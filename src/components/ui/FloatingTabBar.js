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

// Alto que ocupa la barra flotante (18 que sobresale el botón + 70 de la barra
// + separación de abajo). Las pantallas raíz lo usan como paddingBottom para
// que la última card se pueda scrollear por encima de la barra.
export const TAB_BAR_SPACE = 104;

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

  const centerIndex = state.routes.findIndex((r) => r.name === CENTER_TAB);
  const centerRoute = state.routes[centerIndex];
  const centerFocused = state.index === centerIndex;
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
      {/* paddingTop = lo que sobresale el botón, para que quede dentro de este
          contenedor: en Android lo que se dibuja fuera del padre no recibe toques. */}
      <View style={styles.barWrap}>
        <View style={[styles.bar, { backgroundColor: barBg }]}>
          {state.routes.map((route, i) => {
            const isFocused = state.index === i;
            const { options } = descriptors[route.key];
            const label = options.tabBarLabel ?? route.name;

            // El botón se dibuja fuera de la barra (abajo): acá solo se le
            // reserva el lugar en la fila.
            if (route.name === CENTER_TAB) {
              return <View key={route.key} style={styles.fabSpacer} />;
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
              {/* Sin fondo en el tab activo: Android lo dibujaba cuadrado por más
                  que el radio estuviera puesto. El estado activo ya se lee en el
                  ícono (relleno + blanco vs. contorno gris), el fondo sobraba. */}
              <View style={styles.iconSlot}>
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

        {/* El botón, fuera de la barra para que el recorte no lo tape */}
        <View pointerEvents="box-none" style={styles.fabLayer}>
          <TouchableOpacity
            onPress={() => onPress(centerRoute, centerFocused)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: centerFocused }}
            accessibilityLabel="Rumbo"
            // Opacidad siempre 1: al bajarla, la parte que sobresale de la barra
            // dejaba pasar el fondo. El estado activo lo marca el avatar.
            style={[styles.fab, { backgroundColor: fabBg }]}
          >
            <Image
              source={ui.isDarkMode ? RUMBO_BLACK : RUMBO_WHITE}
              style={styles.fabAvatar}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Flota sobre el contenido: si ocupara lugar en el layout, la franja del
  // fondo de la pantalla cortaba la última card. Las pantallas raíz dejan
  // TAB_BAR_SPACE de aire al final de sus listas.
  wrap:      { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  // paddingTop = lo que sobresale el botón (18)
  barWrap:   { paddingTop: 18 },
  // Sin overflow hidden: en Android el recorte redondeado del padre se come el
  // redondeo propio de los hijos y el fondo del tab activo salía cuadrado. Ya
  // no hay nada que recortar (la bajadita y el FAB viven fuera de la barra).
  bar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', height: 70, borderRadius: 999, paddingHorizontal: 8 },
  tab:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Solo posiciona el ícono y le da lugar al badge; ya no pinta nada.
  iconSlot:  { width: 46, height: 40, alignItems: 'center', justifyContent: 'center' },

  fabSpacer: { width: 54 },

  // top:0 de barWrap = 18px por encima del borde de la barra
  fabLayer:  { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  fab:       { width: 54, height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  fabAvatar:    { width: 34, height: 34, borderRadius: 999 },
  // Solo el avatar se atenúa; el círculo queda opaco para no dejar pasar el fondo
  badge:     { position: 'absolute', top: 2, right: 4, minWidth: 17, height: 17, borderRadius: 999, borderWidth: 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontFamily: 'Sora_700Bold', fontSize: 9, color: '#000000' },
});

export default FloatingTabBar;
