import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Keyboard, Platform } from 'react-native';

const RUMBO_AVATAR_DARK = require('../../assets/agent/rumbo_128.png');
const RUMBO_AVATAR_LIGHT = require('../../assets/agent/rumbo_black_128.png');
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../hooks/useColors';
import { useTheme } from '../context/ThemeContext';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useNotifications } from '../context/NotificationContext';

// Stack Navigators
import HomeStackNavigator from './stacks/HomeStackNavigator';
import CarpoolingsStackNavigator from './stacks/CarpoolingsStackNavigator';
import ChatStackNavigator from './stacks/ChatStackNavigator';
import ProfileStackNavigator from './stacks/ProfileStackNavigator';
import AssistantStackNavigator from './stacks/AssistantStackNavigator';
import UnreadNewsModalLayer from '../components/modals/UnreadNewsModalLayer';
import AppTutorialOverlay from '../components/tutorial/AppTutorialOverlay';
import { useTutorial } from '../context/TutorialContext';

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { isDarkMode } = useTheme();
  const { unreadCount } = useUnreadMessages();
  const { unreadCount: unreadNotifications = 0 } = useNotifications();
  const { tutorialReady, tutorialCompleted, completeTutorial } = useTutorial();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <>
    <Tab.Navigator
      id="MainTabs"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          // Ícono custom de Rumbo
          if (route.name === 'AssistantTab') {
            return (
              <View style={[
                styles.rumboContainer,
                {
                  borderColor: focused
                    ? (isDarkMode ? '#FFFFFF' : '#1F2937')
                    : 'transparent',
                },
              ]}>
                <Image
                  source={isDarkMode ? RUMBO_AVATAR_DARK : RUMBO_AVATAR_LIGHT}
                  style={styles.rumboAvatar}
                />
              </View>
            );
          }

          let iconName;
          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'CarpoolingsTab') {
            iconName = focused ? 'car' : 'car-outline';
          } else if (route.name === 'ChatsTab') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }

          // Badge de mensajes no leídos
          if (route.name === 'ChatsTab' && unreadCount > 0) {
            return (
              <View style={styles.iconContainer}>
                <Ionicons name={iconName} size={size} color={color} />
                <View style={[
                  styles.badge,
                  {
                    backgroundColor: isDarkMode ? '#F87171' : '#EF4444',
                    borderColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.3,
                    shadowRadius: 2,
                    elevation: 3,
                  }
                ]}>
                  <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              </View>
            );
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: isDarkMode ? '#FFFFFF' : '#1F2937',
        tabBarInactiveTintColor: isDarkMode ? '#9CA3AF' : '#6B7280',
        tabBarStyle: keyboardVisible ? { display: 'none' } : {
          backgroundColor: isDarkMode ? '#1F1F1F' : '#FFFFFF',
          borderTopColor: colors.border,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
          height: 60 + (insets.bottom > 0 ? insets.bottom : 0),
        },
        tabBarShowLabel: false,
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={({ route }) => {
          const focused = getFocusedRouteNameFromRoute(route) ?? 'Home';
          const hideTabBar = ['CreateTripRequest', 'TripMap'].includes(focused);
          return {
            tabBarLabel: 'Inicio',
            ...(hideTabBar ? { tabBarStyle: { display: 'none' } } : {}),
          };
        }}
      />
      <Tab.Screen
        name="CarpoolingsTab"
        component={CarpoolingsStackNavigator}
        options={{ tabBarLabel: 'Viajes' }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            const state = navigation.getState();
            const currentRoute = state.routes[state.index];
            const leavingOtherTab = currentRoute.name !== 'CarpoolingsTab';
            const inner = currentRoute.state;
            const nestedInCarpoolings =
              currentRoute.name === 'CarpoolingsTab' && inner && inner.index > 0;

            if (leavingOtherTab || nestedInCarpoolings) {
              e.preventDefault();
              navigation.navigate('CarpoolingsTab', { screen: 'Carpoolings' });
            }
          },
        })}
      />
      <Tab.Screen
        name="AssistantTab"
        component={AssistantStackNavigator}
        options={{ tabBarLabel: 'Asistente' }}
      />
      <Tab.Screen
        name="ChatsTab"
        component={ChatStackNavigator}
        options={({ route }) => {
          const nested = getFocusedRouteNameFromRoute(route) ?? 'Chats';
          const hideTabBar = nested === 'ChatDetail' || nested === 'UserProfile';
          return {
            tabBarLabel: 'Mensajes',
            ...(hideTabBar ? { tabBarStyle: { display: 'none' } } : {}),
          };
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            e.preventDefault();

            console.log('🔄 [ChatTab] Tab pressed');
            const state = navigation.getState();
            const currentRoute = state.routes[state.index];

            console.log('📍 [ChatTab] Current route:', currentRoute.name);

            if (currentRoute.name === 'ChatsTab') {
              const chatTabState = currentRoute.state;
              console.log('📚 [ChatTab] Internal state:', chatTabState);

              if (chatTabState && chatTabState.index > 0) {
                console.log('↩️ [ChatTab] Navegando a inicio del stack');
                navigation.navigate('ChatsTab', {
                  screen: 'Chats',
                  params: { reset: true }
                });
              } else {
                console.log('🏠 [ChatTab] Ya en pantalla principal');
              }
            } else {
              console.log('🔄 [ChatTab] Navegando al tab');
              navigation.navigate('ChatsTab', { screen: 'Chats' });
            }
          },
        })}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{ tabBarLabel: 'Perfil' }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            // Prevenir navegación por defecto
            e.preventDefault();

            console.log('🔄 [ProfileTab] Tab pressed');
            const state = navigation.getState();
            const currentRoute = state.routes[state.index];

            console.log('📍 [ProfileTab] Current route:', currentRoute.name);

            // Si ya estamos en ProfileTab, verificar stack interno
            if (currentRoute.name === 'ProfileTab') {
              const profileTabState = currentRoute.state;
              console.log('📚 [ProfileTab] Internal state:', profileTabState);

              // Si estamos en una pantalla anidada (como Notifications), volver al inicio del stack (Profile)
              if (profileTabState && profileTabState.index > 0) {
                console.log('↩️ [ProfileTab] Navegando a inicio del stack (Profile)');
                navigation.navigate('ProfileTab', {
                  screen: 'Profile',
                  params: { reset: true }
                });
              } else {
                console.log('🏠 [ProfileTab] Ya en pantalla principal');
                // Permitir navegación normal si ya estamos en Profile
                navigation.navigate('ProfileTab', { screen: 'Profile' });
              }
            } else {
              // Navegar al tab normalmente
              console.log('🔄 [ProfileTab] Navegando al tab');
              navigation.navigate('ProfileTab', { screen: 'Profile' });
            }
          },
        })}
      />
    </Tab.Navigator>
      <UnreadNewsModalLayer />
      {tutorialReady && !tutorialCompleted ? (
        <AppTutorialOverlay onComplete={completeTutorial} />
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  rumboContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rumboAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  iconContainer: {
    width: 24,
    height: 24,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -10,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default MainTabNavigator;
