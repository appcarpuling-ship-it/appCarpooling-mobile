import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';

// Botón pill del rediseño: barra ancha con los chevrons ">>>" y, opcional,
// un círculo separado al costado (el patrón que se repite en las referencias).
const PillButton = ({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary', // 'primary' = alto contraste | 'surface' = gris
  chevrons = true,
  trailingIcon,        // nombre de Ionicon -> renderiza el círculo aparte
  onTrailingPress,
  style,
}) => {
  const ui = useUI();
  const isPrimary = variant === 'primary';
  const bg = isPrimary ? ui.invertBg : ui.surface;
  const fg = isPrimary ? ui.invertText : ui.text;
  const off = disabled || loading;

  return (
    <View style={[styles.row, style]}>
      <TouchableOpacity
        style={[styles.pill, { backgroundColor: bg }, off && styles.off]}
        onPress={onPress}
        disabled={off}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: off, busy: loading }}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            <Text style={[styles.label, { color: fg }]}>{label}</Text>
            {chevrons && (
              <View style={styles.chevrons}>
                {[0.35, 0.6, 1].map((opacity, i) => (
                  <Ionicons key={i} name="chevron-forward" size={15} color={fg} style={{ opacity, marginLeft: -5 }} />
                ))}
              </View>
            )}
          </>
        )}
      </TouchableOpacity>

      {trailingIcon && (
        <TouchableOpacity
          style={[styles.circle, { backgroundColor: bg }, off && styles.off]}
          onPress={onTrailingPress || onPress}
          disabled={off}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <Ionicons name={trailingIcon} size={20} color={fg} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill:     { flex: 1, height: 58, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  label:    { fontFamily: 'Sora_600SemiBold', fontSize: 16 },
  chevrons: { flexDirection: 'row', alignItems: 'center', marginLeft: 14 },
  circle:   { width: 58, height: 58, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  off:      { opacity: 0.5 },
});

export default PillButton;
