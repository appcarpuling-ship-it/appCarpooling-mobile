import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { ARGENTINA_PROVINCES } from '../../constants/provinces';
import { PROVINCE_IMAGES } from '../../constants/provinceImages';
import { getDepartmentsForProvince } from '../../constants/departmentImages';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_SIZE = (SCREEN_WIDTH * 0.96 - 32 - 12) / 2;

/**
 * Selector de provincia + ciudad con imágenes, replicando el filtro del Home.
 * Usa el listado completo de departamentos (constants/departmentImages) por provincia.
 *
 * Props:
 *  - province, city: valores actuales
 *  - onProvinceChange(province): setea provincia (debe limpiar la ciudad en el padre)
 *  - onCityChange(city): setea ciudad
 *  - provinceError, cityError: mensajes de error
 */
const LocationPickerField = ({
  // 'line' = sin caja, sólo la línea de abajo, para el registro. Sin la prop queda igual.
  variant,
  province,
  city,
  onProvinceChange,
  onCityChange,
  provinceError,
  cityError,
}) => {
  const { isDarkMode: dark } = useTheme();

  const [modalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState('province'); // 'province' | 'loading' | 'department'

  // Paleta (alineada con el filtro del Home y los registros)
  const modalBg     = dark ? '#1E1E1E' : '#FFFFFF';
  const divider     = dark ? '#2E2E2E' : '#E5E7EB';
  const textPrimary = dark ? '#FFFFFF' : '#000000';
  const textMuted   = dark ? '#9CA3AF' : '#6B7280';

  const fieldBg     = dark ? '#292929' : '#F8F9FA';
  const fieldBorder = dark ? '#404040' : '#E5E7EB';
  const errorColor  = dark ? '#EF4444' : '#DC2626';

  const depts = getDepartmentsForProvince(province);

  const openAt = (targetStep) => {
    setStep(targetStep);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setTimeout(() => setStep('province'), 250);
  };

  const handleProvinceSelect = (p) => {
    onProvinceChange(p);
    setStep('loading');
    setTimeout(() => setStep('department'), 700);
  };

  const handleCitySelect = (label) => {
    onCityChange(label);
    closeModal();
  };

  const renderField = ({ label, valueText, placeholder, icon, error, onPress, disabled }) => (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: textMuted }]}>
        {label}
        <Text style={{ color: errorColor }}> *</Text>
      </Text>
      <TouchableOpacity
        style={[
          styles.fieldButton,
          variant === 'line'
            ? {
                backgroundColor: 'transparent',
                borderRadius: 0,
                paddingHorizontal: 2,
                minHeight: 50,
                borderBottomColor: error ? errorColor : fieldBorder,
                borderBottomWidth: 1.5,
              }
            : {
                backgroundColor: fieldBg,
                borderColor: error ? errorColor : fieldBorder,
                borderWidth: error ? 2 : 1,
              },
          disabled && { opacity: 0.55 },
        ]}
        onPress={() => !disabled && onPress()}
        activeOpacity={disabled ? 1 : 0.7}
      >
        <Ionicons name={icon} size={20} color={error ? errorColor : textMuted} style={{ marginRight: 10 }} />
        <Text
          style={[styles.fieldText, { color: valueText ? (dark ? '#FFFFFF' : '#1F2937') : (dark ? '#6B7280' : '#9CA3AF') }]}
          numberOfLines={1}
        >
          {valueText || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={error ? errorColor : textMuted} />
      </TouchableOpacity>
      {error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={14} color={errorColor} />
          <Text style={[styles.errorText, { color: errorColor }]}>{error}</Text>
        </View>
      )}
    </View>
  );

  const renderGridItem = (image, label, isSelected, onPress) => {
    const cardBg    = isSelected ? (dark ? '#FFFFFF' : '#1F2937') : (dark ? '#252525' : '#FFFFFF');
    const imgTint   = isSelected ? (dark ? '#1F2937' : '#FFFFFF') : (dark ? '#FFFFFF' : '#1F2937');
    const labelClr  = isSelected ? (dark ? '#1F2937' : '#FFFFFF') : textMuted;
    return (
      <TouchableOpacity
        style={[styles.gridItem, {
          width: ITEM_SIZE,
          backgroundColor: cardBg,
          borderColor: isSelected ? cardBg : (dark ? '#333333' : '#E5E7EB'),
          shadowColor: isSelected ? (dark ? '#FFFFFF' : '#000') : 'transparent',
          shadowOpacity: isSelected ? 0.15 : 0,
          shadowRadius: 8,
          elevation: isSelected ? 4 : 0,
        }]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <Image source={image} style={[styles.gridImage, { tintColor: imgTint }]} resizeMode="contain" />
        <Text
          style={[styles.gridLabel, { color: labelClr }, isSelected && { fontWeight: '700' }]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const title = step === 'province' ? 'Seleccioná tu provincia'
    : step === 'loading' ? province
    : province;

  return (
    <>
      {renderField({
        label: 'Provincia',
        valueText: province,
        placeholder: 'Seleccioná tu provincia',
        icon: 'map-outline',
        error: provinceError,
        onPress: () => openAt('province'),
        disabled: false,
      })}

      {renderField({
        label: 'Ciudad',
        valueText: city,
        placeholder: province ? 'Seleccioná tu ciudad' : 'Primero seleccioná una provincia',
        icon: 'location-outline',
        error: cityError,
        onPress: () => openAt(province ? 'department' : 'province'),
        disabled: !province,
      })}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerContainer, { backgroundColor: modalBg }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: divider }]}>
              {step === 'department' && (
                <TouchableOpacity
                  onPress={() => setStep('province')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginRight: 10 }}
                >
                  <Ionicons name="arrow-back" size={22} color={textMuted} />
                </TouchableOpacity>
              )}
              <Text style={[styles.pickerTitle, { color: textPrimary, flex: 1 }]} numberOfLines={1}>{title}</Text>
              <TouchableOpacity onPress={closeModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={textMuted} />
              </TouchableOpacity>
            </View>

            {(step === 'province' || step === 'loading') && (
              <FlatList
                data={ARGENTINA_PROVINCES}
                keyExtractor={(item) => item}
                numColumns={2}
                columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
                contentContainerStyle={{ paddingTop: 16, paddingBottom: 24, gap: 12 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) =>
                  renderGridItem(PROVINCE_IMAGES[item], item, province === item, () => handleProvinceSelect(item))
                }
              />
            )}

            {step === 'loading' && (
              <View style={styles.pickerLoadingOverlay}>
                <ActivityIndicator size="large" color={dark ? '#FFFFFF' : '#1F2937'} />
              </View>
            )}

            {step === 'department' && (
              <FlatList
                data={depts}
                keyExtractor={(item) => item.key}
                numColumns={2}
                columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
                contentContainerStyle={{ paddingTop: 16, paddingBottom: 24, gap: 12 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) =>
                  renderGridItem(item.image, item.label, city === item.label, () => handleCitySelect(item.label))
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fieldWrap:   {},
  fieldLabel:  { fontSize: 12.5, fontFamily: 'Sora_600SemiBold', marginBottom: 6 },
  fieldButton: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 14, minHeight: 48 },
  fieldText:   { flex: 1, fontSize: 15 },
  errorRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: 4 },
  errorText:   { fontSize: 12, marginLeft: 4, flex: 1 },

  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerContainer:     { borderRadius: 20, width: '96%', maxHeight: '90%', overflow: 'hidden' },
  pickerLoadingOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  pickerHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1 },
  pickerTitle:         { fontSize: 17, fontFamily: 'Sora_600SemiBold' },

  gridItem:   { borderRadius: 16, borderWidth: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 10 },
  gridImage:  { width: 96, height: 96, marginBottom: 10 },
  gridLabel:  { fontSize: 12, textAlign: 'center', lineHeight: 17 },
});

export default LocationPickerField;
