import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Modal,
    Keyboard,
    TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { post_withauth } from '../../../services/apiService';
import { useAlert } from '../../../context/AlertContext';
import { useColors } from '../../../hooks/useColors';
import { useUI } from '../../../theme/ui';
import { useAuth } from '../../../context/AuthContext';
import { ENDPOINTS } from '../../../config/api';

const TripDetails = ({ navigation, route }) => {
    const { origin, destination, waypoints, distance, duration, vehicles } = route.params;
    const { showAlert } = useAlert();
    const { isDarkMode } = useColors();
    const { user } = useAuth();

    const ui          = useUI();
    const bg          = ui.bg;
    const cardBg      = ui.surface;
    const border      = ui.border;
    const textPrimary = ui.text;
    const textMuted   = ui.textMuted;
    const divider     = ui.bg;

    const [loading, setLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showVehicleModal, setShowVehicleModal] = useState(false);

    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(new Date());

    const [formData, setFormData] = useState({
        vehicle:        '',
        departureDate:  '',
        departureTime:  '',
        availableSeats: '',

        notes:          '',
        allowSmoking:        false,
        allowPets:           false,
        womenOnly:           false,
        largeLuggageAllowed: false,
    });

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const onDateChange = (event, selectedDate) => {
        setShowDatePicker(false);
        if (selectedDate && event?.type === 'set') {
            setDate(selectedDate);
            const y = selectedDate.getFullYear();
            const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const d = String(selectedDate.getDate()).padStart(2, '0');
            handleChange('departureDate', `${y}-${m}-${d}`);
        }
    };

    const onTimeChange = (event, selectedTime) => {
        setShowTimePicker(false);
        if (selectedTime && event?.type === 'set') {
            setTime(selectedTime);
            const h = selectedTime.getHours().toString().padStart(2, '0');
            const m = selectedTime.getMinutes().toString().padStart(2, '0');
            handleChange('departureTime', `${h}:${m}`);
        }
    };

    const formatDateDisplay = (s) => {
        if (!s) return '';
        const [y, m, d] = s.split('-');
        return `${d}/${m}/${y}`;
    };

    const formatTimeDisplay = (s) => {
        if (!s) return '';
        const [h, m] = s.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${display}:${m} ${ampm}`;
    };

    const handleCreateTrip = async () => {
        const { vehicle, departureDate, departureTime, availableSeats } = formData;
        if (!vehicle || !departureDate || !departureTime || !availableSeats) {
            showAlert('Ocurrió algo', 'Por favor completá todos los campos obligatorios');
            return;
        }

        if (selectedVehicle?.capacity && parseInt(availableSeats) > selectedVehicle.capacity) {
            showAlert('Asientos inválidos', `El vehículo seleccionado tiene capacidad para ${selectedVehicle.capacity} pasajeros.`);
            return;
        }

        setLoading(true);
        try {
            const tripData = {
                vehicle,
                origin,
                destination,
                intermediateStops: (waypoints || []).map((wp, i) => ({
                    address: wp.address,
                    city: wp.city,
                    province: wp.province,
                    coordinates: wp.coordinates,
                    order: wp.order ?? i + 1,
                })),
                departureDate: formData.departureDate,
                departureTime: formData.departureTime,
                availableSeats: parseInt(availableSeats),
                pricePerSeat: 0,
                notes: formData.notes,
                rules: {
                    smokingAllowed:      formData.allowSmoking,
                    petsAllowed:         formData.allowPets,
                    womenOnly:           formData.womenOnly,
                    largeLuggageAllowed: formData.largeLuggageAllowed,
                },
            };

            const response = await post_withauth(ENDPOINTS.CREATE_TRIP, tripData);
            if (response.success) {
                showAlert('Viaje Publicado', 'Tu viaje ha sido creado con éxito. Ahora otros usuarios podrán verlo.', [
                    {
                        text: 'Continuar',
                        onPress: () => navigation.navigate('Main', {
                            screen: 'CarpoolingsTab',
                            params: { screen: 'Carpoolings' },
                        }),
                    },
                ], 'success');
            } else {
                showAlert('Ocurrió algo', response.message || 'No pudimos crear el viaje en este momento.', [], 'error');
            }
        } catch (error) {
            showAlert('Ocurrió algo', error.message || 'No pudimos crear el viaje en este momento.', [], 'error');
        } finally {
            setLoading(false);
        }
    };

    const selectedVehicle = vehicles?.find(v => v?._id === formData.vehicle);

    const preferences = [
        { key: 'allowSmoking',        label: 'Permitir fumar',        icon: 'ban-outline' },
        { key: 'allowPets',           label: 'Permitir mascotas',     icon: 'paw-outline' },
        ...(user?.gender === 'female' ? [{ key: 'womenOnly', label: 'Solo mujeres', icon: 'woman-outline' }] : []),
        { key: 'largeLuggageAllowed', label: 'Equipaje grande',       icon: 'bag-handle-outline' },
    ];

    return (
        <>
            <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['bottom', 'left', 'right']}>
                <KeyboardAvoidingView behavior="padding" style={styles.flex}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView
                        style={styles.flex}
                        contentContainerStyle={styles.scroll}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >

                        {/* Ruta */}
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                            <View style={styles.routeRow}>
                                <View style={styles.routeDots}>
                                    <View style={[styles.dot, { backgroundColor: textMuted }]} />
                                    <View style={[styles.line, { backgroundColor: border }]} />
                                    <View style={[styles.dot, { backgroundColor: textPrimary }]} />
                                </View>
                                <View style={styles.routeLabels}>
                                    <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={1}>
                                        {[origin.address, origin.city, origin.province].filter(Boolean).join(', ')}
                                    </Text>
                                    <Text style={[styles.routeText, { color: textPrimary, marginTop: 18 }]} numberOfLines={1}>
                                        {[destination.address, destination.city, destination.province].filter(Boolean).join(', ')}
                                    </Text>
                                </View>
                            </View>
                            {distance && duration && (
                                <Text style={[styles.routeMeta, { color: textMuted, borderTopColor: divider }]}>
                                    {distance} · {duration}
                                </Text>
                            )}
                        </View>

                        {/* Vehículo */}
                        <Text style={[styles.sectionLabel, { color: textPrimary }]}>VEHÍCULO</Text>
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                            <TouchableOpacity
                                style={styles.selectRow}
                                onPress={() => setShowVehicleModal(true)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="car-outline" size={19} color={textPrimary} />
                                <Text style={[
                                    styles.selectText,
                                    { color: formData.vehicle ? textPrimary : textMuted },
                                ]}>
                                    {selectedVehicle
                                        ? `${selectedVehicle.brand} ${selectedVehicle.model}`
                                        : 'Seleccionar vehículo'}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={textPrimary} />
                            </TouchableOpacity>

                            {selectedVehicle && (
                                <View style={[styles.vehicleExtra, { borderTopColor: divider }]}>
                                    <Text style={[styles.vehiclePlate, { color: textMuted }]}>
                                        {selectedVehicle.licensePlate}
                                        {selectedVehicle.capacity ? `  ·  ${selectedVehicle.capacity} asientos` : ''}
                                    </Text>
                                    <Text style={[styles.chipText, { color: textMuted, marginBottom: 4 }]}>Características</Text>
                                    {(() => {
                                        const f = selectedVehicle.features || {};
                                        const activeFeatures = [
                                            f.ac      && { label: 'A/C',      icon: 'snow-outline' },
                                            f.music   && { label: 'Música',   icon: 'musical-notes-outline' },
                                            f.luggage && { label: 'Equipaje', icon: 'bag-handle-outline' },
                                            f.pets    && { label: 'Mascotas', icon: 'paw-outline' },
                                        ].filter(Boolean);
                                        return activeFeatures.length > 0 ? (
                                            <View style={styles.chips}>
                                                {activeFeatures.map(feat => (
                                                    <View key={feat.label} style={[styles.chip, { backgroundColor: divider, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                                                        <Ionicons name={feat.icon} size={12} color={textPrimary} />
                                                        <Text style={[styles.chipText, { color: textPrimary }]}>{feat.label}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        ) : (
                                            <Text style={[styles.chipText, { color: textMuted }]}>Sin características registradas</Text>
                                        );
                                    })()}
                                </View>
                            )}
                        </View>

                        {/* Fecha y hora */}
                        <Text style={[styles.sectionLabel, { color: textPrimary }]}>FECHA Y HORA DE SALIDA</Text>
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                            <TouchableOpacity
                                style={[styles.selectRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider }]}
                                onPress={() => setShowDatePicker(true)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="calendar-outline" size={19} color={textPrimary} />
                                <Text style={[styles.selectText, { color: formData.departureDate ? textPrimary : textMuted }]}>
                                    {formData.departureDate ? formatDateDisplay(formData.departureDate) : 'Seleccionar fecha'}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={textPrimary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.selectRow}
                                onPress={() => setShowTimePicker(true)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="time-outline" size={19} color={textPrimary} />
                                <Text style={[styles.selectText, { color: formData.departureTime ? textPrimary : textMuted }]}>
                                    {formData.departureTime ? formatTimeDisplay(formData.departureTime) : 'Seleccionar hora'}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={textPrimary} />
                            </TouchableOpacity>
                        </View>

                        {/* Detalles */}
                        <Text style={[styles.sectionLabel, { color: textPrimary }]}>DETALLES</Text>
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                            <View style={[styles.inputRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider }]}>
                                <Ionicons name="people-outline" size={19} color={textPrimary} />
                                <TextInput
                                    style={[styles.input, { color: textPrimary }]}
                                    placeholder="Asientos disponibles *"
                                    placeholderTextColor={textMuted}
                                    value={formData.availableSeats}
                                    onChangeText={v => {
                                        const num = parseInt(v);
                                        const cap = selectedVehicle?.capacity;
                                        if (cap && num > cap) return;
                                        handleChange('availableSeats', v);
                                    }}
                                    keyboardType="numeric"
                                />
                                {selectedVehicle?.capacity && (
                                    <Text style={[styles.capacityHint, { color: textMuted }]}>
                                        máx {selectedVehicle.capacity}
                                    </Text>
                                )}
                            </View>
                            {/* <View style={[styles.inputRow, { alignItems: 'flex-start' }]}>
                                <Ionicons name="document-text-outline" size={19} color={textMuted} style={{ marginTop: 2 }} />
                                <TextInput
                                    style={[styles.input, styles.textArea, { color: textPrimary }]}
                                    placeholder="Notas adicionales (opcional)"
                                    placeholderTextColor={textMuted}
                                    value={formData.notes}
                                    onChangeText={v => handleChange('notes', v)}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                />
                            </View> */}
                        </View>

                        {/* Preferencias */}
                        <Text style={[styles.sectionLabel, { color: textPrimary }]}>PREFERENCIAS</Text>
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                            {preferences.map((p, index) => (
                                <TouchableOpacity
                                    key={p.key}
                                    style={[
                                        styles.prefRow,
                                        index < preferences.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider },
                                    ]}
                                    onPress={() => handleChange(p.key, !formData[p.key])}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.prefIcon, { backgroundColor: divider }]}>
                                        <Ionicons name={p.icon} size={17} color={textPrimary} />
                                    </View>
                                    <Text style={[styles.prefText, { color: textPrimary }]}>{p.label}</Text>
                                    <View style={[
                                        styles.toggle,
                                        { backgroundColor: formData[p.key] ? textPrimary : divider },
                                    ]}>
                                        <View style={[
                                            styles.toggleCircle,
                                            { backgroundColor: formData[p.key] ? (isDarkMode ? '#000000' : '#FFFFFF') : textMuted },
                                            formData[p.key] && styles.toggleOn,
                                        ]} />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Publicar */}
                        <TouchableOpacity
                            style={[
                                styles.submitBtn,
                                { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' },
                                loading && { opacity: 0.6 },
                            ]}
                            onPress={handleCreateTrip}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading
                                ? <ActivityIndicator color={isDarkMode ? '#000000' : '#FFFFFF'} size="small" />
                                : <Text style={[styles.submitText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>
                                    Publicar viaje
                                  </Text>
                            }
                        </TouchableOpacity>

                    </ScrollView>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>

                {/* Modal vehículo */}
                <Modal
                    visible={showVehicleModal}
                    animationType="slide"
                    presentationStyle="pageSheet"
                    onRequestClose={() => setShowVehicleModal(false)}
                >
                    <SafeAreaView style={[styles.modalContainer, { backgroundColor: bg }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: border }]}>
                            <TouchableOpacity onPress={() => setShowVehicleModal(false)}>
                                <Text style={[styles.modalCancel, { color: textMuted }]}>Cancelar</Text>
                            </TouchableOpacity>
                            <Text style={[styles.modalTitle, { color: textPrimary }]}>Vehículo</Text>
                            <View style={{ width: 60 }} />
                        </View>
                        <ScrollView>
                            {vehicles?.map((vehicle) => (
                                <TouchableOpacity
                                    key={vehicle._id}
                                    style={[
                                        styles.vehicleOption,
                                        { borderBottomColor: divider },
                                        formData.vehicle === vehicle._id && { backgroundColor: cardBg },
                                    ]}
                                    onPress={() => { handleChange('vehicle', vehicle._id); setShowVehicleModal(false); }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="car-outline" size={22} color={textPrimary} />
                                    <View style={styles.vehicleInfo}>
                                        <Text style={[styles.vehicleName, { color: textPrimary }]}>
                                            {vehicle.brand} {vehicle.model}
                                        </Text>
                                        <Text style={[styles.vehiclePlateTxt, { color: textMuted }]}>{vehicle.licensePlate}</Text>
                                    </View>
                                    {formData.vehicle === vehicle._id && (
                                        <Ionicons name="checkmark" size={20} color={textPrimary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </SafeAreaView>
                </Modal>
            </SafeAreaView>

            {/* Date Picker */}
            {Platform.OS === 'android' && showDatePicker && (
                <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} minimumDate={new Date()} />
            )}
            {Platform.OS === 'ios' && (
                <Modal transparent animationType="fade" visible={showDatePicker} onRequestClose={() => setShowDatePicker(false)}>
                    <View style={styles.pickerOverlay}>
                        <View style={[styles.pickerBox, { backgroundColor: cardBg }]}>
                            <Text style={[styles.pickerTitle, { color: textPrimary, borderBottomColor: divider }]}>Fecha de salida</Text>
                            <DateTimePicker
                                value={date}
                                mode="date"
                                display="spinner"
                                onChange={(_, d) => { if (d) setDate(d); }}
                                minimumDate={new Date()}
                                textColor={textPrimary}
                            />
                            <View style={[styles.pickerFooter, { borderTopColor: divider }]}>
                                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                    <Text style={[styles.pickerBtn, { color: textMuted }]}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => onDateChange({ type: 'set' }, date)}>
                                    <Text style={[styles.pickerBtn, { color: textPrimary, fontWeight: '600' }]}>Confirmar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Time Picker */}
            {Platform.OS === 'android' && showTimePicker && (
                <DateTimePicker value={time} mode="time" display="default" onChange={onTimeChange} />
            )}
            {Platform.OS === 'ios' && (
                <Modal transparent animationType="fade" visible={showTimePicker} onRequestClose={() => setShowTimePicker(false)}>
                    <View style={styles.pickerOverlay}>
                        <View style={[styles.pickerBox, { backgroundColor: cardBg }]}>
                            <Text style={[styles.pickerTitle, { color: textPrimary, borderBottomColor: divider }]}>Hora de salida</Text>
                            <DateTimePicker
                                value={time}
                                mode="time"
                                display="spinner"
                                onChange={(_, t) => { if (t) setTime(t); }}
                                textColor={textPrimary}
                            />
                            <View style={[styles.pickerFooter, { borderTopColor: divider }]}>
                                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                                    <Text style={[styles.pickerBtn, { color: textMuted }]}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => onTimeChange({ type: 'set' }, time)}>
                                    <Text style={[styles.pickerBtn, { color: textPrimary, fontWeight: '600' }]}>Confirmar</Text>
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
    container: { flex: 1 },
    flex:      { flex: 1 },
    scroll:    { padding: 16, paddingBottom: 40, gap: 8 },

    sectionLabel: {
        fontSize: 11,
        fontFamily: 'Sora_600SemiBold',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginLeft: 4,
        marginTop: 8,
        marginBottom: 4,
    },

    card: {
        borderRadius: 14,
        borderWidth: 1,
        overflow: 'hidden',
    },

    // Route
    routeRow: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    routeDots: {
        alignItems: 'center',
        paddingTop: 3,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    line: {
        width: 1,
        flex: 1,
        marginVertical: 4,
        minHeight: 24,
    },
    routeLabels: {
        flex: 1,
    },
    routeText: {
        fontSize: 14,
        fontFamily: 'Sora_500Medium',
    },
    routeMeta: {
        fontSize: 13,
        textAlign: 'center',
        paddingVertical: 10,
        borderTopWidth: 1,
    },

    // Select row
    selectRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    selectText: {
        flex: 1,
        fontSize: 15,
    },

    // Vehicle extra info
    vehicleExtra: {
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: 8,
    },
    vehiclePlate: {
        fontSize: 13,
    },
    chips: {
        flexDirection: 'row',
        gap: 6,
    },
    chip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    chipText: {
        fontSize: 12,
        fontFamily: 'Sora_500Medium',
    },

    // Input row
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    input: {
        flex: 1,
        fontSize: 15,
    },
    textArea: {
        minHeight: 72,
        paddingTop: 0,
    },
    capacityHint: {
        fontSize: 12,
        fontFamily: 'Sora_500Medium',
    },

    // Preferences
    prefRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 14,
    },
    prefIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    prefText: {
        flex: 1,
        fontSize: 15,
        fontFamily: 'Sora_500Medium',
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
    toggleOn: {
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
        fontFamily: 'Sora_600SemiBold',
    },

    // Modal vehículo
    modalContainer: { flex: 1 },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    modalCancel: { fontSize: 16 },
    modalTitle:  { fontSize: 17, fontFamily: 'Sora_600SemiBold' },
    vehicleOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 14,
    },
    vehicleInfo: { flex: 1 },
    vehicleName: { fontSize: 15, fontFamily: 'Sora_600SemiBold', marginBottom: 2 },
    vehiclePlateTxt: { fontSize: 13 },

    // Pickers
    pickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerBox: {
        borderRadius: 14,
        margin: 20,
        minWidth: 300,
        overflow: 'hidden',
    },
    pickerTitle: {
        fontSize: 15,
        fontFamily: 'Sora_600SemiBold',
        textAlign: 'center',
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    pickerFooter: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    pickerBtn: {
        fontSize: 16,
        paddingHorizontal: 12,
    },
});

export default TripDetails;
