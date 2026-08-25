import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useUI } from '../../theme/ui';

/**
 * Un solo valor animado compartible entre varios Skeleton. Sin esto, una lista de
 * varias cards (cada una con varias barras) terminaba con decenas de animaciones
 * nativas corriendo a la vez — con varias pantallas cambiando rápido eso suma
 * rápido. Un valor por lista alcanza: todas las barras pulsan igual de todos modos.
 */
export const useSkeletonPulse = () => {
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

  return opacity;
};

/**
 * Bloque que pulsa entre dos opacidades, para simular contenido cargando.
 * `progress`: un valor de useSkeletonPulse ya corriendo, para compartir entre
 * varios bloques (una lista de cards, por ejemplo). Sin ese prop, crea el suyo
 * propio — para el caso de un Skeleton suelto, sin lista alrededor.
 */
const Skeleton = ({ width = '100%', height = 14, radius = 8, progress, style }) => {
  const ui = useUI();
  const ownPulse = useRef(new Animated.Value(0.4)).current;
  const anim = progress || ownPulse;

  useEffect(() => {
    if (progress) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ownPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(ownPulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, ownPulse]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: ui.border, opacity: anim },
        style,
      ]}
    />
  );
};

export default Skeleton;
