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
import { useTheme } from '../../context/ThemeContext';
import { colors as themeColors,  spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';

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
  // 'line' = sin caja, sólo la línea de abajo. Lo usan las pantallas de acceso, para que
  // el selector no desentone al lado de los campos de línea. Sin la prop, todo sigue igual.
  variant,
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
  const { isDarkMode } = useTheme();

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
    if (error) return isDarkMode ? '#EF4444' : '#DC2626';
    return isDarkMode ? '#404040' : '#E5E7EB';
  };

  return (
    <View style={[styles.container, style]}>
      {/* Label */}
      {label && (
        <Text style={[styles.label, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
          {label}
          {required && <Text style={[styles.required, { color: isDarkMode ? '#EF4444' : '#DC2626' }]}> *</Text>}
        </Text>
      )}

      {/* Picker Button */}
      <TouchableOpacity
        style={[
          styles.pickerButton,
          variant === 'line'
            ? {
                backgroundColor: 'transparent',
                borderRadius: 0,
                paddingHorizontal: 2,
                minHeight: 50,
                borderBottomColor: getBorderColor(),
                borderBottomWidth: 1.5,
              }
            : {
                backgroundColor: isDarkMode ? '#292929' : '#F8F9FA',
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
              color={error ? (isDarkMode ? '#EF4444' : '#DC2626') : (isDarkMode ? '#9CA3AF' : '#6B7280')}
            />
          </View>
        )}

        {/* Display Value */}
        <Text
          style={[
            styles.pickerText,
            { color: isDarkMode ? '#FFFFFF' : '#1F2937' },
            !value && [styles.placeholder, { color: isDarkMode ? '#6B7280' : '#9CA3AF' }],
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
          color={error ? (isDarkMode ? '#EF4444' : '#DC2626') : (isDarkMode ? '#9CA3AF' : '#6B7280')}
        />
      </TouchableOpacity>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle"
            size={14}
            color={isDarkMode ? '#EF4444' : '#DC2626'}
          />
          <Text style={[styles.errorText, { color: isDarkMode ? '#EF4444' : '#DC2626' }]}>{error}</Text>
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
<View style={[styles.modalContainer, { backgroundColor: isDarkMode ? '#292929' : '#FFFFFF' }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: isDarkMode ? '#404040' : '#E5E7EB' }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
              {label || 'Seleccionar'}
            </Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color={isDarkMode ? '#FFFFFF' : '#000000'} />
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
                      {
                        backgroundColor: isDarkMode ? '#161616' : '#FFFFFF',
                        borderBottomColor: isDarkMode ? '#2E2E2E' : '#F3F4F6',
                      },
                      isSelected && {
                        backgroundColor: isDarkMode ? '#1E3A8A' : '#EBF4FF',
                        borderColor: isDarkMode ? '#3B82F6' : '#6366F1'
                      },
                    ]}
                    onPress={() => handleSelect(item.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                        isSelected && {
                          color: isDarkMode ? '#3B82F6' : '#6366F1',
                          fontWeight: '600'
                        },
                      ]}
                    >
                      {item.label}
                    </Text>

                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={isDarkMode ? '#3B82F6' : '#6366F1'}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>No hay opciones disponibles</Text>
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
    fontFamily: SORA_FONTS.semiBold,
    color: styleColors.textSecondary,
    marginBottom: spacing.xs,
  },
  required: {
    color: styleColors.error || '#EF4444',
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.bold,
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
    fontFamily: SORA_FONTS.regular,
    color: styleColors.textPrimary,
  },
  placeholder: {
    color: styleColors.textTertiary,
    fontFamily: SORA_FONTS.regular,
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
    fontFamily: SORA_FONTS.regular,
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
    fontFamily: SORA_FONTS.bold,
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
    fontFamily: SORA_FONTS.medium,
    color: '#000000',
  },
  optionTextSelected: {
    color: '#1F2937',
    fontFamily: SORA_FONTS.bold,
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