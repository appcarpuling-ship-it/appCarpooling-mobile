import React, { useState, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import PillButton from '../../components/ui/PillButton';

const { width: SCREEN_W } = Dimensions.get('window');

// Una imagen por tipo de vehículo. Hoy todos caen al sedán isométrico; cuando
// lleguen los PNG de pickup/suv se agregan acá (mismo formato, fondo transparente).
const VEHICLE_IMAGES = {
  sedan: require('../../../assets/illustrations/vehicle-sedan.png'),
  hatchback: require('../../../assets/illustrations/vehicle-sedan.png'),
  suv: require('../../../assets/illustrations/vehicle-sedan.png'),
  pickup: require('../../../assets/illustrations/vehicle-sedan.png'),
};
const imageForType = (type) => VEHICLE_IMAGES[type] || VEHICLE_IMAGES.sedan;

const FEATURES = [
  { key: 'ac', label: 'A/C', icon: 'snow-outline' },
  { key: 'music', label: 'Música', icon: 'musical-notes-outline' },
  { key: 'luggage', label: 'Equipaje', icon: 'bag-handle-outline' },
  { key: 'pets', label: 'Mascotas', icon: 'paw-outline' },
];

// Selección de vehículo como pantalla: carrusel con la foto del auto arriba,
// se pasa de auto con swipe o flechas. Devuelve el _id elegido por onSelect.
const VehiclePickerScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const { vehicles = [], selectedId, onSelect } = route.params || {};

  const initialIndex = Math.max(0, vehicles.findIndex((v) => v._id === selectedId));
  const [index, setIndex] = useState(initialIndex);
  const listRef = useRef(null);

  const goTo = (i) => {
    const next = Math.min(Math.max(i, 0), vehicles.length - 1);
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  const confirm = () => {
    const v = vehicles[index];
    if (v) onSelect?.(v._id);
    navigation.goBack();
  };

  const renderItem = ({ item }) => {
    const activeFeatures = FEATURES.filter((f) => item.features?.[f.key]);
    return (
      <View style={[styles.page, { width: SCREEN_W }]}>
        <View style={[styles.imageWrap, { backgroundColor: ui.surface }]}>
          <Image source={imageForType(item.type)} style={styles.carImage} resizeMode="contain" />
        </View>
        <Text style={[styles.name, { color: ui.text }]}>{item.brand} {item.model}</Text>
        <Text style={[styles.plate, { color: ui.textMuted }]}>
          {item.licensePlate}{item.capacity ? `  ·  ${item.capacity} asientos` : ''}
        </Text>
        {activeFeatures.length > 0 && (
          <View style={styles.chips}>
            {activeFeatures.map((f) => (
              <View key={f.key} style={[styles.chip, { backgroundColor: ui.surface }]}>
                <Ionicons name={f.icon} size={13} color={ui.text} />
                <Text style={[styles.chipText, { color: ui.text }]}>{f.label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: ui.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={[styles.headerBtn, { backgroundColor: ui.surface }]}>
          <Ionicons name="arrow-back" size={20} color={ui.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: ui.text }]}>Elegí tu vehículo</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.carousel}>
        {vehicles.length > 1 && index > 0 && (
          <TouchableOpacity style={[styles.arrow, styles.arrowLeft, { backgroundColor: ui.surface }]} onPress={() => goTo(index - 1)} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={ui.text} />
          </TouchableOpacity>
        )}
        <FlatList
          ref={listRef}
          data={vehicles}
          keyExtractor={(v) => v._id}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
        />
        {vehicles.length > 1 && index < vehicles.length - 1 && (
          <TouchableOpacity style={[styles.arrow, styles.arrowRight, { backgroundColor: ui.surface }]} onPress={() => goTo(index + 1)} hitSlop={8}>
            <Ionicons name="chevron-forward" size={22} color={ui.text} />
          </TouchableOpacity>
        )}
      </View>

      {vehicles.length > 1 && (
        <View style={styles.dots}>
          {vehicles.map((v, i) => (
            <View key={v._id} style={[styles.dot, { backgroundColor: i === index ? ui.text : ui.border }, i === index && styles.dotActive]} />
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <PillButton label="Usar este vehículo" onPress={confirm} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 0 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  headerBtn: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: 'Sora_700Bold', fontSize: 20, letterSpacing: -0.5, textAlign: 'center' },

  carousel: { flex: 1, justifyContent: 'center' },
  page: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 10 },
  imageWrap: { width: '100%', aspectRatio: 1.3, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  carImage: { width: '80%', height: '80%' },
  name: { fontFamily: 'Sora_800ExtraBold', fontSize: 24, letterSpacing: -0.5, textAlign: 'center' },
  plate: { fontFamily: 'Sora_500Medium', fontSize: 14, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontFamily: 'Sora_500Medium', fontSize: 12 },

  arrow: { position: 'absolute', zIndex: 2, top: '38%', width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginVertical: 16 },
  dot: { width: 6, height: 6, borderRadius: 999 },
  dotActive: { width: 22 },

  footer: { paddingHorizontal: 24, paddingTop: 8 },
});

export default VehiclePickerScreen;
