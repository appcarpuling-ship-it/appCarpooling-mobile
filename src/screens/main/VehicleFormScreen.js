import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { post_withauth_formdata, put_withauth_formdata, buildImageUri } from '../../services/apiService';
import { useGalleryPermissions } from '../../hooks/useGalleryPermissions';
import { useColors } from '../../hooks/useColors';
import PermissionModal from '../../components/PermissionModal';
import ConfirmationModal from '../../components/ConfirmationModal';

const VehicleFormScreen = ({ navigation, route }) => {
  const { colors, getCurrentThemeMode } = useColors();
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

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

  const handleChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
  };

  const {
    showPermissionModal,
    setShowPermissionModal,
    openSettings,
    handlePermissionRequest,
    forceRefreshPermissions,
  } = useGalleryPermissions();

  const toggleFeature = (feature) => {
    setFeatures(prevFeatures => ({
      ...prevFeatures,
      [feature]: !prevFeatures[feature]
    }));
  };

  const compressImage = async (uri) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(uri, [
        { resize: { width: 1200 } }
      ], {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG
      });
      return manipResult.uri;
    } catch (error) {
      return uri;
    }
  };

  const pickImages = async () => {
    const hasPermission = await handlePermissionRequest();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const compressedUris = await Promise.all(
          result.assets.map(asset => compressImage(asset.uri))
        );

        const newPhotos = [...photos, ...compressedUris];
        const totalAfterAdd = existingPhotos.length + newPhotos.length;

        if (totalAfterAdd > 10) {
          setModalMessage('Maximo 10 fotos');
          setShowErrorModal(true);
          return;
        }
        setPhotos(newPhotos);
      }
    } catch (error) {
      setModalMessage('No se pudieron seleccionar las imagenes');
      setShowErrorModal(true);
    }
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = (index) => {
    setExistingPhotos(existingPhotos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formData.brand || !formData.model || !formData.year || !formData.color || !formData.licensePlate || !formData.capacity) {
      setModalMessage('Completa todos los campos');
      setShowErrorModal(true);
      return;
    }

    const totalPhotos = existingPhotos.length + photos.length;

    if (!isEdit && totalPhotos < 3) {
      setModalMessage(`Minimo 3 fotos. Tenes ${totalPhotos}`);
      setShowErrorModal(true);
      return;
    }

    if (isEdit && totalPhotos === 0) {
      setModalMessage('Necesitas al menos 1 foto');
      setShowErrorModal(true);
      return;
    }

    const yearNum = parseInt(formData.year);
    if (yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
      setModalMessage('Año no valido');
      setShowErrorModal(true);
      return;
    }

    const capacityNum = parseInt(formData.capacity);
    if (capacityNum < 1 || capacityNum > 8) {
      setModalMessage('Capacidad: 1 a 8 pasajeros');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('brand', formData.brand);
      formDataToSend.append('model', formData.model);
      formDataToSend.append('year', yearNum);
      formDataToSend.append('color', formData.color);
      formDataToSend.append('licensePlate', formData.licensePlate);
      formDataToSend.append('capacity', capacityNum);
      formDataToSend.append('features', JSON.stringify(features));

      if (isEdit && existingPhotos.length > 0) {
        formDataToSend.append('existingPhotos', JSON.stringify(existingPhotos));
      }

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
        setModalMessage(isEdit ? 'Vehiculo actualizado' : 'Vehiculo creado');
        setShowSuccessModal(true);
      } else {
        setModalMessage(response.message || 'Error al guardar');
        setShowErrorModal(true);
      }
    } catch (error) {
      setModalMessage(error.message || 'Error al guardar');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const featuresList = [
    { key: 'ac', label: 'Aire acondicionado', icon: 'snow-outline' },
    { key: 'music', label: 'Musica', icon: 'musical-notes-outline' },
    { key: 'smoking', label: 'Se puede fumar', icon: 'flame-outline' },
    { key: 'pets', label: 'Mascotas', icon: 'paw-outline' },
    { key: 'luggage', label: 'Equipaje grande', icon: 'bag-handle-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          {/* Photos Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Fotos</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {isEdit ? 'Agrega o elimina fotos' : 'Minimo 3, maximo 10'}
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photosScroll}
              contentContainerStyle={styles.photosContainer}
            >
              {/* Existing photos */}
              {existingPhotos.map((photoUrl, index) => (
                <View key={`existing-${index}`} style={styles.photoWrapper}>
                  <Image
                    source={{ uri: buildImageUri(photoUrl) }}
                    style={styles.photo}
                  />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeExistingPhoto(index)}
                  >
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* New photos */}
              {photos.map((photoUri, index) => (
                <View key={`new-${index}`} style={styles.photoWrapper}>
                  <Image source={{ uri: photoUri }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add button */}
              {(existingPhotos.length + photos.length) < 10 && (
                <TouchableOpacity style={[styles.addButton, { 
                  backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, 
                  borderColor: getCurrentThemeMode() === 'dark' ? '#404040' : colors.border 
                }]} onPress={pickImages}>
                  <Ionicons name="add" size={32} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Vehicle Info */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Informacion</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Marca</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, 
                  borderColor: getCurrentThemeMode() === 'dark' ? '#404040' : colors.border, 
                  color: colors.textPrimary 
                }]}
                value={formData.brand}
                onChangeText={(value) => handleChange('brand', value)}
                placeholder="Toyota, Ford, Chevrolet..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Modelo</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, 
                  borderColor: getCurrentThemeMode() === 'dark' ? '#404040' : colors.border, 
                  color: colors.textPrimary 
                }]}
                value={formData.model}
                onChangeText={(value) => handleChange('model', value)}
                placeholder="Corolla, Focus, Cruze..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Año</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, 
                    borderColor: getCurrentThemeMode() === 'dark' ? '#404040' : colors.border, 
                    color: colors.textPrimary 
                  }]}
                  value={formData.year}
                  onChangeText={(value) => handleChange('year', value)}
                  placeholder="2020"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Color</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, 
                    borderColor: getCurrentThemeMode() === 'dark' ? '#404040' : colors.border, 
                    color: colors.textPrimary 
                  }]}
                  value={formData.color}
                  onChangeText={(value) => handleChange('color', value)}
                  placeholder="Blanco"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Patente</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, 
                  borderColor: getCurrentThemeMode() === 'dark' ? '#404040' : colors.border, 
                  color: colors.textPrimary 
                }]}
                value={formData.licensePlate}
                onChangeText={(value) => handleChange('licensePlate', value.toUpperCase())}
                placeholder="ABC123"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Capacidad de pasajeros</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, 
                  borderColor: getCurrentThemeMode() === 'dark' ? '#404040' : colors.border, 
                  color: colors.textPrimary 
                }]}
                value={formData.capacity}
                onChangeText={(value) => handleChange('capacity', value)}
                placeholder="4"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                maxLength={1}
              />
            </View>
          </View>

          {/* Features */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Caracteristicas</Text>

            {featuresList.map((feature) => (
              <TouchableOpacity
                key={feature.key}
                style={[styles.featureRow, { 
                  backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, 
                  borderColor: colors.border 
                }]}
                onPress={() => toggleFeature(feature.key)}
                activeOpacity={0.7}
              >
                <View style={styles.featureLeft}>
                  <Ionicons name={feature.icon} size={22} color={getCurrentThemeMode() === 'dark' ? colors.textMuted : '#000000'} />
                  <Text style={[styles.featureLabel, { color: colors.textPrimary }]}>{feature.label}</Text>
                </View>
                <View style={[
                  styles.toggle,
                  { backgroundColor: colors.border },
                  features[feature.key] && { 
                    ...styles.toggleActive, 
                    backgroundColor: getCurrentThemeMode() === 'dark' ? '#FFFFFF' : '#000000' 
                  }
                ]}>
                  <View style={[
                    styles.toggleCircle,
                    { backgroundColor: features[feature.key] && getCurrentThemeMode() === 'dark' ? "#000000" : "#FFFFFF" },
                    features[feature.key] && styles.toggleCircleActive
                  ]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled, { 
              backgroundColor: getCurrentThemeMode() === 'dark' ? '#FFFFFF' : '#000000' 
            }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={getCurrentThemeMode() === 'dark' ? '#000000' : '#FFFFFF'} size="small" />
            ) : (
              <Text style={[styles.submitButtonText, { color: getCurrentThemeMode() === 'dark' ? '#000000' : '#FFFFFF' }]}>
                {isEdit ? 'Guardar cambios' : 'Crear vehiculo'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Acceso a galeria"
        message="Necesitamos acceso a tu galeria para agregar fotos del vehiculo."
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
        title="Listo"
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
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // Sections
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
    borderBottomWidth: 1,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  // Photos
  photosScroll: {
    marginHorizontal: -20,
  },
  photosContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  photoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Form
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  halfWidth: {
    flex: 1,
  },
  // Features
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  featureLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureLabel: {
    fontSize: 16,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
  },
  toggleCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
  // Submit
  submitButton: {
    marginHorizontal: 20,
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VehicleFormScreen;
