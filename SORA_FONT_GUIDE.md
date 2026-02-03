# Guía de Uso de Tipografía Sora

Esta app usa la tipografía **Sora** en todos los textos. Sigue estas guías para asegurar consistencia.

## ✅ Configuración

La fuente Sora ya está instalada y configurada en:
- `mobile/src/theme/typography.js` - Configuración de tipografía
- `mobile/src/theme/colors.js` - Exportación de fontFamily
- `mobile/App.js` - Carga de fuentes con `useFonts`

## 📝 Cómo Usar Sora

### Opción 1: Usar fontFamily desde el tema (Recomendado)

```javascript
import { fontFamily } from '../theme/colors';
// o desde useColors hook
const { fontFamily } = useColors();

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontFamily: fontFamily.bold, // ✅ Usa Sora Bold
  },
  body: {
    fontSize: 16,
    fontFamily: fontFamily.regular, // ✅ Usa Sora Regular
  },
});
```

### Opción 2: Usar el componente SoraText

```javascript
import SoraText from '../components/SoraText';

<SoraText style={styles.title}>Título</SoraText>
<SoraText fontWeight="bold">Texto en negrita</SoraText>
```

### Opción 3: Usar estilos globales

```javascript
import { globalTextStyles } from '../theme/globalStyles';

<Text style={globalTextStyles.h1}>Título H1</Text>
<Text style={globalTextStyles.body}>Texto del cuerpo</Text>
```

## 🎯 Pesos Disponibles

```javascript
fontFamily.thin        // Sora_100Thin
fontFamily.extraLight  // Sora_200ExtraLight
fontFamily.light       // Sora_300Light
fontFamily.regular     // Sora_400Regular (por defecto)
fontFamily.medium      // Sora_500Medium
fontFamily.semiBold    // Sora_600SemiBold
fontFamily.bold        // Sora_700Bold
fontFamily.extraBold   // Sora_800ExtraBold
```

## ⚠️ Reglas Importantes

1. **SIEMPRE incluye `fontFamily`** en los estilos de Text
2. **NO uses solo `fontWeight`** sin `fontFamily` - esto usará la fuente del sistema
3. **Usa `fontFamily.regular`** como valor por defecto si no especificas peso

## 🔧 Migración de Estilos Existentes

Si encuentras estilos que usan `fontWeight` sin `fontFamily`, agrégalo:

```javascript
// ❌ Incorrecto - usa fuente del sistema
const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
});

// ✅ Correcto - usa Sora
const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontFamily: fontFamily.bold,
    fontWeight: '700', // Opcional, pero recomendado para compatibilidad
  },
});
```

## 📚 Ejemplos Completos

### Ejemplo 1: Pantalla con múltiples estilos

```javascript
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSize } from '../theme/colors';

const MyScreen = () => {
  return (
    <View>
      <Text style={styles.h1}>Título Principal</Text>
      <Text style={styles.body}>Texto del cuerpo</Text>
      <Text style={styles.caption}>Texto pequeño</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  h1: {
    fontSize: fontSize.xxxl,
    fontFamily: fontFamily.bold,
  },
  body: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
  },
  caption: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
  },
});
```

### Ejemplo 2: Usando useColors hook

```javascript
import { useColors } from '../hooks/useColors';

const MyComponent = () => {
  const { fontFamily, colors } = useColors();
  
  return (
    <Text style={{
      fontSize: 18,
      fontFamily: fontFamily.semiBold,
      color: colors.textPrimary,
    }}>
      Mi texto
    </Text>
  );
};
```

## 🚀 Verificación

Para verificar que todos los textos usan Sora:

1. Busca en el código: `fontWeight.*[0-9]` sin `fontFamily`
2. Revisa que todos los componentes Text tengan `fontFamily` en sus estilos
3. Usa el componente `SoraText` para nuevos componentes

## 📖 Referencias

- Archivo de configuración: `mobile/src/theme/typography.js`
- Componente personalizado: `mobile/src/components/SoraText.js`
- Helper utilities: `mobile/src/utils/fontHelper.js`
- Estilos globales: `mobile/src/theme/globalStyles.js`
