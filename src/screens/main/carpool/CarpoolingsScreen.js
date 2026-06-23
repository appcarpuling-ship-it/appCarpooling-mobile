import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  FlatList,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import { get_public, get_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { sanitizeImageUrl } from '../../../utils/imageUtils';
import BannerDetailModal from '../../../components/modals/BannerDetailModal';
import useColors from '../../../hooks/useColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 48;
const BANNER_HEIGHT = 180;
const BANNER_ITEM_WIDTH = BANNER_WIDTH + 16;

const menuItems = [
  {
    id: 1,
    title: 'Crear Viaje',
    description: 'Publica un nuevo viaje como conductor',
    icon: 'add-circle-outline',
    screen: 'CreateTrip',
  },
  {
    id: 2,
    title: 'Mis Viajes Creados',
    description: 'Ver viajes que has creado como conductor',
    icon: 'car-outline',
    screen: 'MyTrips',
  },
  {
    id: 3,
    title: 'Mis Reservas',
    description: 'Ver viajes que has reservado como pasajero',
    icon: 'list-outline',
    screen: 'MyBookings',
  },
  {
    id: 4,
    title: 'Reservas Recibidas',
    description: 'Ver solicitudes de pasajeros para tus viajes',
    icon: 'people-outline',
    screen: 'TripRequests',
  },
];

const CarpoolingsScreen = ({ navigation }) => {
  const { isDarkMode } = useTheme();
  const { colors } = useColors();
  const [banners, setBanners] = useState([]);
  const [bannerModal, setBannerModal] = useState({ visible: false, banner: null });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const bannerScrollRef = useRef(null);
  const bannerAutoScrollTimer = useRef(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const pulseDot = useRef(new Animated.Value(1)).current;

  const bg = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg = isDarkMode ? '#222222' : '#FFFFFF';
  const border = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textSecondary = isDarkMode ? '#9CA3AF' : '#6B7280';

  useEffect(() => {
    loadBanners();
    return () => clearInterval(bannerAutoScrollTimer.current);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBanners();
      loadActiveTrip();
    }, [])
  );

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

  useEffect(() => {
    if (banners.length > 1) {
      bannerAutoScrollTimer.current = setInterval(() => {
        setActiveBannerIndex((prev) => {
          const next = (prev + 1) % banners.length;
          bannerScrollRef.current?.scrollToIndex({ index: next, animated: true });
          return next;
        });
      }, 5000);
    }
    return () => clearInterval(bannerAutoScrollTimer.current);
  }, [banners]);

  const loadActiveTrip = async () => {
    try {
      const [driverRes, passengerRes] = await Promise.allSettled([
        get_withauth(ENDPOINTS.MY_TRIPS_DRIVER),
        get_withauth(ENDPOINTS.MY_TRIPS_PASSENGER),
      ]);
      let found = null;
      if (driverRes.status === 'fulfilled' && driverRes.value?.success) {
        found = (driverRes.value.data || []).find(t => t.status === 'started') || null;
      }
      if (!found && passengerRes.status === 'fulfilled' && passengerRes.value?.success) {
        found = (passengerRes.value.data || []).find(t => t.status === 'started') || null;
      }
      setActiveTrip(found);
    } catch {
      // banner es opcional
    }
  };

  const loadBanners = async () => {
    try {
      const response = await get_public(ENDPOINTS.GET_BANNER_SECTIONS, { appScreen: 'carpoolings' });
      if (response.success && Array.isArray(response.data)) {
        setBanners(response.data.flatMap(s => s.banners || []));
      }
    } catch (error) {
      console.error('Error loading banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBanners();
    setRefreshing(false);
  };

  const onBannerScroll = (event) => {
    const index = Math.floor(event.nativeEvent.contentOffset.x / (BANNER_WIDTH + 16));
    if (index !== activeBannerIndex && index >= 0 && index < banners.length) {
      setActiveBannerIndex(index);
    }
  };

  const renderBannerItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.bannerSlide, { backgroundColor: cardBg }]}
      activeOpacity={0.92}
      onPress={() => setBannerModal({ visible: true, banner: item })}
    >
      {item.imageUrl ? (
        <Image source={{ uri: sanitizeImageUrl(item.imageUrl) }} style={styles.bannerImage} resizeMode="cover" />
      ) : (
        <View style={styles.bannerContent} />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={textPrimary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textSecondary} colors={[textPrimary]} />}
      >

        {/* Header */}
        <View style={styles.header}>
          <Image
            source={isDarkMode ? require('../../../../assets/logo/192x192-white.png') : require('../../../../assets/logo/192x192-black.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: textPrimary }]}>Gestionar Viajes</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Crea viajes o revisa tus reservas</Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuList}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, { backgroundColor: cardBg, borderColor: border }]}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: isDarkMode ? '#333333' : '#F0F0F0' }]}>
                <Ionicons name={item.icon} size={24} color={textPrimary} />
              </View>
              <View style={styles.menuText}>
                <Text style={[styles.menuTitle, { color: textPrimary }]}>{item.title}</Text>
                <Text style={[styles.menuDesc, { color: textSecondary }]}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Banners */}
        {banners.length > 0 && (
          <View style={styles.bannerSection}>
            <FlatList
              ref={bannerScrollRef}
              data={banners}
              renderItem={renderBannerItem}
              keyExtractor={(item) => item._id}
              horizontal
              pagingEnabled={false}
              showsHorizontalScrollIndicator={false}
              onScroll={onBannerScroll}
              scrollEventThrottle={16}
              snapToInterval={BANNER_WIDTH + 16}
              decelerationRate="fast"
              contentContainerStyle={styles.bannerListContent}
              getItemLayout={(_, index) => ({
                length: BANNER_WIDTH + 16,
                offset: (BANNER_WIDTH + 16) * index,
                index,
              })}
            />
            {banners.length > 1 && (
              <View style={styles.dots}>
                {banners.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      { backgroundColor: i === activeBannerIndex ? textPrimary : border },
                      i === activeBannerIndex && styles.dotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

      </ScrollView>

      <BannerDetailModal
        visible={bannerModal.visible}
        banner={bannerModal.banner}
        onClose={() => setBannerModal({ visible: false, banner: null })}
        navigation={navigation}
        colors={colors}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logo: { width: 36, height: 36, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center' },

  menuList: { paddingHorizontal: 16 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: { flex: 1, marginLeft: 14, marginRight: 8 },
  menuTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  menuDesc: { fontSize: 13, lineHeight: 18 },

  bannerSection: { marginTop: 24 },
  bannerListContent: { paddingHorizontal: 24 },
  bannerSlide: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    marginRight: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bannerImage: { width: '100%', height: '100%' },
  bannerContent: { flex: 1 },

  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 3 },
  dotActive: { width: 18 },

  activeTripWrapper: { marginHorizontal: 24, marginTop: 16, marginBottom: 4 },
  activeTripRing: { ...StyleSheet.absoluteFillObject, borderRadius: 16, borderWidth: 0.8, borderColor: '#F59E0B' },
  activeTripBanner: {
    backgroundColor: '#111111',
    borderRadius: 16,
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
  activeTripLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E' },
  activeTripLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  activeTripDest: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

export default CarpoolingsScreen;
