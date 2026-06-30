import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Keyboard, Platform, ScrollView, Image, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { useColors } from '../../hooks/useColors';
import { useFormValidation } from '../../hooks/useFormValidation';
import FormInput from '../../components/forms/FormInput';
import FormPicker from '../../components/forms/FormPicker';
import LocationPickerField from '../../components/forms/LocationPickerField';
import { useGalleryPermissions } from '../../hooks/useGalleryPermissions';
import PermissionModal from '../../components/modals/PermissionModal';
import { put_withauth_formdata } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';

const STEPS = [
  { title: 'Sobre vos',        subtitle: 'Contanos quién sos',                        fields: ['firstName', 'lastName'] },
  { title: 'Tus datos',        subtitle: 'Información de contacto y ubicación',        fields: ['phone', 'gender', 'age', 'province', 'city'] },
  { title: 'Últimos detalles', subtitle: 'Bio opcional y verificación de identidad',   fields: [] },
];

const completeProfileSchema = {
  firstName: ['required', { type: 'maxLength', value: 50 }],
  lastName:  ['required', { type: 'maxLength', value: 50 }],
  phone:     ['required', 'phone'],
  gender:    ['required'],
  age:       ['required', 'age'],
  province:  ['required'],
  city:      ['required', { type: 'maxLength', value: 100 }],
  bio:       [{ type: 'maxLength', value: 500 }],
};

const isPlaceholder = (name) =>
  !name || ['Usuario', 'Google', 'Apple'].includes(name);

const CompleteProfileScreen = () => {
  const { user, updateProfile, refreshUser, logout } = useAuth();
  const { showAlert } = useAlert();
  const { getCurrentThemeMode } = useColors();

  const isDarkMode  = getCurrentThemeMode() === 'dark';
  const bg          = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg      = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const border      = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted   = isDarkMode ? '#6B7280' : '#9CA3AF';

  const [currentStep, setCurrentStep] = useState(0);
  const stepAnim = useRef(new Animated.Value(1)).current;

  const initialValues = {
    firstName: isPlaceholder(user?.firstName) ? '' : (user?.firstName || ''),
    lastName:  isPlaceholder(user?.lastName)  ? '' : (user?.lastName  || ''),
    phone: '', gender: '', age: '', city: '', province: '', bio: '',
  };

  const { values, errors, touched, setValue, setFieldTouched, validateAllFields, getFieldProps } = useFormValidation(
    initialValues, completeProfileSchema
  );

  const [avatarUri,   setAvatarUri]   = useState(null);
  const [dniFrontUri, setDniFrontUri] = useState(null);
  const [dniBackUri,  setDniBackUri]  = useState(null);
  const [loading, setLoading] = useState(false);

  const { pickImage: pickFromGallery, showPermissionModal, setShowPermissionModal, openSettings, forceRefreshPermissions } = useGalleryPermissions();

  const pickAvatar = async () => {
    const asset = await pickFromGallery({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (asset) { const uri = asset.uri || asset.assets?.[0]?.uri; if (uri) setAvatarUri(uri); }
  };

  const pickDni = async (side) => {
    const asset = await pickFromGallery({ mediaTypes: ['images'], allowsEditing: false, quality: 0.85 });
    if (!asset) return;
    const uri = asset.uri || asset.assets?.[0]?.uri;
    if (!uri) return;
    if (side === 'front') setDniFrontUri(uri);
    else setDniBackUri(uri);
  };

  const appendImage = (fd, field, uri) => {
    if (!uri) return;
    const filename = uri.split('/').pop() || `${field}.jpg`;
    const ext = (/\.(\w+)$/.exec(filename)?.[1] || 'jpeg').replace('jpg', 'jpeg');
    fd.append(field, { uri, name: filename.includes('.') ? filename : `${filename}.jpg`, type: `image/${ext}` });
  };

  const animateToStep = (next) => {
    Animated.timing(stepAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setCurrentStep(next);
      Animated.timing(stepAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const handleNext = () => {
    const fields = STEPS[currentStep].fields;
    fields.forEach(f => setFieldTouched(f, true));
    const { errors: stepErrors } = validateAllFields();
    const hasError = fields.some(f => stepErrors[f]);
    if (hasError) {
      const msg = fields.map(f => stepErrors[f]).find(Boolean);
      showAlert('Error de validación', msg);
      return;
    }
    animateToStep(currentStep + 1);
  };

  const handleSave = async () => {
    const requiredFields = ['firstName', 'lastName', 'phone', 'gender', 'age', 'province', 'city'];
    requiredFields.forEach(f => setFieldTouched(f, true));
    const { isValid, errors: allErrors } = validateAllFields();
    if (!isValid) {
      const msg = requiredFields.map(f => allErrors[f]).find(Boolean);
      if (msg) { showAlert('Error de validación', msg); return; }
    }

    setLoading(true);
    try {
      // 1. Actualizar perfil con FormData (permite avatar)
      const fd = new FormData();
      fd.append('firstName', values.firstName);
      fd.append('lastName',  values.lastName);
      fd.append('phone',     values.phone);
      fd.append('gender',    values.gender);
      fd.append('age',       parseInt(values.age));
      fd.append('city',      values.city);
      fd.append('province',  values.province);
      if (values.bio?.trim()) fd.append('bio', values.bio);
      appendImage(fd, 'avatar', avatarUri);

      const profileResult = await put_withauth_formdata(ENDPOINTS.UPDATE_PROFILE, fd);
      if (!profileResult.success) {
        showAlert('Error', profileResult.message || 'No se pudo guardar el perfil.');
        setLoading(false);
        return;
      }

      // 2. Subir DNI si se cargó
      if (dniFrontUri || dniBackUri) {
        const dniFd = new FormData();
        appendImage(dniFd, 'dniFront', dniFrontUri);
        appendImage(dniFd, 'dniBack',  dniBackUri);
        await put_withauth_formdata(ENDPOINTS.UPLOAD_DNI, dniFd);
      }

      await refreshUser();
      // AppNavigator detecta user.phone y navega a Main automáticamente
    } catch (e) {
      showAlert('Error', e.message || 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: return (
        <>
          <FormInput label="Nombre"   placeholder="Ingresá tu nombre"   leftIcon="person-outline" autoCapitalize="words" required {...getFieldProps('firstName')} />
          <FormInput label="Apellido" placeholder="Ingresá tu apellido" leftIcon="person-outline" autoCapitalize="words" required {...getFieldProps('lastName')} />
        </>
      );
      case 1: return (
        <>
          <FormInput label="Teléfono" placeholder="+54 11 1234-5678" leftIcon="call-outline" keyboardType="phone-pad" helper="Formato: +54 código de área número" required {...getFieldProps('phone')} />
          <FormPicker
            label="Sexo" placeholder="Seleccioná una opción" leftIcon="person-outline" required
            value={values.gender} onSelect={(v) => setValue('gender', v)}
            error={touched.gender ? errors.gender : null}
            options={[{ value: 'female', label: 'Femenino' }, { value: 'male', label: 'Masculino' }]}
          />
          <Text style={{ fontSize: 12, color: textMuted, marginTop: -10, marginBottom: 8 }}>No podrás cambiar el sexo después.</Text>
          <FormInput label="Edad" placeholder="18" leftIcon="calendar-outline" keyboardType="numeric" helper="Debés ser mayor de 18 años" required {...getFieldProps('age')} />
          <LocationPickerField
            province={values.province}
            city={values.city}
            onProvinceChange={(v) => { setValue('province', v); setValue('city', ''); setFieldTouched('province', true); }}
            onCityChange={(v) => { setValue('city', v); setFieldTouched('city', true); }}
            provinceError={touched.province ? errors.province : null}
            cityError={touched.city ? errors.city : null}
          />
        </>
      );
      case 2: return (
        <>
          <FormInput label="Sobre vos" placeholder="Contanos sobre vos (opcional)" leftIcon="document-text-outline" multiline numberOfLines={3} maxLength={500} helper="Máximo 500 caracteres" {...getFieldProps('bio')} />
          <Text style={[styles.dniTitle, { color: textPrimary }]}>Documentación (DNI)</Text>
          <Text style={[styles.dniHint, { color: textMuted }]}>
            Necesitamos frente y dorso para verificar tu identidad. Podés cargarlo ahora o después en Editar perfil.
          </Text>
          <View style={styles.dniRow}>
            {[{ key: 'front', uri: dniFrontUri, label: 'Frente' }, { key: 'back', uri: dniBackUri, label: 'Dorso' }].map(({ key, uri, label }) => (
              <TouchableOpacity key={key} style={[styles.dniCard, { borderColor: border, backgroundColor: cardBg }]} onPress={() => pickDni(key)} activeOpacity={0.85}>
                {uri
                  ? <Image source={{ uri }} style={styles.dniThumb} />
                  : <View style={styles.dniPlaceholder}>
                      <Ionicons name="id-card-outline" size={28} color={textMuted} />
                      <Text style={[styles.dniLabel, { color: textMuted }]}>{label}</Text>
                    </View>
                }
              </TouchableOpacity>
            ))}
          </View>
        </>
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <TouchableWithoutFeedback onPress={Platform.OS !== 'web' ? Keyboard.dismiss : undefined} accessible={false}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

          {/* Top nav */}
          <View style={styles.topNav}>
            <TouchableOpacity
              onPress={currentStep > 0 ? () => animateToStep(currentStep - 1) : logout}
              style={styles.exitBtn}
            >
              <Ionicons
                name={currentStep > 0 ? 'arrow-back' : 'log-out-outline'}
                size={22}
                color={textPrimary}
              />
            </TouchableOpacity>
            <View style={styles.dotsRow}>
              {STEPS.map((_, i) => (
                <View key={i} style={[styles.dot, { width: i === currentStep ? 24 : 8, backgroundColor: i <= currentStep ? textPrimary : border }]} />
              ))}
            </View>
            <Text style={[styles.counter, { color: textMuted }]}>{currentStep + 1}/{STEPS.length}</Text>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {currentStep === 0 ? (
              <Animated.View style={[{ opacity: stepAnim, marginBottom: 28 }]}>
                <Text style={[styles.stepTitle, { color: textPrimary }]}>{STEPS[0].title}</Text>
                <Text style={[styles.stepSubtitle, { color: textMuted, marginBottom: 28 }]}>{STEPS[0].subtitle}</Text>
                <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} style={styles.avatarCenter}>
                  {avatarUri
                    ? <Image source={{ uri: avatarUri }} style={[styles.avatarLarge, { borderColor: border }]} />
                    : <View style={[styles.avatarPlaceholderLarge, { backgroundColor: cardBg, borderColor: border }]}>
                        <Ionicons name="camera-outline" size={40} color={textMuted} />
                      </View>
                  }
                  <View style={[styles.cameraBadge, { backgroundColor: isDarkMode ? '#2E2E2E' : '#E5E7EB' }]}>
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
            <Animated.View style={{ opacity: stepAnim }}>{renderStep()}</Animated.View>
          </ScrollView>

          <View style={[styles.btnContainer, { backgroundColor: bg }]}>
            {currentStep < STEPS.length - 1 ? (
              <TouchableOpacity style={[styles.btn, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }]} onPress={handleNext} activeOpacity={0.85}>
                <Text style={[styles.btnText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>Siguiente</Text>
                <Ionicons name="arrow-forward" size={18} color={isDarkMode ? '#000000' : '#FFFFFF'} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.btn, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading} activeOpacity={0.85}>
                {loading
                  ? <ActivityIndicator color={isDarkMode ? '#000000' : '#FFFFFF'} />
                  : <Text style={[styles.btnText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>Guardar y continuar</Text>
                }
              </TouchableOpacity>
            )}
          </View>

        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      <PermissionModal visible={showPermissionModal} onClose={() => setShowPermissionModal(false)} title="Permisos de Galería" message="Para elegir fotos necesitamos acceso a tu galería." onOpenSettings={openSettings} onRefreshPermissions={forceRefreshPermissions} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:       { flex: 1 },
  topNav:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  exitBtn:         { width: 40, height: 40, justifyContent: 'center' },
  dotsRow:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:             { height: 8, borderRadius: 4 },
  counter:         { width: 40, textAlign: 'right', fontSize: 13, fontWeight: '600' },
  scroll:          { paddingHorizontal: 24, paddingBottom: 16 },
  avatarCenter:          { alignSelf: 'center', position: 'relative', marginBottom: 12 },
  avatarLarge:           { width: 130, height: 130, borderRadius: 65, borderWidth: 2 },
  avatarPlaceholderLarge: { width: 130, height: 130, borderRadius: 65, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center' },
  cameraBadge:           { position: 'absolute', bottom: 4, right: 4, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarHint:            { textAlign: 'center', fontSize: 13, marginBottom: 28, fontWeight: '500' },
  stepTitle:       { fontSize: 26, fontWeight: '700', marginBottom: 6 },
  stepSubtitle:    { fontSize: 14 },
  btnContainer:    { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 },
  btn:             { borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  btnText:         { fontSize: 16, fontWeight: '700' },
  dniTitle:        { fontSize: 15, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  dniHint:         { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  dniRow:          { flexDirection: 'row', gap: 12 },
  dniCard:         { flex: 1, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', aspectRatio: 1.55, maxHeight: 118 },
  dniThumb:        { width: '100%', height: '100%' },
  dniPlaceholder:  { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
  dniLabel:        { fontSize: 12, fontWeight: '600', marginTop: 6 },
});

export default CompleteProfileScreen;
