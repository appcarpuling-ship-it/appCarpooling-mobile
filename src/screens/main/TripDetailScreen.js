import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { get_public, get_withauth, post_withauth, buildImageUri } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { getPendingPaymentReservations } from '../../services/seatReservationService';
import NativeCheckout from '../../components/NativeCheckout';
import Toast from '../../components/Toast';
import { useColors } from '../../hooks/useColors';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';

const TripDetailScreen = ({ route, navigation }) => {
  const { tripId } = route.params;
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { colors, getCurrentThemeMode } = useColors();
  
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userBooking, setUserBooking] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

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
      showAlert('Error', 'No se pudo cargar el viaje');
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
          showAlert('Error', 'No se encontro la URL de pago');
        }
      } else if (reservationStatus === 'pending_approval') {
        showAlert('Pendiente', 'Tu solicitud esta esperando aprobacion del conductor');
      }
    } catch (error) {
      showAlert('Error', 'No se pudo procesar el pago');
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
    showAlert('Cancelar reserva', 'Estas seguro?', [
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
            showAlert('Error', 'No se pudo cancelar');
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
      showAlert('Error', 'No se pudo iniciar el chat');
    }
  };

  const handleImagePress = (imageUri) => {
    setSelectedImage(imageUri);
    setImageModalVisible(true);
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={getCurrentThemeMode() === 'dark' ? '#FFFFFF' : '#000000'} />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.textPrimary }]}>Viaje no encontrado</Text>
      </View>
    );
  }

  const userId = user?._id || user?.id;
  const driverId = trip.driver?._id || trip.driver?.id;
  const isOwnTrip = userId && driverId && userId === driverId;
  const driver = trip.driver;

  const getStatusConfig = (status) => {
    switch (status) {
      case 'started': return { color: colors.info, bg: colors.info + '20', text: 'En curso' };
      case 'completed': return { color: colors.success, bg: colors.success + '20', text: 'Finalizado' };
      case 'cancelled': return { color: colors.error, bg: colors.error + '20', text: 'Cancelado' };
      case 'active': return { color: colors.textMuted, bg: colors.border, text: 'Programado' };
      default: return { color: colors.textMuted, bg: colors.border, text: status };
    }
  };

  const statusConfig = getStatusConfig(trip.status);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <View style={[styles.routeSection, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
            <View style={styles.routeContent}>
              <Text style={[styles.routeCity, { color: colors.textPrimary }]}>{trip.origin?.address}</Text>
            </View>
          </View>
          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
          
          {/* Paradas Intermedias */}
          {trip.intermediateStops && trip.intermediateStops.length > 0 && 
            trip.intermediateStops
              .sort((a, b) => a.order - b.order)
              .map((stop, index) => (
                <React.Fragment key={`stop-${index}`}>
                  <View style={styles.routeRow}>
                    <View style={[styles.routeDotIntermediate, { backgroundColor: colors.textMuted }]}>
                      <Text style={styles.routeDotNumber}>{stop.order}</Text>
                    </View>
                    <View style={styles.routeContent}>
                      <Text style={[styles.routeCityIntermediate, { color: colors.textSecondary }]}>
                        Parada {stop.order}: {stop.address}, {stop.city}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
                </React.Fragment>
              ))
          }
          
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, styles.routeDotDestination, { backgroundColor: colors.background, borderColor: colors.error }]} />
            <View style={styles.routeContent}>
              <Text style={[styles.routeCity, { color: colors.textPrimary }]}>{trip.destination?.address}</Text>
            </View>
          </View>
        </View>

        {/* Date & Seats */}
        <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>{formatDate(trip.departureDate)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>{trip.departureTime} Hs</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>{trip.availableSeats} asientos</Text>
          </View>
        </View>

        {/* Actual Cost */}
        {(trip.status === 'started' || trip.status === 'completed') && trip.actualCost > 0 && (
          <View style={[styles.costBanner, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="cash-outline" size={20} color={colors.success} />
            <Text style={[styles.costLabel, { color: colors.success }]}>Costo final</Text>
            <Text style={[styles.costValue, { color: colors.success }]}>${formatNumber(trip.actualCost)}</Text>
          </View>
        )}

        {/* Driver */}
        <TouchableOpacity
          style={[styles.driverSection, { borderBottomColor: colors.border }]}
          // onPress={!isOwnTrip ? handleStartChat : undefined}
          activeOpacity={isOwnTrip ? 1 : 0.7}
        >
          {driver?.avatar ? (
            <Image source={{ uri: buildImageUri(driver.avatar) }} style={styles.driverAvatar} />
          ) : (
            <View style={[styles.driverAvatarPlaceholder, { backgroundColor: '#292929' }]}>
              <Text style={[styles.driverInitials, { color: colors.textPrimary }]}>
                {driver?.firstName?.[0]}{driver?.lastName?.[0]}
              </Text>
            </View>
          )}
          <View style={styles.driverInfo}>
            <Text style={[styles.driverName, { color: colors.textPrimary }]}>
              {driver?.firstName} {driver?.lastName}
            </Text>
            <Text style={[styles.driverLabel, { color: colors.textSecondary }]}>Conductor</Text>
          </View>
          {/* {!isOwnTrip && (
            <Ionicons name="chatbubble-outline" size={22} color={colors.textMuted} />
          )} */}
        </TouchableOpacity>

        {/* Vehicle */}
        {trip.vehicle && (() => {
          const vehicleImage = trip.vehicle.photo || (trip.vehicle.photos && trip.vehicle.photos[0]);
          return (
            <View style={[styles.section, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Vehiculo</Text>
              <View style={styles.vehicleContainer}>
                {vehicleImage ? (
                  <Image 
                    source={{ uri: buildImageUri(vehicleImage) }} 
                    style={styles.vehicleImage}
                  />
                ) : (
                  <View style={[styles.vehicleImagePlaceholder, { backgroundColor: '#292929' }]}>
                    <Ionicons name="car-outline" size={48} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.vehicleDetails}>
                  <Text style={[styles.vehicleText, { color: colors.textPrimary }]}>
                    {trip.vehicle.brand} {trip.vehicle.model}
                  </Text>
                  <Text style={[styles.vehicleColor, { color: colors.textSecondary }]}>{trip.vehicle.color}</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* Features */}
        {trip.vehicle?.features && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Caracteristicas</Text>
            <View style={styles.featuresGrid}>
              {trip.vehicle.features.ac && (
                <View style={styles.featureItem}>
                  <Ionicons name="snow-outline" size={18} color={colors.textSecondary} />
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>Aire</Text>
                </View>
              )}
              {trip.vehicle.features.music && (
                <View style={styles.featureItem}>
                  <Ionicons name="musical-notes-outline" size={18} color={colors.textSecondary} />
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>Musica</Text>
                </View>
              )}
              {trip.vehicle.features.pets && (
                <View style={styles.featureItem}>
                  <Ionicons name="paw-outline" size={18} color={colors.textSecondary} />
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>Mascotas</Text>
                </View>
              )}
              {trip.vehicle.features.luggage && (
                <View style={styles.featureItem}>
                  <Ionicons name="bag-handle-outline" size={18} color={colors.textSecondary} />
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>Equipaje</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Rules */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Reglas del viaje</Text>
          <View style={styles.rulesContainer}>
            <View style={styles.ruleItem}>
              <Ionicons
                name={trip.rules?.smokingAllowed ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={trip.rules?.smokingAllowed ? colors.success : colors.error}
              />
              <Text style={[styles.ruleText, { color: colors.textSecondary }]}>
                {trip.rules?.smokingAllowed ? 'Se puede fumar' : 'No fumar'}
              </Text>
            </View>
            <View style={styles.ruleItem}>
              <Ionicons
                name={trip.rules?.petsAllowed ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={trip.rules?.petsAllowed ? colors.success : colors.error}
              />
              <Text style={[styles.ruleText, { color: colors.textSecondary }]}>
                {trip.rules?.petsAllowed ? 'Mascotas permitidas' : 'Sin mascotas'}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {trip.notes && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Notas</Text>
            <Text style={[styles.notesText, { color: colors.textSecondary }]}>{trip.notes}</Text>
          </View>
        )}

        <View style={{ height: 180 }} />
      </ScrollView>

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setImageModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.imageModalContent}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setImageModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              {selectedImage && (
                <Image 
                  source={{ uri: selectedImage }} 
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Footer */}
      {!isOwnTrip && (
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {userBooking ? (
            (userBooking.seatReservation?.reservationStatus === 'pending_payment' ||
              userBooking.paymentStatus === 'pending_payment') ? (
              <View style={styles.pendingContainer}>
                <View style={styles.pendingHeader}>
                  <View style={styles.pendingIndicator}>
                    <View style={[styles.pendingDot, { backgroundColor: colors.warning }]} />
                    <Text style={[styles.pendingText, { color: colors.warning }]}>Pago pendiente</Text>
                  </View>
                  <TouchableOpacity onPress={handleCancelPendingReservation}>
                    <Text style={[styles.cancelText, { color: colors.error }]}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[
                    styles.payButton, 
                    { 
                      backgroundColor: getCurrentThemeMode() === 'dark' ? '#FFFFFF' : '#000000'
                    }
                  ]}
                  onPress={handleCompletePendingPayment}
                  disabled={paymentLoading}
                >
                  {paymentLoading ? (
                    <ActivityIndicator 
                      size="small" 
                      color={getCurrentThemeMode() === 'dark' ? '#000000' : '#FFFFFF'} 
                    />
                  ) : (
                    <Text style={[
                      styles.payButtonText, 
                      { 
                        color: getCurrentThemeMode() === 'dark' ? '#000000' : '#FFFFFF'
                      }
                    ]}>
                      Completar pago
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.confirmedBadge, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={[styles.confirmedText, { color: colors.success }]}>Reserva confirmada</Text>
              </View>
            )
          ) : (
            <TouchableOpacity
              style={[
                styles.bookButton, 
                { 
                  backgroundColor: trip.availableSeats === 0 
                    ? colors.textMuted 
                    : (getCurrentThemeMode() === 'dark' ? '#FFFFFF' : '#000000')
                }
              ]}
              onPress={handleBookTrip}
              disabled={trip.availableSeats === 0}
            >
              <Text style={[
                styles.bookButtonText, 
                { 
                  color: trip.availableSeats === 0 
                    ? colors.textPrimary 
                    : (getCurrentThemeMode() === 'dark' ? '#000000' : '#FFFFFF')
                }
              ]}>
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
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
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
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 16,
  },
  routeDotDestination: {
    borderWidth: 2,
  },
  // Paradas intermedias
  routeDotIntermediate: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    marginTop: 2,
  },
  routeDotNumber: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  routeCityIntermediate: {
    fontSize: 15,
    fontWeight: '500',
  },
  routeLine: {
    width: 2,
    height: 32,
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
  },
  routeAddress: {
    fontSize: 14,
    marginTop: 2,
  },
  // Info Row
  infoRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 24,
    borderBottomWidth: 1,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 15,
  },
  // Cost
  costBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  costLabel: {
    fontSize: 14,
    flex: 1,
  },
  costValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Driver
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  driverAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  driverAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInitials: {
    fontSize: 18,
    fontWeight: '600',
  },
  driverInfo: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
  },
  driverLabel: {
    fontSize: 14,
    marginTop: 2,
  },
  // Sections
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
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
  vehicleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vehicleImage: {
    width: 96,
    height: 72,
    borderRadius: 8,
  },
  vehicleImagePlaceholder: {
    width: 96,
    height: 72,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  vehicleColor: {
    fontSize: 14,
    marginTop: 2,
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
  },
  // Notes
  notesText: {
    fontSize: 15,
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
    borderTopWidth: 1,
  },
  bookButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    // removed - handled inline
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
  },
  pendingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  payButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Confirmed
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  confirmedText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Image Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    position: 'relative',
    width: '95%',
    height: '80%',
    backgroundColor: 'transparent',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
});

export default TripDetailScreen;
