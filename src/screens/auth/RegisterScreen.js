import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { appendFile } from '../../utils/formDataFile';
import { useUI } from '../../theme/ui';
import { useFormValidation, validationSchemas } from '../../hooks/useFormValidation';
import LineInput from '../../components/auth/LineInput';
import AuthHero from '../../components/auth/AuthHero';
import FormPicker from '../../components/forms/FormPicker';
import LocationPickerField from '../../components/forms/LocationPickerField';
import { useGalleryPermissions } from '../../hooks/useGalleryPermissions';
import PermissionModal from '../../components/modals/PermissionModal';
import { get_public } from '../../services/apiService';
import * as ScreenCapture from 'expo-screen-capture';

const STEPS = [
  { title: 'Sobre vos',       subtitle: 'Contanos quién sos',                              fields: ['firstName', 'lastName'] },
  { title: 'Tu cuenta',       subtitle: 'Creá tus credenciales de acceso',                  fields: ['email', 'password', 'confirmPassword'] },
  { title: 'Tus datos',       subtitle: 'Información de contacto y ubicación',              fields: ['phone', 'gender', 'age', 'province', 'city'] },
  { title: 'Últimos detalles', subtitle: 'Bio y código opcionales. DNI: lo pedimos a todos los usuarios para verificar identidad (podés subirlo después en perfil).', fields: [] },
];

const RegisterScreen = ({ navigation }) => {
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync();
    return () => { ScreenCapture.allowScreenCaptureAsync(); };
  }, []);

  const { showAlert } = useAlert();

  const ui          = useUI();
  const bg          = ui.bg;
  const cardBg      = ui.surface;
  const border      = ui.border;
  const textPrimary = ui.text;
  const textMuted   = ui.textMuted;

  const [currentStep, setCurrentStep] = useState(0);
  const stepAnim = useRef(new Animated.Value(1)).current;

  const { values, errors, touched, setValue, setFieldTouched, validateAllFields, getFieldProps } = useFormValidation(
    { firstName: '', lastName: '', email: '', password: '', confirmPassword: '', phone: '', gender: '', age: '', city: '', province: '', bio: '', referralCode: '' },
    validationSchemas.register
  );

  const [avatarUri, setAvatarUri] = useState(null);
  const [dniFrontUri, setDniFrontUri] = useState(null);
  const [dniBackUri, setDniBackUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validatingReferral, setValidatingReferral] = useState(false);
  const [referralMessage, setReferralMessage] = useState('');
  const { register } = useAuth();

  const { pickImage: pickImageFromGallery, takePhoto, showPermissionModal, setShowPermissionModal, openSettings, forceRefreshPermissions } = useGalleryPermissions();

  /** Cámara o galería: sacar la foto en el momento evita tener que guardarla antes (sobre todo el DNI). */
  const chooseImageSource = (options, onPicked) => {
    const handle = async (getAsset) => {
      const imageAsset = await getAsset(options);
      if (!imageAsset) return;
      const uri = imageAsset.uri || imageAsset.assets?.[0]?.uri;
      if (uri) onPicked(uri);
    };

    showAlert('Agregar foto', '¿De dónde la querés sacar?', [
      { text: 'Cámara', onPress: () => handle(takePhoto) },
      { text: 'Galería', onPress: () => handle(pickImageFromGallery) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const pickImage = () => {
    chooseImageSource(
      { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 },
      setAvatarUri
    );
  };

  const appendRegisterImage = (formData, fieldName, uri) =>
    appendFile(formData, fieldName, uri, `${fieldName}.jpg`);

  const pickDniSide = (side) => {
    chooseImageSource(
      // Sin allowsEditing: recortar el DNI le come datos al OCR de la tarjeta.
      { mediaTypes: ['images'], allowsEditing: false, quality: 0.85 },
      (uri) => (side === 'front' ? setDniFrontUri(uri) : setDniBackUri(uri))
    );
  };

  const validateReferralCode = async (code) => {
    if (!code || code.trim().length === 0) { setReferralMessage(''); return; }
    setValidatingReferral(true);
    setReferralMessage('');
    try {
      const data = await get_public(`/users/validate-referral/${code.toUpperCase()}`);
      setReferralMessage(data.success
        ? `Código válido. Referido por: ${data.data.referrerName}`
        : 'Código promocional no válido');
    } catch (err) {
      // 404 = código no existe; cualquier otro error = problema de red
      const msg = err?.response?.data?.message;
      setReferralMessage(msg || 'Código promocional no válido');
    } finally {
      setValidatingReferral(false);
    }
  };

  const debounceRef = useRef();
  const handleReferralCodeChange = (text) => {
    setValue('referralCode', text.toUpperCase());
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => validateReferralCode(text), 1000);
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
      await appendRegisterImage(formDataToSend, 'avatar', avatarUri);
      await appendRegisterImage(formDataToSend, 'dniFront', dniFrontUri);
      await appendRegisterImage(formDataToSend, 'dniBack', dniBackUri);
      const result = await register(formDataToSend);
      if (result.success) {
        navigation.navigate('Result', {
          type: 'success',
          title: 'Registro exitoso',
          message: 'Te enviamos un código de verificación a tu email. Recuerda revisar la carpeta (spam).',
          primaryLabel: 'Continuar',
          onPrimary: () => navigation.navigate('Verification', { email: values.email }),
        });
      } else {
        navigation.navigate('Result', { type: 'error', title: 'Ocurrió algo', message: result.message || 'Error al registrar usuario' });
      }
    } catch (error) {
      navigation.navigate('Result', { type: 'error', title: 'Ocurrió algo', message: error.message || 'Error al registrar usuario' });
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <>
            <LineInput label="Nombre" placeholder="Ingresá tu nombre" leftIcon="person-outline" autoCapitalize="words" required {...getFieldProps('firstName')} />
            <LineInput label="Apellido" placeholder="Ingresá tu apellido" leftIcon="person-outline" autoCapitalize="words" required {...getFieldProps('lastName')} />
          </>
        );
      case 1:
        return (
          <>
            <LineInput label="Email" placeholder="ejemplo@correo.com" leftIcon="mail-outline" keyboardType="email-address" autoCapitalize="none" autoComplete="email" required {...getFieldProps('email')} />
            <LineInput label="Contraseña" placeholder="Mínimo 8 caracteres" leftIcon="lock-closed-outline" secureTextEntry showPasswordToggle helper="Incluye mayúscula, minúscula, número y carácter especial" required {...getFieldProps('password')} />
            <LineInput label="Confirmar contraseña" placeholder="Repetí tu contraseña" leftIcon="lock-closed-outline" secureTextEntry showPasswordToggle required {...getFieldProps('confirmPassword')} />
          </>
        );
      case 2:
        return (
          <>
            <LineInput label="Teléfono" placeholder="+54 11 1234-5678" leftIcon="call-outline" keyboardType="phone-pad" helper="Formato: +54 código de área número" required {...getFieldProps('phone')} />
            <FormPicker
              variant="line"
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
            <Text style={{ fontSize: 12, fontFamily: 'Sora_400Regular', color: textMuted, marginTop: -12 }}>
              No podrás cambiar el sexo después del registro.
            </Text>
            <LineInput label="Edad" placeholder="18" leftIcon="calendar-outline" keyboardType="numeric" helper="Debés ser mayor de 18 años" required {...getFieldProps('age')} />
            <LocationPickerField
              variant="line"
              province={values.province}
              city={values.city}
              onProvinceChange={(value) => { setValue('province', value); setValue('city', ''); setFieldTouched('province', true); }}
              onCityChange={(value) => { setValue('city', value); setFieldTouched('city', true); }}
              provinceError={touched.province ? errors.province : null}
              cityError={touched.city ? errors.city : null}
            />
          </>
        );
      case 3:
        return (
          <>
            <LineInput label="Biografía" placeholder="Contanos sobre vos (opcional)" leftIcon="document-text-outline" multiline numberOfLines={3} maxLength={500} helper="Máximo 500 caracteres" {...getFieldProps('bio')} />
            <LineInput label="Código promocional" placeholder="Ej: JP1234 (opcional)" leftIcon="gift-outline" value={values.referralCode} onChangeText={handleReferralCodeChange} autoCapitalize="characters" maxLength={6} helper="Si tenés un código de un amigo, ingresalo para obtener 20% de descuento" />
            {(validatingReferral || referralMessage) && (
              <View style={{ marginTop: -8, marginBottom: 16 }}>
                {validatingReferral
                  ? <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={textMuted} />
                      <Text style={[styles.referralMsg, { color: textMuted }]}>  Validando código...</Text>
                    </View>
                  : <Text style={[styles.referralMsg, { color: textPrimary }]}>
                      {referralMessage}
                    </Text>
                }
              </View>
            )}
            <Text style={[styles.dniSectionTitle, { color: textPrimary }]}>Documentación (DNI)</Text>
            <Text style={[styles.dniHint, { color: textMuted }]}>
              Lo pedimos a todos (conductores y pasajeros) para verificar tu identidad. Necesitamos frente y dorso. Podés cargarlos ahora o después en Editar perfil.
            </Text>
            <View style={styles.dniRow}>
              <TouchableOpacity
                style={[styles.dniCard, { borderColor: border, backgroundColor: cardBg }]}
                onPress={() => pickDniSide('front')}
                activeOpacity={0.85}
              >
                {dniFrontUri ? (
                  <Image source={{ uri: dniFrontUri }} style={styles.dniThumb} />
                ) : (
                  <View style={styles.dniPlaceholder}>
                    <Ionicons name="id-card-outline" size={28} color={textMuted} />
                    <Text style={[styles.dniCardLabel, { color: textMuted }]}>Frente</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dniCard, { borderColor: border, backgroundColor: cardBg }]}
                onPress={() => pickDniSide('back')}
                activeOpacity={0.85}
              >
                {dniBackUri ? (
                  <Image source={{ uri: dniBackUri }} style={styles.dniThumb} />
                ) : (
                  <View style={styles.dniPlaceholder}>
                    <Ionicons name="id-card-outline" size={28} color={textMuted} />
                    <Text style={[styles.dniCardLabel, { color: textMuted }]}>Dorso</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      {/* Sin TouchableWithoutFeedback envolviendo todo: con el teclado abierto se
          comia el primer tap para cerrarlo y el boton de abajo (fuera del
          ScrollView) nunca recibia su onPress. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Volver + barra segmentada. Es la misma que usa el alta de viaje: un solo lenguaje
            de "vas por acá" en toda la app. El texto dice el paso Y su título, que los
            puntitos solos no podían. */}
        <View style={styles.topNav}>
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.backBtn, { backgroundColor: ui.surface, borderColor: border }]}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="chevron-back" size={22} color={textPrimary} />
          </TouchableOpacity>
        </View>

        {/* `automaticallyAdjustKeyboardInsets`: iOS ajusta el contentInset solo con el
            teclado y sube el campo enfocado, sin JS de por medio. Reemplaza a
            KeyboardAwareScrollView, que llamaba a APIs del renderer viejo
            (UIManager.viewIsDescendantOf / measureInWindow sobre findNodeHandle) que en la
            New Architecture de Expo SDK 54 ya no existen. */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          <AuthHero height={132} />

          <View style={styles.stepper}>
            <View style={styles.stepperBarra}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[styles.stepperTramo, { backgroundColor: i <= currentStep ? textPrimary : border }]}
                />
              ))}
            </View>
            <Text style={[styles.stepperTexto, { color: textMuted }]}>
              Paso {currentStep + 1} de {STEPS.length} · {STEPS[currentStep].title}
            </Text>
          </View>

          {currentStep === 0 ? (
            <Animated.View style={[{ opacity: stepAnim, marginBottom: 28 }]}>
              <Text style={[styles.stepTitle, { color: textPrimary }]}>Creá tu cuenta</Text>
              <Text style={[styles.stepSubtitle, { color: textMuted, marginBottom: 28 }]}>{STEPS[0].subtitle}</Text>
              <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={styles.avatarCenter}>
                {avatarUri
                  ? <Image source={{ uri: avatarUri }} style={[styles.avatarLarge, { borderColor: border }]} />
                  : <View style={[styles.avatarPlaceholderLarge, { backgroundColor: cardBg, borderColor: border }]}>
                      <Ionicons name="camera-outline" size={40} color={textMuted} />
                    </View>
                }
                <View style={[styles.cameraBadge, { backgroundColor: ui.surface }]}>
                  <Ionicons name="camera" size={14} color={textPrimary} />
                </View>
              </TouchableOpacity>
              <Text style={[styles.avatarHint, { color: avatarUri ? textPrimary : textMuted }]}>
                {avatarUri ? 'Foto cargada' : 'Tocá para agregar tu foto'}
              </Text>
            </Animated.View>
          ) : (
            <Animated.View style={{ opacity: stepAnim, marginBottom: 28 }}>
              <Text style={[styles.stepTitle, { color: textPrimary }]}>Creá tu cuenta</Text>
              <Text style={[styles.stepSubtitle, { color: textMuted }]}>{STEPS[currentStep].subtitle}</Text>
            </Animated.View>
          )}

          {/* `gap` en el contenedor y no un margen por campo: los componentes de formulario
              traían el suyo propio y, al mezclarlos, el label de un campo quedaba pegado a la
              línea del anterior. */}
          <Animated.View style={[styles.campos, { opacity: stepAnim }]}>
            {renderStepContent()}
          </Animated.View>
        </ScrollView>

        {/* Action button — always at bottom */}
        <View style={[styles.btnContainer, { backgroundColor: bg }]}>
          {currentStep < STEPS.length - 1 ? (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: ui.invertBg }]}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnText, { color: ui.invertText }]}>Siguiente</Text>
              <Ionicons name="arrow-forward" size={18} color={ui.invertText} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: ui.invertBg }, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={ui.invertText} />
                : <Text style={[styles.btnText, { color: ui.invertText }]}>Crear cuenta</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Permisos de Galería"
        message="Para elegir foto de perfil o DNI necesitamos acceso a tu galería. Ve a configuración y habilitá los permisos para esta aplicación."
        onOpenSettings={openSettings}
        onRefreshPermissions={forceRefreshPermissions}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1 },
  topNav:       { paddingHorizontal: 26, paddingTop: 4, paddingBottom: 0 },
  backBtn:      { width: 44, height: 44, borderRadius: 999, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  stepper:      { gap: 9, marginTop: 4, marginBottom: 20 },
  stepperBarra: { flexDirection: 'row', gap: 6 },
  stepperTramo: { flex: 1, height: 3, borderRadius: 999 },
  stepperTexto: { fontSize: 12.5, fontFamily: 'Sora_600SemiBold' },
  scrollContent:{ paddingHorizontal: 26, paddingBottom: 16 },
  campos:       { gap: 20 },
  avatarCenter:          { alignSelf: 'center', position: 'relative', marginBottom: 12 },
  avatarLarge:           { width: 130, height: 130, borderRadius: 65, borderWidth: 2 },
  avatarPlaceholderLarge: { width: 130, height: 130, borderRadius: 65, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center' },
  cameraBadge:           { position: 'absolute', bottom: 4, right: 4, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarHint:            { textAlign: 'center', fontSize: 13, marginBottom: 28, fontFamily: 'Sora_500Medium' },
  stepTitle:    { fontSize: 27, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.6, lineHeight: 33, marginBottom: 8 },
  stepSubtitle: { fontSize: 14.5, fontFamily: 'Sora_400Regular', lineHeight: 21 },
  btnContainer: { paddingHorizontal: 26, paddingBottom: 16, paddingTop: 8 },
  btn:          { borderRadius: 999, height: 56, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  btnText:      { fontSize: 16, fontFamily: 'Sora_700Bold' },
  loginRow:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  loginText:    { fontSize: 14 },
  loginLink:    { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  referralMsg:  { fontSize: 12, fontFamily: 'Sora_500Medium' },
  dniSectionTitle: { fontSize: 15, fontFamily: 'Sora_700Bold', marginTop: 8, marginBottom: 6 },
  dniHint: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  dniRow: { flexDirection: 'row', gap: 12 },
  dniCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    aspectRatio: 1.55,
    maxHeight: 118,
  },
  dniThumb: { width: '100%', height: '100%' },
  dniPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
  dniCardLabel: { fontSize: 12, fontFamily: 'Sora_600SemiBold', marginTop: 6 },
});

export default RegisterScreen;
