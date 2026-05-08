import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 48;
const BANNER_HEIGHT = 150;
const BANNER_ITEM_WIDTH = BANNER_WIDTH + 16;
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { get_public, get_withauth, post_withauth, put_withauth, buildImageUri } from '../../../services/apiService';
import socketService from '../../../services/socketService';
import { ENDPOINTS } from '../../../config/api';
import { getPendingPaymentReservations, confirmFromCallback, cancelSeatReservation } from '../../../services/seatReservationService';
import CheckoutWebView from '../../../components/payment/CheckoutWebView';
import RebillPaymentOptions from '../../../components/payment/RebillPaymentOptions';
import Toast from '../../../components/Toast';
import { useColors } from '../../../hooks/useColors';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import BannerDetailModal from '../../../components/modals/BannerDetailModal';

const BANNER_SCROLL_SPEED = 30;

const BannerCarousel = ({ banners, onPress }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const totalWidth = banners.length * BANNER_ITEM_WIDTH;

  useEffect(() => {
    if (banners.length <= 1) return;
    const duration = (totalWidth / BANNER_SCROLL_SPEED) * 1000;
    const animation = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -totalWidth,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [banners]);

  const duplicated = banners.length > 1 ? [...banners, ...banners] : banners;

  return (
    <View style={{ overflow: 'hidden' }}>
      <Animated.View style={{ flexDirection: 'row', paddingHorizontal: 24, gap: 16, transform: [{ translateX: scrollX }] }}>
        {duplicated.map((item, index) => (
          <TouchableOpacity
            key={`${item._id}-${index}`}
            activeOpacity={0.92}
            style={bannerStyles.slide}
            onPress={() => onPress && onPress(item)}
          >
            {item.imageUrl ? (
              <View style={StyleSheet.absoluteFillObject}>
                <Image source={{ uri: item.imageUrl }} style={bannerStyles.image} resizeMode="cover" />
              </View>
            ) : (
              <View style={bannerStyles.content}>
                <Text style={bannerStyles.title} numberOfLines={2}>{item.title}</Text>
                {item.description && (
                  <Text style={bannerStyles.desc} numberOfLines={2}>{item.description}</Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
};

const bannerStyles = StyleSheet.create({
  slide: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  image: { width: '100%', height: '100%' },
  content: { flex: 1, padding: 18, justifyContent: 'flex-end' },
  title: { fontSize: 17, fontWeight: '700', color: '#FFF', marginBottom: 6 },
  desc: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
});

/** Rutas únicas: `photo` principal + array `photos` (sin duplicar). */
function collectVehiclePhotoPaths(vehicle) {
  if (!vehicle) return [];
  const raw = [];
  if (vehicle.photo) raw.push(vehicle.photo);
  if (Array.isArray(vehicle.photos)) raw.push(...vehicle.photos);
  const seen = new Set();
  const out = [];
  for (const p of raw) {
    if (p == null || typeof p !== 'string') continue;
    const norm = p.trim();
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

const TripDetailScreen = ({ route, navigation }) => {
  const { tripId } = route.params;
  const { user, refreshUser } = useAuth();
  const { showAlert } = useAlert();
  const { colors, getCurrentThemeMode } = useColors();

  const dark = getCurrentThemeMode() === 'dark';
  const bg = colors.background;
  const textPrimary = colors.textPrimary;
  const textSecondary = colors.textSecondary;
  const textMuted = colors.textMuted;
  const divider = dark ? '#2A2A2A' : '#F0F0F0';
  const cardBg = dark ? '#1A1A1A' : '#F7F7F7';
  const accent = dark ? '#FFFFFF' : '#000000';
  const accentInverse = dark ? '#000000' : '#FFFFFF';

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userBooking, setUserBooking] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentModalData, setPaymentModalData] = useState({ paymentUrl: null, qrDataUrl: null, amount: null });
  const [checkoutWebViewVisible, setCheckoutWebViewVisible] = useState(false);
  const [checkoutWebViewUrl, setCheckoutWebViewUrl] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [actualCost, setActualCost] = useState('');
  const [driverPay, setDriverPay] = useState('');
  const [startingTrip, setStartingTrip] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [passengers, setPassengers] = useState([]);
  const [banners, setBanners] = useState([]);
  const [bannerModal, setBannerModal] = useState({ visible: false, banner: null });

  const canReserveWomenOnlyTrip = trip ? (!trip.womenOnly || user?.gender === 'female') : false;

  useEffect(() => {
    loadTripDetail();
    loadBanners();
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkUserBooking();
    }, [tripId])
  );

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
  };

  const formatNumber = (num) => {
    if (typeof num !== 'number') num = parseFloat(num);
    if (isNaN(num)) return num;
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatAddress = (location) => {
    if (!location) return '';
    let raw = location.address || location.street || '';
    raw = raw.replace(/, [A-Z][0-9]{4}[A-Z0-9]{0,3}\s+/g, ', ');
    return raw || location.city || location.name || '';
  };

  const loadBanners = async () => {
    try {
      const response = await get_public(ENDPOINTS.GET_BANNERS_BY_PACKAGE('enterprise'), { isActive: true });
      if (response.success && Array.isArray(response.data)) {
        setBanners(response.data.filter(b => b.isActive));
      }
    } catch (_) {}
  };

  const loadTripDetail = async () => {
    try {
      const response = await get_public(ENDPOINTS.GET_TRIP(tripId));
      if (response.success) {
        setTrip(response.data);
        const userId = user?._id || user?.id;
        const driverId = response.data.driver?._id || response.data.driver?.id;
        if (userId && driverId && userId === driverId) {
          await loadPassengers();
        } else {
          await checkUserBooking();
        }
      }
    } catch (error) {
      showAlert('Error', 'No se pudo cargar el viaje');
    } finally {
      setLoading(false);
    }
  };

  const loadPassengers = async () => {
    try {
      const response = await get_withauth(`/bookings/trip/${tripId}`);
      if (response.success) {
        const confirmed = (response.data || []).filter(b => {
          const rs = b.seatReservation?.reservationStatus;
          const s = b.status;
          return rs === 'reserved' || ['confirmed', 'accepted', 'completed'].includes(s);
        });
        setPassengers(confirmed);
      }
    } catch (_) {}
  };

  const checkUserBooking = async () => {
    try {
      const response = await get_withauth('/bookings/my-bookings');
      const bookings = response?.data || [];
      if (response?.success && Array.isArray(bookings)) {
        const tid = String(tripId || '');
        const existingBooking = bookings.find(booking => {
          const bt = booking.trip?._id || booking.trip;
          const bookingTripId = bt ? String(bt) : '';
          // No incluir 'cancelled': el usuario puede volver a reservar el mismo viaje
          const statusesThatBlockNewReservation = ['pending', 'confirmed', 'accepted', 'active', 'completed'];
          return bookingTripId === tid && statusesThatBlockNewReservation.includes(booking.status);
        });
        setUserBooking(existingBooking || null);
      }
    } catch (error) {
      setUserBooking(null);
    }
  };

  const handleBookTrip = () => {
    if (!trip || trip.availableSeats === 0) {
      showAlert('Error', 'No hay asientos disponibles');
      return;
    }
    navigation.navigate('Booking', { trip });
  };

  const handleCompletePendingPayment = async () => {
    try {
      setPaymentLoading(true);
      let updatedBooking = userBooking;
      try {
        const response = await get_withauth('/bookings/my-bookings');
        const bookings = response?.data || [];
        if (response?.success && Array.isArray(bookings)) {
          const tid = String(tripId || '');
          updatedBooking = bookings.find(b => String(b.trip?._id || b.trip || '') === tid);
          if (updatedBooking) setUserBooking(updatedBooking);
        }
      } catch (err) {}

      const currentBooking = updatedBooking || userBooking;
      const seatReservation = currentBooking?.seatReservation;
      const reservationStatus = seatReservation?.reservationStatus;

      if (reservationStatus === 'pending_approval') {
        showAlert('Pendiente', 'Tu solicitud esta esperando aprobacion del conductor');
        return;
      }
      if (reservationStatus === 'pending_payment') {
        let paymentUrl = seatReservation?.reservationPayment?.paymentUrl ||
          seatReservation?.reservationPayment?.checkoutLink ||
          seatReservation?.paymentUrl ||
          currentBooking?.paymentUrl;
        let qrDataUrl = seatReservation?.reservationPayment?.qrDataUrl;
        let amount = seatReservation?.reservationAmount;

        if (!paymentUrl && !qrDataUrl) {
          const pendingResponse = await getPendingPaymentReservations();
          const pendingData = pendingResponse?.data?.pendingReservations || pendingResponse?.pendingReservations;
          const pending = pendingData?.find(r => (r.trip?._id || r.trip?.id) === tripId);
          if (pending) {
            paymentUrl = pending.paymentUrl;
            qrDataUrl = pending.qrDataUrl;
            amount = pending.reservationAmount;
          }
        }

        if (paymentUrl || qrDataUrl) {
          setPaymentModalData({ paymentUrl, qrDataUrl, amount });
          setPaymentModalVisible(true);
        } else {
          showAlert('Error', 'No se puede realizar el pago. Contacta al soporte.');
        }
      }
    } catch (error) {
      showAlert('Error', 'No se pudo procesar el pago');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentData) => {
    showToast('Pago completado - Actualizando...', 'success');
    let confirmOk = false;
    try {
      if (paymentData?.externalReference && paymentData?.status === 'approved') {
        const res = await confirmFromCallback(paymentData.externalReference, 'approved');
        confirmOk = res?.success !== false;
      }
    } catch (e) {
      console.error('confirmFromCallback error:', e?.response?.data || e?.message);
      showAlert(
        'Error al confirmar pago',
        (e?.response?.data?.message || e?.message || 'No se pudo confirmar. El pago puede estar procesandose.') + '\n\nReintentar?',
        [
          { text: 'Cerrar', style: 'cancel' },
          { text: 'Reintentar', onPress: async () => { await checkUserBooking(); await loadTripDetail(); } }
        ]
      );
    }
    await checkUserBooking();
    await loadTripDetail();
    if (confirmOk) showToast('Reserva confirmada', 'success');
    setTimeout(async () => {
      await checkUserBooking();
      await loadTripDetail();
    }, 2500);
  };

  const handlePaymentError = (error) => {
    showToast(error.message || 'Error al procesar el pago', 'error');
  };

  const handleCancelPendingReservation = async () => {
    const seatRes = userBooking?.seatReservation;
    const seatReservationId =
      (seatRes && typeof seatRes === 'object' && (seatRes._id || seatRes.id)) ||
      (typeof seatRes === 'string' ? seatRes : null);

    if (!seatReservationId) {
      showAlert('No se pudo cancelar', 'No encontramos el dato de la reserva. Sali y volvé a entrar al viaje e intentá de nuevo.');
      return;
    }

    showAlert('Cancelar reserva', '¿Estás seguro?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            setPaymentLoading(true);
            await cancelSeatReservation(String(seatReservationId), 'Cancelado por el usuario');
            await checkUserBooking();
            await loadTripDetail();
          } catch (error) {
            const msg =
              error?.response?.data?.message ||
              error?.message ||
              'No se pudo cancelar';
            showAlert('Error', msg);
          } finally {
            setPaymentLoading(false);
          }
        },
      },
    ]);
  };

  const handleStartChat = async () => {
    const driverId = trip?.driver?._id || trip?.driver?.id;
    if (!driverId) { showAlert('Error', 'No se encontraron datos del conductor'); return; }
    setChatLoading(true);
    try {
      const response = await post_withauth('/chat/conversation', { participantId: driverId });
      if (response?.success) {
        const conversation = response.data?.conversation || response.data;
        const otherUser =
          response.data?.conversation?.participants?.find(p => p._id !== (user?._id || user?.id)) ||
          response.data?.participants?.find(p => p._id !== (user?._id || user?.id)) ||
          { _id: driverId, firstName: trip.driver?.firstName || 'Conductor', lastName: trip.driver?.lastName || '', avatar: trip.driver?.avatar || null };
        navigation.navigate('ChatsTab', {
          screen: 'ChatDetail',
          params: { conversation, otherUser },
        });
      } else {
        showAlert('Error', 'No se pudo abrir el chat');
      }
    } catch {
      showAlert('Error', 'No se pudo abrir el chat');
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatWithPassenger = async (passengerId) => {
    try {
      const response = await post_withauth('/chat/conversation', {
        participantId: passengerId,
        tripId: trip._id,
      });
      if (response.success) {
        navigation.navigate('ChatsTab', {
          screen: 'ChatDetail',
          params: {
            conversation: response.data,
            otherUser: response.data.participants?.find(p => p._id !== (user?._id || user?.id)),
          },
        });
      }
    } catch (_) {
      showAlert('Error', 'No se pudo iniciar el chat');
    }
  };

  const handleImagePress = (imageUri) => {
    setSelectedImage(imageUri);
    setImageModalVisible(true);
  };

  const handleStartTrip = () => {
    showAlert('Iniciar Viaje', 'Los pasajeros seran notificados.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Si, iniciar',
        onPress: async () => {
          setStartingTrip(true);
          try {
            const response = await put_withauth(ENDPOINTS.START_TRIP(tripId));
            if (response.success) {
              showAlert('Viaje Iniciado', 'El viaje ha comenzado.');
              await loadTripDetail();
            } else {
              showAlert('Error', response.message || 'No se pudo iniciar el viaje');
            }
          } catch (error) {
            showAlert('Error', error.message || 'Error al iniciar el viaje');
          } finally {
            setStartingTrip(false);
          }
        },
      },
    ]);
  };

  const handleCancelTrip = () => {
    showAlert('Cancelar viaje', '¿Cancelar el viaje? Esto cancelará todas las reservas asociadas.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await put_withauth(ENDPOINTS.CANCEL_TRIP(tripId));
            if (response.success) {
              if (socketService.socket && socketService.isConnected) {
                socketService.socket.emit('trip:cancelled', {
                  tripId,
                  cancelledBy: 'driver',
                  timestamp: new Date().toISOString(),
                });
              }
              showAlert('Cancelado', 'El viaje ha sido cancelado.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } else {
              showAlert('Error', response.message || 'No se pudo cancelar el viaje');
            }
          } catch (error) {
            showAlert('Error', error.message || 'Error al cancelar el viaje');
          }
        },
      },
    ]);
  };

  const handleCompleteTrip = () => {
    setActualCost('');
    setDriverPay('');
    setShowCostModal(true);
  };

  const submitCompleteTrip = async () => {
    const cost = parseFloat(actualCost);
    if (!actualCost || isNaN(cost) || cost <= 0) {
      showAlert('Error', 'Ingresa un costo valido mayor a 0');
      return;
    }
    const pay = parseFloat(driverPay) || 0;
    try {
      const response = await put_withauth(ENDPOINTS.COMPLETE_TRIP(tripId), { actualCost: cost, driverPay: pay });
      if (response.success) {
        setShowCostModal(false);
        const total = cost + pay;
        showAlert('Viaje Completado', pay > 0
          ? `Costo: $${formatNumber(cost)} + Tu paga: $${formatNumber(pay)} = $${formatNumber(total)}`
          : `Costo final: $${formatNumber(cost)}`);
        if (response.data) {
          const updatedTrip = response.data.trip || response.data;
          const actualCostVal = updatedTrip?.actualCost ?? response.data.actualCost ?? cost;
          const driverPayVal = updatedTrip?.driverPay ?? response.data.driverPay ?? pay;
          setTrip(prev => prev ? { ...prev, ...updatedTrip, actualCost: actualCostVal, driverPay: driverPayVal, status: 'completed' } : prev);
        }
        await loadTripDetail();
        await refreshUser();
      } else {
        showAlert('Error', response.message || 'No se pudo completar el viaje');
      }
    } catch (error) {
      showAlert('Error', error.message || 'Error al completar el viaje');
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="small" color={textMuted} />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <Text style={[styles.emptyText, { color: textMuted }]}>Viaje no encontrado</Text>
      </View>
    );
  }

  const userId = user?._id || user?.id;
  const driverId = trip.driver?._id || trip.driver?.id;
  const isOwnTrip = userId && driverId && userId === driverId;
  const driver = trip.driver;
  const showDriverChatCta = Boolean(
    !isOwnTrip && user && driverId && String(driverId) !== String(userId)
  );

  const statusMap = {
    started: { color: colors.info, label: 'En curso' },
    completed: { color: colors.success, label: 'Finalizado' },
    cancelled: { color: colors.error, label: 'Cancelado' },
  };
  const statusCfg = statusMap[trip.status];

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {statusCfg && (
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '18' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
              <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
          </View>
        )}

        {/* Route */}
        <View style={[styles.section, { borderBottomColor: divider }]}>
          <View style={styles.routeRow}>
            <View style={styles.routeDotsCol}>
              <View style={[styles.routeDotOrigin, { borderColor: accent }]} />
              <View style={[styles.routeLineV, { backgroundColor: dark ? '#333' : '#D0D0D0' }]} />
              {trip.intermediateStops?.length > 0 && trip.intermediateStops
                .sort((a, b) => a.order - b.order)
                .map((stop, i) => (
                  <React.Fragment key={i}>
                    <View style={[styles.routeDotStop, { backgroundColor: textMuted }]}>
                      <Text style={styles.routeDotStopNum}>{stop.order}</Text>
                    </View>
                    <View style={[styles.routeLineV, { backgroundColor: dark ? '#333' : '#D0D0D0' }]} />
                  </React.Fragment>
                ))}
              <View style={[styles.routeDotDest, { backgroundColor: accent }]} />
            </View>

            <View style={styles.routeLabelsCol}>
              <View style={styles.routeStop}>
                <Text style={[styles.routeStopLabel, { color: textPrimary }]}>Origen</Text>
                <Text style={[styles.routeStopAddress, { color: textPrimary }]}>{formatAddress(trip.origin)}</Text>
                {trip.origin?.city && (
                  <Text style={[styles.routeStopCity, { color: textMuted }]}>{trip.origin.city}, {trip.origin.province}</Text>
                )}
              </View>

              {trip.intermediateStops?.length > 0 && trip.intermediateStops
                .sort((a, b) => a.order - b.order)
                .map((stop, i) => (
                  <View key={i} style={styles.routeStop}>
                    <Text style={[styles.routeStopLabel, { color: textPrimary }]}>Parada {stop.order}</Text>
                    <Text style={[styles.routeStopAddress, { color: textSecondary }]}>{formatAddress(stop)}</Text>
                    <Text style={[styles.routeStopCity, { color: textMuted }]}>{stop.city}, {stop.province}</Text>
                  </View>
                ))}

              <View style={styles.routeStop}>
                <Text style={[styles.routeStopLabel, { color: textPrimary }]}>Destino</Text>
                <Text style={[styles.routeStopAddress, { color: textPrimary }]}>{formatAddress(trip.destination)}</Text>
                {trip.destination?.city && (
                  <Text style={[styles.routeStopCity, { color: textMuted }]}>{trip.destination.city}, {trip.destination.province}</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Date / time / seats */}
        <View style={[styles.metaRow, { borderBottomColor: divider }]}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={16} color={textMuted} />
            <Text style={[styles.metaText, { color: textSecondary }]}>{formatDate(trip.departureDate)}</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: divider }]} />
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color={textMuted} />
            <Text style={[styles.metaText, { color: textSecondary }]}>{trip.departureTime}</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: divider }]} />
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={16} color={textMuted} />
            <Text style={[styles.metaText, { color: textSecondary }]}>{trip.availableSeats} asientos</Text>
          </View>
        </View>

        {/* Estimated cost card */}
        {/* {Number(trip.estimatedCost) > 0 && trip.status === 'active' && (
          <View style={[styles.priceCard, { backgroundColor: cardBg }]}>
            <View style={styles.priceCardLeft}>
              <Text style={[styles.priceCardLabel, { color: textMuted }]}>Costo estimado</Text>
              <Text style={[styles.priceCardValue, { color: textPrimary }]}>
                ${formatNumber(trip.estimatedCost)}
              </Text>
            </View>
            <View style={[styles.priceCardIcon, { backgroundColor: dark ? '#2A2A2A' : '#EFEFEF' }]}>
              <Ionicons name="cash-outline" size={22} color={textSecondary} />
            </View>
          </View>
        )} */}

        {/* Cost banner — solo costo real (actualCost + driverPay); no mezclar con estimatedCost */}
        {(trip.status === 'started' || trip.status === 'completed') &&
          (Number(trip.actualCost) > 0 || Number(trip.driverPay) > 0) && (
          <View style={[styles.costBanner, { backgroundColor: colors.success + '15', borderColor: colors.success + '30' }]}>
            <View style={styles.costBannerLeft}>
              <Text style={[styles.costBannerLabel, { color: colors.success }]}>Costo del viaje</Text>
              {Number(trip.actualCost) > 0 && Number(trip.driverPay) > 0 && (
                <Text style={[styles.costBannerSub, { color: colors.success }]}>
                  Gastos ${formatNumber(trip.actualCost)} + Paga ${formatNumber(trip.driverPay)}
                </Text>
              )}
            </View>
            <Text style={[styles.costBannerValue, { color: colors.success }]}>
              ${formatNumber((Number(trip.actualCost) || 0) + (Number(trip.driverPay) || 0))}
            </Text>
          </View>
        )}

        {/* Driver */}
        <View style={[styles.section, { borderBottomColor: divider }]}>
          <Text style={[styles.sectionLabel, { color: textMuted }]}>Conductor</Text>
          <View style={styles.driverRow}>
            {(() => {
              const driverPhotoUri = driver?.avatar ? buildImageUri(driver.avatar) : null;
              if (driverPhotoUri) {
                return (
                  <TouchableOpacity onPress={() => handleImagePress(driverPhotoUri)} activeOpacity={0.85}>
                    <Image source={{ uri: driverPhotoUri }} style={styles.driverAvatar} />
                  </TouchableOpacity>
                );
              }
              return (
                <View style={[styles.driverAvatarPlaceholder, { backgroundColor: cardBg }]}>
                  <Text style={[styles.driverInitials, { color: textSecondary }]}>
                    {driver?.firstName?.[0]}{driver?.lastName?.[0]}
                  </Text>
                </View>
              );
            })()}
            <View style={styles.driverInfo}>
              <Text style={[styles.driverName, { color: textPrimary }]}>
                {driver?.firstName} {driver?.lastName}
              </Text>
              <Text style={[styles.driverPhotoHint, { color: textMuted }]}>
                {driver?.avatar ? 'Toca para ampliar' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Vehicle — galería con todas las fotos */}
        {trip.vehicle && (() => {
          const vehiclePaths = collectVehiclePhotoPaths(trip.vehicle);
          return (
            <View style={[styles.section, { borderBottomColor: divider }]}>
              <Text style={[styles.sectionLabel, { color: textMuted }]}>Vehículo</Text>
              {vehiclePaths.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.vehiclePhotosScroll}
                >
                  {vehiclePaths.map((path, idx) => {
                    const uri = buildImageUri(path);
                    if (!uri) return null;
                    return (
                      <TouchableOpacity
                        key={`vph-${idx}-${path.slice(-24)}`}
                        onPress={() => handleImagePress(uri)}
                        activeOpacity={0.85}
                        style={styles.vehicleThumbTouchable}
                      >
                        <Image source={{ uri }} style={styles.vehicleThumb} resizeMode="cover" />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={[styles.vehicleImagePlaceholder, { backgroundColor: cardBg, marginBottom: 12 }]}>
                  <Ionicons name="car-outline" size={32} color={textMuted} />
                </View>
              )}
              <View style={styles.vehicleInfoBlock}>
                <Text style={[styles.vehicleName, { color: textPrimary }]}>
                  {trip.vehicle.brand} {trip.vehicle.model}
                  {trip.vehicle.year ? ` (${trip.vehicle.year})` : ''}
                </Text>
                <Text style={[styles.vehicleColor, { color: textMuted }]}>
                  {[trip.vehicle.color, trip.vehicle.licensePlate].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Features */}
        {trip.vehicle?.features && (
          <View style={[styles.section, { borderBottomColor: divider }]}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>Caracteristicas</Text>
            <View style={styles.featuresRow}>
              {trip.vehicle.features.ac && (
                <View style={[styles.featureChip, { backgroundColor: cardBg }]}>
                  <Ionicons name="snow-outline" size={15} color={textSecondary} />
                  <Text style={[styles.featureChipText, { color: textSecondary }]}>Aire</Text>
                </View>
              )}
              {trip.vehicle.features.music && (
                <View style={[styles.featureChip, { backgroundColor: cardBg }]}>
                  <Ionicons name="musical-notes-outline" size={15} color={textSecondary} />
                  <Text style={[styles.featureChipText, { color: textSecondary }]}>Musica</Text>
                </View>
              )}
              {trip.vehicle.features.pets && (
                <View style={[styles.featureChip, { backgroundColor: cardBg }]}>
                  <Ionicons name="paw-outline" size={15} color={textSecondary} />
                  <Text style={[styles.featureChipText, { color: textSecondary }]}>Mascotas</Text>
                </View>
              )}
              {trip.vehicle.features.luggage && (
                <View style={[styles.featureChip, { backgroundColor: cardBg }]}>
                  <Ionicons name="bag-handle-outline" size={15} color={textSecondary} />
                  <Text style={[styles.featureChipText, { color: textSecondary }]}>Equipaje</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Rules */}
        <View style={[styles.section, { borderBottomColor: divider }]}>
          <Text style={[styles.sectionLabel, { color: textMuted }]}>Reglas</Text>
          <View style={styles.rulesRow}>
            <View style={styles.ruleItem}>
              <Ionicons
                name={trip.rules?.smokingAllowed ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={trip.rules?.smokingAllowed ? colors.success : colors.error}
              />
              <Text style={[styles.ruleText, { color: textSecondary }]}>
                {trip.rules?.smokingAllowed ? 'Se puede fumar' : 'No fumar'}
              </Text>
            </View>
            <View style={styles.ruleItem}>
              <Ionicons
                name={trip.rules?.petsAllowed ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={trip.rules?.petsAllowed ? colors.success : colors.error}
              />
              <Text style={[styles.ruleText, { color: textSecondary }]}>
                {trip.rules?.petsAllowed ? 'Mascotas permitidas' : 'Sin mascotas'}
              </Text>
            </View>
            {trip.womenOnly && (
              <View style={styles.ruleItem}>
                <Ionicons name="woman" size={18} color={textSecondary} />
                <Text style={[styles.ruleText, { color: textSecondary }]}>
                  Solo mujeres (pasajeras)
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Notes */}
        {trip.notes && (
          <View style={[styles.section, { borderBottomColor: divider }]}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>Notas</Text>
            <Text style={[styles.notesText, { color: textSecondary }]}>{trip.notes}</Text>
          </View>
        )}

        {/* Passengers (driver only) */}
        {isOwnTrip && passengers.length > 0 && (
          <View style={[styles.section, { borderBottomColor: divider }]}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>
              Pasajeros ({passengers.length})
            </Text>
            {passengers.map((booking) => {
              const p = booking.passenger;
              const avatarUrl = p?.avatar ? buildImageUri(p.avatar) : null;
              return (
                <TouchableOpacity
                  key={booking._id}
                  style={[styles.passengerRow, { borderBottomColor: divider }]}
                  onPress={() => navigation.navigate('UserProfile', { userId: p?._id, tripId: trip._id })}
                  activeOpacity={0.7}
                >
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.passengerAvatar} />
                  ) : (
                    <View style={[styles.passengerAvatarPlaceholder, { backgroundColor: cardBg }]}>
                      <Text style={[styles.passengerInitials, { color: textSecondary }]}>
                        {p?.firstName?.[0]}{p?.lastName?.[0]}
                      </Text>
                    </View>
                  )}
                  <View style={styles.passengerInfo}>
                    <Text style={[styles.passengerName, { color: textPrimary }]}>
                      {p?.firstName} {p?.lastName}
                    </Text>
                    <Text style={[styles.passengerSeats, { color: textMuted }]}>
                      {booking.seatsBooked || booking.seatsRequested || 1} asiento(s)
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.chatBtn, { backgroundColor: cardBg }]}
                    onPress={(e) => { e.stopPropagation(); handleChatWithPassenger(p?._id); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="chatbubble-outline" size={17} color={textPrimary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Banners */}
        {banners.length > 0 && (
          <View style={styles.bannersSection}>
            <Text style={[styles.sectionLabel, { color: textMuted, paddingHorizontal: 20, marginBottom: 14 }]}>
              Destacados
            </Text>
            <BannerCarousel banners={banners} onPress={(item) => setBannerModal({ visible: true, banner: item })} />
          </View>
        )}

        {/* Footer — driver */}
        {isOwnTrip && (trip.status === 'active' || trip.status === 'started') && (
          <View style={[styles.footer, { borderTopColor: divider }]}>
            {trip.status === 'active' && trip.occupiedSeats > 0 && (
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: accent }]}
                onPress={handleStartTrip}
                disabled={startingTrip}
              >
                <Text style={[styles.footerBtnText, { color: accentInverse }]}>
                  {startingTrip ? 'Iniciando...' : 'Iniciar viaje'}
                </Text>
              </TouchableOpacity>
            )}
            {trip.status === 'started' && (
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: accent }]}
                onPress={handleCompleteTrip}
              >
                <Text style={[styles.footerBtnText, { color: accentInverse }]}>Completar viaje</Text>
              </TouchableOpacity>
            )}
            {trip.status === 'active' && (
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: dark ? '#3D1A1A' : '#FEE2E2', marginTop: 8 }]}
                onPress={handleCancelTrip}
              >
                <Text style={[styles.footerBtnText, { color: dark ? '#F87171' : '#DC2626' }]}>Cancelar viaje</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Footer — passenger */}
        {!isOwnTrip && (
          <View style={[styles.footer, { borderTopColor: divider, gap: 0 }]}>
            {userBooking ? (
              (userBooking.seatReservation?.reservationStatus === 'cancelled' || userBooking.status === 'cancelled') ? (
                <View style={[styles.statusFooter, { backgroundColor: cardBg }]}>
                  <Ionicons name="close-circle" size={18} color={textMuted} />
                  <Text style={[styles.statusFooterText, { color: textMuted }]}>Reserva cancelada</Text>
                </View>
              ) : userBooking.seatReservation?.reservationStatus === 'pending_approval' ? (
                <View style={[styles.statusFooter, { backgroundColor: (colors.warning || '#F59E0B') + '15' }]}>
                  <Text style={[styles.statusFooterText, { color: colors.warning || '#F59E0B' }]}>
                    Esperando aprobacion del conductor
                  </Text>
                </View>
              ) : userBooking.seatReservation?.reservationStatus === 'pending_payment' ? (
                <View style={styles.pendingWrap}>
                  <View style={styles.pendingTopRow}>
                    <View style={styles.pendingIndicator}>
                      <View style={[styles.pendingDot, { backgroundColor: colors.warning }]} />
                      <Text style={[styles.pendingLabel, { color: colors.warning }]}>Pago pendiente</Text>
                    </View>
                    <TouchableOpacity onPress={handleCancelPendingReservation}>
                      <Text style={[styles.cancelLink, { color: colors.error }]}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.footerBtn, { backgroundColor: accent }]}
                    onPress={handleCompletePendingPayment}
                    disabled={paymentLoading}
                  >
                    {paymentLoading ? (
                      <ActivityIndicator size="small" color={accentInverse} />
                    ) : (
                      <Text style={[styles.footerBtnText, { color: accentInverse }]}>Completar pago</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.statusFooter, { backgroundColor: colors.success + '15' }]}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={[styles.statusFooterText, { color: colors.success }]}>Reserva paga</Text>
                </View>
              )
            ) : (
              trip.womenOnly && !canReserveWomenOnlyTrip ? (
                <View style={[styles.statusFooter, { backgroundColor: (colors.warning || '#F59E0B') + '12' }]}>
                  <Ionicons name="woman-outline" size={18} color={colors.warning || '#F59E0B'} />
                  <Text style={[styles.statusFooterText, { color: textMuted }]}>
                    Este viaje es solo mujeres. Solo pueden reservar usuarias con perfil femenino.
                  </Text>
                </View>
              ) : (
              <TouchableOpacity
                style={[styles.footerBtn, {
                  backgroundColor: trip.availableSeats === 0 ? (dark ? '#2A2A2A' : '#E0E0E0') : accent
                }]}
                onPress={handleBookTrip}
                disabled={trip.availableSeats === 0}
              >
                <Text style={[styles.footerBtnText, {
                  color: trip.availableSeats === 0 ? textMuted : accentInverse
                }]}>
                  {trip.availableSeats === 0 ? 'Sin asientos disponibles' : 'Reservar'}
                </Text>
              </TouchableOpacity>
              )
            )}

            {showDriverChatCta && (
              <View
                style={[
                  styles.footerChatWrap,
                  { marginTop: 16, paddingTop: 16, borderTopColor: divider },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.footerChatBtn,
                    {
                      backgroundColor: cardBg,
                      borderColor: dark ? '#3F3F46' : '#D4D4D8',
                    },
                  ]}
                  onPress={handleStartChat}
                  disabled={chatLoading}
                  activeOpacity={0.8}
                >
                  {chatLoading ? (
                    <ActivityIndicator size="small" color={accent} />
                  ) : (
                    <>
                      <Text style={[styles.footerChatBtnText, { color: textPrimary }]}>Chatear con el conductor</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <BannerDetailModal
        visible={bannerModal.visible}
        banner={bannerModal.banner}
        onClose={() => setBannerModal({ visible: false, banner: null })}
        navigation={navigation}
        colors={colors}
      />

      {/* Payment Options Modal */}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheetContent, { backgroundColor: bg }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: divider }]}>
              <Text style={[styles.sheetTitle, { color: textPrimary }]}>Completar pago</Text>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={textSecondary} />
              </TouchableOpacity>
            </View>
            <RebillPaymentOptions
              paymentUrl={paymentModalData.paymentUrl}
              qrDataUrl={paymentModalData.qrDataUrl}
              amount={paymentModalData.amount}
              formatCurrency={(n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)}
              onCheckoutPress={(url) => {
                setPaymentModalVisible(false);
                setCheckoutWebViewUrl(url);
                setCheckoutWebViewVisible(true);
              }}
            />
          </View>
        </View>
      </Modal>

      <CheckoutWebView
        visible={checkoutWebViewVisible}
        paymentUrl={checkoutWebViewUrl}
        onClose={() => { setCheckoutWebViewVisible(false); setCheckoutWebViewUrl(null); }}
        onPaymentSuccess={handlePaymentSuccess}
        onPaymentError={handlePaymentError}
      />

      {/* Image Modal */}
      <Modal visible={imageModalVisible} transparent animationType="fade" onRequestClose={() => setImageModalVisible(false)}>
        <TouchableOpacity style={styles.imageOverlay} activeOpacity={1} onPress={() => setImageModalVisible(false)}>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={styles.imageFullscreen} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>

      {/* Cost Modal */}
      <Modal visible={showCostModal} transparent animationType="fade" onRequestClose={() => setShowCostModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: bg }]}>
            <Text style={[styles.modalTitle, { color: textPrimary }]}>Completar viaje</Text>
            <Text style={[styles.modalSub, { color: textMuted }]}>Costo real del viaje</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: divider, color: textPrimary, backgroundColor: cardBg }]}
              placeholder="Ej: 1500"
              placeholderTextColor={textMuted}
              keyboardType="decimal-pad"
              value={actualCost}
              onChangeText={setActualCost}
              autoFocus
            />
            <Text style={[styles.modalSub, { color: textMuted }]}>Tu contribucion extra (opcional)</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: divider, color: textPrimary, backgroundColor: cardBg, marginTop: 6 }]}
              placeholder={actualCost ? `Ej: ${Math.round(parseFloat(actualCost) * 0.15)}` : 'Ej: 500'}
              placeholderTextColor={textMuted}
              keyboardType="decimal-pad"
              value={driverPay}
              onChangeText={setDriverPay}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtnSecondary, { borderColor: divider }]}
                onPress={() => setShowCostModal(false)}
              >
                <Text style={[styles.modalBtnSecondaryText, { color: textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: accent }]}
                onPress={submitCompleteTrip}
              >
                <Text style={[styles.modalBtnPrimaryText, { color: accentInverse }]}>Completar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15 },

  // Status
  statusRow: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600' },

  // Section
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 14,
  },

  // Route
  routeRow: { flexDirection: 'row', gap: 16 },
  routeDotsCol: {
    width: 18,
    alignItems: 'center',
    paddingTop: 4,
  },
  routeDotOrigin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  routeLineV: {
    width: 1.5,
    height: 44,
    marginVertical: 2,
  },
  routeDotStop: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeDotStopNum: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  routeDotDest: { width: 10, height: 10, borderRadius: 5 },
  routeLabelsCol: { flex: 1, gap: 0 },
  routeStop: { paddingBottom: 16 },
  routeStopLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  routeStopAddress: { fontSize: 15, fontWeight: '500' },
  routeStopCity: { fontSize: 13, marginTop: 1 },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 0,
  },
  metaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaDivider: { width: StyleSheet.hairlineWidth, height: 20, marginHorizontal: 4 },
  metaText: { fontSize: 13, flex: 1 },

  // Cost banner
  costBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  costBannerLeft: { flex: 1 },
  costBannerLabel: { fontSize: 14, fontWeight: '500' },
  costBannerSub: { fontSize: 12, marginTop: 2 },
  costBannerValue: { fontSize: 22, fontWeight: '700' },

  // Driver
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  driverAvatar: { width: 72, height: 72, borderRadius: 36 },
  driverAvatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
  },
  driverInitials: { fontSize: 18, fontWeight: '600' },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: '600' },
  driverPhotoHint: { fontSize: 12, marginTop: 4 },

  // Vehicle
  vehiclePhotosScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 10,
  },
  vehicleThumbTouchable: { borderRadius: 10, overflow: 'hidden' },
  vehicleThumb: {
    width: 132,
    height: 88,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
  },
  vehicleInfoBlock: { marginTop: 14 },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  vehicleImage: { width: 88, height: 64, borderRadius: 10 },
  vehicleImagePlaceholder: {
    width: 88, height: 64, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  vehicleInfo: { flex: 1 },
  vehicleName: { fontSize: 15, fontWeight: '600' },
  vehicleColor: { fontSize: 13, marginTop: 2 },

  // Features
  featuresRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, gap: 6,
  },
  featureChipText: { fontSize: 13 },

  // Rules
  rulesRow: { gap: 12 },
  ruleItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleText: { fontSize: 14 },

  // Notes
  notesText: { fontSize: 14, lineHeight: 22 },

  // Passengers
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  passengerAvatar: { width: 40, height: 40, borderRadius: 20 },
  passengerAvatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  passengerInitials: { fontSize: 14, fontWeight: '600' },
  passengerInfo: { flex: 1 },
  passengerName: { fontSize: 14, fontWeight: '500' },
  passengerSeats: { fontSize: 12, marginTop: 2 },
  chatBtn: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },

  // Footer
  footer: {
    padding: 20,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  footerBtn: {
    height: 52, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  footerBtnText: { fontSize: 16, fontWeight: '600' },
  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    gap: 8,
  },
  statusFooterText: { fontSize: 15, fontWeight: '500' },
  pendingWrap: { gap: 12 },
  pendingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingDot: { width: 8, height: 8, borderRadius: 4 },
  pendingLabel: { fontSize: 14, fontWeight: '500' },
  cancelLink: { fontSize: 14, fontWeight: '500' },
  footerChatWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerChatBtn: {
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
  },
  footerChatBtnText: { fontSize: 15, fontWeight: '600' },

  // Modals
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 17, fontWeight: '600' },
  imageOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center', alignItems: 'center',
  },
  imageFullscreen: { width: '100%', height: '80%' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: { borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSub: { fontSize: 13, marginBottom: 12 },
  modalInput: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 17, marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtnSecondary: {
    flex: 1, height: 48, borderRadius: 10,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center',
  },
  modalBtnSecondaryText: { fontSize: 15, fontWeight: '500' },
  modalBtnPrimary: {
    flex: 1, height: 48, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  modalBtnPrimaryText: { fontSize: 15, fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  headerOrigin: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  headerDest: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    flexShrink: 0,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Price card
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 18,
    borderRadius: 14,
  },
  priceCardLeft: { flex: 1, gap: 4 },
  priceCardLabel: { fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4 },
  priceCardValue: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  priceCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Banners section
  bannersSection: {
    marginTop: 28,
    paddingBottom: 4,
  },
});

export default TripDetailScreen;
