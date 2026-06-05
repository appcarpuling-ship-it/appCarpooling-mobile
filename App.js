import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import JailMonkey from 'jail-monkey';
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
import { soraFonts } from './src/theme/typography';
import { Linking, View, Text, StyleSheet } from 'react-native';
import NativeCheckout from './src/components/payment/NativeCheckout';
import AnimatedSplash from './src/components/AnimatedSplash';
import OtaUpdateListener from './src/components/OtaUpdateListener';

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

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <AppNavigator />
      <PushNotificationRouter />
    </NavigationContainer>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts(soraFonts);
  const [showSplash, setShowSplash] = useState(true);
  const [deviceBlocked, setDeviceBlocked] = useState(false);
  useEffect(() => {
    if (JailMonkey.isJailBroken()) {
      setDeviceBlocked(true);
    }
  }, []);

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
