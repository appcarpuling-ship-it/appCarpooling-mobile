import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Image,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import { useFormValidation, validationSchemas } from '../../hooks/useFormValidation';
import FormInput from '../../components/FormInput';
import FormPicker from '../../components/FormPicker';
import { ARGENTINA_PROVINCES } from '../../constants/provinces';
import { useGalleryPermissions } from '../../hooks/useGalleryPermissions';
import PermissionModal from '../../components/PermissionModal';


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

const RegisterScreen = ({ navigation }) => {
  // Usar el hook de validación
  const {
    values,
    errors,
    touched,
    setValue,
    setFieldTouched,
    validateAllFields,
    getFieldProps,
    isValid,
  } = useFormValidation(
    {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
      age: '',
      city: '',
      province: '',
      bio: '',
    },
    validationSchemas.register
  );

  const [avatarUri, setAvatarUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

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


  const {
    pickImage: pickImageFromGallery,
    showPermissionModal,
    setShowPermissionModal,
    openSettings,
    forceRefreshPermissions,
  } = useGalleryPermissions();

  const pickImage = async () => {
    const imageAsset = await pickImageFromGallery({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (imageAsset) {
      setAvatarUri(imageAsset.uri);
    }
  };

  const handleRegister = async () => {
    // Validar todos los campos
    const { isValid: formIsValid, errors: formErrors } = validateAllFields();

    if (!formIsValid) {
      // Marcar todos los campos como tocados para mostrar errores
      Object.keys(validationSchemas.register).forEach(field => {
        setFieldTouched(field, true);
      });

      // Mostrar el primer error encontrado
      const firstErrorField = Object.keys(formErrors)[0];
      const firstError = formErrors[firstErrorField];
      Alert.alert('Error de validación', firstError);
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();

      // Agregar campos
      formDataToSend.append('firstName', values.firstName);
      formDataToSend.append('lastName', values.lastName);
      formDataToSend.append('email', values.email);
      formDataToSend.append('password', values.password);
      formDataToSend.append('phone', values.phone);
      formDataToSend.append('age', parseInt(values.age));
      formDataToSend.append('city', values.city);
      formDataToSend.append('province', values.province);

      if (values.bio) {
        formDataToSend.append('bio', values.bio);
      }

      // Agregar avatar si existe
      if (avatarUri) {
        const filename = avatarUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formDataToSend.append('avatar', {
          uri: avatarUri,
          name: filename,
          type,
        });
      }

      const result = await register(formDataToSend);

      if (result.success) {
        Alert.alert(
          'Registro exitoso',
          'Te hemos enviado un código de verificación a tu email',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Verification', { email: values.email })
            }
          ]
        );
      } else {
        Alert.alert('Error', result.message || 'Error al registrar usuario');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Error al registrar usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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
              {/* Header */}
              <View style={styles.header}>
                <LinearGradient
                  colors={['#1F2937', '#111827']}
                  style={styles.logoContainer}
                >
                  <Ionicons name="person-add" size={32} color="#FFF" />
                </LinearGradient>
                <Text style={styles.title}>Crear Cuenta</Text>
                <Text style={styles.subtitle}>Únete a la comunidad de Carpooling</Text>
              </View>

              {/* Avatar */}
              <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="camera" size={32} color="#6B7280" />
                  </View>
                )}
                <Text style={styles.avatarText}>Foto de Perfil (opcional)</Text>
              </TouchableOpacity>

              {/* Form */}
              <View style={styles.form}>
                {/* Nombre */}
                <FormInput
                  label="Nombre"
                  placeholder="Ingresa tu nombre"
                  leftIcon="person-outline"
                  autoCapitalize="words"
                  required
                  {...getFieldProps('firstName')}
                />

                {/* Apellido */}
                <FormInput
                  label="Apellido"
                  placeholder="Ingresa tu apellido"
                  leftIcon="person-outline"
                  autoCapitalize="words"
                  required
                  {...getFieldProps('lastName')}
                />

                {/* Email */}
                <FormInput
                  label="Email"
                  placeholder="ejemplo@correo.com"
                  leftIcon="mail-outline"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  required
                  {...getFieldProps('email')}
                />

                {/* Teléfono */}
                <FormInput
                  label="Teléfono"
                  placeholder="+54 11 1234-5678"
                  leftIcon="call-outline"
                  keyboardType="phone-pad"
                  helper="Formato: +54 código de área número"
                  required
                  {...getFieldProps('phone')}
                />

                {/* Edad */}
                <FormInput
                  label="Edad"
                  placeholder="18"
                  leftIcon="calendar-outline"
                  keyboardType="numeric"
                  helper="Debes ser mayor de 18 años"
                  maxLength={2}
                  required
                  {...getFieldProps('age')}
                />

                {/* Provincia */}
                <FormPicker
                  label="Provincia"
                  placeholder="Selecciona tu provincia"
                  leftIcon="map-outline"
                  required
                  value={values.province}
                  onSelect={(value) => setValue('province', value)}
                  error={touched.province ? errors.province : null}
                  options={ARGENTINA_PROVINCES}
                />

                {/* Ciudad */}
                <FormInput
                  label="Ciudad"
                  placeholder="Ingresa tu ciudad"
                  leftIcon="location-outline"
                  autoCapitalize="words"
                  required
                  {...getFieldProps('city')}
                />

                {/* Contraseña */}
                <FormInput
                  label="Contraseña"
                  placeholder="Mínimo 8 caracteres"
                  leftIcon="lock-closed-outline"
                  secureTextEntry
                  showPasswordToggle
                  helper="Incluye mayúscula, minúscula, número y carácter especial"
                  required
                  {...getFieldProps('password')}
                />

                {/* Confirmar Contraseña */}
                <FormInput
                  label="Confirmar Contraseña"
                  placeholder="Repite tu contraseña"
                  leftIcon="lock-closed-outline"
                  secureTextEntry
                  showPasswordToggle
                  required
                  {...getFieldProps('confirmPassword')}
                />

                {/* Biografía */}
                <FormInput
                  label="Biografía"
                  placeholder="Cuéntanos sobre ti (opcional)"
                  leftIcon="document-text-outline"
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                  helper="Máximo 500 caracteres"
                  {...getFieldProps('bio')}
                />

                {/* Register Button */}
                <TouchableOpacity
                  onPress={handleRegister}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#1F2937', '#111827']}
                    style={styles.button}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Registrarse</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Login Link */}
              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>¿Ya tienes cuenta? </Text>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#1F2937', '#111827']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.loginLinkGradient}
                  >
                    <Text style={styles.loginLink}>Inicia Sesión</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
      
      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Permisos de Galería"
        message="Para seleccionar una foto de perfil necesitamos acceso a tu galería. Ve a configuración y habilita los permisos para esta aplicación."
        onOpenSettings={openSettings}
        onRefreshPermissions={forceRefreshPermissions}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: safeColors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: safeColors.textSecondary,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#1F2937',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: safeColors.surface,
    borderWidth: 2,
    borderColor: safeColors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: safeColors.textSecondary,
  },
  form: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: safeColors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: safeColors.border,
    paddingHorizontal: spacing.md,
  },
  inputIconContainer: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: safeColors.textPrimary,
  },
  eyeIcon: {
    padding: spacing.sm,
  },
  textAreaWrapper: {
    alignItems: 'flex-start',
  },
  textAreaIconContainer: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  pickerText: {
    fontSize: fontSize.md,
    color: safeColors.textPrimary,
  },
  pickerPlaceholder: {
    color: safeColors.placeholder,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: safeColors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: safeColors.border,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: safeColors.textPrimary,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalList: {
    padding: spacing.md,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    backgroundColor: safeColors.background,
  },
  modalItemSelected: {
    backgroundColor: safeColors.surfaceElevated,
    borderWidth: 2,
    borderColor: safeColors.primary,
  },
  modalItemText: {
    fontSize: fontSize.md,
    color: safeColors.textPrimary,
  },
  modalItemTextSelected: {
    color: safeColors.primary,
    fontWeight: fontWeight.semiBold,
  },
  button: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonText: {
    color: '#FFF',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  loginText: {
    color: safeColors.textSecondary,
    fontSize: fontSize.md,
  },
  loginLinkGradient: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  loginLink: {
    color: '#FFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    letterSpacing: 0.3,
  },
});

export default RegisterScreen;
