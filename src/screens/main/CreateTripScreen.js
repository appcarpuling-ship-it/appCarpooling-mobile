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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { post_withauth, get_withauth } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import {  gradients, spacing, borderRadius, fontSize } from '../../theme/colors';
import useColors from '../../hooks/useColors';
import { useAlert } from '../../context/AlertContext';
import { ARGENTINA_PROVINCES } from '../../constants/provinces';
import ConfirmationModal from '../../components/ConfirmationModal';

const CreateTripScreen = ({ navigation }) => {
  const { showAlert } = useAlert();
  const { colors, gradients, fontFamily, createColorArray } = useColors();
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
      fontFamily: fontFamily.semiBold,
      fontWeight: '600',
      color: colors.textPrimary,
      marginLeft: spacing.sm,
    },
    label: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.medium,
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
      fontFamily: fontFamily.regular,
      color: colors.textPrimary,
      marginLeft: spacing.sm,
      paddingVertical: spacing.sm,
    },
    dateTimeText: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.regular,
      color: colors.textSecondary,
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
      fontFamily: fontFamily.regular,
      color: colors.textPrimary,
      marginLeft: spacing.sm,
    },
    createButton: {
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
    createButtonText: {
      color: '#ffffff',
      fontSize: fontSize.lg,
      fontFamily: fontFamily.semiBold,
      fontWeight: '600',
      marginLeft: spacing.sm,
    },
    emptyText: {
      fontSize: fontSize.xl,
      fontFamily: fontFamily.bold,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: spacing.lg,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.regular,
      color: colors.textTertiary,
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
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontFamily: fontFamily.semiBold,
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
      fontFamily: fontFamily.semiBold,
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
      fontFamily: fontFamily.semiBold,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    modalButtonCancel: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.semiBold,
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
      fontFamily: fontFamily.semiBold,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    vehicleNameSelected: {
      color: colors.primary,
    },
    vehiclePlate: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.regular,
      color: colors.textSecondary,
    },
    datePickerWrapper: {
      backgroundColor: '#FFFFFF',
      paddingVertical: spacing.md,
    },
  });
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [showOriginProvincePicker, setShowOriginProvincePicker] = useState(false);
  const [showDestinationProvincePicker, setShowDestinationProvincePicker] = useState(false);
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
    loadVehicles();

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

  const loadVehicles = async () => {
    try {
      console.log('🚗 [CreateTrip] Cargando vehículos...');
      setLoadingVehicles(true);

      const response = await get_withauth(ENDPOINTS.MY_VEHICLES);
      console.log('🚗 [CreateTrip] Respuesta vehículos:', response);

      if (response.success) {
        setVehicles(response.data);
        console.log('✅ [CreateTrip] Vehículos cargados:', response.data);

        // No auto-seleccionar vehículo, dejar que el usuario elija
        // if (response.data.length > 0) {
        //   const firstVehicleId = response.data[0]._id;
        //   console.log('🚗 [CreateTrip] Seleccionando primer vehículo:', firstVehicleId);
        //
        //   setFormData(prevFormData => ({
        //     ...prevFormData,
        //     vehicle: firstVehicleId
        //   }));
        // }
      } else {
        console.warn('⚠️ [CreateTrip] Error cargando vehículos:', response.message);
        showAlert('Error', 'No se pudieron cargar los vehículos: ' + (response.message || 'Error desconocido'));
      }
    } catch (error) {
      console.error('❌ [CreateTrip] Error loading vehicles:', error);
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

    // Usar la fecha directamente sin conversiones de timezone problemáticas
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const formatted = `${year}-${month}-${day}`;

    console.log('📅 Fecha seleccionada:', {
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

    console.log('🕒 Hora seleccionada:', {
      original: selectedTime,
      formatted: timeString
    });

    setFormData({ ...formData, departureTime: timeString });
  };

  const handleCreateTrip = async () => {
    const {
      vehicle,
      origin,
      destination,
      departureDate,
      departureTime,
      availableSeats,
      pricePerSeat,
    } = formData;

    if (
      !vehicle ||
      !origin.address ||
      !origin.city ||
      !origin.province ||
      !destination.address ||
      !destination.city ||
      !destination.province ||
      !departureDate ||
      !departureTime ||
      !availableSeats
    ) {
      setModalMessage('Por favor completa todos los campos obligatorios');
      setShowErrorModal(true);
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
        rules: {
          smokingAllowed: formData.allowSmoking,
          petsAllowed: formData.allowPets,
        }
      };

      // Solo agregar pricePerSeat si tiene un valor
      if (pricePerSeat && pricePerSeat.trim() !== '') {
        tripData.pricePerSeat = parseFloat(pricePerSeat);
      } else {
        tripData.pricePerSeat = 0;
      }

      const response = await post_withauth(ENDPOINTS.CREATE_TRIP, tripData);

      if (response.success) {
        setModalMessage('Viaje creado exitosamente');
        setShowSuccessModal(true);
      }
    } catch (error) {
      setModalMessage(error.message || 'Error al crear el viaje');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Mostrar loading mientras cargan los vehículos
  if (loadingVehicles) {
    return (
      <LinearGradient colors={createColorArray(colors.background, colors.surface)} style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={dynamicStyles.emptyText}>Cargando vehículos...</Text>
      </LinearGradient>
    );
  }

  // Mostrar mensaje si no hay vehículos después de cargar
  if (!loadingVehicles && vehicles.length === 0) {
    return (
      <LinearGradient colors={createColorArray(colors.background, colors.surface)} style={styles.emptyContainer}>
        <Ionicons name="car-outline" size={64} color={colors.textTertiary} />
        <Text style={dynamicStyles.emptyText}>No tienes vehículos registrados</Text>
        <Text style={dynamicStyles.emptySubtext}>
          Necesitas registrar un vehículo antes de crear un viaje
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Vehicles')}>
          <LinearGradient colors={gradients.primary} style={dynamicStyles.addVehicleButton}>
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

            {/* Route Section - Origin */}
            <LinearGradient
              colors={createColorArray(colors.surfaceElevated, colors.surface)}
              style={dynamicStyles.section}
            >
              <View style={styles.sectionHeader}>
                <Ionicons name="location-outline" size={24} color={colors.primary} />
                <Text style={dynamicStyles.sectionTitle}>Origen</Text>
              </View>

              <TouchableOpacity onPress={() => setShowOriginProvincePicker(true)} activeOpacity={0.7}>
                <View style={dynamicStyles.inputWrapper}>
                  <Ionicons name="map-outline" size={18} color={colors.textSecondary} />
                  <View style={styles.dateTimeTextContainer}>
                    <Text style={[dynamicStyles.dateTimeText, !formData.origin.province && dynamicStyles.placeholderText]}>
                      {formData.origin.province || 'Provincia *'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <View style={dynamicStyles.inputWrapper}>
                <Ionicons name="business-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Ciudad *"
                  placeholderTextColor={colors.placeholder}
                  value={formData.origin.city}
                  onChangeText={(value) => handleChange('origin.city', value)}
                />
              </View>

              <View style={dynamicStyles.inputWrapper}>
                <Ionicons name="navigate-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Dirección *"
                  placeholderTextColor={colors.placeholder}
                  value={formData.origin.address}
                  onChangeText={(value) => handleChange('origin.address', value)}
                />
              </View>

              <Modal
                visible={showOriginProvincePicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowOriginProvincePicker(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={dynamicStyles.modalContainer}>
                    <View style={dynamicStyles.modalHeader}>
                      <Text style={dynamicStyles.modalTitle}>Seleccionar Provincia (Origen)</Text>
                      <TouchableOpacity
                        onPress={() => setShowOriginProvincePicker(false)}
                        style={styles.closeButton}
                      >
                        <Ionicons name="close" size={24} color={colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.provinceList}>
                      {ARGENTINA_PROVINCES.map((province) => (
                        <TouchableOpacity
                          key={province}
                          onPress={() => {
                            handleChange('origin.province', province);
                            setShowOriginProvincePicker(false);
                          }}
                          style={[
                            dynamicStyles.vehicleItem,
                            formData.origin.province === province && dynamicStyles.vehicleItemSelected
                          ]}
                        >
                          <Text style={[
                            dynamicStyles.vehicleName,
                            formData.origin.province === province && dynamicStyles.vehicleNameSelected
                          ]}>
                            {province}
                          </Text>
                          {formData.origin.province === province && (
                            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </Modal>
            </LinearGradient>

            {/* Route Section - Destination */}
            <LinearGradient
              colors={createColorArray(colors.surfaceElevated, colors.surface)}
              style={dynamicStyles.section}
            >
              <View style={styles.sectionHeader}>
                <Ionicons name="flag-outline" size={24} color={colors.accent} />
                <Text style={dynamicStyles.sectionTitle}>Destino</Text>
              </View>

              <TouchableOpacity onPress={() => setShowDestinationProvincePicker(true)} activeOpacity={0.7}>
                <View style={dynamicStyles.inputWrapper}>
                  <Ionicons name="map-outline" size={18} color={colors.textSecondary} />
                  <View style={styles.dateTimeTextContainer}>
                    <Text style={[dynamicStyles.dateTimeText, !formData.destination.province && dynamicStyles.placeholderText]}>
                      {formData.destination.province || 'Provincia *'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <Modal
                visible={showOriginProvincePicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowOriginProvincePicker(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={dynamicStyles.modalContainer}>
                    <View style={dynamicStyles.modalHeader}>
                      <Text style={dynamicStyles.modalTitle}>Seleccionar Provincia (Origen)</Text>
                      <TouchableOpacity
                        onPress={() => setShowOriginProvincePicker(false)}
                        style={styles.closeButton}
                      >
                        <Ionicons name="close" size={24} color={colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.provinceList}>
                      {ARGENTINA_PROVINCES.map((province) => (
                        <TouchableOpacity
                          key={province}
                          onPress={() => {
                            handleChange('origin.province', province);
                            setShowOriginProvincePicker(false);
                          }}
                          style={[
                            dynamicStyles.vehicleItem,
                            formData.origin.province === province && dynamicStyles.vehicleItemSelected
                          ]}
                        >
                          <Text style={[
                            dynamicStyles.vehicleName,
                            formData.origin.province === province && dynamicStyles.vehicleNameSelected
                          ]}>
                            {province}
                          </Text>
                          {formData.origin.province === province && (
                            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              <Modal
                visible={showDestinationProvincePicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDestinationProvincePicker(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={dynamicStyles.modalContainer}>
                    <View style={dynamicStyles.modalHeader}>
                      <Text style={dynamicStyles.modalTitle}>Seleccionar Provincia (Destino)</Text>
                      <TouchableOpacity
                        onPress={() => setShowDestinationProvincePicker(false)}
                        style={styles.closeButton}
                      >
                        <Ionicons name="close" size={24} color={colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.provinceList}>
                      {ARGENTINA_PROVINCES.map((province) => (
                        <TouchableOpacity
                          key={province}
                          onPress={() => {
                            handleChange('destination.province', province);
                            setShowDestinationProvincePicker(false);
                          }}
                          style={[
                            dynamicStyles.vehicleItem,
                            formData.destination.province === province && dynamicStyles.vehicleItemSelected
                          ]}
                        >
                          <Text style={[
                            dynamicStyles.vehicleName,
                            formData.destination.province === province && dynamicStyles.vehicleNameSelected
                          ]}>
                            {province}
                          </Text>
                          {formData.destination.province === province && (
                            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              <View style={dynamicStyles.inputWrapper}>
                <Ionicons name="business-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Ciudad *"
                  placeholderTextColor={colors.placeholder}
                  value={formData.destination.city}
                  onChangeText={(value) => handleChange('destination.city', value)}
                />
              </View>

              <View style={dynamicStyles.inputWrapper}>
                <Ionicons name="navigate-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Dirección *"
                  placeholderTextColor={colors.placeholder}
                  value={formData.destination.address}
                  onChangeText={(value) => handleChange('destination.address', value)}
                />
              </View>
            </LinearGradient>

            {/* Details Section */}
            <LinearGradient
              colors={createColorArray(colors.surfaceElevated, colors.surface)}
              style={dynamicStyles.section}
            >
              <View style={styles.sectionHeader}>
                <Ionicons name="information-circle-outline" size={24} color={colors.info} />
                <Text style={dynamicStyles.sectionTitle}>Detalles del Viaje</Text>
              </View>

              <TouchableOpacity onPress={() => {
                setTempDate(date);
                setShowDatePicker(true);
              }} activeOpacity={0.7}>
                <View style={dynamicStyles.inputWrapper}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                  <View style={styles.dateTimeTextContainer}>
                    <Text style={[dynamicStyles.dateTimeText, !formData.departureDate && dynamicStyles.placeholderText]}>
                      {formData.departureDate ? formatDateForDisplay(formData.departureDate) : 'Fecha de salida *'}
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
                    <View style={dynamicStyles.datePickerWrapper}>
                      <DateTimePicker
                        value={tempDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onDateChange}
                        minimumDate={new Date()}
                        style={dynamicStyles.modalPicker}
                        textColor="#000000"
                      />
                    </View>
                    {Platform.OS === 'ios' && (
                      <View style={dynamicStyles.modalButtons}>
                        <TouchableOpacity
                          onPress={() => setShowDatePicker(false)}
                          style={dynamicStyles.modalButton}
                        >
                          <Text style={dynamicStyles.modalButtonCancel}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => confirmDate(tempDate)}
                          style={[dynamicStyles.modalButton, dynamicStyles.modalButtonPrimary]}
                        >
                          <Text style={dynamicStyles.modalButtonText}>Confirmar</Text>
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
                      {formData.departureTime ? formatTimeForDisplay(formData.departureTime) : 'Hora de salida *'}
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
                    <View style={dynamicStyles.datePickerWrapper}>
                      <DateTimePicker
                        value={tempTime}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onTimeChange}
                        style={dynamicStyles.modalPicker}
                        textColor="#000000"
                      />
                    </View>
                    {Platform.OS === 'ios' && (
                      <View style={dynamicStyles.modalButtons}>
                        <TouchableOpacity
                          onPress={() => setShowTimePicker(false)}
                          style={dynamicStyles.modalButton}
                        >
                          <Text style={dynamicStyles.modalButtonCancel}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => confirmTime(tempTime)}
                          style={[dynamicStyles.modalButton, dynamicStyles.modalButtonPrimary]}
                        >
                          <Text style={dynamicStyles.modalButtonText}>Confirmar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </Modal>

              <View style={dynamicStyles.inputWrapper}>
                <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="¿Cuántos asientos disponibles? *"
                  placeholderTextColor={colors.placeholder}
                  value={formData.availableSeats}
                  onChangeText={(value) => handleChange('availableSeats', value)}
                  keyboardType="numeric"
                />
              </View>

              <View style={dynamicStyles.inputWrapper}>
                <Ionicons name="cash-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Precio por asiento (opcional)"
                  placeholderTextColor={colors.placeholder}
                  value={formData.pricePerSeat}
                  onChangeText={(value) => handleChange('pricePerSeat', value)}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={[dynamicStyles.inputWrapper, styles.textAreaWrapper]}>
                <View style={styles.textAreaIconContainer}>
                  <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
                </View>
                <TextInput
                  style={[dynamicStyles.input, styles.textArea]}
                  placeholder="Notas (opcional)"
                  placeholderTextColor={colors.placeholder}
                  value={formData.notes}
                  onChangeText={(value) => handleChange('notes', value)}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </LinearGradient>

            {/* Preferences Section */}
            <LinearGradient
              colors={createColorArray(colors.surfaceElevated, colors.surface)}
              style={dynamicStyles.section}
            >
              <View style={styles.sectionHeader}>
                <Ionicons name="settings-outline" size={24} color={colors.accentOrange} />
                <Text style={dynamicStyles.sectionTitle}>Preferencias</Text>
              </View>

              <View style={dynamicStyles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <Ionicons name="cloud-outline" size={20} color={colors.textSecondary} />
                  <Text style={dynamicStyles.switchLabel}>Permitir fumar</Text>
                </View>
                <Switch
                  value={formData.allowSmoking}
                  onValueChange={(value) => handleChange('allowSmoking', value)}
                  trackColor={{ false: colors.inputBorder, true: colors.primaryLight }}
                  thumbColor={formData.allowSmoking ? colors.primary : colors.textMuted}
                  ios_backgroundColor={colors.inputBorder}
                />
              </View>

              <View style={dynamicStyles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <Ionicons name="paw-outline" size={20} color={colors.textSecondary} />
                  <Text style={dynamicStyles.switchLabel}>Permitir mascotas</Text>
                </View>
                <Switch
                  value={formData.allowPets}
                  onValueChange={(value) => handleChange('allowPets', value)}
                  trackColor={{ false: colors.inputBorder, true: colors.primaryLight }}
                  thumbColor={formData.allowPets ? colors.primary : colors.textMuted}
                  ios_backgroundColor={colors.inputBorder}
                />
              </View>
            </LinearGradient>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleCreateTrip}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient colors={gradients.primary} style={dynamicStyles.createButton}>
                {loading ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <>
                    <Text style={dynamicStyles.createButtonText}>Crear Viaje</Text>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dateTimeTextContainer: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
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
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  // Date/Time Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    padding: spacing.xs,
  },
  // Vehicle Picker Modal Styles
  vehicleList: {
    maxHeight: 400,
    padding: spacing.md,
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
  provinceList: {
    maxHeight: 400,
    padding: spacing.md,
  },
});

export default CreateTripScreen;
