import { useRef } from 'react';
import React from 'react';
import { View, Animated, StyleSheet } from 'react-native';

/**
 * El pin del centro de un mapa en modo "elegir un punto".
 *
 * Vive acá porque lo usan las dos pantallas que dejan marcar en el mapa —el selector de
 * recogida/bajada de la reserva y el alta de viaje—, y antes cada una tenía su propio ícono
 * suelto con el mismo problema: estaba centrado en la MITAD de su caja, así que el punto que
 * se confirmaba quedaba unos 15px más arriba de donde apuntaba la punta. A escala de calle,
 * media cuadra entre lo que se veía y la dirección que se guardaba.
 *
 * Acá el ancla está en la punta: la caja mide 46 de alto y se sube 46, así que su borde
 * inferior cae exactamente en el centro del mapa.
 */
const MapCenterPin = ({ alzado }) => (
  <View style={styles.centerPin} pointerEvents="none">
    <Animated.View
      style={{
        alignItems: 'center',
        transform: [{ translateY: alzado.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }],
      }}
    >
      <View style={styles.cabeza}>
        <View style={styles.nucleo} />
      </View>
      <View style={styles.tallo} />
    </Animated.View>

    {/* La sombra se queda en el punto y se achica: es lo que da la sensación de que el pin se
        despegó y sigue marcando el mismo lugar. Si se moviera todo junto parecería que el
        punto se corrió. */}
    <Animated.View
      style={[
        styles.base,
        {
          opacity: alzado.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.16] }),
          transform: [{ scale: alzado.interpolate({ inputRange: [0, 1], outputRange: [1, 0.65] }) }],
        },
      ]}
    />
  </View>
);

/**
 * El valor animado y el disparador, para que la pantalla sólo tenga que avisar cuándo el
 * mapa se mueve y cuándo frena.
 *
 * El flag no es de más: onRegionChange dispara decenas de veces por segundo mientras se
 * arrastra, y sin él se lanzaría una animación nueva en cada frame.
 */
export const usePinAlzado = () => {
  const alzado = useRef(new Animated.Value(0)).current;
  const arriba = useRef(false);

  const levantarPin = (subir) => {
    if (arriba.current === subir) return;
    arriba.current = subir;
    Animated.spring(alzado, {
      toValue: subir ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 120,
    }).start();
  };

  return { alzado, levantarPin };
};

const styles = StyleSheet.create({
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -17,
    marginTop: -46,
    width: 34,
    height: 46,
    alignItems: 'center',
  },
  cabeza: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#010101',
    borderWidth: 3, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 5,
  },
  nucleo: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  tallo: { width: 3, height: 11, backgroundColor: '#010101', marginTop: -1 },
  base: { width: 10, height: 4, borderRadius: 5, backgroundColor: '#000000', marginTop: 1 },
});

export default MapCenterPin;
