import { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Easing } from 'react-native';

const AnimatedSplash = ({ onComplete, fontsLoaded }) => {
  const logoOpacity    = useRef(new Animated.Value(0)).current;
  const logoScale      = useRef(new Animated.Value(0.88)).current;
  const nameOpacity    = useRef(new Animated.Value(0)).current;
  const nameTranslateY = useRef(new Animated.Value(12)).current;
  const exitOpacity    = useRef(new Animated.Value(1)).current;
  const exitScale      = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!fontsLoaded) return;

    Animated.sequence([
      // Fase 1 — logo entra suave
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 70,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),

      // Fase 2 — nombre sube
      Animated.parallel([
        Animated.timing(nameOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(nameTranslateY, {
          toValue: 0,
          duration: 340,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      // Pausa
      Animated.delay(1300),

      // Fase 3 — salida: zoom leve + fade
      Animated.parallel([
        Animated.timing(exitOpacity, {
          toValue: 0,
          duration: 420,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(exitScale, {
          toValue: 1.07,
          duration: 440,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => onComplete?.());
  }, [fontsLoaded]);

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: exitOpacity, transform: [{ scale: exitScale }] },
      ]}
    >
      <Animated.Image
        source={require('../../assets/logo/192x192-white.png')}
        style={[
          styles.logo,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
        resizeMode="contain"
      />
      <Animated.Text
        style={[
          styles.name,
          { opacity: nameOpacity, transform: [{ translateY: nameTranslateY }] },
        ]}
      >
        Carpuling
      </Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  name: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});

export default AnimatedSplash;
