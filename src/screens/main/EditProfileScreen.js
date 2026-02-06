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
import { useAuth } from '../../context/AuthContext';
import { put_withauth_formdata, buildImageUri } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { ARGENTINA_PROVINCES } from '../../constants/provinces';
import { useGalleryPermissions } from '../../hooks/useGalleryPermissions';
import PermissionModal from '../../components/PermissionModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import Toast from '../../components/Toast';

const EditProfileScreen = ({ navigation }) => {
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const { user, refreshUser } = useAuth();
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    age: user?.age?.toString() || '',
    city: user?.city || '',
    province: user?.province || '',
    bio: user?.bio || '',
  });
  const [avatarUri, setAvatarUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        age: user.age?.toString() || '',
        city: user.city || '',
        province: user.province || '',
        bio: user.bio || '',
      });
    }
  }, [user]);

  const handleChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
  };

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

      formDataToSend.append('avatar', {
        uri: imageUri,
        name: filename,
        type: type,
      });

      const response = await put_withauth_formdata(ENDPOINTS.UPDATE_PROFILE, formDataToSend);

      if (response.success) {
        await refreshUser();
        setToastMessage('Foto de perfil actualizada');
        setShowSuccessToast(true);
        setAvatarUri(null); // Clear the temporary URI since it's now saved
      } else {
        setModalMessage(response.message || 'Error al actualizar la foto');
        setShowErrorModal(true);
        setAvatarUri(null); // Reset on error
      }
    } catch (error) {
      setModalMessage(error.message || 'Error al actualizar la foto');
      setShowErrorModal(true);
      setAvatarUri(null); // Reset on error
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
        let uri = null;
        if (imageAsset.uri) {
          uri = imageAsset.uri;
        } else if (imageAsset.assets && imageAsset.assets[0] && imageAsset.assets[0].uri) {
          uri = imageAsset.assets[0].uri;
        }
        if (uri) {
          setAvatarUri(uri);
          // Automatically update the avatar
          await updateAvatarOnly(uri);
        }
      }
    } catch (error) {
      setModalMessage('No se pudo seleccionar la imagen');
      setShowErrorModal(true);
    }
  };

  const handleSave = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setModalMessage('Nombre y apellido son obligatorios');
      setShowErrorModal(true);
      return;
    }

    if (!formData.email.trim()) {
      setModalMessage('El email es obligatorio');
      setShowErrorModal(true);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setModalMessage('Por favor ingresa un email valido');
      setShowErrorModal(true);
      return;
    }

    if (!formData.phone.trim()) {
      setModalMessage('El telefono es obligatorio');
      setShowErrorModal(true);
      return;
    }

    if (formData.age && (parseInt(formData.age) < 18 || parseInt(formData.age) > 100)) {
      setModalMessage('La edad debe estar entre 18 y 100 anos');
      setShowErrorModal(true);
      return;
    }

    if (!formData.city.trim() || !formData.province) {
      setModalMessage('Ciudad y provincia son obligatorios');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('firstName', formData.firstName.trim());
      formDataToSend.append('lastName', formData.lastName.trim());
      formDataToSend.append('email', formData.email.trim());
      formDataToSend.append('phone', formData.phone.trim());

      if (formData.age) {
        formDataToSend.append('age', parseInt(formData.age));
      }

      formDataToSend.append('city', formData.city.trim());
      formDataToSend.append('province', formData.province);

      if (formData.bio.trim()) {
        formDataToSend.append('bio', formData.bio.trim());
      }

      // Don't include avatar in main save since it's handled separately
      const response = await put_withauth_formdata(ENDPOINTS.UPDATE_PROFILE, formDataToSend);

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
    if (avatarUri) {
      return <Image source={{ uri: avatarUri }} style={styles.avatarImage} />;
    }
    if (user?.avatar) {
      return <Image source={{ uri: buildImageUri(user.avatar) }} style={styles.avatarImage} />;
    }
    return (
      <View style={styles.avatarPlaceholder}>
        <Text style={styles.avatarInitials}>
          {formData.firstName?.[0] || ''}{formData.lastName?.[0] || ''}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              {avatarLoading && (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
              {renderAvatar()}
            </View>
            <TouchableOpacity 
              onPress={pickImage} 
              activeOpacity={0.7}
              disabled={avatarLoading}
            >
              <Text style={[styles.changePhotoText, avatarLoading && styles.changePhotoTextDisabled]}>
                {avatarLoading ? 'Actualizando...' : 'Cambiar foto'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Nombre */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={formData.firstName}
                onChangeText={(value) => handleChange('firstName', value)}
                placeholder="Tu nombre"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Apellido */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Apellido</Text>
              <TextInput
                style={styles.input}
                value={formData.lastName}
                onChangeText={(value) => handleChange('lastName', value)}
                placeholder="Tu apellido"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(value) => handleChange('email', value)}
                placeholder="tu@email.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Telefono */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Telefono</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(value) => handleChange('phone', value)}
                placeholder="+54 9 11 1234-5678"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
            </View>

            {/* Edad */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Edad</Text>
              <TextInput
                style={styles.input}
                value={formData.age}
                onChangeText={(value) => handleChange('age', value)}
                placeholder="25"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={3}
              />
            </View>

            {/* Ciudad */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ciudad</Text>
              <TextInput
                style={styles.input}
                value={formData.city}
                onChangeText={(value) => handleChange('city', value)}
                placeholder="Tu ciudad"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Provincia */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Provincia</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowProvincePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.selectorText, !formData.province && styles.placeholder]}>
                  {formData.province || 'Seleccionar'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Bio */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Sobre ti</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.bio}
                onChangeText={(value) => handleChange('bio', value)}
                placeholder="Cuentanos sobre ti..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Guardar</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Province Picker Modal */}
      <Modal
        visible={showProvincePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProvincePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Provincia</Text>
              <TouchableOpacity onPress={() => setShowProvincePicker(false)}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ARGENTINA_PROVINCES.map((province) => (
                <TouchableOpacity
                  key={province}
                  style={styles.provinceItem}
                  onPress={() => {
                    handleChange('province', province);
                    setShowProvincePicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.provinceText,
                    formData.province === province && styles.provinceTextSelected
                  ]}>
                    {province}
                  </Text>
                  {formData.province === province && (
                    <Ionicons name="checkmark" size={20} color="#000000" />
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
        title="Acceso a galeria"
        message="Necesitamos acceso a tu galeria para cambiar tu foto de perfil."
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
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  changePhotoText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  changePhotoTextDisabled: {
    color: '#9CA3AF',
  },
  // Form
  form: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    color: '#000000',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
    borderBottomWidth: 0,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  selectorText: {
    fontSize: 16,
    color: '#000000',
  },
  placeholder: {
    color: '#9CA3AF',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
  },
  // Save Button
  saveButton: {
    backgroundColor: '#000000',
    marginHorizontal: 20,
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  provinceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  provinceText: {
    fontSize: 16,
    color: '#374151',
  },
  provinceTextSelected: {
    fontWeight: '600',
    color: '#000000',
  },
});

export default EditProfileScreen;
