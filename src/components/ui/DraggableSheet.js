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
 * Sólo el `header` arrastra el sheet (ver el comentario sobre por qué el body no). El resto
 * del contenido va en un ScrollView normal.
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        heightAnim.stopAnimation((val) => { startHeightRef.current = val; });
      },
      onPanResponderMove: (_, g) => {
        // Arrastrar hacia arriba (dy negativo) agranda el sheet.
        heightAnim.setValue(clamp(startHeightRef.current - g.dy));
      },
      onPanResponderRelease: (_, g) => {
        const finalHeight = clamp(startHeightRef.current - g.dy);
        animateToIndex(nearestSnapIndex(finalHeight, g.vy));
      },
    })
  ).current;

  return (
    <Animated.View style={[styles.sheet, style, { height: heightAnim }]}>
      <View {...panResponder.panHandlers}>
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
        {header}
      </View>
      <Animated.ScrollView
        style={styles.body}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        // El sheet arranca en un punto medio, no en el más chico: si el usuario ya ve
        // contenido, que pueda scrollearlo sin tener que arrastrar el sheet primero.
        bounces={false}
      >
        {children}
      </Animated.ScrollView>
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
