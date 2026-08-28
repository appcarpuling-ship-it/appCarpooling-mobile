import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { useUI } from '../../theme/ui';
import AuthHero from '../../components/auth/AuthHero';

const LARGO = 6;

const VerificationScreen = ({ route, navigation }) => {
  const { email, sendCodeOnMount } = route.params || {};
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [enfocado, setEnfocado] = useState(false);
  const { verifyEmail, resendVerification } = useAuth();
  const { showAlert } = useAlert();
  const ui = useUI();

  // Las seis casillas son sólo dibujo: el código vive en UN input invisible estirado por
  // encima. Seis TextInput de verdad obligan a saltar el foco a mano y rompen el autocompletado
  // del código que llega por SMS/mail (`one-time-code`), que es como la mayoría lo carga.
  const inputRef = useRef(null);

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
    if (!verificationCode || verificationCode.length !== LARGO) {
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
          showAlert('Problema del servidor', 'Hay un problema con la verificación. Por favor contactá al soporte técnico.', [
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

  const formatCode = (text) => text.replace(/[^0-9]/g, '').slice(0, LARGO);
  const isReady = verificationCode.length === LARGO;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: ui.bg }, Platform.OS === 'web' && { minHeight: '100vh' }]}
      edges={['top', 'bottom']}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
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

        <AuthHero height={196} />

        <View style={styles.cuerpo}>
          <View style={styles.titulo}>
            <Text style={[styles.h1, { color: ui.text }]}>Verificá tu email</Text>
            <Text style={[styles.sub, { color: ui.textMuted }]}>
              Te mandamos un código de 6 dígitos a{' '}
              <Text style={{ color: ui.text, fontFamily: 'Sora_600SemiBold' }}>{email}</Text>. Revisá también el spam.
            </Text>
          </View>

          <Pressable
            style={styles.casillas}
            onPress={() => inputRef.current?.focus()}
            accessibilityRole="none"
          >
            {Array.from({ length: LARGO }, (_, i) => {
              const ch = verificationCode[i] || '';
              // El cursor: la casilla que sigue a lo ya escrito se marca mientras hay foco.
              const activa = enfocado && i === Math.min(verificationCode.length, LARGO - 1);
              return (
                <View
                  key={i}
                  style={[
                    styles.casilla,
                    {
                      backgroundColor: ch ? ui.surface : ui.bg,
                      borderColor: ch || activa ? ui.text : ui.border,
                      borderWidth: ch || activa ? 1.5 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.digito, { color: ch ? ui.text : ui.textMuted }]}>{ch}</Text>
                </View>
              );
            })}

            <TextInput
              ref={inputRef}
              style={styles.inputInvisible}
              value={verificationCode}
              onChangeText={(text) => setVerificationCode(formatCode(text))}
              onFocus={() => setEnfocado(true)}
              onBlur={() => setEnfocado(false)}
              keyboardType="number-pad"
              maxLength={LARGO}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              caretHidden
              accessibilityLabel="Código de verificación de 6 dígitos"
            />
          </Pressable>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: ui.invertBg }, !isReady && { opacity: 0.4 }]}
            onPress={handleVerify}
            disabled={loading || !isReady}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={ui.invertText} />
              : <Text style={[styles.btnText, { color: ui.invertText }]}>Verificar</Text>
            }
          </TouchableOpacity>

          <View style={styles.pie}>
            <Text style={[styles.pieText, { color: ui.textMuted }]}>¿No te llegó? </Text>
            <TouchableOpacity onPress={handleResendCode} disabled={resending}>
              {resending
                ? <ActivityIndicator size="small" color={ui.textMuted} />
                : <Text style={[styles.pieLink, { color: ui.text }]}>Reenviar código</Text>
              }
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

  cuerpo: { paddingHorizontal: 26, gap: 24, marginTop: 8 },
  titulo: { gap: 8 },
  h1:     { fontSize: 28, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.6, lineHeight: 34 },
  sub:    { fontSize: 14.5, fontFamily: 'Sora_400Regular', lineHeight: 21 },

  casillas: { flexDirection: 'row', justifyContent: 'space-between' },
  casilla:  { width: 48, height: 60, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  digito:   { fontSize: 24, fontFamily: 'Sora_700Bold' },
  // Estirado por encima de las seis casillas y transparente: recibe el toque y el teclado.
  inputInvisible: { ...StyleSheet.absoluteFillObject, opacity: 0, color: 'transparent' },

  btn:     { height: 56, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  btnText: { fontSize: 15.5, fontFamily: 'Sora_700Bold', letterSpacing: 0.2 },

  pie:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  pieText: { fontSize: 13.5, fontFamily: 'Sora_400Regular' },
  pieLink: { fontSize: 13.5, fontFamily: 'Sora_700Bold' },
});

export default VerificationScreen;
