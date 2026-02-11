import React, { useState, Fragment } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
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
import { useAlert } from '../../context/AlertContext';
import { ENDPOINTS } from '../../config/api';


const TripDetails = ({ navigation, route }) => {
    const { origin, destination, distance, duration, vehicles } = route.params;
    const { showAlert } = useAlert();

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
            showAlert('Error', 'Por favor completa todos los campos obligatorios');
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
                showAlert('Viaje creado', 'Tu viaje ha sido publicado exitosamente', [
                    {
                        text: 'Continuar',
                        onPress: () => navigation.navigate('Carpoolings'),
                    },
                ]);
            }
        } catch (error) {
            showAlert('Error', error.message || 'Error al crear el viaje');
        } finally {
            setLoading(false);
        }
    };

    const selectedVehicle = vehicles?.find(v => v && v._id === formData.vehicle);

    return (
        <>
            <SafeAreaView style={[styles.container, { backgroundColor: '#161616' }]} edges={['left', 'right']}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardView}
                >
                    <ScrollView 
                        style={[styles.scrollView, { backgroundColor: '#1F1F1F' }]}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Route info */}
                        <View style={[styles.routeCard, {
                            backgroundColor: '#292929',
                            borderColor: '#404040'
                        }]}>
                            <View style={styles.routeItem}>
                                <View style={[styles.routeDot, { backgroundColor: '#9CA3AF' }]} />
                                <Text style={[styles.routeText, { color: '#FFFFFF' }]} numberOfLines={1}>
                                    {[origin.address, origin.city, origin.province].filter(Boolean).join(', ')}
                                </Text>
                            </View>
                            <View style={[styles.routeLine, { backgroundColor: '#404040' }]} />
                            <View style={styles.routeItem}>
                                <View style={[styles.routeDot, { backgroundColor: '#FFFFFF' }]} />
                                <Text style={[styles.routeText, { color: '#FFFFFF' }]} numberOfLines={1}>
                                    {[destination.address, destination.city, destination.province].filter(Boolean).join(', ')}
                                </Text>
                            </View>
                            {distance && duration && (
                                <View style={[styles.routeInfo, { borderTopColor: '#404040' }]}>
                                    <Text style={[styles.routeInfoText, { color: '#9CA3AF' }]}>{distance} • {duration}</Text>
                                </View>
                            )}
                        </View>

                        {/* Vehicle Selection */}
                        <View style={[styles.section, {
                            backgroundColor: '#292929',
                            borderColor: '#404040'
                        }]}>
                            <Text style={[styles.sectionTitle, { color: '#FFFFFF' }]}>Vehículo</Text>
                            <TouchableOpacity 
                                style={[styles.inputContainer, {
                                    backgroundColor: '#1F1F1F',
                                    borderColor: '#404040'
                                }]}
                                onPress={() => setShowVehicleModal(true)}
                            >
                                <Ionicons name="car-outline" size={20} color={'#9CA3AF'} />
                                <Text style={[
                                    styles.inputText, 
                                    { color: '#FFFFFF' },
                                    !formData.vehicle && { color: '#6B7280' }
                                ]}>
                                    {selectedVehicle 
                                        ? `${selectedVehicle.brand} ${selectedVehicle.model}` 
                                        : 'Seleccionar vehículo'
                                    }
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={'#9CA3AF'} />
                            </TouchableOpacity>
                            
                            {selectedVehicle && (
                                <View style={styles.vehicleDetails}>
                                    <Text style={[styles.vehicleDetailText, { color: '#9CA3AF' }]}>Patente: {selectedVehicle.licensePlate}</Text>
                                    {selectedVehicle.features && (
                                        <View style={styles.features}>
                                            {selectedVehicle.features.ac && <Text style={[styles.feature, {
                                                color: '#FFFFFF',
                                                backgroundColor: '#1F1F1F'
                                            }]}>A/C</Text>}
                                            {selectedVehicle.features.music && <Text style={[styles.feature, {
                                                color: '#FFFFFF',
                                                backgroundColor: '#1F1F1F'
                                            }]}>Música</Text>}
                                            {selectedVehicle.features.luggage && <Text style={[styles.feature, {
                                                color: '#FFFFFF',
                                                backgroundColor: '#1F1F1F'
                                            }]}>Equipaje</Text>}
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Date and Time */}
                        <View style={[styles.section, {
                            backgroundColor: '#292929',
                            borderColor: '#404040'
                        }]}>
                            <Text style={[styles.sectionTitle, { color: '#FFFFFF' }]}>Fecha y hora de salida</Text>
                            
                            <TouchableOpacity 
                                style={[styles.inputContainer, {
                                    backgroundColor: '#1F1F1F',
                                    borderColor: '#404040'
                                }]}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Ionicons name="calendar-outline" size={20} color={'#9CA3AF'} />
                                <Text style={[
                                    styles.inputText, 
                                    { color: formData.departureDate ? '#FFFFFF' : '#6B7280' }
                                ]}>
                                    {formData.departureDate ? formatDateForDisplay(formData.departureDate) : 'Seleccionar fecha'}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={'#9CA3AF'} />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.inputContainer, {
                                    backgroundColor: '#1F1F1F',
                                    borderColor: '#404040'
                                }]}
                                onPress={() => setShowTimePicker(true)}
                            >
                                <Ionicons name="time-outline" size={20} color={'#9CA3AF'} />
                                <Text style={[
                                    styles.inputText, 
                                    { color: formData.departureTime ? '#FFFFFF' : '#6B7280' }
                                ]}>
                                    {formData.departureTime ? formatTimeForDisplay(formData.departureTime) : 'Seleccionar hora'}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={'#9CA3AF'} />
                            </TouchableOpacity>
                        </View>

                        {/* Trip Details */}
                        <View style={[styles.section, {
                            backgroundColor: '#292929',
                            borderColor: '#404040'
                        }]}>
                            <Text style={[styles.sectionTitle, { color: '#FFFFFF' }]}>Detalles del viaje</Text>
                            
                            <View style={[styles.inputContainer, {
                                backgroundColor: '#1F1F1F',
                                borderColor: '#404040'
                            }]}>
                                <Ionicons name="person-outline" size={20} color={'#9CA3AF'} />
                                <TextInput
                                    style={[styles.input, { color: '#FFFFFF' }]}
                                    placeholder="Asientos disponibles"
                                    placeholderTextColor={'#6B7280'}
                                    value={formData.availableSeats}
                                    onChangeText={(value) => handleChange('availableSeats', value)}
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={[styles.inputContainer, {
                                backgroundColor: '#1F1F1F',
                                borderColor: '#404040',
                                alignItems: 'flex-start'
                            }]}>
                                <View style={{ paddingTop: 12 }}>
                                    <Ionicons name="document-text-outline" size={20} color={'#9CA3AF'} />
                                </View>
                                <TextInput
                                    style={[styles.input, styles.textArea, { color: '#FFFFFF' }]}
                                    placeholder="Notas adicionales (opcional)"
                                    placeholderTextColor={'#6B7280'}
                                    value={formData.notes}
                                    onChangeText={(value) => handleChange('notes', value)}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                />
                            </View>
                        </View>

                        {/* Preferences */}
                        <View style={[styles.section, styles.lastSection, {
                            backgroundColor: '#292929',
                            borderColor: '#404040'
                        }]}>
                            <Text style={[styles.sectionTitle, { color: '#FFFFFF' }]}>Preferencias</Text>
                            
                            <View style={[styles.preferenceItem, { borderBottomColor: '#404040' }]}>
                                <View style={styles.preferenceLabel}>
                                    <Ionicons name="ban-outline" size={20} color={'#9CA3AF'} />
                                    <Text style={[styles.preferenceText, { color: '#FFFFFF' }]}>Permitir fumar</Text>
                                </View>
                                <Switch
                                    value={formData.allowSmoking}
                                    onValueChange={(value) => handleChange('allowSmoking', value)}
                                    trackColor={{ false: '#404040', true: '#FFFFFF' }}
                                    thumbColor={formData.allowSmoking ? '#000000' : '#FFFFFF'}
                                />
                            </View>

                            <View style={[styles.preferenceItem, { borderBottomColor: '#404040' }]}>
                                <View style={styles.preferenceLabel}>
                                    <Ionicons name="paw-outline" size={20} color={'#9CA3AF'} />
                                    <Text style={[styles.preferenceText, { color: '#FFFFFF' }]}>Permitir mascotas</Text>
                                </View>
                                <Switch
                                    value={formData.allowPets}
                                    onValueChange={(value) => handleChange('allowPets', value)}
                                    trackColor={{ false: '#404040', true: '#FFFFFF' }}
                                    thumbColor={formData.allowPets ? '#000000' : '#FFFFFF'}
                                />
                            </View>
                        </View>

                        {/* Create Button */}
                        <View style={styles.createButtonContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.createButton,
                                    { backgroundColor: '#FFFFFF' },
                                    loading && { backgroundColor: '#E5E7EB' }
                                ]}
                                onPress={handleCreateTrip}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#000000" />
                                ) : (
                                    <Text style={[styles.createButtonText, { color: '#000000' }]}>Publicar viaje</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* Vehicle Selection Modal */}
                <Modal
                    visible={showVehicleModal}
                    animationType="fade"
                    presentationStyle="pageSheet"
                    onRequestClose={() => setShowVehicleModal(false)}
                >
                    <SafeAreaView style={[styles.modalContainer, { backgroundColor: '#161616' }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: '#404040' }]}>
                            <TouchableOpacity onPress={() => setShowVehicleModal(false)}>
                                <Text style={[styles.modalCancel, { color: '#FFFFFF' }]}>Cancelar</Text>
                            </TouchableOpacity>
                            <Text style={[styles.modalTitle, { color: '#FFFFFF' }]}>Seleccionar vehículo</Text>
                            <View style={styles.modalRight} />
                        </View>
                        
                        <ScrollView style={styles.modalContent}>
                            {vehicles?.map((vehicle) => (
                                <TouchableOpacity
                                    key={vehicle._id}
                                    style={[
                                        styles.vehicleOption,
                                        { borderBottomColor: '#404040' },
                                        formData.vehicle === vehicle._id && { backgroundColor: '#1F1F1F' }
                                    ]}
                                    onPress={() => {
                                        handleChange('vehicle', vehicle._id);
                                        setShowVehicleModal(false);
                                    }}
                                >
                                    <Ionicons name="car" size={24} color={'#FFFFFF'} />
                                    <View style={styles.vehicleInfo}>
                                        <Text style={[styles.vehicleName, { color: '#FFFFFF' }]}>
                                            {vehicle.brand} {vehicle.model}
                                        </Text>
                                        <Text style={[styles.vehiclePlate, { color: '#9CA3AF' }]}>{vehicle.licensePlate}</Text>
                                    </View>
                                    {formData.vehicle === vehicle._id && (
                                        <Ionicons name="checkmark" size={20} color={'#FFFFFF'} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </SafeAreaView>
                </Modal>
            </SafeAreaView>

            {/* Date Picker */}
            {showDatePicker && (
                <Modal
                    transparent
                    animationType="fade"
                    visible={showDatePicker}
                    onRequestClose={() => setShowDatePicker(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.pickerContainer, { backgroundColor: '#292929' }]}>
                            <View style={[styles.pickerHeader, { borderBottomColor: '#404040' }]}>
                                <Text style={[styles.pickerTitle, { color: '#FFFFFF' }]}>Seleccionar Fecha</Text>
                            </View>
                            <View style={styles.pickerContent}>
                                <DateTimePicker
                                    value={date}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(event, selectedDate) => {
                                        if (selectedDate) {
                                            setDate(selectedDate);
                                        }
                                    }}
                                    minimumDate={new Date()}
                                    textColor={'#FFFFFF'}
                                />
                            </View>
                            <View style={[styles.pickerFooter, { borderTopColor: '#404040' }]}>
                                <TouchableOpacity 
                                    style={styles.pickerButton}
                                    onPress={() => setShowDatePicker(false)}
                                >
                                    <Text style={[styles.pickerButtonText, { color: '#9CA3AF' }]}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={styles.pickerButton}
                                    onPress={() => {
                                        onDateChange({ type: 'set' }, date);
                                    }}
                                >
                                    <Text style={[styles.pickerButtonText, styles.pickerConfirmText, { color: '#FFFFFF' }]}>Confirmar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Time Picker */}
            {showTimePicker && (
                <Modal
                    transparent
                    animationType="fade"
                    visible={showTimePicker}
                    onRequestClose={() => setShowTimePicker(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.pickerContainer, { backgroundColor: '#292929' }]}>
                            <View style={[styles.pickerHeader, { borderBottomColor: '#404040' }]}>
                                <Text style={[styles.pickerTitle, { color: '#FFFFFF' }]}>Seleccionar Hora</Text>
                            </View>
                            <View style={styles.pickerContent}>
                                <DateTimePicker
                                    value={time}
                                    mode="time"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(event, selectedTime) => {
                                        if (selectedTime) {
                                            setTime(selectedTime);
                                        }
                                    }}
                                    textColor={'#FFFFFF'}
                                />
                            </View>
                            <View style={[styles.pickerFooter, { borderTopColor: '#404040' }]}>
                                <TouchableOpacity 
                                    style={styles.pickerButton}
                                    onPress={() => setShowTimePicker(false)}
                                >
                                    <Text style={[styles.pickerButtonText, { color: '#9CA3AF' }]}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={styles.pickerButton}
                                    onPress={() => {
                                        onTimeChange({ type: 'set' }, time);
                                    }}
                                >
                                    <Text style={[styles.pickerButtonText, styles.pickerConfirmText, { color: '#FFFFFF' }]}>Confirmar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </>
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
    
    // Route Card
    routeCard: {
        marginHorizontal: 16,
        marginTop: 20,
        marginBottom: 8,
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
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
        marginRight: 12,
    },
    destinationDot: {
        // Color will be set inline
    },
    routeLine: {
        width: 1,
        height: 20,
        marginLeft: 4,
        marginVertical: 2,
    },
    routeText: {
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
    },
    routeInfo: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
    },
    routeInfoText: {
        fontSize: 14,
        textAlign: 'center',
    },
    
    // Sections
    section: {
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    lastSection: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 16,
        marginTop: 20,
        marginHorizontal: 20,
    },
    
    // Input Container
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginHorizontal: 20,
        marginBottom: 12,
    },
    inputText: {
        flex: 1,
        fontSize: 16,
        marginLeft: 12,
    },
    placeholder: {
        // Color will be set inline
    },
    input: {
        flex: 1,
        fontSize: 16,
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
        marginBottom: 8,
    },
    features: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    feature: {
        fontSize: 12,
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
    },
    preferenceLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    preferenceText: {
        fontSize: 16,
        marginLeft: 12,
    },
    
    // Create Button Container
    createButtonContainer: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 32,
    },
    createButton: {
        borderRadius: 8,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    createButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    
    // Modal Styles
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    modalCancel: {
        fontSize: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
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
    },
    vehicleInfo: {
        flex: 1,
        marginLeft: 16,
    },
    vehicleName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    vehiclePlate: {
        fontSize: 14,
    },
    
    // Date/Time Picker Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerContainer: {
        borderRadius: 12,
        margin: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        minWidth: 300,
    },
    pickerHeader: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
    },
    pickerContent: {
        paddingVertical: 10,
    },
    pickerFooter: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderTopWidth: 1,
    },
    pickerTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    pickerButton: {
        paddingVertical: 5,
        paddingHorizontal: 10,
    },
    pickerButtonText: {
        fontSize: 16,
    },
    pickerConfirmText: {
        fontWeight: '600',
    },
});

export default TripDetails;