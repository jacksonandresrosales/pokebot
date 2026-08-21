import "dotenv/config";

import { readFile } from "node:fs/promises";

import { pool } from "../src/db/client.js";

async function main(): Promise<void> {
  const esquema = await readFile("src/db/schema.sql", "utf8");
  await pool.query(esquema);

  const resultado = await pool.query<{ table_name: string }>(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('mensajes_bot', 'feedback', 'ejemplos_estilo')
      order by table_name
    `,
  );

  console.log(
    "Esquema aplicado. Tablas verificadas:",
    resultado.rows.map((fila) => fila.table_name).join(", "),
  );
}

try {
  await main();
} finally {
  await pool.end();
}
