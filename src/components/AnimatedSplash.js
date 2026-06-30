import { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Easing, View } from 'react-native';
import useColors from '../hooks/useColors';

const TITLE = 'Carpuling';

/** Evita doble animación en React Strict Mode (remount). */
let splashAnimationConsumed = false;

/**
 * Splash mínimo: mismo fondo que la app, logo + marca, solo fades suaves.
 */
const AnimatedSplash = ({ onComplete, fontsLoaded }) => {
  const { colors, fontFamily, isDarkMode } = useColors();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const curtainOpacity = useRef(new Animated.Value(1)).current;

  const LOGO_SOURCE = isDarkMode
    ? require('../../assets/logo/192x192-white.png')
    : require('../../assets/logo/192x192-black.png');

  useEffect(() => {
    if (!fontsLoaded || splashAnimationConsumed) return;
    splashAnimationConsumed = true;

    const out = Easing.bezier(0.33, 1, 0.68, 1);

    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 560,
          easing: out,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(180),
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 480,
            easing: out,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.delay(640),
      Animated.timing(curtainOpacity, {
        toValue: 0,
        duration: 340,
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
    <Animated.View style={[styles.root, { backgroundColor: colors.background, opacity: curtainOpacity }]}>
      <View style={styles.center}>
        <Animated.Image
          source={LOGO_SOURCE}
          style={[styles.logo, { opacity: logoOpacity }]}
          resizeMode="contain"
        />

        {/* <Animated.Text
          style={[
            styles.wordmark,
            {
              color: colors.textPrimary,
              opacity: textOpacity,
              fontFamily: fontFamily.medium,
            },
          ]}
        >
          {TITLE}
        </Animated.Text> */}
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
    gap: 20,
  },
  logo: {
    width: 64,
    height: 64,
  },
  wordmark: {
    fontSize: 22,
    letterSpacing: 1.2,
  },
});

export default AnimatedSplash;
