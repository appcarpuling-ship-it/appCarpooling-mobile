import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import PillButton from '../../components/ui/PillButton';

/**
 * Último paso al postularse a una solicitud: cuánto cobra el conductor por asiento.
 *
 * Va como pantalla y no como alert por la misma razón que DriverRoutePicker, que es el paso
 * anterior del mismo flujo: hace falta un input y hace falta explicar contra qué compite ese
 * número. La solicitud admite hasta 5 postulaciones y el pasajero las compara por precio.
 *
 *   navigation.navigate('DriverPricePicker', { seatsNeeded, onDone })
 *     seatsNeeded  cuántos asientos pidió el pasajero, para mostrar el total
 *     onDone       (precioPorAsiento: number) => void
 */
const formatMiles = (n) => Number(n).toLocaleString('es-AR');

const DriverPricePickerScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const { seatsNeeded = 1, onDone } = route.params || {};

  const [precio, setPrecio] = useState('');
  const [error, setError] = useState('');

  const valor = parseInt(String(precio).replace(/\./g, ''), 10) || 0;
  const asientos = Math.max(1, Number(seatsNeeded) || 1);

  const confirmar = () => {
    if (valor <= 0) {
      setError('Poné cuánto cobrás por asiento');
      return;
    }
    navigation.goBack();
    onDone?.(valor);
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

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* El total sólo si pidió más de un asiento: con uno solo repetiría el mismo número. */}
          {valor > 0 && asientos > 1 && (
            <Text style={[styles.total, { color: ui.textMuted }]}>
              Son {asientos} asientos: cobrás ${formatMiles(valor * asientos)} en total.
            </Text>
          )}

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

  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 16 },
  cardLabel: { fontFamily: 'Sora_600SemiBold', fontSize: 12, letterSpacing: 0.3 },
  input: { fontFamily: 'Sora_800ExtraBold', fontSize: 38, letterSpacing: -1.2, paddingVertical: 4, marginTop: 2 },

  error: { color: '#EF4444', fontSize: 13, fontFamily: 'Sora_400Regular', paddingHorizontal: 4 },
  total: { fontFamily: 'Sora_500Medium', fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },


  footer: { paddingHorizontal: 24, paddingTop: 8 },
});

export default DriverPricePickerScreen;
