import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { get_public, get_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { useNotifications } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import { useTheme } from '../../../context/ThemeContext';
import { useColors } from '../../../hooks/useColors';
import { precargarUbicacion } from '../../../services/locationCache';
import NotificationsScreen from '../profile/NotificationsScreen';
import BannerDetailModal from '../../../components/modals/BannerDetailModal';
import BannerCarousel from '../../../components/banners/BannerCarousel';
import { tripDisplaySeats } from '../../../utils/tripSeatsDisplay';
import { reportError } from '../../../utils/sentry';
import { getOpenTripRequests, getMyTripRequests } from '../../../services/tripRequestService';
import { TAB_BAR_SPACE } from '../../../components/ui/FloatingTabBar';
import { useUI } from '../../../theme/ui';
import { HomeTripListSkeleton } from '../../../components/ui/TripCardSkeleton';
import { useMinDuration } from '../../../hooks/useMinDuration';

/**
 * Incluye sólo viajes públicos verdaderamente "próximos": no cancelados ni completados,
 * listado activo y salida aún no pasada.
 *
 * `trip.departureDate` YA es el instante real (el backend lo arma con fecha + hora + offset
 * de Argentina al crear el viaje, ver tripController.createTrip) — no una fecha "pelada" a
 * medianoche UTC. Antes esta función volvía a pegarle `departureTime` encima
 * (`${departureDate}T${departureTime}`), y como departureDate ya termina en "Z", el string
 * quedaba con dos horas adentro ("...000ZT23:59") y `new Date(...)` daba Invalid Date. Con
 * fecha inválida el chequeo de "ya pasó" nunca se aplicaba a nada.
 */
function tripQualifiesForHomeUpcomingStrip(trip) {
  if (!trip) return false;
  const status = trip.status;
  if (status === 'cancelled' || status === 'completed') return false;
  if (status === 'started') return false;
  if (trip.isActive === false) return false;
  const dep = new Date(trip.departureDate);
  if (!Number.isNaN(dep.getTime()) && dep.getTime() < Date.now()) return false;
  return true;
}

const HomeScreen = ({ navigation, route }) => {
  const { isAuthenticated, user } = useAuth();
  const { unreadCount = 0 } = useNotifications();
  useTheme();
  const { showAlert } = useAlert();
  const { colors, isDarkMode } = useColors();

  const dark = isDarkMode;

  const LOGO_SOURCE = dark
    ? require('../../../../assets/logo/192x192-white.png')
    : require('../../../../assets/logo/192x192-black.png');

  const [origin, setOrigin] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [destination, setDestination] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [recentTrips, setRecentTrips] = useState([]);
  const [bannerSections, setBannerSections] = useState([]); // [{sectionTitle, banners}]
  const [loading, setLoading] = useState(false);
  const showTripsSkeleton = useMinDuration(loading);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('inicio');
  const [bannerModal, setBannerModal] = useState({ visible: false, banner: null });
  const [activeTrip, setActiveTrip] = useState(null);
  const [activeTripRole, setActiveTripRole] = useState(null);
  const autoOpenedMapRef = useRef(false);
  const [openRequests, setOpenRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const showRequestsSkeleton = useMinDuration(loadingRequests);
  const pulseDot = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadRecentTrips();
    loadBannerSections();
    loadOpenRequests();
    if (isAuthenticated) loadActiveTrip();
    // Pide el GPS acá y no cuando se abre un mapa: para cuando el usuario entra a reservar o a
    // publicar un viaje, la ubicación ya está lista en el caché (ver locationCache) y esas
    // pantallas no tienen que esperar al GPS de nuevo.
    precargarUbicacion();
  }, []);

  useEffect(() => {
    if (!activeTrip) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseDot, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseDot, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [activeTrip]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadActiveTrip();
        loadOpenRequests();
      }
      return () => {
        setShowNotificationsModal(false);
      };
    }, [isAuthenticated])
  );

  useEffect(() => {
    const tab = route.params?.openTab;
    if (tab) setActiveTab(tab);
  }, [route.params?.openTab]);

  const loadRecentTrips = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      // nearCity/nearProvince: prioriza lo cercano al usuario (ciudad, y si no alcanza
      // provincia) antes de filtrar/ordenar/recortar a los 3 que se muestran.
      const response = await get_public(ENDPOINTS.GET_TRIPS, {
        limit: 40,
        nearCity: user?.city || undefined,
        nearProvince: user?.province || undefined,
      });
      if (response.success && Array.isArray(response.data)) {
        const userId = user?._id || user?.id;
        const upcoming = response.data.filter(t => {
          if (!tripQualifiesForHomeUpcomingStrip(t)) return false;
          const driverId = t.driver?._id || t.driver;
          return !userId || String(driverId) !== String(userId);
        });
        // departureDate ya es el instante real (ver tripQualifiesForHomeUpcomingStrip):
        // pegarle departureTime encima daba Invalid Date y el comparador quedaba en NaN,
        // así que .sort() no ordenaba nada — la tira quedaba en el orden que mandó el
        // backend, no por hora de salida.
        const sortedTrips = [...upcoming].sort(
          (a, b) => new Date(a.departureDate) - new Date(b.departureDate)
        );
        setRecentTrips(sortedTrips.slice(0, 3));
      }
    } catch (error) {
      console.error('Error loading trips:', error);
      reportError(error, { screen: 'HomeScreen', action: 'loadTrips' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * El banner de "viaje en curso" abre el detalle, para conductor y pasajero por igual: ahí
   * está el chat, la lista de pasajeros, completar el viaje y el botón para ver el mapa.
   * Al mapa se entra solo por dos vías: ese botón, o la apertura automática al abrir la app
   * con un viaje en curso. Tocar el banner NO tiene que llevar al mapa: es el atajo a todo
   * lo demás, y desde el mapa hay que volver atrás para hacer cualquier otra cosa.
   */
  const openActiveTrip = () => {
    if (!activeTrip) return;
    navigation.navigate('TripDetail', { tripId: activeTrip._id });
  };

  const loadActiveTrip = async () => {
    try {
      const [driverRes, passengerRes] = await Promise.allSettled([
        // status=started en el server: recorrer la primera página no alcanzaba,
        // el viaje en curso puede quedar detrás de muchos viajes futuros.
        get_withauth(ENDPOINTS.MY_TRIPS_DRIVER, { status: 'started', limit: 1 }),
        get_withauth(ENDPOINTS.MY_TRIPS_PASSENGER, { status: 'started', limit: 1 }),
      ]);
      let found = null;
      let role = null;
      if (driverRes.status === 'fulfilled' && driverRes.value?.success) {
        const started = (driverRes.value.data || []).find(t => t.status === 'started');
        if (started) { found = started; role = 'driver'; }
      }
      if (!found && passengerRes.status === 'fulfilled' && passengerRes.value?.success) {
        const started = (passengerRes.value.data || []).find(t => t.status === 'started');
        if (started) { found = started; role = 'passenger'; }
      }
      setActiveTrip(found || null);
      setActiveTripRole(found ? role : null);

      // Viaje EN CURSO: al abrir la app va derecho al mapa, sin Home → viaje → detalle → mapa.
      // Vale para los dos roles. El conductor está manejando; el pasajero está esperando o ya
      // arriba, y el mapa es justo lo que quiere ver —dónde viene el auto— (TripMapScreen ya
      // dibuja la posición del conductor y el "te está esperando" para el que no maneja).
      // Solo con un viaje EN CURSO, nunca con uno publicado para más adelante, que lo dejaría
      // encerrado. Una sola vez por arranque: loadActiveTrip corre en cada focus del Home, así
      // que sin el ref lo rebotaría al mapa cada vez que vuelve y no podría usar el resto de
      // la app.
      if (found && !autoOpenedMapRef.current) {
        autoOpenedMapRef.current = true;
        navigation.navigate('TripMap', { trip: found });
      }
    } catch {
      // no-op: banner is optional
    }
  };

  const loadBannerSections = async () => {
    try {
      // El único de los tres screens que no mandaba appScreen: sin él, el backend no filtra
      // por targetApp y Home mostraba TODOS los banners activos, incluidos los que un admin
      // había marcado para que salieran sólo en Viajes o en el detalle del viaje.
      const response = await get_public(ENDPOINTS.GET_BANNER_SECTIONS, { appScreen: 'home' });
      if (response.success && Array.isArray(response.data)) {
        setBannerSections(response.data);
      }
    } catch (error) {
      console.error('Error loading banner sections:', error);
    }
  };

  const loadOpenRequests = async () => {
    setLoadingRequests(true);
    try {
      const [openRes, myRes] = await Promise.allSettled([
        getOpenTripRequests({
          limit: 40,
          nearCity: user?.city || undefined,
          nearProvince: user?.province || undefined,
        }),
        isAuthenticated ? getMyTripRequests() : Promise.resolve({ success: false }),
      ]);
      const open = openRes.status === 'fulfilled' && openRes.value?.success ? openRes.value.data : [];
      const mine = myRes.status === 'fulfilled' && myRes.value?.success ? myRes.value.data : [];
      // departureDate guarda el día de calendario como medianoche UTC: "hoy" hay que armarlo
      // igual (medianoche UTC del día LOCAL) — setHours(0,0,0,0) da medianoche local, que cae
      // 3hs después, y una solicitud propia de HOY se caía del merge.
      const now = new Date();
      const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const activeMine = mine.filter(r => r.status === 'open' && new Date(r.departureDate) >= today);
      const merged = [...open];
      activeMine.forEach(r => { if (!merged.find(x => x._id === r._id)) merged.push(r); });
      merged.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));
      setOpenRequests(merged.slice(0, 3));
    } catch {}
    finally { setLoadingRequests(false); }
  };

  const onRefresh = () => {
    loadRecentTrips(true);
    loadBannerSections();
    if (isAuthenticated) {
      loadActiveTrip();
      loadOpenRequests();
    }
  };

  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && date) {
        setSelectedDate(date);
      }
    } else {
      if (date) setSelectedDate(date);
    }
  };

  const handleDatePickerOpen = () => {
    setShowDatePicker(true);
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-ES');
  };

  const handleSearch = () => {
    if (!origin && !destination && !selectedDate && !selectedSeats) {
      navigation.navigate('AllTrips');
      return;
    }
    if (!origin && !destination) {
      showAlert('Ocurrió algo', 'Por favor completa al menos el origen o destino');
      return;
    }
    navigation.navigate('SearchResults', {
      origin,
      originCity,
      destination,
      destinationCity,
      date: selectedDate,
      seats: selectedSeats,
    });
  };

  const clearFilters = () => {
    setOrigin('');
    setOriginCity('');
    setDestination('');
    setDestinationCity('');
    setSelectedDate(null);
    setSelectedSeats('');
  };

  const formatAddress = (location) => {
    if (!location) return '';
    let raw = location.address || location.street || '';
    raw = raw.replace(/, [A-Z][0-9]{4}[A-Z0-9]{0,3}\s+/g, ', ').trim();
    const city = location.city || location.name || '';
    const province = location.province || '';
    let result = raw || city;
    if (city && result && !result.includes(city)) result += `, ${city}`;
    if (province && !result.includes(province)) result += `, ${province}`;
    return result;
  };

  // Dynamic colors
  const bg = colors.background;
  const ui = useUI();
  const cardBg = ui.surface;
  const inputBg = ui.surface;
  const textPrimary = colors.textPrimary;
  const textSecondary = colors.textSecondary;
  const textMuted = colors.textMuted;
  const borderColor = ui.bg;  const accent = ui.invertBg;
  const accentInverse = ui.invertText;
  const divider = ui.bg;
  /** Contraste fuerte en claro: labels, paradas, flechas */
  const tripRouteMuted = dark ? textMuted : '#111827';
  const tripCardChevron = ui.text;
  const tripRouteLine = ui.textMuted;
  /** Búsqueda inicio: en claro texto negro para leer bien (4 campos) */
  const searchFieldLabel = dark ? textMuted : '#000000';
  const searchFieldEmpty = dark ? textMuted : '#000000';

  // Ícono del cuadrado de la izquierda: mismo set que los hubs de Crear Viaje/Solicitudes.
  const TRIP_ICON = require('../../../../assets/tabsIcons/mis-viajes.png');
  const REQUEST_ICON = require('../../../../assets/tabsIcons/reservas-recibidas-solicitudes.png');

  const renderTripCard = (trip) => {
    const freeSeats = tripDisplaySeats(trip);
    const hasStops = trip.intermediateStops?.length > 0;
    const originCity = trip.origin?.city || formatAddress(trip.origin);
    const destCity = trip.destination?.city || formatAddress(trip.destination);
    return (
    <TouchableOpacity
      key={trip._id}
      style={[styles.tripCard, { backgroundColor: cardBg }]}
      onPress={() => navigation.navigate('TripDetail', { tripId: trip._id })}
      activeOpacity={0.7}
    >
      <View style={styles.tripHeaderRow}>
        <Image source={TRIP_ICON} style={styles.tripIconBox} resizeMode="contain" />
        <View style={styles.tripInfoColumn}>
          <View style={styles.routeLine}>
            <Text style={[styles.routeCity, { color: textPrimary }]} numberOfLines={1}>{originCity}</Text>
            <Text style={[styles.routeConnector, { color: tripRouteMuted }]}>{hasStops ? '···' : '→'}</Text>
            <Text style={[styles.routeCity, { color: textPrimary }]} numberOfLines={1}>{destCity}</Text>
          </View>
          <Text style={[styles.tripMeta, { color: tripRouteMuted }]} numberOfLines={1}>
            {new Date(trip.departureDate).toLocaleDateString('es-ES', {
              weekday: 'short', day: 'numeric', month: 'short',
            })} · {trip.departureTime} · {freeSeats === 0 ? 'Completo' : `${freeSeats} disponible${freeSeats !== 1 ? 's' : ''}`}
          </Text>
        </View>
        {trip.sinPrecioFijo ? (
          <View style={styles.priceBox}>
            <Text style={[styles.priceValue, { color: textPrimary }]}>Gastos</Text>
            <Text style={[styles.priceLabel, { color: tripRouteMuted }]}>compartidos</Text>
          </View>
        ) : trip.driverPrice > 0 ? (
          <View style={styles.priceBox}>
            <Text style={[styles.priceValue, { color: textPrimary }]}>${Number(trip.driverPrice).toLocaleString('es-AR')}</Text>
            <Text style={[styles.priceLabel, { color: tripRouteMuted }]}>por asiento</Text>
          </View>
        ) : null}
      </View>

      {/* Siempre se renderiza (con o sin paradas): así todas las cards quedan de la misma
          altura, en vez de la de sin paradas quedando más baja o con un hueco vacío. */}
      <View style={[styles.stopChip, { backgroundColor: ui.bg, borderColor: divider }]}>
        <Ionicons name="git-branch-outline" size={13} color={tripRouteMuted} />
        <Text style={[styles.stopChipText, { color: tripRouteMuted }]}>
          {hasStops ? `${trip.intermediateStops.length} parada${trip.intermediateStops.length !== 1 ? 's' : ''}` : 'Sin paradas'}
        </Text>
      </View>
    </TouchableOpacity>
    );
  };

  const renderRequestCard = (req) => {
    const totalApps = req.applicationCount ?? req.applications?.length ?? 0;
    const cupos = Math.max(0, 5 - totalApps);
    const hasStops = req.intermediateStops?.length > 0;
    return (
      <TouchableOpacity
        key={req._id}
        style={[styles.tripCard, { backgroundColor: cardBg }]}
        onPress={() => navigation.getParent('AppStack')?.navigate('TripRequestDetail', { requestId: req._id })}
        activeOpacity={0.7}
      >
        <View style={styles.tripHeaderRow}>
          <Image source={REQUEST_ICON} style={styles.tripIconBox} resizeMode="contain" />
          <View style={styles.tripInfoColumn}>
            <View style={styles.routeLine}>
              <Text style={[styles.routeCity, { color: textPrimary }]} numberOfLines={1}>{req.origin?.city}</Text>
              <Text style={[styles.routeConnector, { color: tripRouteMuted }]}>{hasStops ? '···' : '→'}</Text>
              <Text style={[styles.routeCity, { color: textPrimary }]} numberOfLines={1}>{req.destination?.city}</Text>
            </View>
            <Text style={[styles.tripMeta, { color: tripRouteMuted }]} numberOfLines={1}>
              {/* timeZone UTC: es un dia de calendario, sin esto en UTC-3 muestra el dia anterior.
                  Ojo: la card de VIAJES (arriba) NO lleva esto, ahi departureDate es un instante real. */}
              {new Date(req.departureDate).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}
              {' · '}{req.departureTime || ''} · {cupos} cupo{cupos !== 1 ? 's' : ''} para postularte
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={tripCardChevron} />
        </View>

        <View style={[styles.stopChip, { backgroundColor: ui.bg, borderColor: divider }]}>
          <Ionicons name="git-branch-outline" size={13} color={tripRouteMuted} />
          <Text style={[styles.stopChipText, { color: tripRouteMuted }]}>
            {hasStops ? `${req.intermediateStops.length} parada${req.intermediateStops.length !== 1 ? 's' : ''}` : 'Sin paradas'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTop = () => (
    <>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Image source={LOGO_SOURCE} style={styles.logo} />
          <Text style={[styles.headerGreeting, { color: textMuted }]} numberOfLines={1}>
            {user?.firstName ? `Hola, ${user.firstName}` : 'Carpuling'}
          </Text>
          {isAuthenticated && (
            <TouchableOpacity
              onPress={() => setShowNotificationsModal(true)}
              style={[styles.notifBtn, { backgroundColor: inputBg }]}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={20} color={textPrimary} />
              {unreadCount > 0 && (
                <View style={[styles.notifBadge, { borderColor: bg, backgroundColor: textPrimary }]}>
                  <Text style={[styles.notifBadgeText, { color: bg }]}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
        {/* Título display: el peso hace de acento, no el color. */}
        <Text style={[styles.headerTitle, { color: textPrimary }]}>
          Compartí tu{'\n'}
          <Text style={styles.headerTitleStrong}>próximo viaje</Text>
        </Text>
      </View>
      <View style={styles.tabBarWrap}>
        <View style={[styles.tabPill, { backgroundColor: inputBg }]}>
          <TouchableOpacity
            style={[styles.tabPillItem, activeTab === 'inicio' && { backgroundColor: accent }]}
            onPress={() => { setActiveTab('inicio'); loadRecentTrips(); if (isAuthenticated) loadActiveTrip(); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabPillText, { color: activeTab === 'inicio' ? accentInverse : textMuted }]}>Inicio</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabPillItem, activeTab === 'solicitudes' && { backgroundColor: accent }]}
            onPress={() => { setActiveTab('solicitudes'); loadOpenRequests(); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabPillText, { color: activeTab === 'solicitudes' ? accentInverse : textMuted }]}>Solicitudes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>

      {/* Inicio tab */}
      <View style={{ flex: 1, display: activeTab === 'inicio' ? 'flex' : 'none' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={textMuted}
          />
        }
      >
        {renderTop()}

        {/* Banner viaje en curso */}
        {activeTrip && (
          <View style={styles.activeTripWrapper}>
            <TouchableOpacity
              // En oscuro, el #111 del banner se perdía contra el fondo #161616.
              style={[styles.activeTripBanner, dark && { backgroundColor: '#2A2A2A' }]}
              onPress={() => openActiveTrip()}
              activeOpacity={0.88}
            >
              <View style={styles.activeTripLeft}>
                <Animated.View style={[styles.activeDot, { opacity: pulseDot }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeTripLabel}>
                    {activeTripRole === 'driver' ? 'Viaje en curso' : 'Viaje en curso'}
                  </Text>
                  <Text style={styles.activeTripDest} numberOfLines={1}>
                    En camino a {activeTrip.destination?.city || activeTrip.destination?.address || '—'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
            <Animated.View
              pointerEvents="none"
              style={[styles.activeTripRing, { opacity: pulseDot }]}
            />
          </View>
        )}

        {/* Search block */}
        <View style={[styles.searchBlock, { backgroundColor: inputBg }]}>
          {/* Origin */}
          <TouchableOpacity
            style={styles.searchRow}
            onPress={() => navigation.navigate('LocationPicker', {
              title: 'Provincia de origen',
              province: origin,
              city: originCity,
              onSelect: ({ province, city }) => { setOrigin(province); setOriginCity(city); },
            })}
            activeOpacity={0.7}
          >
            <View style={styles.routeIndicator}>
              <View style={[styles.dotOutline, { borderColor: accent }]} />
            </View>
            <View style={styles.searchRowContent}>
              <Text style={[styles.searchRowLabel, { color: searchFieldLabel }]}>Origen</Text>
              {!origin ? (
                <Text style={[styles.searchRowValue, { color: searchFieldEmpty }]}>Provincia · Ciudad</Text>
              ) : !originCity ? (
                <Text style={[styles.searchRowValue, { color: textPrimary }]}>{origin} · Todas las ciudades</Text>
              ) : (
                <Text style={[styles.searchRowValue, { color: textPrimary }]}>{originCity}, {origin}</Text>
              )}
            </View>
          </TouchableOpacity>

          <View style={[styles.searchDivider, { backgroundColor: divider }]}>
            <View style={[styles.routeConnector, { backgroundColor: dark ? '#444' : '#CCC' }]} />
          </View>

          {/* Destination */}
          <TouchableOpacity
            style={styles.searchRow}
            onPress={() => navigation.navigate('LocationPicker', {
              title: 'Provincia de destino',
              province: destination,
              city: destinationCity,
              onSelect: ({ province, city }) => { setDestination(province); setDestinationCity(city); },
            })}
            activeOpacity={0.7}
          >
            <View style={styles.routeIndicator}>
              <View style={[styles.dotFilled, { backgroundColor: accent }]} />
            </View>
            <View style={styles.searchRowContent}>
              <Text style={[styles.searchRowLabel, { color: searchFieldLabel }]}>Destino</Text>
              {!destination ? (
                <Text style={[styles.searchRowValue, { color: searchFieldEmpty }]}>Provincia · Ciudad</Text>
              ) : !destinationCity ? (
                <Text style={[styles.searchRowValue, { color: textPrimary }]}>{destination} · Todas las ciudades</Text>
              ) : (
                <Text style={[styles.searchRowValue, { color: textPrimary }]}>{destinationCity}, {destination}</Text>
              )}
            </View>
          </TouchableOpacity>

          <View style={[styles.searchDividerFull, { backgroundColor: divider }]} />

          {/* Date row */}
          <TouchableOpacity
            style={styles.searchRow}
            onPress={handleDatePickerOpen}
            activeOpacity={0.7}
          >
            <View style={styles.routeIndicator}>
              <Ionicons name="calendar-outline" size={16} color={textPrimary} />
            </View>
            <View style={styles.searchRowContent}>
              <Text style={[styles.searchRowLabel, { color: searchFieldLabel }]}>Fecha</Text>
              <Text style={[styles.searchRowValue, { color: selectedDate ? textPrimary : searchFieldEmpty }]}>
                {selectedDate ? formatDate(selectedDate) : 'Cualquier dia'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.searchDividerFull, { backgroundColor: divider }]} />

          {/* Seats row */}
          <View style={styles.searchRow}>
            <View style={styles.routeIndicator}>
              <Ionicons name="person-outline" size={16} color={textPrimary} />
            </View>
            <View style={styles.searchRowContent}>
              <Text style={[styles.searchRowLabel, { color: searchFieldLabel }]}>Asientos</Text>
              <TextInput
                style={[styles.searchRowInput, { color: selectedSeats ? textPrimary : searchFieldEmpty }]}
                placeholder="Cuantos viajan"
                placeholderTextColor={searchFieldEmpty}
                value={selectedSeats}
                onChangeText={setSelectedSeats}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsWrap}>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.searchBtn, { backgroundColor: accent }]}
              onPress={handleSearch}
              activeOpacity={0.85}
            >
              <Text style={[styles.searchBtnText, { color: accentInverse }]}>Buscar viajes</Text>
              <View style={styles.searchBtnChevrons}>
                {[0.35, 0.6, 1].map((opacity, i) => (
                  <Ionicons key={i} name="chevron-forward" size={15} color={accentInverse} style={{ opacity, marginLeft: -5 }} />
                ))}
              </View>
            </TouchableOpacity>
          </View>
          {(origin || destination || selectedDate || selectedSeats) && (
            <TouchableOpacity
              style={styles.clearFiltersLink}
              onPress={clearFilters}
              activeOpacity={0.65}
              accessibilityRole="button"
              accessibilityLabel="Restablecer búsqueda y limpiar filtros"
            >
              <Text style={[styles.clearFiltersLinkText, { color: textMuted }]}>
                Restablecer búsqueda
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Upcoming trips */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Proximos viajes</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AllTrips')} activeOpacity={0.7}>
              <Text style={[styles.sectionLink, { color: textMuted }]}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          {showTripsSkeleton ? (
            <HomeTripListSkeleton />
          ) : recentTrips.length > 0 ? (
            recentTrips.map(renderTripCard)
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyText, { color: textMuted }]}>
                No hay viajes disponibles
              </Text>
            </View>
          )}
        </View>

        {/* Banner sections (dynamic) */}
        {bannerSections.map((section) =>
          section.banners.length > 0 ? (
            <View key={section.sectionTitle} style={styles.bannerSection}>
              <Text style={[styles.bannerSectionTitle, { color: textPrimary }]}>
                {section.sectionTitle}
              </Text>
              <BannerCarousel
                banners={section.banners}
                onBannerPress={(b) => setBannerModal({ visible: true, banner: b })}
              />
            </View>
          ) : null
        )}
      </ScrollView>
      </KeyboardAvoidingView>
      </View>

      {/* Solicitudes tab */}
      <View style={{ flex: 1, display: activeTab === 'solicitudes' ? 'flex' : 'none' }}>
        <ScrollView
          // Mismo espacio que el tab de Inicio: con 40 fijos la tab bar flotante
          // tapaba los ultimos banners al llegar al final.
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textMuted} />
          }
        >
          {renderTop()}

          {/* Banner viaje en curso */}
          {activeTrip && (
            <View style={styles.activeTripWrapper}>
              <TouchableOpacity
                style={styles.activeTripBanner}
                onPress={() => openActiveTrip()}
                activeOpacity={0.88}
              >
                <View style={styles.activeTripLeft}>
                  <Animated.View style={[styles.activeDot, { opacity: pulseDot }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activeTripLabel}>Viaje en curso</Text>
                    <Text style={styles.activeTripDest} numberOfLines={1}>
                      En camino a {activeTrip.destination?.city || activeTrip.destination?.address || '—'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              <Animated.View pointerEvents="none" style={[styles.activeTripRing, { opacity: pulseDot }]} />
            </View>
          )}

          <View style={styles.solicitudesCards}>
          <TouchableOpacity
            style={[styles.hubCard, { backgroundColor: cardBg, borderColor: borderColor }]}
            onPress={() => navigation.navigate('CreateTripRequest')}
            activeOpacity={0.8}
          >
            <Image source={require('../../../../assets/tabsIcons/publica-solicitud.png')} style={styles.hubIcon} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.hubCardTitle, { color: textPrimary }]}>Publicar solicitud</Text>
              <Text style={[styles.hubCardSub, { color: textMuted }]} numberOfLines={2}>Indicá a dónde querés ir y recibí postulaciones de conductores</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.hubCard, { backgroundColor: cardBg, borderColor: borderColor }]}
            onPress={() => navigation.navigate('MyTripRequests')}
            activeOpacity={0.8}
          >
            <Image source={require('../../../../assets/tabsIcons/mis-reservas-solicitudes.png')} style={styles.hubIcon} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.hubCardTitle, { color: textPrimary }]}>Mis solicitudes</Text>
              <Text style={[styles.hubCardSub, { color: textMuted }]} numberOfLines={2}>Revisá las solicitudes que publicaste y elegí a tu conductor</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.hubCard, { backgroundColor: cardBg, borderColor: borderColor }]}
            onPress={() => navigation.navigate('OpenTripRequests')}
            activeOpacity={0.8}
          >
            <Image source={require('../../../../assets/tabsIcons/reservas-recibidas-solicitudes.png')} style={styles.hubIcon} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.hubCardTitle, { color: textPrimary }]}>Ver solicitudes abiertas</Text>
              <Text style={[styles.hubCardSub, { color: textMuted }]} numberOfLines={2}>Explorá pedidos de pasajeros y postulate como conductor</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.hubCard, { backgroundColor: cardBg, borderColor: borderColor }]}
            onPress={() => navigation.navigate('MyApplications')}
            activeOpacity={0.8}
          >
            <Image source={require('../../../../assets/tabsIcons/mis-viajes-solicitudes.png')} style={styles.hubIcon} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.hubCardTitle, { color: textPrimary }]}>Mis postulaciones</Text>
              <Text style={[styles.hubCardSub, { color: textMuted }]} numberOfLines={2}>Revisá las solicitudes donde te postulaste como conductor</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textMuted} />
          </TouchableOpacity>
          </View>

          {/* Próximas solicitudes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Próximas solicitudes</Text>
              <TouchableOpacity onPress={() => navigation.navigate('OpenTripRequests')}>
                <Text style={[styles.sectionLink, { color: textMuted }]}>Ver todas</Text>
              </TouchableOpacity>
            </View>
            {showRequestsSkeleton ? (
              <HomeTripListSkeleton count={1} />
            ) : openRequests.length === 0 ? (
              <View style={[styles.reqEmptySmall, { backgroundColor: cardBg }]}>
                <Text style={[styles.reqEmptySmallText, { color: textMuted }]}>No hay solicitudes abiertas</Text>
              </View>
            ) : (
              openRequests.map(req => renderRequestCard(req))
            )}
          </View>

          {/* Banner sections */}
          {bannerSections.map((section) =>
            section.banners.length > 0 ? (
              <View key={section.sectionTitle} style={styles.bannerSection}>
                <Text style={[styles.bannerSectionTitle, { color: textPrimary }]}>{section.sectionTitle}</Text>
                <BannerCarousel
                  banners={section.banners}
                  onBannerPress={(banner) => setBannerModal({ visible: true, banner })}
                />
              </View>
            ) : null
          )}

        </ScrollView>
      </View>

      {/* Date Picker */}
      {showDatePicker && (
        <>
          {Platform.OS === 'ios' ? (
            <Modal visible transparent animationType="fade">
              <View style={styles.modalOverlay}>
                <View style={[styles.pickerContainer, { backgroundColor: colors.background }]}>
                  <View style={[styles.pickerHeader, { borderBottomColor: divider }]}>
                    <Text style={[styles.pickerTitle, { color: textPrimary }]}>Seleccionar fecha</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Ionicons name="close" size={22} color={textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <DateTimePicker
                      value={selectedDate || new Date()}
                      mode="date"
                      display="spinner"
                      onChange={handleDateChange}
                      minimumDate={new Date()}
                      textColor={textPrimary}
                      themeVariant={dark ? 'dark' : 'light'}
                    />
                  </View>
                  <View style={[styles.datePickerActions, { borderTopColor: divider }]}>
                    <TouchableOpacity
                      style={[styles.dateBtn, { borderColor: borderColor }]}
                      onPress={() => { setSelectedDate(null); setShowDatePicker(false); }}
                    >
                      <Text style={[styles.dateBtnText, { color: textSecondary }]}>Limpiar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.dateBtn, styles.dateBtnPrimary, { backgroundColor: accent }]}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={[styles.dateBtnText, { color: accentInverse }]}>Confirmar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          ) : (
            <DateTimePicker
              value={selectedDate || new Date()}
              mode="date"
              display="default"
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}
        </>
      )}

      <BannerDetailModal
        visible={bannerModal.visible}
        banner={bannerModal.banner}
        onClose={() => setBannerModal({ visible: false, banner: null })}
        navigation={navigation}
        colors={colors}
      />

      {/* Notifications Modal */}
      <Modal
        visible={showNotificationsModal}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
        transparent={false}
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        {/* El Modal de RN abre una ventana nativa aparte: los insets del provider de
            afuera no valen ahi, y en Android el contenido quedaba mal ubicado. El propio
            provider del modal los mide para esta ventana. */}
        <SafeAreaProvider>
          <NotificationsScreen
            navigation={{
              ...navigation,
              goBack: () => setShowNotificationsModal(false),
              navigate: (screen, params) => {
                setShowNotificationsModal(false);
                setTimeout(() => navigation.navigate(screen, params), 300);
              },
            }}
          />
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    // TAB_BAR_SPACE cubre justo el alto de la barra: el ultimo banner quedaba pegado.
    paddingBottom: TAB_BAR_SPACE + 24,
  },

  // Active trip banner
  activeTripWrapper: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  activeTripRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 0.8,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  activeTripBanner: {
    backgroundColor: '#111111',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  activeTripLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  activeTripLabel: {
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  activeTripDest: {
    fontSize: 15,
    fontFamily: 'Sora_700Bold',
    color: '#FFFFFF',
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  headerGreeting: {
    flex: 1,
    fontFamily: 'Sora_500Medium',
    fontSize: 15,
  },
  headerTitle: {
    fontFamily: 'Sora_300Light',
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -1,
    marginTop: 18,
  },
  headerTitleStrong: {
    fontFamily: 'Sora_800ExtraBold',
  },
  headerSub: {
    fontSize: 13,
    marginTop: 4,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
  },
  notifBadgeText: {
    fontFamily: 'Sora_700Bold',
    fontSize: 9,
  },

  // Search block
  searchBlock: {
    marginHorizontal: 24,
    borderRadius: 24,
    overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    minHeight: 58,
  },
  routeIndicator: {
    width: 22,
    alignItems: 'center',
    marginRight: 14,
  },
  dotOutline: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  dotFilled: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  searchRowText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Sora_400Regular',
  },
  searchRowContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  searchRowLabel: {
    fontSize: 11,
    fontFamily: 'Sora_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchRowValue: {
    fontSize: 15,
    fontFamily: 'Sora_400Regular',
  },
  searchRowInput: {
    fontSize: 15,
    fontFamily: 'Sora_400Regular',
    padding: 0,
    margin: 0,
    ...Platform.select({
      android: {
        paddingTop: 0,
        paddingBottom: 0,
        includeFontPadding: false,
      },
    }),
  },
  searchDivider: {
    height: 1,
    marginLeft: 54,
    position: 'relative',
  },
  routeConnector: {
    position: 'absolute',
    left: -24,
    top: -8,
    width: 1,
    height: 16,
  },
  searchDividerFull: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 18,
  },

  // Actions (buscar + enlace para limpiar)
  actionsWrap: {
    paddingHorizontal: 24,
    marginTop: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBtn: {
    flex: 1,
    height: 58,
    borderRadius: 999,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 16,
  },
  searchBtnChevrons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 14,
  },
  clearFiltersLink: {
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearFiltersLinkText: {
    fontFamily: 'Sora_500Medium',
    fontSize: 13,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },

  // Tab pill
  tabBarWrap: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 16,
  },
  tabPill: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 5,
  },
  tabPillItem: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabPillText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 14,
  },

  // Solicitudes hub
  // paddingHorizontal 24, no 16: tiene que alinear con el resto de las secciones de la
  // pantalla (sectionHeader, tripCard, etc.) o las cards de acá quedaban más angostas.
  solicitudesCards: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  hubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  hubIcon: {
    width: 44,
    height: 44,
  },
  hubCardTitle: {
    fontSize: 14,
    fontFamily: 'Sora_700Bold',
    marginBottom: 3,
  },
  // 2 renglones fijos, como las cards de Viajes: las descripciones más cortas
  // entraban en uno y esas cards quedaban más bajas que el resto.
  hubCardSub: {
    fontSize: 12,
    lineHeight: 17,
    minHeight: 34,
  },

  // Request cards (solicitudes tab)
  reqEmptySmall: {
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  reqEmptySmallText: {
    fontSize: 13,
  },
  reqCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    overflow: 'hidden',
  },
  reqCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  reqRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  reqCity: {
    fontSize: 14,
    fontFamily: 'Sora_600SemiBold',
    maxWidth: 90,
  },
  reqStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reqStatusText: {
    fontSize: 11,
    fontFamily: 'Sora_700Bold',
  },
  reqMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reqMetaText: {
    fontSize: 12,
  },
  reqMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },

  // Banners
  bannerSection: {
    marginTop: 28,
  },
  bannerSectionTitle: {
    fontSize: 16,
    fontFamily: 'Sora_700Bold',
    marginBottom: 10,
    paddingHorizontal: 24,
  },
  // Section
  section: {
    paddingHorizontal: 24,
    marginTop: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Sora_700Bold',
    fontSize: 22,
    letterSpacing: -0.6,
  },
  sectionLink: {
    fontFamily: 'Sora_500Medium',
    fontSize: 14,
  },

  // Trip Card — ícono + ruta en una línea + precio (o "gastos compartidos"), sin botones de
  // gestión: estas cards muestran viajes/solicitudes de OTROS usuarios en el feed de Inicio.
  tripCard: {
    borderRadius: 18,
    marginBottom: 12,
    padding: 16,
    gap: 10,
  },
  tripHeaderRow: {
    flexDirection: 'row',
    gap: 14,
  },
  tripIconBox: {
    width: 52,
    height: 52,
  },
  tripInfoColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 4,
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minWidth: 0,
  },
  routeCity: {
    fontSize: 15,
    fontFamily: 'Sora_700Bold',
    flexShrink: 1,
  },
  routeConnector: {
    fontSize: 15,
    fontFamily: 'Sora_700Bold',
  },
  tripMeta: {
    fontSize: 12,
    fontFamily: 'Sora_600SemiBold',
  },
  priceBox: {
    flexShrink: 0,
    alignSelf: 'center',
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: 15,
    fontFamily: 'Sora_800ExtraBold',
  },
  priceLabel: {
    fontSize: 10,
    fontFamily: 'Sora_600SemiBold',
  },
  stopChip: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  stopChipText: {
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
  },

  // Loading & Empty
  loadingWrap: {
    padding: 40,
    alignItems: 'center',
  },
  emptyWrap: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    borderRadius: 20,
    width: '96%',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  pickerLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  pickerTitle: {
    fontSize: 17,
    fontFamily: 'Sora_600SemiBold',
  },
  provinceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  provinceOptionText: {
    fontSize: 15,
  },
  deptAllItem: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  provinceGridItem: {
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  provinceGridImage: {
    width: 96,
    height: 96,
    marginBottom: 10,
  },
  provinceGridAllIcon: {
    width: 96,
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  provinceGridLabel: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  provinceGridCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  dateBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  dateBtnPrimary: {
    borderWidth: 0,
  },
  dateBtnText: {
    fontSize: 15,
    fontFamily: 'Sora_500Medium',
  },
});

export default HomeScreen;
