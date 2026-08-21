# pokebot

Bot de Discord inspirado en el estilo de escritura de una persona real.

Actualmente responde cuando lo mencionan, añade botones 👍/👎 y guarda el
feedback en Supabase. Las respuestas con voto positivo se convierten en
ejemplos de estilo para las siguientes respuestas.

El panel web permite administrar entrenadores, importar conversaciones,
analizarlas con Gemini y aprobar manualmente los ejemplos propuestos.

## Estructura

```text
src/
├─ ai/              Integración con Gemini y personalidad
├─ bot/             Eventos y comandos de Discord
├─ config/          Variables de entorno y configuración
├─ db/              Cliente y esquema de base de datos
├─ types/           Tipos compartidos
└─ index.ts         Punto de entrada

web/                Panel web de entrenamiento y analíticas
scripts/            Scripts de mantenimiento y entrenamiento
tests/              Pruebas automatizadas
```

## Requisitos

- Node.js 20 o superior
- Un bot creado en el Discord Developer Portal
- Una clave de Gemini API

## Inicio

```bash
npm install
copy .env.example .env
npm run typecheck
npm run db:setup
```

Antes de ejecutar el bot, completa las variables de `.env`. `npm run db:setup`
aplica el esquema de Supabase y verifica sus tablas.

Para abrir el panel web, ejecuta `npm run web:dev` y visita
`http://localhost:3000`.
