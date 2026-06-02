# Deploys · Carpuling Mobile

Todos los deploys se disparan con **commits vacíos** desde la rama correspondiente.

```bash
git commit --allow-empty -m "<comando>"
git push origin <rama>
```

---

## Rama `main` — Producción

| Comando | Qué hace |
|---|---|
| `prod.ota:Mensaje` | Publica un OTA al canal **production**. Llega a todos los usuarios con el build de stores instalado. |
| `prod.build` | Build completo para stores: **Android AAB** (Play Store) + **iOS IPA** (TestFlight). |
| `prod.build.apk` | Build interno: **Android APK** + **iOS IPA** (distribución interna). Sirve para testear OTAs de producción en el dispositivo sin pasar por los stores. |

### Ejemplos

```bash
# Mandar un fix rápido a producción
git commit --allow-empty -m "prod.ota:Fix crash en pantalla de login"
git push origin main

# Generar nuevo build para Play Store y TestFlight
git commit --allow-empty -m "prod.build"
git push origin main

# Generar APK/IPA interno para testear OTAs
git commit --allow-empty -m "prod.build.apk"
git push origin main
```

---

## Rama `dev` — Desarrollo

| Comando | Qué hace |
|---|---|
| `dev.ota:Mensaje` | Publica un OTA al canal **development**. Llega a dispositivos con el dev client instalado. |
| `dev.client` | Build del **dev client APK** para Android. |

### Ejemplos

```bash
# Mandar cambios al dev client
git commit --allow-empty -m "dev.ota:Probando nuevo feature de mapa"
git push origin dev

# Generar nuevo dev client
git commit --allow-empty -m "dev.client"
git push origin dev
```

---

## Canales EAS

| Canal | Builds que lo reciben |
|---|---|
| `production` | Builds de Play Store / TestFlight / production-apk |
| `development` | Dev client |
| `build` | Builds internos con perfil `build` |

---

## Secrets requeridos en GitHub

Configurar en **Settings → Secrets and variables → Actions**:

| Secret | Valor |
|---|---|
| `EXPO_TOKEN` | Token de expo.dev (Settings → Access Tokens) |
| `EXPO_PUBLIC_API_BASE_URL` | `https://appcarpooling.onrender.com/api` |
