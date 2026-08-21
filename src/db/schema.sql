-- Esquema inicial para mensajes, feedback y ejemplos aprobados.

create table if not exists mensajes_bot (
  id uuid primary key default gen_random_uuid(),
  discord_message_id text not null unique,
  discord_user_id text not null,
  mensaje_usuario text not null,
  respuesta_bot text not null,
  created_at timestamptz not null default now()
);

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
  aprobado boolean not null default false,
  created_at timestamptz not null default now()
);
