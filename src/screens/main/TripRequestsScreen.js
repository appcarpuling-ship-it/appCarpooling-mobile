import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { get_withauth, put_withauth, buildImageUri } from '../../services/apiService';
import { approveOrRejectReservation } from '../../services/seatReservationService';
import { useColors } from '../../hooks/useColors';
import { useAlert } from '../../context/AlertContext';

const TripRequestsScreen = ({ route }) => {
  const { colors, getCurrentThemeMode } = useColors();
  const { showAlert } = useAlert();
  const { tripId } = route.params || {};
  const isDarkMode = getCurrentThemeMode() === 'dark';

  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(tripId);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingRequestId, setAcceptingRequestId] = useState(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pendingCounts, setPendingCounts] = useState({});

  useEffect(() => {
    loadUserTrips();
  }, []);

  useEffect(() => {
    if (selectedTripId) {
      loadRequests();
    }
  }, [selectedTripId]);

  const loadUserTrips = async () => {
    try {
      const response = await get_withauth('/trips/my-trips/driver');
      if (response.success && response.data.length > 0) {
        const activeTrips = response.data.filter(t => t.status === 'active' || t.status === 'started');
        setTrips(response.data);
        if (response.data.length === 1 && !selectedTripId) {
          setSelectedTripId(response.data[0]._id);
        }
        const counts = {};
        await Promise.all(
          activeTrips.map(async (trip) => {
            try {
              const r = await get_withauth(`/bookings/trip/${trip._id}`);
              if (r.success) {
                counts[trip._id] = (r.data || []).filter(b => {
                  const rs = b.seatReservation?.reservationStatus || b.status;
                  return rs === 'pending_approval' || rs === 'pending';
                }).length;
              }
            } catch (_) {}
          })
        );
        setPendingCounts(counts);
      } else {
        setTrips([]);
      }
    } catch (error) {
      showAlert('Error', 'No se pudieron cargar tus viajes');
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
      showAlert('Error', 'No se pudieron cargar las solicitudes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (selectedTripId) loadRequests();
    else loadUserTrips();
  };

  const handleAccept = async (request) => {
    const requestId = request._id || request.id;
    const isSeatReservation = request.bookingType === 'seat_reservation';
    const seatReservationId = request.seatReservation?._id || request.seatReservation?.id;

    showAlert(
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
                  showAlert('Aprobado', 'El pasajero recibirá una notificación para completar el pago.', [
                    { text: 'OK', onPress: () => loadRequests() }
                  ]);
                }
              } else {
                const response = await put_withauth(`/bookings/${requestId}/confirm`);
                if (response.success) {
                  showAlert('Éxito', 'Solicitud aceptada');
                  loadRequests();
                }
              }
            } catch (error) {
              showAlert('Error', error?.response?.data?.message || error.message);
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
      showAlert('Error', 'Ingresa una razón para el rechazo');
      return;
    }
    try {
      const request = requests.find(r => (r._id || r.id) === selectedRequest);
      const isSeatReservation = request?.bookingType === 'seat_reservation';
      const seatReservationId = request?.seatReservation?._id || request?.seatReservation?.id;

      if (isSeatReservation && seatReservationId) {
        const response = await approveOrRejectReservation(seatReservationId, 'reject', rejectReason);
        if (response.success) {
          setRejectModalVisible(false);
          setRejectReason('');
          setSelectedRequest(null);
          loadRequests();
        }
      } else {
        const response = await put_withauth(`/bookings/${selectedRequest}/reject`, { reason: rejectReason });
        if (response.success) {
          setRejectModalVisible(false);
          setRejectReason('');
          setSelectedRequest(null);
          loadRequests();
        }
      }
    } catch (error) {
      showAlert('Error', error?.response?.data?.message || error.message);
    }
  };

  const openRejectModal = (requestId) => {
    setSelectedRequest(requestId);
    setRejectModalVisible(true);
  };

  const getStatusConfig = (status) => {
    const configs = {
      pending: { color: '#F59E0B', bg: '#FEF3C7', text: 'Pendiente', icon: 'time-outline' },
      confirmed: { color: '#10B981', bg: '#D1FAE5', text: 'Confirmado', icon: 'checkmark-circle' },
      cancelled: { color: '#EF4444', bg: '#FEE2E2', text: 'Cancelado', icon: 'close-circle' },
      completed: { color: '#3B82F6', bg: '#DBEAFE', text: 'Completado', icon: 'checkmark-done' },
      pending_approval: { color: '#F59E0B', bg: '#FEF3C7', text: 'Esperando tu aprobación', icon: 'hourglass-outline' },
      pending_payment: { color: '#8B5CF6', bg: '#EDE9FE', text: 'Pago pendiente', icon: 'card-outline' },
      reserved: { color: '#10B981', bg: '#D1FAE5', text: 'Confirmada', icon: 'checkmark-circle' },
      rejected: { color: '#EF4444', bg: '#FEE2E2', text: 'Rechazada', icon: 'close-circle' },
    };
    return configs[status] || { color: colors.textMuted, bg: colors.border, text: status, icon: 'help-circle-outline' };
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatAddress = (address, city, province) => {
    if (!address) return [city, province].filter(Boolean).join(', ');
    let cleaned = address
      .replace(/\b[A-Za-z]\d{4}[A-Za-z]{0,3}\b,?\s*/g, '')
      .replace(/,?\s*Argentina\s*$/i, '')
      .replace(/,\s*,/g, ',')
      .replace(/,\s*$/, '')
      .trim();
    const cityIncluded = city && cleaned.toLowerCase().includes(city.toLowerCase());
    if (cityIncluded) return cleaned;
    return [cleaned, city, province].filter(Boolean).join(', ');
  };

  const formatCurrency = (num) => {
    if (num == null || isNaN(num)) return '-';
    return '$' + Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const pendingRequests = requests.filter(r => {
    const rs = r.seatReservation?.reservationStatus || r.status;
    return rs === 'pending_approval' || rs === 'pending';
  });
  const selectedTrip = trips.find(t => t._id === selectedTripId);

  const renderRequestItem = ({ item }) => {
    if (!item.passenger || !item.passenger._id) {
      return (
        <View style={[styles.requestCard, { backgroundColor: isDarkMode ? '#1F1F1F' : '#FFFFFF' }]}>
          <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#333' : '#F3F4F6' }]}>
            <Ionicons name="person" size={28} color={colors.textMuted} />
          </View>
          <Text style={[styles.passengerName, { color: colors.textPrimary }]}>Usuario no disponible</Text>
        </View>
      );
    }

    const avatarUrl = item.passenger?.avatar ? buildImageUri(item.passenger.avatar) : null;
    const reservationStatus = item.seatReservation?.reservationStatus || item.status;
    const statusConfig = getStatusConfig(reservationStatus);
    const isPending = reservationStatus === 'pending_approval' || reservationStatus === 'pending';
    const reservationAmount = item.seatReservation?.reservationAmount;

    return (
      <View style={[
        styles.requestCard,
        {
          backgroundColor: isDarkMode ? '#1F1F1F' : '#FFFFFF',
          borderLeftWidth: 4,
          borderLeftColor: isPending ? '#F59E0B' : statusConfig.color,
        }
      ]}>
        {/* Header: Avatar + Info + Status */}
        <View style={styles.cardHeader}>
          <View style={styles.passengerRow}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#333' : '#EEF2FF' }]}>
                <Text style={[styles.avatarInitials, { color: isDarkMode ? '#A5B4FC' : '#6366F1' }]}>
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
                  {item.passenger.city}{item.passenger.province ? `, ${item.passenger.province}` : ''}
                </Text>
              )}
            </View>
          </View>
          <View style={[styles.statusChip, { backgroundColor: isDarkMode ? statusConfig.color + '30' : statusConfig.bg }]}>
            <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.text}</Text>
          </View>
        </View>

        {/* Details row */}
        <View style={[styles.detailsRow, { borderTopColor: isDarkMode ? '#333' : '#F3F4F6' }]}>
          <View style={styles.detailChip}>
            <Ionicons name="people" size={14} color={colors.textMuted} />
            <Text style={[styles.detailChipText, { color: colors.textSecondary }]}>
              {item.seatsBooked || item.seatsRequested} asiento{(item.seatsBooked || item.seatsRequested) === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={styles.detailChip}>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.detailChipText, { color: colors.textSecondary }]}>{formatDate(item.createdAt)}</Text>
          </View>
          {reservationAmount != null && (
            <View style={[styles.detailChip, styles.amountChip]}>
              <Ionicons name="cash-outline" size={14} color="#10B981" />
              <Text style={[styles.detailChipText, { color: '#10B981', fontWeight: '600' }]}>
                {formatCurrency(reservationAmount)}
              </Text>
            </View>
          )}
        </View>

        {/* Message */}
        {item.message && (
          <View style={[styles.messageBubble, { backgroundColor: isDarkMode ? '#292929' : '#F9FAFB' }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.messageText, { color: colors.textSecondary }]} numberOfLines={3}>{item.message}</Text>
          </View>
        )}

        {/* Actions */}
        {isPending && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.acceptBtn, { backgroundColor: isDarkMode ? '#10B981' : '#059669' }]}
              onPress={() => handleAccept(item)}
              disabled={acceptingRequestId === (item._id || item.id)}
              activeOpacity={0.8}
            >
              {acceptingRequestId === (item._id || item.id) ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.acceptBtnText}>Aceptar</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectBtn, { backgroundColor: isDarkMode ? '#EF444420' : '#FEE2E2' }]}
              onPress={() => openRejectModal(item._id)}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
              <Text style={[styles.rejectBtnText, { color: '#EF4444' }]}>Rechazar</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'rejected' && item.rejectionReason && (
          <View style={[styles.rejectionBubble, { borderLeftColor: '#EF4444' }]}>
            <Text style={[styles.rejectionText, { color: colors.textSecondary }]}>Razón: {item.rejectionReason}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderTripChip = ({ item }) => {
    const isSelected = item._id === selectedTripId;
    const pending = pendingCounts[item._id] || 0;

    return (
      <TouchableOpacity
        style={[
          styles.tripCard,
          {
            backgroundColor: isSelected ? (isDarkMode ? '#6366F1' : '#4F46E5') : (isDarkMode ? '#1F1F1F' : '#FFFFFF'),
            borderColor: isSelected ? (isDarkMode ? '#6366F1' : '#4F46E5') : colors.border,
          }
        ]}
        onPress={() => setSelectedTripId(item._id)}
        activeOpacity={0.7}
      >
        <View style={styles.tripCardRoute}>
          <View style={styles.tripCardRouteRow}>
            <View style={[styles.tripCardDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.tripCardCity, { color: isSelected ? '#FFF' : colors.textPrimary }]} numberOfLines={1}>
              {formatAddress(item.origin?.address, item.origin?.city, item.origin?.province)}
            </Text>
          </View>
          <View style={[styles.tripCardLine, { backgroundColor: isSelected ? 'rgba(255,255,255,0.5)' : colors.border }]} />
          <View style={styles.tripCardRouteRow}>
            <View style={[styles.tripCardDot, styles.tripCardDotDest, { borderColor: '#EF4444' }]} />
            <Text style={[styles.tripCardCity, { color: isSelected ? '#FFF' : colors.textPrimary }]} numberOfLines={1}>
              {formatAddress(item.destination?.address, item.destination?.city, item.destination?.province)}
            </Text>
          </View>
        </View>
        <View style={styles.tripCardFooter}>
          <View style={styles.tripCardMeta}>
            <Ionicons name="calendar-outline" size={14} color={isSelected ? 'rgba(255,255,255,0.8)' : colors.textMuted} />
            <Text style={[styles.tripCardDate, { color: isSelected ? 'rgba(255,255,255,0.9)' : colors.textSecondary }]}>
              {formatDate(item.departureDate)} · {item.departureTime}
            </Text>
          </View>
          {pending > 0 && (
            <View style={[styles.pendingPill, { backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : '#FEF3C7' }]}>
              <Text style={[styles.pendingPillText, { color: isSelected ? '#FFF' : '#B45309' }]}>
                {pending} pendiente{pending > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = (icon, title, subtitle) => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconWrap, { backgroundColor: isDarkMode ? '#262626' : '#F3F4F6' }]}>
        <Ionicons name={icon} size={56} color={colors.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={isDarkMode ? '#6366F1' : '#4F46E5'} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando solicitudes...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header con resumen */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {selectedTripId && trips.length > 1 && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setSelectedTripId(null)}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {selectedTripId ? 'Solicitudes' : 'Mis viajes'}
          </Text>
          {selectedTripId && (
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {pendingRequests.length > 0
                ? `${pendingRequests.length} esperando tu respuesta`
                : `${requests.length} solicitud${requests.length !== 1 ? 'es' : ''} en total`}
            </Text>
          )}
        </View>
      </View>

      {!selectedTripId && trips.length > 0 ? (
        <FlatList
          data={trips.filter(t => t.status === 'active' || t.status === 'started')}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => renderTripChip({ item })}
          contentContainerStyle={styles.tripListContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
          }
          ListHeaderComponent={
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              Elige un viaje para ver sus solicitudes
            </Text>
          }
        />
      ) : selectedTripId && requests.length > 0 ? (
        <FlatList
          data={requests}
          renderItem={renderRequestItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
          }
          ListHeaderComponent={
            selectedTrip && (
              <View style={[styles.selectedTripBanner, { backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF' }]}>
                <View style={styles.selectedTripInfo}>
                  <View style={styles.selectedTripRoute}>
                    <Text style={[styles.selectedTripCity, { color: isDarkMode ? '#A5B4FC' : '#4F46E5' }]} numberOfLines={1}>
                      {selectedTrip.origin?.city} → {selectedTrip.destination?.city}
                    </Text>
                    <Text style={[styles.selectedTripDate, { color: colors.textSecondary }]}>
                      {formatDate(selectedTrip.departureDate)} · {selectedTrip.departureTime}
                    </Text>
                  </View>
                </View>
              </View>
            )
          }
        />
      ) : selectedTripId ? (
        renderEmptyState('people-outline', 'Sin solicitudes', 'Las solicitudes para este viaje aparecerán aquí')
      ) : (
        renderEmptyState('car-outline', 'Sin viajes activos', 'Crea un viaje para recibir solicitudes de reserva')
      )}

      {/* Modal Rechazar */}
      <Modal animationType="fade" transparent visible={rejectModalVisible} onRequestClose={() => setRejectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1F1F1F' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Rechazar solicitud</Text>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Indica la razón del rechazo:</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: isDarkMode ? '#292929' : '#F9FAFB', borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Escribe la razón aquí..."
              placeholderTextColor={colors.textMuted}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: '#EF4444' }]} onPress={handleReject}>
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
  container: { flex: 1 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: { fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: { flex: 1 },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },

  tripListContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionLabel: {
    fontSize: 14,
    marginBottom: 16,
  },
  tripCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  tripCardRoute: {
    marginBottom: 12,
  },
  tripCardRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tripCardDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tripCardDotDest: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  tripCardLine: {
    width: 2,
    height: 16,
    marginLeft: 4,
    marginVertical: 4,
  },
  tripCardCity: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  tripCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  tripCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripCardDate: {
    fontSize: 13,
  },
  pendingPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingPillText: {
    fontSize: 12,
    fontWeight: '600',
  },

  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  selectedTripBanner: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  selectedTripInfo: { flex: 1 },
  selectedTripRoute: { gap: 4 },
  selectedTripCity: {
    fontSize: 16,
    fontWeight: '700',
  },
  selectedTripDate: {
    fontSize: 13,
  },

  requestCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '700',
  },
  passengerInfo: {
    marginLeft: 14,
    flex: 1,
  },
  passengerName: {
    fontSize: 17,
    fontWeight: '700',
  },
  passengerLocation: {
    fontSize: 13,
    marginTop: 2,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailChipText: {
    fontSize: 13,
  },
  amountChip: {
    marginLeft: 'auto',
  },
  messageBubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  acceptBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  rejectBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  rejectionBubble: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  rejectionText: {
    fontSize: 13,
    fontStyle: 'italic',
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 20,
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
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default TripRequestsScreen;
