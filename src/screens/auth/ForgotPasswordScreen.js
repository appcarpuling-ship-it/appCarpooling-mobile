import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { post_public } from '../../services/apiService';
import { useAlert } from '../../context/AlertContext';
import { ENDPOINTS } from '../../config/api';
import { useUI } from '../../theme/ui';
import AuthHero from '../../components/auth/AuthHero';
import LineInput from '../../components/auth/LineInput';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlert();
  const ui = useUI();

  const handleResetPassword = async () => {
    if (!email) {
      showAlert('Ocurrió algo', 'Por favor ingresá tu email');
      return;
    }
    setLoading(true);
    try {
      await post_public(ENDPOINTS.FORGOT_PASSWORD, { email });
      navigation.navigate('Result', {
        type: 'success',
        title: 'Código enviado',
        message: 'Enviamos un código de recuperación a tu email',
        primaryLabel: 'Ingresar código',
        onPrimary: () => navigation.navigate('ResetPassword', { email }),
      });
    } catch (error) {
      navigation.navigate('Result', { type: 'error', title: 'Ocurrió algo', message: error.message || 'Error al enviar el email' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ui.bg }]} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.volverWrap}>
          <TouchableOpacity
            style={[styles.volver, { backgroundColor: ui.surface, borderColor: ui.border }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="chevron-back" size={22} color={ui.text} />
          </TouchableOpacity>
        </View>

        <AuthHero height={214} />

        <View style={styles.cuerpo}>
          <View style={styles.titulo}>
            <Text style={[styles.h1, { color: ui.text }]}>¿Olvidaste tu{'\n'}contraseña?</Text>
            <Text style={[styles.sub, { color: ui.textMuted }]}>
              Poné tu email y te mandamos un código de 6 dígitos para que puedas crear una nueva.
            </Text>
          </View>

          <LineInput
            label="Email"
            icon="mail-outline"
            placeholder="tu@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: ui.invertBg }, loading && { opacity: 0.7 }]}
            onPress={handleResetPassword}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={ui.invertText} />
              : <Text style={[styles.btnText, { color: ui.invertText }]}>Enviarme el código</Text>
            }
          </TouchableOpacity>

          <View style={styles.pie}>
            <Text style={[styles.pieText, { color: ui.textMuted }]}>¿Te acordaste? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={[styles.pieLink, { color: ui.text }]}>Volvé al inicio</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:  { flex: 1 },
  scroll:     { flexGrow: 1, paddingBottom: 28 },
  volverWrap: { paddingHorizontal: 26, paddingTop: 4 },
  volver:     { width: 44, height: 44, borderRadius: 999, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

  // El hero pisa un poco al botón de volver: sin esto quedaba una franja muerta entre los dos.
  cuerpo: { paddingHorizontal: 26, gap: 22, marginTop: 6 },
  titulo: { gap: 8 },
  h1:     { fontSize: 28, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.6, lineHeight: 34 },
  sub:    { fontSize: 14.5, fontFamily: 'Sora_400Regular', lineHeight: 21 },

  btn:     { height: 56, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  btnText: { fontSize: 15.5, fontFamily: 'Sora_700Bold', letterSpacing: 0.2 },

  pie:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  pieText: { fontSize: 13.5, fontFamily: 'Sora_400Regular' },
  pieLink: { fontSize: 13.5, fontFamily: 'Sora_700Bold' },
});

export default ForgotPasswordScreen;
