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
