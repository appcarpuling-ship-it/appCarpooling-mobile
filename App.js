import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { AlertProvider } from './src/context/AlertContext';
import AppNavigator from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { soraFonts } from './src/theme/typography';
import { ActivityIndicator, View, Linking } from 'react-native';
import NativeCheckout from './src/components/NativeCheckout';

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
    <NavigationContainer>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <AppNavigator />
    </NavigationContainer>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts(soraFonts);

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

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AlertProvider>
          <AuthProvider>
            <NotificationProvider>
              <AppWithTheme />
            </NotificationProvider>
          </AuthProvider>
        </AlertProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
