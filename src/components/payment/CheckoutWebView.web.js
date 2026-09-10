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
        <View style={[styles.box, { backgroundColor: ui.surface }]}>
          <Ionicons name="open-outline" size={28} color={ui.text} />
          <Text style={[styles.title, { color: ui.text }]}>Pago en otra pestaña</Text>
          <Text style={[styles.body, { color: ui.textMuted }]}>
            Abrimos la página de pago en una pestaña nueva. Completá el pago ahí y volvé a esta
            pantalla.
          </Text>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: ui.invertBg }]}
            onPress={() => window.open(paymentUrl, '_blank', 'noopener')}
            activeOpacity={0.85}
          >
            <Text style={[styles.btnText, { color: ui.invertText }]}>Reabrir el pago</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnGhost, { borderColor: ui.border }]}
            onPress={() => {
              // El caller re-chequea el estado de la reserva al cerrarse.
              onPaymentSuccess?.({ status: 'pending', reservationId });
              onClose();
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.btnText, { color: ui.text }]}>Ya completé el pago</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.cancel} activeOpacity={0.7}>
            <Text style={[styles.cancelText, { color: ui.textMuted }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: { width: '100%', maxWidth: 380, borderRadius: 18, padding: 24, alignItems: 'center', gap: 10 },
  title: { fontSize: 17, fontFamily: 'Sora_700Bold', marginTop: 4 },
  body: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 8 },
  btn: { width: '100%', paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  btnText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  cancel: { paddingVertical: 8, marginTop: 2 },
  cancelText: { fontSize: 13, fontFamily: 'Sora_400Regular' },
});

export default CheckoutWebView;
