import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import type { Voto } from "../types/index.js";

const ID_VOTO_POSITIVO = "feedback:positivo";
const ID_VOTO_NEGATIVO = "feedback:negativo";

interface ConteoDeVotos {
  positivos: number;
  negativos: number;
}

interface ResultadoDeVoto {
  aceptado: boolean;
  conteo: ConteoDeVotos;
}

const votosPorMensaje = new Map<string, Map<string, Voto>>();

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

export function registrarVotoTemporal(
  mensajeId: string,
  usuarioId: string,
  voto: Voto,
): ResultadoDeVoto {
  const votos = votosPorMensaje.get(mensajeId) ?? new Map<string, Voto>();

  if (votos.has(usuarioId)) {
    return { aceptado: false, conteo: contarVotos(votos) };
  }

  votos.set(usuarioId, voto);
  votosPorMensaje.set(mensajeId, votos);

  return { aceptado: true, conteo: contarVotos(votos) };
}

function contarVotos(votos: Map<string, Voto>): ConteoDeVotos {
  let positivos = 0;
  let negativos = 0;

  for (const voto of votos.values()) {
    if (voto === "positivo") {
      positivos += 1;
    } else {
      negativos += 1;
    }
  }

  return { positivos, negativos };
}
