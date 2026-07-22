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
import { useUI } from '../../../theme/ui';

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

  const ui = useUI();
  const bg = ui.bg;
  const cardBg = ui.surface;
  const border = ui.border;
  const textPrimary = ui.text;
  const textSecondary = ui.textMuted;

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
        // status=started en el server: recorrer la primera página no alcanzaba,
        // el viaje en curso puede quedar detrás de muchos viajes futuros.
        get_withauth(ENDPOINTS.MY_TRIPS_DRIVER, { status: 'started', limit: 1 }),
        get_withauth(ENDPOINTS.MY_TRIPS_PASSENGER, { status: 'started', limit: 1 }),
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
          <Text style={[styles.title, { color: textPrimary }]}>
            Gestioná{'\n'}
            <Text style={styles.titleStrong}>tus viajes</Text>
          </Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Creá viajes o revisá tus reservas.</Text>
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
              <View style={[styles.iconBox, { backgroundColor: ui.bg }]}>
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
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  logo: { width: 30, height: 30, marginBottom: 18 },
  title: { fontFamily: 'Sora_300Light', fontSize: 34, lineHeight: 42, letterSpacing: -1 },
  titleStrong: { fontFamily: 'Sora_800ExtraBold' },
  subtitle: { fontFamily: 'Sora_400Regular', fontSize: 15, marginTop: 12 },

  menuList: { paddingHorizontal: 24, gap: 12 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    padding: 18,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: { flex: 1, marginLeft: 14, marginRight: 8 },
  menuTitle: { fontFamily: 'Sora_600SemiBold', fontSize: 16, marginBottom: 3 },
  menuDesc: { fontFamily: 'Sora_400Regular', fontSize: 13, lineHeight: 18 },

  bannerSection: { marginTop: 32 },
  bannerListContent: { paddingHorizontal: 24 },
  bannerSlide: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    marginRight: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  bannerImage: { width: '100%', height: '100%' },
  bannerContent: { flex: 1 },

  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 999, marginHorizontal: 3 },
  dotActive: { width: 22 },
});

export default CarpoolingsScreen;
