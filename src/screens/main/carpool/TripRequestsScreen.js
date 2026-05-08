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
import { get_withauth, put_withauth, buildImageUri } from '../../../services/apiService';
import { approveOrRejectReservation } from '../../../services/seatReservationService';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';

const TripRequestsScreen = ({ route }) => {
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();
  const { tripId } = route.params || {};

  const bg          = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg      = isDarkMode ? '#222222' : '#FFFFFF';
  const border      = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted   = isDarkMode ? '#6B7280' : '#9CA3AF';
  const divider     = isDarkMode ? '#2A2A2A' : '#F0F0F0';
  const accent      = isDarkMode ? '#FFFFFF' : '#000000';
  const accentInv   = isDarkMode ? '#000000' : '#FFFFFF';

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

  useEffect(() => { loadUserTrips(); }, []);
  useEffect(() => { if (selectedTripId) loadRequests(); }, [selectedTripId]);

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
    } catch {
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
      if (response.success) setRequests(response.data);
    } catch {
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

  const handleAccept = (request) => {
    const requestId = request._id || request.id;
    const isSeatReservation = request.bookingType === 'seat_reservation';
    const seatReservationId = request.seatReservation?._id || request.seatReservation?.id;

    showAlert(
      'Aceptar solicitud',
      `¿Aceptar ${request.seatsBooked || request.seatsRequested} asiento(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            setAcceptingRequestId(requestId);
            try {
              if (isSeatReservation && seatReservationId) {
                const res = await approveOrRejectReservation(seatReservationId, 'approve');
                if (res.success) {
                  showAlert('Aprobado', 'El pasajero recibirá una notificación para completar el pago.', [
                    { text: 'OK', onPress: () => loadRequests() },
                  ]);
                }
              } else {
                const res = await put_withauth(`/bookings/${requestId}/confirm`);
                if (res.success) { showAlert('Éxito', 'Solicitud aceptada'); loadRequests(); }
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
    if (!rejectReason.trim()) { showAlert('Error', 'Ingresa una razón para el rechazo'); return; }
    try {
      const request = requests.find(r => (r._id || r.id) === selectedRequest);
      const isSeatReservation = request?.bookingType === 'seat_reservation';
      const seatReservationId = request?.seatReservation?._id || request?.seatReservation?.id;
      const close = () => { setRejectModalVisible(false); setRejectReason(''); setSelectedRequest(null); loadRequests(); };

      if (isSeatReservation && seatReservationId) {
        const res = await approveOrRejectReservation(seatReservationId, 'reject', rejectReason);
        if (res.success) close();
      } else {
        const res = await put_withauth(`/bookings/${selectedRequest}/reject`, { reason: rejectReason });
        if (res.success) close();
      }
    } catch (error) {
      showAlert('Error', error?.response?.data?.message || error.message);
    }
  };

  const getStatus = (status) => {
    const map = {
      pending:          { color: '#F59E0B', label: 'Pendiente' },
      confirmed:        { color: '#10B981', label: 'Confirmado' },
      cancelled:        { color: '#EF4444', label: 'Cancelado' },
      completed:        { color: '#3B82F6', label: 'Completado' },
      pending_approval: { color: '#F59E0B', label: 'Esperando tu aprobación' },
      pending_payment:  { color: '#8B5CF6', label: 'Pago pendiente' },
      reserved:         { color: '#10B981', label: 'Confirmada' },
      rejected:         { color: '#EF4444', label: 'Rechazada' },
    };
    return map[status] || { color: textMuted, label: status };
  };

  const fmtDate = (d) =>
    new Date(d).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

  const fmtAddress = (address, city) => {
    if (!address) return city || '';
    let s = address
      .replace(/\b[A-Za-z]\d{4}[A-Za-z]{0,3}\b,?\s*/g, '')
      .replace(/,?\s*Argentina\s*$/i, '')
      .replace(/,\s*,/g, ',')
      .replace(/,\s*$/, '')
      .trim();
    return s || city || '';
  };

  const fmtCurrency = (n) =>
    n == null || isNaN(n) ? '-' : '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const activeTrips = trips.filter(t => t.status === 'active' || t.status === 'started');

  // ─── Trip card (for the selector list) ───────────────────────────────────
  const renderTripCard = ({ item }) => {
    const pending = pendingCounts[item._id] || 0;
    return (
      <TouchableOpacity
        style={[styles.tripCard, { backgroundColor: cardBg, borderColor: border }]}
        onPress={() => setSelectedTripId(item._id)}
        activeOpacity={0.7}
      >
        {/* Route */}
        <View style={styles.routeBlock}>
          <View style={styles.routeDotsCol}>
            <View style={[styles.dotOrigin, { borderColor: accent }]} />
            <View style={[styles.routeLine, { backgroundColor: isDarkMode ? '#444' : '#D0D0D0' }]} />
            <View style={[styles.dotDest, { backgroundColor: accent }]} />
          </View>
          <View style={styles.routeTextCol}>
            <Text style={[styles.routeTextLabel, { color: textMuted }]}>Origen</Text>
            <Text style={[styles.routeTextValue, { color: textPrimary }]} numberOfLines={2}>
              {fmtAddress(item.origin?.address, item.origin?.city)}
            </Text>
            <View style={{ height: 14 }} />
            <Text style={[styles.routeTextLabel, { color: textMuted }]}>Destino</Text>
            <Text style={[styles.routeTextValue, { color: textPrimary }]} numberOfLines={2}>
              {fmtAddress(item.destination?.address, item.destination?.city)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={[styles.tripCardFooter, { borderTopColor: divider }]}>
          <View style={styles.tripCardMeta}>
            <Ionicons name="calendar-outline" size={13} color={textMuted} />
            <Text style={[styles.tripCardMetaText, { color: textMuted }]}>
              {fmtDate(item.departureDate)} · {item.departureTime}
            </Text>
          </View>
          {pending > 0 ? (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pending} pendiente{pending > 1 ? 's' : ''}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={textMuted} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Request card ─────────────────────────────────────────────────────────
  const renderRequestCard = ({ item }) => {
    if (!item.passenger?._id) {
      return (
        <View style={[styles.reqCard, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={{ color: textMuted }}>Usuario no disponible</Text>
        </View>
      );
    }
    const avatarUrl = item.passenger?.avatar ? buildImageUri(item.passenger.avatar) : null;
    const resStatus = item.seatReservation?.reservationStatus || item.status;
    const status    = getStatus(resStatus);
    const isPending = resStatus === 'pending_approval' || resStatus === 'pending';
    const amount    = item.seatReservation?.reservationAmount;
    const seats     = item.seatsBooked || item.seatsRequested;

    return (
      <View style={[styles.reqCard, { backgroundColor: cardBg, borderColor: border }]}>

        {/* Passenger row */}
        <View style={styles.passengerRow}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#2A2A2A' : '#E8E8E8' }]}>
              <Text style={[styles.avatarInitials, { color: textMuted }]}>
                {item.passenger?.firstName?.[0]}{item.passenger?.lastName?.[0]}
              </Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.passengerName, { color: textPrimary }]}>
              {item.passenger?.firstName} {item.passenger?.lastName}
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: status.color }]} />
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          {amount != null && (
            <Text style={[styles.amountText, { color: textPrimary }]}>{fmtCurrency(amount)}</Text>
          )}
        </View>

        {/* Meta row */}
        <View style={[styles.metaRow, { borderTopColor: divider }]}>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>
              {seats} asiento{seats === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>{fmtDate(item.createdAt)}</Text>
          </View>
        </View>

        {/* Message */}
        {item.message && (
          <Text style={[styles.messageText, { color: textMuted, borderTopColor: divider }]} numberOfLines={3}>
            "{item.message}"
          </Text>
        )}

        {/* Rejection reason */}
        {item.status === 'rejected' && item.rejectionReason && (
          <Text style={[styles.rejectionText, { borderTopColor: divider }]}>
            Razón: {item.rejectionReason}
          </Text>
        )}

        {/* Actions */}
        {isPending && (
          <View style={[styles.actionsRow, { borderTopColor: divider }]}>
            <TouchableOpacity
              style={[styles.btnReject, { backgroundColor: isDarkMode ? '#3D1A1A' : '#FEE2E2' }]}
              onPress={() => { setSelectedRequest(item._id); setRejectModalVisible(true); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnRejectText, { color: isDarkMode ? '#F87171' : '#DC2626' }]}>Rechazar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnAccept, { backgroundColor: accent }]}
              onPress={() => handleAccept(item)}
              disabled={acceptingRequestId === (item._id || item.id)}
              activeOpacity={0.8}
            >
              {acceptingRequestId === (item._id || item.id) ? (
                <ActivityIndicator size="small" color={accentInv} />
              ) : (
                <Text style={[styles.btnAcceptText, { color: accentInv }]}>Aceptar</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading && !refreshing) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={textMuted} />
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>

      {/* Content */}
      {!selectedTripId && activeTrips.length > 0 ? (
        <FlatList
          data={activeTrips}
          keyExtractor={(item) => item._id}
          renderItem={renderTripCard}
          contentContainerStyle={styles.listPad}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textMuted} />}
          ListHeaderComponent={
            <Text style={[styles.sectionLabel, { color: textMuted }]}>Selecciona un viaje</Text>
          }
        />
      ) : selectedTripId && requests.length > 0 ? (
        <FlatList
          data={requests}
          keyExtractor={(item) => item._id}
          renderItem={renderRequestCard}
          contentContainerStyle={styles.listPad}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textMuted} />}
        />
      ) : (
        <View style={styles.centered}>
          <Ionicons name={selectedTripId ? 'people-outline' : 'car-outline'} size={48} color={textMuted} />
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>
            {selectedTripId ? 'Sin solicitudes' : 'Sin viajes activos'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: textMuted }]}>
            {selectedTripId ? 'Las solicitudes aparecerán aquí' : 'Crea un viaje para recibir reservas'}
          </Text>
        </View>
      )}

      {/* Reject Modal */}
      <Modal animationType="fade" transparent visible={rejectModalVisible} onRequestClose={() => setRejectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: cardBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: divider }]}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>Rechazar solicitud</Text>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                <Ionicons name="close" size={22} color={textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalLabel, { color: textMuted }]}>Razón del rechazo</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: bg, borderColor: border, color: textPrimary }]}
              placeholder="Escribe la razón aquí..."
              placeholderTextColor={textMuted}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: border }]}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: textMuted }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalRejectBtn}
                onPress={handleReject}
              >
                <Text style={styles.modalRejectText}>Rechazar</Text>
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
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:     { marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub:   { fontSize: 13, marginTop: 2 },

  listPad:      { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 13, marginBottom: 12 },

  // Trip card
  tripCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  routeBlock: {
    flexDirection: 'row',
    padding: 16,
    gap: 14,
  },
  routeDotsCol: {
    width: 18,
    alignItems: 'center',
    paddingTop: 18,
  },
  dotOrigin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  routeLine: {
    width: 1.5,
    height: 28,
    marginVertical: 4,
  },
  dotDest: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeTextCol:   { flex: 1 },
  routeTextLabel: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  routeTextValue: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  tripCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tripCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tripCardMetaText: { fontSize: 13 },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pendingBadgeText: { fontSize: 12, fontWeight: '600', color: '#B45309' },

  // Request card
  reqCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: { fontSize: 16, fontWeight: '600' },
  passengerName:  { fontSize: 15, fontWeight: '600' },
  statusRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot:      { width: 7, height: 7, borderRadius: 4 },
  statusText:     { fontSize: 12, fontWeight: '500' },
  amountText:     { fontSize: 15, fontWeight: '700' },

  metaRow: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText:  { fontSize: 13 },

  messageText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rejectionText: {
    fontSize: 13,
    color: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btnReject: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnRejectText: {
    fontSize: 15,
    fontWeight: '600',
  },
  btnAccept: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnAcceptText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
  modalRejectBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalRejectText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  // Empty
  emptyTitle:    { fontSize: 17, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    borderRadius: 14,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle:   { fontSize: 17, fontWeight: '700' },
  modalLabel:   { fontSize: 13, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  textArea: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 90,
  },
  modalActions: { flexDirection: 'row', gap: 10, padding: 20 },
});

export default TripRequestsScreen;
