import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { useUI } from '../../theme/ui';
import PillButton from '../../components/ui/PillButton';

/**
 * Se muestra cuando ya se descargó un OTA nuevo.
 *
 * La aplica el usuario con el botón, no un temporizador. Reiniciar solo se veía como si la app
 * se cerrara de golpe: si estabas en medio de algo, te lo interrumpía sin haber pedido permiso.
 * El update ya está bajado, así que esperar unos segundos más no cuesta nada.
 *
 * Sin forma de salir a propósito: la pantalla no tiene botón de cerrar ni gesto. Lo único que
 * se puede hacer es aplicar el update, que es lo que uno quiere que pase.
 */
const UpdateRequiredScreen = () => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const [aplicando, setAplicando] = useState(false);
  const [fallo, setFallo] = useState(false);

  const aplicar = async () => {
    setAplicando(true);
    try {
      await Updates.reloadAsync();
    } catch {
      // Si el reinicio no sale, queda el plan B de siempre: cerrar y abrir a mano.
      setAplicando(false);
      setFallo(true);
    }
  };

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
          {fallo
            ? 'No pudimos aplicarla desde acá. Cerrá la aplicación y volvé a abrirla para empezar a usarla.'
            : 'Ya descargamos la última versión de Carpuling. Cuando quieras, aplicala: la app se reinicia y sigue donde estabas.'}
        </Text>
      </View>

      {!fallo && (
        <PillButton
          label="Aplicar y reiniciar"
          onPress={aplicar}
          loading={aplicando}
          style={styles.cta}
        />
      )}
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
  cta: { marginTop: 16 },
});

export default UpdateRequiredScreen;
