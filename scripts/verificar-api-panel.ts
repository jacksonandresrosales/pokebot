import "dotenv/config";

import { createHmac, randomUUID } from "node:crypto";

import { configuracion } from "../src/config/env.js";
import { obtenerUsuarioPorDiscordId } from "../src/db/repository.js";
import { pool } from "../src/db/client.js";

const entradaPrueba = `prueba-panel-${randomUUID()}`;
const discordIdPrueba = `9${Date.now()}${Math.floor(Math.random() * 100000).toString().padStart(5, "0")}`;

function crearCookie(sesion: {
  discordUserId: string;
  nombre: string;
  rol: "administrador" | "entrenador";
  puedeEntrenar: boolean;
}): string {
  const contenido = Buffer.from(JSON.stringify({ ...sesion, avatarUrl: null })).toString("base64url");
  const firma = createHmac("sha256", configuracion.sessionSecret())
    .update(contenido)
    .digest("base64url");
  return `pokebot_sesion=${contenido}.${firma}`;
}

try {
  const usuario = await obtenerUsuarioPorDiscordId(configuracion.adminDiscordId());

  if (!usuario) {
    throw new Error("El administrador todavía no está registrado en la base de datos.");
  }

  if (usuario.rol !== "administrador" || !usuario.puedeEntrenar) {
    throw new Error("La cuenta principal no tiene acceso administrativo completo.");
  }

  const cookie = crearCookie({
    discordUserId: usuario.discordUserId,
    nombre: usuario.nombre,
    rol: usuario.rol,
    puedeEntrenar: usuario.puedeEntrenar,
  });
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


  const nuevoEntrenador = await fetch(`${configuracion.webUrl()}/api/trainers`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      discordUserId: discordIdPrueba,
      nombre: "Entrenador temporal",
      rol: "entrenador",
      importancia: 4,
    }),
  });

  if (nuevoEntrenador.status !== 201) {
    throw new Error(`La autorización respondió con estado ${nuevoEntrenador.status}.`);
  }

  const entrenadorCreado = (await nuevoEntrenador.json()) as {
    entrenador: {
      id: string;
      nombre: string;
      rol: "administrador" | "entrenador";
      puedeEntrenar: boolean;
      importancia: number;
    };
  };
  const cookieEntrenador = crearCookie({
    discordUserId: discordIdPrueba,
    nombre: entrenadorCreado.entrenador.nombre,
    rol: "entrenador",
    puedeEntrenar: true,
  });
  const intentoSinPermiso = await fetch(
    `${configuracion.webUrl()}/api/trainers/${entrenadorCreado.entrenador.id}`,
    {
      method: "PATCH",
      headers: {
        Cookie: cookieEntrenador,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rol: "administrador",
        puedeEntrenar: true,
        importancia: 5,
      }),
    },
  );

  if (intentoSinPermiso.status !== 403) {
    throw new Error("Un entrenador sin rol administrativo pudo cambiar permisos.");
  }

  const cambioEntrenador = await fetch(
    `${configuracion.webUrl()}/api/trainers/${entrenadorCreado.entrenador.id}`,
    {
      method: "PATCH",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rol: "administrador",
        puedeEntrenar: true,
        importancia: 5,
      }),
    },
  );

  if (!cambioEntrenador.ok) {
    throw new Error(`El cambio de permisos respondió con estado ${cambioEntrenador.status}.`);
  }

  const cookieAdministradorTemporal = crearCookie({
    discordUserId: discordIdPrueba,
    nombre: entrenadorCreado.entrenador.nombre,
    rol: "administrador",
    puedeEntrenar: true,
  });
  const cambioComoAdministrador = await fetch(
    `${configuracion.webUrl()}/api/trainers/${entrenadorCreado.entrenador.id}`,
    {
      method: "PATCH",
      headers: {
        Cookie: cookieAdministradorTemporal,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rol: "administrador",
        puedeEntrenar: true,
        importancia: 4,
      }),
    },
  );

  if (!cambioComoAdministrador.ok) {
    throw new Error("Un administrador secundario no pudo gestionar permisos.");
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
      entrenadorCreado: nuevoEntrenador.status === 201,
      entrenadorRestringido: intentoSinPermiso.status === 403,
      administradorSecundario: cambioComoAdministrador.ok,
      importanciaActualizada: (
        await pool.query<{ importancia: number }>(
          `select importancia::int from usuarios where discord_user_id = $1`,
          [discordIdPrueba],
        )
      ).rows[0]?.importancia === 4,
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
  await pool.query(
    `delete from usuarios where discord_user_id = $1`,
    [discordIdPrueba],
  );
  await pool.end();
}
