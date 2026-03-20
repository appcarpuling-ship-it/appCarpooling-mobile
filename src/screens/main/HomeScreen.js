import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
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
import { get_public, buildImageUri } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { ARGENTINA_PROVINCES } from '../../constants/provinces';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { useTheme } from '../../context/ThemeContext';
import { useColors } from '../../hooks/useColors';
import NotificationsScreen from './NotificationsScreen';
import { handleBannerPress } from '../../utils/bannerNavigation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 48;
const BANNER_HEIGHT = 160;
const BANNER_ITEM_WIDTH = BANNER_WIDTH + 16;
const BANNER_SCROLL_SPEED = 30;

const BannerCarousel = ({ banners, navigation }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const totalWidth = banners.length * BANNER_ITEM_WIDTH;

  useEffect(() => {
    if (banners.length <= 1) return;
    const duration = (totalWidth / BANNER_SCROLL_SPEED) * 1000;
    const animation = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -totalWidth,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [banners]);

  const duplicated = banners.length > 1 ? [...banners, ...banners] : banners;

  return (
    <View style={{ overflow: 'hidden' }}>
      <Animated.View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 24,
          gap: 16,
          transform: [{ translateX: scrollX }],
        }}
      >
        {duplicated.map((item, index) => (
          <TouchableOpacity
            key={`${item._id}-${index}`}
            activeOpacity={0.92}
            style={styles.bannerSlide}
            onPress={() => handleBannerPress(item, navigation)}
          >
            {item.imageUrl ? (
              <View style={StyleSheet.absoluteFillObject}>
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
              </View>
            ) : (
              <View style={styles.bannerContent}>
                <Text style={styles.bannerTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.description && (
                  <Text style={styles.bannerDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </Animated.View>
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
    ? require('../../../assets/logo/192x192-white.png')
    : require('../../../assets/logo/192x192-black.png');

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
  const cardBg = dark ? '#1A1A1A' : '#F7F7F7';
  const inputBg = dark ? '#1A1A1A' : '#F7F7F7';
  const textPrimary = colors.textPrimary;
  const textSecondary = colors.textSecondary;
  const textMuted = colors.textMuted;
  const borderColor = dark ? '#2A2A2A' : '#E8E8E8';
  const accent = dark ? '#FFFFFF' : '#000000';
  const accentInverse = dark ? '#000000' : '#FFFFFF';
  const divider = dark ? '#2A2A2A' : '#F0F0F0';

  const renderTripCard = (trip) => (
    <TouchableOpacity
      key={trip._id}
      style={[styles.tripCard, { backgroundColor: cardBg }]}
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
        <Ionicons name="chevron-forward" size={16} color={dark ? '#444' : '#CCC'} />
      </View>

      {/* Divider */}
      <View style={[styles.tripInnerDivider, { backgroundColor: divider }]} />

      {/* Route */}
      <View style={styles.tripRouteRow}>
        <View style={styles.routeColumn}>
          <View style={[styles.routeDot, { borderColor: accent }]} />
          <View style={[styles.routeLineVertical, { backgroundColor: dark ? '#333' : '#D0D0D0' }]} />
          <View style={[styles.routeDotFilled, { backgroundColor: accent }]} />
        </View>
        <View style={styles.tripInfoColumn}>
          <Text style={[styles.routeLabel, { color: textMuted }]}>Origen</Text>
          <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={1}>
            {formatAddress(trip.origin) || trip.origin?.city}
          </Text>
          <View style={{ height: 14 }} />
          <Text style={[styles.routeLabel, { color: textMuted }]}>Destino</Text>
          <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={1}>
            {formatAddress(trip.destination) || trip.destination?.city}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.tripFooterRow, { borderTopColor: divider }]}>
        <View style={styles.tripFooterItem}>
          <Ionicons name="person-outline" size={13} color={textMuted} />
          <Text style={[styles.tripFooterText, { color: textMuted }]}>
            {trip.availableSeats} lugar{trip.availableSeats !== 1 ? 'es' : ''}
          </Text>
        </View>
        {trip.intermediateStops?.length > 0 && (
          <View style={styles.tripFooterItem}>
            <Ionicons name="git-branch-outline" size={13} color={textMuted} />
            <Text style={[styles.tripFooterText, { color: textMuted }]}>
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
              { color: origin ? textPrimary : textMuted },
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
              { color: destination ? textPrimary : textMuted },
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
              <Ionicons name="calendar-outline" size={16} color="#000" />
            </View>
            <View style={styles.searchRowContent}>
              <Text style={[styles.searchRowLabel, { color: textMuted }]}>Fecha</Text>
              <Text style={[styles.searchRowValue, { color: selectedDate ? textPrimary : textMuted }]}>
                {selectedDate ? formatDate(selectedDate) : 'Cualquier dia'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.searchDividerFull, { backgroundColor: divider }]} />

          {/* Seats row */}
          <View style={styles.searchRow}>
            <View style={styles.routeIndicator}>
              <Ionicons name="person-outline" size={16} color="#000" />
            </View>
            <View style={styles.searchRowContent}>
              <Text style={[styles.searchRowLabel, { color: textMuted }]}>Asientos</Text>
              <TextInput
                style={[styles.searchRowInput, { color: selectedSeats ? textPrimary : textMuted }]}
                placeholder="Cuantos viajan"
                placeholderTextColor={textMuted}
                value={selectedSeats}
                onChangeText={setSelectedSeats}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: accent }]}
            onPress={handleSearch}
            activeOpacity={0.85}
          >
            <Text style={[styles.searchBtnText, { color: accentInverse }]}>Buscar viajes</Text>
          </TouchableOpacity>

          {(origin || destination || selectedDate || selectedSeats) && (
            <TouchableOpacity
              style={[styles.clearBtn, { borderColor: borderColor }]}
              onPress={clearFilters}
              activeOpacity={0.7}
            >
              <Ionicons name="close-outline" size={16} color={textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Banner Enterprise */}
        {bannersEnterprise.length > 0 && (
          <View style={styles.bannerSection}>
            <BannerCarousel banners={bannersEnterprise} navigation={navigation} />
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
            <BannerCarousel banners={bannersVip} navigation={navigation} />
          </View>
        )}

        {/* Banner Premium */}
        {bannersPremium.length > 0 && (
          <View style={styles.bannerSection}>
            <BannerCarousel banners={bannersPremium} navigation={navigation} />
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

  // Actions row
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 12,
    gap: 10,
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
  clearBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Banners
  bannerSection: {
    marginTop: 28,
  },
  bannerSlide: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
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
    padding: 18,
    justifyContent: 'flex-end',
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  bannerDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
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
    overflow: 'hidden',
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
