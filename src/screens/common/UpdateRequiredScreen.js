import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUI } from '../../theme/ui';

// Se muestra cuando ya se descargó un OTA nuevo, mientras la app se reinicia sola para
// aplicarlo. A propósito no tiene botones ni forma de salir. `manual` es el plan B: si el
// reinicio automático falla, se le pide al usuario que cierre y abra, como antes.
// Mismo layout que ResultScreen, sin CTA ni close.
const UpdateRequiredScreen = ({ manual = false }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: ui.bg,
          paddingTop: insets.top + 14,
          paddingBottom: Math.max(insets.bottom, 12) + 10,
        },
      ]}
    >
      <View style={styles.body}>
        <View style={styles.illustrationWrap}>
          <View style={[styles.halo, styles.haloOuter, { backgroundColor: ui.surface }]} />
          <View style={[styles.halo, styles.haloInner, { backgroundColor: ui.surface }]} />
          <Image
            source={require('../../../assets/icons/pngwing.com (16).png')}
            style={styles.illustration}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.title, { color: ui.text }]}>Nueva actualización</Text>
        <Text style={[styles.message, { color: ui.textMuted }]}>
          {manual
            ? 'Ya descargamos la última versión de Carpuling. Cerrá la aplicación y volvé a abrirla para empezar a usarla.'
            : 'Ya descargamos la última versión de Carpuling. La estamos aplicando, esto tarda un segundo.'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontFamily: 'Sora_800ExtraBold', fontSize: 28, lineHeight: 34, textAlign: 'center', marginTop: 28 },
  message: { fontFamily: 'Sora_400Regular', fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: 'center' },
  illustrationWrap: { width: '100%', flex: 1, maxHeight: 320, minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', borderRadius: 999 },
  haloOuter: { width: '85%', height: '85%', opacity: 0.5 },
  haloInner: { width: '62%', height: '62%', opacity: 0.9 },
  illustration: { width: '68%', height: '68%' },
});

export default UpdateRequiredScreen;
