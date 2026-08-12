import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';

/**
 * La calificación de una persona: estrella, promedio y cuántas reseñas lo respaldan.
 *
 * El contador importa tanto como el promedio. Un 5,0 con una sola reseña no es lo mismo que un
 * 4,8 con doscientas, y sin el número al lado las dos cosas se ven idénticas. Si nadie lo
 * calificó todavía se dice, en vez de mostrar el 5 por defecto que no puso nadie.
 */
const Rating = ({ rating, count, size = 14, style }) => {
  const ui = useUI();
  const total = Number(count) || 0;

  if (total === 0) {
    return (
      <Text style={[styles.vacio, { color: ui.textMuted, fontSize: size - 1 }, style]}>
        Sin calificaciones
      </Text>
    );
  }

  return (
    <View style={[styles.fila, style]}>
      <Ionicons name="star" size={size} color={ui.text} />
      <Text style={[styles.valor, { color: ui.text, fontSize: size }]}>
        {(Number(rating) || 0).toFixed(1).replace('.', ',')}
      </Text>
      <Text style={[styles.total, { color: ui.textMuted, fontSize: size - 1 }]}>
        ({total})
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  valor: { fontFamily: 'Sora_600SemiBold' },
  total: { fontFamily: 'Sora_400Regular' },
  vacio: { fontFamily: 'Sora_400Regular' },
});

export default Rating;
