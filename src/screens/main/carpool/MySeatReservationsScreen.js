import React, { useState, useEffect, useRef } from 'react';
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
import { post_withauth } from '../../../services/apiService';
import useColors from '../../../hooks/useColors';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import CheckoutWebView from '../../../components/payment/CheckoutWebView';
import RebillPaymentOptions from '../../../components/payment/RebillPaymentOptions';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';

const MySeatReservationsScreen = ({ navigation }) => {
  const { showAlert } = useAlert();
  const { colors } = useColors();
  const { getCurrentThemeMode } = useTheme();

  const dark = getCurrentThemeMode() === 'dark';
  const bg = colors.background;
  const cardBg = colors.cardBackground;
  const divider = dark ? '#2A2A2A' : '#ECECEC';
  const textPrimary = colors.textPrimary;
  const textMuted = colors.textMuted;

  const [reservations, setReservations] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [chatLoading, setChatLoading] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [checkoutModal, setCheckoutModal] = useState({ visible: false, paymentUrl: null });
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
    showAlert('Pago Confirmado', 'Tu pago fue procesado correctamente. La reserva será confirmada en breve.', [], 'success');
    try {
      if (paymentData?.externalReference && paymentData?.status === 'approved') {
        await confirmFromCallback(paymentData.externalReference, 'approved');
      }
    } catch (e) {
      console.warn('Confirmación de pago:', e?.message);
    }
    await loadReservations(1, true);
  };

  const handlePaymentError = (error) => {
    showAlert('Ocurrió algo', error.message || 'No se pudo procesar el pago.', [], 'error');
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
          try {
            await cancelSeatReservation(seatReservationId, 'Cancelado por el usuario');
            showAlert('Reserva Cancelada', 'Tu reserva fue cancelada correctamente.', [], 'success');
            await loadReservations(1, true, { force: true });
          } catch (error) {
            showAlert('Ocurrió algo', error?.response?.data?.message || error.message || 'No se pudo cancelar.', [], 'error');
          }
        },
      },
    ]);
  };


  const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(amount);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

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
    // Estados del viaje primero (misma paleta que Mis viajes / MyTripsScreen)
    if (ts === 'cancelled') {
      return { c: dark ? '#F87171' : '#EF4444', t: 'Viaje cancelado' };
    }
    if (ts === 'completed') {
      return { c: dark ? '#60A5FA' : '#3B82F6', t: 'Viaje finalizado' };
    }
    if (ts === 'started') {
      return { c: dark ? '#FBBF24' : '#F59E0B', t: 'En curso' };
    }
    switch (rs) {
      case 'pending_approval':
        return { c: dark ? '#FBBF24' : '#F59E0B', t: 'Pendiente de aprobación' };
      case 'pending_payment':
        return { c: dark ? '#FB923C' : '#EA580C', t: 'Pendiente de pago' };
      case 'payment_failed':
        return { c: dark ? '#F87171' : '#DC2626', t: 'Pago fallido' };
      case 'reserved':
        return { c: dark ? '#34D399' : '#10B981', t: 'Confirmada' };
      case 'trip_completed':
        return { c: dark ? '#60A5FA' : '#3B82F6', t: 'Completada' };
      case 'expired':
        return { c: textMuted, t: 'Vencida' };
      case 'rejected':
        return { c: dark ? '#F87171' : '#EF4444', t: 'Rechazada' };
      case 'cancelled':
        return { c: dark ? '#F87171' : '#EF4444', t: 'Cancelada' };
      default:
        return { c: textMuted, t: '—' };
    }
  };

  const handleOpenChat = async (item) => {
    const driverId = item.trip?.driver?._id || item.trip?.driver?.id;
    if (!driverId) { showAlert('Ocurrió algo', 'Sin datos del conductor'); return; }
    const reservationId = item.seatReservation?._id;
    setChatLoading(prev => ({ ...prev, [reservationId]: true }));
    try {
      const response = await post_withauth('/chat/conversation', { participantId: driverId });
      if (response?.success && response?.data?.conversation) {
        const driver = item.trip.driver;
        navigation.navigate('ChatsTab', {
          screen: 'ChatDetail',
          params: {
            conversation: response.data.conversation,
            otherUser: {
              _id: driverId,
              firstName: driver.firstName || driver.name?.split(' ')[0] || 'Conductor',
              lastName: driver.lastName || driver.name?.split(' ').slice(1).join(' ') || '',
              avatar: driver.avatar || null,
            },
          },
        });
      } else {
        showAlert('Ocurrió algo', 'No se pudo abrir el chat');
      }
    } catch {
      showAlert('Ocurrió algo', 'No se pudo abrir el chat');
    } finally {
      setChatLoading(prev => ({ ...prev, [reservationId]: false }));
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

    return (
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: divider }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => item.trip?.id && navigation.navigate('TripDetailFromCarpoolings', { tripId: item.trip.id })}
        >
          <View style={styles.cardTop}>
            <View style={[styles.statusPill, { backgroundColor: pill.c + '22' }]}>
              <Text style={[styles.statusPillText, { color: pill.c }]}>{pill.t}</Text>
            </View>
            <View style={styles.routeBlock}>
              <Text style={[styles.addr, { color: textPrimary }]} numberOfLines={2}>
                {item.trip?.from || 'Origen'}
              </Text>
              <Text style={[styles.addr, { color: textPrimary, marginTop: 6 }]} numberOfLines={2}>
                {item.trip?.to || 'Destino'}
              </Text>
            </View>
          </View>

          <Text style={[styles.meta, { color: textMuted }]}>
            {formatDate(item.trip?.date || item.trip?.departureDate)}
            {item.trip?.time ? ` · ${item.trip.time}` : ''}
            {` · ${item.booking?.seatsBooked || 1} asiento${(item.booking?.seatsBooked || 1) > 1 ? 's' : ''}`}
          </Text>
        </TouchableOpacity>

        {rs === 'pending_payment' && (
          <View style={[styles.actions, { borderTopColor: divider }]}>
            <Text style={[styles.payLine, { color: textPrimary }]}>
              {formatCurrency(item.seatReservation?.reservationAmount || 0)}
              {timeLeft ? <Text style={{ color: textMuted }}> · {timeLeft}</Text> : null}
            </Text>
            <RebillPaymentOptions
              paymentUrl={item.seatReservation?.reservationPayment?.paymentUrl || item.seatReservation?.paymentUrl}
              qrDataUrl={item.seatReservation?.reservationPayment?.qrDataUrl}
              amount={item.seatReservation?.reservationAmount}
              formatCurrency={formatCurrency}
              onCheckoutPress={handleOpenCheckout}
            />
            <TouchableOpacity onPress={() => handleCancelReservation(item)} hitSlop={{ top: 8, bottom: 8 }}>
              <Text style={[styles.linkMuted, { color: colors.error || '#DC2626' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}

        {rs === 'pending_approval' && (
          <View style={[styles.actions, styles.rowBetween, { borderTopColor: divider }]}>
            <Text style={[styles.hint, { color: textMuted }]}>Esperando al conductor</Text>
            <TouchableOpacity onPress={() => handleCancelReservation(item)}>
              <Text style={[styles.linkMuted, { color: colors.error || '#DC2626' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}

        {rs === 'reserved' && (
          <View style={[styles.actions, { borderTopColor: divider }]}>
            <TouchableOpacity
              style={[styles.btnGhost, { borderColor: divider }]}
              onPress={() => handleOpenChat(item)}
              disabled={!!chatLoading[item.seatReservation?._id]}
            >
              {chatLoading[item.seatReservation?._id]
                ? <ActivityIndicator size="small" color={textPrimary} />
                : (
                  <>
                    <Ionicons name="chatbubble-outline" size={16} color={textPrimary} />
                    <Text style={[styles.btnGhostText, { color: textPrimary }]}>Mensaje</Text>
                  </>
                )}
            </TouchableOpacity>
          </View>
        )}

        {(rs === 'rejected' || rs === 'cancelled') && (
          <View style={[styles.actions, { borderTopColor: divider }]}>
            <Text style={[styles.hint, { color: textMuted }]}>
              {rs === 'rejected' ? 'Rechazada por el conductor' : 'Reserva cancelada'}
            </Text>
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
          <Ionicons name="calendar-outline" size={36} color={textMuted} />
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>Sin reservas</Text>
          <Text style={[styles.emptySub, { color: textMuted }]}>Buscá un viaje y reservá</Text>
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
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 28 },
  list: { padding: 16, paddingBottom: 28, gap: 10 },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  cardTop: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  routeBlock: { minWidth: 0 },
  addr: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusPillText: { fontSize: 11, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 10 },
  actions: { marginTop: 12, paddingTop: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payLine: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12 },
  linkMuted: { fontSize: 13, fontWeight: '500' },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnGhostText: { fontSize: 14, fontWeight: '500' },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 13, textAlign: 'center' },
});

export default MySeatReservationsScreen;
