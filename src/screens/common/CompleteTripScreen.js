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
    // tanque entero para un viaje corto cargaba el tanque completo como gasto del viaje. De
    // ahí el "del viaje" en la etiqueta: la aclaración larga de abajo se sacó a pedido.
    { key: 'fuel', label: 'Combustible del viaje *', value: fuel, set: setFuel, icon: 'speedometer-outline' },
    { key: 'food', label: 'Comida', value: food, set: setFood, icon: 'fast-food-outline' },
    // "Peajes y otros" en la etiqueta y no en una aclaración abajo: decía lo mismo y dejaba
    // un renglón de texto suelto colgando de la ficha.
    { key: 'other', label: 'Peajes y otros', value: other, set: setOther, icon: 'receipt-outline' },
    // Campo "Extra conductor" desactivado a pedido del usuario. Sin él, driverPay queda en 0
    // y el viaje se reparte sólo por gastos reales entre todos los que viajaron, que es el
    // encuadre de gastos compartidos en su forma más pura. La validación del tope sigue en
    // el server: con 0 pasa siempre. Para reactivarlo, descomentar.
    // {
    //   key: 'driverPay',
    //   label: 'Extra conductor',
    //   value: driverPay,
    //   set: setDriverPay,
    //   placeholder: 'Ej: 1.500',
    //   hint: gastos > 0
    //     ? `Máximo $${formatMoney(topeExtra)} (${maxExtraPct}% de los gastos)`
    //     : 'Cargá primero los gastos: el extra se calcula sobre ellos',
    //   invalid: extraExcedido,
    // },
  ];

  const handleSubmit = async () => {
    // Combustible obligatorio: sin él el reparto queda sobre comida/peajes y el gasto real
    // del viaje no entra. Comida y peajes siguen siendo opcionales.
    if (num(fuel) <= 0) { setError('Cargá el combustible del viaje'); return; }
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

          {/* Una ficha con los tres montos y el importe alineado a la derecha, como cualquier
              pantalla de plata. Antes era un input suelto por gasto con la etiqueta arriba, y
              ocupaba el triple de alto para decir lo mismo. */}
          <View style={[styles.card, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            {fields.map((f, i) => (
              <View
                key={f.key}
                style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.border }]}
              >
                <Ionicons name={f.icon} size={19} color={ui.textMuted} style={styles.rowIcon} />
                <Text style={[styles.rowLabel, { color: ui.text }]} numberOfLines={1}>{f.label}</Text>
                {/* El "$" va DENTRO del valor y no como texto aparte: separado, el input
                    right-aligned lo dejaba a media pantalla del número ("$        0"). */}
                <TextInput
                  style={[styles.rowInput, { color: f.invalid ? '#EF4444' : ui.text }]}
                  placeholder="$0"
                  placeholderTextColor={ui.textMuted}
                  keyboardType="number-pad"
                  value={f.value ? `$${f.value}` : ''}
                  onChangeText={(v) => { f.set(formatInput(v)); if (error) setError(''); }}
                />
              </View>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* El resumen va siempre, aunque esté en cero: es el punto de la pantalla, y con los
              montos vacíos quedaba media pantalla en blanco. */}
          <View style={[styles.resumen, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            {/* El número que el conductor va a decir en voz alta, arriba y grande. Antes
                competía en tamaño con el total del viaje y había que buscarlo entre cuatro
                renglones iguales. */}
            <Text style={[styles.heroLabel, { color: ui.textMuted }]}>Cada pasajero te paga</Text>
            <Text style={[styles.heroValor, { color: ui.text }]}>${formatMoney(porAsiento)}</Text>

            <View style={[styles.detalles, { borderTopColor: ui.border }]}>
              <View style={styles.fila}>
                <Text style={[styles.filaLabel, { color: ui.textMuted }]}>Total del viaje</Text>
                <Text style={[styles.filaValor, { color: ui.text }]}>${formatMoney(total)}</Text>
              </View>

              {/* El reparto a la vista: es la diferencia entre compartir gastos y cobrar por
                  llevar gente, así que tiene que quedar claro que el conductor también pone. */}
              <View style={styles.fila}>
                <Text style={[styles.filaLabel, { color: ui.textMuted }]}>
                  Entre {personas} {personas === 1 ? 'persona' : 'personas'} (vos y {seats} pasajero{seats !== 1 ? 's' : ''})
                </Text>
                <Text style={[styles.filaValor, { color: ui.textMuted }]}>${formatMoney(porPersona)} c/u</Text>
              </View>

              {num(driverPay) > 0 && (
                <View style={styles.fila}>
                  <Text style={[styles.filaLabel, { color: ui.textMuted }]}>Tu extra, entre los pasajeros</Text>
                  <Text style={[styles.filaValor, { color: ui.textMuted }]}>${formatMoney(extraPorAsiento)} c/u</Text>
                </View>
              )}

              <View style={styles.fila}>
                <Text style={[styles.filaLabel, { color: ui.textMuted }]}>Te queda a vos</Text>
                <Text style={[styles.filaValor, { color: ui.textMuted }]}>${formatMoney(parteDelConductor)}</Text>
              </View>
            </View>
          </View>
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
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, minHeight: 56 },
  rowIcon: { marginRight: 10 },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: 'Sora_500Medium' },
  rowInput: { minWidth: 96, textAlign: 'right', paddingVertical: 12, fontSize: 17, fontFamily: 'Sora_700Bold' },
  error: { color: '#EF4444', fontSize: 13, marginTop: 10 },
  resumen: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 18, marginTop: 20 },
  heroLabel: { fontSize: 13, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.3, textTransform: 'uppercase' },
  heroValor: { fontSize: 38, fontFamily: 'Sora_800ExtraBold', letterSpacing: -1.2, marginTop: 2 },
  detalles: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 14, gap: 7 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filaLabel: { fontSize: 13, fontFamily: 'Sora_400Regular', flex: 1, marginRight: 8 },
  filaValor: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  footer: { paddingHorizontal: 24, paddingTop: 8 },
});

export default CompleteTripScreen;
