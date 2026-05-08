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
import useColors from '../../hooks/useColors';
import { navigationRef } from '../../navigation/rootNavigation';

const STEPS = [
  {
    key: 'welcome',
    showLogo: true,
    title: '¡Bienvenido a Carpuling!',
    body: 'En unos pasos te contamos cómo moverte por la app para buscar viajes, chatear y gestionar tu perfil.',
    tabNav: { tab: 'HomeTab', screen: 'Home' },
  },
  {
    key: 'home',
    icon: 'home',
    title: 'Inicio',
    body: 'Desde acá podés explorar la app, ver novedades y buscar viajes que se ajusten a tu ruta y fecha.',
    tabNav: { tab: 'HomeTab', screen: 'Home' },
  },
  {
    key: 'carpool',
    icon: 'car',
    title: 'Viajes compartidos',
    body: 'En este ícono vas a ver y administrar tus carpools: los que ofrecés y a los que te sumás como pasajero.',
    tabNav: { tab: 'CarpoolingsTab', screen: 'Carpoolings' },
  },
  {
    key: 'chat',
    icon: 'chatbubbles',
    title: 'Mensajes',
    body: 'Coordiná con conductores y pasajeros. Tus conversaciones aparecen acá, con aviso cuando hay mensajes nuevos.',
    tabNav: { tab: 'ChatsTab', screen: 'Chats' },
  },
  {
    key: 'profile',
    icon: 'person',
    title: 'Perfil',
    body: 'Editá tus datos, vehículos, notificaciones y preferencias. Cuando quieras, podés volver a ver esta guía desde tu perfil.',
    tabNav: { tab: 'ProfileTab', screen: 'Profile' },
  },
  {
    key: 'tabs',
    icon: 'apps',
    title: 'Navegación inferior',
    body: 'Usá los cuatro botones de abajo para cambiar de sección en cualquier momento. ¡Ya estás listo para usar Carpuling!',
    tabNav: { tab: 'HomeTab', screen: 'Home' },
  },
];

const { width: SCREEN_W } = Dimensions.get('window');

const AppTutorialOverlay = ({ onComplete }) => {
  const insets = useSafeAreaInsets();
  const insetTop = insets.top || initialWindowMetrics?.insets.top || 0;
  const insetBottom = insets.bottom || initialWindowMetrics?.insets.bottom || 0;
  const { colors, fontFamily, isDarkMode } = useColors();
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

  const muted = colors.textMuted || (isDarkMode ? '#9CA3AF' : '#6B7280');

  const padH = Math.max(20, SCREEN_W * 0.06);

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={() => undefined}
    >
      <View style={[styles.backdrop, { backgroundColor: '#000000' }]}>
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
            <Text
              style={[styles.stepLabel, { color: muted, fontFamily: fontFamily.medium }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              Paso {step + 1} de {total}
            </Text>
          </View>

          <View style={styles.body}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.2)',
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.35)',
                },
              ]}
            >
              {current.showLogo ? (
                <Image
                  source={require('../../../assets/logo/192x192-white.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <Ionicons name={current.icon} size={48} color="#FFFFFF" />
              )}
            </View>
            <Text style={[styles.title, { fontFamily: fontFamily.bold }]}>{current.title}</Text>
            <Text style={[styles.paragraph, { color: 'rgba(255,255,255,0.88)', fontFamily: fontFamily.regular }]}>
              {current.body}
            </Text>
          </View>

          <View style={styles.dots}>
            {STEPS.map((s, i) => (
              <View
                key={s.key}
                style={[
                  styles.dot,
                  { backgroundColor: i === step ? '#FFFFFF' : 'rgba(255,255,255,0.28)' },
                  i === step && styles.dotActive,
                ]}
              />
            ))}
          </View>

          <View style={styles.footer}>
            <View style={styles.footerInner}>
              {step > 0 ? (
                <View style={styles.footerButtonRow}>
                  <TouchableOpacity
                    style={styles.btnGhost}
                    onPress={goBack}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Volver al paso anterior"
                  >
                    <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
                    <Text style={[styles.btnGhostText, { fontFamily: fontFamily.semiBold }]}>Atrás</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnPrimary, styles.btnPrimaryInRow]}
                    onPress={goNext}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel={isLast ? 'Empezar a usar la app' : 'Siguiente paso'}
                  >
                    <Text style={[styles.btnPrimaryText, { fontFamily: fontFamily.semiBold }]}>
                      {isLast ? '¡Empezar!' : 'Siguiente'}
                    </Text>
                    {!isLast ? <Ionicons name="arrow-forward" size={18} color="#111827" style={styles.btnIcon} /> : null}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={goNext}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={isLast ? 'Empezar a usar la app' : 'Siguiente paso'}
                >
                  <Text style={[styles.btnPrimaryText, { fontFamily: fontFamily.semiBold }]}>
                    {isLast ? '¡Empezar!' : 'Siguiente'}
                  </Text>
                  {!isLast ? <Ionicons name="arrow-forward" size={18} color="#111827" style={styles.btnIcon} /> : null}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginBottom: 4,
  },
  stepLabel: {
    fontSize: 14,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 104,
    height: 104,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 26,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 32,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 22,
    borderRadius: 4,
  },
  footer: {
    paddingTop: 12,
    alignItems: 'center',
    width: '100%',
  },
  footerInner: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  footerButtonRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    width: '100%',
  },
  btnGhost: {
    flex: 0.95,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.42)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    minHeight: 52,
    gap: 4,
  },
  btnGhostText: {
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    width: '100%',
    minHeight: 52,
  },
  btnPrimaryInRow: {
    flex: 1.25,
    width: undefined,
    paddingHorizontal: 20,
  },
  btnPrimaryText: {
    fontSize: 17,
    color: '#111827',
  },
  btnIcon: {
    marginLeft: 8,
  },
});

export default AppTutorialOverlay;
