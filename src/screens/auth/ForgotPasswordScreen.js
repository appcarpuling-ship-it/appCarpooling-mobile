import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { post_public } from '../../services/apiService';
import { useAlert } from '../../context/AlertContext';
import { ENDPOINTS } from '../../config/api';
import { useColors } from '../../hooks/useColors';
import { useUI } from '../../theme/ui';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlert();
  const { isDarkMode } = useColors();

  const ui = useUI();

  const bg          = ui.bg;
  const cardBg      = ui.surface;
  const border      = ui.border;
  const textPrimary = ui.invertBg;
  const textMuted   = ui.textMuted;
  const iconBg      = ui.bg;

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
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={textPrimary} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <Ionicons name="key-outline" size={32} color={textPrimary} />
            </View>
            <Text style={[styles.title, { color: textPrimary }]}>Recuperar contraseña</Text>
            <Text style={[styles.subtitle, { color: textMuted }]}>
              Ingresá tu email y te enviaremos un código para restablecer tu contraseña
            </Text>
          </View>

          {/* Form card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color={textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: textPrimary }]}
                placeholder="Email"
                placeholderTextColor={textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Button */}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: ui.invertBg }, loading && { opacity: 0.7 }]}
            onPress={handleResetPassword}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={ui.invertText} />
              : <Text style={[styles.btnText, { color: ui.invertText }]}>Enviar código</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scrollContent:{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  backBtn:      { width: 44, height: 44, justifyContent: 'center', marginBottom: 24 },
  header:       { alignItems: 'center', marginBottom: 32 },
  iconCircle:   { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title:        { fontSize: 26, fontFamily: 'Sora_700Bold', marginBottom: 10, textAlign: 'center' },
  subtitle:     { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  card:         { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 16 },
  inputRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  inputIcon:    { marginRight: 10 },
  input:        { flex: 1, height: 52, fontSize: 15 },
  btn:          { borderRadius: 999, height: 54, justifyContent: 'center', alignItems: 'center' },
  btnText:      { fontSize: 16, fontFamily: 'Sora_700Bold' },
});

export default ForgotPasswordScreen;
