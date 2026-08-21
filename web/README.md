# Aplicación web

Panel minimalista para entrenar y supervisar el estilo del bot. Incluye:

- creación y administración de ejemplos;
- métricas de votos y actividad de los últimos siete días;
- configuración visible del comportamiento del bot;
- listado de amigos autorizados para entrenarlo.
- gestión de roles, accesos e importancia de cada entrenador.

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

## Verificación

Con el servidor web activo, puedes comprobar el panel y su conexión con la
base de datos mediante:

```bash
npm run db:verify-panel
npm run web:verify-panel
```
