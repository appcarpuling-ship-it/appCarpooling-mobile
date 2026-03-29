import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { AlertProvider } from './src/context/AlertContext';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/rootNavigation';
import PushNotificationRouter from './src/components/PushNotificationRouter';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { soraFonts } from './src/theme/typography';
import { Linking } from 'react-native';
import NativeCheckout from './src/components/NativeCheckout';
import AnimatedSplash from './src/components/AnimatedSplash';

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

  // Configurar listener para deep links de MercadoPago
  useEffect(() => {
    // Manejar deep link si la app ya estaba abierta
    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith('carpooling://')) {
        console.log('🔗 [App] Deep link inicial recibido:', url);
        NativeCheckout.handleDeepLink(url);
      }
    });

    // Manejar deep links cuando la app está en primer plano
    const subscription = Linking.addEventListener('url', (event) => {
      if (event.url && event.url.startsWith('carpooling://')) {
        console.log('🔗 [App] Deep link recibido (app en primer plano):', event.url);
        NativeCheckout.handleDeepLink(event.url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AlertProvider>
          <AuthProvider>
            <NotificationProvider>
              {fontsLoaded && <AppWithTheme />}
              {showSplash && (
                <AnimatedSplash
                  fontsLoaded={fontsLoaded}
                  onComplete={() => setShowSplash(false)}
                />
              )}
            </NotificationProvider>
          </AuthProvider>
        </AlertProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
