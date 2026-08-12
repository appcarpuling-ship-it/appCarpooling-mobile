import React, { useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import { useAuth } from '../../context/AuthContext';
import PillButton from '../../components/ui/PillButton';
import { reportError } from '../../utils/sentry';

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
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const {
    type = 'success',
    title,
    message,
    primaryLabel = 'Entendido',
    onPrimary,
    onClose,
    image,
    error, // opcional: el Error original capturado en el catch, para mejor stack trace en Sentry
  } = route.params || {};

  const isError = type === 'error';
  const resolvedImage = image || DEFAULT_IMAGES[type] || DEFAULT_IMAGES.success;

  // Choke point: cualquier pantalla que navegue acá con type:'error' queda
  // reportada a Sentry automáticamente, sin instrumentar cada catch a mano.
  useEffect(() => {
    if (!isError) return;
    if (error) reportError(error, { screen: 'Result', title, message });
    else reportError(new Error(`[Result] ${title || 'Error'}: ${message || ''}`), { screen: 'Result' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Un EXITO es terminal: la accion ya se hizo y la pantalla que la disparo (completar viaje,
  // publicar solicitud) no tiene sentido volver a verla, asi que se RESETEA el stack. Con
  // navigate, si el flujo llego aca desde una pestaña, 'Main' podia ya no estar en el stack y
  // se empujaba uno nuevo ENCIMA del resultado: desde el Home, el gesto de volver atras del
  // iPhone devolvia a la pantalla de exito.
  //
  // Un ERROR no lo es, y ese es el caso que quedaba mal. Las dos salidas de abajo existen
  // porque navegar o resetear hacia una ruta que no esta en el navegador NO falla ni avisa:
  // simplemente deja el boton muerto.
  const goHome = () => {
    // Un ERROR no es terminal: la accion no se hizo y hay que corregirla, asi que se vuelve al
    // formulario. Mandarlo al Home lo obliga a rehacer todo desde cero para arreglar un campo.
    if (isError) return navigation.goBack();

    if (!isAuthenticated) return navigation.goBack();

    // 'Main' no siempre existe: con sesion iniciada pero sin telefono cargado (alguien que
    // entro con Google), AppNavigator monta SOLO 'CompleteProfile'. Resetear hacia una ruta
    // que no esta en el navegador no falla ni avisa: deja el boton muerto, que es justo lo que
    // pasaba al fallar el alta por telefono repetido.
    const rutas = navigation.getState()?.routeNames || [];
    if (!rutas.includes('Main')) return navigation.goBack();

    navigation.reset({
      index: 0,
      routes: [{ name: 'Main', params: { screen: 'HomeTab', params: { screen: 'Home' } } }],
    });
  };

  const handlePrimary = () => {
    try {
      if (onPrimary) onPrimary();
      else goHome();
    } catch {
      goHome();
    }
  };

  const handleClose = () => {
    try {
      if (onClose) onClose();
      else goHome();
    } catch {
      goHome();
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
        <View style={styles.illustrationWrap}>
          <View style={[styles.halo, styles.haloOuter, { backgroundColor: ui.surface }]} />
          <View style={[styles.halo, styles.haloInner, { backgroundColor: ui.surface }]} />
          <Image source={resolvedImage} style={styles.illustration} resizeMode="contain" />
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
  title: { fontFamily: 'Sora_800ExtraBold', fontSize: 28, lineHeight: 34, textAlign: 'center', marginTop: 28 },
  message: { fontFamily: 'Sora_400Regular', fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: 'center' },
  illustrationWrap: { width: '100%', flex: 1, maxHeight: 320, minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', borderRadius: 999 },
  haloOuter: { width: '85%', height: '85%', opacity: 0.5 },
  haloInner: { width: '62%', height: '62%', opacity: 0.9 },
  illustration: { width: '68%', height: '68%' },
  cta: { marginTop: 16 },
});

export default ResultScreen;
