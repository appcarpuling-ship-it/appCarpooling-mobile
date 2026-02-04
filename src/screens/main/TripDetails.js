import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
    Switch,
    Animated,
    KeyboardAvoidingView,
    Platform,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { post_withauth } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { gradients, spacing, borderRadius, fontSize } from '../../theme/colors';
import useColors from '../../hooks/useColors';

// Usar valores directos para evitar problemas de carga en estilos estáticos
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

const TripDetails = ({ navigation, route }) => {
    const { colors, gradients, fontFamily, createColorArray } = useColors();
    const { origin, destination, distance, duration, vehicles } = route.params;

    // Helpers defensivos para estilos
    const safeSpacing = typeof spacing === 'object' ? spacing : { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
    const safeBorderRadius = typeof borderRadius === 'object' ? borderRadius : { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 };
    const safeFontSize = typeof fontSize === 'object' ? fontSize : { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, xxl: 24, xxxl: 32, display: 48 };

    const dynamicStyles = StyleSheet.create({
        section: {
            marginBottom: safeSpacing.lg,
            padding: safeSpacing.lg,
            borderRadius: safeBorderRadius.lg,
            borderWidth: 1,
            borderColor: colors.borderLight,
            overflow: 'hidden',
        },
        sectionTitle: {
            fontSize: safeFontSize.lg,
            fontFamily: fontFamily.semiBold,
            fontWeight: '600',
            color: colors.textPrimary,
            marginLeft: safeSpacing.sm,
        },
        label: {
            fontSize: safeFontSize.md,
            fontFamily: fontFamily.medium,
            fontWeight: '500',
            color: colors.textSecondary,
            marginBottom: safeSpacing.md,
        },
        inputWrapper: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: safeBorderRadius.md,
            paddingHorizontal: safeSpacing.md,
            paddingVertical: safeSpacing.sm,
            marginBottom: safeSpacing.sm,
            borderWidth: 1,
            borderColor: colors.borderLight,
        },
        input: {
            flex: 1,
            fontSize: safeFontSize.md,
            fontFamily: fontFamily.regular,
            color: colors.textPrimary,
            marginLeft: safeSpacing.sm,
            paddingVertical: safeSpacing.sm,
        },
        dateTimeText: {
            fontSize: safeFontSize.md,
            fontFamily: fontFamily.regular,
            color: colors.textSecondary,
            paddingVertical: safeSpacing.sm,
        },
        placeholderText: {
            color: colors.textTertiary,
        },
        switchRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: safeSpacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight,
            marginBottom: safeSpacing.xs,
        },
        switchLabel: {
            fontSize: safeFontSize.md,
            fontFamily: fontFamily.regular,
            color: colors.textPrimary,
            marginLeft: safeSpacing.sm,
        },
        createButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: safeBorderRadius.lg,
            paddingVertical: safeSpacing.lg,
            marginTop: safeSpacing.md,
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
            fontSize: safeFontSize.lg,
            fontFamily: fontFamily.semiBold,
            fontWeight: '600',
            marginLeft: safeSpacing.sm,
        },
        vehicleItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface,
            borderRadius: safeBorderRadius.md,
            padding: safeSpacing.md,
            marginBottom: safeSpacing.sm,
            borderWidth: 1,
            borderColor: colors.borderLight,
        },
        vehicleItemSelected: {
            backgroundColor: colors.primary + '20',
            borderColor: colors.primary,
        },
        vehicleName: {
            fontSize: safeFontSize.md,
            fontFamily: fontFamily.semiBold,
            fontWeight: '600',
            color: colors.textPrimary,
            marginBottom: safeSpacing.xs,
        },
        vehicleNameSelected: {
            color: colors.primary,
        },
        vehiclePlate: {
            fontSize: safeFontSize.sm,
            fontFamily: fontFamily.regular,
            color: colors.textSecondary,
        },
    });

    // Estados
    const [loading, setLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showVehicleModal, setShowVehicleModal] = useState(false);

    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(new Date());
    const [tempDate, setTempDate] = useState(new Date());
    const [tempTime, setTempTime] = useState(new Date());

    const [formData, setFormData] = useState({
        vehicle: '',
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

    React.useEffect(() => {
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

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const onDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
            if (selectedDate && event.type === 'set') {
                confirmDate(selectedDate);
            }
        } else {
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

        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const formatted = `${year}-${month}-${day}`;

        setFormData(prev => ({ ...prev, departureDate: formatted }));
    };

    const onTimeChange = (event, selectedTime) => {
        if (Platform.OS === 'android') {
            setShowTimePicker(false);
            if (selectedTime && event.type === 'set') {
                confirmTime(selectedTime);
            }
        } else {
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

        setFormData(prev => ({ ...prev, departureTime: timeString }));
    };

    const handleCreateTrip = async () => {
        const {
            vehicle,
            departureDate,
            departureTime,
            availableSeats,
            pricePerSeat,
        } = formData;

        if (
            !vehicle ||
            !departureDate ||
            !departureTime ||
            !availableSeats
        ) {
            Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
            return;
        }

        setLoading(true);
        try {
            const tripData = {
                vehicle: formData.vehicle,
                origin: origin,
                destination: destination,
                departureDate: formData.departureDate,
                departureTime: formData.departureTime,
                availableSeats: parseInt(availableSeats),
                notes: formData.notes,
                rules: {
                    smokingAllowed: formData.allowSmoking,
                    petsAllowed: formData.allowPets,
                }
            };

            if (pricePerSeat && pricePerSeat.trim() !== '') {
                tripData.pricePerSeat = parseFloat(pricePerSeat);
            } else {
                tripData.pricePerSeat = 0;
            }

            const response = await post_withauth(ENDPOINTS.CREATE_TRIP, tripData);

            if (response.success) {
                Alert.alert('Éxito', 'Viaje creado exitosamente', [
                    {
                        text: 'OK',
                        onPress: () => navigation.navigate('Carpoolings'),
                    },
                ]);
            }
        } catch (error) {
            console.error('❌ Error al crear viaje:', error);
            Alert.alert('Error', error.message || 'Error al crear el viaje');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={[]}>
            <LinearGradient colors={createColorArray(colors.background, colors.surface)} style={styles.gradientContainer}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
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
                            {/* Selector de Vehículo */}
                            <LinearGradient
                                colors={createColorArray(colors.surfaceElevated, colors.surface)}
                                style={dynamicStyles.section}
                            >
                                <Text style={dynamicStyles.label}>Vehículo *</Text>
                                <TouchableOpacity
                                    onPress={() => setShowVehicleModal(true)}
                                    activeOpacity={0.7}
                                >
                                    <View style={dynamicStyles.inputWrapper}>
                                        <Ionicons name="car-outline" size={20} color="#000000" />
                                        <View style={styles.dateTimeTextContainer}>
                                            <Text style={[dynamicStyles.dateTimeText, !formData.vehicle && dynamicStyles.placeholderText]}>
                                                {formData.vehicle && Array.isArray(vehicles)
                                                    ? (() => {
                                                        const selected = vehicles.find(v => v && v._id === formData.vehicle);
                                                        return selected
                                                            ? `${selected.brand} ${selected.model} - ${selected.licensePlate}`
                                                            : 'Selecciona un vehículo';
                                                    })()
                                                    : 'Selecciona un vehículo'}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-down" size={18} color="#000000" />
                                    </View>
                                </TouchableOpacity>
                            </LinearGradient>

                            {/* Características del Vehículo Seleccionado */}
                            {formData.vehicle && (() => {
                                const selectedVehicle = vehicles.find(v => v && v._id === formData.vehicle);
                                // Solo mostrar si hay características Y al menos una está activa
                                const hasActiveFeatures = selectedVehicle?.features && (
                                    selectedVehicle.features.ac || 
                                    selectedVehicle.features.music || 
                                    selectedVehicle.features.smoking || 
                                    selectedVehicle.features.pets || 
                                    selectedVehicle.features.luggage
                                );
                                return hasActiveFeatures ? (
                                    <LinearGradient
                                        colors={createColorArray(colors.surfaceElevated, colors.surface)}
                                        style={dynamicStyles.section}
                                    >
                                        <Text style={dynamicStyles.label}>Características del Vehículo</Text>
                                        <View style={styles.featuresContainer}>
                                            {selectedVehicle.features.ac && (
                                                <View style={styles.featureItem}>
                                                    <Ionicons name="snow-outline" size={20} color="#1F2937" />
                                                    <Text style={styles.featureText}>Aire Acondicionado</Text>
                                                </View>
                                            )}
                                            {selectedVehicle.features.music && (
                                                <View style={styles.featureItem}>
                                                    <Ionicons name="musical-notes-outline" size={20} color="#1F2937" />
                                                    <Text style={styles.featureText}>Música / Radio</Text>
                                                </View>
                                            )}
                                            {selectedVehicle.features.smoking && (
                                                <View style={styles.featureItem}>
                                                    <Ionicons name="ban-outline" size={20} color="#1F2937" />
                                                    <Text style={styles.featureText}>Se Permite Fumar</Text>
                                                </View>
                                            )}
                                            {selectedVehicle.features.pets && (
                                                <View style={styles.featureItem}>
                                                    <Ionicons name="paw-outline" size={20} color="#1F2937" />
                                                    <Text style={styles.featureText}>Mascotas</Text>
                                                </View>
                                            )}
                                            {selectedVehicle.features.luggage && (
                                                <View style={styles.featureItem}>
                                                    <Ionicons name="bag-handle-outline" size={20} color="#1F2937" />
                                                    <Text style={styles.featureText}>Equipaje Grande</Text>
                                                </View>
                                            )}
                                        </View>
                                    </LinearGradient>
                                ) : null;
                            })()}

                            {/* Detalles del Viaje */}
                            <LinearGradient
                                colors={createColorArray(colors.surfaceElevated, colors.surface)}
                                style={dynamicStyles.section}
                            >
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="information-circle-outline" size={24} color="#000000" />
                                    <Text style={dynamicStyles.sectionTitle}>Detalles del Viaje</Text>
                                </View>

                                <TouchableOpacity onPress={() => {
                                    setTempDate(date);
                                    setShowDatePicker(true);
                                }} activeOpacity={0.7}>
                                    <View style={dynamicStyles.inputWrapper}>
                                        <Ionicons name="calendar-outline" size={18} color="#000000" />
                                        <View style={styles.dateTimeTextContainer}>
                                            <Text style={[dynamicStyles.dateTimeText, !formData.departureDate && dynamicStyles.placeholderText]}>
                                                {formData.departureDate ? formatDateForDisplay(formData.departureDate) : 'Fecha de salida *'}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-down" size={18} color="#000000" />
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => {
                                    setTempTime(time);
                                    setShowTimePicker(true);
                                }} activeOpacity={0.7}>
                                    <View style={dynamicStyles.inputWrapper}>
                                        <Ionicons name="time-outline" size={18} color="#000000" />
                                        <View style={styles.dateTimeTextContainer}>
                                            <Text style={[dynamicStyles.dateTimeText, !formData.departureTime && dynamicStyles.placeholderText]}>
                                                {formData.departureTime ? formatTimeForDisplay(formData.departureTime) : 'Hora de salida *'}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-down" size={18} color="#000000" />
                                    </View>
                                </TouchableOpacity>

                                <View style={dynamicStyles.inputWrapper}>
                                    <Ionicons name="people-outline" size={18} color="#000000" />
                                    <TextInput
                                        style={dynamicStyles.input}
                                        placeholder="Asientos disponibles*"
                                        placeholderTextColor={colors.placeholder}
                                        value={formData.availableSeats}
                                        onChangeText={(value) => handleChange('availableSeats', value)}
                                        keyboardType="numeric"
                                    />
                                </View>

                                {/* <View style={dynamicStyles.inputWrapper}>
                                    <Ionicons name="cash-outline" size={18} color="#000000" />
                                    <TextInput
                                        style={dynamicStyles.input}
                                        placeholder="Precio por asiento (opcional)"
                                        placeholderTextColor={colors.placeholder}
                                        value={formData.pricePerSeat}
                                        onChangeText={(value) => handleChange('pricePerSeat', value)}
                                        keyboardType="decimal-pad"
                                    />
                                </View> */}

                                <View style={[dynamicStyles.inputWrapper, styles.textAreaWrapper]}>
                                    <View style={styles.textAreaIconContainer}>
                                        <Ionicons name="document-text-outline" size={18} color="#000000" />
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

                            {/* Preferencias */}
                            <LinearGradient
                                colors={createColorArray(colors.surfaceElevated, colors.surface)}
                                style={dynamicStyles.section}
                            >
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="settings-outline" size={24} color="#000000" />
                                    <Text style={dynamicStyles.sectionTitle}>Preferencias</Text>
                                </View>

                                <View style={dynamicStyles.switchRow}>
                                    <View style={styles.switchLabelContainer}>
                                        <Ionicons name="cloud-outline" size={20} color="#000000" />
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
                                        <Ionicons name="paw-outline" size={20} color="#000000" />
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

                            <TouchableOpacity
                                onPress={handleCreateTrip}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                <LinearGradient colors={gradients.primary} style={dynamicStyles.createButton}>
                                    {loading ? (
                                        <ActivityIndicator color="#ffffff" />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
                                            <Text style={dynamicStyles.createButtonText}>Crear Viaje</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* MODAL DE VEHÍCULOS - Aparece en el centro */}
                <Modal
                    visible={showVehicleModal}
                    animationType="fade"
                    transparent={true}
                    onRequestClose={() => setShowVehicleModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Seleccionar Vehículo</Text>
                                <TouchableOpacity
                                    onPress={() => setShowVehicleModal(false)}
                                    style={styles.modalCloseButton}
                                >
                                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={styles.modalList}>
                                {(Array.isArray(vehicles) ? vehicles : []).map((vehicle) => (
                                    vehicle && vehicle._id ? (
                                        <TouchableOpacity
                                            key={vehicle._id}
                                            onPress={() => {
                                                handleChange('vehicle', vehicle._id);
                                                setShowVehicleModal(false);
                                            }}
                                            style={[
                                                styles.modalItem,
                                                formData.vehicle === vehicle._id && styles.modalItemSelected
                                            ]}
                                        >
                                            <View style={styles.vehicleModalInfo}>
                                                <Ionicons
                                                    name="car"
                                                    size={24}
                                                    color={formData.vehicle === vehicle._id ? colors.primary : '#000000'}
                                                    style={styles.vehicleModalIcon}
                                                />
                                                <View>
                                                    <Text style={[
                                                        styles.modalItemText,
                                                        formData.vehicle === vehicle._id && styles.modalItemTextSelected
                                                    ]}>
                                                        {vehicle.brand} {vehicle.model}
                                                    </Text>
                                                    <Text style={styles.vehicleModalPlate}>{vehicle.licensePlate}</Text>
                                                </View>
                                            </View>
                                            {formData.vehicle === vehicle._id && (
                                                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                                            )}
                                        </TouchableOpacity>
                                    ) : null
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                {/* Date Picker */}
                {showDatePicker && Platform.OS === 'android' && (
                    <DateTimePicker
                        value={tempDate}
                        mode="date"
                        display="default"
                        onChange={onDateChange}
                        minimumDate={new Date()}
                    />
                )}
                {showDatePicker && Platform.OS === 'ios' && (
                    <View style={styles.pickerOverlay}>
                        <View style={styles.pickerContainer}>
                            <View style={styles.pickerHeader}>
                                <Text style={styles.pickerTitle}>Seleccionar Fecha</Text>
                                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={tempDate}
                                mode="date"
                                display="spinner"
                                onChange={onDateChange}
                                minimumDate={new Date()}
                                textColor="#000000"
                            />
                            <View style={styles.pickerButtons}>
                                <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.pickerButton}>
                                    <Text style={styles.pickerButtonCancel}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => confirmDate(tempDate)} style={styles.pickerButtonPrimary}>
                                    <Text style={styles.pickerButtonText}>Confirmar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                {/* Time Picker */}
                {showTimePicker && Platform.OS === 'android' && (
                    <DateTimePicker
                        value={tempTime}
                        mode="time"
                        display="default"
                        onChange={onTimeChange}
                    />
                )}
                {showTimePicker && Platform.OS === 'ios' && (
                    <View style={styles.pickerOverlay}>
                        <View style={styles.pickerContainer}>
                            <View style={styles.pickerHeader}>
                                <Text style={styles.pickerTitle}>Seleccionar Hora</Text>
                                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={tempTime}
                                mode="time"
                                display="spinner"
                                onChange={onTimeChange}
                                textColor="#000000"
                            />
                            <View style={styles.pickerButtons}>
                                <TouchableOpacity onPress={() => setShowTimePicker(false)} style={styles.pickerButton}>
                                    <Text style={styles.pickerButtonCancel}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => confirmTime(tempTime)} style={styles.pickerButtonPrimary}>
                                    <Text style={styles.pickerButtonText}>Confirmar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </LinearGradient>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    gradientContainer: { flex: 1 },
    keyboardView: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { 
        paddingBottom: 0, // Eliminado el padding bottom
        flexGrow: 1,
    },
    content: { 
        padding: spacing.lg || 24,
        paddingBottom: spacing.xxl || 48, // Espacio para separar del bottom navigation
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md || 16,
    },
    dateTimeTextContainer: {
        flex: 1,
        marginLeft: spacing.sm || 8,
        marginRight: spacing.sm || 8,
    },
    textArea: {
        minHeight: 80,
        paddingTop: spacing.sm || 8,
    },
    textAreaWrapper: {
        alignItems: 'flex-start',
    },
    textAreaIconContainer: {
        marginTop: spacing.md || 16,
    },
    switchLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    
    // Modal de Vehículos - Centrado en la pantalla
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg || 24,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius.xl || 24,
        maxHeight: '70%',
        width: '100%',
        maxWidth: 500,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg || 24,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: fontSize.xl || 20,
        fontFamily: SORA_FONTS.bold,
        fontWeight: '700',
        color: '#000000',
    },
    modalCloseButton: {
        padding: spacing.xs || 8,
    },
    modalList: {
        padding: spacing.md || 16,
    },
    modalItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md || 16,
        borderRadius: borderRadius.md || 12,
        marginBottom: spacing.xs || 8,
        backgroundColor: '#F8F9FA',
    },
    modalItemSelected: {
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#6366F1',
    },
    vehicleModalInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    vehicleModalIcon: {
        marginRight: spacing.md || 16,
    },
    modalItemText: {
        fontSize: fontSize.md || 16,
        color: '#000000',
        fontWeight: '600',
    },
    modalItemTextSelected: {
        color: '#6366F1',
        fontWeight: '700',
    },
    vehicleModalPlate: {
        fontSize: fontSize.sm || 14,
        color: '#6B7280',
        marginTop: 2,
    },

    // Features del vehículo
    featuresContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm || 8,
        marginTop: spacing.sm || 8,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingVertical: spacing.xs || 6,
        paddingHorizontal: spacing.sm || 10,
        borderRadius: borderRadius.md || 12,
        gap: spacing.xs || 6,
    },
    featureText: {
        fontSize: fontSize.sm || 14,
        color: '#1F2937',
        fontWeight: '500',
    },
    
    // Pickers de Fecha y Hora
    pickerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        margin: 24,
        minWidth: '80%',
        maxWidth: '90%',
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },
    pickerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    pickerButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E5E5',
    },
    pickerButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: '#F0F0F0',
        marginHorizontal: 8,
    },
    pickerButtonPrimary: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: '#000000',
        marginHorizontal: 8,
    },
    pickerButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    pickerButtonCancel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
});

export default TripDetails;