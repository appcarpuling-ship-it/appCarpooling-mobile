# 🌗 Guía de Implementación de Modo Oscuro

## ✅ Lo que ya está implementado:

### 1. Sistema base de colores
- ✅ `colors.js` - Colores para modo claro y oscuro
- ✅ `ThemeContext.js` - Contexto para manejar el estado del tema
- ✅ `useColors.js` - Hook actualizado para usar el contexto 
- ✅ `App.js` - ThemeProvider agregado
- ✅ `ThemeSettingsScreen.js` - Pantalla para cambiar tema

### 2. Funcionalidades implementadas
- ✅ Persistencia de preferencia del usuario
- ✅ Modo automático (sigue la configuración del sistema)
- ✅ StatusBar que cambia según el tema
- ✅ Colores dinámicos disponibles en toda la app

## 📋 Próximos pasos para completar la implementación:

### Paso 1: Migrar pantallas principales
Para cada pantalla, necesitas:

#### A. Agregar el hook useColors:
```js
import { useColors } from '../../hooks/useColors';

const MyScreen = ({ navigation }) => {
  const { colors } = useColors();
  // ... resto del componente
};
```

#### B. Convertir estilos estáticos a dinámicos:
```js
// ❌ Antes (estático)
<View style={styles.container}>

// ✅ Después (dinámico)
<View style={[styles.container, { backgroundColor: colors.background }]}>
```

#### C. Actualizar StyleSheet:
```js
// ❌ Remover colores hardcodeados
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // ❌ Remover esto
  },
});

// ✅ Usar solo propiedades no relacionadas con colores
const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor se aplica dinámicamente
  },
});
```

### Paso 2: Orden sugerido de migración

#### Prioridad Alta (pantallas principales):
1. `HomeScreen.js` - ✅ **Iniciado** (agregados useColors y container)
2. `ChatsScreen.js` - Ya usa useColors ✅ 
3. `ProfileScreen.js`
4. `LoginScreen.js`
5. `RegisterScreen.js`

#### Prioridad Media:
6. `TripDetailScreen.js`
7. `CreateTripScreen.js`
8. `MyTripsScreen.js`
9. `MyBookingsScreen.js`
10. `SearchTripsScreen.js`

#### Prioridad Baja:
11. Pantallas de configuración
12. Pantallas secundarias

### Paso 3: Migrar componentes
1. `Toast.js`
2. `FormInput.js`
3. `FormPicker.js`
4. `ConfirmationModal.js`
5. `AdvancedFiltersModal.js`

### Paso 4: Agregar acceso a configuración de tema

#### A. En ProfileScreen, agregar botón:
```js
<TouchableOpacity 
  onPress={() => navigation.navigate('ThemeSettings')}
>
  <Text>🌗 Tema de la aplicación</Text>
</TouchableOpacity>
```

#### B. Agregar ruta en el navigator:
```js
// En ProfileStackNavigator.js
<Stack.Screen name="ThemeSettings" component={ThemeSettingsScreen} />
```

## 🎨 Colores disponibles:

### Backgrounds
- `colors.background` - Fondo principal
- `colors.surface` - Fondo de tarjetas/superficies
- `colors.surfaceElevated` - Fondo elevado

### Textos  
- `colors.textPrimary` - Texto principal
- `colors.textSecondary` - Texto secundario
- `colors.textTertiary` - Texto terciario
- `colors.textMuted` - Texto atenuado

### Bordes y elementos de UI
- `colors.border` - Bordes principales
- `colors.borderLight` - Bordes suaves
- `colors.cardBackground` - Fondo de tarjetas
- `colors.inputBackground` - Fondo de inputs

### Colores de estado
- `colors.success` - Verde (éxito)
- `colors.error` - Rojo (error)
- `colors.warning` - Naranja (advertencia)  
- `colors.info` - Azul (información)

## 📝 Patrón de migración típico:

### Antes:
```js
const MyScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hola</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  title: {
    color: '#000000',
    fontSize: 18,
  },
});
```

### Después:
```js
import { useColors } from '../hooks/useColors';

const MyScreen = () => {
  const { colors } = useColors();
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Hola</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor removido - aplicado dinámicamente
  },
  title: {
    // color removido - aplicado dinámicamente
    fontSize: 18,
  },
});
```

## 🔧 Funciones del hook useColors:

```js
const { 
  colors,           // Colores actuales (claro u oscuro)
  isDarkMode,       // true si está en modo oscuro
  toggleTheme,      // Alternar entre claro/oscuro
  setThemeMode,     // Establecer modo específico ('light'|'dark'|'system')
  getCurrentThemeMode, // Obtener modo actual
} = useColors();
```

## 🎯 Tips importantes:

1. **Siempre usar colores dinámicos** - Nunca hardcodear colores en los estilos
2. **Probar en ambos modos** - Verificar que todo se vea bien en claro y oscuro
3. **Usar colores semánticamente correctos** - textPrimary para texto principal, etc.
4. **No olvidar StatusBar** - Ya está configurado dinámicamente en App.js
5. **Considerar las imágenes** - Algunas pueden necesitar versiones para modo oscuro

## 📱 Cómo probar:

1. Ve a Configuraciones del dispositivo
2. Cambia entre modo claro y oscuro
3. La app debería cambiar automáticamente si está en modo "Automático"
4. O prueba desde la pantalla de configuración de tema dentro de la app

---

¡El modo oscuro ya está funcional! Solo falta migrar las pantallas restantes usando estos patrones. 🚀