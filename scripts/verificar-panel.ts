import "dotenv/config";

import {
  listarEjemplosPanel,
  listarEntrenadores,
  obtenerAnaliticasEntrenamiento,
} from "../src/db/repository.js";
import { pool } from "../src/db/client.js";

try {
  const [analiticas, ejemplos, entrenadores, columna] = await Promise.all([
    obtenerAnaliticasEntrenamiento(),
    listarEjemplosPanel(3),
    listarEntrenadores(),
    pool.query(
      `
        select column_name
        from information_schema.columns
        where table_name = $1
          and column_name = $2
      `,
      ["ejemplos_estilo", "creado_por"],
    ),
  ]);

  console.log(
    JSON.stringify({
      analiticas,
      ejemplosConsultados: ejemplos.length,
      entrenadores: entrenadores.length,
      columnaCreadoPor: columna.rowCount === 1,
    }),
  );
} finally {
  await pool.end();
}
