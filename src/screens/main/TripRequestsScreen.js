import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { get_withauth, put_withauth, buildImageUri } from '../../services/apiService';
import { approveOrRejectReservation, getPendingApprovalReservations } from '../../services/seatReservationService';
import { Linking } from 'react-native';
import { colors as staticColors, gradients, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';
import { useNavigation } from '@react-navigation/native';

const TripRequestsScreen = ({ route }) => {
  const { colors, gradients, createColorArray } = useColors();
  // Fallbacks para gradientes
  const safeGradients = {
    card: Array.isArray(gradients?.card) && gradients.card.length > 0 ? gradients.card : ['#FFFFFF', '#F8F9FA'],
    primary: ['#1F2937', '#111827'],
    dark: Array.isArray(gradients?.dark) && gradients.dark.length > 0 ? gradients.dark : ['#F8F9FA', '#E5E7EB'],
  };
  const { tripId } = route.params || {};
  const navigation = useNavigation();

  // Si no hay tripId específico, mostrar selector de viajes
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(tripId);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (selectedTripId) {
      loadRequests();
    } else {
      loadUserTrips();
    }
  }, [selectedTripId]);

  const loadUserTrips = async () => {
    try {
      console.log('🚗 [TripRequests] Cargando viajes del usuario...');
      const response = await get_withauth('/trips/my-trips/driver');
      if (response.success && response.data.length > 0) {
        setTrips(response.data);
        // Seleccionar automáticamente el primer viaje si hay solo uno
        if (response.data.length === 1) {
          setSelectedTripId(response.data[0]._id);
        }
      } else {
        setTrips([]);
      }
    } catch (error) {
      console.error('❌ [TripRequests] Error cargando viajes:', error);
      Alert.alert('Error', 'No se pudieron cargar tus viajes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadRequests = async () => {
    if (!selectedTripId) {
      console.warn('⚠️ [TripRequests] No hay tripId seleccionado');
      return;
    }

    setLoading(true);
    try {
      console.log('📋 [TripRequests] Cargando solicitudes para viaje:', selectedTripId);
      const response = await get_withauth(`/bookings/trip/${selectedTripId}`);
      if (response.success) {
        setRequests(response.data);
        console.log('✅ [TripRequests] Solicitudes cargadas:', response.data.length);
      }
    } catch (error) {
      console.error('❌ [TripRequests] Error cargando solicitudes:', error);
      Alert.alert('Error', 'No se pudieron cargar las solicitudes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (selectedTripId) {
      loadRequests();
    } else {
      loadUserTrips();
    }
  };

  const handleAccept = async (request) => {
    const requestId = request._id || request.id;
    const isSeatReservation = request.bookingType === 'seat_reservation';
    const seatReservationId = request.seatReservation?._id || request.seatReservation?.id;

    Alert.alert(
      'Aceptar Solicitud',
      `¿Estás seguro de aceptar esta solicitud de ${request.seatsBooked || request.seatsRequested} asiento(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            try {
              if (isSeatReservation && seatReservationId) {
                // Reserva de asiento: usar el nuevo endpoint
                const response = await approveOrRejectReservation(seatReservationId, 'approve');
                if (response.success) {
                  Alert.alert(
                    '✅ Solicitud Aprobada',
                    'La reserva ha sido aprobada. El pasajero recibirá una notificación para completar el pago.',
                    [{ text: 'OK', onPress: () => loadRequests() }]
                  );
                }
              } else {
                // Reserva tradicional
                const response = await put_withauth(`/bookings/${requestId}/confirm`);
                if (response.success) {
                  Alert.alert('Éxito', 'Solicitud aceptada');
                  loadRequests();
                }
              }
            } catch (error) {
              Alert.alert('Error', error?.response?.data?.message || error.message);
            }
          },
        },
      ]
    );
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Error', 'Por favor ingresa una razón para el rechazo');
      return;
    }

    try {
      // Buscar la solicitud completa para determinar si es seat reservation
      const request = requests.find(r => (r._id || r.id) === selectedRequest);
      const isSeatReservation = request?.bookingType === 'seat_reservation';
      const seatReservationId = request?.seatReservation?._id || request?.seatReservation?.id;

      if (isSeatReservation && seatReservationId) {
        // Reserva de asiento: usar el nuevo endpoint
        const response = await approveOrRejectReservation(seatReservationId, 'reject', rejectReason);
        if (response.success) {
          Alert.alert('Éxito', 'Solicitud rechazada');
          setRejectModalVisible(false);
          setRejectReason('');
          setSelectedRequest(null);
          loadRequests();
        }
      } else {
        // Reserva tradicional
        const response = await put_withauth(`/bookings/${selectedRequest}/reject`, {
          reason: rejectReason,
        });

        if (response.success) {
          Alert.alert('Éxito', 'Solicitud rechazada');
          setRejectModalVisible(false);
          setRejectReason('');
          setSelectedRequest(null);
          loadRequests();
        }
      }
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || error.message);
    }
  };

  const openRejectModal = (requestId) => {
    setSelectedRequest(requestId);
    setRejectModalVisible(true);
  };

  const getStatusColor = (status) => {
    // Manejar estados de seat reservation
    if (status === 'pending_approval') return '#F59E0B';
    if (status === 'pending_payment') return '#F97316';
    if (status === 'reserved') return '#10B981';
    if (status === 'rejected') return colors.error;

    // Estados tradicionales
    switch (status) {
      case 'pending':
        return colors.warning || '#F59E0B';
      case 'accepted':
      case 'confirmed':
        return colors.success || '#10B981';
      case 'rejected':
        return colors.error || '#EF4444';
      default:
        return colors.textSecondary || '#6B7280';
    }
  };

  const getStatusText = (status, seatReservationStatus) => {
    // Priorizar estado de seat reservation si existe
    if (seatReservationStatus) {
      switch (seatReservationStatus) {
        case 'pending_approval':
          return 'Pendiente de Aprobación';
        case 'pending_payment':
          return 'Pendiente de Pago';
        case 'reserved':
          return 'Reserva Confirmada';
        case 'rejected':
          return 'Rechazada';
        default:
          return seatReservationStatus;
      }
    }

    // Estado tradicional
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'accepted':
      case 'confirmed':
        return 'Aceptada';
      case 'rejected':
        return 'Rechazada';
      default:
        return status;
    }
  };

  const renderRequestItem = ({ item }) => {
    // Validar que el pasajero exista
    if (!item.passenger || !item.passenger._id) {
      console.warn('⚠️ [TripRequests] Solicitud sin datos de pasajero:', item._id);
      return (
        <LinearGradient
          colors={safeGradients.card}
          style={styles.requestCard}
        >
          <View style={styles.cardBorder} />
          <View style={styles.userSection}>
            <LinearGradient
              colors={safeGradients.primary}
              style={styles.avatar}
            >
              <Ionicons name="person" size={32} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>Usuario no disponible</Text>
              <Text style={styles.infoText}>Los datos del usuario no están disponibles</Text>
            </View>
          </View>
          <View style={styles.detailsSection}>
            <View style={styles.statusContainer}>
              <LinearGradient
                colors={createColorArray(getStatusColor(item.status) + '20', getStatusColor(item.status) + '10')}
                style={styles.statusBadge}
              >
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                  {getStatusText(item.status)}
                </Text>
              </LinearGradient>
            </View>
          </View>
        </LinearGradient>
      );
    }

    const avatarUrl = item.passenger?.avatar
      ? buildImageUri(item.passenger.avatar)
      : null;

    return (
      <LinearGradient
        colors={gradients.card}
        style={styles.requestCard}
      >
        <View style={styles.cardBorder} />

        <View style={styles.userSection}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
              onError={() => console.log('Error loading passenger avatar from:', item.passenger.avatar)}
            />
          ) : (
            <LinearGradient
              colors={gradients.primary}
              style={styles.avatar}
            >
              <Ionicons name="person" size={32} color="#FFFFFF" />
            </LinearGradient>
          )}

          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {item.passenger?.firstName} {item.passenger?.lastName}
            </Text>

            {item.passenger?.age && (
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.infoText}>{item.passenger.age} años</Text>
              </View>
            )}

            {item.passenger?.city && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.infoText}>
                  {item.passenger.city}, {item.passenger.province}
                </Text>
              </View>
            )}

            {item.passenger?.tripsCompleted !== undefined && (
              <View style={styles.infoRow}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#1F2937" />
                <Text style={styles.infoText}>
                  {item.passenger.tripsCompleted} viajes completados
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.detailsSection}>
          <View style={styles.statusContainer}>
            <LinearGradient
              colors={createColorArray(getStatusColor(item.status) + '20', getStatusColor(item.status) + '10') || ['#F3F4F6', '#E5E7EB']}
              style={styles.statusBadge}
            >
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.seatReservation?.reservationStatus || item.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(item.seatReservation?.reservationStatus || item.status) }]}>
                {getStatusText(item.status, item.seatReservation?.reservationStatus)}
              </Text>
            </LinearGradient>
          </View>

          <View style={styles.seatsInfo}>
            <Ionicons name="people" size={16} color={colors.textSecondary} />
            <Text style={styles.seatsText}>
              {item.seatsBooked || item.seatsRequested} {(item.seatsBooked || item.seatsRequested) === 1 ? 'asiento' : 'asientos'}
            </Text>
          </View>

          {/* Mostrar estado de reserva de asiento si existe */}
          {item.seatReservation && (
            <View style={styles.seatReservationStatus}>
              <Ionicons
                name={
                  item.seatReservation.reservationStatus === 'pending_approval' ? 'time-outline' :
                    item.seatReservation.reservationStatus === 'pending_payment' ? 'card-outline' :
                      item.seatReservation.reservationStatus === 'reserved' ? 'checkmark-circle-outline' :
                        item.seatReservation.reservationStatus === 'rejected' ? 'close-circle-outline' :
                          'help-circle-outline'
                }
                size={14}
                color={
                  item.seatReservation.reservationStatus === 'pending_approval' ? '#F59E0B' :
                    item.seatReservation.reservationStatus === 'pending_payment' ? '#F97316' :
                      item.seatReservation.reservationStatus === 'reserved' ? '#10B981' :
                        item.seatReservation.reservationStatus === 'rejected' ? '#EF4444' :
                          '#6B7280'
                }
              />
              <Text style={[
                styles.seatReservationStatusText,
                {
                  color:
                    item.seatReservation.reservationStatus === 'pending_approval' ? '#F59E0B' :
                      item.seatReservation.reservationStatus === 'pending_payment' ? '#F97316' :
                        item.seatReservation.reservationStatus === 'reserved' ? '#10B981' :
                          item.seatReservation.reservationStatus === 'rejected' ? '#EF4444' :
                            '#6B7280'
                }
              ]}>
                {item.seatReservation.reservationStatus === 'pending_approval' ? 'Pendiente de Aprobación' :
                  item.seatReservation.reservationStatus === 'pending_payment' ? 'Pendiente de Pago' :
                    item.seatReservation.reservationStatus === 'reserved' ? 'Reserva Confirmada' :
                      item.seatReservation.reservationStatus === 'rejected' ? 'Rechazada' :
                        item.seatReservation.reservationStatus}
              </Text>
            </View>
          )}

          {item.message && (
            <View style={styles.messageContainer}>
              <Ionicons name="chatbubble-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.messageText}>{item.message}</Text>
            </View>
          )}

          <View style={styles.dateContainer}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.dateText}>
              Solicitado el {new Date(item.createdAt).toLocaleDateString('es-ES')}
            </Text>
          </View>
        </View>

        {(item.seatReservation
          ? item.seatReservation.reservationStatus === 'pending_approval'
          : item.status === 'pending'
        ) && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleAccept(item)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={createColorArray(colors.success + '30', colors.success + '20') || ['#10B981', '#059669']}
                style={styles.actionButtonGradient}
              >
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={[styles.actionButtonText, { color: colors.success }]}>
                  Aceptar
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => openRejectModal(item._id)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={createColorArray(colors.error + '30', colors.error + '20') || ['#EF4444', '#DC2626']}
                style={styles.actionButtonGradient}
              >
                <Ionicons name="close-circle" size={20} color={colors.error} />
                <Text style={[styles.actionButtonText, { color: colors.error }]}>
                  Rechazar
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'rejected' && item.rejectionReason && (
          <View style={styles.rejectionReasonContainer}>
            <Ionicons name="information-circle-outline" size={16} color={colors.error} />
            <Text style={styles.rejectionReasonText}>
              Razón: {item.rejectionReason}
            </Text>
          </View>
        )}
      </LinearGradient>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={safeGradients.dark} style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1F2937" />
      </LinearGradient>
    );
  }

  // Render trip selector when no trip is selected but trips are available
  const renderTripSelector = () => (
    <View style={styles.tripSelectorContainer}>
      <Text style={styles.selectorTitle}>Selecciona un viaje</Text>
      <Text style={styles.selectorSubtitle}>
        Elige el viaje del cual quieres ver las solicitudes
      </Text>

      <FlatList
        data={trips}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.tripSelectorCard}
            onPress={() => setSelectedTripId(item._id)}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={gradients.card}
              style={styles.tripSelectorGradient}
            >
              <View style={styles.tripRoute}>
                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, { backgroundColor: '#1F2937' }]} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {item.origin?.city || 'Ciudad origen'}
                  </Text>
                </View>

                <View style={styles.routeArrow}>
                  <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
                </View>

                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, { backgroundColor: colors.accent }]} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {item.destination?.city || 'Ciudad destino'}
                  </Text>
                </View>
              </View>

              <View style={styles.tripMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>
                    {new Date(item.departureDate).toLocaleDateString('es-ES')}
                  </Text>
                </View>

                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>
                    {item.departureTime}
                  </Text>
                </View>

                <View style={styles.metaItem}>
                  <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>
                    {item.availableSeats} asientos
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.tripSelectorList}
      />
    </View>
  );

  return (
    <LinearGradient colors={safeGradients.dark} style={styles.container}>
      {!selectedTripId && trips.length > 0 ? (
        renderTripSelector()
      ) : selectedTripId && requests.length > 0 ? (
        <FlatList
          data={requests}
          renderItem={renderRequestItem}
          keyExtractor={(item) => item._id}
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
      ) : selectedTripId && requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay solicitudes</Text>
          <Text style={styles.emptySubtext}>
            Las solicitudes para este viaje aparecerán aquí
          </Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <LinearGradient
            colors={safeGradients.primary}
            style={styles.emptyIconContainer}
          >
            <Ionicons name="car-outline" size={48} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.emptyText}>No tienes viajes</Text>
          <Text style={styles.emptySubtext}>
            Crea un viaje para recibir solicitudes de pasajeros
          </Text>
        </View>
      )}

      {/* Reject Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={rejectModalVisible}
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient colors={safeGradients.dark} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Rechazar Solicitud</Text>
                <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                  <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Por favor, indica la razón del rechazo:
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textArea}
                  placeholder="Escribe la razón aquí..."
                  placeholderTextColor={colors.placeholder}
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setRejectModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={createColorArray(colors.surface, colors.inputBackground) || ['#F3F4F6', '#E5E7EB']}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>
                      Cancelar
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={handleReject}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={safeGradients.primary}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>Confirmar Rechazo</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
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
  listContent: {
    padding: spacing.lg,
  },

  // Request Card
  requestCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // User Section
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
    marginBottom: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: '#6B7280',
  },

  // Details Section
  detailsSection: {
    gap: spacing.sm,
  },
  statusContainer: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
  },
  seatsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  seatsText: {
    fontSize: fontSize.md,
    color: '#000000',
    fontWeight: fontWeight.medium,
  },
  seatReservationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    padding: spacing.sm,
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.sm,
  },
  seatReservationStatusText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: '#F3F4F6',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  messageText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: '#6B7280',
    lineHeight: 20,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateText: {
    fontSize: fontSize.xs,
    color: '#9CA3AF',
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.xs,
  },
  actionButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
  },

  // Rejection Reason
  rejectionReasonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#EF4444' + '10',
    borderRadius: borderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  rejectionReasonText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: '#EF4444',
    fontStyle: 'italic',
  },

  // Empty State
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
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    width: '85%',
    maxHeight: '70%',
  },
  modalContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: '#000000',
  },
  modalSubtitle: {
    fontSize: fontSize.md,
    color: '#6B7280',
    marginBottom: spacing.md,
  },
  inputContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  textArea: {
    fontSize: fontSize.md,
    color: '#000000',
    minHeight: 100,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  modalButtonGradient: {
    padding: spacing.md,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: '#FFFFFF',
  },

  // Trip Selector
  tripSelectorContainer: {
    flex: 1,
    padding: spacing.lg,
  },
  selectorTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: '#000000',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  selectorSubtitle: {
    fontSize: fontSize.md,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  tripSelectorList: {
    paddingBottom: spacing.lg,
  },
  tripSelectorCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  tripSelectorGradient: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  tripRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  routePoint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeText: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: '#000000',
  },
  routeArrow: {
    paddingHorizontal: spacing.md,
  },
  tripMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: '#6B7280',
  },
});

export default TripRequestsScreen;
