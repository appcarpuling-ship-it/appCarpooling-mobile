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
  Image,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getMyReservations, getPendingPaymentReservations, cancelSeatReservation } from '../../services/seatReservationService';
import { colors as staticColors, gradients, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';
import { useAlert } from '../../context/AlertContext';
import NativeCheckout from '../../components/NativeCheckout';
import AstroPayPaymentOptions from '../../components/AstroPayPaymentOptions';
import Toast from '../../components/Toast';
import AnimatedCard from '../../components/AnimatedCard';

const MySeatReservationsScreen = ({ navigation }) => {
  const { showAlert } = useAlert();
  const { colors, gradients, createColorArray } = useColors();
  const safeGradients = {
    card: Array.isArray(gradients?.card) && gradients.card.length > 0 ? gradients.card : ['#FFFFFF', '#F8F9FA'],
    primary: ['#1F2937', '#111827'],
    dark: Array.isArray(gradients?.dark) && gradients.dark.length > 0 ? gradients.dark : ['#F8F9FA', '#E5E7EB'],
  };

  const [reservations, setReservations] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

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

  const handleOpenCheckout = async (paymentUrl) => {
    try {
      await NativeCheckout.openCheckout(paymentUrl, {
        onPaymentSuccess: handlePaymentSuccess,
        onPaymentError: handlePaymentError
      });
    } catch (error) {
      console.error('Error opening payment URL:', error);
      showAlert('Error', 'No se pudo procesar el pago');
    }
  };

  const handlePaymentSuccess = async (paymentData) => {
    console.log('✅ [MySeatReservations] Pago exitoso:', paymentData);

    showToast('✅ Pago completado exitosamente', 'success');

    // Recargar las reservas después de un breve delay para que se vea el toast
    setTimeout(async () => {
      await Promise.all([loadReservations(), loadPendingPayments()]);
    }, 1000);
  };

  const handlePaymentError = (error) => {
    console.error('❌ [MySeatReservations] Error en pago:', error);
    showToast(
      error.message || 'Error al procesar el pago. Intenta nuevamente.',
      'error'
    );
  };

  const handleCancelReservation = (reservation) => {
    const seatReservationId = reservation.seatReservation?._id || reservation.seatReservation?.id;

    if (!seatReservationId) {
      showAlert('Error', 'No se puede cancelar esta reserva');
      return;
    }

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
              setTimeout(() => {
                loadReservations();
                loadPendingPayments();
              }, 500);
            } catch (error) {
              showToast(
                error?.response?.data?.message || error.message || 'Error al cancelar la reserva',
                'error'
              );
            }
          },
        },
      ]
    );
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending_approval':
        return { color: '#F59E0B', text: 'Pendiente de Aprobación', icon: 'time-outline' };
      case 'pending_payment':
        return { color: '#F97316', text: 'Pendiente de Pago', icon: 'card-outline' };
      case 'reserved':
        return { color: '#10B981', text: 'Confirmada', icon: 'checkmark-circle-outline' };
      case 'rejected':
        return { color: '#EF4444', text: 'Rechazada', icon: 'close-circle-outline' };
      case 'cancelled':
        return { color: '#6B7280', text: 'Cancelada', icon: 'close-circle-outline' };
      default:
        return { color: '#6B7280', text: status || 'Desconocido', icon: 'help-circle-outline' };
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires - now;
    if (diff <= 0) return 'Expirado';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
  };

  const renderReservationItem = ({ item, index }) => {
    const status = item.seatReservation?.reservationStatus;
    const statusConfig = getStatusConfig(status);
    const StatusIcon = statusConfig.icon;

    // Debug: Log para verificar datos del conductor
    if (status === 'reserved') {
      console.log('🔍 [MySeatReservations] Reserva confirmada - Datos del conductor:', {
        hasDriver: !!item.trip?.driver,
        driver: item.trip?.driver,
        tripId: item.trip?.id
      });
    }

    return (
      <AnimatedCard
        delay={index * 50}
        gradientColors={safeGradients.card}
        style={styles.reservationCard}
      >
        <View style={styles.cardBorder}>
          {/* Header con ruta y estado */}
          <View style={styles.reservationHeader}>
            <View style={styles.routeInfo}>
              <View style={styles.routePoint}>
                <Ionicons name="location" size={16} color="#1F2937" />
                <Text style={styles.routeText} numberOfLines={1}>
                  {item.trip?.from || 'Origen'}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={staticColors.textTertiary} />
              <View style={styles.routePoint}>
                <Ionicons name="location" size={16} color="#EF4444" />
                <Text style={styles.routeText} numberOfLines={1}>
                  {item.trip?.to || 'Destino'}
                </Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
              <Ionicons name={StatusIcon} size={14} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.text}
              </Text>
            </View>
          </View>

          {/* Información del viaje */}
          <View style={styles.tripInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={14} color={staticColors.textSecondary} />
              <Text style={styles.infoText}>
                {formatDate(item.trip?.date || item.trip?.departureDate)}
              </Text>
            </View>
            {item.trip?.time && (
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={14} color={staticColors.textSecondary} />
                <Text style={styles.infoText}>{item.trip.time}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Ionicons name="people-outline" size={14} color={staticColors.textSecondary} />
              <Text style={styles.infoText}>
                {item.booking?.seatsBooked || 1} asiento{item.booking?.seatsBooked > 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Información financiera */}
          {item.seatReservation && (
            <View style={styles.financialInfo}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Reserva Pagada:</Text>
                <Text style={[styles.priceValue, { color: '#10B981' }]}>
                  {formatCurrency(item.seatReservation.reservationAmount)}
                </Text>
              </View>
              {item.seatReservation.remainingPayment?.amountToPay ? (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Resto a Pagar:</Text>
                  <Text style={[styles.priceValue, { color: '#3B82F6' }]}>
                    {formatCurrency(item.seatReservation.remainingPayment.amountToPay)}
                  </Text>
                </View>
              ) : (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Costo Total Viaje:</Text>
                  <Text style={[styles.priceValue, { color: '#3B82F6' }]}>
                    {formatCurrency(item.booking?.totalPrice || 0)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Información del conductor - Solo para reservas confirmadas y pagadas */}
          {status === 'reserved' && (
            <View>
              {item.trip?.driver ? (
                <LinearGradient
                  colors={['#E0F2FE', '#BAE6FD']}
                  style={styles.driverInfoCard}
                >
                  <View style={styles.driverInfoHeader}>
                    <Ionicons name="person-circle" size={24} color="#0EA5E9" />
                    <Text style={styles.driverInfoTitle}>Información del Conductor</Text>
                  </View>
                  <View style={styles.driverDetails}>
                    <View style={styles.driverNameRow}>
                      <Ionicons name="person-outline" size={18} color="#0369A1" />
                      <Text style={styles.driverName}>
                        {item.trip.driver.name ||
                          `${item.trip.driver.firstName || ''} ${item.trip.driver.lastName || ''}`.trim() ||
                          'Conductor'}
                      </Text>
                    </View>
                    {item.trip.driver.phone && (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`tel:${item.trip.driver.phone}`)}
                        style={styles.contactButtonLarge}
                      >
                        <LinearGradient
                          colors={['#3B82F6', '#2563EB']}
                          style={styles.contactButtonGradient}
                        >
                          <Ionicons name="call" size={18} color="#FFFFFF" />
                          <Text style={styles.contactTextLarge}>Llamar: {item.trip.driver.phone}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                    {item.trip.driver.email && (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`mailto:${item.trip.driver.email}`)}
                        style={styles.emailButton}
                      >
                        <Ionicons name="mail-outline" size={16} color="#0369A1" />
                        <Text style={styles.emailText}>{item.trip.driver.email}</Text>
                      </TouchableOpacity>
                    )}
                    {item.trip.driver.avatar && (
                      <View style={styles.avatarContainer}>
                        <Image
                          source={{ uri: item.trip.driver.avatar }}
                          style={styles.driverAvatar}
                        />
                      </View>
                    )}
                  </View>
                </LinearGradient>
              ) : (
                <View style={styles.driverInfoCard}>
                  <View style={styles.driverInfoHeader}>
                    <Ionicons name="person-circle-outline" size={24} color="#6B7280" />
                    <Text style={styles.driverInfoTitle}>Información del Conductor</Text>
                  </View>
                  <Text style={styles.driverInfoPlaceholder}>
                    Los datos del conductor se cargarán en breve...
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Acciones según el estado */}
          {status === 'pending_approval' && (
            <View style={styles.pendingApprovalBox}>
              <Ionicons name="time-outline" size={16} color="#F59E0B" />
              <Text style={styles.pendingText}>
                Esperando respuesta del conductor
              </Text>
              <TouchableOpacity
                onPress={() => handleCancelReservation(item)}
                style={styles.cancelButtonSmall}
              >
                <Text style={styles.cancelButtonTextSmall}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'pending_payment' && (
            <View style={styles.pendingPaymentBox}>
              <View style={styles.pendingPaymentHeader}>
                <Ionicons name="alert-circle" size={16} color="#F97316" />
                <Text style={styles.pendingPaymentTitle}>
                  ¡Solicitud aprobada! - Pago pendiente
                </Text>
              </View>
              {item.seatReservation?.expiresAt && (
                <Text style={styles.expiresText}>
                  Expira en: {getTimeRemaining(item.seatReservation.expiresAt)}
                </Text>
              )}
              <AstroPayPaymentOptions
                paymentUrl={item.seatReservation?.reservationPayment?.paymentUrl || item.seatReservation?.paymentUrl}
                qrDataUrl={item.seatReservation?.reservationPayment?.qrDataUrl}
                amount={item.seatReservation?.reservationAmount}
                formatCurrency={formatCurrency}
                onCheckoutPress={handleOpenCheckout}
              />
              <View style={styles.paymentActions}>
                <TouchableOpacity
                  onPress={() => handleCancelReservation(item)}
                  style={styles.cancelButtonSmall}
                >
                  <Text style={styles.cancelButtonTextSmall}>Cancelar</Text>
                </TouchableOpacity>
              </View>
              {(item.seatReservation?.reservationPayment?.fallbackUrl) && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(item.seatReservation.reservationPayment.fallbackUrl)}
                  style={styles.fallbackLink}
                >
                  <Text style={styles.fallbackLinkText}>
                    ¿El pago falló o no te redirigió? Tocá aquí para volver
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {status === 'reserved' && (
            <View style={styles.confirmedBox}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.confirmedText}>
                Reserva confirmada. El costo de reserva ({formatCurrency(item.seatReservation.reservationAmount)}) es aparte del costo del viaje ({formatCurrency(item.booking?.totalPrice || 0)}). El día del viaje pagarás el resto directamente al conductor.
              </Text>
            </View>
          )}

          {status === 'rejected' && (
            <View style={styles.rejectedBox}>
              <Ionicons name="close-circle" size={16} color="#EF4444" />
              <Text style={styles.rejectedText}>
                El conductor rechazó tu solicitud de reserva.
              </Text>
            </View>
          )}

          {status === 'cancelled' && (
            <View style={[styles.rejectedBox, { backgroundColor: '#6B728020' }]}>
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
      <LinearGradient colors={safeGradients.dark} style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1F2937" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={safeGradients.dark} style={styles.container}>
      {/* Alertas urgentes de reservas pendientes de pago */}
      {/* Toast para feedback */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      {/* Alertas urgentes de reservas pendientes de pago */}
      {pendingPayments.length > 0 && (
        <Animated.View
          style={[
            styles.urgentAlert,
            {
              opacity: fadeAnim,
              transform: [{
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              }],
            },
          ]}
        >
          <LinearGradient
            colors={['#F97316', '#EA580C']}
            style={styles.urgentAlertGradient}
          >
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
              tintColor="#1F2937"
              colors={['#1F2937', '#111827']}
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <LinearGradient
            colors={safeGradients.primary}
            style={styles.emptyIconContainer}
          >
            <Ionicons name="calendar-outline" size={48} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.emptyText}>No tienes reservas</Text>
          <Text style={styles.emptySubtext}>
            Busca y reserva viajes para comenzar
          </Text>
        </View>
      )}
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
    backgroundColor: staticColors.cardBackground || '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: staticColors.cardBorder || '#E5E7EB',
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
    color: '#000000',
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
    borderBottomColor: '#E5E7EB',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: staticColors.textSecondary || '#6B7280',
  },
  financialInfo: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  priceLabel: {
    fontSize: fontSize.sm,
    color: staticColors.textSecondary || '#6B7280',
  },
  priceValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  driverInfo: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  driverInfoCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  driverInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  driverInfoTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#0369A1',
  },
  driverDetails: {
    gap: spacing.sm,
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  driverName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#0369A1',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contactButtonLarge: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  contactButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  contactText: {
    fontSize: fontSize.sm,
    color: '#3B82F6',
  },
  contactTextLarge: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: '#FFFFFF',
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  emailText: {
    fontSize: fontSize.sm,
    color: '#0369A1',
  },
  avatarContainer: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  driverInfoPlaceholder: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  pendingApprovalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  pendingText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: '#92400E',
  },
  pendingPaymentBox: {
    backgroundColor: '#FFF7ED',
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
  payButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
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
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
  confirmedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#D1FAE5',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  confirmedText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: '#065F46',
  },
  rejectedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEE2E2',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  rejectedText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: '#991B1B',
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
    color: '#000000',
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: staticColors.textSecondary || '#6B7280',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default MySeatReservationsScreen;
