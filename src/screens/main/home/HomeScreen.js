import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
  Animated,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { get_public, get_withauth, buildImageUri } from '../../../services/apiService';
import { sanitizeImageUrl } from '../../../utils/imageUtils';
import { ENDPOINTS } from '../../../config/api';
import { useNotifications } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import { useTheme } from '../../../context/ThemeContext';
import { useColors } from '../../../hooks/useColors';
import NotificationsScreen from '../profile/NotificationsScreen';
import BannerDetailModal from '../../../components/modals/BannerDetailModal';
import { tripDisplaySeats } from '../../../utils/tripSeatsDisplay';
import { reportError } from '../../../utils/sentry';
import { getOpenTripRequests, getMyTripRequests } from '../../../services/tripRequestService';
import { TAB_BAR_SPACE } from '../../../components/ui/FloatingTabBar';
import { useUI } from '../../../theme/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 48;
const BANNER_HEIGHT = 160;
const BANNER_ITEM_WIDTH = BANNER_WIDTH + 16;

/** Incluye solo viajes públicos verdaderamente “próximos”: no cancelados ni completados, listado activo y salida aún no pasada */
function tripQualifiesForHomeUpcomingStrip(trip) {
  if (!trip) return false;
  const status = trip.status;
  if (status === 'cancelled' || status === 'completed') return false;
  if (status === 'started') return false;
  if (trip.isActive === false) return false;
  const rawTime = trip.departureTime != null ? String(trip.departureTime).trim() : '';
  const timePart = rawTime || '00:00';
  const dep = new Date(`${trip.departureDate}T${timePart}`);
  if (!Number.isNaN(dep.getTime()) && dep.getTime() < Date.now()) return false;
  return true;
}

const BannerCarousel = ({ banners, dotColor, dotInactiveColor, onBannerPress }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);
  const autoScrollTimer = useRef(null);

  useEffect(() => {
    if (banners.length > 1) {
      autoScrollTimer.current = setInterval(() => {
        setActiveIndex((prev) => {
          const next = (prev + 1) % banners.length;
          scrollRef.current?.scrollToIndex({ index: next, animated: true });
          return next;
        });
      }, 5000);
    }
    return () => clearInterval(autoScrollTimer.current);
  }, [banners]);

  const onScroll = (event) => {
    const index = Math.floor(event.nativeEvent.contentOffset.x / (BANNER_ITEM_WIDTH));
    if (index !== activeIndex && index >= 0 && index < banners.length) {
      setActiveIndex(index);
    }
  };

  return (
    <View>
      <FlatList
        ref={scrollRef}
        data={banners}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.bannerSlide}
            activeOpacity={0.92}
            onPress={() => onBannerPress?.(item)}
          >
            {item.imageUrl ? (
              <Image source={{ uri: sanitizeImageUrl(item.imageUrl) }} style={styles.bannerImage} resizeMode="cover" />
            ) : (
              <View style={styles.bannerContent} />
            )}
          </TouchableOpacity>
        )}
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={BANNER_ITEM_WIDTH}
        decelerationRate="fast"
        contentContainerStyle={styles.bannerListContent}
        getItemLayout={(_, index) => ({
          length: BANNER_ITEM_WIDTH,
          offset: BANNER_ITEM_WIDTH * index,
          index,
        })}
      />
      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, dotInactiveColor && { backgroundColor: dotInactiveColor }, i === activeIndex && [styles.dotActive, dotColor && { backgroundColor: dotColor }]]}

            />
          ))}
        </View>
      )}
    </View>
  );
};

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
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('inicio');
  const [bannerModal, setBannerModal] = useState({ visible: false, banner: null });
  const [activeTrip, setActiveTrip] = useState(null);
  const [activeTripRole, setActiveTripRole] = useState(null);
  const [openRequests, setOpenRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const pulseDot = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadRecentTrips();
    loadBannerSections();
    loadOpenRequests();
    if (isAuthenticated) loadActiveTrip();
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
      const response = await get_public(ENDPOINTS.GET_TRIPS, { limit: 40 });
      if (response.success && Array.isArray(response.data)) {
        const userId = user?._id || user?.id;
        const upcoming = response.data.filter(t => {
          if (!tripQualifiesForHomeUpcomingStrip(t)) return false;
          const driverId = t.driver?._id || t.driver;
          return !userId || String(driverId) !== String(userId);
        });
        const sortedTrips = [...upcoming].sort((a, b) => {
          const dateA = new Date(`${a.departureDate}T${a.departureTime || '00:00'}`);
          const dateB = new Date(`${b.departureDate}T${b.departureTime || '00:00'}`);
          return dateA - dateB;
        });
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
    } catch {
      // no-op: banner is optional
    }
  };

  const loadBannerSections = async () => {
    try {
      const response = await get_public(ENDPOINTS.GET_BANNER_SECTIONS);
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
        getOpenTripRequests(),
        isAuthenticated ? getMyTripRequests() : Promise.resolve({ success: false }),
      ]);
      const open = openRes.status === 'fulfilled' && openRes.value?.success ? openRes.value.data : [];
      const mine = myRes.status === 'fulfilled' && myRes.value?.success ? myRes.value.data : [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
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

  const getDriverInitials = (driver) => {
    if (!driver) return '?';
    return `${driver.firstName?.[0] || ''}${driver.lastName?.[0] || ''}`;
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

  const renderTripCard = (trip) => {
    const freeSeats = tripDisplaySeats(trip);
    return (
    <TouchableOpacity
      key={trip._id}
      style={[
        styles.tripCard,
        { backgroundColor: cardBg },
      ]}
      onPress={() => navigation.navigate('TripDetail', { tripId: trip._id })}
      activeOpacity={0.7}
    >
      {/* Driver row */}
      <View style={styles.tripDriverRow}>
        {trip.driver?.avatar ? (
          <Image
            source={{ uri: buildImageUri(trip.driver.avatar) }}
            style={styles.driverAvatar}
          />
        ) : (
          <View style={[styles.driverAvatarPlaceholder, { backgroundColor: ui.bg }]}>
            <Text style={[styles.driverInitials, { color: textSecondary }]}>
              {getDriverInitials(trip.driver)}
            </Text>
          </View>
        )}
        <View style={styles.driverInfo}>
          <Text style={[styles.driverName, { color: textPrimary }]}>
            {trip.driver?.firstName} {trip.driver?.lastName}
          </Text>
          <Text style={[styles.tripDateTime, { color: textMuted }]}>
            {new Date(trip.departureDate).toLocaleDateString('es-ES', {
              weekday: 'short', day: 'numeric', month: 'short',
            })}{'  '}{trip.departureTime}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={tripCardChevron} />
      </View>

      {/* Divider */}
      <View style={[styles.tripInnerDivider, { backgroundColor: divider }]} />

      {/* Route */}
      <View style={styles.tripRouteRow}>
        <View style={styles.routeColumn}>
          <View style={[styles.routeDot, { borderColor: accent }]} />
          <View style={[styles.routeLineVertical, { backgroundColor: tripRouteLine }]} />
          <View style={[styles.routeDotFilled, { backgroundColor: accent }]} />
        </View>
        <View style={styles.tripInfoColumn}>
          <Text style={[styles.routeLabel, { color: tripRouteMuted }]}>Origen</Text>
          <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={2}>
            {formatAddress(trip.origin) || trip.origin?.city}
          </Text>
          <View style={{ height: 14 }} />
          <Text style={[styles.routeLabel, { color: tripRouteMuted }]}>Destino</Text>
          <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={2}>
            {formatAddress(trip.destination) || trip.destination?.city}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.tripFooterRow, { borderTopColor: divider }]}>
        <View style={styles.tripFooterItem}>
          <Ionicons name="person-outline" size={13} color={tripRouteMuted} />
          <Text style={[styles.tripFooterText, { color: tripRouteMuted }]}>
            {freeSeats === 0
              ? 'Completo'
              : `${freeSeats} disponible${freeSeats !== 1 ? 's' : ''}`}
          </Text>
        </View>
        {trip.intermediateStops?.length > 0 && (
          <View style={styles.tripFooterItem}>
            <Ionicons name="git-branch-outline" size={13} color={tripRouteMuted} />
            <Text style={[styles.tripFooterText, { color: tripRouteMuted }]}>
              {trip.intermediateStops.length} parada{trip.intermediateStops.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
    );
  };

  const renderRequestCard = (req) => {
    const totalApps = req.applicationCount ?? req.applications?.length ?? 0;
    return (
      <TouchableOpacity
        key={req._id}
        style={[styles.tripCard, { backgroundColor: cardBg }]}
        onPress={() => navigation.getParent('AppStack')?.navigate('TripRequestDetail', { requestId: req._id })}
        activeOpacity={0.7}
      >
        {/* Header row */}
        <View style={styles.tripDriverRow}>
          {req.passenger?.avatar ? (
            <Image source={{ uri: buildImageUri(req.passenger.avatar) }} style={styles.driverAvatar} />
          ) : (
            <View style={[styles.driverAvatarPlaceholder, { backgroundColor: ui.bg }]}>
              <Ionicons name="person-outline" size={18} color={textMuted} />
            </View>
          )}
          <View style={styles.driverInfo}>
            <Text style={[styles.driverName, { color: textPrimary }]}>
              {req.origin?.city} → {req.destination?.city}
            </Text>
            <Text style={[styles.tripDateTime, { color: textMuted }]}>
              {/* timeZone UTC: es un dia de calendario, sin esto en UTC-3 muestra el dia anterior.
                  Ojo: la card de VIAJES (arriba) NO lleva esto, ahi departureDate es un instante real. */}
              {new Date(req.departureDate).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}
              {'  '}{req.departureTime || ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={tripCardChevron} />
        </View>

        <View style={[styles.tripInnerDivider, { backgroundColor: divider }]} />

        {/* Route */}
        <View style={styles.tripRouteRow}>
          <View style={styles.routeColumn}>
            <View style={[styles.routeDot, { borderColor: accent }]} />
            <View style={[styles.routeLineVertical, { backgroundColor: tripRouteLine }]} />
            <View style={[styles.routeDotFilled, { backgroundColor: accent }]} />
          </View>
          <View style={styles.tripInfoColumn}>
            <Text style={[styles.routeLabel, { color: tripRouteMuted }]}>Origen</Text>
            <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={2}>
              {req.origin?.address || req.origin?.city}
            </Text>
            <View style={{ height: 14 }} />
            <Text style={[styles.routeLabel, { color: tripRouteMuted }]}>Destino</Text>
            <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={2}>
              {req.destination?.address || req.destination?.city}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={[styles.tripFooterRow, { borderTopColor: divider }]}>
          {/* <View style={styles.tripFooterItem}>
            <Ionicons name="cash-outline" size={13} color={tripRouteMuted} />
            <Text style={[styles.tripFooterText, { color: tripRouteMuted }]}>
              ${req.pricePerSeat?.toLocaleString('es-AR')} por asiento
            </Text>
          </View> */}
          {totalApps > 0 && (
            <View style={styles.tripFooterItem}>
              <Ionicons name="people-outline" size={13} color={tripRouteMuted} />
              <Text style={[styles.tripFooterText, { color: tripRouteMuted }]}>
                {totalApps} postulacion{totalApps !== 1 ? 'es' : ''}
              </Text>
            </View>
          )}
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
            onPress={() => setActiveTab('inicio')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabPillText, { color: activeTab === 'inicio' ? accentInverse : textMuted }]}>Inicio</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabPillItem, activeTab === 'solicitudes' && { backgroundColor: accent }]}
            onPress={() => setActiveTab('solicitudes')}
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
              onPress={() => navigation.navigate('TripDetail', { tripId: activeTrip._id })}
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

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={textMuted} />
            </View>
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
                dotColor={accent}
                dotInactiveColor={borderColor}
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
          contentContainerStyle={{ paddingBottom: 40 }}
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
                onPress={() => navigation.navigate('TripDetail', { tripId: activeTrip._id })}
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
            <View style={[styles.hubIcon, { backgroundColor: accent }]}>
              <Ionicons name="add" size={22} color={accentInverse} />
            </View>
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
            <View style={[styles.hubIcon, { backgroundColor: inputBg }]}>
              <Ionicons name="list" size={22} color={textPrimary} />
            </View>
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
            <View style={[styles.hubIcon, { backgroundColor: inputBg }]}>
              <Ionicons name="search" size={22} color={textPrimary} />
            </View>
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
            <View style={[styles.hubIcon, { backgroundColor: inputBg }]}>
              <Ionicons name="car-outline" size={22} color={textPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.hubCardTitle, { color: textPrimary }]}>Viajes que ofrecí</Text>
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
            {loadingRequests ? (
              <ActivityIndicator size="small" color={textMuted} style={{ marginVertical: 16 }} />
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
                  dotColor={accent}
                  dotInactiveColor={borderColor}
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
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: TAB_BAR_SPACE,
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
  solicitudesCards: {
    padding: 16,
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
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
  bannerListContent: {
    paddingHorizontal: 24,
  },
  bannerSlide: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    marginRight: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerContent: {
    flex: 1,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
    backgroundColor: '#D0D0D0',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#000000',
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

  // Trip Card
  tripCard: {
    borderRadius: 24,
    marginBottom: 12,
  },
  tripDriverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  driverAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInitials: {
    fontSize: 14,
    fontFamily: 'Sora_600SemiBold',
  },
  driverInfo: {
    flex: 1,
    gap: 3,
  },
  driverName: {
    fontSize: 15,
    fontFamily: 'Sora_600SemiBold',
  },
  tripDateTime: {
    fontSize: 12,
  },
  tripInnerDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  tripRouteRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  routeColumn: {
    width: 22,
    alignItems: 'center',
    paddingTop: 4,
    marginRight: 14,
  },
  routeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
  },
  routeLineVertical: {
    width: 1.5,
    height: 28,
    marginVertical: 3,
  },
  routeDotFilled: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  tripInfoColumn: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    fontFamily: 'Sora_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  routeText: {
    fontSize: 14,
    fontFamily: 'Sora_500Medium',
  },
  tripFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tripFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tripFooterText: {
    fontSize: 12,
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
