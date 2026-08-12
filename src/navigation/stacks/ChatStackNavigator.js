import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useColors } from '../../hooks/useColors';
import { useHeaderStatusBarHeight } from '../useHeaderStatusBarHeight';
import { useTheme } from '../../context/ThemeContext';
import ChatsScreen from '../../screens/main/chat/ChatsScreen';
import ChatDetailScreen from '../../screens/main/chat/ChatDetailScreen';
import UserProfileScreen from '../../screens/main/common/UserProfileScreen';
import UserReviewsScreen from '../../screens/main/common/UserReviewsScreen';

const Stack = createStackNavigator();

const ChatStackNavigator = () => {
  const colors = useColors();
  const headerStatusBarHeight = useHeaderStatusBarHeight();
  const { isDarkMode } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStatusBarHeight,
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
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ title: 'Perfil' }}
      />
      <Stack.Screen
        name="UserReviews"
        component={UserReviewsScreen}
        options={{ title: 'Reseñas' }}
      />
    </Stack.Navigator>
  );
};

export default ChatStackNavigator;
