import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import socketService from '../../../services/socketService';
import { getDirections } from '../../../services/mapsService';
import { useUI } from '../../../theme/ui';
import { buildRoutePoints, kindLabel, quienLabel, ordenarStops, puntosDeRuta } from '../../../utils/routePoints';
import { put_withauth } from '../../../services/apiService';
import RutaPolyline from '../../../components/map/RutaPolyline';
import { useMapFit } from '../../../hooks/useMapFit';
import { ENDPOINTS } from '../../../config/api';

/** Cada cuánto se reporta la posición del conductor: nada de APIs pagas, solo GPS + socket */
const DRIVER_LOCATION_INTERVAL_MS = 8000;
const DRIVER_LOCATION_DISTANCE_M = 25;

const TripMapScreen = ({ route, navigation }) => {
  const { trip } = route.params;
  const insets = useSafeAreaInsets();
  const ui = useUI();
  const { user } = useAuth();
  const mapRef = useRef(null);
  const isMounted = useRef(true);
  const locationWatchRef = useRef(null);

  const isDark = ui.isDarkMode;
  const cardBg = ui.surface;
  const textPrimary = ui.text;

  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStop, setSelectedStop] = useState(null);
  // Los marcadores son una vista propia con el número adentro, y en Android eso se dibuja
  // capturando la vista en un bitmap. Si la captura sale antes de que el hijo esté medido,
  // el pin queda sin número. Remontarlos cuando el mapa avisa que está listo fuerza una
  // captura nueva. Antes origen y destino esquivaban esto con PNGs fijos, pero dejaron de
  // servir cuando pasaron a llevar número: el número depende de cuántas paradas haya.
  const [mapReady, setMapReady] = useState(false);

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
            const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            // También en estado: es el punto por donde se corta el trazado en recorrido y
            // pendiente. El conductor no se ve a sí mismo con driverLocation (eso es lo que
            // reciben los pasajeros por socket), así que sin esto no habría por dónde cortar.
            setDriverLocation({ ...coords, heading: loc.coords.heading });
            seguirAlConductor(coords);
            socketService.sendTripLocationUpdate(trip._id, { ...coords, heading: loc.coords.heading });
          }
        );
      }
    })();

    if (!isDriver) {
      // Pasajero: solo escucha la posición ya calculada por el conductor, sin llamadas propias.
      socketService.joinTripTracking(trip._id);
      socketService.onTripLocation((data) => {
        if (data?.tripId === trip._id) {
          setDriverLocation({ latitude: data.latitude, longitude: data.longitude, heading: data.heading });
        }
      });
    }

    return () => {
      cancelled = true;
      locationWatchRef.current?.remove?.();
      locationWatchRef.current = null;
      if (!isDriver) {
        socketService.leaveTripTracking(trip._id);
        socketService.removeListener('trip:location');
      }
    };
  }, [trip?._id, isTripStarted, isDriver]);

  // El encuadre espera a que el mapa esté listo: ver useMapFit. Con el setTimeout de antes,
  // si el mapa tardaba más de 400 ms en inicializar la cámara se quedaba en la región inicial
  // —un cuadrito alrededor del origen— y de la ruta se veía sólo el principio.
  const fitTo = useMapFit(mapRef, mapReady, { top: 80, right: 40, bottom: 80, left: 40 });

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
   * Cerrar el viaje desde el mapa. El conductor llega al destino y el botón deja de decir
   * "Continuar" para decir "Completar": no tiene por qué volver atrás a buscar dónde estaba
   * esa acción. Es el mismo endpoint que usa el detalle del viaje.
   *
   * trip.passengers tiene una entrada POR ASIENTO, no por pasajero, así que su largo es
   * justo lo que necesita la pantalla de costos para repartir.
   */
  const submitCompleteTrip = async ({ costBreakdown, driverPay }) => {
    try {
      const response = await put_withauth(ENDPOINTS.COMPLETE_TRIP(trip._id), { costBreakdown, driverPay });
      if (response.success) {
        const actualizado = response.data?.trip || response.data;
        // El mapa queda debajo en el stack: sin esto, volver atrás desde el resultado te
        // devolvía al mapa de un viaje ya terminado, con su tarjeta y su botón.
        navigation.popToTop();
        return { ok: true, message: `Costo final: $${Math.round(actualizado?.actualCost || 0).toLocaleString('es-AR')}` };
      }
      return { ok: false, message: response.message || 'No se pudo completar el viaje' };
    } catch (error) {
      return { ok: false, message: error.message || 'Error al completar el viaje' };
    }
  };

  const avanzar = () => {
    if (enElDestino) {
      navigation.navigate('CompleteTrip', {
        onSubmit: submitCompleteTrip,
        totalSeats: trip?.passengers?.length || 1,
      });
      return;
    }
    setParadasHechas((prev) => [...prev, proximaParada.id]);
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
      fitTo(markerCoords());
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
          fitTo(points);
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
          fitTo(pts);
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
    fitTo(puntos);
  };


  const initialRegion = originCoords?.latitude
    ? { latitude: originCoords.latitude, longitude: originCoords.longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 }
    : { latitude: -34.6037, longitude: -58.3816, latitudeDelta: 2, longitudeDelta: 2 };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        paddingAdjustmentBehavior="never"
        showsUserLocation={showMyLocation}
        onMapReady={() => setMapReady(true)}
        // `isGesture` distingue el arrastre del usuario de los movimientos que hacemos
        // nosotros (encuadre inicial, seguimiento): sin eso, la propia cámara se apagaría sola.
        onRegionChangeComplete={(r, detalles = {}) => {
          if (!detalles.isGesture || !siguiendoRef.current) return;
          siguiendoRef.current = false;
          setSiguiendo(false);
        }}
      >
        {!isDriver && driverLocation?.latitude && (
          <Marker
            coordinate={{ latitude: driverLocation.latitude, longitude: driverLocation.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={driverLocation.heading || 0}
            flat
          >
            <View style={styles.driverMarker}>
              <Ionicons name="navigate" size={16} color="#FFFFFF" />
            </View>
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
            onPress={() =>
              setSelectedStop(
                selectedStop?.number === i + 1
                  ? null
                  : { number: i + 1, address: point.address, kindLabel: point.kindLabel }
              )
            }
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

      {/* A dónde va ahora. Sólo para el conductor y sólo con el viaje en curso: al pasajero
          no le sirve y le taparía el mapa. Va arriba y ocupa lo mínimo para que el mapa se
          siga viendo entero, que es lo que el conductor necesita mientras maneja. */}
      {isDriver && isTripStarted && proximaParada && (
        <View style={[styles.navCard, { backgroundColor: cardBg, top: insets.top + 56 }]}>
          <Text style={[styles.navLabel, { color: ui.textMuted }]}>Yendo a</Text>
          <Text style={[styles.navAddress, { color: textPrimary }]} numberOfLines={2}>
            {proximaParada.address}
          </Text>
          {!!proximaParada.quien && (
            <Text style={[styles.navQuien, { color: ui.textMuted }]} numberOfLines={1}>
              {proximaParada.quien}
            </Text>
          )}
        </View>
      )}

      {/* Continuar: pasa a la parada siguiente. Abajo y ancho, para tocarlo sin mirar; el
          check chiquito arriba a la derecha no se entendía ni se acertaba manejando. */}
      {isDriver && isTripStarted && proximaParada && (
        <View style={[styles.navFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.navContinuar}
            onPress={avanzar}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={enElDestino ? 'Completar el viaje' : 'Ir a la parada siguiente'}
          >
            <Text style={styles.navContinuarText}>{enElDestino ? 'Completar' : 'Continuar'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recentrar. Sólo aparece cuando dejó de seguir, que es cuando sirve. */}
      {isDriver && isTripStarted && !siguiendo && driverLocation?.latitude && (
        <TouchableOpacity
          style={[styles.recentrarBtn, { backgroundColor: cardBg, bottom: insets.bottom + (proximaParada ? 96 : 24) }]}
          onPress={recentrar}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Volver a centrar en mi ubicación"
        >
          <Ionicons name="locate" size={22} color={textPrimary} />
        </TouchableOpacity>
      )}

      {selectedStop && (
        <TouchableOpacity
          style={[styles.stopTooltip, { backgroundColor: cardBg }]}
          onPress={() => setSelectedStop(null)}
          activeOpacity={0.9}
        >
          <Text style={[styles.stopTooltipLabel, { color: textPrimary }]}>
            {selectedStop.kindLabel ? `${selectedStop.number} · ${selectedStop.kindLabel}` : selectedStop.number}
          </Text>
          <Text style={[styles.stopTooltipAddress, { color: textPrimary }]}>{selectedStop.address}</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#010101" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
  driverMarker: { width: 30, height: 30, borderRadius: 18, backgroundColor: '#010101', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  routeMarkerNum: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Sora_700Bold' },
  stopTooltip: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
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
  stopTooltipLabel: { fontSize: 11, fontFamily: 'Sora_600SemiBold', opacity: 0.5, marginBottom: 4 },
  stopTooltipAddress: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
});

export default TripMapScreen;
