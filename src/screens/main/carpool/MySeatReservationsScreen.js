import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
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
import { useUI } from '../../../theme/ui';
import { useAlert } from '../../../context/AlertContext';
import CheckoutWebView from '../../../components/payment/CheckoutWebView';
import RebillPaymentOptions from '../../../components/payment/RebillPaymentOptions';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import EmptyState from '../../../components/ui/EmptyState';
import { reportError } from '../../../utils/sentry';

const MySeatReservationsScreen = ({ navigation }) => {
  const { showAlert } = useAlert();
  const ui = useUI();

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

  // Todo del sistema `ui`, como el resto de la app (MyBookingsScreen es la pantalla gemela y
  // usa lo mismo). Antes mezclaba `useColors` —`colors.background` es negro puro, más oscuro
  // que el `ui.bg` del tema— con chips hardcodeados, y no matcheaba con ninguna otra pantalla.
  const bg = ui.bg;
  const cardBg = ui.surface;
  const divider = ui.border;
  const textPrimary = ui.text;
  const textMuted = ui.textMuted;
  const chipBg = ui.surface;

  const [activeTab, setActiveTab] = useState('upcoming');
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
    } catch (error) {
      reportError(error, { screen: 'MySeatReservationsScreen', action: 'loadReservations' });
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
    const yaPagada = reservation.seatReservation?.reservationStatus === 'reserved';
    const mensaje = yaPagada
      ? 'Ya pagaste esta reserva. Si la cancelás no se te devuelve el dinero. ¿Cancelar de todas formas?'
      : '¿Cancelar esta reserva?';
    navigation.navigate('Confirm', {
      title: 'Cancelar',
      message: mensaje,
      confirmLabel: 'Sí',
      destructive: true,
      onConfirm: async () => {
        setCancellingId(seatReservationId);
        try {
          await cancelSeatReservation(seatReservationId, 'Cancelado por el usuario');
          await loadReservations(1, true, { force: true });
        } finally {
          setCancellingId(null);
        }
      },
      successParams: { title: 'Reserva Cancelada', message: 'Tu reserva fue cancelada correctamente.' },
      errorParams: { title: 'Ocurrió algo' },
    });
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

  /**
   * Una reserva sigue "viva" si todavía puede pasar algo con ella. Se mira el estado de la
   * reserva y no solo el del viaje: una reserva cancelada sobre un viaje en curso ya no
   * tiene nada pendiente, y mezclarla con las próximas era justo lo que confundía (la
   * tarjeta decía "En curso" arriba y "Reserva cancelada" abajo).
   */
  const isLive = (item) => {
    const ts = item.trip?.status;
    if (ts === 'completed' || ts === 'cancelled') return false;
    return ['pending_payment', 'payment_failed', 'pending_approval', 'reserved']
      .includes(item.seatReservation?.reservationStatus);
  };

  // Lo que exige plata primero: es lo único de esta pantalla con un vencimiento corriendo.
  const UPCOMING_ORDER = { pending_payment: 0, payment_failed: 1, pending_approval: 2, reserved: 3 };

  const visibleData = useMemo(() => {
    const when = (r) => new Date(r.trip?.date || r.trip?.departureDate || 0).getTime();
    const list = reservations.filter((r) => (activeTab === 'upcoming' ? isLive(r) : !isLive(r)));
    if (activeTab === 'past') return list.sort((a, b) => when(b) - when(a));
    return list.sort((a, b) => {
      const pa = UPCOMING_ORDER[a.seatReservation?.reservationStatus] ?? 9;
      const pb = UPCOMING_ORDER[b.seatReservation?.reservationStatus] ?? 9;
      if (pa !== pb) return pa - pb;
      return when(a) - when(b);
    });
  }, [reservations, activeTab]);

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
              <View style={[styles.routeConnector, { backgroundColor: textPrimary }]} />
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
              style={[styles.cancelBtn, { backgroundColor: '#EF4444', borderColor: '#EF4444' }]}
              onPress={() => handleCancelReservation(item)}
              activeOpacity={0.7}
              disabled={cancellingId === item.seatReservation?._id}
            >
              {cancellingId === item.seatReservation?._id
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={[styles.cancelText, { color: '#FFFFFF' }]}>Cancelar reserva</Text>
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
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="small" color={textMuted} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textPrimary }]}>Tus reservas</Text>
        <Text style={[styles.title, styles.titleStrong, { color: textPrimary }]}>de asiento</Text>
      </View>

      {/* Mismo pill que Mis Viajes, para que las dos listas se lean igual. */}
      <View style={styles.tabsContainer}>
        <View style={[styles.tabPill, { backgroundColor: ui.surface }]}>
          {['upcoming', 'past'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && { backgroundColor: ui.invertBg }]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, { color: activeTab === tab ? ui.invertText : ui.textMuted }]}>
                {tab === 'upcoming' ? 'Próximas' : 'Pasadas'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {visibleData.length > 0 ? (
        <FlatList
          data={visibleData}
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
          <EmptyState
            image={require('../../../../assets/icons/pngwing.com (20).png')}
            title={activeTab === 'upcoming' ? 'Sin reservas próximas' : 'Sin reservas pasadas'}
            subtitle={activeTab === 'upcoming'
              ? 'Buscá un viaje y reservá tu asiento'
              : 'Acá van a quedar las reservas que ya terminaron'}
          />
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

  // Encabezado y tabs calcados de Mis Viajes: son la misma clase de pantalla y el usuario
  // salta de una a la otra, así que compartir el patrón vale más que ser original acá.
  header:         { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  title:          { fontFamily: 'Sora_300Light', fontSize: 32, lineHeight: 40, letterSpacing: -1 },
  titleStrong:    { fontFamily: 'Sora_800ExtraBold' },
  tabsContainer:  { paddingHorizontal: 24, paddingBottom: 8 },
  tabPill:        { flexDirection: 'row', borderRadius: 999, padding: 5 },
  tab:            { flex: 1, paddingVertical: 11, borderRadius: 999, alignItems: 'center' },
  tabText:        { fontSize: 14, fontFamily: 'Sora_600SemiBold' },

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

  cancelBtn:      { alignSelf: 'stretch', paddingVertical: 13, alignItems: 'center', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  cancelText:     { fontSize: 15, fontFamily: 'Sora_700Bold' },

  emptyTitle:     { fontSize: 16, fontFamily: 'Sora_600SemiBold' },
  emptySub:       { fontSize: 13, textAlign: 'center' },
});

export default MySeatReservationsScreen;
