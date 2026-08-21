import "dotenv/config";

import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";

import { configuracion } from "../src/config/env.js";
import {
  actualizarAprobacionEjemplo,
  crearEjemploManual,
  listarEjemplosPanel,
  listarEntrenadores,
  obtenerAnaliticasEntrenamiento,
  obtenerUsuarioPorDiscordId,
  registrarUsuario,
} from "../src/db/repository.js";
import type { UsuarioEntrenador } from "../src/types/index.js";

const directorioWeb = resolve(process.cwd(), "web");
const nombreCookie = "pokebot_sesion";

interface Sesion {
  discordUserId: string;
  nombre: string;
  avatarUrl: string | null;
  rol: UsuarioEntrenador["rol"];
  puedeEntrenar: boolean;
}

function encabezadosJson(): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

function responderJson(
  respuesta: ServerResponse,
  estado: number,
  contenido: unknown,
): void {
  respuesta.writeHead(estado, encabezadosJson());
  respuesta.end(JSON.stringify(contenido));
}

function redirigir(respuesta: ServerResponse, destino: string): void {
  respuesta.writeHead(302, { Location: destino });
  respuesta.end();
}

function crearCookieSesion(sesion: Sesion): string {
  const contenido = Buffer.from(JSON.stringify(sesion)).toString("base64url");
  const firma = createHmac("sha256", configuracion.sessionSecret())
    .update(contenido)
    .digest("base64url");

  return `${contenido}.${firma}`;
}

function leerCookieSesion(solicitud: IncomingMessage): Sesion | null {
  const cookies = solicitud.headers.cookie?.split(";") ?? [];
  const cookie = cookies
    .map((valor) => valor.trim().split("="))
    .find(([nombre]) => nombre === nombreCookie)?.[1];

  if (!cookie) {
    return null;
  }

  const [contenido, firma] = cookie.split(".");

  if (!contenido || !firma) {
    return null;
  }

  const firmaEsperada = createHmac("sha256", configuracion.sessionSecret())
    .update(contenido)
    .digest("base64url");

  if (firma.length !== firmaEsperada.length) {
    return null;
  }

  const firmaValida = timingSafeEqual(
    Buffer.from(firma),
    Buffer.from(firmaEsperada),
  );

  if (!firmaValida) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(contenido, "base64url").toString("utf8")) as Sesion;
  } catch {
    return null;
  }
}

function establecerCookieSesion(
  respuesta: ServerResponse,
  sesion: Sesion,
): void {
  respuesta.setHeader(
    "Set-Cookie",
    `${nombreCookie}=${crearCookieSesion(sesion)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
  );
}

async function obtenerSesionActual(
  solicitud: IncomingMessage,
): Promise<Sesion | null> {
  const sesion = leerCookieSesion(solicitud);

  if (!sesion) {
    return null;
  }

  const usuario = await obtenerUsuarioPorDiscordId(sesion.discordUserId);

  if (!usuario?.puedeEntrenar) {
    return null;
  }

  return {
    ...sesion,
    nombre: usuario.nombre,
    rol: usuario.rol,
    puedeEntrenar: usuario.puedeEntrenar,
  };
}

async function leerJson<T>(solicitud: IncomingMessage): Promise<T> {
  const partes: Buffer[] = [];
  let total = 0;

  for await (const parte of solicitud) {
    const buffer = Buffer.isBuffer(parte) ? parte : Buffer.from(parte);
    total += buffer.length;

    if (total > 64 * 1024) {
      throw new Error("El cuerpo de la petición es demasiado grande.");
    }

    partes.push(buffer);
  }

  return JSON.parse(Buffer.concat(partes).toString("utf8")) as T;
}

function esUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    valor,
  );
}

async function manejarDashboard(
  solicitud: IncomingMessage,
  respuesta: ServerResponse,
): Promise<void> {
  const sesion = await obtenerSesionActual(solicitud);

  if (!sesion) {
    responderJson(respuesta, 401, { error: "Debes iniciar sesión." });
    return;
  }

  const [ejemplos, analiticas, entrenadores] = await Promise.all([
    listarEjemplosPanel(),
    obtenerAnaliticasEntrenamiento(),
    listarEntrenadores(),
  ]);

  responderJson(respuesta, 200, {
    ejemplos,
    analiticas,
    entrenadores,
    caracteristicas: {
      modelo: configuracion.geminiModel(),
      aprendeDeFeedback: true,
      admiteEjemplosManuales: true,
      multiplesEntrenadores: true,
    },
  });
}

async function manejarNuevoEjemplo(
  solicitud: IncomingMessage,
  respuesta: ServerResponse,
): Promise<void> {
  const sesion = await obtenerSesionActual(solicitud);

  if (!sesion) {
    responderJson(respuesta, 401, { error: "No tienes permiso para entrenar." });
    return;
  }

  let contenido: { entrada?: unknown; respuestaIdeal?: unknown };

  try {
    contenido = await leerJson(solicitud);
  } catch {
    responderJson(respuesta, 400, { error: "El contenido enviado no es válido." });
    return;
  }

  const entrada = typeof contenido.entrada === "string" ? contenido.entrada.trim() : "";
  const respuestaIdeal = typeof contenido.respuestaIdeal === "string"
    ? contenido.respuestaIdeal.trim()
    : "";

  if (entrada.length < 2 || entrada.length > 1000) {
    responderJson(respuesta, 400, { error: "El mensaje debe tener entre 2 y 1000 caracteres." });
    return;
  }

  if (respuestaIdeal.length < 1 || respuestaIdeal.length > 2000) {
    responderJson(respuesta, 400, { error: "La respuesta debe tener entre 1 y 2000 caracteres." });
    return;
  }

  const creado = await crearEjemploManual(
    entrada,
    respuestaIdeal,
    sesion.discordUserId,
  );

  if (!creado) {
    responderJson(respuesta, 409, { error: "Ese ejemplo ya existe." });
    return;
  }

  responderJson(respuesta, 201, { ok: true });
}

async function manejarEstadoEjemplo(
  solicitud: IncomingMessage,
  respuesta: ServerResponse,
  id: string,
): Promise<void> {
  const sesion = await obtenerSesionActual(solicitud);

  if (!sesion || sesion.rol !== "administrador") {
    responderJson(respuesta, 403, { error: "Solo el administrador puede cambiar ejemplos." });
    return;
  }

  if (!esUuid(id)) {
    responderJson(respuesta, 400, { error: "El identificador no es válido." });
    return;
  }

  let contenido: { aprobado?: unknown };

  try {
    contenido = await leerJson(solicitud);
  } catch {
    responderJson(respuesta, 400, { error: "El contenido enviado no es válido." });
    return;
  }

  if (typeof contenido.aprobado !== "boolean") {
    responderJson(respuesta, 400, { error: "El estado del ejemplo no es válido." });
    return;
  }

  const actualizado = await actualizarAprobacionEjemplo(id, contenido.aprobado);
  responderJson(
    respuesta,
    actualizado ? 200 : 404,
    actualizado ? { ok: true } : { error: "Ejemplo no encontrado." },
  );
}

async function manejarLoginDiscord(respuesta: ServerResponse): Promise<void> {
  const parametros = new URLSearchParams({
    client_id: configuracion.discordClientId(),
    redirect_uri: `${configuracion.webUrl()}/api/auth/discord/callback`,
    response_type: "code",
    scope: "identify",
  });

  redirigir(
    respuesta,
    `https://discord.com/oauth2/authorize?${parametros.toString()}`,
  );
}

async function manejarCallbackDiscord(
  solicitud: IncomingMessage,
  respuesta: ServerResponse,
): Promise<void> {
  const url = new URL(solicitud.url ?? "/", configuracion.webUrl());
  const codigo = url.searchParams.get("code");

  if (!codigo) {
    responderJson(respuesta, 400, { error: "Falta el código de Discord." });
    return;
  }

  const datosToken = new URLSearchParams({
    client_id: configuracion.discordClientId(),
    client_secret: configuracion.discordClientSecret(),
    grant_type: "authorization_code",
    code: codigo,
    redirect_uri: `${configuracion.webUrl()}/api/auth/discord/callback`,
  });

  const tokenRespuesta = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: datosToken,
  });

  if (!tokenRespuesta.ok) {
    responderJson(respuesta, 502, { error: "Discord rechazó la autenticación." });
    return;
  }

  const token = (await tokenRespuesta.json()) as { access_token: string };
  const usuarioRespuesta = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  if (!usuarioRespuesta.ok) {
    responderJson(respuesta, 502, { error: "No se pudo obtener el usuario de Discord." });
    return;
  }

  const usuarioDiscord = (await usuarioRespuesta.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
    avatar: string | null;
  };
  const avatarUrl = usuarioDiscord.avatar
    ? `https://cdn.discordapp.com/avatars/${usuarioDiscord.id}/${usuarioDiscord.avatar}.webp?size=128`
    : null;
  const usuario = await registrarUsuario(
    usuarioDiscord.id,
    usuarioDiscord.global_name ?? usuarioDiscord.username,
  );

  establecerCookieSesion(respuesta, {
    discordUserId: usuario.discordUserId,
    nombre: usuario.nombre,
    avatarUrl,
    rol: usuario.rol,
    puedeEntrenar: usuario.puedeEntrenar,
  });
  redirigir(respuesta, "/");
}

async function servirInicio(respuesta: ServerResponse): Promise<void> {
  const html = await readFile(resolve(directorioWeb, "index.html"), "utf8");
  respuesta.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  respuesta.end(html);
}

async function servirEstilos(respuesta: ServerResponse): Promise<void> {
  const css = await readFile(resolve(directorioWeb, "styles.css"), "utf8");
  respuesta.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
  respuesta.end(css);
}

async function servirScript(respuesta: ServerResponse): Promise<void> {
  const script = await readFile(resolve(directorioWeb, "app.js"), "utf8");
  respuesta.writeHead(200, {
    "Content-Type": "text/javascript; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  respuesta.end(script);
}

async function servirLogo(respuesta: ServerResponse): Promise<void> {
  const logo = await readFile(resolve(directorioWeb, "assets", "pokebot.jpg"));
  respuesta.writeHead(200, {
    "Content-Type": "image/jpeg",
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  });
  respuesta.end(logo);
}

const servidor = createServer(async (solicitud, respuesta) => {
  try {
    const ruta = new URL(solicitud.url ?? "/", configuracion.webUrl()).pathname;

    if (solicitud.method === "GET" && ruta === "/") {
      await servirInicio(respuesta);
      return;
    }

    if (solicitud.method === "GET" && ruta === "/styles.css") {
      await servirEstilos(respuesta);
      return;
    }

    if (solicitud.method === "GET" && ruta === "/app.js") {
      await servirScript(respuesta);
      return;
    }

    if (solicitud.method === "GET" && ruta === "/assets/pokebot.jpg") {
      await servirLogo(respuesta);
      return;
    }

    if (solicitud.method === "GET" && ruta === "/api/health") {
      responderJson(respuesta, 200, { estado: "ok" });
      return;
    }

    if (solicitud.method === "GET" && ruta === "/api/me") {
      responderJson(respuesta, 200, { usuario: await obtenerSesionActual(solicitud) });
      return;
    }

    if (solicitud.method === "GET" && ruta === "/api/dashboard") {
      await manejarDashboard(solicitud, respuesta);
      return;
    }

    if (solicitud.method === "POST" && ruta === "/api/examples") {
      await manejarNuevoEjemplo(solicitud, respuesta);
      return;
    }

    const coincidenciaEjemplo = ruta.match(/^\/api\/examples\/([^/]+)$/);

    if (solicitud.method === "PATCH" && coincidenciaEjemplo) {
      await manejarEstadoEjemplo(solicitud, respuesta, coincidenciaEjemplo[1]);
      return;
    }

    if (solicitud.method === "GET" && ruta === "/api/auth/discord") {
      await manejarLoginDiscord(respuesta);
      return;
    }

    if (solicitud.method === "GET" && ruta === "/api/auth/discord/callback") {
      await manejarCallbackDiscord(solicitud, respuesta);
      return;
    }

    if (solicitud.method === "POST" && ruta === "/api/auth/logout") {
      respuesta.setHeader(
        "Set-Cookie",
        `${nombreCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
      );
      redirigir(respuesta, "/");
      return;
    }

    responderJson(respuesta, 404, { error: "Ruta no encontrada." });
  } catch (error) {
    console.error("Error en el servidor web:", error);
    responderJson(respuesta, 500, { error: "Error interno del servidor." });
  }
});

servidor.listen(configuracion.webPort(), () => {
  console.log(`Web disponible en ${configuracion.webUrl()}`);
});
