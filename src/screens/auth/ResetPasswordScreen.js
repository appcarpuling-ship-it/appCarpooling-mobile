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
import { Ionicons } from '@expo/vector-icons';
import { post_public } from '../../services/apiService';
import { useAlert } from '../../context/AlertContext';
import { ENDPOINTS } from '../../config/api';
import { spacing, borderRadius, fontSize } from '../../theme/colors';
import { useUI } from '../../theme/ui';

const ResetPasswordScreen = ({ navigation, route }) => {
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlert();
  const ui = useUI();

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
    if (!code) {
      showAlert('Ocurrió algo', 'Por favor ingresa el código de recuperación');
      return;
    }

    if (!newPassword) {
      showAlert('Ocurrió algo', 'Por favor ingresa tu nueva contraseña');
      return;
    }

    if (newPassword.length < 6) {
      showAlert('Ocurrió algo', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('Ocurrió algo', 'Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      await post_public(ENDPOINTS.RESET_PASSWORD, {
        email,
        code,
        newPassword,
      });

      navigation.navigate('Result', {
        type: 'success',
        title: 'Contraseña restablecida',
        message: 'Tu contraseña se ha cambiado exitosamente. Ya puedes iniciar sesión.',
        primaryLabel: 'Iniciar Sesión',
        onPrimary: () => navigation.navigate('Login'),
      });
    } catch (error) {
      showAlert('Ocurrió algo', error.message || 'Error al restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: ui.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
              <View style={[styles.logoContainer, { backgroundColor: ui.invertBg }]}>
                <Ionicons name="lock-open-outline" size={40} color={ui.invertText} />
              </View>
              <Text style={[styles.title, { color: ui.text }]}>Nueva Contraseña</Text>
              <Text style={[styles.subtitle, { color: ui.textMuted }]}>
                Ingresa el código que enviamos a {email} y tu nueva contraseña
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Code Input */}
              <View style={[styles.inputWrapper, { backgroundColor: ui.surface, borderColor: ui.border }]}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="keypad-outline" size={20} color={ui.textMuted} />
                </View>
                <TextInput
                  style={[styles.input, { color: ui.text }]}
                  placeholder="Código de 6 dígitos"
                  placeholderTextColor={ui.textMuted}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              {/* New Password Input */}
              <View style={[styles.inputWrapper, { backgroundColor: ui.surface, borderColor: ui.border }]}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color={ui.textMuted} />
                </View>
                <TextInput
                  style={[styles.input, { color: ui.text }]}
                  placeholder="Nueva contraseña"
                  placeholderTextColor={ui.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={ui.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Confirm Password Input */}
              <View style={[styles.inputWrapper, { backgroundColor: ui.surface, borderColor: ui.border }]}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color={ui.textMuted} />
                </View>
                <TextInput
                  style={[styles.input, { color: ui.text }]}
                  placeholder="Confirmar contraseña"
                  placeholderTextColor={ui.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>

              {/* Reset Button */}
              <TouchableOpacity
                onPress={handleResetPassword}
                disabled={loading}
                activeOpacity={0.8}
              >
                <View style={[styles.button, { backgroundColor: ui.invertBg }]}>
                  {loading ? (
                    <ActivityIndicator color={ui.invertText} />
                  ) : (
                    <Text style={[styles.buttonText, { color: ui.invertText }]}>Restablecer Contraseña</Text>
                  )}
                </View>
              </TouchableOpacity>

              {/* Back */}
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={[styles.linkText, { color: ui.text }]}>Volver</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontFamily: 'Sora_700Bold',
    textAlign: 'center',
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: fontSize.md,
    textAlign: 'center',
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
    borderRadius: borderRadius.md,
    borderWidth: 1,
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
  },
  button: {
    borderRadius: borderRadius.md,
    padding: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: 'Sora_600SemiBold',
  },
  linkButton: {
    marginTop: spacing.md,
    alignItems: 'center',
    padding: spacing.sm,
  },
  linkText: {
    fontSize: fontSize.sm,
  },
});

export default ResetPasswordScreen;
