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
import ConfirmationModal from '../../../components/modals/ConfirmationModal';
import PillButton from '../../../components/ui/PillButton';

const EditProfileScreen = ({ navigation }) => {
  const ui = useUI();
  const headerHeight = useHeaderHeight();

  const bg          = ui.bg;
  const textPrimary = ui.text;
  const textMuted   = ui.textMuted;
  const labelTitleColor = ui.textMuted;
  const accent      = ui.invertBg;
  const accentInv   = ui.invertText;

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal]   = useState(false);
  const [modalMessage, setModalMessage]       = useState('');
  const [successMessage, setSuccessMessage]   = useState('');

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
  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
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
      const filename = imageUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      formDataToSend.append('avatar', { uri: imageUri, name: filename, type });
      const response = await put_withauth_formdata(ENDPOINTS.UPDATE_PROFILE, formDataToSend);
      if (response.success) {
        await refreshUser();
        setSuccessMessage('Foto de perfil actualizada');
        setShowSuccessModal(true);
        setAvatarUri(null);
      } else {
        setModalMessage(response.message || 'Error al actualizar la foto');
        setShowErrorModal(true);
        setAvatarUri(null);
      }
    } catch (error) {
      setModalMessage(error.message || 'Error al actualizar la foto');
      setShowErrorModal(true);
      setAvatarUri(null);
    } finally {
      setAvatarLoading(false);
    }
  };

  const pickImage = () => {
    const useSource = async (getAsset) => {
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
        setModalMessage('No se pudo cargar la imagen');
        setShowErrorModal(true);
      }
    };

    showAlertAsync('Foto de perfil', '¿De dónde la querés sacar?', [
      { text: 'Cámara', onPress: () => useSource(takePhoto) },
      { text: 'Galería', onPress: () => useSource(pickImageFromGallery) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const uploadDniSide = async (side, imageUri) => {
    const field = side === 'front' ? 'dniFront' : 'dniBack';
    const setDniLoading = side === 'front' ? setDniFrontLoading : setDniBackLoading;
    setDniLoading(true);
    try {
      const fd = new FormData();
      const filename = imageUri.split('/').pop() || `${field}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      let ext = match ? match[1].toLowerCase() : 'jpeg';
      if (ext === 'jpg') ext = 'jpeg';
      const name = filename.includes('.') ? filename : `${field}.jpg`;
      fd.append(field, { uri: imageUri, name, type: `image/${ext}` });
      const response = await put_withauth_formdata(ENDPOINTS.UPLOAD_DNI, fd);
      if (response.success) {
        await refreshUser();
        setSuccessMessage(side === 'front' ? 'Frente del DNI actualizado' : 'Dorso del DNI actualizado');
        setShowSuccessModal(true);
      } else {
        setModalMessage(response.message || 'No se pudo subir el DNI');
        setShowErrorModal(true);
      }
    } catch (error) {
      setModalMessage(error.message || 'No se pudo subir el DNI');
      setShowErrorModal(true);
    } finally {
      setDniLoading(false);
    }
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
      setModalMessage('No se pudo seleccionar la imagen');
      setShowErrorModal(true);
    }
  };

  const handleSave = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setModalMessage('Nombre y apellido son obligatorios'); setShowErrorModal(true); return;
    }
    if (!formData.phone.trim()) {
      setModalMessage('El teléfono es obligatorio'); setShowErrorModal(true); return;
    }
    if (formData.age && (parseInt(formData.age) < 18 || parseInt(formData.age) > 100)) {
      setModalMessage('La edad debe estar entre 18 y 100 años'); setShowErrorModal(true); return;
    }
    if (!formData.city.trim() || !formData.province) {
      setModalMessage('Ciudad y provincia son obligatorios'); setShowErrorModal(true); return;
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

      const response = await put_withauth_formdata(ENDPOINTS.UPDATE_PROFILE, fd);
      if (response.success) {
        await refreshUser();
        setSuccessMessage('Tus datos personales se han guardado correctamente.');
        setShowSuccessModal(true);
      } else {
        setModalMessage(response.message || 'Error al actualizar');
        setShowErrorModal(true);
      }
    } catch (error) {
      setModalMessage(error.message || 'Error al actualizar');
      setShowErrorModal(true);
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
  const renderField = (field) => (
    <View
      key={field.key}
      style={[
        styles.field,
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

  // Dato que no se edita (email, sexo): mismo contenedor, sin input.
  const renderReadOnly = (label, value) => (
    <View style={[styles.field, { backgroundColor: ui.surface, borderColor: 'transparent' }]}>
      <Text style={[styles.fieldLabel, { color: textMuted }]}>{label}</Text>
      <Text style={[styles.fieldInput, styles.fieldReadOnly, { color: textMuted }]}>{value}</Text>
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
          {/* Avatar + identidad */}
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
            <Text style={[styles.heroMail, { color: textMuted }]} numberOfLines={1}>{user?.email || '—'}</Text>
          </View>

          {/* Datos personales */}
          <View style={styles.section}>
            <SectionLabel>Datos personales</SectionLabel>
            <View style={styles.fieldStack}>
              {fields.map(renderField)}

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

          {/* DNI — verificación para todos los usuarios */}
          <View style={styles.section}>
            <SectionLabel>Documentación (DNI)</SectionLabel>
            <Text style={[styles.sectionHint, { color: textMuted }]}>
              Lo solicitamos a conductores y pasajeros para verificar identidad. Necesitás frente y dorso. Las fotos se guardan de forma segura.
            </Text>
            <View style={styles.dniRow}>
              {[
                { side: 'front', label: 'Frente', url: user?.dniFrontUrl, busy: dniFrontLoading },
                { side: 'back',  label: 'Dorso',  url: user?.dniBackUrl,  busy: dniBackLoading },
              ].map((slot) => (
                <TouchableOpacity
                  key={slot.side}
                  style={[styles.dniSlot, { backgroundColor: ui.surface }]}
                  onPress={() => pickDniDocument(slot.side)}
                  activeOpacity={0.85}
                  disabled={slot.busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Subir ${slot.label} del DNI`}
                >
                  {slot.busy && (
                    <View style={styles.dniSlotOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  )}
                  {slot.url ? (
                    <>
                      <Image source={{ uri: buildImageUri(slot.url) }} style={styles.dniSlotImage} />
                      {/* Tilde de "ya cargado": antes la foto se veía pero nada confirmaba el estado */}
                      <View style={[styles.dniCheck, { backgroundColor: accent }]}>
                        <Ionicons name="checkmark" size={13} color={accentInv} />
                      </View>
                    </>
                  ) : (
                    <View style={styles.dniSlotInner}>
                      <Ionicons name="id-card-outline" size={26} color={textMuted} />
                      <Text style={[styles.dniSlotLabel, { color: textMuted }]}>{slot.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Cuenta — datos que no se editan acá */}
          <View style={styles.section}>
            <SectionLabel>Cuenta</SectionLabel>
            <View style={styles.fieldStack}>
              {renderReadOnly('Email', user?.email || '—')}
              {renderReadOnly('Sexo', genderLabel)}
            </View>
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

      <ConfirmationModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        onConfirm={() => setShowSuccessModal(false)}
        type="success"
        title="Perfil Actualizado"
        message={successMessage}
        confirmText="Continuar"
        showCancel={false}
      />

      <ConfirmationModal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        onConfirm={() => setShowErrorModal(false)}
        type="error"
        title="Error"
        message={modalMessage}
        confirmText="Entendido"
        showCancel={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container:     { flex: 1 },
  flex:          { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  // Hero: avatar + identidad
  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 34, paddingHorizontal: 24 },
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
  heroName:       { fontFamily: 'Sora_300Light', fontSize: 26, letterSpacing: -0.6 },
  heroNameStrong: { fontFamily: 'Sora_800ExtraBold' },
  heroMail:       { fontFamily: 'Sora_400Regular', fontSize: 14, marginTop: 5 },

  // Secciones
  section: { paddingHorizontal: 24, marginBottom: 28 },
  sectionLabel: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionHint: { fontFamily: 'Sora_400Regular', fontSize: 13, lineHeight: 19, marginBottom: 14, marginLeft: 4 },

  // Campos
  fieldStack: { gap: 10 },
  field: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 13,
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

  // DNI
  dniRow: { flexDirection: 'row', gap: 12 },
  dniSlot: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    height: 116,
    position: 'relative',
  },
  dniSlotImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  dniSlotInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
  },
  dniSlotLabel: { fontSize: 12, fontFamily: 'Sora_600SemiBold', textAlign: 'center' },
  dniCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dniSlotOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
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
