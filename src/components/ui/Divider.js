import React from 'react';
import { View, StyleSheet } from 'react-native';
import SoraText from '../SoraText';
import { useColors } from '../../hooks/useColors';
import { textStyles } from '../../theme/tokens';

const Divider = ({ label, style }) => {
  const { colors } = useColors();

  if (label) {
    return (
      <View style={[styles.row, style]}>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <SoraText style={[styles.label, { color: colors.textMuted }]}>{label}</SoraText>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>
    );
  }

  return (
    <View
      style={[styles.simple, { backgroundColor: colors.borderLight }, style]}
    />
  );
};

const styles = StyleSheet.create({
  simple: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  label: {
    ...textStyles.caption,
  },
});

export default Divider;
