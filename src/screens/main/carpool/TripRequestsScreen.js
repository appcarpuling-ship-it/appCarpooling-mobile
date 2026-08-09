import React, { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
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
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { get_withauth, put_withauth, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { approveOrRejectReservation } from '../../../services/seatReservationService';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import { useUI } from '../../../theme/ui';
import EmptyState from '../../../components/ui/EmptyState';
import { reportError } from '../../../utils/sentry';

const TripRequestsScreen = ({ route }) => {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();
  const { tripId } = route.params || {};

  useLayoutEffect(() => {
    const tint = ui.text;
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Volver a gestionar viajes"
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Carpoolings');
            }
          }}
          style={{
            marginLeft: Platform.OS === 'android' ? 6 : 4,
            paddingVertical: 10,
            paddingRight: 10,
            paddingLeft: 4,
          }}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={tint} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, isDarkMode]);


  const ui = useUI();
  const bg          = ui.bg;
  const cardBg      = ui.surface;
  const border      = ui.border;
  const textPrimary = ui.invertBg;
  const textMuted   = ui.textMuted;
  const divider     = ui.bg;
  const accent      = ui.invertBg;
  const accentInv   = ui.invertText;

  const [trips, setTrips] = useState([]);
  const [tripsPage, setTripsPage] = useState(1);
  const [tripsHasMore, setTripsHasMore] = useState(true);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loadingMoreTrips, setLoadingMoreTrips] = useState(false);
  const tripsFetchLock = useRef(false);

  const [selectedTripId, setSelectedTripId] = useState(tripId);
  const [requests, setRequests] = useState([]);
  const [reqPage, setReqPage] = useState(1);
  const [reqHasMore, setReqHasMore] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingMoreRequests, setLoadingMoreRequests] = useState(false);
  const reqFetchLock = useRef(false);

  const [refreshing, setRefreshing] = useState(false);
  const [acceptingRequestId, setAcceptingRequestId] = useState(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pendingCounts, setPendingCounts] = useState({});

  const enrichPendingForTrips = async (tripList) => {
    const active = tripList.filter(t => t.status === 'active' || t.status === 'started');
    if (!active.length) return;
    const entries = await Promise.all(
      active.map(async (trip) => {
        try {
          const r = await get_withauth(`/bookings/trip/${trip._id}`);
          if (!r.success) return [trip._id, 0];
          const n = (r.data || []).filter((b) => {
            const rs = b.seatReservation?.reservationStatus || b.status;
            return rs === 'pending_approval' || rs === 'pending';
          }).length;
          return [trip._id, n];
        } catch {
          return [trip._id, 0];
        }
      }),
    );
    setPendingCounts((prev) => {
      const next = { ...prev };
      entries.forEach(([id, n]) => { next[id] = n; });
      return next;
    });
  };

  const loadUserTrips = async (pageNum = 1, { append = false } = {}) => {
    if (tripsFetchLock.current && append) return;
    tripsFetchLock.current = true;
    if (append) setLoadingMoreTrips(true);
    else setLoadingTrips(true);
    try {
      const response = await get_withauth(ENDPOINTS.MY_TRIPS_DRIVER, {
        page: pageNum,
        limit: LIST_PAGE_SIZE,
      });
      if (response.success && Array.isArray(response.data)) {
        const rows = response.data;
        setTrips((prev) => (append ? [...prev, ...rows] : rows));
        setTripsPage(pageNum);
        setTripsHasMore(response.hasMore === true);
        setSelectedTripId((cur) => {
          if (cur) return cur;
          if (rows.length === 1) return rows[0]._id;
          return cur;
        });
        await enrichPendingForTrips(rows);
      } else if (!append) {
        setTrips([]);
        setTripsHasMore(false);
      }
    } catch (error) {
      reportError(error, { screen: 'TripRequestsScreen', action: 'loadTrips' });
      showAlert('Ocurrió algo', 'No se pudieron cargar tus viajes');
    } finally {
      tripsFetchLock.current = false;
      setLoadingTrips(false);
      setLoadingMoreTrips(false);
      setRefreshing(false);
    }
  };

  const loadRequests = useCallback(async (pageNum = 1, { append = false, isRefresh = false } = {}) => {
    if (!selectedTripId) return;
    if (reqFetchLock.current && append) return;
    reqFetchLock.current = true;
    const tid = selectedTripId;
    if (append) setLoadingMoreRequests(true);
    else if (!isRefresh) setLoadingRequests(true);
    try {
      const response = await get_withauth(`/bookings/trip/${tid}`, {
        page: pageNum,
        limit: LIST_PAGE_SIZE,
      });
      if (!response.success || tid !== selectedTripId) return;
      const rows = response.data || [];
      setRequests((prev) => (append ? [...prev, ...rows] : rows));
      setReqPage(pageNum);
      setReqHasMore(response.hasMore === true);
    } catch (error) {
      reportError(error, { screen: 'TripRequestsScreen', action: 'loadRequests' });
      if (tid === selectedTripId) {
        showAlert('Ocurrió algo', 'No se pudieron cargar las solicitudes');
      }
    } finally {
      if (tid === selectedTripId) {
        reqFetchLock.current = false;
        setLoadingRequests(false);
        setLoadingMoreRequests(false);
        setRefreshing(false);
      }
    }
  }, [selectedTripId]);

  useEffect(() => {
    loadUserTrips(1, { append: false });
  }, []);

  useEffect(() => {
    if (!selectedTripId) return;
    setRequests([]);
    setReqPage(1);
    setReqHasMore(true);
    reqFetchLock.current = false;
    loadRequests(1, { append: false, isRefresh: false });
  }, [selectedTripId, loadRequests]);

  useEffect(() => {
    if (selectedTripId) return;
    if (loadingTrips || loadingMoreTrips || !tripsHasMore || tripsFetchLock.current) return;
    const hasActive = trips.some((t) => t.status === 'active' || t.status === 'started');
    if (!hasActive && trips.length > 0) {
      loadUserTrips(tripsPage + 1, { append: true });
    }
  }, [trips, tripsPage, tripsHasMore, loadingTrips, loadingMoreTrips, selectedTripId]);

  const onRefresh = () => {
    setRefreshing(true);
    if (selectedTripId) loadRequests(1, { append: false, isRefresh: true });
    else loadUserTrips(1, { append: false });
  };

  const onTripsEndReached = () => {
    if (selectedTripId || !tripsHasMore || loadingMoreTrips || tripsFetchLock.current || loadingTrips) return;
    loadUserTrips(tripsPage + 1, { append: true });
  };

  const seatsLabelEs = (n) => {
    const s = Math.max(1, Number(n) || 1);
    return s === 1 ? '1 asiento' : `${s} asientos`;
  };

  const handleAccept = (request) => {
    const requestId = request._id || request.id;
    const isSeatReservation = request.bookingType === 'seat_reservation';
    const seatReservationId = request.seatReservation?._id || request.seatReservation?.id;

    showAlert(
      'Aceptar solicitud',
      `¿Aceptar ${seatsLabelEs(request.seatsBooked || request.seatsRequested)}?`,
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
                  loadRequests(1, { append: false });
                  navigation.navigate('Result', { type: 'success', title: 'Aprobado', message: 'El pasajero recibirá una notificación para completar el pago.' });
                }
              } else {
                const res = await put_withauth(`/bookings/${requestId}/confirm`);
                if (res.success) {
                  loadRequests(1, { append: false });
                  navigation.navigate('Result', { type: 'success', title: 'Solicitud aceptada', message: 'La solicitud fue aceptada correctamente.' });
                }
              }
            } catch (error) {
              showAlert(
                'Error',
                String(error?.response?.data?.message || error?.message || 'No se pudo aprobar o rechazar la solicitud')
              );
            } finally {
              setAcceptingRequestId(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = async () => {
    try {
      const request = requests.find(r => (r._id || r.id) === selectedRequest);
      if (!request) {
        showAlert('Ocurrió algo', 'No se encontró la solicitud.');
        return;
      }
      const isSeatReservation = request.bookingType === 'seat_reservation';
      const seatReservationRaw = request.seatReservation?._id || request.seatReservation?.id || request.seatReservation;
      const seatReservationId = seatReservationRaw != null ? String(seatReservationRaw) : '';

      const close = () => { setRejectModalVisible(false); setRejectReason(''); setSelectedRequest(null); loadRequests(1, { append: false }); };

      const reasonToSend = (rejectReason && rejectReason.trim()) || '';

      if (isSeatReservation) {
        if (!seatReservationId) {
          showAlert('Ocurrió algo', 'Faltan datos de la reserva. Actualizá la lista e intentá de nuevo.');
          return;
        }
        const res = await approveOrRejectReservation(seatReservationId, 'reject', reasonToSend);
        if (res.success) close();
      } else {
        const res = await put_withauth(`/bookings/${selectedRequest}/reject`, { reason: reasonToSend || undefined });
        if (res.success) close();
      }
    } catch (error) {
      showAlert('Ocurrió algo', String(error?.response?.data?.message || error?.message || 'Error al rechazar'));
    }
  };

  const getStatus = (status) => {
    // Los 8 valores del enum reservationStatus del backend, mas los del viaje.
    // Faltaban payment_failed, trip_completed y expired: caian al default y la
    // pantalla mostraba la clave cruda ("trip_completed") al conductor.
    const map = {
      // del viaje
      pending:          { solid: true,  label: 'Pendiente' },
      confirmed:        { solid: true,  label: 'Confirmado' },
      cancelled:        { solid: false, label: 'Cancelado' },
      completed:        { solid: false, label: 'Completado' },
      // de la reserva del asiento
      pending_approval: { solid: true,  label: 'Esperando tu aprobación' },
      pending_payment:  { solid: true,  label: 'Pago pendiente' },
      payment_failed:   { solid: true,  label: 'Pago fallido' },
      reserved:         { solid: true,  label: 'Confirmada' },
      trip_completed:   { solid: false, label: 'Viaje completado' },
      expired:          { solid: false, label: 'Vencida' },
      rejected:         { solid: false, label: 'Rechazada' },
    };
    return map[status] || { solid: false, label: '—' };
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

  const activeTrips = trips.filter((t) => t.status === 'active' || t.status === 'started');

  /** Viaje actualmente seleccionado (origen / destino para el encabezado de solicitudes) */
  const selectedTrip = useMemo(
    () => trips.find((t) => String(t._id) === String(selectedTripId)),
    [trips, selectedTripId]
  );

  /** Encabezado de viaje: dentro de la tarjeta unificada (sin borde propio). */
  const renderTripContextBlock = () => {
    if (!selectedTripId) return null;

    if (!selectedTrip) {
      return (
        <View style={styles.tripContextEmbedded}>
          <Text style={[styles.tripContextLabel, { color: textMuted }]}>VIAJE</Text>
          <Text style={[styles.tripContextLine, { color: textPrimary }]}>
            Cargando ruta del viaje…
          </Text>
          {activeTrips.length > 1 ? (
            <TouchableOpacity
              onPress={() => setSelectedTripId(null)}
              style={styles.tripContextSwitchBtn}
              hitSlop={{ top: 8, bottom: 8 }}
            >
              <Text style={[styles.tripContextSwitchText, { color: accent }]}>Cambiar de viaje</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }

    const fmtFull = (loc) => {
      const addr = fmtAddress(loc?.address, loc?.city);
      const cityProv = [loc?.city, loc?.province].filter(Boolean).join(', ');
      return [addr, cityProv].filter(Boolean).join(', ');
    };
    const o = fmtFull(selectedTrip.origin);
    const d = fmtFull(selectedTrip.destination);
    return (
      <View style={styles.tripContextEmbedded}>
        <Text style={[styles.tripContextLabel, { color: textMuted }]}>VIAJE</Text>
        <Text style={[styles.tripContextLine, { color: textPrimary }]} numberOfLines={2}>
          {o || 'Origen'}{' '}
          <Text style={{ color: textMuted }}>→</Text>
          {' '}
          {d || 'Destino'}
        </Text>
        <View style={styles.tripContextMetaRow}>
          <Ionicons name="calendar-outline" size={14} color={textMuted} />
          <Text style={[styles.tripContextMetaText, { color: textMuted }]}>
            Salida: {fmtDate(selectedTrip.departureDate)} · {selectedTrip.departureTime || '—'}
          </Text>
        </View>
        {activeTrips.length > 1 ? (
          <TouchableOpacity
            onPress={() => setSelectedTripId(null)}
            style={styles.tripContextSwitchBtn}
            hitSlop={{ top: 8, bottom: 8 }}
          >
            <Text style={[styles.tripContextSwitchText, { color: accent }]}>Cambiar de viaje</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };
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
            <View style={[styles.pendingBadge, { backgroundColor: ui.invertBg }]}>
              <Text style={[styles.pendingBadgeText, { color: ui.invertText }]}>{pending} pendiente{pending > 1 ? 's' : ''}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={textMuted} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Solicitud (contenido sin tarjeta propia: va dentro de tarjeta unificada con el viaje) ─
  const renderRequestSection = (item) => {
    if (!item.passenger?._id) {
      return (
        <View style={styles.reqSectionPad}>
          <Text style={{ color: textMuted }}>Usuario no disponible</Text>
        </View>
      );
    }
    const avatarUrl = item.passenger?.avatar ? buildImageUri(item.passenger.avatar) : null;
    const resStatus = item.seatReservation?.reservationStatus || item.status;
    const status = getStatus(resStatus);
    const isPending = resStatus === 'pending_approval' || resStatus === 'pending';
    const amount = item.seatReservation?.reservationAmount;
    const seats = item.seatsBooked || item.seatsRequested;

    return (
      <View>
        <TouchableOpacity
          style={styles.passengerRow}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('UserProfile', { userId: item.passenger._id, tripId: selectedTripId })}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: ui.bg }]}>
              <Text style={[styles.avatarInitials, { color: textMuted }]}>
                {item.passenger?.firstName?.[0]}
                {item.passenger?.lastName?.[0]}
              </Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.passengerName, { color: textPrimary }]}>
              {item.passenger?.firstName} {item.passenger?.lastName}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: status.solid ? ui.invertBg : bg }]}>
              <Text style={[styles.statusPillText, { color: status.solid ? ui.invertText : textMuted }]}>
                {status.label}
              </Text>
            </View>
          </View>
          {amount != null && (
            <Text style={[styles.amountText, { color: textPrimary }]}>{fmtCurrency(amount)}</Text>
          )}
        </TouchableOpacity>

        <View style={[styles.metaRow, { borderTopColor: divider }]}>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>
              {seats} asiento{seats === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={[styles.metaItem, styles.metaHint]}>
            <Ionicons name="time-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>
              Solicitud: {fmtDate(item.createdAt)}
            </Text>
          </View>
        </View>

        {item.message && (
          <Text style={[styles.messageText, { color: textMuted, borderTopColor: divider }]} numberOfLines={3}>
            "{item.message}"
          </Text>
        )}

        {item.seatReservation?.pickupLocation?.address && (() => {
          const pickup = item.seatReservation.pickupLocation;
          const hasCoords = pickup.coordinates?.latitude != null;
          return (
            /* La fila entera es el botón, en vez de una píldora suelta adentro: así ocupa
               el ancho de la tarjeta como el resto de las filas y arranca en el mismo
               margen. El chevron es lo único que hace falta para decir que se toca. */
            <TouchableOpacity
              style={[styles.pickupRow, { borderTopColor: divider }]}
              onPress={hasCoords
                ? () => navigation.navigate('PickupMap', { coordinates: pickup.coordinates, address: pickup.address })
                : undefined}
              disabled={!hasCoords}
              activeOpacity={0.7}
            >
              <Ionicons name={hasCoords ? 'map-outline' : 'location-outline'} size={16} color={textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickupLabel, { color: textMuted }]}>Punto de recogida</Text>
                <Text style={[styles.pickupText, { color: textPrimary }]} numberOfLines={2}>
                  {pickup.address}
                </Text>
              </View>
              {hasCoords && <Ionicons name="chevron-forward" size={16} color={textMuted} />}
            </TouchableOpacity>
          );
        })()}

        {item.status === 'rejected' && item.rejectionReason && (
          <Text style={[styles.rejectionText, { borderTopColor: divider }]}>
            Razón: {item.rejectionReason}
          </Text>
        )}

        {isPending && (
          <View style={[styles.actionsRow, { borderTopColor: divider }]}>
            <TouchableOpacity
              style={[styles.btnReject, { backgroundColor: ui.surface }]}
              onPress={() => {
                setSelectedRequest(item._id);
                setRejectModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnRejectText, { color: isDarkMode ? ui.textMuted : ui.textMuted }]}>Rechazar</Text>
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

  const handleRequestsScroll = useCallback(
    (e) => {
      if (!selectedTripId || !reqHasMore || loadingMoreRequests || reqFetchLock.current || loadingRequests) return;
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const threshold = 220;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold) {
        loadRequests(reqPage + 1, { append: true });
      }
    },
    [
      selectedTripId,
      reqHasMore,
      loadingMoreRequests,
      loadingRequests,
      reqPage,
      loadRequests,
    ]
  );

  const listFooter = (loadingMore) =>
    loadingMore ? (
      <View style={{ paddingVertical: 20, alignItems: 'center', gap: 8 }}>
        <ActivityIndicator size="small" color={textMuted} />
        <Text style={{ fontSize: 13, color: textMuted }}>Cargando más…</Text>
      </View>
    ) : null;

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (!selectedTripId && loadingTrips && !refreshing) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={textMuted} />
      </View>
    );
  }

  if (selectedTripId && loadingRequests && !refreshing && requests.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={textMuted} />
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.screenHeader}>
        <Text style={[styles.screenTitle, { color: textPrimary }]}>
          Las reservas{'\n'}
          <Text style={styles.screenTitleStrong}>que recibiste</Text>
        </Text>
      </View>

      {/* Content */}
      {!selectedTripId && activeTrips.length > 0 ? (
        <FlatList
          data={activeTrips}
          keyExtractor={(item) => item._id}
          renderItem={renderTripCard}
          contentContainerStyle={styles.listPad}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textMuted} />}
          onEndReached={onTripsEndReached}
          onEndReachedThreshold={0.35}
          ListFooterComponent={listFooter(loadingMoreTrips)}
          ListHeaderComponent={
            <Text style={[styles.sectionLabel, { color: textMuted }]}>Selecciona un viaje</Text>
          }
        />
      ) : selectedTripId ? (
        <ScrollView
          contentContainerStyle={[
            styles.listPad,
            requests.length === 0 ? { flexGrow: 1 } : undefined,
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textMuted} />}
          onScroll={handleRequestsScroll}
          scrollEventThrottle={400}
        >
          <View style={[styles.unifiedCard, { backgroundColor: cardBg }]}>
            {renderTripContextBlock()}
            {requests.length > 0 && (
              <View style={[styles.inCardFullBleedLine, { backgroundColor: divider }]} />
            )}
            {requests.length === 0 ? (
              <EmptyState
                image={require('../../../../assets/icons/pngwing.com (20).png')}
                title="Sin solicitudes"
                subtitle="Cuando alguien quiera sumarse a este viaje, la solicitud va a aparecer acá."
              />
            ) : (
              requests.map((item, index) => (
                <View
                  key={item._id || item.id || String(index)}
                  style={
                    index > 0
                      ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: divider }
                      : undefined
                  }
                >
                  {renderRequestSection(item)}
                </View>
              ))
            )}
          </View>
          {listFooter(loadingMoreRequests)}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.centered, { flexGrow: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textMuted} />}
        >
          <EmptyState
            image={require('../../../../assets/icons/pngwing.com (20).png')}
            title="Sin viajes activos"
            subtitle="Creá un viaje para empezar a recibir solicitudes de otros pasajeros."
          />
        </ScrollView>
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
            <Text style={[styles.modalLabel, { color: textMuted }]}>Razón del rechazo (opcional)</Text>
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
  headerTitle: { fontSize: 20, fontFamily: 'Sora_700Bold' },
  headerSub:   { fontSize: 13, marginTop: 2 },

  listPad:      { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 13, marginBottom: 12 },

  // Mismo titulo grande que Mis Reservas, Viajes que ofreciste y Solicitudes abiertas.
  screenHeader:      { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 22 },
  screenTitle:       { fontFamily: 'Sora_300Light', fontSize: 32, lineHeight: 40, letterSpacing: -1 },
  screenTitleStrong: { fontFamily: 'Sora_800ExtraBold' },

  /** Viaje + solicitudes en una sola tarjeta. Mismo lenguaje que Mis Viajes y
   *  Viajes que ofreci: radio 24, sin borde, sombra apenas marcada. */
  unifiedCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  tripContextEmbedded: {
    padding: 14,
  },
  inCardFullBleedLine: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  emptyInsideCard: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 28,
  },

  tripContextLabel: {
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tripContextLine: {
    fontSize: 15,
    fontFamily: 'Sora_600SemiBold',
    lineHeight: 21,
  },
  tripContextMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  tripContextMetaText: { fontSize: 13 },
  tripContextSwitchBtn: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 2 },
  tripContextSwitchText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },

  emptyBlock: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  emptyBlockGrow: { flex: 1, justifyContent: 'center', paddingVertical: 48 },

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
  routeTextLabel: { fontSize: 11, fontFamily: 'Sora_500Medium', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  routeTextValue: { fontSize: 14, fontFamily: 'Sora_500Medium', lineHeight: 20 },
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pendingBadgeText: { fontSize: 12, fontFamily: 'Sora_600SemiBold' },

  reqSectionPad: {
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  avatarInitials: { fontSize: 16, fontFamily: 'Sora_600SemiBold' },
  passengerName:  { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
  // El chip apagado va sobre el fondo de pagina: la card ya es `surface`, pintarlo
  // del mismo color lo dejaba invisible.
  statusPill:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  statusPillText: { fontSize: 11, fontFamily: 'Sora_600SemiBold' },
  amountText:     { fontSize: 15, fontFamily: 'Sora_700Bold' },

  metaRow: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaHint: { flexShrink: 1 },
  metaText:  { fontSize: 13 },

  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pickupLabel: { fontSize: 11, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.4, marginBottom: 2 },
  pickupText: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: 'Sora_500Medium',
  },

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
    color: '#8A8A8E',
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
    fontFamily: 'Sora_600SemiBold',
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
    fontFamily: 'Sora_700Bold',
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  modalRejectBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#8A8A8E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalRejectText: { fontSize: 14, fontFamily: 'Sora_600SemiBold', color: '#FFFFFF' },

  // Empty
  emptyTitle:    { fontSize: 17, fontFamily: 'Sora_600SemiBold' },
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
  modalTitle:   { fontSize: 17, fontFamily: 'Sora_700Bold' },
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
