import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import PillButton from '../../components/ui/PillButton';

/**
 * Pantalla de confirmación previa a una acción (cancelar reserva, iniciar viaje,
 * etc.), reemplazando el Alert nativo. Se navega acá con params:
 *   { title, message, confirmLabel, cancelLabel, destructive, icon, onConfirm,
 *     successParams, errorParams }
 * `onConfirm` es async: si resuelve, reemplaza esta pantalla por Result (éxito);
 * si tira, la reemplaza por Result (error) con el mensaje de errorParams o el
 * del error mismo. "Cancelar" solo vuelve atrás, sin ejecutar nada.
 */
const ConfirmScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const {
    title = '¿Confirmás?',
    message,
    confirmLabel = 'Continuar',
    cancelLabel = 'Cancelar',
    destructive = false,
    icon,
    onConfirm,
    successParams = {},
    errorParams = {},
  } = route.params || {};

  const iconName = icon || (destructive ? 'alert-circle' : 'help-circle');

  const handleCancel = () => navigation.goBack();

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // onConfirm puede devolver datos que solo se conocen después de ejecutarse (ej. un
      // monto que viene en la respuesta) para completar el mensaje de éxito, mezclándose
      // sobre successParams. skipResult es el caso raro en el que onConfirm ya hizo lo suyo
      // (abrir un checkout, cerrar sesión) y esta pantalla no tiene nada que mostrar: solo
      // se saca de encima con goBack, sin pisar ninguna navegación propia del caller ni
      // quedarse esperando a que algo externo (ej. el remount por isAuthenticated) la saque.
      const result = await onConfirm?.();
      if (result?.skipResult) {
        navigation.goBack();
        return;
      }
      navigation.replace('Result', { type: 'success', ...successParams, ...result });
    } catch (e) {
      // Mismo criterio que el resto de la app: el mensaje real de un rechazo
      // del backend vive en response.data.message, no en e.message (eso es
      // genérico, tipo "Request failed with status 400").
      const apiMessage = e?.response?.data?.message;
      navigation.replace('Result', {
        type: 'error',
        title: errorParams.title,
        message: errorParams.message || apiMessage || e?.message,
        error: e,
        ...errorParams,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: ui.bg, paddingTop: insets.top + 14, paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
      <TouchableOpacity
        onPress={handleCancel}
        hitSlop={12}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
      >
        <Ionicons name="close" size={26} color={ui.text} />
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={styles.illustrationWrap}>
          <View style={[styles.halo, styles.haloOuter, { backgroundColor: ui.surface }]} />
          <View style={[styles.halo, styles.haloInner, { backgroundColor: ui.surface }]} />
          <Ionicons name={iconName} size={72} color={destructive ? ui.invertBg : ui.text} />
        </View>

        <Text style={[styles.title, { color: ui.text }]}>{title}</Text>
        {message ? <Text style={[styles.message, { color: ui.textMuted }]}>{message}</Text> : null}
      </View>

      <PillButton
        label={confirmLabel}
        onPress={handleConfirm}
        loading={loading}
        chevrons={false}
        style={styles.cta}
      />
      <TouchableOpacity
        onPress={handleCancel}
        disabled={loading}
        style={[styles.cancelBtn, loading && { opacity: 0.5 }]}
        activeOpacity={0.7}
      >
        <Text style={[styles.cancelText, { color: ui.textMuted }]}>{cancelLabel}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  close: { alignSelf: 'flex-start' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontFamily: 'Sora_800ExtraBold', fontSize: 28, lineHeight: 34, textAlign: 'center', marginTop: 28 },
  message: { fontFamily: 'Sora_400Regular', fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: 'center' },
  illustrationWrap: { width: '100%', height: 200, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', borderRadius: 999 },
  haloOuter: { width: '55%', height: '55%', opacity: 0.5 },
  haloInner: { width: '40%', height: '40%', opacity: 0.9 },
  cta: { marginTop: 16 },
  cancelBtn: { alignItems: 'center', paddingVertical: 16 },
  cancelText: { fontFamily: 'Sora_600SemiBold', fontSize: 15 },
});

export default ConfirmScreen;
