import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  Image,
  FlatList,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors as staticColors, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';
import { get_public } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 48;
const BANNER_HEIGHT = 200;

const CarpoolingsScreen = ({ navigation }) => {
  const { colors, createColorArray } = useColors();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  // Banner states
  const [banners, setBanners] = useState([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const bannerScrollRef = useRef(null);
  const bannerAutoScrollTimer = useRef(null);

  useEffect(() => {
    loadBanners();
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      if (bannerAutoScrollTimer.current) {
        clearInterval(bannerAutoScrollTimer.current);
      }
    };
  }, []);

  // Auto-scroll banners
  useEffect(() => {
    if (banners.length > 1) {
      bannerAutoScrollTimer.current = setInterval(() => {
        setActiveBannerIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % banners.length;
          bannerScrollRef.current?.scrollToIndex({
            index: nextIndex,
            animated: true,
          });
          return nextIndex;
        });
      }, 5000);
    }

    return () => {
      if (bannerAutoScrollTimer.current) {
        clearInterval(bannerAutoScrollTimer.current);
      }
    };
  }, [banners]);

  const loadBanners = async () => {
    try {
      const response = await get_public(ENDPOINTS.GET_BANNERS_BY_PACKAGE('free'), { isActive: true });
      if (response.success && Array.isArray(response.data)) {
        setBanners(response.data.filter(b => b.isActive));
      } else {
        setBanners([]);
      }
    } catch (error) {
      console.error('Error loading banners:', error);
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

  const onBannerScroll = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.floor(event.nativeEvent.contentOffset.x / slideSize);
    if (index !== activeBannerIndex && index >= 0 && index < banners.length) {
      setActiveBannerIndex(index);
    }
  };

  const renderBannerItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => handleBannerPress(item)}
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
            <Text style={styles.bannerOverlayTitle} numberOfLines={1}>
              {item.title}
            </Text>
          </LinearGradient>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  const menuItems = [
    {
      id: 1,
      title: 'Crear Viaje',
      description: 'Publica un nuevo viaje como conductor',
      icon: 'add-circle',
      gradient: ['#1F2937', '#111827'],
      // onPress: () => navigation.navigate('CreateTrip'),
      onPress: () => navigation.navigate('CreateTrip'),
    },
    {
      id: 2,
      title: 'Mis Viajes Creados',
      description: 'Ver viajes que has creado como conductor',
      icon: 'car',
      gradient: ['#1F2937', '#111827'],
      onPress: () => navigation.navigate('MyTrips'),
    },
    {
      id: 3,
      title: 'Mis Reservas',
      description: 'Ver viajes que has reservado como pasajero',
      icon: 'list',
      gradient: ['#1F2937', '#111827'],
      onPress: () => navigation.navigate('MyBookings'),
    },
    {
      id: 4,
      title: 'Reservas Recibidas',
      description: 'Ver solicitudes de pasajeros para tus viajes',
      icon: 'people',
      gradient: ['#1F2937', '#111827'],
      onPress: () => navigation.navigate('TripRequests'),
    },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={createColorArray(colors.background, colors.surface)}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {/* Header */}
            <View style={styles.header}>
              <LinearGradient
                colors={['#1F2937', '#111827']}
                style={styles.headerIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="car-sport" size={28} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.title}>Gestionar Viajes</Text>
              <Text style={styles.subtitle}>
                Crea viajes o revisa tus reservas
              </Text>
            </View>

            {/* Menu Items */}
            <View style={styles.content}>
              {menuItems.map((item, index) => (
                <Animated.View
                  key={item.id}
                  style={{
                    opacity: fadeAnim,
                    transform: [
                      {
                        translateY: slideAnim.interpolate({
                          inputRange: [0, 30],
                          outputRange: [0, 30 + index * 10],
                        }),
                      },
                    ],
                  }}
                >
                  <TouchableOpacity
                    style={styles.menuItemWrapper}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={createColorArray(colors.surfaceElevated, colors.surface)}
                      style={styles.menuItem}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                        <LinearGradient
                          colors={Array.isArray(item.gradient) && item.gradient.length > 0 ? item.gradient : ['#1F2937', '#111827']}
                          style={styles.iconContainer}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Ionicons name={item.icon} size={32} color="#FFFFFF" />
                        </LinearGradient>
                      <View style={styles.menuInfo}>
                        <Text style={styles.menuTitle}>{item.title}</Text>
                        <Text style={styles.menuDescription}>{item.description}</Text>
                      </View>
                      <View style={styles.chevronContainer}>
                        <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>

            {/* Banner Carousel Section */}
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
                  getItemLayout={(data, index) => ({
                    length: BANNER_WIDTH + 16,
                    offset: (BANNER_WIDTH + 16) * index,
                    index,
                  })}
                />
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    padding: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: '#000000',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  menuItemWrapper: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  menuInfo: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  menuTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
    marginBottom: spacing.xs,
  },
  menuDescription: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    lineHeight: 20,
  },
  chevronContainer: {
    padding: spacing.xs,
  },
  infoSection: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  infoCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  infoIconContainer: {
    marginBottom: spacing.md,
  },
  infoIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  infoTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: '#000000',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  infoText: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
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
    borderBottomLeftRadius: borderRadius.xl || 16,
    borderBottomRightRadius: borderRadius.xl || 16,
  },
  bannerOverlayTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
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
    backgroundColor: 'rgba(31, 41, 55, 0.3)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#1F2937',
    width: 24,
  },
});

export default CarpoolingsScreen;
