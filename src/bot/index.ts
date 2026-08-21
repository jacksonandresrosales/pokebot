import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";

import { generarRespuesta } from "../ai/gemini.js";
import { configuracion } from "../config/env.js";
import {
  crearBotonesDeFeedback,
  obtenerVotoDesdeBoton,
  registrarVotoTemporal,
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
      const respuesta = await generarRespuesta(texto);
      await mensaje.reply({
        content: respuesta,
        components: [crearBotonesDeFeedback()],
      });
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

    const resultado = registrarVotoTemporal(
      interaccion.message.id,
      interaccion.user.id,
      voto,
    );

    if (!resultado.aceptado) {
      await interaccion.reply({
        content: "Ya registraste un voto para esta respuesta.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaccion.update({
      components: [crearBotonesDeFeedback(resultado.conteo)],
    });
    await interaccion.followUp({
      content:
        voto === "positivo"
          ? "Gracias. Esta respuesta se marcará como un buen ejemplo."
          : "Gracias. Tendremos en cuenta que esta respuesta necesita mejorar.",
      flags: MessageFlags.Ephemeral,
    });
  });

  await cliente.login(configuracion.discordToken());
}
