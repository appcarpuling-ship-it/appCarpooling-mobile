import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../hooks/useColors';

const formatMoney = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const ROW_LABELS = {
  fuel: 'Combustible',
  food: 'Comida',
  other: 'Otros',
  driverPay: 'Extra conductor',
};

/** Total del viaje completado, tocable para desplegar el desglose */
const TripCostBreakdown = ({ trip }) => {
  const { colors } = useColors();
  const [open, setOpen] = useState(false);

  if (!trip?.actualCost) return null;

  const breakdown = trip.costBreakdown;
  // driverPay no vive dentro de costBreakdown sino suelto en el viaje, pero Trip.computeCost
  // lo suma al actualCost igual que los otros tres. Al no listarlo, el total no cerraba con
  // la suma de las filas y parecía un error de cálculo.
  const driverPay = Number(trip.driverPay) || 0;
  const rows = [
    { key: 'fuel', amount: Number(breakdown?.fuel) || 0 },
    { key: 'food', amount: Number(breakdown?.food) || 0 },
    { key: 'other', amount: Number(breakdown?.other) || 0 },
    { key: 'driverPay', amount: driverPay },
  ].filter(r => r.amount > 0);
  const hasBreakdown = rows.length > 0;

  return (
    <View>
      <TouchableOpacity
        style={styles.row}
        onPress={() => hasBreakdown && setOpen(o => !o)}
        activeOpacity={hasBreakdown ? 0.7 : 1}
      >
        <Text style={[styles.total, { color: colors.textPrimary }]}>
          Costo final: ${formatMoney(trip.actualCost)}
        </Text>
        {hasBreakdown && (
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
        )}
      </TouchableOpacity>

      {open && (
        <View style={[styles.details, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {rows.map(r => (
            <View key={r.key} style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{ROW_LABELS[r.key]}</Text>
              <Text style={[styles.detailValue, { color: colors.textSecondary }]}>${formatMoney(r.amount)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  total: {
    fontSize: 15,
    fontFamily: 'Sora_700Bold',
  },
  details: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 12,
    fontFamily: 'Sora_600SemiBold',
  },
});

export default TripCostBreakdown;
