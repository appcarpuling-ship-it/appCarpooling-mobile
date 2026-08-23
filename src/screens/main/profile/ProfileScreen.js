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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import { buildImageUri } from '../../../services/apiService';
import useColors from '../../../hooks/useColors';
import { useUI } from '../../../theme/ui';
import { TAB_BAR_SPACE } from '../../../components/ui/FloatingTabBar';
import { useTutorial } from '../../../context/TutorialContext';
import Rating from '../../../components/ui/Rating';

/** Evitar refetch infinito al cambiar de tab; disparaba loader de avatar en bucle */
const PROFILE_REFRESH_GAP_MS = 10000;

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const { user, logout, loading: authLoading, refreshUser } = useAuth();
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
  const divider     = ui.bg; // separa las filas dentro de la card gris
  const sectionMenuTitleColor = ui.textMuted;

  const handleLogout = () => {
    showAlert('Cerrar Sesión', '¿Estás seguro que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch (error) {
            showAlert('Ocurrió algo', 'No se pudo cerrar sesión. Intenta nuevamente.');
          }
        },
      },
    ]);
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

  const menuSections = [
    {
      title: 'Perfil',
      items: [
        { id: 1, title: 'Editar Perfil',  subtitle: 'Cambiá tu foto, nombre y datos', icon: 'person-outline', onPress: () => navigation.navigate('EditProfile') },
        { id: 2, title: 'Mis Vehículos',  subtitle: 'Administrá tus vehículos',        icon: 'car-outline',    onPress: () => navigation.navigate('Vehicles') },
        { id: 3, title: 'Mi saldo',       subtitle: 'Lo que debés por los asientos ocupados', icon: 'receipt-outline', onPress: () => navigation.navigate('Saldo') },
      ],
    },
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
        { id: 5,  title: 'Ayuda',                  subtitle: 'Resolvé tus dudas frecuentes',      icon: 'help-circle-outline',   onPress: () => navigation.navigate('Help') },
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
    <View style={[styles.container, { backgroundColor: bg }]}>
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

        {/* Header */}
        <View style={styles.header}>
          {authLoading && !user ? (
            <View style={[styles.avatarPlaceholder, { backgroundColor: cardBg, borderColor: border }]}>
              <ActivityIndicator size="large" color={textMuted} />
            </View>
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
                    <ActivityIndicator size="large" color={ui.invertBg} />
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[styles.avatarInitials, { color: textPrimary }]}>{initials}</Text>
            </View>
          )}
          <Text style={[styles.name, { color: textPrimary }]}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={[styles.email, { color: textMuted }]}>{user?.email}</Text>
          {/* Solo el número: sin toque, sin lista de reseñas una por una. Leer lo que
              escribieron sobre uno no suma nada bueno acá. */}
          <View style={styles.ratingRow}>
            <Rating rating={user?.rating} count={user?.ratingCount} size={15} />
          </View>
          {/* {user?.gender ? (
            <Text style={[styles.email, { color: textMuted, marginTop: 6 }]}>
              Sexo: {user.gender === 'female' ? 'Femenino' : user.gender === 'male' ? 'Masculino' : user.gender}
            </Text>
          ) : null} */}

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

        {/* Menu */}
        <View style={styles.menuContent}>
          {menuSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: sectionMenuTitleColor }]}>{section.title}</Text>
              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: border }]}>
                {section.items.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.menuItem,
                      index < section.items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider },
                    ]}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                  >
                    {/* El destructivo se marca invirtiendo el fondo, no con rojo. */}
                    <View style={[
                      styles.iconBox,
                      { backgroundColor: item.danger ? ui.invertBg : divider },
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
    </View>
  );
};

const styles = StyleSheet.create({
  container:     { flex: 1 },
  scrollContent: { paddingBottom: TAB_BAR_SPACE },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  avatarImageWrap: {
    width: 128,
    height: 128,
    borderRadius: 64,
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 128,
    height: 128,
    borderRadius: 64,
  },
  avatarImageLoader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 64,
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
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarInitials: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 44,
    letterSpacing: 1,
  },
  name: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 26,
    letterSpacing: -0.6,
    marginBottom: 4,
    textAlign: 'center',
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 8 },
  email: {
    fontFamily: 'Sora_400Regular',
    fontSize: 14,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  discountText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 13,
  },

  // Menu
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
  sectionCard: {
    borderRadius: 24,
    overflow: 'hidden',
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
