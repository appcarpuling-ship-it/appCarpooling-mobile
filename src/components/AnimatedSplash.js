import { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Easing } from 'react-native';

const LOGO = require('../../assets/logo/192x192-white.png');

// El mismo negro que el splash nativo (`splash` en app.json: logo blanco sobre
// #000000). Antes esto salía del tema, o sea blanco sobre blanco en tema claro:
// como esta vista cubre el root de la app pero no las franjas de las barras del
// sistema, el splash nativo negro asomaba por los bordes y se veía "cortado en
// las puntas". Fijo y no del tema para que el paso de uno al otro no tenga
// costura en ningún modo.
const SPLASH_BG = '#000000';

/** Evita doble animación en React Strict Mode (remount). */
let splashAnimationConsumed = false;

/**
 * Solo el logo, al estilo del arranque de Uber: entra, respira un momento y se
 * abre sobre la app.
 *
 * No hay texto a propósito. Las versiones anteriores animaban la palabra
 * "Carpuling" y en Android salía con las puntas comidas: Android recorta el
 * glifo contra su caja de layout, y un peso grueso con interletrado negativo se
 * sale de esa caja. Se parcheó tres veces (padding con márgenes negativos,
 * left/right negativos, y después un solo peso) — con una imagen el problema no
 * existe, porque no hay glifo que recortar.
 *
 * Todo con opacity y transform, que es lo que el driver nativo puede animar sin
 * cruzar al hilo de JS.
 */
const AnimatedSplash = ({ onComplete, fontsLoaded }) => {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const enter = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const curtain = useRef(new Animated.Value(1)).current;

  // Espera a las fuentes aunque acá no se use ninguna: App.js recién monta la app
  // con `fontsLoaded`, así que un splash que termina antes destaparía una pantalla vacía.
  useEffect(() => {
    if (!fontsLoaded || splashAnimationConsumed) return;
    splashAnimationConsumed = true;

    const sequence = Animated.sequence([
      Animated.timing(enter, {
        toValue: 1,
        duration: 620,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.delay(380),
      // La salida: el logo crece y el negro se disuelve encima de la app. Da la
      // sensación de que el logo se abre, en vez de un fundido plano.
      Animated.parallel([
        Animated.timing(exit, {
          toValue: 1,
          duration: 480,
          easing: Easing.bezier(0.4, 0, 1, 1),
          useNativeDriver: true,
        }),
        Animated.timing(curtain, {
          toValue: 0,
          duration: 420,
          delay: 60,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ]),
    ]);

    sequence.start(({ finished }) => finished && onCompleteRef.current?.());
    return () => sequence.stop();
  }, [fontsLoaded]);

  // El asset mide 141x150 y se dibuja a 128, así que hasta 1.35x sigue por debajo
  // de su tamaño nativo y no se pixela al agrandarse.
  const scale = Animated.multiply(
    enter.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }),
    exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] })
  );

  return (
    <Animated.View style={[styles.root, { backgroundColor: SPLASH_BG, opacity: curtain }]}>
      <Animated.Image
        source={LOGO}
        resizeMode="contain"
        style={[styles.logo, { opacity: enter, transform: [{ scale }] }]}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 128,
    height: 128,
  },
});

export default AnimatedSplash;
