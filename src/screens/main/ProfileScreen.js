import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { buildImageUri } from '../../services/apiService';
import { Image } from 'react-native';
import useColors from '../../hooks/useColors';

// Usar valores directos para evitar problemas de carga en estilos estáticos
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
  const { user, logout, isAuthenticated } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { colors, fontFamily, createColorArray, getCurrentThemeMode, setThemeMode } = useColors();
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Dynamic styles that depend on fontFamily from hook
  const dynamicStyles = StyleSheet.create({
    statValue: {
      fontSize: 24,
      fontFamily: fontFamily.bold,
      fontWeight: 'bold',
      // color: '#000000', // Ahora dinámico
    },
    statLabel: {
      fontSize: 13,
      // color: '#6B7280', // Ahora dinámico
      fontFamily: fontFamily.medium,
      fontWeight: '500',
      letterSpacing: 0.3,
    },
    sectionTitle: {
      fontSize: 11,
      fontFamily: fontFamily.semiBold,
      fontWeight: '600',
      // color: '#9CA3AF', // Ahora dinámico
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 14,
      marginLeft: 4,
    },
    menuItemText: {
      flex: 1,
      marginLeft: 14,
      fontSize: 16,
      // color: '#000000', // Ahora dinámico
      fontFamily: fontFamily.medium,
      fontWeight: '500',
    },
  });

  useEffect(() => {
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
  }, []);

  // Efecto para detectar cuando el usuario se desautentica
  useEffect(() => {
    console.log('ProfileScreen - isAuthenticated:', isAuthenticated, 'user:', user);
    if (!isAuthenticated && !user) {
      console.log('Usuario desautenticado detectado en ProfileScreen');
      // El AppNavigator debería redirigir automáticamente
    }
  }, [isAuthenticated, user]);

  const handleLogout = () => {
    console.log('handleLogout - Botón presionado');
    console.log('Estado actual - isAuthenticated:', isAuthenticated, 'user:', user);

    // Mostrar alert de confirmación
    console.log('Preparando Alert.alert...');

    try {
      Alert.alert(
        'Cerrar Sesión',
        '¿Estás seguro que deseas cerrar sesión?',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => {
              console.log('Logout cancelado por el usuario');
            }
          },
          {
            text: 'Cerrar Sesión',
            style: 'destructive',
            onPress: () => {
              console.log('✅ Usuario confirmó logout - iniciando proceso...');
              performLogout();
            },
          },
        ],
        {
          cancelable: true,
          onDismiss: () => {
            console.log('Alert cerrado sin seleccionar');
          }
        }
      );
      console.log('✅ Alert.alert llamado exitosamente');
    } catch (error) {
      console.error('❌ Error al mostrar Alert:', error);
      // Si el Alert falla, ejecutar logout directamente
      console.log('Ejecutando logout directamente debido a error en Alert');
      performLogout();
    }
  };

  const performLogout = async () => {
    try {
      console.log('🔄 performLogout - INICIANDO');

      // Ejecutar logout
      console.log('🔄 performLogout - Ejecutando función logout()...');
      await logout();
      console.log('✅ performLogout - logout() completado');

      // El AppNavigator debería redirigir automáticamente cuando isAuthenticated cambie a false
      // pero si necesitas redirigir explícitamente, usa esto:
      setTimeout(() => {
        try {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            })
          );
          console.log('✅ Navegación a Login completada');
        } catch (navError) {
          console.error('Error en navegación:', navError);
        }
      }, 500);

    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
      Alert.alert('Error', 'No se pudo cerrar sesión. Intenta nuevamente.');
    }
  };

  const handleThemeToggle = () => {
    const currentMode = getCurrentThemeMode();
    
    // Ciclo: light -> dark -> system -> light
    if (currentMode === 'light') {
      setThemeMode('dark');
      Alert.alert('Tema Cambiado', '🌙 Modo oscuro activado');
    } else if (currentMode === 'dark') {
      setThemeMode('system');
      Alert.alert('Tema Cambiado', '📱 Modo automático activado (sigue el sistema)');
    } else {
      setThemeMode('light');
      Alert.alert('Tema Cambiado', '🌞 Modo claro activado');
    }
  };

  const getThemeButtonText = () => {
    const currentMode = getCurrentThemeMode();
    if (currentMode === 'light') return 'Cambiar a Oscuro';
    if (currentMode === 'dark') return 'Cambiar a Automático'; 
    return 'Cambiar a Claro';
  };

  const getThemeIcon = () => {
    const currentMode = getCurrentThemeMode();
    if (currentMode === 'light') return 'moon-outline';
    if (currentMode === 'dark') return 'phone-portrait-outline';
    return 'sunny-outline';
  };

  const menuSections = [
    {
      title: 'Perfil',
      items: [
        {
          id: 1,
          title: 'Editar Perfil',
          icon: 'person-outline',
          onPress: () => navigation.navigate('EditProfile'),
        },
        {
          id: 2,
          title: 'Mis Vehículos',
          icon: 'car-outline',
          onPress: () => navigation.navigate('Vehicles'),
        },
        // {
        //   id: 3,
        //   title: 'Mis Reseñas',
        //   icon: 'star-outline',
        //   onPress: () => navigation.navigate('UserReviews', {
        //     userId: user?._id,
        //     userName: `${user?.firstName} ${user?.lastName}`,
        //   }),
        // },
      ],
    },
    {
      title: 'Información',
      items: [
        // {
        //   id: 3,
        //   title: 'Notificaciones',
        //   icon: 'notifications-outline',
        //   onPress: () => navigation.navigate('Notifications'),
        // },
        {
          id: 4,
          title: 'Términos y Condiciones',
          icon: 'document-text-outline',
          onPress: () => navigation.navigate('Terms'),
        },
        {
          id: 5,
          title: 'Ayuda',
          icon: 'help-circle-outline',
          onPress: () => navigation.navigate('Help'),
        },
        {
          id: 6,
          title: getThemeButtonText(),
          icon: getThemeIcon(),
          onPress: handleThemeToggle,
        },
      ],
    },
    // {
    //   title: 'Reservas',
    //   items: [
    //     {
    //       id: 6,
    //       title: 'Mis Reservas de Asiento',
    //       icon: 'calendar-outline',
    //       onPress: () => navigation.navigate('CarpoolingsTab', { screen: 'MySeatReservations' }),
    //     },
    //   ],
    // },
    {
      title: 'Sesión',
      items: [
        {
          id: 7,
          title: 'Cerrar Sesión',
          icon: 'log-out-outline',
          onPress: handleLogout,
          danger: true,
        },
      ],
    },
  ];

  return (
    <View style={[styles.gradient, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image
                source={{ uri: buildImageUri(user.avatar) || undefined }}
                style={styles.avatarImage}
                onError={() => console.log('Error loading avatar from:', user.avatar)}
              />
            ) : (
              <View
                style={[styles.avatar, { backgroundColor: '#292929', borderColor: colors.cardBackground }]}
              >
                <Text style={[styles.avatarText, { color: colors.textPrimary }]}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.name, { color: colors.textPrimary }]}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {menuSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={[dynamicStyles.sectionTitle, { color: colors.textMuted }]}>{section.title}</Text>
              {section.items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.menuItem, { backgroundColor: '#292929', borderColor: colors.border }]}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuItemContent}>
                    <View style={[
                      styles.iconContainer,
                      item.danger && styles.iconContainerDanger,
                      { 
                        backgroundColor: item.danger ? 'rgba(239, 68, 68, 0.1)' : '#000000',
                        borderColor: item.danger ? 'rgba(239, 68, 68, 0.2)' : colors.border
                      }
                    ]}>
                      <Ionicons
                        name={item.icon}
                        size={22}
                        color={item.danger ? colors.error : colors.textPrimary}
                      />
                    </View>
                    <Text
                      style={[
                        dynamicStyles.menuItemText,
                        { color: item.danger ? colors.error : colors.textPrimary },
                        item.danger && styles.menuItemDanger,
                      ]}
                    >
                      {item.title}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={item.danger ? colors.error : colors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 48,
    paddingBottom: 32,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#F8F9FA',
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#F8F9FA',
  },
  avatarText: {
    fontSize: 44,
    fontFamily: SORA_FONTS.bold,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  name: {
    fontSize: 28,
    fontFamily: SORA_FONTS.bold,
    fontWeight: 'bold',
    // color: '#000000', // Ahora dinámico
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  email: {
    fontSize: 15,
    fontFamily: SORA_FONTS.regular,
    // color: '#6B7280', // Ahora dinámico
    marginBottom: 28,
  },
  statsContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#1F2937',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statBadge: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 10,
    minWidth: 70,
    alignItems: 'center',
    shadowColor: '#1F2937',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 12,
  },
  content: {
    padding: 24,
    paddingTop: 8,
  },
  section: {
    marginBottom: 28,
  },
  menuItem: {
    // backgroundColor: '#FFFFFF', // Ahora dinámico
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    // borderColor: '#F3F4F6', // Ahora dinámico
    overflow: 'hidden',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    // backgroundColor: '#F8F9FA', // Ahora dinámico
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    // borderColor: '#F3F4F6', // Ahora dinámico
  },
  iconContainerDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  menuItemDanger: {
    color: '#EF4444',
  },
});

export default ProfileScreen;
