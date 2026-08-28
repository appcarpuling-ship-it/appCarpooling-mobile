import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUI } from '../../theme/ui';

/**
 * Se muestra cuando ya se descargó un OTA nuevo.
 *
 * NO tiene botón de "Actualizar ahora". Lo tuvo: llamaba a `Updates.reloadAsync()` para no
 * depender de que el sistema matara el proceso —en Samsung con gestión de batería agresiva,
 * cerrar desde recientes no siempre lo mata y el cartel volvía en bucle—. Pero al recargar,
 * la app quedaba en NEGRO en vez de volver a arrancar, que es bastante peor que el bucle:
 * el bucle se sale cerrando bien la app, la pantalla negra no se sale con nada.
 *
 * Así que el reinicio queda en manos de la persona, y lo que sí se puede hacer desde acá es
 * explicarle exactamente cómo: no "cerrá la app", sino deslizarla fuera de la lista de
 * aplicaciones abiertas, que es lo que de verdad la mata.
 *
 * Sigue sin salida: sin X y sin gesto de atrás. La versión nueva ya está descargada; seguir
 * con la vieja sería quedarse con una app que ya sabemos desactualizada.
 */
const UpdateRequiredScreen = () => {
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
          Ya descargamos la última versión de Carpuling. Cerrá la app y abrila para actualizarla.
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
