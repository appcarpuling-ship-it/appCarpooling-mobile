import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { get_withauth, put_withauth, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import socketService from '../../../services/socketService';
import { useUI } from '../../../theme/ui';
import EmptyState from '../../../components/ui/EmptyState';

const MyBookingsScreen = ({ navigation }) => {
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();

  const [bookings, setBookings]       = useState([]);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const fetchingRef = useRef(false);
  const pulseDot = useRef(new Animated.Value(1)).current;


  const ui = useUI();

  // Flecha de volver garantizada: si la pantalla queda como raíz (ej. deep-link
  // de pago) canGoBack es false y el header por defecto no dibujaba flecha.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Carpoolings'))}
          style={{ marginLeft: 8, paddingVertical: 10, paddingRight: 10, paddingLeft: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="chevron-back" size={26} color={ui.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, ui.text]);

  const bg = ui.bg;
  const cardBg = ui.surface;
  const border = ui.border;
  const textPrimary = ui.invertBg;
  const textSecondary = ui.textMuted;
  const divider = ui.bg;

  useEffect(() => {
    setupTripCancellationListener();
    return () => cleanupListeners();
  }, []);

  useEffect(() => {
    const hasActive = bookings.some(b => b.trip?.status === 'started');
    if (!hasActive) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseDot, { toValue: 0.25, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseDot, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [bookings]);

  useFocusEffect(
    useCallback(() => {
      loadMyBookings(1, true, { force: true });
    }, [])
  );

  const setupTripCancellationListener = () => {
    const handleTripCancelled = (data) => {
      setBookings((prev) => {
        let hasUpdates = false;
        const updated = prev.map((booking) => {
          const tripId = booking.trip?._id || booking.trip;
          if (tripId === data.tripId) {
            hasUpdates = true;
            return { ...booking, status: 'cancelled', cancelReason: data.reason || 'Viaje cancelado por el conductor' };
          }
          return booking;
        });
        if (hasUpdates) setTimeout(() => loadMyBookings(1, true), 1000);
        return updated;
      });
    };

    if (!socketService.isConnected) socketService.connect();
    if (socketService.socket) socketService.socket.on('trip:cancelled', handleTripCancelled);
  };

  const cleanupListeners = () => {
    if (socketService.socket) socketService.socket.off('trip:cancelled');
  };

  const loadMyBookings = async (pageNum = 1, reset = false, opts = {}) => {
    const force = !!opts.force;
    if (!force && fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const response = await get_withauth(ENDPOINTS.MY_BOOKINGS, { page: pageNum, limit: LIST_PAGE_SIZE });
      if (response.success) {
        setBookings(prev => reset ? response.data : [...prev, ...response.data]);
        setPage(pageNum);
        setHasMore(response.hasMore ?? false);
      }
    } catch {
      showAlert('Ocurrió algo', 'No se pudieron cargar las reservas');
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMyBookings(1, true);
  };

  const onEndReached = () => {
    if (!hasMore || loadingMore || fetchingRef.current) return;
    setLoadingMore(true);
    loadMyBookings(page + 1, false);
  };

  const handleCancelBooking = (bookingId) => {
    showAlert('Cancelar reserva', '¿Estás seguro?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          setCancellingId(bookingId);
          try {
            const response = await put_withauth(ENDPOINTS.CANCEL_BOOKING(bookingId));
            if (!response.success) {
              showAlert(
                'No se pudo cancelar',
                response.message || 'Intentá de nuevo en un momento.'
              );
              return;
            }
            await loadMyBookings(1, true, { force: true });
            navigation.navigate('Result', { type: 'success', title: 'Reserva cancelada', message: 'Ya no tenés esa reserva activa.' });
          } catch (error) {
            showAlert('Ocurrió algo', error.message || 'No se pudo cancelar.');
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  };

  const getStatusConfig = (item) => {
    const rs = item.seatReservation?.reservationStatus;
    if (rs === 'pending_approval') return { color: ui.textMuted, label: 'Pendiente' };
    if (rs === 'pending_payment')  return { color: ui.textMuted, label: 'Pendiente de pago' };
    if (rs === 'reserved')         return { color: ui.text, label: 'Reserva paga' };
    if (rs === 'cancelled')        return { color: ui.textMuted, label: 'Cancelado' };
    switch (item.status) {
      case 'pending':   return { color: ui.textMuted, label: 'Pendiente' };
      case 'confirmed': return { color: ui.text, label: 'Reserva paga' };
      case 'cancelled': return { color: ui.textMuted, label: 'Cancelado' };
      case 'completed': return { color: ui.text, label: 'Completado' };
      default:          return { color: textSecondary, label: item.status };
    }
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

  const formatAddress = (location) => {
    if (!location) return '';
    let raw = location.address || location.street || '';
    raw = raw.replace(/, [A-Z][0-9]{4}[A-Z0-9]{0,3}\s+/g, ', ');
    return raw || location.city || location.name || '';
  };

  const getStatusPriority = (item) => {
    const rs = item.seatReservation?.reservationStatus;
    if (rs === 'pending_payment')  return 0;
    if (rs === 'pending_approval') return 1;
    if (rs === 'reserved')         return 2;
    if (rs === 'rejected')         return 3;
    if (rs === 'cancelled')        return 4;
    // viaje en curso tiene prioridad máxima
    if (item.trip?.status === 'started') return 0;
    // sin seatReservation, usar booking.status
    switch (item.status) {
      case 'pending':   return 1;
      case 'confirmed': return 2;
      case 'completed': return 3;
      case 'cancelled': return 4;
      default:          return 5;
    }
  };

  const canCancel = (item) =>
    item.seatReservation?.reservationStatus === 'pending_approval' ||
    item.seatReservation?.reservationStatus === 'pending_payment' ||
    (item.status === 'pending' && !item.seatReservation);

  const canPay = (item) =>
    item.seatReservation?.reservationStatus === 'pending_payment' ||
    (item.status === 'pending' && !item.seatReservation);

  const renderItem = ({ item }) => {
    if (!item.trip?.driver?.firstName) return null;
    const { color, label } = getStatusConfig(item);
    const driver = item.trip.driver;
    const seats = item.seats || item.seatsBooked || 1;
    const isActive = item.trip?.status === 'started';
    const activeBg      = isDarkMode ? '#111111' : '#FFFFFF';
    const activeBorder  = isActive ? ui.textMuted : border;
    const activeTxt     = isActive ? (isDarkMode ? '#FFFFFF' : textPrimary) : textPrimary;
    const activeMuted   = isActive ? (isDarkMode ? 'rgba(255,255,255,0.5)' : textSecondary) : textSecondary;
    const activeDivider = isActive ? (isDarkMode ? '#333333' : divider) : divider;
    const activeLabelColor = isDarkMode ? 'rgba(255,255,255,0.6)' : textSecondary;

    return (
      <View style={styles.cardWrapper}>
        <TouchableOpacity
          style={[
            styles.card,
            isActive
              ? { backgroundColor: activeBg, borderColor: activeBorder, borderWidth: 1, shadowOpacity: 0.15, elevation: 4 }
              : { backgroundColor: cardBg, borderColor: border },
          ]}
          onPress={() => navigation.navigate('TripDetailFromCarpoolings', { tripId: item.trip?._id })}
          activeOpacity={0.7}
        >
          {/* Status */}
          {isActive ? (
            <View style={[styles.activeHeader, { borderBottomColor: activeDivider }]}>
              <Animated.View style={[styles.activePulseDot, { opacity: pulseDot }]} />
              <Text style={[styles.activeLabel, { color: activeLabelColor }]}>Viaje en curso</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: color + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: color }]} />
              <Text style={[styles.statusText, { color }]}>{label}</Text>
            </View>
          )}

        {/* Route */}
        <View style={styles.route}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDotOutline, { borderColor: activeTxt }]} />
            <Text style={[styles.routeText, { color: activeTxt }]} numberOfLines={1}>
              {formatAddress(item.trip?.origin)}
            </Text>
          </View>
          <View style={[styles.routeConnector, { backgroundColor: activeDivider }]} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDotFilled, { backgroundColor: activeTxt }]} />
            <Text style={[styles.routeText, { color: activeTxt }]} numberOfLines={1}>
              {formatAddress(item.trip?.destination)}
            </Text>
          </View>
        </View>

        {/* Meta */}
        <View style={[styles.meta, { borderTopColor: activeDivider, borderBottomColor: activeDivider }]}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={activeMuted} />
            <Text style={[styles.metaText, { color: activeMuted }]}>{formatDate(item.trip?.departureDate)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={activeMuted} />
            <Text style={[styles.metaText, { color: activeMuted }]}>{item.trip?.departureTime}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={14} color={activeMuted} />
            <Text style={[styles.metaText, { color: activeMuted }]}>
              {seats} asiento{seats !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Driver */}
        <View style={styles.driver}>
          {driver.avatar ? (
            <Image source={{ uri: buildImageUri(driver.avatar) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#333' : '#EFEFEF' }]}>
              <Text style={[styles.avatarInitials, { color: activeTxt }]}>
                {driver.firstName[0]}{driver.lastName[0]}
              </Text>
            </View>
          )}
          <View style={styles.driverInfo}>
            <Text style={[styles.driverName, { color: activeTxt }]}>{driver.firstName} {driver.lastName}</Text>
            <Text style={[styles.driverLabel, { color: activeMuted }]}>Conductor</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={isActive ? (isDarkMode ? 'rgba(255,255,255,0.3)' : ui.textMuted) : (ui.textMuted)} />
        </View>

        {/* Actions */}
        {canCancel(item) && (
          <View style={styles.actions}>
            {canPay(item) && (
              <TouchableOpacity
                style={[styles.btnPrimary, { backgroundColor: isActive ? '#FFFFFF' : textPrimary }]}
                onPress={() => navigation.navigate('TripDetailFromCarpoolings', { tripId: item.trip?._id, openPayment: true })}
                activeOpacity={0.8}
              >
                <Text style={[styles.btnPrimaryText, { color: isActive ? '#000' : (isDarkMode ? '#000' : '#FFF') }]}>Ir a pagar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.btnSecondary, { borderColor: isActive ? (isDarkMode ? '#555' : ui.textMuted) : (ui.textMuted) }]}
              onPress={() => handleCancelBooking(item._id)}
              activeOpacity={0.7}
              disabled={cancellingId === item._id}
            >
              {cancellingId === item._id
                ? <ActivityIndicator size="small" color={activeTxt} />
                : <Text style={[styles.btnSecondaryText, { color: activeTxt }]}>Cancelar reserva</Text>
              }
            </TouchableOpacity>
          </View>
        )}
        </TouchableOpacity>
        {isActive && (
          <Animated.View pointerEvents="none" style={[styles.activeRing, { opacity: pulseDot }]} />
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={textPrimary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.screenHeader}>
        <Text style={[styles.screenTitle, { color: ui.text }]}>
          Los viajes{'\n'}
          <Text style={styles.screenTitleStrong}>que reservaste</Text>
        </Text>
      </View>

      {bookings.length > 0 ? (
        <FlatList
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.listFooterLoader}>
                <ActivityIndicator size="small" color={textPrimary} />
                <Text style={[styles.listFooterText, { color: textSecondary }]}>Cargando más…</Text>
              </View>
            ) : null
          }
          data={[...bookings].sort((a, b) => {
            const pa = getStatusPriority(a);
            const pb = getStatusPriority(b);
            if (pa !== pb) return pa - pb;
            // mismo estado → viaje más próximo primero
            const da = new Date(a.trip?.departureDate || 0).getTime();
            const db = new Date(b.trip?.departureDate || 0).getTime();
            return da - db;
          })}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textSecondary} />
          }
        />
      ) : (
        <View style={styles.empty}>
          <EmptyState
            image={require('../../../../assets/icons/pngwing.com (20).png')}
            title="Sin reservas"
            subtitle="Cuando reserves un viaje aparecerá aquí"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenHeader:      { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 22 },
  screenTitle:       { fontFamily: 'Sora_300Light', fontSize: 32, lineHeight: 40, letterSpacing: -1 },
  screenTitleStrong: { fontFamily: 'Sora_800ExtraBold' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  listFooterLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  listFooterText: { fontSize: 13 },

  cardWrapper: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  activeRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: '#8A8A8E',
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000000',
  },
  activeLabel: {
    fontSize: 11,
    fontFamily: 'Sora_700Bold',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    margin: 16,
    marginBottom: 0,
    gap: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: 'Sora_600SemiBold' },

  route: { padding: 16, paddingBottom: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeDotOutline: {
    width: 10, height: 10, borderRadius: 5, borderWidth: 2,
  },
  routeDotFilled: { width: 10, height: 10, borderRadius: 5 },
  routeConnector: { width: 1.5, height: 20, marginLeft: 4, marginVertical: 3 },
  routeText: { flex: 1, fontSize: 14, fontFamily: 'Sora_500Medium' },

  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13 },

  driver: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitials: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  driverLabel: { fontSize: 12, marginTop: 2 },

  actions: {
    padding: 16,
    paddingTop: 0,
    gap: 10,
  },
  btnPrimary: {
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrimaryText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  btnSecondary: {
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  btnSecondaryText: { fontSize: 14, fontFamily: 'Sora_500Medium' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Sora_600SemiBold', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

export default MyBookingsScreen;
