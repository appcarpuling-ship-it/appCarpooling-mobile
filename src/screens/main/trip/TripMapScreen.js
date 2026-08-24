import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { MAP_PROVIDER } from '../../../utils/mapProvider';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import { useNotifications } from '../../../context/NotificationContext';
import socketService from '../../../services/socketService';
import { getDirections } from '../../../services/mapsService';
import { useUI } from '../../../theme/ui';
import { buildRoutePoints, kindLabel, quienLabel, ordenarStops, puntosDeRuta } from '../../../utils/routePoints';
import { asientosDePasajero } from '../../../utils/asientosDePasajero';
import { mostrarAvisoLocal } from '../../../services/pushNotificationService';
import { get_withauth, put_withauth, post_withauth, buildImageUri } from '../../../services/apiService';
import RutaPolyline from '../../../components/map/RutaPolyline';
import { iniciarSeguimiento, detenerSeguimiento } from '../../../services/ubicacionBackground';
import { empujarCalificacionPendiente } from '../../../services/calificacionPendiente';
import { useMapFit } from '../../../hooks/useMapFit';
import { ENDPOINTS } from '../../../config/api';
import DraggableSheet, { SCREEN_HEIGHT } from '../../../components/ui/DraggableSheet';
import Rating from '../../../components/ui/Rating';

/** Cada cuánto se reporta la posición del conductor: nada de APIs pagas, solo GPS + socket */
const DRIVER_LOCATION_INTERVAL_MS = 8000;
const DRIVER_LOCATION_DISTANCE_M = 25;
/**
 * Piso de frescura. `watchPositionAsync` sólo avisa cuando el conductor se movió 25 m, así
 * que parado —un semáforo, esperando a que suba alguien— no manda NADA y el pasajero se
 * queda mirando una posición vieja sin saber si sigue siendo la de ahora. Cada minuto se
 * reenvía la última conocida: no agrega precisión, agrega que el dato esté vivo.
 */
const DRIVER_LOCATION_HEARTBEAT_MS = 60000;

/** Lo que ve el PASAJERO en el lugar del conductor: era un círculo negro con una flechita
 * genérica. Un auto de verdad se lee más rápido de un vistazo en un mapa lleno de otras cosas. */
const CAR_ICON = require('../../../../assets/icons/icon-carr.png');

const TripMapScreen = ({ route, navigation }) => {
  // `route.params.trip` es una foto fija de cuando se navegó acá. Si el conductor inició el
  // viaje DESPUÉS de que esa pantalla lo cargara (el caso típico: el pasajero ya tenía el
  // detalle abierto), `status` seguía en "active" para siempre y el efecto de abajo, que
  // depende de isTripStarted, nunca se activaba: el pasajero jamás se sumaba al tracking por
  // socket y no veía el auto. Se refresca el estado una vez al entrar para no arrastrar esa foto vieja.
  const [trip, setTrip] = useState(route.params.trip);

  const refrescarEstadoViaje = useCallback(() => {
    if (!trip?._id) return;
    get_withauth(ENDPOINTS.GET_TRIP(trip._id))
      .then((res) => {
        if (res?.success && res.data?.status) {
          setTrip((prev) => (prev ? { ...prev, status: res.data.status, currentLocation: res.data.currentLocation } : prev));
          // `driverLocation` arrancó con el `currentLocation` de la foto vieja (route.params.trip),
          // que useState solo lee una vez al montar. Sin esto, el auto no aparecía hasta el
          // PRÓXIMO movimiento real del conductor —si no se mueve (GPS quieto o simulador), el
          // pasajero nunca ve nada aunque el conductor ya tenga una posición guardada.
          if (res.data.currentLocation?.latitude) setDriverLocation(res.data.currentLocation);
          setEsperandome(Boolean(res.data.driverWaitingForMe));
        }
      })
      .catch(() => {});
  }, [trip?._id]);

  useEffect(() => { refrescarEstadoViaje(); }, []);
  const insets = useSafeAreaInsets();
  const ui = useUI();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { notifications } = useNotifications();
  const mapRef = useRef(null);
  const isMounted = useRef(true);
  const locationWatchRef = useRef(null);
  // Última coordenada que mandó el GPS, para poder reenviarla si el socket se reconecta
  // después de que ya se perdió el intento original (ver reenviarAlConectar más abajo).
  const ultimaCoordsRef = useRef(null);

  const isDark = ui.isDarkMode;
  const cardBg = ui.surface;
  const textPrimary = ui.text;

  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  // Los marcadores son una vista propia con el número adentro, y en Android eso se dibuja
  // capturando la vista en un bitmap. Si la captura sale antes de que el hijo esté medido,
  // el pin queda sin número. Remontarlos cuando el mapa avisa que está listo fuerza una
  // captura nueva. Antes origen y destino esquivaban esto con PNGs fijos, pero dejaron de
  // servir cuando pasaron a llevar número: el número depende de cuántas paradas haya.
  const [mapReady, setMapReady] = useState(false);
  // Ver `tracksViewChanges` en los marcadores: true el tiempo justo para que se dibujen.
  const [marcadoresVivos, setMarcadoresVivos] = useState(true);

  /**
   * La cámara sigue al conductor hasta que el conductor toca el mapa.
   *
   * Seguir siempre pelea con el usuario: si arrastrás el mapa para ver qué viene más
   * adelante, a los pocos segundos te lo devuelve de un tirón. Se corta con el primer gesto
   * y vuelve con el botón de recentrar, que es lo que hace cualquier navegador.
   *
   * En ref además de estado porque quien la lee es el callback de watchPositionAsync, que se
   * crea una vez y se quedaría con el valor viejo.
   */
  const [siguiendo, setSiguiendo] = useState(true);
  const siguiendoRef = useRef(true);

  const seguirAlConductor = (coords) => {
    if (!siguiendoRef.current || !coords?.latitude) return;
    mapRef.current?.animateCamera({ center: coords }, { duration: 700 });
  };

  const recentrar = () => {
    siguiendoRef.current = true;
    setSiguiendo(true);
    seguirAlConductor(driverLocation);
  };
  const [driverLocation, setDriverLocation] = useState(trip?.currentLocation || null);
  const [showMyLocation, setShowMyLocation] = useState(false);
  // Paradas ya pasadas. Local a la pantalla y a propósito: es una ayuda para manejar, no un
  // estado del viaje — si se reinicia la app se recalcula sola por cercanía.
  const [paradasHechas, setParadasHechas] = useState([]);
  // Id de la parada de recogida donde el conductor ya avisó "Recoger a X" pero todavía no
  // confirmó "Continuar". Mientras esté acá, el botón cambia de "Recoger a X" a "Continuar"
  // SIN avanzar la parada — el conductor sigue ahí, esperando a que suba.
  const [esperandoEnParada, setEsperandoEnParada] = useState(null);

  const originCoords = trip?.origin?.coordinates;
  const destCoords = trip?.destination?.coordinates;
  // Misma lista que el detalle del viaje: la numeración y el descarte de las paradas que
  // caen encima del origen o del destino viven en utils/routePoints. Esas paradas encimadas
  // son las que tapaban el marcador del origen y hacían desaparecer el número 1.
  // Sólo las que tienen coordenadas: se usan para los waypoints de Directions, para
  // encuadrar el mapa y para calcular la próxima parada, y las tres las desreferencian.
  const stops = buildRoutePoints(trip)
    .filter((p) => p.kind !== 'origin' && p.kind !== 'destination')
    .map((p) => p.location)
    .filter((s) => s?.coordinates?.latitude != null && s?.coordinates?.longitude != null);

  const routePoints = buildRoutePoints(trip)
    .filter((p) => p.location?.coordinates?.latitude != null)
    .map((p) => ({
      coordinate: {
        latitude: p.location.coordinates.latitude,
        longitude: p.location.coordinates.longitude,
      },
      address: p.location.address || p.location.city
        || (p.kind === 'origin' ? 'Origen' : p.kind === 'destination' ? 'Destino' : 'Parada'),
      kindLabel: kindLabel(p.kind),
      quien: quienLabel(p.kind, p.passenger),
      isEnd: p.isEnd,
    }));

  const userId = user?._id || user?.id;
  // El viaje llega de dos lados y con el conductor en dos formas: el detalle lo popula
  // (objeto) y "mis viajes como conductor" no (ObjectId pelado). Sin el último caso, al
  // abrir el mapa solo desde Home la app creía que NO eras el conductor: no salía la
  // tarjeta de "Yendo a", te dibujaba a vos como si fueras otro auto, y encima no emitía
  // tu posición, así que los pasajeros no te veían moverte.
  const driverId = trip?.driver?._id || trip?.driver?.id || trip?.driver;
  const isDriver = Boolean(userId && driverId && String(userId) === String(driverId));
  const isTripStarted = trip?.status === 'started';
  // Sólo el conductor en viaje tiene su propia posición en estado (la del watchPositionAsync
  // que ya corre para avisarles a los pasajeros). Para el resto sigue el punto nativo.
  const dibujamosNuestroPunto = Boolean(isDriver && isTripStarted && driverLocation?.latitude);

  // "El conductor te espera": arranca con lo que ya diga el server al entrar (driverWaitingForMe,
  // ver refrescarEstadoViaje) y se corrige en vivo con trip:pickup-status más abajo. Lo abre y
  // lo cierra el CONDUCTOR (Recoger a X / Continuar) — el pasajero no tiene ninguna acción acá,
  // por eso no depende de si vio o no la notificación ni tiene botón propio.
  const [esperandome, setEsperandome] = useState(false);

  // El estado general del viaje (completado, cancelado) no era en vivo: el pasajero solo lo
  // veía si salía y volvía a entrar a esta pantalla. Se apoya en el mismo NotificationContext:
  // cuando llega el aviso de que el viaje terminó, se vuelve a pedir el viaje. Cortado por
  // isTripStarted para no repetir el pedido en cada notificación nueva que llegue después:
  // una vez que el status deja de ser "started" esta condición ya no se cumple más.
  useEffect(() => {
    if (isDriver || !isTripStarted) return;
    const huboCambioDeEstado = notifications.some((n) => (
      ['trip_completed', 'trip_cancelled'].includes(n?.type)
      && String(n.relatedTrip?._id || n.relatedTrip) === String(trip?._id)
    ));
    if (huboCambioDeEstado) refrescarEstadoViaje();
  }, [notifications, isDriver, isTripStarted]);

  /**
   * El conductor completó el viaje y el pasajero está mirando el mapa.
   *
   * Se lo saca de ahí: el mapa de un viaje terminado no sirve para nada y quedarse mirándolo
   * es la peor forma de enterarse de que llegaste. Va al home y de una a calificar, que es
   * el momento en que se acuerda de cómo estuvo el viaje.
   *
   * `reintentos`: el backend crea la calificación pendiente al completar, y el aviso puede
   * llegar antes de que esté escrita. Si no está todavía, insiste una vez.
   */
  const yaSalioDelViaje = useRef(false);
  useEffect(() => {
    if (isDriver || yaSalioDelViaje.current) return;
    if (trip?.status !== 'completed') return;
    yaSalioDelViaje.current = true;
    navigation.popToTop();
    empujarCalificacionPendiente({ forzar: true, reintentos: 2 });
  }, [trip?.status, isDriver, navigation]);

  useEffect(() => {
    if (!mapReady) return undefined;
    const t = setTimeout(() => setMarcadoresVivos(false), 900);
    return () => clearTimeout(t);
  }, [mapReady]);

  // Mismo problema que arriba (Android, captura en bitmap) pero para el ícono del auto: éste
  // no existe desde el arranque como los de las paradas, aparece recién cuando llega la
  // posición del conductor (por el fetch inicial o por socket) — a veces mucho después de que
  // `marcadoresVivos` ya bajó a false. Sin esto el auto quedaba invisible en Android siempre
  // que apareciera tarde, que es el caso normal.
  //
  // Depende TAMBIÉN de isTripStarted: los dos marcadores que usan esto (el auto y el punto
  // propio del conductor) sólo se montan con el viaje en curso. Si la ubicación ya existía
  // al abrir el mapa —lo normal— el temporizador se consumía antes de que el marcador
  // existiera, y al tocar "Iniciar viaje" nacía con la captura ya apagada: invisible.
  const [autoMarkerVivo, setAutoMarkerVivo] = useState(true);
  useEffect(() => {
    if (!driverLocation?.latitude || !isTripStarted) return undefined;
    setAutoMarkerVivo(true);
    const t = setTimeout(() => setAutoMarkerVivo(false), 900);
    return () => clearTimeout(t);
  }, [Boolean(driverLocation?.latitude), isTripStarted]);

  useEffect(() => {
    isMounted.current = true;
    let reintento;
    (async () => {
      const trazada = await fetchRoute();
      // Directions falla por cosas pasajeras: el 429 de la API cuando varias pantallas piden
      // a la vez, o la red del celular justo al arrancar el viaje. No había segundo intento,
      // así que el mapa se quedaba sin ninguna línea hasta salir y volver a entrar.
      if (!trazada && isMounted.current) reintento = setTimeout(fetchRoute, 2500);
    })();
    return () => { isMounted.current = false; clearTimeout(reintento); };
  }, []);

  // El punto azul, siempre y para cualquiera que mire el mapa. Antes sólo aparecía con el
  // viaje en curso, así que al abrir un punto de recogida no había con qué saber si te
  // queda cerca o cruzando la ciudad.
  useEffect(() => {
    let cancelled = false;
    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => { if (!cancelled && status === 'granted') setShowMyLocation(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Ubicación en vivo del conductor: se comparte por socket (sin costo de API), no por polling ni geocodificación.
  // Además, con el viaje en curso, cada uno (conductor o pasajero) ve su propio punto azul nativo
  // vía showsUserLocation — no hace falta watchPositionAsync propio para eso, solo el permiso.
  useEffect(() => {
    if (!trip?._id || !isTripStarted) return;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== 'granted') return;

      if (isDriver) {
        locationWatchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: DRIVER_LOCATION_INTERVAL_MS,
            distanceInterval: DRIVER_LOCATION_DISTANCE_M,
          },
          (loc) => {
            const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, heading: loc.coords.heading };
            // También en estado: es el punto por donde se corta el trazado en recorrido y
            // pendiente. El conductor no se ve a sí mismo con driverLocation (eso es lo que
            // reciben los pasajeros por socket), así que sin esto no habría por dónde cortar.
            setDriverLocation(coords);
            seguirAlConductor(coords);
            ultimaCoordsRef.current = coords;
            socketService.sendTripLocationUpdate(trip._id, coords);
          }
        );
      }
    })();

    // socketService recuerda la sala y la vuelve a pedir en cada 'connect', así que alcanza
    // con pedirla una vez: cubre tanto el caso de que el socket todavía no haya conectado
    // como una reconexión a mitad de viaje.
    const unirseAlTracking = () => socketService.joinTripTracking(trip._id);
    // Mismo problema que el del pasajero, del lado del conductor: si el GPS entrega la
    // primera lectura antes de que el socket termine de conectar, sendTripLocationUpdate no
    // hace nada (silencioso) y watchPositionAsync no vuelve a llamar hasta que el conductor se
    // mueva 25m — si se queda quieto (probando, o esperando), el viaje se queda SIN ninguna
    // ubicación guardada. Al reconectar, reenvía la última posición conocida.
    const reenviarAlConectar = () => {
      if (ultimaCoordsRef.current) socketService.sendTripLocationUpdate(trip._id, ultimaCoordsRef.current);
    };

    // Latido: mantiene fresca la última posición aunque el conductor no se mueva. Sólo
    // reenvía lo que ya tenía, no pide GPS de nuevo, así que no gasta batería extra.
    const latido = isDriver
      ? setInterval(() => {
          if (ultimaCoordsRef.current) socketService.sendTripLocationUpdate(trip._id, ultimaCoordsRef.current);
        }, DRIVER_LOCATION_HEARTBEAT_MS)
      : null;
    // "El conductor te espera": vive en el trip (driverWaitingFor) y llega en vivo por este
    // evento propio, no por notification:new — así el cartel no depende de si la notificación
    // se marcó como leída ni compite por el listener único que ya usa NotificationContext.
    const onPickupStatus = (data) => {
      if (data?.tripId === trip._id) setEsperandome(Boolean(data.waiting));
    };

    if (!isDriver) {
      // Pasajero: solo escucha la posición ya calculada por el conductor, sin llamadas propias.
      unirseAlTracking();
      socketService.socket?.on('trip:pickup-status', onPickupStatus);
      socketService.onTripLocation((data) => {
        if (data?.tripId === trip._id) {
          setDriverLocation({ latitude: data.latitude, longitude: data.longitude, heading: data.heading });
        }
      });
    } else {
      socketService.socket?.on('connect', reenviarAlConectar);
    }

    return () => {
      cancelled = true;
      if (latido) clearInterval(latido);
      if (!isDriver) {
        socketService.socket?.off('trip:pickup-status', onPickupStatus);
      } else {
        socketService.socket?.off('connect', reenviarAlConectar);
      }
      locationWatchRef.current?.remove?.();
      locationWatchRef.current = null;
      if (!isDriver) {
        socketService.leaveTripTracking(trip._id);
        socketService.removeListener('trip:location');
      }
    };
  }, [trip?._id, isTripStarted, isDriver]);

  /**
   * Seguimiento en SEGUNDO PLANO, sólo para el conductor y sólo con el viaje en curso.
   *
   * A propósito NO se corta al desmontar esta pantalla: el punto de todo esto es que siga
   * reportando cuando el conductor sale del mapa o minimiza la app. Se corta cuando el viaje
   * deja de estar en curso, que es abajo, y al completarlo desde el botón.
   *
   * Si el conductor no da el permiso "Siempre", no pasa nada malo: sigue funcionando el
   * seguimiento en primer plano, que es el que ya andaba.
   */
  useEffect(() => {
    if (!isDriver || !trip?._id) return;
    if (isTripStarted) {
      iniciarSeguimiento(trip._id).then((ok) => {
        if (!ok) console.log('[mapa] sin permiso de ubicación en segundo plano; queda sólo el de primer plano');
      });
    } else {
      // Cubre el viaje completado o cancelado desde otro lado (el detalle, otro dispositivo).
      detenerSeguimiento();
    }
  }, [isDriver, trip?._id, isTripStarted]);

  // El encuadre espera a que el mapa esté listo: ver useMapFit. Con el setTimeout de antes,
  // si el mapa tardaba más de 400 ms en inicializar la cámara se quedaba en la región inicial
  // —un cuadrito alrededor del origen— y de la ruta se veía sólo el principio.
  const fitTo = useMapFit(mapRef, mapReady, { top: 80, right: 40, bottom: 80, left: 40 });

  /**
   * El sheet de abajo tapa parte del mapa, así que cuando cambia de altura hay que
   * reencuadrar para que el trazado siga entero por encima de él.
   *
   * `useMapFit` fija el padding en el momento en que se llama el hook (no reacciona a que
   * cambie después), así que un simple cambio de padding no alcanza: hay que volver a pedir
   * el encuadre a mano, con el padding de abajo actualizado. Por eso se recuerdan los
   * últimos puntos que se usaron para encuadrar — son distintos según el momento del viaje
   * (con/sin trazado, con/sin conductor en curso) — y se re-piden con el padding nuevo.
   */
  const lastFitPointsRef = useRef([]);
  const fitToAndRemember = (pts) => { lastFitPointsRef.current = pts; fitTo(pts); };
  const [sheetHeight, setSheetHeight] = useState(0);
  const onSheetSnap = (_index, heightPx) => {
    setSheetHeight(heightPx);
    if (lastFitPointsRef.current.length) {
      mapRef.current?.fitToCoordinates(lastFitPointsRef.current, {
        edgePadding: { top: 80, right: 40, bottom: heightPx + 40, left: 40 },
        animated: true,
      });
    }
  };

  /** Lo que se pueda encuadrar aunque no haya trayecto: origen, paradas y destino que tengan coords. */
  const markerCoords = () => [
    originCoords?.latitude && { latitude: originCoords.latitude, longitude: originCoords.longitude },
    ...stops.map(s => ({ latitude: s.coordinates.latitude, longitude: s.coordinates.longitude })),
    destCoords?.latitude && { latitude: destCoords.latitude, longitude: destCoords.longitude },
  ].filter(Boolean);


  /**
   * Las paradas del recorrido en el orden en que se van a pisar: los puntos de los pasajeros
   * más el destino final. El origen no entra, porque de ahí ya salió.
   *
   * Se ordenan por su posición SOBRE EL TRAZADO, no por `order` —que es el orden en que se
   * pagaron las reservas— ni por distancia en línea recta. Con el orden de pago, a alguien
   * que reservó último le tocaba figurar primero aunque su parada estuviera 200km más
   * adelante, y el conductor veía una lista que no era el camino.
   */
  const navTargets = useMemo(() => {
    // Acá van TODAS las paradas de pasajeros, incluidas las que caen encima del origen o del
    // destino. Esas se descartan para los marcadores —dos pines en el mismo lugar se tapan—
    // pero para el conductor no son un duplicado: que Benjamín suba en la dirección de salida
    // es justo lo que necesita saber al arrancar, y si se filtra no aparece por ningún lado.
    //
    // El ORDEN sale de ordenarStops, el mismo que usa el detalle del viaje: si cada pantalla
    // ordenara por su cuenta, el conductor y el pasajero verían recorridos distintos.
    const paradas = ordenarStops(trip)
      .filter((st) => st?.coordinates?.latitude != null && st?.coordinates?.longitude != null)
      .map((st, i) => ({
        id: `stop-${i}`,
        coordinate: { latitude: st.coordinates.latitude, longitude: st.coordinates.longitude },
        address: st.address || st.city || 'Parada',
        quien: quienLabel(st.kind, st.passenger),
        // kind y pasajero se guardan para el aviso de cobro al dejar a alguien: sin ellos no se
        // sabe si esta parada es una bajada ni a quién hay que cobrarle.
        kind: st.kind,
        pasajero: st.passenger,
      }));

    // El destino va último y solo. No es una parada de nadie —por eso no lleva "a recoger a"
    // ni "a dejar a"— pero sí es a dónde va el conductor una vez que bajó el último pasajero,
    // y ahí es donde cierra el viaje.
    return [
      ...paradas,
      destCoords?.latitude != null && {
        id: 'destino',
        coordinate: { latitude: destCoords.latitude, longitude: destCoords.longitude },
        address: trip?.destination?.address || trip?.destination?.city || 'Destino',
        quien: 'A finalizar el viaje',
      },
    ].filter(Boolean);
  }, [trip?.intermediateStops, destCoords?.latitude, destCoords?.longitude]);

  const pendientes = navTargets.filter((t) => !paradasHechas.includes(t.id));
  const proximaParada = pendientes[0] || null;
  const enElDestino = proximaParada?.id === 'destino';

  /**
   * "Continuar" no decía qué iba a pasar al tocarlo. En una parada de recogida son DOS toques:
   * "Recoger a X" avisa al pasajero pero no avanza (el conductor sigue ahí, esperando), y una
   * vez que ya avisó el botón pasa a "Continuar" — ESE toque es el que avanza de verdad y le
   * saca el cartel de espera al pasajero. Sin nombre (parada vieja sin el pasajero poblado)
   * cae directo a "Continuar", nunca a un "Recoger a undefined".
   */
  const esRecogidaPendienteDeAviso =
    proximaParada?.kind === 'pickup'
    && proximaParada?.pasajero?.firstName
    && esperandoEnParada !== proximaParada.id;

  const textoBoton = enElDestino
    ? 'Completar'
    : esRecogidaPendienteDeAviso
      ? `Recoger a ${proximaParada.pasajero.firstName}`
      : 'Continuar';

  /**
   * Cerrar el viaje desde el mapa. El conductor llega al destino y el botón deja de decir
   * "Continuar" para decir "Completar": no tiene por qué volver atrás a buscar dónde estaba
   * esa acción. Es el mismo endpoint que usa el detalle del viaje.
   *
   * Ya no se piden gastos: lo que cobra lo fijó al publicar el viaje (`driverPrice`) y el
   * pasajero lo vio antes de reservar, así que no hay nada que cargar al final.
   *
   * trip.passengers tiene una entrada POR ASIENTO, no por pasajero, así que su largo son los
   * asientos ocupados.
   */
  /**
   * Iniciar el viaje desde el mapa. Es el PRIMER estado del botón: antes de arrancar, el
   * conductor abría el mapa y no tenía nada para tocar — el botón recién aparecía con el
   * viaje ya iniciado, así que tenía que volver al detalle a buscar dónde arrancarlo.
   *
   * Iniciar tarde está permitido a propósito (ver el guard en tripController.startTrip):
   * un viaje que no se puede iniciar tampoco se puede completar, y ahí el conductor nunca
   * cobra.
   */
  const [iniciando, setIniciando] = useState(false);
  const iniciarViaje = async () => {
    if (iniciando) return;
    setIniciando(true);
    try {
      const res = await put_withauth(ENDPOINTS.START_TRIP(trip._id), {});
      if (res?.success) {
        // Se actualiza en el acto para que el botón pase solo a "Continuar" y arranque el
        // seguimiento, sin salir y volver a entrar.
        setTrip((prev) => (prev ? { ...prev, status: 'started' } : prev));
        return;
      }
      showAlert('No se pudo iniciar', res?.message || 'Probá de nuevo en un momento.');
    } catch (error) {
      showAlert('No se pudo iniciar', error?.message || 'Probá de nuevo en un momento.');
    } finally {
      setIniciando(false);
    }
  };

  const submitCompleteTrip = async () => {
    try {
      const response = await put_withauth(ENDPOINTS.COMPLETE_TRIP(trip._id), {});
      if (response.success) {
        // Antes de navegar: el viaje terminó y no hay nada más que reportar. Dejarlo vivo
        // sería seguir gastando batería y mostrando la notificación permanente de Android.
        await detenerSeguimiento();
        // El mapa queda debajo en el stack: sin esto, volver atrás desde el resultado te
        // devolvía al mapa de un viaje ya terminado, con su tarjeta y su botón.
        navigation.popToTop();
        // Sin montos: el cobro ya se le recordó al bajar cada pasajero, y acá repetirlo
        // convierte el cierre del viaje en una factura. Es el momento de cerrar, no de cobrar.
        navigation.navigate('Result', {
          type: 'success',
          title: 'Viaje completado',
          message: 'Completaste el viaje. ¡Gracias por usar Carpuling!',
        });
        return;
      }
      navigation.navigate('Result', {
        type: 'error',
        title: 'No se pudo completar',
        message: response.message || 'Probá de nuevo en un momento.',
      });
    } catch (error) {
      navigation.navigate('Result', {
        type: 'error',
        title: 'No se pudo completar',
        message: error.message || 'Error al completar el viaje',
        error,
      });
    }
  };

  /**
   * Al dejar a un pasajero, recordarle al conductor que le cobre. El monto es el que él mismo
   * publicó al crear el viaje y el pasajero ya vio antes de reservar: acá no se decide nada,
   * sólo se recuerda en el momento en que hay que cobrarlo, que es cuando la persona se baja.
   *
   * Va como NOTIFICACIÓN y no como alert. Era un modal con un botón "Listo, cobrado", y tenía
   * tres problemas: pedía un segundo toque manejando, tapaba el mapa, y ese botón prometía un
   * registro de cobro que no existe en ningún lado. Así baja, se lee y se va sola.
   *
   * No bloquea el avance: la parada se marca igual, en paralelo.
   */
  const avisarCobro = async (parada) => {
    const precio = Math.max(0, Number(trip?.driverPrice) || 0);
    if (precio <= 0 || parada?.kind !== 'dropoff') return;

    const nombre = parada?.pasajero?.firstName || 'El pasajero';
    const asientos = asientosDePasajero(trip, parada.pasajero);
    const total = precio * asientos;
    const titulo = 'Recordatorio de cobro';
    const cuerpo = asientos > 1
      ? `${nombre} llegó a su destino, recordá cobrarle $${total.toLocaleString('es-AR')} de tu viaje ($${precio.toLocaleString('es-AR')} × ${asientos} asientos).`
      : `${nombre} llegó a su destino, recordá cobrarle $${total.toLocaleString('es-AR')} de tu viaje.`;

    // Sin permiso de notificaciones no aparece nada, y quedarse sin el recordatorio del cobro es
    // peor que un modal: ahí sí cae al alert.
    const mostrada = await mostrarAvisoLocal({ title: titulo, body: cuerpo });
    if (!mostrada) showAlert(titulo, cuerpo);
  };

  /**
   * Avisarle al PASAJERO (su teléfono, no el del conductor) que el conductor llegó a
   * buscarlo. A diferencia de avisarCobro, esto no es un recordatorio local: tiene que
   * cruzar a otro dispositivo, así que pasa por el backend (POST notify-arrival), que
   * entrega por push + socket + queda guardado en sus notificaciones.
   *
   * No bloquea el avance ni lo frena un error: si el push falla, el conductor ya está ahí
   * igual, y la parada se marca de todos modos.
   */
  const avisarLlegadaRecogida = async (parada) => {
    if (parada?.kind !== 'pickup') return;
    const passengerId = parada?.pasajero?._id || parada?.pasajero;
    if (!passengerId) return;
    try {
      await post_withauth(ENDPOINTS.NOTIFY_PICKUP_ARRIVAL(trip._id), { passengerId });
    } catch {
      // El conductor ya está en la parada aunque el aviso falle; no tiene sentido frenarlo acá.
    }
  };

  // Segundo toque de una recogida: le saca el cartel de espera al pasajero. Lo cierra el
  // conductor (acá), no el pasajero — es él quien sabe si ya arrancó de nuevo.
  const confirmarRecogida = async (parada) => {
    const passengerId = parada?.pasajero?._id || parada?.pasajero;
    if (!passengerId) return;
    try {
      await post_withauth(ENDPOINTS.CONFIRM_PICKUP(trip._id), { passengerId });
    } catch {
      // El pasajero se queda con el cartel un rato de más si esto falla; no frena al conductor.
    }
  };

  const avanzar = () => {
    if (enElDestino) {
      submitCompleteTrip();
      return;
    }
    const parada = proximaParada;
    if (esRecogidaPendienteDeAviso) {
      // "Recoger a X": solo avisa. El conductor se queda en esta parada hasta el próximo toque.
      setEsperandoEnParada(parada.id);
      avisarLlegadaRecogida(parada);
      return;
    }
    // "Continuar": acá sí avanza de verdad.
    setParadasHechas((prev) => [...prev, parada.id]);
    setEsperandoEnParada(null);
    avisarCobro(parada);
    if (parada.kind === 'pickup') confirmarRecogida(parada);
  };

  // Al pasar cerca se marca sola: pedirle al conductor que toque un botón en cada parada es
  // pedirle que maneje y opere el teléfono al mismo tiempo. El botón queda igual, por si el
  // GPS no la detecta o se saltea una parada.
  // Nada de marcar paradas solo por cercanía: el conductor arranca PARADO en el origen, que
  // suele ser también el punto de recogida de alguien, y esa parada se daba por hecha antes
  // de que llegara a verla. Avanza él con el botón, que es lo único predecible.


  const fetchRoute = async () => {
    // SIN trazado guardado. Se calcula siempre con las coordenadas reales del viaje: origen,
    // las paradas de cada pasajero en el orden del camino, y destino.
    //
    // El trazado que se guardaba al crear el viaje se calculaba ANTES de que existiera
    // ninguna reserva, así que nunca contemplaba los puntos de recogida ni de bajada, y
    // tampoco se recalculaba al agregar una parada. Se dibujaba un recorrido que no pasaba
    // por donde el conductor tiene que pasar. Como las coordenadas de cada punto ya quedan
    // guardadas en el viaje, la ruta se puede pedir completa y correcta cada vez.
    //
    // Falta una punta: no hay trayecto posible, pero igual se encuadra lo que haya.
    // Antes salía sin centrar y el mapa quedaba en la región inicial, lejos del viaje.
    if (!originCoords?.latitude || !destCoords?.latitude) {
      fitToAndRemember(markerCoords());
      setLoading(false);
      return true; // sin puntas no hay nada que reintentar
    }
    try {
      const orig = `${originCoords.latitude},${originCoords.longitude}`;
      const dest = `${destCoords.latitude},${destCoords.longitude}`;
      let waypointsParam;
      if (stops.length > 0) {
        waypointsParam = stops.map(s => `${s.coordinates.latitude},${s.coordinates.longitude}`).join('|');
      }
      const data = await getDirections(orig, dest, waypointsParam);
      if (!isMounted.current) return;
      if (data.routes?.length > 0) {
        const r = data.routes[0];
        // Con el detalle de los steps, que es el que sigue las calles: ver puntosDeRuta.
        const points = puntosDeRuta(r);
        if (points.length > 0) {
          setRouteCoordinates(points);
          fitToAndRemember(points);
          return true;
        }
        sinRuta();
      } else if (waypointsParam) {
        // Sin rutas con las paradas puestas (ZERO_RESULTS, demasiados waypoints, un punto
        // que no cae sobre una calle): se reintenta el tramo origen→destino. Es peor que la
        // ruta completa pero muchísimo mejor que un mapa sin ninguna línea, que es lo que
        // pasaba. Los marcadores siguen mostrando dónde está cada parada.
        console.warn('[TripMap] Directions no devolvió ruta con paradas; se reintenta sin ellas');
        const simple = await getDirections(orig, dest);
        if (!isMounted.current) return;
        const pts = puntosDeRuta(simple.routes?.[0]);
        if (pts.length > 0) {
          setRouteCoordinates(pts);
          fitToAndRemember(pts);
          return true;
        }
        sinRuta();
      } else {
        sinRuta();
      }
    } catch (e) {
      sinRuta();
    } finally {
      if (isMounted.current) setLoading(false);
    }
    return false;
  };

  /**
   * Directions no dio nada. Se une lo que hay —origen, paradas y destino— con una recta.
   *
   * No sigue las calles y se ve feo, pero un mapa con los marcadores y NINGUNA línea es
   * indistinguible de un mapa roto: no hay forma de saber si el viaje no tiene ruta o si la
   * petición se cayó. Con la recta al menos se lee el viaje, y se nota que es provisoria.
   *
   * ponytail: con el viaje empezado, el corte de "recorrido / pendiente" se calcula sobre esta
   * recta y el avance queda aproximado. Es preferible a no dibujar nada.
   */
  const sinRuta = () => {
    const puntos = markerCoords();
    if (puntos.length > 1) setRouteCoordinates(puntos);
    fitToAndRemember(puntos);
  };


  const initialRegion = originCoords?.latitude
    ? { latitude: originCoords.latitude, longitude: originCoords.longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 }
    : { latitude: -34.6037, longitude: -58.3816, latitudeDelta: 2, longitudeDelta: 2 };

  /**
   * Contenido del sheet de abajo. Estilo Uber: un peek con lo justo para no perder de vista
   * el viaje, un medio con el resumen (a quién le pagás/quién te paga, el recorrido), y un
   * expandido con la lista completa de paradas — la misma numeración que ven los marcadores
   * del mapa, para que las dos vistas cuenten la misma historia.
   */
  const PEEK = 108 + insets.bottom;
  const MID = Math.round(SCREEN_HEIGHT * 0.42);
  const FULL = Math.round(SCREEN_HEIGHT * 0.82);

  const precioTag = (() => {
    if (trip?.sinPrecioFijo) return { texto: 'Gastos compartidos', icon: 'people-outline' };
    const precio = Math.max(0, Number(trip?.driverPrice) || 0);
    if (precio > 0) return { texto: `$${precio.toLocaleString('es-AR')} por asiento`, icon: 'cash-outline' };
    return null;
  })();

  // `trip.passengers` tiene UNA ENTRADA POR ASIENTO, no por persona: si benjamin reservó 2
  // asientos, aparece dos veces. El total de asientos ocupados sale de ahí tal cual — pero
  // para LISTAR pasajeros hay que agrupar, o el mismo nombre se repite tantas veces como
  // asientos tenga.
  const asientosOcupados = (trip?.passengers || []).length;
  const pasajerosUnicos = useMemo(() => {
    const porId = new Map();
    (trip?.passengers || []).forEach((p) => {
      const id = String(p?._id || p);
      const actual = porId.get(id);
      if (actual) actual.asientos += 1;
      else porId.set(id, { ...p, asientos: 1 });
    });
    return Array.from(porId.values());
  }, [trip?.passengers]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <MapView
        ref={mapRef}
        provider={MAP_PROVIDER}
        style={styles.map}
        initialRegion={initialRegion}
        paddingAdjustmentBehavior="never"
        // La parte de abajo tapada por el sheet no cuenta como mapa "visible" para los
        // controles nativos (brújula, etc). El reencuadre real, con el trazado, lo hace
        // fitToAndRemember/onSheetSnap — esto es sólo para que esos controles no queden
        // atrás del sheet.
        mapPadding={{ top: 0, right: 0, bottom: sheetHeight, left: 0 }}
        // El punto nativo es la ubicación propia, y el pasajero no la necesita acá: ya ve al
        // conductor, que es lo que le importa. Para el conductor, salvo cuando lo dibujamos
        // nosotros (abajo): el SDK lo pinta por encima de los overlays pero POR DEBAJO de los
        // marcadores, y no hay zIndex que lo arregle. Con el viaje en curso el conductor
        // quedaba tapado por el número de la parada justo al llegar a ella.
        showsUserLocation={isDriver && showMyLocation && !dibujamosNuestroPunto}
        onMapReady={() => setMapReady(true)}
        // `isGesture` distingue el arrastre del usuario de los movimientos que hacemos
        // nosotros (encuadre inicial, seguimiento): sin eso, la propia cámara se apagaría sola.
        onRegionChangeComplete={(r, detalles = {}) => {
          if (!detalles.isGesture || !siguiendoRef.current) return;
          siguiendoRef.current = false;
          setSiguiendo(false);
        }}
      >
        {!isDriver && isTripStarted && driverLocation?.latitude && (
          <Marker
            coordinate={{ latitude: driverLocation.latitude, longitude: driverLocation.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={driverLocation.heading || 0}
            flat
            tracksViewChanges={autoMarkerVivo}
          >
            <Image source={CAR_ICON} style={styles.driverCarIcon} resizeMode="contain" />
          </Marker>
        )}

        {/* Un solo recorrido para los tres tipos de punto: la numeración es la misma
            secuencia que muestra el detalle del viaje (origen 1, destino el más alto), y
            tenerla en un solo lugar evita que las dos pantallas se contradigan.
            Origen y destino usaban PNG fijos en Android; ya no pueden, porque el número
            cambia según cuántas paradas tenga el viaje. */}
        {routePoints.map((point, i) => (
          <Marker
            key={`pt-${i}-${mapReady}`}
            coordinate={point.coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            // Por debajo del punto azul: el SDK dibuja la ubicación propia sobre los overlays,
            // pero un marcador con zIndex alto se le pone encima y el conductor se pierde a sí
            // mismo justo cuando pasa por una parada.
            zIndex={1}
            // Android redibuja la vista del marcador en cada frame mientras `tracksViewChanges`
            // esté en true, y eso es el parpadeo de los numeritos. Se apaga apenas el marcador
            // termina de dibujarse: si se apagara desde el arranque, saldrían en blanco.
            tracksViewChanges={marcadoresVivos}
          >
            <View style={[styles.routeMarker, point.isEnd && styles.routeMarkerEnd]}>
              <Text style={styles.routeMarkerNum}>{i + 1}</Text>
            </View>
          </Marker>
        ))}

        {/* El recorrido completo, en negro y de una sola pieza. Estuvo partido en "ya
            recorrido" (gris) y "pendiente", pero el corte se calculaba por cercanía al auto y
            se equivocaba de las dos formas posibles: enganchaba un tramo por el que el
            trazado vuelve a pasar, o pintaba como hechas las cuadras que faltaban. Un dato
            que miente es peor que no darlo. */}
        <RutaPolyline coordinates={routeCoordinates} width={6} color="#000000" />
        {/* Nuestra posición, por encima de las paradas. Mismo aspecto que el punto nativo. */}
        {dibujamosNuestroPunto && (
          <Marker
            coordinate={{ latitude: driverLocation.latitude, longitude: driverLocation.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={10}
            flat
            // Mismo motivo que el auto de acá arriba: en Android un marcador con vista propia
            // y `tracksViewChanges` en false desde el primer render se dibuja EN BLANCO. Este
            // estaba hardcodeado en false, así que el conductor se quedaba sin su punto azul
            // justo al iniciar el viaje — que es cuando se apaga el nativo para poner este.
            tracksViewChanges={autoMarkerVivo}
          >
            <View style={styles.miPuntoHalo}>
              <View style={styles.miPunto} />
            </View>
          </Marker>
        )}
      </MapView>


      {/* Back button */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: cardBg }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color={textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Antes vivía acá un cartel "Yendo a" con esta misma dirección. Con el sheet de abajo
          ya no hace falta: su header le dice al conductor exactamente lo mismo (la próxima
          parada), y el cartel flotante sólo lograba pisarse con el botón de abajo cuando el
          sheet estaba expandido — los dos flotaban sobre el mismo punto de la pantalla. */}

      {/* Iniciar viaje: el primer estado del botón. Mismo lugar y mismo tamaño que
          "Continuar", así el conductor toca siempre en el mismo lado.
          `Math.min(sheetHeight, MID)`: si el conductor expande el sheet del todo, el botón
          NO lo sigue hasta arriba — se queda esperando a la altura del punto medio, así
          nunca termina flotando por encima del back button o del status bar. */}
      {isDriver && !isTripStarted && trip?.status === 'active' && (
        <View style={[styles.navFooter, { bottom: Math.min(sheetHeight, MID) + 12, paddingBottom: 4 }]}>
          <TouchableOpacity
            style={styles.navContinuar}
            onPress={iniciarViaje}
            activeOpacity={0.85}
            disabled={iniciando}
            accessibilityRole="button"
            accessibilityLabel="Iniciar el viaje"
          >
            <Text style={styles.navContinuarText}>
              {iniciando ? 'Iniciando…' : 'Iniciar viaje'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Continuar: pasa a la parada siguiente. Abajo y ancho, para tocarlo sin mirar; el
          check chiquito arriba a la derecha no se entendía ni se acertaba manejando. */}
      {isDriver && isTripStarted && proximaParada && (
        <View style={[styles.navFooter, { bottom: Math.min(sheetHeight, MID) + 12, paddingBottom: 4 }]}>
          <TouchableOpacity
            style={styles.navContinuar}
            onPress={avanzar}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={enElDestino ? 'Completar el viaje' : textoBoton}
          >
            <Text style={styles.navContinuarText}>{textoBoton}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* El conductor te está esperando: mismo cartel que ve él ("Yendo a"), para el pasajero.
          Sin botón acá a propósito — lo cierra el conductor con "Continuar" del lado suyo
          (ver confirmarRecogida), no una acción del pasajero. Sale y entra sola por
          trip:pickup-status, o al abrir esta pantalla si ya estaba así (driverWaitingForMe). */}
      {!isDriver && isTripStarted && esperandome && (
        <View style={[styles.navCard, { backgroundColor: cardBg, top: insets.top + 56 }]}>
          <Text style={[styles.navLabel, { color: ui.textMuted }]}>Conductor esperando</Text>
          <Text style={[styles.navAddress, { color: textPrimary }]} numberOfLines={2}>
            {`El conductor ${[trip?.driver?.firstName, trip?.driver?.lastName].filter(Boolean).join(' ')}`}
          </Text>
          <Text style={[styles.navQuien, { color: ui.textMuted }]} numberOfLines={1}>
            Está esperándote afuera
          </Text>
        </View>
      )}

      {/* Recentrar. Sólo aparece cuando dejó de seguir, que es cuando sirve. */}
      {isDriver && isTripStarted && !siguiendo && driverLocation?.latitude && (
        <TouchableOpacity
          style={[styles.recentrarBtn, { backgroundColor: cardBg, bottom: Math.min(sheetHeight, MID) + (proximaParada ? 84 : 16) }]}
          onPress={recentrar}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Volver a centrar en mi ubicación"
        >
          <Ionicons name="locate" size={22} color={textPrimary} />
        </TouchableOpacity>
      )}

      <DraggableSheet
        snapPoints={[PEEK, MID, FULL]}
        initialIndex={1}
        onSnapChange={onSheetSnap}
        style={{ backgroundColor: cardBg }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
        header={
          <View style={styles.sheetHeader}>
            {isDriver ? (
              <>
                <View style={[styles.sheetAvatarFallback, { backgroundColor: ui.bg }]}>
                  <Ionicons name="navigate" size={20} color={textPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetTitle, { color: textPrimary }]} numberOfLines={1}>
                    {isTripStarted ? (proximaParada?.address || 'En camino') : 'Antes de arrancar'}
                  </Text>
                  <Text style={[styles.sheetSubtitle, { color: ui.textMuted }]} numberOfLines={1}>
                    {/* A quién va a buscar/dejar, si el viaje está en curso — es la misma info
                        que antes vivía en el cartel "Yendo a" flotante, que se sacó porque
                        duplicaba esto y además chocaba con el botón de abajo. */}
                    {isTripStarted && proximaParada?.quien
                      ? proximaParada.quien
                      : asientosOcupados > 0 ? `${asientosOcupados} pasajero(s)` : 'Sin pasajeros todavía'}
                  </Text>
                </View>
              </>
            ) : (
              <>
                {trip?.driver?.avatar ? (
                  <Image source={{ uri: buildImageUri(trip.driver.avatar) }} style={styles.sheetAvatar} />
                ) : (
                  <View style={[styles.sheetAvatarFallback, { backgroundColor: ui.bg }]}>
                    <Ionicons name="person" size={20} color={textPrimary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetTitle, { color: textPrimary }]} numberOfLines={1}>
                    {[trip?.driver?.firstName, trip?.driver?.lastName].filter(Boolean).join(' ') || 'Tu conductor'}
                  </Text>
                  <Text style={[styles.sheetSubtitle, { color: ui.textMuted }]} numberOfLines={1}>
                    {trip?.vehicle ? `${trip.vehicle.brand} ${trip.vehicle.model}${trip.vehicle.licensePlate ? ` · ${trip.vehicle.licensePlate}` : ''}` : 'En camino'}
                  </Text>
                </View>
                {trip?.driver?.rating > 0 && (
                  <Rating rating={trip.driver.rating} count={trip.driver.ratingCount} size={13} />
                )}
              </>
            )}
          </View>
        }
      >
        {/* Etiquetas de plata: el mismo criterio que en el resto de la app — un tag para el
            precio o "gastos compartidos", y otro si el conductor acepta efectivo. */}
        <View style={styles.sheetTagsRow}>
          {precioTag && (
            <View style={[styles.sheetTag, { backgroundColor: ui.bg }]}>
              <Ionicons name={precioTag.icon} size={13} color={textPrimary} />
              <Text style={[styles.sheetTagText, { color: textPrimary }]}>{precioTag.texto}</Text>
            </View>
          )}
          {trip?.aceptaEfectivo && (
            <View style={[styles.sheetTag, { backgroundColor: ui.bg }]}>
              <Ionicons name="wallet-outline" size={13} color={textPrimary} />
              <Text style={[styles.sheetTagText, { color: textPrimary }]}>Acepta efectivo</Text>
            </View>
          )}
        </View>

        {/* El recorrido, con la MISMA numeración que los pines del mapa (routePoints), para
            que el sheet y el mapa cuenten la misma historia. Origen primero, siempre fijo;
            después las paradas en el orden en que se pisan. */}
        <Text style={[styles.sheetSectionLabel, { color: ui.textMuted }]}>RECORRIDO</Text>
        <View style={styles.sheetTimeline}>
          <View style={styles.sheetTimelineRow}>
            <View style={[styles.sheetTimelineDot, { backgroundColor: textPrimary }]}>
              <Text style={styles.sheetTimelineDotNum}>1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTimelineAddress, { color: textPrimary }]} numberOfLines={1}>
                {trip?.origin?.address || trip?.origin?.city || 'Origen'}
              </Text>
              <Text style={[styles.sheetTimelineQuien, { color: ui.textMuted }]}>Salida</Text>
            </View>
          </View>
          {navTargets.map((t, i) => {
            const hecha = paradasHechas.includes(t.id);
            return (
              <View key={t.id} style={styles.sheetTimelineRow}>
                <View style={[
                  styles.sheetTimelineDot,
                  { backgroundColor: hecha ? ui.bg : textPrimary, borderWidth: hecha ? 1 : 0, borderColor: ui.border },
                ]}>
                  {hecha
                    ? <Ionicons name="checkmark" size={13} color={ui.textMuted} />
                    : <Text style={styles.sheetTimelineDotNum}>{i + 2}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetTimelineAddress, { color: hecha ? ui.textMuted : textPrimary }]} numberOfLines={1}>
                    {t.address}
                  </Text>
                  {!!t.quien && (
                    <Text style={[styles.sheetTimelineQuien, { color: ui.textMuted }]} numberOfLines={1}>
                      {t.quien}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Pasajeros a bordo: sólo el conductor los ve acá — al pasajero ya se lo dice el
            header con el nombre del conductor. */}
        {isDriver && pasajerosUnicos.length > 0 && (
          <>
            <Text style={[styles.sheetSectionLabel, { color: ui.textMuted, marginTop: 18 }]}>PASAJEROS</Text>
            {pasajerosUnicos.map((p, i) => (
              <View key={p?._id || i} style={styles.sheetPersonRow}>
                {p?.avatar ? (
                  <Image source={{ uri: buildImageUri(p.avatar) }} style={styles.sheetPersonAvatar} />
                ) : (
                  <View style={[styles.sheetPersonAvatarFallback, { backgroundColor: ui.bg }]}>
                    <Ionicons name="person" size={16} color={textPrimary} />
                  </View>
                )}
                <Text style={[styles.sheetPersonName, { color: textPrimary }]} numberOfLines={1}>
                  {[p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Pasajero'}
                  {p.asientos > 1 ? ` · ${p.asientos} asientos` : ''}
                </Text>
                {p?.rating > 0 && <Rating rating={p.rating} count={p.ratingCount} size={12} />}
              </View>
            ))}
          </>
        )}
      </DraggableSheet>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#010101" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  sheetAvatar: { width: 44, height: 44, borderRadius: 22 },
  sheetAvatarFallback: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 16, fontFamily: 'Sora_700Bold', letterSpacing: -0.2 },
  sheetSubtitle: { fontSize: 13, fontFamily: 'Sora_400Regular', marginTop: 2 },

  sheetTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  sheetTag: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  sheetTagText: { fontSize: 12, fontFamily: 'Sora_600SemiBold' },

  sheetSectionLabel: { fontSize: 11, fontFamily: 'Sora_700Bold', letterSpacing: 0.6, marginBottom: 10 },
  sheetTimeline: { gap: 2 },
  sheetTimelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
  sheetTimelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sheetTimelineDotNum: { fontSize: 11, fontFamily: 'Sora_700Bold', color: '#FFFFFF' },
  sheetTimelineAddress: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  sheetTimelineQuien: { fontSize: 12, fontFamily: 'Sora_400Regular', marginTop: 1 },

  sheetPersonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  sheetPersonAvatar: { width: 32, height: 32, borderRadius: 16 },
  sheetPersonAvatarFallback: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetPersonName: { flex: 1, fontSize: 14, fontFamily: 'Sora_500Medium' },

  miPuntoHalo: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(66,133,244,0.22)' },
  miPunto: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#4285F4', borderWidth: 2.5, borderColor: '#FFFFFF' },
  recentrarBtn: { position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  // Puntas en negro pleno, paradas intermedias en gris: el número dice el orden y el
  // color dice si es una punta del viaje o una parada del camino.
  routeMarker: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#555555', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  routeMarkerEnd: { backgroundColor: '#010101' },
  driverCarIcon: { width: 42, height: 42 },
  routeMarkerNum: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Sora_700Bold' },
  navCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  navLabel: { fontSize: 11, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.5, textTransform: 'uppercase' },
  navAddress: { fontSize: 20, fontFamily: 'Sora_700Bold', letterSpacing: -0.4, lineHeight: 26, marginTop: 2 },
  navQuien: { fontSize: 13, fontFamily: 'Sora_400Regular', marginTop: 3 },
  navFooter: { position: 'absolute', left: 16, right: 16, bottom: 0 },
  // Negro fijo, no invertido por tema: el mapa siempre se ve claro, así que en modo oscuro
  // el botón salía blanco sobre fondo claro.
  navContinuar: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#010101',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  navContinuarText: { fontSize: 16, fontFamily: 'Sora_700Bold', color: '#FFFFFF' },
});

export default TripMapScreen;
