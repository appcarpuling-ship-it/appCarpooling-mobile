import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import PillButton from '../ui/PillButton';
import { navigationRef } from '../../navigation/rootNavigation';

const STEPS = [
  {
    key: 'welcome',
    showLogo: true,
    title: '¡Bienvenido a Carpuling!',
    body: 'En unos pasos te contamos cómo moverte por la app: buscar o publicar un viaje, verificar tu identidad y usar el chat con confianza.',
    tabNav: { tab: 'HomeTab', screen: 'Home' },
  },
  {
    key: 'home',
    icon: 'home',
    illustration: require('../../../assets/illustrations/tutorial-home.png'),
    title: 'Inicio',
    body: 'Buscá por origen y destino, o mirá directo los próximos viajes cerca tuyo. Antes de reservar, revisá el perfil del conductor: sus reseñas y si tiene el DNI verificado.',
    tabNav: { tab: 'HomeTab', screen: 'Home' },
  },
  {
    key: 'requests',
    icon: 'megaphone',
    illustration: require('../../../assets/illustrations/tutorial-requests.png'),
    title: 'Solicitudes de viaje',
    body: 'Si no encontrás un viaje que te sirva, pedilo vos: tocá «Solicitudes» en Inicio, publicá a dónde querés ir y esperá que un conductor se postule. Vos elegís con cuál viajar.',
    tabNav: { tab: 'HomeTab', screen: 'Home' },
  },
  {
    key: 'carpool',
    icon: 'car',
    illustration: require('../../../assets/illustrations/tutorial-carpool.png'),
    title: 'Traslados',
    body: 'Acá administrás todo lo tuyo, separado por rol: como conductor tus viajes publicados y las reservas que te piden, y como pasajero tus reservas y postulaciones.',
    tabNav: { tab: 'CarpoolingsTab', screen: 'Carpoolings' },
  },
  {
    key: 'assistant',
    icon: 'chatbubble-ellipses',
    title: 'Asistente',
    body: 'Rumbo es un asistente que responde dudas sobre cómo funciona la app, tus reservas o tarifas, a cualquier hora. Escribile como a un chat.',
    tabNav: { tab: 'AssistantTab', screen: 'Assistant' },
  },
  {
    key: 'history',
    icon: 'time',
    // No hay ilustración propia para Historial todavía; se reusa la de Viajes
    // compartidos por ser la más cercana en tema. Cambiar si se genera una.
    illustration: require('../../../assets/illustrations/tutorial-carpool.png'),
    title: 'Historial',
    body: 'Todo lo que ya viajaste, como conductor o pasajero. Cuando termina un viaje tenés que calificarlo: es obligatorio, y es lo que mantiene confiable a toda la comunidad.',
    tabNav: { tab: 'HistoryTab', screen: 'History' },
  },
  {
    key: 'profile',
    icon: 'person',
    illustration: require('../../../assets/illustrations/tutorial-profile.png'),
    title: 'Perfil',
    body: 'Cargá tu DNI y, si vas a manejar, tu licencia de conducir: sin eso no podés publicar viajes. También administrás tus vehículos, notificaciones y podés volver a ver esta guía cuando quieras.',
    tabNav: { tab: 'ProfileTab', screen: 'Profile' },
  },
  {
    key: 'tabs',
    icon: 'apps',
    illustration: require('../../../assets/illustrations/tutorial-tabs.png'),
    title: 'Navegación inferior',
    body: 'Usá los botones de abajo para cambiar de sección en cualquier momento. ¡Ya estás listo para usar Carpuling!',
    tabNav: { tab: 'HomeTab', screen: 'Home' },
  },
];

const { width: SCREEN_W } = Dimensions.get('window');

const AppTutorialOverlay = ({ onComplete }) => {
  const insets = useSafeAreaInsets();
  const insetTop = insets.top || initialWindowMetrics?.insets.top || 0;
  const insetBottom = insets.bottom || initialWindowMetrics?.insets.bottom || 0;
  const ui = useUI();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const cfg = STEPS[step]?.tabNav;
    if (!cfg?.tab || !cfg?.screen) return;
    const id = requestAnimationFrame(() => {
      if (!navigationRef.isReady()) return;
      try {
        navigationRef.navigate('Main', {
          screen: cfg.tab,
          params: { screen: cfg.screen },
        });
      } catch {
        /* noop */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [step]);

  const total = STEPS.length;
  const isLast = step === total - 1;
  const current = STEPS[step];

  const goNext = useCallback(() => {
    if (isLast) {
      onComplete();
      return;
    }
    setStep((s) => Math.min(s + 1, total - 1));
  }, [isLast, onComplete, total]);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const padH = Math.max(20, SCREEN_W * 0.06);

  // El logo del paso de bienvenida se invierte con el tema: sobre fondo claro
  // el blanco desaparecía.
  const LOGO = ui.isDarkMode
    ? require('../../../assets/logo/192x192-white.png')
    : require('../../../assets/logo/192x192-black.png');

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={() => undefined}
    >
      <View style={[styles.backdrop, { backgroundColor: ui.bg }]}>
        {/* En Modal, SafeAreaView a veces no aplica bien en iOS: insets manuales (Dynamic Island / notch) */}
        <View
          style={[
            styles.safe,
            {
              paddingTop: insetTop + 14,
              paddingBottom: Math.max(insetBottom, 12) + 10,
              paddingHorizontal: padH,
            },
          ]}
        >
          <View style={styles.topBar}>
            <Text style={[styles.stepLabel, { color: ui.textMuted }]} numberOfLines={1}>
              Paso {step + 1} de {total}
            </Text>
            <TouchableOpacity
              onPress={onComplete}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Saltar la guía"
            >
              <Text style={[styles.skip, { color: ui.textMuted }]}>Saltar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={[styles.iconWrap, { backgroundColor: ui.surface }]}>
              {current.showLogo ? (
                <Image
                  source={LOGO}
                  style={styles.logoImage}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              ) : current.illustration ? (
                <Image
                  // key por paso: fuerza remount para que RN refresque el source al pasar de paso.
                  key={current.key}
                  source={current.illustration}
                  style={styles.illustrationImage}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons name={current.icon} size={96} color={ui.text} />
              )}
            </View>

            <Text style={[styles.title, { color: ui.text }]}>{current.title}</Text>
            <Text style={[styles.paragraph, { color: ui.textMuted }]}>{current.body}</Text>
          </View>

          <View style={styles.dots}>
            {STEPS.map((s, i) => (
              <View
                key={s.key}
                style={[
                  styles.dot,
                  { backgroundColor: i === step ? ui.text : ui.border },
                  i === step && styles.dotActive,
                ]}
              />
            ))}
          </View>

          <View style={styles.footer}>
            {step > 0 && (
              <TouchableOpacity
                style={[styles.back, { backgroundColor: ui.surface }]}
                onPress={goBack}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Volver al paso anterior"
              >
                <Ionicons name="chevron-back" size={20} color={ui.text} />
              </TouchableOpacity>
            )}
            {/* Sin trailingIcon: la flecha del círculo repetía los chevrons. */}
            <PillButton
              label={isLast ? '¡Empezar!' : 'Siguiente'}
              onPress={goNext}
              style={styles.cta}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop:   { flex: 1 },
  safe:       { flex: 1 },
  topBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  stepLabel:  { fontFamily: 'Sora_500Medium', fontSize: 14, letterSpacing: 0.2 },
  skip:       { fontFamily: 'Sora_500Medium', fontSize: 15 },
  body:       { flex: 1, justifyContent: 'center' },
  // Elástico: el paso de "Solicitudes" tiene un texto largo y con alto fijo
  // desbordaba en pantallas chicas. El ícono cede el espacio que pide el texto.
  iconWrap:   { flex: 1, maxHeight: 260, minHeight: 110, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  logoImage:  { width: 96, height: 96 },
  illustrationImage: { width: '80%', height: '80%' },
  title:      { fontFamily: 'Sora_800ExtraBold', fontSize: 32, lineHeight: 39, letterSpacing: -1 },
  paragraph:  { fontFamily: 'Sora_400Regular', fontSize: 15, lineHeight: 23, marginTop: 14 },
  dots:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  dot:        { width: 6, height: 6, borderRadius: 999 },
  dotActive:  { width: 22 },
  footer:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back:       { width: 58, height: 58, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  cta:        { flex: 1 },
});

export default AppTutorialOverlay;
