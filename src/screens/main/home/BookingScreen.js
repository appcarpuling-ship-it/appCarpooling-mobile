import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Modal,
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
import { tripRemainingSeats, tripSeatCapacity } from '../../../utils/tripSeatsDisplay';
import useColors from '../../../hooks/useColors';
import { useAuth } from '../../../context/AuthContext';
import ConfirmationModal from '../../../components/modals/ConfirmationModal';
import BannerDetailModal from '../../../components/modals/BannerDetailModal';
import * as Location from 'expo-location';
import { useFrequentAddresses } from '../../../hooks/useFrequentAddresses';
import { searchPlaces, getPlaceDetails, reverseGeocode } from '../../../services/mapsService';

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
  const { colors, getCurrentThemeMode } = useColors();
  const { user } = useAuth();
  const frequentAddresses = useFrequentAddresses();

  const dark = getCurrentThemeMode() === 'dark';
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
  const divider = dark ? '#2A2A2A' : '#F0F0F0';
  const accent = dark ? '#FFFFFF' : '#000000';
  const accentInverse = dark ? '#000000' : '#FFFFFF';
  const sectionLabelColor = dark ? textMuted : '#374151';
  const successColor = colors.success || '#10B981';
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [pickupLocation, setPickupLocation] = useState(null);
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
  const pickupMapReady = useRef(false);
  const [pickupMapSelectionMode, setPickupMapSelectionMode] = useState(false);
  const pickupMapSelectionModeRef = useRef(false);
  const [modalMessage, setModalMessage] = useState('');
  const [priceData, setPriceData] = useState(null);
  const [seats, setSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [calculatingPrice, setCalculatingPrice] = useState(true);
  const [error, setError] = useState('');
  const [banners, setBanners] = useState([]);
  const [bannerModal, setBannerModal] = useState({ visible: false, banner: null });
  
  const routeParams = route.params || {};
  const trip = routeParams.trip;
  const existingReservation = routeParams.existingReservation;

  const tripFreeNow = useMemo(() => tripRemainingSeats(trip), [trip]);
  const tripCap = useMemo(() => tripSeatCapacity(trip), [trip]);

  /** Cupos libres ahora mismo (0 si el viaje está lleno o hay holds pendientes). */
  const maxSelectableSeats = useMemo(() => {
    if (!tripFreeNow || tripFreeNow <= 0) return 0;
    return Math.min(99, tripFreeNow);
  }, [tripFreeNow]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const calculatePrice = async () => {
    if (!trip) return;
    try {
      setCalculatingPrice(true);
      setError('');
      const tripId = trip._id || trip.id;
      const response = await calculateReservationPrice(tripId, seats);
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

  const loadBanners = async () => {
    try {
      const response = await get_public(ENDPOINTS.GET_BANNER_SECTIONS, { appScreen: 'booking' });
      if (response.success && Array.isArray(response.data)) {
        setBanners(response.data.flatMap(s => s.banners || []));
      }
    } catch {
      // silent
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
    loadBanners();
    
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!trip || seats <= 0 || existingReservation) return;
    if (tripRemainingSeats(trip) <= 0) return;
    calculatePrice();
  }, [seats]);

  if (!trip || !trip.origin || !trip.destination) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.error || '#EF4444' }]}>
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
      const origin = trip?.origin?.coordinates;
      const fallback = origin || { latitude: -34.6037, longitude: -58.3816 };
      setPickupPinCoords(fallback);
      setPickupRegion({ ...fallback, latitudeDelta: 0.02, longitudeDelta: 0.02 });
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
    setPickupLocation({ address, coordinates: pickupPinCoords });
    setPickupMapVisible(false);
    setPickupSearchVisible(false);
    setPickupMapSelectionMode(false);
    pickupMapSelectionModeRef.current = false;
    setPickupSearch('');
    setPickupSearchResults([]);
    setPickupPinAddress('');
    if (pickupIdleTimer.current) { clearTimeout(pickupIdleTimer.current); pickupIdleTimer.current = null; }
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
        ...(pickupLocation?.address && { pickupLocation })
      });
      if (!reservationResponse?.success) {
        throw new Error(reservationResponse?.message || 'Error creando la reserva');
      }
      setModalMessage('Tu solicitud de reserva ha sido enviada al conductor. Te notificaremos cuando la apruebe.');
      setShowSuccessModal(true);
    } catch (err) {
      setModalMessage(
        err?.response?.data?.message || err?.message || 'Error al procesar la reserva'
      );
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const displayPrice = priceData?.pricing?.finalPrice || priceData?.pricing?.totalPrice;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Animated.View
        style={[styles.animatedContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }], backgroundColor: bg }]}
      >
        <ScrollView
          style={[styles.scroll, { backgroundColor: bg }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
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
                  {tripFreeNow} disponible{tripFreeNow !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Banners promocionales */}
          {banners.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.sectionLabel, { color: textMuted, marginBottom: 10 }]}>Destacados</Text>
              <FlatList
                data={banners}
                keyExtractor={(item) => item._id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 8 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.bannerThumb, { borderColor: divider }]}
                    activeOpacity={0.92}
                    onPress={() => setBannerModal({ visible: true, banner: item })}
                  >
                    {item.imageUrl ? (
                      <Image source={{ uri: sanitizeImageUrl(item.imageUrl) }} style={styles.bannerThumbImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.bannerThumbFallback, { backgroundColor: cardBg }]}>
                        <Text style={[styles.bannerTitle, { color: textPrimary }]} numberOfLines={2}>
                          {item.title || 'Banner'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* Seat Selector */}
          {calculatingPrice ? (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: divider, alignItems: 'center', paddingVertical: 28 }]}>
              <ActivityIndicator size="small" color={textMuted} />
              <Text style={[styles.loadingText, { color: textMuted }]}>Calculando precio...</Text>
            </View>
          ) : error ? (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: divider }]}>
              <Text style={[styles.errorInline, { color: colors.error || '#EF4444' }]}>{error}</Text>
            </View>
          ) : priceData ? (
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
          ) : null}

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
                {tripFreeNow} de {tripCap || trip.totalSeats || 0}
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
                    color={trip.rules?.smokingAllowed ? successColor : '#EF4444'}
                  />
                  <Text style={[styles.prefText, { color: textMuted }]}>
                    {trip.rules?.smokingAllowed ? 'Permite fumar' : 'No fumar'}
                  </Text>
                </View>
                <View style={styles.prefItem}>
                  <Ionicons
                    name={trip.rules?.petsAllowed ? 'checkmark-circle-outline' : 'close-circle-outline'}
                    size={18}
                    color={trip.rules?.petsAllowed ? successColor : '#EF4444'}
                  />
                  <Text style={[styles.prefText, { color: textMuted }]}>
                    {trip.rules?.petsAllowed ? 'Mascotas OK' : 'Sin mascotas'}
                  </Text>
                </View>
                <View style={styles.prefItem}>
                  <Ionicons
                    name={trip.rules?.musicAllowed !== false ? 'musical-notes-outline' : 'musical-notes-outline'}
                    size={18}
                    color={trip.rules?.musicAllowed !== false ? successColor : '#EF4444'}
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

          {/* Pickup Location */}
          <TouchableOpacity
            style={[styles.card, styles.pickupRow, { backgroundColor: cardBg, borderColor: divider }]}
            onPress={() => {
              setPickupSearch('');
              setPickupPinAddress(pickupLocation?.address || '');
              setPickupMapSelectionMode(false);
              pickupMapSelectionModeRef.current = false;
              pickupMapReady.current = false;
              setPickupMapVisible(true);
              if (pickupLocation?.coordinates) {
                setPickupPinCoords(pickupLocation.coordinates);
                setPickupRegion({ ...pickupLocation.coordinates, latitudeDelta: 0.01, longitudeDelta: 0.01 });
              } else {
                setPickupRegion(null);
                setPickupPinCoords(null);
                gotoUserLocation();
              }
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.pickupIconWrap, { backgroundColor: dark ? '#2A2A2A' : '#F3F4F6' }]}>
              <Ionicons name="location-outline" size={18} color={textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pickupLabel, { color: textMuted }]}>Punto de recogida</Text>
              <Text style={[styles.pickupValue, { color: pickupLocation ? textPrimary : textMuted }]} numberOfLines={1}>
                {pickupLocation ? pickupLocation.address : 'Agregar punto de recogida'}
              </Text>
            </View>
            {pickupLocation
              ? <TouchableOpacity onPress={(e) => { e.stopPropagation(); setPickupLocation(null); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={textMuted} />
                </TouchableOpacity>
              : <Ionicons name="chevron-forward" size={16} color={textMuted} />
            }
          </TouchableOpacity>

          {/* Pickup Map Modal */}
          <Modal
            visible={pickupMapVisible}
            animationType="slide"
            onRequestClose={() => { setPickupMapVisible(false); setPickupSearchVisible(false); setPickupMapSelectionMode(false); pickupMapSelectionModeRef.current = false; if (pickupIdleTimer.current) clearTimeout(pickupIdleTimer.current); }}
          >
            <View style={{ flex: 1 }}>
              {/* Map — solo monta cuando tenemos región */}
              {pickupRegion ? (
                <MapView
                  ref={pickupMapRef}
                  provider={PROVIDER_GOOGLE}
                  style={StyleSheet.absoluteFill}
                  initialRegion={pickupRegion}
                  onRegionChangeComplete={(r, details = {}) => {
                    if (!pickupMapSelectionModeRef.current) return;
                    if (details.isGesture === false) return;
                    const coords = { latitude: r.latitude, longitude: r.longitude };
                    setPickupPinCoords(coords);
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
                    <View style={[pickupStyles.handle, { backgroundColor: dark ? '#2E2E2E' : '#E8E8E8' }]} />
                  </View>

                  <TouchableOpacity
                    style={[pickupStyles.addressRow, { borderBottomColor: dark ? '#2A2A2A' : '#F0F0F0' }]}
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
                      style={[pickupStyles.confirmBtn, { backgroundColor: dark ? '#FFFFFF' : '#000000' }, (pickupResolving || !pickupPinCoords) && { opacity: 0.6 }]}
                      onPress={confirmPickupLocation}
                      disabled={pickupResolving || !pickupPinCoords}
                      activeOpacity={0.85}
                    >
                      {pickupResolving
                        ? <ActivityIndicator color={dark ? '#000000' : '#FFFFFF'} />
                        : <Text style={[pickupStyles.confirmBtnText, { color: dark ? '#000000' : '#FFFFFF' }]}>Confirmar punto de recogida</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Search overlay (Uber style) */}
              {pickupSearchVisible && (
                <Animated.View style={[pickupStyles.searchOverlay, { backgroundColor: cardBg, opacity: pickupOverlayOpacity, transform: [{ translateY: pickupOverlayY }] }]}>
                  <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                    <View style={[pickupStyles.searchHeader, { paddingTop: insets.top + 8, borderBottomColor: dark ? '#2A2A2A' : '#F0F0F0' }]}>
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
                      style={[pickupStyles.results, { borderTopColor: dark ? '#2A2A2A' : '#F0F0F0' }]}
                      keyboardShouldPersistTaps="handled"
                      keyboardDismissMode="on-drag"
                      showsVerticalScrollIndicator={false}
                    >
                      <TouchableOpacity
                        style={[pickupStyles.resultRow, { borderBottomColor: dark ? '#2A2A2A' : '#F0F0F0' }]}
                        onPress={() => {
                          closePickupSearch();
                          setPickupMapSelectionMode(true);
                          pickupMapSelectionModeRef.current = true;
                        }}
                        activeOpacity={0.6}
                      >
                        <View style={[pickupStyles.resultIcon, { backgroundColor: dark ? '#2A2A2A' : '#F3F4F6' }]}>
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
                              style={[pickupStyles.resultRow, { borderBottomColor: dark ? '#2A2A2A' : '#F0F0F0' }]}
                              onPress={() => selectFrequentPickup(addr)}
                              activeOpacity={0.6}
                            >
                              <View style={[pickupStyles.resultIcon, { backgroundColor: dark ? '#2A2A2A' : '#F3F4F6' }]}>
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
                          style={[pickupStyles.resultRow, { borderBottomColor: dark ? '#2A2A2A' : '#F0F0F0' }]}
                          onPress={() => selectPickupFromSearch(item)}
                          activeOpacity={0.6}
                        >
                          <View style={[pickupStyles.resultIcon, { backgroundColor: dark ? '#2A2A2A' : '#F3F4F6' }]}>
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
          </Modal>

          {/* Footer */}
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              {
                backgroundColor:
                  tripFreeNow <= 0 ? (colors.error || '#EF4444') : accent,
                opacity:
                  loading ||
                  calculatingPrice ||
                  tripFreeNow <= 0 ||
                  (!priceData && tripFreeNow > 0)
                    ? 0.5
                    : 1,
              },
            ]}
            onPress={handleCreateReservation}
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
                  {tripFreeNow <= 0 ? 'No hay cupos disponibles' : 'Solicitar Reserva'}
                </Text>
                {priceData && tripFreeNow > 0 && (
                  <Text style={[styles.confirmBtnPrice, { color: accentInverse }]}>
                    ${formatNumber(displayPrice)} ARS
                  </Text>
                )}
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </Animated.View>

      <BannerDetailModal
        visible={bannerModal.visible}
        banner={bannerModal.banner}
        onClose={() => setBannerModal({ visible: false, banner: null })}
        navigation={navigation}
        colors={colors}
      />

      <ConfirmationModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        onConfirm={() => { setShowSuccessModal(false); navigation.goBack(); }}
        type="success"
        title="Solicitud Enviada"
        message={modalMessage}
        confirmText="Continuar"
        showCancel={false}
      />

      <ConfirmationModal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        onConfirm={() => setShowErrorModal(false)}
        type="error"
        title="Error"
        message={modalMessage}
        confirmText="OK"
        showCancel={false}
      />
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
    fontWeight: '600',
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
    borderRadius: 12,
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
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '700',
    lineHeight: 40,
  },
  seatCountLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 10,
  },
  errorInline: {
    fontSize: 14,
    fontWeight: '500',
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
    fontWeight: '500',
  },
  priceDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  priceTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  priceTotalValue: {
    fontSize: 18,
    fontWeight: '700',
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
    fontWeight: '500',
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
    fontWeight: '700',
  },
  driverInfo: {
    flex: 1,
    gap: 4,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '500',
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
    fontWeight: '600',
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
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  pickupValue: {
    fontSize: 14,
    fontWeight: '500',
  },

  confirmBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmBtnPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
});

const pickupStyles = StyleSheet.create({
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
  addressText: { flex: 1, fontSize: 15, fontWeight: '500' },
  sheetActions: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  confirmBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { fontSize: 16, fontWeight: '700' },
  searchOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
  },
  searchHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 8,
  },
  searchBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  searchTextInput: { flex: 1, height: 44, fontSize: 15, fontWeight: '500' },
  results: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth },
  resultRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    gap: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  resultMain: { fontSize: 14, fontWeight: '500' },
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
  selectionText: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '500' },
  selectionCancel: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});

export default BookingScreen;
