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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import { get_public } from '../../../services/apiService';
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
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const bannerScrollRef = useRef(null);
  const bannerAutoScrollTimer = useRef(null);

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
    }, [])
  );

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

  const loadBanners = async () => {
    try {
      const response = await get_public(ENDPOINTS.GET_BANNERS_BY_PACKAGE('free'), { isActive: true });
      if (response.success && Array.isArray(response.data)) {
        setBanners(response.data.filter((b) => b.isActive));
      }
    } catch (error) {
      console.error('Error loading banners:', error);
    }
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

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

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
});

export default CarpoolingsScreen;
