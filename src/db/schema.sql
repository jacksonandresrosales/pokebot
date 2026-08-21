-- Esquema inicial para mensajes, feedback y ejemplos aprobados.

create extension if not exists pgcrypto;

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  discord_user_id text not null unique,
  nombre text not null,
  rol text not null default 'entrenador'
    check (rol in ('administrador', 'entrenador')),
  puede_entrenar boolean not null default true,
  importancia smallint not null default 3
    check (importancia between 1 and 5),
  consentimiento boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists usuarios_rol_idx
  on usuarios (rol);

alter table usuarios
  add column if not exists importancia smallint not null default 3
    check (importancia between 1 and 5);

alter table usuarios enable row level security;

create table if not exists mensajes_bot (
  id uuid primary key default gen_random_uuid(),
  discord_message_id text not null unique,
  discord_user_id text not null,
  mensaje_usuario text not null,
  respuesta_bot text not null,
  modelo_usado text not null,
  created_at timestamptz not null default now()
);

alter table mensajes_bot
  add column if not exists modelo_usado text not null default 'desconocido';

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  mensaje_id uuid not null references mensajes_bot(id) on delete cascade,
  discord_user_id text not null,
  voto text not null check (voto in ('positivo', 'negativo')),
  motivo text,
  created_at timestamptz not null default now(),
  unique (mensaje_id, discord_user_id)
);

create table if not exists ejemplos_estilo (
  id uuid primary key default gen_random_uuid(),
  entrada text not null,
  respuesta_ideal text not null,
  origen text not null default 'feedback',
  aprobado boolean not null default false,
  creado_por uuid references usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table ejemplos_estilo
  add column if not exists origen text not null default 'feedback';

alter table ejemplos_estilo
  add column if not exists creado_por uuid references usuarios(id) on delete set null;

create unique index if not exists ejemplos_estilo_contenido_uq
  on ejemplos_estilo (digest(entrada || chr(31) || respuesta_ideal, 'sha256'));

create index if not exists ejemplos_estilo_aprobado_idx
  on ejemplos_estilo (created_at desc)
  where aprobado = true;

create index if not exists ejemplos_estilo_creado_por_idx
  on ejemplos_estilo (creado_por, created_at desc)
  where creado_por is not null;

create index if not exists feedback_created_at_idx
  on feedback (created_at desc);

create index if not exists feedback_discord_user_id_idx
  on feedback (discord_user_id);

create table if not exists importaciones_mensajes (
  id uuid primary key default gen_random_uuid(),
  nombre_archivo text not null,
  formato text not null check (formato in ('txt', 'json', 'csv')),
  nombre_objetivo text not null,
  contenido text not null,
  aportado_por uuid not null references usuarios(id) on delete restrict,
  creado_por uuid not null references usuarios(id) on delete restrict,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'analizando', 'listo', 'error')),
  resumen text,
  patrones jsonb not null default '[]'::jsonb,
  error text,
  analisis_iniciado_at timestamptz,
  analizado_at timestamptz,
  created_at timestamptz not null default now()
);

alter table importaciones_mensajes
  add column if not exists analisis_iniciado_at timestamptz;

create index if not exists importaciones_mensajes_aportado_por_idx
  on importaciones_mensajes (aportado_por);

create index if not exists importaciones_mensajes_creado_por_idx
  on importaciones_mensajes (creado_por);

create index if not exists importaciones_mensajes_estado_created_at_idx
  on importaciones_mensajes (estado, created_at desc);

create table if not exists propuestas_entrenamiento (
  id uuid primary key default gen_random_uuid(),
  importacion_id uuid not null references importaciones_mensajes(id) on delete cascade,
  entrada text not null,
  respuesta_ideal text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada')),
  ejemplo_id uuid references ejemplos_estilo(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists propuestas_entrenamiento_contenido_uq
  on propuestas_entrenamiento (
    importacion_id,
    digest(entrada || chr(31) || respuesta_ideal, 'sha256')
  );

create index if not exists propuestas_entrenamiento_importacion_id_idx
  on propuestas_entrenamiento (importacion_id, created_at desc);

create index if not exists propuestas_entrenamiento_ejemplo_id_idx
  on propuestas_entrenamiento (ejemplo_id)
  where ejemplo_id is not null;

alter table mensajes_bot enable row level security;
alter table feedback enable row level security;
alter table ejemplos_estilo enable row level security;
alter table importaciones_mensajes enable row level security;
alter table propuestas_entrenamiento enable row level security;
