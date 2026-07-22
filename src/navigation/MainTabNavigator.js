import React, { useState, useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useNotifications } from '../context/NotificationContext';
import FloatingTabBar from '../components/ui/FloatingTabBar';

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
      tabBar={(props) => <FloatingTabBar {...props} unreadCount={unreadCount} />}
      screenOptions={{
        headerShown: false,
        // FloatingTabBar lee este display:'none' para ocultarse (teclado abierto
        // en Android, y las pantallas que ya lo declaraban en sus options).
        tabBarStyle: keyboardVisible ? { display: 'none' } : undefined,
      }}
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

export default MainTabNavigator;
