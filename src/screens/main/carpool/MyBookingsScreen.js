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
import { TripListSkeleton } from '../../../components/ui/TripCardSkeleton';
import { useMinDuration } from '../../../hooks/useMinDuration';
import { TAB_BAR_SPACE } from '../../../components/ui/FloatingTabBar';
import { reportError } from '../../../utils/sentry';
import { useTabBarScroll } from '../../../components/ui/tabBarScroll';

// historyMode: usado por HistoryScreen, que ya pone su propio switch Viajes/Solicitudes
// arriba. Ahí no tiene sentido otro título + otro toggle Próximas/Pasadas: el historial
// es, por definición, solo lo pasado.
const MyBookingsScreen = ({ navigation, historyMode = false }) => {
  const onTabBarScroll = useTabBarScroll();
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();

  const [bookings, setBookings]       = useState([]);
  const [activeTab, setActiveTab]     = useState(historyMode ? 'past' : 'upcoming');
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);
  const [loading, setLoading]         = useState(true);
  const showSkeleton = useMinDuration(loading);
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
    } catch (error) {
      reportError(error, { screen: 'MyBookingsScreen', action: 'loadBookings' });
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

  const handleCancelBooking = (bookingId, yaPagada) => {
    const mensaje = yaPagada
      ? 'Ya pagaste esta reserva. Si la cancelás no se te devuelve el dinero. ¿Cancelar de todas formas?'
      : '¿Estás seguro?';
    navigation.navigate('Confirm', {
      title: 'Cancelar reserva',
      message: mensaje,
      confirmLabel: 'Sí, cancelar',
      destructive: true,
      onConfirm: async () => {
        setCancellingId(bookingId);
        try {
          const response = await put_withauth(ENDPOINTS.CANCEL_BOOKING(bookingId));
          if (!response.success) throw new Error(response.message || 'Intentá de nuevo en un momento.');
          await loadMyBookings(1, true, { force: true });
        } finally {
          setCancellingId(null);
        }
      },
      successParams: { title: 'Reserva cancelada', message: 'Ya no tenés esa reserva activa.' },
      errorParams: { title: 'No se pudo cancelar' },
    });
  };

  /**
   * Próximos = lo que sigue en juego (pendiente, por pagar, pagada, en curso).
   * Pasados = lo terminado: completadas, canceladas y rechazadas. Mismo criterio que
   * Mis Viajes, que es la pantalla espejo del lado del conductor.
   */
  const esPasada = (item) => {
    const rs = item.seatReservation?.reservationStatus;
    if (['cancelled', 'rejected', 'expired', 'trip_completed'].includes(rs)) return true;
    if (['cancelled', 'completed'].includes(item.status)) return true;
    return item.trip?.status === 'completed' || item.trip?.status === 'cancelled';
  };

  const getStatusConfig = (item) => {
    const rs = item.seatReservation?.reservationStatus;
    if (rs === 'pending_approval') return { color: ui.textMuted, label: 'Pendiente' };
    if (rs === 'pending_payment')  return { color: ui.textMuted, label: 'Pendiente de pago' };
    // "Aprobada" y no "paga": con el modelo actual el pasajero no le paga nada a la app, le
    // paga directo al conductor el dia del viaje. Lo que este estado significa es que el
    // conductor la acepto. Mismo criterio que ya usaba el footer del detalle del viaje.
    if (rs === 'reserved')         return { color: ui.text, label: 'Reserva aprobada' };
    if (rs === 'cancelled')        return { color: ui.textMuted, label: 'Cancelado' };
    switch (item.status) {
      case 'pending':   return { color: ui.textMuted, label: 'Pendiente' };
      case 'confirmed': return { color: ui.text, label: 'Reserva aprobada' };
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

  /**
   * Ciudad y provincia, para la segunda línea de cada punto de la ruta. La dirección
   * guardada suele ser solo la calle ("1 de Mayo 447"), así que en el listado dos viajes
   * a ciudades distintas se leían idénticos. Se omite lo que ya venga escrito dentro de
   * la dirección, porque en algunos viajes sí viene incluida y quedaba repetido.
   */
  const formatArea = (location) => {
    if (!location) return '';
    const base = String(location.address || location.street || '').toLowerCase();
    return [location.city, location.province]
      .filter((part) => part && !base.includes(String(part).toLowerCase()))
      .join(', ');
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
    item.trip?.status !== 'started' && (
      item.seatReservation?.reservationStatus === 'pending_approval' ||
      item.seatReservation?.reservationStatus === 'pending_payment' ||
      item.seatReservation?.reservationStatus === 'reserved' ||
      item.status === 'pending' ||
      item.status === 'confirmed'
    );

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
            <View style={styles.routeTextCol}>
              <Text style={[styles.routeText, { color: activeTxt }]} numberOfLines={1}>
                {formatAddress(item.trip?.origin)}
              </Text>
              {!!formatArea(item.trip?.origin) && (
                <Text style={[styles.routeArea, { color: activeMuted }]} numberOfLines={1}>
                  {formatArea(item.trip?.origin)}
                </Text>
              )}
            </View>
          </View>
          <View style={[styles.routeConnector, { backgroundColor: activeTxt }]} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDotFilled, { backgroundColor: activeTxt }]} />
            <View style={styles.routeTextCol}>
              <Text style={[styles.routeText, { color: activeTxt }]} numberOfLines={1}>
                {formatAddress(item.trip?.destination)}
              </Text>
              {!!formatArea(item.trip?.destination) && (
                <Text style={[styles.routeArea, { color: activeMuted }]} numberOfLines={1}>
                  {formatArea(item.trip?.destination)}
                </Text>
              )}
            </View>
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
            {/* Rojo sólido siempre, sin importar canPay: es una acción destructiva, no una
                variante de "pagar" o "confirmar" que tenga sentido tintar con el tema. */}
            <TouchableOpacity
              style={[styles.btnSecondary, { backgroundColor: '#EF4444' }]}
              onPress={() => handleCancelBooking(item._id, item.seatReservation?.reservationStatus === 'reserved' || item.status === 'confirmed')}
              activeOpacity={0.8}
              disabled={cancellingId === item._id}
            >
              {cancellingId === item._id
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : (
                  <Text style={[styles.btnSecondaryText, { color: '#FFFFFF' }]}>
                    Cancelar reserva
                  </Text>
                )
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

  const visibles = bookings.filter((b) => (activeTab === 'past' ? esPasada(b) : !esPasada(b)));

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {!historyMode && (
        <>
          <View style={styles.screenHeader}>
            <Text style={[styles.screenTitle, { color: ui.text }]}>
              Los viajes{'\n'}
              <Text style={styles.screenTitleStrong}>que reservaste</Text>
            </Text>
          </View>

          {/* Tabs en pill, iguales a las de Mis Viajes: es la misma pantalla del otro lado. */}
          <View style={styles.tabsContainer}>
            <View style={[styles.tabPill, { backgroundColor: ui.surface }]}>
              {['upcoming', 'past'].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && { backgroundColor: ui.invertBg }]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, { color: activeTab === tab ? ui.invertText : ui.textMuted }]}>
                    {tab === 'upcoming' ? 'Próximas' : 'Pasadas'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}

      {showSkeleton ? (
        <TripListSkeleton />
      ) : visibles.length > 0 ? (
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
          data={[...visibles].sort((a, b) => {
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
          onScroll={onTabBarScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.list, historyMode && { paddingBottom: TAB_BAR_SPACE + 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textSecondary} />
          }
        />
      ) : (
        <View style={styles.empty}>
          <EmptyState
            image={require('../../../../assets/icons/pngwing.com (20).png')}
            title={activeTab === 'past' ? 'Sin reservas pasadas' : 'Sin reservas próximas'}
            subtitle={activeTab === 'past'
              ? 'Acá van a aparecer las que se completen o canceles'
              : 'Cuando reserves un viaje aparecerá aquí'}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabsContainer: { paddingHorizontal: 24, paddingBottom: 8 },
  tabPill: { flexDirection: 'row', borderRadius: 999, padding: 5 },
  tab: { flex: 1, paddingVertical: 11, borderRadius: 999, alignItems: 'center' },
  tabText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
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
    borderRadius: 24,
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
  // Une los dos puntos del recorrido, así que va del color de los puntos y no del de los
  // separadores: con el color de divisor quedaba una línea blanca sobre la tarjeta gris.
  routeConnector: { width: 1.5, height: 20, marginLeft: 4, marginVertical: 3 },
  routeTextCol: { flex: 1, gap: 2 },
  routeText: { fontSize: 14, fontFamily: 'Sora_500Medium' },
  routeArea: { fontSize: 12, fontFamily: 'Sora_400Regular' },

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
  // Pill como el resto del rediseño. El radio 10 anterior chocaba con las esquinas
  // redondeadas de la tarjeta y el bloque con borde a todo el ancho pesaba más que el
  // contenido: cancelar es la salida, no la acción principal, y ahora se ve como tal.
  btnPrimary: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  btnPrimaryText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  // Sólido con el color invertido del tema —blanco en oscuro, negro en claro—, como el resto
  // de los botones de la app. Sólo pasa a contorno cuando en la misma tarjeta está "Ir a
  // pagar", que ya es sólido: dos botones idénticos ahí no dejarían ver cuál es cuál.
  btnSecondary: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  btnSecondaryText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Sora_600SemiBold', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

export default MyBookingsScreen;
