export type Voto = "positivo" | "negativo";

export interface EjemploDeEstilo {
  entrada: string;
  respuestaIdeal: string;
  importancia: number;
}

export interface UsuarioEntrenador {
  id: string;
  discordUserId: string;
  nombre: string;
  avatarUrl: string | null;
  rol: "administrador" | "entrenador";
  puedeEntrenar: boolean;
  importancia: number;
  consentimiento: boolean;
}
