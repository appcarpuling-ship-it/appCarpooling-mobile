import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { useUI } from '../../theme/ui';

/**
 * Se muestra cuando ya se descargó un OTA nuevo.
 *
 * Antes no tenía botón: la app no se reiniciaba sola (a los 1400 ms sentía como que se cerraba
 * de golpe) y cerrar y volver a abrir quedaba en manos de la persona. En Android eso rebotaba
 * en Samsung con gestión de batería agresiva: "cerrar y volver a abrir" desde recientes no
 * siempre mata el proceso de verdad, así que la app se reanudaba con el mismo bundle viejo
 * corriendo y el cartel volvía a aparecer en bucle. `Updates.reloadAsync()` recarga el bundle
 * ya descargado sin depender de que el SO haya desalojado el proceso.
 *
 * Sigue sin salida por afuera del botón: sin X y sin gesto de atrás. La versión nueva ya está
 * descargada; seguir usando la vieja sería quedarse con una app que ya sabemos desactualizada.
 */
const UpdateRequiredScreen = () => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const [reloading, setReloading] = useState(false);

  const handleReload = async () => {
    if (reloading) return;
    setReloading(true);
    try {
      await Updates.reloadAsync();
    } catch {
      // Sin red o algo raro del SO: se puede reintentar tocando de nuevo.
      setReloading(false);
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
          Ya descargamos la última versión de Carpuling. Tocá el botón para empezar a usarla.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: ui.invertBg }, reloading && { opacity: 0.7 }]}
        onPress={handleReload}
        disabled={reloading}
        activeOpacity={0.85}
      >
        {reloading
          ? <ActivityIndicator color={ui.invertText} />
          : <Text style={[styles.btnText, { color: ui.invertText }]}>Actualizar ahora</Text>
        }
      </TouchableOpacity>
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
  // Pill, como el resto de los botones de la app.
  btn: { borderRadius: 999, height: 54, justifyContent: 'center', alignItems: 'center' },
  btnText: { fontSize: 16, fontFamily: 'Sora_700Bold' },
});

export default UpdateRequiredScreen;
