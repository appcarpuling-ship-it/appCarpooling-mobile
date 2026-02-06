import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';


// Safe colors fallback to prevent 'colors is not defined' errors
const safeColors = (() => {
  try {
    const { colors } = require('./src/theme/colors');
    return colors;
  } catch {
    try {
      const { colors } = require('../theme/colors');
      return colors;
    } catch {
      try {
        const { colors } = require('../../theme/colors');
        return colors;
      } catch {
        return {
          background: '#FFFFFF', surface: '#F8F9FA', surfaceElevated: '#FFFFFF',
          textPrimary: '#000000', textSecondary: '#374151', textTertiary: '#6B7280',
          textMuted: '#9CA3AF', primary: '#6366F1', primaryDark: '#4F46E5',
          accent: '#A855F7', accentGreen: '#10B981', accentOrange: '#F59E0B',
          accentRed: '#EF4444', success: '#10B981', warning: '#F59E0B',
          error: '#EF4444', info: '#3B82F6', inputBackground: '#FFFFFF',
          inputBorder: '#D1D5DB', borderLight: '#F3F4F6', border: '#E5E7EB'
        };
      }
    }
  }
})();

const VerificationScreen = ({ route, navigation }) => {
  const { email } = route.params || {};
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { verifyEmail, resendVerification } = useAuth();
  const { isDarkMode } = useTheme();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      Alert.alert('Error', 'Por favor ingresa un código válido de 6 dígitos');
      return;
    }

    setLoading(true);

    try {
      const result = await verifyEmail(email, verificationCode);

      if (result.success) {
        Alert.alert(
          'Verificación Exitosa',
          'Tu cuenta ha sido verificada correctamente. Ya puedes iniciar sesión.',
          [
            {
              text: 'Continuar',
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
      } else {
        // Mostrar mensaje específico si es un problema de backend
        if (result.isBackendIssue) {
          Alert.alert(
            'Problema del Servidor',
            'Hay un problema con la verificación de email en el servidor. Por favor contacta al soporte técnico.\n\nDetalles técnicos:\n' +
            (result.errorDetails ?
              `Tipo: ${result.errorDetails.type}\nURL: ${result.errorDetails.url}\nEstatus: ${result.errorDetails.status || 'N/A'}` :
              result.message),
            [
              { text: 'Contactar Soporte', onPress: () => console.log('Contactar soporte') },
              { text: 'Intentar Después', style: 'cancel' }
            ]
          );
        } else {
          Alert.alert('Error', result.message || 'Código de verificación inválido');
        }
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Error al verificar el código');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);

    try {
      const result = await resendVerification(email);

      if (result.success) {
        Alert.alert('Código Enviado', 'Se ha enviado un nuevo código de verificación a tu email');
      } else {
        // Mostrar mensaje específico si es un problema de backend
        if (result.isBackendIssue) {
          Alert.alert(
            'Problema del Servidor',
            'No se puede reenviar el código debido a un problema en el servidor. Por favor contacta al soporte técnico.',
            [
              { text: 'Contactar Soporte', onPress: () => console.log('Contactar soporte') },
              { text: 'OK', style: 'cancel' }
            ]
          );
        } else {
          Alert.alert('Error', result.message || 'Error al enviar el código');
        }
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Error al enviar el código');
    } finally {
      setResending(false);
    }
  };

  const formatCode = (text) => {
    // Solo permitir números y limitar a 6 dígitos
    const cleaned = text.replace(/[^0-9]/g, '');
    return cleaned.slice(0, 6);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#161616' : '#FFFFFF' }]}>
      <LinearGradient
        colors={isDarkMode ? ['#161616', '#292929', '#161616'] : ['#FFFFFF', '#F8F9FA', '#FFFFFF']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <LinearGradient
                colors={isDarkMode ? ['#6B7280', '#4B5563'] : ['#6366F1', '#8B5CF6']}
                style={styles.iconContainer}
              >
                <Ionicons name="mail-outline" size={32} color="#FFF" />
              </LinearGradient>
              <Text style={[styles.title, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>Verificar Email</Text>
              <Text style={[styles.subtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Hemos enviado un código de verificación a:
              </Text>
              <Text style={[styles.email, { color: isDarkMode ? '#3B82F6' : '#6366F1' }]}>{email}</Text>
            </View>

            {/* Verification Code Input */}
            <View style={styles.formContainer}>
              <Text style={[styles.inputLabel, { color: isDarkMode ? '#FFFFFF' : '#1F2937', textAlign: 'center' }]}>Código de Verificación</Text>
              <View style={[styles.inputWrapper, { backgroundColor: isDarkMode ? '#292929' : '#F8F9FA', borderColor: isDarkMode ? '#404040' : '#E5E7EB' }]}>
                {/* <View style={styles.inputIconContainer}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                </View> */}
                <TextInput
                  style={[styles.input, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}
                  placeholder="000000"
                  placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                  value={verificationCode}
                  onChangeText={(text) => setVerificationCode(formatCode(text))}
                  keyboardType="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  textAlign="center"
                  letterSpacing={8}
                />
              </View>

              {/* Verify Button */}
              <TouchableOpacity
                onPress={handleVerify}
                disabled={loading || verificationCode.length !== 6}
                activeOpacity={0.8}
                style={[styles.buttonContainer, (loading || verificationCode.length !== 6) && styles.buttonDisabled]}
              >
                <LinearGradient
                  colors={
                    loading || verificationCode.length !== 6
                      ? [isDarkMode ? '#374151' : '#F3F4F6', isDarkMode ? '#292929' : '#E5E7EB']
                      : isDarkMode ? ['#6B7280', '#4B5563'] : ['#6366F1', '#8B5CF6']
                  }
                  style={styles.button}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                      <Text style={styles.buttonText}>Verificar Código</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Resend Code */}
              <View style={styles.resendContainer}>
                <Text style={[styles.resendText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>¿No recibiste el código?</Text>
                <TouchableOpacity
                  onPress={handleResendCode}
                  disabled={resending}
                  activeOpacity={0.7}
                  style={styles.resendButton}
                >
                  {resending ? (
                    <ActivityIndicator size="small" color={isDarkMode ? '#3B82F6' : '#6366F1'} />
                  ) : (
                    <LinearGradient
                      colors={isDarkMode ? ['#6B7280', '#4B5563'] : ['#6366F1', '#8B5CF6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.resendLinkGradient}
                    >
                      <Text style={styles.resendLink}>Reenviar Código</Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              </View>

              {/* Back to Login */}
              {/* <View style={styles.loginContainer}>
                <Text style={[styles.loginText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>¿Ya tienes tu código? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={[styles.loginLink, { color: isDarkMode ? '#3B82F6' : '#6366F1' }]}>Ir al Login</Text>
                </TouchableOpacity>
              </View> */}
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  inputLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    paddingHorizontal: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  inputIconContainer: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.lg,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  buttonContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonDisabled: {
    shadowOpacity: 0.1,
    elevation: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  buttonText: {
    color: '#FFF',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  resendText: {
    fontSize: fontSize.md,
    marginBottom: spacing.sm,
  },
  resendButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  resendLinkGradient: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  resendLink: {
    color: '#FFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  loginText: {
    fontSize: fontSize.md,
  },
  loginLink: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});

export default VerificationScreen;