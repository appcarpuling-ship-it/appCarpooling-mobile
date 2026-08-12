import { useEffect, useState } from 'react';
import { Modal } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import UpdateRequiredScreen from '../screens/common/UpdateRequiredScreen';

/** Lo que se ve la pantalla antes de reiniciar sola: suficiente para leerla, sin ser una espera. */
const PAUSA_ANTES_DE_REINICIAR_MS = 1400;

export default function OtaUpdateListener() {
  const [visible, setVisible] = useState(false);
  // Si el reinicio automático falla, se cae al pedido manual de siempre.
  const [manual, setManual] = useState(false);

  useEffect(() => {
    // No filtramos por __DEV__: al canal dev también le mandamos OTAs. La guarda real
    // es isEnabled, que expo-updates pone en false donde no hay updates (Expo Go, Metro),
    // que es justo donde checkForUpdateAsync tiraría.
    if (!Updates.isEnabled) return;

    let cancelled = false;
    let timer;

    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        setVisible(true);

        // Se aplica solo. Antes esta pantalla pedía cerrar y volver a abrir la app, y ese
        // paso manual se perdía todo el tiempo: con fallbackToCacheTimeout en 0 el arranque
        // usa SIEMPRE el bundle guardado, así que quien no cerraba del todo seguía viendo la
        // versión anterior y creía que el cambio no había salido.
        timer = setTimeout(async () => {
          try {
            await Updates.reloadAsync();
          } catch {
            if (!cancelled) setManual(true);
          }
        }, PAUSA_ANTES_DE_REINICIAR_MS);
      } catch {
        /* sin red, sin ruido */
      }
    })();

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  // Modal opaco (sin transparent) = pantalla completa. Sin onRequestClose, el back
  // de Android tampoco la saca mientras se aplica el update.
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      {/* El Modal abre una ventana nativa aparte: necesita su propio provider
          para medir los insets de esta ventana (mismo caso que en HomeScreen). */}
      <SafeAreaProvider>
        <UpdateRequiredScreen manual={manual} />
      </SafeAreaProvider>
    </Modal>
  );
}
