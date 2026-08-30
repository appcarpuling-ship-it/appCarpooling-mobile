import { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Easing } from 'react-native';

/**
 * El nombre, no el isotipo. Es una IMAGEN y no un <Text> a propósito: ver el comentario del
 * componente. Se genera desde el mismo Sora_700Bold que usa la app (el .ttf de
 * @expo-google-fonts/sora), con el interletrado del logotipo ya aplicado y aire alrededor, así
 * que es el mismo tipo que el resto de la interfaz — sólo que rasterizado.
 */
const WORDMARK = require('../../assets/logo/wordmark-carpuling-white.png');

// El mismo negro que el splash nativo (`splash` en app.json: logo blanco sobre
// #000000). Antes esto salía del tema, o sea blanco sobre blanco en tema claro:
// como esta vista cubre el root de la app pero no las franjas de las barras del
// sistema, el splash nativo negro asomaba por los bordes y se veía "cortado en
// las puntas". Fijo y no del tema para que el paso de uno al otro no tenga
// costura en ningún modo.
const SPLASH_BG = '#000000';

/**
 * El nombre "Carpuling", al estilo del arranque de Uber: entra desde abajo, respira un
 * momento y se abre sobre la app.
 *
 * El texto va como IMAGEN, nunca como <Text>. Las versiones anteriores animaban la palabra
 * con la fuente y en Android salía con las puntas comidas: Android recorta el glifo contra su
 * caja de layout, y un peso grueso con interletrado negativo se sale de esa caja. Se parcheó
 * tres veces (padding con márgenes negativos, left/right negativos, y después un solo peso)
 * antes de pasar al isotipo. La imagen es el nombre de vuelta sin volver a ese bug: está
 * rasterizada desde el mismo Sora, así que no hay glifo que Android pueda recortar.
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
  // Guarda de esta instancia, no del módulo: antes era un `let` a nivel de módulo, y en Android
  // "cerrar la app" no siempre mata el proceso de verdad — si el motor de JS sigue vivo, esa
  // variable quedaba en `true` de la sesión anterior y la animación no volvía a correr nunca,
  // así que `onComplete` no se llamaba y el splash se quedaba tapando la app para siempre (sólo
  // desinstalar garantizaba un proceso nuevo). Un ref muere con el componente, no con el proceso.
  const yaCorrida = useRef(false);

  // Espera a las fuentes aunque acá no se use ninguna: App.js recién monta la app
  // con `fontsLoaded`, así que un splash que termina antes destaparía una pantalla vacía.
  useEffect(() => {
    if (!fontsLoaded || yaCorrida.current) return;
    yaCorrida.current = true;

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

  // El asset mide 725px de ancho y se dibuja a 232, así que ni siquiera a 1.2x se acerca a su
  // tamaño nativo: no se pixela al agrandarse.
  const scale = Animated.multiply(
    enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }),
    exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] })
  );

  // Sube unos pocos píxeles al entrar. Es lo que separa un fundido plano de algo que "llega":
  // corto (12px) para que se lea como un asentamiento y no como un deslizamiento.
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  return (
    <Animated.View style={[styles.root, { backgroundColor: SPLASH_BG, opacity: curtain }]}>
      <Animated.Image
        source={WORDMARK}
        resizeMode="contain"
        style={[styles.wordmark, { opacity: enter, transform: [{ scale }, { translateY }] }]}
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
  // Proporción del asset (725x197). El alto sale de ahí: forzar otro ratio lo deformaría, y
  // resizeMode contain dejaría aire raro a los costados.
  wordmark: {
    width: 232,
    height: 63,
  },
});

export default AnimatedSplash;
