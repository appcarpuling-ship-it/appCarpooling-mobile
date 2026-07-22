import React, { useState, useEffect, useMemo } from 'react';
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
import { useHeaderHeight } from '@react-navigation/elements';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { post_withauth_formdata, put_withauth_formdata, buildImageUri } from '../../../services/apiService';
import { useGalleryPermissions } from '../../../hooks/useGalleryPermissions';
import { useUI } from '../../../theme/ui';
import { useAlert } from '../../../context/AlertContext';
import PermissionModal from '../../../components/modals/PermissionModal';
import RemoteImageWithLoader from '../../../components/RemoteImageWithLoader';
import PillButton from '../../../components/ui/PillButton';

const VehicleFormScreen = ({ navigation, route }) => {
  const ui = useUI();
  const { showAlert } = useAlert();
  const headerHeight = useHeaderHeight();

  const isDarkMode  = ui.isDarkMode;
  const bg          = ui.bg;
  const cardBg      = ui.surface;
  const border      = ui.border;
  const textPrimary     = ui.text;
  const textMuted       = ui.textMuted;
  const textHint        = ui.textMuted;
  const placeholderColor = ui.textMuted;
  const divider         = ui.bg;

  const isEdit = !!route.params?.vehicle;
  const vehicleData = route.params?.vehicle;

  const VEHICLE_TYPES = [
    { key: 'sedan',    label: 'Sedán',    maxCapacity: 4 },
    { key: 'hatchback',label: 'Hatchback',maxCapacity: 4 },
    { key: 'suv',      label: 'SUV',      maxCapacity: 6 },
    { key: 'pickup',   label: 'Pickup',   maxCapacity: 3 },
    { key: 'van',      label: 'Van',      maxCapacity: 8 },
    { key: 'otro',     label: 'Otro',     maxCapacity: 8 },
  ];

  const [selectedType, setSelectedType] = useState(vehicleData?.type || 'sedan');
  const [focusedField, setFocusedField] = useState(null);
  const maxCapacityForType = VEHICLE_TYPES.find(t => t.key === selectedType)?.maxCapacity ?? 8;

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

  /** Índice alineado con existingPhotos (buildImageUri no puede filtrarse sin romper el botón ✕). */
  const resolvedExistingPhotoRows = useMemo(
    () =>
      existingPhotos.map((p, idx) => {
        const raw = typeof p === 'string' ? p : '';
        return { idx, fullUri: raw ? buildImageUri(raw) : null };
      }),
    [existingPhotos],
  );

  const registrationSavedUri =
    !registrationCardUri && hasRegistrationOnServer && vehicleData?.registrationCardUrl
      ? buildImageUri(vehicleData.registrationCardUrl)
      : null;

  const handleChange = (name, value) => {
    if (name === 'capacity') {
      const num = parseInt(value);
      if (!isNaN(num) && num > maxCapacityForType) return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleTypeChange = (typeKey) => {
    setSelectedType(typeKey);
    const maxCap = VEHICLE_TYPES.find(t => t.key === typeKey)?.maxCapacity ?? 8;
    const currentCap = parseInt(formData.capacity);
    if (!isNaN(currentCap) && currentCap > maxCap) {
      setFormData(prev => ({ ...prev, capacity: maxCap.toString() }));
    }
  };

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
      showAlert('Ocurrió algo', 'No se pudo seleccionar la imagen');
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
            showAlert('Ocurrió algo', 'Máximo 10 fotos');
            return;
          }
          setPhotos(next);
        } finally {
          setProcessingNewPhotos(false);
        }
      }
    } catch {
      showAlert('Ocurrió algo', 'No se pudieron seleccionar las imágenes');
    }
  };

  const handleSubmit = async () => {
    const { brand, model, year, color, licensePlate, capacity } = formData;
    if (!brand || !model || !year || !color || !licensePlate || !capacity) {
      showAlert('Ocurrió algo', 'Completa todos los campos');
      return;
    }

    const totalPhotos = existingPhotos.length + photos.length;
    if (!isEdit && totalPhotos < 3) {
      showAlert('Ocurrió algo', `Mínimo 3 fotos. Tenés ${totalPhotos}`);
      return;
    }
    if (isEdit && totalPhotos === 0) {
      showAlert('Ocurrió algo', 'Necesitás al menos 1 foto');
      return;
    }

    if (!isEdit && !registrationCardUri) {
      showAlert('Ocurrió algo', 'Subí la tarjeta verde o cédula del vehículo');
      return;
    }
    if (isEdit && !hasRegistrationOnServer && !registrationCardUri) {
      showAlert('Ocurrió algo', 'Subí la tarjeta verde o cédula del vehículo');
      return;
    }

    const yearNum = parseInt(year);
    if (yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
      showAlert('Ocurrió algo', 'Año no válido');
      return;
    }

    const capacityNum = parseInt(capacity);
    if (capacityNum < 1 || capacityNum > maxCapacityForType) {
      showAlert('Ocurrió algo', `Capacidad: 1 a ${maxCapacityForType} pasajeros para el tipo seleccionado`);
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
      fd.append('type', selectedType);
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
          isEdit ? 'Vehículo Actualizado' : 'Vehículo Registrado',
          isEdit ? 'Los cambios en tu vehículo se guardaron correctamente.' : 'Tu vehículo fue registrado con éxito.',
          [{ text: 'Continuar', onPress: () => navigation.navigate('Vehicles', { refreshVehicles: true }) }],
          'success'
        );
      } else {
        showAlert('Ocurrió algo', response.message || 'No pudimos guardar el vehículo.', [], 'error');
      }
    } catch (error) {
      showAlert('Ocurrió algo', error.message || 'No pudimos guardar el vehículo.', [], 'error');
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
    { key: 'licensePlate', label: 'Patente', placeholder: 'Como figura en el vehículo o documento', half: false, caps: true, autoCapitalize: 'characters', max: 50 },
    { key: 'capacity',     label: `Capacidad de pasajeros (máx. ${maxCapacityForType})`, placeholder: `1–${maxCapacityForType}`, half: false, keyboard: 'numeric', max: 1 },
  ];

  const totalPhotos = existingPhotos.length + photos.length;

  // Mismo campo relleno que en editar perfil: etiqueta adentro y foco marcado
  // con el borde, en vez de la fila subrayada.
  const renderField = (f, half) => (
    <View
      key={f.key}
      style={[
        styles.field,
        half && styles.fieldHalf,
        { backgroundColor: cardBg, borderColor: focusedField === f.key ? textPrimary : 'transparent' },
      ]}
    >
      <Text style={[styles.fieldLabel, { color: textMuted }]} numberOfLines={1}>{f.label}</Text>
      <TextInput
        style={[styles.fieldInput, { color: textPrimary }]}
        value={formData[f.key]}
        onChangeText={v => handleChange(f.key, f.noAutoUpper ? v : (f.caps ? v.toUpperCase() : v))}
        onFocus={() => setFocusedField(f.key)}
        onBlur={() => setFocusedField(null)}
        placeholder={f.placeholder}
        placeholderTextColor={placeholderColor}
        keyboardType={f.keyboard || 'default'}
        maxLength={f.max}
        autoCapitalize={f.autoCapitalize ?? (f.caps ? 'characters' : 'sentences')}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* keyboardVerticalOffset: esta pantalla tiene header nativo del stack, que queda FUERA
          del KeyboardAvoidingView. En iOS el KAV mide desde su propio marco, así que sin el alto
          del header le falta ese desplazamiento y el input enfocado termina tapado por el teclado.
          (El registro no lo sufre porque su nav está adentro del KAV.) */}
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

          {/* Titulo */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: textPrimary }]}>
              {isEdit ? 'Editá tu' : 'Sumá tu'}{'\n'}
              <Text style={styles.titleStrong}>vehículo</Text>
            </Text>
            <Text style={[styles.subtitle, { color: textMuted }]}>
              {isEdit
                ? 'Actualizá las fotos, los datos o lo que ofrecés a bordo.'
                : 'Cargá las fotos y los datos para empezar a publicar viajes.'}
            </Text>
          </View>

          {/* Photos */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>Fotos</Text>
            <Text style={[styles.sectionHint, { color: textMuted }]}>
              {isEdit ? 'Agregá o eliminá fotos.' : `Mínimo 3, máximo 10. Llevás ${totalPhotos}.`}
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photosScroll}
              contentContainerStyle={styles.photosContainer}
            >
              {resolvedExistingPhotoRows.map(({ idx, fullUri }) => (
                <View key={`ex-${idx}`} style={styles.photoWrapper}>
                  {fullUri ? (
                    <RemoteImageWithLoader
                      uri={fullUri}
                      style={styles.photoImg}
                      isDarkMode={isDarkMode}
                      spinnerColor={textPrimary}
                    />
                  ) : (
                    <View style={[styles.photoImg, { backgroundColor: divider, justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="image-outline" size={26} color={textMuted} />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => setExistingPhotos(existingPhotos.filter((_, j) => j !== idx))}
                  >
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
                  style={[styles.photoAdd, { backgroundColor: cardBg, borderColor: border }]}
                  onPress={pickImages}
                  disabled={processingNewPhotos}
                  activeOpacity={0.7}
                >
                  {processingNewPhotos ? (
                    <>
                      <ActivityIndicator size="small" color={textPrimary} />
                      <Text style={[styles.photoAddText, styles.photoAddHint, { color: textMuted }]}>
                        Procesando…
                      </Text>
                    </>
                  ) : (
                    <>
                      <View style={[styles.photoAddIcon, { backgroundColor: ui.invertBg }]}>
                        <Ionicons name="add" size={22} color={ui.invertText} />
                      </View>
                      <Text style={[styles.photoAddText, { color: textMuted }]}>{totalPhotos}/10</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Tipo de vehículo */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>Tipo</Text>
            <Text style={[styles.sectionHint, { color: textMuted }]}>
              Define el máximo de pasajeros que podés ofrecer.
            </Text>
            <View style={styles.chipsWrap}>
              {VEHICLE_TYPES.map((t) => {
                const on = selectedType === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.chip, { backgroundColor: on ? ui.invertBg : cardBg }]}
                    onPress={() => handleTypeChange(t.key)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.chipText, { color: on ? ui.invertText : textPrimary }]}>{t.label}</Text>
                    <Text style={[styles.chipMeta, { color: on ? ui.invertText : textMuted }]}>{t.maxCapacity}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Tarjeta verde / cédula */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>Documentación</Text>
            <Text style={[styles.sectionHint, { color: textMuted }]}>
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
                    uri={registrationSavedUri}
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
                  style={[styles.regCardAdd, { backgroundColor: cardBg, borderColor: border }]}
                  onPress={pickRegistrationCard}
                  disabled={processingRegistration}
                >
                  {processingRegistration ? (
                    <>
                      <ActivityIndicator size="small" color={textPrimary} />
                      <Text style={[styles.photoAddText, styles.photoAddHint, { color: textMuted }]}>
                        Procesando…
                      </Text>
                    </>
                  ) : (
                    <>
                      <View style={[styles.photoAddIcon, { backgroundColor: ui.invertBg }]}>
                        <Ionicons name="document-text-outline" size={20} color={ui.invertText} />
                      </View>
                      <Text style={[styles.photoAddText, { color: textMuted }]}>Subir documento</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Info */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>Información</Text>

            <View style={styles.fieldStack}>
              <View style={styles.row}>
                {fields.filter(f => f.half).map(f => renderField(f, true))}
              </View>
              {fields.filter(f => !f.half).map(f => renderField(f, false))}
            </View>
          </View>

          {/* Features: chips que se prenden, como los tags de la referencia */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>Características</Text>
            <Text style={[styles.sectionHint, { color: textMuted }]}>
              Tocá lo que ofrecés a bordo.
            </Text>
            <View style={styles.chipsWrap}>
              {featuresList.map((f) => {
                const on = features[f.key];
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.featureChip, { backgroundColor: on ? ui.invertBg : cardBg }]}
                    onPress={() => toggleFeature(f.key)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Ionicons name={f.icon} size={16} color={on ? ui.invertText : textMuted} />
                    <Text style={[styles.featureChipText, { color: on ? ui.invertText : textPrimary }]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <PillButton
            label={isEdit ? 'Guardar cambios' : 'Crear vehículo'}
            onPress={handleSubmit}
            loading={loading}
            disabled={processingNewPhotos || processingRegistration}
            style={styles.submit}
          />

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
  scrollContent: { paddingBottom: 48 },

  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 30 },
  title:       { fontFamily: 'Sora_300Light', fontSize: 32, lineHeight: 40, letterSpacing: -1 },
  titleStrong: { fontFamily: 'Sora_800ExtraBold' },
  subtitle:    { fontFamily: 'Sora_400Regular', fontSize: 15, lineHeight: 22, marginTop: 12 },

  // Las secciones ya no son cards con borde: la etiqueta va afuera y el gris lo
  // aportan los campos, igual que en editar perfil.
  section: { paddingHorizontal: 24, marginBottom: 30 },
  sectionLabel: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionHint: {
    fontFamily: 'Sora_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
    marginLeft: 4,
  },

  // Photos
  photosScroll:    { marginHorizontal: -24 },
  photosContainer: { paddingHorizontal: 24, gap: 12 },
  photoWrapper: {
    width: 108,
    height: 108,
    borderRadius: 20,
    overflow: 'hidden',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoAdd: {
    width: 108,
    height: 108,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  photoAddIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddText: {
    fontSize: 12,
    fontFamily: 'Sora_600SemiBold',
  },
  photoAddHint: {
    fontSize: 11,
    fontFamily: 'Sora_500Medium',
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
    width: 220,
    height: 132,
    borderRadius: 20,
  },
  regCardHint: {
    fontFamily: 'Sora_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  regCardReplace: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
  },
  regCardReplaceText: {
    fontSize: 13,
    fontFamily: 'Sora_600SemiBold',
  },
  regCardAdd: {
    width: 220,
    minHeight: 132,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },

  // Chips (tipo y caracteristicas)
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
  },
  chipText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  chipMeta: { fontSize: 12, fontFamily: 'Sora_500Medium', opacity: 0.7 },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
  },
  featureChipText: { fontSize: 14, fontFamily: 'Sora_500Medium' },

  // Campos
  fieldStack: { gap: 10 },
  row:        { flexDirection: 'row', gap: 10 },
  field: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 13,
  },
  fieldHalf: { flex: 1 },
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

  submit: { marginHorizontal: 24, marginTop: 4 },
});

export default VehicleFormScreen;
