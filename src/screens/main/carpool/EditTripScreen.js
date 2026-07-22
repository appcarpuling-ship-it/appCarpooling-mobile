import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { get_withauth, put_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import useColors from '../../../hooks/useColors';
import { useAlert } from '../../../context/AlertContext';
import ConfirmationModal from '../../../components/modals/ConfirmationModal';
import { useUI } from '../../../theme/ui';

const EditTripScreen = ({ navigation, route }) => {
  const { showAlert } = useAlert();
  const { isDarkMode } = useColors();


  const ui = useUI();
  const bg      = ui.bg;
  const cardBg  = ui.surface;
  const border  = ui.border;
  const tp      = ui.invertBg;
  const tm      = ui.textMuted;

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal]     = useState(false);
  const [modalMessage, setModalMessage]         = useState('');
  const { tripId } = route.params;
  const [vehicles, setVehicles]                 = useState([]);
  const [loading, setLoading]                   = useState(false);
  const [loadingTrip, setLoadingTrip]           = useState(true);
  const [loadingVehicles, setLoadingVehicles]   = useState(true);
  const [showDatePicker, setShowDatePicker]     = useState(false);
  const [showTimePicker, setShowTimePicker]     = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [date, setDate]       = useState(new Date());
  const [time, setTime]       = useState(new Date());
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());
  const [occupiedSeats, setOccupiedSeats] = useState(0);
  const [formData, setFormData] = useState({
    vehicle: '',
    origin:      { address: '', city: '', province: '' },
    destination: { address: '', city: '', province: '' },
    intermediateStops: [],
    departureDate: '',
    departureTime: '',
    availableSeats: '',
    pricePerSeat: '',
    notes: '',
    allowSmoking: false,
    allowPets: false,
  });

  useEffect(() => {
    const loadData = async () => {
      await loadVehicles();
      await loadTripData();
    };
    loadData();
  }, []);

  const loadTripData = async () => {
    try {
      setLoadingTrip(true);
      const response = await get_withauth(ENDPOINTS.GET_TRIP(tripId));
      if (response.success) {
        const trip = response.data;
        if (!['pending', 'active'].includes(trip.status)) {
          showAlert('No editable', 'Este viaje ya no se puede editar.');
          setLoadingTrip(false);
          navigation.goBack();
          return;
        }
        const tripDate = new Date(trip.departureDate);
        setDate(tripDate);
        const [hours, minutes] = trip.departureTime.split(':');
        const tripTime = new Date();
        tripTime.setHours(parseInt(hours), parseInt(minutes));
        setTime(tripTime);
        setOccupiedSeats(trip.occupiedSeats ?? trip.passengers?.length ?? 0);
        setFormData({
          vehicle: typeof trip.vehicle === 'object' && trip.vehicle !== null
            ? trip.vehicle._id || ''
            : trip.vehicle || '',
          origin:      { address: trip.origin.address || '', city: trip.origin.city || '', province: trip.origin.province || '' },
          destination: { address: trip.destination.address || '', city: trip.destination.city || '', province: trip.destination.province || '' },
          intermediateStops: [...(trip.intermediateStops || [])].sort((a, b) => (a.order || 0) - (b.order || 0)),
          departureDate: typeof trip.departureDate === 'string'
            ? trip.departureDate.split('T')[0]
            : new Date(trip.departureDate).toISOString().slice(0, 10),
          departureTime:  trip.departureTime,
          availableSeats: trip.availableSeats.toString(),
          pricePerSeat:   trip.pricePerSeat ? trip.pricePerSeat.toString() : '',
          notes:          trip.notes || '',
          allowSmoking:   trip.rules?.smokingAllowed || false,
          allowPets:      trip.rules?.petsAllowed || false,
        });
      } else {
        showAlert('Ocurrió algo', response.message || 'No se pudo cargar el viaje');
      }
    } catch {
      showAlert('Ocurrió algo', 'No se pudo cargar el viaje');
    } finally {
      setLoadingTrip(false);
    }
  };

  const loadVehicles = async () => {
    try {
      setLoadingVehicles(true);
      const response = await get_withauth(ENDPOINTS.MY_VEHICLES);
      if (response.success) {
        setVehicles(response.data);
      } else {
        showAlert('Ocurrió algo', 'No se pudieron cargar los vehículos');
      }
    } catch {
      showAlert('Ocurrió algo', 'Error al cargar vehículos');
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleChange = (field, value) => {
    if (field === 'vehicle') {
      const newVehicle = vehicles.find(v => v._id === value);
      const maxCap = newVehicle?.capacity ?? 8;
      const currentSeats = parseInt(formData.availableSeats) || 1;
      const clampedSeats = Math.min(currentSeats, maxCap);
      setFormData(prev => ({ ...prev, vehicle: value, availableSeats: clampedSeats.toString() }));
    } else if (field.includes('.')) {
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
    } else {
      if (selectedDate) setTempDate(selectedDate);
    }
  };

  const confirmDate = (selectedDate) => {
    setDate(selectedDate);
    setShowDatePicker(false);
    const year  = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day   = String(selectedDate.getDate()).padStart(2, '0');
    setFormData({ ...formData, departureDate: `${year}-${month}-${day}` });
  };

  const onTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (selectedTime && event.type === 'set') confirmTime(selectedTime);
    } else {
      if (selectedTime) setTempTime(selectedTime);
    }
  };

  const confirmTime = (selectedTime) => {
    setTime(selectedTime);
    setShowTimePicker(false);
    const hours   = selectedTime.getHours().toString().padStart(2, '0');
    const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
    setFormData({ ...formData, departureTime: `${hours}:${minutes}` });
  };

  const handleUpdateTrip = async () => {
    const { vehicle, departureDate, departureTime, availableSeats } = formData;
    if (!vehicle || !departureDate || !departureTime) {
      setModalMessage('Seleccioná fecha, hora y vehículo.');
      setShowErrorModal(true);
      return;
    }
    const seatsNum = parseInt(availableSeats);
    if (!seatsNum || seatsNum < 1) {
      setModalMessage('Indicá cuántos asientos tiene el viaje.');
      setShowErrorModal(true);
      return;
    }
    if (seatsNum < occupiedSeats) {
      setModalMessage(`No podés bajar los asientos a ${seatsNum}: ya hay ${occupiedSeats} pasajero${occupiedSeats !== 1 ? 's' : ''} confirmado${occupiedSeats !== 1 ? 's' : ''}.`);
      setShowErrorModal(true);
      return;
    }
    const maxSeats = selectedVehicle?.capacity ?? 8;
    if (seatsNum > maxSeats) {
      setModalMessage(`El vehículo elegido tiene capacidad máxima de ${maxSeats} pasajeros.`);
      setShowErrorModal(true);
      return;
    }
    setLoading(true);
    try {
      const response = await put_withauth(ENDPOINTS.UPDATE_TRIP(tripId), {
        vehicle:        formData.vehicle,
        departureDate:  formData.departureDate,
        departureTime:  formData.departureTime,
        availableSeats: parseInt(formData.availableSeats) || undefined,
      });
      if (response.success) {
        setModalMessage('Los cambios se guardaron correctamente.');
        setShowSuccessModal(true);
      }
    } catch (error) {
      setModalMessage(error.message || 'No pudimos actualizar el viaje.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loadingTrip || loadingVehicles) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={tp} />
        <Text style={[styles.loadingText, { color: tm }]}>
          {loadingTrip ? 'Cargando viaje...' : 'Cargando vehículos...'}
        </Text>
      </View>
    );
  }

  // ── Sin vehículos ────────────────────────────────────────────────────────
  if (vehicles.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <Ionicons name="car-outline" size={48} color={tm} />
        <Text style={[styles.emptyTitle, { color: tp }]}>Sin vehículos</Text>
        <Text style={[styles.emptySubtext, { color: tm }]}>
          Necesitás registrar un vehículo antes de editar el viaje
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Vehicles')}
          style={[styles.emptyBtn, { backgroundColor: tp }]}
          activeOpacity={0.85}
        >
          <Text style={{ color: isDarkMode ? '#000' : '#fff', fontWeight: '700', fontSize: 15 }}>
            Agregar vehículo
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const selectedVehicle = vehicles.find(v => v._id === formData.vehicle);

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Vehículo ── */}
          <Text style={[styles.sectionLabel, { color: tm }]}>Vehículo</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <TouchableOpacity
              onPress={() => setShowVehiclePicker(true)}
              style={styles.row}
              activeOpacity={0.7}
            >
              <Ionicons name="car-outline" size={19} color={tm} />
              <Text style={[styles.rowText, { color: selectedVehicle ? tp : tm }]}>
                {selectedVehicle
                  ? `${selectedVehicle.brand} ${selectedVehicle.model} · ${selectedVehicle.licensePlate}`
                  : 'Seleccioná un vehículo'}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={tm} />
            </TouchableOpacity>
          </View>

          {/* ── Ruta (solo lectura) ── */}
          <Text style={[styles.sectionLabel, { color: tm }]}>Ruta</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>

            {/* Origen */}
            <View style={styles.routeRow}>
              <View style={styles.routeLeft}>
                <View style={[styles.routeDot, { backgroundColor: tp }]} />
                <View style={[styles.routeLine, { backgroundColor: border }]} />
              </View>
              <View style={styles.routeInfo}>
                <Text style={[styles.routeTag, { color: tm }]}>Origen</Text>
                <Text style={[styles.routeAddress, { color: tp }]}>{formData.origin.address || '—'}</Text>
                {(formData.origin.city || formData.origin.province) ? (
                  <Text style={[styles.routeCity, { color: tm }]}>
                    {[formData.origin.city, formData.origin.province].filter(Boolean).join(', ')}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Paradas intermedias */}
            {formData.intermediateStops.map((stop, idx) => (
              <View key={idx} style={styles.routeRow}>
                <View style={styles.routeLeft}>
                  <View style={[styles.routeDotSm, { backgroundColor: tm }]} />
                  <View style={[styles.routeLine, { backgroundColor: border }]} />
                </View>
                <View style={styles.routeInfo}>
                  <Text style={[styles.routeTag, { color: tm }]}>Parada {idx + 1}</Text>
                  <Text style={[styles.routeAddress, { color: tp }]}>{stop.address || '—'}</Text>
                  {(stop.city || stop.province) ? (
                    <Text style={[styles.routeCity, { color: tm }]}>
                      {[stop.city, stop.province].filter(Boolean).join(', ')}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}

            {/* Destino */}
            <View style={[styles.routeRow, { marginBottom: 4 }]}>
              <View style={[styles.routeLeft, { justifyContent: 'flex-start' }]}>
                <View style={[styles.routeDot, { backgroundColor: tp }]} />
              </View>
              <View style={styles.routeInfo}>
                <Text style={[styles.routeTag, { color: tm }]}>Destino</Text>
                <Text style={[styles.routeAddress, { color: tp }]}>{formData.destination.address || '—'}</Text>
                {(formData.destination.city || formData.destination.province) ? (
                  <Text style={[styles.routeCity, { color: tm }]}>
                    {[formData.destination.city, formData.destination.province].filter(Boolean).join(', ')}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* ── Fecha y hora ── */}
          <Text style={[styles.sectionLabel, { color: tm }]}>Fecha y hora</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <TouchableOpacity
              style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border }]}
              onPress={() => { setTempDate(date); setShowDatePicker(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={19} color={tm} />
              <Text style={[styles.rowText, { color: formData.departureDate ? tp : tm }]}>
                {formData.departureDate || 'Fecha de salida'}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={tm} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.row}
              onPress={() => { setTempTime(time); setShowTimePicker(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={19} color={tm} />
              <Text style={[styles.rowText, { color: formData.departureTime ? tp : tm }]}>
                {formData.departureTime || 'Hora de salida'}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={tm} />
            </TouchableOpacity>
          </View>

          {/* ── Asientos ── */}
          {selectedVehicle && (() => {
            const maxCap = selectedVehicle.capacity;
            const current = parseInt(formData.availableSeats) || 1;
            const minSeats = Math.max(1, occupiedSeats);
            return (
              <>
                <Text style={[styles.sectionLabel, { color: tm }]}>Asientos del viaje</Text>
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                  <View style={[styles.row, { justifyContent: 'space-between' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowText, { color: tp }]}>Asientos disponibles</Text>
                      <Text style={[{ fontSize: 12, color: tm, marginTop: 2 }]}>
                        Máx. {maxCap} · vehículo{occupiedSeats > 0 ? ` · ${occupiedSeats} ya reservado${occupiedSeats !== 1 ? 's' : ''}` : ''}
                      </Text>
                    </View>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        onPress={() => {
                          if (current > minSeats) handleChange('availableSeats', (current - 1).toString());
                        }}
                        style={[styles.stepperBtn, { borderColor: border, opacity: current <= minSeats ? 0.3 : 1 }]}
                        disabled={current <= minSeats}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="remove" size={16} color={tp} />
                      </TouchableOpacity>
                      <Text style={[styles.stepperVal, { color: tp }]}>{current}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          if (current < maxCap) handleChange('availableSeats', (current + 1).toString());
                        }}
                        style={[styles.stepperBtn, { borderColor: border, opacity: current >= maxCap ? 0.3 : 1 }]}
                        disabled={current >= maxCap}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="add" size={16} color={tp} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </>
            );
          })()}

          {/* Botón guardar */}
          <TouchableOpacity
            onPress={handleUpdateTrip}
            disabled={loading}
            style={[styles.saveBtn, { backgroundColor: tp, opacity: loading ? 0.6 : 1 }]}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={isDarkMode ? '#000' : '#fff'} />
              : <Text style={[styles.saveBtnText, { color: isDarkMode ? '#000' : '#fff' }]}>Guardar cambios</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Modal: Vehículo (bottom sheet) ── */}
      <Modal
        visible={showVehiclePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVehiclePicker(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: cardBg }]}>
            <View style={[styles.sheetHandle, { backgroundColor: border }]} />
            <View style={[styles.sheetHeader, { borderBottomColor: border }]}>
              <Text style={[styles.sheetTitle, { color: tp }]}>Vehículo</Text>
              <TouchableOpacity onPress={() => setShowVehiclePicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={tp} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ padding: 16 }}>
              {vehicles.map((v) => (
                <TouchableOpacity
                  key={v._id}
                  onPress={() => { handleChange('vehicle', v._id); setShowVehiclePicker(false); }}
                  style={[
                    styles.vehicleRow,
                    { borderColor: formData.vehicle === v._id ? tp : border },
                    formData.vehicle === v._id && { backgroundColor: isDarkMode ? '#2A2A2A' : '#F5F5F5' },
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.vehicleName, { color: tp }]}>{v.brand} {v.model}</Text>
                    <Text style={[styles.vehiclePlate, { color: tm }]}>{v.licensePlate} · {v.capacity} asientos</Text>
                  </View>
                  {formData.vehicle === v._id && (
                    <Ionicons name="checkmark" size={20} color={tp} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Fecha ── */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.centeredOverlay}>
          <View style={[styles.pickerCard, { backgroundColor: cardBg }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: border }]}>
              <Text style={[styles.sheetTitle, { color: tp }]}>Fecha de salida</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={tp} />
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
              minimumDate={new Date()}
              style={{ marginVertical: 8 }}
            />
            {Platform.OS === 'ios' && (
              <View style={[styles.pickerBtns, { borderTopColor: border }]}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.pickerBtn}>
                  <Text style={{ color: tm, fontWeight: '600', fontSize: 15 }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDate(tempDate)} style={styles.pickerBtn}>
                  <Text style={{ color: tp, fontWeight: '700', fontSize: 15 }}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Modal: Hora ── */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.centeredOverlay}>
          <View style={[styles.pickerCard, { backgroundColor: cardBg }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: border }]}>
              <Text style={[styles.sheetTitle, { color: tp }]}>Hora de salida</Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={tp} />
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onTimeChange}
              style={{ marginVertical: 8 }}
            />
            {Platform.OS === 'ios' && (
              <View style={[styles.pickerBtns, { borderTopColor: border }]}>
                <TouchableOpacity onPress={() => setShowTimePicker(false)} style={styles.pickerBtn}>
                  <Text style={{ color: tm, fontWeight: '600', fontSize: 15 }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmTime(tempTime)} style={styles.pickerBtn}>
                  <Text style={{ color: tp, fontWeight: '700', fontSize: 15 }}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <ConfirmationModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        onConfirm={() => { setShowSuccessModal(false); navigation.goBack(); }}
        type="success"
        title="Viaje Actualizado"
        message={modalMessage}
        confirmText="Continuar"
        showCancel={false}
      />
      <ConfirmationModal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        onConfirm={() => setShowErrorModal(false)}
        type="error"
        title="Ocurrió algo"
        message={modalMessage}
        confirmText="Entendido"
        showCancel={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48 },

  // Estados vacíos/carga
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 14 },
  emptyTitle:  { fontSize: 18, fontFamily: 'Sora_700Bold', marginTop: 16, marginBottom: 8 },
  emptySubtext:{ fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn:    { marginTop: 24, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 },

  // Secciones
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Sora_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowText: { flex: 1, fontSize: 15 },

  // Timeline ruta
  routeRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 0,
  },
  routeLeft: {
    width: 20,
    alignItems: 'center',
    marginRight: 14,
  },
  routeDot:   { width: 10, height: 10, borderRadius: 5 },
  routeDotSm: { width: 7,  height: 7,  borderRadius: 3.5 },
  routeLine:  { width: 1, flex: 1, marginTop: 4, minHeight: 20 },
  routeInfo:  { flex: 1, paddingBottom: 14 },
  routeTag:   { fontSize: 10, fontFamily: 'Sora_700Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  routeAddress: { fontSize: 14, fontFamily: 'Sora_500Medium' },
  routeCity:    { fontSize: 12, marginTop: 2 },

  // Stepper
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn: {
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  stepperVal: { fontSize: 18, fontFamily: 'Sora_700Bold', minWidth: 24, textAlign: 'center' },

  // Botón
  saveBtn: {
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontFamily: 'Sora_700Bold' },

  // Bottom sheet (vehículo)
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 16, fontFamily: 'Sora_700Bold' },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  vehicleName:  { fontSize: 15, fontFamily: 'Sora_600SemiBold', marginBottom: 2 },
  vehiclePlate: { fontSize: 13 },

  // Modal centrado (fecha/hora)
  centeredOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  pickerBtns: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pickerBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
});

export default EditTripScreen;
