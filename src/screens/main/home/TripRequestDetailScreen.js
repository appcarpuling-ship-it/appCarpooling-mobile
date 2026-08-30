import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { MAP_PROVIDER } from '../../../utils/mapProvider';
import RutaPolyline from '../../../components/map/RutaPolyline';
import { puntosDeRuta } from '../../../utils/routePoints';
import { getDirections } from '../../../services/mapsService';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import { useAuth } from '../../../context/AuthContext';
import { get_withauth, put_withauth, buildImageUri } from '../../../services/apiService';
import { acceptTripRequestApplication, applyToTripRequest, cancelTripRequest, cancelTripRequestApplication } from '../../../services/tripRequestService';
import { confirmFromCallback } from '../../../services/seatReservationService';
import CheckoutWebView from '../../../components/payment/CheckoutWebView';
import Rating from '../../../components/ui/Rating';
import { ENDPOINTS } from '../../../config/api';
import { useUI } from '../../../theme/ui';
import { reportError } from '../../../utils/sentry';
import { recorridoElegido, armarTripParaMapa, ofertaDelConductor } from '../../../utils/postulacionTrip';

const STATUS_MAP = {
  open:             { label: 'Abierta',       solid: true },
  awaiting_payment: { label: 'Pago pendiente', solid: true },
  paid:             { label: 'Confirmada',     solid: true },
  cancelled:        { label: 'Cancelada',      solid: false },
  expired:          { label: 'Vencida',        color: '#9CA3AF' },
  completed:        { label: 'Completada',     solid: false },
};

const TripRequestDetailScreen = ({ route, navigation }) => {
  const { requestId, canApply: canApplyParam, alreadyApplied: alreadyAppliedParam } = route.params || {};

  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { showAlert }  = useAlert();

  const dark        = isDarkMode;
  const ui = useUI();
  const bg          = ui.bg;
  const cardBg      = ui.surface;
  const textPrimary = dark ? '#FFFFFF'  : '#1F2937';
  const textSecondary = dark ? '#D1D5DB' : '#374151';
  const textMuted   = dark ? '#9CA3AF'  : '#6B7280';
  const divider     = dark ? '#2A2A2A'  : '#E5E7EB';
  const accent      = dark ? '#FFFFFF'  : '#1F2937';  const accentInverse = ui.invertText;

  const [request,        setRequest]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [accepting,      setAccepting]      = useState(null);
  const [vehicles,       setVehicles]       = useState([]);
  const [applying,       setApplying]       = useState(false);
  const [canApply,       setCanApply]       = useState(canApplyParam ?? false);
  const [alreadyApplied, setAlreadyApplied] = useState(alreadyAppliedParam ?? false);
  const [checkoutModal,  setCheckoutModal]  = useState({ visible: false, paymentUrl: null });
  const [cancelling,     setCancelling]     = useState(false);
  const [retirando,      setRetirando]      = useState(false);
  // Mini mapa arriba de todo, mismo criterio que TripDetailScreen/BookingScreen. En Android
  // un marker con vista propia y tracksViewChanges en false desde el primer render se dibuja
  // invisible; arranca en true y se apaga solo una vez que el mapa avisa que está listo.
  const [mapPreviewReady, setMapPreviewReady] = useState(false);
  const [mapPreviewDotsVivos, setMapPreviewDotsVivos] = useState(true);
  // Trazado real del preview. Una solicitud no guarda polyline (eso lo tiene el viaje, recién
  // creado): se pide una vez a Directions, igual que TripMapScreen. Sin ruta (falla el pedido,
  // o no hay coordenadas) no va línea — una recta cruza terreno y ríos en diagonal, y se lee
  // como un error más que como una estimación.
  const [previewRoutePoints, setPreviewRoutePoints] = useState([]);

  const previewMapRef = useRef(null);
  /**
   * Los puntos del encuadre. Se calculan bien abajo (necesitan `request`, que recién ahí está
   * garantizado) y se depositan acá durante el render, que corre antes que los efectos. El ref
   * existe para que el efecto del encuadre pueda vivir ACÁ ARRIBA: esta pantalla tiene dos
   * early returns (`loading` y `!request`), y un hook declarado después de ellos se saltea en
   * el primer render y se ejecuta en el segundo. React cuenta los hooks y esa diferencia
   * crashea la pantalla al abrirla.
   */
  const puntosEncuadreRef = useRef([]);

  // El apagado del tracking vive en el efecto del encuadre, para que ocurra DESPUÉS de mover
  // la cámara y no en paralelo (ver el comentario allá).

  // `initialRegion` sola no alcanza: en Android se aplica antes de que la vista nativa esté
  // lista y queda ignorada. Las dependencias son las fuentes de los puntos (la solicitud y el
  // trazado que llega de Directions), no el array, que se arma nuevo en cada render.
  useEffect(() => {
    if (!mapPreviewReady) return undefined;
    const puntos = puntosEncuadreRef.current;
    if (puntos.length >= 2) {
      previewMapRef.current?.fitToCoordinates(puntos, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: false,
      });
    }
    // El tracking de los puntos se apaga ACÁ, después de encuadrar, y no en un efecto aparte
    // que arrancaba con onMapReady. En Android un marcador con `tracksViewChanges` ya apagado
    // no se reubica bien cuando la cámara se mueve por código, y su vista puede quedar sin
    // medir: el anchor {0.5, 0.5} deja de caer donde corresponde y los puntos aparecen corridos
    // del trazado. Se los deja vivos mientras el mapa se acomoda y recién después se apagan.
    setMapPreviewDotsVivos(true);
    const t = setTimeout(() => setMapPreviewDotsVivos(false), 900);
    return () => clearTimeout(t);
  }, [mapPreviewReady, request, previewRoutePoints]);

  const previewOriginCoords = request?.origin?.coordinates;
  const previewDestCoords   = request?.destination?.coordinates;
  // Las paradas de la solicitud, ya filtradas a las que tienen coordenadas: sirven para el
  // trazado (waypoints), para los pines y para el encuadre.
  const previewStops = (request?.intermediateStops || [])
    .filter((s) => s?.coordinates?.latitude != null && s?.coordinates?.longitude != null)
    .map((s) => ({ latitude: s.coordinates.latitude, longitude: s.coordinates.longitude }));
  // Serializado: como `previewStops` es un array nuevo en cada render, usarlo de dependencia
  // directa volvería a pedir Directions en bucle.
  const previewStopsKey = previewStops.map((s) => `${s.latitude},${s.longitude}`).join('|');
  useEffect(() => {
    if (!previewOriginCoords?.latitude || !previewDestCoords?.latitude) return;
    let vivo = true;
    const orig = `${previewOriginCoords.latitude},${previewOriginCoords.longitude}`;
    const dest = `${previewDestCoords.latitude},${previewDestCoords.longitude}`;
    // Con las paradas adentro: sin ellas el trazado iba derecho de punta a punta y se
    // saltaba el desvío, que es justo lo que la parada agrega al viaje.
    getDirections(orig, dest, previewStopsKey || undefined)
      .then((data) => {
        if (!vivo) return;
        const points = puntosDeRuta(data?.routes?.[0]);
        if (points.length > 1) setPreviewRoutePoints(points);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [previewOriginCoords?.latitude, previewOriginCoords?.longitude, previewDestCoords?.latitude, previewDestCoords?.longitude, previewStopsKey]);

  const isPassenger = request ? request.isPassenger : false;
  const isDriver    = request ? !request.isPassenger : false;

  // El backend le manda al conductor SOLO su propia postulación (filtra las de terceros), así
  // que igual se busca por id: si algún día dejara de filtrar, mostrar la oferta de otro sería
  // peor que no mostrar ninguna.
  const miPostulacion = request?.applications?.find(
    (a) => String(a.driver?._id || a.driver) === String(user?._id || user?.id),
  );
  // Detalle de la propia oferta: mismo tramo o recorrido propio, y el mapa para verlo.
  // Antes, una vez postulado, sólo quedaba el precio — el conductor no tenía forma de
  // volver a ver por dónde había dicho que iba a pasar.
  const miEleccion = miPostulacion ? recorridoElegido(miPostulacion) : null;
  const miTripParaMapa = miPostulacion
    ? armarTripParaMapa(miPostulacion, request, user, miPostulacion.vehicleSnapshot)
    : null;

  const loadVehicles = async () => {
    try {
      const res = await get_withauth(ENDPOINTS.MY_VEHICLES);
      if (res.success) setVehicles(res.data || []);
    } catch { /* no-op */ }
  };

  const load = async (isRefreshing = false) => {
    if (isRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await get_withauth(`/trip-requests/${requestId}`);
      if (res.success) {
        setRequest(res.data);
        if (res.data.canApply       !== undefined) setCanApply(res.data.canApply);
        if (res.data.alreadyApplied !== undefined) setAlreadyApplied(res.data.alreadyApplied);
        if (!res.data.isPassenger) loadVehicles();
      }
    } catch (err) {
      reportError(err, { screen: 'TripRequestDetailScreen', action: 'load' });
      showAlert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [requestId]));

  const onRefresh = () => { load(true); };

  const handleCancel = () => {
    navigation.navigate('Confirm', {
      title: 'Cancelar solicitud',
      message: '¿Estás seguro? Los conductores postulados serán notificados.',
      confirmLabel: 'Sí, cancelar',
      destructive: true,
      onConfirm: async () => {
        setCancelling(true);
        try {
          await cancelTripRequest(requestId);
        } finally {
          setCancelling(false);
        }
      },
      successParams: {
        title: 'Solicitud cancelada',
        message: 'Tu solicitud fue cancelada.',
        // Confirm se reemplaza por Result, así que el stack queda igual que antes.
        onPrimary: () => { navigation.goBack(); navigation.goBack(); },
      },
      errorParams: { title: 'Error' },
    });
  };

  const handleCancelTrip = () => {
    navigation.navigate('Confirm', {
      title: 'Cancelar viaje',
      message: '¿Estás seguro? El viaje será eliminado y el pasajero será notificado. La solicitud volverá a estar abierta.',
      confirmLabel: 'Sí, cancelar',
      destructive: true,
      onConfirm: async () => {
        setCancelling(true);
        try {
          const tripId = request?.createdTrip?._id || request?.createdTrip;
          await put_withauth(ENDPOINTS.CANCEL_TRIP(tripId));
        } finally {
          setCancelling(false);
        }
      },
      successParams: {
        title: 'Viaje cancelado',
        message: 'El viaje fue cancelado y el pasajero fue notificado.',
        onPrimary: () => { navigation.goBack(); navigation.goBack(); },
      },
      errorParams: { title: 'Error' },
    });
  };

  /**
   * Una vez aceptado un conductor ya existe el viaje real (`createdTrip`), con conductor,
   * vehículo y tracking en vivo — cosas que la solicitud en sí no tiene. Mandar la solicitud
   * disfrazada de viaje a TripMapScreen la dejaba con datos a medias. Si no hay viaje creado
   * todavía (solicitud abierta) se manda la solicitud, como antes: ahí sólo hacen falta los
   * dos puntos para el mapa.
   */
  const handleOpenMap = async () => {
    const tripId = request?.createdTrip?._id || request?.createdTrip;
    if (tripId) {
      try {
        const res = await get_withauth(ENDPOINTS.GET_TRIP(tripId));
        if (res.success) return navigation.navigate('TripMap', { trip: res.data });
      } catch (_) { /* cae al fallback de abajo */ }
    }
    navigation.navigate('TripMap', { trip: request });
  };

  const handleApplyPress = () => {
    if (vehicles.length === 0) {
      return showAlert(
        'Sin vehículos',
        'Necesitás tener al menos un vehículo registrado para postularte.',
        [{ text: 'Agregar vehículo', onPress: () => navigation.navigate('ProfileTab', { screen: 'Vehicles', initial: false }) }]
      );
    }
    // Misma pantalla que usa la creacion de viaje (VehiclePicker, registrada en el
    // stack raiz) en vez del bottom sheet propio que habia acá.
    // El picker no sabe de capacidad, asi que la lista llega ya filtrada: mostrar
    // un auto que no entra y despues rebotarlo con un alert era peor.
    const seatsNeeded = request?.seatsNeeded || 1;
    const eligible = vehicles.filter((v) => v.capacity >= seatsNeeded);

    if (eligible.length === 0) {
      return showAlert(
        'Capacidad insuficiente',
        `Este viaje necesita ${seatsNeeded} asiento${seatsNeeded === 1 ? '' : 's'} y ninguno de tus vehículos llega.`,
      );
    }

    navigation.navigate('VehiclePicker', {
      vehicles: eligible,
      onSelect: confirmApply,
    });
  };

  /**
   * Elegido el vehículo, falta saber qué recorrido hace el conductor. Puede ser más largo que
   * el del pasajero —de Misiones a Ushuaia levantando a alguien que va de Concordia a Buenos
   * Aires— y entonces el viaje tiene que armarse con las cuatro puntas, no con dos.
   *
   * Es opcional a propósito: el caso común es hacer el mismo tramo, y ahí pedir dos
   * direcciones más sería un trámite al pedo.
   */
  const confirmApply = (vehicleId) => {
    navigation.navigate('DriverRoutePicker', {
      tramo: { origin: request?.origin, destination: request?.destination },
      onSelect: (opcion) => {
        if (opcion === 'mismo') return pedirPrecio(vehicleId);
        navigation.navigate('PickDriverRoute', {
          mode: 'apply',
          onDone: ({ origin, destination, waypoints }) => pedirPrecio(vehicleId, {
            driverOrigin: origin,
            driverDestination: destination,
            // Las paradas propias del conductor, entre sus dos puntas.
            driverStops: waypoints || [],
          }),
        });
      },
    });
  };

  /**
   * Último paso antes de mandar: cuánto cobra. Va después del recorrido y no antes porque el
   * conductor recién ahí sabe cuánto se desvía, que es lo que puede mover su número.
   */
  const pedirPrecio = (vehicleId, recorrido) => {
    navigation.navigate('DriverPricePicker', {
      seatsNeeded: request?.seatsNeeded || 1,
      onDone: (oferta) => enviarPostulacion(vehicleId, recorrido, oferta),
    });
  };

  /**
   * Retirar la postulación. Se confirma antes porque es destructivo y no se deshace: para
   * volver hay que postularse de nuevo, y si mientras tanto la solicitud llegó a 5 postulantes
   * puede quedarse afuera.
   */
  const handleRetirarPostulacion = () => {
    navigation.navigate('Confirm', {
      title: 'Retirar postulación',
      message: 'Se le deja de ofrecer este viaje al pasajero. Podés volver a postularte si querés.',
      confirmLabel: 'Sí, retirar',
      destructive: true,
      onConfirm: async () => {
        setRetirando(true);
        try {
          const res = await cancelTripRequestApplication(requestId);
          if (!res.success) throw new Error(res.message || 'No se pudo retirar la postulación');
          // Los flags los recalcula el server (canApply mira además el tope de 5
          // postulantes y el estado de la solicitud): ponerlos a mano acá haría
          // parpadear "Ofrecer viaje" en casos donde no se puede.
          await load();
        } finally {
          setRetirando(false);
        }
      },
      successParams: { title: 'Postulación retirada', message: 'Ya no le ofrecés viaje a este pasajero.' },
      errorParams: { title: 'Ocurrió algo' },
    });
  };

  const enviarPostulacion = async (vehicleId, recorrido, oferta) => {
    setApplying(true);
    try {
      const res = await applyToTripRequest(requestId, vehicleId, recorrido, oferta);
      if (res.success) {
        navigation.navigate('Result', { type: 'success', title: '¡Propuesta enviada!', message: 'El pasajero revisará tu perfil y vehículo.' });
        setAlreadyApplied(true);
        setCanApply(false);
      }
    } catch (err) {
      // Bloqueado por saldo pendiente. Postularse acá es, en los hechos, publicar un viaje
      // (si el pasajero acepta, se convierte en uno): mismo bloqueo, mismo aviso que en
      // CreateTripGoogleMaps, para que no sea una sorpresa distinta según por dónde entró.
      if (err.response?.data?.code === 'SALDO_PENDIENTE') {
        showAlert(
          'Tenés saldo pendiente',
          err.response.data.message || 'Saldá tu cuenta para volver a postularte.',
          [
            { text: 'Ahora no', style: 'cancel' },
            { text: 'Ver mi saldo', onPress: () => navigation.navigate('ProfileTab', { screen: 'Saldo', initial: false }) }
          ]
        );
        return;
      }
      navigation.navigate('Result', { type: 'error', title: 'Ocurrió algo', message: err.message });
    } finally {
      setApplying(false);
    }
  };

  const handleAccept = (applicationId) => {
    navigation.navigate('Confirm', {
      title: 'Aceptar conductor',
      message: 'Al aceptar este conductor, los demás serán rechazados y se generará el pago.',
      confirmLabel: 'Aceptar',
      onConfirm: async () => {
        setAccepting(applicationId);
        try {
          const res = await acceptTripRequestApplication(requestId, applicationId);
          if (!res.success) throw new Error(res.message || 'No se pudo aceptar');
          // paymentUrl: solo en solicitudes viejas con un checkout abierto de antes del
          // cambio a pago directo. Ahí hay que abrir el modal, no mostrar Result. El goBack
          // que saca el Confirm de encima lo hace ConfirmScreen solo con skipResult.
          const paymentUrl = res.data?.payment?.url;
          if (paymentUrl) {
            setCheckoutModal({ visible: true, paymentUrl });
            return { skipResult: true };
          }
          await load();
        } finally {
          setAccepting(null);
        }
      },
      successParams: { title: 'Conductor aceptado', message: 'El viaje quedó confirmado.' },
      errorParams: { title: 'Ocurrió algo' },
    });
  };

  // timeZone UTC: departureDate de una solicitud es un dia de calendario guardado como
  // medianoche UTC. Sin esto, en UTC-3 se muestra el dia anterior.
  const formatDate = (date) =>
    new Date(date).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

  /**
   * "Concordia" sola no ubica a nadie: hay ciudades homónimas en varias provincias. Se
   * omite la provincia si ya está escrita adentro de la ciudad (o al revés), porque en
   * CABA vienen prácticamente iguales y quedaba repetido.
   */
  const cityWithProvince = (loc) => {
    const city = String(loc?.city || '').trim();
    const province = String(loc?.province || '').trim();
    if (!province || !city) return city || province;
    if (city.toLowerCase().includes(province.toLowerCase())) return city;
    if (province.toLowerCase().includes(city.toLowerCase())) return province;
    return `${city}, ${province}`;
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="small" color={textMuted} />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <Text style={[styles.emptyText, { color: textMuted }]}>Solicitud no encontrada</Text>
      </View>
    );
  }

  // El backend recién marca 'expired' con un job diario: una solicitud 'open'/'awaiting_payment'
  // cuya fecha ya pasó puede seguir así hasta 24hs (mismo criterio de "pasada" que ya usa el
  // backend para bucketear en Próximas/Pasadas). Sin esto, quedaba mostrando "Abierta" y
  // dejando cancelar/postularse a un viaje que ya se hizo o nunca se hizo.
  //
  // `departureDate` guarda el día de calendario como medianoche UTC (no un instante real), así
  // que "hoy" hay que armarlo con el mismo criterio — medianoche UTC del día de calendario
  // LOCAL — y no con `setHours(0,0,0,0)`, que da medianoche LOCAL. Medianoche UTC de hoy cae
  // 3 horas ANTES que medianoche local (Argentina es UTC-3): con el cálculo viejo, cualquier
  // solicitud para HOY quedaba "vencida" todo el día, incluso antes de su hora de salida.
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const effectivelyExpired = new Date(request.departureDate) < today
    && ['open', 'awaiting_payment'].includes(request.status);
  const statusCfg   = effectivelyExpired
    ? STATUS_MAP.expired
    : STATUS_MAP[request.status] || { label: request.status, color: textMuted };
  const acceptedApp = request.applications?.find(a => a.status === 'accepted');
  const ofertaAceptada = acceptedApp ? ofertaDelConductor(acceptedApp) : null;
  const passenger   = request.passenger;
  const isAcceptedDriver = isDriver && !!acceptedApp && String(acceptedApp.driver) === String(user?._id);

  // Una solicitud todavía no tiene trazado real (eso lo tiene el viaje, una vez creado): solo
  // los dos puntos, sin línea — una recta cruza terreno y ríos en diagonal, ninguna calle hace eso.
  const originCoords = request.origin?.coordinates;
  const destCoords    = request.destination?.coordinates;
  const hasMapPreview = Boolean(originCoords?.latitude && destCoords?.latitude);
  // El recorrido completo, con las paradas. Se arma una vez y lo consume la lista de abajo.
  const puntosDeLaSolicitud = [
    { tipo: 'origen', label: 'Origen', loc: request.origin },
    ...(request.intermediateStops || []).map((stop, i) => ({
      tipo: 'parada', label: `Parada ${i + 1}`, loc: stop,
    })),
    { tipo: 'destino', label: 'Destino', loc: request.destination },
  ].map((p) => {
    const ciudad = cityWithProvince(p.loc);
    return {
      ...p,
      direccion: p.loc?.address || ciudad,
      // La ciudad no se repite si ya es lo que se muestra arriba.
      ciudad: ciudad && ciudad !== p.loc?.address ? ciudad : '',
    };
  });

  // Las paradas entran en el encuadre: una parada lejos de la recta origen→destino quedaba
  // fuera de cuadro.
  // El trazado va incluido cuando ya llegó: es lo que hace que el fit muestre el recorrido
  // entero y no sólo la caja entre las puntas (una ruta que se abre para esquivar un río se
  // salía de cuadro). Llega async de Directions, así que el encuadre se rehace al recibirlo.
  const puntosDelEncuadre = hasMapPreview
    ? [originCoords, destCoords, ...previewStops, ...previewRoutePoints].filter((p) => p?.latitude != null)
    : [];
  // Se los deja al efecto del encuadre, que vive arriba de los early returns (ver
  // puntosEncuadreRef).
  puntosEncuadreRef.current = puntosDelEncuadre;
  const previewRegion = hasMapPreview
    ? (() => {
        const lats = [originCoords.latitude, destCoords.latitude, ...previewStops.map((p) => p.latitude)];
        const lngs = [originCoords.longitude, destCoords.longitude, ...previewStops.map((p) => p.longitude)];
        const minLat = Math.min(...lats), maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
        const latitudeDelta = Math.max((maxLat - minLat) * 1.5, 0.03);
        const longitudeDelta = Math.max((maxLng - minLng) * 1.5, 0.03);
        return {
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
          latitudeDelta,
          longitudeDelta,
        };
      })()
    : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textMuted} colors={[textMuted]} />}
      >

        {/* Mini mapa arriba de todo, con el estado superpuesto. Tocarlo lleva al mapa real. */}
        {hasMapPreview ? (
          <TouchableOpacity
            style={styles.mapPreviewWrap}
            onPress={handleOpenMap}
            activeOpacity={0.9}
          >
            <MapView
              ref={previewMapRef}
              provider={MAP_PROVIDER}
              style={styles.mapPreview}
              initialRegion={previewRegion}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              pointerEvents="none"
              onMapReady={() => setMapPreviewReady(true)}
            >
              {previewRoutePoints.length > 1 && (
                // Fijo en negro, no del tema: va sobre las baldosas del mapa, no sobre la app.
                <RutaPolyline coordinates={previewRoutePoints} width={4} color="#000000" />
              )}
              <Marker
                key={`preview-origin-${mapPreviewReady}`}
                coordinate={{ latitude: originCoords.latitude, longitude: originCoords.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={mapPreviewDotsVivos}
              >
                <View style={styles.previewDotOrigin} />
              </Marker>
              {previewStops.map((stop, i) => (
                <Marker
                  key={`preview-stop-${i}-${mapPreviewReady}`}
                  coordinate={stop}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={mapPreviewDotsVivos}
                >
                  <View style={styles.previewDotStop} />
                </Marker>
              ))}
              <Marker
                key={`preview-dest-${mapPreviewReady}`}
                coordinate={{ latitude: destCoords.latitude, longitude: destCoords.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={mapPreviewDotsVivos}
              >
                <View style={styles.previewDotDest} />
              </Marker>
            </MapView>
            <View style={[styles.mapPreviewBadge, { backgroundColor: statusCfg.solid ? ui.invertBg : ui.surface }]}>
              <View style={[styles.statusDot, { backgroundColor: statusCfg.solid ? ui.invertText : textMuted }]} />
              <Text style={[styles.statusText, { color: statusCfg.solid ? ui.invertText : textMuted }]}>{statusCfg.label}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.solid ? ui.invertBg : ui.surface }]}>
              <View style={[styles.statusDot, { backgroundColor: statusCfg.solid ? ui.invertText : textMuted }]} />
              <Text style={[styles.statusText, { color: statusCfg.solid ? ui.invertText : textMuted }]}>{statusCfg.label}</Text>
            </View>
          </View>
        )}

        {/* Route */}
        <View style={[styles.section, { borderBottomColor: divider }]}>
          {/* Cada punto es UNA fila con su círculo al lado de su texto. Con la columna de
              círculos aparte —dos puntos y una línea de alto fijo— la parada intermedia no
              tenía punto propio y los de origen/destino no coincidían con su dirección. */}
          {puntosDeLaSolicitud.map((punto, i) => (
            <View key={`punto-${i}`} style={styles.routePoint}>
              <View style={styles.routeRail}>
                {punto.tipo === 'origen'
                  ? <View style={[styles.routeDotOrigin, { borderColor: accent }]} />
                  : punto.tipo === 'destino'
                    ? <View style={[styles.routeDotDest, { backgroundColor: accent }]} />
                    : <View style={[styles.routeDotParada, { backgroundColor: textMuted }]} />}
                {i < puntosDeLaSolicitud.length - 1 && (
                  <View style={[styles.routeLineV, { backgroundColor: dark ? '#333' : '#D0D0D0' }]} />
                )}
              </View>
              <View style={[styles.routeBody, i < puntosDeLaSolicitud.length - 1 && styles.routeBodyGap]}>
                <Text style={[styles.routeStopLabel, { color: textMuted }]}>{punto.label}</Text>
                <Text style={[styles.routeStopAddress, { color: textPrimary }]}>{punto.direccion}</Text>
                {!!punto.ciudad && (
                  <Text style={[styles.routeStopCity, { color: textMuted }]} numberOfLines={2}>{punto.ciudad}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Meta: fecha · hora · km · precio */}
        <View style={[styles.metaRow, { borderBottomColor: divider }]}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={16} color={textPrimary} />
            <Text style={[styles.metaText, { color: textPrimary }]}>{formatDate(request.departureDate)}</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: divider }]} />
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color={textPrimary} />
            <Text style={[styles.metaText, { color: textPrimary }]}>{request.departureTime} hs</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: divider }]} />
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={16} color={textPrimary} />
            <Text style={[styles.metaText, { color: textPrimary }]}>
              {request.seatsNeeded} {request.seatsNeeded === 1 ? 'asiento' : 'asientos'}
            </Text>
          </View>
        </View>

        {/* Acá se mostraba "Asegurás tu asiento · Pagás ahora" con la conexión. Ya no va:
            en una solicitud el pasajero no paga ninguna conexión, y lo que va a pagar
            depende de QUÉ conductor elija — cada postulación trae su propio precio. Poner
            un número acá era prometer un precio que todavía no existe. */}

        {/* Passenger info (driver mode) */}
        {isDriver && passenger && (
          <View style={[styles.section, { borderBottomColor: divider }]}>
            <Text style={[styles.sectionLabel, { color: textPrimary }]}>Publicado por</Text>
            <View style={styles.driverRow}>
              {passenger.avatar ? (
                <Image source={{ uri: buildImageUri(passenger.avatar) }} style={styles.driverAvatar} />
              ) : (
                <View style={[styles.driverAvatarPlaceholder, { backgroundColor: cardBg }]}>
                  <Text style={[styles.driverInitials, { color: textSecondary }]}>
                    {`${passenger.firstName?.[0] || ''}${passenger.lastName?.[0] || ''}`}
                  </Text>
                </View>
              )}
              <View style={styles.driverInfo}>
                <Text style={[styles.driverName, { color: textPrimary }]}>
                  {passenger.firstName} {passenger.lastName}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Driver selected — passenger mode, non-open */}
        {isPassenger && acceptedApp && request.status !== 'open' && (
          <View style={[styles.section, { borderBottomColor: divider }]}>
            <Text style={[styles.sectionLabel, { color: textPrimary }]}>Conductor aprobado</Text>
            <View style={styles.driverRow}>
              {acceptedApp.driverSnapshot?.avatar ? (
                <Image source={{ uri: buildImageUri(acceptedApp.driverSnapshot.avatar) }} style={styles.driverAvatar} />
              ) : (
                <View style={[styles.driverAvatarPlaceholder, { backgroundColor: cardBg }]}>
                  <Ionicons name="person" size={22} color={textMuted} />
                </View>
              )}
              <View style={styles.driverInfo}>
                <Text style={[styles.driverName, { color: textPrimary }]}>
                  {acceptedApp.driverSnapshot?.firstName} {acceptedApp.driverSnapshot?.lastName}
                </Text>
                {acceptedApp.vehicleSnapshot && (
                  <Text style={[styles.driverPhotoHint, { color: textMuted }]}>
                    {acceptedApp.vehicleSnapshot.brand} {acceptedApp.vehicleSnapshot.model} · {acceptedApp.vehicleSnapshot.licensePlate}
                  </Text>
                )}
                {/* Qué se acordó con este conductor. Estaba en la lista de postulaciones pero
                    no acá, así que apenas se aceptaba una propuesta de gastos compartidos
                    desaparecía de la vista: el pasajero quedaba sin saber qué había aceptado.
                    Misma fuente que la lista (ofertaDelConductor), no una segunda lógica. */}
                {ofertaAceptada && (
                  <Text style={[styles.driverPhotoHint, { color: textMuted, marginTop: 2 }]}>
                    {ofertaAceptada.esPrecio
                      ? `${ofertaAceptada.texto} por asiento`
                      : ofertaAceptada.texto}
                  </Text>
                )}
              </View>
              <Ionicons name="checkmark-circle" size={20} color={textPrimary} />
            </View>
          </View>
        )}

        {/* Applications — passenger, open */}
        {isPassenger && request.status === 'open' && (
          <View style={[styles.section, { borderBottomColor: divider }]}>
            <Text style={[styles.sectionLabel, { color: textPrimary }]}>
              Postulaciones · {request.applications?.length || 0}/5
            </Text>
            {request.applications?.length === 0 ? (
              <Text style={{ fontSize: 13, color: textMuted }}>
                Aún no hay conductores postulados. Te avisamos cuando lleguen.
              </Text>
            ) : (
              request.applications.map((app) => (
                <TouchableOpacity
                  key={app._id}
                  style={[styles.passengerRow, { borderBottomColor: divider }]}
                  onPress={() => navigation.navigate('ApplicationDetail', {
                    app,
                    requestId,
                    // Para poder mostrar el recorrido completo: dónde sube y baja el pasajero
                    // entre las puntas del conductor.
                    // Con las paradas: sin ellas, la postulación mostraba el tramo del
                    // pasajero como si fuera directo y se perdían las direcciones del medio.
                    tramoPasajero: {
                      origin: request.origin,
                      destination: request.destination,
                      intermediateStops: request.intermediateStops || [],
                    },
                  })}
                  activeOpacity={0.75}
                >
                  {app.driverSnapshot?.avatar ? (
                    <Image source={{ uri: buildImageUri(app.driverSnapshot.avatar) }} style={styles.passengerAvatar} />
                  ) : (
                    <View style={[styles.passengerAvatarPlaceholder, { backgroundColor: cardBg }]}>
                      <Ionicons name="person" size={18} color={textMuted} />
                    </View>
                  )}
                  <View style={styles.passengerInfo}>
                    <Text style={[styles.passengerName, { color: textPrimary }]}>
                      {app.driverSnapshot?.firstName} {app.driverSnapshot?.lastName}
                    </Text>
                    <Rating
                      rating={app.driverSnapshot?.rating}
                      count={app.driverSnapshot?.ratingCount}
                      size={13}
                      style={{ marginTop: 3 }}
                    />
                    {app.vehicleSnapshot && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        <Text style={[styles.passengerSeats, { color: textMuted }]}>
                          {app.vehicleSnapshot.brand} {app.vehicleSnapshot.model}{app.vehicleSnapshot.licensePlate ? ` · ${app.vehicleSnapshot.licensePlate}` : ''}
                        </Text>
                      </View>
                    )}
                  </View>
                  {app.status === 'rejected' ? (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: cardBg }}>
                      <Text style={{ color: ui.textMuted, fontSize: 10, fontWeight: '600' }}>Rechazado</Text>
                    </View>
                  ) : (
                    /* El precio al lado del chevron: es lo que el pasajero está comparando entre
                       las hasta 5 propuestas, así que tiene que leerse sin entrar a cada una. */
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {/* Misma fuente que el detalle y que el conductor aprobado. Sin precio ni
                          modalidad no va nada: un hueco vacío se lee como si esta postulación
                          no tuviera nada que ofrecer, pero "$0" mentiría. */}
                      {(() => {
                        const oferta = ofertaDelConductor(app);
                        if (!oferta) return null;
                        return oferta.esPrecio ? (
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: textPrimary, fontSize: 15, fontFamily: 'Sora_700Bold' }}>
                              {oferta.texto}
                            </Text>
                            <Text style={{ color: textMuted, fontSize: 10 }}>{oferta.detalle}</Text>
                          </View>
                        ) : (
                          <Text style={{ color: textMuted, fontSize: 11, fontFamily: 'Sora_600SemiBold' }}>
                            {oferta.texto}
                          </Text>
                        );
                      })()}
                      <Ionicons name="chevron-forward" size={16} color={textMuted} />
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: divider }]}>

          {/* Pago pendiente (passenger) */}
          {isPassenger && request.status === 'awaiting_payment' && request.paymentData?.paymentUrl && (
            <View style={styles.pendingWrap}>
              <View style={styles.pendingTopRow}>
                <View style={styles.pendingIndicator}>
                  <View style={[styles.pendingDot, { backgroundColor: ui.textMuted }]} />
                  <Text style={[styles.pendingLabel, { color: ui.textMuted }]}>Pago pendiente</Text>
                </View>
              </View>
              <Text style={[{ fontSize: 13, color: textMuted, marginBottom: 14 }]}>
                Tu conductor está reservado. Completá el pago para confirmar el viaje.
              </Text>
              {/* invertBg y no textMuted: el gris de textos secundarios lo hacia
                  parecer deshabilitado. Es el CTA principal de esta tarjeta. */}
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: ui.invertBg }]}
                onPress={() => setCheckoutModal({ visible: true, paymentUrl: request.paymentData.paymentUrl })}
                activeOpacity={0.85}
              >
                <Text style={[styles.footerBtnText, { color: ui.invertText }]}>Ir al pago</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Esperando pago (driver) */}
          {isAcceptedDriver && request.status === 'awaiting_payment' && (
            <View style={[styles.statusFooter, { backgroundColor: ui.invertBg }]}>
              <Ionicons name="hourglass-outline" size={17} color={ui.invertText} />
              <Text style={[styles.statusFooterText, { color: ui.invertText }]}>
                ¡Te eligieron! El pasajero está completando el pago.
              </Text>
            </View>
          )}

          {/* Confirmado */}
          {(isPassenger || isAcceptedDriver) && request.status === 'paid' && (
            <View style={[styles.statusFooter, { backgroundColor: ui.invertBg }]}>
              <Ionicons name="checkmark-circle" size={17} color={ui.invertText} />
              <Text style={[styles.statusFooterText, { color: ui.invertText }]}>
                {isPassenger ? 'Viaje confirmado. Aparece en "Mis reservas".' : 'Pago confirmado. El viaje está en "Mis viajes".'}
              </Text>
            </View>
          )}

          {/* Completado */}
          {(isPassenger || isAcceptedDriver) && request.status === 'completed' && (
            <View style={[styles.statusFooter, { backgroundColor: ui.surface }]}>
              <Ionicons name="checkmark-done-circle-outline" size={17} color={ui.textMuted} />
              <Text style={[styles.statusFooterText, { color: ui.textMuted }]}>
                Viaje completado.
              </Text>
            </View>
          )}

          {/* Cancelar viaje (driver aceptado, paid) */}
          {isAcceptedDriver && request.status === 'paid' && (
            <View style={[styles.footerRow, { marginTop: 10 }]}>
              <TouchableOpacity
                style={[styles.footerBtnOutline, { borderColor: ui.border, flex: 1 }, cancelling && { opacity: 0.6 }]}
                onPress={handleCancelTrip}
                activeOpacity={0.7}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator size="small" color={ui.textMuted} />
                  : <Text style={[styles.footerBtnOutlineText, { color: ui.textMuted }]}>Cancelar viaje</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Ofrecer viaje (driver) */}
          {isDriver && (
            alreadyApplied && !['paid', 'awaiting_payment'].includes(request.status) ? (
              <>
                {/* Tu propuesta, en UNA tarjeta. Antes eran cuatro bloques sueltos apilados con
                    margen —una barra negra, una fila de texto huérfana y dos botones— y no se
                    leía como una sola cosa. Lo que importa es el número que ofreciste, así que
                    manda la jerarquía: precio grande, el resto alrededor.
                    El backend le manda al conductor SÓLO su propia postulación. */}
                <View style={[styles.miPropuesta, { backgroundColor: ui.surface, borderColor: ui.border }]}>
                  <View style={styles.miPropuestaTop}>
                    <Text style={[styles.miPropuestaLabel, { color: ui.textMuted }]}>TU PROPUESTA</Text>
                    <View style={styles.miPropuestaEstado}>
                      <Ionicons name="checkmark-circle" size={14} color={ui.text} />
                      <Text style={[styles.miPropuestaEstadoText, { color: ui.text }]}>Enviada</Text>
                    </View>
                  </View>

                  {miPostulacion?.driverPrice > 0 ? (
                    <>
                      <Text style={[styles.miPropuestaMonto, { color: ui.text }]}>
                        ${Number(miPostulacion.driverPrice).toLocaleString('es-AR')}
                      </Text>
                      <Text style={[styles.miPropuestaPie, { color: ui.textMuted }]}>por asiento</Text>
                    </>
                  ) : (
                    <Text style={[styles.miPropuestaModo, { color: ui.text }]}>
                      {miPostulacion?.sinPrecioFijo ? 'Gastos compartidos' : 'Ya te postulaste'}
                    </Text>
                  )}

                  {/* Qué recorrido ofreciste: mismo tramo o propio. Sin esto, una vez postulado
                      había que acordarse de memoria por dónde dijiste que ibas a pasar. */}
                  {miEleccion && (
                    <View style={[styles.miPropuestaRecorrido, { borderTopColor: ui.border }]}>
                      <Ionicons name={miEleccion.icono} size={15} color={ui.textMuted} />
                      <Text style={[styles.miPropuestaRecorridoText, { color: ui.textMuted }]}>
                        {miEleccion.texto}
                      </Text>
                    </View>
                  )}

                  {miTripParaMapa && (
                    <TouchableOpacity
                      style={[styles.miPropuestaVerMapa, { borderTopColor: ui.border }]}
                      onPress={() => navigation.navigate('TripMap', { trip: miTripParaMapa })}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.miPropuestaVerMapaText, { color: ui.text }]}>
                        Ver mi recorrido en el mapa
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Retirar: hasta acá, una postulación era irreversible desde la app. Sigue
                    siendo la única acción en rojo —es destructiva y no se deshace— pero como
                    texto y no como botón sólido: al lado de la tarjeta, un bloque rojo lleno
                    pesaba más que la propuesta misma, que es lo que se vino a mirar. */}
                <TouchableOpacity
                  style={[styles.retirar, retirando && { opacity: 0.6 }]}
                  onPress={handleRetirarPostulacion}
                  disabled={retirando}
                  activeOpacity={0.7}
                >
                  {retirando
                    ? <ActivityIndicator size="small" color="#EF4444" />
                    : <Text style={styles.retirarText}>Retirar postulación</Text>
                  }
                </TouchableOpacity>
              </>
            ) : canApply && !effectivelyExpired ? (
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: accent }, applying && { opacity: 0.6 }]}
                onPress={handleApplyPress}
                disabled={applying}
              >
                {applying
                  ? <ActivityIndicator color={accentInverse} />
                  : <Text style={[styles.footerBtnText, { color: accentInverse }]}>Ofrecer viaje</Text>
                }
              </TouchableOpacity>
            ) : null
          )}

          {/* Cancelar (passenger) */}
          {isPassenger && !effectivelyExpired && ['open', 'awaiting_payment', 'paid'].includes(request.status) && (
            <View style={[styles.footerRow, { marginTop: request.status === 'awaiting_payment' ? 0 : 10 }]}>
              <TouchableOpacity
                style={[styles.footerBtnOutline, { backgroundColor: '#EF4444', borderColor: '#EF4444', flex: 1 }, cancelling && { opacity: 0.6 }]}
                onPress={handleCancel}
                activeOpacity={0.7}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={[styles.footerBtnOutlineText, { color: '#FFFFFF' }]}>Cancelar solicitud</Text>
                }
              </TouchableOpacity>
            </View>
          )}

        </View>

      </ScrollView>

      {/* Checkout WebView */}
      <CheckoutWebView
        visible={checkoutModal.visible}
        paymentUrl={checkoutModal.paymentUrl}
        onClose={() => { setCheckoutModal({ visible: false, paymentUrl: null }); load(); }}
        onPaymentSuccess={async ({ externalReference }) => {
          try {
            await confirmFromCallback(externalReference || requestId, 'approved');
          } catch (e) {
            console.warn('confirmFromCallback:', e?.message);
          }
          setCheckoutModal({ visible: false, paymentUrl: null });
          load();
          navigation.navigate('Result', {
            type: 'success',
            title: 'Pago confirmado',
            message: 'Tu pago fue procesado correctamente.',
          });
        }}
        onPaymentError={(error) => {
          setCheckoutModal({ visible: false, paymentUrl: null });
          load();
          navigation.navigate('Result', {
            type: 'error',
            title: 'No se pudo procesar el pago',
            message: error?.message || 'No se pudo procesar el pago.',
          });
        }}
        reservationId={requestId}
      />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15 },

  // Status — exact match TripDetailScreen
  statusRow: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6,
  },
  statusDot:  { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontFamily: 'Sora_600SemiBold' },

  // Section
  section:      { paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionLabel: { fontSize: 11, fontFamily: 'Sora_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 },

  // Route
  routePoint:     { flexDirection: 'row', gap: 16 },
  routeRail:      { width: 18, alignItems: 'center', paddingTop: 4 },
  routeBody:      { flex: 1 },
  routeBodyGap:   { paddingBottom: 16 },
  routeDotParada: { width: 7, height: 7, borderRadius: 4 },
  routeDotOrigin: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  // flex, no alto fijo: cada fila mide distinto según cuántas líneas tenga su dirección.
  routeLineV:     { width: 1.5, flex: 1, minHeight: 18, marginVertical: 2 },
  routeDotDest:   { width: 10, height: 10, borderRadius: 5 },
  routeStopLabel:   { fontSize: 11, fontFamily: 'Sora_500Medium', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  routeStopAddress: { fontSize: 15, fontFamily: 'Sora_500Medium' },
  routeStopCity:    { fontSize: 13, marginTop: 1 },

  // Meta row
  metaRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  metaItem:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaDivider:{ width: StyleSheet.hairlineWidth, height: 20, marginHorizontal: 4 },
  metaText:   { fontSize: 13, flex: 1 },

  // Cost banner
  costBanner:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  costBannerLeft:  { flex: 1 },
  costBannerLabel: { fontSize: 14, fontFamily: 'Sora_500Medium' },
  costBannerSub:   { fontSize: 12, marginTop: 2 },
  costBannerValue: { fontSize: 22, fontFamily: 'Sora_700Bold' },

  // Driver / person row
  driverRow:              { flexDirection: 'row', alignItems: 'center', gap: 14 },
  driverAvatar:           { width: 56, height: 56, borderRadius: 28 },
  driverAvatarPlaceholder:{ width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  driverInitials:         { fontSize: 16, fontFamily: 'Sora_600SemiBold' },
  driverInfo:             { flex: 1 },
  driverName:             { fontSize: 16, fontFamily: 'Sora_600SemiBold' },
  driverPhotoHint:        { fontSize: 12, marginTop: 4 },

  // Passengers / applications list
  passengerRow:              { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  passengerAvatar:           { width: 40, height: 40, borderRadius: 20 },
  passengerAvatarPlaceholder:{ width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  passengerInfo:             { flex: 1 },
  passengerName:             { fontSize: 14, fontFamily: 'Sora_500Medium' },
  passengerSeats:            { fontSize: 12 },
  chatBtn:                   { width: 60, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  // Footer
  footer:           { padding: 16, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4, gap: 4 },
  footerRow:        { flexDirection: 'row', gap: 10 },
  // Pill, como el resto de los botones de la app.
  footerBtn:        { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  footerBtnText:    { fontSize: 15, fontFamily: 'Sora_700Bold' },
  footerBtnOutline: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  footerBtnOutlineText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  statusFooter:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12 },
  statusFooterText: { fontSize: 13, fontFamily: 'Sora_500Medium', flex: 1 },

  // Tu propuesta ya enviada. Una tarjeta con el precio como protagonista, y el recorrido y el
  // mapa colgando de él separados por líneas en vez de por márgenes sueltos.
  miPropuesta:      { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, paddingHorizontal: 18, paddingTop: 14, overflow: 'hidden' },
  miPropuestaTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  miPropuestaLabel: { fontSize: 11, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.6 },
  miPropuestaEstado:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  miPropuestaEstadoText: { fontSize: 12, fontFamily: 'Sora_600SemiBold' },
  // El número es el dato que se vino a mirar: el mismo cuerpo que usa el campo al proponerlo.
  miPropuestaMonto: { fontSize: 34, fontFamily: 'Sora_800ExtraBold', letterSpacing: -1.2, marginTop: 6 },
  miPropuestaPie:   { fontSize: 12, fontFamily: 'Sora_400Regular', marginTop: -2, marginBottom: 14 },
  miPropuestaModo:  { fontSize: 19, fontFamily: 'Sora_700Bold', letterSpacing: -0.4, marginTop: 6, marginBottom: 14 },
  // Los márgenes negativos devuelven el separador al ancho completo de la tarjeta.
  miPropuestaRecorrido: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, marginHorizontal: -18, paddingHorizontal: 18 },
  miPropuestaRecorridoText: { fontSize: 13, fontFamily: 'Sora_500Medium', flex: 1 },
  miPropuestaVerMapa: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 14, marginHorizontal: -18, paddingHorizontal: 18 },
  miPropuestaVerMapaText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },

  // Destructiva y sin vuelta atrás, pero secundaria: en rojo para que no se confunda con las
  // demás acciones, y sin relleno para que no pese más que la propuesta.
  retirar:          { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  retirarText:      { fontSize: 14, fontFamily: 'Sora_600SemiBold', color: '#EF4444' },

  // Map preview
  mapPreviewWrap: { height: 200, marginTop: 16, marginHorizontal: 20, marginBottom: 12, borderRadius: 24, overflow: 'hidden' },
  mapPreview:     { ...StyleSheet.absoluteFillObject },
  mapPreviewBadge: {
    position: 'absolute', top: 14, left: 14,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6,
  },
  // Puntos sueltos del preview (contorno = origen, relleno = destino). Colores fijos, no del
  // tema: van sobre las baldosas del mapa, que no son ni claras ni oscuras según el tema de la app.
  // Las paradas del medio, más chicas que las puntas: son escalas, no el viaje.
  previewDotStop: {
    width: 10, height: 10, borderRadius: 5, borderWidth: 2,
    backgroundColor: '#FFFFFF', borderColor: '#000000',
  },
  previewDotOrigin: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 3,
    backgroundColor: '#FFFFFF', borderColor: '#000000',
  },
  previewDotDest: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 2,
    backgroundColor: '#000000', borderColor: '#FFFFFF',
  },

  // Pending payment
  pendingWrap:      { marginBottom: 4 },
  pendingTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  pendingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingDot:       { width: 7, height: 7, borderRadius: 4 },
  pendingLabel:     { fontSize: 13, fontFamily: 'Sora_600SemiBold' },

  // Modal
});

export default TripRequestDetailScreen;
