import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { colors as themeColors } from '../../theme/colors';

// Safe colors with fallbacks for navigation
const colors = themeColors || {
  surface: '#F8F9FA',
  border: '#E5E7EB',
  textPrimary: '#000000',
};
import ChatsScreen from '../../screens/main/ChatsScreen';
import ChatDetailScreen from '../../screens/main/ChatDetailScreen';

const Stack = createStackNavigator();

const ChatStackNavigator = () => {
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
          color: '#000000',
        },
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="Chats"
        component={ChatsScreen}
        options={{
          title: 'Mensajes'
        }}
      />
      <Stack.Screen
        name="ChatDetail"
        component={ChatDetailScreen}
        options={{
          headerBackTitleVisible: false
        }}
      />
    </Stack.Navigator>
  );
};

export default ChatStackNavigator;
