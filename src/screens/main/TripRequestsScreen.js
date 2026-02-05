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
import { get_withauth, put_withauth, buildImageUri } from '../../services/apiService';
import { approveOrRejectReservation } from '../../services/seatReservationService';

const TripRequestsScreen = ({ route }) => {
  const { tripId } = route.params || {};

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
      const response = await get_withauth('/trips/my-trips/driver');
      if (response.success && response.data.length > 0) {
        setTrips(response.data);
        if (response.data.length === 1) {
          setSelectedTripId(response.data[0]._id);
        }
      } else {
        setTrips([]);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar tus viajes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadRequests = async () => {
    if (!selectedTripId) return;

    setLoading(true);
    try {
      const response = await get_withauth(`/bookings/trip/${selectedTripId}`);
      if (response.success) {
        setRequests(response.data);
      }
    } catch (error) {
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
      `Aceptar ${request.seatsBooked || request.seatsRequested} asiento(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            try {
              if (isSeatReservation && seatReservationId) {
                const response = await approveOrRejectReservation(seatReservationId, 'approve');
                if (response.success) {
                  Alert.alert('Aprobado', 'El pasajero recibira una notificacion para completar el pago.', [
                    { text: 'OK', onPress: () => loadRequests() }
                  ]);
                }
              } else {
                const response = await put_withauth(`/bookings/${requestId}/confirm`);
                if (response.success) {
                  Alert.alert('Exito', 'Solicitud aceptada');
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
      Alert.alert('Error', 'Ingresa una razon para el rechazo');
      return;
    }

    try {
      const request = requests.find(r => (r._id || r.id) === selectedRequest);
      const isSeatReservation = request?.bookingType === 'seat_reservation';
      const seatReservationId = request?.seatReservation?._id || request?.seatReservation?.id;

      if (isSeatReservation && seatReservationId) {
        const response = await approveOrRejectReservation(seatReservationId, 'reject', rejectReason);
        if (response.success) {
          Alert.alert('Exito', 'Solicitud rechazada');
          setRejectModalVisible(false);
          setRejectReason('');
          setSelectedRequest(null);
          loadRequests();
        }
      } else {
        const response = await put_withauth(`/bookings/${selectedRequest}/reject`, {
          reason: rejectReason,
        });
        if (response.success) {
          Alert.alert('Exito', 'Solicitud rechazada');
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

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending_approval':
        return { color: '#F59E0B', bg: '#FEF3C7', text: 'Pendiente' };
      case 'pending_payment':
        return { color: '#F97316', bg: '#FFEDD5', text: 'Pago pendiente' };
      case 'reserved':
        return { color: '#10B981', bg: '#D1FAE5', text: 'Confirmada' };
      case 'pending':
        return { color: '#F59E0B', bg: '#FEF3C7', text: 'Pendiente' };
      case 'accepted':
      case 'confirmed':
        return { color: '#10B981', bg: '#D1FAE5', text: 'Aceptada' };
      case 'rejected':
        return { color: '#EF4444', bg: '#FEE2E2', text: 'Rechazada' };
      default:
        return { color: '#6B7280', bg: '#F3F4F6', text: status };
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { weekday: 'short', day: 'numeric', month: 'short' };
    return date.toLocaleDateString('es-ES', options);
  };

  const renderRequestItem = ({ item }) => {
    if (!item.passenger || !item.passenger._id) {
      return (
        <View style={styles.card}>
          <View style={styles.passengerSection}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.passengerName}>Usuario no disponible</Text>
          </View>
        </View>
      );
    }

    const avatarUrl = item.passenger?.avatar ? buildImageUri(item.passenger.avatar) : null;
    const reservationStatus = item.seatReservation?.reservationStatus || item.status;
    const statusConfig = getStatusConfig(reservationStatus);
    const isPending = reservationStatus === 'pending_approval' || reservationStatus === 'pending';

    return (
      <View style={styles.card}>
        {/* Passenger Info */}
        <View style={styles.passengerSection}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>
                {item.passenger?.firstName?.[0]}{item.passenger?.lastName?.[0]}
              </Text>
            </View>
          )}
          <View style={styles.passengerInfo}>
            <Text style={styles.passengerName}>
              {item.passenger?.firstName} {item.passenger?.lastName}
            </Text>
            {item.passenger?.city && (
              <Text style={styles.passengerLocation}>
                {item.passenger.city}, {item.passenger.province}
              </Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.text}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.detailsSection}>
          <View style={styles.detailItem}>
            <Ionicons name="people-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              {item.seatsBooked || item.seatsRequested} {(item.seatsBooked || item.seatsRequested) === 1 ? 'asiento' : 'asientos'}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              {formatDate(item.createdAt)}
            </Text>
          </View>
        </View>

        {/* Message */}
        {item.message && (
          <View style={styles.messageSection}>
            <Ionicons name="chatbubble-outline" size={14} color="#6B7280" />
            <Text style={styles.messageText}>{item.message}</Text>
          </View>
        )}

        {/* Actions */}
        {isPending && (
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAccept(item)}
            >
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.acceptButtonText}>Aceptar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => openRejectModal(item._id)}
            >
              <Ionicons name="close" size={18} color="#EF4444" />
              <Text style={styles.rejectButtonText}>Rechazar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Rejection Reason */}
        {item.status === 'rejected' && item.rejectionReason && (
          <View style={styles.rejectionSection}>
            <Text style={styles.rejectionText}>Razon: {item.rejectionReason}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderTripSelector = () => (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorTitle}>Selecciona un viaje</Text>
      <Text style={styles.selectorSubtitle}>
        Elige el viaje del cual quieres ver las solicitudes
      </Text>

      <FlatList
        data={trips}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.tripCard}
            onPress={() => setSelectedTripId(item._id)}
          >
            <View style={styles.tripRoute}>
              <View style={styles.routeRow}>
                <View style={styles.routeDot} />
                <Text style={styles.routeCity}>{item.origin?.city}</Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, styles.routeDotDestination]} />
                <Text style={styles.routeCity}>{item.destination?.city}</Text>
              </View>
            </View>
            <View style={styles.tripMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                <Text style={styles.metaText}>{formatDate(item.departureDate)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color="#6B7280" />
                <Text style={styles.metaText}>{item.departureTime}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.tripList}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
              tintColor="#000000"
            />
          }
        />
      ) : selectedTripId ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="people-outline" size={48} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyTitle}>Sin solicitudes</Text>
          <Text style={styles.emptySubtitle}>
            Las solicitudes para este viaje apareceran aqui
          </Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="car-outline" size={48} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyTitle}>Sin viajes</Text>
          <Text style={styles.emptySubtitle}>
            Crea un viaje para recibir solicitudes
          </Text>
        </View>
      )}

      {/* Reject Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={rejectModalVisible}
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rechazar solicitud</Text>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>Indica la razon del rechazo:</Text>

            <TextInput
              style={styles.textArea}
              placeholder="Escribe la razon aqui..."
              placeholderTextColor="#9CA3AF"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleReject}
              >
                <Text style={styles.modalConfirmText}>Rechazar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  listContent: {
    padding: 16,
  },
  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  // Passenger
  passengerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  passengerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  passengerLocation: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Details
  detailsSection: {
    flexDirection: 'row',
    gap: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
  },
  // Message
  messageSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  // Actions
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  // Rejection
  rejectionSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  rejectionText: {
    fontSize: 13,
    color: '#991B1B',
    fontStyle: 'italic',
  },
  // Trip Selector
  selectorContainer: {
    flex: 1,
    padding: 16,
  },
  selectorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  selectorSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  tripList: {
    paddingBottom: 16,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tripRoute: {
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000000',
  },
  routeDotDestination: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#E5E7EB',
    marginLeft: 4,
    marginVertical: 4,
  },
  routeCity: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  tripMeta: {
    flexDirection: 'row',
    gap: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#000000',
    minHeight: 100,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default TripRequestsScreen;
