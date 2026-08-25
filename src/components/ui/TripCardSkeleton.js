import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useUI } from '../../theme/ui';
import Skeleton from './Skeleton';

/** Una card placeholder, con la forma aproximada de una card de viaje/reserva. */
const TripCardSkeleton = () => {
  const ui = useUI();
  return (
    <View style={[styles.card, { backgroundColor: ui.card }]}>
      <Skeleton width={84} height={22} radius={11} style={{ marginBottom: 16 }} />
      <Skeleton width="72%" height={16} style={{ marginBottom: 10 }} />
      <Skeleton width="52%" height={16} style={{ marginBottom: 18 }} />
      <View style={styles.metaRow}>
        <Skeleton width={64} height={12} />
        <Skeleton width={48} height={12} />
        <Skeleton width={76} height={12} />
      </View>
    </View>
  );
};

/** Varias apiladas, para reemplazar el spinner centrado en la carga inicial. */
export const TripListSkeleton = ({ count = 4 }) => (
  <View style={styles.list}>
    {Array.from({ length: count }).map((_, i) => (
      <TripCardSkeleton key={i} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 24, padding: 18 },
  metaRow: { flexDirection: 'row', gap: 14 },
});

export default TripCardSkeleton;
