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
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFFFFF', '#F8F9FA', '#FFFFFF']}
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
                colors={['#6366F1', '#8B5CF6']}
                style={styles.iconContainer}
              >
                <Ionicons name="mail-outline" size={32} color="#FFF" />
              </LinearGradient>
              <Text style={styles.title}>Verificar Email</Text>
              <Text style={styles.subtitle}>
                Hemos enviado un código de verificación de 6 dígitos a:
              </Text>
              <Text style={styles.email}>{email}</Text>
            </View>

            {/* Verification Code Input */}
            <View style={styles.formContainer}>
              <Text style={styles.inputLabel}>Código de Verificación</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.textTertiary} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="000000"
                  placeholderTextColor={colors.placeholder}
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
                      ? [colors.surfaceElevated, colors.surface]
                      : ['#6366F1', '#8B5CF6']
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
                <Text style={styles.resendText}>¿No recibiste el código?</Text>
                <TouchableOpacity
                  onPress={handleResendCode}
                  disabled={resending}
                  activeOpacity={0.7}
                  style={styles.resendButton}
                >
                  {resending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <LinearGradient
                      colors={['#6366F1', '#8B5CF6']}
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
              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>¿Ya tienes tu código? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.loginLink}>Ir al Login</Text>
                </TouchableOpacity>
              </View>
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
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: safeColors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: safeColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: safeColors.primary,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  inputLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: safeColors.textPrimary,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: safeColors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: safeColors.border,
    paddingHorizontal: spacing.md,
    shadowColor: safeColors.primary,
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
    color: safeColors.textPrimary,
  },
  buttonContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#6366F1',
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
    color: safeColors.textSecondary,
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
    color: safeColors.textSecondary,
    fontSize: fontSize.md,
  },
  loginLink: {
    color: safeColors.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});

export default VerificationScreen;