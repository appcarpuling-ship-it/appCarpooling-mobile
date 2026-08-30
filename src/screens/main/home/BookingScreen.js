import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  BackHandler,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { MAP_PROVIDER } from '../../../utils/mapProvider';
import RutaPolyline from '../../../components/map/RutaPolyline';
import { decodePolyline, buildRoutePoints } from '../../../utils/routePoints';
import { calculateReservationPrice, createSeatReservation } from '../../../services/seatReservationService';
import { tripRemainingSeats, tripDisplaySeats } from '../../../utils/tripSeatsDisplay';
import useColors from '../../../hooks/useColors';
import { useAuth } from '../../../context/AuthContext';
import { obtenerUbicacion } from '../../../services/locationCache';
import { reverseGeocode } from '../../../services/mapsService';
import { useUI } from '../../../theme/ui';

// Reservar en pasos: el mapa de recogida/bajada ya era una pantalla aparte, pero todo lo
// demás caía junto y el asiento quedaba enterrado entre el precio y las preferencias.
const PASOS_RESERVA = ['Dónde subís y bajás', 'Asientos', 'Confirmar'];


function formatNumber(num) {
  if (typeof num !== 'number') num = parseFloat(num);
  if (isNaN(num)) return num;
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const BookingScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useColors();
  const { user } = useAuth();

  const dark = isDarkMode;
  const bg = colors.background;
  
  const cleanAddress = (address, city, province) => {
    if (!address) return null;
    
    let cleaned = address;
    
    // Eliminar códigos postales
    cleaned = cleaned.replace(/\b[A-Z]?\d{4,5}[A-Z]{0,3}\b/g, '');
    
    // Eliminar ciudad y provincia si están incluidas en la dirección
    if (city) {
      cleaned = cleaned.replace(new RegExp(`,?\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,?`, 'gi'), '');
    }
    if (province) {
      cleaned = cleaned.replace(new RegExp(`,?\\s*${province.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,?`, 'gi'), '');
    }
    
    // Eliminar "argentina" si aparece
    cleaned = cleaned.replace(/,?\s*argentina\s*,?/gi, '');
    
    // Limpiar comas múltiples y espacios
    cleaned = cleaned
      .replace(/\s*,\s*,+/g, ',')
      .replace(/(^[,\s]+|[,\s]+$)/g, '')
      .trim();
    
    return cleaned || null;
  };

  const formatLocationString = (city, province, country = 'Argentina') => {
    const parts = [];
    if (city) parts.push(city);
    if (province) parts.push(province);
    if (country) parts.push(country);
    return parts.join(', ');
  };
  
  const cardBg = colors.cardBackground || (dark ? '#1C1C1E' : '#FFFFFF');
  const textPrimary = colors.textPrimary;
  const textMuted = colors.textMuted;

  const ui = useUI();  const divider = ui.bg;
  const accent = ui.invertBg;
  const accentInverse = ui.invertText;
  const sectionLabelColor = dark ? textMuted : '#374151';
  const successColor = ui.text || ui.text;
  
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [paso, setPaso] = useState(1);
  const scrollRef = useRef(null);
  const [priceData, setPriceData] = useState(null);
  const [seats, setSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [calculatingPrice, setCalculatingPrice] = useState(true);
  const [error, setError] = useState('');
  
  const routeParams = route.params || {};
  const trip = routeParams.trip;
  const existingReservation = routeParams.existingReservation;

  // Mini mapa arriba del resumen, mismo criterio que en Detalle del viaje: contexto visual
  // en vez de solo texto. Sin trazado real guardado no va línea (una recta cruza terreno y
  // ríos en diagonal, ninguna calle hace eso) — solo los dos puntos.
  const bookingOriginCoords = trip?.origin?.coordinates;
  const bookingDestCoords = trip?.destination?.coordinates;
  const hasBookingMapPreview = Boolean(bookingOriginCoords?.latitude && bookingDestCoords?.latitude);
  const bookingStraightLine = hasBookingMapPreview
    ? [
        { latitude: bookingOriginCoords.latitude, longitude: bookingOriginCoords.longitude },
        { latitude: bookingDestCoords.latitude, longitude: bookingDestCoords.longitude },
      ]
    : [];
  const bookingDecodedPolyline = trip?.routePolyline ? decodePolyline(trip.routePolyline) : [];
  const hasBookingRealRoute = bookingDecodedPolyline.length >= 2;
  const bookingPreviewCoordinates = hasBookingRealRoute ? bookingDecodedPolyline : bookingStraightLine;
  // Las paradas del medio también van marcadas: sin ellas el preview de un viaje con
  // paradas era indistinguible de uno directo. buildRoutePoints ya descarta las que caen
  // encima del origen o el destino, que sólo taparían esos pines.
  const bookingPreviewStops = buildRoutePoints(trip)
    .filter((p) => !p.isEnd && p.location?.coordinates?.latitude != null)
    .map((p) => ({
      latitude: p.location.coordinates.latitude,
      longitude: p.location.coordinates.longitude,
    }));
  // Las paradas entran en el encuadre: sin trazado real, una parada lejos de la recta
  // origen→destino quedaba fuera de cuadro.
  const puntosDelEncuadre = hasBookingMapPreview
    ? [...bookingPreviewCoordinates, ...bookingPreviewStops]
    : [];
  const bookingPreviewRegion = hasBookingMapPreview
    ? (() => {
        const lats = puntosDelEncuadre.map((p) => p.latitude);
        const lngs = puntosDelEncuadre.map((p) => p.longitude);
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
  // En Android, un marker con vista propia y tracksViewChanges en false desde el primer
  // render se dibuja invisible (mismo bug ya resuelto en TripMapScreen/TripDetailScreen).
  const [bookingMapReady, setBookingMapReady] = useState(false);
  const [bookingDotsVivos, setBookingDotsVivos] = useState(true);
  const bookingMapRef = useRef(null);
  useEffect(() => {
    if (!bookingMapReady) return undefined;
    const t = setTimeout(() => setBookingDotsVivos(false), 900);
    return () => clearTimeout(t);
  }, [bookingMapReady]);
  // `initialRegion` sola no alcanza: en Android se aplica antes de que la vista nativa esté
  // lista y queda ignorada, y el mapa arranca con un zoom que no es el del recorrido. Mismo
  // encuadre que TripDetailScreen. La cantidad de puntos va en las dependencias y no el array,
  // que se arma nuevo en cada render.
  useEffect(() => {
    if (!bookingMapReady || puntosDelEncuadre.length < 2) return;
    bookingMapRef.current?.fitToCoordinates(puntosDelEncuadre, {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: false,
    });
  }, [bookingMapReady, puntosDelEncuadre.length]);

  const tripFreeNow = useMemo(() => tripRemainingSeats(trip), [trip]); // guard: incluye holds pendientes
  const tripShownSeats = useMemo(() => tripDisplaySeats(trip), [trip]); // display: sin holds

  // Lo que el conductor cobra por asiento: no pasa por la app, se le paga a él al llegar.
  // Es aparte del precio de la conexión que se cobra acá.
  const driverPrice = Math.max(0, Number(trip?.driverPrice) || 0);
  const driverPriceTotal = driverPrice * (seats || 1);

  /**
   * Tope del selector: se usa el número mostrado (sin holds), no el del guard,
   * para no dejar "2 disponibles" en pantalla y solo permitir elegir 1 — muy
   * confuso. Si justo en el medio otro usuario confirma el cupo que faltaba,
   * el backend lo rechaza al confirmar con un mensaje claro para reintentar.
   */
  const maxSelectableSeats = useMemo(() => {
    if (!tripShownSeats || tripShownSeats <= 0) return 0;
    return Math.min(99, tripShownSeats);
  }, [tripShownSeats]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;


  const calculatePrice = async () => {
    if (!trip) return;
    try {
      setCalculatingPrice(true);
      setError('');
      const tripId = trip._id || trip.id;
      const response = await calculateReservationPrice(tripId, seats, { pickupLocation, dropoffLocation });
      if (response.success) {
        const basePrice = response.data.pricing.totalPrice;
        const userDiscount = user?.discountPercentage || 0;
        let discountAmount = 0;
        let finalPrice = basePrice;
        if (userDiscount > 0) {
          discountAmount = (basePrice * userDiscount) / 100;
          finalPrice = basePrice - discountAmount;
        }
        setPriceData({
          ...response.data,
          pricing: {
            ...response.data.pricing,
            originalPrice: basePrice,
            discountPercentage: userDiscount,
            discountAmount: Math.round(discountAmount),
            finalPrice: Math.round(finalPrice),
          },
        });
      } else {
        setError('Error al calcular el precio');
      }
    } catch (err) {
      setError(err.message || 'Error al calcular el precio');
    } finally {
      setCalculatingPrice(false);
    }
  };

  useEffect(() => {
    setSeats((s) => {
      if (!maxSelectableSeats || maxSelectableSeats <= 0) return 0;
      return Math.min(Math.max(1, s), maxSelectableSeats);
    });
  }, [maxSelectableSeats]);

  useEffect(() => {
    const autoDetectPickup = async () => {
      try {
        // Del caché si Home ya lo precargó: sin esperar al GPS de nuevo. Ver locationCache.
        const coords = await obtenerUbicacion();
        if (!coords) return;
        const data = await reverseGeocode(coords.latitude, coords.longitude);
        const cruda = data?.results?.[0]?.formatted_address;
        if (cruda) setPickupLocation({ address: cleanAddress(cruda) || cruda, coordinates: coords });
      } catch {}
    };
    autoDetectPickup();
  }, []);

  useEffect(() => {
    if (!trip) return;
    if (!existingReservation) {
      const free = tripRemainingSeats(trip);
      if (free <= 0) {
        setCalculatingPrice(false);
        setPriceData(null);
        setError(
          'No hay asientos disponibles. El viaje puede estar completo o con solicitudes pendientes.'
        );
        return;
      }
      calculatePrice();
    } else {
      setPriceData({
        pricing: {
          basePrice: existingReservation.totalPrice,
          totalPrice: existingReservation.totalPrice,
          numberOfSeats: existingReservation.seatsBooked,
        },
      });
      setSeats(existingReservation.seatsBooked);
      setCalculatingPrice(false);
    }
    
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // También al cambiar los puntos: los dos suman su desvío al precio, así que si no se
  // recalcula, la pantalla muestra el precio de antes de elegirlos.
  useEffect(() => {
    if (!trip || seats <= 0 || existingReservation) return;
    if (tripRemainingSeats(trip) <= 0) return;
    calculatePrice();
  }, [seats, pickupLocation, dropoffLocation]);

  if (!trip || !trip.origin || !trip.destination) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: ui.textMuted || ui.textMuted }]}>
            Error: Datos del viaje incompletos
          </Text>
        </View>
      </View>
    );
  }






  // Dirección frecuente: ya tenemos coordinates guardadas, sin llamar a Place Details de nuevo.



  const esUltimoPaso = paso === PASOS_RESERVA.length;

  const irAlSiguientePaso = () => {
    setPaso((p) => Math.min(p + 1, PASOS_RESERVA.length));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const volverDePaso = () => {
    if (paso > 1) {
      setPaso((p) => p - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      return true;
    }
    return false;
  };

  const handleCreateReservation = async () => {
    if (tripRemainingSeats(trip) <= 0 || !priceData) return;
    setLoading(true);
    setError('');
    try {
      const tripId = trip._id || trip.id;
      const reservationResponse = await createSeatReservation({
        tripId,
        seatsBooked: seats,
        message: '',
        ...(pickupLocation?.address && { pickupLocation }),
        ...(dropoffLocation?.address && { dropoffLocation })
      });
      if (!reservationResponse?.success) {
        throw new Error(reservationResponse?.message || 'Error creando la reserva');
      }
      // El backend aplica el cupón/descuento bancado al crear la reserva (se cobra
      // recién cuando el conductor apruebe), pero nunca se lo confirmamos al pasajero.
      const { couponApplied, couponDiscountAmount, discountApplied } = reservationResponse.data || {};
      const discountNote = couponApplied
        ? ` Se aplicó tu cupón ${couponApplied}: ahorrás $${Number(couponDiscountAmount || 0).toLocaleString('es-AR')} ARS en el costo de la reserva.`
        : discountApplied > 0
          ? ` Se aplicó tu descuento del ${discountApplied}% en el costo de la reserva.`
          : '';
      navigation.navigate('Result', {
        type: 'success',
        title: 'Solicitud Enviada',
        message: `Tu solicitud de reserva ha sido enviada al conductor. Te notificaremos cuando la apruebe.${discountNote}`,
        primaryLabel: 'Continuar',
        onPrimary: () => navigation.navigate('CarpoolingsTab', { screen: 'MyBookings', initial: false }),
      });
      // Result vive en el stack raíz, encima de las tabs, así que la tab de Inicio se queda
      // parada en este formulario. Al volver a Inicio reaparecía la reserva ya enviada, y
      // reservar de nuevo fallaba por capacidad porque el asiento ya estaba tomado.
      // Se vacía el stack de Inicio pase lo que pase después, no sólo si toca "Continuar".
      navigation.popToTop();
    } catch (err) {
      navigation.navigate('Result', {
        type: 'error',
        title: 'Error',
        message: err?.response?.data?.message || err?.message || 'Error al procesar la reserva',
      });
    } finally {
      setLoading(false);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: PASOS_RESERVA[paso - 1],
      // La flecha retrocede de paso, no sale de la reserva: salir tira los puntos elegidos.
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => { if (!volverDePaso()) navigation.goBack(); }}
          style={{ paddingVertical: 10, paddingRight: 10, paddingLeft: 4, marginLeft: Platform.OS === 'android' ? 6 : 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="chevron-back" size={26} color={textPrimary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, paso, textPrimary]);

  // El botón físico de Android retrocede de paso en vez de salir de la reserva.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', volverDePaso);
    return () => sub.remove();
  }, [paso]);

  const displayPrice = priceData?.pricing?.finalPrice || priceData?.pricing?.totalPrice;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Animated.View
        style={[styles.animatedContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }], backgroundColor: bg }]}
      >
        <ScrollView
          ref={scrollRef}
          style={[styles.scroll, { backgroundColor: bg }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >

          {/* Progreso. Reservar es tres decisiones —dónde te suben, cuántos asientos y confirmar—
              y en una sola pantalla larga se perdían entre el precio, los detalles y las
              preferencias del viaje. */}
          <View style={styles.pasoBarra}>
              {PASOS_RESERVA.map((_, i) => (
                  <View key={i} style={[styles.pasoTramo, { backgroundColor: i < paso ? textPrimary : divider }]} />
              ))}
          </View>
          <Text style={[styles.pasoTexto, { color: textMuted }]}>
              Paso {paso} de {PASOS_RESERVA.length} · {PASOS_RESERVA[paso - 1]}
          </Text>

          {/* Mini mapa: contexto visual del recorrido antes del resumen en texto. No
              interactivo (sin scroll/zoom) — es una foto, no algo para explorar acá. */}
          {hasBookingMapPreview && (
            <View style={styles.bookingMapWrap}>
              <MapView
                ref={bookingMapRef}
                provider={MAP_PROVIDER}
                style={styles.bookingMapPreview}
                initialRegion={bookingPreviewRegion}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                pointerEvents="none"
                onMapReady={() => setBookingMapReady(true)}
              >
                {hasBookingRealRoute && (
                  <RutaPolyline coordinates={bookingPreviewCoordinates} width={4} color="#000000" />
                )}
                <Marker
                  key={`booking-origin-${bookingMapReady}`}
                  coordinate={{ latitude: bookingOriginCoords.latitude, longitude: bookingOriginCoords.longitude }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={bookingDotsVivos}
                >
                  <View style={styles.bookingDotOrigin} />
                </Marker>
                {bookingPreviewStops.map((stop, i) => (
                  <Marker
                    key={`booking-stop-${i}-${bookingMapReady}`}
                    coordinate={stop}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={bookingDotsVivos}
                  >
                    <View style={styles.bookingDotStop} />
                  </Marker>
                ))}
                <Marker
                  key={`booking-dest-${bookingMapReady}`}
                  coordinate={{ latitude: bookingDestCoords.latitude, longitude: bookingDestCoords.longitude }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={bookingDotsVivos}
                >
                  <View style={styles.bookingDotDest} />
                </Marker>
              </MapView>
            </View>
          )}

          {/* Trip Summary */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: divider }]}>
            <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Resumen del viaje</Text>

            {/* Route */}
            <View style={styles.routeRow}>
              <View style={styles.routeCol}>
                <View style={styles.routeDot} />
                {/* `divider` es ui.bg, o sea el MISMO color del fondo: la línea existía pero era
                    invisible sobre la tarjeta. Va con el color del texto, que en oscuro es blanco
                    y en claro es negro, así que se ve en los dos temas. */}
                <View style={[styles.routeLine, { backgroundColor: textPrimary }]} />
                <View style={[styles.routeDotDest, { borderColor: accent }]} />
              </View>
              <View style={styles.routeTextCol}>
                <View style={styles.routeStop}>
                  {!!cleanAddress(trip.origin?.address, trip.origin?.city, trip.origin?.province) && (
                    <Text style={[styles.routeAddress, { color: textPrimary }]} numberOfLines={1}>{cleanAddress(trip.origin.address, trip.origin.city, trip.origin.province)}</Text>
                  )}
                  <Text style={[styles.routeCity, { color: textMuted }]} numberOfLines={1}>
                    {formatLocationString(trip.origin?.city || 'Origen', trip.origin?.province)}
                  </Text>
                </View>
                <View style={[styles.routeStop, { marginTop: 16 }]}>
                  {!!cleanAddress(trip.destination?.address, trip.destination?.city, trip.destination?.province) && (
                    <Text style={[styles.routeAddress, { color: textPrimary }]} numberOfLines={1}>{cleanAddress(trip.destination.address, trip.destination.city, trip.destination.province)}</Text>
                  )}
                  <Text style={[styles.routeCity, { color: textMuted }]} numberOfLines={1}>
                    {formatLocationString(trip.destination?.city || 'Destino', trip.destination?.province)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Date & Time */}
            <View style={[styles.metaRow, { borderTopColor: divider }]}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={15} color={textMuted} />
                <Text style={[styles.metaText, { color: textMuted }]}>
                  {new Date(trip.departureDate).toLocaleDateString('es-ES', {
                    weekday: 'short', day: 'numeric', month: 'short',
                  })}
                </Text>
              </View>
              <View style={[styles.metaDivider, { backgroundColor: divider }]} />
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={15} color={textMuted} />
                <Text style={[styles.metaText, { color: textMuted }]}>{trip.departureTime || 'N/A'} hs</Text>
              </View>
              <View style={[styles.metaDivider, { backgroundColor: divider }]} />
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={15} color={textMuted} />
                <Text style={[styles.metaText, { color: textMuted }]}>
                  {tripShownSeats} disponible{tripShownSeats !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>


          {paso === 1 && (
              <>
          {/* Dónde sube y dónde baja. Las dos filas son la misma: sólo cambia en qué estado
              cae el punto y contra qué punta del viaje se mide el desvío. */}
          {[
            { mode: 'pickup', label: 'Punto de recogida', vacio: 'Agregar punto de recogida',
              icon: 'location-outline', value: pickupLocation,
              set: setPickupLocation, clear: () => setPickupLocation(null) },
            { mode: 'dropoff', label: 'Punto de bajada', vacio: 'Bajar en el destino del viaje',
              icon: 'flag-outline', value: dropoffLocation,
              set: setDropoffLocation, clear: () => setDropoffLocation(null) },
          ].map((row) => (
            <TouchableOpacity
              key={row.mode}
              style={[styles.card, styles.pickupRow, { backgroundColor: cardBg, borderColor: divider }]}
              onPress={() => navigation.navigate('PointPicker', {
                mode: row.mode,
                initial: row.value,
                // Para la bajada conviene abrir en el destino del viaje y no donde está
                // parado el usuario, que puede ser del otro lado del país.
                fallback: row.mode === 'dropoff' ? trip?.destination?.coordinates : null,
                onSelect: row.set,
              })}
              activeOpacity={0.7}
            >
              <View style={[styles.pickupIconWrap, { backgroundColor: ui.bg }]}>
                <Ionicons name={row.icon} size={18} color={textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickupLabel, { color: textMuted }]}>{row.label}</Text>
                <Text style={[styles.pickupValue, { color: row.value ? textPrimary : textMuted }]} numberOfLines={1}>
                  {row.value ? row.value.address : row.vacio}
                </Text>
              </View>
              {row.value
                ? <TouchableOpacity onPress={(e) => { e.stopPropagation(); row.clear(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={textMuted} />
                  </TouchableOpacity>
                : <Ionicons name="chevron-forward" size={16} color={textMuted} />
              }
            </TouchableOpacity>
          ))}

              </>
          )}

          {paso === 2 && (
              <>
          {/* Selector de asientos: SIEMPRE visible. Antes se reemplazaba por un cartel de
              "Calculando precio…" de otra altura, y como el precio se recalcula en cada
              cambio de asientos, el selector desaparecía y volvía saltando en cada toque.
              Los asientos no dependen del precio: el tope sale del viaje. */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: divider }]}>
            <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Asientos</Text>

              <View style={styles.seatSelector}>
                <TouchableOpacity
                  style={[styles.seatBtn, { backgroundColor: seats === 1 ? divider : accent }]}
                  onPress={() => setSeats(Math.max(1, seats - 1))}
                  disabled={seats === 1}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={20} color={seats === 1 ? textMuted : accentInverse} />
                </TouchableOpacity>

                <View style={styles.seatCountWrap}>
                  <Text style={[styles.seatCount, { color: textPrimary }]}>{seats}</Text>
                  <Text style={[styles.seatCountLabel, { color: textMuted }]}>asiento{seats > 1 ? 's' : ''}</Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.seatBtn,
                    { backgroundColor: seats === maxSelectableSeats ? divider : accent },
                  ]}
                  onPress={() => setSeats((s) => Math.min(maxSelectableSeats, s + 1))}
                  disabled={seats >= maxSelectableSeats}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color={seats >= maxSelectableSeats ? textMuted : accentInverse} />
                </TouchableOpacity>
              </View>
          </View>

          {!!error && (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: divider }]}>
              <Text style={[styles.errorInline, { color: ui.textMuted }]}>{error}</Text>
            </View>
          )}

              </>
          )}

          {paso === 3 && (
              <>
          {/* Acá vivía la ficha "Pagás ahora", que mostraba la comisión de Carpuling.
              El pasajero ya no la paga: la paga el conductor, como saldo, cuando el viaje se
              completa. Dejarla habría sido pedirle plata que no debe.

              Lo único que le corresponde ver es lo que le paga al conductor, que es la ficha
              de abajo. */}

          {/* Lo que le paga al CONDUCTOR va en su PROPIA ficha. Estaba metido dentro de la de
              arriba, cuyo título es "Pagás ahora por la app": esta plata no se paga ahora ni por
              la app, así que el título se contradecía con su propio contenido. Separadas, cada
              encabezado dice la verdad y se lee que son dos pagos distintos.

              Va igual en esta pantalla, donde decide: enterarse al bajarse del auto es
              exactamente lo que este rediseño vino a sacar. */}
          {driverPriceTotal > 0 && (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: divider }]}>
              <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Al conductor le pagás al llegar</Text>
              {/* Número hero en vez de una fila con la etiqueta vacía (con un solo asiento no
                  había nada que poner a la izquierda). Mismo estilo que ya usan la ficha del
                  conductor en el detalle del viaje y la del detalle de la postulación, para
                  que este monto se lea igual en toda la app. */}
              <Text style={{ color: textPrimary, fontSize: 30, fontFamily: 'Sora_800ExtraBold', letterSpacing: -1, marginTop: 2 }}>
                ${formatNumber(driverPriceTotal)} ARS
              </Text>
              {seats > 1 && (
                <Text style={[styles.priceLabel, { color: textMuted, marginTop: 4 }]}>
                  ${formatNumber(driverPrice)} por asiento × {seats}
                </Text>
              )}
            </View>
          )}


          {/* Preferences */}
          {trip.rules && (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: divider }]}>
              <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Preferencias</Text>
              <View style={styles.prefGrid}>
                <View style={styles.prefItem}>
                  <Ionicons
                    name={trip.rules?.smokingAllowed ? 'checkmark-circle-outline' : 'close-circle-outline'}
                    size={18}
                    color={trip.rules?.smokingAllowed ? successColor : ui.textMuted}
                  />
                  <Text style={[styles.prefText, { color: textMuted }]}>
                    {trip.rules?.smokingAllowed ? 'Permite fumar' : 'No fumar'}
                  </Text>
                </View>
                <View style={styles.prefItem}>
                  <Ionicons
                    name={trip.rules?.petsAllowed ? 'checkmark-circle-outline' : 'close-circle-outline'}
                    size={18}
                    color={trip.rules?.petsAllowed ? successColor : ui.textMuted}
                  />
                  <Text style={[styles.prefText, { color: textMuted }]}>
                    {trip.rules?.petsAllowed ? 'Mascotas OK' : 'Sin mascotas'}
                  </Text>
                </View>
                <View style={styles.prefItem}>
                  <Ionicons
                    name={trip.rules?.musicAllowed !== false ? 'musical-notes-outline' : 'musical-notes-outline'}
                    size={18}
                    color={trip.rules?.musicAllowed !== false ? successColor : ui.textMuted}
                  />
                  <Text style={[styles.prefText, { color: textMuted }]}>
                    {trip.rules?.musicAllowed !== false ? 'Música OK' : 'Sin música'}
                  </Text>
                </View>
                <View style={styles.prefItem}>
                  <Ionicons name="chatbubble-outline" size={18} color={textMuted} />
                  <Text style={[styles.prefText, { color: textMuted }]}>
                    {trip.rules?.talkative === 'quiet' ? 'Silencioso' : trip.rules?.talkative === 'chatty' ? 'Conversador' : 'Flexible'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Notes */}
          {trip.notes && (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: divider }]}>
              <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Notas del conductor</Text>
              <Text style={[styles.notesText, { color: textMuted }]}>{trip.notes}</Text>
            </View>
          )}


              </>
          )}

        </ScrollView>

        {/* Fijo abajo: el botón principal tiene que estar siempre en el mismo lugar. Dentro
            del scroll subía o bajaba según cuánto contenido tuviera el paso, y en los pasos
            cortos quedaba en el medio de la pantalla con todo vacío debajo. */}
        <View style={[styles.footerFijo, { backgroundColor: bg, borderTopColor: divider, paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Footer */}
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            {
              backgroundColor:
                tripFreeNow <= 0 ? (ui.textMuted || ui.textMuted) : accent,
              opacity:
                loading ||
                calculatingPrice ||
                tripFreeNow <= 0 ||
                (!priceData && tripFreeNow > 0)
                  ? 0.5
                  : 1,
            },
          ]}
          onPress={esUltimoPaso ? handleCreateReservation : irAlSiguientePaso}
          disabled={
            loading ||
            calculatingPrice ||
            tripFreeNow <= 0 ||
            (!priceData && tripFreeNow > 0)
          }
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={accentInverse} size="small" />
          ) : (
            // El botón no lleva monto: el pasajero no paga nada por la app al reservar, así
            // que un número acá se lee como un cobro que no existe. Lo que le va a pagar al
            // conductor ya está en la ficha de arriba, que es donde corresponde.
            <Text style={[styles.confirmBtnText, { color: accentInverse }]}>
              {tripFreeNow <= 0
                ? 'No hay cupos disponibles'
                : esUltimoPaso ? 'Solicitar Reserva' : 'Continuar'}
            </Text>
          )}
        </TouchableOpacity>

        </View>
      </Animated.View>



    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    fontFamily: 'Sora_600SemiBold',
    textAlign: 'center',
  },
  animatedContainer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Card
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 12,
  },

  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Sora_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 14,
  },

  // Route
  routeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  routeCol: {
    alignItems: 'center',
    paddingTop: 5,
    width: 12,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  routeLine: {
    width: 1.5,
    flex: 1,
    marginVertical: 4,
    minHeight: 20,
  },
  routeDotDest: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  routeTextCol: {
    flex: 1,
  },
  routeStop: {},
  routeCity: {
    fontSize: 15,
    fontFamily: 'Sora_600SemiBold',
  },
  routeAddress: {
    fontSize: 12,
    marginTop: 1,
  },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  metaText: {
    fontSize: 12,
  },
  metaDivider: {
    width: 1,
    height: 14,
    marginHorizontal: 8,
  },

  // Seat Selector
  seatSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingVertical: 4,
  },
  seatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatCountWrap: {
    alignItems: 'center',
    minWidth: 48,
  },
  seatCount: {
    fontSize: 36,
    fontFamily: 'Sora_700Bold',
    lineHeight: 40,
  },
  seatCountLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  errorInline: {
    fontSize: 14,
    fontFamily: 'Sora_500Medium',
  },

  // Price
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  priceLabel: {
    fontSize: 14,
  },
  priceValue: {
    fontSize: 14,
    fontFamily: 'Sora_500Medium',
  },
  priceDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  priceTotalLabel: {
    fontSize: 16,
    fontFamily: 'Sora_600SemiBold',
  },
  priceTotalValue: {
    fontSize: 18,
    fontFamily: 'Sora_700Bold',
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  discountBadgeText: {
    fontSize: 13,
    fontFamily: 'Sora_500Medium',
    flex: 1,
  },

  // Driver

  // Vehicle


  // Preferences
  prefGrid: {
    gap: 10,
  },
  prefItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prefText: {
    fontSize: 14,
  },

  // Notes
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Banner Carousel

  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  pickupIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickupLabel: {
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  pickupValue: {
    fontSize: 14,
    fontFamily: 'Sora_500Medium',
  },

  footerFijo: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pasoBarra: { flexDirection: 'row', gap: 6, marginTop: 4, marginBottom: 8 },
  pasoTramo: { flex: 1, height: 3, borderRadius: 999 },
  pasoTexto: { fontSize: 12, fontFamily: 'Sora_500Medium', marginBottom: 14 },
  bookingMapWrap: { height: 140, borderRadius: 20, overflow: 'hidden', marginBottom: 12 },
  bookingMapPreview: { ...StyleSheet.absoluteFillObject },
  // Las paradas del medio, más chicas que las puntas: son escalas, no el viaje.
  bookingDotStop: {
    width: 10, height: 10, borderRadius: 5, borderWidth: 2,
    backgroundColor: '#FFFFFF', borderColor: '#000000',
  },
  bookingDotOrigin: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 3,
    backgroundColor: '#FFFFFF', borderColor: '#000000',
  },
  bookingDotDest: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 2,
    backgroundColor: '#000000', borderColor: '#FFFFFF',
  },
  confirmBtn: {
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 22,
    flexDirection: 'row',
    // Centrado: el `space-between` era para empujar el precio al borde derecho. Sin el
    // precio dejaba el texto solo, pegado a la izquierda.
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    fontFamily: 'Sora_600SemiBold',
  },
});


export default BookingScreen;
