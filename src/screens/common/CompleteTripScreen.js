import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import PillButton from '../../components/ui/PillButton';

const num = (v) => parseFloat(v) || 0;
const formatMoney = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Completar viaje como pantalla (antes era CompleteTripCostModal). El caller
// pasa onSubmit(data) que hace el PUT y devuelve { ok, message }. En éxito se
// reemplaza por la pantalla Result con la imagen; en error se muestra inline.
const CompleteTripScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const { onSubmit } = route.params || {};

  const [fuel, setFuel] = useState('');
  const [food, setFood] = useState('');
  const [other, setOther] = useState('');
  const [driverPay, setDriverPay] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const total = num(fuel) + num(food) + num(other) + num(driverPay);

  const fields = [
    { key: 'fuel', label: 'Combustible', value: fuel, set: setFuel, placeholder: 'Ej: 2000' },
    { key: 'food', label: 'Comida', value: food, set: setFood, placeholder: 'Ej: 1000' },
    { key: 'other', label: 'Otros gastos', value: other, set: setOther, placeholder: 'Ej: 500' },
    { key: 'driverPay', label: 'Extra conductor', value: driverPay, set: setDriverPay, placeholder: 'Ej: 1500' },
  ];

  const handleSubmit = async () => {
    if (total <= 0) { setError('Ingresá al menos un costo válido'); return; }
    setError('');
    setSubmitting(true);
    const res = await onSubmit?.({ costBreakdown: { fuel: num(fuel), food: num(food), other: num(other) }, driverPay: num(driverPay) });
    setSubmitting(false);
    if (res?.ok) {
      navigation.replace('Result', { type: 'success', title: 'Viaje completado', message: res.message });
    } else {
      setError(res?.message || 'No se pudo completar el viaje');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { backgroundColor: ui.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={[styles.headerBtn, { backgroundColor: ui.surface }]}>
            <Ionicons name="arrow-back" size={20} color={ui.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: ui.text }]}>Completar viaje</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={[styles.subtitle, { color: ui.textMuted }]}>Desglosá el costo final del viaje</Text>

          {fields.map((f) => (
            <View key={f.key} style={styles.field}>
              <Text style={[styles.label, { color: ui.textMuted }]}>{f.label}</Text>
              <TextInput
                style={[styles.input, { borderColor: ui.border, color: ui.text, backgroundColor: ui.surface }]}
                placeholder={f.placeholder}
                placeholderTextColor={ui.textMuted}
                keyboardType="decimal-pad"
                value={f.value}
                onChangeText={(v) => { f.set(v); if (error) setError(''); }}
              />
            </View>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {total > 0 && (
            <View style={[styles.totalRow, { borderTopColor: ui.border }]}>
              <Text style={[styles.totalLabel, { color: ui.textMuted }]}>Total</Text>
              <Text style={[styles.totalValue, { color: ui.text }]}>${formatMoney(total)}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <PillButton label="Completar viaje" onPress={handleSubmit} loading={submitting} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  headerBtn: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: 'Sora_700Bold', fontSize: 20, letterSpacing: -0.5, textAlign: 'center' },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  subtitle: { fontSize: 14, fontFamily: 'Sora_400Regular', marginBottom: 20 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontFamily: 'Sora_600SemiBold', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Sora_400Regular' },
  error: { color: '#EF4444', fontSize: 13, marginTop: 2, marginBottom: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, marginTop: 8 },
  totalLabel: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
  totalValue: { fontSize: 20, fontFamily: 'Sora_800ExtraBold' },
  footer: { paddingHorizontal: 24, paddingTop: 8 },
});

export default CompleteTripScreen;
