import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";

import { generarRespuesta, obtenerModeloUsado } from "../ai/gemini.js";
import { configuracion } from "../config/env.js";
import { verificarConexion } from "../db/client.js";
import {
  guardarMensajeBot,
  obtenerEjemplosEstilo,
  registrarFeedback,
} from "../db/repository.js";
import type { EjemploDeEstilo } from "../types/index.js";
import {
  crearBotonesDeFeedback,
  obtenerVotoDesdeBoton,
} from "./feedback.js";

export async function iniciarBot(): Promise<void> {
  const cliente = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  cliente.once(Events.ClientReady, (clienteListo) => {
    console.log(`Bot conectado como ${clienteListo.user.tag}`);
  });

  cliente.on(Events.MessageCreate, async (mensaje) => {
    if (mensaje.author.bot || !mensaje.mentions.has(cliente.user!)) {
      return;
    }

    const texto = mensaje.content
      .replace(new RegExp(`<@!?${cliente.user!.id}>`, "g"), "")
      .trim();

    if (!texto) {
      await mensaje.reply("Mencióname con un mensaje y te respondo.");
      return;
    }

    try {
      await mensaje.channel.sendTyping();
      let ejemplos: EjemploDeEstilo[] = [];

      try {
        ejemplos = await obtenerEjemplosEstilo();
      } catch (error) {
        console.error("No se pudieron cargar los ejemplos de estilo:", error);
      }

      const respuesta = await generarRespuesta(texto, ejemplos);
      const mensajeBot = await mensaje.reply({
        content: respuesta,
        components: [crearBotonesDeFeedback()],
      });

      try {
        await guardarMensajeBot({
          discordMessageId: mensajeBot.id,
          discordUserId: mensaje.author.id,
          mensajeUsuario: texto,
          respuestaBot: respuesta,
          modeloUsado: obtenerModeloUsado(),
        });
      } catch (error) {
        console.error("No se pudo guardar la respuesta en Supabase:", error);
      }
    } catch (error) {
      console.error("Error al generar la respuesta:", error);
      await mensaje.reply("Ocurrió un error al generar la respuesta.");
    }
  });

  cliente.on(Events.InteractionCreate, async (interaccion) => {
    if (!interaccion.isButton()) {
      return;
    }

    const voto = obtenerVotoDesdeBoton(interaccion.customId);

    if (!voto) {
      return;
    }

    try {
      const resultado = await registrarFeedback(
        interaccion.message.id,
        interaccion.user.id,
        voto,
      );

      if (!resultado.encontrado) {
        await interaccion.reply({
          content: "No encontré esta respuesta en la base de datos.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (!resultado.aceptado) {
        await interaccion.reply({
          content: "Ya registraste un voto para esta respuesta.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaccion.update({
        components: [
          crearBotonesDeFeedback({
            positivos: resultado.positivos,
            negativos: resultado.negativos,
          }),
        ],
      });
      await interaccion.followUp({
        content:
          voto === "positivo"
            ? "Gracias. Esta respuesta se marcará como un buen ejemplo."
            : "Gracias. Tendremos en cuenta que esta respuesta necesita mejorar.",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("No se pudo registrar el feedback:", error);
      await interaccion.reply({
        content: "No pude guardar tu voto en este momento.",
        flags: MessageFlags.Ephemeral,
      });
    }
  });

  await verificarConexion();
  console.log("Base de datos conectada correctamente");
  await cliente.login(configuracion.discordToken());
}
