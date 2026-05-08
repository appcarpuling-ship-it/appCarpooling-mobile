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
import { useColors } from '../../../hooks/useColors';
import { put_withauth_formdata, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { ARGENTINA_PROVINCES } from '../../../constants/provinces';
import { useGalleryPermissions } from '../../../hooks/useGalleryPermissions';
import PermissionModal from '../../../components/modals/PermissionModal';
import ConfirmationModal from '../../../components/modals/ConfirmationModal';
import Toast from '../../../components/Toast';

const EditProfileScreen = ({ navigation }) => {
  const { getCurrentThemeMode } = useColors();
  const isDarkMode = getCurrentThemeMode() === 'dark';

  const bg          = isDarkMode ? '#161616' : '#FFFFFF';
  const border      = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted   = isDarkMode ? '#6B7280' : '#9CA3AF';
  const divider     = isDarkMode ? '#2A2A2A' : '#F0F0F0';
  const accent      = isDarkMode ? '#FFFFFF' : '#000000';
  const accentInv   = isDarkMode ? '#000000' : '#FFFFFF';

  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');

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
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

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
        setToastMessage('Foto de perfil actualizada');
        setShowSuccessToast(true);
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

  const pickImage = async () => {
    try {
      const imageAsset = await pickImageFromGallery({
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
        setToastMessage('Perfil actualizado');
        setShowSuccessToast(true);
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
      <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#2A2A2A' : '#E8E8E8' }]}>
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
    { key: 'city',      label: 'Ciudad',     placeholder: 'Tu ciudad',           keyboard: 'default' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={[styles.avatarSection, { borderBottomColor: divider }]}>
            <View style={styles.avatarWrapper}>
              {avatarLoading && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
              {renderAvatar()}
            </View>
            <TouchableOpacity onPress={pickImage} activeOpacity={0.7} disabled={avatarLoading}>
              <Text style={[styles.changePhotoText, { color: avatarLoading ? textMuted : accent }]}>
                {avatarLoading ? 'Actualizando...' : 'Cambiar foto'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={[styles.inputGroup, { borderBottomColor: divider }]}>
              <Text style={[styles.label, { color: textMuted }]}>Email</Text>
              <Text style={[styles.input, { color: textMuted, paddingVertical: 12 }]}>{user?.email || '—'}</Text>
            </View>
            <View style={[styles.inputGroup, { borderBottomColor: divider }]}>
              <Text style={[styles.label, { color: textMuted }]}>Sexo</Text>
              <Text style={[styles.input, { color: textMuted, paddingVertical: 12 }]}>{genderLabel}</Text>
            </View>
            {fields.map((field) => (
              <View key={field.key} style={[styles.inputGroup, { borderBottomColor: divider }]}>
                <Text style={[styles.label, { color: textMuted }]}>{field.label}</Text>
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={formData[field.key]}
                  onChangeText={(v) => handleChange(field.key, v)}
                  placeholder={field.placeholder}
                  placeholderTextColor={textMuted}
                  keyboardType={field.keyboard}
                  autoCapitalize={field.autoCapitalize || 'words'}
                  maxLength={field.maxLength}
                />
              </View>
            ))}

            {/* Provincia */}
            <View style={[styles.inputGroup, { borderBottomColor: divider }]}>
              <Text style={[styles.label, { color: textMuted }]}>Provincia</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowProvincePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.input, { color: formData.province ? textPrimary : textMuted, flex: 1 }]}>
                  {formData.province || 'Seleccionar'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={textMuted} />
              </TouchableOpacity>
            </View>

            {/* Bio */}
            <View style={[styles.inputGroup, { borderBottomColor: 'transparent' }]}>
              <Text style={[styles.label, { color: textMuted }]}>Sobre ti</Text>
              <TextInput
                style={[styles.textArea, { color: textPrimary, borderColor: border, backgroundColor: isDarkMode ? '#1A1A1A' : '#F9FAFB' }]}
                value={formData.bio}
                onChangeText={(v) => handleChange('bio', v)}
                placeholder="Cuéntanos sobre ti..."
                placeholderTextColor={textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: loading ? textMuted : accent }]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={accentInv} size="small" />
            ) : (
              <Text style={[styles.saveBtnText, { color: accentInv }]}>Guardar cambios</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Province Picker */}
      <Modal visible={showProvincePicker} transparent animationType="fade" onRequestClose={() => setShowProvincePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#222222' : '#FFFFFF' }]}>
            <View style={[styles.modalHeader, { borderBottomColor: divider }]}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>Provincia</Text>
              <TouchableOpacity onPress={() => setShowProvincePicker(false)}>
                <Ionicons name="close" size={22} color={textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ARGENTINA_PROVINCES.map((province) => (
                <TouchableOpacity
                  key={province}
                  style={[styles.provinceItem, { borderBottomColor: divider }]}
                  onPress={() => { handleChange('province', province); setShowProvincePicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.provinceText,
                    { color: formData.province === province ? textPrimary : textMuted },
                    formData.province === province && { fontWeight: '600' },
                  ]}>
                    {province}
                  </Text>
                  {formData.province === province && (
                    <Ionicons name="checkmark" size={18} color={textPrimary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Acceso a galería"
        message="Necesitamos acceso a tu galería para cambiar tu foto de perfil."
        onOpenSettings={openSettings}
        onRefreshPermissions={forceRefreshPermissions}
      />

      <Toast
        visible={showSuccessToast}
        message={toastMessage}
        type="success"
        duration={2000}
        onHide={() => setShowSuccessToast(false)}
      />

      <ConfirmationModal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        onConfirm={() => setShowErrorModal(false)}
        type="error"
        title="Error"
        message={modalMessage}
        confirmText="OK"
        showCancel={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container:     { flex: 1 },
  flex:          { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
  },
  avatarImage:       { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarInitials:    { fontSize: 32, fontWeight: '700' },
  avatarOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  changePhotoText: { fontSize: 15, fontWeight: '500' },

  // Form
  form: { paddingHorizontal: 20, paddingTop: 8 },
  inputGroup: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label:  { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input:  { fontSize: 15, paddingVertical: 0 },
  selector: { flexDirection: 'row', alignItems: 'center' },
  textArea: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 90,
  },

  // Save
  saveBtn: {
    marginHorizontal: 20,
    marginTop: 28,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    borderRadius: 14,
    maxHeight: '70%',
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle:   { fontSize: 17, fontWeight: '700' },
  provinceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  provinceText: { fontSize: 15 },
});

export default EditProfileScreen;
