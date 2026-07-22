import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUI } from '../../theme/ui';

const RUMBO_AVATAR = require('../../../assets/agent/rumbo_black_128.png');

const ICONS = {
  HomeTab:        ['home-outline', 'home'],
  CarpoolingsTab: ['car-outline', 'car'],
  ChatsTab:       ['chatbubbles-outline', 'chatbubbles'],
  ProfileTab:     ['person-outline', 'person'],
};

// Rumbo va al medio y sobresale del pill, como el botón central de la referencia.
const CENTER_TAB = 'AssistantTab';

const FloatingTabBar = ({ state, descriptors, navigation, unreadCount = 0 }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();

  // Cubre los dos casos que ya existían: teclado abierto (screenOptions) y
  // pantallas anidadas que ocultan la barra (options por screen).
  const focusedOptions = descriptors[state.routes[state.index].key]?.options;
  if (focusedOptions?.tabBarStyle?.display === 'none') return null;

  // La barra es oscura en ambos temas (es el contraste de la referencia); en
  // modo oscuro se aclara apenas para despegarse del fondo.
  const barBg = ui.isDarkMode ? '#262626' : '#111111';
  const activeFg = '#FFFFFF';
  const inactiveFg = '#8A8A8E';

  const onPress = (route, isFocused) => {
    // emit() respeta los listeners de tabPress ya definidos en el navigator
    // (los que resetean el stack de Viajes/Mensajes/Perfil).
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  return (
    <View style={[styles.wrap, { backgroundColor: ui.bg, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={[styles.bar, { backgroundColor: barBg }]}>
        {state.routes.map((route, i) => {
          const isFocused = state.index === i;
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? route.name;

          if (route.name === CENTER_TAB) {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={() => onPress(route, isFocused)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={label}
                style={[styles.fab, { borderColor: barBg, opacity: isFocused ? 1 : 0.75 }]}
              >
                <Image source={RUMBO_AVATAR} style={styles.fabAvatar} />
              </TouchableOpacity>
            );
          }

          const [outline, solid] = ICONS[route.name] ?? ICONS.HomeTab;
          const showBadge = route.name === 'ChatsTab' && unreadCount > 0;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => onPress(route, isFocused)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={label}
              style={styles.tab}
            >
              <View style={[styles.iconSlot, isFocused && { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
                <Ionicons
                  name={isFocused ? solid : outline}
                  size={22}
                  color={isFocused ? activeFg : inactiveFg}
                />
                {showBadge && (
                  <View style={[styles.badge, { borderColor: barBg }]}>
                    <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Sin position:absolute a propósito: la barra sigue ocupando su lugar en el
  // layout, así ninguna lista queda tapada por debajo.
  // paddingTop >= lo que sobresale el FAB, o su parte de arriba queda fuera del
  // área pintada y se ve el contenido de la pantalla por detrás.
  // Sobresale 16: marginTop 20 menos los 4 que lo centran en la barra de 64.
  wrap:      { paddingHorizontal: 16, paddingTop: 22 },
  bar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', height: 64, borderRadius: 999, paddingHorizontal: 8 },
  tab:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconSlot:  { width: 46, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  fab:       { width: 56, height: 56, borderRadius: 999, marginTop: -20, backgroundColor: '#FFFFFF', borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  fabAvatar: { width: 40, height: 40, borderRadius: 999 },
  badge:     { position: 'absolute', top: 2, right: 4, minWidth: 17, height: 17, borderRadius: 999, borderWidth: 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontFamily: 'Sora_700Bold', fontSize: 9, color: '#000000' },
});

export default FloatingTabBar;
