import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import PillButton from '../../components/ui/PillButton';

/**
 * Último paso al postularse a una solicitud: cuánto cobra el conductor por asiento, o si
 * prefiere no fijar precio y arreglar los gastos directo con el pasajero.
 *
 * Mismas dos modalidades que TripDetails.js al publicar un viaje normal — la postulación a
 * una solicitud no tenía esta opción, así que un conductor de carpooling real quedaba
 * obligado a inventar un precio para poder postularse.
 *
 * Va como pantalla y no como alert por la misma razón que DriverRoutePicker, que es el paso
 * anterior del mismo flujo: hace falta explicar contra qué compite ese número, y con el
 * switch prendido hace falta explicar por qué no hay ninguno.
 *
 *   navigation.navigate('DriverPricePicker', { seatsNeeded, onDone })
 *     seatsNeeded  cuántos asientos pidió el pasajero, para mostrar el total
 *     onDone       ({ driverPrice, sinPrecioFijo, aceptaEfectivo }) => void
 */
const formatMiles = (n) => Number(n).toLocaleString('es-AR');

const DriverPricePickerScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const { seatsNeeded = 1, onDone } = route.params || {};

  const [precio, setPrecio] = useState('');
  const [error, setError] = useState('');
  const [sinPrecioFijo, setSinPrecioFijo] = useState(false);
  const [aceptaEfectivo, setAceptaEfectivo] = useState(false);

  const valor = parseInt(String(precio).replace(/\./g, ''), 10) || 0;
  const asientos = Math.max(1, Number(seatsNeeded) || 1);

  const confirmar = () => {
    if (!sinPrecioFijo && valor <= 0) {
      setError('Poné cuánto cobrás por asiento, o activá "Gastos compartidos"');
      return;
    }
    navigation.goBack();
    onDone?.({ driverPrice: sinPrecioFijo ? 0 : valor, sinPrecioFijo, aceptaEfectivo });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { backgroundColor: ui.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={[styles.headerBtn, { backgroundColor: ui.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="arrow-back" size={20} color={ui.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: ui.text }]}>Tu precio</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.body}>
          {/* Mismo toggle que en TripDetails: con precio fijo no hay nada que "compartir", y
              con gastos compartidos no hay precio que fijar. El campo de abajo desaparece
              cuando esto se prende, en vez de quedar pidiendo un número que no se usa. */}
          <TouchableOpacity
            style={[styles.row, { backgroundColor: ui.surface, borderColor: ui.border }]}
            onPress={() => { setSinPrecioFijo((v) => !v); if (error) setError(''); }}
            activeOpacity={0.7}
          >
            <Ionicons name="pricetags-outline" size={19} color={ui.text} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: ui.text, fontSize: 15, fontFamily: 'Sora_500Medium', flex: 1 }}>
                  Gastos compartidos
                </Text>
                <View style={[styles.toggle, { backgroundColor: sinPrecioFijo ? ui.text : ui.border }]}>
                  <View style={[
                    styles.toggleCircle,
                    { backgroundColor: sinPrecioFijo ? ui.invertText : ui.textMuted },
                    sinPrecioFijo && styles.toggleOn,
                  ]} />
                </View>
              </View>
              <Text style={{ color: ui.textMuted, fontSize: 12, fontFamily: 'Sora_400Regular', lineHeight: 17, marginTop: 4 }}>
                {sinPrecioFijo
                  ? 'Sin precio fijo: arreglás los gastos del viaje directo con el pasajero.'
                  : 'Vos fijás cuánto cobra cada asiento.'}
              </Text>
            </View>
          </TouchableOpacity>

          {!sinPrecioFijo && (
            <>
              <Text style={[styles.intro, { color: ui.textMuted }]}>
                ¿Cuánto le cobrás a cada pasajero?
              </Text>

              <View style={[styles.card, { backgroundColor: ui.surface, borderColor: ui.border }]}>
                <Text style={[styles.cardLabel, { color: ui.textMuted }]}>POR ASIENTO</Text>
                <TextInput
                  style={[styles.input, { color: valor > 0 ? ui.text : ui.textMuted }]}
                  placeholder="$0"
                  placeholderTextColor={ui.textMuted}
                  keyboardType="number-pad"
                  autoFocus
                  value={precio ? `$${precio}` : ''}
                  onChangeText={(v) => {
                    const digits = v.replace(/\D/g, '');
                    setPrecio(digits ? formatMiles(Number(digits)) : '');
                    if (error) setError('');
                  }}
                />
              </View>

              {/* El total sólo si pidió más de un asiento: con uno solo repetiría el mismo número. */}
              {valor > 0 && asientos > 1 && (
                <Text style={[styles.total, { color: ui.textMuted }]}>
                  Son {asientos} asientos: cobrás ${formatMiles(valor * asientos)} en total.
                </Text>
              )}
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Sólo informativo, igual que en TripDetails: no cambia el cobro. */}
          <TouchableOpacity
            style={[styles.row, { backgroundColor: ui.surface, borderColor: ui.border, marginTop: 4 }]}
            onPress={() => setAceptaEfectivo((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons name="wallet-outline" size={19} color={ui.text} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: ui.text, fontSize: 15, fontFamily: 'Sora_500Medium', flex: 1 }}>
                  Acepto efectivo
                </Text>
                <View style={[styles.toggle, { backgroundColor: aceptaEfectivo ? ui.text : ui.border }]}>
                  <View style={[
                    styles.toggleCircle,
                    { backgroundColor: aceptaEfectivo ? ui.invertText : ui.textMuted },
                    aceptaEfectivo && styles.toggleOn,
                  ]} />
                </View>
              </View>
              <Text style={{ color: ui.textMuted, fontSize: 12, fontFamily: 'Sora_400Regular', lineHeight: 17, marginTop: 4 }}>
                Le avisa al pasajero que además de transferencia, también recibís efectivo.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <PillButton label="Enviar propuesta" onPress={confirmar} />
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

  body: { flex: 1, paddingHorizontal: 24, paddingTop: 16, gap: 12 },
  intro: { fontFamily: 'Sora_400Regular', fontSize: 14, lineHeight: 20, marginBottom: 4 },

  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 18,
    paddingHorizontal: 18, paddingVertical: 16,
  },
  toggle: { width: 46, height: 26, borderRadius: 13, padding: 2, justifyContent: 'center' },
  toggleCircle: { width: 22, height: 22, borderRadius: 11 },
  toggleOn: { alignSelf: 'flex-end' },

  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 16 },
  cardLabel: { fontFamily: 'Sora_600SemiBold', fontSize: 12, letterSpacing: 0.3 },
  input: { fontFamily: 'Sora_800ExtraBold', fontSize: 38, letterSpacing: -1.2, paddingVertical: 4, marginTop: 2 },

  error: { color: '#EF4444', fontSize: 13, fontFamily: 'Sora_400Regular', paddingHorizontal: 4 },
  total: { fontFamily: 'Sora_500Medium', fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },

  footer: { paddingHorizontal: 24, paddingTop: 8 },
});

export default DriverPricePickerScreen;
