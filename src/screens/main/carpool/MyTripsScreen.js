import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { get_withauth, put_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import { useColors } from '../../../hooks/useColors';
import { tripDisplaySeats, tripSeatsLabel } from '../../../utils/tripSeatsDisplay';
import { reportError } from '../../../utils/sentry';
import { isTripToday } from '../../../utils/tripDateUtils';
import { useUI } from '../../../theme/ui';

const MyTripsScreen = ({ navigation }) => {
  const ui = useUI();
  const { refreshUser } = useAuth();
  const { showAlert } = useAlert();
  const { colors, isDarkMode } = useColors();
  const [trips, setTrips]           = useState([]);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab]   = useState('upcoming');
  const fetchingRef = useRef(false);
  const pulseDot = useRef(new Animated.Value(1)).current;
  const [startingTripId, setStartingTripId] = useState(null);

  useEffect(() => {
    loadMyTrips(1, true);
  }, []);

  useEffect(() => {
    const hasActive = trips.some(t => t.status === 'started');
    if (!hasActive) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseDot, { toValue: 0.25, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseDot, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [trips]);

  useFocusEffect(
    useCallback(() => {
      loadMyTrips(1, true);
    }, [activeTab])
  );

  const loadMyTrips = async (pageNum = 1, reset = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const response = await get_withauth(ENDPOINTS.MY_TRIPS_DRIVER, { page: pageNum, limit: LIST_PAGE_SIZE });
      if (response.success) {
        setTrips(prev => reset ? response.data : [...prev, ...response.data]);
        setPage(pageNum);
        setHasMore(response.hasMore ?? false);
      }
    } catch (error) {
      reportError(error, { screen: 'MyTripsScreen', action: 'loadTrips' });
      showAlert('Ocurrió algo', 'No se pudieron cargar los viajes');
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMyTrips(1, true);
  };

  const onEndReached = () => {
    if (!hasMore || loadingMore || fetchingRef.current) return;
    setLoadingMore(true);
    loadMyTrips(page + 1, false);
  };

  const formatAddress = (location) => {
    if (!location) return '';
    let raw = location.address || location.street || '';
    raw = raw.replace(/, [A-Z][0-9]{4}[A-Z0-9]{0,3}\s+/g, ', ');
    const city = location.city || location.name || '';
    const province = location.province || '';
    // Si raw ya contiene ciudad y provincia (ej: "Bolivia, Concordia, Entre Ríos, Argentina"), no duplicar
    const rawLower = raw.toLowerCase();
    const cityInRaw = city && rawLower.includes(city.toLowerCase());
    const provinceInRaw = province && rawLower.includes(province.toLowerCase());
    if (cityInRaw && (provinceInRaw || !province)) {
      return raw.replace(/,?\s*Argentina\s*$/i, '').replace(/,\s*$/, '').trim();
    }
    return [raw, city, province].filter(Boolean).join(', ');
  };

  // handleCancelTrip movido a TripDetailScreen

  const handleStartTrip = (tripId) => {
    showAlert(
      'Iniciar Viaje',
      'Los pasajeros seran notificados.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Si, iniciar',
          onPress: async () => {
            setStartingTripId(tripId);
            try {
              const response = await put_withauth(ENDPOINTS.START_TRIP(tripId));
              if (response.success) {
                // El listado se recarga acá y no al volver: cuando el usuario cierra la
                // pantalla de resultado, el viaje ya tiene que figurar como en curso.
                loadMyTrips(1, true);
                navigation.navigate('Result', {
                  type: 'success',
                  title: 'Viaje iniciado',
                  message: 'Avisamos a los pasajeros que ya saliste.',
                  primaryLabel: 'Continuar',
                });
              } else {
                navigation.navigate('Result', {
                  type: 'error',
                  title: 'No se pudo iniciar',
                  message: response.message || 'Probá de nuevo en un momento.',
                });
              }
            } catch (error) {
              navigation.navigate('Result', {
                type: 'error',
                title: 'No se pudo iniciar',
                message: error.message || 'Probá de nuevo en un momento.',
                error,
              });
            } finally {
              setStartingTripId(null);
            }
          },
        },
      ]
    );
  };

  const formatNumber = (num) => {
    if (typeof num !== 'number') num = parseFloat(num);
    if (isNaN(num)) return num;
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleCompleteTrip = (tripId, totalSeats) => {
    navigation.navigate('CompleteTrip', {
      onSubmit: (data) => submitCompleteTrip(tripId, data),
      totalSeats,
    });
  };

  const submitCompleteTrip = async (tripId, { costBreakdown, driverPay }) => {
    try {
      const response = await put_withauth(ENDPOINTS.COMPLETE_TRIP(tripId), { costBreakdown, driverPay });
      if (response.success) {
        const updatedTrip = response.data?.trip || response.data;
        await loadMyTrips(1, true);
        await refreshUser();
        return { ok: true, message: `Costo final: $${formatNumber(updatedTrip?.actualCost)}` };
      }
      return { ok: false, message: response.message || 'No se pudo completar el viaje' };
    } catch (error) {
      return { ok: false, message: error.message || 'Error al completar el viaje' };
    }
  };

  // Mismo criterio que el resto: lo que sigue en juego va sólido, lo cerrado
  // apagado. Antes eran verde, ámbar, azul y rojo con su fondo tintado.
  const getStatusConfig = (status) => {
    switch (status) {
      case 'active':
        return { color: ui.invertText, bg: ui.invertBg, text: 'Activo' };
      case 'started':
        return { color: ui.invertText, bg: ui.invertBg, text: 'Viaje iniciado' };
      // Los cerrados van con contorno y no rellenos: el relleno era ui.surface, el MISMO
      // color de la tarjeta, así que la píldora desaparecía y quedaba un texto gris flotando.
      case 'completed':
        return { color: ui.textMuted, bg: 'transparent', borde: ui.border, text: 'Completado' };
      case 'cancelled':
        return { color: ui.textMuted, bg: 'transparent', borde: ui.border, text: 'Cancelado' };
      default:
        return { color: ui.textMuted, bg: 'transparent', borde: ui.border, text: status };
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { weekday: 'short', day: 'numeric', month: 'short' };
    return date.toLocaleDateString('es-ES', options);
  };

  const getFilteredTrips = () => {
    const tripsArray = Array.isArray(trips) ? trips : [];
    if (activeTab === 'upcoming') {
      const filtered = tripsArray.filter(trip =>
        trip.status === 'active' || trip.status === 'started'
      );
      return filtered.sort((a, b) => {
        // 1° viajes en curso
        if (a.status === 'started' && b.status !== 'started') return -1;
        if (b.status === 'started' && a.status !== 'started') return  1;
        // 2° viajes de hoy que se pueden iniciar
        const aToday = isTripToday(a.departureDate);
        const bToday = isTripToday(b.departureDate);
        if (aToday && !bToday) return -1;
        if (bToday && !aToday) return  1;
        // 3° resto por fecha ascendente
        return new Date(a.departureDate) - new Date(b.departureDate);
      });
    } else {
      const filtered = tripsArray.filter(trip =>
        trip.status === 'completed' || trip.status === 'cancelled'
      );
      return filtered.sort((a, b) => {
        // completados antes que cancelados
        if (a.status === 'completed' && b.status === 'cancelled') return -1;
        if (a.status === 'cancelled' && b.status === 'completed') return 1;
        // mismo estado → más reciente primero
        return new Date(b.departureDate) - new Date(a.departureDate);
      });
    }
  };

  const renderTripItem = ({ item }) => {
    // El fondo del chip sale de `bg`, no del color del texto: "Activo" devuelve
    // invertText (blanco en claro, negro en oscuro) y pintar el fondo con
    // `color + '18'` daba texto blanco sobre casi blanco (y negro sobre casi
    // negro), o sea invisible en los dos temas.
    const { color, bg: statusBg, borde: statusBorde, text: statusText } = getStatusConfig(item.status);
    const freeNow = tripDisplaySeats(item);
    const textPrimary   = ui.invertBg;
    const textMuted     = ui.textMuted;
    const cardBg        = colors.cardBackground;
    const divider       = ui.bg;
    const accent        = textPrimary;
    const accentInv     = ui.invertText;
    const isActive      = item.status === 'started';

    const activeTxt   = isActive ? '#FFFFFF' : textPrimary;
    const activeMuted = isActive ? 'rgba(255,255,255,0.5)' : textMuted;
    const activeDivider = isActive ? '#333333' : divider;

    return (
      <View style={styles.cardWrapper}>
        <TouchableOpacity
          style={[styles.card, isActive ? styles.cardActive : { backgroundColor: cardBg }]}
          onPress={() => navigation.navigate('TripDetailFromCarpoolings', { tripId: item._id })}
          activeOpacity={0.7}
        >
          {/* Cabecera: estado arriba, luego ruta */}
          <View style={styles.cardHeader}>
            {isActive ? (
              <View style={styles.activeHeader}>
                <Animated.View style={[styles.activePulseDot, { opacity: pulseDot }]} />
                <Text style={styles.activeLabel}>Viaje en curso</Text>
              </View>
            ) : (
              <View style={[
                styles.statusPill,
                { backgroundColor: statusBg },
                statusBorde && { borderWidth: StyleSheet.hairlineWidth, borderColor: statusBorde },
              ]}>
                <Text style={[styles.statusPillText, { color }]}>{statusText}</Text>
              </View>
            )}
            <View style={styles.routeBlock}>
              <View style={styles.routeDots}>
                <View style={[styles.dotOrigin, { borderColor: activeTxt }]} />
                <View style={[styles.routeConnector, { backgroundColor: activeTxt }]} />
                <View style={[styles.dotDest, { backgroundColor: activeTxt }]} />
              </View>
              <View style={styles.routeLabels}>
                <Text style={[styles.cityText, { color: activeTxt }]} numberOfLines={1}>
                  {formatAddress(item.origin)}
                </Text>
                <Text style={[styles.cityText, { color: activeTxt, marginTop: 10 }]} numberOfLines={1}>
                  {formatAddress(item.destination)}
                </Text>
              </View>
            </View>
          </View>

          {/* Meta row */}
          <View style={[styles.metaRow, { borderTopColor: activeDivider, borderBottomColor: activeDivider }]}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={13} color={activeMuted} />
              <Text style={[styles.metaText, { color: activeMuted }]}>{formatDate(item.departureDate)}</Text>
            </View>
            <View style={[styles.metaDivider, { backgroundColor: activeDivider }]} />
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={activeMuted} />
              <Text style={[styles.metaText, { color: activeMuted }]}>{item.departureTime}</Text>
            </View>
            <View style={[styles.metaDivider, { backgroundColor: activeDivider }]} />
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={13} color={activeMuted} />
              <Text style={[styles.metaText, { color: activeMuted }]}>
                {item.fromTripRequest
                  ? tripSeatsLabel(item)
                  : freeNow <= 0 ? 'Completo' : `${freeNow} disponibles`}
              </Text>
            </View>
            {activeTab === 'upcoming' && item.bookingsCount > 0 && (
              <>
                <View style={[styles.metaDivider, { backgroundColor: activeDivider }]} />
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={13} color={activeMuted} />
                  <Text style={[styles.metaText, { color: activeMuted }]}>{item.bookingsCount} pendiente{item.bookingsCount !== 1 ? 's' : ''}</Text>
                </View>
              </>
            )}
          </View>

          {/* Botones — solo viajes activos o en curso */}
          {item.status === 'active' && (
            <View style={styles.footerRow}>
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: accent }]}
                onPress={() => navigation.navigate('TripRequests', { tripId: item._id })}
              >
                <Text style={[styles.footerBtnText, { color: accentInv }]}>Ver reservas</Text>
                {item.bookingsCount > 0 && (
                  <View style={[styles.footerBadge, { backgroundColor: accentInv }]}>
                    <Text style={[styles.footerBadgeText, { color: accent }]}>{item.bookingsCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {isTripToday(item.departureDate) && (
                <TouchableOpacity
                  style={[styles.footerBtnOutline, { borderColor: divider }]}
                  onPress={() => handleStartTrip(item._id)}
                  disabled={startingTripId === item._id}
                >
                  <Ionicons name="play-circle-outline" size={15} color={textPrimary} />
                  <Text style={[styles.footerBtnOutlineText, { color: textPrimary }]}>
                    {startingTripId === item._id ? 'Iniciando…' : 'Iniciar'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {item.status === 'started' && (
            <View style={styles.footerRow}>
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: '#FFFFFF', flex: 1 }]}
                onPress={() => handleCompleteTrip(item._id, item.passengers?.length)}
              >
                <Ionicons name="checkmark-circle-outline" size={15} color="#000000" />
                <Text style={[styles.footerBtnText, { color: '#000000' }]}>Completar viaje</Text>
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
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </View>
    );
  }

  const filteredTrips = getFilteredTrips();

  const textPrimary = ui.invertBg;
  const textMuted   = ui.textMuted;
  const divider     = ui.bg;

  return (
    <View style={[styles.container, { backgroundColor: ui.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: ui.text }]}>
          Los viajes{'\n'}
          <Text style={styles.titleStrong}>que ofrecés</Text>
        </Text>
      </View>

      {/* Tabs en pill, como el resto de la app */}
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
                {tab === 'upcoming' ? 'Próximos' : 'Pasados'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeTab === 'past' ? (
        <Text
          style={{
            fontSize: 11,
            color: textMuted,
            paddingHorizontal: 16,
            paddingTop: 6,
            paddingBottom: 4,
            lineHeight: 15,
            textAlign: 'center',
          }}
        >
          Los viajes completados o cancelados se conservan un tiempo limitado (dos semanas) y luego se
          eliminan automáticamente.
        </Text>
      ) : null}

      {/* Trips List */}
      {filteredTrips.length > 0 ? (
        <FlatList
          data={filteredTrips}
          renderItem={renderTripItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
          }
              ListFooterComponent={
                loadingMore ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color={textMuted} />
                    <Text style={{ fontSize: 13, color: textMuted }}>Cargando más…</Text>
                  </View>
                ) : null
              }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Image
            source={require('../../../../assets/illustrations/empty-trips.png')}
            style={styles.emptyIllustration}
            resizeMode="contain"
          />
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>
            {activeTab === 'upcoming' ? 'Sin viajes próximos' : 'Sin viajes pasados'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: textMuted }]}>
            {activeTab === 'upcoming'
              ? 'Creá tu primer viaje y compartí gastos'
              : 'Tus viajes completados aparecerán aquí'}
          </Text>
        </View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container:      { flex: 1 },
  centerContainer:{ flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Tabs — estilo subrayado
  tabsContainer: { paddingHorizontal: 24, paddingBottom: 8 },
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  title:       { fontFamily: 'Sora_300Light', fontSize: 32, lineHeight: 40, letterSpacing: -1 },
  titleStrong: { fontFamily: 'Sora_800ExtraBold' },
  tabPill: { flexDirection: 'row', borderRadius: 999, padding: 5 },
  tab: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },

  listContent: { padding: 16, gap: 12 },

  // Card
  cardWrapper: { marginBottom: 0 },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardActive: {
    backgroundColor: '#111111',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
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

  // Cabecera: estado encima de la ruta
  cardHeader: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: 16,
    paddingBottom: 12,
    gap: 12,
  },
  routeBlock: { flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1 },
  routeDots:  { width: 14, alignItems: 'center', paddingVertical: 2 },
  dotOrigin: {
    width: 9, height: 9, borderRadius: 5, borderWidth: 2,
  },
  routeConnector: { width: 1.5, height: 16, marginVertical: 2 },
  dotDest:   { width: 9, height: 9, borderRadius: 2 },
  routeLabels: { flex: 1 },
  cityText:  { fontSize: 14, fontFamily: 'Sora_600SemiBold' },

  // Status pill
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusPillText: { fontSize: 11, fontFamily: 'Sora_600SemiBold' },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:    { fontSize: 12 },
  metaDivider: { width: 1, height: 12 },

  // Footer botones
  footerRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
  },
  footerBtnText: { fontSize: 13, fontFamily: 'Sora_600SemiBold' },
  footerBadge: {
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  footerBadgeText: { fontSize: 10, fontFamily: 'Sora_700Bold' },
  footerBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  footerBtnOutlineText: { fontSize: 13, fontFamily: 'Sora_500Medium' },

  // Empty
  emptyIllustration: { width: 200, height: 200 },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: 10, padding: 32,
  },
  emptyTitle:    { fontSize: 16, fontFamily: 'Sora_600SemiBold', marginTop: 4 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});

export default MyTripsScreen;
