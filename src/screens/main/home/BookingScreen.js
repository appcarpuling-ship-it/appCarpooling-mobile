import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  FlatList,
  BackHandler,
  TextInput,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { calculateReservationPrice, createSeatReservation } from '../../../services/seatReservationService';
import { get_public } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { sanitizeImageUrl } from '../../../utils/imageUtils';
import { tripRemainingSeats, tripDisplaySeats, tripSeatCapacity } from '../../../utils/tripSeatsDisplay';
import useColors from '../../../hooks/useColors';
import { useAuth } from '../../../context/AuthContext';
import * as Location from 'expo-location';
import { useFrequentAddresses } from '../../../hooks/useFrequentAddresses';
import { searchPlaces, getPlaceDetails, reverseGeocode } from '../../../services/mapsService';
import { useUI } from '../../../theme/ui';

// Reservar en pasos: el mapa de recogida/bajada ya era una pantalla aparte, pero todo lo
// demás caía junto y el asiento quedaba enterrado entre el precio y las preferencias.
const PASOS_RESERVA = ['Dónde subís y bajás', 'Asientos', 'Confirmar'];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 48;
const BANNER_HEIGHT = 160;

function formatNumber(num) {
  if (typeof num !== 'number') num = parseFloat(num);
  if (isNaN(num)) return num;
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const BookingScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useColors();
  const { user } = useAuth();
  const frequentAddresses = useFrequentAddresses();

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
  // El selector de mapa es UNO solo y sirve para los dos puntos: duplicar las ~17 piezas de
  // estado, el buscador y el geocodificador inverso para la dejada era garantía de que se
  // arreglara un bug en una copia y no en la otra. pickerMode dice dónde cae lo confirmado.
  const [pickerMode, setPickerMode] = useState('pickup');
  // El MapView no puede montarse en el mismo frame en que aparece el overlay: en iOS sale
  // en blanco (celeste, sin tiles). Con la recogida no se notaba porque la región llega
  // recién cuando responde el GPS, o sea un frame después; con la bajada se arma de una
  // desde el destino del viaje y el mapa nacía en el mismo commit. Un tick de espera.
  const [overlayMontado, setOverlayMontado] = useState(false);
  const [paso, setPaso] = useState(1);
  const scrollRef = useRef(null);
  const [pickupMapVisible, setPickupMapVisible] = useState(false);
  const [pickupSearch, setPickupSearch] = useState('');
  const [pickupSearchResults, setPickupSearchResults] = useState([]);
  const [pickupRegion, setPickupRegion] = useState(null);
  const [pickupPinCoords, setPickupPinCoords] = useState(null);
  const [pickupResolving, setPickupResolving] = useState(false);
  const pickupMapRef = useRef(null);
  const pickupSearchDebounce = useRef(null);
  const [pickupSearchVisible, setPickupSearchVisible] = useState(false);
  const [pickupPinAddress, setPickupPinAddress] = useState('');
  const pickupOverlayOpacity = useRef(new Animated.Value(0)).current;
  const pickupOverlayY = useRef(new Animated.Value(16)).current;
  const pickupIdleTimer = useRef(null);
  const pickupGeocodeId = useRef(0);
  // Se incrementa para forzar el remontaje del mapa. El buscador se abre a pantalla completa
  // TAPANDO el mapa, y al cerrarse el GMSMapView de iOS queda con el renderizado suspendido:
  // sigue vivo (onMapReady ya disparó) y con la región correcta, pero no vuelve a dibujar
  // tiles. Por eso quedaba celeste sólo cuando se pasaba por el buscador — que es siempre en
  // la bajada, porque ahí no hay dirección precargada como en la recogida.
  const [mapKey, setMapKey] = useState(0);
  const [pickupMapSelectionMode, setPickupMapSelectionMode] = useState(false);
  const pickupMapSelectionModeRef = useRef(false);
  const [priceData, setPriceData] = useState(null);
  const [seats, setSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [calculatingPrice, setCalculatingPrice] = useState(true);
  const [error, setError] = useState('');
  
  const routeParams = route.params || {};
  const trip = routeParams.trip;
  const existingReservation = routeParams.existingReservation;

  const tripFreeNow = useMemo(() => tripRemainingSeats(trip), [trip]); // guard: incluye holds pendientes
  const tripShownSeats = useMemo(() => tripDisplaySeats(trip), [trip]); // display: sin holds
  const tripCap = useMemo(() => tripSeatCapacity(trip), [trip]);

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

  /**
   * Región del mapa a partir de unas coordenadas, o null si no sirven.
   *
   * El 0 es el caso que importa: `coords.latitude != null` lo da por bueno, y un viaje con el
   * destino sin geocodificar queda en 0,0 — que es mar abierto frente a África. El mapa se
   * abría en el océano y se veía una pantalla celeste vacía.
   */
  const regionDesde = (coords, delta) => {
    const lat = Number(coords?.latitude);
    const lng = Number(coords?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta };
  };

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
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        const addr = await reverseGeocodePickup(coords);
        if (addr) setPickupLocation({ address: addr, coordinates: coords });
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

  const searchPickupPlaces = useCallback((text) => {
    if (pickupSearchDebounce.current) clearTimeout(pickupSearchDebounce.current);
    if (!text || text.length < 3) { setPickupSearchResults([]); return; }
    pickupSearchDebounce.current = setTimeout(async () => {
      try {
        const data = await searchPlaces(text);
        if (data.predictions) setPickupSearchResults(data.predictions.slice(0, 5));
      } catch {}
    }, 400);
  }, []);

  const gotoUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('denied');
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setPickupPinCoords(coords);
      setPickupRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      pickupGeocodeId.current++;
      const thisId = pickupGeocodeId.current;
      const addr = await reverseGeocodePickup(coords);
      if (pickupGeocodeId.current === thisId) setPickupPinAddress(addr || '');
    } catch {
      // Sin permiso de ubicación: el origen del viaje, y si ese tampoco sirve (0,0 o sin
      // geocodificar), Buenos Aires. Cualquier cosa antes que abrir el mapa en el océano.
      const fallback = regionDesde(trip?.origin?.coordinates, 0.02)
        || { latitude: -34.6037, longitude: -58.3816, latitudeDelta: 0.02, longitudeDelta: 0.02 };
      setPickupPinCoords({ latitude: fallback.latitude, longitude: fallback.longitude });
      setPickupRegion(fallback);
    }
  };

  const openPickupSearch = () => {
    setPickupSearchVisible(true);
    pickupOverlayOpacity.setValue(0);
    pickupOverlayY.setValue(16);
    Animated.parallel([
      Animated.timing(pickupOverlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(pickupOverlayY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const closePickupSearch = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(pickupOverlayOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(pickupOverlayY, { toValue: 12, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setPickupSearchVisible(false);
      setPickupSearch('');
      setPickupSearchResults([]);
      setMapKey((k) => k + 1);
    });
  };

  const selectPickupFromSearch = async (prediction) => {
    closePickupSearch();
    try {
      const data = await getPlaceDetails(prediction.place_id, 'geometry,formatted_address');
      if (data.result?.geometry?.location) {
        const coords = { latitude: data.result.geometry.location.lat, longitude: data.result.geometry.location.lng };
        pickupGeocodeId.current++;  // cancel any in-flight geocode from map dragging
        if (pickupIdleTimer.current) { clearTimeout(pickupIdleTimer.current); pickupIdleTimer.current = null; }
        setPickupPinCoords(coords);
        setPickupPinAddress(prediction.description);
        const region = { ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 };
        setPickupRegion(region);
        pickupMapRef.current?.animateToRegion(region, 500);
      }
    } catch {}
  };

  // Dirección frecuente: ya tenemos coordinates guardadas, sin llamar a Place Details de nuevo.
  const selectFrequentPickup = (addr) => {
    closePickupSearch();
    if (!addr.coordinates?.latitude) return;
    const coords = { latitude: addr.coordinates.latitude, longitude: addr.coordinates.longitude };
    pickupGeocodeId.current++;
    if (pickupIdleTimer.current) { clearTimeout(pickupIdleTimer.current); pickupIdleTimer.current = null; }
    setPickupPinCoords(coords);
    setPickupPinAddress(addr.address);
    const region = { ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    setPickupRegion(region);
    pickupMapRef.current?.animateToRegion(region, 500);
  };

  const reverseGeocodePickup = async (coords) => {
    try {
      const data = await reverseGeocode(coords.latitude, coords.longitude);
      if (data.results && data.results[0]) {
        return cleanAddress(data.results[0].formatted_address) || data.results[0].formatted_address;
      }
    } catch {}
    return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
  };

  const confirmPickupLocation = async () => {
    if (!pickupPinCoords) return;
    let address = pickupPinAddress;
    if (!address) {
      setPickupResolving(true);
      address = await reverseGeocodePickup(pickupPinCoords);
      setPickupResolving(false);
    }
    const punto = { address, coordinates: pickupPinCoords };
    if (pickerMode === 'dropoff') setDropoffLocation(punto); else setPickupLocation(punto);
    setPickupMapVisible(false);
    setPickupSearchVisible(false);
    setPickupMapSelectionMode(false);
    pickupMapSelectionModeRef.current = false;
    setPickupSearch('');
    setPickupSearchResults([]);
    setPickupPinAddress('');
    if (pickupIdleTimer.current) { clearTimeout(pickupIdleTimer.current); pickupIdleTimer.current = null; }
  };

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

  // El overlay del selector vive dentro de la pantalla, asi que por si solo no taparia el
  // header del navegador. Y sin <Modal> ya nadie escucha el boton fisico de atras.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: !pickupMapVisible,
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
  }, [navigation, pickupMapVisible, paso, textPrimary]);

  // El botón físico de Android, con el mapa cerrado, también retrocede de paso.
  useEffect(() => {
    if (pickupMapVisible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', volverDePaso);
    return () => sub.remove();
  }, [pickupMapVisible, paso]);

  useEffect(() => {
    if (!pickupMapVisible) { setOverlayMontado(false); return undefined; }
    // Un frame real, no un tick: con 0ms el callback corre antes de que el overlay llegue a
    // pintarse y el mapa vuelve a nacer junto con su contenedor.
    const t = setTimeout(() => setOverlayMontado(true), 120);
    return () => clearTimeout(t);
  }, [pickupMapVisible]);

  useEffect(() => {
    if (!pickupMapVisible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pickupSearchVisible) closePickupSearch();
      else setPickupMapVisible(false);
      return true;
    });
    return () => sub.remove();
  }, [pickupMapVisible, pickupSearchVisible]);

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

          {/* Trip Summary */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: divider }]}>
            <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Resumen del viaje</Text>

            {/* Route */}
            <View style={styles.routeRow}>
              <View style={styles.routeCol}>
                <View style={styles.routeDot} />
                <View style={[styles.routeLine, { backgroundColor: divider }]} />
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
              icon: 'location-outline', value: pickupLocation, clear: () => setPickupLocation(null) },
            { mode: 'dropoff', label: 'Punto de bajada', vacio: 'Bajar en el destino del viaje',
              icon: 'flag-outline', value: dropoffLocation, clear: () => setDropoffLocation(null) },
          ].map((row) => (
            <TouchableOpacity
              key={row.mode}
              style={[styles.card, styles.pickupRow, { backgroundColor: cardBg, borderColor: divider }]}
              onPress={() => {
                setPickerMode(row.mode);
                setPickupSearch('');
                setPickupPinAddress(row.value?.address || '');
                setPickupMapSelectionMode(false);
                pickupMapSelectionModeRef.current = false;
                setPickupMapVisible(true);
                const yaElegido = regionDesde(row.value?.coordinates, 0.01);
                if (yaElegido) {
                  setPickupPinCoords({ latitude: yaElegido.latitude, longitude: yaElegido.longitude });
                  setPickupRegion(yaElegido);
                } else {
                  setPickupRegion(null);
                  setPickupPinCoords(null);
                  // Para la bajada, arrancar en el destino del viaje es mucho más útil que en
                  // dónde está parado ahora, que puede ser del otro lado del país.
                  const enDestino = row.mode === 'dropoff' ? regionDesde(trip?.destination?.coordinates, 0.05) : null;
                  if (enDestino) {
                    // Sólo la región, SIN pin: un <Marker> montado en el mismo commit que el
                    // <MapView> deja el mapa sin tiles en iOS (queda celeste). En recogida no
                    // pasaba porque ahí el pin todavía no existe cuando el mapa aparece.
                    // Además, abrir con un pin ya puesto en el destino da a entender que el
                    // punto está elegido, y no lo está.
                    setPickupRegion(enDestino);
                  } else {
                    gotoUserLocation();
                  }
                }
              }}
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
            <View style={styles.asientosHeader}>
              <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Asientos</Text>
              {calculatingPrice && <ActivityIndicator size="small" color={textMuted} />}
            </View>

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
          {/* Price Breakdown */}
          {priceData && (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: divider }]}>
              <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Precio</Text>

              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: textMuted }]}>
                  Precio base ({seats} asiento{seats > 1 ? 's' : ''})
                </Text>
                <Text style={[styles.priceValue, { color: textPrimary }]}>
                  ${formatNumber(priceData.pricing.originalPrice || priceData.pricing.totalPrice)} ARS
                </Text>
              </View>

              {priceData.pricing.discountPercentage > 0 && (
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: successColor }]}>
                    Descuento ({priceData.pricing.discountPercentage}%)
                  </Text>
                  <Text style={[styles.priceValue, { color: successColor }]}>
                    -${formatNumber(priceData.pricing.discountAmount)} ARS
                  </Text>
                </View>
              )}

              <View style={[styles.priceDivider, { backgroundColor: divider }]} />

              <View style={styles.priceRow}>
                <Text style={[styles.priceTotalLabel, { color: textPrimary }]}>Total</Text>
                <Text style={[styles.priceTotalValue, { color: textPrimary }]}>
                  ${formatNumber(displayPrice)} ARS
                </Text>
              </View>

              {priceData.pricing.discountPercentage > 0 && (
                <View style={[styles.discountBadge, { backgroundColor: dark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)' }]}>
                  <Ionicons name="pricetag-outline" size={14} color={successColor} />
                  <Text style={[styles.discountBadgeText, { color: successColor }]}>
                    Ahorrás ${formatNumber(priceData.pricing.discountAmount)} ARS con tu descuento
                  </Text>
                </View>
              )}
            </View>
          )}


          {/* Trip details */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: divider }]}>
            <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Detalles</Text>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: textMuted }]}>Asientos disponibles</Text>
              <Text style={[styles.detailValue, { color: textPrimary }]}>
                {tripShownSeats} de {tripCap || trip.totalSeats || 0}
              </Text>
            </View>

            {priceData?.distanceKm && (
              <View style={[styles.detailRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: divider }]}>
                <Text style={[styles.detailLabel, { color: textMuted }]}>Distancia estimada</Text>
                <Text style={[styles.detailValue, { color: textPrimary }]}>{priceData.distanceKm} km</Text>
              </View>
            )}
          </View>

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
            <>
              <Text style={[styles.confirmBtnText, { color: accentInverse }]}>
                {tripFreeNow <= 0
                  ? 'No hay cupos disponibles'
                  : esUltimoPaso ? 'Solicitar Reserva' : 'Continuar'}
              </Text>
              {priceData && tripFreeNow > 0 && (
                <Text style={[styles.confirmBtnPrice, { color: accentInverse }]}>
                  ${formatNumber(displayPrice)} ARS
                </Text>
              )}
            </>
          )}
        </TouchableOpacity>

        </View>
      </Animated.View>

      {/* Selector del punto de recogida.
          NO envolver esto en <Modal>: en Android un Modal es una ventana aparte y la
          superficie de react-native-maps no se compone ahi, asi que el mapa sale todo
          celeste (el color de fondo, sin tiles). Los otros tres mapas de la app son
          pantallas completas y por eso andan. Como overlay dentro de la pantalla el mapa
          dibuja normal; el header del navegador se oculta mientras esta abierto para que
          el overlay tape todo, y el boton fisico de atras de Android lo cierra. */}
      {pickupMapVisible && (
        <View style={pickupStyles.fullscreen}>
              {/* Map — sólo monta con región válida y con el overlay ya en pantalla */}
              {pickupRegion && overlayMontado ? (
                <MapView
                  key={`picker-map-${mapKey}`}
                  ref={pickupMapRef}
                  provider={PROVIDER_GOOGLE}
                  style={StyleSheet.absoluteFill}
                  initialRegion={pickupRegion}
                  onRegionChangeComplete={(r, details = {}) => {
                    if (!pickupMapSelectionModeRef.current) return;
                    if (details.isGesture === false) return;
                    const coords = { latitude: r.latitude, longitude: r.longitude };
                    setPickupPinCoords(coords);
                    // Guardar la región completa: si el mapa se remonta, arranca donde el
                    // usuario lo dejó y no de vuelta en el destino del viaje.
                    setPickupRegion(r);
                    if (pickupIdleTimer.current) clearTimeout(pickupIdleTimer.current);
                    setPickupPinAddress('');
                    const reqId = ++pickupGeocodeId.current;
                    pickupIdleTimer.current = setTimeout(async () => {
                      const addr = await reverseGeocodePickup(coords);
                      if (pickupGeocodeId.current === reqId) setPickupPinAddress(addr || '');
                    }, 800);
                  }}
                  showsUserLocation={false}
                  showsMyLocationButton={false}
                >
                  {/* Marker fijo en la ubicación confirmada (fuera de modo selección) */}
                  {pickupPinCoords && !pickupMapSelectionMode && (
                    <Marker coordinate={pickupPinCoords} anchor={{ x: 0.5, y: 1 }}>
                      <View style={pickupStyles.markerDot} />
                    </Marker>
                  )}
                </MapView>
              ) : (
                <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: cardBg }]}>
                  <ActivityIndicator size="large" color={textPrimary} />
                </View>
              )}


              {/* Center pin — solo en modo selección manual */}
              {!pickupSearchVisible && pickupMapSelectionMode && (
                <View style={pickupStyles.centerPin} pointerEvents="none">
                  <Ionicons name="location" size={20} color="#1F2937" />
                </View>
              )}

              {/* Banner de modo selección */}
              {!pickupSearchVisible && pickupMapSelectionMode && (
                <View style={[pickupStyles.selectionBanner, { top: insets.top + 60 }]}>
                  <Text style={pickupStyles.selectionText}>Mové el mapa para seleccionar</Text>
                  <TouchableOpacity onPress={() => {
                    setPickupMapSelectionMode(false);
                    pickupMapSelectionModeRef.current = false;
                  }} style={{ marginLeft: 12 }}>
                    <Text style={pickupStyles.selectionCancel}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Floating back button */}
              {!pickupSearchVisible && (
                <View style={[pickupStyles.topBar, { paddingTop: insets.top }]}>
                  <TouchableOpacity
                    style={[pickupStyles.circleBtn, { backgroundColor: cardBg }]}
                    onPress={() => { setPickupMapVisible(false); if (pickupIdleTimer.current) clearTimeout(pickupIdleTimer.current); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="arrow-back" size={22} color={textPrimary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Bottom mini sheet */}
              {!pickupSearchVisible && (
                <View style={[pickupStyles.miniSheet, { backgroundColor: cardBg, paddingBottom: Math.max(insets.bottom, 16) }]}>
                  <View style={pickupStyles.handleContainer}>
                    <View style={[pickupStyles.handle, { backgroundColor: ui.border }]} />
                  </View>

                  <TouchableOpacity
                    style={[pickupStyles.addressRow, { borderBottomColor: ui.bg }]}
                    onPress={openPickupSearch}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="location-outline" size={18} color={textMuted} />
                    <Text style={[pickupStyles.addressText, { color: pickupPinAddress ? textPrimary : textMuted }]} numberOfLines={2}>
                      {pickupPinAddress || 'Mové el mapa o buscá una dirección'}
                    </Text>
                    <Ionicons name="search" size={16} color={textMuted} />
                  </TouchableOpacity>

                  <View style={pickupStyles.sheetActions}>
                    <TouchableOpacity
                      style={[pickupStyles.confirmBtn, { backgroundColor: ui.invertBg }, (pickupResolving || !pickupPinCoords) && { opacity: 0.6 }]}
                      onPress={confirmPickupLocation}
                      disabled={pickupResolving || !pickupPinCoords}
                      activeOpacity={0.85}
                    >
                      {pickupResolving
                        ? <ActivityIndicator color={ui.invertText} />
                        : <Text style={[pickupStyles.confirmBtnText, { color: ui.invertText }]}>
                            {pickerMode === 'dropoff' ? 'Confirmar punto de bajada' : 'Confirmar punto de recogida'}
                          </Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Search overlay (Uber style) */}
              {pickupSearchVisible && (
                <Animated.View style={[pickupStyles.searchOverlay, { backgroundColor: cardBg, opacity: pickupOverlayOpacity, transform: [{ translateY: pickupOverlayY }] }]}>
                  <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                    <View style={[pickupStyles.searchHeader, { paddingTop: insets.top + 8, borderBottomColor: ui.bg }]}>
                      <TouchableOpacity onPress={closePickupSearch} style={pickupStyles.searchBackBtn} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={22} color={textPrimary} />
                      </TouchableOpacity>
                      <TextInput
                        style={[pickupStyles.searchTextInput, { color: textPrimary }]}
                        placeholder="Buscar dirección..."
                        placeholderTextColor={textMuted}
                        value={pickupSearch}
                        onChangeText={(t) => { setPickupSearch(t); searchPickupPlaces(t); }}
                        autoFocus
                        autoCorrect={false}
                      />
                      {pickupSearch.length > 0 && (
                        <TouchableOpacity onPress={() => { setPickupSearch(''); setPickupSearchResults([]); }} style={{ padding: 8 }}>
                          <Ionicons name="close" size={18} color={textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <ScrollView
                      style={[pickupStyles.results, { borderTopColor: ui.bg }]}
                      keyboardShouldPersistTaps="handled"
                      keyboardDismissMode="on-drag"
                      showsVerticalScrollIndicator={false}
                    >
                      <TouchableOpacity
                        style={[pickupStyles.resultRow, { borderBottomColor: ui.bg }]}
                        onPress={() => {
                          closePickupSearch();
                          setPickupMapSelectionMode(true);
                          pickupMapSelectionModeRef.current = true;
                        }}
                        activeOpacity={0.6}
                      >
                        <View style={[pickupStyles.resultIcon, { backgroundColor: ui.bg }]}>
                          <Ionicons name="map-outline" size={16} color={textPrimary} />
                        </View>
                        <Text style={[pickupStyles.resultMain, { color: textPrimary }]}>Marcar en el mapa</Text>
                      </TouchableOpacity>

                      {pickupSearch.length === 0 && pickupSearchResults.length === 0 && frequentAddresses.length > 0 && (
                        <>
                          <Text style={[pickupStyles.resultSub, { color: textMuted, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, textTransform: 'uppercase', fontWeight: '600', fontSize: 11 }]}>
                            Direcciones frecuentes
                          </Text>
                          {frequentAddresses.map((addr, i) => (
                            <TouchableOpacity
                              key={`freq-${i}`}
                              style={[pickupStyles.resultRow, { borderBottomColor: ui.bg }]}
                              onPress={() => selectFrequentPickup(addr)}
                              activeOpacity={0.6}
                            >
                              <View style={[pickupStyles.resultIcon, { backgroundColor: ui.bg }]}>
                                <Ionicons name="time-outline" size={16} color={textPrimary} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[pickupStyles.resultMain, { color: textPrimary }]} numberOfLines={1}>{addr.address}</Text>
                                {!!addr.city && <Text style={[pickupStyles.resultSub, { color: textMuted }]} numberOfLines={1}>{addr.city}</Text>}
                              </View>
                            </TouchableOpacity>
                          ))}
                        </>
                      )}

                      {pickupSearchResults.map((item) => (
                        <TouchableOpacity
                          key={item.place_id}
                          style={[pickupStyles.resultRow, { borderBottomColor: ui.bg }]}
                          onPress={() => selectPickupFromSearch(item)}
                          activeOpacity={0.6}
                        >
                          <View style={[pickupStyles.resultIcon, { backgroundColor: ui.bg }]}>
                            <Ionicons name="location-sharp" size={16} color={textPrimary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[pickupStyles.resultMain, { color: textPrimary }]} numberOfLines={1}>
                              {item.structured_formatting?.main_text || item.description}
                            </Text>
                            <Text style={[pickupStyles.resultSub, { color: textMuted }]} numberOfLines={1}>
                              {item.structured_formatting?.secondary_text || ''}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </KeyboardAvoidingView>
                </Animated.View>
              )}
        </View>
      )}


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
  bannerThumb: {
    width: BANNER_WIDTH * 0.85,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerThumbImage: {
    width: '100%',
    height: '100%',
  },
  bannerThumbFallback: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
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
  routeProvince: {
    fontSize: 12,
    marginTop: 2,
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
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontFamily: 'Sora_700Bold',
  },
  driverInfo: {
    flex: 1,
    gap: 4,
  },
  driverName: {
    fontSize: 15,
    fontFamily: 'Sora_600SemiBold',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
  },

  // Vehicle
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  vehicleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleInfo: {
    flex: 1,
    gap: 4,
  },
  vehicleName: {
    fontSize: 15,
    fontFamily: 'Sora_600SemiBold',
  },
  vehicleYear: {
    fontSize: 13,
  },
  plateWrap: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  plateText: {
    fontSize: 12,
    fontFamily: 'Sora_600SemiBold',
    letterSpacing: 1,
  },

  // Details
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Sora_500Medium',
  },

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
  bannerWrap: {
    height: BANNER_HEIGHT,
    overflow: 'hidden',
    marginBottom: 12,
  },
  bannerStrip: {
    flexDirection: 'row',
    height: BANNER_HEIGHT,
  },
  bannerSlide: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 16,
    fontFamily: 'Sora_600SemiBold',
    marginBottom: 6,
  },
  bannerDesc: {
    fontSize: 13,
    lineHeight: 18,
  },

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
  asientosHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pasoBarra: { flexDirection: 'row', gap: 6, marginTop: 4, marginBottom: 8 },
  pasoTramo: { flex: 1, height: 3, borderRadius: 999 },
  pasoTexto: { fontSize: 12, fontFamily: 'Sora_500Medium', marginBottom: 14 },
  confirmBtn: {
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    fontFamily: 'Sora_600SemiBold',
  },
  confirmBtnPrice: {
    fontSize: 16,
    fontFamily: 'Sora_700Bold',
  },
});

const pickupStyles = StyleSheet.create({
  // Reemplaza al <Modal>: mismo efecto de pantalla completa sin crear una ventana aparte.
  fullscreen: { ...StyleSheet.absoluteFillObject, zIndex: 30 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  circleBtn: {
    marginLeft: 16, marginTop: 8,
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -31,
    marginLeft: -22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10,
  },
  handleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  addressRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 56,
  },
  addressText: { flex: 1, fontSize: 15, fontFamily: 'Sora_500Medium' },
  sheetActions: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  confirmBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { fontSize: 16, fontFamily: 'Sora_700Bold' },
  searchOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
  },
  searchHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 8,
  },
  searchBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  searchTextInput: { flex: 1, height: 44, fontSize: 15, fontFamily: 'Sora_500Medium' },
  results: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth },
  resultRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    gap: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  resultMain: { fontSize: 14, fontFamily: 'Sora_500Medium' },
  resultSub: { fontSize: 12, marginTop: 2 },
  markerDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#000000', borderWidth: 2, borderColor: '#FFFFFF',
  },
  selectionBanner: {
    position: 'absolute', left: 16, right: 16,
    backgroundColor: '#1F2937', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    zIndex: 50,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8,
  },
  selectionText: { flex: 1, color: '#FFFFFF', fontSize: 13, fontFamily: 'Sora_500Medium' },
  selectionCancel: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Sora_600SemiBold' },
});

export default BookingScreen;
