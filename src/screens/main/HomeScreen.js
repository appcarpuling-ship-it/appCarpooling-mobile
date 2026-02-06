import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
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
import NotificationsScreen from './NotificationsScreen';

const LOGO_SOURCE = require('../../../assets/logo/192x192.jpg');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 48;
const BANNER_HEIGHT = 180;
const BANNER_ITEM_WIDTH = BANNER_WIDTH + 16;
const BANNER_SCROLL_SPEED = 30;

const ContinuousCarousel = ({ banners, onBannerPress }) => {
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
            onPress={() => onBannerPress(item)}
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

  const handleBannerPress = async (banner) => {
    try {
      await get_public(ENDPOINTS.REGISTER_BANNER_CLICK(banner._id));
    } catch (error) {
      console.error('Error registering banner click:', error);
    }

    if (banner.clickUrl) {
      try {
        const canOpen = await Linking.canOpenURL(banner.clickUrl);
        if (canOpen) {
          await Linking.openURL(banner.clickUrl);
        }
      } catch (error) {
        console.error('Error opening banner URL:', error);
      }
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
      Alert.alert('Error', 'Por favor completa al menos el origen o destino');
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
      style={styles.tripCard}
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
          <View style={styles.driverAvatarPlaceholder}>
            <Text style={styles.driverInitials}>{getDriverInitials(trip.driver)}</Text>
          </View>
        )}
        <View style={styles.tripInfo}>
          <Text style={styles.driverName}>
            {trip.driver?.firstName} {trip.driver?.lastName}
          </Text>
          <Text style={styles.tripDate}>
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
          <View style={styles.routeDotOrigin} />
          <View style={styles.routeLine} />
          <View style={styles.routeDotDestination} />
        </View>
        <View style={styles.routeTexts}>
          <Text style={styles.routeCity} numberOfLines={1}>
            {trip.origin.address ? `${trip.origin.address}, ${trip.origin.city}` : trip.origin.city}
          </Text>
          <Text style={styles.routeCity} numberOfLines={1}>
            {trip.destination.address ? `${trip.destination.address}, ${trip.destination.city}` : trip.destination.city}
          </Text>
        </View>
      </View>
      {trip.intermediateStops && trip.intermediateStops.length > 0 && (
        <Text style={styles.routeCityIntermediate} numberOfLines={1}>
          +{trip.intermediateStops.length} parada{trip.intermediateStops.length !== 1 ? 's' : ''}
        </Text>
      )}

      {/* Footer */}
      <View style={styles.tripFooter}>
        <View style={styles.seatsInfo}>
          <Ionicons name="person-outline" size={14} color="#6B7280" />
          <Text style={styles.seatsText}>
            {trip.availableSeats} lugar{trip.availableSeats !== 1 ? 'es' : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );

  const renderProvincePicker = (visible, onClose, selected, onSelect, title) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#000000" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.provinceList} showsVerticalScrollIndicator={false}>
            {ARGENTINA_PROVINCES.map((province) => (
              <TouchableOpacity
                key={province}
                onPress={() => {
                  onSelect(province);
                  onClose();
                }}
                style={[styles.provinceOption, selected === province && styles.provinceOptionSelected]}
              >
                <Text style={[styles.provinceOptionText, selected === province && styles.provinceOptionTextSelected]}>
                  {province}
                </Text>
                {selected === province && (
                  <Ionicons name="checkmark" size={20} color="#000000" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#000000"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          {isAuthenticated && (
            <TouchableOpacity
              onPress={() => setShowNotificationsModal(true)}
              style={styles.notificationButton}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={22} color="#000000" />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <Image source={LOGO_SOURCE} style={styles.logo} />
          <Text style={styles.title}>Carpuling</Text>
          <Text style={styles.subtitle}>Viaja inteligente, ahorra más</Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TouchableOpacity
            style={styles.inputContainer}
            onPress={() => setShowOriginPicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.inputDot} />
            <Text style={[styles.inputText, origin && styles.inputTextFilled]}>
              {origin || '¿Desde dónde viajas?'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.inputContainer}
            onPress={() => setShowDestinationPicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.inputDotFilled} />
            <Text style={[styles.inputText, destination && styles.inputTextFilled]}>
              {destination || '¿Cuál es tu destino?'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.inputContainer}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={18} color="#6B7280" />
            <Text style={[styles.inputText, selectedDate && styles.inputTextFilled]}>
              {selectedDate ? formatDate(selectedDate) : '¿Cuándo sales?'}
            </Text>
          </TouchableOpacity>

          <View style={styles.inputContainer}>
            <Ionicons name="people-outline" size={18} color="#6B7280" />
            <TextInput
              style={styles.textInput}
              placeholder="¿Cuántos viajan?"
              placeholderTextColor="#9CA3AF"
              value={selectedSeats}
              onChangeText={setSelectedSeats}
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity style={styles.searchButton} onPress={handleSearch} activeOpacity={0.8}>
            <Ionicons name="search" size={20} color="#FFFFFF" />
            <Text style={styles.searchButtonText}>Buscar viajes</Text>
          </TouchableOpacity>

          {(origin || destination || selectedDate || selectedSeats) && (
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={16} color="#6B7280" />
              <Text style={styles.clearButtonText}>Limpiar filtros</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Banner Enterprise */}
        {bannersEnterprise.length > 0 && (
          <View style={styles.bannerSection}>
            <ContinuousCarousel banners={bannersEnterprise} onBannerPress={handleBannerPress} />
          </View>
        )}

        {/* Recent Trips */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Próximos viajes</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#000000" />
            </View>
          ) : recentTrips.length > 0 ? (
            recentTrips.map(renderTripCard)
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="car-outline" size={40} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyText}>No hay viajes disponibles</Text>
              <Text style={styles.emptySubtext}>Sé el primero en crear uno</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('AllTrips')}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>Ver todos los viajes</Text>
            <Ionicons name="arrow-forward" size={18} color="#000000" />
          </TouchableOpacity>
        </View>

        {/* Banner VIP */}
        {bannersVip.length > 0 && (
          <View style={styles.bannerSection}>
            <ContinuousCarousel banners={bannersVip} onBannerPress={handleBannerPress} />
          </View>
        )}

        {/* Banner Premium */}
        {bannersPremium.length > 0 && (
          <View style={styles.bannerSection}>
            <ContinuousCarousel banners={bannersPremium} onBannerPress={handleBannerPress} />
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
                <View style={styles.pickerContainer}>
                  <View style={styles.pickerHeader}>
                    <Text style={styles.pickerTitle}>Seleccionar fecha</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Ionicons name="close" size={24} color="#000000" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.datePickerWrapper}>
                    <DateTimePicker
                      value={selectedDate || new Date()}
                      mode="date"
                      display="spinner"
                      onChange={handleDateChange}
                      minimumDate={new Date()}
                      textColor="#000000"
                    />
                  </View>
                  <View style={styles.pickerButtons}>
                    <TouchableOpacity
                      style={styles.pickerButtonClear}
                      onPress={() => {
                        setSelectedDate(null);
                        setShowDatePicker(false);
                      }}
                    >
                      <Text style={styles.pickerButtonClearText}>Limpiar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pickerButtonConfirm}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={styles.pickerButtonConfirmText}>Confirmar</Text>
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
    backgroundColor: '#F9FAFB',
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
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
  },
  // Search
  searchContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  inputDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#000000',
  },
  inputDotFilled: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000000',
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    color: '#9CA3AF',
  },
  inputTextFilled: {
    color: '#000000',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 4,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
    color: '#6B7280',
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
    color: '#000000',
  },
  // Trip Card
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    backgroundColor: '#1F2937',
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
    color: '#000000',
  },
  tripDate: {
    fontSize: 13,
    color: '#6B7280',
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
    borderColor: '#000000',
  },
  routeLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  routeDotDestination: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000000',
  },
  routeTexts: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  routeCity: {
    fontSize: 14,
    color: '#374151',
  },
  routeCityIntermediate: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'left',
  },
  tripFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  seatsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seatsText: {
    fontSize: 13,
    color: '#6B7280',
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
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
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
    color: '#000000',
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
    backgroundColor: '#000000',
  },
  pickerButtonConfirmText: {
    fontSize: 15,
    color: '#FFFFFF',
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
