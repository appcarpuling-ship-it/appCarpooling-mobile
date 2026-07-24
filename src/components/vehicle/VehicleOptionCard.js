import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import { imageForType } from '../../utils/vehicleImage';
import { buildImageUri } from '../../services/apiService';

const FEATURES = [
  { key: 'ac', label: 'A/C', icon: 'snow-outline' },
  { key: 'music', label: 'Música', icon: 'musical-notes-outline' },
  { key: 'luggage', label: 'Equipaje', icon: 'bag-handle-outline' },
  { key: 'pets', label: 'Mascotas', icon: 'paw-outline' },
];

// Tarjeta visual de vehículo compartida entre el picker de "crear viaje"
// (variante grande, dentro del carrusel) y el modal de "ofrecer viaje para
// una solicitud" (variante compacta, en una lista vertical). Sólo presentación:
// quien la usa decide qué pasa al tocarla.
const VehicleOptionCard = ({ vehicle, compact = false, disabledReason = null, onPress }) => {
  const ui = useUI();
  const activeFeatures = FEATURES.filter((f) => vehicle.features?.[f.key]);
  const disabled = !!disabledReason;
  const photos = (vehicle.photos || []).filter(Boolean);

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactRow, { borderColor: ui.border, opacity: disabled ? 0.5 : 1 }]}
        onPress={() => onPress?.(vehicle)}
        activeOpacity={0.75}
      >
        <View style={[styles.compactImageWrap, { backgroundColor: ui.surface }]}>
          <Image source={imageForType(vehicle.type)} style={styles.compactImage} resizeMode="contain" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.compactName, { color: ui.text }]} numberOfLines={1}>
            {vehicle.brand} {vehicle.model} {vehicle.year || ''}
          </Text>
          <Text style={[styles.compactPlate, { color: ui.textMuted }]} numberOfLines={1}>
            {vehicle.color ? `${vehicle.color} · ` : ''}{vehicle.licensePlate}
          </Text>
          {disabled && (
            <Text style={[styles.compactWarning, { color: ui.textMuted }]}>{disabledReason}</Text>
          )}
        </View>
        {!disabled && <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.fullCard}>
      <View style={styles.haloWrap}>
        <View style={[styles.halo, styles.haloOuter, { backgroundColor: ui.surface }]} />
        <View style={[styles.halo, styles.haloInner, { backgroundColor: ui.surface }]} />
        <Image source={imageForType(vehicle.type)} style={styles.fullImage} resizeMode="contain" />
      </View>

      <View style={styles.fullInfoRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fullName, { color: ui.text }]} numberOfLines={1}>
            {vehicle.brand} {vehicle.model}
          </Text>
          <Text style={[styles.fullPlate, { color: ui.textMuted }]} numberOfLines={1}>
            {vehicle.licensePlate}
          </Text>
        </View>
        {vehicle.capacity ? (
          <View style={[styles.capacityChip, { backgroundColor: ui.surface }]}>
            <Text style={[styles.capacityChipText, { color: ui.text }]}>{vehicle.capacity} asientos</Text>
          </View>
        ) : null}
      </View>

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

      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photosRow}
          contentContainerStyle={styles.photosContent}
        >
          {photos.map((photo, i) => (
            <Image
              key={i}
              source={{ uri: buildImageUri(photo) }}
              style={[styles.photoThumb, { backgroundColor: ui.surface }]}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Compact (lista vertical dentro de un modal)
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderRadius: 14, marginBottom: 8 },
  compactImageWrap: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  compactImage: { width: '78%', height: '78%' },
  compactName: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  compactPlate: { fontSize: 12, marginTop: 2 },
  compactWarning: { fontSize: 11, marginTop: 3 },

  // Full (página del carrusel del picker)
  fullCard: { alignItems: 'center', gap: 10 },
  haloWrap: { width: '100%', aspectRatio: 1.3, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  halo: { position: 'absolute', borderRadius: 999 },
  haloOuter: { width: '92%', height: '92%', opacity: 0.5 },
  haloInner: { width: '68%', height: '68%', opacity: 0.9 },
  fullImage: { width: '62%', height: '62%' },
  fullInfoRow: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 8, gap: 12 },
  fullName: { fontSize: 20, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.5 },
  fullPlate: { fontSize: 13, fontFamily: 'Sora_500Medium', marginTop: 2 },
  capacityChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  capacityChipText: { fontSize: 12, fontFamily: 'Sora_600SemiBold' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontFamily: 'Sora_500Medium', fontSize: 12 },
  photosRow: { width: '100%', marginTop: 12 },
  photosContent: { gap: 8, paddingHorizontal: 8 },
  photoThumb: { width: 72, height: 72, borderRadius: 14 },
});

export default VehicleOptionCard;
