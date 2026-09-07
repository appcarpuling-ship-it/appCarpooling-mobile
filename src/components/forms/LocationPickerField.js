import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import { ARGENTINA_PROVINCES } from '../../constants/provinces';
import { PROVINCE_IMAGES } from '../../constants/provinceImages';
import { getDepartmentsForProvince } from '../../constants/departmentImages';

// Sin acentos ni mayúsculas: "cordoba" tiene que encontrar "Córdoba". Mismo truco que
// routePoints.js — no se escriben los diacríticos literales en el código.
const norm = (s) =>
  (s || '').toLowerCase().normalize('NFD').split('')
    .filter((c) => { const n = c.charCodeAt(0); return n < 0x0300 || n > 0x036f; }).join('');

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
  province,
  city,
  onProvinceChange,
  onCityChange,
  provinceError,
  cityError,
}) => {
  const ui = useUI();
  const dark = ui.isDarkMode;

  const [modalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState('province'); // 'province' | 'loading' | 'department'
  const [search, setSearch] = useState('');

  // Paleta única del rediseño (blanco y negro), la misma que usa el filtro del Home.
  const modalBg     = ui.card;
  const divider     = ui.border;
  const textPrimary = ui.text;
  const textMuted   = ui.textMuted;

  const fieldBg     = ui.surface;
  const fieldBorder = ui.border;
  const errorColor  = dark ? '#EF4444' : '#DC2626';

  const allDepts = getDepartmentsForProvince(province);
  const provinces = useMemo(() => {
    if (!search.trim()) return ARGENTINA_PROVINCES;
    const q = norm(search);
    return ARGENTINA_PROVINCES.filter((p) => norm(p).includes(q));
  }, [search]);
  const depts = useMemo(() => {
    if (!search.trim()) return allDepts;
    const q = norm(search);
    return allDepts.filter((d) => norm(d.label).includes(q));
  }, [search, allDepts]);

  const openAt = (targetStep) => {
    setStep(targetStep);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setTimeout(() => { setStep('province'); setSearch(''); }, 250);
  };

  const handleProvinceSelect = (p) => {
    onProvinceChange(p);
    setSearch('');
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
          {
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
          style={[styles.fieldText, { color: valueText ? textPrimary : textMuted }]}
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
    const cardBg   = isSelected ? ui.text : ui.surface;
    const imgTint  = isSelected ? ui.invertText : ui.text;
    const labelClr = isSelected ? ui.invertText : textMuted;
    return (
      <TouchableOpacity
        style={[styles.gridItem, {
          width: ITEM_SIZE,
          backgroundColor: cardBg,
          borderColor: isSelected ? cardBg : ui.border,
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

            {(step === 'province' || step === 'department') && (
              <View style={[styles.searchBar, { backgroundColor: fieldBg, borderColor: fieldBorder }]}>
                <Ionicons name="search" size={18} color={textMuted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={step === 'province' ? 'Buscar provincia' : 'Buscar ciudad'}
                  placeholderTextColor={textMuted}
                  style={[styles.searchInput, { color: textPrimary }]}
                  autoCorrect={false}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
                    <Ionicons name="close-circle" size={18} color={textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {(step === 'province' || step === 'loading') && (
              <FlatList
                data={provinces}
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
                <ActivityIndicator size="large" color={ui.text} />
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
  fieldWrap:   { marginBottom: 16 },
  fieldLabel:  { fontSize: 13, fontFamily: 'Sora_600SemiBold', marginBottom: 6 },
  fieldButton: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 14, minHeight: 48 },
  fieldText:   { flex: 1, fontSize: 15 },
  errorRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: 4 },
  errorText:   { fontSize: 12, marginLeft: 4, flex: 1 },

  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerContainer:     { borderRadius: 20, width: '96%', maxHeight: '90%', overflow: 'hidden' },
  pickerLoadingOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  pickerHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1 },
  pickerTitle:         { fontSize: 17, fontFamily: 'Sora_600SemiBold' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 14, height: 44,
    borderRadius: 999, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  gridItem:   { borderRadius: 16, borderWidth: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 10 },
  gridImage:  { width: 96, height: 96, marginBottom: 10 },
  gridLabel:  { fontSize: 12, textAlign: 'center', lineHeight: 17 },
});

export default LocationPickerField;
