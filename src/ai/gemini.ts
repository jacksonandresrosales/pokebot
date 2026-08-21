import { GoogleGenAI } from "@google/genai";

import { configuracion } from "../config/env.js";
import { instruccionesDePersonalidad } from "./personality.js";

const clienteGemini = new GoogleGenAI({
  apiKey: configuracion.geminiApiKey(),
});

export async function generarRespuesta(mensaje: string): Promise<string> {
  const respuesta = await clienteGemini.models.generateContent({
    model: configuracion.geminiModel(),
    contents: `${instruccionesDePersonalidad}\n\nMensaje del usuario:\n${mensaje}`,
  });

  return respuesta.text?.trim() || "No pude generar una respuesta.";
}

export function obtenerModeloUsado(): string {
  return configuracion.geminiModel();
}
