# Despliegues · Carpuling Mobile

Este documento forma parte del proyecto Carpuling. Uso interno para el equipo de desarrollo.

## Despliegues, actualizaciones y builds

Los despliegues, actualizaciones "over the air" y builds se realizan de forma automática con GitHub Actions.

Se deberá anteponer los siguientes prefijos en el mensaje del commit si se desea disparar alguna acción:

```bash
git commit --allow-empty -m "ACCIÓN:MENSAJE"
```

---

## Rama `dev`

| Acción | Descripción |
|---|---|
| `dev.ota:` | Dispara una actualización "over the air" para dev |
| `dev.build` | Dispara el build de una nueva versión APK apuntando a dev |
| `dev.client` | Dispara el build de una nueva versión dev client apuntando a dev |

```bash
git commit --allow-empty -m "dev.ota:Mensaje"
git push origin dev

git commit --allow-empty -m "dev.build"
git push origin dev

git commit --allow-empty -m "dev.client"
git push origin dev
```

---

## Rama `main`

| Acción | Descripción |
|---|---|
| `prod.ota:` | Dispara una actualización "over the air" para prod |
| `prod.build` | Dispara el build **AAB** (Google Play: pruebas cerradas/abiertas/producción) + **IPA** (TestFlight: pruebas internas/externas) |
| `prod.build.apk` | Dispara el build **APK + IPA interno** para instalar directo en dispositivo y testear OTAs de prod sin pasar por los stores |

```bash
git commit --allow-empty -m "prod.ota:Mensaje"
git push origin main

git commit --allow-empty -m "prod.build"
git push origin main

git commit --allow-empty -m "prod.build.apk"
git push origin main
```

---

> **Nota:** los workflows solo se disparan con commits vacíos (`--allow-empty`). Un commit con archivos modificados no dispara ninguna acción automática.
