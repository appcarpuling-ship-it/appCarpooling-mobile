import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAlert } from '../../../context/AlertContext';
import { post_withauth, get_withauth, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import PillButton from '../../../components/ui/PillButton';
import { useUI } from '../../../theme/ui';

const TEXTO_POR_ESTRELLA = ['Tocá una estrella', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

/**
 * Calificar al otro después del viaje. Es obligatorio: no hay forma de salir sin puntuar.
 *
 * Sin mapa a propósito. Tenía uno con el recorrido completo para ubicar de qué viaje habla,
 * pero un MapView en una pantalla que se abre sola al arrancar la app es demasiada superficie
 * para que algo falle —y en esta app ya nos dio varios dolores de cabeza—. "Viaje a" con la
 * provincia alcanza para reconocerlo.
 */
const CreateReviewScreen = ({ route, navigation }) => {
  const { showAlert } = useAlert();
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const params = route.params || {};
  const { reviewType = 'driver' } = params;

  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(false);

  // Se entra por dos caminos: desde la notificación, que manda sólo `tripId`, y desde el
  // bloqueo al abrir la app, que ya trae el viaje entero. Se aceptan los dos.
  const [trip, setTrip] = useState(params.trip || null);
  const [reviewedUser, setReviewedUser] = useState(params.reviewedUser || null);

  useEffect(() => {
    if (trip || !params.tripId) return undefined;
    let cancelado = false;
    get_withauth(ENDPOINTS.GET_TRIP(params.tripId))
      .then((res) => {
        if (cancelado || !res?.success) return;
        setTrip(res.data);
        setReviewedUser(res.data?.driver || null);
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [params.tripId]);

  // Calificar es obligatorio: no hay botón de volver ni gesto para atrás (ver el navegador),
  // y acá se corta también el botón físico de Android, que si no era la salida de escape.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // Sólo la provincia: el destino exacto ya lo vivió, lo que ubica el viaje en la memoria
  // es a dónde fue.
  const provinciaDestino = trip?.destination?.province || trip?.destination?.city || '';

  const avatarUrl = reviewedUser?.avatar ? buildImageUri(reviewedUser.avatar) : null;
  const nombre = `${reviewedUser?.firstName || ''} ${reviewedUser?.lastName || ''}`.trim();

  const enviar = async () => {
    if (!trip?._id || !reviewedUser?._id) return;
    if (rating === 0) {
      showAlert('Ocurrió algo', 'Elegí una calificación para continuar');
      return;
    }
    setLoading(true);
    try {
      const response = await post_withauth(ENDPOINTS.CREATE_REVIEW, {
        trip: trip._id,
        reviewedUser: reviewedUser._id,
        rating,
        // El server valida `reviewType`. Antes se mandaba como `type` y la calificación
        // fallaba SIEMPRE por validación, sin que nada lo dijera.
        reviewType,
      });

      if (response.success) {
        // navigate y no replace: 'Result' vive en el stack raiz y esta pantalla corre
        // dentro de una pestaña, asi que el replace subia y reemplazaba a 'Main' entero.
        navigation.navigate('Result', {
          type: 'success',
          title: '¡Gracias!',
          message: 'Tu calificación quedó registrada.',
        });
      } else {
        showAlert('Ocurrió algo', response.message || 'No se pudo enviar la calificación');
      }
    } catch (error) {
      showAlert('Ocurrió algo', error.message || 'No se pudo enviar la calificación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: ui.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.cuerpo, { paddingTop: insets.top + 32 }]}>
            <Text style={[styles.viajeLabel, { color: ui.textMuted }]}>Viaje a</Text>
            <Text style={[styles.viajeDestino, { color: ui.text }]} numberOfLines={1}>
              {provinciaDestino || 'Tu último viaje'}
            </Text>

            <View style={[styles.persona, { borderTopColor: ui.border }]}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarVacio, { backgroundColor: ui.surface }]}>
                  <Text style={[styles.avatarIniciales, { color: ui.textMuted }]}>
                    {reviewedUser?.firstName?.[0]}{reviewedUser?.lastName?.[0]}
                  </Text>
                </View>
              )}
              <Text style={[styles.nombre, { color: ui.text }]} numberOfLines={1}>{nombre}</Text>
              <Text style={[styles.rol, { color: ui.textMuted }]}>
                {reviewType === 'driver' ? 'Conductor' : 'Pasajero'}
              </Text>

              <View style={styles.estrellas}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setRating(n)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel={`${n} estrella${n > 1 ? 's' : ''}`}
                  >
                    <Ionicons
                      name={n <= rating ? 'star' : 'star-outline'}
                      size={38}
                      color={n <= rating ? ui.text : ui.border}
                      style={styles.estrella}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.textoRating, { color: ui.textMuted }]}>{TEXTO_POR_ESTRELLA[rating]}</Text>
            </View>

          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: ui.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <PillButton
            label="Enviar calificación"
            onPress={enviar}
            loading={loading}
            disabled={rating === 0 || !trip?._id || !reviewedUser?._id}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  cuerpo: { paddingHorizontal: 24 },
  viajeLabel: { fontSize: 12, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.5, textTransform: 'uppercase' },
  viajeDestino: { fontSize: 26, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.6, marginTop: 4 },

  persona: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 22, paddingTop: 26 },
  avatar: { width: 82, height: 82, borderRadius: 41 },
  avatarVacio: { alignItems: 'center', justifyContent: 'center' },
  avatarIniciales: { fontSize: 26, fontFamily: 'Sora_700Bold' },
  nombre: { fontSize: 20, fontFamily: 'Sora_700Bold', marginTop: 12 },
  rol: { fontSize: 13, fontFamily: 'Sora_400Regular', marginTop: 2 },
  estrellas: { flexDirection: 'row', gap: 6, marginTop: 20 },
  estrella: { marginHorizontal: 2 },
  textoRating: { fontSize: 14, fontFamily: 'Sora_500Medium', marginTop: 10 },

  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});

export default CreateReviewScreen;
