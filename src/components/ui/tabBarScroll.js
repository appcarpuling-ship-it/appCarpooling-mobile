import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Ocultar la barra flotante al scrollear hacia abajo y traerla de vuelta al scrollear hacia
 * arriba, como en Twitter/Instagram.
 *
 * El estado vive a nivel de módulo (un solo `Animated.Value` para toda la app) porque hay una
 * sola barra y varias pantallas que la controlan. `0` = visible, `1` = escondida abajo;
 * FloatingTabBar interpola eso a un translateY + opacity.
 *
 * Cada pantalla raíz de tab:
 *   const onScroll = useTabBarScroll();
 *   <FlatList onScroll={onScroll} scrollEventThrottle={16} ... />
 *
 * El hook además la vuelve a mostrar cada vez que la pantalla toma foco (volver de un detalle,
 * cambiar de tab): sin eso, entrabas escondida a una pantalla donde no habías scrolleado.
 */
export const tabBarHidden = new Animated.Value(0);

let animacion = null;
const mover = (hacia) => {
  animacion?.stop();
  animacion = Animated.timing(tabBarHidden, {
    toValue: hacia,
    duration: 200,
    useNativeDriver: true,
  });
  animacion.start();
};

export const mostrarTabBar = () => mover(0);
export const ocultarTabBar = () => mover(1);

// Umbrales: no reaccionar a micro-movimientos del dedo, y no esconder si estás cerca del tope
// (ahí no molesta y esconderla se siente errático).
const DELTA_MIN = 8;
const Y_MIN_PARA_OCULTAR = 60;

export function useTabBarScroll() {
  const ultimaY = useRef(0);

  useFocusEffect(
    useCallback(() => {
      mostrarTabBar();
      ultimaY.current = 0;
    }, [])
  );

  return useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - ultimaY.current;
    ultimaY.current = y;

    if (y <= 0) { mostrarTabBar(); return; }
    if (dy > DELTA_MIN && y > Y_MIN_PARA_OCULTAR) ocultarTabBar();
    else if (dy < -DELTA_MIN) mostrarTabBar();
  }, []);
}
