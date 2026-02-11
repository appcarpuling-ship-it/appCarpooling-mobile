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
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { post_public } from '../../services/apiService';
import { useAlert } from '../../context/AlertContext';
import { ENDPOINTS } from '../../config/api';
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

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlert();

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

  const handleResetPassword = async () => {
    if (!email) {
      showAlert('Error', 'Por favor ingresa tu email');
      return;
    }

    setLoading(true);
    try {
      const response = await post_public(ENDPOINTS.FORGOT_PASSWORD, { email });

      showAlert(
        'Éxito',
        'Se ha enviado un enlace de recuperación a tu email',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    } catch (error) {
      showAlert('Error', error.message || 'Error al enviar el email');
    } finally {
      setLoading(false);
    }
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
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }
              ]}
            >
              {/* Logo y título */}
              <View style={styles.header}>
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6']}
                  style={styles.logoContainer}
                >
                  <Ionicons name="key-outline" size={40} color="#FFF" />
                </LinearGradient>
                <Text style={styles.title}>Recuperar Contraseña</Text>
                <Text style={styles.subtitle}>
                  Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña
                </Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                {/* Email Input */}
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconContainer}>
                    <Ionicons name="mail-outline" size={20} color={colors.textTertiary} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={colors.placeholder}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>

                {/* Reset Password Button */}
                <TouchableOpacity
                  onPress={handleResetPassword}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    style={styles.button}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Enviar Enlace</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Back to Login */}
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={styles.linkText}>Volver al inicio de sesión</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: safeColors.background,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: safeColors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
    color: safeColors.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: fontSize.md,
    textAlign: 'center',
    color: safeColors.textSecondary,
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  form: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: safeColors.inputBackground,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: safeColors.inputBorder,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  inputIconContainer: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: safeColors.textPrimary,
  },
  button: {
    borderRadius: borderRadius.md,
    padding: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
    shadowColor: safeColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: safeColors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
  },
  linkButton: {
    marginTop: spacing.md,
    alignItems: 'center',
    padding: spacing.sm,
  },
  linkText: {
    color: safeColors.primary,
    fontSize: fontSize.sm,
  },
});

export default ForgotPasswordScreen;
