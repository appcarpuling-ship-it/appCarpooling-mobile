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
import { useTutorial } from '../../../context/TutorialContext';

/** Evitar refetch infinito al cambiar de tab; disparaba loader de avatar en bucle */
const PROFILE_REFRESH_GAP_MS = 10000;

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const { user, logout, loading: authLoading, refreshUser } = useAuth();
  const lastProfileFetchAtRef = useRef(0);
  const { getCurrentThemeMode, setThemeMode } = useColors();
  const { resetTutorial } = useTutorial();

  const isDarkMode = getCurrentThemeMode() === 'dark';
  const bg          = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg      = isDarkMode ? '#222222' : '#FFFFFF';
  const border      = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted   = isDarkMode ? '#6B7280' : '#9CA3AF';
  const divider     = isDarkMode ? '#2A2A2A' : '#F0F0F0';
  const sectionMenuTitleColor = isDarkMode ? textMuted : '#000000';

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
        { id: 1, title: 'Editar Perfil',  icon: 'person-outline', onPress: () => navigation.navigate('EditProfile') },
        { id: 2, title: 'Mis Vehículos',  icon: 'car-outline',    onPress: () => navigation.navigate('Vehicles') },
      ],
    },
    {
      title: 'Información',
      items: [
        { id: 4, title: 'Términos y Condiciones', icon: 'document-text-outline', onPress: () => navigation.navigate('Terms') },
        { id: 5, title: 'Ayuda',                  icon: 'help-circle-outline',   onPress: () => navigation.navigate('Help') },
        { id: 9, title: 'Mostrar introducción',   icon: 'book-outline',            onPress: () => resetTutorial() },
        {
          id: 6,
          title: isDarkMode ? 'Cambiar a Claro' : 'Cambiar a Oscuro',
          icon:  isDarkMode ? 'sunny-outline'   : 'moon-outline',
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
      ],
    },
    {
      title: 'Sesión',
      items: [
        { id: 7, title: 'Cerrar Sesión', icon: 'log-out-outline', onPress: handleLogout, danger: true },
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
                    <ActivityIndicator size="large" color={isDarkMode ? '#FFFFFF' : '#111827'} />
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
          {/* {user?.gender ? (
            <Text style={[styles.email, { color: textMuted, marginTop: 6 }]}>
              Sexo: {user.gender === 'female' ? 'Femenino' : user.gender === 'male' ? 'Masculino' : user.gender}
            </Text>
          ) : null} */}

          {(user?.discountPercentage ?? 0) > 0 && (() => {
            const pct = user.discountPercentage;
            const count = Math.round(pct / 20) || 1;
            return (
              <View style={[styles.discountBadge, { backgroundColor: isDarkMode ? '#064E3B' : '#D1FAE5' }]}>
                <Ionicons name="pricetag" size={13} color="#10B981" />
                <Text style={[styles.discountText, { color: '#10B981' }]}>
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
                    <View style={[
                      styles.iconBox,
                      { backgroundColor: item.danger ? (isDarkMode ? '#3D1A1A' : '#FEE2E2') : divider },
                    ]}>
                      <Ionicons
                        name={item.icon}
                        size={19}
                        color={item.danger ? (isDarkMode ? '#F87171' : '#DC2626') : textPrimary}
                      />
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                      <Text style={[
                        styles.menuItemText,
                        { color: item.danger ? (isDarkMode ? '#F87171' : '#DC2626') : textPrimary },
                      ]}>
                        {item.title}
                      </Text>
                      {item.subtitle ? (
                        <Text style={{ fontSize: 11, color: (user?.discountPercentage ?? 0) > 0 && item.id === 8 ? '#10B981' : textMuted, marginTop: 2 }}>
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
  scrollContent: { paddingBottom: 40 },

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
    fontSize: 46,
    fontWeight: '700',
    letterSpacing: 1,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  email: {
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
    fontSize: 13,
    fontWeight: '600',
  },

  // Menu
  menuContent: { paddingHorizontal: 16 },
  section:     { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

export default ProfileScreen;
