import "dotenv/config";

import { randomUUID } from "node:crypto";

import {
  analizarMensajesConGemini,
  ocultarDatosSensibles,
} from "../src/ai/message-analysis.js";
import { configuracion } from "../src/config/env.js";
import { pool } from "../src/db/client.js";
import {
  actualizarEstadoPropuesta,
  crearImportacionMensajes,
  guardarAnalisisImportacion,
  iniciarAnalisisImportacion,
  listarPropuestasEntrenamiento,
  obtenerUsuarioPorDiscordId,
} from "../src/db/repository.js";

const marcador = `verificacion-${randomUUID()}`;
const archivo = `${marcador}.txt`;
let importacionId: string | null = null;

try {
  const administrador = await obtenerUsuarioPorDiscordId(
    configuracion.adminDiscordId(),
  );

  if (!administrador) {
    throw new Error("No existe el administrador principal.");
  }

  const conversacion = `
Andre: ${marcador} vas a entrar hoy? correo prueba@example.com
Poke: ya voy oe dame chance
Andre: tienes hambre? https://example.com/secreto
Poke: full ñaño
  `.trim();
  const contenidoSeguro = ocultarDatosSensibles(conversacion);
  importacionId = await crearImportacionMensajes(
    archivo,
    "txt",
    "Poke",
    contenidoSeguro,
    administrador.id,
    administrador.discordUserId,
  );

  if (!importacionId) {
    throw new Error("No se pudo crear la importación temporal.");
  }

  const importacion = await iniciarAnalisisImportacion(importacionId);

  if (!importacion) {
    throw new Error("No se pudo iniciar el análisis temporal.");
  }

  const analisis = await analizarMensajesConGemini(
    importacion.contenido,
    importacion.nombreObjetivo,
  );

  if (analisis.propuestas.length === 0) {
    throw new Error("Gemini no produjo propuestas para la conversación de prueba.");
  }

  await guardarAnalisisImportacion(
    importacionId,
    analisis.resumen,
    analisis.patrones,
    analisis.propuestas,
  );
  const propuestas = (await listarPropuestasEntrenamiento()).filter(
    (propuesta) => propuesta.importacionId === importacionId,
  );
  const aprobada = await actualizarEstadoPropuesta(
    propuestas[0].id,
    "aprobada",
  );
  const privacidad = await pool.query<{ contenido: string }>(
    `select contenido from importaciones_mensajes where id = $1`,
    [importacionId],
  );

  console.log(JSON.stringify({
    propuestas: propuestas.length,
    patrones: analisis.patrones.length,
    aprobacion: aprobada,
    correoOculto: !privacidad.rows[0].contenido.includes("prueba@example.com"),
    enlaceOculto: !privacidad.rows[0].contenido.includes("example.com/secreto"),
  }));
} finally {
  if (importacionId) {
    await pool.query(
      `
        delete from ejemplos_estilo
        where id in (
          select ejemplo_id
          from propuestas_entrenamiento
          where importacion_id = $1
            and ejemplo_id is not null
        )
      `,
      [importacionId],
    );
    await pool.query(
      `delete from importaciones_mensajes where id = $1`,
      [importacionId],
    );
  }

  await pool.end();
}
