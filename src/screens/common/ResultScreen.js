import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import PillButton from '../../components/ui/PillButton';

// Imagen por defecto según el tipo, para cuando el caller no pasa una
// específica (ej. "Solicitud enviada"). Nunca se usan íconos de relleno.
const DEFAULT_IMAGES = {
  success: require('../../../assets/icons/pngwing.com (28).png'),
  error: require('../../../assets/icons/pngwing.com (32).png'),
};

// Pantalla de éxito/error tras crear algo (viaje, reserva, perfil, etc.).
// Reemplaza el ConfirmationModal copiado en cada pantalla de creación:
// se navega acá con params { type, title, message, primaryLabel, onPrimary, image }.
// Layout: título + subtítulo arriba, ilustración grande abajo, sin dots/pasos.
const ResultScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const {
    type = 'success',
    title,
    message,
    primaryLabel = 'Entendido',
    onPrimary,
    onClose,
    image,
  } = route.params || {};

  const isError = type === 'error';
  const resolvedImage = image || DEFAULT_IMAGES[type] || DEFAULT_IMAGES.success;

  const handlePrimary = () => {
    try {
      if (onPrimary) onPrimary();
      else navigation.goBack();
    } catch {
      navigation.goBack();
    }
  };

  const handleClose = () => {
    try {
      if (onClose) onClose();
      else navigation.goBack();
    } catch {
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: ui.bg, paddingTop: insets.top + 14, paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
      <TouchableOpacity
        onPress={handleClose}
        hitSlop={12}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
      >
        <Ionicons name="close" size={26} color={ui.text} />
      </TouchableOpacity>

      <View style={styles.body}>
        <Text style={[styles.title, { color: ui.text }]}>{title || (isError ? 'Ocurrió un error' : '¡Listo!')}</Text>
        {message ? <Text style={[styles.message, { color: ui.textMuted }]}>{message}</Text> : null}

        <View style={[styles.illustrationWrap, { backgroundColor: ui.surface }]}>
          <Image source={resolvedImage} style={styles.illustration} resizeMode="contain" />
        </View>
      </View>

      <PillButton label={primaryLabel} onPress={handlePrimary} style={styles.cta} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  close: { alignSelf: 'flex-start' },
  body: { flex: 1, justifyContent: 'center' },
  title: { fontFamily: 'Sora_800ExtraBold', fontSize: 28, lineHeight: 34 },
  message: { fontFamily: 'Sora_400Regular', fontSize: 15, lineHeight: 22, marginTop: 10 },
  illustrationWrap: { width: '100%', flex: 1, maxHeight: 320, minHeight: 200, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  illustration: { width: '80%', height: '80%' },
  cta: { marginTop: 16 },
});

export default ResultScreen;
