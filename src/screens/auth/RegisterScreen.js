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
  Image,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { useTheme } from '../../context/ThemeContext';
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

const STEPS = [
  {
    title: 'Sobre vos',
    subtitle: 'Cuéntanos quién sos',
    fields: ['firstName', 'lastName'],
  },
  {
    title: 'Tu cuenta',
    subtitle: 'Crea tus credenciales de acceso',
    fields: ['email', 'password', 'confirmPassword'],
  },
  {
    title: 'Tus datos',
    subtitle: 'Información de contacto y ubicación',
    fields: ['phone', 'age', 'province', 'city'],
  },
  {
    title: 'Últimos detalles',
    subtitle: 'Todo es opcional, puedes completarlo después',
    fields: [],
  },
];

const RegisterScreen = ({ navigation }) => {
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();

  const [currentStep, setCurrentStep] = useState(0);
  const stepAnim = useRef(new Animated.Value(1)).current;

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
      referralCode: '',
    },
    validationSchemas.register
  );

  const [avatarUri, setAvatarUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validatingReferral, setValidatingReferral] = useState(false);
  const [referralMessage, setReferralMessage] = useState('');
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

  const validateReferralCode = async (code) => {
    if (!code || code.trim().length === 0) {
      setReferralMessage('');
      return;
    }

    setValidatingReferral(true);
    setReferralMessage('');

    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/validate-referral/${code.toUpperCase()}`);
      const data = await response.json();

      if (data.success) {
        setReferralMessage(`✅ ${data.data.message} Referido por: ${data.data.referrerName}`);
      } else {
        setReferralMessage('❌ Código promocional no válido');
      }
    } catch (error) {
      setReferralMessage('❌ Error al validar código');
    } finally {
      setValidatingReferral(false);
    }
  };

  const debounceRef = useRef();
  const handleReferralCodeChange = (text) => {
    setValue('referralCode', text.toUpperCase());

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      validateReferralCode(text);
    }, 500);
  };

  // Animar transición entre pasos
  const animateToStep = (newStep) => {
    Animated.timing(stepAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep(newStep);
      Animated.timing(stepAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNext = () => {
    const stepFields = STEPS[currentStep].fields;
    // Marcar los campos del paso actual como tocados para mostrar errores
    stepFields.forEach(field => setFieldTouched(field, true));
    // Validar todos los campos y filtrar sólo los del paso actual
    const { errors: allErrors } = validateAllFields();
    const hasErrors = stepFields.some(field => allErrors[field]);
    if (hasErrors) {
      const firstError = stepFields.map(f => allErrors[f]).find(Boolean);
      if (firstError) showAlert('Error de validación', firstError);
      return;
    }
    animateToStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      animateToStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleRegister = async () => {
    const { isValid: formIsValid, errors: formErrors } = validateAllFields();

    if (!formIsValid) {
      Object.keys(validationSchemas.register).forEach(field => {
        setFieldTouched(field, true);
      });

      const firstErrorField = Object.keys(formErrors)[0];
      const firstError = formErrors[firstErrorField];
      showAlert('Error de validación', firstError);
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();

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

      if (values.referralCode?.trim()) {
        formDataToSend.append('referralCode', values.referralCode.toUpperCase());
      }

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
        showAlert(
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
        showAlert('Error', result.message || 'Error al registrar usuario');
      }
    } catch (error) {
      showAlert('Error', error.message || 'Error al registrar usuario');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <>
            {/* Avatar */}
            <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={[styles.avatar, { borderColor: isDarkMode ? '#6B7280' : '#1F2937' }]} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#292929' : '#F8F9FA', borderColor: isDarkMode ? '#404040' : '#E5E7EB' }]}>
                  <Ionicons name="camera" size={32} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                </View>
              )}
              <Text style={[styles.avatarText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Foto de Perfil (opcional)</Text>
            </TouchableOpacity>

            <FormInput
              label="Nombre"
              placeholder="Ingresa tu nombre"
              leftIcon="person-outline"
              autoCapitalize="words"
              required
              {...getFieldProps('firstName')}
            />
            <FormInput
              label="Apellido"
              placeholder="Ingresa tu apellido"
              leftIcon="person-outline"
              autoCapitalize="words"
              required
              {...getFieldProps('lastName')}
            />
          </>
        );

      case 1:
        return (
          <>
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
            <FormInput
              label="Confirmar Contraseña"
              placeholder="Repite tu contraseña"
              leftIcon="lock-closed-outline"
              secureTextEntry
              showPasswordToggle
              required
              {...getFieldProps('confirmPassword')}
            />
          </>
        );

      case 2:
        return (
          <>
            <FormInput
              label="Teléfono"
              placeholder="+54 11 1234-5678"
              leftIcon="call-outline"
              keyboardType="phone-pad"
              helper="Formato: +54 código de área número"
              required
              {...getFieldProps('phone')}
            />
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
            <FormInput
              label="Ciudad"
              placeholder="Ingresa tu ciudad"
              leftIcon="location-outline"
              autoCapitalize="words"
              required
              {...getFieldProps('city')}
            />
          </>
        );

      case 3:
        return (
          <>
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
            <FormInput
              label="Código Promocional"
              placeholder="Ej: JP1234 (opcional)"
              leftIcon="gift-outline"
              value={values.referralCode}
              onChangeText={handleReferralCodeChange}
              autoCapitalize="characters"
              maxLength={8}
              helper="Si tienes un código promocional de un amigo, ingrésalo aquí para obtener 20% de descuento"
            />

            {(validatingReferral || referralMessage) && (
              <View style={{ marginTop: -8, marginBottom: 16, marginLeft: 4 }}>
                {validatingReferral ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={isDarkMode ? '#3B82F6' : '#6366F1'} />
                    <Text style={{ marginLeft: 8, fontSize: 12, color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                      Validando código...
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={{
                      fontSize: 12,
                      color: referralMessage.includes('✅') ? '#10B981' : '#EF4444',
                      fontWeight: '500'
                    }}
                  >
                    {referralMessage}
                  </Text>
                )}
              </View>
            )}
          </>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#161616' : '#FFFFFF' }]}>
      <LinearGradient
        colors={isDarkMode ? ['#161616', '#292929', '#161616'] : ['#FFFFFF', '#F8F9FA', '#FFFFFF']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Top nav: back + progress dots + contador */}
          <Animated.View style={[styles.topNav, { opacity: fadeAnim }]}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color={isDarkMode ? '#FFFFFF' : '#1F2937'} />
            </TouchableOpacity>

            <View style={styles.progressContainer}>
              {STEPS.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    { width: index === currentStep ? 24 : 8 },
                    index <= currentStep
                      ? { backgroundColor: isDarkMode ? '#FFFFFF' : '#1F2937' }
                      : { backgroundColor: isDarkMode ? '#404040' : '#E5E7EB' },
                  ]}
                />
              ))}
            </View>

            <Text style={[styles.stepCounter, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
              {currentStep + 1}/{STEPS.length}
            </Text>
          </Animated.View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
              {/* Título y subtítulo del paso */}
              <Animated.View style={[styles.stepHeader, { opacity: stepAnim }]}>
                <Text style={[styles.title, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                  {STEPS[currentStep].title}
                </Text>
                <Text style={[styles.subtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                  {STEPS[currentStep].subtitle}
                </Text>
              </Animated.View>

              {/* Contenido del paso */}
              <Animated.View style={[styles.form, { opacity: stepAnim }]}>
                {renderStepContent()}
              </Animated.View>

              {/* Botón de acción */}
              <Animated.View style={{ opacity: stepAnim }}>
                {currentStep < STEPS.length - 1 ? (
                  <TouchableOpacity onPress={handleNext} activeOpacity={0.8}>
                    <LinearGradient
                      colors={isDarkMode ? ['#FFFFFF', '#FFFFFF'] : ['#1F2937', '#111827']}
                      style={styles.button}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={[styles.buttonText, { color: isDarkMode ? '#000000' : '#FFF' }]}>
                        Siguiente
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={18}
                        color={isDarkMode ? '#000000' : '#FFF'}
                        style={{ marginLeft: 8 }}
                      />
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handleRegister}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={isDarkMode ? ['#FFFFFF', '#FFFFFF'] : ['#1F2937', '#111827']}
                      style={styles.button}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {loading ? (
                        <ActivityIndicator color={isDarkMode ? '#000000' : '#fff'} />
                      ) : (
                        <Text style={[styles.buttonText, { color: isDarkMode ? '#000000' : '#FFF' }]}>
                          Crear cuenta
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </Animated.View>

              {/* Link a Login — sólo en el primer paso */}
              {currentStep === 0 && (
                <View style={styles.loginContainer}>
                  <Text style={[styles.loginText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>¿Ya tienes cuenta? </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Login')}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={isDarkMode ? ['#FFFFFF', '#FFFFFF'] : ['#1F2937', '#111827']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.loginLinkGradient}
                    >
                      <Text style={[styles.loginLink, { color: isDarkMode ? '#000000' : '#FFF' }]}>Inicia Sesión</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
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
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },

  // Top nav
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    height: 8,
    borderRadius: 4,
  },
  stepCounter: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    width: 40,
    textAlign: 'right',
  },

  // Scroll
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },

  // Step header
  stepHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
  },

  // Avatar
  avatarContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
  },

  // Form
  form: {
    width: '100%',
    marginBottom: spacing.lg,
  },

  // Buttons
  button: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  buttonText: {
    color: '#FFF',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },

  // Login link
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  loginText: {
    fontSize: fontSize.md,
  },
  loginLinkGradient: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    shadowColor: '#000000',
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
