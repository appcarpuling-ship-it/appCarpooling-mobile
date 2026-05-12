import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { post_withauth, get_withauth, put_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import {  gradients, spacing, borderRadius, fontSize } from '../../../theme/colors';
import useColors from '../../../hooks/useColors';
import { useAlert } from '../../../context/AlertContext';
import ConfirmationModal from '../../../components/modals/ConfirmationModal';

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

const EditTripScreen = ({ navigation, route }) => {
  const { showAlert } = useAlert();
  const { colors, gradients, createColorArray } = useColors();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  
  // Dynamic styles that depend on colors hook
  const dynamicStyles = StyleSheet.create({
    section: {
      marginBottom: spacing.lg,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
    },
    sectionTitle: {
      fontSize: fontSize.lg,
      fontWeight: '600',
      color: colors.textPrimary,
      marginLeft: spacing.sm,
    },
    label: {
      fontSize: fontSize.md,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    input: {
      flex: 1,
      fontSize: fontSize.md,
      color: colors.textPrimary,
      marginLeft: spacing.sm,
      paddingVertical: spacing.sm,
    },
    dateTimeText: {
      fontSize: fontSize.md,
      color: colors.textPrimary,
      paddingVertical: spacing.sm,
    },
    placeholderText: {
      color: colors.textTertiary,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      marginBottom: spacing.xs,
    },
    switchLabel: {
      fontSize: fontSize.md,
      color: colors.textPrimary,
      marginLeft: spacing.sm,
    },
    updateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      marginTop: spacing.md,
      shadowColor: colors.primary,
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
    updateButtonText: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '600',
      marginLeft: spacing.sm,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      marginTop: spacing.md,
      backgroundColor: colors.error,
      shadowColor: colors.error,
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
    deleteButtonText: {
      color: '#FFF',
      fontSize: fontSize.lg,
      fontWeight: '600',
      marginLeft: spacing.sm,
    },
    emptyText: {
      fontSize: fontSize.xl,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: spacing.lg,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: fontSize.sm,
      color: colors.textTertiary,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    addVehicleButtonText: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
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
      fontWeight: '600',
      color: colors.textPrimary,
    },
    modalPicker: {
      backgroundColor: 'transparent',
      color: colors.textPrimary,
      marginVertical: spacing.md,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    modalButton: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      backgroundColor: colors.surface,
      marginHorizontal: spacing.xs,
    },
    modalButtonPrimary: {
      backgroundColor: colors.primary,
    },
    modalButtonText: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    modalButtonCancel: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.textSecondary,
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
      backgroundColor: colors.primary + '20',
      borderColor: colors.primary,
    },
    vehicleName: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    vehicleNameSelected: {
      color: colors.primary,
    },
    vehiclePlate: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
    },
  });
  const { tripId } = route.params;
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());
  const [formData, setFormData] = useState({
    vehicle: '',
    origin: {
      address: '',
      city: '',
      province: '',
    },
    destination: {
      address: '',
      city: '',
      province: '',
    },
    intermediateStops: [],
    departureDate: '',
    departureTime: '',
    availableSeats: '',
    pricePerSeat: '',
    notes: '',
    allowSmoking: false,
    allowPets: false,
  });

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const loadData = async () => {
      // Cargar vehículos primero
      await loadVehicles();
      // Luego cargar datos del viaje
      await loadTripData();
    };

    loadData();

    // Start animations
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

  const loadTripData = async () => {
    try {
      console.log('🔄 [EditTrip] Cargando datos del viaje:', tripId);
      setLoadingTrip(true);
      const response = await get_withauth(ENDPOINTS.GET_TRIP(tripId));
      console.log('📋 [EditTrip] Respuesta del viaje:', response);

      if (response.success) {
        const trip = response.data;
        console.log('✅ [EditTrip] Datos del viaje:', trip);

        if (!['pending', 'active'].includes(trip.status)) {
          showAlert('No editable', 'Este viaje ya no se puede editar.');
          setLoadingTrip(false);
          navigation.goBack();
          return;
        }

        // Parsear fecha
        const tripDate = new Date(trip.departureDate);
        setDate(tripDate);
        console.log('📅 [EditTrip] Fecha parseada:', tripDate);

        // Parsear hora
        const [hours, minutes] = trip.departureTime.split(':');
        const tripTime = new Date();
        tripTime.setHours(parseInt(hours), parseInt(minutes));
        setTime(tripTime);
        console.log('🕒 [EditTrip] Hora parseada:', tripTime);

        const newFormData = {
          vehicle:
            typeof trip.vehicle === 'object' && trip.vehicle !== null
              ? trip.vehicle._id || ''
              : trip.vehicle || '',
          origin: {
            address: trip.origin.address || '',
            city: trip.origin.city || '',
            province: trip.origin.province || '',
          },
          destination: {
            address: trip.destination.address || '',
            city: trip.destination.city || '',
            province: trip.destination.province || '',
          },
          intermediateStops: [...(trip.intermediateStops || [])].sort(
            (a, b) => (a.order || 0) - (b.order || 0)
          ),
          departureDate:
            typeof trip.departureDate === 'string'
              ? trip.departureDate.split('T')[0]
              : new Date(trip.departureDate).toISOString().slice(0, 10),
          departureTime: trip.departureTime,
          availableSeats: trip.availableSeats.toString(),
          pricePerSeat: trip.pricePerSeat ? trip.pricePerSeat.toString() : '',
          notes: trip.notes || '',
          allowSmoking: trip.rules?.smokingAllowed || false,
          allowPets: trip.rules?.petsAllowed || false,
        };

        console.log('📝 [EditTrip] FormData a setear:', newFormData);
        setFormData(newFormData);
      } else {
        console.warn('⚠️ [EditTrip] Error en respuesta:', response.message);
        showAlert('Error', response.message || 'No se pudo cargar el viaje');
      }
    } catch (error) {
      console.error('❌ [EditTrip] Error cargando viaje:', error);
      showAlert('Error', 'No se pudo cargar el viaje');
    } finally {
      setLoadingTrip(false);
    }
  };

  const loadVehicles = async () => {
    try {
      console.log('🚗 [EditTrip] Cargando vehículos...');
      setLoadingVehicles(true);

      const response = await get_withauth(ENDPOINTS.MY_VEHICLES);
      console.log('🚗 [EditTrip] Respuesta vehículos:', response);

      if (response.success) {
        setVehicles(response.data);
        console.log('✅ [EditTrip] Vehículos cargados:', response.data);

        // NO establecer vehículo por defecto aquí, se hará en loadTripData
      } else {
        console.warn('⚠️ [EditTrip] Error cargando vehículos:', response.message);
        showAlert('Error', 'No se pudieron cargar los vehículos: ' + (response.message || 'Error desconocido'));
      }
    } catch (error) {
      console.error('❌ [EditTrip] Error loading vehicles:', error);
      showAlert('Error', 'Error al cargar vehículos: ' + error.message);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData({
        ...formData,
        [parent]: { ...formData[parent], [child]: value },
      });
    } else {
      setFormData({ ...formData, [field]: value });
    }
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (selectedDate && event.type === 'set') {
        confirmDate(selectedDate);
      }
    } else {
      // En iOS, solo actualizar la fecha temporal
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const confirmDate = (selectedDate) => {
    setDate(selectedDate);
    setShowDatePicker(false);

    // Usar la fecha directamente sin conversiones de timezone problemáticas
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const formatted = `${year}-${month}-${day}`;

    console.log('📅 [EditTrip] Fecha seleccionada:', {
      original: selectedDate,
      year: year,
      month: month,
      day: day,
      formatted: formatted
    });

    setFormData({ ...formData, departureDate: formatted });
  };

  const onTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (selectedTime && event.type === 'set') {
        confirmTime(selectedTime);
      }
    } else {
      // En iOS, solo actualizar la hora temporal
      if (selectedTime) {
        setTempTime(selectedTime);
      }
    }
  };

  const confirmTime = (selectedTime) => {
    setTime(selectedTime);
    setShowTimePicker(false);

    const hours = selectedTime.getHours().toString().padStart(2, '0');
    const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    console.log('🕒 [EditTrip] Hora seleccionada:', {
      original: selectedTime,
      formatted: timeString
    });

    setFormData({ ...formData, departureTime: timeString });
  };

  const handleUpdateTrip = async () => {
    const { vehicle, departureDate, departureTime } = formData;

    if (!vehicle || !departureDate || !departureTime) {
      setModalMessage('Seleccioná fecha, hora y vehículo.');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    try {
      /** Solo estos campos acepta el backend para conductores */
      const tripData = {
        vehicle: formData.vehicle,
        departureDate: formData.departureDate,
        departureTime: formData.departureTime,
      };

      const response = await put_withauth(ENDPOINTS.UPDATE_TRIP(tripId), tripData);

      if (response.success) {
        setModalMessage('Viaje actualizado exitosamente');
        setShowSuccessModal(true);
      }
    } catch (error) {
      setModalMessage(error.message || 'Error al actualizar el viaje');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Mostrar loading mientras cargan los datos
  if (loadingTrip || loadingVehicles) {
    return (
      <LinearGradient colors={createColorArray(colors.background, colors.surface)} style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.emptyText}>
          {loadingTrip ? 'Cargando viaje...' : 'Cargando vehículos...'}
        </Text>
      </LinearGradient>
    );
  }

  // Mostrar mensaje si no hay vehículos después de cargar
  if (!loadingVehicles && vehicles.length === 0) {
    return (
      <LinearGradient colors={createColorArray(colors.background, colors.surface)} style={styles.emptyContainer}>
        <Ionicons name="car-outline" size={64} color={colors.textTertiary} />
        <Text style={styles.emptyText}>No tienes vehículos registrados</Text>
        <Text style={styles.emptySubtext}>
          Necesitas registrar un vehículo antes de editar un viaje
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Vehicles')}>
          <LinearGradient colors={gradients.primary} style={styles.addVehicleButton}>
            <Text style={dynamicStyles.addVehicleButtonText}>Agregar Vehículo</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={createColorArray(colors.background, colors.surface)} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
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
            {/* Vehicle Selection Section */}
            <LinearGradient
              colors={createColorArray(colors.surfaceElevated, colors.surface)}
              style={dynamicStyles.section}
            >
              <Text style={dynamicStyles.label}>Vehículo *</Text>
              <Text style={dynamicStyles.emptySubtext}>
                Solo podés cambiar la fecha, la hora y el vehículo. La ruta y el resto del viaje no se pueden editar.
              </Text>
              <TouchableOpacity
                onPress={() => setShowVehiclePicker(true)}
                activeOpacity={0.7}
              >
                <View style={dynamicStyles.inputWrapper}>
                  <Ionicons name="car-outline" size={20} color={colors.primary} />
                  <View style={styles.dateTimeTextContainer}>
                    <Text style={[dynamicStyles.dateTimeText, !formData.vehicle && dynamicStyles.placeholderText]}>
                      {formData.vehicle
                        ? vehicles.find(v => v._id === formData.vehicle)
                          ? `${vehicles.find(v => v._id === formData.vehicle).brand} ${vehicles.find(v => v._id === formData.vehicle).model} - ${vehicles.find(v => v._id === formData.vehicle).licensePlate}`
                          : 'Selecciona un vehículo'
                        : 'Selecciona un vehículo'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <Modal
                visible={showVehiclePicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowVehiclePicker(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={dynamicStyles.modalContainer}>
                    <View style={dynamicStyles.modalHeader}>
                      <Text style={dynamicStyles.modalTitle}>Seleccionar Vehículo</Text>
                      <TouchableOpacity
                        onPress={() => setShowVehiclePicker(false)}
                        style={styles.closeButton}
                      >
                        <Ionicons name="close" size={24} color={colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.vehicleList}>
                      {vehicles.map((vehicle) => (
                        <TouchableOpacity
                          key={vehicle._id}
                          onPress={() => {
                            handleChange('vehicle', vehicle._id);
                            setShowVehiclePicker(false);
                          }}
                          style={[
                            dynamicStyles.vehicleItem,
                            formData.vehicle === vehicle._id && dynamicStyles.vehicleItemSelected
                          ]}
                        >
                          <View style={styles.vehicleItemContent}>
                            <Ionicons
                              name="car"
                              size={24}
                              color={formData.vehicle === vehicle._id ? colors.primary : colors.textSecondary}
                            />
                            <View style={styles.vehicleItemText}>
                              <Text style={[
                                dynamicStyles.vehicleName,
                                formData.vehicle === vehicle._id && dynamicStyles.vehicleNameSelected
                              ]}>
                                {vehicle.brand} {vehicle.model}
                              </Text>
                              <Text style={dynamicStyles.vehiclePlate}>{vehicle.licensePlate}</Text>
                            </View>
                          </View>
                          {formData.vehicle === vehicle._id && (
                            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </Modal>
            </LinearGradient>

            {/* Ruta — solo lectura */}
            <LinearGradient
              colors={createColorArray(colors.surfaceElevated, colors.surface)}
              style={dynamicStyles.section}
            >
              <View style={styles.sectionHeader}>
                <Ionicons name="map-outline" size={24} color={colors.primary} />
                <Text style={dynamicStyles.sectionTitle}>Ruta</Text>
              </View>
              <Text style={dynamicStyles.label}>Origen</Text>
              <Text style={[dynamicStyles.dateTimeText, { marginBottom: spacing.sm }]}>
                {formData.origin.address || '—'}
                {(formData.origin.city || formData.origin.province)
                  ? `\n${[formData.origin.city, formData.origin.province].filter(Boolean).join(', ')}`
                  : ''}
              </Text>
              {!!formData.intermediateStops?.length && (
                <>
                  <Text style={dynamicStyles.label}>Paradas intermedias</Text>
                  {formData.intermediateStops.map((stop, idx) => (
                    <Text
                      key={stop.order != null ? `stop-${stop.order}` : `stop-${idx}`}
                      style={[dynamicStyles.dateTimeText, { marginBottom: spacing.xs }]}
                    >
                      {stop.address || '—'}
                      {(stop.city || stop.province) ? ` (${[stop.city, stop.province].filter(Boolean).join(', ')})` : ''}
                    </Text>
                  ))}
                </>
              )}
              <Text style={dynamicStyles.label}>Destino</Text>
              <Text style={dynamicStyles.dateTimeText}>
                {formData.destination.address || '—'}
                {(formData.destination.city || formData.destination.province)
                  ? `\n${[formData.destination.city, formData.destination.province].filter(Boolean).join(', ')}`
                  : ''}
              </Text>
            </LinearGradient>

            {/* Fecha y hora */}
            <LinearGradient
              colors={createColorArray(colors.surfaceElevated, colors.surface)}
              style={dynamicStyles.section}
            >
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar-outline" size={24} color={colors.info} />
                <Text style={dynamicStyles.sectionTitle}>Fecha y hora</Text>
              </View>

              <TouchableOpacity onPress={() => {
                setTempDate(date);
                setShowDatePicker(true);
              }} activeOpacity={0.7}>
                <View style={dynamicStyles.inputWrapper}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                  <View style={styles.dateTimeTextContainer}>
                    <Text style={[dynamicStyles.dateTimeText, !formData.departureDate && dynamicStyles.placeholderText]}>
                      {formData.departureDate || 'Fecha de salida *'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <Modal
                visible={showDatePicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={dynamicStyles.modalContainer}>
                    <View style={dynamicStyles.modalHeader}>
                      <Text style={dynamicStyles.modalTitle}>Seleccionar Fecha</Text>
                      <TouchableOpacity
                        onPress={() => setShowDatePicker(false)}
                        style={styles.closeButton}
                      >
                        <Ionicons name="close" size={24} color={colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={tempDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onDateChange}
                      minimumDate={new Date()}
                      style={styles.modalPicker}
                    />
                    {Platform.OS === 'ios' && (
                      <View style={styles.modalButtons}>
                        <TouchableOpacity
                          onPress={() => setShowDatePicker(false)}
                          style={styles.modalButton}
                        >
                          <Text style={styles.modalButtonCancel}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => confirmDate(tempDate)}
                          style={[styles.modalButton, styles.modalButtonPrimary]}
                        >
                          <Text style={styles.modalButtonText}>Confirmar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </Modal>

              <TouchableOpacity onPress={() => {
                setTempTime(time);
                setShowTimePicker(true);
              }} activeOpacity={0.7}>
                <View style={dynamicStyles.inputWrapper}>
                  <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                  <View style={styles.dateTimeTextContainer}>
                    <Text style={[dynamicStyles.dateTimeText, !formData.departureTime && dynamicStyles.placeholderText]}>
                      {formData.departureTime || 'Hora de salida *'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <Modal
                visible={showTimePicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowTimePicker(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={dynamicStyles.modalContainer}>
                    <View style={dynamicStyles.modalHeader}>
                      <Text style={dynamicStyles.modalTitle}>Seleccionar Hora</Text>
                      <TouchableOpacity
                        onPress={() => setShowTimePicker(false)}
                        style={styles.closeButton}
                      >
                        <Ionicons name="close" size={24} color={colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={tempTime}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onTimeChange}
                      style={styles.modalPicker}
                    />
                    {Platform.OS === 'ios' && (
                      <View style={styles.modalButtons}>
                        <TouchableOpacity
                          onPress={() => setShowTimePicker(false)}
                          style={styles.modalButton}
                        >
                          <Text style={styles.modalButtonCancel}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => confirmTime(tempTime)}
                          style={[styles.modalButton, styles.modalButtonPrimary]}
                        >
                          <Text style={styles.modalButtonText}>Confirmar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </Modal>
            </LinearGradient>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleUpdateTrip}
              disabled={loading || loadingTrip}
              activeOpacity={0.8}
            >
              <LinearGradient colors={gradients.primary} style={styles.createButton}>
                {loading || loadingTrip ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={24} color={colors.textPrimary} />
                    <Text style={styles.createButtonText}>Actualizar Viaje</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

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
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  content: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: '600',
    color: '#000000',
    marginLeft: spacing.sm,
  },
  label: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.medium,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.regular,
    color: '#000000',
    marginLeft: spacing.sm,
    paddingVertical: spacing.sm,
  },
  pickerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    paddingLeft: spacing.md,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  picker: {
    flex: 1,
    color: '#000000',
  },
  pickerText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.regular,
    color: '#000000',
  },
  dateTimeTextContainer: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  dateTimeText: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.regular,
    color: '#000000',
    paddingVertical: spacing.sm,
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  textArea: {
    minHeight: 80,
    paddingTop: spacing.sm,
  },
  textAreaWrapper: {
    alignItems: 'flex-start',
  },
  textAreaIconContainer: {
    marginTop: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: spacing.xs,
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  switchLabel: {
    fontSize: fontSize.md,
    color: '#000000',
    marginLeft: spacing.sm,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
    shadowColor: '#6366F1',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  createButtonText: {
    color: '#000000',
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: '#9CA3AF',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  addVehicleButton: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  addVehicleButtonText: {
    color: '#000000',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  // Date/Time Picker Styles
  pickerContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: borderRadius.md,
    marginVertical: spacing.sm,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  picker: {
    backgroundColor: 'transparent',
    color: '#000000',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#F8F9FA',
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
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: '#000000',
  },
  closeButton: {
    padding: spacing.xs,
  },
  modalPicker: {
    backgroundColor: 'transparent',
    color: '#000000',
    marginVertical: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.xs,
  },
  modalButtonPrimary: {
    backgroundColor: '#6366F1',
  },
  modalButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#000000',
  },
  modalButtonCancel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#6B7280',
  },
  // Vehicle Picker Modal Styles
  vehicleList: {
    maxHeight: 400,
    padding: spacing.md,
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  vehicleItemSelected: {
    backgroundColor: '#6366F1' + '20',
    borderColor: '#6366F1',
  },
  vehicleItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vehicleItemText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  vehicleName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#000000',
    marginBottom: spacing.xs,
  },
  vehicleNameSelected: {
    color: '#6366F1',
  },
  vehiclePlate: {
    fontSize: fontSize.sm,
    color: '#6B7280',
  },
});

export default EditTripScreen;
