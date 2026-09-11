import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';

/**
 * Versión web del checkout. react-native-webview no corre en web, así que el pago se abre
 * en una pestaña nueva del navegador y esta pantalla queda esperando a que la persona vuelva.
 *
 * La confirmación real la resuelve el que llama: al cerrarse (onClose) vuelve a chequear el
 * estado de la reserva contra el backend (getPendingPaymentReservations / confirmFromCallback),
 * igual que hace hoy al recuperar el foco. Acá sólo se ofrece el botón para volver.
 *
 * Mismo lenguaje visual que AlertModal (círculo del ícono, tarjeta con borde+sombra, botones
 * pill apilados) — antes tenía su propia caja plana sin borde ni sombra y botones con esquinas
 * apenas redondeadas, que desentonaba con el resto de los diálogos de la app.
 */
const CheckoutWebView = ({ visible, onClose, paymentUrl, onPaymentSuccess, reservationId }) => {
  const ui = useUI();
  const abierto = useRef(false);

  useEffect(() => {
    if (visible && paymentUrl && !abierto.current) {
      abierto.current = true;
      window.open(paymentUrl, '_blank', 'noopener');
    }
    if (!visible) abierto.current = false;
  }, [visible, paymentUrl]);

  if (!visible || !paymentUrl) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.box, { backgroundColor: ui.card, borderColor: ui.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: ui.surface }]}>
            <Ionicons name="open-outline" size={28} color={ui.text} />
          </View>
          <Text style={[styles.title, { color: ui.text }]}>Pago en otra pestaña</Text>
          <Text style={[styles.body, { color: ui.textMuted }]}>
            Abrimos la página de pago en una pestaña nueva. Completá el pago ahí y volvé a esta
            pantalla.
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: ui.invertBg, borderColor: ui.invertBg }]}
              onPress={() => window.open(paymentUrl, '_blank', 'noopener')}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnText, { color: ui.invertText }]}>Reabrir el pago</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: ui.surface, borderColor: ui.border }]}
              onPress={() => {
                // El caller re-chequea el estado de la reserva al cerrarse.
                onPaymentSuccess?.({ status: 'pending', reservationId });
                onClose();
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnText, { color: ui.text }]}>Ya completé el pago</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnPlano]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnText, { color: ui.textMuted, fontFamily: 'Sora_500Medium' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: {
    width: '100%', maxWidth: 340, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22, paddingTop: 26, paddingBottom: 18, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
  },
  iconWrap: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 18, fontFamily: 'Sora_700Bold', textAlign: 'center', letterSpacing: -0.3 },
  body: { fontSize: 14, fontFamily: 'Sora_400Regular', lineHeight: 20, textAlign: 'center', marginTop: 6 },

  buttons: { width: '100%', marginTop: 22, gap: 8 },
  // Pill, igual que PillButton y el resto de los botones de la app.
  btn: { paddingVertical: 13, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  btnPlano: { borderColor: 'transparent', backgroundColor: 'transparent' },
  btnText: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
});

export default CheckoutWebView;
