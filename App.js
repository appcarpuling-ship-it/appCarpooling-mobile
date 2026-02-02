import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import AppNavigator from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { soraFonts } from './src/theme/typography';
import { ActivityIndicator, View, Linking } from 'react-native';
import NativeCheckout from './src/components/NativeCheckout';

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
      <AuthProvider>
        <NotificationProvider>
          <NavigationContainer>
            <StatusBar style="dark" />
            <AppNavigator />
          </NavigationContainer>
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
