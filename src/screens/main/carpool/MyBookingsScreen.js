import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { get_withauth, put_withauth, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import socketService from '../../../services/socketService';

const MyBookingsScreen = ({ navigation }) => {
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();

  const [bookings, setBookings]       = useState([]);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const fetchingRef = useRef(false);

  const bg = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg = isDarkMode ? '#222222' : '#FFFFFF';
  const border = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textSecondary = isDarkMode ? '#9CA3AF' : '#6B7280';
  const divider = isDarkMode ? '#2A2A2A' : '#F0F0F0';

  useEffect(() => {
    loadMyBookings(1, true);
    setupTripCancellationListener();
    return () => cleanupListeners();
  }, []);

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
      showAlert('Error', 'No se pudieron cargar las reservas');
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
          try {
            const response = await put_withauth(ENDPOINTS.CANCEL_BOOKING(bookingId));
            if (!response.success) {
              showAlert(
                'No se pudo cancelar',
                response.message || 'Intentá de nuevo en un momento.'
              );
              return;
            }
            showAlert('Reserva cancelada', 'Ya no tenés esa reserva activa.');
            await loadMyBookings(1, true, { force: true });
          } catch (error) {
            showAlert('Error', error.message || 'No se pudo cancelar.');
          }
        },
      },
    ]);
  };

  const getStatusConfig = (item) => {
    const rs = item.seatReservation?.reservationStatus;
    if (rs === 'pending_approval') return { color: '#F59E0B', label: 'Pendiente' };
    if (rs === 'pending_payment')  return { color: '#F59E0B', label: 'Pendiente de pago' };
    if (rs === 'reserved')         return { color: '#10B981', label: 'Reserva paga' };
    if (rs === 'cancelled')        return { color: '#EF4444', label: 'Cancelado' };
    switch (item.status) {
      case 'pending':   return { color: '#F59E0B', label: 'Pendiente' };
      case 'confirmed': return { color: '#10B981', label: 'Reserva paga' };
      case 'cancelled': return { color: '#EF4444', label: 'Cancelado' };
      case 'completed': return { color: '#3B82F6', label: 'Completado' };
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

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
        onPress={() => navigation.navigate('TripDetailFromCarpoolings', { tripId: item.trip?._id })}
        activeOpacity={0.7}
      >
        {/* Status */}
        <View style={[styles.statusBadge, { backgroundColor: color + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={[styles.statusText, { color }]}>{label}</Text>
        </View>

        {/* Route */}
        <View style={styles.route}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDotOutline, { borderColor: textPrimary }]} />
            <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={1}>
              {formatAddress(item.trip?.origin)}
            </Text>
          </View>
          <View style={[styles.routeConnector, { backgroundColor: isDarkMode ? '#444' : '#D0D0D0' }]} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDotFilled, { backgroundColor: textPrimary }]} />
            <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={1}>
              {formatAddress(item.trip?.destination)}
            </Text>
          </View>
        </View>

        {/* Meta */}
        <View style={[styles.meta, { borderTopColor: divider, borderBottomColor: divider }]}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={textSecondary} />
            <Text style={[styles.metaText, { color: textSecondary }]}>{formatDate(item.trip?.departureDate)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={textSecondary} />
            <Text style={[styles.metaText, { color: textSecondary }]}>{item.trip?.departureTime}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={14} color={textSecondary} />
            <Text style={[styles.metaText, { color: textSecondary }]}>
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
              <Text style={[styles.avatarInitials, { color: textPrimary }]}>
                {driver.firstName[0]}{driver.lastName[0]}
              </Text>
            </View>
          )}
          <View style={styles.driverInfo}>
            <Text style={[styles.driverName, { color: textPrimary }]}>{driver.firstName} {driver.lastName}</Text>
            <Text style={[styles.driverLabel, { color: textSecondary }]}>Conductor</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#555' : '#CCC'} />
        </View>

        {/* Actions */}
        {canCancel(item) && (
          <View style={styles.actions}>
            {canPay(item) && (
              <TouchableOpacity
                style={[styles.btnPrimary, { backgroundColor: textPrimary }]}
                onPress={() => navigation.navigate('TripDetailFromCarpoolings', { tripId: item.trip?._id, openPayment: true })}
                activeOpacity={0.8}
              >
                <Text style={[styles.btnPrimaryText, { color: isDarkMode ? '#000' : '#FFF' }]}>Ir a pagar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.btnSecondary, { borderColor: isDarkMode ? '#666666' : '#888888' }]}
              onPress={() => handleCancelBooking(item._id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnSecondaryText, { color: textPrimary }]}>Cancelar reserva</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
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
          <View style={[styles.emptyIconBox, { backgroundColor: isDarkMode ? '#222' : '#EFEFEF' }]}>
            <Ionicons name="calendar-outline" size={36} color={textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>Sin reservas</Text>
          <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
            Cuando reserves un viaje aparecerá aquí
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  listFooterLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  listFooterText: { fontSize: 13 },

  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
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
  statusText: { fontSize: 12, fontWeight: '600' },

  route: { padding: 16, paddingBottom: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeDotOutline: {
    width: 10, height: 10, borderRadius: 5, borderWidth: 2,
  },
  routeDotFilled: { width: 10, height: 10, borderRadius: 5 },
  routeConnector: { width: 1.5, height: 20, marginLeft: 4, marginVertical: 3 },
  routeText: { flex: 1, fontSize: 14, fontWeight: '500' },

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
  avatarInitials: { fontSize: 14, fontWeight: '600' },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 14, fontWeight: '600' },
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
  btnPrimaryText: { fontSize: 14, fontWeight: '600' },
  btnSecondary: {
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  btnSecondaryText: { fontSize: 14, fontWeight: '500' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

export default MyBookingsScreen;
