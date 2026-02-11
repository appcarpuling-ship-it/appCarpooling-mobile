# README — Build y Deploy con EAS (Expo)

Este documento resume todo lo que configuramos para poder generar builds, previews y artefactos Android (AAB/APK) usando EAS.

---

## 1) Requisitos previos

* Node.js instalado
* Expo CLI
* Cuenta en Expo
* Proyecto configurado con Expo

Instalar Expo CLI:

```bash
npm install -g expo-cli
```

Instalar EAS CLI:

```bash
npm install -g eas-cli
```

Login:

```bash
eas login
```

---

## 2) Inicializar EAS en el proyecto

Desde la raíz del proyecto:

```bash
eas init
```

Esto crea el archivo:

* `eas.json`

---

## 3) Configuración de perfiles de build

Dentro de `eas.json` se definen los entornos:

* development
* preview
* production

Ejemplo base:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

---

## 4) Build Android

### Generar APK de pruebas

```bash
eas build -p android --profile preview
```

### Generar AAB para Play Store

```bash
eas build -p android --profile production
```

---

## 5) Internal distribution

Permite instalar la app sin Play Store.

```bash
eas build -p android --profile preview
```

Expo genera un link de descarga.

---

## 6) Preview del proyecto

Para probar rápidamente:

```bash
npx expo start
```

O con development build:

```bash
eas build -p android --profile development
```

---

## 7) Variables de entorno

Se configuran en:

* Expo dashboard
* eas.json
* app.json / app.config.js

Ejemplo:

```json
{
  "extra": {
    "API_URL": "https://tu-backend.com"
  }
}
```

---

## 8) Conexión con backend

Verificar:

* URL correcta
* HTTPS
* variables en producción

---

## 9) Comandos clave

Login:

```bash
eas login
```

Build Android:

```bash
eas build -p android
```

Build iOS:

```bash
eas build -p ios
```

Ver builds:

```bash
eas build:list
```

Descargar artefactos:

Desde el link generado por Expo.

---

## 10) Publicación en Play Store

1. Generar AAB
2. Ir a Google Play Console
3. Subir artefacto
4. Crear release
5. Enviar a revisión

---

## 11) Troubleshooting

### Build queda en progreso

Es normal. Puede tardar entre:

* 5 a 20 minutos

Depende de:

* cola de Expo
* tamaño del proyecto

### Problemas comunes

* Falta de credenciales
* app.json mal configurado
* variables de entorno incorrectas

---

## 12) Flujo recomendado

1. Desarrollo local
2. Build preview
3. Test interno
4. Build production
5. Play Store

---

## 13) Buenas prácticas

* Usar perfiles separados
* No hardcodear URLs
* Versionar builds
* Documentar cambios

---

## 14) Próximos pasos

* CI/CD
* auto build por push
* staging backend
* monitoreo de crashes

---

**Fin del README**
