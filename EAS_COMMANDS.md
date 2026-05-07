# Comandos EAS — Carpuling Mobile

## Requisitos previos (una sola vez)

```powershell
# Instalar EAS CLI globalmente
npm install --global eas-cli

# Iniciar sesión en Expo
eas login

# Verificar que estás logueado
eas whoami
```

---

## 1. Development Client

> APK especial que incluye herramientas de desarrollo. Se usa con `npx expo start --dev-client`.
> Solo hay que rebuildearlo si cambiás dependencias nativas.

```powershell
# Build development para Android
eas build --profile development --platform android

# Build development para iOS (requiere cuenta Apple Developer $99/año)
eas build --profile development --platform ios
```

Luego para correr el servidor de desarrollo:

```powershell
npx expo start --dev-client
```

---

## 2. Preview Build (APK de prueba)

> APK para compartir con testers sin necesidad de Play Store.
> Regenerar cuando agregues nuevas librerías nativas o cambies permisos.

```powershell
# Android (genera APK descargable)
eas build --profile preview --platform android

# iOS (requiere cuenta Apple Developer $99/año)
eas build --profile preview --platform ios
```

Ver el link de descarga en: https://expo.dev/accounts/carpuling/projects/carpuling/builds

---

## 3. Production Build (para tiendas)

> Para subir a Google Play Store o Apple App Store.

```powershell
# Android (genera .aab para Play Store)
eas build --profile production --platform android

# iOS (requiere cuenta Apple Developer $99/año)
eas build --profile production --platform ios

# Ambas plataformas a la vez
eas build --profile production --platform all
```

---

## 4. OTA Updates (Over The Air) ⚡

> Actualiza el código JS/assets sin generar un nuevo build.
> Los usuarios reciben el update automáticamente al abrir la app.
> NO requiere pasar por Play Store ni App Store.

```powershell
# Mandar update al canal preview (testers)
eas update --branch preview --message "Fix en pantalla de home"

# Mandar update al canal production (todos los usuarios)
eas update --branch production --message "Mejora en filtros de búsqueda"
```

### ¿Qué se puede actualizar con OTA?
| ✅ SÍ (OTA) | ❌ NO (requiere nuevo build) |
|---|---|
| Código JS / pantallas | Nuevas librerías nativas |
| Lógica de negocio | Cambios en app.json / permisos |
| Estilos y colores | Nuevos plugins de Expo |
| Imágenes y assets | Cambios en AndroidManifest / Info.plist |

---

## 5. Submit a las tiendas

```powershell
# Subir a Google Play (requiere cuenta Google Play $25 único)
eas submit --platform android --latest

# Subir a App Store (requiere cuenta Apple Developer $99/año)
eas submit --platform ios --latest
```

---

## 6. Ver estado de builds

```powershell
# Ver builds recientes
eas build:list

# Ver info del proyecto
eas project:info
```

---

## Flujo de trabajo habitual

```
Desarrollo diario:
  → npx expo start               (con Expo Go, sin builds)

Cambios que no tocan nativas:
  → eas update --branch preview  (OTA instantáneo)

Cambios que tocan nativas (nueva lib, permisos):
  → eas build --profile preview  (nuevo APK, ~10 min)

Lanzar a producción:
  1. eas build --profile production --platform android
  2. eas submit --platform android --latest
  3. eas update --branch production --message "v1.x.x"
```

---

## Canales configurados

| Canal | Perfil | Uso |
|---|---|---|
| `development` | development | Dev client local |
| `preview` | preview | APK de prueba interno |
| `production` | production | App Store / Play Store |

---

## IDs del proyecto

- **EAS Project ID**: `4f43e00d-f804-4c94-aa0a-beae6f6be58a`
- **Owner**: `carpuling`
- **Dashboard**: https://expo.dev/accounts/carpuling/projects/carpuling
