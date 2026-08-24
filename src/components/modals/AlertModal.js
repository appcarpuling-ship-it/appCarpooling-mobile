import React, { useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Platform,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';

const AlertModal = ({
  visible,
  title,
  message,
  buttons = [],
  onRequestClose,
  type, // 'success' | 'error' | 'warning' | undefined
}) => {
  const ui = useUI();

  /**
   * La acción del botón corre DESPUÉS de que el modal se cerró del todo.
   *
   * En iOS no se puede presentar una pantalla nativa —la galería, la cámara— mientras hay otro
   * modal presentado: el sistema la descarta sin avisar. Como acá se llamaba `onPress()` antes
   * de cerrar, el botón "Galería" no abría nada y no había ningún error que mirar.
   *
   * `onDismiss` sólo existe en iOS, que es justo donde importa; en Android se ejecuta al toque.
   */
  const pendiente = useRef(null);

  const ejecutarPendiente = () => {
    const accion = pendiente.current;
    pendiente.current = null;
    accion?.();
  };

  const cerrarYEjecutar = (accion) => {
    pendiente.current = accion || null;
    onRequestClose?.();
    if (Platform.OS !== 'ios') ejecutarPendiente();
  };

  const handleBackdropPress = () => {
    cerrarYEjecutar(buttons.find((b) => b.style === 'cancel')?.onPress);
  };

  const iconConfig = {
    success: { name: 'checkmark-circle', color: '#16A34A' },
    error: { name: 'close-circle', color: '#DC2626' },
    warning: { name: 'warning', color: '#D97706' },
  }[type];

  // Apilados cuando son más de dos: en fila el texto wrapea y quedan ilegibles.
  const apilados = buttons.length > 2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      onDismiss={ejecutarPendiente}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.modal, { backgroundColor: ui.card, borderColor: ui.border }]}>
              {iconConfig && (
                <View style={[styles.iconWrap, { backgroundColor: ui.surface }]}>
                  <Ionicons name={iconConfig.name} size={30} color={iconConfig.color} />
                </View>
              )}
              {title ? <Text style={[styles.title, { color: ui.text }]}>{title}</Text> : null}
              {message ? <Text style={[styles.message, { color: ui.textMuted }]}>{message}</Text> : null}

              <View style={[styles.buttons, apilados ? styles.columna : styles.fila]}>
                {buttons.map((button, index) => {
                  const esCancelar = button.style === 'cancel';
                  const esDestructivo = button.style === 'destructive';
                  // Apilados son opciones equivalentes (Cámara / Galería): ninguna manda. En
                  // fila, la última es la acción principal y va rellena.
                  const esPrincipal = !apilados && !esCancelar && !esDestructivo && index === buttons.length - 1;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        apilados && styles.buttonStacked,
                        // Cancelar sin caja: es una salida, no una opción más.
                        esCancelar
                          ? styles.buttonPlano
                          : { borderColor: ui.border, backgroundColor: ui.surface },
                        esDestructivo && { backgroundColor: '#DC2626', borderColor: '#DC2626' },
                        esPrincipal && { backgroundColor: ui.invertBg, borderColor: ui.invertBg },
                      ]}
                      onPress={() => cerrarYEjecutar(button.onPress)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.buttonText,
                          { color: ui.text },
                          esCancelar && { color: ui.textMuted, fontFamily: 'Sora_500Medium' },
                          esDestructivo && { color: '#FFFFFF' },
                          esPrincipal && { color: ui.invertText },
                        ]}
                      >
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    alignItems: 'center',
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 18, fontFamily: 'Sora_700Bold', textAlign: 'center', letterSpacing: -0.3 },
  message: { fontSize: 14, fontFamily: 'Sora_400Regular', textAlign: 'center', lineHeight: 20, marginTop: 6 },

  buttons: { width: '100%', marginTop: 22 },
  fila: { flexDirection: 'row', gap: 10 },
  columna: { flexDirection: 'column', gap: 8 },
  button: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    // Pill, igual que PillButton y que el resto de los botones de la app.
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Apilados, el flex:1 deja flexBasis en 0 y el botón colapsa a la altura del padding.
  buttonStacked: { flex: 0, alignSelf: 'stretch' },
  buttonPlano: { borderColor: 'transparent', backgroundColor: 'transparent' },
  buttonText: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
});

export default AlertModal;
