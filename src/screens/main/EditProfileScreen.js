import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Platform,
  Image,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { put_withauth_formdata, buildImageUri } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import {  gradients, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';
import { ARGENTINA_PROVINCES } from '../../constants/provinces';
import { useGalleryPermissions } from '../../hooks/useGalleryPermissions';
import PermissionModal from '../../components/PermissionModal';
import ConfirmationModal from '../../components/ConfirmationModal';

const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán'
];

const EditProfileScreen = ({ navigation }) => {
  const { colors, gradients, fontFamily, createColorArray } = useColors();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  // Fallbacks para gradientes
  const safeGradients = {
    dark: Array.isArray(gradients?.dark) && gradients.dark.length > 0 ? gradients.dark : ['#F8F9FA', '#E5E7EB'],
    primary: ['#1F2937', '#111827'],
  };

  // Dynamic styles that depend on colors hook
  const dynamicStyles = StyleSheet.create({
    modalContainer: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      margin: spacing.lg,
      minWidth: '80%',
      maxWidth: '90%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    modalTitle: {
      fontSize: fontSize.lg,
      fontFamily: fontFamily.semiBold,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    vehicleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    vehicleItemSelected: {
      backgroundColor: '#1F293720',
      borderColor: '#1F2937',
    },
    vehicleName: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.semiBold,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    vehicleNameSelected: {
      color: '#1F2937',
    },
    input: {
      flex: 1,
      color: '#000000',
      fontSize: fontSize.md,
      paddingVertical: spacing.md,
      fontFamily: fontFamily.regular,
      fontWeight: fontWeight.regular,
    },
    helperText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.regular,
      color: '#9CA3AF',
      marginTop: spacing.xs,
      marginLeft: spacing.xs,
    },
    picker: {
      flex: 1,
      color: '#000000',
      fontSize: fontSize.md,
      fontFamily: fontFamily.regular,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: fontSize.md,
      fontFamily: fontFamily.bold,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.5,
    },
  });

  const { user, updateProfile, refreshUser } = useAuth();
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

  // Actualizar formData cuando el usuario cambia
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
      
      // Si el usuario tiene avatar del servidor y no hay avatarUri local, mantener el avatar del servidor
      // Si hay avatarUri local, mantenerlo (es la nueva imagen seleccionada)
      if (user.avatar && !avatarUri) {
        // No hacer nada, el avatar del servidor se mostrará
      }
    }
  }, [user]);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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

  const pickImage = async () => {
    try {
      console.log('📸 [EditProfile] Iniciando selección de imagen...');
      const imageAsset = await pickImageFromGallery({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('📸 [EditProfile] Resultado completo de pickImageFromGallery:', JSON.stringify(imageAsset, null, 2));

      if (imageAsset) {
        // El hook puede retornar el asset directamente o dentro de assets[0]
        let uri = null;
        
        if (imageAsset.uri) {
          uri = imageAsset.uri;
        } else if (imageAsset.assets && imageAsset.assets[0] && imageAsset.assets[0].uri) {
          uri = imageAsset.assets[0].uri;
        }
        
        if (uri) {
          console.log('✅ [EditProfile] Imagen seleccionada, URI:', uri);
          // Actualizar el estado inmediatamente para mostrar la imagen
          setAvatarUri(uri);
          console.log('✅ [EditProfile] avatarUri actualizado en estado, debería mostrarse ahora');
        } else {
          console.log('⚠️ [EditProfile] Imagen seleccionada pero sin URI válida. Estructura:', imageAsset);
          Alert.alert('Error', 'No se pudo obtener la imagen seleccionada');
        }
      } else {
        console.log('⚠️ [EditProfile] No se seleccionó imagen (usuario canceló)');
      }
    } catch (error) {
      console.error('❌ [EditProfile] Error al seleccionar imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen. Intenta nuevamente.');
    }
  };

  const handleSave = async () => {
    // Validaciones
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

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setModalMessage('Por favor ingresa un email válido');
      setShowErrorModal(true);
      return;
    }

    if (!formData.phone.trim()) {
      setModalMessage('El teléfono es obligatorio');
      setShowErrorModal(true);
      return;
    }

    if (formData.age && (parseInt(formData.age) < 18 || parseInt(formData.age) > 100)) {
      setModalMessage('La edad debe estar entre 18 y 100 años');
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

      if (avatarUri) {
        const filename = avatarUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formDataToSend.append('avatar', {
          uri: avatarUri,
          name: filename,
          type: type,
        });
      }

      console.log('📤 [EditProfile] Enviando datos:', {
        hasAvatar: !!avatarUri,
        email: formData.email,
      });

      const response = await put_withauth_formdata(ENDPOINTS.UPDATE_PROFILE, formDataToSend);

      console.log('📥 [EditProfile] Respuesta del servidor:', response);

      if (response.success) {
        // Refrescar usuario para obtener datos actualizados del servidor (incluyendo avatar)
        await refreshUser();
        // NO limpiar avatarUri aquí - mantenerlo hasta que el usuario se actualice
        // El avatarUri se limpiará cuando el usuario se actualice y tenga el nuevo avatar del servidor
        setModalMessage('Perfil actualizado exitosamente');
        setShowSuccessModal(true);
      } else {
        setModalMessage(response.message || 'Error al actualizar el perfil');
        setShowErrorModal(true);
      }
    } catch (error) {
      setModalMessage(error.message || 'Error al actualizar el perfil');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={safeGradients.dark}
      style={styles.container}
    >
      {/* Province Picker Modal - Fuera del ScrollView */}
      {showProvincePicker && (
        <Modal transparent={true} animationType="fade" onRequestClose={() => setShowProvincePicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={dynamicStyles.modalContainer}>
              <View style={dynamicStyles.modalHeader}>
                <Text style={dynamicStyles.modalTitle}>Seleccionar Provincia</Text>
                <TouchableOpacity onPress={() => setShowProvincePicker(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.provinceList} showsVerticalScrollIndicator={false}>
                {ARGENTINA_PROVINCES.map((province) => (
                  <TouchableOpacity
                    key={province}
                    style={[
                      dynamicStyles.vehicleItem,
                      formData.province === province && dynamicStyles.vehicleItemSelected
                    ]}
                    onPress={() => {
                      handleChange('province', province);
                      setShowProvincePicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      dynamicStyles.vehicleName,
                      formData.province === province && dynamicStyles.vehicleNameSelected
                    ]}>
                      {province}
                    </Text>
                    {formData.province === province && (
                      <Ionicons name="checkmark-circle" size={24} color="#1F2937" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Avatar Section */}
          <View style={styles.avatarCard}>
            <LinearGradient
              colors={safeGradients.primary}
              style={styles.avatarGradient}
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                  onError={(error) => {
                    console.error('❌ [EditProfile] Error cargando avatarUri:', avatarUri, error);
                  }}
                  onLoad={() => {
                    console.log('✅ [EditProfile] Avatar cargado exitosamente desde:', avatarUri);
                  }}
                />
              ) : user?.avatar ? (
                <Image
                  source={{
                    uri: buildImageUri(user.avatar) || undefined,
                  }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                  onError={() => console.log('Error loading avatar from:', user.avatar)}
                />
              ) : (
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarText}>
                    {formData.firstName?.[0] || ''}{formData.lastName?.[0] || ''}
                  </Text>
                </View>
              )}
            </LinearGradient>
            <TouchableOpacity 
              style={styles.changePhotoButton} 
              onPress={pickImage}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={20} color="#1F2937" />
              <Text style={styles.changePhotoText}>
                {avatarUri ? 'Cambiar foto' : 'Cambiar foto de perfil'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Personal Information Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-outline" size={24} color="#1F2937" />
              <Text style={styles.cardTitle}>Información Personal</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholderTextColor={colors.placeholder}
                  value={formData.firstName}
                  onChangeText={(value) => handleChange('firstName', value)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Apellido *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Apellido"
                  placeholderTextColor={colors.placeholder}
                  value={formData.lastName}
                  onChangeText={(value) => handleChange('lastName', value)}
                />
              </View>
            </View>
          </View>

          {/* Contact Information Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="call-outline" size={24} color="#1F2937" />
              <Text style={styles.cardTitle}>Información de Contacto</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Teléfono *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Teléfono"
                  placeholderTextColor={colors.placeholder}
                  value={formData.phone}
                  onChangeText={(value) => handleChange('phone', value)}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Email"
                  placeholderTextColor={colors.placeholder}
                  value={formData.email}
                  onChangeText={(value) => handleChange('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Edad *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Edad"
                  placeholderTextColor={colors.placeholder}
                  value={formData.age}
                  onChangeText={(value) => handleChange('age', value)}
                  keyboardType="numeric"
                  maxLength={3}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ciudad *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="location-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Ciudad"
                  placeholderTextColor={colors.placeholder}
                  value={formData.city}
                  onChangeText={(value) => handleChange('city', value)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Provincia *</Text>
              <TouchableOpacity
                style={styles.provinceSelector}
                onPress={() => setShowProvincePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="map-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <Text style={[styles.input, { marginVertical: 0, paddingVertical: 0 }]}>
                  {formData.province || 'Seleccionar provincia...'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* About Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={24} color="#1F2937" />
              <Text style={styles.cardTitle}>Sobre ti</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Biografía</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="create-outline" size={20} color={colors.textSecondary} style={[styles.inputIcon, styles.textAreaIcon]} />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Cuéntanos sobre ti..."
                  placeholderTextColor={colors.placeholder}
                  value={formData.bio}
                  onChangeText={(value) => handleChange('bio', value)}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={safeGradients.primary}
              style={styles.saveButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={22} color="#FFFFFF" />
                  <Text style={dynamicStyles.saveButtonText}>Guardar Cambios</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
      
      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Permisos de Galería"
        message="Para seleccionar una foto de perfil necesitamos acceso a tu galería. Ve a configuración y habilita los permisos para esta aplicación."
        onOpenSettings={openSettings}
        onRefreshPermissions={forceRefreshPermissions}
      />

      <ConfirmationModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        onConfirm={() => {
          setShowSuccessModal(false);
          navigation.goBack();
        }}
        type="success"
        title="Éxito"
        message={modalMessage}
        confirmText="OK"
        showCancel={false}
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
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: spacing.lg,
  },
  // Avatar Section
  avatarCard: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    padding: 4,
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#1F2937',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  avatarContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 70,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 70,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 56,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  changePhotoText: {
    color: '#1F2937',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
  },
  // Card Styles
  card: {
    backgroundColor: '#F8F9FA',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
  },
  // Input Styles
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: '#6B7280',
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  textAreaIcon: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
  input: {
    flex: 1,
    color: '#000000',
    fontSize: fontSize.md,
    paddingVertical: spacing.md,
    fontWeight: fontWeight.regular,
  },
  inputDisabled: {
    opacity: 0.5,
    borderColor: '#E5E7EB',
  },
  inputTextDisabled: {
    color: '#9CA3AF',
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  helperText: {
    fontSize: fontSize.xs,
    color: '#9CA3AF',
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingLeft: spacing.md,
  },
  picker: {
    flex: 1,
    color: '#000000',
    fontSize: fontSize.md,
  },
  provinceSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    padding: spacing.xs,
  },
  provinceList: {
    maxHeight: 400,
    padding: spacing.md,
  },
  // Save Button
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#1F2937',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
});

export default EditProfileScreen;
