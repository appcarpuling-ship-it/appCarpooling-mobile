import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMyReservations, cancelSeatReservation, confirmFromCallback } from '../../../services/seatReservationService';
import useColors from '../../../hooks/useColors';
import { useTheme } from '../../../context/ThemeContext';
import { useUI } from '../../../theme/ui';
import { useAlert } from '../../../context/AlertContext';
import CheckoutWebView from '../../../components/payment/CheckoutWebView';
import RebillPaymentOptions from '../../../components/payment/RebillPaymentOptions';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';

const MySeatReservationsScreen = ({ navigation }) => {
  const { showAlert } = useAlert();
  const { colors } = useColors();
  const ui = useUI();
  const { isDarkMode } = useTheme();

  // Flecha de volver garantizada aunque la pantalla quede como raíz (deep-link).
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Carpoolings'))}
          style={{ marginLeft: 8, paddingVertical: 10, paddingRight: 10, paddingLeft: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="chevron-back" size={26} color={ui.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, ui.text]);

  const dark = isDarkMode;
  const bg = colors.background;
  const cardBg = colors.cardBackground;
  const divider = ui.bg;
  const textPrimary = colors.textPrimary;
  const textMuted = colors.textMuted;
  const chipBg = dark ? '#1C1C1C' : '#F3F4F6';

  const [reservations, setReservations] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [checkoutModal, setCheckoutModal] = useState({ visible: false, paymentUrl: null });
  const [cancellingId, setCancellingId] = useState(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    loadReservations(1, true);
  }, []);

  const loadReservations = async (pageNum = 1, reset = false, opts = {}) => {
    const force = !!opts.force;
    if (!force && fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const response = await getMyReservations({ page: pageNum, limit: LIST_PAGE_SIZE });
      if (response.success) {
        const newItems = response.data.reservations || [];
        setReservations(prev => reset ? newItems : [...prev, ...newItems]);
        setPage(pageNum);
        setHasMore(response.data.pagination?.hasMore ?? false);
      }
    } catch {
      showAlert('Ocurrió algo', 'No se pudieron cargar las reservas');
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReservations(1, true);
  };

  const onEndReached = () => {
    if (!hasMore || loadingMore || fetchingRef.current) return;
    setLoadingMore(true);
    loadReservations(page + 1, false);
  };

  const handleOpenCheckout = (paymentUrl) => {
    if (!paymentUrl) { showAlert('Ocurrió algo', 'No hay link de pago'); return; }
    setCheckoutModal({ visible: true, paymentUrl });
  };

  const handlePaymentSuccess = async (paymentData) => {
    try {
      if (paymentData?.externalReference && paymentData?.status === 'approved') {
        await confirmFromCallback(paymentData.externalReference, 'approved');
      }
    } catch (e) {
      console.warn('Confirmación de pago:', e?.message);
    }
    await loadReservations(1, true);
    navigation.navigate('Result', {
      type: 'success',
      title: 'Pago confirmado',
      message: 'Tu pago fue procesado correctamente. La reserva será confirmada en breve.',
    });
  };

  const handlePaymentError = (error) => {
    navigation.navigate('Result', {
      type: 'error',
      title: 'No se pudo procesar el pago',
      message: error.message || 'No se pudo procesar el pago.',
    });
  };

  const handleCancelReservation = (reservation) => {
    const seatReservationId = reservation.seatReservation?._id || reservation.seatReservation?.id;
    if (!seatReservationId) { showAlert('Ocurrió algo', 'No se puede cancelar'); return; }
    showAlert('Cancelar', '¿Cancelar esta reserva?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí',
        style: 'destructive',
        onPress: async () => {
          setCancellingId(seatReservationId);
          try {
            await cancelSeatReservation(seatReservationId, 'Cancelado por el usuario');
            await loadReservations(1, true, { force: true });
            navigation.navigate('Result', { type: 'success', title: 'Reserva Cancelada', message: 'Tu reserva fue cancelada correctamente.' });
          } catch (error) {
            showAlert('Ocurrió algo', error?.response?.data?.message || error.message || 'No se pudo cancelar.', [], 'error');
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(amount);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  const formatAddress = (location) => {
    if (!location) return '';
    const parts = [location.address || location.street, location.city || location.province]
      .filter(Boolean);
    return parts.join(', ') || location.name || '';
  };

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Venció';
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const getPill = (item) => {
    const ts = item.trip?.status;
    const rs = item.seatReservation?.reservationStatus;
    // Sin color: lo que sigue en juego lleva el pill solido y lo cerrado, apagado.
    const vivo = { solid: true }, cerrado = { solid: false };
    if (ts === 'cancelled') return { ...cerrado, t: 'Viaje cancelado' };
    if (ts === 'completed') return { ...cerrado, t: 'Viaje finalizado' };
    if (ts === 'started')   return { ...vivo, t: 'En curso' };
    switch (rs) {
      case 'pending_approval': return { ...vivo, t: 'Pendiente de aprobación' };
      case 'pending_payment':  return { ...vivo, t: 'Pendiente de pago' };
      case 'payment_failed':   return { ...vivo, t: 'Pago fallido' };
      case 'reserved':         return { ...vivo, t: 'Confirmada' };
      case 'trip_completed':   return { ...cerrado, t: 'Completada' };
      case 'expired':          return { ...cerrado, t: 'Vencida' };
      case 'rejected':         return { ...cerrado, t: 'Rechazada' };
      case 'cancelled':        return { ...cerrado, t: 'Cancelada' };
      default:                 return { ...cerrado, t: '—' };
    }
  };

  const sortedData = [...reservations].sort((a, b) => {
    const phase = (item) => {
      const s = item.trip?.status;
      if (s === 'started') return 0;
      if (s === 'completed') return 2;
      if (s === 'cancelled') return 3;
      return 1;
    };
    const phA = phase(a);
    const phB = phase(b);
    if (phA !== phB) return phA - phB;
    const ORDER = { pending_payment: 0, pending_approval: 1, reserved: 2, rejected: 3, cancelled: 4 };
    const pa = ORDER[a.seatReservation?.reservationStatus] ?? 5;
    const pb = ORDER[b.seatReservation?.reservationStatus] ?? 5;
    if (pa !== pb) return pa - pb;
    const da = new Date(a.trip?.date || a.trip?.departureDate || 0).getTime();
    const db = new Date(b.trip?.date || b.trip?.departureDate || 0).getTime();
    if (phA === 2) return db - da;
    return da - db;
  });

  const renderItem = ({ item }) => {
    const pill = getPill(item);
    const rs = item.seatReservation?.reservationStatus;
    const timeLeft = item.seatReservation?.expiresAt ? getTimeRemaining(item.seatReservation.expiresAt) : null;
    const seats = item.booking?.seatsBooked || 1;

    return (
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: divider }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => item.trip?.id && navigation.navigate('TripDetailFromCarpoolings', { tripId: item.trip.id })}
        >
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={[styles.statusPill, { backgroundColor: pill.solid ? ui.invertBg : ui.surface }]}>
              <View style={[styles.statusDot, { backgroundColor: pill.solid ? ui.invertText : textMuted }]} />
              <Text style={[styles.statusPillText, { color: pill.solid ? ui.invertText : textMuted }]}>{pill.t}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={textMuted} />
          </View>

          {/* Route */}
          <View style={styles.routeRow}>
            <View style={styles.routeLine}>
              <View style={[styles.dotOrigin, { borderColor: textPrimary }]} />
              <View style={[styles.routeConnector, { backgroundColor: divider }]} />
              <View style={[styles.dotDest, { backgroundColor: textPrimary }]} />
            </View>
            <View style={styles.routeLabels}>
              <View style={styles.addrBlock}>
                <Text style={[styles.addrMain, { color: textPrimary }]}>
                  {item.trip?.origin?.address || item.trip?.from || 'Origen'}
                </Text>
                {(item.trip?.origin?.city || item.trip?.origin?.province) && (
                  <Text style={[styles.addrSub, { color: textMuted }]}>
                    {[item.trip.origin.city, item.trip.origin.province].filter(Boolean).join(', ')}
                  </Text>
                )}
              </View>
              <View style={styles.addrBlock}>
                <Text style={[styles.addrMain, { color: textPrimary }]}>
                  {item.trip?.destination?.address || item.trip?.to || 'Destino'}
                </Text>
                {(item.trip?.destination?.city || item.trip?.destination?.province) && (
                  <Text style={[styles.addrSub, { color: textMuted }]}>
                    {[item.trip.destination.city, item.trip.destination.province].filter(Boolean).join(', ')}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Meta */}
          <View style={styles.metaRow}>
            <View style={[styles.metaChip, { backgroundColor: chipBg }]}>
              <Ionicons name="calendar-outline" size={12} color={textMuted} />
              <Text style={[styles.metaText, { color: textMuted }]}>
                {formatDate(item.trip?.date || item.trip?.departureDate)}
              </Text>
            </View>
            {item.trip?.time && (
              <View style={[styles.metaChip, { backgroundColor: chipBg }]}>
                <Ionicons name="time-outline" size={12} color={textMuted} />
                <Text style={[styles.metaText, { color: textMuted }]}>{item.trip.time}</Text>
              </View>
            )}
            <View style={[styles.metaChip, { backgroundColor: chipBg }]}>
              <Ionicons name="person-outline" size={12} color={textMuted} />
              <Text style={[styles.metaText, { color: textMuted }]}>
                {seats} {seats > 1 ? 'asientos' : 'asiento'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Actions */}
        {rs === 'pending_payment' && (
          <View style={[styles.actions, { borderTopColor: divider }]}>
            <View style={[styles.priceBox, { backgroundColor: chipBg }]}>
              <Text style={[styles.price, { color: textPrimary }]}>
                {formatCurrency(item.seatReservation?.reservationAmount || 0)}
              </Text>
              {timeLeft && (
                <View style={[styles.timerBadge, { backgroundColor: ui.surface }]}>
                  <Ionicons name="time-outline" size={12} color={textMuted} />
                  <Text style={[styles.timerText, { color: textMuted }]}>{timeLeft}</Text>
                </View>
              )}
            </View>
            <RebillPaymentOptions
              paymentUrl={item.seatReservation?.reservationPayment?.paymentUrl || item.seatReservation?.paymentUrl}
              qrDataUrl={item.seatReservation?.reservationPayment?.qrDataUrl}
              amount={item.seatReservation?.reservationAmount}
              formatCurrency={formatCurrency}
              onCheckoutPress={handleOpenCheckout}
            />
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: ui.border }]}
              onPress={() => handleCancelReservation(item)}
              activeOpacity={0.7}
              disabled={cancellingId === item.seatReservation?._id}
            >
              {cancellingId === item.seatReservation?._id
                ? <ActivityIndicator size="small" color={textMuted} />
                : <Text style={[styles.cancelText, { color: textMuted }]}>Cancelar reserva</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {rs === 'pending_approval' && (
          <View style={[styles.actions, styles.rowBetween, { borderTopColor: divider }]}>
            <View style={[styles.metaChip, { backgroundColor: chipBg }]}>
              <Ionicons name="hourglass-outline" size={13} color={textMuted} />
              <Text style={[styles.metaText, { color: textMuted }]}>Esperando al conductor</Text>
            </View>
            <TouchableOpacity
              onPress={() => handleCancelReservation(item)}
              hitSlop={{ top: 8, bottom: 8 }}
              disabled={cancellingId === item.seatReservation?._id}
            >
              {cancellingId === item.seatReservation?._id
                ? <ActivityIndicator size="small" color={textMuted} />
                : <Text style={[styles.cancelText, { color: textMuted }]}>Cancelar</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {(rs === 'rejected' || rs === 'cancelled') && (
          <View style={[styles.actions, { borderTopColor: divider }]}>
            <View style={[styles.metaChip, { backgroundColor: ui.surface, alignSelf: 'flex-start' }]}>
              {rs === 'rejected' && <Ionicons name="close-circle-outline" size={13} color={textMuted} />}
              <Text style={[styles.metaText, { color: textMuted }]}>
                {rs === 'rejected' ? 'Rechazada por el conductor' : 'Reserva cancelada'}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: chipBg }]}>
        <ActivityIndicator size="small" color={textMuted} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: chipBg }]}>
      {reservations.length > 0 ? (
        <FlatList
          data={sortedData}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id || item._id)}
          contentContainerStyle={styles.list}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20, alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={textMuted} />
                <Text style={{ fontSize: 13, color: textMuted }}>Cargando más…</Text>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textMuted} colors={[textMuted]} />
          }
        />
      ) : (
        <View style={styles.centered}>
          <Ionicons name="calendar-outline" size={40} color={textMuted} />
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>Sin reservas</Text>
          <Text style={[styles.emptySub, { color: textMuted }]}>Buscá un viaje y reservá tu asiento</Text>
        </View>
      )}

      <CheckoutWebView
        visible={checkoutModal.visible}
        paymentUrl={checkoutModal.paymentUrl}
        onClose={() => setCheckoutModal({ visible: false, paymentUrl: null })}
        onPaymentSuccess={handlePaymentSuccess}
        onPaymentError={handlePaymentError}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container:      { flex: 1 },
  centered:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 28 },
  list:           { padding: 16, paddingBottom: 32, gap: 12 },

  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  cardHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  statusPill:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot:      { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontFamily: 'Sora_700Bold' },

  routeRow:       { flexDirection: 'row', marginBottom: 14 },
  routeLine:      { alignItems: 'center', width: 18, marginRight: 12, paddingTop: 2 },
  dotOrigin:      { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  routeConnector: { width: 2, flex: 1, minHeight: 16, marginVertical: 4 },
  dotDest:        { width: 10, height: 10, borderRadius: 5 },
  routeLabels:    { flex: 1, gap: 14 },
  addrBlock:      {},
  addrMain:       { fontSize: 14, fontFamily: 'Sora_600SemiBold', lineHeight: 20 },
  addrSub:        { fontSize: 12, lineHeight: 17, marginTop: 1 },

  metaRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  metaText:       { fontSize: 12 },

  actions:        { marginTop: 14, paddingTop: 14, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  rowBetween:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  priceBox:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  price:          { fontSize: 20, fontFamily: 'Sora_700Bold' },
  timerBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  timerText:      { fontSize: 12, fontFamily: 'Sora_600SemiBold' },

  cancelBtn:      { alignSelf: 'stretch', paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  cancelText:     { fontSize: 14, fontFamily: 'Sora_600SemiBold' },

  emptyTitle:     { fontSize: 16, fontFamily: 'Sora_600SemiBold' },
  emptySub:       { fontSize: 13, textAlign: 'center' },
});

export default MySeatReservationsScreen;
