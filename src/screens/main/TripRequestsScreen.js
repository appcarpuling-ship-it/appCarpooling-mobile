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
import { useColors } from '../../hooks/useColors';

const TripRequestsScreen = ({ route }) => {
  const { colors, getCurrentThemeMode } = useColors();
  const { tripId } = route.params || {};

  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(tripId);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingRequestId, setAcceptingRequestId] = useState(null);
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
            setAcceptingRequestId(requestId);
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
            } finally {
              setAcceptingRequestId(null);
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
      case 'pending':
        return { color: colors.warning, bg: colors.warning + '20', text: 'Pendiente' };
      case 'confirmed':
        return { color: colors.success, bg: colors.success + '20', text: 'Confirmado' };
      case 'cancelled':
        return { color: colors.error, bg: colors.error + '20', text: 'Cancelado' };
      case 'completed':
        return { color: colors.info, bg: colors.info + '20', text: 'Completado' };
      case 'pending_approval':
        return { color: colors.warning, bg: colors.warning + '20', text: 'Pendiente' };
      case 'pending_payment':
        return { color: colors.warning, bg: colors.warning + '20', text: 'Pago pendiente' };
      case 'reserved':
        return { color: colors.success, bg: colors.success + '20', text: 'Confirmada' };
      case 'accepted':
        return { color: colors.success, bg: colors.success + '20', text: 'Aceptada' };
      case 'rejected':
        return { color: colors.error, bg: colors.error + '20', text: 'Rechazada' };
      default:
        return { color: colors.textMuted, bg: colors.border, text: status };
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
      <View style={[styles.card, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.passengerSection}>
          <View style={[styles.avatarPlaceholder, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.surface }]}>
            <Ionicons name="person" size={24} color={colors.textPrimary} />
          </View>
          <Text style={[styles.passengerName, { color: colors.textPrimary }]}>Usuario no disponible</Text>
          </View>
        </View>
      );
    }

    const avatarUrl = item.passenger?.avatar ? buildImageUri(item.passenger.avatar) : null;
    const reservationStatus = item.seatReservation?.reservationStatus || item.status;
    const statusConfig = getStatusConfig(reservationStatus);
    const isPending = reservationStatus === 'pending_approval' || reservationStatus === 'pending';

    return (
      <View style={[styles.card, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, borderColor: colors.border }]}>
        {/* Passenger Info */}
        <View style={styles.passengerSection}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.surface }]}>
              <Text style={[styles.avatarInitials, { color: colors.textPrimary }]}>
                {item.passenger?.firstName?.[0]}{item.passenger?.lastName?.[0]}
              </Text>
            </View>
          )}
          <View style={styles.passengerInfo}>
            <Text style={[styles.passengerName, { color: colors.textPrimary }]}>
              {item.passenger?.firstName} {item.passenger?.lastName}
            </Text>
            {item.passenger?.city && (
              <Text style={[styles.passengerLocation, { color: colors.textSecondary }]}>
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
        <View style={[styles.detailsSection, { borderBottomColor: colors.border }]}>
          <View style={styles.detailItem}>
            <Ionicons name="people-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {item.seatsBooked || item.seatsRequested} {(item.seatsBooked || item.seatsRequested) === 1 ? 'asiento' : 'asientos'}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {formatDate(item.createdAt)}
            </Text>
          </View>
        </View>

        {/* Message */}
        {item.message && (
          <View style={[styles.messageSection, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.surface }]}>
            <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.messageText, { color: colors.textSecondary }]}>{item.message}</Text>
          </View>
        )}

        {/* Actions */}
        {isPending && (
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={[styles.acceptButton, { backgroundColor: getCurrentThemeMode() === 'dark' ? colors.textSecondary : '#000000' }]}
              onPress={() => handleAccept(item)}
              disabled={acceptingRequestId === (item._id || item.id)}
            >
              {acceptingRequestId === (item._id || item.id) ? (
                <ActivityIndicator 
                  size="small" 
                  color={getCurrentThemeMode() === 'dark' ? '#FFFFFF' : '#FFFFFF'} 
                />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color={getCurrentThemeMode() === 'dark' ? colors.cardBackground : '#FFFFFF'} />
                  <Text style={[styles.acceptButtonText, { color: getCurrentThemeMode() === 'dark' ? colors.cardBackground : '#FFFFFF' }]}>Aceptar</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectButton, { backgroundColor: colors.error + '20' }]}
              onPress={() => openRejectModal(item._id)}
            >
              <Ionicons name="close" size={18} color={colors.error} />
              <Text style={[styles.rejectButtonText, { color: colors.error }]}>Rechazar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Rejection Reason */}
        {item.status === 'rejected' && item.rejectionReason && (
          <View style={[styles.rejectionSection, { backgroundColor: colors.error + '20', borderLeftColor: colors.error }]}>
            <Text style={[styles.rejectionText, { color: colors.error }]}>Razon: {item.rejectionReason}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderTripSelector = () => (
    <View style={[styles.selectorContainer, { backgroundColor: colors.background }]}>
      <Text style={[styles.selectorTitle, { color: colors.textPrimary }]}>Selecciona un viaje</Text>
      <Text style={[styles.selectorSubtitle, { color: colors.textSecondary }]}>
        Elige el viaje del cual quieres ver las solicitudes
      </Text>

      <FlatList
        data={trips}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.tripCard, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, borderColor: colors.border }]}
            onPress={() => setSelectedTripId(item._id)}
          >
            <View style={styles.tripRoute}>
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.routeCity, { color: colors.textPrimary }]} numberOfLines={1}>{[item.origin?.address, item.origin?.city, item.origin?.province].filter(Boolean).join(', ')}</Text>
              </View>
              <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, styles.routeDotDestination, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, borderColor: colors.error }]} />
                <Text style={[styles.routeCity, { color: colors.textPrimary }]} numberOfLines={1}>{[item.destination?.address, item.destination?.city, item.destination?.province].filter(Boolean).join(', ')}</Text>
              </View>
            </View>
            <View style={styles.tripMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatDate(item.departureDate)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{item.departureTime}</Text>
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
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={getCurrentThemeMode() === 'dark' ? '#292929' : colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
              tintColor={getCurrentThemeMode() === 'dark' ? '#292929' : colors.primary}
            />
          }
        />
      ) : selectedTripId ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.surface }]}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin solicitudes</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Las solicitudes para este viaje apareceran aqui
          </Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.surface }]}>
            <Ionicons name="car-outline" size={48} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin viajes</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
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
          <View style={[styles.modalContent, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Rechazar solicitud</Text>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Indica la razon del rechazo:</Text>

            <TextInput
              style={[styles.textArea, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Escribe la razon aqui..."
              placeholderTextColor={colors.textMuted}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, borderColor: colors.border }]}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: colors.error }]}
                onPress={handleReject}
              >
                <Text style={[styles.modalConfirmText, { color: colors.textPrimary }]}>Rechazar</Text>
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
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  // Card
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '600',
  },
  passengerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  passengerLocation: {
    fontSize: 13,
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
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
  },
  // Message
  messageSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  messageText: {
    flex: 1,
    fontSize: 14,
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
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Rejection
  rejectionSection: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  rejectionText: {
    fontSize: 13,
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
    textAlign: 'center',
    marginBottom: 8,
  },
  selectorSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  tripList: {
    paddingBottom: 16,
  },
  tripCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
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
  },
  routeDotDestination: {
    borderWidth: 2,
  },
  routeLine: {
    width: 2,
    height: 16,
    marginLeft: 4,
    marginVertical: 4,
  },
  routeCity: {
    fontSize: 15,
    fontWeight: '600',
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
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
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
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
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default TripRequestsScreen;
