import { pool } from "./client.js";

import type { Voto } from "../types/index.js";

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

export async function registrarFeedback(
  discordMessageId: string,
  discordUserId: string,
  voto: Voto,
): Promise<ResultadoFeedback> {
  const mensaje = await pool.query<{ id: string }>(
    "select id from mensajes_bot where discord_message_id = $1",
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
