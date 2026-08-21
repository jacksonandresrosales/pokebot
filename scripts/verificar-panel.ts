import "dotenv/config";

import {
  listarEjemplosPanel,
  listarEntrenadores,
  obtenerAnaliticasEntrenamiento,
  registrarFeedback,
} from "../src/db/repository.js";
import { pool } from "../src/db/client.js";

try {
  const [analiticas, ejemplos, entrenadores, columnas, indiceFeedback, restriccion] = await Promise.all([
    obtenerAnaliticasEntrenamiento(),
    listarEjemplosPanel(3),
    listarEntrenadores(),
    pool.query<{ column_name: string }>(
      `
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = $1
          and column_name = any($2::text[])
      `,
      ["usuarios", ["importancia"]],
    ),
    pool.query(
      `
        select 1
        from pg_indexes
        where schemaname = 'public'
          and indexname = 'feedback_discord_user_id_idx'
      `,
    ),
    pool.query(
      `
        select 1
        from pg_constraint
        where conrelid = 'public.usuarios'::regclass
          and contype = 'c'
          and pg_get_constraintdef(oid) like '%importancia%'
      `,
    ),
  ]);

  const mensaje = await pool.query<{ discord_message_id: string }>(
    `select discord_message_id from mensajes_bot order by created_at desc limit 1`,
  );
  const feedbackNoAutorizado = mensaje.rows[0]
    ? await registrarFeedback(
        mensaje.rows[0].discord_message_id,
        "verificador-no-autorizado",
        "positivo",
      )
    : null;

  console.log(
    JSON.stringify({
      analiticas,
      ejemplosConsultados: ejemplos.length,
      entrenadores: entrenadores.length,
      columnaImportancia: columnas.rowCount === 1,
      indiceFeedback: indiceFeedback.rowCount === 1,
      restriccionImportancia: restriccion.rowCount === 1,
      administradorPrincipal: entrenadores.some(
        (entrenador) => entrenador.esPrincipal
          && entrenador.rol === "administrador"
          && entrenador.puedeEntrenar,
      ),
      feedbackNoAutorizadoBloqueado: feedbackNoAutorizado?.autorizado === false,
    }),
  );
} finally {
  await pool.end();
}
