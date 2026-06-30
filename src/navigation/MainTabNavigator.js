import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, Keyboard, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../hooks/useColors';
import { useTheme } from '../context/ThemeContext';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useNotifications } from '../context/NotificationContext';
import SoraText from '../components/SoraText';

import HomeStackNavigator from './stacks/HomeStackNavigator';
import CarpoolingsStackNavigator from './stacks/CarpoolingsStackNavigator';
import ChatStackNavigator from './stacks/ChatStackNavigator';
import ProfileStackNavigator from './stacks/ProfileStackNavigator';
import AssistantStackNavigator from './stacks/AssistantStackNavigator';
import UnreadNewsModalLayer from '../components/modals/UnreadNewsModalLayer';
import AppTutorialOverlay from '../components/tutorial/AppTutorialOverlay';
import { useTutorial } from '../context/TutorialContext';

const RUMBO_AVATAR_DARK = require('../../assets/agent/rumbo_128.png');
const RUMBO_AVATAR_LIGHT = require('../../assets/agent/rumbo_black_128.png');

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useColors();
  const { isDarkMode } = useTheme();
  const { unreadCount } = useUnreadMessages();
  const { tutorialReady, tutorialCompleted, completeTutorial } = useTutorial();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const activeColor   = isDarkMode ? '#F5F5F5' : '#0A0A0A';
  const inactiveColor = isDarkMode ? '#555555' : '#BBBBBB';
  const tabBg         = isDarkMode ? '#111111' : '#FFFFFF';
  const pillBg        = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';

  const bottomPad = insets.bottom > 0 ? insets.bottom : 8;
  const TAB_HEIGHT = 56 + bottomPad;

  return (
    <>
      <Tab.Navigator
        id="MainTabs"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor:   activeColor,
          tabBarInactiveTintColor: inactiveColor,
          tabBarStyle: keyboardVisible ? { display: 'none' } : {
            backgroundColor: tabBg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            paddingBottom: bottomPad,
            paddingTop: 8,
            height: TAB_HEIGHT,
          },
          tabBarIcon: ({ focused, color }) => {
            // Tab Asistente — avatar de Rumbo con borde circular
            if (route.name === 'AssistantTab') {
              return (
                <View style={[
                  styles.rumboWrap,
                  {
                    borderColor: focused ? activeColor : 'transparent',
                  },
                ]}>
                  <Image
                    source={isDarkMode ? RUMBO_AVATAR_DARK : RUMBO_AVATAR_LIGHT}
                    style={styles.rumboImg}
                  />
                </View>
              );
            }

            const iconMap = {
              HomeTab:        focused ? 'home'        : 'home-outline',
              CarpoolingsTab: focused ? 'car'         : 'car-outline',
              ChatsTab:       focused ? 'chatbubbles' : 'chatbubbles-outline',
              ProfileTab:     focused ? 'person'      : 'person-outline',
            };
            const iconName = iconMap[route.name];

            // Badge de mensajes no leídos dentro del pill
            const showBadge = route.name === 'ChatsTab' && unreadCount > 0;

            return (
              <View style={[styles.pill, focused && { backgroundColor: pillBg }]}>
                <Ionicons name={iconName} size={22} color={color} />
                {showBadge && (
                  <View style={[styles.badge, { backgroundColor: colors.error, borderColor: tabBg }]}>
                    <SoraText style={styles.badgeText}>
                      {unreadCount > 99 ? '99+' : String(unreadCount)}
                    </SoraText>
                  </View>
                )}
              </View>
            );
          },
        })}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeStackNavigator}
          options={({ route }) => {
            const focused = getFocusedRouteNameFromRoute(route) ?? 'Home';
            const hide = ['CreateTripRequest', 'TripMap'].includes(focused);
            return { ...(hide ? { tabBarStyle: { display: 'none' } } : {}) };
          }}
        />

        <Tab.Screen
          name="CarpoolingsTab"
          component={CarpoolingsStackNavigator}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              const state = navigation.getState();
              const cur = state.routes[state.index];
              if (cur.name !== 'CarpoolingsTab' || (cur.state && cur.state.index > 0)) {
                e.preventDefault();
                navigation.navigate('CarpoolingsTab', { screen: 'Carpoolings' });
              }
            },
          })}
        />

        <Tab.Screen
          name="AssistantTab"
          component={AssistantStackNavigator}
        />

        <Tab.Screen
          name="ChatsTab"
          component={ChatStackNavigator}
          options={({ route }) => {
            const nested = getFocusedRouteNameFromRoute(route) ?? 'Chats';
            const hide = nested === 'ChatDetail' || nested === 'UserProfile';
            return { ...(hide ? { tabBarStyle: { display: 'none' } } : {}) };
          }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault();
              const state = navigation.getState();
              const cur = state.routes[state.index];
              if (cur.name === 'ChatsTab' && cur.state && cur.state.index > 0) {
                navigation.navigate('ChatsTab', { screen: 'Chats', params: { reset: true } });
              } else {
                navigation.navigate('ChatsTab', { screen: 'Chats' });
              }
            },
          })}
        />

        <Tab.Screen
          name="ProfileTab"
          component={ProfileStackNavigator}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault();
              const state = navigation.getState();
              const cur = state.routes[state.index];
              if (cur.name === 'ProfileTab' && cur.state && cur.state.index > 0) {
                navigation.navigate('ProfileTab', { screen: 'Profile', params: { reset: true } });
              } else {
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
  // Rumbo
  rumboWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rumboImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },

  // Pill background para icon activo
  pill: {
    width: 48,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  // Badge de mensajes no leídos
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    borderRadius: 10,
    minWidth: 17,
    height: 17,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'Sora_700Bold',
    lineHeight: 12,
  },
});

export default MainTabNavigator;
