import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import { useScreenWidth } from '../../hooks/useScreenWidth';
import { ARGENTINA_PROVINCES } from '../../constants/provinces';
import { PROVINCE_IMAGES } from '../../constants/provinceImages';
import { getDepartmentsForProvince } from '../../constants/departmentImages';

// Selector de provincia + ciudad como pantalla (reemplaza el modal que se
// repetía en Home, AllTrips y Solicitudes). El caller navega con:
//   navigation.navigate('LocationPicker', { title, province, city, onSelect })
// y recibe { province, city } al elegir. "Todos" devuelve city ''.
const LocationPickerScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const ITEM_SIZE = (useScreenWidth() - 48 - 12) / 2;
  const { title = 'Provincia', province: initialProvince = '', city = '', onSelect } = route.params || {};

  const [step, setStep] = useState(initialProvince ? 'department' : 'province');
  const [province, setProvince] = useState(initialProvince);
  const [search, setSearch] = useState('');

  // Sin esto, Buenos Aires solo (130+ departamentos) se scrollea a ciegas. Sin acentos ni
  // mayúsculas: "cordoba" tiene que encontrar "Córdoba". Mismo truco que routePoints.js:
  // no se escriben los diacríticos literales en el código, se filtran por rango Unicode.
  const norm = (s) =>
    (s || '').toLowerCase().normalize('NFD').split('')
      .filter((c) => { const n = c.charCodeAt(0); return n < 0x0300 || n > 0x036f; }).join('');

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

  const handleProvince = (p) => {
    setProvince(p);
    setSearch('');
    setStep('loading');
    setTimeout(() => setStep('department'), 900);
  };

  const finish = (selectedCity) => {
    onSelect?.({ province, city: selectedCity });
    navigation.goBack();
  };

  const goBack = () => {
    if (step === 'department') {
      setSearch('');
      setStep('province');
    } else {
      navigation.goBack();
    }
  };

  const renderGridItem = (image, label, isSelected, onPress) => {
    const cardBg = isSelected ? ui.text : ui.surface;
    const imgTint = isSelected ? ui.invertText : ui.text;
    const labelColor = isSelected ? ui.invertText : ui.textMuted;
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
        <Text style={[styles.gridLabel, { color: labelColor }, isSelected && { fontWeight: '700' }]} numberOfLines={2}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: ui.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} hitSlop={12} style={[styles.headerBtn, { backgroundColor: ui.surface }]}>
          <Ionicons name="arrow-back" size={20} color={ui.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: ui.text }]} numberOfLines={1}>
          {step === 'province' ? title : province}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      {(step === 'province' || step === 'department') && (
        <View style={[styles.searchBar, { backgroundColor: ui.surface, borderColor: ui.border }]}>
          <Ionicons name="search" size={18} color={ui.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={step === 'province' ? 'Buscar provincia' : 'Buscar departamento'}
            placeholderTextColor={ui.textMuted}
            style={[styles.searchInput, { color: ui.text }]}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={ui.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* No todo lo que la gente escribe está en la lista (localidades chicas, barrios,
          nombres que no coinciden con el departamento oficial). Sin esto quedaban trabados
          si su lugar no figuraba. */}
      {search.trim().length > 0 && step === 'province' && (
        <TouchableOpacity
          style={[styles.useTypedRow, { borderColor: ui.border }]}
          onPress={() => handleProvince(search.trim())}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={18} color={ui.text} />
          <Text style={[styles.useTypedText, { color: ui.text }]} numberOfLines={1}>
            Usar "{search.trim()}" como provincia
          </Text>
        </TouchableOpacity>
      )}
      {search.trim().length > 0 && step === 'department' && (
        <TouchableOpacity
          style={[styles.useTypedRow, { borderColor: ui.border }]}
          onPress={() => finish(search.trim())}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={18} color={ui.text} />
          <Text style={[styles.useTypedText, { color: ui.text }]} numberOfLines={1}>
            Usar "{search.trim()}" como ciudad
          </Text>
        </TouchableOpacity>
      )}

      {(step === 'province' || step === 'loading') && (
        <FlatList
          data={provinces}
          keyExtractor={(item) => item}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={provinces.length}
          maxToRenderPerBatch={provinces.length}
          windowSize={5}
          renderItem={({ item }) =>
            renderGridItem(PROVINCE_IMAGES[item], item, province === item, () => handleProvince(item))
          }
        />
      )}

      {step === 'loading' && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={ui.text} />
        </View>
      )}

      {step === 'department' && (
        <FlatList
          data={depts}
          keyExtractor={(item) => item.key}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={depts.length}
          maxToRenderPerBatch={depts.length}
          windowSize={5}
          ListHeaderComponent={
            <TouchableOpacity
              style={[styles.deptAllItem, { backgroundColor: ui.surface, borderColor: ui.border }]}
              onPress={() => finish('')}
              activeOpacity={0.75}
            >
              <Ionicons name="grid-outline" size={28} color={ui.textMuted} style={{ marginBottom: 6 }} />
              <Text style={[styles.gridLabel, { color: ui.textMuted }]}>Todos los departamentos</Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) =>
            renderGridItem(item.image, item.label, city === item.label, () => finish(item.label))
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  headerBtn: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: 'Sora_700Bold', fontSize: 20, letterSpacing: -0.5, textAlign: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 4,
    paddingHorizontal: 14, height: 44,
    borderRadius: 999, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Sora_400Regular', padding: 0 },
  useTypedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 999, borderWidth: 1, borderStyle: 'dashed',
  },
  useTypedText: { flex: 1, fontSize: 13, fontFamily: 'Sora_500Medium' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  gridItem: { borderRadius: 24, borderWidth: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 10 },
  gridImage: { width: 96, height: 96, marginBottom: 10 },
  gridLabel: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  deptAllItem: { marginHorizontal: 16, borderRadius: 24, borderWidth: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, marginBottom: 4 },
});

export default LocationPickerScreen;
