import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useUI } from '../../theme/ui';

/**
 * Bloque que pulsa entre dos opacidades en loop, para simular contenido cargando.
 * Un solo primitivo reusable: los skeletons de cada pantalla se arman apilando
 * varios de estos con el ancho/alto que haga falta.
 */
const Skeleton = ({ width = '100%', height = 14, radius = 8, style }) => {
  const ui = useUI();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: ui.border, opacity },
        style,
      ]}
    />
  );
};

export default Skeleton;
