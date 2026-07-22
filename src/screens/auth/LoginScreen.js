import React, { useState, useEffect } from 'react';
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
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import * as ScreenCapture from 'expo-screen-capture';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { useUI } from '../../theme/ui';
import PillButton from '../../components/ui/PillButton';
import { API_CONFIG } from '../../config/api';

// Derivado de la API configurada (EXPO_PUBLIC_API_BASE_URL / eas.json), no clavado:
// antes apuntaba siempre a producción y el SSO de un build dev terminaba en el server equivocado.
const GOOGLE_START_URL = `${API_CONFIG.BASE_URL}/auth/google/start`;

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(null); // 'google' | 'apple' | null
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null); // 'email' | 'password' | null
  const { login, loginWithJwt, loginWithApple } = useAuth();
  const { showAlert } = useAlert();
  const ui = useUI();

  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync();
    return () => { ScreenCapture.allowScreenCaptureAsync(); };
  }, []);

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const otaId = Updates.updateId ? Updates.updateId.replace(/-/g, '').slice(0, 8) : null;
  const versionLabel = otaId ? `v${version} - ${otaId}` : `v${version}`;

  const handleGoogleLogin = async () => {
    setSsoLoading('google');
    try {
      const redirectUrl = Linking.createURL('auth/google');
      const startUrl = `${GOOGLE_START_URL}?redirectUrl=${encodeURIComponent(redirectUrl)}`;
      const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUrl);

      if (result.type === 'success') {
        // Linking.parse es el parser canónico de Expo: URLSearchParams de React Native
        // no decodifica de forma confiable el deep link y devolvía un token corrupto
        // que el backend rechazaba ("Token inválido o expirado").
        const { queryParams } = Linking.parse(result.url);
        const token = queryParams?.token;
        const error = queryParams?.error;
        if (token) {
          const loginResult = await loginWithJwt(token);
          if (!loginResult.success) showAlert('Error con Google', loginResult.message || 'No se pudo iniciar sesión.');
        } else if (error !== 'cancelled') {
          showAlert('Error con Google', 'No se pudo completar el inicio de sesión.');
        }
      }
    } catch (e) {
      showAlert('Error con Google', e.message || 'Error inesperado.');
    }
    setSsoLoading(null);
  };

  const handleAppleLogin = async () => {
    setSsoLoading('apple');
    const result = await loginWithApple();
    setSsoLoading(null);
    if (!result.success && !result.cancelled) {
      showAlert('Error con Apple', result.message || 'No se pudo iniciar sesión con Apple.');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Ocurrió algo', 'Por favor completa todos los campos');
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) {
      if (result.requiresVerification) {
        const verificationEmail = (result.email || email).trim();
        navigation.replace('Verification', {
          email: verificationEmail,
          sendCodeOnMount: true,
        });
      } else {
        showAlert('No pudimos iniciar sesión', result.message || 'Revisá tus datos e intentá de nuevo.');
      }
    }
  };

  // El foco se marca con un borde del color del texto: es el único "acento"
  // disponible en una paleta blanco y negro.
  const fieldStyle = (name) => [
    styles.field,
    { backgroundColor: ui.surface, borderColor: focused === name ? ui.text : 'transparent' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ui.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <Text style={[styles.title, { color: ui.text }]}>
            Hola de nuevo,{'\n'}
            <Text style={styles.titleStrong}>iniciá sesión</Text>
          </Text>
          <Text style={[styles.subtitle, { color: ui.textMuted }]}>Viajá inteligente, ahorrá más.</Text>

          <View style={styles.form}>
            <View style={fieldStyle('email')}>
              <Ionicons name="mail-outline" size={18} color={ui.textMuted} />
              <TextInput
                style={[styles.input, { color: ui.text }]}
                placeholder="Email"
                placeholderTextColor={ui.textMuted}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={fieldStyle('password')}>
              <Ionicons name="lock-closed-outline" size={18} color={ui.textMuted} />
              <TextInput
                style={[styles.input, { color: ui.text }]}
                placeholder="Contraseña"
                placeholderTextColor={ui.textMuted}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={ui.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgot} onPress={() => navigation.navigate('ForgotPassword')} hitSlop={8}>
              <Text style={[styles.forgotText, { color: ui.textMuted }]}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </View>

          <PillButton label="Iniciar sesión" onPress={handleLogin} loading={loading} style={styles.cta} />

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: ui.border }]} />
            <Text style={[styles.dividerLabel, { color: ui.textMuted }]}>o continuá con</Text>
            <View style={[styles.dividerLine, { backgroundColor: ui.border }]} />
          </View>

          <View style={styles.ssoRow}>
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                style={[styles.sso, { backgroundColor: ui.surface }, ssoLoading === 'google' && styles.off]}
                onPress={handleGoogleLogin}
                disabled={!!ssoLoading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Continuar con Google"
              >
                {ssoLoading === 'google'
                  ? <ActivityIndicator color={ui.textMuted} size="small" />
                  : <FontAwesome name="google" size={20} color={ui.text} />
                }
              </TouchableOpacity>
            )}

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.sso, { backgroundColor: ui.surface }, ssoLoading === 'apple' && styles.off]}
                onPress={handleAppleLogin}
                disabled={!!ssoLoading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Continuar con Apple"
              >
                {ssoLoading === 'apple'
                  ? <ActivityIndicator color={ui.textMuted} size="small" />
                  : <FontAwesome name="apple" size={22} color={ui.text} />
                }
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.registerRow}>
            <Text style={[styles.registerText, { color: ui.textMuted }]}>¿No tenés cuenta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')} hitSlop={8}>
              <Text style={[styles.registerLink, { color: ui.text }]}>Registrate</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.version, { color: ui.textMuted }]}>{versionLabel}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  title:        { fontFamily: 'Sora_300Light', fontSize: 34, lineHeight: 42, letterSpacing: -1 },
  titleStrong:  { fontFamily: 'Sora_800ExtraBold' },
  subtitle:     { fontFamily: 'Sora_400Regular', fontSize: 15, marginTop: 12 },
  form:         { marginTop: 36, gap: 12 },
  field:        { flexDirection: 'row', alignItems: 'center', gap: 12, height: 58, borderRadius: 18, paddingHorizontal: 18, borderWidth: 1.5 },
  input:        { flex: 1, fontFamily: 'Sora_400Regular', fontSize: 15 },
  forgot:       { alignSelf: 'flex-end', paddingVertical: 4 },
  forgotText:   { fontFamily: 'Sora_500Medium', fontSize: 13 },
  cta:          { marginTop: 24 },
  divider:      { flexDirection: 'row', alignItems: 'center', marginVertical: 28 },
  dividerLine:  { flex: 1, height: StyleSheet.hairlineWidth },
  dividerLabel: { fontFamily: 'Sora_400Regular', fontSize: 13, marginHorizontal: 12 },
  ssoRow:       { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  sso:          { width: 64, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  off:          { opacity: 0.5 },
  registerRow:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 32 },
  registerText: { fontFamily: 'Sora_400Regular', fontSize: 14 },
  registerLink: { fontFamily: 'Sora_600SemiBold', fontSize: 14 },
  version:      { fontFamily: 'Sora_400Regular', textAlign: 'center', fontSize: 12, marginTop: 28 },
});

export default LoginScreen;
