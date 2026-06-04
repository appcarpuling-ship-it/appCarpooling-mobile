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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { useColors } from '../../hooks/useColors';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(null); // 'google' | 'apple' | null
  const [showPassword, setShowPassword] = useState(false);
  const { login, loginWithGoogle, loginWithApple } = useAuth();
  const { showAlert } = useAlert();
  const { getCurrentThemeMode } = useColors();

  const isDarkMode  = getCurrentThemeMode() === 'dark';
  const bg          = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg      = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const border      = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted   = isDarkMode ? '#6B7280' : '#9CA3AF';

  const LOGO_SOURCE = isDarkMode
    ? require('../../../assets/logo/192x192-white.png')
    : require('../../../assets/logo/192x192-black.png');

  const version = Constants.expoConfig?.version ?? '1.0.0';

  const handleGoogleLogin = async () => {
    setSsoLoading('google');
    const result = await loginWithGoogle();
    setSsoLoading(null);
    if (!result.success && !result.cancelled) {
      showAlert('Error con Google', result.message || 'No se pudo iniciar sesión con Google.');
    }
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.header}>
            <Image source={LOGO_SOURCE} style={styles.logo} />
            <Text style={[styles.title, { color: textPrimary }]}>Carpuling</Text>
            <Text style={[styles.subtitle, { color: textMuted }]}>Viajá inteligente, ahorrá más</Text>
          </View>

          {/* Form card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={[styles.inputRow, { borderBottomColor: border }]}>
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
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: textPrimary }]}
                placeholder="Contraseña"
                placeholderTextColor={textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Login button */}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={isDarkMode ? '#000000' : '#FFFFFF'} />
              : <Text style={[styles.btnText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>Iniciar Sesión</Text>
            }
          </TouchableOpacity>

          {/* Divider SSO */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: border }]} />
            <Text style={[styles.dividerLabel, { color: textMuted }]}>o continuá con</Text>
            <View style={[styles.dividerLine, { backgroundColor: border }]} />
          </View>

          {/* Google */}
          <TouchableOpacity
            style={[styles.ssoBtn, { borderColor: border, backgroundColor: cardBg }, ssoLoading === 'google' && { opacity: 0.7 }]}
            onPress={handleGoogleLogin}
            disabled={!!ssoLoading}
            activeOpacity={0.85}
          >
            {ssoLoading === 'google'
              ? <ActivityIndicator color={textMuted} />
              : <>
                  <FontAwesome name="google" size={18} color="#DB4437" style={styles.ssoIcon} />
                  <Text style={[styles.ssoBtnText, { color: textPrimary }]}>Continuar con Google</Text>
                </>
            }
          </TouchableOpacity>

          {/* Apple (solo iOS) */}
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={isDarkMode
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={14}
              style={styles.appleBtn}
              onPress={handleAppleLogin}
            />
          )}

          {/* Forgot password */}
          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={[styles.linkText, { color: textMuted }]}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          {/* Register */}
          <View style={styles.registerRow}>
            <Text style={[styles.registerText, { color: textMuted }]}>¿No tenés cuenta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={[styles.registerLink, { color: textPrimary }]}>Registrate</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.version, { color: textMuted }]}>v{version}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:     { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  header:        { alignItems: 'center', marginBottom: 40 },
  logo:          { width: 64, height: 64, resizeMode: 'contain', marginBottom: 16 },
  title:         { fontSize: 28, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  subtitle:      { fontSize: 15 },
  card:          { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 16 },
  inputRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  inputIcon:     { marginRight: 10 },
  input:         { flex: 1, height: 52, fontSize: 15 },
  eyeBtn:        { padding: 8 },
  btn:           { borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  btnText:       { fontSize: 16, fontWeight: '700' },
  linkBtn:       { alignItems: 'center', paddingVertical: 12 },
  linkText:      { fontSize: 14 },
  registerRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  registerText:  { fontSize: 14 },
  registerLink:  { fontSize: 14, fontWeight: '600' },
  version:       { textAlign: 'center', fontSize: 12, marginTop: 32 },
  divider:       { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine:   { flex: 1, height: StyleSheet.hairlineWidth },
  dividerLabel:  { fontSize: 13, marginHorizontal: 12 },
  ssoBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, height: 54, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12 },
  ssoIcon:       { marginRight: 10 },
  ssoBtnText:    { fontSize: 15, fontWeight: '600' },
  appleBtn:      { height: 54, marginBottom: 12 },
});

export default LoginScreen;
