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
import FormInput from '../../components/forms/FormInput';
import FormPicker from '../../components/forms/FormPicker';
import LocationPickerField from '../../components/forms/LocationPickerField';
import { useGalleryPermissions } from '../../hooks/useGalleryPermissions';
import PermissionModal from '../../components/modals/PermissionModal';
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
    { firstName: '', lastName: '', email: '', password: '', confirmPassword: '', phone: '', gender: '', age: '', city: '', province: '', bio: '' },
    validationSchemas.register
  );

  const [avatarUri, setAvatarUri] = useState(null);
  const [dniFrontUri, setDniFrontUri] = useState(null);
  const [dniBackUri, setDniBackUri] = useState(null);
  const [loading, setLoading] = useState(false);
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
            <FormInput label="Edad" placeholder="18" leftIcon="calendar-outline" keyboardType="numeric" helper="Debés ser mayor de 18 años" required {...getFieldProps('age')} />
            <LocationPickerField
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
            <FormInput label="Biografía" placeholder="Contanos sobre vos (opcional)" leftIcon="document-text-outline" multiline numberOfLines={3} maxLength={500} helper="Máximo 500 caracteres" {...getFieldProps('bio')} />
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
          ScrollView) nunca recibia su onPress.

          El KeyboardAvoidingView envuelve SOLO el nav+scroll, no el botón: antes lo
          envolvía todo, y como el botón es hermano directo del ScrollView (no está
          adentro), el padding/alto que el teclado le agregaba al wrapper lo empujaba
          a él también — subía pegado al teclado en vez de quedarse fijo abajo. */}
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
          {currentStep === 0 ? (
            <Animated.View style={[{ opacity: stepAnim, marginBottom: 28 }]}>
              <Text style={[styles.stepTitle, { color: textPrimary }]}>{STEPS[0].title}</Text>
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
              <Text style={[styles.stepTitle, { color: textPrimary }]}>{STEPS[currentStep].title}</Text>
              <Text style={[styles.stepSubtitle, { color: textMuted }]}>{STEPS[currentStep].subtitle}</Text>
            </Animated.View>
          )}

          {/* Step content */}
          <Animated.View style={{ opacity: stepAnim }}>
            {renderStepContent()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fuera del KeyboardAvoidingView a propósito: fijo abajo siempre, el teclado no lo mueve. */}
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
  topNav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  backBtn:      { width: 40, height: 40, justifyContent: 'center' },
  dotsRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:          { height: 8, borderRadius: 4 },
  stepCounter:  { width: 40, textAlign: 'right', fontSize: 13, fontFamily: 'Sora_600SemiBold' },
  scrollContent:{ paddingHorizontal: 24, paddingBottom: 16 },
  avatarCenter:          { alignSelf: 'center', position: 'relative', marginBottom: 12 },
  avatarLarge:           { width: 130, height: 130, borderRadius: 65, borderWidth: 2 },
  avatarPlaceholderLarge: { width: 130, height: 130, borderRadius: 65, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center' },
  cameraBadge:           { position: 'absolute', bottom: 4, right: 4, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarHint:            { textAlign: 'center', fontSize: 13, marginBottom: 28, fontFamily: 'Sora_500Medium' },
  stepTitle:    { fontSize: 26, fontFamily: 'Sora_700Bold', marginBottom: 6 },
  stepSubtitle: { fontSize: 14 },
  btnContainer: { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 },
  btn:          { borderRadius: 999, height: 54, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  btnText:      { fontSize: 16, fontFamily: 'Sora_700Bold' },
  loginRow:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  loginText:    { fontSize: 14 },
  loginLink:    { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
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
