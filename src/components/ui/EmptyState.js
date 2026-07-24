import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';

// Bloque reutilizable para listas vacías: imagen o ícono + título + subtítulo,
// con acción opcional. Reemplaza los bloques "a mano" repetidos en cada pantalla.
const EmptyState = ({ image, icon = 'file-tray-outline', title, subtitle, actionLabel, onAction, style }) => {
  const ui = useUI();

  return (
    <View style={[styles.container, style]}>
      {image ? (
        <Image source={image} style={styles.image} resizeMode="contain" />
      ) : (
        <Ionicons name={icon} size={40} color={ui.textMuted} />
      )}
      <Text style={[styles.title, { color: ui.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: ui.textMuted }]}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: ui.invertBg }]}
          onPress={onAction}
          activeOpacity={0.85}
        >
          <Text style={[styles.actionLabel, { color: ui.invertText }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 24 },
  image: { width: 140, height: 140 },
  title: { fontSize: 17, fontFamily: 'Sora_600SemiBold', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  actionBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  actionLabel: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
});

export default EmptyState;
