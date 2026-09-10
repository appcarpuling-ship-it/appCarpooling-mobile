import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Fila de fecha u hora para web. @react-native-community/datetimepicker no corre en web,
 * así que se usa el <input type="date|time"> nativo del navegador — que además devuelve
 * exactamente el formato que espera el backend ('YYYY-MM-DD' y 'HH:MM'), sin conversiones.
 *
 * @param {'date'|'time'} mode
 * @param {string}   value     'YYYY-MM-DD' | 'HH:MM' | ''
 * @param {Function} onChange  (str) => void
 * @param {string}   [min]     sólo date: 'YYYY-MM-DD' mínimo seleccionable
 * @param {string}   icon      nombre de Ionicon
 * @param {boolean}  [isLast]  saca el borde inferior
 * @param {object}   colors    { textPrimary, textMuted, divider, isDark }
 */
export default function DateTimeRow({ mode, value, onChange, min, icon, isLast, colors }) {
  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
      ]}
    >
      <Ionicons name={icon} size={19} color={colors.textPrimary} />
      {React.createElement('input', {
        type: mode,
        value: value || '',
        min: mode === 'date' ? min : undefined,
        onChange: (e) => onChange(e.target.value),
        style: {
          flex: 1,
          marginLeft: 12,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 15,
          fontFamily: 'Sora_400Regular',
          color: value ? colors.textPrimary : colors.textMuted,
          colorScheme: colors.isDark ? 'dark' : 'light',
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
});
