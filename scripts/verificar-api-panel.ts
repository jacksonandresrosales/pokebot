import "dotenv/config";

import { createHmac, randomUUID } from "node:crypto";

import { configuracion } from "../src/config/env.js";
import { obtenerUsuarioPorDiscordId } from "../src/db/repository.js";
import { pool } from "../src/db/client.js";

const entradaPrueba = `prueba-panel-${randomUUID()}`;

try {
  const usuario = await obtenerUsuarioPorDiscordId(configuracion.adminDiscordId());

  if (!usuario) {
    throw new Error("El administrador todavía no está registrado en la base de datos.");
  }

  const sesion = {
    discordUserId: usuario.discordUserId,
    nombre: usuario.nombre,
    avatarUrl: null,
    rol: usuario.rol,
    puedeEntrenar: usuario.puedeEntrenar,
  };
  const contenido = Buffer.from(JSON.stringify(sesion)).toString("base64url");
  const firma = createHmac("sha256", configuracion.sessionSecret())
    .update(contenido)
    .digest("base64url");
  const cookie = `pokebot_sesion=${contenido}.${firma}`;
  const respuesta = await fetch(`${configuracion.webUrl()}/api/dashboard`, {
    headers: { Cookie: cookie },
  });

  if (!respuesta.ok) {
    throw new Error(`El panel respondió con estado ${respuesta.status}.`);
  }

  const panelInicial = (await respuesta.json()) as {
    ejemplos: unknown[];
    entrenadores: unknown[];
    analiticas: { mensajes: number };
  };

  const creacion = await fetch(`${configuracion.webUrl()}/api/examples`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      entrada: entradaPrueba,
      respuestaIdeal: "respuesta temporal de verificación",
    }),
  });

  if (creacion.status !== 201) {
    throw new Error(`La creación respondió con estado ${creacion.status}.`);
  }

  const panelActualizadoRespuesta = await fetch(
    `${configuracion.webUrl()}/api/dashboard`,
    { headers: { Cookie: cookie } },
  );
  const panelActualizado = (await panelActualizadoRespuesta.json()) as {
    ejemplos: Array<{ id: string; entrada: string; aprobado: boolean }>;
  };
  const ejemplo = panelActualizado.ejemplos.find(
    (item) => item.entrada === entradaPrueba,
  );

  if (!ejemplo) {
    throw new Error("El ejemplo temporal no apareció en el panel.");
  }

  const pausa = await fetch(
    `${configuracion.webUrl()}/api/examples/${ejemplo.id}`,
    {
      method: "PATCH",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ aprobado: false }),
    },
  );

  if (!pausa.ok) {
    throw new Error(`La pausa respondió con estado ${pausa.status}.`);
  }

  const estado = await pool.query<{ aprobado: boolean }>(
    `
      select aprobado
      from ejemplos_estilo
      where id = $1
    `,
    [ejemplo.id],
  );

  console.log(
    JSON.stringify({
      estado: respuesta.status,
      ejemplosIniciales: panelInicial.ejemplos.length,
      entrenadores: panelInicial.entrenadores.length,
      mensajes: panelInicial.analiticas.mensajes,
      creacion: creacion.status,
      ejemploPausado: estado.rows[0]?.aprobado === false,
    }),
  );
} finally {
  await pool.query(
    `
      delete from ejemplos_estilo
      where entrada = $1
        and origen = 'manual'
    `,
    [entradaPrueba],
  );
  await pool.end();
}
