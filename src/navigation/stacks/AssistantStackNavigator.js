import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AssistantScreen from '../../screens/main/assistant/AssistantScreen';

const Stack = createStackNavigator();

const AssistantStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { flex: 1, minHeight: 0 } }}>
    <Stack.Screen name="Assistant" component={AssistantScreen} />
  </Stack.Navigator>
);

export default AssistantStackNavigator;
