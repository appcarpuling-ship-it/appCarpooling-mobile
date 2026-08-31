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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import {
  getStatus,
  estadoDe,
  esperandoRespuesta,
  seatsLabelEs,
  fmtDate,
  fmtCuando,
  partirDesvio,
} from '../../../utils/solicitudes';

const TripRequestsScreen = ({ route }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
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

  const handleAccept = (request) => {
    const requestId = request._id || request.id;
    const isSeatReservation = request.bookingType === 'seat_reservation';
    const seatReservationId = request.seatReservation?._id || request.seatReservation?.id;

    const successParams = isSeatReservation && seatReservationId
      ? { title: 'Aprobado', message: 'El pasajero recibirá una notificación para completar el pago.' }
      : { title: 'Solicitud aceptada', message: 'La solicitud fue aceptada correctamente.' };

    navigation.navigate('Confirm', {
      title: 'Aceptar solicitud',
      message: `¿Aceptar ${seatsLabelEs(request.seatsBooked || request.seatsRequested)}?`,
      confirmLabel: 'Aceptar',
      onConfirm: async () => {
        setAcceptingRequestId(requestId);
        try {
          if (isSeatReservation && seatReservationId) {
            const res = await approveOrRejectReservation(seatReservationId, 'approve');
            if (!res.success) throw new Error(res.message || 'No se pudo aprobar la solicitud');
          } else {
            const res = await put_withauth(`/bookings/${requestId}/confirm`);
            if (!res.success) throw new Error(res.message || 'No se pudo aprobar la solicitud');
          }
          loadRequests(1, { append: false });
        } finally {
          setAcceptingRequestId(null);
        }
      },
      successParams,
      errorParams: { title: 'Error' },
    });
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

  const activeTrips = trips.filter((t) => t.status === 'active' || t.status === 'started');

  const pendientes = useMemo(
    () => requests.filter((r) => esperandoRespuesta(estadoDe(r))),
    [requests],
  );
  const resueltas = useMemo(
    () => requests.filter((r) => !esperandoRespuesta(estadoDe(r))),
    [requests],
  );

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
        <View style={[styles.tripContextEmbedded, { borderBottomColor: divider }]}>
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

    // Sin repetir lo que la dirección ya dice: cuando el viaje se creó eligiendo una ciudad,
    // `address` ES la ciudad, y al pegarle ciudad + provincia quedaba
    // "Concordia, Entre Ríos, Concordia, Entre Ríos".
    const fmtFull = (loc) => {
      const partes = [fmtAddress(loc?.address, loc?.city)].filter(Boolean);
      for (const extra of [loc?.city, loc?.province]) {
        if (!extra) continue;
        if (partes.join(', ').toLowerCase().includes(extra.toLowerCase())) continue;
        partes.push(extra);
      }
      return partes.join(', ');
    };
    const o = fmtFull(selectedTrip.origin);
    const d = fmtFull(selectedTrip.destination);
    return (
      <View style={[styles.tripContextEmbedded, { borderBottomColor: divider }]}>
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

  // ─── Una fila de la bandeja ───────────────────────────────────────────────
  /**
   * Lo mínimo para saber si le podés decir que sí: quién es, cuánto ocupa, hace cuánto que
   * espera y cuánto te saca del camino. Todo lo demás —el mensaje, las direcciones enteras,
   * el mapa y los botones— vive en la ficha, que se abre tocando la fila.
   */
  const renderRequestRow = (item, esUltima) => {
    const id = item._id || item.id;
    if (!item.passenger?._id) {
      return (
        <View key={id} style={styles.fila}>
          <Text style={{ color: textMuted }}>Usuario no disponible</Text>
        </View>
      );
    }
    const rs = estadoDe(item);
    const pendiente = esperandoRespuesta(rs);
    const status = getStatus(rs);
    const seats = item.seatsBooked || item.seatsRequested;
    const avatarUrl = item.passenger?.avatar ? buildImageUri(item.passenger.avatar) : null;
    const desvio = pendiente ? partirDesvio(item.desvioEtiqueta) : null;

    return (
      <TouchableOpacity
        key={id}
        style={[styles.fila, !esUltima && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider }]}
        onPress={() =>
          navigation.navigate('RequestDetail', {
            request: item,
            tripId: selectedTripId,
            // Los resuelve la bandeja y no la ficha: el diálogo de confirmar y el cuadro del
            // motivo viven acá, con el estado de la lista que hay que recargar después.
            onAceptar: () => handleAccept(item),
            onRechazar: () => { setSelectedRequest(id); setRejectModalVisible(true); },
          })
        }
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={`Solicitud de ${item.passenger?.firstName || 'un pasajero'}`}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarFila} />
        ) : (
          <View style={[styles.avatarPlaceholder, styles.avatarFila, { backgroundColor: bg }]}>
            <Text style={[styles.avatarInitials, { color: textMuted }]}>
              {item.passenger?.firstName?.[0]}{item.passenger?.lastName?.[0]}
            </Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={[styles.filaNombre, { color: textPrimary }]} numberOfLines={1}>
            {item.passenger?.firstName} {item.passenger?.lastName}
          </Text>
          <Text style={[styles.filaSub, { color: textMuted }]} numberOfLines={1}>
            {seatsLabelEs(seats)} · {fmtCuando(item.createdAt)}
          </Text>
        </View>

        {desvio ? (
          <View style={styles.filaDesvio}>
            <Text style={[styles.filaDesvioFuerte, { color: textPrimary }]}>{desvio.fuerte}</Text>
            {!!desvio.pie && <Text style={[styles.filaDesvioPie, { color: textMuted }]}>{desvio.pie}</Text>}
          </View>
        ) : (
          <View style={[styles.statusPill, { backgroundColor: status.solid ? accent : bg }]}>
            <Text style={[styles.statusPillText, { color: status.solid ? accentInv : textMuted }]}>
              {status.label}
            </Text>
          </View>
        )}

        <Ionicons name="chevron-forward" size={16} color={textMuted} />
      </TouchableOpacity>
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
          {renderTripContextBlock()}

          {requests.length === 0 ? (
            <EmptyState
              image={require('../../../../assets/icons/pngwing.com (20).png')}
              title="Sin solicitudes"
              subtitle="Cuando alguien quiera sumarse a este viaje, la solicitud va a aparecer acá."
            />
          ) : (
            /* Dos grupos, y el que te está esperando va primero: en una bandeja lo único
               urgente es lo que todavía no respondiste. Las resueltas quedan abajo, como
               historial, sin desaparecer. */
            [
              { clave: 'pendientes', titulo: 'Te están esperando', filas: pendientes },
              { clave: 'resueltas', titulo: 'Ya resueltas', filas: resueltas },
            ]
              .filter((g) => g.filas.length > 0)
              .map((g) => (
                <View key={g.clave} style={styles.grupo}>
                  <View style={styles.grupoHead}>
                    <Text style={[styles.grupoTitulo, { color: textMuted }]}>{g.titulo}</Text>
                    {g.clave === 'pendientes' && (
                      <View style={[styles.grupoCuenta, { backgroundColor: accent }]}>
                        <Text style={[styles.grupoCuentaText, { color: accentInv }]}>{g.filas.length}</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.lista, { backgroundColor: cardBg, borderColor: border }]}>
                    {g.filas.map((item, i) => renderRequestRow(item, i === g.filas.length - 1))}
                  </View>
                </View>
              ))
          )}
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
  listPad:      { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 13, marginBottom: 12 },

  // Mismo titulo grande que Mis Reservas, Viajes que ofreciste y Solicitudes abiertas.
  screenHeader:      { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 22 },
  screenTitle:       { fontFamily: 'Sora_300Light', fontSize: 32, lineHeight: 40, letterSpacing: -1 },
  screenTitleStrong: { fontFamily: 'Sora_800ExtraBold' },
  tripCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  // Bandeja: un grupo por estado, y dentro una lista de filas separadas por un pelo.
  grupo: { marginBottom: 22 },
  grupoHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingHorizontal: 4 },
  grupoTitulo: { fontFamily: 'Sora_600SemiBold', fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase' },
  grupoCuenta: { minWidth: 20, height: 20, borderRadius: 999, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  grupoCuentaText: { fontFamily: 'Sora_700Bold', fontSize: 11 },
  lista: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },

  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  avatarFila: { width: 38, height: 38, borderRadius: 999 },
  filaNombre: { fontFamily: 'Sora_600SemiBold', fontSize: 14.5 },
  filaSub: { fontFamily: 'Sora_400Regular', fontSize: 11.5, marginTop: 2 },
  // El número del desvío alineado a la derecha y en negrita, con la aclaración abajo: es el
  // dato que decide, y suelto en una línea de texto chico se perdía.
  filaDesvio: { alignItems: 'flex-end' },
  filaDesvioFuerte: { fontFamily: 'Sora_600SemiBold', fontSize: 12.5 },
  filaDesvioPie: { fontFamily: 'Sora_400Regular', fontSize: 10, marginTop: 1 },

  // Ficha
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: { flex: 1 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },

  // Header
  // Encabezado del viaje: ya no vive dentro de una tarjeta, es la cabecera de la bandeja.
  // La línea de abajo lo separa de los grupos sin necesidad de encerrarlo en otra caja.
  tripContextEmbedded: {
    paddingHorizontal: 4,
    paddingBottom: 16,
    marginBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  // El chip apagado va sobre el fondo de pagina: la card ya es `surface`, pintarlo
  // del mismo color lo dejaba invisible.
  statusPill:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  statusPillText: { fontSize: 11, fontFamily: 'Sora_600SemiBold' },

  // El recorrido de la solicitud, en su propia sub-tarjeta: se distingue del resto de la card.



  // Rechazar con contorno en vez de gris sobre gris: como estaba parecía deshabilitado.
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
