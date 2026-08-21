import "dotenv/config";

import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";

import { configuracion } from "../src/config/env.js";
import { registrarUsuario } from "../src/db/repository.js";
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
  return { "Content-Type": "application/json; charset=utf-8" };
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

    if (solicitud.method === "GET" && ruta === "/api/health") {
      responderJson(respuesta, 200, { estado: "ok" });
      return;
    }

    if (solicitud.method === "GET" && ruta === "/api/me") {
      responderJson(respuesta, 200, { usuario: leerCookieSesion(solicitud) });
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
