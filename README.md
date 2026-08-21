# pokebot

Bot de Discord inspirado en el estilo de escritura de una persona real.

## Estructura

```text
src/
├─ ai/              Integración con Gemini y personalidad
├─ bot/             Eventos y comandos de Discord
├─ config/          Variables de entorno y configuración
├─ db/              Cliente y esquema de base de datos
├─ types/           Tipos compartidos
└─ index.ts         Punto de entrada

web/                Futura aplicación web de administración
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
```

Antes de ejecutar el bot, completa las variables de `.env`.
