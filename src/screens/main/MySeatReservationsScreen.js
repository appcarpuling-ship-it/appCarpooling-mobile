import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  RefreshControl,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getMyReservations, getPendingPaymentReservations, cancelSeatReservation } from '../../services/seatReservationService';
import { colors as staticColors, gradients, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';

const MySeatReservationsScreen = ({ navigation }) => {
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
      Alert.alert('Error', 'No se pudieron cargar las reservas');
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

  const handlePayReservation = async (reservation) => {
    try {
      const paymentUrl = reservation.seatReservation?.paymentUrl ||
        reservation.seatReservation?.reservationPayment?.paymentUrl ||
        reservation.paymentUrl;

      if (paymentUrl) {
        const canOpen = await Linking.canOpenURL(paymentUrl);
        if (canOpen) {
          await Linking.openURL(paymentUrl);
        } else {
          Alert.alert('Error', 'No se pudo abrir el link de pago');
        }
      } else {
        Alert.alert('Error', 'No se encontró la URL de pago');
      }
    } catch (error) {
      console.error('Error opening payment URL:', error);
      Alert.alert('Error', 'No se pudo procesar el pago');
    }
  };

  const handleCancelReservation = (reservation) => {
    const seatReservationId = reservation.seatReservation?._id || reservation.seatReservation?.id;

    if (!seatReservationId) {
      Alert.alert('Error', 'No se puede cancelar esta reserva');
      return;
    }

    Alert.alert(
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
              Alert.alert('Éxito', 'Reserva cancelada');
              loadReservations();
              loadPendingPayments();
            } catch (error) {
              Alert.alert('Error', error?.response?.data?.message || error.message);
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
      default:
        return { color: '#6B7280', text: status, icon: 'help-circle-outline' };
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
    if (!loading && reservations.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, reservations]);

  const renderReservationItem = ({ item, index }) => {
    const status = item.seatReservation?.reservationStatus;
    const statusConfig = getStatusConfig(status);
    const StatusIcon = statusConfig.icon;

    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <LinearGradient
          colors={safeGradients.card}
          style={styles.reservationCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
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

            {/* Información del conductor - Solo para reservas confirmadas */}
            {status === 'reserved' && item.trip?.driver && (
              <View style={styles.driverInfo}>
                <Text style={styles.driverLabel}>Conductor:</Text>
                <Text style={styles.driverName}>
                  {item.trip.driver.name || `${item.trip.driver.firstName} ${item.trip.driver.lastName}`}
                </Text>
                {item.trip.driver.phone && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${item.trip.driver.phone}`)}
                    style={styles.contactButton}
                  >
                    <Ionicons name="call-outline" size={14} color="#3B82F6" />
                    <Text style={styles.contactText}>{item.trip.driver.phone}</Text>
                  </TouchableOpacity>
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
                <View style={styles.paymentActions}>
                  <TouchableOpacity
                    onPress={() => handlePayReservation(item)}
                    style={styles.payButton}
                  >
                    <LinearGradient
                      colors={['#F97316', '#EA580C']}
                      style={styles.payButtonGradient}
                    >
                      <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.payButtonText}>Pagar Ahora</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleCancelReservation(item)}
                    style={styles.cancelButtonSmall}
                  >
                    <Text style={styles.cancelButtonTextSmall}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
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
          </View>
        </LinearGradient>
      </Animated.View>
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
      {pendingPayments.length > 0 && (
        <View style={styles.urgentAlert}>
          <LinearGradient
            colors={['#F97316', '#EA580C']}
            style={styles.urgentAlertGradient}
          >
            <Ionicons name="alert-triangle" size={24} color="#FFFFFF" />
            <View style={styles.urgentAlertContent}>
              <Text style={styles.urgentAlertTitle}>
                ⚠️ Tienes {pendingPayments.length} reserva(s) pendiente(s) de pago
              </Text>
              <Text style={styles.urgentAlertSubtitle}>
                Completa el pago antes de que expire para confirmar tu reserva.
              </Text>
            </View>
          </LinearGradient>
        </View>
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
    borderRadius: borderRadius.lg,
    padding: 1.5,
    marginBottom: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
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
  driverLabel: {
    fontSize: fontSize.xs,
    color: staticColors.textSecondary || '#6B7280',
    marginBottom: spacing.xs,
  },
  driverName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
    marginBottom: spacing.xs,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contactText: {
    fontSize: fontSize.sm,
    color: '#3B82F6',
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
