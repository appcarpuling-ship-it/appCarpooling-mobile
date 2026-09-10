import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useUI } from '../../../theme/ui';
import { put_withauth_formdata, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { ARGENTINA_PROVINCES } from '../../../constants/provinces';
import { useHeaderHeight } from '@react-navigation/elements';
import { useGalleryPermissions } from '../../../hooks/useGalleryPermissions';
import { showAlertAsync } from '../../../context/AlertContext';
import PermissionModal from '../../../components/modals/PermissionModal';
import PillButton from '../../../components/ui/PillButton';
import { appendFile } from '../../../utils/formDataFile';
import DocumentoUpload from '../../../components/vehicle/DocumentoUpload';

const EditProfileScreen = ({ navigation }) => {
  const ui = useUI();
  const headerHeight = useHeaderHeight();

  const bg          = ui.bg;
  const textPrimary = ui.text;
  const textMuted   = ui.textMuted;
  const labelTitleColor = ui.textMuted;
  const accent      = ui.invertBg;
  const accentInv   = ui.invertText;


  const { user, refreshUser } = useAuth();
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName:  user?.lastName  || '',
    phone:     user?.phone     || '',
    age:       user?.age?.toString() || '',
    city:      user?.city     || '',
    province:  user?.province || '',
    bio:       user?.bio      || '',
  });
  const [avatarUri, setAvatarUri] = useState(null);
  const [gender, setGender] = useState(user?.gender || '');
  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  // Licencia de conducir. El DNI dice quién sos, no que puedas manejar: son dos documentos
  // distintos y hasta ahora sólo se pedía el primero. Va con vencimiento, como en Uber.
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseUri, setLicenseUri] = useState(null);
  const [licenseExpiry, setLicenseExpiry] = useState(
    user?.driverLicenseExpiry ? new Date(user.driverLicenseExpiry) : null,
  );
  const [dniFrontLoading, setDniFrontLoading] = useState(false);
  const [dniBackLoading, setDniBackLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName:  user.lastName  || '',
        phone:     user.phone     || '',
        age:       user.age?.toString() || '',
        city:      user.city     || '',
        province:  user.province || '',
        bio:       user.bio      || '',
      });
    }
  }, [user]);

  const handleChange = (name, value) => setFormData({ ...formData, [name]: value });

  const {
    pickImage: pickImageFromGallery,
    takePhoto,
    showPermissionModal,
    setShowPermissionModal,
    openSettings,
    forceRefreshPermissions,
  } = useGalleryPermissions();

  const updateAvatarOnly = async (imageUri) => {
    setAvatarLoading(true);
    try {
      const formDataToSend = new FormData();
      await appendFile(formDataToSend, 'avatar', imageUri, 'avatar.jpg');
      const response = await put_withauth_formdata(ENDPOINTS.UPDATE_PROFILE, formDataToSend);
      if (response.success) {
        await refreshUser();
        navigation.navigate('Result', { type: 'success', title: 'Perfil Actualizado', message: 'Foto de perfil actualizada', primaryLabel: 'Continuar', image: require('../../../../assets/icons/pngwing.com (16).png') });
        setAvatarUri(null);
      } else {
        navigation.navigate('Result', { type: 'error', title: 'Error', message: response.message || 'Error al actualizar la foto' });
        setAvatarUri(null);
      }
    } catch (error) {
      navigation.navigate('Result', { type: 'error', title: 'Error', message: error.message || 'Error al actualizar la foto' });
      setAvatarUri(null);
    } finally {
      setAvatarLoading(false);
    }
  };

  const pickImage = () => {
    const elegirDesde = async (getAsset) => {
      try {
        const imageAsset = await getAsset({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        if (imageAsset) {
          const uri = imageAsset.uri || imageAsset.assets?.[0]?.uri;
          if (uri) { setAvatarUri(uri); await updateAvatarOnly(uri); }
        }
      } catch {
        navigation.navigate('Result', { type: 'error', title: 'Error', message: 'No se pudo cargar la imagen' });
      }
    };

    showAlertAsync('Foto de perfil', '¿De dónde la querés sacar?', [
      { text: 'Cámara', onPress: () => elegirDesde(takePhoto) },
      { text: 'Galería', onPress: () => elegirDesde(pickImageFromGallery) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  /**
   * La licencia se sube cuando están la foto Y la fecha: el server rechaza una sin la otra,
   * porque una licencia vencida se ve igual que una al día.
   */
  const subirLicencia = async (imageUri, fecha) => {
    if (!imageUri || !fecha) return;
    setLicenseLoading(true);
    try {
      const fd = new FormData();
      await appendFile(fd, 'driverLicense', imageUri, 'licencia.jpg');
      fd.append('driverLicenseExpiry', fecha.toISOString());
      const response = await put_withauth_formdata(ENDPOINTS.UPLOAD_DNI, fd);
      if (response.success) {
        setLicenseUri(null);
        await refreshUser();
        navigation.navigate('Result', {
          type: 'success',
          title: 'Perfil Actualizado',
          message: 'Licencia de conducir actualizada',
          primaryLabel: 'Continuar',
          image: require('../../../../assets/icons/pngwing.com (16).png'),
        });
      } else {
        navigation.navigate('Result', { type: 'error', title: 'Error', message: response.message || 'No se pudo subir la licencia' });
      }
    } catch (e) {
      navigation.navigate('Result', { type: 'error', title: 'Error', message: e.message || 'No se pudo subir la licencia' });
    } finally {
      setLicenseLoading(false);
    }
  };

  const uploadDniSide = async (side, imageUri) => {
    const field = side === 'front' ? 'dniFront' : 'dniBack';
    const setDniLoading = side === 'front' ? setDniFrontLoading : setDniBackLoading;
    setDniLoading(true);
    try {
      const fd = new FormData();
      await appendFile(fd, field, imageUri, `${field}.jpg`);
      const response = await put_withauth_formdata(ENDPOINTS.UPLOAD_DNI, fd);
      if (response.success) {
        await refreshUser();
        navigation.navigate('Result', {
          type: 'success',
          title: 'Perfil Actualizado',
          message: side === 'front' ? 'Frente del DNI actualizado' : 'Dorso del DNI actualizado',
          primaryLabel: 'Continuar',
          image: require('../../../../assets/icons/pngwing.com (16).png'),
        });
      } else {
        navigation.navigate('Result', { type: 'error', title: 'Error', message: response.message || 'No se pudo subir el DNI' });
      }
    } catch (error) {
      navigation.navigate('Result', { type: 'error', title: 'Error', message: error.message || 'No se pudo subir el DNI' });
    } finally {
      setDniLoading(false);
    }
  };

  const pickLicencia = async () => {
    try {
      const imageAsset = await pickImageFromGallery({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });
      const uri = imageAsset?.uri || imageAsset?.assets?.[0]?.uri;
      if (!uri) return;
      setLicenseUri(uri);
      // Si la fecha ya estaba puesta se sube de una; si no, espera a que la elija.
      if (licenseExpiry) await subirLicencia(uri, licenseExpiry);
    } catch {
      navigation.navigate('Result', { type: 'error', title: 'Error', message: 'No se pudo seleccionar la imagen' });
    }
  };

  const elegirVencimientoLicencia = async (fecha) => {
    setLicenseExpiry(fecha);
    if (licenseUri) await subirLicencia(licenseUri, fecha);
  };

  const pickDniDocument = async (side) => {
    try {
      const imageAsset = await pickImageFromGallery({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });
      const uri = imageAsset?.uri || imageAsset?.assets?.[0]?.uri;
      if (uri) await uploadDniSide(side, uri);
    } catch {
      navigation.navigate('Result', { type: 'error', title: 'Error', message: 'No se pudo seleccionar la imagen' });
    }
  };

  const handleSave = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      navigation.navigate('Result', { type: 'error', title: 'Error', message: 'Nombre y apellido son obligatorios' }); return;
    }
    if (!formData.phone.trim()) {
      navigation.navigate('Result', { type: 'error', title: 'Error', message: 'El teléfono es obligatorio' }); return;
    }
    if (formData.age && (parseInt(formData.age) < 18 || parseInt(formData.age) > 100)) {
      navigation.navigate('Result', { type: 'error', title: 'Error', message: 'La edad debe estar entre 18 y 100 años' }); return;
    }
    if (!formData.city.trim() || !formData.province) {
      navigation.navigate('Result', { type: 'error', title: 'Error', message: 'Ciudad y provincia son obligatorios' }); return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('firstName', formData.firstName.trim());
      fd.append('lastName',  formData.lastName.trim());
      fd.append('phone',     formData.phone.trim());
      if (formData.age) fd.append('age', parseInt(formData.age));
      fd.append('city',     formData.city.trim());
      fd.append('province', formData.province);
      if (formData.bio.trim()) fd.append('bio', formData.bio.trim());
      // El backend solo acepta gender si el usuario todavía no tiene uno
      // (authController.updateProfile); mandarlo si ya está lo ignora.
      if (!user?.gender && gender) fd.append('gender', gender);

      const response = await put_withauth_formdata(ENDPOINTS.UPDATE_PROFILE, fd);
      if (response.success) {
        await refreshUser();
        navigation.navigate('Result', {
          type: 'success',
          title: 'Perfil Actualizado',
          message: 'Tus datos personales se han guardado correctamente.',
          primaryLabel: 'Continuar',
          image: require('../../../../assets/icons/pngwing.com (16).png'),
        });
      } else {
        navigation.navigate('Result', { type: 'error', title: 'Error', message: response.message || 'Error al actualizar' });
      }
    } catch (error) {
      navigation.navigate('Result', { type: 'error', title: 'Error', message: error.message || 'Error al actualizar' });
    } finally {
      setLoading(false);
    }
  };

  const renderAvatar = () => {
    const uri = avatarUri || (user?.avatar ? buildImageUri(user.avatar) : null);
    if (uri) return <Image source={{ uri }} style={styles.avatarImage} />;
    return (
      <View style={[styles.avatarPlaceholder, { backgroundColor: ui.surface }]}>
        <Text style={[styles.avatarInitials, { color: textPrimary }]}>
          {formData.firstName?.[0] || ''}{formData.lastName?.[0] || ''}
        </Text>
      </View>
    );
  };

  const genderLabel =
    user?.gender === 'female' ? 'Femenino' : user?.gender === 'male' ? 'Masculino' : '—';

  const dniCount = (user?.dniFrontUrl ? 1 : 0) + (user?.dniBackUrl ? 1 : 0);
  const dniDone = dniCount === 2;


  const fields = [
    { key: 'firstName', label: 'Nombre',    placeholder: 'Tu nombre',          keyboard: 'default' },
    { key: 'lastName',  label: 'Apellido',   placeholder: 'Tu apellido',         keyboard: 'default' },
    { key: 'phone',     label: 'Teléfono',   placeholder: '+54 9 11 1234-5678',  keyboard: 'phone-pad' },
    { key: 'age',       label: 'Edad',       placeholder: '25',                  keyboard: 'numeric', maxLength: 3 },
  ];

  // Va después del selector de Provincia: primero se elige la provincia y después la
  // ciudad, que es el orden en que uno las piensa (y el mismo que usa el registro).
  const cityField = { key: 'city', label: 'Ciudad', placeholder: 'Tu ciudad', keyboard: 'default' };

  // Campo relleno con la etiqueta adentro: reemplaza la fila subrayada, que hacía
  // ver la pantalla como un formulario de ajustes y no como el resto de la app.
  const renderField = (field, half) => (
    <View
      key={field.key}
      style={[
        styles.field,
        half && styles.fieldHalf,
        { backgroundColor: ui.surface, borderColor: focusedField === field.key ? textPrimary : 'transparent' },
      ]}
    >
      <Text style={[styles.fieldLabel, { color: textMuted }]}>{field.label}</Text>
      <TextInput
        style={[styles.fieldInput, { color: textPrimary }]}
        value={formData[field.key]}
        onChangeText={(v) => handleChange(field.key, v)}
        onFocus={() => setFocusedField(field.key)}
        onBlur={() => setFocusedField(null)}
        placeholder={field.placeholder}
        placeholderTextColor={textMuted}
        keyboardType={field.keyboard}
        autoCapitalize={field.autoCapitalize || 'words'}
        maxLength={field.maxLength}
      />
    </View>
  );

  const SectionLabel = ({ children }) => (
    <Text style={[styles.sectionLabel, { color: labelTitleColor }]}>{children}</Text>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Mismo caso que VehicleForm: header nativo fuera del KAV, así que en iOS hay que
          descontarle ese alto o el input enfocado queda debajo del teclado. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar + nombre */}
          <View style={styles.hero}>
            <View style={styles.avatarBlock}>
              <View style={styles.avatarWrapper}>
                {avatarLoading && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
                {renderAvatar()}
              </View>
              {/* El botón de cámara reemplaza al link "Cambiar foto": es el gesto
                  que ya espera la gente sobre un avatar. */}
              <TouchableOpacity
                style={[styles.avatarBadge, { backgroundColor: accent, borderColor: bg }]}
                onPress={pickImage}
                activeOpacity={0.85}
                disabled={avatarLoading}
                accessibilityRole="button"
                accessibilityLabel="Cambiar foto de perfil"
              >
                <Ionicons name="camera" size={17} color={accentInv} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.heroName, { color: textPrimary }]} numberOfLines={1}>
              {formData.firstName || 'Tu'} <Text style={styles.heroNameStrong}>{formData.lastName || 'perfil'}</Text>
            </Text>
          </View>

          {/* Cuenta */}
          <View style={styles.section}>
            <SectionLabel>Cuenta</SectionLabel>
            <View style={styles.fieldStack}>
              {/* El email identifica la cuenta y el backend no lo modifica en
                  este endpoint, así que se muestra bloqueado y se dice por qué. */}
              <View style={[styles.field, styles.fieldLocked, { backgroundColor: ui.surface, borderColor: 'transparent' }]}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>Email</Text>
                <View style={styles.selector}>
                  <Text style={[styles.fieldInput, styles.fieldReadOnly, { color: textMuted, flex: 1 }]} numberOfLines={1}>
                    {user?.email || '—'}
                  </Text>
                  <Ionicons name="lock-closed" size={15} color={textMuted} />
                </View>
              </View>

              <View style={[styles.field, { backgroundColor: ui.surface, borderColor: 'transparent' }]}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>Sexo</Text>
                {user?.gender ? (
                  // Una vez cargado no se cambia: el backend solo lo acepta vacío.
                  <View style={styles.selector}>
                    <Text style={[styles.fieldInput, styles.fieldReadOnly, { color: textMuted, flex: 1 }]}>
                      {genderLabel}
                    </Text>
                    <Ionicons name="lock-closed" size={15} color={textMuted} />
                  </View>
                ) : (
                  <View style={styles.genderRow}>
                    {[
                      { key: 'female', label: 'Femenino' },
                      { key: 'male',   label: 'Masculino' },
                    ].map((g) => {
                      const on = gender === g.key;
                      return (
                        <TouchableOpacity
                          key={g.key}
                          style={[styles.genderChip, { backgroundColor: on ? accent : bg }]}
                          onPress={() => setGender(g.key)}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                        >
                          <Text style={[styles.genderChipText, { color: on ? accentInv : textPrimary }]}>
                            {g.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Datos personales */}
          <View style={styles.section}>
            <SectionLabel>Datos personales</SectionLabel>
            <View style={styles.fieldStack}>
              <View style={styles.row}>
                {renderField(fields[0], true)}
                {renderField(fields[1], true)}
              </View>
              <View style={styles.row}>
                {renderField(fields[2], true)}
                {renderField(fields[3], true)}
              </View>

              {/* Provincia va antes que Ciudad: es el orden en que uno las piensa */}
              <TouchableOpacity
                style={[styles.field, { backgroundColor: ui.surface, borderColor: 'transparent' }]}
                onPress={() => setShowProvincePicker(true)}
                activeOpacity={0.75}
              >
                <Text style={[styles.fieldLabel, { color: textMuted }]}>Provincia</Text>
                <View style={styles.selector}>
                  <Text style={[styles.fieldInput, styles.fieldReadOnly, { color: formData.province ? textPrimary : textMuted, flex: 1 }]}>
                    {formData.province || 'Seleccionar'}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={textMuted} />
                </View>
              </TouchableOpacity>

              {renderField(cityField)}
            </View>
          </View>

          {/* Sobre vos */}
          <View style={styles.section}>
            <SectionLabel>Sobre vos</SectionLabel>
            <TextInput
              style={[
                styles.textArea,
                { color: textPrimary, backgroundColor: ui.surface, borderColor: focusedField === 'bio' ? textPrimary : 'transparent' },
              ]}
              value={formData.bio}
              onChangeText={(v) => handleChange('bio', v)}
              onFocus={() => setFocusedField('bio')}
              onBlur={() => setFocusedField(null)}
              placeholder="Contá algo sobre vos: a dónde viajás seguido, si escuchás música, si llevás mascotas…"
              placeholderTextColor={textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Verificación de identidad. Antes eran dos recuadros enormes para algo
              secundario; ahora es una tarjeta con estado y dos filas compactas. */}
          <View style={styles.section}>
            <SectionLabel>Identidad</SectionLabel>
            <View style={[styles.verifyCard, { backgroundColor: ui.surface }]}>
              <View style={styles.verifyHead}>
                <View style={[styles.verifyIcon, { backgroundColor: dniDone ? accent : bg }]}>
                  <Ionicons
                    name={dniDone ? 'shield-checkmark' : 'shield-outline'}
                    size={20}
                    color={dniDone ? accentInv : textMuted}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.verifyTitle, { color: textPrimary }]}>
                    {dniDone ? 'Identidad verificada' : 'Verificá tu identidad'}
                  </Text>
                  <Text style={[styles.verifySub, { color: textMuted }]}>
                    {dniDone
                      ? 'Ya tenemos las dos caras de tu DNI.'
                      : `Faltan ${2 - dniCount} de 2 fotos.`}
                  </Text>
                </View>
              </View>

              {[
                { side: 'front', label: 'Frente del DNI', url: user?.dniFrontUrl, busy: dniFrontLoading },
                { side: 'back',  label: 'Dorso del DNI',  url: user?.dniBackUrl,  busy: dniBackLoading },
              ].map((slot) => (
                <TouchableOpacity
                  key={slot.side}
                  style={[styles.verifyRow, { borderTopColor: bg }]}
                  onPress={() => pickDniDocument(slot.side)}
                  activeOpacity={0.75}
                  disabled={slot.busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Subir ${slot.label}`}
                >
                  <View style={[styles.verifyThumb, { backgroundColor: bg }]}>
                    {slot.busy ? (
                      <ActivityIndicator size="small" color={textMuted} />
                    ) : slot.url ? (
                      <Image source={{ uri: buildImageUri(slot.url) }} style={styles.verifyThumbImg} />
                    ) : (
                      <Ionicons name="camera-outline" size={19} color={textMuted} />
                    )}
                  </View>

                  <View style={styles.flex}>
                    <Text style={[styles.verifyRowLabel, { color: textPrimary }]}>{slot.label}</Text>
                    <Text style={[styles.verifyRowState, { color: textMuted }]}>
                      {slot.url ? 'Cargada · tocá para reemplazar' : 'Tocá para subir la foto'}
                    </Text>
                  </View>

                  {slot.url ? (
                    <View style={[styles.verifyTick, { backgroundColor: accent }]}>
                      <Ionicons name="checkmark" size={13} color={accentInv} />
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={textMuted} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.sectionHint, { color: textMuted }]}>
              Se la pedimos a conductores y pasajeros. Las fotos se guardan de forma segura y no se muestran en tu perfil.
            </Text>

            {/* Licencia: sólo hace falta para manejar, pero se pide acá junto al resto de la
                documentación personal. Lleva vencimiento, como el seguro del vehículo. */}
            <DocumentoUpload
              label="Licencia de conducir"
              hint="Sólo si vas a publicar viajes como conductor."
              uri={licenseUri}
              uriGuardada={!licenseUri && user?.driverLicenseUrl ? buildImageUri(user.driverLicenseUrl) : null}
              onElegir={pickLicencia}
              onQuitar={() => setLicenseUri(null)}
              procesando={licenseLoading}
              vencimiento={licenseExpiry}
              onVencimiento={elegirVencimientoLicencia}
              isDarkMode={ui.isDarkMode}
            />
          </View>

          <PillButton
            label="Guardar cambios"
            onPress={handleSave}
            loading={loading}
            style={styles.save}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Province Picker */}
      <Modal visible={showProvincePicker} transparent animationType="slide" onRequestClose={() => setShowProvincePicker(false)}>
        <View style={styles.modalOverlay}>
          {/* Tocar fuera cierra: antes solo salías por la X */}
          <TouchableOpacity style={styles.flex} activeOpacity={1} onPress={() => setShowProvincePicker(false)} />
          <View style={[styles.modalBox, { backgroundColor: bg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>Provincia</Text>
              <TouchableOpacity
                style={[styles.modalClose, { backgroundColor: ui.surface }]}
                onPress={() => setShowProvincePicker(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Ionicons name="close" size={19} color={textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalList}>
              {ARGENTINA_PROVINCES.map((province) => {
                const selected = formData.province === province;
                return (
                  <TouchableOpacity
                    key={province}
                    style={[styles.provinceItem, { backgroundColor: selected ? accent : ui.surface }]}
                    onPress={() => { handleChange('province', province); setShowProvincePicker(false); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.provinceText, { color: selected ? accentInv : textPrimary }]}>
                      {province}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={18} color={accentInv} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Acceso a galería"
        message="Necesitamos acceso a tu galería para tu foto de perfil y las fotos del DNI."
        onOpenSettings={openSettings}
        onRefreshPermissions={forceRefreshPermissions}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container:     { flex: 1 },
  flex:          { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  // Hero: avatar + nombre
  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 32, paddingHorizontal: 24 },
  avatarBlock: { width: 124, height: 124, marginBottom: 18 },
  avatarWrapper: {
    width: 124,
    height: 124,
    borderRadius: 999,
    overflow: 'hidden',
  },
  avatarImage:       { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarInitials:    { fontSize: 44, fontFamily: 'Sora_800ExtraBold' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  // Fuera del wrapper: ese tiene overflow hidden y recortaría el botón.
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName:       { fontFamily: 'Sora_300Light', fontSize: 26, letterSpacing: -0.6, textAlign: 'center' },
  heroNameStrong: { fontFamily: 'Sora_800ExtraBold' },
  // Campos bloqueados: se ven como los demás pero con candado y sin foco
  fieldLocked: { opacity: 0.85 },
  genderRow:   { flexDirection: 'row', gap: 8, marginTop: 8 },
  genderChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 999,
    alignItems: 'center',
  },
  genderChipText: { fontFamily: 'Sora_600SemiBold', fontSize: 14 },

  // Secciones
  // "Todo lo que tiene es necesario, hay que hacerla más linda" (feedback directo): no se
  // sacó nada, se le dio más aire — más separación entre secciones y entre campos, y un
  // poco más de padding adentro de cada uno.
  section: { paddingHorizontal: 24, marginBottom: 36 },
  sectionLabel: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,
    marginLeft: 4,
  },
  sectionHint: { fontFamily: 'Sora_400Regular', fontSize: 12, lineHeight: 18, marginTop: 10, marginLeft: 4, marginRight: 4 },

  // Campos
  fieldStack: { gap: 14 },
  row:        { flexDirection: 'row', gap: 14 },
  fieldHalf:  { flex: 1 },
  field: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },
  fieldLabel: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fieldInput: {
    fontFamily: 'Sora_500Medium',
    fontSize: 16,
    padding: 0,
    marginTop: 3,
    minHeight: 22,
  },
  fieldReadOnly: { lineHeight: 22 },
  selector: { flexDirection: 'row', alignItems: 'center' },
  textArea: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    fontFamily: 'Sora_400Regular',
    fontSize: 15,
    lineHeight: 21,
    minHeight: 110,
  },

  // Verificación de identidad
  verifyCard: { borderRadius: 24, overflow: 'hidden' },
  verifyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  verifyIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyTitle: { fontFamily: 'Sora_700Bold', fontSize: 16 },
  verifySub:   { fontFamily: 'Sora_400Regular', fontSize: 13, marginTop: 2 },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 2,
  },
  verifyThumb: {
    width: 52,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  verifyThumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  verifyRowLabel: { fontFamily: 'Sora_600SemiBold', fontSize: 14 },
  verifyRowState: { fontFamily: 'Sora_400Regular', fontSize: 12, marginTop: 2 },
  verifyTick: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  save: { marginHorizontal: 24, marginTop: 4 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '75%',
    width: '100%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 16,
  },
  modalTitle: { fontSize: 24, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.5 },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalList: { paddingHorizontal: 24, paddingBottom: 32, gap: 8 },
  provinceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderRadius: 18,
  },
  provinceText: { fontSize: 15, fontFamily: 'Sora_500Medium' },
});

export default EditProfileScreen;
