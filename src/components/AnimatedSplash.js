import { useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Animated, Easing } from 'react-native';

const TITLE = 'Carpuling';
const LOGO = require('../../assets/logo/192x192-white.png');

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
 * El logo aterriza, la palabra sube letra por letra, y al final todo se abre
 * hacia afuera mientras el negro se disuelve sobre la app.
 *
 * La versión anterior cruzaba dos pesos de la misma letra (Light -> ExtraBold)
 * superpuestos en una ranura. Eso se veía recortado en Android y no había forma
 * limpia de arreglarlo: Android corta el glifo contra su caja de layout, la caja
 * la medía la ExtraBold con `letterSpacing` negativo, y la Light entraba encima
 * con `scale: 1.4`. Dos rondas de parches (padding + márgenes negativos, left/right
 * negativos) lo escondieron a medias. Acá directamente no existe el problema: un
 * solo peso, sin escala sobre el texto y sin interletrado negativo.
 *
 * Todo con opacity y transform, que es lo que el driver nativo puede animar sin
 * cruzar al hilo de JS.
 */
const AnimatedSplash = ({ onComplete, fontsLoaded }) => {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const logoIn = useRef(new Animated.Value(0)).current;
  const letters = useMemo(() => TITLE.split('').map(() => new Animated.Value(0)), []);
  const exit = useRef(new Animated.Value(0)).current;
  const curtain = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!fontsLoaded || splashAnimationConsumed) return;
    splashAnimationConsumed = true;

    const out = Easing.bezier(0.16, 1, 0.3, 1);

    const sequence = Animated.sequence([
      // El logo y la palabra se pisan a propósito: arrancar la palabra recién
      // al terminar el logo hacía toda la intro demasiado larga para un splash.
      Animated.parallel([
        Animated.timing(logoIn, {
          toValue: 1,
          duration: 700,
          easing: out,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(280),
          Animated.stagger(
            42,
            letters.map((v) =>
              Animated.timing(v, {
                toValue: 1,
                duration: 460,
                easing: out,
                useNativeDriver: true,
              })
            )
          ),
        ]),
      ]),
      Animated.delay(420),
      // La salida: el conjunto crece y el negro se va. Da la sensación de que el
      // logo se abre y deja ver la app, en vez de un simple fundido.
      Animated.parallel([
        Animated.timing(exit, {
          toValue: 1,
          duration: 520,
          easing: Easing.bezier(0.4, 0, 1, 1),
          useNativeDriver: true,
        }),
        Animated.timing(curtain, {
          toValue: 0,
          duration: 460,
          delay: 60,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ]),
    ]);

    sequence.start(({ finished }) => finished && onCompleteRef.current?.());
    return () => sequence.stop();
  }, [fontsLoaded]);

  // 1.45 y no más: el asset mide 141x150 y se dibuja a 112, así que hasta ahí
  // sigue por debajo de su tamaño nativo y no se pixela al agrandarse.
  const exitScale = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const logoScale = logoIn.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });

  return (
    <Animated.View style={[styles.root, { backgroundColor: SPLASH_BG, opacity: curtain }]}>
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: exitScale }] }}>
        <Animated.Image
          source={LOGO}
          resizeMode="contain"
          style={[styles.logo, { opacity: logoIn, transform: [{ scale: logoScale }] }]}
        />

        <Animated.View style={styles.word}>
          {TITLE.split('').map((char, i) => (
            <Animated.Text
              key={`${char}-${i}`}
              style={[
                styles.letter,
                {
                  color: SPLASH_FG,
                  opacity: letters[i],
                  transform: [
                    {
                      translateY: letters[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [16, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {char}
            </Animated.Text>
          ))}
        </Animated.View>
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
  logo: {
    width: 112,
    height: 112,
  },
  word: {
    flexDirection: 'row',
    marginTop: 22,
  },
  letter: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 26,
    // Sin interletrado negativo: con un peso grueso, eso mete el trazo fuera de
    // la caja de layout y Android lo recorta. Es lo que comía las puntas antes.
    letterSpacing: 0.5,
  },
});

export default AnimatedSplash;
