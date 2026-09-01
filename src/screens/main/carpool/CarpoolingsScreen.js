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
const BANNER_WIDTH = Math.round((SCREEN_WIDTH - 24 * 2 - BANNER_GAP * 1.5) / 1.45);
const BANNER_IMAGE_HEIGHT = Math.round(BANNER_WIDTH / 2);

// Antes esta pantalla mezclaba conductor y pasajero en 4 filas largas, y las 4 acciones de
// solicitudes vivían aparte, en el switch "Solicitudes" del Home. Reagrupado por ROL —la
// pregunta que el usuario ya se hizo antes de abrir la app— y en tiles (2 grandes + el resto
// chico) en vez de filas de texto, para que no se sienta a menú de configuración.
// Los `tab` marcan los que hay que cruzar a HomeStackNavigator; el resto vive en este mismo
// stack (CarpoolingsStackNavigator).
const conductorBig = [
  { id: 'c1', title: 'Crear Viaje', image: require('../../../../assets/tabsIcons/crear-viaje.png'), screen: 'CreateTrip' },
  { id: 'c2', title: 'Mis Viajes', image: require('../../../../assets/tabsIcons/mis-viajes.png'), screen: 'MyTrips' },
];
const conductorSmall = [
  { id: 'c3', title: 'Reservas Recibidas', image: require('../../../../assets/tabsIcons/reservas-recibidas.png'), screen: 'TripRequests' },
  { id: 'c4', title: 'Ver solicitudes abiertas', image: require('../../../../assets/tabsIcons/reservas-recibidas-solicitudes.png'), screen: 'OpenTripRequests', tab: 'HomeTab' },
  { id: 'c5', title: 'Mis postulaciones', image: require('../../../../assets/tabsIcons/mis-viajes-solicitudes.png'), screen: 'MyApplications', tab: 'HomeTab' },
];
const pasajeroBig = [
  { id: 'p1', title: 'Mis Reservas', image: require('../../../../assets/tabsIcons/mis-reservas.png'), screen: 'MyBookings' },
  { id: 'p2', title: 'Crear Solicitud', image: require('../../../../assets/tabsIcons/publica-solicitud.png'), screen: 'CreateTripRequest', tab: 'HomeTab' },
];
const pasajeroSmall = [
  { id: 'p3', title: 'Mis Solicitudes', image: require('../../../../assets/tabsIcons/mis-reservas-solicitudes.png'), screen: 'MyTripRequests', tab: 'HomeTab' },
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
            <Text style={styles.titleStrong}>Traslados</Text>
          </Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Como conductor o como pasajero.</Text>
        </View>

        <Text style={[styles.sectionLabel, { color: textSecondary }]}>Como conductor</Text>
        <View style={styles.bigRow}>
          {conductorBig.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.tileBig, { backgroundColor: cardBg, borderColor: border }]}
              onPress={() => item.tab ? navigation.navigate(item.tab, { screen: item.screen }) : navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <Image source={item.image} style={styles.tileBigIcon} resizeMode="contain" />
              <Text style={[styles.tileBigTitle, { color: textPrimary }]} numberOfLines={2}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.smallRow}>
          {conductorSmall.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.tileSmall, { backgroundColor: cardBg, borderColor: border }]}
              onPress={() => item.tab ? navigation.navigate(item.tab, { screen: item.screen }) : navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <Image source={item.image} style={styles.tileSmallIcon} resizeMode="contain" />
              <Text style={[styles.tileSmallTitle, { color: textPrimary }]} numberOfLines={2}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: textSecondary }]}>Como pasajero</Text>
        <View style={styles.bigRow}>
          {pasajeroBig.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.tileBig, { backgroundColor: cardBg, borderColor: border }]}
              onPress={() => item.tab ? navigation.navigate(item.tab, { screen: item.screen }) : navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <Image source={item.image} style={styles.tileBigIcon} resizeMode="contain" />
              <Text style={[styles.tileBigTitle, { color: textPrimary }]} numberOfLines={2}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.smallRow}>
          {pasajeroSmall.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.tileSmall, { backgroundColor: cardBg, borderColor: border }]}
              onPress={() => item.tab ? navigation.navigate(item.tab, { screen: item.screen }) : navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <Image source={item.image} style={styles.tileSmallIcon} resizeMode="contain" />
              <Text style={[styles.tileSmallTitle, { color: textPrimary }]} numberOfLines={2}>{item.title}</Text>
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

  sectionLabel: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  bigRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginBottom: 10 },
  tileBig: {
    flex: 1,
    minHeight: 104,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  tileBigIcon: { width: 34, height: 34 },
  tileBigTitle: { fontFamily: 'Sora_700Bold', fontSize: 14, lineHeight: 18, marginTop: 18 },

  smallRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginBottom: 28 },
  tileSmall: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  tileSmallIcon: { width: 26, height: 26 },
  tileSmallTitle: { fontFamily: 'Sora_600SemiBold', fontSize: 11.5, lineHeight: 15 },

  bannerSection: { marginTop: 8 },
});

export default CarpoolingsScreen;
