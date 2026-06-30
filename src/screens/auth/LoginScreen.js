import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
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
import { useColors } from '../../hooks/useColors';
import SoraText from '../../components/SoraText';
import { SF, textStyles, shadows } from '../../theme/tokens';

const GOOGLE_START_URL = 'https://appcarpooling.onrender.com/api/auth/google/start';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [ssoLoading, setSsoLoading] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const { login, loginWithJwt, loginWithApple } = useAuth();
  const { showAlert } = useAlert();
  const { colors, isDarkMode, getCurrentThemeMode } = useColors();

  const LOGO_SOURCE = isDarkMode
    ? require('../../../assets/logo/192x192-white.png')
    : require('../../../assets/logo/192x192-black.png');

  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync();
    return () => { ScreenCapture.allowScreenCaptureAsync(); };
  }, []);

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const otaId = Updates.updateId ? Updates.updateId.replace(/-/g, '').slice(0, 8) : null;
  const versionLabel = otaId ? `v${version} · ${otaId}` : `v${version}`;

  const handleGoogleLogin = async () => {
    setSsoLoading('google');
    try {
      const redirectUrl = Linking.createURL('auth/google');
      const startUrl = `${GOOGLE_START_URL}?redirectUrl=${encodeURIComponent(redirectUrl)}`;
      const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUrl);
      if (result.type === 'success') {
        const params = new URLSearchParams(result.url.split('?')[1] || '');
        const token = params.get('token');
        const error = params.get('error');
        if (token) {
          const r = await loginWithJwt(token);
          if (!r.success) showAlert('Error con Google', r.message || 'No se pudo iniciar sesión.');
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
      showAlert('Ocurrió algo', 'Por favor completá todos los campos');
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) {
      if (result.requiresVerification) {
        navigation.replace('Verification', {
          email: (result.email || email).trim(),
          sendCodeOnMount: true,
        });
      } else {
        showAlert('No pudimos iniciar sesión', result.message || 'Revisá tus datos e intentá de nuevo.');
      }
    }
  };

  const inputBorderColor = (field) => {
    if (focusedField === field) return colors.textPrimary;
    return colors.border;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Image source={LOGO_SOURCE} style={styles.logo} />
            <SoraText style={[styles.brand, { color: colors.textPrimary }]}>
              Carpuling
            </SoraText>
            <SoraText style={[styles.tagline, { color: colors.textMuted }]}>
              Viajá inteligente, ahorrá más
            </SoraText>
          </View>

          {/* Form card */}
          <View style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              ...(isDarkMode ? {} : shadows.sm),
            },
          ]}>
            {/* Email */}
            <View style={[
              styles.inputRow,
              {
                borderBottomColor: colors.borderLight,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
            ]}>
              <Ionicons
                name="mail-outline"
                size={17}
                color={focusedField === 'email' ? colors.textPrimary : colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: colors.textPrimary, fontFamily: SF.regular }]}
                placeholder="Email"
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                selectionColor={colors.info}
              />
            </View>

            {/* Contraseña */}
            <View style={styles.inputRow}>
              <Ionicons
                name="lock-closed-outline"
                size={17}
                color={focusedField === 'password' ? colors.textPrimary : colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: colors.textPrimary, fontFamily: SF.regular }]}
                placeholder="Contraseña"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showPassword}
                autoComplete="password"
                selectionColor={colors.info}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={17}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Botón principal */}
          <TouchableOpacity
            style={[
              styles.btn,
              { backgroundColor: colors.textPrimary },
              loading && styles.btnDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={colors.background} />
              : <SoraText style={[styles.btnText, { color: colors.background }]}>
                  Iniciar Sesión
                </SoraText>
            }
          </TouchableOpacity>

          {/* Divisor SSO */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <SoraText style={[styles.dividerLabel, { color: colors.textMuted }]}>
              o continuá con
            </SoraText>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* SSO */}
          <View style={styles.ssoRow}>
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                style={[
                  styles.ssoBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    ...(isDarkMode ? {} : shadows.sm),
                  },
                  ssoLoading === 'google' && styles.btnDisabled,
                ]}
                onPress={handleGoogleLogin}
                disabled={!!ssoLoading}
                activeOpacity={0.8}
              >
                {ssoLoading === 'google'
                  ? <ActivityIndicator color={colors.textMuted} size="small" />
                  : <FontAwesome name="google" size={20} color="#DB4437" />
                }
              </TouchableOpacity>
            )}

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[
                  styles.ssoBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    ...(isDarkMode ? {} : shadows.sm),
                  },
                  ssoLoading === 'apple' && styles.btnDisabled,
                ]}
                onPress={handleAppleLogin}
                disabled={!!ssoLoading}
                activeOpacity={0.8}
              >
                {ssoLoading === 'apple'
                  ? <ActivityIndicator color={colors.textMuted} size="small" />
                  : <FontAwesome name="apple" size={22} color={colors.textPrimary} />
                }
              </TouchableOpacity>
            )}
          </View>

          {/* ¿Olvidaste tu contraseña? */}
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <SoraText style={[styles.linkText, { color: colors.textTertiary }]}>
              ¿Olvidaste tu contraseña?
            </SoraText>
          </TouchableOpacity>

          {/* Registro */}
          <View style={styles.registerRow}>
            <SoraText style={[styles.registerText, { color: colors.textMuted }]}>
              ¿No tenés cuenta?{' '}
            </SoraText>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <SoraText style={[styles.registerLink, { color: colors.textPrimary }]}>
                Registrate
              </SoraText>
            </TouchableOpacity>
          </View>

          <SoraText style={[styles.version, { color: colors.textMuted }]}>
            {versionLabel}
          </SoraText>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    marginBottom: 18,
  },
  brand: {
    ...textStyles.h1,
    marginBottom: 6,
  },
  tagline: {
    ...textStyles.body,
  },

  // Card del form
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    height: 54,
    fontSize: 15,
  },
  eyeBtn: { padding: 8 },

  // Botón principal
  btn: {
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { ...textStyles.button },

  // Divisor SSO
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerLabel: { ...textStyles.bodySm },

  // SSO
  ssoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 8,
  },
  ssoBtn: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Links
  linkBtn: { alignItems: 'center', paddingVertical: 14 },
  linkText: { ...textStyles.body },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  registerText: { ...textStyles.body },
  registerLink: { ...textStyles.label },
  version: {
    ...textStyles.caption,
    textAlign: 'center',
    marginTop: 36,
  },
});

export default LoginScreen;
