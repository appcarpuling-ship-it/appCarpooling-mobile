import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors as themeColors, gradients, spacing, borderRadius, fontSize, fontWeight } from '../theme/colors';
import useColors from '../hooks/useColors';

const AdvancedFiltersModal = ({ visible, onClose, onApplyFilters, initialFilters = {} }) => {
  const { colors, createColorArray } = useColors();

  // Dynamic styles that depend on colors hook
  const dynamicStyles = StyleSheet.create({
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    modalTitle: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.bold,
      color: colors.textPrimary,
    },
    sectionTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    inputLabel: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    input: {
      flex: 1,
      paddingVertical: spacing.md,
      marginLeft: spacing.sm,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    dateText: {
      flex: 1,
      marginLeft: spacing.sm,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    timeButton: {
      flex: 1,
      minWidth: '45%',
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    timeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    ratingText: {
      marginLeft: spacing.sm,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      flex: 1,
    },
    vehicleButton: {
      flex: 1,
      minWidth: '45%',
      borderRadius: borderRadius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkboxLabel: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
    },
    sortButton: {
      flex: 1,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    modalActions: {
      flexDirection: 'row',
      padding: spacing.lg,
      gap: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    resetButton: {
      flex: 1,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    resetButtonText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.textSecondary,
    },
  });
  const [filters, setFilters] = useState({
    originCity: '',
    destinationCity: '',
    date: '',
    minSeats: '',
    maxPrice: '',
    minRating: 0,
    timeOfDay: '', // 'morning', 'afternoon', 'evening', 'night'
    vehicleType: '', // 'sedan', 'suv', 'hatchback', 'pickup'
    instantBooking: false,
    sortBy: 'departureDate', // 'departureDate', 'price', 'rating'
    sortOrder: 'asc', // 'asc', 'desc'
    ...initialFilters,
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      originCity: initialFilters.originCity || '',
      destinationCity: initialFilters.destinationCity || '',
      date: '',
      minSeats: '',
      maxPrice: '',
      minRating: 0,
      timeOfDay: '',
      vehicleType: '',
      instantBooking: false,
      sortBy: 'departureDate',
      sortOrder: 'asc',
    });
  };

  const applyFilters = () => {
    onApplyFilters(filters);
    closeModal();
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setSelectedDate(selectedDate);
      updateFilter('date', selectedDate.toISOString().split('T')[0]);
    }
  };

  const renderStarRating = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => updateFilter('minRating', i)}
          style={styles.starButton}
        >
          <Ionicons
            name={i <= filters.minRating ? 'star' : 'star-outline'}
            size={24}
            color={i <= filters.minRating ? '#FFB800' : colors.textTertiary}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const renderTimeButtons = () => {
    const times = [
      { key: 'morning', label: 'Mañana', icon: 'sunny-outline', color: '#F59E0B' },
      { key: 'afternoon', label: 'Tarde', icon: 'partly-sunny-outline', color: '#FB923C' },
      { key: 'evening', label: 'Noche', icon: 'moon-outline', color: '#8B5CF6' },
      { key: 'night', label: 'Madrugada', icon: 'moon', color: '#1F2937' },
    ];

    return times.map(time => (
      <TouchableOpacity
        key={time.key}
        onPress={() => updateFilter('timeOfDay', filters.timeOfDay === time.key ? '' : time.key)}
        style={[dynamicStyles.timeButton, filters.timeOfDay === time.key && dynamicStyles.timeButtonActive]}
        activeOpacity={0.7}
      >
        <Ionicons
          name={time.icon}
          size={20}
          color={filters.timeOfDay === time.key ? '#FFF' : time.color}
        />
        <Text style={[
          styles.timeButtonText,
          { color: filters.timeOfDay === time.key ? '#FFF' : colors.textSecondary }
        ]}>
          {time.label}
        </Text>
      </TouchableOpacity>
    ));
  };

  const renderVehicleButtons = () => {
    const vehicles = [
      { key: 'sedan', label: 'Sedán', icon: 'car-outline' },
      { key: 'suv', label: 'SUV', icon: 'car-sport-outline' },
      { key: 'hatchback', label: 'Hatchback', icon: 'car' },
      { key: 'pickup', label: 'Pickup', icon: 'truck-outline' },
    ];

    return vehicles.map(vehicle => (
      <TouchableOpacity
        key={vehicle.key}
        onPress={() => updateFilter('vehicleType', filters.vehicleType === vehicle.key ? '' : vehicle.key)}
        style={[dynamicStyles.vehicleButton, filters.vehicleType === vehicle.key && styles.vehicleButtonActive]}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={filters.vehicleType === vehicle.key ? ['#1F2937', '#111827'] : ['transparent', 'transparent']}
          style={styles.vehicleButtonContent}
        >
          <Ionicons
            name={vehicle.icon}
            size={20}
            color={filters.vehicleType === vehicle.key ? '#FFF' : colors.primary}
          />
          <Text style={[
            styles.vehicleButtonText,
            { color: filters.vehicleType === vehicle.key ? '#FFF' : colors.textSecondary }
          ]}>
            {vehicle.label}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    ));
  };

  const renderSortButton = (key, label, icon) => {
    const isActive = filters.sortBy === key;
    return (
      <TouchableOpacity
        onPress={() => {
          if (isActive) {
            updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc');
          } else {
            updateFilter('sortBy', key);
            updateFilter('sortOrder', 'asc');
          }
        }}
        style={[dynamicStyles.sortButton, isActive && styles.sortButtonActive]}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={isActive ? ['#1F2937', '#111827'] : ['transparent', 'transparent']}
          style={styles.sortButtonContent}
        >
          <Ionicons
            name={icon}
            size={18}
            color={isActive ? '#FFF' : colors.textSecondary}
          />
          <Text style={[
            styles.sortButtonText,
            { color: isActive ? '#FFF' : colors.textSecondary }
          ]}>
            {label}
          </Text>
          {isActive && (
            <Ionicons
              name={filters.sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#FFF"
            />
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={closeModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.modalContainer,
                  { transform: [{ translateY: slideAnim }] }
                ]}
              >
                <LinearGradient
                  colors={createColorArray(colors.background, colors.surface)}
                  style={styles.modalGradient}
                >
                  {/* Header */}
                  <View style={dynamicStyles.modalHeader}>
                    <Text style={dynamicStyles.modalTitle}>Filtros Avanzados</Text>
                    <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                      <Ionicons name="close" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                    {/* Ubicaciones */}
                    <View style={styles.section}>
                      <Text style={dynamicStyles.sectionTitle}>Ubicaciones</Text>
                      <View style={styles.inputGroup}>
                        <Text style={dynamicStyles.inputLabel}>Ciudad de Origen</Text>
                        <View style={dynamicStyles.inputContainer}>
                          <Ionicons name="radio-button-on" size={18} color={colors.primary} />
                          <TextInput
                            style={styles.input}
                            placeholder="Ej: Buenos Aires"
                            placeholderTextColor={colors.textTertiary}
                            value={filters.originCity}
                            onChangeText={(text) => updateFilter('originCity', text)}
                          />
                        </View>
                      </View>
                      <View style={styles.inputGroup}>
                        <Text style={dynamicStyles.inputLabel}>Ciudad de Destino</Text>
                        <View style={dynamicStyles.inputContainer}>
                          <Ionicons name="location" size={18} color={colors.primary} />
                          <TextInput
                            style={styles.input}
                            placeholder="Ej: Córdoba"
                            placeholderTextColor={colors.textTertiary}
                            value={filters.destinationCity}
                            onChangeText={(text) => updateFilter('destinationCity', text)}
                          />
                        </View>
                      </View>
                    </View>

                    {/* Fecha y Horario */}
                    <View style={styles.section}>
                      <Text style={dynamicStyles.sectionTitle}>Fecha y Horario</Text>
                      <View style={styles.inputGroup}>
                        <Text style={dynamicStyles.inputLabel}>Fecha</Text>
                        <TouchableOpacity
                          onPress={() => setShowDatePicker(true)}
                          style={dynamicStyles.dateButton}
                        >
                          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                          <Text style={dynamicStyles.dateText}>
                            {filters.date || 'Seleccionar fecha'}
                          </Text>
                          <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.inputGroup}>
                        <Text style={dynamicStyles.inputLabel}>Horario</Text>
                        <View style={styles.timeButtonsGrid}>
                          {renderTimeButtons()}
                        </View>
                      </View>
                    </View>

                    {/* Capacidad y Precio */}
                    <View style={styles.section}>
                      <Text style={dynamicStyles.sectionTitle}>Capacidad y Precio</Text>
                      <View style={styles.row}>
                        <View style={styles.halfInput}>
                          <Text style={dynamicStyles.inputLabel}>Asientos Mínimos</Text>
                          <View style={dynamicStyles.inputContainer}>
                            <Ionicons name="people" size={18} color={colors.primary} />
                            <TextInput
                              style={styles.input}
                              placeholder="Ej: 2"
                              placeholderTextColor={colors.textTertiary}
                              value={filters.minSeats}
                              onChangeText={(text) => updateFilter('minSeats', text)}
                              keyboardType="number-pad"
                            />
                          </View>
                        </View>
                        <View style={styles.halfInput}>
                          <Text style={dynamicStyles.inputLabel}>Precio Máximo</Text>
                          <View style={dynamicStyles.inputContainer}>
                            <Ionicons name="cash" size={18} color={colors.accentGreen} />
                            <TextInput
                              style={styles.input}
                              placeholder="$1500"
                              placeholderTextColor={colors.textTertiary}
                              value={filters.maxPrice}
                              onChangeText={(text) => updateFilter('maxPrice', text)}
                              keyboardType="number-pad"
                            />
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Rating del Conductor */}
                    <View style={styles.section}>
                      <Text style={dynamicStyles.sectionTitle}>Rating Mínimo del Conductor</Text>
                      <View style={styles.starsContainer}>
                        {renderStarRating()}
                        <Text style={dynamicStyles.ratingText}>
                          {filters.minRating > 0 ? `${filters.minRating} estrellas o más` : 'Sin mínimo'}
                        </Text>
                      </View>
                    </View>

                    {/* Tipo de Vehículo */}
                    <View style={styles.section}>
                      <Text style={dynamicStyles.sectionTitle}>Tipo de Vehículo</Text>
                      <View style={styles.vehicleGrid}>
                        {renderVehicleButtons()}
                      </View>
                    </View>

                    {/* Preferencias */}
                    <View style={styles.section}>
                      <Text style={dynamicStyles.sectionTitle}>Preferencias</Text>
                      <TouchableOpacity
                        onPress={() => updateFilter('instantBooking', !filters.instantBooking)}
                        style={styles.checkboxContainer}
                        activeOpacity={0.7}
                      >
                        <View style={[dynamicStyles.checkbox, filters.instantBooking && dynamicStyles.checkboxActive]}>
                          {filters.instantBooking && (
                            <Ionicons name="checkmark" size={16} color="#FFF" />
                          )}
                        </View>
                        <Text style={dynamicStyles.checkboxLabel}>Solo reserva instantánea</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Ordenamiento */}
                    <View style={styles.section}>
                      <Text style={dynamicStyles.sectionTitle}>Ordenar por</Text>
                      <View style={styles.sortButtonsContainer}>
                        {renderSortButton('departureDate', 'Fecha', 'calendar-outline')}
                        {renderSortButton('price', 'Precio', 'cash-outline')}
                        {renderSortButton('rating', 'Rating', 'star-outline')}
                      </View>
                    </View>
                  </ScrollView>

                  {/* Actions */}
                  <View style={dynamicStyles.modalActions}>
                    <TouchableOpacity
                      style={dynamicStyles.resetButton}
                      onPress={resetFilters}
                      activeOpacity={0.7}
                    >
                      <Text style={dynamicStyles.resetButtonText}>Limpiar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.applyButton}
                      onPress={applyFilters}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={createColorArray('#1F2937', '#111827')}
                        style={styles.applyButtonGradient}
                      >
                        <Text style={styles.applyButtonText}>Aplicar Filtros</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </Animated.View>
            </TouchableWithoutFeedback>

            {/* Date Picker */}
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={onDateChange}
                minimumDate={new Date()}
              />
            )}
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '85%',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  modalGradient: {
    flex: 1,
  },
  closeButton: {
    padding: spacing.xs,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginVertical: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  timeButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeButtonText: {
    marginLeft: spacing.xs,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  starButton: {
    padding: spacing.xs,
  },
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  vehicleButtonActive: {
    borderColor: 'transparent',
  },
  vehicleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.xs,
  },
  vehicleButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sortButtonsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sortButtonActive: {
    borderColor: 'transparent',
  },
  sortButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  sortButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  applyButton: {
    flex: 2,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  applyButtonGradient: {
    padding: spacing.md,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#FFF',
  },
});

export default AdvancedFiltersModal;