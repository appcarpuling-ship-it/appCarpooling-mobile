import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  Animated,
  Dimensions,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors as themeColors,  spacing, borderRadius, fontSize, fontWeight } from '../theme/colors';


// Safe colors for styles (fallbacks in case theme colors fail to load)
const styleColors = themeColors || {
  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#374151',
  textTertiary: '#6B7280',
  textMuted: '#9CA3AF',
  inputBackground: '#FFFFFF',
  inputBorder: '#D1D5DB',
  borderLight: '#F3F4F6',
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  accent: '#A855F7',
  error: '#EF4444',
  success: '#10B981',
};

const { height: screenHeight } = Dimensions.get('window');

const FormPicker = ({
  label,
  value,
  onSelect,
  error,
  placeholder = 'Seleccionar...',
  options = [],
  required = false,
  style,
  disabled = false,
  searchable = false,
  leftIcon,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Asegurar que options sea un array
  const validOptions = Array.isArray(options) ? options : [];

  const filteredOptions = searchable && searchQuery.length > 0
    ? (Array.isArray(validOptions) ? validOptions : []).filter(option =>
        typeof option === 'string'
          ? option.toLowerCase().includes(searchQuery.toLowerCase())
          : option.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : (Array.isArray(validOptions) ? validOptions : []);

  const handleSelect = (selectedValue) => {
    onSelect(selectedValue);
    setModalVisible(false);
    setSearchQuery('');
  };

  const getDisplayValue = () => {
    if (!value) return null;

    if (typeof options[0] === 'string') {
      return value;
    } else {
      const selectedOption = options.find(opt => opt.value === value);
      return selectedOption ? selectedOption.label : value;
    }
  };

  const getBorderColor = () => {
    if (error) return '#EF4444';
    return styleColors.borderLight;
  };

  return (
    <View style={[styles.container, style]}>
      {/* Label */}
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      {/* Picker Button */}
      <TouchableOpacity
        style={[
          styles.pickerButton,
          {
            borderColor: getBorderColor(),
            borderWidth: error ? 2 : 1,
          },
          disabled && styles.pickerDisabled,
        ]}
        onPress={() => !disabled && setModalVisible(true)}
        activeOpacity={disabled ? 1 : 0.7}
      >
        {/* Left Icon */}
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            <Ionicons
              name={leftIcon}
              size={20}
              color={error ? '#EF4444' : styleColors.textTertiary}
            />
          </View>
        )}

        {/* Display Value */}
        <Text
          style={[
            styles.pickerText,
            !value && styles.placeholder,
            leftIcon && styles.textWithIcon,
          ]}
          numberOfLines={1}
        >
          {getDisplayValue() || placeholder}
        </Text>

        {/* Chevron Icon */}
        <Ionicons
          name="chevron-down"
          size={20}
          color={error ? '#EF4444' : styleColors.textTertiary}
        />
      </TouchableOpacity>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle"
            size={14}
            color={'#EF4444'}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {label || 'Seleccionar'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={28} color="#000000" />
              </TouchableOpacity>
            </View>

            {/* Options List usando FlatList */}
            <FlatList
              data={filteredOptions.map((option, index) => ({
                id: index.toString(),
                value: typeof option === 'string' ? option : option.value,
                label: typeof option === 'string' ? option : option.label,
              }))}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = value === item.value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.optionItem,
                      isSelected && styles.optionItemSelected,
                    ]}
                    onPress={() => handleSelect(item.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>

                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color="#1F2937"
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No hay opciones disponibles</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: styleColors.textSecondary,
    marginBottom: spacing.xs,
  },
  required: {
    color: styleColors.error || '#EF4444',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: styleColors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  pickerDisabled: {
    backgroundColor: styleColors.surfaceDisabled || styleColors.surface,
    opacity: 0.6,
  },
  leftIconContainer: {
    marginRight: spacing.sm,
  },
  pickerText: {
    flex: 1,
    fontSize: fontSize.md,
    color: styleColors.textPrimary,
  },
  placeholder: {
    color: styleColors.textTertiary,
  },
  textWithIcon: {
    marginLeft: 0,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  errorText: {
    fontSize: fontSize.xs,
    color: styleColors.error || '#EF4444',
    marginLeft: spacing.xs,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#000000',
  },
  closeButton: {
    padding: spacing.xs,
  },
  optionsList: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    minHeight: 56,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionItemSelected: {
    backgroundColor: '#F8F9FA',
  },
  optionText: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: '#000000',
  },
  optionTextSelected: {
    color: '#1F2937',
    fontWeight: fontWeight.bold,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    minHeight: 250,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: '#6B7280',
    marginTop: spacing.md,
  },
});

export default FormPicker;