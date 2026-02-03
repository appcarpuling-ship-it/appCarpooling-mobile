import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { post_withauth_formdata, put_withauth_formdata, buildImageUri } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import {  spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';
import { useGalleryPermissions } from '../../hooks/useGalleryPermissions';
import PermissionModal from '../../components/PermissionModal';
import ConfirmationModal from '../../components/ConfirmationModal';

// Usar valores directos para evitar problemas de carga
const SORA_FONTS = {
  thin: 'Sora_100Thin',
  extraLight: 'Sora_200ExtraLight',
  light: 'Sora_300Light',
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semiBold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  extraBold: 'Sora_800ExtraBold',
};

const VehicleFormScreen = ({ navigation, route }) => {
  const { colors, gradients, createColorArray } = useColors();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  // Fallbacks para gradientes
  const safeGradients = {
    background: Array.isArray(colors?.background) && colors.background.length > 0 ? colors.background : ['#FFFFFF', '#F8F9FA'],
    surface: Array.isArray(colors?.surface) && colors.surface.length > 0 ? colors.surface : ['#F8F9FA', '#E5E7EB'],
    primary: Array.isArray(gradients?.primary) && gradients.primary.length > 0 ? gradients.primary : ['#1F2937', '#111827'],
  };
  const isEdit = route.params?.vehicle;
  const vehicleData = route.params?.vehicle;

  const [formData, setFormData] = useState({
    brand: vehicleData?.brand || '',
    model: vehicleData?.model || '',
    year: vehicleData?.year?.toString() || '',
    color: vehicleData?.color || '',
    licensePlate: vehicleData?.licensePlate || '',
    capacity: vehicleData?.capacity?.toString() || '',
  });

  const [features, setFeatures] = useState({
    ac: vehicleData?.features?.ac || false,
    music: vehicleData?.features?.music || false,
    smoking: vehicleData?.features?.smoking || false,
    pets: vehicleData?.features?.pets || false,
    luggage: vehicleData?.features?.luggage || false,
  });

  const [photos, setPhotos] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit && vehicleData?.photos && vehicleData.photos.length > 0) {
      setExistingPhotos(vehicleData.photos);
    }
  }, []);

  // Debug: Monitor features state changes
  useEffect(() => {
    console.log('🔍 [VehicleForm] Features state updated:', features);
  }, [features]);

  const handleChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
  };

  const {
    pickImage: pickImageFromGallery,
    showPermissionModal,
    setShowPermissionModal,
    openSettings,
    handlePermissionRequest,
    forceRefreshPermissions,
  } = useGalleryPermissions();

  const toggleFeature = (feature) => {
    console.log(`🔄 [VehicleForm] Toggling feature: ${feature}, current value:`, features[feature]);

    // Use functional update to ensure we have the latest state
    setFeatures(prevFeatures => {
      const newFeatures = {
        ...prevFeatures,
        [feature]: !prevFeatures[feature]
      };

      console.log(`✅ [VehicleForm] New features state:`, newFeatures);
      return newFeatures;
    });
  };

  const compressImage = async (uri) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(uri, [
        { resize: { width: 1200 } } // Redimensionar a máximo 1200px de ancho
      ], {
        compress: 0.7, // Comprimir al 70%
        format: ImageManipulator.SaveFormat.JPEG
      });
      return manipResult.uri;
    } catch (error) {
      console.error('Error al comprimir imagen:', error);
      return uri; // Si falla, devolver la URI original
    }
  };

  const pickImages = async () => {
    const hasPermission = await handlePermissionRequest();
    
    if (!hasPermission) {
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        // Comprimir todas las imágenes seleccionadas
        const compressedUris = await Promise.all(
          result.assets.map(asset => compressImage(asset.uri))
        );

        const newPhotos = [...photos, ...compressedUris];
        if (newPhotos.length > 10) {
          Alert.alert('Límite', 'Puedes subir máximo 10 fotos');
          return;
        }
        setPhotos(newPhotos);
      }
    } catch (error) {
      console.error('Error seleccionando imágenes:', error);
      Alert.alert('Error', 'No se pudieron seleccionar las imágenes');
    }
  };

  const removePhoto = (index) => {
    setPhotos((Array.isArray(photos) ? photos : []).filter((_, i) => i !== index));
  };

  const removeExistingPhoto = (index) => {
    setExistingPhotos((Array.isArray(existingPhotos) ? existingPhotos : []).filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validaciones
    if (!formData.brand || !formData.model || !formData.year || !formData.color || !formData.licensePlate || !formData.capacity) {
      setModalMessage('Por favor completa todos los campos');
      setShowErrorModal(true);
      return;
    }

    const totalPhotos = existingPhotos.length + photos.length;

    if (!isEdit && photos.length < 3) {
      setModalMessage('Debes subir al menos 3 fotos del vehículo');
      setShowErrorModal(true);
      return;
    }

    if (totalPhotos > 10) {
      setModalMessage('Puedes tener máximo 10 fotos');
      setShowErrorModal(true);
      return;
    }

    const yearNum = parseInt(formData.year);
    if (yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
      setModalMessage('El año no es válido');
      setShowErrorModal(true);
      return;
    }

    const capacityNum = parseInt(formData.capacity);
    if (capacityNum < 1 || capacityNum > 8) {
      setModalMessage('La capacidad debe estar entre 1 y 8 pasajeros');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();

      // Agregar campos
      formDataToSend.append('brand', formData.brand);
      formDataToSend.append('model', formData.model);
      formDataToSend.append('year', yearNum);
      formDataToSend.append('color', formData.color);
      formDataToSend.append('licensePlate', formData.licensePlate);
      formDataToSend.append('capacity', capacityNum);

      // Agregar features como JSON
      formDataToSend.append('features', JSON.stringify(features));

      // Agregar fotos existentes (solo las URLs)
      if (isEdit && existingPhotos.length > 0) {
        formDataToSend.append('existingPhotos', JSON.stringify(existingPhotos));
      }

      // Agregar nuevas fotos
      photos.forEach((photoUri, index) => {
        const filename = photoUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formDataToSend.append('photos', {
          uri: photoUri,
          name: filename || `photo-${index}.jpg`,
          type,
        });
      });

      let response;
      if (isEdit) {
        response = await put_withauth_formdata(`/vehicles/${vehicleData._id}`, formDataToSend);
      } else {
        response = await post_withauth_formdata('/vehicles', formDataToSend);
      }

      if (response.success) {
        setModalMessage(isEdit ? 'Vehículo actualizado exitosamente' : 'Vehículo creado exitosamente');
        setShowSuccessModal(true);
      } else {
        setModalMessage(response.message || 'Error al guardar vehículo');
        setShowErrorModal(true);
      }
    } catch (error) {
      setModalMessage(error.message || 'Error al guardar vehículo');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={createColorArray(colors.background, colors.surface) || ['#FFFFFF', '#F8F9FA']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>{isEdit ? 'Editar' : 'Agregar'} Vehículo</Text>
          </View>

          {/* Photos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fotos del Vehículo *</Text>
            <Text style={styles.sectionSubtitle}>
              {isEdit ? 'Opcional: agrega nuevas fotos' : 'Mínimo 3, máximo 10 fotos'}
            </Text>

            <View style={styles.photosGrid}>
              {/* Existing photos */}
              {existingPhotos.map((photoUrl, index) => (
                <View key={`existing-${index}`} style={styles.photoContainer}>
                  <Image
                    source={{ uri: buildImageUri(photoUrl) || undefined }}
                    style={styles.photo}
                    onError={() => console.log('Error loading vehicle photo from:', photoUrl)}
                  />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => removeExistingPhoto(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                  <View style={styles.photoNumber}>
                    <Text style={styles.photoNumberText}>{index + 1}</Text>
                  </View>
                </View>
              ))}

              {/* New photos */}
              {photos.map((photoUri, index) => (
                <View key={`new-${index}`} style={styles.photoContainer}>
                  <Image source={{ uri: photoUri }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                  <View style={styles.photoNumber}>
                    <Text style={styles.photoNumberText}>{existingPhotos.length + index + 1}</Text>
                  </View>
                </View>
              ))}

              {(existingPhotos.length + photos.length) < 10 && (
                <TouchableOpacity style={styles.addPhotoButton} onPress={pickImages}>
                  <Ionicons name="camera" size={32} color={colors.textTertiary} />
                  <Text style={styles.addPhotoText}>Agregar Fotos</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Form */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información del Vehículo</Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="car-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Marca *"
                placeholderTextColor={colors.placeholder}
                value={formData.brand}
                onChangeText={(value) => handleChange('brand', value)}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="car-sport-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Modelo *"
                placeholderTextColor={colors.placeholder}
                value={formData.model}
                onChangeText={(value) => handleChange('model', value)}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputWrapper, styles.halfWidth]}>
                <Ionicons name="calendar-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Año *"
                  placeholderTextColor={colors.placeholder}
                  value={formData.year}
                  onChangeText={(value) => handleChange('year', value)}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputWrapper, styles.halfWidth]}>
                <Ionicons name="color-palette-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Color *"
                  placeholderTextColor={colors.placeholder}
                  value={formData.color}
                  onChangeText={(value) => handleChange('color', value)}
                />
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="document-text-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Patente *"
                placeholderTextColor={colors.placeholder}
                value={formData.licensePlate}
                onChangeText={(value) => handleChange('licensePlate', value.toUpperCase())}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="people-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Capacidad (1-8 pasajeros) *"
                placeholderTextColor={colors.placeholder}
                value={formData.capacity}
                onChangeText={(value) => handleChange('capacity', value)}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Características</Text>

            <View style={styles.featuresGrid}>
              <TouchableOpacity
                style={[styles.featureButton, features.ac && styles.featureButtonActive]}
                onPress={() => toggleFeature('ac')}
              >
                <Ionicons
                  name="snow-outline"
                  size={24}
                  color={features.ac ? '#FFF' : colors.textTertiary}
                />
                <Text style={[styles.featureText, features.ac && styles.featureTextActive]}>
                  Aire Acondicionado
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.featureButton, features.music && styles.featureButtonActive]}
                onPress={() => toggleFeature('music')}
              >
                <Ionicons
                  name="musical-notes-outline"
                  size={24}
                  color={features.music ? '#FFF' : colors.textTertiary}
                />
                <Text style={[styles.featureText, features.music && styles.featureTextActive]}>
                  Música
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.featureButton, features.smoking && styles.featureButtonActive]}
                onPress={() => toggleFeature('smoking')}
              >
                <Ionicons
                  name="ban-outline"
                  size={24}
                  color={features.smoking ? '#FFF' : colors.textTertiary}
                />
                <Text style={[styles.featureText, features.smoking && styles.featureTextActive]}>
                  Se Permite Fumar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.featureButton, features.pets && styles.featureButtonActive]}
                onPress={() => toggleFeature('pets')}
              >
                <Ionicons
                  name="paw-outline"
                  size={24}
                  color={features.pets ? '#FFF' : colors.textTertiary}
                />
                <Text style={[styles.featureText, features.pets && styles.featureTextActive]}>
                  Mascotas
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.featureButton, features.luggage && styles.featureButtonActive]}
                onPress={() => toggleFeature('luggage')}
              >
                <Ionicons
                  name="bag-handle-outline"
                  size={24}
                  color={features.luggage ? '#FFF' : colors.textTertiary}
                />
                <Text style={[styles.featureText, features.luggage && styles.featureTextActive]}>
                  Equipaje Grande
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity onPress={handleSubmit} disabled={loading} activeOpacity={0.8}>
            <LinearGradient
              colors={createColorArray('#1F2937', '#111827') || ['#1F2937', '#111827']}
              style={styles.submitButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isEdit ? 'Actualizar Vehículo' : 'Crear Vehículo'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
      
      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Permisos de Galería"
        message="Para seleccionar fotos de tu vehículo necesitamos acceso a tu galería. Ve a configuración y habilita los permisos para esta aplicación."
        onOpenSettings={openSettings}
        onRefreshPermissions={forceRefreshPermissions}
      />

      <ConfirmationModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        onConfirm={() => {
          setShowSuccessModal(false);
          navigation.navigate('Vehicles', { refreshVehicles: true });
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  backButton: {
    marginRight: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontFamily: SORA_FONTS.bold,
    fontWeight: fontWeight.bold,
    color: '#000000',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semibold,
    color: '#000000',
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.regular,
    color: '#6B7280',
    marginBottom: spacing.md,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  photoContainer: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  photoNumber: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoNumberText: {
    color: '#FFF',
    fontSize: fontSize.xs,
    fontFamily: SORA_FONTS.bold,
    fontWeight: fontWeight.bold,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
    fontFamily: SORA_FONTS.regular,
    color: '#9CA3AF',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.regular,
    color: '#1A1A1A',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  featureButton: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featureButtonActive: {
    backgroundColor: '#1F2937',
    borderColor: '#111827',
  },
  featureText: {
    marginLeft: spacing.sm,
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.regular,
    color: '#6B7280',
    flex: 1,
  },
  featureTextActive: {
    color: '#FFF',
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semibold,
  },
  submitButton: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: fontSize.lg,
    fontFamily: SORA_FONTS.bold,
    fontWeight: fontWeight.bold,
  },
});

export default VehicleFormScreen;
