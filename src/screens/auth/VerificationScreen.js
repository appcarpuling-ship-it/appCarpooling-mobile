import React, { useState, useEffect, useRef } from 'react';
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
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { useColors } from '../../hooks/useColors';
import { useUI } from '../../theme/ui';

const VerificationScreen = ({ route, navigation }) => {
  const { email, sendCodeOnMount } = route.params || {};
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { verifyEmail, resendVerification } = useAuth();
  const { showAlert } = useAlert();
  const { isDarkMode } = useColors();

  const ui = useUI();

  const bg          = ui.bg;
  const cardBg      = ui.surface;
  const border      = ui.border;
  const textPrimary = ui.invertBg;
  const textMuted   = ui.textMuted;
  const iconBg      = ui.bg;

  const autoSendStarted = useRef(false);
  useEffect(() => {
    if (!sendCodeOnMount || !email?.trim()) return;
    if (autoSendStarted.current) return;
    autoSendStarted.current = true;

    let cancelled = false;
    (async () => {
      setResending(true);
      try {
        const result = await resendVerification(email.trim());
        if (cancelled) return;
        if (result.success) {
          showAlert(
            'Código enviado',
            'Te enviamos un código de verificación. Revisá tu correo (y la carpeta de spam).'
          );
        } else {
          showAlert(
            'No se pudo enviar el código',
            result.message || 'Podés tocar «Reenviar código» para intentarlo de nuevo.'
          );
        }
      } finally {
        if (!cancelled) setResending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sendCodeOnMount, email, resendVerification, showAlert]);

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      showAlert('Ocurrió algo', 'Por favor ingresá un código válido de 6 dígitos');
      return;
    }
    setLoading(true);
    try {
      const result = await verifyEmail(email, verificationCode);
      if (result.success) {
        navigation.navigate('Result', {
          type: 'success',
          title: 'Verificación exitosa',
          message: 'Tu cuenta fue verificada correctamente. Ya podés iniciar sesión.',
          primaryLabel: 'Continuar',
          onPrimary: () => navigation.navigate('Login'),
        });
      } else {
        if (result.isBackendIssue) {
          showAlert('No pudimos verificarte', 'Hubo un problema al verificar tu cuenta. Escribinos al soporte y lo resolvemos.', [
            { text: 'Intentar después', style: 'cancel' },
          ]);
        } else {
          navigation.navigate('Result', { type: 'error', title: 'Ocurrió algo', message: result.message || 'Código de verificación inválido' });
        }
      }
    } catch (error) {
      navigation.navigate('Result', { type: 'error', title: 'Ocurrió algo', message: error.message || 'Error al verificar el código' });
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
        showAlert('Ocurrió algo', result.message || 'Error al enviar el código');
      }
    } catch (error) {
      showAlert('Ocurrió algo', error.message || 'Error al enviar el código');
    } finally {
      setResending(false);
    }
  };

  const formatCode = (text) => text.replace(/[^0-9]/g, '').slice(0, 6);

  const isReady = verificationCode.length === 6;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }, Platform.OS === 'web' && { minHeight: '100vh' }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

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
            />
          </View>

          {/* Verify button */}
          <TouchableOpacity
            style={[
              styles.btn,
              { backgroundColor: ui.invertBg },
              !isReady && { opacity: 0.4 },
            ]}
            onPress={handleVerify}
            disabled={loading || !isReady}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={ui.invertText} />
              : <Text style={[styles.btnText, { color: ui.invertText }]}>Verificar código</Text>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:  { flex: 1 },
  content:    { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header:     { alignItems: 'center', marginBottom: 32 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title:      { fontSize: 26, fontFamily: 'Sora_700Bold', marginBottom: 8 },
  subtitle:   { fontSize: 14, marginBottom: 4 },
  email:      { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
  card:       { borderRadius: 16, borderWidth: 1.5, marginBottom: 16, overflow: 'hidden', paddingHorizontal: 20 },
  codeInput:  { height: 72, fontSize: 32, fontFamily: 'Sora_700Bold', textAlign: 'center', letterSpacing: 12 },
  btn:        { borderRadius: 999, height: 54, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  btnText:    { fontSize: 16, fontFamily: 'Sora_700Bold' },
  resendRow:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resendText: { fontSize: 14 },
  resendLink: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
});

export default VerificationScreen;
