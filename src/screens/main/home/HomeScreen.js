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
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { get_public, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { ARGENTINA_PROVINCES } from '../../../constants/provinces';
import { useNotifications } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import { useTheme } from '../../../context/ThemeContext';
import { useColors } from '../../../hooks/useColors';
import NotificationsScreen from '../profile/NotificationsScreen';
import BannerDetailModal from '../../../components/modals/BannerDetailModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 48;
const BANNER_HEIGHT = 160;
const BANNER_ITEM_WIDTH = BANNER_WIDTH + 16;

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
              <Image source={{ uri: item.imageUrl }} style={styles.bannerImage} resizeMode="cover" />
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

const HomeScreen = ({ navigation }) => {
  const { isAuthenticated } = useAuth();
  const { unreadCount = 0 } = useNotifications();
  useTheme();
  const { showAlert } = useAlert();
  const { colors, getCurrentThemeMode } = useColors();

  const dark = getCurrentThemeMode() === 'dark';

  const LOGO_SOURCE = dark
    ? require('../../../../assets/logo/192x192-white.png')
    : require('../../../../assets/logo/192x192-black.png');

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [recentTrips, setRecentTrips] = useState([]);
  const [bannersEnterprise, setBannersEnterprise] = useState([]);
  const [bannersVip, setBannersVip] = useState([]);
  const [bannersPremium, setBannersPremium] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [bannerModal, setBannerModal] = useState({ visible: false, banner: null });

  useEffect(() => {
    loadRecentTrips();
    loadBannersEnterprise();
    loadBannersVip();
    loadBannersPremium();
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setShowNotificationsModal(false);
      };
    }, [])
  );

  const loadRecentTrips = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const response = await get_public(ENDPOINTS.GET_TRIPS, { limit: 10 });
      if (response.success) {
        const sortedTrips = response.data.sort((a, b) => {
          const dateA = new Date(`${a.departureDate}T${a.departureTime}`);
          const dateB = new Date(`${b.departureDate}T${b.departureTime}`);
          return dateA - dateB;
        });
        setRecentTrips(sortedTrips.slice(0, 5));
      }
    } catch (error) {
      console.error('Error loading trips:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadBannersEnterprise = async () => {
    try {
      const response = await get_public(ENDPOINTS.GET_BANNERS_BY_PACKAGE('enterprise'), { isActive: true });
      if (response.success && Array.isArray(response.data)) {
        setBannersEnterprise(response.data.filter(b => b.isActive));
      }
    } catch (error) {
      console.error('Error loading bannersEnterprise:', error);
    }
  };

  const loadBannersVip = async () => {
    try {
      const response = await get_public(ENDPOINTS.GET_BANNERS_BY_PACKAGE('vip'), { isActive: true });
      if (response.success && Array.isArray(response.data)) {
        setBannersVip(response.data.filter(b => b.isActive));
      }
    } catch (error) {
      console.error('Error loading bannersVip:', error);
    }
  };

  const loadBannersPremium = async () => {
    try {
      const response = await get_public(ENDPOINTS.GET_BANNERS_BY_PACKAGE('premium'), { isActive: true });
      if (response.success && Array.isArray(response.data)) {
        setBannersPremium(response.data.filter(b => b.isActive));
      }
    } catch (error) {
      console.error('Error loading bannersPremium:', error);
    }
  };

  const onRefresh = () => {
    loadRecentTrips(true);
    loadBannersEnterprise();
    loadBannersVip();
    loadBannersPremium();
  };

  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleDatePickerOpen = () => {
    if (!selectedDate) {
      setSelectedDate(new Date());
    }
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
      showAlert('Error', 'Por favor completa al menos el origen o destino');
      return;
    }
    navigation.navigate('SearchResults', {
      origin,
      destination,
      date: selectedDate,
      seats: selectedSeats,
    });
  };

  const clearFilters = () => {
    setOrigin('');
    setDestination('');
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
    raw = raw.replace(/, [A-Z][0-9]{4}[A-Z0-9]{0,3}\s+/g, ', ');
    const city = location.city || location.name || '';
    if (raw) return raw;
    return city;
  };

  // Dynamic colors
  const bg = colors.background;
  const cardBg = dark ? '#222222' : '#F7F7F7';
  const inputBg = dark ? '#222222' : '#F7F7F7';
  const textPrimary = colors.textPrimary;
  const textSecondary = colors.textSecondary;
  const textMuted = colors.textMuted;
  const borderColor = dark ? '#2A2A2A' : '#E8E8E8';
  const accent = dark ? '#FFFFFF' : '#000000';
  const accentInverse = dark ? '#000000' : '#FFFFFF';
  const divider = dark ? '#2A2A2A' : '#F0F0F0';
  /** Contraste fuerte en claro: labels, paradas, flechas */
  const tripRouteMuted = dark ? textMuted : '#111827';
  const tripCardChevron = dark ? '#444444' : '#111827';
  const tripRouteLine = dark ? '#333333' : '#374151';
  /** Búsqueda inicio: en claro texto negro para leer bien (4 campos) */
  const searchFieldLabel = dark ? textMuted : '#000000';
  const searchFieldEmpty = dark ? textMuted : '#000000';

  const renderTripCard = (trip) => (
    <TouchableOpacity
      key={trip._id}
      style={[
        styles.tripCard,
        { backgroundColor: cardBg },
        !dark && styles.tripCardShadowLight,
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
          <View style={[styles.driverAvatarPlaceholder, { backgroundColor: dark ? '#2A2A2A' : '#E8E8E8' }]}>
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
          <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={1}>
            {formatAddress(trip.origin) || trip.origin?.city}
          </Text>
          <View style={{ height: 14 }} />
          <Text style={[styles.routeLabel, { color: tripRouteMuted }]}>Destino</Text>
          <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={1}>
            {formatAddress(trip.destination) || trip.destination?.city}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.tripFooterRow, { borderTopColor: divider }]}>
        <View style={styles.tripFooterItem}>
          <Ionicons name="person-outline" size={13} color={tripRouteMuted} />
          <Text style={[styles.tripFooterText, { color: tripRouteMuted }]}>
            {trip.availableSeats} lugar{trip.availableSeats !== 1 ? 'es' : ''}
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

  const renderProvincePicker = (visible, onClose, selected, onSelect, title) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.pickerContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: divider }]}>
            <Text style={[styles.pickerTitle, { color: textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {ARGENTINA_PROVINCES.map((province) => (
              <TouchableOpacity
                key={province}
                onPress={() => { onSelect(province); onClose(); }}
                style={[
                  styles.provinceOption,
                  { borderBottomColor: divider },
                  selected === province && { backgroundColor: dark ? '#222' : '#F5F5F5' },
                ]}
              >
                <Text style={[
                  styles.provinceOptionText,
                  { color: selected === province ? textPrimary : textSecondary },
                  selected === province && { fontWeight: '600' },
                ]}>
                  {province}
                </Text>
                {selected === province && (
                  <Ionicons name="checkmark" size={18} color={accent} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={textMuted}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Image source={LOGO_SOURCE} style={styles.logo} />
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Carpuling</Text>
          <Text style={[styles.headerSub, { color: textMuted }]}>Viaja inteligente</Text>
          {isAuthenticated && (
            <TouchableOpacity
              onPress={() => setShowNotificationsModal(true)}
              style={[styles.notifBtn, { backgroundColor: inputBg }]}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={20} color={textPrimary} />
              {unreadCount > 0 && (
                <View style={[styles.notifBadge, { borderColor: bg }]}>
                  <Text style={styles.notifBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Search block */}
        <View style={[styles.searchBlock, { backgroundColor: inputBg }]}>
          {/* Origin */}
          <TouchableOpacity
            style={styles.searchRow}
            onPress={() => setShowOriginPicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.routeIndicator}>
              <View style={[styles.dotOutline, { borderColor: accent }]} />
            </View>
            <Text style={[
              styles.searchRowText,
              { color: origin ? textPrimary : searchFieldEmpty },
            ]}>
              {origin || 'Origen'}
            </Text>
          </TouchableOpacity>

          <View style={[styles.searchDivider, { backgroundColor: divider }]}>
            <View style={[styles.routeConnector, { backgroundColor: dark ? '#444' : '#CCC' }]} />
          </View>

          {/* Destination */}
          <TouchableOpacity
            style={styles.searchRow}
            onPress={() => setShowDestinationPicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.routeIndicator}>
              <View style={[styles.dotFilled, { backgroundColor: accent }]} />
            </View>
            <Text style={[
              styles.searchRowText,
              { color: destination ? textPrimary : searchFieldEmpty },
            ]}>
              {destination || 'Destino'}
            </Text>
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

        {/* Banner Enterprise */}
        {bannersEnterprise.length > 0 && (
          <View style={styles.bannerSection}>
            <BannerCarousel
              banners={bannersEnterprise}
              dotColor={accent}
              dotInactiveColor={borderColor}
              onBannerPress={(b) => setBannerModal({ visible: true, banner: b })}
            />
          </View>
        )}

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

        {/* Banner VIP */}
        {bannersVip.length > 0 && (
          <View style={styles.bannerSection}>
            <BannerCarousel
              banners={bannersVip}
              dotColor={accent}
              dotInactiveColor={borderColor}
              onBannerPress={(b) => setBannerModal({ visible: true, banner: b })}
            />
          </View>
        )}

        {/* Banner Premium */}
        {bannersPremium.length > 0 && (
          <View style={styles.bannerSection}>
            <BannerCarousel
              banners={bannersPremium}
              dotColor={accent}
              dotInactiveColor={borderColor}
              onBannerPress={(b) => setBannerModal({ visible: true, banner: b })}
            />
          </View>
        )}
      </ScrollView>

      {/* Province Pickers */}
      {renderProvincePicker(showOriginPicker, () => setShowOriginPicker(false), origin, setOrigin, 'Origen')}
      {renderProvincePicker(showDestinationPicker, () => setShowDestinationPicker(false), destination, setDestination, 'Destino')}

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
                  <View style={{ padding: 16 }}>
                    <DateTimePicker
                      value={selectedDate || new Date()}
                      mode="date"
                      display="spinner"
                      onChange={handleDateChange}
                      minimumDate={new Date()}
                      textColor={textPrimary}
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
    paddingBottom: 40,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    position: 'relative',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    marginBottom: 10,
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    marginTop: 4,
  },
  notifBtn: {
    position: 'absolute',
    top: 20,
    right: 24,
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
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },

  // Search block
  searchBlock: {
    marginHorizontal: 24,
    borderRadius: 16,
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
    fontWeight: '400',
  },
  searchRowContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  searchRowLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchRowValue: {
    fontSize: 15,
    fontWeight: '400',
  },
  searchRowInput: {
    fontSize: 15,
    fontWeight: '400',
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
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  clearFiltersLink: {
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearFiltersLinkText: {
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },

  // Banners
  bannerSection: {
    marginTop: 28,
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
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Trip Card
  tripCard: {
    borderRadius: 14,
    marginBottom: 12,
  },
  tripCardShadowLight: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
    fontWeight: '600',
  },
  driverInfo: {
    flex: 1,
    gap: 3,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '600',
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
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  routeText: {
    fontSize: 14,
    fontWeight: '500',
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
    borderRadius: 16,
    width: '88%',
    maxHeight: '75%',
    overflow: 'hidden',
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
    fontWeight: '600',
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
    fontWeight: '500',
  },
});

export default HomeScreen;
