import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  RefreshControl,
  Animated,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationContext';
import { get_public, get_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import BannerDetailModal from '../../../components/modals/BannerDetailModal';
import NotificationsScreen from '../profile/NotificationsScreen';
import useColors from '../../../hooks/useColors';
import { useUI } from '../../../theme/ui';
import { TAB_BAR_SPACE } from '../../../components/ui/FloatingTabBar';
import Skeleton from '../../../components/ui/Skeleton';
import BannerCarousel from '../../../components/banners/BannerCarousel';
import { useMinDuration } from '../../../hooks/useMinDuration';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// El tamaño real de la tarjeta vive en BannerCarousel (componente compartido con Home y
// el detalle de un viaje). Estas dos son sólo para el esqueleto de carga de acá abajo, que
// dibuja antes de que lleguen los banners y no puede importar constantes privadas del
// componente — se mantienen calculadas igual, a mano.
const BANNER_GAP = 12;
const BANNER_WIDTH = Math.round((SCREEN_WIDTH - 24 * 2 - BANNER_GAP * 1.5) / 2.15);
const BANNER_IMAGE_HEIGHT = Math.round(BANNER_WIDTH / 2);

const menuItems = [
  {
    id: 1,
    title: 'Crear Viaje',
    description: 'Publicá un nuevo viaje y ofrecé lugares libres',
    icon: 'add-circle-outline',
    image: require('../../../../assets/tabsIcons/crear-viaje.png'),
    screen: 'CreateTrip',
  },
  {
    id: 2,
    title: 'Mis Viajes',
    description: 'Mirá los viajes que publicaste como conductor',
    icon: 'car-outline',
    image: require('../../../../assets/tabsIcons/mis-viajes.png'),
    screen: 'MyTrips',
  },
  {
    id: 3,
    title: 'Mis Reservas',
    description: 'Mirá los viajes que reservaste como pasajero',
    icon: 'list-outline',
    image: require('../../../../assets/tabsIcons/mis-reservas.png'),
    screen: 'MyBookings',
  },
  {
    id: 4,
    title: 'Reservas Recibidas',
    // Texto corto: quedaba en 1 renglón mientras el resto de las cards ocupan 2. El salto
    // de línea fuerza el mismo alto visual sin depender del ancho de pantalla.
    description: 'Revisá quién quiere\nsumarse a tus viajes',
    icon: 'people-outline',
    image: require('../../../../assets/tabsIcons/reservas-recibidas.png'),
    screen: 'TripRequests',
  },
];

const CarpoolingsScreen = ({ navigation }) => {
  const { isDarkMode } = useTheme();
  const { colors } = useColors();
  const { isAuthenticated, user } = useAuth();
  const { unreadCount = 0 } = useNotifications();
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [banners, setBanners] = useState([]);
  const [bannerModal, setBannerModal] = useState({ visible: false, banner: null });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const showBannerSkeleton = useMinDuration(loading);

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

  // Sin auto-scroll a propósito: el carrusel de banners se queda quieto y sólo se mueve
  // cuando la persona lo desliza, mismo criterio que el de Home. Antes había un setInterval
  // que lo corría solo cada 5s.

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

    return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textSecondary} colors={[textPrimary]} />}
      >

        {/* Header estilo home: logo + saludo + campana */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Image
              source={isDarkMode ? require('../../../../assets/logo/192x192-white.png') : require('../../../../assets/logo/192x192-black.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.headerGreeting, { color: textSecondary }]} numberOfLines={1}>
              {user?.firstName ? `Hola, ${user.firstName}` : 'Carpuling'}
            </Text>
            {isAuthenticated && (
              <TouchableOpacity
                onPress={() => setShowNotificationsModal(true)}
                style={[styles.notifBtn, { backgroundColor: cardBg }]}
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
              <Image source={item.image} style={styles.iconBox} resizeMode="contain" />
              <View style={styles.menuText}>
                <Text style={[styles.menuTitle, { color: textPrimary }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.menuDesc, { color: textSecondary }]} numberOfLines={2}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Banners */}
        {showBannerSkeleton ? (
          <View style={styles.bannerSection}>
            <Skeleton width={BANNER_WIDTH} height={BANNER_IMAGE_HEIGHT} radius={14} style={{ marginLeft: 24 }} />
          </View>
        ) : banners.length > 0 && (
          <View style={styles.bannerSection}>
            <BannerCarousel
              banners={banners}
              onBannerPress={(banner) => setBannerModal({ visible: true, banner })}
              showDots
            />
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

      {/* Notifications Modal (mismo patrón que Home) */}
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
  container: { flex: 1 },
  // TAB_BAR_SPACE cubre justo el alto de la barra: el ultimo banner quedaba pegado.
  scrollContent: { paddingBottom: TAB_BAR_SPACE + 24 },

  header: {
    paddingTop: 14,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  logo: { width: 30, height: 30 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  headerGreeting: { flex: 1, fontFamily: 'Sora_500Medium', fontSize: 15 },
  notifBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  notifBadge: { position: 'absolute', top: -2, right: -2, borderRadius: 999, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 2 },
  notifBadgeText: { fontFamily: 'Sora_700Bold', fontSize: 9 },
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
  },
  menuText: { flex: 1, marginLeft: 14, marginRight: 8 },
  menuTitle: { fontFamily: 'Sora_600SemiBold', fontSize: 16, lineHeight: 20, marginBottom: 3 },
  // 2 renglones fijos: "Crear Viaje" entraba en uno y su card quedaba más baja
  // que las demás. El alto no depende del ancho de pantalla.
  menuDesc: { fontFamily: 'Sora_400Regular', fontSize: 13, lineHeight: 18, minHeight: 36 },

  bannerSection: { marginTop: 32 },
});

export default CarpoolingsScreen;
