import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { colors as themeColors } from '../../theme/colors';

// Safe colors with fallbacks for navigation
const colors = themeColors || {
  surface: '#F8F9FA',
  border: '#E5E7EB',
  textPrimary: '#000000',
};
import HomeScreen from '../../screens/main/HomeScreen';
import TripDetailScreen from '../../screens/main/TripDetailScreen';
import SearchTripsScreen from '../../screens/main/SearchTripsScreen';
import SearchResultsScreen from '../../screens/main/SearchResultsScreen';
import BookingScreen from '../../screens/main/BookingScreen';
import AllTripsScreen from '../../screens/main/AllTripsScreen';

const Stack = createStackNavigator();

const HomeStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#F8F9FA',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        },
        headerTintColor: '#000000',
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
          color: colors.textPrimary,
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
