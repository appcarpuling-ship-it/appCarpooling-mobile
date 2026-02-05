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
import PermissionModal from '../../components/PermissionModal';
import ConfirmationModal from '../../components/ConfirmationModal';

const VehicleFormScreen = ({ navigation, route }) => {
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
      setModalMessage('Ano no valido');
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
          {/* Photos Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fotos</Text>
            <Text style={styles.sectionSubtitle}>
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
                <TouchableOpacity style={styles.addButton} onPress={pickImages}>
                  <Ionicons name="add" size={32} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Vehicle Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informacion</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Marca</Text>
              <TextInput
                style={styles.input}
                value={formData.brand}
                onChangeText={(value) => handleChange('brand', value)}
                placeholder="Toyota, Ford, Chevrolet..."
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Modelo</Text>
              <TextInput
                style={styles.input}
                value={formData.model}
                onChangeText={(value) => handleChange('model', value)}
                placeholder="Corolla, Focus, Cruze..."
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Ano</Text>
                <TextInput
                  style={styles.input}
                  value={formData.year}
                  onChangeText={(value) => handleChange('year', value)}
                  placeholder="2020"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Color</Text>
                <TextInput
                  style={styles.input}
                  value={formData.color}
                  onChangeText={(value) => handleChange('color', value)}
                  placeholder="Blanco"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Patente</Text>
              <TextInput
                style={styles.input}
                value={formData.licensePlate}
                onChangeText={(value) => handleChange('licensePlate', value.toUpperCase())}
                placeholder="ABC123"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Capacidad de pasajeros</Text>
              <TextInput
                style={styles.input}
                value={formData.capacity}
                onChangeText={(value) => handleChange('capacity', value)}
                placeholder="4"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={1}
              />
            </View>
          </View>

          {/* Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Caracteristicas</Text>

            {featuresList.map((feature) => (
              <TouchableOpacity
                key={feature.key}
                style={styles.featureRow}
                onPress={() => toggleFeature(feature.key)}
                activeOpacity={0.7}
              >
                <View style={styles.featureLeft}>
                  <Ionicons name={feature.icon} size={22} color="#374151" />
                  <Text style={styles.featureLabel}>{feature.label}</Text>
                </View>
                <View style={[
                  styles.toggle,
                  features[feature.key] && styles.toggleActive
                ]}>
                  <View style={[
                    styles.toggleCircle,
                    features[feature.key] && styles.toggleCircleActive
                  ]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>
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
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#F3F4F6',
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
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
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
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
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  featureLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureLabel: {
    fontSize: 16,
    color: '#374151',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E7EB',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#000000',
  },
  toggleCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
  // Submit
  submitButton: {
    backgroundColor: '#000000',
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
    color: '#FFFFFF',
  },
});

export default VehicleFormScreen;
