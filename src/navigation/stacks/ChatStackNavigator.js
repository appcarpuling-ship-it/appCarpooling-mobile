import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useColors } from '../../hooks/useColors';
import { useTheme } from '../../context/ThemeContext';
import ChatsScreen from '../../screens/main/chat/ChatsScreen';
import ChatDetailScreen from '../../screens/main/chat/ChatDetailScreen';

const Stack = createStackNavigator();

const ChatStackNavigator = () => {
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
        headerTitleAlign: 'center',
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
