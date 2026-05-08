import React from 'react'; // eslint-disable-line
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import { buildImageUri } from '../../../services/apiService';
import useColors from '../../../hooks/useColors';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const { user, logout } = useAuth();
  const { getCurrentThemeMode, setThemeMode } = useColors();

  const isDarkMode = getCurrentThemeMode() === 'dark';
  const bg          = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg      = isDarkMode ? '#222222' : '#FFFFFF';
  const border      = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted   = isDarkMode ? '#6B7280' : '#9CA3AF';
  const divider     = isDarkMode ? '#2A2A2A' : '#F0F0F0';

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
            showAlert('Error', 'No se pudo cerrar sesión. Intenta nuevamente.');
          }
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
        { id: 1, title: 'Editar Perfil',  icon: 'person-outline', onPress: () => navigation.navigate('EditProfile') },
        { id: 2, title: 'Mis Vehículos',  icon: 'car-outline',    onPress: () => navigation.navigate('Vehicles') },
      ],
    },
    {
      title: 'Información',
      items: [
        { id: 4, title: 'Términos y Condiciones', icon: 'document-text-outline', onPress: () => navigation.navigate('Terms') },
        { id: 5, title: 'Ayuda',                  icon: 'help-circle-outline',   onPress: () => navigation.navigate('Help') },
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
        { id: 8, title: 'Mi Código Promocional', icon: 'gift-outline', onPress: () => navigation.navigate('ReferralScreen') },
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <View style={styles.header}>
          {user?.avatar ? (
            <Image
              source={{ uri: buildImageUri(user.avatar) }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[styles.avatarInitials, { color: textPrimary }]}>{initials}</Text>
            </View>
          )}
          <Text style={[styles.name, { color: textPrimary }]}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={[styles.email, { color: textMuted }]}>{user?.email}</Text>
          {user?.gender ? (
            <Text style={[styles.email, { color: textMuted, marginTop: 6 }]}>
              Sexo: {user.gender === 'female' ? 'Femenino' : user.gender === 'male' ? 'Masculino' : user.gender}
            </Text>
          ) : null}

          {(user?.discountPercentage ?? 0) > 0 && (
            <View style={[styles.discountBadge, { backgroundColor: isDarkMode ? '#064E3B' : '#D1FAE5' }]}>
              <Ionicons name="pricetag" size={13} color="#10B981" />
              <Text style={[styles.discountText, { color: '#10B981' }]}>
                {user.discountPercentage}% de descuento activo
              </Text>
            </View>
          )}
        </View>

        {/* Menu */}
        <View style={styles.menuContent}>
          {menuSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: textMuted }]}>{section.title}</Text>
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
                    <Text style={[
                      styles.menuItemText,
                      { color: item.danger ? (isDarkMode ? '#F87171' : '#DC2626') : textPrimary },
                    ]}>
                      {item.title}
                    </Text>
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
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarInitials: {
    fontSize: 36,
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
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
});

export default ProfileScreen;
