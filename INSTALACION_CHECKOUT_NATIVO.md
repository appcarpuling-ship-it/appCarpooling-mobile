# Instalación de Checkout Nativo de MercadoPago

## Pasos para completar la instalación

### 1. Instalar dependencia

Ejecuta en la terminal:

```bash
cd appCarpooling-mobile
npm install expo-web-browser
```

O si usas yarn:

```bash
yarn add expo-web-browser
```

### 2. Rebuild de la app

Después de instalar `expo-web-browser`, necesitas hacer un rebuild de la app:

```bash
# Si usas Expo Go, simplemente reinicia el servidor
npm start

# Si tienes un build nativo, necesitas hacer prebuild
npx expo prebuild --clean
```

### 3. Configuración completada

Ya está configurado:
- ✅ Deep linking en `app.json` (scheme: `carpooling`)
- ✅ Componente `NativeCheckout.js` creado
- ✅ Integración en `MySeatReservationsScreen` y `TripDetailScreen`
- ✅ Listener de deep links en `App.js`

### 4. Cómo funciona

1. Usuario hace clic en "Pagar"
2. Se abre Custom Tabs (Android) o Safari View Controller (iOS) - navegador nativo del sistema
3. Usuario completa el pago en MercadoPago
4. MercadoPago redirige a `carpooling://payments/confirmation?status=approved&payment_id=xxx`
5. La app detecta el deep link y procesa el resultado
6. Se muestra el resultado al usuario

### 5. Probar el deep link

Para probar el deep link manualmente:

```bash
# Android
npx uri-scheme open carpooling://payments/confirmation?status=approved&payment_id=123 --android

# iOS
npx uri-scheme open carpooling://payments/confirmation?status=approved&payment_id=123 --ios
```

### Notas importantes

- El checkout usa componentes nativos del sistema (no WebView)
- Funciona mejor que WebView porque usa Custom Tabs/Safari View Controller
- El deep linking permite que MercadoPago vuelva automáticamente a la app
- Si el usuario no tiene la app de MercadoPago instalada, se abre en el navegador nativo del sistema
