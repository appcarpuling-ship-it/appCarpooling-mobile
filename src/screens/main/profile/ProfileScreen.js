import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'; // eslint-disable-line
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// El contador de no leídos que alimenta el acceso a Mensajes. Montarlo acá es seguro desde
// que socketService admite varios listeners por evento: antes, dos consumidores se pisaban.
import { useUnreadMessages } from '../../../hooks/useUnreadMessages';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import { buildImageUri } from '../../../services/apiService';
import useColors from '../../../hooks/useColors';
import { useUI } from '../../../theme/ui';
import { TAB_BAR_SPACE } from '../../../components/ui/FloatingTabBar';
import { useTutorial } from '../../../context/TutorialContext';
import Rating from '../../../components/ui/Rating';
import Skeleton from '../../../components/ui/Skeleton';
import { useMinDuration } from '../../../hooks/useMinDuration';

/** Evitar refetch infinito al cambiar de tab; disparaba loader de avatar en bucle */
const PROFILE_REFRESH_GAP_MS = 10000;

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const { user, logout, loading: authLoading, refreshUser } = useAuth();
  const showAuthSkeleton = useMinDuration(authLoading && !user);
  const lastProfileFetchAtRef = useRef(0);
  const { getCurrentThemeMode, setThemeMode } = useColors();
  const { resetTutorial } = useTutorial();

  const ui = useUI();
  const isDarkMode  = ui.isDarkMode;
  const bg          = ui.bg;
  const cardBg      = ui.surface;
  const border      = ui.border;
  const textPrimary = ui.text;
  const textMuted   = ui.textMuted;
  const sectionMenuTitleColor = ui.textMuted;

  const handleLogout = () => {
    navigation.navigate('Confirm', {
      title: 'Cerrar Sesión',
      message: '¿Estás seguro que deseas cerrar sesión?',
      confirmLabel: 'Cerrar Sesión',
      destructive: true,
      // skipResult: sin esto se alcanza a ver un "¡Listo!" un instante antes de que
      // isAuthenticated pase a false y desmonte todo el stack — cerrar sesión no necesita
      // pantalla de éxito, solo pasar.
      onConfirm: async () => { await logout(); return { skipResult: true }; },
      errorParams: { title: 'Ocurrió algo', message: 'No se pudo cerrar sesión. Intenta nuevamente.' },
    });
  };

  const handleThemeToggle = () => {
    const current = getCurrentThemeMode();
    setThemeMode(current === 'light' ? 'dark' : 'light');
  };

  const [refreshing, setRefreshing] = useState(false);
  const [avatarImageLoading, setAvatarImageLoading] = useState(false);
  const [avatarPreviewVisible, setAvatarPreviewVisible] = useState(false);
  const avatarLoaderTimeoutRef = useRef(null);

  const avatarUri = user?.avatar ? buildImageUri(user.avatar) : null;

  const avatarSource = useMemo(
    () => (avatarUri ? { uri: avatarUri } : null),
    [avatarUri]
  );

  /** Un solo ciclo por URI; sin `onLoadStart` (en RN suele repetir sin emparejar con `onLoad` y deja el spinner fijo). */
  useEffect(() => {
    avatarLoaderTimeoutRef.current && clearTimeout(avatarLoaderTimeoutRef.current);
    if (!avatarUri) {
      setAvatarImageLoading(false);
      return undefined;
    }
    setAvatarImageLoading(true);
    avatarLoaderTimeoutRef.current = setTimeout(() => setAvatarImageLoading(false), 12000);
    return () => {
      avatarLoaderTimeoutRef.current && clearTimeout(avatarLoaderTimeoutRef.current);
    };
  }, [avatarUri]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastProfileFetchAtRef.current < PROFILE_REFRESH_GAP_MS) {
        return;
      }
      lastProfileFetchAtRef.current = now;
      refreshUser();
    }, [refreshUser])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  };

  const clearAvatarLoaderTimeout = () => {
    avatarLoaderTimeoutRef.current && clearTimeout(avatarLoaderTimeoutRef.current);
    avatarLoaderTimeoutRef.current = null;
  };

  // Los 4 accesos más usados van al grid de arriba, estilo Uber; el resto sigue
  // como lista.
  // Badge con lo que debe: sin esto, el conductor solo se enteraba de la deuda por la
  // notificación al completar el viaje (que puede perderse o descartarse) o entrando a
  // "Mi saldo" por las suyas. Acá queda a la vista cada vez que abre el Perfil.
  const { unreadCount } = useUnreadMessages();
  const deuda = user?.deudaEfectivo || 0;
  const quickAccessItems = [
    { id: 1, title: 'Editar perfil', icon: 'person-outline', onPress: () => navigation.navigate('EditProfile') },
    {
      id: 3, title: 'Mi saldo', icon: 'receipt-outline', onPress: () => navigation.navigate('Saldo'),
      badge: deuda > 0 ? `$${deuda.toLocaleString('es-AR')}` : null,
    },
    { id: 2, title: 'Vehículos',     icon: 'car-outline',    onPress: () => navigation.navigate('Vehicles') },
    { id: 5, title: 'Ayuda',         icon: 'help-circle-outline', onPress: () => navigation.navigate('Help') },
  ];

  const menuSections = [
    {
      title: 'Privacidad',
      items: [
        { id: 10, title: 'Usuarios bloqueados', subtitle: 'Administrá quién tenés bloqueado', icon: 'ban-outline', onPress: () => navigation.navigate('BlockedUsers') },
      ],
    },
    {
      title: 'Información',
      items: [
        { id: 4,  title: 'Términos y Condiciones',  subtitle: 'Leé nuestras políticas de uso',      icon: 'document-text-outline', onPress: () => navigation.navigate('Terms') },
        { id: 11, title: 'Política de Privacidad', subtitle: 'Cómo usamos tus datos personales',  icon: 'shield-outline',        onPress: () => navigation.navigate('Privacy') },
        { id: 12, title: 'Cookies',                subtitle: 'Información sobre almacenamiento', icon: 'information-circle-outline', onPress: () => navigation.navigate('Cookies') },
        { id: 9, title: 'Mostrar introducción',   subtitle: 'Volvé a ver el tutorial de la app', icon: 'book-outline',          onPress: () => resetTutorial() },
        {
          id: 6,
          title:    isDarkMode ? 'Cambiar a Claro' : 'Cambiar a Oscuro',
          subtitle: isDarkMode ? 'Activar modo día' : 'Activar modo noche',
          icon:     isDarkMode ? 'sunny-outline'   : 'moon-outline',
          onPress: handleThemeToggle,
        },
      ],
    },
    {
      title: 'Referidos',
      items: [
        {
          id: 8,
          title: 'Mi Código Promocional',
          subtitle: (user?.discountPercentage ?? 0) > 0
            ? `${user.discountPercentage}% de descuento disponible`
            : 'Invitá amigos y ganá descuentos',
          icon: 'gift-outline',
          onPress: () => navigation.navigate('ReferralScreen'),
        },
        {
          id: 13,
          title: 'Mis Cupones',
          subtitle: 'Canjeá un código y consultá tu estado',
          icon: 'pricetag-outline',
          onPress: () => navigation.navigate('Coupons'),
        },
      ],
    },
    {
      title: 'Sesión',
      items: [
        // Tiene que poder hacerse desde adentro de la app: es requisito de App Store y, sobre
        // todo, es el derecho de cualquiera a llevarse sus datos.
        { id: 13, title: 'Eliminar cuenta', subtitle: 'Borrá tu cuenta y todos tus datos', icon: 'trash-outline', onPress: () => navigation.navigate('DeleteAccount'), danger: true },
        { id: 7, title: 'Cerrar Sesión', subtitle: 'Salí de tu cuenta', icon: 'log-out-outline', onPress: handleLogout, danger: true },
      ],
    },
  ];

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
      <Modal
        visible={avatarPreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPreviewVisible(false)}
      >
        <Pressable
          style={[styles.avatarModalBackdrop, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.88)' }]}
          onPress={() => setAvatarPreviewVisible(false)}
        >
          {avatarSource ? (
            <Image source={avatarSource} style={styles.avatarModalImage} resizeMode="contain" />
          ) : null}
          {/* <Text style={styles.avatarModalHint}>Tocá fuera para cerrar</Text> */}
        </Pressable>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textMuted} colors={[textPrimary]} />}
      >

        {/* Header: nombre a la izquierda, avatar chico a la derecha (antes era al
            revés — avatar grande y centrado, como una portada más que un perfil). */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            {showAuthSkeleton ? (
              <>
                <Skeleton width={160} height={24} style={{ marginBottom: 8 }} />
                <Skeleton width={90} height={14} />
              </>
            ) : (
              <>
                <Text style={[styles.name, { color: textPrimary }]} numberOfLines={2}>
                  {user?.firstName} {user?.lastName}
                </Text>
                <View style={styles.ratingRow}>
                  <Rating rating={user?.rating} count={user?.ratingCount} size={14} />
                </View>
              </>
            )}
            {(user?.discountPercentage ?? 0) > 0 && (() => {
              const pct = user.discountPercentage;
              const count = Math.round(pct / 20) || 1;
              return (
                <View style={[styles.discountBadge, { backgroundColor: ui.invertBg }]}>
                  <Ionicons name="pricetag" size={13} color={ui.invertText} />
                  <Text style={[styles.discountText, { color: ui.invertText }]}>
                    {count} descuento{count !== 1 ? 's' : ''} activo{count !== 1 ? 's' : ''} · {pct}% de ahorro
                  </Text>
                </View>
              );
            })()}
          </View>

          {showAuthSkeleton ? (
            <Skeleton width={60} height={60} radius={30} />
          ) : avatarSource ? (
            <TouchableOpacity
              onPress={() => setAvatarPreviewVisible(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Ver foto de perfil en grande"
            >
              <View style={styles.avatarImageWrap}>
                <Image
                  key={avatarUri}
                  source={avatarSource}
                  style={styles.avatarImage}
                  onLoadEnd={() => {
                    clearAvatarLoaderTimeout();
                    setAvatarImageLoading(false);
                  }}
                  onError={() => {
                    clearAvatarLoaderTimeout();
                    setAvatarImageLoading(false);
                  }}
                />
                {avatarImageLoading ? (
                  <View style={[styles.avatarImageLoader, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.65)' }]}>
                    <ActivityIndicator size="small" color={ui.invertBg} />
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[styles.avatarInitials, { color: textPrimary }]}>{initials}</Text>
            </View>
          )}
        </View>

        {/* Accesos rápidos: los 4 destinos que más se usan, en grid, sin subtítulo
            ni flecha — el resto de las opciones ya se explican solas en la lista. */}
        <View style={styles.quickGrid}>
          {quickAccessItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.quickItem, { backgroundColor: cardBg }]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={19} color={textPrimary} />
              <Text style={[styles.quickItemText, { color: textPrimary }]} numberOfLines={1}>
                {item.title}
              </Text>
              {!!item.badge && (
                <View style={[styles.quickItemBadge, { backgroundColor: ui.invertBg }]}>
                  <Text style={[styles.quickItemBadgeText, { color: ui.invertText }]} numberOfLines={1}>
                    {item.badge}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Mensajes va aparte del grid y a lo ancho, no como quinto elemento: con cinco, la
            cuadrícula de 2x2 queda con un hueco. Y es de otra naturaleza — los otros cuatro son
            ajustes de la cuenta, esto es contenido que te está esperando, así que lleva el
            contador y una flecha.
            La bandeja se sacó de la barra de tabs y quedó sin ninguna entrada: el contador de no
            leídos seguía funcionando pero no había forma de llegar a los mensajes. */}
        <TouchableOpacity
          style={[styles.mensajes, { backgroundColor: cardBg }]}
          onPress={() => navigation.navigate('Chats')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            unreadCount > 0 ? `Mensajes, ${unreadCount} sin leer` : 'Mensajes'
          }
        >
          <Ionicons name="chatbubble-ellipses-outline" size={21} color={textPrimary} />
          <View style={styles.mensajesTexto}>
            <Text style={[styles.mensajesTitulo, { color: textPrimary }]}>Mensajes</Text>
            <Text style={[styles.mensajesSub, { color: textMuted }]} numberOfLines={1}>
              {unreadCount > 0
                ? `Tenés ${unreadCount} sin leer`
                : 'Coordiná los detalles de tus viajes'}
            </Text>
          </View>
          {unreadCount > 0 && (
            <View style={[styles.mensajesBadge, { backgroundColor: ui.invertBg }]}>
              <Text style={[styles.mensajesBadgeText, { color: ui.invertText }]}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={textMuted} />
        </TouchableOpacity>

        {/* Menu: lista plana, sin tarjeta con borde alrededor — solo separadores
            finitos entre filas, como el resto de las opciones de cuenta en Uber. */}
        <View style={styles.menuContent}>
          {menuSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: sectionMenuTitleColor }]}>{section.title}</Text>
              <View>
                {section.items.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.menuItem,
                      index < section.items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border },
                    ]}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                  >
                    {/* El destructivo se marca invirtiendo el fondo, no con rojo. */}
                    <View style={[
                      styles.iconBox,
                      { backgroundColor: item.danger ? ui.invertBg : cardBg },
                    ]}>
                      <Ionicons
                        name={item.icon}
                        size={19}
                        color={item.danger ? ui.invertText : textPrimary}
                      />
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                      <Text style={[styles.menuItemText, { color: textPrimary }]}>
                        {item.title}
                      </Text>
                      {item.subtitle ? (
                        <Text numberOfLines={1} style={[styles.menuItemSub, { color: textMuted }]}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:     { flex: 1 },
  scrollContent: { paddingBottom: TAB_BAR_SPACE },

  // Header: nombre a la izquierda, avatar chico a la derecha.
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    gap: 16,
  },
  headerText: { flex: 1 },
  avatarImageWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarImageLoader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },
  avatarModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  avatarModalImage: {
    width: '100%',
    height: '80%',
    maxHeight: 520,
  },
  avatarModalHint: {
    marginTop: 20,
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 22,
    letterSpacing: 1,
  },
  name: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 24,
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  discountText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 13,
  },

  // Accesos rápidos (grid 2x2, estilo Uber)
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  // Ancho completo y algo más alto que las tarjetas del grid: es una fila propia, no un quinto
  // elemento de la cuadrícula. Mismo padding horizontal que quickGrid para que los bordes
  // queden alineados con las tarjetas de arriba.
  mensajes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginHorizontal: 24,
    marginTop: -18,
    marginBottom: 28,
  },
  mensajesTexto:  { flex: 1, gap: 2 },
  mensajesTitulo: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
  mensajesSub:    { fontSize: 12, fontFamily: 'Sora_400Regular' },
  mensajesBadge:  { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  mensajesBadgeText: { fontSize: 11, fontFamily: 'Sora_700Bold' },
  quickItem: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  quickItemText: {
    flexShrink: 1,
    fontFamily: 'Sora_600SemiBold',
    fontSize: 14,
  },
  quickItemBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 'auto',
  },
  quickItemBadgeText: {
    fontFamily: 'Sora_700Bold',
    fontSize: 11,
  },

  // Menu: lista plana, sin tarjeta contenedora.
  menuContent: { paddingHorizontal: 24 },
  section:     { marginBottom: 28 },
  sectionLabel: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
  },
  menuItemSub: {
    fontFamily: 'Sora_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
});

export default ProfileScreen;
