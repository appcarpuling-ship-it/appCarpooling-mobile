import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Keyboard,
  TouchableWithoutFeedback, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import PillButton from '../../components/ui/PillButton';
import { senaLegible } from '../../utils/sena';

// En Android con la arquitectura vieja, LayoutAnimation viene apagado por defecto.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
 *     onDone       ({ driverPrice, sinPrecioFijo, requiereSena }) => void
 */
const formatMiles = (n) => Number(n).toLocaleString('es-AR');

const DriverPricePickerScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const { seatsNeeded = 1, onDone } = route.params || {};

  const [precio, setPrecio] = useState('');
  const [error, setError] = useState('');
  const [sinPrecioFijo, setSinPrecioFijo] = useState(false);
  const [requiereSena, setRequiereSena] = useState(false);

  const valor = parseInt(String(precio).replace(/\./g, ''), 10) || 0;
  const asientos = Math.max(1, Number(seatsNeeded) || 1);
  // La mitad de lo que va a pagar ESE pasajero (precio × asientos que pidió).
  const senaTexto = senaLegible(valor, asientos);

  const confirmar = () => {
    if (!sinPrecioFijo && valor <= 0) {
      setError('Poné cuánto cobrás por asiento, o activá "Gastos compartidos"');
      return;
    }
    navigation.goBack();
    onDone?.({
      driverPrice: sinPrecioFijo ? 0 : valor,
      sinPrecioFijo,
      requiereSena: !sinPrecioFijo && requiereSena,
    });
  };

  return (
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

        {/* Todo scrollea, con el botón "Enviar propuesta" al final —como el resto de la app—
            en vez de un footer fijo que el teclado tapaba. `automaticallyAdjustKeyboardInsets`
            sube el campo en iOS; `keyboardDismissMode="on-drag"` lo baja al scrollear.
            `keyboardShouldPersistTaps` deja que los toggles respondan con el teclado arriba. */}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.bodyInner}>
          {!sinPrecioFijo && (
              /* Hero centrado y sin tarjeta, como el monto de "Tu reserva": es lo único
                  grande de la pantalla, no una caja más entre las demás. Va primero, antes
                  que los toggles, tal cual la maqueta aprobada. */
              <View style={styles.precioHero}>
                <Text style={[styles.precioRotulo, { color: ui.textMuted }]}>POR ASIENTO</Text>
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
                {/* El total sólo si pidió más de un asiento: con uno solo repetiría el mismo número. */}
                {valor > 0 && asientos > 1 && (
                  <Text style={[styles.total, { color: ui.textMuted }]}>
                    Son {asientos} asientos: cobrás ${formatMiles(valor * asientos)} en total.
                  </Text>
                )}
              </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Mismo toggle que en TripDetails: con precio fijo no hay nada que "compartir", y
              con gastos compartidos no hay precio que fijar. El precio de arriba y la seña
              de abajo desaparecen cuando esto se prende, en vez de quedar pidiendo un
              número que no se usa. */}
          <TouchableOpacity
            style={[styles.row, { backgroundColor: ui.surface, borderColor: ui.border }]}
            onPress={() => {
              // Sin esto, el precio y "Pido seña" aparecían/desaparecían de un salto seco.
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSinPrecioFijo((v) => !v);
              if (error) setError('');
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBadge, { backgroundColor: ui.border }]}>
              <Ionicons name="pricetags-outline" size={17} color={ui.text} />
            </View>
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

          {/* Seña: mismo concepto que al publicar un viaje. No aparece con "gastos
              compartidos" porque sin precio por asiento no hay mitad que calcular. */}
          {!sinPrecioFijo && (
          <TouchableOpacity
            style={[styles.row, { backgroundColor: ui.surface, borderColor: ui.border, marginTop: 4 }]}
            onPress={() => setRequiereSena((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBadge, { backgroundColor: ui.border }]}>
              <Ionicons name="shield-checkmark-outline" size={17} color={ui.text} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: ui.text, fontSize: 15, fontFamily: 'Sora_500Medium', flex: 1 }}>
                  Pido seña
                </Text>
                <View style={[styles.toggle, { backgroundColor: requiereSena ? ui.text : ui.border }]}>
                  <View style={[
                    styles.toggleCircle,
                    { backgroundColor: requiereSena ? ui.invertText : ui.textMuted },
                    requiereSena && styles.toggleOn,
                  ]} />
                </View>
              </View>
              <Text style={{ color: ui.textMuted, fontSize: 12, fontFamily: 'Sora_400Regular', lineHeight: 17, marginTop: 4 }}>
                {senaTexto
                  ? `Te transfiere ${senaTexto} por adelantado para reservar, y el resto al subir.`
                  : 'Te adelanta la mitad para reservar, y te paga el resto al subir. Poné el precio para ver cuánto es.'}
              </Text>
            </View>
          </TouchableOpacity>
          )}

          <View style={styles.footer}>
            <PillButton label="Enviar propuesta" onPress={confirmar} />
          </View>
        </View>
        </TouchableWithoutFeedback>
        </ScrollView>
      </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  headerBtn: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: 'Sora_700Bold', fontSize: 20, letterSpacing: -0.5, textAlign: 'center' },

  body: { flex: 1 },
  // Sin paddingBottom: abajo del boton queda solo el del contenedor (insets.bottom + 16),
  // el mismo aire que el resto de los botones de la app. Con los 24 de acá quedaba más arriba.
  bodyContent: { paddingHorizontal: 24, paddingTop: 16, flexGrow: 1 },
  // flexGrow: la cadena tiene que llenar el contentContainer entero para que el `marginTop:
  // 'auto'` del footer lo empuje al fondo cuando el contenido es corto. A pedido: el botón va
  // siempre abajo, como el resto de los footers de la app — el espacio vacío en pantallas
  // cortas es preferible a que "Enviar propuesta" ande flotando a mitad de pantalla.
  bodyInner: { gap: 12, flexGrow: 1 },

  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 18,
    paddingHorizontal: 18, paddingVertical: 16,
  },
  iconBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  toggle: { width: 46, height: 26, borderRadius: 13, padding: 2, justifyContent: 'center' },
  toggleCircle: { width: 22, height: 22, borderRadius: 11 },
  toggleOn: { alignSelf: 'flex-end' },

  // Hero del precio: centrado y sin tarjeta, como el monto de "Tu reserva" — es lo único
  // grande de la pantalla, no una caja más entre las demás.
  precioHero: { alignItems: 'center', paddingVertical: 20 },
  precioRotulo: { fontFamily: 'Sora_600SemiBold', fontSize: 11, letterSpacing: 1.1, textAlign: 'center' },
  // lineHeight explícito: sin esto Sora_800ExtraBold a 56px se recortaba arriba y abajo
  // dentro del TextInput (el "$0" se veía cortado/superpuesto).
  input: { fontFamily: 'Sora_800ExtraBold', fontSize: 56, lineHeight: 64, letterSpacing: -1.8, textAlign: 'center', marginTop: 6 },

  error: { color: '#EF4444', fontSize: 13, fontFamily: 'Sora_400Regular', paddingHorizontal: 4 },
  total: { fontFamily: 'Sora_500Medium', fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 8 },

  footer: { paddingTop: 16, marginTop: 'auto' },
});

export default DriverPricePickerScreen;
