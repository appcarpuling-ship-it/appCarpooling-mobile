import React, { useState, useEffect, useRef, useMemo } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { calculateReservationPrice, createSeatReservation } from '../../../services/seatReservationService';
import { get_public } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { sanitizeImageUrl } from '../../../utils/imageUtils';
import { tripRemainingSeats, tripSeatCapacity } from '../../../utils/tripSeatsDisplay';
import useColors from '../../../hooks/useColors';
import { useAuth } from '../../../context/AuthContext';
import ConfirmationModal from '../../../components/modals/ConfirmationModal';
import BannerDetailModal from '../../../components/modals/BannerDetailModal';

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
      const response = await get_public(ENDPOINTS.GET_BANNERS_BY_PACKAGE('free'), { isActive: true });
      if (response.success && Array.isArray(response.data)) {
        setBanners(response.data.filter(b => b.isActive));
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

  const handleCreateReservation = async () => {
    if (tripRemainingSeats(trip) <= 0 || !priceData) return;
    setLoading(true);
    setError('');
    try {
      const tripId = trip._id || trip.id;
      const reservationResponse = await createSeatReservation({ tripId, seatsBooked: seats, message: '' });
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
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      <Animated.View
        style={[styles.animatedContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
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

export default BookingScreen;
