import React, { useRef, useEffect, useCallback } from 'react';
import { View, Animated, PanResponder, StyleSheet, Dimensions } from 'react-native';

const { height: SCREEN_H } = Dimensions.get('window');

/**
 * Bottom sheet arrastrable con altura variable, estilo Uber: un peek chico siempre visible,
 * un punto medio con el resumen del viaje, y uno expandido con todo.
 *
 * Deliberadamente NO usa @gorhom/bottom-sheet ni reanimated: los dos son módulos nativos y
 * agregarlos ahora habría obligado a un build para algo que se puede resolver con
 * `Animated` + `PanResponder`, que ya vienen en React Native y salen por OTA.
 *
 * @param {number[]} snapPoints  Alturas en px, de menor a mayor. Ej: [PEEK, MID, FULL].
 * @param {number} [initialIndex=1]
 * @param {(index:number, heightPx:number) => void} [onSnapChange]
 * @param {React.ReactNode} header  Fijo arriba del scroll; acá va el handle y arrastra.
 * @param {React.ReactNode} children  Contenido scrolleable.
 */
const DraggableSheet = ({ snapPoints, initialIndex = 1, onSnapChange, header, children, style, contentContainerStyle }) => {
  const min = snapPoints[0];
  const max = snapPoints[snapPoints.length - 1];

  const heightAnim = useRef(new Animated.Value(snapPoints[initialIndex])).current;
  // Punto de partida del gesto: Animated.Value no se puede leer de forma síncrona, así que
  // se congela acá al empezar a arrastrar y todo el gesto se calcula contra ese número.
  const startHeightRef = useRef(snapPoints[initialIndex]);
  const indexRef = useRef(initialIndex);
  // Cuánto scrolleó el contenido, para decidir si un arrastre hacia abajo tiene que
  // colapsar el sheet o dejarle scrollear al ScrollView (ver contentPanResponder).
  const scrollYRef = useRef(0);

  const clamp = (v) => Math.max(min, Math.min(max, v));

  const nearestSnapIndex = (heightPx, velocityY) => {
    // Un envión rápido gana aunque el dedo no haya llegado al punto: es lo que hace que un
    // "flick" chico alcance para abrir o cerrar del todo, en vez de tener que arrastrar
    // literalmente hasta el final.
    if (velocityY < -0.6) return Math.min(indexRef.current + 1, snapPoints.length - 1);
    if (velocityY > 0.6) return Math.max(indexRef.current - 1, 0);
    let best = 0;
    let bestDist = Infinity;
    snapPoints.forEach((p, i) => {
      const d = Math.abs(p - heightPx);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  };

  const animateToIndex = useCallback((index) => {
    indexRef.current = index;
    Animated.spring(heightAnim, {
      toValue: snapPoints[index],
      useNativeDriver: false, // la altura no la puede animar el hilo nativo
      bounciness: 4,
      speed: 14,
    }).start();
    onSnapChange?.(index, snapPoints[index]);
  }, [heightAnim, snapPoints, onSnapChange]);

  useEffect(() => { onSnapChange?.(initialIndex, snapPoints[initialIndex]); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // El arrastre en sí: lo comparten el handle (arriba) y el contenido (ver más abajo), para
  // que "seguir arrastrando dentro del contenido" mueva el sheet exactamente igual que
  // arrastrar el handle — sin esto había que soltar y buscar el handle con el dedo.
  const onGrant = () => { heightAnim.stopAnimation((val) => { startHeightRef.current = val; }); };
  const onMove = (_, g) => { heightAnim.setValue(clamp(startHeightRef.current - g.dy)); };
  const onRelease = (_, g) => {
    animateToIndex(nearestSnapIndex(clamp(startHeightRef.current - g.dy), g.vy));
  };

  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: onGrant,
      onPanResponderMove: onMove,
      onPanResponderRelease: onRelease,
    })
  ).current;

  /**
   * Mismo arrastre, pero decidiendo cuándo robárselo al ScrollView en vez de dejarlo
   * scrollear:
   *
   *   - Si el sheet NO está expandido del todo: cualquier arrastre vertical lo mueve.
   *     Es lo que hace que "seguir bajando el dedo" dentro del contenido, estando en el
   *     punto medio, siga agrandando el sheet en vez de quedarse pegado ahí sin hacer nada.
   *   - Si YA está expandido del todo: se le deja el gesto al ScrollView (que scrollee el
   *     contenido con normalidad) EXCEPTO cuando el contenido ya está en el tope
   *     (`scrollYRef.current <= 0`) y se sigue arrastrando hacia ABAJO — ahí es donde
   *     "seguir bajando" tiene que colapsar el sheet, no quedarse sin efecto.
   */
  const contentPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) => {
        if (Math.abs(g.dy) < 6) return false;
        const expandidoDelTodo = indexRef.current === snapPoints.length - 1;
        if (!expandidoDelTodo) return true;
        return scrollYRef.current <= 0 && g.dy > 0;
      },
      onPanResponderGrant: onGrant,
      onPanResponderMove: onMove,
      onPanResponderRelease: onRelease,
    })
  ).current;

  return (
    <Animated.View style={[styles.sheet, style, { height: heightAnim }]}>
      <View {...handlePanResponder.panHandlers}>
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
        {header}
      </View>
      <View style={styles.body} {...contentPanResponder.panHandlers}>
        <Animated.ScrollView
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEventThrottle={16}
          onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
        >
          {children}
        </Animated.ScrollView>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },
  handleWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(128,128,128,0.4)' },
  body: { flex: 1 },
});

export const SCREEN_HEIGHT = SCREEN_H;
export default DraggableSheet;
