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
  const seguridadMensajes = await pool.query<{
    tablas: number;
    protegidas: boolean;
  }>(
    `
      select
        count(*)::int as tablas,
        bool_and(relrowsecurity) as protegidas
      from pg_class
      where oid in (
        'public.importaciones_mensajes'::regclass,
        'public.propuestas_entrenamiento'::regclass
      )
    `,
  );
  const clavesSinIndice = await pool.query(
    `
      select 1
      from pg_constraint as restriccion
      join pg_attribute as columna
        on columna.attrelid = restriccion.conrelid
        and columna.attnum = any(restriccion.conkey)
      where restriccion.contype = 'f'
        and restriccion.conrelid in (
          'public.importaciones_mensajes'::regclass,
          'public.propuestas_entrenamiento'::regclass
        )
        and not exists (
          select 1
          from pg_index as indice
          where indice.indrelid = restriccion.conrelid
            and columna.attnum = any(indice.indkey)
        )
    `,
  );

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
      tablasMensajesConRls: seguridadMensajes.rows[0]?.tablas === 2
        && seguridadMensajes.rows[0]?.protegidas,
      clavesForaneasMensajesConIndice: clavesSinIndice.rowCount === 0,
    }),
  );
} finally {
  await pool.end();
}
