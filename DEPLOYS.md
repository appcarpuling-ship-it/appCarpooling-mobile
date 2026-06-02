# Despliegues · Carpuling Mobile

Este documento forma parte del proyecto Carpuling. Uso interno para el equipo de desarrollo.

## Despliegues, actualizaciones y builds

Los despliegues, actualizaciones "over the air" y builds se realizan de forma automática con GitHub Actions.

Se deberá anteponer los siguientes prefijos en el mensaje del commit si se desea disparar alguna acción:

```bash
git commit --allow-empty -m "ACCIÓN:MENSAJE"
```

---

| Acción | Descripción |
|---|---|
| `dev.ota:` | Dispara una actualización "over the air" para dev |
| `dev.build` | Dispara el build de una nueva versión de la app apuntando a dev |
| `dev.client` | Dispara el build de una nueva versión dev client de la app apuntando a dev |
| `prod.ota:` | Dispara una actualización "over the air" para prod |
| `prod.build` | Dispara el build de una nueva versión de la app apuntando a prod (AAB + IPA) |
| `prod.build.apk` | Dispara el build de una versión interna APK + IPA apuntando a prod (para testear OTAs) |

---

### Ejemplos

```bash
# OTA a producción
git commit --allow-empty -m "prod.ota:Fix crash en login"
git push origin main

# Build completo para stores
git commit --allow-empty -m "prod.build"
git push origin main

# OTA a desarrollo
git commit --allow-empty -m "dev.ota:Probando nuevo feature"
git push origin dev

# Dev client
git commit --allow-empty -m "dev.client"
git push origin dev
```

---

> **Nota:** los workflows solo se disparan con commits vacíos (`--allow-empty`). Un commit con archivos modificados no dispara ninguna acción automática.
