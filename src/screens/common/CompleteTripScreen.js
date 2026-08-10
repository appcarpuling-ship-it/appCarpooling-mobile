import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import PillButton from '../../components/ui/PillButton';
import { get_withauth } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';

// Si el server no contesta, el tope se muestra con este valor: es el mismo default que tiene
// parametrosService. La app sólo lo muestra — quien decide y rechaza es siempre el server.
const DEFAULT_MAX_EXTRA_PCT = 15;

const formatMoney = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
// El input muestra el número con separador de miles; num() lo lee sacando los puntos.
const num = (v) => parseFloat(String(v).replace(/\./g, '')) || 0;
const formatInput = (v) => {
  const digits = String(v).replace(/\D/g, '');
  return digits ? formatMoney(Number(digits)) : '';
};

// Completar viaje como pantalla (antes era CompleteTripCostModal). El caller
// pasa onSubmit(data) que hace el PUT y devuelve { ok, message }. En éxito se
// reemplaza por la pantalla Result con la imagen; en error se muestra inline.
const CompleteTripScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const { onSubmit, totalSeats } = route.params || {};
  // El backend reparte el total entre los asientos confirmados (ver seatReservationService.
  // completeTripWithActualCost); esto es sólo la vista previa por asiento, misma cuenta.
  const seats = totalSeats > 0 ? totalSeats : 1;

  const [fuel, setFuel] = useState('');
  const [food, setFood] = useState('');
  const [other, setOther] = useState('');
  const [driverPay, setDriverPay] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [maxExtraPct, setMaxExtraPct] = useState(DEFAULT_MAX_EXTRA_PCT);

  useEffect(() => {
    let cancelled = false;
    get_withauth(ENDPOINTS.LIMITE_EXTRA_CONDUCTOR)
      .then((res) => {
        const pct = res?.data?.maxExtraConductorPct;
        if (!cancelled && typeof pct === 'number') setMaxExtraPct(pct);
      })
      .catch(() => {}); // el default alcanza para mostrarlo; el server valida igual
    return () => { cancelled = true; };
  }, []);

  const total = num(fuel) + num(food) + num(other) + num(driverPay);

  // Los tres primeros son gastos que se reparten; el extra es lo único que se queda el
  // conductor y por eso tiene tope. Mismo Math.floor que el server: si mostrara un máximo
  // con decimales, escribir el número que dice la pantalla sería rechazado.
  const gastos = num(fuel) + num(food) + num(other);
  const topeExtra = Math.floor((gastos * maxExtraPct) / 100);
  const extraExcedido = num(driverPay) > topeExtra;

  // El conductor también viaja, así que también pone: los gastos se dividen entre TODOS los
  // que fueron en el auto (asientos + 1). El extra del conductor es aparte —no es un gasto
  // del viaje, es lo que se lleva él— y lo pagan sólo los pasajeros.
  // Antes se dividía el total entre los asientos y el conductor viajaba gratis.
  const personas = seats + 1;
  const porPersona = gastos / personas;
  const extraPorAsiento = seats > 0 ? num(driverPay) / seats : 0;
  const porAsiento = porPersona + extraPorAsiento;
  const parteDelConductor = Math.max(0, porPersona - num(driverPay));

  const fields = [
    // "Combustible" a secas se leía como lo que pagaste en la estación, y el que llena el
    // tanque entero para un viaje corto cargaba el tanque completo como gasto del viaje.
    { key: 'fuel', label: 'Combustible del viaje', value: fuel, set: setFuel, placeholder: 'Ej: 2.000',
      hint: 'Lo que se consumió en este viaje, no lo que cargaste en la estación' },
    { key: 'food', label: 'Comida', value: food, set: setFood, placeholder: 'Ej: 1.000' },
    { key: 'other', label: 'Otros gastos', value: other, set: setOther, placeholder: 'Ej: 500',
      hint: 'Peajes, estacionamiento y demás gastos del viaje' },
    {
      key: 'driverPay',
      label: 'Extra conductor',
      value: driverPay,
      set: setDriverPay,
      placeholder: 'Ej: 1.500',
      hint: gastos > 0
        ? `Máximo $${formatMoney(topeExtra)} (${maxExtraPct}% de los gastos)`
        : 'Cargá primero los gastos: el extra se calcula sobre ellos',
      invalid: extraExcedido,
    },
  ];

  const handleSubmit = async () => {
    if (total <= 0) { setError('Ingresá al menos un costo válido'); return; }
    if (extraExcedido) {
      setError(gastos > 0
        ? `El extra del conductor no puede superar $${formatMoney(topeExtra)}`
        : 'Cargá primero los gastos del viaje: el extra se calcula sobre ellos');
      return;
    }
    setError('');
    setSubmitting(true);
    const res = await onSubmit?.({ costBreakdown: { fuel: num(fuel), food: num(food), other: num(other) }, driverPay: num(driverPay) });
    setSubmitting(false);
    if (res?.ok) {
      navigation.navigate('Result', { type: 'success', title: 'Viaje completado', message: res.message });
    } else {
      setError(res?.message || 'No se pudo completar el viaje');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { backgroundColor: ui.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={[styles.headerBtn, { backgroundColor: ui.surface }]}>
            <Ionicons name="arrow-back" size={20} color={ui.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: ui.text }]}>Completar viaje</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={[styles.subtitle, { color: ui.textMuted }]}>
            Cargá lo que se gastó en este viaje. Se reparte entre todos los que viajaron, vos incluido.
          </Text>

          {fields.map((f) => (
            <View key={f.key} style={styles.field}>
              <Text style={[styles.label, { color: ui.textMuted }]}>{f.label}</Text>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: f.invalid ? '#EF4444' : ui.border, color: ui.text, backgroundColor: ui.surface },
                ]}
                placeholder={f.placeholder}
                placeholderTextColor={ui.textMuted}
                keyboardType="number-pad"
                value={f.value}
                onChangeText={(v) => { f.set(formatInput(v)); if (error) setError(''); }}
              />
              {!!f.hint && (
                <Text style={[styles.hint, { color: f.invalid ? '#EF4444' : ui.textMuted }]}>{f.hint}</Text>
              )}
            </View>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {total > 0 && (
            <>
              <View style={[styles.totalRow, { borderTopColor: ui.border }]}>
                <Text style={[styles.totalLabel, { color: ui.textMuted }]}>Total del viaje</Text>
                <Text style={[styles.totalValue, { color: ui.text }]}>${formatMoney(total)}</Text>
              </View>

              {/* El reparto a la vista: es la diferencia entre compartir gastos y cobrar por
                  llevar gente, así que tiene que quedar claro que el conductor también pone. */}
              <View style={styles.perPassengerRow}>
                <Text style={[styles.perPassengerLabel, { color: ui.textMuted }]}>
                  Gastos entre {personas} {personas === 1 ? 'persona' : 'personas'} (vos y {seats} pasajero{seats !== 1 ? 's' : ''})
                </Text>
                <Text style={[styles.perPassengerValue, { color: ui.textMuted }]}>${formatMoney(porPersona)} c/u</Text>
              </View>

              {num(driverPay) > 0 && (
                <View style={styles.perPassengerRow}>
                  <Text style={[styles.perPassengerLabel, { color: ui.textMuted }]}>
                    Tu extra, repartido entre los pasajeros
                  </Text>
                  <Text style={[styles.perPassengerValue, { color: ui.textMuted }]}>${formatMoney(extraPorAsiento)} c/u</Text>
                </View>
              )}

              <View style={[styles.destacado, { borderTopColor: ui.border }]}>
                <Text style={[styles.perPassengerLabel, { color: ui.text }]}>
                  Cada pasajero te paga
                </Text>
                <Text style={[styles.destacadoValor, { color: ui.text }]}>${formatMoney(porAsiento)}</Text>
              </View>
              <View style={styles.perPassengerRow}>
                <Text style={[styles.perPassengerLabel, { color: ui.textMuted }]}>Te queda a vos</Text>
                <Text style={[styles.perPassengerValue, { color: ui.textMuted }]}>${formatMoney(parteDelConductor)}</Text>
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <PillButton label="Completar viaje" onPress={handleSubmit} loading={submitting} disabled={extraExcedido} />
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
  hint: { fontSize: 12, fontFamily: 'Sora_400Regular', marginTop: 5 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, marginTop: 8 },
  totalLabel: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
  totalValue: { fontSize: 20, fontFamily: 'Sora_800ExtraBold' },
  perPassengerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  perPassengerLabel: { fontSize: 13, fontFamily: 'Sora_400Regular', flex: 1, marginRight: 8 },
  perPassengerValue: { fontSize: 15, fontFamily: 'Sora_700Bold' },
  destacado: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 12,
  },
  destacadoValor: { fontSize: 20, fontFamily: 'Sora_800ExtraBold' },
  footer: { paddingHorizontal: 24, paddingTop: 8 },
});

export default CompleteTripScreen;
