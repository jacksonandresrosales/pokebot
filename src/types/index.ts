export type Voto = "positivo" | "negativo";

export interface EjemploDeEstilo {
  entrada: string;
  respuestaIdeal: string;
}

export interface UsuarioEntrenador {
  id: string;
  discordUserId: string;
  nombre: string;
  rol: "administrador" | "entrenador";
  puedeEntrenar: boolean;
  consentimiento: boolean;
}
