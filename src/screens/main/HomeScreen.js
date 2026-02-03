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
  FlatList,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { get_public } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { ARGENTINA_PROVINCES } from '../../constants/provinces';
import { colors as themeColors, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';
import { typography } from '../../theme/typography';
import AnimatedCard from '../../components/AnimatedCard';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import NotificationsScreen from './NotificationsScreen';
const LOGO_SOURCE = require('../../../assets/logo/192x192.jpg');

// Safe colors for styles (fallbacks in case theme colors fail to load)
const styleColors = themeColors || {
  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#374151',
  textTertiary: '#6B7280',
  inputBackground: '#FFFFFF',
  inputBorder: '#D1D5DB',
  borderLight: '#F3F4F6',
  primary: '#1F2937',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 48; // 24px de margen a cada lado
const BANNER_HEIGHT = 200;
const BANNER_ITEM_WIDTH = BANNER_WIDTH + 16; // banner + margin
const BANNER_SCROLL_SPEED = 30; // pixels per second

const ContinuousCarousel = ({ banners, onBannerPress, createColorArray }) => {
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
            <LinearGradient
              colors={createColorArray('#1F2937', '#374151')}
              style={styles.bannerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
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
              {item.imageUrl && item.title && (
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={styles.bannerOverlay}
                >
                </LinearGradient>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
};

const HomeScreen = ({ navigation }) => {
  const { colors, gradients, createColorArray } = useColors();
  const { isAuthenticated } = useAuth();
  const { unreadCount = 0 } = useNotifications();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [recentTrips, setRecentTrips] = useState([]);
  const [bannersEnterprise, setBannersEnterprise] = useState([]);
  const [bannersVip, setBannersVip] = useState([]);
  // PREMIUM
  const [bannersPremium, setBannersPremium] = useState([]);
  const [bannersPremiumLoading, setBannersPremiumLoading] = useState(false);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  useEffect(() => {
    loadRecentTrips();
    loadBannersEnterprise();
    loadBannersVip();
    loadBannersPremium();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Cerrar el modal de notificaciones cuando se cambia de tab o se desenfoca la pantalla
  useFocusEffect(
    React.useCallback(() => {
      // Cuando la pantalla se enfoca, no hacer nada
      return () => {
        // Cuando la pantalla se desenfoca, cerrar el modal si está abierto
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
        // Ordenar por fecha y hora de salida (próximos viajes primero)
        const sortedTrips = response.data.sort((a, b) => {
          const dateA = new Date(`${a.departureDate}T${a.departureTime}`);
          const dateB = new Date(`${b.departureDate}T${b.departureTime}`);
          return dateA - dateB;
        });
        // Mostrar solo los primeros 5 próximos viajes
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
    setBannersLoading(true);
    try {
      // Cargar banners del paquete 'enterprise' para usuarios normales
      const response = await get_public(ENDPOINTS.GET_BANNERS_BY_PACKAGE('enterprise'), { isActive: true });
      if (response.success && Array.isArray(response.data)) {
        setBannersEnterprise(response.data.filter(b => b.isActive));
      } else {
        setBannersEnterprise([]);
      }
    } catch (error) {
      console.error('Error loading bannersEnterprise:', error);
    } finally {
      setBannersLoading(false);
    }
  };

  const loadBannersVip = async () => {
    setBannersLoading(true);
    try {
      // Cargar banners del paquete 'vip' para usuarios VIP
      const response = await get_public(ENDPOINTS.GET_BANNERS_BY_PACKAGE('vip'), { isActive: true });
      if (response.success && Array.isArray(response.data)) {
        setBannersVip(response.data.filter(b => b.isActive));
      } else {
        setBannersVip([]);
      }
    } catch (error) {
      console.error('Error loading bannersVip:', error);
    } finally {
      setBannersLoading(false);
    }
  };

  // PREMIUM: igual a VIP pero usando variables premium
  const loadBannersPremium = async () => {
    setBannersPremiumLoading(true);
    try {
      // Cargar banners del paquete 'premium' para usuarios premium
      const response = await get_public(ENDPOINTS.GET_BANNERS_BY_PACKAGE('premium'), { isActive: true });
      if (response.success && Array.isArray(response.data)) {
        setBannersPremium(response.data.filter(b => b.isActive));
      } else {
        setBannersPremium([]);
      }
    } catch (error) {
      console.error('Error loading bannersPremium:', error);
    } finally {
      setBannersPremiumLoading(false);
    }
  };

  const handleBannerPress = async (banner) => {
    try {
      // Registrar click
      await get_public(ENDPOINTS.REGISTER_BANNER_CLICK(banner._id));
    } catch (error) {
      console.error('Error registering banner click:', error);
    }

    // Abrir URL si existe
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

  const handleNotificationsPress = () => {
    // Abrir como modal para no cambiar el tab activo
    setShowNotificationsModal(true);
  };

  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
      }
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-ES');
  };

  const handleSearch = () => {
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

  const renderTripCard = (trip, index) => (
    <AnimatedCard
      key={trip._id}
      delay={index * 50}
      gradientColors={createColorArray(colors.surfaceElevated, colors.surface)}
      style={styles.tripCard}
    >
      <TouchableOpacity
        onPress={() => navigation.navigate('TripDetail', { tripId: trip._id })}
        activeOpacity={0.8}
        style={styles.tripCardContent}
      >
        <View style={styles.tripHeader}>
          <LinearGradient
            colors={createColorArray('#1F2937', '#111827')}
            style={styles.avatarPlaceholder}
          >
            <Text style={styles.avatarText}>
              {trip.driver?.firstName?.[0]}{trip.driver?.lastName?.[0]}
            </Text>
          </LinearGradient>
          <View style={styles.tripInfo}>
            <Text style={styles.driverName}>
              {trip.driver?.firstName} {trip.driver?.lastName}
            </Text>
            <Text style={styles.tripDate}>
              {new Date(trip.departureDate).toLocaleDateString('es-ES')} • {trip.departureTime}
            </Text>
          </View>
          {/* <LinearGradient
            colors={createColorArray('#1F2937', '#111827')}
            style={styles.priceContainer}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.price}>${trip.pricePerSeat}</Text>
          </LinearGradient> */}
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <Ionicons name="radio-button-on" size={16} color="#1F2937" />
            <Text style={styles.routeText} numberOfLines={1}>
              {trip.origin.city}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={14} color={colors.textTertiary} />
          <View style={styles.routePoint}>
            <Ionicons name="location" size={16} color="#1F2937" />
            <Text style={styles.routeText} numberOfLines={1}>
              {trip.destination.city}
            </Text>
          </View>
        </View>

        <View style={styles.tripFooter}>
          <View style={styles.seatsContainer}>
            <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.seats}>
              {trip.availableSeats} disponible{trip.availableSeats > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </AnimatedCard>
  );


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={createColorArray(colors.background, colors.surface)}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={createColorArray(colors.primary)}
            />
          }
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {/* Header */}
            <View style={styles.header}>
              {/* Notification Icon Header */}
              {isAuthenticated && (
                <View style={styles.notificationHeader}>
                  <TouchableOpacity
                    onPress={handleNotificationsPress}
                    style={styles.notificationIconButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="notifications-outline" size={24} color="#1F2937" />
                    {unreadCount > 0 && (
                      <View style={styles.notificationBadge}>
                        <Text style={styles.notificationBadgeText}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              
              <LinearGradient
                colors={createColorArray('#1F2937', '#111827')}
                style={styles.logoIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Image
                  source={LOGO_SOURCE}
                  style={styles.logo}
                />
              </LinearGradient>
              <Text style={styles.title}>Carpooling</Text>
              <Text style={styles.subtitle}>Viaja inteligente, ahorra más</Text>
            </View>

            {/* Search Container */}
            <View style={styles.searchContainer}>
              {/* Origen */}
              <TouchableOpacity onPress={() => setShowOriginPicker(true)} activeOpacity={0.7}>
                <View style={styles.inputContainer}>
                  <Ionicons name="radio-button-on" size={20} color="#1F2937" />
                  <Text style={[styles.input, { color: origin ? '#000000' : colors.placeholder }]}>
                    {origin || '¿Desde dónde viajas?'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Modal Origen */}
              {showOriginPicker && (
                <Modal transparent={true} animationType="fade" onRequestClose={() => setShowOriginPicker(false)}>
                  <View style={styles.modalOverlay}>
                    <View style={styles.pickerContainer}>
                      <View style={styles.pickerHeader}>
                        <Text style={styles.pickerTitle}>Seleccionar Origen</Text>
                        <TouchableOpacity onPress={() => setShowOriginPicker(false)}>
                          <Ionicons name="close" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView style={styles.provinceList}>
                        {ARGENTINA_PROVINCES.map((province) => (
                          <TouchableOpacity
                            key={province}
                            onPress={() => {
                              setOrigin(province);
                              setShowOriginPicker(false);
                            }}
                            style={[styles.provinceOption, origin === province && styles.provinceOptionSelected]}
                          >
                            <Text style={[styles.provinceOptionText, origin === province && styles.provinceOptionTextSelected]}>
                              {province}
                            </Text>
                            {origin === province && (
                              <Ionicons name="checkmark" size={20} color="#1F2937" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </Modal>
              )}

              {/* Destino */}
              <TouchableOpacity onPress={() => setShowDestinationPicker(true)} activeOpacity={0.7}>
                <View style={styles.inputContainer}>
                  <Ionicons name="location" size={20} color="#1F2937" />
                  <Text style={[styles.input, { color: destination ? '#000000' : colors.placeholder }]}>
                    {destination || '¿Cuál es tu destino?'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Modal Destino */}
              {showDestinationPicker && (
                <Modal transparent={true} animationType="fade" onRequestClose={() => setShowDestinationPicker(false)}>
                  <View style={styles.modalOverlay}>
                    <View style={styles.pickerContainer}>
                      <View style={styles.pickerHeader}>
                        <Text style={styles.pickerTitle}>Seleccionar Destino</Text>
                        <TouchableOpacity onPress={() => setShowDestinationPicker(false)}>
                          <Ionicons name="close" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView style={styles.provinceList}>
                        {ARGENTINA_PROVINCES.map((province) => (
                          <TouchableOpacity
                            key={province}
                            onPress={() => {
                              setDestination(province);
                              setShowDestinationPicker(false);
                            }}
                            style={[styles.provinceOption, destination === province && styles.provinceOptionSelected]}
                          >
                            <Text style={[styles.provinceOptionText, destination === province && styles.provinceOptionTextSelected]}>
                              {province}
                            </Text>
                            {destination === province && (
                              <Ionicons name="checkmark" size={20} color="#1F2937" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </Modal>
              )}

              {/* Fecha */}
              <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
                <View style={styles.inputContainer}>
                  <Ionicons name="calendar-outline" size={20} color="#1F2937" />
                  <Text style={[styles.input, { color: selectedDate ? '#000000' : colors.placeholder }]}>
                    {selectedDate ? formatDate(selectedDate) : '¿Cuándo sales?'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Asientos */}
              <View style={styles.inputContainer}>
                <Ionicons name="people-outline" size={20} color="#1F2937" />
                <TextInput
                  style={styles.input}
                  placeholder="¿Cuántos viajan?"
                  placeholderTextColor={colors.placeholder}
                  value={selectedSeats}
                  onChangeText={setSelectedSeats}
                  keyboardType="numeric"
                />
              </View>

              {/* DateTimePicker Modal */}
              {showDatePicker && (
                <Modal transparent={true} animationType="fade">
                  <View style={styles.modalOverlay}>
                    <View style={styles.pickerContainer}>
                      <View style={styles.pickerHeader}>
                        <Text style={styles.pickerTitle}>Seleccionar Fecha</Text>
                        <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                          <Ionicons name="close" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.datePickerWrapper}>
                        <DateTimePicker
                          value={selectedDate || new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={handleDateChange}
                          minimumDate={new Date()}
                          textColor="#000000"
                        />
                      </View>
                      {Platform.OS === 'ios' && (
                        <View style={styles.pickerButtons}>
                          <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={() => {
                              setSelectedDate(null);
                              setShowDatePicker(false);
                            }}
                          >
                            <Text style={styles.pickerButtonText}>Limpiar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.pickerButton, styles.pickerButtonConfirm]}
                            onPress={() => setShowDatePicker(false)}
                          >
                            <Text style={styles.pickerButtonConfirmText}>Confirmar</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </Modal>
              )}

              <TouchableOpacity onPress={handleSearch} activeOpacity={0.8}>
                <LinearGradient
                  colors={createColorArray('#1F2937', '#111827')}
                  style={styles.searchButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="search" size={20} color="#fff" />
                  <Text style={styles.searchButtonText}>Buscar Viajes</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Banner Carousel Enterprise */}
            {bannersEnterprise.length > 0 && (
              <View style={styles.bannerSection}>
                <ContinuousCarousel
                  banners={bannersEnterprise}
                  onBannerPress={handleBannerPress}
                  createColorArray={createColorArray}
                />
              </View>
            )}

            {/* Recent Trips Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Viajes Recientes</Text>
                <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : recentTrips.length > 0 ? (
                recentTrips.map((trip, index) => renderTripCard(trip, index))
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="car-outline" size={64} color={colors.textTertiary} />
                  <Text style={styles.emptyText}>No hay viajes disponibles</Text>
                  <Text style={styles.emptySubtext}>Sé el primero en crear uno</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={() => navigation.navigate('AllTrips')}
                activeOpacity={0.7}
                style={styles.viewAllButton}
              >
                <Text style={styles.viewAllText}>Ver todos los viajes disponibles</Text>
                {/* <Ionicons name="arrow-forward" size={16} color="#1F2937" /> */}
              </TouchableOpacity>
            </View>

            {/* Banner Carousel VIP */}
            {bannersVip.length > 0 && (
              <View style={styles.bannerSection}>
                <ContinuousCarousel
                  banners={bannersVip}
                  onBannerPress={handleBannerPress}
                  createColorArray={createColorArray}
                />
              </View>
            )}

            {/* Banner Carousel Premium */}
            {bannersPremium.length > 0 && (
              <View style={styles.bannerSection}>
                <ContinuousCarousel
                  banners={bannersPremium}
                  onBannerPress={handleBannerPress}
                  createColorArray={createColorArray}
                />
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </LinearGradient>

      {/* Modal de Notificaciones */}
      <Modal
        visible={showNotificationsModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowNotificationsModal(false)}
        statusBarTranslucent={false}
        transparent={false}
      >
        <NotificationsScreen 
          navigation={{
            ...navigation,
            goBack: () => setShowNotificationsModal(false),
            navigate: (screen, params) => {
              setShowNotificationsModal(false);
              // Pequeño delay para que el modal se cierre antes de navegar
              setTimeout(() => {
                navigation.navigate(screen, params);
              }, 300);
            }
          }}
        />
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  logo: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
    borderRadius: borderRadius.full,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl + spacing.md,
    alignItems: 'center',
    position: 'relative',
  },
  notificationHeader: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
    zIndex: 10,
  },
  notificationIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
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
    fontWeight: fontWeight.bold,
  },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    ...typography.h1,
    color: '#000000',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body2,
    color: '#6B7280',
  },
  searchContainer: {
    padding: spacing.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    padding: spacing.md + 2,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: fontSize.md,
    color: '#000000',
  },
  searchButton: {
    borderRadius: borderRadius.md,
    padding: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  searchButtonText: {
    ...typography.button,
    color: '#F3F4F6',
    marginLeft: spacing.sm,
  },
  section: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: '#000000',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  viewAllText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: '#1F2937',
    marginRight: spacing.xs,
  },
  tripCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  tripCardContent: {
    padding: spacing.md,
  },
  tripCardGradient: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#F3F4F6',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  tripInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  driverName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
  },
  tripDate: {
    fontSize: fontSize.xs,
    color: '#6B7280',
    marginTop: 2,
  },
  priceContainer: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
  },
  price: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#F3F4F6',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  routeText: {
    marginLeft: spacing.xs,
    fontSize: fontSize.sm,
    color: '#000000',
    flex: 1,
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seats: {
    fontSize: fontSize.xs,
    color: '#6B7280',
    marginLeft: spacing.xs,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: spacing.md,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#9CA3AF',
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
  },
  filtersRow: {
    marginBottom: spacing.md,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: spacing.md,
  },
  filterButtonText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: fontSize.sm,
    color: '#000000',
    fontWeight: fontWeight.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    maxHeight: '70%',
    width: '85%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
  },
  pickerButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  pickerButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  pickerButtonText: {
    fontSize: fontSize.md,
    color: '#6B7280',
    fontWeight: fontWeight.medium,
  },
  pickerButtonConfirm: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  pickerButtonConfirmText: {
    fontSize: fontSize.md,
    color: '#FFFFFF',
    fontWeight: fontWeight.medium,
  },
  seatsPickerContent: {
    paddingVertical: spacing.md,
  },
  seatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  seatOptionSelected: {
    backgroundColor: '#1F2937' + '15',
  },
  seatOptionText: {
    fontSize: fontSize.md,
    color: '#6B7280',
    marginLeft: spacing.md,
    fontWeight: fontWeight.medium,
  },
  seatOptionTextSelected: {
    color: '#1F2937',
    fontWeight: fontWeight.semiBold,
  },
  provinceList: {
    maxHeight: 400,
  },
  provinceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  provinceOptionSelected: {
    backgroundColor: '#1F2937' + '15',
  },
  provinceOptionText: {
    fontSize: fontSize.md,
    color: '#6B7280',
    flex: 1,
  },
  provinceOptionTextSelected: {
    color: '#1F2937',
    fontWeight: fontWeight.semiBold,
  },
  datePickerWrapper: {
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing.md,
  },
  // Banner Carousel Styles
  bannerSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerListContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  bannerSlide: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    marginRight: 16,
    borderRadius: borderRadius.xl || 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: '#1F2937',
  },
  bannerGradient: {
    flex: 1,
    borderRadius: borderRadius.xl || 16,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.xl || 16,
  },
  bannerContent: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  bannerDescription: {
    fontSize: fontSize.sm,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: spacing.md,
  },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full || 20,
  },
  bannerCtaText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: '#FFFFFF',
    marginRight: spacing.xs,
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingTop: spacing.xl,
  },
  bannerOverlayTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#1F2937',
    width: 24,
  },
});

export default HomeScreen;
