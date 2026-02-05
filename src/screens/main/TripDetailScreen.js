import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { get_public, get_withauth, post_withauth, buildImageUri } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { getPendingPaymentReservations } from '../../services/seatReservationService';
import NativeCheckout from '../../components/NativeCheckout';
import Toast from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';

const TripDetailScreen = ({ route, navigation }) => {
  const { tripId } = route.params;
  const { user } = useAuth();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userBooking, setUserBooking] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  useEffect(() => {
    loadTripDetail();
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
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const loadTripDetail = async () => {
    try {
      const response = await get_public(ENDPOINTS.GET_TRIP(tripId));
      if (response.success) {
        setTrip(response.data);
        await checkUserBooking();
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar el viaje');
    } finally {
      setLoading(false);
    }
  };

  const checkUserBooking = async () => {
    try {
      const response = await get_withauth('/bookings/my-bookings');
      if (response.success && response.data) {
        const existingBooking = response.data.find(booking => {
          const bookingTripId = booking.trip?._id || booking.trip;
          const activeStatuses = ['pending', 'confirmed', 'accepted', 'active', 'completed'];
          return bookingTripId === tripId && activeStatuses.includes(booking.status);
        });
        setUserBooking(existingBooking);
      }
    } catch (error) {
      setUserBooking(null);
    }
  };

  const handleBookTrip = () => {
    if (!trip || trip.availableSeats === 0) {
      Alert.alert('Error', 'No hay asientos disponibles');
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
        if (response.success && response.data) {
          updatedBooking = response.data.find(b => (b.trip?._id || b.trip) === tripId);
          if (updatedBooking) setUserBooking(updatedBooking);
        }
      } catch (err) {}

      const currentBooking = updatedBooking || userBooking;
      const seatReservation = currentBooking?.seatReservation;
      const reservationStatus = seatReservation?.reservationStatus || currentBooking?.paymentStatus;

      if (reservationStatus === 'pending_payment') {
        let paymentUrl = seatReservation?.reservationPayment?.paymentUrl ||
          seatReservation?.paymentUrl ||
          currentBooking?.paymentUrl;

        if (!paymentUrl) {
          const pendingResponse = await getPendingPaymentReservations();
          if (pendingResponse.success && pendingResponse.data?.pendingReservations) {
            const pending = pendingResponse.data.pendingReservations.find(
              r => r.trip?._id === tripId || r.trip?.id === tripId
            );
            if (pending) paymentUrl = pending.paymentUrl;
          }
        }

        if (paymentUrl) {
          await NativeCheckout.openCheckout(paymentUrl, {
            onPaymentSuccess: handlePaymentSuccess,
            onPaymentError: handlePaymentError
          });
        } else {
          Alert.alert('Error', 'No se encontro la URL de pago');
        }
      } else if (reservationStatus === 'pending_approval') {
        Alert.alert('Pendiente', 'Tu solicitud esta esperando aprobacion del conductor');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo procesar el pago');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    showToast('Pago completado', 'success');
    setTimeout(async () => {
      await checkUserBooking();
      await loadTripDetail();
    }, 1000);
  };

  const handlePaymentError = (error) => {
    showToast(error.message || 'Error al procesar el pago', 'error');
  };

  const handleCancelPendingReservation = async () => {
    Alert.alert('Cancelar reserva', 'Estas seguro?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Si, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            setPaymentLoading(true);
            const { cancelSeatReservation } = require('../../services/seatReservationService');
            const seatReservationId = userBooking.seatReservation?._id;
            if (seatReservationId) {
              await cancelSeatReservation(seatReservationId, 'Cancelado por el usuario');
            }
            await loadTripDetail();
          } catch (error) {
            Alert.alert('Error', 'No se pudo cancelar');
          } finally {
            setPaymentLoading(false);
          }
        }
      }
    ]);
  };

  const handleStartChat = async () => {
    try {
      const response = await post_withauth('/chat/conversation', {
        participantId: trip.driver._id,
        tripId: trip._id
      });
      if (response.success) {
        navigation.navigate('ChatsTab', {
          screen: 'ChatDetail',
          params: {
            conversation: response.data,
            otherUser: response.data.participants?.find(p => p._id !== user._id)
          }
        });
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo iniciar el chat');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text style={styles.emptyText}>Viaje no encontrado</Text>
      </View>
    );
  }

  const userId = user?._id || user?.id;
  const driverId = trip.driver?._id || trip.driver?.id;
  const isOwnTrip = userId && driverId && userId === driverId;
  const driver = trip.driver;

  const getStatusConfig = (status) => {
    switch (status) {
      case 'started': return { color: '#3B82F6', bg: '#DBEAFE', text: 'En curso' };
      case 'completed': return { color: '#10B981', bg: '#D1FAE5', text: 'Finalizado' };
      case 'cancelled': return { color: '#EF4444', bg: '#FEE2E2', text: 'Cancelado' };
      case 'active': return { color: '#6B7280', bg: '#F3F4F6', text: 'Programado' };
      default: return { color: '#6B7280', bg: '#F3F4F6', text: status };
    }
  };

  const statusConfig = getStatusConfig(trip.status);

  return (
    <View style={styles.container}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Status Badge */}
        {trip.status && trip.status !== 'active' && (
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.text}
            </Text>
          </View>
        )}

        {/* Route */}
        <View style={styles.routeSection}>
          <View style={styles.routeRow}>
            <View style={styles.routeDot} />
            <View style={styles.routeContent}>
              <Text style={styles.routeTime}>{trip.departureTime}</Text>
              <Text style={styles.routeCity}>{trip.origin?.city}</Text>
              <Text style={styles.routeAddress}>{trip.origin?.address}</Text>
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, styles.routeDotDestination]} />
            <View style={styles.routeContent}>
              <Text style={styles.routeCity}>{trip.destination?.city}</Text>
              <Text style={styles.routeAddress}>{trip.destination?.address}</Text>
            </View>
          </View>
        </View>

        {/* Date & Seats */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={18} color="#6B7280" />
            <Text style={styles.infoText}>{formatDate(trip.departureDate)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="person-outline" size={18} color="#6B7280" />
            <Text style={styles.infoText}>{trip.availableSeats} asientos</Text>
          </View>
        </View>

        {/* Actual Cost */}
        {(trip.status === 'started' || trip.status === 'completed') && trip.actualCost > 0 && (
          <View style={styles.costBanner}>
            <Ionicons name="cash-outline" size={20} color="#10B981" />
            <Text style={styles.costLabel}>Costo final</Text>
            <Text style={styles.costValue}>${formatNumber(trip.actualCost)}</Text>
          </View>
        )}

        {/* Driver */}
        <TouchableOpacity
          style={styles.driverSection}
          onPress={!isOwnTrip ? handleStartChat : undefined}
          activeOpacity={isOwnTrip ? 1 : 0.7}
        >
          {driver?.avatar ? (
            <Image source={{ uri: buildImageUri(driver.avatar) }} style={styles.driverAvatar} />
          ) : (
            <View style={styles.driverAvatarPlaceholder}>
              <Text style={styles.driverInitials}>
                {driver?.firstName?.[0]}{driver?.lastName?.[0]}
              </Text>
            </View>
          )}
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>
              {driver?.firstName} {driver?.lastName}
            </Text>
            <Text style={styles.driverLabel}>Conductor</Text>
          </View>
          {!isOwnTrip && (
            <Ionicons name="chatbubble-outline" size={22} color="#6B7280" />
          )}
        </TouchableOpacity>

        {/* Vehicle */}
        {trip.vehicle && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehiculo</Text>
            <View style={styles.vehicleInfo}>
              <Ionicons name="car-outline" size={20} color="#374151" />
              <Text style={styles.vehicleText}>
                {trip.vehicle.brand} {trip.vehicle.model} · {trip.vehicle.color}
              </Text>
            </View>
          </View>
        )}

        {/* Features */}
        {trip.vehicle?.features && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Caracteristicas</Text>
            <View style={styles.featuresGrid}>
              {trip.vehicle.features.ac && (
                <View style={styles.featureItem}>
                  <Ionicons name="snow-outline" size={18} color="#374151" />
                  <Text style={styles.featureText}>Aire</Text>
                </View>
              )}
              {trip.vehicle.features.music && (
                <View style={styles.featureItem}>
                  <Ionicons name="musical-notes-outline" size={18} color="#374151" />
                  <Text style={styles.featureText}>Musica</Text>
                </View>
              )}
              {trip.vehicle.features.pets && (
                <View style={styles.featureItem}>
                  <Ionicons name="paw-outline" size={18} color="#374151" />
                  <Text style={styles.featureText}>Mascotas</Text>
                </View>
              )}
              {trip.vehicle.features.luggage && (
                <View style={styles.featureItem}>
                  <Ionicons name="bag-handle-outline" size={18} color="#374151" />
                  <Text style={styles.featureText}>Equipaje</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Rules */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reglas del viaje</Text>
          <View style={styles.rulesContainer}>
            <View style={styles.ruleItem}>
              <Ionicons
                name={trip.rules?.smokingAllowed ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={trip.rules?.smokingAllowed ? '#10B981' : '#EF4444'}
              />
              <Text style={styles.ruleText}>
                {trip.rules?.smokingAllowed ? 'Se puede fumar' : 'No fumar'}
              </Text>
            </View>
            <View style={styles.ruleItem}>
              <Ionicons
                name={trip.rules?.petsAllowed ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={trip.rules?.petsAllowed ? '#10B981' : '#EF4444'}
              />
              <Text style={styles.ruleText}>
                {trip.rules?.petsAllowed ? 'Mascotas permitidas' : 'Sin mascotas'}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {trip.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notas</Text>
            <Text style={styles.notesText}>{trip.notes}</Text>
          </View>
        )}

        <View style={{ height: 180 }} />
      </ScrollView>

      {/* Footer */}
      {!isOwnTrip && (
        <View style={styles.footer}>
          {userBooking ? (
            (userBooking.seatReservation?.reservationStatus === 'pending_payment' ||
              userBooking.paymentStatus === 'pending_payment') ? (
              <View style={styles.pendingContainer}>
                <View style={styles.pendingHeader}>
                  <View style={styles.pendingIndicator}>
                    <View style={styles.pendingDot} />
                    <Text style={styles.pendingText}>Pago pendiente</Text>
                  </View>
                  <TouchableOpacity onPress={handleCancelPendingReservation}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.payButton}
                  onPress={handleCompletePendingPayment}
                  disabled={paymentLoading}
                >
                  {paymentLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.payButtonText}>Completar pago</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.confirmedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.confirmedText}>Reserva confirmada</Text>
              </View>
            )
          ) : (
            <TouchableOpacity
              style={[styles.bookButton, trip.availableSeats === 0 && styles.bookButtonDisabled]}
              onPress={handleBookTrip}
              disabled={trip.availableSeats === 0}
            >
              <Text style={styles.bookButtonText}>
                {trip.availableSeats === 0 ? 'Sin asientos' : 'Reservar'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  // Status
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Route
  routeSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000000',
    marginTop: 4,
    marginRight: 16,
  },
  routeDotDestination: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },
  routeLine: {
    width: 2,
    height: 32,
    backgroundColor: '#E5E7EB',
    marginLeft: 5,
    marginVertical: 4,
  },
  routeContent: {
    flex: 1,
  },
  routeTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  routeCity: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  routeAddress: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  // Info Row
  infoRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 15,
    color: '#374151',
  },
  // Cost
  costBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    gap: 12,
  },
  costLabel: {
    fontSize: 14,
    color: '#065F46',
    flex: 1,
  },
  costValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  // Driver
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  driverAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInitials: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  driverInfo: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  driverLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  // Sections
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  // Vehicle
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vehicleText: {
    fontSize: 15,
    color: '#374151',
  },
  // Features
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
  },
  // Rules
  rulesContainer: {
    gap: 12,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ruleText: {
    fontSize: 15,
    color: '#374151',
  },
  // Notes
  notesText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  bookButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Pending Payment
  pendingContainer: {
    gap: 12,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  pendingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400E',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#EF4444',
  },
  payButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Confirmed
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  confirmedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065F46',
  },
});

export default TripDetailScreen;
