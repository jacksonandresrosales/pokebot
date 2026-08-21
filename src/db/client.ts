import { Pool } from "pg";

import { configuracion } from "../config/env.js";

export const pool = new Pool({
  connectionString: configuracion.databaseUrl(),
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Mantiene TLS activo; el certificado raíz se configurará antes de producción.
  ssl: { rejectUnauthorized: false },
});

export async function verificarConexion(): Promise<void> {
  await pool.query("select 1 as conectado");
}
