import React, { useState } from 'react';
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
    KeyboardAvoidingView,
    Platform,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { post_withauth } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { colors } from '../../theme/colors';

const TripDetails = ({ navigation, route }) => {
    const { origin, destination, distance, duration, vehicles } = route.params;

    // Estados
    const [loading, setLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showVehicleModal, setShowVehicleModal] = useState(false);

    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(new Date());

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

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const onDateChange = (event, selectedDate) => {
        setShowDatePicker(false);
        if (selectedDate && event.type === 'set') {
            setDate(selectedDate);
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDate.getDate()).padStart(2, '0');
            const formatted = `${year}-${month}-${day}`;
            setFormData(prev => ({ ...prev, departureDate: formatted }));
        }
    };

    const onTimeChange = (event, selectedTime) => {
        setShowTimePicker(false);
        if (selectedTime && event.type === 'set') {
            setTime(selectedTime);
            const hours = selectedTime.getHours().toString().padStart(2, '0');
            const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
            const timeString = `${hours}:${minutes}`;
            setFormData(prev => ({ ...prev, departureTime: timeString }));
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

    const handleCreateTrip = async () => {
        const { vehicle, departureDate, departureTime, availableSeats } = formData;

        if (!vehicle || !departureDate || !departureTime || !availableSeats) {
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

            if (formData.pricePerSeat && formData.pricePerSeat.trim() !== '') {
                tripData.pricePerSeat = parseFloat(formData.pricePerSeat);
            } else {
                tripData.pricePerSeat = 0;
            }

            const response = await post_withauth(ENDPOINTS.CREATE_TRIP, tripData);

            if (response.success) {
                Alert.alert('Viaje creado', 'Tu viaje ha sido publicado exitosamente', [
                    {
                        text: 'Continuar',
                        onPress: () => navigation.navigate('Carpoolings'),
                    },
                ]);
            }
        } catch (error) {
            Alert.alert('Error', error.message || 'Error al crear el viaje');
        } finally {
            setLoading(false);
        }
    };

    const selectedVehicle = vehicles?.find(v => v && v._id === formData.vehicle);

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardView}
            >
                <ScrollView 
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Route info */}
                    <View style={styles.routeCard}>
                        <View style={styles.routeItem}>
                            <View style={styles.routeDot} />
                            <Text style={styles.routeText} numberOfLines={1}>{origin.address}</Text>
                        </View>
                        <View style={styles.routeLine} />
                        <View style={styles.routeItem}>
                            <View style={[styles.routeDot, styles.destinationDot]} />
                            <Text style={styles.routeText} numberOfLines={1}>{destination.address}</Text>
                        </View>
                        {distance && duration && (
                            <View style={styles.routeInfo}>
                                <Text style={styles.routeInfoText}>{distance} • {duration}</Text>
                            </View>
                        )}
                    </View>

                    {/* Vehicle Selection */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Vehículo</Text>
                        <TouchableOpacity 
                            style={styles.inputContainer}
                            onPress={() => setShowVehicleModal(true)}
                        >
                            <Ionicons name="car-outline" size={20} color={colors.textSecondary} />
                            <Text style={[
                                styles.inputText, 
                                !formData.vehicle && styles.placeholder
                            ]}>
                                {selectedVehicle 
                                    ? `${selectedVehicle.brand} ${selectedVehicle.model}` 
                                    : 'Seleccionar vehículo'
                                }
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                        
                        {selectedVehicle && (
                            <View style={styles.vehicleDetails}>
                                <Text style={styles.vehicleDetailText}>Patente: {selectedVehicle.licensePlate}</Text>
                                {selectedVehicle.features && (
                                    <View style={styles.features}>
                                        {selectedVehicle.features.ac && <Text style={styles.feature}>A/C</Text>}
                                        {selectedVehicle.features.music && <Text style={styles.feature}>Música</Text>}
                                        {selectedVehicle.features.luggage && <Text style={styles.feature}>Equipaje</Text>}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Date and Time */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Fecha y hora de salida</Text>
                        
                        <TouchableOpacity 
                            style={styles.inputContainer}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                            <Text style={[
                                styles.inputText, 
                                !formData.departureDate && styles.placeholder
                            ]}>
                                {formData.departureDate ? formatDateForDisplay(formData.departureDate) : 'Seleccionar fecha'}
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.inputContainer}
                            onPress={() => setShowTimePicker(true)}
                        >
                            <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                            <Text style={[
                                styles.inputText, 
                                !formData.departureTime && styles.placeholder
                            ]}>
                                {formData.departureTime ? formatTimeForDisplay(formData.departureTime) : 'Seleccionar hora'}
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Trip Details */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Detalles del viaje</Text>
                        
                        <View style={styles.inputContainer}>
                            <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
                            <TextInput
                                style={styles.input}
                                placeholder="Asientos disponibles"
                                placeholderTextColor={colors.textTertiary}
                                value={formData.availableSeats}
                                onChangeText={(value) => handleChange('availableSeats', value)}
                                keyboardType="numeric"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Notas adicionales (opcional)"
                                placeholderTextColor={colors.textTertiary}
                                value={formData.notes}
                                onChangeText={(value) => handleChange('notes', value)}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />
                        </View>
                    </View>

                    {/* Preferences */}
                    <View style={[styles.section, styles.lastSection]}>
                        <Text style={styles.sectionTitle}>Preferencias</Text>
                        
                        <View style={styles.preferenceItem}>
                            <View style={styles.preferenceLabel}>
                                <Ionicons name="ban-outline" size={20} color={colors.textSecondary} />
                                <Text style={styles.preferenceText}>Permitir fumar</Text>
                            </View>
                            <Switch
                                value={formData.allowSmoking}
                                onValueChange={(value) => handleChange('allowSmoking', value)}
                                trackColor={{ false: '#E5E7EB', true: colors.primary }}
                                thumbColor={'#FFFFFF'}
                            />
                        </View>

                        <View style={styles.preferenceItem}>
                            <View style={styles.preferenceLabel}>
                                <Ionicons name="paw-outline" size={20} color={colors.textSecondary} />
                                <Text style={styles.preferenceText}>Permitir mascotas</Text>
                            </View>
                            <Switch
                                value={formData.allowPets}
                                onValueChange={(value) => handleChange('allowPets', value)}
                                trackColor={{ false: '#E5E7EB', true: colors.primary }}
                                thumbColor={'#FFFFFF'}
                            />
                        </View>
                    </View>
                </ScrollView>

                {/* Create Button */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.createButton, loading && styles.createButtonDisabled]}
                        onPress={handleCreateTrip}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.createButtonText}>Publicar viaje</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Vehicle Selection Modal */}
            <Modal
                visible={showVehicleModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowVehicleModal(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowVehicleModal(false)}>
                            <Text style={styles.modalCancel}>Cancelar</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Seleccionar vehículo</Text>
                        <View style={styles.modalRight} />
                    </View>
                    
                    <ScrollView style={styles.modalContent}>
                        {vehicles?.map((vehicle) => (
                            <TouchableOpacity
                                key={vehicle._id}
                                style={[
                                    styles.vehicleOption,
                                    formData.vehicle === vehicle._id && styles.vehicleOptionSelected
                                ]}
                                onPress={() => {
                                    handleChange('vehicle', vehicle._id);
                                    setShowVehicleModal(false);
                                }}
                            >
                                <Ionicons name="car" size={24} color={colors.textPrimary} />
                                <View style={styles.vehicleInfo}>
                                    <Text style={styles.vehicleName}>
                                        {vehicle.brand} {vehicle.model}
                                    </Text>
                                    <Text style={styles.vehiclePlate}>{vehicle.licensePlate}</Text>
                                </View>
                                {formData.vehicle === vehicle._id && (
                                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Date Picker */}
            {showDatePicker && (
                <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                    minimumDate={new Date()}
                />
            )}

            {/* Time Picker */}
            {showTimePicker && (
                <DateTimePicker
                    value={time}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onTimeChange}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
        backgroundColor: colors.surface,
    },
    
    // Route Card
    routeCard: {
        backgroundColor: colors.cardBackground,
        marginHorizontal: 16,
        marginTop: 20,
        marginBottom: 8,
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    routeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 6,
    },
    routeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.textSecondary,
        marginRight: 12,
    },
    destinationDot: {
        backgroundColor: colors.primary,
    },
    routeLine: {
        width: 1,
        height: 20,
        backgroundColor: colors.border,
        marginLeft: 4,
        marginVertical: 2,
    },
    routeText: {
        fontSize: 16,
        color: colors.textPrimary,
        fontWeight: '500',
        flex: 1,
    },
    routeInfo: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    routeInfoText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    
    // Sections
    section: {
        backgroundColor: colors.cardBackground,
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    lastSection: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 16,
        marginTop: 20,
        marginHorizontal: 20,
    },
    
    // Input Container
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.inputBackground,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginHorizontal: 20,
        marginBottom: 12,
    },
    inputText: {
        flex: 1,
        fontSize: 16,
        color: colors.textPrimary,
        marginLeft: 12,
    },
    placeholder: {
        color: colors.textTertiary,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: colors.textPrimary,
        marginLeft: 12,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
        paddingTop: 12,
    },
    
    // Vehicle Details
    vehicleDetails: {
        marginHorizontal: 20,
        marginBottom: 20,
        paddingTop: 8,
    },
    vehicleDetailText: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 8,
    },
    features: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    feature: {
        fontSize: 12,
        color: colors.primary,
        backgroundColor: colors.surface,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        overflow: 'hidden',
    },
    
    // Preferences
    preferenceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        
    },
    preferenceLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    preferenceText: {
        fontSize: 16,
        color: colors.textPrimary,
        marginLeft: 12,
    },
    
    // Footer
    footer: {
        backgroundColor: colors.background,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    createButton: {
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    createButtonDisabled: {
        backgroundColor: colors.textTertiary,
    },
    createButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    
    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalCancel: {
        fontSize: 16,
        color: colors.primary,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    modalRight: {
        width: 60,
    },
    modalContent: {
        flex: 1,
    },
    vehicleOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    vehicleOptionSelected: {
        backgroundColor: colors.surface,
    },
    vehicleInfo: {
        flex: 1,
        marginLeft: 16,
    },
    vehicleName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    vehiclePlate: {
        fontSize: 14,
        color: colors.textSecondary,
    },
});

export default TripDetails;