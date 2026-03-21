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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { useColors } from '../../hooks/useColors';

const VerificationScreen = ({ route, navigation }) => {
  const { email } = route.params || {};
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { verifyEmail, resendVerification } = useAuth();
  const { showAlert } = useAlert();
  const { getCurrentThemeMode } = useColors();

  const isDarkMode  = getCurrentThemeMode() === 'dark';
  const bg          = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg      = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const border      = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted   = isDarkMode ? '#6B7280' : '#9CA3AF';
  const iconBg      = isDarkMode ? '#2A2A2A' : '#F3F4F6';

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      showAlert('Error', 'Por favor ingresá un código válido de 6 dígitos');
      return;
    }
    setLoading(true);
    try {
      const result = await verifyEmail(email, verificationCode);
      if (result.success) {
        showAlert('Verificación exitosa', 'Tu cuenta fue verificada correctamente. Ya podés iniciar sesión.', [
          { text: 'Continuar', onPress: () => navigation.navigate('Login') },
        ]);
      } else {
        if (result.isBackendIssue) {
          showAlert('Problema del servidor', 'Hay un problema con la verificación. Por favor contactá al soporte técnico.', [
            { text: 'Intentar después', style: 'cancel' },
          ]);
        } else {
          showAlert('Error', result.message || 'Código de verificación inválido');
        }
      }
    } catch (error) {
      showAlert('Error', error.message || 'Error al verificar el código');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    try {
      const result = await resendVerification(email);
      if (result.success) {
        showAlert('Código enviado', 'Se envió un nuevo código de verificación a tu email');
      } else {
        showAlert('Error', result.message || 'Error al enviar el código');
      }
    } catch (error) {
      showAlert('Error', error.message || 'Error al enviar el código');
    } finally {
      setResending(false);
    }
  };

  const formatCode = (text) => text.replace(/[^0-9]/g, '').slice(0, 6);

  const isReady = verificationCode.length === 6;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.content}>

          {/* Icon */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <Ionicons name="mail-outline" size={32} color={textPrimary} />
            </View>
            <Text style={[styles.title, { color: textPrimary }]}>Verificar Email</Text>
            <Text style={[styles.subtitle, { color: textMuted }]}>Enviamos un código de verificación a</Text>
            <Text style={[styles.email, { color: textPrimary }]}>{email}</Text>
          </View>

          {/* Code input card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <TextInput
              style={[styles.codeInput, { color: textPrimary }]}
              placeholder="000000"
              placeholderTextColor={textMuted}
              value={verificationCode}
              onChangeText={(text) => setVerificationCode(formatCode(text))}
              keyboardType="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              textAlign="center"
              letterSpacing={10}
            />
          </View>

          {/* Verify button */}
          <TouchableOpacity
            style={[
              styles.btn,
              { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' },
              !isReady && { opacity: 0.4 },
            ]}
            onPress={handleVerify}
            disabled={loading || !isReady}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={isDarkMode ? '#000000' : '#FFFFFF'} />
              : <Text style={[styles.btnText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>Verificar código</Text>
            }
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={[styles.resendText, { color: textMuted }]}>¿No recibiste el código? </Text>
            <TouchableOpacity onPress={handleResendCode} disabled={resending}>
              {resending
                ? <ActivityIndicator size="small" color={textMuted} />
                : <Text style={[styles.resendLink, { color: textPrimary }]}>Reenviar</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:  { flex: 1 },
  content:    { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header:     { alignItems: 'center', marginBottom: 32 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title:      { fontSize: 26, fontWeight: '700', marginBottom: 8 },
  subtitle:   { fontSize: 14, marginBottom: 4 },
  email:      { fontSize: 15, fontWeight: '600' },
  card:       { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 16, overflow: 'hidden' },
  codeInput:  { height: 72, fontSize: 28, fontWeight: '700' },
  btn:        { borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  btnText:    { fontSize: 16, fontWeight: '700' },
  resendRow:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resendText: { fontSize: 14 },
  resendLink: { fontSize: 14, fontWeight: '600' },
});

export default VerificationScreen;
