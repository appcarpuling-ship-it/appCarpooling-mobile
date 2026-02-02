# 🚗 Carpooling Mobile App

Aplicación móvil de carpooling desarrollada con React Native y Expo. Permite a los usuarios compartir viajes, reducir costos y contribuir al medio ambiente.

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** (v16 o superior) - [Descargar aquí](https://nodejs.org/)
- **npm** o **yarn** - Viene incluido con Node.js
- **Expo CLI** - Se instalará con el proyecto
- **Android Studio** (para Android) o **Xcode** (para iOS)
- **Git** - [Descargar aquí](https://git-scm.com/)

### Para Android:
- Android Studio instalado
- Android SDK configurado
- Un dispositivo Android o emulador configurado

### Para iOS (solo macOS):
- Xcode instalado
- Simulador iOS configurado

## 🚀 Instalación

### 1. Clonar el repositorio (si aplica)

```bash
git clone <url-del-repositorio>
cd carpuling/mobile
```

### 2. Instalar dependencias

```bash
npm install
# o
yarn install
```

### 3. Configurar la conexión al backend

Edita el archivo `src/config/api.js` y actualiza la URL del backend:

```javascript
export const API_CONFIG = {
  BASE_URL: 'http://TU_IP:5000/api', // Cambia TU_IP por la IP de tu computadora
  TIMEOUT: 10000,
};
```

**Importante**:
- Si usas un emulador Android, usa `http://10.0.2.2:5000/api`
- Si usas un dispositivo físico, usa la IP de tu computadora en la red local (ej: `http://192.168.1.100:5000/api`)
- Para iOS, usa la IP de tu computadora

Para encontrar tu IP:
- **Windows**: `ipconfig` en CMD
- **Mac/Linux**: `ifconfig` en Terminal

## 📱 Ejecutar la Aplicación

### Iniciar el servidor de desarrollo

```bash
npm start
# o
expo start
```

Esto abrirá Expo DevTools en tu navegador.

### Ejecutar en Android

#### Opción 1: Usando Android Studio (Recomendado)

1. Abre Android Studio
2. Abre AVD Manager (Android Virtual Device Manager)
3. Inicia un emulador Android
4. En la terminal del proyecto, ejecuta:

```bash
npm run android
# o
expo start --android
```

#### Opción 2: Usando dispositivo físico

1. Habilita la depuración USB en tu dispositivo Android
2. Conecta tu dispositivo al computador
3. Ejecuta:

```bash
npm run android
```

### Ejecutar en iOS (solo macOS)

1. Abre el Simulador de iOS
2. En la terminal del proyecto, ejecuta:

```bash
npm run ios
# o
expo start --ios
```

### Ejecutar en navegador web

```bash
npm run web
# o
expo start --web
```

## 🛠️ Scripts Disponibles

- `npm start` - Inicia el servidor de desarrollo de Expo
- `npm run android` - Inicia la app en Android
- `npm run ios` - Inicia la app en iOS
- `npm run web` - Inicia la app en navegador web

## 📂 Estructura del Proyecto

```
mobile/
├── App.js                      # Punto de entrada principal
├── app.json                    # Configuración de Expo
├── package.json               # Dependencias del proyecto
├── babel.config.js           # Configuración de Babel
└── src/
    ├── config/
    │   └── api.js            # Configuración de la API
    ├── context/
    │   └── AuthContext.js    # Contexto de autenticación
    ├── navigation/
    │   ├── AppNavigator.js   # Navegación principal
    │   ├── MainTabNavigator.js
    │   └── stacks/           # Stack navigators
    ├── screens/
    │   ├── auth/            # Pantallas de autenticación
    │   │   ├── LoginScreen.js
    │   │   ├── RegisterScreen.js
    │   │   └── ForgotPasswordScreen.js
    │   └── main/            # Pantallas principales
    │       ├── HomeScreen.js
    │       ├── CarpoolingsScreen.js
    │       ├── ProfileScreen.js
    │       ├── SearchTripsScreen.js
    │       ├── TripDetailScreen.js
    │       ├── BookingScreen.js
    │       ├── CreateTripScreen.js
    │       ├── MyTripsScreen.js
    │       ├── MyBookingsScreen.js
    │       ├── EditProfileScreen.js
    │       ├── VehiclesScreen.js
    │       ├── NotificationsScreen.js
    │       ├── TermsScreen.js
    │       └── HelpScreen.js
    └── services/
        └── apiService.js     # Servicios de API
```

## 🔑 Funcionalidades Principales

### Autenticación
- ✅ Login de usuarios
- ✅ Registro de nuevos usuarios
- ✅ Recuperación de contraseña
- ✅ Gestión de sesión con tokens JWT

### Viajes
- ✅ Búsqueda de viajes por origen y destino
- ✅ Creación de viajes como conductor
- ✅ Visualización de detalles de viaje
- ✅ Reserva de asientos
- ✅ Gestión de mis viajes creados
- ✅ Gestión de mis reservas

### Perfil
- ✅ Visualización de perfil
- ✅ Edición de datos personales
- ✅ Gestión de vehículos
- ✅ Notificaciones
- ✅ Términos y condiciones
- ✅ Centro de ayuda

## 🔄 Conexión con el Backend

La aplicación se conecta al backend a través de los servicios definidos en `src/services/apiService.js`:

- `post_withauth(endpoint, data)` - POST con autenticación
- `get_withauth(endpoint, params)` - GET con autenticación
- `put_withauth(endpoint, data)` - PUT con autenticación
- `delete_withauth(endpoint)` - DELETE con autenticación
- `post_public(endpoint, data)` - POST sin autenticación
- `get_public(endpoint, params)` - GET sin autenticación

El token JWT se guarda automáticamente en AsyncStorage y se envía en cada petición autenticada.

## 🐛 Solución de Problemas

### La app no se conecta al backend

1. Verifica que el backend esté corriendo (`npm run dev` en la carpeta backend)
2. Verifica la URL en `src/config/api.js`
3. Si usas un dispositivo físico, asegúrate de estar en la misma red WiFi
4. Desactiva temporalmente el firewall de Windows/Mac para probar

### Error al instalar dependencias

```bash
# Limpia el caché de npm
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Metro Bundler no inicia

```bash
# Limpia el caché de Expo
expo start -c
```

### Problemas con Android

1. Asegúrate de tener las variables de entorno configuradas:
   - `ANDROID_HOME` apuntando al SDK de Android
   - `JAVA_HOME` apuntando al JDK

2. Verifica que el emulador esté corriendo antes de ejecutar la app

### Problemas con iOS

1. Instala los pods (si es necesario):
```bash
cd ios
pod install
cd ..
```

2. Limpia el build:
```bash
expo start -c
```

## 📱 Probar con Expo Go

Puedes probar la app rápidamente usando la app Expo Go:

1. Instala Expo Go en tu dispositivo móvil:
   - [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iOS](https://apps.apple.com/app/expo-go/id982107779)

2. Ejecuta `npm start` o `expo start`
3. Escanea el código QR con Expo Go (Android) o la cámara (iOS)

**Nota**: Asegúrate de estar en la misma red WiFi que tu computadora.

## 🔐 Usuarios de Prueba

Una vez que el backend esté corriendo con datos de prueba (seeders), puedes usar:

```
Email: usuario@ejemplo.com
Contraseña: password123
```

(Verifica los seeders del backend para más usuarios)

## 📝 Notas Importantes

- La app requiere que el backend esté corriendo para funcionar
- Las imágenes de perfil y avatares usan placeholders por defecto
- Los pagos se manejan manualmente entre usuarios (no hay integración de pagos)
- Las notificaciones push requieren configuración adicional en producción

## 🚀 Compilar para Producción

### Android (APK/AAB)

```bash
expo build:android
```

### iOS (IPA)

```bash
expo build:ios
```

Sigue las instrucciones en pantalla para configurar tus credenciales.

## 📚 Recursos Adicionales

- [Documentación de Expo](https://docs.expo.dev/)
- [Documentación de React Native](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Guía de publicación en Play Store](https://docs.expo.dev/distribution/app-stores/)
- [Guía de publicación en App Store](https://docs.expo.dev/distribution/app-stores/)

## 🤝 Contribuir

Si deseas contribuir al proyecto:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

---

¿Necesitas ayuda? Contacta al equipo de desarrollo o revisa la documentación del backend.
