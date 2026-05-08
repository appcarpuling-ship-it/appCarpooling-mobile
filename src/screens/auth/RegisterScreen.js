import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { useColors } from '../../hooks/useColors';
import { useFormValidation, validationSchemas } from '../../hooks/useFormValidation';
import FormInput from '../../components/forms/FormInput';
import FormPicker from '../../components/forms/FormPicker';
import { ARGENTINA_PROVINCES } from '../../constants/provinces';
import { useGalleryPermissions } from '../../hooks/useGalleryPermissions';
import PermissionModal from '../../components/modals/PermissionModal';

const STEPS = [
  { title: 'Sobre vos',       subtitle: 'Contanos quién sos',                              fields: ['firstName', 'lastName'] },
  { title: 'Tu cuenta',       subtitle: 'Creá tus credenciales de acceso',                  fields: ['email', 'password', 'confirmPassword'] },
  { title: 'Tus datos',       subtitle: 'Información de contacto y ubicación',              fields: ['phone', 'gender', 'age', 'province', 'city'] },
  { title: 'Últimos detalles',subtitle: 'Todo es opcional, podés completarlo después',      fields: [] },
];

const RegisterScreen = ({ navigation }) => {
  const { getCurrentThemeMode } = useColors();
  const { showAlert } = useAlert();

  const isDarkMode  = getCurrentThemeMode() === 'dark';
  const bg          = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg      = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const border      = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted   = isDarkMode ? '#6B7280' : '#9CA3AF';

  const [currentStep, setCurrentStep] = useState(0);
  const stepAnim = useRef(new Animated.Value(1)).current;

  const { values, errors, touched, setValue, setFieldTouched, validateAllFields, getFieldProps } = useFormValidation(
    { firstName: '', lastName: '', email: '', password: '', confirmPassword: '', phone: '', gender: '', age: '', city: '', province: '', bio: '', referralCode: '' },
    validationSchemas.register
  );

  const [avatarUri, setAvatarUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validatingReferral, setValidatingReferral] = useState(false);
  const [referralMessage, setReferralMessage] = useState('');
  const { register } = useAuth();

  const { pickImage: pickImageFromGallery, showPermissionModal, setShowPermissionModal, openSettings, forceRefreshPermissions } = useGalleryPermissions();

  const pickImage = async () => {
    const imageAsset = await pickImageFromGallery({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (imageAsset) setAvatarUri(imageAsset.uri);
  };

  const validateReferralCode = async (code) => {
    if (!code || code.trim().length === 0) { setReferralMessage(''); return; }
    setValidatingReferral(true);
    setReferralMessage('');
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/validate-referral/${code.toUpperCase()}`);
      const data = await response.json();
      setReferralMessage(data.success
        ? `Código válido. Referido por: ${data.data.referrerName}`
        : 'Código promocional no válido');
    } catch {
      setReferralMessage('Error al validar código');
    } finally {
      setValidatingReferral(false);
    }
  };

  const debounceRef = useRef();
  const handleReferralCodeChange = (text) => {
    setValue('referralCode', text.toUpperCase());
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => validateReferralCode(text), 500);
  };

  const animateToStep = (newStep) => {
    Animated.timing(stepAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setCurrentStep(newStep);
      Animated.timing(stepAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const handleNext = () => {
    const stepFields = STEPS[currentStep].fields;
    stepFields.forEach(field => setFieldTouched(field, true));
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
    if (currentStep > 0) animateToStep(currentStep - 1);
    else navigation.goBack();
  };

  const handleRegister = async () => {
    const { isValid: formIsValid, errors: formErrors } = validateAllFields();
    if (!formIsValid) {
      Object.keys(validationSchemas.register).forEach(field => setFieldTouched(field, true));
      const firstError = formErrors[Object.keys(formErrors)[0]];
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
      formDataToSend.append('gender', values.gender);
      formDataToSend.append('age', parseInt(values.age));
      formDataToSend.append('city', values.city);
      formDataToSend.append('province', values.province);
      if (values.bio) formDataToSend.append('bio', values.bio);
      if (values.referralCode?.trim()) formDataToSend.append('referralCode', values.referralCode.toUpperCase());
      if (avatarUri) {
        const filename = avatarUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        formDataToSend.append('avatar', { uri: avatarUri, name: filename, type: match ? `image/${match[1]}` : 'image/jpeg' });
      }
      const result = await register(formDataToSend);
      if (result.success) {
        showAlert('Registro exitoso', 'Te enviamos un código de verificación a tu email', [
          { text: 'OK', onPress: () => navigation.navigate('Verification', { email: values.email }) },
        ]);
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
            <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
              {avatarUri
                ? <Image source={{ uri: avatarUri }} style={[styles.avatar, { borderColor: border }]} />
                : <View style={[styles.avatarPlaceholder, { backgroundColor: cardBg, borderColor: border }]}>
                    <Ionicons name="camera" size={28} color={textMuted} />
                  </View>
              }
              <Text style={[styles.avatarText, { color: textMuted }]}>Foto de perfil (opcional)</Text>
            </TouchableOpacity>
            <FormInput label="Nombre" placeholder="Ingresá tu nombre" leftIcon="person-outline" autoCapitalize="words" required {...getFieldProps('firstName')} />
            <FormInput label="Apellido" placeholder="Ingresá tu apellido" leftIcon="person-outline" autoCapitalize="words" required {...getFieldProps('lastName')} />
          </>
        );
      case 1:
        return (
          <>
            <FormInput label="Email" placeholder="ejemplo@correo.com" leftIcon="mail-outline" keyboardType="email-address" autoCapitalize="none" autoComplete="email" required {...getFieldProps('email')} />
            <FormInput label="Contraseña" placeholder="Mínimo 8 caracteres" leftIcon="lock-closed-outline" secureTextEntry showPasswordToggle helper="Incluye mayúscula, minúscula, número y carácter especial" required {...getFieldProps('password')} />
            <FormInput label="Confirmar contraseña" placeholder="Repetí tu contraseña" leftIcon="lock-closed-outline" secureTextEntry showPasswordToggle required {...getFieldProps('confirmPassword')} />
          </>
        );
      case 2:
        return (
          <>
            <FormInput label="Teléfono" placeholder="+54 11 1234-5678" leftIcon="call-outline" keyboardType="phone-pad" helper="Formato: +54 código de área número" required {...getFieldProps('phone')} />
            <FormPicker
              label="Sexo"
              placeholder="Seleccioná una opción"
              leftIcon="person-outline"
              required
              value={values.gender}
              onSelect={(value) => setValue('gender', value)}
              error={touched.gender ? errors.gender : null}
              options={[
                { value: 'female', label: 'Femenino' },
                { value: 'male', label: 'Masculino' },
              ]}
            />
            <Text style={{ fontSize: 12, color: textMuted, marginTop: -10, marginBottom: 8 }}>
              No podrás cambiar el sexo después del registro.
            </Text>
            <FormInput label="Edad" placeholder="18" leftIcon="calendar-outline" keyboardType="numeric" helper="Debés ser mayor de 18 años" maxLength={2} required {...getFieldProps('age')} />
            <FormPicker label="Provincia" placeholder="Seleccioná tu provincia" leftIcon="map-outline" required value={values.province} onSelect={(value) => setValue('province', value)} error={touched.province ? errors.province : null} options={ARGENTINA_PROVINCES} />
            <FormInput label="Ciudad" placeholder="Ingresá tu ciudad" leftIcon="location-outline" autoCapitalize="words" required {...getFieldProps('city')} />
          </>
        );
      case 3:
        return (
          <>
            <FormInput label="Biografía" placeholder="Contanos sobre vos (opcional)" leftIcon="document-text-outline" multiline numberOfLines={3} maxLength={500} helper="Máximo 500 caracteres" {...getFieldProps('bio')} />
            <FormInput label="Código promocional" placeholder="Ej: JP1234 (opcional)" leftIcon="gift-outline" value={values.referralCode} onChangeText={handleReferralCodeChange} autoCapitalize="characters" maxLength={8} helper="Si tenés un código de un amigo, ingresalo para obtener 20% de descuento" />
            {(validatingReferral || referralMessage) && (
              <View style={{ marginTop: -8, marginBottom: 16 }}>
                {validatingReferral
                  ? <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={textMuted} />
                      <Text style={[styles.referralMsg, { color: textMuted }]}>  Validando código...</Text>
                    </View>
                  : <Text style={[styles.referralMsg, { color: referralMessage.includes('válido') && !referralMessage.includes('no') ? '#10B981' : '#EF4444' }]}>
                      {referralMessage}
                    </Text>
                }
              </View>
            )}
          </>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Top nav */}
        <View style={styles.topNav}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={textPrimary} />
          </TouchableOpacity>
          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { width: i === currentStep ? 24 : 8, backgroundColor: i <= currentStep ? textPrimary : border },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.stepCounter, { color: textMuted }]}>{currentStep + 1}/{STEPS.length}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Step header */}
          <Animated.View style={{ opacity: stepAnim, marginBottom: 28 }}>
            <Text style={[styles.stepTitle, { color: textPrimary }]}>{STEPS[currentStep].title}</Text>
            <Text style={[styles.stepSubtitle, { color: textMuted }]}>{STEPS[currentStep].subtitle}</Text>
          </Animated.View>

          {/* Step content */}
          <Animated.View style={{ opacity: stepAnim }}>
            {renderStepContent()}
          </Animated.View>

          {/* Action button */}
          {currentStep < STEPS.length - 1 ? (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }]}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>Siguiente</Text>
              <Ionicons name="arrow-forward" size={18} color={isDarkMode ? '#000000' : '#FFFFFF'} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={isDarkMode ? '#000000' : '#FFFFFF'} />
                : <Text style={[styles.btnText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>Crear cuenta</Text>
              }
            </TouchableOpacity>
          )}

          {/* Login link — solo primer paso */}
          {currentStep === 0 && (
            <View style={styles.loginRow}>
              <Text style={[styles.loginText, { color: textMuted }]}>¿Ya tenés cuenta? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={[styles.loginLink, { color: textPrimary }]}>Iniciá sesión</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Permisos de Galería"
        message="Para seleccionar una foto de perfil necesitamos acceso a tu galería. Ve a configuración y habilitá los permisos para esta aplicación."
        onOpenSettings={openSettings}
        onRefreshPermissions={forceRefreshPermissions}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1 },
  topNav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  backBtn:      { width: 40, height: 40, justifyContent: 'center' },
  dotsRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:          { height: 8, borderRadius: 4 },
  stepCounter:  { width: 40, textAlign: 'right', fontSize: 13, fontWeight: '600' },
  scrollContent:{ paddingHorizontal: 24, paddingBottom: 40 },
  stepTitle:    { fontSize: 26, fontWeight: '700', marginBottom: 6 },
  stepSubtitle: { fontSize: 14 },
  avatarContainer: { alignItems: 'center', marginBottom: 24 },
  avatar:       { width: 96, height: 96, borderRadius: 48, borderWidth: 2 },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center' },
  avatarText:   { marginTop: 10, fontSize: 13 },
  btn:          { borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', marginTop: 8, marginBottom: 8 },
  btnText:      { fontSize: 16, fontWeight: '700' },
  loginRow:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  loginText:    { fontSize: 14 },
  loginLink:    { fontSize: 14, fontWeight: '600' },
  referralMsg:  { fontSize: 12, fontWeight: '500' },
});

export default RegisterScreen;
