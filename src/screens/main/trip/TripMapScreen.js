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
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import socketService from '../../../services/socketService';
import { getDirections } from '../../../services/mapsService';
import { useUI } from '../../../theme/ui';
import { buildRoutePoints, kindLabel, quienLabel } from '../../../utils/routePoints';
import { put_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';

/** Cada cuánto se reporta la posición del conductor: nada de APIs pagas, solo GPS + socket */
const DRIVER_LOCATION_INTERVAL_MS = 8000;
const DRIVER_LOCATION_DISTANCE_M = 25;

const decodePolyline = (encoded) => {
  if (!encoded) return [];
  const pts = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charAt(i++).charCodeAt(0) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charAt(i++).charCodeAt(0) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    pts.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return pts;
};

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
    fetchRoute();
    return () => { isMounted.current = false; };
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
            socketService.sendTripLocationUpdate(trip._id, {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading,
            });
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

  const fitTo = (coords) => {
    if (!coords?.length) return;
    setTimeout(() => {
      if (mapRef.current && isMounted.current) {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 40, bottom: 80, left: 40 },
          animated: true,
        });
      }
    }, 400);
  };

  /** Lo que se pueda encuadrar aunque no haya trayecto: origen, paradas y destino que tengan coords. */
  const markerCoords = () => [
    originCoords?.latitude && { latitude: originCoords.latitude, longitude: originCoords.longitude },
    ...stops.map(s => ({ latitude: s.coordinates.latitude, longitude: s.coordinates.longitude })),
    destCoords?.latitude && { latitude: destCoords.latitude, longitude: destCoords.longitude },
  ].filter(Boolean);

  /** Metros entre dos puntos (haversine). Alcanza para saber si el trazado roza la parada. */
  const metersBetween = (a, b) => {
    const R = 6371000;
    const rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(b.latitude - a.latitude);
    const dLon = rad(b.longitude - a.longitude);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  /** ¿El trazado pasa por todas las paradas? 150 m tolera el ancho de calle y la resolución. */
  const stopsCoveredBy = (points) =>
    stops.length === 0 ||
    stops.every((s) => points.some((p) => metersBetween(p, s.coordinates) < 150));

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
    const posicionEnRuta = (coord) => {
      if (!routeCoordinates.length) return Number.MAX_SAFE_INTEGER;
      let mejorDist = Infinity;
      let mejorIdx = Number.MAX_SAFE_INTEGER;
      for (let i = 0; i < routeCoordinates.length; i++) {
        const d = metersBetween(routeCoordinates[i], coord);
        if (d < mejorDist) { mejorDist = d; mejorIdx = i; }
      }
      return mejorIdx;
    };

    // Acá van TODAS las paradas de pasajeros, incluidas las que caen encima del origen o del
    // destino. Esas se descartan para los marcadores —dos pines en el mismo lugar se tapan—
    // pero para el conductor no son un duplicado: que Benjamín suba en la dirección de salida
    // es justo lo que necesita saber al arrancar, y si se filtra no aparece por ningún lado.
    const paradas = (trip?.intermediateStops || [])
      .filter((st) => st?.coordinates?.latitude != null && st?.coordinates?.longitude != null)
      .map((st, i) => ({
        id: `stop-${i}`,
        coordinate: { latitude: st.coordinates.latitude, longitude: st.coordinates.longitude },
        address: st.address || st.city || 'Parada',
        quien: quienLabel(st.kind, st.passenger),
      }));

    // Sin trazado todavía, se respeta el orden con el que vinieron: es lo único que hay.
    paradas.sort((a, b) => posicionEnRuta(a.coordinate) - posicionEnRuta(b.coordinate));

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
  }, [trip?.intermediateStops, destCoords?.latitude, destCoords?.longitude, routeCoordinates]);

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
    // La ruta guardada al crear el viaje: no cambia nunca, así que verla no cuesta una
    // llamada a Directions. Los viajes viejos y las solicitudes no la tienen y siguen pidiéndola.
    //
    // Pero si el viaje tiene paradas, hay que confirmar que la guardada las contemple:
    // se guardaron rutas calculadas sin los waypoints (y EditTripScreen nunca la recalcula
    // al agregar una parada), y el mapa dibujaba un trazado que no pasa por la parada.
    // Cuando no las cubre se descarta y se pide a Directions, que sí manda los waypoints.
    const saved = decodePolyline(trip?.routePolyline);
    if (saved.length > 0 && stopsCoveredBy(saved)) {
      setRouteCoordinates(saved);
      fitTo(saved);
      setLoading(false);
      return;
    }
    // Falta una punta: no hay trayecto posible, pero igual se encuadra lo que haya.
    // Antes salía sin centrar y el mapa quedaba en la región inicial, lejos del viaje.
    if (!originCoords?.latitude || !destCoords?.latitude) {
      fitTo(markerCoords());
      setLoading(false);
      return;
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
        let points = [];
        r.legs?.forEach(leg => leg.steps?.forEach(step => {
          if (step.polyline?.points) points.push(...decodePolyline(step.polyline.points));
        }));
        if (points.length === 0 && r.overview_polyline?.points) points = decodePolyline(r.overview_polyline.points);
        if (points.length > 0) {
          setRouteCoordinates(points);
          fitTo(points);
        } else {
          fitTo(markerCoords());
        }
      } else {
        // Respuesta sin rutas (ZERO_RESULTS, REQUEST_DENIED…): no lanza excepción, así que
        // antes se caía por acá en silencio y no dibujaba NI centraba.
        fitTo(markerCoords());
      }
    } catch (e) {
      fitTo(markerCoords());
    } finally {
      if (isMounted.current) setLoading(false);
    }
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

        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={5}
            strokeColor="#010101"
            strokeColors={['#010101']}
            lineCap="round"
            lineJoin="round"
          />
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
