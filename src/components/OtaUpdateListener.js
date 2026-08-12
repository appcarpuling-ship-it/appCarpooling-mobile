import { useEffect, useRef, useState } from 'react';
import { AppState, Modal } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import UpdateRequiredScreen from '../screens/common/UpdateRequiredScreen';
import { navigationRef } from '../navigation/rootNavigation';

/** Lo que se ve la pantalla antes de reiniciar sola: suficiente para leerla, sin ser una espera. */
const PAUSA_ANTES_DE_REINICIAR_MS = 1400;

/**
 * Cada cuánto, como mucho, se le pregunta al servidor si hay update.
 *
 * Se chequea también al navegar, y sin este freno cada toque de pantalla sería una request.
 */
const ESPERA_ENTRE_CHEQUEOS_MS = 20000;

export default function OtaUpdateListener() {
  const [visible, setVisible] = useState(false);
  // Si el reinicio automático falla, se cae al pedido manual de siempre.
  const [manual, setManual] = useState(false);

  const ultimoChequeo = useRef(0);
  const enCurso = useRef(false);
  // En ref y no en estado: el efecto no se resuscribe y los listeners se enganchan una vez.
  const yaEncontrado = useRef(false);

  useEffect(() => {
    // No filtramos por __DEV__: al canal dev también le mandamos OTAs. La guarda real
    // es isEnabled, que expo-updates pone en false donde no hay updates (Expo Go, Metro),
    // que es justo donde checkForUpdateAsync tiraría.
    if (!Updates.isEnabled) return undefined;

    let cancelled = false;
    let timer;

    /**
     * Se chequea al arrancar, al volver del fondo y al navegar.
     *
     * Antes era sólo al montar el bundle, o sea únicamente arrancando la app desde cero. Como
     * uno casi siempre vuelve desde el fondo en vez de matarla, el chequeo no corría nunca y
     * el update quedaba esperando. Encima con `fallbackToCacheTimeout: 0` el arranque usa
     * SIEMPRE el bundle guardado, así que sin este reload el cambio recién aparecía en la
     * apertura siguiente y parecía que el OTA no había salido.
     */
    const revisar = async () => {
      if (cancelled || enCurso.current || yaEncontrado.current) return;
      if (Date.now() - ultimoChequeo.current < ESPERA_ENTRE_CHEQUEOS_MS) return;

      enCurso.current = true;
      ultimoChequeo.current = Date.now();
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        yaEncontrado.current = true;
        setVisible(true);

        timer = setTimeout(async () => {
          try {
            await Updates.reloadAsync();
          } catch {
            if (!cancelled) setManual(true);
          }
        }, PAUSA_ANTES_DE_REINICIAR_MS);
      } catch {
        /* sin red, sin ruido */
      } finally {
        enCurso.current = false;
      }
    };

    revisar();

    const subApp = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') revisar();
    });

    // Al navegar. El freno de arriba hace que esto no sea una request por pantalla.
    // Con espera: este componente monta antes de que el navegador esté listo, y engancharse
    // en ese momento no serviría de nada.
    let subNav = null;
    const engancheNav = setTimeout(() => {
      if (!cancelled && navigationRef.isReady()) subNav = navigationRef.addListener('state', revisar);
    }, 2000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearTimeout(engancheNav);
      subApp.remove();
      if (subNav) subNav();
    };
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
