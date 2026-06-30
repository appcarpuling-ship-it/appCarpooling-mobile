import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
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
import { useColors } from '../../../hooks/useColors';
import { useTutorial } from '../../../context/TutorialContext';
import SoraText from '../../../components/SoraText';
import { SF, textStyles, shadows } from '../../../theme/tokens';

/** Evitar refetch infinito al cambiar de tab */
const PROFILE_REFRESH_GAP_MS = 10000;

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const { user, logout, loading: authLoading, refreshUser } = useAuth();
  const lastFetchRef = useRef(0);
  const { colors, isDarkMode, getCurrentThemeMode, setThemeMode } = useColors();
  const { resetTutorial } = useTutorial();

  const [refreshing, setRefreshing] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(false);
  const timerRef = useRef(null);

  const avatarUri    = user?.avatar ? buildImageUri(user.avatar) : null;
  const avatarSource = useMemo(() => (avatarUri ? { uri: avatarUri } : null), [avatarUri]);
  const initials     = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`;

  useEffect(() => {
    timerRef.current && clearTimeout(timerRef.current);
    if (!avatarUri) { setAvatarLoading(false); return; }
    setAvatarLoading(true);
    timerRef.current = setTimeout(() => setAvatarLoading(false), 12000);
    return () => { timerRef.current && clearTimeout(timerRef.current); };
  }, [avatarUri]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFetchRef.current < PROFILE_REFRESH_GAP_MS) return;
      lastFetchRef.current = now;
      refreshUser();
    }, [refreshUser])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  };

  const clearTimer = () => { timerRef.current && clearTimeout(timerRef.current); timerRef.current = null; };

  const handleLogout = () => {
    showAlert('Cerrar Sesión', '¿Estás seguro que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          try { await logout(); }
          catch { showAlert('Ocurrió algo', 'No se pudo cerrar sesión. Intentá nuevamente.'); }
        },
      },
    ]);
  };

  const handleThemeToggle = () => {
    const current = getCurrentThemeMode();
    setThemeMode(current === 'light' ? 'dark' : 'light');
  };

  const menuSections = [
    {
      title: 'Perfil',
      items: [
        { id: 1, title: 'Editar Perfil',   subtitle: 'Cambiá tu foto, nombre y datos', icon: 'person-outline',  onPress: () => navigation.navigate('EditProfile') },
        { id: 2, title: 'Mis Vehículos',   subtitle: 'Administrá tus vehículos',        icon: 'car-outline',     onPress: () => navigation.navigate('Vehicles') },
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
        { id: 4,  title: 'Términos y Condiciones',  subtitle: 'Leé nuestras políticas de uso',      icon: 'document-text-outline',     onPress: () => navigation.navigate('Terms') },
        { id: 11, title: 'Política de Privacidad',  subtitle: 'Cómo usamos tus datos personales',   icon: 'shield-outline',            onPress: () => navigation.navigate('Privacy') },
        { id: 12, title: 'Cookies',                 subtitle: 'Información sobre almacenamiento',   icon: 'information-circle-outline', onPress: () => navigation.navigate('Cookies') },
        { id: 5,  title: 'Ayuda',                   subtitle: 'Resolvé tus dudas frecuentes',       icon: 'help-circle-outline',       onPress: () => navigation.navigate('Help') },
        { id: 9,  title: 'Mostrar introducción',    subtitle: 'Volvé a ver el tutorial de la app',  icon: 'book-outline',              onPress: () => resetTutorial() },
        {
          id: 6,
          title:    isDarkMode ? 'Cambiar a Claro' : 'Cambiar a Oscuro',
          subtitle: isDarkMode ? 'Activar modo día' : 'Activar modo noche',
          icon:     isDarkMode ? 'sunny-outline'   : 'moon-outline',
          onPress:  handleThemeToggle,
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
          accent: (user?.discountPercentage ?? 0) > 0,
          onPress: () => navigation.navigate('ReferralScreen'),
        },
      ],
    },
    {
      title: 'Sesión',
      items: [
        { id: 7, title: 'Cerrar Sesión', subtitle: 'Salí de tu cuenta', icon: 'log-out-outline', onPress: handleLogout, danger: true },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Modal preview avatar */}
      <Modal
        visible={avatarPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPreview(false)}
      >
        <Pressable
          style={[styles.modalBg, { backgroundColor: 'rgba(0,0,0,0.90)' }]}
          onPress={() => setAvatarPreview(false)}
        >
          {avatarSource && (
            <Image source={avatarSource} style={styles.modalImg} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textMuted}
            colors={[colors.textPrimary]}
          />
        }
      >
        {/* Header con avatar */}
        <View style={styles.header}>
          {authLoading && !user ? (
            <View style={[styles.avatarShell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActivityIndicator size="large" color={colors.textMuted} />
            </View>
          ) : avatarSource ? (
            <TouchableOpacity
              onPress={() => setAvatarPreview(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Ver foto de perfil en grande"
            >
              <View style={styles.avatarWrap}>
                <Image
                  key={avatarUri}
                  source={avatarSource}
                  style={styles.avatar}
                  onLoadEnd={() => { clearTimer(); setAvatarLoading(false); }}
                  onError={() => { clearTimer(); setAvatarLoading(false); }}
                />
                {avatarLoading && (
                  <View style={[
                    styles.avatarLoader,
                    { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.40)' : 'rgba(255,255,255,0.65)' },
                  ]}>
                    <ActivityIndicator size="large" color={colors.textPrimary} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.avatarShell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SoraText style={[styles.initials, { color: colors.textPrimary }]}>{initials}</SoraText>
            </View>
          )}

          <SoraText style={[styles.name, { color: colors.textPrimary }]}>
            {user?.firstName} {user?.lastName}
          </SoraText>
          <SoraText style={[styles.email, { color: colors.textTertiary }]}>
            {user?.email}
          </SoraText>

          {(user?.discountPercentage ?? 0) > 0 && (() => {
            const pct   = user.discountPercentage;
            const count = Math.round(pct / 20) || 1;
            return (
              <View style={[
                styles.discountBadge,
                { backgroundColor: isDarkMode ? 'rgba(52,211,153,0.12)' : 'rgba(16,185,129,0.10)' },
              ]}>
                <Ionicons name="pricetag" size={12} color={colors.success} />
                <SoraText style={[styles.discountText, { color: colors.success }]}>
                  {count} descuento{count !== 1 ? 's' : ''} activo{count !== 1 ? 's' : ''} · {pct}% de ahorro
                </SoraText>
              </View>
            );
          })()}
        </View>

        {/* Menú de secciones */}
        <View style={styles.menuArea}>
          {menuSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <SoraText style={[styles.sectionLabel, { color: colors.textMuted }]}>
                {section.title}
              </SoraText>
              <View style={[
                styles.sectionCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  ...(isDarkMode ? {} : shadows.sm),
                },
              ]}>
                {section.items.map((item, idx) => {
                  const isLast    = idx === section.items.length - 1;
                  const textColor = item.danger
                    ? colors.error
                    : item.accent
                    ? colors.success
                    : colors.textPrimary;
                  const iconBg = item.danger
                    ? (isDarkMode ? 'rgba(239,68,68,0.12)' : 'rgba(220,38,38,0.08)')
                    : colors.surfaceSubtle;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.menuItem,
                        !isLast && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.borderLight,
                        },
                      ]}
                      onPress={item.onPress}
                      activeOpacity={0.65}
                    >
                      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
                        <Ionicons name={item.icon} size={18} color={textColor} />
                      </View>
                      <View style={styles.menuText}>
                        <SoraText style={[styles.menuTitle, { color: textColor }]}>
                          {item.title}
                        </SoraText>
                        {item.subtitle ? (
                          <SoraText
                            numberOfLines={1}
                            style={[styles.menuSubtitle, {
                              color: item.accent ? colors.success : colors.textMuted,
                            }]}
                          >
                            {item.subtitle}
                          </SoraText>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 48 },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  avatarWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  avatarLoader: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarShell: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  initials: {
    fontSize: 40,
    fontFamily: SF.bold,
    letterSpacing: 1,
  },
  name: {
    ...textStyles.h3,
    marginBottom: 4,
  },
  email: {
    ...textStyles.body,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    marginTop: 12,
  },
  discountText: {
    ...textStyles.labelSm,
  },

  // Modal
  modalBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalImg: {
    width: '100%',
    height: '80%',
    maxHeight: 520,
  },

  // Menú
  menuArea: { paddingHorizontal: 16 },
  section:  { marginBottom: 24 },
  sectionLabel: {
    ...textStyles.tag,
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
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: { flex: 1, justifyContent: 'center' },
  menuTitle: {
    ...textStyles.label,
  },
  menuSubtitle: {
    ...textStyles.bodySm,
    marginTop: 2,
  },
});

export default ProfileScreen;
