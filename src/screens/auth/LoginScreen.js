import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import * as ScreenCapture from 'expo-screen-capture';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { API_CONFIG } from '../../config/api';
import { useUI } from '../../theme/ui';
import AuthHero from '../../components/auth/AuthHero';
import LineInput from '../../components/auth/LineInput';

// Derivado de la API configurada (EXPO_PUBLIC_API_BASE_URL / eas.json), no clavado:
// antes apuntaba siempre a producción y el SSO de un build dev terminaba en el server equivocado.
const GOOGLE_START_URL = `${API_CONFIG.BASE_URL}/auth/google/start`;

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(null); // 'google' | 'apple' | null
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

  // En web no hay SSO nativo: el bloque entero (divisor incluido) no va.
  const mostrarSSO = Platform.OS !== 'web';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ui.bg }]} edges={['bottom']}>
      {/* `automaticallyAdjustKeyboardInsets` lo resuelve iOS del lado nativo; en Android
          app.json ya tiene softwareKeyboardLayoutMode: 'resize'. Sin librerías de teclado. */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <AuthHero height={240} />

        <View style={styles.cuerpo}>
          <View style={styles.titulo}>
            <Text style={[styles.h1, { color: ui.text }]}>Carpuling</Text>
            <Text style={[styles.sub, { color: ui.textMuted }]}>Viajá inteligente, ahorrá más</Text>
          </View>

          <View style={styles.campos}>
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
            <LineInput
              label="Contraseña"
              icon="lock-closed-outline"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              showPasswordToggle
              autoComplete="password"
            />
            <TouchableOpacity
              style={styles.olvide}
              onPress={() => navigation.navigate('ForgotPassword')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.olvideText, { color: ui.text }]}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: ui.invertBg }, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={ui.invertText} />
              : <Text style={[styles.btnText, { color: ui.invertText }]}>Iniciar Sesión</Text>
            }
          </TouchableOpacity>

          {mostrarSSO && (
            <>
              <View style={styles.divisor}>
                <View style={[styles.linea, { backgroundColor: ui.border }]} />
                <Text style={[styles.divisorText, { color: ui.textMuted }]}>o continuá con</Text>
                <View style={[styles.linea, { backgroundColor: ui.border }]} />
              </View>

              <View style={styles.sso}>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity
                    style={[styles.ssoBtn, { backgroundColor: ui.surface, borderColor: ui.border }, ssoLoading === 'google' && { opacity: 0.6 }]}
                    onPress={handleGoogleLogin}
                    disabled={!!ssoLoading}
                    activeOpacity={0.85}
                  >
                    {ssoLoading === 'google'
                      ? <ActivityIndicator color={ui.textMuted} size="small" />
                      : <>
                          <FontAwesome name="google" size={18} color="#DB4437" />
                          <Text style={[styles.ssoText, { color: ui.text }]}>Continuar con Google</Text>
                        </>
                    }
                  </TouchableOpacity>
                )}

                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[styles.ssoBtn, { backgroundColor: ui.surface, borderColor: ui.border }, ssoLoading === 'apple' && { opacity: 0.6 }]}
                    onPress={handleAppleLogin}
                    disabled={!!ssoLoading}
                    activeOpacity={0.85}
                  >
                    {ssoLoading === 'apple'
                      ? <ActivityIndicator color={ui.textMuted} size="small" />
                      : <>
                          <FontAwesome name="apple" size={19} color={ui.text} />
                          <Text style={[styles.ssoText, { color: ui.text }]}>Continuar con Apple</Text>
                        </>
                    }
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          <View style={styles.pie}>
            <Text style={[styles.pieText, { color: ui.textMuted }]}>¿No tenés cuenta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={[styles.pieLink, { color: ui.text }]}>Registrate</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.version, { color: ui.textMuted }]}>{versionLabel}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { flexGrow: 1, paddingBottom: 28 },
  cuerpo:    { paddingHorizontal: 26, gap: 20, marginTop: 4 },

  titulo: { gap: 8 },
  h1:     { fontSize: 32, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.6, lineHeight: 38 },
  sub:    { fontSize: 14.5, fontFamily: 'Sora_400Regular', lineHeight: 21 },

  campos:     { gap: 13 },
  olvide:     { alignSelf: 'flex-end', paddingTop: 2 },
  olvideText: { fontSize: 13, fontFamily: 'Sora_600SemiBold' },

  btn:     { height: 56, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  btnText: { fontSize: 15.5, fontFamily: 'Sora_700Bold', letterSpacing: 0.2 },

  divisor:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  linea:       { flex: 1, height: 1 },
  divisorText: { fontSize: 12.5, fontFamily: 'Sora_400Regular' },

  sso:     { gap: 11 },
  ssoBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 999, borderWidth: 1 },
  ssoText: { fontSize: 14.5, fontFamily: 'Sora_600SemiBold' },

  pie:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  pieText: { fontSize: 13.5, fontFamily: 'Sora_400Regular' },
  pieLink: { fontSize: 13.5, fontFamily: 'Sora_700Bold' },

  version: { textAlign: 'center', fontSize: 11.5, fontFamily: 'Sora_400Regular', marginTop: 4 },
});

export default LoginScreen;
