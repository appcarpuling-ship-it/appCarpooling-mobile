import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Linking,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getMyReservations, getPendingPaymentReservations, cancelSeatReservation, confirmFromCallback } from '../../services/seatReservationService';
import { spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import CheckoutWebView from '../../components/CheckoutWebView';
import RebillPaymentOptions from '../../components/RebillPaymentOptions';
import Toast from '../../components/Toast';
import AnimatedCard from '../../components/AnimatedCard';

const MySeatReservationsScreen = ({ navigation }) => {
  const { showAlert } = useAlert();
  const { colors, gradients, createColorArray } = useColors();
  const { isDarkMode } = useTheme();

  // ── Paleta dinámica ──────────────────────────────────────────────────────
  const bg          = isDarkMode ? ['#111111', '#1A1A1A'] : ['#F8F9FA', '#E5E7EB'];
  const cardBg      = isDarkMode ? '#222222' : '#FFFFFF';
  const cardBorder  = isDarkMode ? '#2E2E2E' : '#E5E7EB';
  const divider     = isDarkMode ? '#2A2A2A' : '#E5E7EB';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#111827';
  const textMuted   = isDarkMode ? '#9CA3AF' : '#6B7280';
  const spinnerColor = isDarkMode ? '#FFFFFF' : '#1F2937';

  // Cajas de estado
  const pendingApprovalBg   = isDarkMode ? '#3B2A0A' : '#FEF3C7';
  const pendingApprovalText = isDarkMode ? '#FCD34D' : '#92400E';
  const pendingPaymentBg    = isDarkMode ? '#2A1A0A' : '#FFF7ED';
  const confirmedBg         = isDarkMode ? '#052E16' : '#D1FAE5';
  const confirmedText       = isDarkMode ? '#6EE7B7' : '#065F46';
  const rejectedBg          = isDarkMode ? '#2D0A0A' : '#FEE2E2';
  const rejectedText        = isDarkMode ? '#FCA5A5' : '#991B1B';

  const safeGradients = {
    card:    Array.isArray(gradients?.card) && gradients.card.length > 0 ? gradients.card : [cardBg, cardBg],
    primary: isDarkMode ? ['#1F2937', '#111827'] : ['#1F2937', '#111827'],
  };

  const [reservations, setReservations]       = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [toast, setToast]               = useState({ visible: false, message: '', type: 'success' });
  const [checkoutModal, setCheckoutModal] = useState({ visible: false, paymentUrl: null });

  useEffect(() => {
    loadReservations();
    loadPendingPayments();
  }, []);

  const loadReservations = async () => {
    try {
      const response = await getMyReservations();
      if (response.success) {
        setReservations(response.data.reservations || []);
      }
    } catch (error) {
      showAlert('Error', 'No se pudieron cargar las reservas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadPendingPayments = async () => {
    try {
      const response = await getPendingPaymentReservations();
      if (response.success) {
        setPendingPayments(response.data.pendingReservations || []);
      }
    } catch (error) {
      console.error('Error loading pending payments:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadReservations(), loadPendingPayments()]);
  };

  const handleOpenCheckout = (paymentUrl) => {
    if (!paymentUrl) { showAlert('Error', 'No hay URL de pago disponible'); return; }
    setCheckoutModal({ visible: true, paymentUrl });
  };

  const handlePaymentSuccess = async (paymentData) => {
    showToast('✅ Pago completado exitosamente', 'success');
    try {
      if (paymentData?.externalReference && paymentData?.status === 'approved') {
        await confirmFromCallback(paymentData.externalReference, 'approved');
      }
    } catch (e) {
      console.warn('Confirmación de pago:', e?.message);
    }
    await Promise.all([loadReservations(), loadPendingPayments()]);
  };

  const handlePaymentError = (error) => {
    showToast(error.message || 'Error al procesar el pago. Intenta nuevamente.', 'error');
  };

  const handleCancelReservation = (reservation) => {
    const seatReservationId = reservation.seatReservation?._id || reservation.seatReservation?.id;
    if (!seatReservationId) { showAlert('Error', 'No se puede cancelar esta reserva'); return; }
    showAlert(
      'Cancelar Reserva',
      '¿Estás seguro que deseas cancelar esta reserva? Solo puedes cancelar reservas pendientes de pago.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelSeatReservation(seatReservationId, 'Cancelado por el usuario');
              showToast('Reserva cancelada exitosamente', 'success');
              setTimeout(() => { loadReservations(); loadPendingPayments(); }, 500);
            } catch (error) {
              showToast(error?.response?.data?.message || error.message || 'Error al cancelar la reserva', 'error');
            }
          },
        },
      ]
    );
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending_approval': return { color: '#F59E0B', text: 'Pendiente de Aprobación', icon: 'time-outline' };
      case 'pending_payment':  return { color: '#F97316', text: 'Pendiente de Pago',        icon: 'card-outline' };
      case 'reserved':         return { color: '#10B981', text: 'Confirmada',                icon: 'checkmark-circle-outline' };
      case 'rejected':         return { color: '#EF4444', text: 'Rechazada',                 icon: 'close-circle-outline' };
      case 'cancelled':        return { color: '#6B7280', text: 'Cancelada',                 icon: 'close-circle-outline' };
      default:                 return { color: '#6B7280', text: status || 'Desconocido',     icon: 'help-circle-outline' };
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

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  const showToast = (message, type = 'success') => setToast({ visible: true, message, type });

  const renderReservationItem = ({ item, index }) => {
    const status       = item.seatReservation?.reservationStatus;
    const statusConfig = getStatusConfig(status);

    return (
      <AnimatedCard delay={index * 50} gradientColors={safeGradients.card} style={styles.reservationCard}>
        <View style={[styles.cardBorder, { backgroundColor: cardBg, borderColor: cardBorder }]}>

          {/* Header */}
          <View style={styles.reservationHeader}>
            <View style={styles.routeInfo}>
              <View style={styles.routePoint}>
                <Ionicons name="location" size={16} color="#1F2937" />
                <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={1}>
                  {item.trip?.from || 'Origen'}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={textMuted} />
              <View style={styles.routePoint}>
                <Ionicons name="location" size={16} color="#EF4444" />
                <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={1}>
                  {item.trip?.to || 'Destino'}
                </Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
              <Ionicons name={statusConfig.icon} size={14} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.text}</Text>
            </View>
          </View>

          {/* Info del viaje */}
          <View style={[styles.tripInfo, { borderBottomColor: divider }]}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={14} color={textMuted} />
              <Text style={[styles.infoText, { color: textMuted }]}>
                {formatDate(item.trip?.date || item.trip?.departureDate)}
              </Text>
            </View>
            {item.trip?.time && (
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={14} color={textMuted} />
                <Text style={[styles.infoText, { color: textMuted }]}>{item.trip.time}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Ionicons name="people-outline" size={14} color={textMuted} />
              <Text style={[styles.infoText, { color: textMuted }]}>
                {item.booking?.seatsBooked || 1} asiento{item.booking?.seatsBooked > 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Info financiera */}
          {item.seatReservation && (
            <View style={[styles.financialInfo, { borderBottomColor: divider }]}>
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: textMuted }]}>Reserva Pagada:</Text>
                <Text style={[styles.priceValue, { color: '#10B981' }]}>
                  {formatCurrency(item.seatReservation.reservationAmount)}
                </Text>
              </View>
              {item.seatReservation.remainingPayment?.amountToPay ? (
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: textMuted }]}>Resto a Pagar:</Text>
                  <Text style={[styles.priceValue, { color: '#3B82F6' }]}>
                    {formatCurrency(item.seatReservation.remainingPayment.amountToPay)}
                  </Text>
                </View>
              ) : (
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: textMuted }]}>Costo Total Viaje:</Text>
                  <Text style={[styles.priceValue, { color: '#3B82F6' }]}>
                    {formatCurrency(item.booking?.totalPrice || 0)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Acciones según estado */}
          {status === 'pending_approval' && (
            <View style={[styles.pendingApprovalBox, { backgroundColor: pendingApprovalBg }]}>
              <Ionicons name="time-outline" size={16} color="#F59E0B" />
              <Text style={[styles.pendingText, { color: pendingApprovalText }]}>
                Esperando respuesta del conductor
              </Text>
              <TouchableOpacity onPress={() => handleCancelReservation(item)} style={styles.cancelButtonSmall}>
                <Text style={styles.cancelButtonTextSmall}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'pending_payment' && (
            <View style={[styles.pendingPaymentBox, { backgroundColor: pendingPaymentBg }]}>
              <View style={styles.pendingPaymentHeader}>
                <Ionicons name="alert-circle" size={16} color="#F97316" />
                <Text style={styles.pendingPaymentTitle}>¡Solicitud aprobada! - Pago pendiente</Text>
              </View>
              {item.seatReservation?.expiresAt && (
                <Text style={styles.expiresText}>
                  Expira en: {getTimeRemaining(item.seatReservation.expiresAt)}
                </Text>
              )}
              <RebillPaymentOptions
                paymentUrl={item.seatReservation?.reservationPayment?.paymentUrl || item.seatReservation?.paymentUrl}
                qrDataUrl={item.seatReservation?.reservationPayment?.qrDataUrl}
                amount={item.seatReservation?.reservationAmount}
                formatCurrency={formatCurrency}
                onCheckoutPress={handleOpenCheckout}
              />
              <View style={styles.paymentActions}>
                <TouchableOpacity onPress={() => handleCancelReservation(item)} style={styles.cancelButtonSmall}>
                  <Text style={styles.cancelButtonTextSmall}>Cancelar</Text>
                </TouchableOpacity>
              </View>
              {item.seatReservation?.reservationPayment?.fallbackUrl && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(item.seatReservation.reservationPayment.fallbackUrl)}
                  style={styles.fallbackLink}
                >
                  <Text style={[styles.fallbackLinkText, { color: textMuted }]}>
                    ¿El pago falló o no te redirigió? Tocá aquí para volver
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {status === 'reserved' && (
            <View style={[styles.confirmedBox, { backgroundColor: confirmedBg }]}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={[styles.confirmedText, { color: confirmedText }]}>
                Reserva confirmada. El costo de reserva ({formatCurrency(item.seatReservation.reservationAmount)}) es aparte del costo del viaje ({formatCurrency(item.booking?.totalPrice || 0)}). El día del viaje pagarás el resto directamente al conductor.
              </Text>
            </View>
          )}

          {status === 'rejected' && (
            <View style={[styles.rejectedBox, { backgroundColor: rejectedBg }]}>
              <Ionicons name="close-circle" size={16} color="#EF4444" />
              <Text style={[styles.rejectedText, { color: rejectedText }]}>
                El conductor rechazó tu solicitud de reserva.
              </Text>
            </View>
          )}

          {status === 'cancelled' && (
            <View style={[styles.rejectedBox, { backgroundColor: isDarkMode ? '#1F1F1F' : '#F3F4F6' }]}>
              <Ionicons name="close-circle-outline" size={16} color="#6B7280" />
              <Text style={[styles.rejectedText, { color: '#6B7280' }]}>
                Esta reserva fue cancelada.
              </Text>
            </View>
          )}

        </View>
      </AnimatedCard>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={bg} style={styles.centerContainer}>
        <ActivityIndicator size="large" color={spinnerColor} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={bg} style={styles.container}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      {/* Alerta de reservas pendientes de pago */}
      {pendingPayments.length > 0 && (
        <Animated.View
          style={[
            styles.urgentAlert,
            {
              opacity: fadeAnim,
              transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}
        >
          <LinearGradient colors={['#F97316', '#EA580C']} style={styles.urgentAlertGradient}>
            <View style={styles.urgentAlertContent}>
              <Ionicons name="alert-circle" size={24} color="#FFFFFF" />
              <View style={styles.urgentAlertTextContainer}>
                <Text style={styles.urgentAlertTitle}>
                  Tienes {pendingPayments.length} reserva(s) pendiente(s) de pago
                </Text>
                <Text style={styles.urgentAlertSubtitle}>
                  Completa el pago antes de que expire para confirmar tu reserva
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      )}

      {reservations.length > 0 ? (
        <FlatList
          data={reservations}
          renderItem={renderReservationItem}
          keyExtractor={(item) => item.id || item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={spinnerColor}
              colors={['#1F2937', '#111827']}
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <LinearGradient colors={safeGradients.primary} style={styles.emptyIconContainer}>
            <Ionicons name="calendar-outline" size={48} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.emptyText, { color: textPrimary }]}>No tienes reservas</Text>
          <Text style={[styles.emptySubtext, { color: textMuted }]}>
            Busca y reserva viajes para comenzar
          </Text>
        </View>
      )}

      <CheckoutWebView
        visible={checkoutModal.visible}
        paymentUrl={checkoutModal.paymentUrl}
        onClose={() => setCheckoutModal({ visible: false, paymentUrl: null })}
        onPaymentSuccess={handlePaymentSuccess}
        onPaymentError={handlePaymentError}
      />
    </LinearGradient>
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
  },
  urgentAlert: {
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  urgentAlertGradient: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  urgentAlertContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  urgentAlertTextContainer: {
    flex: 1,
  },
  urgentAlertTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  urgentAlertSubtitle: {
    fontSize: fontSize.sm,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  listContent: {
    padding: spacing.md,
  },
  reservationCard: {
    marginBottom: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  cardBorder: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
  },
  reservationHeader: {
    marginBottom: spacing.md,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  routeText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semiBold,
  },
  tripInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoText: {
    fontSize: fontSize.sm,
  },
  financialInfo: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  priceLabel: {
    fontSize: fontSize.sm,
  },
  priceValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  pendingApprovalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  pendingText: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  pendingPaymentBox: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: '#F97316',
  },
  pendingPaymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  pendingPaymentTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#F97316',
  },
  expiresText: {
    fontSize: fontSize.sm,
    color: '#F97316',
    marginBottom: spacing.sm,
  },
  paymentActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButtonSmall: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cancelButtonTextSmall: {
    color: '#EF4444',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
  },
  fallbackLink: {
    marginTop: 8,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  fallbackLinkText: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  confirmedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  confirmedText: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  rejectedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  rejectedText: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default MySeatReservationsScreen;
