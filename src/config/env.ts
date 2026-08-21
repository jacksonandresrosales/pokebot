function obtenerVariable(nombre: string): string {
  const valor = process.env[nombre];

  if (!valor) {
    throw new Error(`Falta la variable de entorno: ${nombre}`);
  }

  return valor;
}

export const configuracion = {
  discordToken: () => obtenerVariable("DISCORD_TOKEN"),
  discordClientId: () => obtenerVariable("DISCORD_CLIENT_ID"),
  discordClientSecret: () => obtenerVariable("DISCORD_CLIENT_SECRET"),
  geminiApiKey: () => obtenerVariable("GEMINI_API_KEY"),
  geminiModel: () => process.env.GEMINI_MODEL ?? "gemini-3-flash-preview",
  databaseUrl: () => obtenerVariable("DATABASE_URL"),
  webUrl: () => process.env.WEB_URL ?? "http://localhost:3000",
  webPort: () => Number(process.env.WEB_PORT ?? "3000"),
  sessionSecret: () => obtenerVariable("SESSION_SECRET"),
  adminDiscordId: () => process.env.ADMIN_DISCORD_ID ?? "",
};
