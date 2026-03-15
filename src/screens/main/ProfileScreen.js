import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { buildImageUri } from '../../services/apiService';
import useColors from '../../hooks/useColors';

const SORA_FONTS = {
  thin: 'Sora_100Thin',
  extraLight: 'Sora_200ExtraLight',
  light: 'Sora_300Light',
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semiBold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  extraBold: 'Sora_800ExtraBold',
};

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const { user, logout, isAuthenticated } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { colors, fontFamily, getCurrentThemeMode, setThemeMode } = useColors();
  const slideAnim = useRef(new Animated.Value(20)).current;

  const isDarkMode = getCurrentThemeMode() === 'dark';
  const cardBg   = isDarkMode ? '#1C1C1C' : '#FFFFFF';
  const screenBg = isDarkMode ? '#0E0E0E' : '#F6F6F6';
  const sep      = isDarkMode ? '#252525' : '#F0F0F0';
  const shadow   = isDarkMode ? {} : {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!isAuthenticated && !user) {
      // El AppNavigator redirige automáticamente
    }
  }, [isAuthenticated, user]);

  const handleLogout = () => {
    showAlert('Cerrar Sesion', 'Estas seguro que deseas cerrar sesion?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesion',
        style: 'destructive',
        onPress: async () => {
          try { await logout(); }
          catch { showAlert('Error', 'No se pudo cerrar sesion. Intenta nuevamente.'); }
        },
      },
    ]);
  };

  const handleThemeToggle = () => {
    if (getCurrentThemeMode() === 'light') {
      setThemeMode('dark');
      showAlert('Tema cambiado', 'Modo oscuro activado');
    } else {
      setThemeMode('light');
      showAlert('Tema cambiado', 'Modo claro activado');
    }
  };

  const getThemeLabel = () => getCurrentThemeMode() === 'light' ? 'Cambiar a oscuro' : 'Cambiar a claro';
  const getThemeIcon  = () => getCurrentThemeMode() === 'light' ? 'moon-outline' : 'sunny-outline';

  const menuSections = [
    {
      title: 'Perfil',
      items: [
        { id: 1, title: 'Editar Perfil',   icon: 'person-outline',       onPress: () => navigation.navigate('EditProfile') },
        { id: 2, title: 'Mis Vehiculos',   icon: 'car-outline',           onPress: () => navigation.navigate('Vehicles') },
      ],
    },
    {
      title: 'Informacion',
      items: [
        { id: 4, title: 'Terminos y Condiciones', icon: 'document-text-outline', onPress: () => navigation.navigate('Terms') },
        { id: 5, title: 'Ayuda',                  icon: 'help-circle-outline',   onPress: () => navigation.navigate('Help') },
        { id: 6, title: getThemeLabel(),           icon: getThemeIcon(),           onPress: handleThemeToggle },
      ],
    },
    {
      title: 'Referidos y Descuentos',
      items: [
        { id: 8, title: 'Mi Codigo Promocional', icon: 'gift-outline', onPress: () => navigation.navigate('ReferralScreen') },
      ],
    },
    {
      title: 'Sesion',
      items: [
        { id: 7, title: 'Cerrar Sesion', icon: 'log-out-outline', onPress: handleLogout, danger: true },
      ],
    },
  ];

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  return (
    <View style={[styles.screen, { backgroundColor: screenBg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Avatar */}
          <View style={[styles.avatarWrap, shadow, { backgroundColor: cardBg }]}>
            {user?.avatar ? (
              <Image source={{ uri: buildImageUri(user.avatar) || undefined }} style={styles.avatarImg} />
            ) : (
              <Text style={[styles.avatarInitials, { color: colors.textPrimary, fontFamily: SORA_FONTS.bold }]}>
                {initials}
              </Text>
            )}
          </View>

          <Text style={[styles.name, { color: colors.textPrimary, fontFamily: SORA_FONTS.bold }]}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={[styles.email, { color: colors.textTertiary, fontFamily: SORA_FONTS.regular }]}>
            {user?.email}
          </Text>

          {(user?.discountPercentage ?? 0) > 0 && (
            <View style={[styles.discountBadge, { backgroundColor: colors.success + '18', borderColor: colors.success + '40' }]}>
              <Ionicons name="pricetag-outline" size={13} color={colors.success} />
              <Text style={[styles.discountTxt, { color: colors.success, fontFamily: SORA_FONTS.medium }]}>
                {user.discountPercentage}% de descuento activo
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Menu */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {menuSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: fontFamily.semiBold }]}>
                {section.title}
              </Text>

              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: sep }, shadow]}>
                {section.items.map((item, idx) => (
                  <View key={item.id}>
                    <TouchableOpacity
                      style={styles.row}
                      onPress={item.onPress}
                      activeOpacity={0.6}
                    >
                      <View style={[
                        styles.iconBox,
                        {
                          backgroundColor: item.danger
                            ? 'rgba(239,68,68,0.08)'
                            : isDarkMode ? '#252525' : '#F5F5F5',
                        },
                      ]}>
                        <Ionicons
                          name={item.icon}
                          size={20}
                          color={item.danger ? colors.error : colors.textPrimary}
                        />
                      </View>

                      <Text style={[
                        styles.rowLabel,
                        {
                          color: item.danger ? colors.error : colors.textPrimary,
                          fontFamily: fontFamily.medium,
                        },
                      ]}>
                        {item.title}
                      </Text>

                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={item.danger ? colors.error + '80' : isDarkMode ? '#444' : '#CCC'}
                      />
                    </TouchableOpacity>

                    {idx < section.items.length - 1 && (
                      <View style={[styles.rowSep, { backgroundColor: sep, marginLeft: 58 }]} />
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Animated.View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  scroll:  { paddingBottom: 40 },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  email: {
    fontSize: 14,
    marginBottom: 10,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 6,
  },
  discountTxt: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Menu
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  rowSep: {
    height: 1,
  },
});

export default ProfileScreen;
