import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useColors } from '../../hooks/useColors';
import { useTheme } from '../../context/ThemeContext';
import HomeScreen from '../../screens/main/HomeScreen';
import TripDetailScreen from '../../screens/main/TripDetailScreen';
import SearchTripsScreen from '../../screens/main/SearchTripsScreen';
import SearchResultsScreen from '../../screens/main/SearchResultsScreen';
import BookingScreen from '../../screens/main/BookingScreen';
import AllTripsScreen from '../../screens/main/AllTripsScreen';

const Stack = createStackNavigator();

const HomeStackNavigator = () => {
  const colors = useColors();
  const { isDarkMode } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: isDarkMode ? '#161616' : '#FFFFFF',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: isDarkMode ? '#404040' : '#E5E7EB',
        },
        headerTintColor: isDarkMode ? '#FFFFFF' : '#1F2937',
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
          color: isDarkMode ? '#FFFFFF' : '#1F2937',
        },
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SearchTrips"
        component={SearchTripsScreen}
        options={{ title: 'Buscar Viajes' }}
      />
      <Stack.Screen
        name="SearchResults"
        component={SearchResultsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        options={{ title: 'Detalle del Viaje' }}
      />
      <Stack.Screen
        name="TripDetailFromHome"
        component={TripDetailScreen}
        options={{ title: 'Detalle del Viaje' }}
      />
      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={{ title: 'Reservar Viaje' }}
      />
      <Stack.Screen
        name="AllTrips"
        component={AllTripsScreen}
        options={{ title: 'Todos los Viajes' }}
      />
    </Stack.Navigator>
  );
};

export default HomeStackNavigator;
