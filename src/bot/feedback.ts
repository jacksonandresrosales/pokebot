import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import type { Voto } from "../types/index.js";

const ID_VOTO_POSITIVO = "feedback:positivo";
const ID_VOTO_NEGATIVO = "feedback:negativo";

export interface ConteoDeVotos {
  positivos: number;
  negativos: number;
}

export function crearBotonesDeFeedback(
  conteo: ConteoDeVotos = { positivos: 0, negativos: 0 },
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ID_VOTO_POSITIVO)
      .setEmoji("👍")
      .setLabel(String(conteo.positivos))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(ID_VOTO_NEGATIVO)
      .setEmoji("👎")
      .setLabel(String(conteo.negativos))
      .setStyle(ButtonStyle.Danger),
  );
}

export function obtenerVotoDesdeBoton(customId: string): Voto | null {
  if (customId === ID_VOTO_POSITIVO) {
    return "positivo";
  }

  if (customId === ID_VOTO_NEGATIVO) {
    return "negativo";
  }

  return null;
}
