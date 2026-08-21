import "dotenv/config";

import { createHmac, randomUUID } from "node:crypto";

import { configuracion } from "../src/config/env.js";
import { obtenerUsuarioPorDiscordId, registrarUsuario } from "../src/db/repository.js";
import { pool } from "../src/db/client.js";

const entradaPrueba = `prueba-panel-${randomUUID()}`;
const rasgoPrueba = `A Poke le gusta la música de prueba ${randomUUID()}.`;
const archivoMensajesPrueba = `mensajes-panel-${randomUUID()}.txt`;
const archivoMensajesEntrenadorPrueba = `mensajes-entrenador-${randomUUID()}.txt`;
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
    entrenadores: Array<{ id: string; esPrincipal: boolean }>;
    importaciones: unknown[];
    propuestas: unknown[];
    analiticas: { mensajes: number };
  };
  const administradorPrincipal = panelInicial.entrenadores.find(
    (entrenador) => entrenador.esPrincipal,
  );

  if (!administradorPrincipal) {
    throw new Error("El panel no devolvió al administrador principal.");
  }

  const importacion = await fetch(`${configuracion.webUrl()}/api/message-imports`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nombreArchivo: archivoMensajesPrueba,
      formato: "txt",
      nombreObjetivo: "Poke",
      aportadoPorId: administradorPrincipal.id,
      texto: "Andre: vas a entrar?\nPoke: ya voy oe",
    }),
  });

  if (importacion.status !== 201) {
    throw new Error(`La importación respondió con estado ${importacion.status}.`);
  }

  const importacionDemasiadoGrande = await fetch(
    `${configuracion.webUrl()}/api/message-imports`,
    {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nombreArchivo: "demasiado-grande.txt",
        formato: "txt",
        nombreObjetivo: "Poke",
        aportadoPorId: administradorPrincipal.id,
        texto: "x".repeat(2 * 1024 * 1024 + 1),
      }),
    },
  );

  if (importacionDemasiadoGrande.status !== 413) {
    throw new Error(
      `Un archivo de más de 2 MB respondió con estado ${importacionDemasiadoGrande.status}.`,
    );
  }

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

  const creacionRasgo = await fetch(`${configuracion.webUrl()}/api/traits`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contenido: rasgoPrueba }),
  });

  if (creacionRasgo.status !== 201) {
    throw new Error(`La creación del rasgo respondió con estado ${creacionRasgo.status}.`);
  }

  const perfilVisitante = await registrarUsuario(
    discordIdPrueba,
    "Entrenador temporal",
    "https://cdn.discordapp.com/embed/avatars/0.png",
  );

  if (perfilVisitante.puedeEntrenar || !perfilVisitante.avatarUrl) {
    throw new Error("El perfil visitante no quedó registrado como pendiente.");
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
  const importacionEntrenador = await fetch(`${configuracion.webUrl()}/api/message-imports`, {
    method: "POST",
    headers: {
      Cookie: cookieEntrenador,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nombreArchivo: archivoMensajesEntrenadorPrueba,
      formato: "txt",
      nombreObjetivo: "Poke",
      aportadoPorId: "",
      texto: "Poke: aporte de un entrenador autorizado",
    }),
  });

  if (importacionEntrenador.status !== 201) {
    throw new Error(
      `Un entrenador autorizado no pudo importar mensajes: ${importacionEntrenador.status}.`,
    );
  }
  const completarTutorial = await fetch(
    `${configuracion.webUrl()}/api/onboarding/complete`,
    { method: "POST", headers: { Cookie: cookieEntrenador } },
  );

  if (!completarTutorial.ok) {
    throw new Error(`El tutorial respondió con estado ${completarTutorial.status}.`);
  }

  const panelEntrenador = await fetch(`${configuracion.webUrl()}/api/dashboard`, {
    headers: { Cookie: cookieEntrenador },
  });
  const datosEntrenador = (await panelEntrenador.json()) as {
    tutorialCompletado: boolean;
  };

  if (!datosEntrenador.tutorialCompletado) {
    throw new Error("El panel no guardó el tutorial completado del entrenador.");
  }
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
    rasgos: Array<{ id: string; contenido: string; activo: boolean }>;
  };
  const ejemplo = panelActualizado.ejemplos.find(
    (item) => item.entrada === entradaPrueba,
  );

  if (!ejemplo) {
    throw new Error("El ejemplo temporal no apareció en el panel.");
  }

  const rasgo = panelActualizado.rasgos.find((item) => item.contenido === rasgoPrueba);

  if (!rasgo) {
    throw new Error("El rasgo temporal no apareció en el panel.");
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

  const pausaRasgo = await fetch(
    `${configuracion.webUrl()}/api/traits/${rasgo.id}`,
    {
      method: "PATCH",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ activo: false }),
    },
  );

  if (!pausaRasgo.ok) {
    throw new Error(`La pausa del rasgo respondió con estado ${pausaRasgo.status}.`);
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
      rasgoCreado: creacionRasgo.status === 201,
      rasgoPausado: (
        await pool.query<{ activo: boolean }>(
          `select activo from rasgos_comportamiento where id = $1`,
          [rasgo.id],
        )
      ).rows[0]?.activo === false,
      entrenadorCreado: nuevoEntrenador.status === 201,
      perfilPendienteRegistrado: !perfilVisitante.puedeEntrenar
        && Boolean(perfilVisitante.avatarUrl),
      tutorialCompletado: datosEntrenador.tutorialCompletado,
      entrenadorRestringido: intentoSinPermiso.status === 403,
      administradorSecundario: cambioComoAdministrador.ok,
      importanciaActualizada: (
        await pool.query<{ importancia: number }>(
          `select importancia::int from usuarios where discord_user_id = $1`,
          [discordIdPrueba],
        )
      ).rows[0]?.importancia === 4,
      importacionCreada: importacion.status === 201,
      importacionEntrenador: importacionEntrenador.status === 201,
      archivoGrandeRechazado: importacionDemasiadoGrande.status === 413,
      datosMensajesVisibles: Array.isArray(panelInicial.importaciones)
        && Array.isArray(panelInicial.propuestas),
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
    `delete from rasgos_comportamiento where contenido = $1`,
    [rasgoPrueba],
  );
  await pool.query(
    `delete from importaciones_mensajes where nombre_archivo = $1`,
    [archivoMensajesPrueba],
  );
  await pool.query(
    `delete from importaciones_mensajes where nombre_archivo = $1`,
    [archivoMensajesEntrenadorPrueba],
  );
  await pool.query(
    `delete from usuarios where discord_user_id = $1`,
    [discordIdPrueba],
  );
  await pool.end();
}
