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
import { post_withauth_formdata, put_withauth_formdata, buildImageUri } from '../../../services/apiService';
import { useGalleryPermissions } from '../../../hooks/useGalleryPermissions';
import { useColors } from '../../../hooks/useColors';
import { useAlert } from '../../../context/AlertContext';
import PermissionModal from '../../../components/modals/PermissionModal';
import RemoteImageWithLoader from '../../../components/RemoteImageWithLoader';

const VehicleFormScreen = ({ navigation, route }) => {
  const { getCurrentThemeMode } = useColors();
  const { showAlert } = useAlert();

  const isDarkMode = getCurrentThemeMode() === 'dark';
  const bg          = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg      = isDarkMode ? '#222222' : '#FFFFFF';
  const border      = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary     = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted       = isDarkMode ? '#6B7280' : '#9CA3AF';
  const textLabel       = isDarkMode ? '#E5E7EB' : '#374151';
  const textHint        = isDarkMode ? '#9CA3AF' : '#6B7280';
  const placeholderColor = isDarkMode ? '#787F8C' : '#A8B0BC';
  const divider         = isDarkMode ? '#2A2A2A' : '#F0F0F0';

  const isEdit = !!route.params?.vehicle;
  const vehicleData = route.params?.vehicle;

  const [formData, setFormData] = useState({
    brand:        vehicleData?.brand || '',
    model:        vehicleData?.model || '',
    year:         vehicleData?.year?.toString() || '',
    color:        vehicleData?.color || '',
    licensePlate: vehicleData?.licensePlate || '',
    capacity:     vehicleData?.capacity?.toString() || '',
  });

  const [features, setFeatures] = useState({
    ac:      vehicleData?.features?.ac      || false,
    music:   vehicleData?.features?.music   || false,
    smoking: vehicleData?.features?.smoking || false,
    pets:    vehicleData?.features?.pets    || false,
    luggage: vehicleData?.features?.luggage || false,
  });

  const [photos, setPhotos] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [registrationCardUri, setRegistrationCardUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingNewPhotos, setProcessingNewPhotos] = useState(false);
  const [processingRegistration, setProcessingRegistration] = useState(false);

  const hasRegistrationOnServer = !!(isEdit && vehicleData?.registrationCardUrl);

  useEffect(() => {
    if (isEdit && vehicleData?.photos?.length > 0) {
      setExistingPhotos(vehicleData.photos);
    }
  }, []);

  const handleChange = (name, value) => setFormData({ ...formData, [name]: value });

  const {
    showPermissionModal,
    setShowPermissionModal,
    openSettings,
    handlePermissionRequest,
    forceRefreshPermissions,
  } = useGalleryPermissions();

  const toggleFeature = (key) => setFeatures(prev => ({ ...prev, [key]: !prev[key] }));

  const compressImage = async (uri) => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch {
      return uri;
    }
  };

  const pickRegistrationCard = async () => {
    const hasPermission = await handlePermissionRequest();
    if (!hasPermission) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setProcessingRegistration(true);
        try {
          setRegistrationCardUri(await compressImage(result.assets[0].uri));
        } finally {
          setProcessingRegistration(false);
        }
      }
    } catch {
      showAlert('Error', 'No se pudo seleccionar la imagen');
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

      if (!result.canceled && result.assets?.length > 0) {
        setProcessingNewPhotos(true);
        try {
          const compressed = await Promise.all(result.assets.map(a => compressImage(a.uri)));
          const next = [...photos, ...compressed];
          if (existingPhotos.length + next.length > 10) {
            showAlert('Error', 'Máximo 10 fotos');
            return;
          }
          setPhotos(next);
        } finally {
          setProcessingNewPhotos(false);
        }
      }
    } catch {
      showAlert('Error', 'No se pudieron seleccionar las imágenes');
    }
  };

  const handleSubmit = async () => {
    const { brand, model, year, color, licensePlate, capacity } = formData;
    if (!brand || !model || !year || !color || !licensePlate || !capacity) {
      showAlert('Error', 'Completa todos los campos');
      return;
    }

    const totalPhotos = existingPhotos.length + photos.length;
    if (!isEdit && totalPhotos < 3) {
      showAlert('Error', `Mínimo 3 fotos. Tenés ${totalPhotos}`);
      return;
    }
    if (isEdit && totalPhotos === 0) {
      showAlert('Error', 'Necesitás al menos 1 foto');
      return;
    }

    if (!isEdit && !registrationCardUri) {
      showAlert('Error', 'Subí la tarjeta verde o cédula del vehículo');
      return;
    }
    if (isEdit && !hasRegistrationOnServer && !registrationCardUri) {
      showAlert('Error', 'Subí la tarjeta verde o cédula del vehículo');
      return;
    }

    const yearNum = parseInt(year);
    if (yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
      showAlert('Error', 'Año no válido');
      return;
    }

    const capacityNum = parseInt(capacity);
    if (capacityNum < 1 || capacityNum > 8) {
      showAlert('Error', 'Capacidad: 1 a 8 pasajeros');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('brand', brand);
      fd.append('model', model);
      fd.append('year', yearNum);
      fd.append('color', color);
      fd.append('licensePlate', licensePlate);
      fd.append('capacity', capacityNum);
      fd.append('features', JSON.stringify(features));

      if (isEdit && existingPhotos.length > 0) {
        fd.append('existingPhotos', JSON.stringify(existingPhotos));
      }

      photos.forEach((uri, index) => {
        const filename = uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        fd.append('photos', { uri, name: filename || `photo-${index}.jpg`, type });
      });

      if (registrationCardUri) {
        const uri = registrationCardUri;
        const filename = uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        fd.append('registrationCard', { uri, name: filename || 'registration-card.jpg', type });
      }

      const response = isEdit
        ? await put_withauth_formdata(`/vehicles/${vehicleData._id}`, fd)
        : await post_withauth_formdata('/vehicles', fd);

      if (response.success) {
        showAlert(
          isEdit ? 'Vehículo actualizado' : 'Vehículo creado',
          isEdit ? 'Tu vehículo fue actualizado correctamente.' : 'Tu vehículo fue registrado correctamente.',
          [{ text: 'OK', onPress: () => navigation.navigate('Vehicles', { refreshVehicles: true }) }]
        );
      } else {
        showAlert('Error', response.message || 'Error al guardar');
      }
    } catch (error) {
      showAlert('Error', error.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const featuresList = [
    { key: 'ac',      label: 'Aire acondicionado', icon: 'snow-outline' },
    { key: 'music',   label: 'Música',             icon: 'musical-notes-outline' },
    { key: 'smoking', label: 'Se puede fumar',     icon: 'flame-outline' },
    { key: 'pets',    label: 'Mascotas',           icon: 'paw-outline' },
    { key: 'luggage', label: 'Equipaje grande',    icon: 'bag-handle-outline' },
  ];

  const fields = [
    { key: 'brand',        label: 'Marca',    placeholder: 'Toyota, Ford, Chevrolet...', half: false },
    { key: 'model',        label: 'Modelo',   placeholder: 'Corolla, Focus, Cruze...',   half: false },
    { key: 'year',         label: 'Año',      placeholder: '2020', half: true, keyboard: 'numeric', max: 4 },
    { key: 'color',        label: 'Color',    placeholder: 'Blanco',                    half: true },
    { key: 'licensePlate', label: 'Patente', placeholder: 'Como figura en el vehículo o documento', half: false, noAutoUpper: true, autoCapitalize: 'none', max: 50 },
    { key: 'capacity',     label: 'Capacidad de pasajeros', placeholder: '4', half: false, keyboard: 'numeric', max: 1 },
  ];

  const totalPhotos = existingPhotos.length + photos.length;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Photos */}
          <View style={[styles.section, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.sectionLabel, { color: textLabel }]}>Fotos</Text>
            <Text style={[styles.sectionHint, { color: textHint }]}>
              {isEdit ? 'Agrega o elimina fotos' : 'Mínimo 3, máximo 10'}
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photosScroll}
              contentContainerStyle={styles.photosContainer}
            >
              {existingPhotos.map((url, i) => (
                <View key={`ex-${i}`} style={styles.photoWrapper}>
                  <RemoteImageWithLoader
                    uri={buildImageUri(url)}
                    style={styles.photoImg}
                    isDarkMode={isDarkMode}
                    spinnerColor={textPrimary}
                  />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => setExistingPhotos(existingPhotos.filter((_, j) => j !== i))}>
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}

              {photos.map((uri, i) => (
                <View key={`new-${i}`} style={styles.photoWrapper}>
                  <Image source={{ uri }} style={styles.photoImg} />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => setPhotos(photos.filter((_, j) => j !== i))}>
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}

              {totalPhotos < 10 && (
                <TouchableOpacity
                  style={[styles.photoAdd, { backgroundColor: divider, borderColor: border }]}
                  onPress={pickImages}
                  disabled={processingNewPhotos}
                  activeOpacity={0.7}
                >
                  {processingNewPhotos ? (
                    <>
                      <ActivityIndicator size="small" color={textPrimary} />
                      <Text style={[styles.photoAddText, styles.photoAddHint, { color: textHint }]}>
                        Procesando…
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="add" size={28} color={textHint} />
                      <Text style={[styles.photoAddText, { color: textHint }]}>{totalPhotos}/10</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Tarjeta verde / cédula */}
          <View style={[styles.section, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.sectionLabel, { color: textLabel }]}>Documentación</Text>
            <Text style={[styles.sectionHint, { color: textHint }]}>
              Tarjeta verde o cédula del vehículo. La patente debe coincidir con lo que cargás abajo (se verifica automáticamente).
            </Text>
            <View style={styles.regCardRow}>
              {registrationCardUri ? (
                <View style={styles.regCardPreview}>
                  <Image source={{ uri: registrationCardUri }} style={styles.regCardImg} />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => setRegistrationCardUri(null)}
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : hasRegistrationOnServer ? (
                <View style={styles.regCardPreview}>
                  <RemoteImageWithLoader
                    uri={buildImageUri(vehicleData.registrationCardUrl)}
                    style={styles.regCardImg}
                    isDarkMode={isDarkMode}
                    spinnerColor={textPrimary}
                  />
                  <Text style={[styles.regCardHint, { color: textHint }]}>Guardada · tocá para reemplazar</Text>
                  <TouchableOpacity
                    style={[styles.regCardReplace, { borderColor: border }]}
                    onPress={pickRegistrationCard}
                    disabled={processingRegistration}
                  >
                    {processingRegistration ? (
                      <ActivityIndicator size="small" color={textPrimary} />
                    ) : (
                      <Text style={[styles.regCardReplaceText, { color: textPrimary }]}>Cambiar imagen</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.regCardAdd, { backgroundColor: divider, borderColor: border }]}
                  onPress={pickRegistrationCard}
                  disabled={processingRegistration}
                >
                  {processingRegistration ? (
                    <>
                      <ActivityIndicator size="small" color={textPrimary} />
                      <Text style={[styles.photoAddText, styles.photoAddHint, { color: textHint }]}>
                        Procesando…
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="document-text-outline" size={28} color={textHint} />
                      <Text style={[styles.photoAddText, { color: textHint }]}>Subir documento</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Info */}
          <View style={[styles.section, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.sectionLabel, { color: textLabel }]}>Información</Text>

            <View style={styles.row}>
              {fields.filter(f => f.half).map(f => (
                <View key={f.key} style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={[styles.label, { color: textLabel }]}>{f.label}</Text>
                  <TextInput
                    style={[styles.input, { borderBottomColor: border, color: textPrimary }]}
                    value={formData[f.key]}
                    onChangeText={v => handleChange(f.key, f.noAutoUpper ? v : (f.caps ? v.toUpperCase() : v))}
                    placeholder={f.placeholder}
                    placeholderTextColor={placeholderColor}
                    keyboardType={f.keyboard || 'default'}
                    maxLength={f.max}
                    autoCapitalize={f.autoCapitalize ?? (f.caps ? 'characters' : 'sentences')}
                  />
                </View>
              ))}
            </View>

            {fields.filter(f => !f.half).map(f => (
              <View key={f.key} style={styles.inputGroup}>
                <Text style={[styles.label, { color: textLabel }]}>{f.label}</Text>
                <TextInput
                  style={[styles.input, { borderBottomColor: border, color: textPrimary }]}
                  value={formData[f.key]}
                  onChangeText={v => handleChange(f.key, f.noAutoUpper ? v : (f.caps ? v.toUpperCase() : v))}
                  placeholder={f.placeholder}
                  placeholderTextColor={placeholderColor}
                  keyboardType={f.keyboard || 'default'}
                  maxLength={f.max}
                  autoCapitalize={f.autoCapitalize ?? (f.caps ? 'characters' : 'sentences')}
                />
              </View>
            ))}
          </View>

          {/* Features */}
          <View style={[styles.section, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.sectionLabel, { color: textLabel }]}>Características</Text>

            {featuresList.map((f, index) => (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.featureRow,
                  index < featuresList.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider },
                ]}
                onPress={() => toggleFeature(f.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.featureIcon, { backgroundColor: divider }]}>
                  <Ionicons name={f.icon} size={18} color={textPrimary} />
                </View>
                <Text style={[styles.featureLabel, { color: textPrimary }]}>{f.label}</Text>
                <View style={[
                  styles.toggle,
                  { backgroundColor: features[f.key] ? textPrimary : divider },
                ]}>
                  <View style={[
                    styles.toggleCircle,
                    { backgroundColor: features[f.key] ? (isDarkMode ? '#000000' : '#FFFFFF') : textMuted },
                    features[f.key] && styles.toggleCircleOn,
                  ]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' },
              (loading || processingNewPhotos || processingRegistration) && { opacity: 0.6 },
            ]}
            onPress={handleSubmit}
            disabled={loading || processingNewPhotos || processingRegistration}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={isDarkMode ? '#000000' : '#FFFFFF'} size="small" />
              : <Text style={[styles.submitText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>
                  {isEdit ? 'Guardar cambios' : 'Crear vehículo'}
                </Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Acceso a galería"
        message="Necesitamos acceso a tu galería para agregar fotos del vehículo."
        onOpenSettings={openSettings}
        onRefreshPermissions={forceRefreshPermissions}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1 },
  flex:        { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 12 },

  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },

  // Photos
  photosScroll:    { marginHorizontal: -20 },
  photosContainer: { paddingHorizontal: 20, gap: 10 },
  photoWrapper: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoAdd: {
    width: 90,
    height: 90,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  photoAddText: {
    fontSize: 14,
    fontWeight: '600',
  },
  photoAddHint: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },

  regCardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  regCardPreview: {
    maxWidth: '100%',
  },
  regCardImg: {
    width: 200,
    height: 120,
    borderRadius: 10,
  },
  regCardHint: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  regCardReplace: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  regCardReplaceText: {
    fontSize: 14,
    fontWeight: '600',
  },
  regCardAdd: {
    width: 200,
    minHeight: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    padding: 16,
  },

  // Form
  row:       { flexDirection: 'row', gap: 20 },
  halfWidth: { flex: 1 },
  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    marginBottom: 8,
  },
  input: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },

  // Features
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    padding: 2,
    justifyContent: 'center',
  },
  toggleCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  toggleCircleOn: {
    alignSelf: 'flex-end',
  },

  // Submit
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VehicleFormScreen;
