import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useUI } from '../../theme/ui';
import Skeleton, { useSkeletonPulse } from './Skeleton';

/** Una card placeholder, con la forma aproximada de una card de viaje/reserva. */
const TripCardSkeleton = ({ progress }) => {
  const ui = useUI();
  return (
    <View style={[styles.card, { backgroundColor: ui.card }]}>
      <Skeleton progress={progress} width={84} height={22} radius={11} style={{ marginBottom: 16 }} />
      <Skeleton progress={progress} width="72%" height={16} style={{ marginBottom: 10 }} />
      <Skeleton progress={progress} width="52%" height={16} style={{ marginBottom: 18 }} />
      <View style={styles.metaRow}>
        <Skeleton progress={progress} width={64} height={12} />
        <Skeleton progress={progress} width={48} height={12} />
        <Skeleton progress={progress} width={76} height={12} />
      </View>
    </View>
  );
};

/**
 * Varias apiladas, para reemplazar el spinner centrado en la carga inicial. Un solo
 * pulso compartido por todas las cards y sus barras (antes cada barra tenía su
 * propia animación nativa — con 4 cards de 6 barras cada una eran 24 corriendo a
 * la vez, y eso se multiplicaba por cada pantalla si se cambiaba de tab rápido).
 */
export const TripListSkeleton = ({ count = 4 }) => {
  const progress = useSkeletonPulse();
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <TripCardSkeleton key={i} progress={progress} />
      ))}
    </View>
  );
};

/**
 * Card placeholder con la forma de las cards de HomeScreen (avatar + nombre/fecha,
 * separador, bloque de ruta con dos renglones, footer) — más alta y con más partes
 * que TripCardSkeleton, que es la de Mis Viajes/Mis Reservas.
 */
export const HomeTripCardSkeleton = ({ progress }) => {
  const ui = useUI();
  return (
    <View style={[styles.homeCard, { backgroundColor: ui.card }]}>
      <View style={styles.homeDriverRow}>
        <Skeleton progress={progress} width={40} height={40} radius={20} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Skeleton progress={progress} width="55%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton progress={progress} width="40%" height={12} />
        </View>
      </View>
      <View style={[styles.homeDivider, { backgroundColor: ui.border }]} />
      <Skeleton progress={progress} width="35%" height={11} style={{ marginBottom: 6 }} />
      <Skeleton progress={progress} width="75%" height={15} style={{ marginBottom: 14 }} />
      <Skeleton progress={progress} width="35%" height={11} style={{ marginBottom: 6 }} />
      <Skeleton progress={progress} width="65%" height={15} />
    </View>
  );
};

export const HomeTripListSkeleton = ({ count = 2 }) => {
  const progress = useSkeletonPulse();
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <HomeTripCardSkeleton key={i} progress={progress} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 24, padding: 18 },
  metaRow: { flexDirection: 'row', gap: 14 },
  homeCard: { borderRadius: 24, padding: 16 },
  homeDriverRow: { flexDirection: 'row', alignItems: 'center' },
  homeDivider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
});

export default TripCardSkeleton;
