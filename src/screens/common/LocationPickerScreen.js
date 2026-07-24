import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, ActivityIndicator, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import { ARGENTINA_PROVINCES } from '../../constants/provinces';
import { PROVINCE_IMAGES } from '../../constants/provinceImages';
import { getDepartmentsForProvince } from '../../constants/departmentImages';

const { width: SCREEN_W } = Dimensions.get('window');
const ITEM_SIZE = (SCREEN_W - 48 - 12) / 2;

// Selector de provincia + ciudad como pantalla (reemplaza el modal que se
// repetía en Home, AllTrips y Solicitudes). El caller navega con:
//   navigation.navigate('LocationPicker', { title, province, city, onSelect })
// y recibe { province, city } al elegir. "Todos" devuelve city ''.
const LocationPickerScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const { title = 'Provincia', province: initialProvince = '', city = '', onSelect } = route.params || {};

  const [step, setStep] = useState(initialProvince ? 'department' : 'province');
  const [province, setProvince] = useState(initialProvince);

  const provinces = ARGENTINA_PROVINCES;
  const depts = getDepartmentsForProvince(province);

  const handleProvince = (p) => {
    setProvince(p);
    setStep('loading');
    setTimeout(() => setStep('department'), 900);
  };

  const finish = (selectedCity) => {
    onSelect?.({ province, city: selectedCity });
    navigation.goBack();
  };

  const goBack = () => {
    if (step === 'department') setStep('province');
    else navigation.goBack();
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
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  gridItem: { borderRadius: 24, borderWidth: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 10 },
  gridImage: { width: 96, height: 96, marginBottom: 10 },
  gridLabel: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  deptAllItem: { marginHorizontal: 16, borderRadius: 24, borderWidth: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, marginBottom: 4 },
});

export default LocationPickerScreen;
