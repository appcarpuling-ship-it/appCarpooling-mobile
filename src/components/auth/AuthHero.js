import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useUI } from '../../theme/ui';

const MAPA_CLARO = require('../../../assets/illustrations/auth-map-light.png');
const MAPA_OSCURO = require('../../../assets/illustrations/auth-map-dark.png');

/**
 * El fondo de las pantallas de acceso: un mapa abstracto con el recorrido de un viaje —
 * origen, dos paradas y destino, con el último tramo punteado, la misma lectura de "lo que
 * falta" que tiene el mapa del viaje real.
 *
 * Va como PNG y no como SVG en vivo porque `react-native-svg` es un módulo nativo: sumarlo
 * obligaría a un build de iOS y Android, y estas pantallas no podrían salir por OTA. El
 * dibujo se genera desde `.design-auth/render-hero.mjs`, que es donde se edita.
 *
 * `cover` y no `contain`: la imagen está armada con el recorrido centrado y los bordes
 * desvaneciéndose contra el fondo, así que recortarla a cualquier alto no corta el trazado.
 * Por eso cada pantalla puede pedir el alto que le sobre sin deformar nada.
 */
const AuthHero = ({ height = 240 }) => {
  const ui = useUI();
  return (
    <View style={[styles.wrap, { height, backgroundColor: ui.bg }]} pointerEvents="none">
      <Image
        source={ui.isDarkMode ? MAPA_OSCURO : MAPA_CLARO}
        style={styles.img}
        resizeMode="cover"
        // El fondo es decorativo: nombrarlo sólo agregaría ruido al lector de pantalla.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
});

export default AuthHero;
