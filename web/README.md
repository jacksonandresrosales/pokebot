# Aplicación web

Panel minimalista para revisar mensajes, feedback, ejemplos de estilo y entrenamientos.

## Ejecutar

Completa estas variables en `.env`:

```env
DISCORD_CLIENT_SECRET=secreto_de_oauth_de_discord
WEB_URL=http://localhost:3000
WEB_PORT=3000
SESSION_SECRET=una_clave_larga_y_aleatoria
ADMIN_DISCORD_ID=tu_id_de_discord
```

En el Discord Developer Portal, configura como redirect URI:

```text
http://localhost:3000/api/auth/discord/callback
```

Luego ejecuta:

```bash
npm run web:dev
```
