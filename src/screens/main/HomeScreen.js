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
  Linking,
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
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 48;
const BANNER_HEIGHT = 180;
const BANNER_ITEM_WIDTH = BANNER_WIDTH + 16;
const BANNER_SCROLL_SPEED = 30;

const ContinuousCarousel = ({ banners }) => {
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
          transform: [{ translateX: scrollX }],
        }}
      >
        {duplicated.map((item, index) => (
          <TouchableOpacity
            key={`${item._id}-${index}`}
            activeOpacity={0.95}
            style={styles.bannerSlide}
          >
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
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
                {item.clickUrl && (
                  <View style={styles.bannerCta}>
                    <Text style={styles.bannerCtaText}>Ver más</Text>
                    <Ionicons name="arrow-forward" size={14} color="#FFF" />
                  </View>
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
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();
  const { colors, getCurrentThemeMode } = useColors();

  // Logo dinámico según el tema
  const LOGO_SOURCE = isDarkMode
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
    // Si no hay fecha seleccionada, setear la fecha de hoy automáticamente
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
      // Si no hay filtros, mostrar todos los viajes
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
    if (!driver) return '??';
    return `${driver.firstName?.[0] || ''}${driver.lastName?.[0] || ''}`;
  };

  const renderTripCard = (trip) => (
    <TouchableOpacity
      key={trip._id}
      style={[styles.tripCard, {
        backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground,
        borderColor: colors.border
      }]}
      onPress={() => navigation.navigate('TripDetail', { tripId: trip._id })}
      activeOpacity={0.7}
    >
      {/* Driver info */}
      <View style={styles.tripHeader}>
        {trip.driver?.avatar ? (
          <Image
            source={{ uri: buildImageUri(trip.driver.avatar) }}
            style={styles.driverAvatar}
          />
        ) : (
          <View style={[styles.driverAvatarPlaceholder, { backgroundColor: '#6B7280' }]}>
            <Text style={styles.driverInitials}>{getDriverInitials(trip.driver)}</Text>
          </View>
        )}
        <View style={styles.tripInfo}>
          <Text style={[styles.driverName, { color: colors.textPrimary }]}>
            {trip.driver?.firstName} {trip.driver?.lastName}
          </Text>
          <Text style={[styles.tripDate, { color: colors.textSecondary }]}>
            {new Date(trip.departureDate).toLocaleDateString('es-ES', {
              weekday: 'short',
              day: 'numeric',
              month: 'short'
            })} - {trip.departureTime}
          </Text>
        </View>

      </View>

      {/* Route */}
      <View style={styles.routeContainer}>
        <View style={styles.routeDotsContainer}>
          <View style={[styles.routeDotOrigin, { borderColor: colors.primary }]} />
          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
          <View style={[styles.routeDotDestination, { backgroundColor: colors.primary }]} />
        </View>
        <View style={styles.routeTexts}>
          <Text style={[styles.routeCity, { color: colors.textSecondary }]} numberOfLines={1}>
            {trip.origin.address ? `${trip.origin.address}, ${trip.origin.city}` : trip.origin.city}
          </Text>
          <Text style={[styles.routeCity, { color: colors.textSecondary }]} numberOfLines={1}>
            {trip.destination.address ? `${trip.destination.address}, ${trip.destination.city}` : trip.destination.city}
          </Text>
        </View>
      </View>
      {trip.intermediateStops && trip.intermediateStops.length > 0 && (
        <Text style={[styles.routeCityIntermediate, { color: colors.textTertiary }]} numberOfLines={1}>
          +{trip.intermediateStops.length} parada{trip.intermediateStops.length !== 1 ? 's' : ''}
        </Text>
      )}

      {/* Footer */}
      <View style={[styles.tripFooter, { borderTopColor: colors.borderLight }]}>
        <View style={styles.seatsInfo}>
          <Ionicons name="person-outline" size={14} color={colors.textTertiary} />
          <Text style={[styles.seatsText, { color: colors.textTertiary }]}>
            {trip.availableSeats} lugar{trip.availableSeats !== 1 ? 'es' : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );

  const renderProvincePicker = (visible, onClose, selected, onSelect, title) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.pickerContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.pickerTitle, { color: colors.textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={[styles.provinceList, { backgroundColor: colors.surface }]} showsVerticalScrollIndicator={false}>
            {ARGENTINA_PROVINCES.map((province) => (
              <TouchableOpacity
                key={province}
                onPress={() => {
                  onSelect(province);
                  onClose();
                }}
                style={[
                  styles.provinceOption,
                  selected === province && styles.provinceOptionSelected,
                  {
                    backgroundColor: selected === province
                      ? colors.primaryLight
                      : getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground,
                    borderBottomColor: colors.borderLight
                  }
                ]}
              >
                <Text style={[
                  styles.provinceOptionText,
                  {
                    color: selected === province
                      ? colors.primary
                      : colors.textPrimary
                  }
                ]}>
                  {province}
                </Text>
                {selected === province && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          {isAuthenticated && (
            <TouchableOpacity
              onPress={() => setShowNotificationsModal(true)}
              style={[styles.notificationButton, {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border
              }]}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
              {unreadCount > 0 && (
                <View style={[styles.notificationBadge, { borderColor: colors.cardBackground }]}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <Image source={LOGO_SOURCE} style={styles.logo} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>Carpuling</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Viaja inteligente, ahorra más</Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TouchableOpacity
            style={[styles.inputContainer, {
              backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground,
              borderColor: colors.border
            }]}
            onPress={() => setShowOriginPicker(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.inputDot, { borderColor: colors.primary }]} />
            <Text style={[styles.inputText, origin && styles.inputTextFilled, {
              color: origin ? colors.textPrimary : colors.placeholder
            }]}>
              {origin || '¿Desde dónde viajas?'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.inputContainer, {
              backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground,
              borderColor: colors.border
            }]}
            onPress={() => setShowDestinationPicker(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.inputDotFilled, { backgroundColor: colors.primary }]} />
            <Text style={[styles.inputText, destination && styles.inputTextFilled, {
              color: destination ? colors.textPrimary : colors.placeholder
            }]}>
              {destination || '¿Cuál es tu destino?'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.inputContainer, {
              backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground,
              borderColor: colors.border
            }]}
            onPress={() => handleDatePickerOpen()}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.inputText, selectedDate && styles.inputTextFilled, {
              color: selectedDate ? colors.textPrimary : colors.placeholder
            }]}>
              {selectedDate ? formatDate(selectedDate) : '¿Cuándo sales?'}
            </Text>
          </TouchableOpacity>

          <View style={[styles.inputContainer, {
            backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground,
            borderColor: colors.border
          }]}>
            <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: colors.textPrimary }]}
              placeholder="¿Cuántos viajan?"
              placeholderTextColor={colors.placeholder}
              value={selectedSeats}
              onChangeText={setSelectedSeats}
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.searchButton,
              {
                backgroundColor: isDarkMode ? '#FFFFFF' : '#000000'
              }
            ]}
            onPress={handleSearch}
            activeOpacity={0.8}
          >
            {/* <Ionicons name="search" size={20} color={colors.background} /> */}
            <Text style={[styles.searchButtonText, { color: isDarkMode ? '#000000' : colors.background }]}>Buscar viajes</Text>
          </TouchableOpacity>

          {(origin || destination || selectedDate || selectedSeats) && (
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.clearButtonText, { color: colors.textSecondary }]}>Limpiar filtros</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Banner Enterprise */}
        {bannersEnterprise.length > 0 && (
          <View style={styles.bannerSection}>
            <ContinuousCarousel banners={bannersEnterprise} />
          </View>
        )}

        {/* Recent Trips */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Próximos viajes</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : recentTrips.length > 0 ? (
            recentTrips.map(renderTripCard)
          ) : (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
                <Ionicons name="car-outline" size={40} color={colors.textMuted} />
              </View>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No hay viajes disponibles</Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>Sé el primero en crear uno</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('AllTrips')}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewAllText, { color: colors.textPrimary }]}>Ver todos los viajes</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Banner VIP */}
        {bannersVip.length > 0 && (
          <View style={styles.bannerSection}>
            <ContinuousCarousel banners={bannersVip} />
          </View>
        )}

        {/* Banner Premium */}
        {bannersPremium.length > 0 && (
          <View style={styles.bannerSection}>
            <ContinuousCarousel banners={bannersPremium} />
          </View>
        )}
      </ScrollView>

      {/* Province Pickers */}
      {renderProvincePicker(showOriginPicker, () => setShowOriginPicker(false), origin, setOrigin, 'Seleccionar origen')}
      {renderProvincePicker(showDestinationPicker, () => setShowDestinationPicker(false), destination, setDestination, 'Seleccionar destino')}

      {/* Date Picker */}
      {showDatePicker && (
        <>
          {Platform.OS === 'ios' ? (
            <Modal visible transparent animationType="fade">
              <View style={styles.modalOverlay}>
                <View style={[styles.pickerContainer, { backgroundColor: colors.background }]}>
                  <View style={[styles.pickerHeader, { borderBottomColor: colors.borderLight }]}>
                    <Text style={[styles.pickerTitle, { color: colors.textPrimary }]}>Seleccionar fecha</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.datePickerWrapper, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.surface }]}>
                    <DateTimePicker
                      value={selectedDate || new Date()}
                      mode="date"
                      display="spinner"
                      onChange={handleDateChange}
                      minimumDate={new Date()}
                      textColor={colors.textPrimary}
                    />
                  </View>
                  <View style={[styles.pickerButtons, { backgroundColor: colors.background }]}>
                    <TouchableOpacity
                      style={[styles.pickerButtonClear, {
                        backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.surface,
                        borderColor: colors.border
                      }]}
                      onPress={() => {
                        setSelectedDate(null);
                        setShowDatePicker(false);
                      }}
                    >
                      <Text style={[styles.pickerButtonClearText, { color: colors.textSecondary }]}>Limpiar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pickerButtonConfirm, { backgroundColor: colors.primary }]}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={[styles.pickerButtonConfirmText, { color: colors.background }]}>Confirmar</Text>
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
            }
          }}
        />
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#F9FAFB', // Removido - ahora se usa color dinámico
  },
  scrollContent: {
    paddingBottom: 24,
  },
  // Header
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    position: 'relative',
  },
  notificationButton: {
    position: 'absolute',
    top: 16,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    marginBottom: 12,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
  },
  // Search
  searchContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  inputDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  inputDotFilled: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
  },
  inputTextFilled: {
    // color handled inline
  },
  textInput: {
    flex: 1,
    fontSize: 15,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 4,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Section
  section: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  // Trip Card
  tripCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  driverAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tripInfo: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '600',
  },
  tripDate: {
    fontSize: 13,
    marginTop: 2,
  },
  priceTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  // Route
  routeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  routeDotsContainer: {
    width: 20,
    alignItems: 'center',
    paddingVertical: 4,
  },
  routeDotOrigin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  routeLine: {
    flex: 1,
    width: 2,
    marginVertical: 4,
  },
  routeDotDestination: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeTexts: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  routeCity: {
    fontSize: 14,
  },
  routeCityIntermediate: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'left',
  },
  tripFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  seatsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seatsText: {
    fontSize: 13,
  },
  // Loading & Empty
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 4,
  },
  viewAllText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '85%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  provinceList: {
    maxHeight: 400,
  },
  provinceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  provinceOptionSelected: {
    backgroundColor: '#F3F4F6',
  },
  provinceOptionText: {
    fontSize: 15,
    color: '#374151',
  },
  provinceOptionTextSelected: {
    color: '#000000',
    fontWeight: '600',
  },
  datePickerWrapper: {
    padding: 16,
  },
  pickerButtons: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  pickerButtonClear: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickerButtonClearText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  pickerButtonConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    // backgroundColor manejado inline
  },
  pickerButtonConfirmText: {
    fontSize: 15,
    // color manejado inline
    fontWeight: '600',
  },
  // Banners
  bannerSection: {
    marginTop: 24,
    marginBottom: 8,
  },
  bannerSlide: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1F2937',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  bannerDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
  },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  bannerCtaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default HomeScreen;
