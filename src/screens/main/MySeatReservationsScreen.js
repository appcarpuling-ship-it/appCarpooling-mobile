import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMyReservations, getPendingPaymentReservations, cancelSeatReservation, confirmFromCallback } from '../../services/seatReservationService';
import { post_withauth } from '../../services/apiService';
import useColors from '../../hooks/useColors';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import CheckoutWebView from '../../components/CheckoutWebView';
import RebillPaymentOptions from '../../components/RebillPaymentOptions';
import Toast from '../../components/Toast';

const MySeatReservationsScreen = ({ navigation }) => {
  const { showAlert } = useAlert();
  const { colors } = useColors();
  const { isDarkMode } = useTheme();

  const bg          = isDarkMode ? '#111111' : '#F5F5F5';
  const cardBg      = isDarkMode ? '#1A1A1A' : '#FFFFFF';
  const divider     = isDarkMode ? '#2A2A2A' : '#F0F0F0';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted   = isDarkMode ? '#6B7280' : '#9CA3AF';
  const accent      = isDarkMode ? '#FFFFFF' : '#000000';
  const accentInv   = isDarkMode ? '#000000' : '#FFFFFF';

  const [reservations, setReservations]   = useState([]);
  const [page, setPage]                   = useState(1);
  const [hasMore, setHasMore]             = useState(true);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [chatLoading, setChatLoading]     = useState({});
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [toast, setToast]                 = useState({ visible: false, message: '', type: 'success' });
  const [checkoutModal, setCheckoutModal] = useState({ visible: false, paymentUrl: null });
  const fetchingRef = useRef(false);

  useEffect(() => {
    loadReservations(1, true);
    loadPendingPayments();
  }, []);

  const loadReservations = async (pageNum = 1, reset = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const response = await getMyReservations({ page: pageNum, limit: 15 });
      if (response.success) {
        const newItems = response.data.reservations || [];
        setReservations(prev => reset ? newItems : [...prev, ...newItems]);
        setPage(pageNum);
        setHasMore(response.data.pagination?.hasMore ?? false);
      }
    } catch {
      showAlert('Error', 'No se pudieron cargar las reservas');
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const loadPendingPayments = async () => {
    try {
      const response = await getPendingPaymentReservations();
      if (response.success) setPendingPayments(response.data.pendingReservations || []);
    } catch {}
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadReservations(1, true), loadPendingPayments()]);
  };

  const onEndReached = () => {
    if (!hasMore || loadingMore || fetchingRef.current) return;
    setLoadingMore(true);
    loadReservations(page + 1, false);
  };

  const handleOpenCheckout = (paymentUrl) => {
    if (!paymentUrl) { showAlert('Error', 'No hay URL de pago disponible'); return; }
    setCheckoutModal({ visible: true, paymentUrl });
  };

  const handlePaymentSuccess = async (paymentData) => {
    showToast('Pago completado exitosamente', 'success');
    try {
      if (paymentData?.externalReference && paymentData?.status === 'approved') {
        await confirmFromCallback(paymentData.externalReference, 'approved');
      }
    } catch (e) {
      console.warn('Confirmación de pago:', e?.message);
    }
    await Promise.all([loadReservations(1, true), loadPendingPayments()]);
  };

  const handlePaymentError = (error) => {
    showToast(error.message || 'Error al procesar el pago', 'error');
  };

  const handleCancelReservation = (reservation) => {
    const seatReservationId = reservation.seatReservation?._id || reservation.seatReservation?.id;
    if (!seatReservationId) { showAlert('Error', 'No se puede cancelar esta reserva'); return; }
    showAlert(
      'Cancelar Reserva',
      '¿Estás seguro que deseas cancelar esta reserva?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelSeatReservation(seatReservationId, 'Cancelado por el usuario');
              showToast('Reserva cancelada', 'success');
              setTimeout(() => { loadReservations(1, true); loadPendingPayments(); }, 500);
            } catch (error) {
              showToast(error?.response?.data?.message || error.message || 'Error al cancelar', 'error');
            }
          },
        },
      ]
    );
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending_approval': return { color: '#F59E0B', text: 'Pendiente de aprobación' };
      case 'pending_payment':  return { color: '#F97316', text: 'Pendiente de pago' };
      case 'reserved':         return { color: '#10B981', text: 'Confirmada' };
      case 'rejected':         return { color: '#EF4444', text: 'Rechazada' };
      case 'cancelled':        return { color: '#6B7280', text: 'Cancelada' };
      default:                 return { color: '#6B7280', text: status || 'Desconocido' };
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(amount);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expirado';
    const hours   = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const showToast = (message, type = 'success') => setToast({ visible: true, message, type });

  const handleOpenChat = async (item) => {
    const driverId = item.trip?.driver?._id || item.trip?.driver?.id;
    if (!driverId) { showAlert('Error', 'No se encontraron datos del conductor'); return; }
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
              _id:       driverId,
              firstName: driver.firstName || driver.name?.split(' ')[0] || 'Conductor',
              lastName:  driver.lastName  || driver.name?.split(' ').slice(1).join(' ') || '',
              avatar:    driver.avatar || null,
            },
          },
        });
      } else {
        showAlert('Error', 'No se pudo abrir el chat');
      }
    } catch {
      showAlert('Error', 'No se pudo abrir el chat');
    } finally {
      setChatLoading(prev => ({ ...prev, [reservationId]: false }));
    }
  };

  const renderReservationItem = ({ item }) => {
    const status       = item.seatReservation?.reservationStatus;
    const statusConfig = getStatusConfig(status);
    const timeLeft     = item.seatReservation?.expiresAt ? getTimeRemaining(item.seatReservation.expiresAt) : null;
    const tripStatus   = item.trip?.status;
    const tripStarted  = tripStatus === 'started';
    const tripCompleted = tripStatus === 'completed';
    const tripCancelledByDriver = tripStatus === 'cancelled';

    return (
      <View style={[
        styles.card,
        { backgroundColor: cardBg },
        tripCompleted && styles.cardCompleted,
        tripStarted && styles.cardInProgress,
      ]}>

        {tripStarted ? (
          <View style={[styles.tripStateBanner, { backgroundColor: isDarkMode ? '#1C1200' : '#FFFBEB', borderBottomColor: isDarkMode ? '#2A2000' : '#FDE68A' }]}>
            <Ionicons name="car" size={13} color="#F59E0B" />
            <Text style={[styles.tripStateBannerText, { color: '#D97706' }]}>Viaje en curso</Text>
          </View>
        ) : tripCompleted ? (
          <View style={[styles.tripStateBanner, { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF', borderBottomColor: isDarkMode ? '#1E3A5F' : '#BFDBFE' }]}>
            <Ionicons name="checkmark-circle" size={13} color="#3B82F6" />
            <Text style={[styles.tripStateBannerText, { color: '#2563EB' }]}>Viaje completado</Text>
          </View>
        ) : tripCancelledByDriver ? (
          <View style={[styles.tripStateBanner, { backgroundColor: isDarkMode ? '#1C1917' : '#F5F5F4', borderBottomColor: isDarkMode ? '#44403C' : '#E7E5E4' }]}>
            <Ionicons name="close-circle-outline" size={13} color="#78716C" />
            <Text style={[styles.tripStateBannerText, { color: '#78716C' }]}>Viaje cancelado</Text>
          </View>
        ) : null}

        {/* Ruta */}
        <View style={styles.routeRow}>
          <View style={styles.routeLeft}>
            <View style={styles.routeDots}>
              <View style={[styles.dotOrigin, { borderColor: accent }]} />
              <View style={[styles.routeLine, { backgroundColor: divider }]} />
              <View style={[styles.dotDest, { backgroundColor: accent }]} />
            </View>
            <View style={styles.routeLabels}>
              <Text style={[styles.routeCity, { color: textPrimary }]} numberOfLines={1}>
                {item.trip?.from || 'Origen'}
              </Text>
              <Text style={[styles.routeCity, { color: textPrimary, marginTop: 10 }]} numberOfLines={1}>
                {item.trip?.to || 'Destino'}
              </Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusConfig.color + '18' }]}>
            <Text style={[styles.statusPillText, { color: statusConfig.color }]}>{statusConfig.text}</Text>
          </View>
        </View>

        {/* Meta */}
        <View style={[styles.metaRow, { borderTopColor: divider, borderBottomColor: divider }]}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>
              {formatDate(item.trip?.date || item.trip?.departureDate)}
            </Text>
          </View>
          {item.trip?.time && (
            <>
              <View style={[styles.metaDivider, { backgroundColor: divider }]} />
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={13} color={textMuted} />
                <Text style={[styles.metaText, { color: textMuted }]}>{item.trip.time}</Text>
              </View>
            </>
          )}
          <View style={[styles.metaDivider, { backgroundColor: divider }]} />
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>
              {item.booking?.seatsBooked || 1} asiento{item.booking?.seatsBooked > 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Precios */}
        {item.seatReservation && (
          <View style={[styles.pricesSection, { borderBottomColor: divider }]}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: textMuted }]}>Reserva</Text>
              <Text style={[styles.priceValue, { color: textPrimary }]}>
                {formatCurrency(item.seatReservation.reservationAmount)}
              </Text>
            </View>
            {item.seatReservation.remainingPayment?.amountToPay ? (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: textMuted }]}>Resto al conductor</Text>
                <Text style={[styles.priceValue, { color: textPrimary }]}>
                  {formatCurrency(item.seatReservation.remainingPayment.amountToPay)}
                </Text>
              </View>
            ) : (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: textMuted }]}>Costo del viaje</Text>
                <Text style={[styles.priceValue, { color: textPrimary }]}>
                  {formatCurrency(item.booking?.totalPrice || 0)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Acciones */}
        <View style={styles.footer}>

          {status === 'pending_approval' && (
            <View style={styles.footerRow}>
              <View style={styles.footerLeft}>
                <Ionicons name="time-outline" size={14} color={textMuted} />
                <Text style={[styles.footerNote, { color: textMuted }]}>Esperando al conductor</Text>
              </View>
              <TouchableOpacity onPress={() => handleCancelReservation(item)}>
                <Text style={[styles.cancelLink, { color: colors.error || '#EF4444' }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'pending_payment' && (
            <View style={styles.pendingPaymentSection}>
              <View style={styles.footerRow}>
                <Text style={[styles.footerNote, { color: textPrimary, fontWeight: '600' }]}>
                  Solicitud aprobada — completá el pago
                </Text>
                {timeLeft && (
                  <Text style={[styles.expiryText, { color: textMuted }]}>
                    {timeLeft}
                  </Text>
                )}
              </View>
              <View style={styles.paymentBtnWrap}>
                <RebillPaymentOptions
                  paymentUrl={item.seatReservation?.reservationPayment?.paymentUrl || item.seatReservation?.paymentUrl}
                  qrDataUrl={item.seatReservation?.reservationPayment?.qrDataUrl}
                  amount={item.seatReservation?.reservationAmount}
                  formatCurrency={formatCurrency}
                  onCheckoutPress={handleOpenCheckout}
                />
              </View>
              <View style={styles.footerRow}>
                <TouchableOpacity onPress={() => handleCancelReservation(item)}>
                  <Text style={[styles.cancelLink, { color: colors.error || '#EF4444' }]}>Cancelar reserva</Text>
                </TouchableOpacity>
                {item.seatReservation?.reservationPayment?.fallbackUrl && (
                  <TouchableOpacity onPress={() => Linking.openURL(item.seatReservation.reservationPayment.fallbackUrl)}>
                    <Text style={[styles.cancelLink, { color: textMuted }]}>¿No te redirigió?</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {status === 'reserved' && (
            <View style={styles.reservedSection}>
              <Text style={[styles.footerNote, { color: textMuted }]}>
                El día del viaje pagás el resto directamente al conductor.
              </Text>
              <TouchableOpacity
                style={[styles.chatBtn, { borderColor: divider }]}
                onPress={() => handleOpenChat(item)}
                disabled={!!chatLoading[item.seatReservation?._id]}
                activeOpacity={0.8}
              >
                {chatLoading[item.seatReservation?._id]
                  ? <ActivityIndicator size="small" color={textPrimary} />
                  : <>
                      <Ionicons name="chatbubble-ellipses-outline" size={15} color={textPrimary} />
                      <Text style={[styles.chatBtnText, { color: textPrimary }]}>Mensaje al conductor</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )}

          {status === 'rejected' && (
            <View style={styles.footerRow}>
              <Ionicons name="close-circle-outline" size={14} color={colors.error || '#EF4444'} />
              <Text style={[styles.footerNote, { color: textMuted }]}>El conductor rechazó tu solicitud.</Text>
            </View>
          )}

          {status === 'cancelled' && (
            <View style={styles.footerRow}>
              <Ionicons name="close-circle-outline" size={14} color={textMuted} />
              <Text style={[styles.footerNote, { color: textMuted }]}>Esta reserva fue cancelada.</Text>
            </View>
          )}

        </View>
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
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      {/* Aviso sutil de pago pendiente */}
      {pendingPayments.length > 0 && (
        <View style={[styles.pendingBanner, { backgroundColor: cardBg, borderBottomColor: divider }]}>
          <Ionicons name="alert-circle-outline" size={14} color='#F97316' />
          <Text style={styles.pendingBannerText}>
            {pendingPayments.length === 1
              ? 'Tenés 1 reserva pendiente de pago'
              : `Tenés ${pendingPayments.length} reservas pendientes de pago`}
          </Text>
        </View>
      )}

      {reservations.length > 0 ? (
        <FlatList
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={textMuted} style={{ paddingVertical: 16 }} />
            ) : null
          }
          data={[...reservations].sort((a, b) => {
            // Fase del viaje: en curso → próximo (activo) → completado → viaje cancelado
            const tripPhase = (item) => {
              const s = item.trip?.status;
              if (s === 'started') return 0;
              if (s === 'completed') return 2;
              if (s === 'cancelled') return 3;
              return 1;
            };
            const phA = tripPhase(a);
            const phB = tripPhase(b);
            if (phA !== phB) return phA - phB;

            const ORDER = { pending_payment: 0, pending_approval: 1, reserved: 2, rejected: 3, cancelled: 4 };
            const pa = ORDER[a.seatReservation?.reservationStatus] ?? 5;
            const pb = ORDER[b.seatReservation?.reservationStatus] ?? 5;
            if (pa !== pb) return pa - pb;

            const da = new Date(a.trip?.date || a.trip?.departureDate || 0).getTime();
            const db = new Date(b.trip?.date || b.trip?.departureDate || 0).getTime();
            // Completados: el más reciente primero
            if (phA === 2) return db - da;
            return da - db;
          })}
          renderItem={renderReservationItem}
          keyExtractor={(item) => item.id || item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={textMuted}
              colors={[textMuted]}
            />
          }
        />
      ) : (
        <View style={styles.centered}>
          <Ionicons name="calendar-outline" size={40} color={textMuted} />
          <Text style={[styles.emptyText, { color: textPrimary }]}>No tenés reservas</Text>
          <Text style={[styles.emptySubtext, { color: textMuted }]}>Buscá y reservá viajes para comenzar</Text>
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
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 32 },

  // Banner de alerta sutil
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pendingBannerText: {
    fontSize: 13,
    color: '#F97316',
    fontWeight: '500',
  },

  listContent: { padding: 16, gap: 12 },

  // Card
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardInProgress: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F59E0B55',
  },
  cardCompleted: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3B82F655',
    opacity: 0.96,
  },

  // Ruta
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    gap: 12,
  },
  routeLeft: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' },
  routeDots: { width: 14, alignItems: 'center', paddingVertical: 2 },
  dotOrigin: {
    width: 9, height: 9, borderRadius: 5, borderWidth: 2,
  },
  routeLine: { width: 1.5, height: 16, marginVertical: 2 },
  dotDest:   { width: 9, height: 9, borderRadius: 2 },
  routeLabels: { flex: 1 },
  routeCity: { fontSize: 14, fontWeight: '600' },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'center',
    flexShrink: 0,
  },
  statusPillText: { fontSize: 11, fontWeight: '600' },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaDivider: { width: StyleSheet.hairlineWidth, height: 14, marginHorizontal: 4 },
  metaText: { fontSize: 12 },

  // Precios
  pricesSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 13 },
  priceValue: { fontSize: 14, fontWeight: '600' },

  // Footer / acciones
  footer: { paddingHorizontal: 16, paddingVertical: 12 },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  footerNote: { fontSize: 13, flex: 1 },
  expiryText: { fontSize: 12 },
  cancelLink: { fontSize: 13, fontWeight: '500' },

  // Pago pendiente
  pendingPaymentSection: { gap: 10 },
  paymentBtnWrap: {},

  // Confirmada
  reservedSection: { gap: 10 },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chatBtnText: { fontSize: 13, fontWeight: '500' },

  // Vacío
  emptyText:    { fontSize: 16, fontWeight: '600', marginTop: 4 },
  emptySubtext: { fontSize: 13, textAlign: 'center' },

  tripStateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tripStateBannerText: { fontSize: 12, fontWeight: '600' },
});

export default MySeatReservationsScreen;
