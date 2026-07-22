import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUI } from '../../theme/ui';

// El logo va al revés que el relleno del botón: relleno negro -> logo blanco.
const RUMBO_WHITE = require('../../../assets/agent/rumbo_128.png');
const RUMBO_BLACK = require('../../../assets/agent/rumbo_black_128.png');

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

  // El botón tiene que distinguirse de la barra Y de la página, y el único
  // recurso en blanco y negro es el tono intermedio. En claro la página es
  // blanca y la barra casi negra, así que va un gris oscuro; en oscuro las dos
  // son oscuras, así que el que se despega es el blanco.
  const fabBg = ui.isDarkMode ? '#FFFFFF' : '#636363';
  const activeFg = '#FFFFFF';
  const inactiveFg = '#8A8A8E';

  const onPress = (route, isFocused) => {
    // emit() respeta los listeners de tabPress ya definidos en el navigator
    // (los que resetean el stack de Viajes/Mensajes/Perfil).
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  return (
    // Sin fondo propio: se ve el de la pantalla. Pintarlo agregaba una banda
    // blanca cuando la pantalla de atrás no era blanca.
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={[styles.bar, { backgroundColor: barBg }]}>
        {state.routes.map((route, i) => {
          const isFocused = state.index === i;
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? route.name;

          if (route.name === CENTER_TAB) {
            return (
              <View key={route.key} style={styles.fabSlot}>
                {/* La "bajadita" de la referencia: un círculo del color del
                    fondo, más grande que el botón, que recorta la barra. Medido
                    sobre la captura, el borde describe un arco de círculo. */}
                <View
                  pointerEvents="none"
                  style={[styles.fabCutout, { backgroundColor: ui.bg }]}
                />
                <TouchableOpacity
                  onPress={() => onPress(route, isFocused)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isFocused }}
                  accessibilityLabel={label}
                  // Opacidad siempre 1: al bajarla, la mitad que sobresale de la
                  // barra dejaba pasar el fondo y se veía descolorida. El estado
                  // activo lo marca el avatar.
                  style={[styles.fab, { backgroundColor: fabBg }]}
                >
                  <Image
                    source={ui.isDarkMode ? RUMBO_BLACK : RUMBO_WHITE}
                    style={[styles.fabAvatar, !isFocused && styles.fabAvatarOff]}
                  />
                </TouchableOpacity>
              </View>
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
  // Proporciones tomadas de la captura de referencia: el botón sobresale ~58%
  // de su alto sobre la barra y la bajadita baja otro tanto.
  wrap:      { paddingHorizontal: 16, paddingTop: 32 },
  bar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', height: 70, borderRadius: 999, paddingHorizontal: 8 },
  tab:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconSlot:  { width: 46, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },

  // marginTop deja el botón 27px por encima del borde de la barra
  fabSlot:   { alignItems: 'center', justifyContent: 'center', marginTop: -70 },
  fabCutout: { position: 'absolute', width: 68, height: 68, borderRadius: 999, top: -7, left: -7 },
  fab:       { width: 54, height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  fabAvatar:    { width: 34, height: 34, borderRadius: 999 },
  // Solo el avatar se atenúa; el círculo queda opaco para no dejar pasar el fondo
  fabAvatarOff: { opacity: 0.55 },
  badge:     { position: 'absolute', top: 2, right: 4, minWidth: 17, height: 17, borderRadius: 999, borderWidth: 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontFamily: 'Sora_700Bold', fontSize: 9, color: '#000000' },
});

export default FloatingTabBar;
