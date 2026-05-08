import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../../hooks/useColors';
import { useTheme } from '../../../context/ThemeContext';

// Valores directos para las fuentes Sora
const SORA_FONTS = {
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semiBold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
};

const ThemeSettingsScreen = ({ navigation }) => {
  const { colors } = useColors();
  const { getCurrentThemeMode, setThemeMode, isDarkMode } = useTheme();
  
  const currentMode = getCurrentThemeMode();

  const themeOptions = [
    {
      key: 'light',
      title: 'Modo Claro',
      description: 'Usar siempre el tema claro',
      icon: 'sunny-outline',
    },
    {
      key: 'dark', 
      title: 'Modo Oscuro',
      description: 'Usar siempre el tema oscuro',
      icon: 'moon-outline',
    },
    {
      key: 'system',
      title: 'Automático',
      description: 'Seguir la configuración del sistema',
      icon: 'phone-portrait-outline',
    },
  ];

  const handleThemeChange = (themeMode) => {
    setThemeMode(themeMode);
  };

  const renderThemeOption = (option) => {
    const isSelected = currentMode === option.key;
    
    return (
      <TouchableOpacity
        key={option.key}
        style={[
          styles.optionContainer,
          {
            backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground,
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 2 : 1,
          }
        ]}
        onPress={() => handleThemeChange(option.key)}
        activeOpacity={0.7}
      >
        <View style={styles.optionContent}>
          <View style={styles.optionLeft}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: isSelected ? colors.primary : getCurrentThemeMode() === 'dark' ? '#292929' : colors.surface,
                }
              ]}
            >
              <Ionicons
                name={option.icon}
                size={24}
                color={isSelected ? colors.background : colors.textPrimary}
              />
            </View>
            <View style={styles.optionText}>
              <Text
                style={[
                  styles.optionTitle,
                  {
                    color: colors.textPrimary,
                    fontFamily: isSelected ? SORA_FONTS.semiBold : SORA_FONTS.medium,
                  }
                ]}
              >
                {option.title}
              </Text>
              <Text
                style={[
                  styles.optionDescription,
                  { color: colors.textSecondary, fontFamily: SORA_FONTS.regular }
                ]}
              >
                {option.description}
              </Text>
            </View>
          </View>
          
          {isSelected && (
            <Ionicons 
              name=\"checkmark-circle\" 
              size={24} 
              color={colors.accentGreen}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Tema',
      headerStyle: {
        backgroundColor: colors.surface,
      },
      headerTintColor: colors.textPrimary,
      headerTitleStyle: {
        color: colors.textPrimary,
        fontFamily: SORA_FONTS.semiBold,
      },
    });
  }, [colors, navigation]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header con preview del tema actual */}
        <View style={[styles.previewContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary, fontFamily: SORA_FONTS.medium }]}>
            Vista previa del tema
          </Text>
          <View style={[styles.previewCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.previewText, { color: colors.textPrimary, fontFamily: SORA_FONTS.regular }]}>
              Título de ejemplo
            </Text>
            <Text style={[styles.previewSubtext, { color: colors.textSecondary, fontFamily: SORA_FONTS.regular }]}>
              Este es un texto de ejemplo para mostrar cómo se ve el tema actual
            </Text>
          </View>
        </View>

        {/* Opciones de tema */}
        <View style={styles.optionsContainer}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: SORA_FONTS.semiBold }]}>
            Seleccionar tema
          </Text>
          {themeOptions.map(renderThemeOption)}
        </View>

        {/* Información adicional */}
        <View style={[styles.infoContainer, { backgroundColor: colors.surface }]}>
          <Ionicons name=\"information-circle-outline\" size={20} color={colors.info} />
          <Text style={[styles.infoText, { color: colors.textSecondary, fontFamily: SORA_FONTS.regular }]}>
            El modo automático cambiará entre claro y oscuro según la configuración de tu dispositivo.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  previewContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  previewCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewText: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 8,
  },
  previewSubtext: {
    fontSize: 14,
    lineHeight: 20,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    marginLeft: 4,
  },
  optionContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 12,
  },
});

export default ThemeSettingsScreen;