import React, { useState, useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useNotifications } from '../context/NotificationContext';
import FloatingTabBar from '../components/ui/FloatingTabBar';

// Stack Navigators
import HomeStackNavigator from './stacks/HomeStackNavigator';
import CarpoolingsStackNavigator from './stacks/CarpoolingsStackNavigator';
import HistoryStackNavigator from './stacks/HistoryStackNavigator';
import ProfileStackNavigator from './stacks/ProfileStackNavigator';
import AssistantStackNavigator from './stacks/AssistantStackNavigator';
import UnreadNewsModalLayer from '../components/modals/UnreadNewsModalLayer';
import AppTutorialOverlay from '../components/tutorial/AppTutorialOverlay';
import { useTutorial } from '../context/TutorialContext';

const Tab = createBottomTabNavigator();

// Pantalla inicial de cada stack: es donde se muestra la barra.
const TAB_ROOT = {
  HomeTab: 'Home',
  CarpoolingsTab: 'Carpoolings',
  AssistantTab: 'Assistant',
  HistoryTab: 'History',
  ProfileTab: 'Profile',
};

const MainTabNavigator = () => {
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
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={({ route }) => {
        // La barra vive solo en la raíz de cada tab. Adentro de un stack
        // (detalle, formulario, mapa) estorba: tapa el final del scroll y
        // compite con el botón de la pantalla. getFocusedRouteNameFromRoute
        // devuelve undefined mientras no saliste de la primera pantalla.
        const nested = getFocusedRouteNameFromRoute(route);
        const deep = nested !== undefined && nested !== TAB_ROOT[route.name];
        return {
          headerShown: false,
          // FloatingTabBar lee este display:'none' para ocultarse.
          tabBarStyle: keyboardVisible || deep ? { display: 'none' } : undefined,
        };
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{ tabBarLabel: 'Inicio' }}
      />
      <Tab.Screen
        name="CarpoolingsTab"
        component={CarpoolingsStackNavigator}
        options={{ tabBarLabel: 'Traslados' }}
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
        name="HistoryTab"
        component={HistoryStackNavigator}
        options={{ tabBarLabel: 'Historial' }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            const state = navigation.getState();
            const currentRoute = state.routes[state.index];
            const leavingOtherTab = currentRoute.name !== 'HistoryTab';
            const inner = currentRoute.state;
            const nestedInHistory =
              currentRoute.name === 'HistoryTab' && inner && inner.index > 0;

            if (leavingOtherTab || nestedInHistory) {
              e.preventDefault();
              navigation.navigate('HistoryTab', { screen: 'History' });
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
