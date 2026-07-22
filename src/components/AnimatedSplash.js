import { useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Animated, Easing, View, Text } from 'react-native';
import { useUI } from '../theme/ui';

const TITLE = 'Carpuling';

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
  const ui = useUI();
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
    <Animated.View style={[styles.root, { backgroundColor: ui.bg, opacity: curtain }]}>
      <Animated.View style={[styles.word, { transform: [{ scale: wordScale }] }]}>
        {TITLE.split('').map((char, i) => {
          const v = letters[i];
          return (
            <View key={`${char}-${i}`} style={styles.slot}>
              {/* Light: se desvanece cuando la palabra se asienta */}
              <Animated.Text
                style={[
                  styles.letter,
                  styles.light,
                  {
                    color: ui.text,
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

              {/* ExtraBold: aparece encima, en el mismo lugar */}
              <Animated.Text
                style={[
                  styles.letter,
                  styles.bold,
                  { color: ui.text, opacity: settle },
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
  light: {
    fontFamily: 'Sora_300Light',
  },
  bold: {
    ...StyleSheet.absoluteFillObject,
    fontFamily: 'Sora_800ExtraBold',
    textAlign: 'center',
  },
});

export default AnimatedSplash;
