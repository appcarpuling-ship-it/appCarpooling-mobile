import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useColors } from '../../hooks/useColors';

const num = (v) => parseFloat(v) || 0;
const formatMoney = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Modal compartida para completar un viaje con desglose de costos (usada en TripDetailScreen y MyTripsScreen) */
const CompleteTripCostModal = ({ visible, onClose, onSubmit, submitting }) => {
  const { colors } = useColors();
  const [fuel, setFuel] = useState('');
  const [food, setFood] = useState('');
  const [other, setOther] = useState('');
  const [driverPay, setDriverPay] = useState('');
  const [error, setError] = useState('');

  const total = num(fuel) + num(food) + num(other) + num(driverPay);

  const handleClose = () => {
    if (submitting) return;
    setFuel('');
    setFood('');
    setOther('');
    setDriverPay('');
    setError('');
    onClose();
  };

  const handleSubmit = () => {
    if (total <= 0) {
      setError('Ingresá al menos un costo válido');
      return;
    }
    setError('');
    onSubmit({ costBreakdown: { fuel: num(fuel), food: num(food), other: num(other) }, driverPay: num(driverPay) });
  };

  const fields = [
    { key: 'fuel', label: 'Combustible', value: fuel, set: setFuel, placeholder: 'Ej: 2000' },
    { key: 'food', label: 'Comida', value: food, set: setFood, placeholder: 'Ej: 1000' },
    { key: 'other', label: 'Otros gastos', value: other, set: setOther, placeholder: 'Ej: 500' },
    { key: 'driverPay', label: 'Extra conductor', value: driverPay, set: setDriverPay, placeholder: 'Ej: 1500' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Completar viaje</Text>
          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>Desglosá el costo final del viaje</Text>

          {fields.map(f => (
            <View key={f.key} style={styles.field}>
              <Text style={[styles.label, { color: colors.textTertiary }]}>{f.label}</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.inputBorder, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                placeholder={f.placeholder}
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
                value={f.value}
                onChangeText={(v) => { f.set(v); if (error) setError(''); }}
              />
            </View>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {total > 0 && (
            <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total</Text>
              <Text style={[styles.totalValue, { color: colors.textPrimary }]}>${formatMoney(total)}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btnSecondary, { borderColor: colors.border, opacity: submitting ? 0.5 : 1 }]}
              onPress={handleClose}
              disabled={submitting}
            >
              <Text style={[styles.btnSecondaryText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: colors.textPrimary, opacity: submitting ? 0.7 : 1 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator size="small" color={colors.background} />
                : <Text style={[styles.btnPrimaryText, { color: colors.background }]}>Completar</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 14,
  },
  field: {
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  error: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  btnPrimary: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default CompleteTripCostModal;
