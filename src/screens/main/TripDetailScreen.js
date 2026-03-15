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
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { get_public, get_withauth, post_withauth, put_withauth, buildImageUri } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { getPendingPaymentReservations, confirmFromCallback } from '../../services/seatReservationService';
import CheckoutWebView from '../../components/CheckoutWebView';
import RebillPaymentOptions from '../../components/RebillPaymentOptions';
import Toast from '../../components/Toast';
import { useColors } from '../../hooks/useColors';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';

const TripDetailScreen = ({ route, navigation }) => {
  const { tripId } = route.params;
  const { user, refreshUser } = useAuth();
  const { showAlert } = useAlert();
  const { colors, getCurrentThemeMode, isDarkMode } = useColors();

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userBooking, setUserBooking] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentModalData, setPaymentModalData] = useState({ paymentUrl: null, qrDataUrl: null, amount: null });
  const [checkoutWebViewVisible, setCheckoutWebViewVisible] = useState(false);
  const [checkoutWebViewUrl, setCheckoutWebViewUrl] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [actualCost, setActualCost] = useState('');
  const [startingTrip, setStartingTrip] = useState(false);
  const [passengers, setPassengers] = useState([]);

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
        const userId = user?._id || user?.id;
        const driverId = response.data.driver?._id || response.data.driver?.id;
        if (userId && driverId && userId === driverId) {
          await loadPassengers();
        } else {
          await checkUserBooking();
        }
      }
    } catch (error) {
      showAlert('Error', 'No se pudo cargar el viaje');
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
      const response = await get_withauth('/bookings/my-bookings');
      const bookings = response?.data || [];
      if (response?.success && Array.isArray(bookings)) {
        const tid = String(tripId || '');
        const existingBooking = bookings.find(booking => {
          const bt = booking.trip?._id || booking.trip;
          const bookingTripId = bt ? String(bt) : '';
          const activeStatuses = ['pending', 'confirmed', 'accepted', 'active', 'completed', 'cancelled'];
          return bookingTripId === tid && activeStatuses.includes(booking.status);
        });
        setUserBooking(existingBooking || null);
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
        const bookings = response?.data || [];
        if (response?.success && Array.isArray(bookings)) {
          const tid = String(tripId || '');
          updatedBooking = bookings.find(b => String(b.trip?._id || b.trip || '') === tid);
          if (updatedBooking) setUserBooking(updatedBooking);
        }
      } catch (err) { }

      const currentBooking = updatedBooking || userBooking;
      const seatReservation = currentBooking?.seatReservation;
      const reservationStatus = seatReservation?.reservationStatus;

      if (reservationStatus === 'pending_approval') {
        showAlert('Pendiente', 'Tu solicitud está esperando aprobación del conductor');
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

        if (paymentUrl || qrDataUrl) {
          setPaymentModalData({ paymentUrl, qrDataUrl, amount });
          setPaymentModalVisible(true);
        } else {
          showAlert('Error', 'No se puede realizar el pago para este viaje. Por favor, contacta al soporte.');
        }
      }
    } catch (error) {
      showAlert('Error', 'No se pudo procesar el pago');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentData) => {
    showToast('Pago completado - Actualizando...', 'success');
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
        (e?.response?.data?.message || e?.message || 'No se pudo confirmar. El pago puede estar procesándose.') + '\n\n¿Reintentar?',
        [
          { text: 'Cerrar', style: 'cancel' },
          { text: 'Reintentar', onPress: async () => { await checkUserBooking(); await loadTripDetail(); } }
        ]
      );
    }
    await checkUserBooking();
    await loadTripDetail();
    if (confirmOk) showToast('Reserva confirmada', 'success');
    setTimeout(async () => {
      await checkUserBooking();
      await loadTripDetail();
    }, 2500);
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

  const handleChatWithPassenger = async (passengerId) => {
    try {
      const response = await post_withauth('/chat/conversation', {
        participantId: passengerId,
        tripId: trip._id,
      });
      if (response.success) {
        navigation.navigate('ChatsTab', {
          screen: 'ChatDetail',
          params: {
            conversation: response.data,
            otherUser: response.data.participants?.find(p => p._id !== (user?._id || user?.id)),
          },
        });
      }
    } catch (_) {
      showAlert('Error', 'No se pudo iniciar el chat');
    }
  };

  const handleImagePress = (imageUri) => {
    setSelectedImage(imageUri);
    setImageModalVisible(true);
  };

  const handleStartTrip = () => {
    showAlert(
      'Iniciar Viaje',
      'Los pasajeros seran notificados.',
      [
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
                showAlert('Error', response.message || 'No se pudo iniciar el viaje');
              }
            } catch (error) {
              showAlert('Error', error.message || 'Error al iniciar el viaje');
            } finally {
              setStartingTrip(false);
            }
          },
        },
      ]
    );
  };

  const handleCompleteTrip = () => {
    setActualCost('');
    setShowCostModal(true);
  };

  const submitCompleteTrip = async () => {
    const cost = parseFloat(actualCost);
    if (!actualCost || isNaN(cost) || cost <= 0) {
      showAlert('Error', 'Ingresa un costo valido mayor a 0');
      return;
    }
    try {
      const response = await put_withauth(ENDPOINTS.COMPLETE_TRIP(tripId), { actualCost: cost });
      if (response.success) {
        setShowCostModal(false);
        showAlert('Viaje Completado', `Costo final: $${cost.toFixed(2)}`);
        await loadTripDetail();
        await refreshUser();
      } else {
        showAlert('Error', response.message || 'No se pudo completar el viaje');
      }
    } catch (error) {
      showAlert('Error', error.message || 'Error al completar el viaje');
    }
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
      case 'started': return { color: colors.info, bg: colors.info + '20', text: 'Viaje iniciado' };
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
              <Text style={[styles.routeAddress, { color: colors.textPrimary }]}>
                {trip.origin?.address}
              </Text>
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
                      <Text style={[styles.routeAddress, { color: colors.textSecondary }]}>
                        Parada {stop.order}: {stop.address}
                      </Text>
                      <Text style={[styles.routeCityIntermediate, { color: colors.textTertiary }]}>
                        {stop.city}, {stop.province}
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
              <Text style={[styles.routeAddress, { color: colors.textPrimary }]}>
                {trip.destination?.address}
              </Text>
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

        {/* Pasajeros (solo conductor) */}
        {isOwnTrip && passengers.length > 0 && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              Pasajeros ({passengers.length})
            </Text>
            {passengers.map((booking) => {
              const p = booking.passenger;
              const avatarUrl = p?.avatar ? buildImageUri(p.avatar) : null;
              return (
                <TouchableOpacity
                  key={booking._id}
                  style={[styles.passengerRow, { borderColor: colors.border, backgroundColor: isDarkMode ? '#292929' : colors.cardBackground }]}
                  onPress={() => navigation.navigate('UserProfile', { userId: p?._id, tripId: trip._id })}
                  activeOpacity={0.7}
                >
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.passengerAvatar} />
                  ) : (
                    <View style={[styles.passengerAvatarPlaceholder, { backgroundColor: isDarkMode ? '#404040' : colors.surface }]}>
                      <Text style={[styles.passengerInitials, { color: colors.textPrimary }]}>
                        {p?.firstName?.[0]}{p?.lastName?.[0]}
                      </Text>
                    </View>
                  )}
                  <View style={styles.passengerInfo}>
                    <Text style={[styles.passengerName, { color: colors.textPrimary }]}>
                      {p?.firstName} {p?.lastName}
                    </Text>
                    <Text style={[styles.passengerSeats, { color: colors.textSecondary }]}>
                      {booking.seatsBooked || booking.seatsRequested || 1} asiento(s)
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.passengerChatBtn, { backgroundColor: isDarkMode ? '#404040' : colors.surface, borderColor: colors.border }]}
                    onPress={(e) => { e.stopPropagation(); handleChatWithPassenger(p?._id); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color={colors.textPrimary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 180 }} />
      </ScrollView>

      {/* Payment Options Modal (Checkout + QR) */}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.paymentModalOverlay}>
          <View style={[styles.paymentModalContent, { backgroundColor: colors.background }]}>
            <View style={styles.paymentModalHeader}>
              <Text style={[styles.paymentModalTitle, { color: colors.textPrimary }]}>Completar pago</Text>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
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
        onClose={() => {
          setCheckoutWebViewVisible(false);
          setCheckoutWebViewUrl(null);
        }}
        onPaymentSuccess={handlePaymentSuccess}
        onPaymentError={handlePaymentError}
      />

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

      {/* Footer conductor */}
      {isOwnTrip && (trip.status === 'active' || trip.status === 'started') && (
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {trip.status === 'active' && trip.occupiedSeats > 0 && (
            <TouchableOpacity
              style={[styles.bookButton, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }]}
              onPress={handleStartTrip}
              disabled={startingTrip}
            >
              <Text style={[styles.bookButtonText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>
                {startingTrip ? 'Iniciando...' : 'Iniciar Viaje'}
              </Text>
            </TouchableOpacity>
          )}
          {trip.status === 'started' && (
            <TouchableOpacity
              style={[styles.bookButton, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }]}
              onPress={handleCompleteTrip}
            >
              <Text style={[styles.bookButtonText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>
                Completar Viaje
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Modal costo */}
      <Modal
        visible={showCostModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCostModal(false)}
      >
        <View style={styles.costModalOverlay}>
          <View style={[styles.costModalContent, { backgroundColor: colors.cardBackground || colors.background }]}>
            <Text style={[styles.costModalTitle, { color: colors.textPrimary }]}>Completar Viaje</Text>
            <Text style={[styles.costModalSubtitle, { color: colors.textSecondary }]}>
              Ingresa el costo real del viaje
            </Text>
            <TextInput
              style={[styles.costInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: isDarkMode ? '#292929' : '#FFFFFF' }]}
              placeholder="Ej: 1500"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={actualCost}
              onChangeText={setActualCost}
              autoFocus
            />
            <View style={styles.costModalActions}>
              <TouchableOpacity
                style={[styles.costModalCancel, { borderColor: colors.border }]}
                onPress={() => setShowCostModal(false)}
              >
                <Text style={[styles.costModalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.costModalConfirm, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }]}
                onPress={submitCompleteTrip}
              >
                <Text style={[styles.costModalConfirmText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>Completar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Footer pasajero */}
      {!isOwnTrip && (
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {userBooking ? (
            (userBooking.seatReservation?.reservationStatus === 'cancelled' || userBooking.status === 'cancelled') ? (
              <View style={[styles.confirmedBadge, { backgroundColor: colors.textMuted + '20' }]}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                <Text style={[styles.confirmedText, { color: colors.textMuted }]}>Reserva cancelada</Text>
              </View>
            ) : userBooking.seatReservation?.reservationStatus === 'pending_approval' ? (
              <View style={[styles.confirmedBadge, { backgroundColor: (colors.warning || '#F59E0B') + '20' }]}>
                <Ionicons name="time-outline" size={20} color={colors.warning || '#F59E0B'} />
                <Text style={[styles.confirmedText, { color: colors.warning || '#F59E0B' }]}>Esperando aprobación del conductor</Text>
              </View>
            ) : userBooking.seatReservation?.reservationStatus === 'pending_payment' ? (
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
                <Text style={[styles.confirmedText, { color: colors.success }]}>Reserva paga</Text>
              </View>
            )
          ) : (
            <TouchableOpacity
              style={[
                styles.bookButton,
                {
                  backgroundColor: trip.availableSeats === 0
                    ? colors.textMuted
                    : (isDarkMode ? '#FFFFFF' : '#000000')
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
                    : (isDarkMode ? '#000000' : '#FFFFFF')
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
  // Passengers
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  passengerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  passengerAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerInitials: {
    fontSize: 16,
    fontWeight: '600',
  },
  passengerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  passengerName: {
    fontSize: 15,
    fontWeight: '600',
  },
  passengerSeats: {
    fontSize: 13,
    marginTop: 2,
  },
  passengerChatBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerPaidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  passengerPaidText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Cost Modal
  costModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  costModalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  costModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  costModalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  costInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    marginBottom: 20,
  },
  costModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  costModalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  costModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  costModalConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  costModalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Image Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  paymentModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  paymentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  paymentModalTitle: {
    fontSize: 18,
    fontWeight: '600',
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
