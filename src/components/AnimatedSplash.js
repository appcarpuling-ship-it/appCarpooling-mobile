import { useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Animated, Easing, View } from 'react-native';

const TITLE = 'Carpuling';

// Los mismos colores que el splash nativo (`splash` en app.json: logo blanco
// sobre #000000). Antes esto usaba ui.bg/ui.text, o sea blanco sobre blanco en
// tema claro: como esta vista cubre el root de la app pero no las franjas de las
// barras del sistema, el splash nativo negro asomaba por los bordes y se veia
// "cortado en las puntas". Fijos y no del tema para que el paso de uno al otro
// no tenga costura en ningun modo.
const SPLASH_BG = '#000000';
const SPLASH_FG = '#FFFFFF';

/** Evita doble animación en React Strict Mode (remount). */
let splashAnimationConsumed = false;

/**
 * Solo tipografía. Cada letra entra por su cuenta —sube, se desenfoca de
 * escala y se endereza— y al final la palabra entera se asienta: el
 * interletrado se cierra y el peso pasa de Light a ExtraBold.
 * Todo con opacity y transform, que es lo que el driver nativo puede animar
 * sin cruzar al hilo de JS.
 */
const AnimatedSplash = ({ onComplete, fontsLoaded }) => {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Un valor por letra + uno para el asentado final de la palabra.
  const letters = useMemo(() => TITLE.split('').map(() => new Animated.Value(0)), []);
  const settle = useRef(new Animated.Value(0)).current;
  const curtain = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!fontsLoaded || splashAnimationConsumed) return;
    splashAnimationConsumed = true;

    const out = Easing.bezier(0.16, 1, 0.3, 1);

    const sequence = Animated.sequence([
      Animated.stagger(
        52,
        letters.map((v) =>
          Animated.timing(v, {
            toValue: 1,
            duration: 620,
            easing: out,
            useNativeDriver: true,
          })
        )
      ),
      Animated.timing(settle, {
        toValue: 1,
        duration: 620,
        easing: Easing.bezier(0.65, 0, 0.35, 1),
        useNativeDriver: true,
      }),
      Animated.delay(360),
      Animated.timing(curtain, {
        toValue: 0,
        duration: 420,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]);

    sequence.start(({ finished }) => finished && onCompleteRef.current?.());
    return () => sequence.stop();
  }, [fontsLoaded]);

  // La palabra se comprime al asentarse: arranca separada y cierra el espacio.
  const wordScale = settle.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] });

  return (
    <Animated.View style={[styles.root, { backgroundColor: SPLASH_BG, opacity: curtain }]}>
      <Animated.View style={[styles.word, { transform: [{ scale: wordScale }] }]}>
        {TITLE.split('').map((char, i) => {
          const v = letters[i];
          return (
            <View key={`${char}-${i}`} style={styles.slot}>
              {/* ExtraBold: es el que define el ancho de la ranura (es el más
                  ancho de los dos); si iba absoluto, Android le recortaba los
                  bordes contra el ancho de la Light. */}
              <Animated.Text
                style={[styles.letter, styles.bold, { color: SPLASH_FG, opacity: settle }]}
              >
                {char}
              </Animated.Text>

              {/* Light: encima, en el mismo lugar. Se desvanece al asentarse */}
              <Animated.Text
                style={[
                  styles.letter,
                  styles.light,
                  {
                    color: SPLASH_FG,
                    opacity: Animated.multiply(
                      v,
                      settle.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })
                    ),
                    transform: [
                      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.4, 1] }) },
                    ],
                  },
                ]}
              >
                {char}
              </Animated.Text>
            </View>
          );
        })}
      </Animated.View>
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
  word: {
    flexDirection: 'row',
  },
  // Cada letra ocupa su ranura y las dos versiones se superponen ahí,
  // así el cambio de peso no mueve nada de lugar.
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: 40,
    letterSpacing: -1,
  },
  // Aire a los costados en vez de absoluteFillObject: la ranura la mide la
  // ExtraBold y la Light se dibujaba con ESE ancho exacto. Android recorta los
  // glifos que se pasan de su caja de layout, y como la Light ademas entra con
  // scale 1.4, el recorte se veia agrandado: las letras salian con las puntas
  // comidas. Los -8 le dan lugar sin moverla de lugar (queda centrada igual).
  light: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -8,
    right: -8,
    fontFamily: 'Sora_300Light',
    textAlign: 'center',
  },
  // La ExtraBold es la que está en el flujo y mide la ranura, así que no puede
  // usar el truco de left/right negativos de la Light. El padding agranda la caja
  // donde Android dibuja el glifo y el margen negativo lo descuenta del layout:
  // queda en el mismo lugar y con el mismo interletrado, pero con aire a los
  // costados. Sin esto salía con las puntas comidas justo al asentarse, porque el
  // trazo grueso se pasa de una caja medida con letterSpacing negativo.
  bold: {
    fontFamily: 'Sora_800ExtraBold',
    paddingHorizontal: 6,
    marginHorizontal: -6,
  },
});

export default AnimatedSplash;
