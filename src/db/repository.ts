import { pool } from "./client.js";

import { configuracion } from "../config/env.js";
import type {
  EjemploDeEstilo,
  UsuarioEntrenador,
  Voto,
} from "../types/index.js";

interface NuevoMensajeBot {
  discordMessageId: string;
  discordUserId: string;
  mensajeUsuario: string;
  respuestaBot: string;
  modeloUsado: string;
}

interface ResultadoFeedback {
  encontrado: boolean;
  aceptado: boolean;
  positivos: number;
  negativos: number;
}

export interface EjemploPanel {
  id: string;
  entrada: string;
  respuestaIdeal: string;
  origen: string;
  aprobado: boolean;
  creadoPor: string | null;
  createdAt: Date;
}

export interface PuntoFeedback {
  fecha: string;
  positivos: number;
  negativos: number;
}

export interface AnaliticasEntrenamiento {
  mensajes: number;
  positivos: number;
  negativos: number;
  ejemplosAprobados: number;
  ejemplosManuales: number;
  entrenadores: number;
  tendencia: PuntoFeedback[];
}

export interface EntrenadorPanel {
  nombre: string;
  rol: UsuarioEntrenador["rol"];
  puedeEntrenar: boolean;
  consentimiento: boolean;
}

export async function obtenerEjemplosEstilo(
  limite = 5,
): Promise<EjemploDeEstilo[]> {
  const limiteSeguro = Math.min(Math.max(Math.trunc(limite), 1), 10);
  const resultado = await pool.query<EjemploDeEstilo>(
    `
      select entrada, respuesta_ideal as "respuestaIdeal"
      from ejemplos_estilo
      where aprobado = true
      order by created_at desc
      limit $1
    `,
    [limiteSeguro],
  );

  return resultado.rows;
}

export async function guardarMensajeBot(mensaje: NuevoMensajeBot): Promise<void> {
  await pool.query(
    `
      insert into mensajes_bot (
        discord_message_id,
        discord_user_id,
        mensaje_usuario,
        respuesta_bot,
        modelo_usado
      ) values ($1, $2, $3, $4, $5)
      on conflict (discord_message_id) do nothing
    `,
    [
      mensaje.discordMessageId,
      mensaje.discordUserId,
      mensaje.mensajeUsuario,
      mensaje.respuestaBot,
      mensaje.modeloUsado,
    ],
  );
}

export async function obtenerUsuarioPorDiscordId(
  discordUserId: string,
): Promise<UsuarioEntrenador | null> {
  const resultado = await pool.query<UsuarioEntrenador>(
    `
      select
        id,
        discord_user_id as "discordUserId",
        nombre,
        rol,
        puede_entrenar as "puedeEntrenar",
        consentimiento
      from usuarios
      where discord_user_id = $1
      limit 1
    `,
    [discordUserId],
  );

  return resultado.rows[0] ?? null;
}

export async function crearEjemploManual(
  entrada: string,
  respuestaIdeal: string,
  discordUserId: string,
): Promise<boolean> {
  const resultado = await pool.query(
    `
      insert into ejemplos_estilo (
        entrada,
        respuesta_ideal,
        origen,
        aprobado,
        creado_por
      )
      select $1, $2, 'manual', true, usuarios.id
      from usuarios
      where discord_user_id = $3
        and puede_entrenar = true
      on conflict do nothing
      returning id
    `,
    [entrada, respuestaIdeal, discordUserId],
  );

  return resultado.rowCount === 1;
}

export async function listarEjemplosPanel(limite = 50): Promise<EjemploPanel[]> {
  const limiteSeguro = Math.min(Math.max(Math.trunc(limite), 1), 100);
  const resultado = await pool.query<EjemploPanel>(
    `
      select
        ejemplos_estilo.id,
        ejemplos_estilo.entrada,
        ejemplos_estilo.respuesta_ideal as "respuestaIdeal",
        ejemplos_estilo.origen,
        ejemplos_estilo.aprobado,
        usuarios.nombre as "creadoPor",
        ejemplos_estilo.created_at as "createdAt"
      from ejemplos_estilo
      left join usuarios on usuarios.id = ejemplos_estilo.creado_por
      order by ejemplos_estilo.created_at desc
      limit $1
    `,
    [limiteSeguro],
  );

  return resultado.rows;
}

export async function actualizarAprobacionEjemplo(
  id: string,
  aprobado: boolean,
): Promise<boolean> {
  const resultado = await pool.query(
    `
      update ejemplos_estilo
      set aprobado = $2
      where id = $1
      returning id
    `,
    [id, aprobado],
  );

  return resultado.rowCount === 1;
}

export async function obtenerAnaliticasEntrenamiento(): Promise<AnaliticasEntrenamiento> {
  const [resumen, tendencia] = await Promise.all([
    pool.query<Omit<AnaliticasEntrenamiento, "tendencia">>(
      `
        select
          (select count(*)::int from mensajes_bot) as mensajes,
          (select count(*)::int from feedback where voto = 'positivo') as positivos,
          (select count(*)::int from feedback where voto = 'negativo') as negativos,
          (
            select count(*)::int
            from ejemplos_estilo
            where aprobado = true
          ) as "ejemplosAprobados",
          (
            select count(*)::int
            from ejemplos_estilo
            where origen = 'manual'
          ) as "ejemplosManuales",
          (
            select count(*)::int
            from usuarios
            where puede_entrenar = true
          ) as entrenadores
      `,
    ),
    pool.query<PuntoFeedback>(
      `
        select
          to_char(dia, 'YYYY-MM-DD') as fecha,
          count(feedback.id) filter (where feedback.voto = 'positivo')::int as positivos,
          count(feedback.id) filter (where feedback.voto = 'negativo')::int as negativos
        from generate_series(
          current_date - interval '6 days',
          current_date,
          interval '1 day'
        ) as dia
        left join feedback
          on feedback.created_at >= dia
          and feedback.created_at < dia + interval '1 day'
        group by dia
        order by dia
      `,
    ),
  ]);

  return {
    ...resumen.rows[0],
    tendencia: tendencia.rows,
  };
}

export async function listarEntrenadores(): Promise<EntrenadorPanel[]> {
  const resultado = await pool.query<EntrenadorPanel>(
    `
      select
        nombre,
        rol,
        puede_entrenar as "puedeEntrenar",
        consentimiento
      from usuarios
      order by
        case when rol = 'administrador' then 0 else 1 end,
        nombre asc
    `,
  );

  return resultado.rows;
}

export async function registrarUsuario(
  discordUserId: string,
  nombre: string,
): Promise<UsuarioEntrenador> {
  const esAdministrador = discordUserId === configuracion.adminDiscordId();
  const resultado = await pool.query<UsuarioEntrenador>(
    `
      insert into usuarios (
        discord_user_id,
        nombre,
        rol,
        puede_entrenar
      ) values ($1, $2, $3, true)
      on conflict (discord_user_id) do update set
        nombre = excluded.nombre,
        rol = case
          when usuarios.rol = 'administrador' then usuarios.rol
          when excluded.rol = 'administrador' then excluded.rol
          else usuarios.rol
        end
      returning
        id,
        discord_user_id as "discordUserId",
        nombre,
        rol,
        puede_entrenar as "puedeEntrenar",
        consentimiento
    `,
    [discordUserId, nombre, esAdministrador ? "administrador" : "entrenador"],
  );

  return resultado.rows[0];
}

export async function registrarFeedback(
  discordMessageId: string,
  discordUserId: string,
  voto: Voto,
): Promise<ResultadoFeedback> {
  const mensaje = await pool.query<{
    id: string;
    mensaje_usuario: string;
    respuesta_bot: string;
  }>(
    `
      select id, mensaje_usuario, respuesta_bot
      from mensajes_bot
      where discord_message_id = $1
    `,
    [discordMessageId],
  );

  if (mensaje.rowCount === 0) {
    return {
      encontrado: false,
      aceptado: false,
      positivos: 0,
      negativos: 0,
    };
  }

  const insercion = await pool.query(
    `
      insert into feedback (mensaje_id, discord_user_id, voto)
      values ($1, $2, $3)
      on conflict (mensaje_id, discord_user_id) do nothing
      returning id
    `,
    [mensaje.rows[0].id, discordUserId, voto],
  );

  if (insercion.rowCount === 1 && voto === "positivo") {
    await pool.query(
      `
        insert into ejemplos_estilo (
          entrada,
          respuesta_ideal,
          origen,
          aprobado
        ) values ($1, $2, 'feedback', true)
        on conflict do nothing
      `,
      [mensaje.rows[0].mensaje_usuario, mensaje.rows[0].respuesta_bot],
    );
  }

  const conteo = await pool.query<{ voto: Voto; total: string }>(
    `
      select voto, count(*)::text as total
      from feedback
      where mensaje_id = $1
      group by voto
    `,
    [mensaje.rows[0].id],
  );

  const conteos = { positivos: 0, negativos: 0 };

  for (const fila of conteo.rows) {
    if (fila.voto === "positivo") {
      conteos.positivos = Number(fila.total);
    } else {
      conteos.negativos = Number(fila.total);
    }
  }

  return {
    encontrado: true,
    aceptado: insercion.rowCount === 1,
    ...conteos,
  };
}
