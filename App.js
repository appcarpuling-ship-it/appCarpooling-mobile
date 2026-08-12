import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { TutorialProvider } from './src/context/TutorialContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { AlertProvider } from './src/context/AlertContext';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/rootNavigation';
import PushNotificationRouter from './src/components/PushNotificationRouter';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { soraFonts } from './src/theme/typography';
import { useUI } from './src/theme/ui';
import { Linking, View, Text, StyleSheet, Platform } from 'react-native';
import NativeCheckout from './src/components/payment/NativeCheckout';
import AnimatedSplash from './src/components/AnimatedSplash';
import OtaUpdateListener from './src/components/OtaUpdateListener';
import PendingReviewGate from './src/components/PendingReviewGate';
import { initSentry } from './src/utils/sentry';

initSentry();

// Forzar Sora como fuente por defecto en todos los Text de la app
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = { fontFamily: 'Sora_400Regular' };

// Componente interno para manejar el StatusBar que responde al tema
const AppWithTheme = () => {
  const { useTheme } = require('./src/context/ThemeContext');
  let isDarkMode = false;

  try {
    const theme = useTheme();
    isDarkMode = theme.isDarkMode;
  } catch (error) {
    // Si falla, usar modo claro por defecto
    isDarkMode = false;
  }

  const ui = useUI();

  // Sin theme propio, React Navigation pinta su fondo por defecto
  // (rgb(242,242,242)), que asomaba como una banda gris alrededor de la barra
  // inferior y en cualquier hueco entre pantallas.
  const base = isDarkMode ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: ui.bg },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <AppNavigator />
      <PushNotificationRouter />
    </NavigationContainer>
  );
};

export default function App() {
  // Ionicons va acá y no se autocarga: en Android (nueva arquitectura) los
  // iconos se dibujaban como cuadraditos hasta que la fuente terminaba sola.
  const [fontsLoaded] = useFonts({ ...soraFonts, ...Ionicons.font });
  const [showSplash, setShowSplash] = useState(true);
  const [deviceBlocked, setDeviceBlocked] = useState(false);
  // useEffect(() => {
  //   if (Platform.OS !== 'web') {
  //     const JailMonkey = require('jail-monkey').default;
  //     if (JailMonkey.isJailBroken()) {
  //       setDeviceBlocked(true);
  //     }
  //   }
  // }, []);

  // Deep links de MercadoPago
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith('carpooling://')) {
        NativeCheckout.handleDeepLink(url);
      }
    });

    const subscription = Linking.addEventListener('url', (event) => {
      if (event.url && event.url.startsWith('carpooling://')) {
        NativeCheckout.handleDeepLink(event.url);
      }
    });

    return () => subscription.remove();
  }, []);

  if (deviceBlocked) {
    return (
      <View style={blockedStyles.container}>
        <Text style={blockedStyles.title}>Dispositivo no compatible</Text>
        <Text style={blockedStyles.message}>
          Carpuling no puede ejecutarse en dispositivos con root o jailbreak por razones de seguridad.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <TutorialProvider>
          <AlertProvider>
            <AuthProvider>
              <NotificationProvider>
                {fontsLoaded && <AppWithTheme />}
                <OtaUpdateListener />
                <PendingReviewGate />
                {showSplash && (
                  <AnimatedSplash
                    fontsLoaded={fontsLoaded}
                    onComplete={() => setShowSplash(false)}
                  />
                )}
              </NotificationProvider>
            </AuthProvider>
          </AlertProvider>
        </TutorialProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const blockedStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', padding: 32 },
  title:     { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  message:   { color: '#6B7280', fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
