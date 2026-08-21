import { Client, Events, GatewayIntentBits } from "discord.js";

import { generarRespuesta } from "../ai/gemini.js";
import { configuracion } from "../config/env.js";

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

    const texto = mensaje.content.replaceAll(`<@${cliente.user!.id}>`, "").trim();

    if (!texto) {
      await mensaje.reply("Mencióname con un mensaje y te respondo.");
      return;
    }

    try {
      await mensaje.channel.sendTyping();
      const respuesta = await generarRespuesta(texto);
      await mensaje.reply(respuesta);
    } catch (error) {
      console.error("Error al generar la respuesta:", error);
      await mensaje.reply("Ocurrió un error al generar la respuesta.");
    }
  });

  await cliente.login(configuracion.discordToken());
}
