import { useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Animated, Easing, View, Text } from 'react-native';
import { useUI } from '../theme/ui';

const TITLE = 'Carpuling';

/** Evita doble animación en React Strict Mode (remount). */
let splashAnimationConsumed = false;

/**
 * Entrada de marca: el logo aparece, las letras del nombre suben escalonadas y
 * una línea se abre debajo. Todo con opacidad y transform, que son las dos
 * propiedades que el driver nativo puede animar sin pasar por el hilo de JS.
 */
const AnimatedSplash = ({ onComplete, fontsLoaded }) => {
  const ui = useUI();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const logo = useRef(new Animated.Value(0)).current;
  const line = useRef(new Animated.Value(0)).current;
  const curtain = useRef(new Animated.Value(1)).current;

  // Un valor por letra: es lo que permite el escalonado.
  const letters = useMemo(
    () => TITLE.split('').map(() => new Animated.Value(0)),
    []
  );

  const LOGO_SOURCE = ui.isDarkMode
    ? require('../../assets/logo/192x192-white.png')
    : require('../../assets/logo/192x192-black.png');

  useEffect(() => {
    if (!fontsLoaded || splashAnimationConsumed) return;
    splashAnimationConsumed = true;

    const out = Easing.bezier(0.16, 1, 0.3, 1); // desacelera largo al final

    // Las letras arrancan con el logo todavía entrando y la línea se solapa con
    // las últimas: en serie la secuencia daba 2,8s, demasiado para un arranque.
    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(logo, {
          toValue: 1,
          duration: 520,
          easing: out,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(200),
          Animated.stagger(
            38,
            letters.map((v) =>
              Animated.timing(v, {
                toValue: 1,
                duration: 380,
                easing: out,
                useNativeDriver: true,
              })
            )
          ),
        ]),
        Animated.sequence([
          Animated.delay(620),
          Animated.timing(line, {
            toValue: 1,
            duration: 420,
            easing: out,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.delay(240),
      Animated.timing(curtain, {
        toValue: 0,
        duration: 380,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]);

    sequence.start(({ finished }) => {
      if (finished) onCompleteRef.current?.();
    });

    return () => sequence.stop();
  }, [fontsLoaded]);

  return (
    <Animated.View style={[styles.root, { backgroundColor: ui.bg, opacity: curtain }]}>
      <View style={styles.center}>
        <Animated.Image
          source={LOGO_SOURCE}
          style={[
            styles.logo,
            {
              opacity: logo,
              transform: [
                { scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
              ],
            },
          ]}
          resizeMode="contain"
        />

        <View style={styles.word}>
          {TITLE.split('').map((char, i) => (
            <Animated.Text
              key={`${char}-${i}`}
              style={[
                styles.letter,
                {
                  color: ui.text,
                  opacity: letters[i],
                  transform: [
                    {
                      translateY: letters[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [18, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {char}
            </Animated.Text>
          ))}
        </View>

        {/* scaleX desde el centro: la línea se abre hacia los dos lados */}
        <Animated.View
          style={[
            styles.line,
            { backgroundColor: ui.text, opacity: line, transform: [{ scaleX: line }] },
          ]}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 26,
  },
  word: {
    flexDirection: 'row',
  },
  letter: {
    fontFamily: 'Sora_300Light',
    fontSize: 32,
    letterSpacing: -0.5,
  },
  line: {
    width: 120,
    height: 1,
    marginTop: 18,
    opacity: 0.35,
  },
});

export default AnimatedSplash;
