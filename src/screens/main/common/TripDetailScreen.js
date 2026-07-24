import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
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
  Platform,
  RefreshControl,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 48;
const BANNER_HEIGHT = 150;
const BANNER_ITEM_WIDTH = BANNER_WIDTH + 16;
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { get_public, get_withauth, post_withauth, put_withauth, buildImageUri } from '../../../services/apiService';
import { sanitizeImageUrl } from '../../../utils/imageUtils';
import { tripRemainingSeats, tripSeatCapacity } from '../../../utils/tripSeatsDisplay';
import { isTripToday } from '../../../utils/tripDateUtils';
import socketService from '../../../services/socketService';
import { ENDPOINTS } from '../../../config/api';
import { getPendingPaymentReservations, confirmFromCallback, cancelSeatReservation } from '../../../services/seatReservationService';
import CheckoutWebView from '../../../components/payment/CheckoutWebView';
import RebillPaymentOptions from '../../../components/payment/RebillPaymentOptions';
import { useColors } from '../../../hooks/useColors';
import { useUI } from '../../../theme/ui';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import BannerDetailModal from '../../../components/modals/BannerDetailModal';
import TripCostBreakdown from '../../../components/modals/TripCostBreakdown';

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
                <Image source={{ uri: sanitizeImageUrl(item.imageUrl) }} style={bannerStyles.image} resizeMode="cover" />
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
  title: { fontSize: 17, fontFamily: 'Sora_700Bold', color: '#FFF', marginBottom: 6 },
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
  const { colors, isDarkMode } = useColors();

  const dark = isDarkMode;
  const ui = useUI();
  const bg = ui.bg;
  const textPrimary = ui.text;
  const textSecondary = ui.textMuted;
  const textMuted = ui.textMuted;
  const divider = ui.border;
  const cardBg = ui.surface;
  const accent = ui.invertBg;
  const accentInverse = ui.invertText;

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userBooking, setUserBooking] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentModalData, setPaymentModalData] = useState({ paymentUrl: null, qrDataUrl: null, amount: null });
  const [checkoutWebViewVisible, setCheckoutWebViewVisible] = useState(false);
  const [checkoutWebViewUrl, setCheckoutWebViewUrl] = useState(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [startingTrip, setStartingTrip] = useState(false);
  const [cancellingTrip, setCancellingTrip] = useState(false);
  const [cancellingReservation, setCancellingReservation] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [passengers, setPassengers] = useState([]);
  const [banners, setBanners] = useState([]);
  const [bannerModal, setBannerModal] = useState({ visible: false, banner: null });

  const canReserveWomenOnlyTrip = trip ? (!trip.womenOnly || user?.gender === 'female') : false;

  const tripFreeSeats = useMemo(() => (trip ? tripRemainingSeats(trip) : 0), [trip]);
  const tripSeatCap = useMemo(() => (trip ? tripSeatCapacity(trip) : 0), [trip]);

  const headerBackTint = ui.text;
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Home');
            }
          }}
          style={{
            marginLeft: Platform.OS === 'android' ? 6 : 4,
            paddingVertical: 10,
            paddingRight: 10,
            paddingLeft: 4,
          }}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={headerBackTint} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, headerBackTint]);

  useEffect(() => {
    loadTripDetail();
    loadBanners();
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkUserBooking();
    }, [tripId])
  );

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
    // Saca comas/espacios colgando (ej: "…, entre rios ," -> "…, entre rios")
    raw = raw.replace(/,\s*,/g, ',').replace(/[\s,]+$/, '').trim();
    return raw || location.city || location.name || '';
  };

  const loadBanners = async () => {
    try {
      const response = await get_public(ENDPOINTS.GET_BANNER_SECTIONS, { appScreen: 'trip_detail' });
      if (response.success && Array.isArray(response.data)) {
        setBanners(response.data.flatMap(s => s.banners || []));
      }
    } catch (_) {}
  };

  const loadTripDetail = async () => {
    try {
      const response = await get_withauth(ENDPOINTS.GET_TRIP(tripId));
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
      showAlert('Ocurrió algo', 'No se pudo cargar el viaje');
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
      const response = await get_withauth(ENDPOINTS.MY_BOOKINGS, { page: 1, limit: 100 });
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
    if (!trip || tripFreeSeats <= 0) {
      showAlert('Ocurrió algo', 'No hay asientos disponibles');
      return;
    }
    navigation.navigate('Booking', { trip });
  };

  const handleCompletePendingPayment = async () => {
    try {
      setPaymentLoading(true);
      let updatedBooking = userBooking;
      try {
        const response = await get_withauth(ENDPOINTS.MY_BOOKINGS, { page: 1, limit: 100 });
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

        if (paymentUrl) {
          setCheckoutWebViewUrl(paymentUrl);
          setCheckoutWebViewVisible(true);
        } else {
          showAlert('Ocurrió algo', 'No se puede realizar el pago. Contacta al soporte.');
        }
      }
    } catch (error) {
      showAlert('Ocurrió algo', 'No se pudo procesar el pago');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentData) => {
    showAlert('Pago Confirmado', 'Tu pago fue procesado correctamente. La reserva será confirmada en breve.', [], 'success');
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
    if (confirmOk) showAlert('Reserva Confirmada', 'Tu lugar está asegurado. El conductor fue notificado.', [], 'success');
    setTimeout(async () => {
      await checkUserBooking();
      await loadTripDetail();
    }, 2500);
  };

  const handlePaymentError = (error) => {
    showAlert('Ocurrió algo', error.message || 'No se pudo procesar el pago.', [], 'error');
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
            setCancellingReservation(true);
            await cancelSeatReservation(String(seatReservationId), 'Cancelado por el usuario');
            setUserBooking(null);
            await checkUserBooking();
            showAlert('Reserva Cancelada', 'Tu reserva fue cancelada correctamente.', [], 'success');
            if (typeof refreshUser === 'function') await refreshUser();
          } catch (error) {
            const msg =
              error?.response?.data?.message ||
              error?.message ||
              'No se pudo cancelar';
            showAlert('Ocurrió algo', msg);
          } finally {
            setCancellingReservation(false);
          }
        },
      },
    ]);
  };

  const handleStartChat = async () => {
    const driverId = trip?.driver?._id || trip?.driver?.id;
    if (!driverId) { showAlert('Ocurrió algo', 'No se encontraron datos del conductor'); return; }
    setChatLoading(true);
    try {
      const response = await post_withauth('/chat/conversation', { participantId: driverId, tripId: trip._id });
      if (response?.success) {
        const conversation = response.data?.conversation || response.data;
        const otherUser =
          response.data?.conversation?.participants?.find(p => p._id !== (user?._id || user?.id)) ||
          response.data?.participants?.find(p => p._id !== (user?._id || user?.id)) ||
          { _id: driverId, firstName: trip.driver?.firstName || 'Conductor', lastName: trip.driver?.lastName || '', avatar: trip.driver?.avatar || null };
        navigation.navigate('ChatDetail', { conversation, otherUser });
      } else {
        showAlert('Ocurrió algo', 'No se pudo abrir el chat');
      }
    } catch {
      showAlert('Ocurrió algo', 'No se pudo abrir el chat');
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
        navigation.navigate('ChatDetail', {
          conversation: response.data,
          otherUser: response.data.participants?.find(p => p._id !== (user?._id || user?.id)),
        });
      }
    } catch (_) {
      showAlert('Ocurrió algo', 'No se pudo iniciar el chat');
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
              showAlert('Ocurrió algo', response.message || 'No se pudo iniciar el viaje');
            }
          } catch (error) {
            showAlert('Ocurrió algo', error.message || 'Error al iniciar el viaje');
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
          setCancellingTrip(true);
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
              showAlert('Ocurrió algo', response.message || 'No se pudo cancelar el viaje');
            }
          } catch (error) {
            showAlert('Ocurrió algo', error.message || 'Error al cancelar el viaje');
          } finally {
            setCancellingTrip(false);
          }
        },
      },
    ]);
  };

  const handleCompleteTrip = () => {
    if (imageModalVisible || bannerModal.visible || checkoutWebViewVisible) return;
    navigation.navigate('CompleteTrip', { onSubmit: submitCompleteTrip });
  };

  const submitCompleteTrip = async ({ costBreakdown, driverPay }) => {
    try {
      const response = await put_withauth(ENDPOINTS.COMPLETE_TRIP(tripId), { costBreakdown, driverPay });
      if (response.success) {
        const updatedTrip = response.data?.trip || response.data;
        if (updatedTrip) {
          setTrip(prev => prev ? { ...prev, ...updatedTrip, status: 'completed' } : prev);
        }
        await loadTripDetail();
        await refreshUser();
        return { ok: true, message: `Costo final: $${formatNumber(updatedTrip?.actualCost)}` };
      }
      return { ok: false, message: response.message || 'No se pudo completar el viaje' };
    } catch (error) {
      return { ok: false, message: error.message || 'Error al completar el viaje' };
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

  // En blanco y negro el estado no puede ir por color: los viajes en marcha
  // llevan el badge sólido y los cerrados uno apagado.
  const statusMap = {
    active:    { solid: true,  label: 'Activo' },
    started:   { solid: true,  label: 'En curso' },
    completed: { solid: false, label: 'Finalizado' },
    cancelled: { solid: false, label: 'Cancelado' },
  };
  const statusCfg = statusMap[trip.status];

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        // Sin style el alto queda sin acotar y en web la rueda no encuentra
        // contenedor scrolleable. Es el único ScrollView principal de la app
        // que no lo tenía.
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadTripDetail();
              setRefreshing(false);
            }}
            tintColor={textMuted}
            colors={[textMuted]}
          />
        }
      >
        {statusCfg && (
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.solid ? accent : cardBg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusCfg.solid ? accentInverse : textMuted }]} />
              <Text style={[styles.statusText, { color: statusCfg.solid ? accentInverse : textMuted }]}>{statusCfg.label}</Text>
            </View>
          </View>
        )}

        {trip.status === 'completed' && (
          <View style={[styles.section, { backgroundColor: cardBg }]}>
            <TripCostBreakdown trip={trip} />
          </View>
        )}

        {/* Route */}
        <View style={[styles.section, { backgroundColor: cardBg }]}>
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

        {/* Ver trayecto en mapa */}
        {(trip.origin?.coordinates?.latitude || trip.destination?.coordinates?.latitude) && (
          <TouchableOpacity
            style={[styles.mapBtn, { borderColor: dark ? '#2E2E2E' : '#E5E7EB' }]}
            onPress={() => navigation.navigate('TripMap', { trip })}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={18} color={textPrimary} />
            <Text style={[styles.mapBtnText, { color: textPrimary }]}>Ver trayecto en mapa</Text>
            <Ionicons name="chevron-forward" size={16} color={textMuted} />
          </TouchableOpacity>
        )}

        {/* Date / time / seats */}
        <View style={[styles.metaRow, { borderBottomColor: divider }]}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={16} color={textMuted} />
            <Text style={[styles.metaText, { color: textPrimary }]}>{formatDate(trip.departureDate)}</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: divider }]} />
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color={textMuted} />
            <Text style={[styles.metaText, { color: textPrimary }]}>{trip.departureTime}</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: divider }]} />
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={16} color={textMuted} />
            <Text style={[styles.metaText, { color: textPrimary }]}>
              {tripFreeSeats}/{tripSeatCap} libres
            </Text>
          </View>
        </View>

        {/* Driver */}
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionLabel, { color: textPrimary }]}>Conductor</Text>
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
            <View style={[styles.section, { backgroundColor: cardBg }]}>
              <Text style={[styles.sectionLabel, { color: textPrimary }]}>Vehículo</Text>
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
                  <Ionicons name="car-outline" size={32} color={colors.primary} />
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
          <View style={[styles.section, { backgroundColor: cardBg }]}>
            <Text style={[styles.sectionLabel, { color: textPrimary }]}>Características del auto</Text>
            <View style={styles.featuresRow}>
              {trip.vehicle.features.ac && (
                <View style={[styles.featureChip, { backgroundColor: cardBg }]}>
                  <Ionicons name="snow-outline" size={15} color={textPrimary} />
                  <Text style={[styles.featureChipText, { color: textPrimary }]}>Aire</Text>
                </View>
              )}
              {trip.vehicle.features.music && (
                <View style={[styles.featureChip, { backgroundColor: cardBg }]}>
                  <Ionicons name="musical-notes-outline" size={15} color={textPrimary} />
                  <Text style={[styles.featureChipText, { color: textPrimary }]}>Musica</Text>
                </View>
              )}
              {trip.vehicle.features.pets && (
                <View style={[styles.featureChip, { backgroundColor: cardBg }]}>
                  <Ionicons name="paw-outline" size={15} color={textPrimary} />
                  <Text style={[styles.featureChipText, { color: textPrimary }]}>Mascotas</Text>
                </View>
              )}
              {trip.vehicle.features.luggage && (
                <View style={[styles.featureChip, { backgroundColor: cardBg }]}>
                  <Ionicons name="bag-handle-outline" size={15} color={textPrimary} />
                  <Text style={[styles.featureChipText, { color: textPrimary }]}>Equipaje</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Rules */}
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionLabel, { color: textPrimary }]}>Preferencias</Text>
          <View style={styles.rulesRow}>
            <View style={styles.ruleItem}>
              <Ionicons
                name={trip.rules?.smokingAllowed ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={trip.rules?.smokingAllowed ? textPrimary : textMuted}
              />
              <Text style={[styles.ruleText, { color: textPrimary }]}>
                {trip.rules?.smokingAllowed ? 'Fumar permitido' : 'No se permite fumar'}
              </Text>
            </View>
            <View style={styles.ruleItem}>
              <Ionicons
                name={trip.rules?.petsAllowed ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={trip.rules?.petsAllowed ? textPrimary : textMuted}
              />
              <Text style={[styles.ruleText, { color: textPrimary }]}>
                {trip.rules?.petsAllowed ? 'Mascotas permitidas' : 'No se permiten mascotas'}
              </Text>
            </View>
            <View style={styles.ruleItem}>
              <Ionicons
                name={trip.rules?.largeLuggageAllowed ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={trip.rules?.largeLuggageAllowed ? textPrimary : textMuted}
              />
              <Text style={[styles.ruleText, { color: textPrimary }]}>
                {trip.rules?.largeLuggageAllowed ? 'Equipaje grande permitido' : 'Sin equipaje grande'}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {trip.notes && (
          <View style={[styles.section, { backgroundColor: cardBg }]}>
            <Text style={[styles.sectionLabel, { color: textPrimary }]}>Notas</Text>
            <Text style={[styles.notesText, { color: textPrimary }]}>{trip.notes}</Text>
          </View>
        )}

        {/* Passengers (driver only) */}
        {isOwnTrip && (
          <View style={[styles.section, { backgroundColor: cardBg }]}>
            <Text style={[styles.sectionLabel, { color: textPrimary }]}>
              Pasajeros confirmados ({passengers.length})
            </Text>
            {passengers.length === 0 ? (
              <Text style={{ fontSize: 13, color: textMuted }}>Sin pasajeros confirmados aún</Text>
            ) : passengers.map((booking) => {
              const p = booking.passenger;
              const avatarUrl = p?.avatar ? buildImageUri(p.avatar) : null;
              const paid = booking.seatReservation?.reservationStatus === 'reserved';
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <Text style={[styles.passengerSeats, { color: textMuted }]}>
                        {booking.seatsBooked || booking.seatsRequested || 1} asiento(s)
                      </Text>
                      <View style={{
                        paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
                        backgroundColor: paid ? accent : cardBg,
                      }}>
                        <Text style={{ fontSize: 11, fontFamily: 'Sora_600SemiBold', color: paid ? accentInverse : textMuted }}>
                          {paid ? 'Pagó' : 'Confirmado'}
                        </Text>
                      </View>
                    </View>
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
            <Text style={[styles.sectionLabel, { color: textPrimary, paddingHorizontal: 20, marginBottom: 14 }]}>
              Destacados
            </Text>
            <BannerCarousel banners={banners} onPress={(item) => setBannerModal({ visible: true, banner: item })} />
          </View>
        )}

        {/* Footer — driver */}
        {isOwnTrip && (trip.status === 'active' || trip.status === 'started' || trip.status === 'pending') && (
          <View style={[styles.footer, { borderTopColor: divider }]}>
            {trip.status === 'active' && (
              <>
                {isTripToday(trip.departureDate) && (
                  <TouchableOpacity
                    style={[styles.footerBtn, { backgroundColor: accent }]}
                    onPress={handleStartTrip}
                    disabled={startingTrip}
                  >
                    {startingTrip
                      ? <ActivityIndicator size="small" color={accentInverse} />
                      : <Text style={[styles.footerBtnText, { color: accentInverse }]}>Iniciar viaje</Text>
                    }
                  </TouchableOpacity>
                )}
                <View style={[styles.footerRow, { marginTop: 10 }]}>
                  {/* Editar: oculto temporalmente
                  <TouchableOpacity
                    style={[styles.footerBtnOutline, { borderColor: divider, flex: 1 }]}
                    onPress={() => navigation.navigate('EditTrip', { tripId: trip._id })}
                  >
                    <Text style={[styles.footerBtnOutlineText, { color: textPrimary }]}>Editar</Text>
                  </TouchableOpacity>
                  */}
                  <TouchableOpacity
                    style={[styles.footerBtnOutline, { borderColor: ui.border, flex: 1 }, cancellingTrip && { opacity: 0.6 }]}
                    onPress={handleCancelTrip}
                    disabled={cancellingTrip}
                  >
                    {cancellingTrip
                      ? <ActivityIndicator size="small" color={textMuted} />
                      : <Text style={[styles.footerBtnOutlineText, { color: textPrimary }]}>Cancelar</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}
            {trip.status === 'pending' && (
              /* Editar viaje: oculto temporalmente
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: accent }]}
                onPress={() => navigation.navigate('EditTrip', { tripId: trip._id })}
              >
                <Text style={[styles.footerBtnText, { color: accentInverse }]}>Editar viaje</Text>
              </TouchableOpacity>
              */
              null
            )}
            {trip.status === 'started' && (
              <>
                <TouchableOpacity
                  style={[styles.footerBtn, { backgroundColor: accent }]}
                  onPress={handleCompleteTrip}
                >
                  <Text style={[styles.footerBtnText, { color: accentInverse }]}>Completar viaje</Text>
                </TouchableOpacity>
                <View style={[styles.footerRow, { marginTop: 10 }]}>
                  <TouchableOpacity
                    style={[styles.footerBtnOutline, { borderColor: ui.border, flex: 1 }, cancellingTrip && { opacity: 0.6 }]}
                    onPress={handleCancelTrip}
                    disabled={cancellingTrip}
                  >
                    {cancellingTrip
                      ? <ActivityIndicator size="small" color={textMuted} />
                      : <Text style={[styles.footerBtnOutlineText, { color: textPrimary }]}>Cancelar</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
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
                <View style={[styles.statusFooter, { backgroundColor: cardBg }]}>
                  <Text style={[styles.statusFooterText, { color: textMuted }]}>
                    Esperando aprobacion del conductor
                  </Text>
                </View>
              ) : userBooking.seatReservation?.reservationStatus === 'pending_payment' ? (
                <View style={styles.pendingWrap}>
                  <View style={styles.pendingTopRow}>
                    <View style={styles.pendingIndicator}>
                      <View style={[styles.pendingDot, { backgroundColor: textPrimary }]} />
                      <Text style={[styles.pendingLabel, { color: textPrimary }]}>Pago pendiente</Text>
                    </View>
                    <TouchableOpacity onPress={handleCancelPendingReservation} disabled={cancellingReservation}>
                      {cancellingReservation
                        ? <ActivityIndicator size="small" color={textMuted} />
                        : <Text style={[styles.cancelLink, { color: textMuted }]}>Cancelar</Text>
                      }
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
                <View style={[styles.statusFooter, { backgroundColor: accent }]}>
                  <Ionicons name="checkmark-circle" size={18} color={accentInverse} />
                  <Text style={[styles.statusFooterText, { color: accentInverse }]}>Reserva paga</Text>
                </View>
              )
            ) : (
              trip.womenOnly && !canReserveWomenOnlyTrip ? (
                <View style={[styles.statusFooter, { backgroundColor: cardBg }]}>
                  <Ionicons name="woman-outline" size={18} color={textMuted} />
                  <Text style={[styles.statusFooterText, { color: textMuted }]}>
                    Este viaje es solo mujeres. Solo pueden reservar usuarias con perfil femenino.
                  </Text>
                </View>
              ) : (
              <>
                {tripFreeSeats <= 0 && (
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: 'Sora_600SemiBold',
                      color: textMuted,
                      textAlign: 'center',
                      marginBottom: 10,
                      paddingHorizontal: 8,
                    }}
                  >
                    No hay asientos disponibles · el viaje está completo o hay solicitudes pendientes
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.footerBtn, {
                    backgroundColor: tripFreeSeats <= 0 ? (dark ? '#2A2A2A' : '#E0E0E0') : accent
                  }]}
                  onPress={handleBookTrip}
                  disabled={tripFreeSeats <= 0}
                >
                  <Text style={[styles.footerBtnText, {
                    color: tripFreeSeats <= 0 ? textMuted : accentInverse
                  }]}>
                    {tripFreeSeats <= 0 ? 'Sin cupos' : 'Reservar'}
                  </Text>
                </TouchableOpacity>
              </>
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

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15 },

  // Status
  statusRow: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    gap: 6,
  },
  statusDot: { width: 7, height: 7, borderRadius: 999 },
  statusText: { fontSize: 13, fontFamily: 'Sora_600SemiBold' },

  // Section
  // Cards separadas en vez de filas con línea divisoria: era el look de lista
  // de ajustes y no el del resto de la app.
  section: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  routeDotStopNum: { fontSize: 9, fontFamily: 'Sora_700Bold', color: '#FFF' },
  routeDotDest: { width: 10, height: 10, borderRadius: 5 },
  routeLabelsCol: { flex: 1, gap: 0 },
  routeStop: { paddingBottom: 16 },
  routeStopLabel: {
    fontSize: 11,
    fontFamily: 'Sora_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  routeStopAddress: { fontSize: 15, fontFamily: 'Sora_500Medium' },
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
  costBannerLabel: { fontSize: 14, fontFamily: 'Sora_500Medium' },
  costBannerSub: { fontSize: 12, marginTop: 2 },
  costBannerValue: { fontSize: 22, fontFamily: 'Sora_700Bold' },

  // Driver
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  driverAvatar: { width: 72, height: 72, borderRadius: 36 },
  driverAvatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
  },
  driverInitials: { fontSize: 18, fontFamily: 'Sora_600SemiBold' },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 16, fontFamily: 'Sora_600SemiBold' },
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
  vehicleName: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
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
  passengerInitials: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  passengerInfo: { flex: 1 },
  passengerName: { fontSize: 14, fontFamily: 'Sora_500Medium' },
  passengerSeats: { fontSize: 12, marginTop: 2 },
  chatBtn: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },

  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mapBtnText: { flex: 1, fontSize: 14, fontFamily: 'Sora_500Medium' },

  // Footer
  footer: {
    padding: 20,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    gap: 4,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  footerBtn: {
    height: 52, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: 6,
  },
  footerBtnText: { fontSize: 16, fontFamily: 'Sora_600SemiBold' },
  footerBtnOutline: {
    height: 52, borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: 6,
  },
  footerBtnOutlineText: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelLinkText: { fontSize: 14, fontFamily: 'Sora_500Medium' },
  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    gap: 8,
  },
  statusFooterText: { fontSize: 15, fontFamily: 'Sora_500Medium' },
  pendingWrap: { gap: 12 },
  pendingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingDot: { width: 8, height: 8, borderRadius: 4 },
  pendingLabel: { fontSize: 14, fontFamily: 'Sora_500Medium' },
  cancelLink: { fontSize: 14, fontFamily: 'Sora_500Medium' },
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
  footerChatBtnText: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },

  // Modals
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 17, fontFamily: 'Sora_600SemiBold' },
  imageOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center', alignItems: 'center',
  },
  imageFullscreen: { width: '100%', height: '80%' },

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
    fontFamily: 'Sora_600SemiBold',
    flexShrink: 1,
  },
  headerDest: {
    fontSize: 14,
    fontFamily: 'Sora_600SemiBold',
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
    fontFamily: 'Sora_600SemiBold',
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
  priceCardLabel: { fontSize: 12, fontFamily: 'Sora_500Medium', textTransform: 'uppercase', letterSpacing: 0.4 },
  priceCardValue: { fontSize: 28, fontFamily: 'Sora_700Bold', letterSpacing: -0.5 },
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
