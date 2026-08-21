function obtenerVariable(nombre: string): string {
  const valor = process.env[nombre];

  if (!valor) {
    throw new Error(`Falta la variable de entorno: ${nombre}`);
  }

  return valor;
}

export const configuracion = {
  discordToken: () => obtenerVariable("DISCORD_TOKEN"),
  geminiApiKey: () => obtenerVariable("GEMINI_API_KEY"),
  geminiModel: () => process.env.GEMINI_MODEL ?? "gemini-3-flash-preview",
  databaseUrl: () => obtenerVariable("DATABASE_URL"),
};
