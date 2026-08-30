import { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';

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

// Medidas del wordmark en pantalla. La proporción es la del asset (725x197): forzar otra lo
// deformaría. Las tapas se derivan de acá, así que cambiando el ancho no hay que tocar nada más.
const MARK_W = 232;
const MARK_H = 63;

/**
 * Cada tapa cubre su mitad del nombre con unos píxeles de más: se solapan en el centro para que
 * ningún redondeo de subpíxel deje una hendija por la que se asome una letra antes de tiempo.
 * Como son del mismo negro que el fondo, ni el solape ni el viaje hacia afuera se ven.
 */
const TAPA_W = MARK_W / 2 + 66;

/**
 * El pin cae al centro y el golpe abre el nombre hacia los dos lados.
 *
 * El texto va como IMAGEN, nunca como <Text>. Las versiones anteriores animaban la palabra
 * con la fuente y en Android salía con las puntas comidas: Android recorta el glifo contra su
 * caja de layout, y un peso grueso con interletrado negativo se sale de esa caja. Se parcheó
 * tres veces (padding con márgenes negativos, left/right negativos, y después un solo peso)
 * antes de pasar al isotipo. La imagen es el nombre de vuelta sin volver a ese bug: está
 * rasterizada desde el mismo Sora, así que no hay glifo que Android pueda recortar.
 *
 * El nombre está visible desde el primer frame y son las dos tapas negras las que lo esconden.
 * Es más barato que animarle la opacidad y no puede quedar a medio revelar si algo se traba:
 * el peor caso es que las tapas no se muevan y el splash se funda con el nombre ya tapado.
 *
 * Todo con opacity y transform, que es lo que el driver nativo puede animar sin
 * cruzar al hilo de JS. Sin overflow hidden a propósito: todo pasa sobre el mismo negro, así
 * que recortar no cambiaría nada de lo que se ve y sí cuesta una capa más en Android.
 */
const AnimatedSplash = ({ onComplete, fontsLoaded }) => {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const caida = useRef(new Animated.Value(0)).current;   // el pin bajando
  const golpe = useRef(new Animated.Value(0)).current;   // el anillo del impacto
  const abrir = useRef(new Animated.Value(0)).current;   // las tapas separándose
  const curtain = useRef(new Animated.Value(1)).current; // el fundido final sobre la app
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
      Animated.delay(100),
      // La caída acelera hasta el final en vez de frenar: es lo que la lee como una caída y no
      // como un elemento que entra deslizándose.
      Animated.timing(caida, {
        toValue: 1,
        duration: 480,
        easing: Easing.bezier(0.5, 0, 0.75, 0),
        useNativeDriver: true,
      }),
      // El impacto y la apertura arrancan juntos: el anillo es la consecuencia del golpe, y si
      // esperara a terminar, el nombre saldría después de que la onda ya se apagó.
      Animated.parallel([
        Animated.timing(golpe, {
          toValue: 1,
          duration: 520,
          easing: Easing.bezier(0.2, 0.7, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(abrir, {
          toValue: 1,
          duration: 700,
          easing: Easing.bezier(0.72, 0, 0.22, 1),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(220),
      Animated.timing(curtain, {
        toValue: 0,
        duration: 400,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]);

    sequence.start(({ finished }) => finished && onCompleteRef.current?.());
    return () => sequence.stop();
  }, [fontsLoaded]);

  // Arranca fuera de la pantalla y termina en el centro exacto del nombre.
  const pinY = caida.interpolate({ inputRange: [0, 1], outputRange: [-160, 0] });
  // Aparece recién sobre el final del primer tramo: entrar ya visible desde arriba del todo lo
  // haría ver como un objeto que estaba esperando, no como algo que llega.
  const pinOpacity = Animated.multiply(
    caida.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
    // Y se apaga apenas toca: a partir de ahí lo que sigue es el anillo.
    golpe.interpolate({ inputRange: [0, 0.45], outputRange: [1, 0], extrapolate: 'clamp' })
  );
  const pinScale = golpe.interpolate({ inputRange: [0, 0.45], outputRange: [1, 0.3], extrapolate: 'clamp' });

  // La onda: crece y se desvanece. Es lo único que dura más que el propio impacto.
  const anilloScale = golpe.interpolate({ inputRange: [0, 1], outputRange: [0.2, 2.6] });
  const anilloOpacity = golpe.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0] });

  const tapaIzq = abrir.interpolate({ inputRange: [0, 1], outputRange: [0, -TAPA_W] });
  const tapaDer = abrir.interpolate({ inputRange: [0, 1], outputRange: [0, TAPA_W] });

  return (
    <Animated.View style={[styles.root, { backgroundColor: SPLASH_BG, opacity: curtain }]}>
      <View style={styles.markWrap}>
        <Animated.Image source={WORDMARK} resizeMode="contain" style={styles.wordmark} />
        <Animated.View
          style={[styles.tapa, styles.tapaIzq, { transform: [{ translateX: tapaIzq }] }]}
        />
        <Animated.View
          style={[styles.tapa, styles.tapaDer, { transform: [{ translateX: tapaDer }] }]}
        />
      </View>

      {/* El pin y la onda van fuera de markWrap: si fueran hijos, las tapas los taparían. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.pin, { opacity: pinOpacity, transform: [{ translateY: pinY }, { scale: pinScale }] }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.anillo, { opacity: anilloOpacity, transform: [{ scale: anilloScale }] }]}
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
  markWrap: {
    width: MARK_W,
    height: MARK_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    width: MARK_W,
    height: MARK_H,
  },
  // Alto de sobra arriba y abajo: el asset tiene aire propio y el nombre no llega a los bordes
  // de su caja, así que una tapa a ras dejaría asomar la 'p' y la 'g'.
  tapa: {
    position: 'absolute',
    top: -24,
    bottom: -24,
    width: TAPA_W,
    backgroundColor: SPLASH_BG,
  },
  tapaIzq: { right: MARK_W / 2 - 2 },
  tapaDer: { left: MARK_W / 2 - 2 },
  pin: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  anillo: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

export default AnimatedSplash;
