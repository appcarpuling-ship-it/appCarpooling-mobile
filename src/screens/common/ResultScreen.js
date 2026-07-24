import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import PillButton from '../../components/ui/PillButton';

// ponytail: los PNG result-success/error eran placeholders de 68 bytes (cuadrado
// negro). El rediseño es monocromo, así que un ícono vectorial en ui.text alcanza.
const ICONS = {
  success: 'checkmark-circle',
  error: 'alert-circle',
};

// Pantalla de éxito/error tras crear algo (viaje, reserva, perfil, etc.).
// Reemplaza el ConfirmationModal copiado en cada pantalla de creación:
// se navega acá con params { type, title, message, primaryLabel, onPrimary }.
const ResultScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const {
    type = 'success',
    title,
    message,
    primaryLabel = 'Entendido',
    onPrimary,
  } = route.params || {};

  const isError = type === 'error';

  const handlePrimary = () => {
    if (onPrimary) onPrimary();
    else navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: ui.bg, paddingTop: insets.top + 14, paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        hitSlop={12}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
      >
        <Ionicons name="close" size={26} color={ui.text} />
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={[styles.illustrationWrap, { backgroundColor: ui.surface }]}>
          <Ionicons name={ICONS[type] || ICONS.success} size={96} color={ui.text} />
        </View>

        <Text style={[styles.title, { color: ui.text }]}>{title || (isError ? 'Ocurrió un error' : '¡Listo!')}</Text>
        {message ? <Text style={[styles.message, { color: ui.textMuted }]}>{message}</Text> : null}
      </View>

      <PillButton label={primaryLabel} onPress={handlePrimary} style={styles.cta} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  close: { alignSelf: 'flex-start' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  illustrationWrap: { width: '100%', maxHeight: 280, minHeight: 160, aspectRatio: 1.1, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  illustration: { width: '75%', height: '75%' },
  title: { fontFamily: 'Sora_800ExtraBold', fontSize: 26, lineHeight: 32, textAlign: 'center' },
  message: { fontFamily: 'Sora_400Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  cta: { marginTop: 16 },
});

export default ResultScreen;
