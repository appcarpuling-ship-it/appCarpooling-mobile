import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { post_withauth, get_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { ARGENTINA_PROVINCES } from '../../../constants/provinces';
import PillButton from '../../../components/ui/PillButton';
import { useAlert } from '../../../context/AlertContext';
import { useUI } from '../../../theme/ui';

const CreateTripScreen = ({ navigation }) => {
  const { showAlert } = useAlert();
  const ui = useUI();

  const bg = ui.bg;
  const cardBg = ui.surface;
  const border = ui.border;
  const textPrimary = ui.text;
  const textMuted = ui.textMuted;


  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [showOriginProvincePicker, setShowOriginProvincePicker] = useState(false);
  const [showDestinationProvincePicker, setShowDestinationProvincePicker] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());
  const [formData, setFormData] = useState({
    vehicle: '',
    origin: { address: '', city: '', province: '' },
    destination: { address: '', city: '', province: '' },
    departureDate: '',
    departureTime: '',
    availableSeats: '',
    pricePerSeat: '',
    notes: '',
    allowSmoking: false,
    allowPets: false,
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadVehicles();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadVehicles = async () => {
    try {
      setLoadingVehicles(true);
      const response = await get_withauth(ENDPOINTS.MY_VEHICLES);
      if (response.success) {
        setVehicles(response.data);
      } else {
        showAlert('Ocurrió algo', 'No se pudieron cargar los vehículos: ' + (response.message || 'Error desconocido'));
      }
    } catch (error) {
      showAlert('Ocurrió algo', 'Error al cargar vehículos: ' + error.message);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData({ ...formData, [parent]: { ...formData[parent], [child]: value } });
    } else {
      setFormData({ ...formData, [field]: value });
    }
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (selectedDate && event.type === 'set') confirmDate(selectedDate);
    } else if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatTimeForDisplay = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const confirmDate = (selectedDate) => {
    setDate(selectedDate);
    setShowDatePicker(false);
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    setFormData({ ...formData, departureDate: `${year}-${month}-${day}` });
  };

  const onTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (selectedTime && event.type === 'set') confirmTime(selectedTime);
    } else if (selectedTime) {
      setTempTime(selectedTime);
    }
  };

  const confirmTime = (selectedTime) => {
    setTime(selectedTime);
    setShowTimePicker(false);
    const hours = selectedTime.getHours().toString().padStart(2, '0');
    const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
    setFormData({ ...formData, departureTime: `${hours}:${minutes}` });
  };

  const handleCreateTrip = async () => {
    const { vehicle, origin, destination, departureDate, departureTime, availableSeats, pricePerSeat } = formData;

    if (
      !vehicle || !origin.address || !origin.city || !origin.province ||
      !destination.address || !destination.city || !destination.province ||
      !departureDate || !departureTime || !availableSeats
    ) {
      navigation.navigate('Result', { type: 'error', title: 'Error', message: 'Por favor completa todos los campos obligatorios' });
      return;
    }

    const seatsNum = parseInt(availableSeats);
    const selectedVehicle = vehicles.find(v => v._id === vehicle);
    if (selectedVehicle?.capacity && seatsNum > selectedVehicle.capacity) {
      navigation.navigate('Result', { type: 'error', title: 'Error', message: `El vehículo tiene capacidad máxima de ${selectedVehicle.capacity} pasajero${selectedVehicle.capacity !== 1 ? 's' : ''}` });
      return;
    }

    setLoading(true);
    try {
      const tripData = {
        vehicle: formData.vehicle,
        origin: formData.origin,
        destination: formData.destination,
        departureDate: formData.departureDate,
        departureTime: formData.departureTime,
        availableSeats: parseInt(availableSeats),
        notes: formData.notes,
        rules: { smokingAllowed: formData.allowSmoking, petsAllowed: formData.allowPets },
      };

      tripData.pricePerSeat = pricePerSeat && pricePerSeat.trim() !== '' ? parseFloat(pricePerSeat) : 0;

      const response = await post_withauth(ENDPOINTS.CREATE_TRIP, tripData);
      if (response.success) {
        // replace (no push): al confirmar, el goBack de ResultScreen vuelve
        // directo a la pantalla previa a la creación, no a este formulario.
        navigation.replace('Result', { type: 'success', title: 'Éxito', message: 'Viaje creado exitosamente' });
      }
    } catch (error) {
      navigation.navigate('Result', { type: 'error', title: 'Error', message: error.message || 'Error al crear el viaje' });
    } finally {
      setLoading(false);
    }
  };

  const selectedVehicleLabel = formData.vehicle
    ? (() => {
        const v = vehicles.find(v => v._id === formData.vehicle);
        return v ? `${v.brand} ${v.model} - ${v.licensePlate}` : 'Selecciona un vehículo';
      })()
    : '';

  // Hoja inferior compartida por los pickers de esta pantalla: corners 28,
  // título 24 ExtraBold, cierre circular y toque afuera para cerrar.
  const Sheet = ({ visible, onClose, title, children }) => (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: bg }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: textPrimary }]}>{title}</Text>
            <TouchableOpacity style={[styles.sheetClose, { backgroundColor: cardBg }]} onPress={onClose}>
              <Ionicons name="close" size={18} color={textPrimary} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );

  const renderField = ({ key, label, placeholder, keyboard, multiline, caps, onChangeText, value }) => (
    <View
      style={[
        styles.field,
        multiline && styles.fieldMultiline,
        { backgroundColor: cardBg, borderColor: focusedField === key ? textPrimary : 'transparent' },
      ]}
    >
      <Text style={[styles.fieldLabel, { color: textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { color: textPrimary }, multiline && styles.fieldInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocusedField(key)}
        onBlur={() => setFocusedField(null)}
        placeholder={placeholder}
        placeholderTextColor={textMuted}
        keyboardType={keyboard || 'default'}
        autoCapitalize={caps ? 'characters' : 'sentences'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );

  if (loadingVehicles) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={textPrimary} />
        <Text style={[styles.emptyText, { color: textPrimary }]}>Cargando vehículos...</Text>
      </View>
    );
  }

  if (!loadingVehicles && vehicles.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: bg }]}>
        <Image
          source={require('../../../../assets/illustrations/empty-vehicles.png')}
          style={styles.emptyIllustration}
          resizeMode="contain"
        />
        <Text style={[styles.emptyText, { color: textPrimary }]}>No tienes vehículos registrados</Text>
        <Text style={[styles.emptySubtext, { color: textMuted }]}>
          Necesitas registrar un vehículo antes de crear un viaje
        </Text>
        <TouchableOpacity
          style={[styles.addVehicleButton, { backgroundColor: ui.invertBg }]}
          onPress={() => navigation.navigate('Vehicles')}
          activeOpacity={0.85}
        >
          <Text style={[styles.addVehicleButtonText, { color: ui.invertText }]}>Agregar Vehículo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: textPrimary }]}>
                Compartí tu{'\n'}
                <Text style={styles.titleStrong}>próximo viaje</Text>
              </Text>
            </View>

            {/* Vehículo */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: textMuted }]}>Vehículo</Text>
              <TouchableOpacity
                style={[styles.field, { backgroundColor: cardBg }]}
                onPress={() => setShowVehiclePicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.fieldRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: textMuted }]}>Auto</Text>
                    <Text style={[styles.fieldInput, { color: formData.vehicle ? textPrimary : textMuted }]} numberOfLines={1}>
                      {selectedVehicleLabel || 'Selecciona un vehículo'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={textMuted} />
                </View>
              </TouchableOpacity>

              <Sheet visible={showVehiclePicker} onClose={() => setShowVehiclePicker(false)} title="Vehículo">
                <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
                  {vehicles.map((vehicle) => {
                    const selected = formData.vehicle === vehicle._id;
                    return (
                      <TouchableOpacity
                        key={vehicle._id}
                        style={[styles.sheetItem, { backgroundColor: selected ? ui.invertBg : cardBg }]}
                        onPress={() => { handleChange('vehicle', vehicle._id); setShowVehiclePicker(false); }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="car" size={20} color={selected ? ui.invertText : textMuted} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.sheetItemTitle, { color: selected ? ui.invertText : textPrimary }]}>
                            {vehicle.brand} {vehicle.model}
                          </Text>
                          <Text style={[styles.sheetItemSubtitle, { color: selected ? ui.invertText : textMuted }]}>
                            {vehicle.licensePlate}
                          </Text>
                        </View>
                        {selected && <Ionicons name="checkmark-circle" size={22} color={ui.invertText} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </Sheet>
            </View>

            {/* Origen */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: textMuted }]}>Origen</Text>

              <TouchableOpacity
                style={[styles.field, { backgroundColor: cardBg, marginBottom: 10 }]}
                onPress={() => setShowOriginProvincePicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.fieldRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: textMuted }]}>Provincia</Text>
                    <Text style={[styles.fieldInput, { color: formData.origin.province ? textPrimary : textMuted }]}>
                      {formData.origin.province || 'Elegí una provincia'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={textMuted} />
                </View>
              </TouchableOpacity>

              {renderField({
                key: 'originCity', label: 'Ciudad', placeholder: 'Ciudad de origen',
                value: formData.origin.city, onChangeText: v => handleChange('origin.city', v),
              })}
              <View style={{ height: 10 }} />
              {renderField({
                key: 'originAddress', label: 'Dirección', placeholder: 'Calle y altura',
                value: formData.origin.address, onChangeText: v => handleChange('origin.address', v),
              })}

              <Sheet
                visible={showOriginProvincePicker}
                onClose={() => setShowOriginProvincePicker(false)}
                title="Provincia de origen"
              >
                <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
                  {ARGENTINA_PROVINCES.map((province) => {
                    const selected = formData.origin.province === province;
                    return (
                      <TouchableOpacity
                        key={province}
                        style={[styles.sheetItem, { backgroundColor: selected ? ui.invertBg : cardBg }]}
                        onPress={() => { handleChange('origin.province', province); setShowOriginProvincePicker(false); }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.sheetItemTitle, { color: selected ? ui.invertText : textPrimary, flex: 1 }]}>
                          {province}
                        </Text>
                        {selected && <Ionicons name="checkmark-circle" size={22} color={ui.invertText} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </Sheet>
            </View>

            {/* Destino */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: textMuted }]}>Destino</Text>

              <TouchableOpacity
                style={[styles.field, { backgroundColor: cardBg, marginBottom: 10 }]}
                onPress={() => setShowDestinationProvincePicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.fieldRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: textMuted }]}>Provincia</Text>
                    <Text style={[styles.fieldInput, { color: formData.destination.province ? textPrimary : textMuted }]}>
                      {formData.destination.province || 'Elegí una provincia'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={textMuted} />
                </View>
              </TouchableOpacity>

              {renderField({
                key: 'destCity', label: 'Ciudad', placeholder: 'Ciudad de destino',
                value: formData.destination.city, onChangeText: v => handleChange('destination.city', v),
              })}
              <View style={{ height: 10 }} />
              {renderField({
                key: 'destAddress', label: 'Dirección', placeholder: 'Calle y altura',
                value: formData.destination.address, onChangeText: v => handleChange('destination.address', v),
              })}

              <Sheet
                visible={showDestinationProvincePicker}
                onClose={() => setShowDestinationProvincePicker(false)}
                title="Provincia de destino"
              >
                <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
                  {ARGENTINA_PROVINCES.map((province) => {
                    const selected = formData.destination.province === province;
                    return (
                      <TouchableOpacity
                        key={province}
                        style={[styles.sheetItem, { backgroundColor: selected ? ui.invertBg : cardBg }]}
                        onPress={() => { handleChange('destination.province', province); setShowDestinationProvincePicker(false); }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.sheetItemTitle, { color: selected ? ui.invertText : textPrimary, flex: 1 }]}>
                          {province}
                        </Text>
                        {selected && <Ionicons name="checkmark-circle" size={22} color={ui.invertText} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </Sheet>
            </View>

            {/* Detalles */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: textMuted }]}>Detalles del viaje</Text>

              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.field, styles.fieldHalf, { backgroundColor: cardBg }]}
                  onPress={() => { setTempDate(date); setShowDatePicker(true); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.fieldLabel, { color: textMuted }]}>Fecha</Text>
                  <Text style={[styles.fieldInput, { color: formData.departureDate ? textPrimary : textMuted }]} numberOfLines={1}>
                    {formData.departureDate ? formatDateForDisplay(formData.departureDate) : 'Elegir'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.field, styles.fieldHalf, { backgroundColor: cardBg }]}
                  onPress={() => { setTempTime(time); setShowTimePicker(true); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.fieldLabel, { color: textMuted }]}>Hora</Text>
                  <Text style={[styles.fieldInput, { color: formData.departureTime ? textPrimary : textMuted }]} numberOfLines={1}>
                    {formData.departureTime ? formatTimeForDisplay(formData.departureTime) : 'Elegir'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 10 }} />

              {renderField({
                key: 'seats', label: 'Asientos disponibles', placeholder: 'Ej. 3', keyboard: 'numeric',
                value: formData.availableSeats, onChangeText: v => handleChange('availableSeats', v),
              })}
              {formData.vehicle && (() => {
                const sv = vehicles.find(v => v._id === formData.vehicle);
                return sv?.capacity ? (
                  <Text style={[styles.fieldHint, { color: textMuted }]}>
                    Máx. {sv.capacity} según el vehículo
                  </Text>
                ) : null;
              })()}

              <View style={{ height: 10 }} />
              {renderField({
                key: 'price', label: 'Precio por asiento (opcional)', placeholder: '$', keyboard: 'decimal-pad',
                value: formData.pricePerSeat, onChangeText: v => handleChange('pricePerSeat', v),
              })}

              <View style={{ height: 10 }} />
              {renderField({
                key: 'notes', label: 'Notas (opcional)', placeholder: 'Punto de encuentro, equipaje, etc.',
                value: formData.notes, onChangeText: v => handleChange('notes', v), multiline: true,
              })}

              <Sheet visible={showDatePicker} onClose={() => setShowDatePicker(false)} title="Fecha de salida">
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                  minimumDate={new Date()}
                  textColor={textPrimary}
                  themeVariant={ui.isDarkMode ? 'dark' : 'light'}
                />
                {Platform.OS === 'ios' && (
                  <PillButton label="Confirmar" onPress={() => confirmDate(tempDate)} style={styles.sheetConfirm} />
                )}
              </Sheet>

              <Sheet visible={showTimePicker} onClose={() => setShowTimePicker(false)} title="Hora de salida">
                <DateTimePicker
                  value={tempTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onTimeChange}
                  textColor={textPrimary}
                  themeVariant={ui.isDarkMode ? 'dark' : 'light'}
                />
                {Platform.OS === 'ios' && (
                  <PillButton label="Confirmar" onPress={() => confirmTime(tempTime)} style={styles.sheetConfirm} />
                )}
              </Sheet>
            </View>

            {/* Preferencias */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: textMuted }]}>Preferencias</Text>

              <View style={[styles.switchRow, { backgroundColor: cardBg }]}>
                <View style={styles.switchLabelContainer}>
                  <Ionicons name="cloud-outline" size={18} color={textMuted} />
                  <Text style={[styles.switchLabel, { color: textPrimary }]}>Permitir fumar</Text>
                </View>
                <Switch
                  value={formData.allowSmoking}
                  onValueChange={(value) => handleChange('allowSmoking', value)}
                  trackColor={{ false: border, true: ui.invertBg }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={border}
                />
              </View>

              <View style={{ height: 10 }} />

              <View style={[styles.switchRow, { backgroundColor: cardBg }]}>
                <View style={styles.switchLabelContainer}>
                  <Ionicons name="paw-outline" size={18} color={textMuted} />
                  <Text style={[styles.switchLabel, { color: textPrimary }]}>Permitir mascotas</Text>
                </View>
                <Switch
                  value={formData.allowPets}
                  onValueChange={(value) => handleChange('allowPets', value)}
                  trackColor={{ false: border, true: ui.invertBg }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={border}
                />
              </View>
            </View>

            <PillButton
              label="Crear viaje"
              onPress={handleCreateTrip}
              loading={loading}
              style={styles.submit}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 26 },
  title: { fontFamily: 'Sora_300Light', fontSize: 32, lineHeight: 40, letterSpacing: -1 },
  titleStrong: { fontFamily: 'Sora_800ExtraBold' },

  section: { paddingHorizontal: 24, marginBottom: 26 },
  sectionLabel: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },

  row: { flexDirection: 'row', gap: 10 },

  field: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 13,
  },
  fieldHalf: { flex: 1 },
  fieldMultiline: { paddingBottom: 13 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  fieldInputMultiline: {
    minHeight: 60,
  },
  fieldHint: {
    fontSize: 12,
    fontFamily: 'Sora_500Medium',
    marginTop: 6,
    marginLeft: 4,
  },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  switchLabelContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchLabel: { fontSize: 15, fontFamily: 'Sora_500Medium' },

  submit: { marginHorizontal: 24, marginTop: 4 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIllustration: { width: 220, height: 220 },
  emptyText: { fontSize: 18, fontFamily: 'Sora_600SemiBold', marginTop: 16, textAlign: 'center' },
  emptySubtext: { fontSize: 14, fontFamily: 'Sora_400Regular', marginTop: 8, textAlign: 'center' },
  addVehicleButton: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28, marginTop: 24 },
  addVehicleButtonText: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 22, fontFamily: 'Sora_800ExtraBold' },
  sheetClose: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  sheetList: { maxHeight: 420 },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  sheetItemTitle: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
  sheetItemSubtitle: { fontSize: 12, fontFamily: 'Sora_500Medium', marginTop: 2 },
  sheetConfirm: { marginTop: 16 },
});

export default CreateTripScreen;
