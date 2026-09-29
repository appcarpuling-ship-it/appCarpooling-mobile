import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import { useScreenWidth } from '../../hooks/useScreenWidth';
import PillButton from '../ui/PillButton';
import { navigationRef } from '../../navigation/rootNavigation';

/**
 * La guía enseña cómo funciona Carpuling, no sólo dónde están los botones. Cada paso es una idea:
 * un título, una línea, y a lo sumo tres filas cortas (`rows`). Van agrupados por `seccion`
 * (el rótulo de arriba del título) para que se note cuándo se pasa de "pasajero" a "conductor".
 *
 * `tabNav` lleva la app de fondo a una pantalla que tenga que ver con lo que se explica.
 */
const HOME = { tab: 'HomeTab', screen: 'Home' };
const TRASLADOS = { tab: 'CarpoolingsTab', screen: 'Carpoolings' };
const HISTORIAL = { tab: 'HistoryTab', screen: 'History' };
const PERFIL = { tab: 'ProfileTab', screen: 'Profile' };

const STEPS = [
  {
    key: 'welcome',
    showLogo: true,
    title: 'Viajá compartiendo',
    body: 'Carpuling conecta a quien viaja entre ciudades con quien ya va para el mismo lado. En un minuto te mostramos cómo funciona.',
    tabNav: HOME,
  },
  {
    key: 'concepto',
    seccion: 'Qué es Carpuling',
    icon: 'people',
    title: 'No es un taxi',
    body: 'Es carpooling: compartir un viaje que alguien ya iba a hacer.',
    rows: [
      { icon: 'car-outline', t: 'Un conductor va de una ciudad a otra y le sobran asientos.' },
      { icon: 'person-add-outline', t: 'Vos ocupás uno y aportás para los gastos: nafta y peajes.' },
      { icon: 'swap-horizontal-outline', t: 'Nadie te cobra por «llevarte»: se comparte un viaje que ya existe.' },
    ],
    tabNav: HOME,
  },
  {
    key: 'pasajero-reservar',
    seccion: 'Si viajás como pasajero',
    icon: 'search',
    title: 'Buscá y reservá',
    rows: [
      { icon: 'search-outline', t: 'Elegí origen, destino y día. Vas a ver los viajes publicados.' },
      { icon: 'shield-checkmark-outline', t: 'Mirá al conductor antes: reseñas, DNI verificado y su vehículo.' },
      { icon: 'hand-right-outline', t: 'Tocá «Reservar» para pedirle lugar. Todavía no está confirmado.' },
    ],
    tabNav: HOME,
  },
  {
    key: 'pasajero-despues',
    seccion: 'Si viajás como pasajero',
    icon: 'checkmark-circle',
    title: 'Y después de reservar',
    rows: [
      { icon: 'time-outline', t: 'El conductor recibe tu pedido y lo acepta o lo rechaza.' },
      { icon: 'notifications-outline', t: 'Te avisamos apenas responde. Lo seguís en «Traslados».' },
      { icon: 'chatbubbles-outline', t: 'Con el viaje aceptado, chateás con él para coordinar el punto de encuentro.' },
    ],
    tabNav: TRASLADOS,
  },
  {
    key: 'sena',
    seccion: 'Si viajás como pasajero',
    icon: 'shield-checkmark',
    title: 'La seña, si el conductor la pide',
    body: 'Algunos conductores piden adelantar la mitad del precio para asegurar el lugar.',
    rows: [
      { icon: 'swap-horizontal-outline', t: 'Se la transferís directo a él, a su alias o CVU. Carpuling no la toca.' },
      { icon: 'camera-outline', t: 'Subís la captura del comprobante en la reserva.' },
      { icon: 'checkmark-done-outline', t: 'Tu lugar es tuyo cuando el conductor confirma que le llegó. Hasta ahí no está asegurado.' },
    ],
    tabNav: TRASLADOS,
  },
  {
    key: 'solicitudes',
    seccion: 'Si no encontrás viaje',
    icon: 'megaphone',
    illustration: require('../../../assets/illustrations/tutorial-requests.png'),
    title: 'Pedilo vos',
    body: 'Si no hay un viaje que te sirva, publicá a dónde querés ir.',
    rows: [
      { icon: 'people-outline', t: 'Hasta 5 conductores se postulan con su precio y su vehículo.' },
      { icon: 'git-compare-outline', t: 'Comparás las propuestas y aceptás la que más te convenga.' },
      { icon: 'flag-outline', t: 'Recién al aceptar se arma el viaje y tu reserva.' },
    ],
    tabNav: HOME,
  },
  {
    key: 'conductor-publicar',
    seccion: 'Si manejás',
    icon: 'car',
    title: 'Publicá tu viaje',
    rows: [
      { icon: 'map-outline', t: 'Marcá tu ruta en el mapa, con las paradas que quieras.' },
      { icon: 'speedometer-outline', t: 'Elegí tu vehículo, cuántos asientos ofrecés y el día y la hora.' },
      { icon: 'cash-outline', t: 'Poné cuánto cobra cada pasajero, o elegí «Gastos compartidos» y lo arreglás con ellos.' },
    ],
    tabNav: TRASLADOS,
  },
  {
    key: 'conductor-gestionar',
    seccion: 'Si manejás',
    icon: 'clipboard',
    title: 'Tus pasajeros',
    rows: [
      { icon: 'person-outline', t: 'Cada pedido te llega con el perfil del pasajero: aceptás o rechazás.' },
      { icon: 'shield-checkmark-outline', t: 'Si pedís seña, mirá tu banco y confirmá cuando te llegue. Si no está, tocá «No me llegó».' },
      { icon: 'play-circle-outline', t: 'Al salir, iniciás el viaje. Al llegar, lo completás.' },
    ],
    tabNav: TRASLADOS,
  },
  {
    key: 'vehiculos',
    seccion: 'Tu vehículo',
    icon: 'document-text',
    title: 'Tu auto, en regla',
    body: 'Te pedimos los datos y los papeles para que los pasajeros sepan que viajan bien.',
    rows: [
      { icon: 'camera-outline', t: 'Fotos, patente y capacidad: es lo que ve el pasajero antes de reservar.' },
      { icon: 'document-attach-outline', t: 'Seguro, VTV y cédula verde: cargalos y mantenelos vigentes.' },
      { icon: 'alert-circle-outline', t: 'Te avisamos antes del vencimiento. Con la documentación al día, tus viajes se muestran primero y con una insignia.' },
    ],
    tabNav: PERFIL,
  },
  {
    key: 'pagos',
    seccion: 'Los pagos',
    icon: 'wallet',
    title: 'Tres plata distintas',
    body: 'Nunca se mezclan entre sí.',
    rows: [
      { icon: 'car-outline', t: 'El viaje: el pasajero le paga directo al conductor, en efectivo o transferencia.' },
      { icon: 'shield-checkmark-outline', t: 'La seña: si el conductor la pide, es la mitad del viaje y va también directo a él.' },
      { icon: 'receipt-outline', t: 'Carpuling: le cobra al conductor un monto fijo por cada asiento ocupado, al completar el viaje.' },
    ],
    tabNav: PERFIL,
  },
  {
    key: 'saldo',
    seccion: 'Los pagos',
    icon: 'card',
    title: 'El saldo del conductor',
    body: 'El pasajero nunca paga nada a Carpuling.',
    rows: [
      { icon: 'add-circle-outline', t: 'Cuando completás un viaje, se suma lo que corresponde a los asientos ocupados.' },
      { icon: 'card-outline', t: 'Lo pagás desde Perfil → Mi saldo.' },
      { icon: 'lock-closed-outline', t: 'Si se acumula mucho, no podés publicar viajes nuevos hasta saldarlo.' },
    ],
    tabNav: PERFIL,
  },
  {
    key: 'confianza',
    seccion: 'Seguridad y confianza',
    icon: 'heart',
    title: 'Viajar tranquilo',
    rows: [
      { icon: 'id-card-outline', t: 'Perfiles con DNI y, para conducir, licencia verificados.' },
      { icon: 'star-outline', t: 'Al terminar, ambos se califican. Es obligatorio y es lo que cuida a la comunidad.' },
      { icon: 'chatbubble-ellipses-outline', t: 'Hablá siempre por el chat de la app y coordiná el punto de encuentro antes de salir.' },
      { icon: 'flag-outline', t: 'Si algo no está bien, reportá o bloqueá al usuario desde su perfil.' },
    ],
    tabNav: HISTORIAL,
  },
  {
    key: 'tabs',
    seccion: 'Listo',
    icon: 'apps',
    illustration: require('../../../assets/illustrations/tutorial-tabs.png'),
    title: 'Todo desde la barra de abajo',
    body: 'Inicio para buscar y publicar, Traslados para tus reservas y viajes, Historial para lo ya hecho y Perfil para tu cuenta, vehículos y saldo. Esta guía la podés volver a ver desde Perfil.',
    tabNav: HOME,
  },
];

const AppTutorialOverlay = ({ onComplete }) => {
  const SCREEN_W = useScreenWidth();
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

          {/* ScrollView por si un paso con filas no entra en una pantalla chica: se lee
              scrolleando en vez de cortarse. Con contenido corto queda centrado, como antes. */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {current.rows ? (
              // Pasos con filas: sólo un ícono chico, para que el espacio sea del texto.
              <View style={[styles.iconChico, { backgroundColor: ui.surface }]}>
                <Ionicons name={current.icon} size={30} color={ui.text} />
              </View>
            ) : (
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
            )}

            {!!current.seccion && (
              <Text style={[styles.seccion, { color: ui.textMuted }]}>{current.seccion.toUpperCase()}</Text>
            )}
            <Text style={[styles.title, { color: ui.text }]}>{current.title}</Text>
            {!!current.body && <Text style={[styles.paragraph, { color: ui.textMuted }]}>{current.body}</Text>}

            {!!current.rows && (
              <View style={styles.rows}>
                {current.rows.map((r) => (
                  <View key={r.t} style={styles.row}>
                    <Ionicons name={r.icon} size={20} color={ui.text} style={styles.rowIcon} />
                    <Text style={[styles.rowText, { color: ui.text }]}>{r.t}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

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
  body:       { flex: 1 },
  bodyContent: { flexGrow: 1, justifyContent: 'center', paddingBottom: 8 },
  iconChico:  { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  seccion:    { fontFamily: 'Sora_600SemiBold', fontSize: 11, letterSpacing: 1.1, marginBottom: 10 },
  rows:       { marginTop: 22, gap: 16 },
  row:        { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  rowIcon:    { marginTop: 1 },
  rowText:    { flex: 1, fontFamily: 'Sora_500Medium', fontSize: 15, lineHeight: 22 },
  // Elástico: el paso de "Solicitudes" tiene un texto largo y con alto fijo
  // desbordaba en pantallas chicas. El ícono cede el espacio que pide el texto.
  iconWrap:   { flex: 1, maxHeight: 260, minHeight: 110, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  logoImage:  { width: 96, height: 96 },
  illustrationImage: { width: '80%', height: '80%' },
  title:      { fontFamily: 'Sora_800ExtraBold', fontSize: 30, lineHeight: 37, letterSpacing: -1 },
  paragraph:  { fontFamily: 'Sora_400Regular', fontSize: 15, lineHeight: 23, marginTop: 14 },
  dots:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  dot:        { width: 6, height: 6, borderRadius: 999 },
  dotActive:  { width: 22 },
  footer:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back:       { width: 58, height: 58, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  cta:        { flex: 1 },
});

export default AppTutorialOverlay;
