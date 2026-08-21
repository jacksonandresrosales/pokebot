# Aplicación web

Panel minimalista para entrenar y supervisar el estilo del bot. Incluye:

- creación y administración de ejemplos;
- rasgos de comportamiento para añadir gustos, temas y manías de Poke;
- métricas de votos y actividad de los últimos siete días;
- listado de amigos autorizados para entrenarlo.
- gestión de roles, accesos e importancia de cada entrenador.
- importación de conversaciones por cualquier entrenador autorizado y análisis con aprobación manual del administrador.
- tutorial inicial para orientar a cada tipo de usuario.

Las conversaciones importadas deben ser archivos TXT, JSON o CSV de hasta 2 MB.

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
npm run verify
```

La comprobación completa de análisis de conversaciones usa Gemini y puede
consumir cuota de IA, por lo que se ejecuta aparte:

```bash
npm run db:verify-panel
npm run db:verify-messages
```
