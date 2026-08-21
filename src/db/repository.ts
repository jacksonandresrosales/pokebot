import { pool } from "./client.js";

import { configuracion } from "../config/env.js";
import type {
  EjemploDeEstilo,
  UsuarioEntrenador,
  Voto,
} from "../types/index.js";

interface NuevoMensajeBot {
  discordMessageId: string;
  discordUserId: string;
  mensajeUsuario: string;
  respuestaBot: string;
  modeloUsado: string;
}

interface ResultadoFeedback {
  encontrado: boolean;
  autorizado: boolean;
  aceptado: boolean;
  positivos: number;
  negativos: number;
}

export interface EjemploPanel {
  id: string;
  entrada: string;
  respuestaIdeal: string;
  origen: string;
  aprobado: boolean;
  creadoPor: string | null;
  importancia: number;
  createdAt: Date;
}

export interface RasgoComportamientoPanel {
  id: string;
  contenido: string;
  activo: boolean;
  creadoPor: string | null;
  importancia: number;
  createdAt: Date;
}

export interface PuntoFeedback {
  fecha: string;
  positivos: number;
  negativos: number;
}

export interface AnaliticasEntrenamiento {
  mensajes: number;
  positivos: number;
  negativos: number;
  ejemplosAprobados: number;
  ejemplosManuales: number;
  entrenadores: number;
  tendencia: PuntoFeedback[];
}

export interface EntrenadorPanel {
  id: string;
  discordUserId: string;
  nombre: string;
  rol: UsuarioEntrenador["rol"];
  puedeEntrenar: boolean;
  importancia: number;
  consentimiento: boolean;
  ejemplosAportados: number;
  votosEmitidos: number;
  esPrincipal: boolean;
}

export interface ImportacionMensajesPanel {
  id: string;
  nombreArchivo: string;
  formato: "txt" | "json" | "csv";
  nombreObjetivo: string;
  estado: "pendiente" | "analizando" | "listo" | "error";
  resumen: string | null;
  patrones: string[];
  error: string | null;
  aportadoPor: string;
  importancia: number;
  propuestas: number;
  pendientes: number;
  analisisIniciadoAt: Date | null;
  createdAt: Date;
}

export interface PropuestaEntrenamientoPanel {
  id: string;
  importacionId: string;
  entrada: string;
  respuestaIdeal: string;
  estado: "pendiente" | "aprobada" | "rechazada";
  nombreArchivo: string;
  aportadoPor: string;
  importancia: number;
  createdAt: Date;
}

export interface ImportacionParaAnalisis {
  id: string;
  contenido: string;
  nombreObjetivo: string;
}

export async function obtenerEjemplosEstilo(
  limite = 5,
): Promise<EjemploDeEstilo[]> {
  const limiteSeguro = Math.min(Math.max(Math.trunc(limite), 1), 10);
  const resultado = await pool.query<EjemploDeEstilo>(
    `
      select
        ejemplos_estilo.entrada,
        ejemplos_estilo.respuesta_ideal as "respuestaIdeal",
        coalesce(usuarios.importancia, 1)::int as importancia
      from ejemplos_estilo
      left join usuarios
        on usuarios.id = ejemplos_estilo.creado_por
        and usuarios.puede_entrenar = true
      where ejemplos_estilo.aprobado = true
      order by
        coalesce(usuarios.importancia, 1) desc,
        ejemplos_estilo.created_at desc
      limit $1
    `,
    [limiteSeguro],
  );

  return resultado.rows;
}

export async function guardarMensajeBot(mensaje: NuevoMensajeBot): Promise<void> {
  await pool.query(
    `
      insert into mensajes_bot (
        discord_message_id,
        discord_user_id,
        mensaje_usuario,
        respuesta_bot,
        modelo_usado
      ) values ($1, $2, $3, $4, $5)
      on conflict (discord_message_id) do nothing
    `,
    [
      mensaje.discordMessageId,
      mensaje.discordUserId,
      mensaje.mensajeUsuario,
      mensaje.respuestaBot,
      mensaje.modeloUsado,
    ],
  );
}

export async function obtenerUsuarioPorDiscordId(
  discordUserId: string,
): Promise<UsuarioEntrenador | null> {
  const resultado = await pool.query<UsuarioEntrenador>(
    `
      select
        id,
        discord_user_id as "discordUserId",
        nombre,
        rol,
        puede_entrenar as "puedeEntrenar",
        importancia,
        consentimiento
      from usuarios
      where discord_user_id = $1
      limit 1
    `,
    [discordUserId],
  );

  return resultado.rows[0] ?? null;
}

export async function obtenerTutorialCompletado(
  discordUserId: string,
): Promise<boolean> {
  const resultado = await pool.query<{ tutorialCompletado: boolean }>(
    `
      select tutorial_completado_at is not null as "tutorialCompletado"
      from usuarios
      where discord_user_id = $1
      limit 1
    `,
    [discordUserId],
  );

  return resultado.rows[0]?.tutorialCompletado ?? false;
}

export async function marcarTutorialCompletado(
  discordUserId: string,
): Promise<boolean> {
  const resultado = await pool.query(
    `
      update usuarios
      set tutorial_completado_at = coalesce(tutorial_completado_at, now())
      where discord_user_id = $1
      returning id
    `,
    [discordUserId],
  );

  return resultado.rowCount === 1;
}

export async function crearEjemploManual(
  entrada: string,
  respuestaIdeal: string,
  discordUserId: string,
): Promise<boolean> {
  const resultado = await pool.query(
    `
      insert into ejemplos_estilo (
        entrada,
        respuesta_ideal,
        origen,
        aprobado,
        creado_por
      )
      select $1, $2, 'manual', true, usuarios.id
      from usuarios
      where discord_user_id = $3
        and puede_entrenar = true
      on conflict do nothing
      returning id
    `,
    [entrada, respuestaIdeal, discordUserId],
  );

  return resultado.rowCount === 1;
}

export async function obtenerRasgosComportamiento(limite = 10): Promise<string[]> {
  const limiteSeguro = Math.min(Math.max(Math.trunc(limite), 1), 20);
  const resultado = await pool.query<{ contenido: string }>(
    `
      select rasgos_comportamiento.contenido
      from rasgos_comportamiento
      left join usuarios
        on usuarios.id = rasgos_comportamiento.creado_por
        and usuarios.puede_entrenar = true
      where rasgos_comportamiento.activo = true
      order by
        coalesce(usuarios.importancia, 1) desc,
        rasgos_comportamiento.created_at desc
      limit $1
    `,
    [limiteSeguro],
  );

  return resultado.rows.map((fila) => fila.contenido);
}

export async function crearRasgoComportamiento(
  contenido: string,
  discordUserId: string,
): Promise<boolean> {
  const resultado = await pool.query(
    `
      insert into rasgos_comportamiento (contenido, creado_por)
      select $1, usuarios.id
      from usuarios
      where usuarios.discord_user_id = $2
        and usuarios.puede_entrenar = true
      on conflict do nothing
      returning id
    `,
    [contenido, discordUserId],
  );

  return resultado.rowCount === 1;
}

export async function listarRasgosComportamientoPanel(
  limite = 30,
): Promise<RasgoComportamientoPanel[]> {
  const limiteSeguro = Math.min(Math.max(Math.trunc(limite), 1), 100);
  const resultado = await pool.query<RasgoComportamientoPanel>(
    `
      select
        rasgos_comportamiento.id,
        rasgos_comportamiento.contenido,
        rasgos_comportamiento.activo,
        usuarios.nombre as "creadoPor",
        coalesce(usuarios.importancia, 1)::int as importancia,
        rasgos_comportamiento.created_at as "createdAt"
      from rasgos_comportamiento
      left join usuarios on usuarios.id = rasgos_comportamiento.creado_por
      order by rasgos_comportamiento.created_at desc
      limit $1
    `,
    [limiteSeguro],
  );

  return resultado.rows;
}

export async function actualizarEstadoRasgoComportamiento(
  id: string,
  activo: boolean,
): Promise<boolean> {
  const resultado = await pool.query(
    `
      update rasgos_comportamiento
      set activo = $2
      where id = $1
      returning id
    `,
    [id, activo],
  );

  return resultado.rowCount === 1;
}

export async function listarEjemplosPanel(limite = 50): Promise<EjemploPanel[]> {
  const limiteSeguro = Math.min(Math.max(Math.trunc(limite), 1), 100);
  const resultado = await pool.query<EjemploPanel>(
    `
      select
        ejemplos_estilo.id,
        ejemplos_estilo.entrada,
        ejemplos_estilo.respuesta_ideal as "respuestaIdeal",
        ejemplos_estilo.origen,
        ejemplos_estilo.aprobado,
        usuarios.nombre as "creadoPor",
        coalesce(usuarios.importancia, 1)::int as importancia,
        ejemplos_estilo.created_at as "createdAt"
      from ejemplos_estilo
      left join usuarios on usuarios.id = ejemplos_estilo.creado_por
      order by ejemplos_estilo.created_at desc
      limit $1
    `,
    [limiteSeguro],
  );

  return resultado.rows;
}

export async function actualizarAprobacionEjemplo(
  id: string,
  aprobado: boolean,
): Promise<boolean> {
  const resultado = await pool.query(
    `
      update ejemplos_estilo
      set aprobado = $2
      where id = $1
      returning id
    `,
    [id, aprobado],
  );

  return resultado.rowCount === 1;
}

export async function obtenerAnaliticasEntrenamiento(): Promise<AnaliticasEntrenamiento> {
  const [resumen, tendencia] = await Promise.all([
    pool.query<Omit<AnaliticasEntrenamiento, "tendencia">>(
      `
        select
          (select count(*)::int from mensajes_bot) as mensajes,
          (select count(*)::int from feedback where voto = 'positivo') as positivos,
          (select count(*)::int from feedback where voto = 'negativo') as negativos,
          (
            select count(*)::int
            from ejemplos_estilo
            where aprobado = true
          ) as "ejemplosAprobados",
          (
            select count(*)::int
            from ejemplos_estilo
            where origen = 'manual'
          ) as "ejemplosManuales",
          (
            select count(*)::int
            from usuarios
            where puede_entrenar = true
          ) as entrenadores
      `,
    ),
    pool.query<PuntoFeedback>(
      `
        select
          to_char(dia, 'YYYY-MM-DD') as fecha,
          count(feedback.id) filter (where feedback.voto = 'positivo')::int as positivos,
          count(feedback.id) filter (where feedback.voto = 'negativo')::int as negativos
        from generate_series(
          current_date - interval '6 days',
          current_date,
          interval '1 day'
        ) as dia
        left join feedback
          on feedback.created_at >= dia
          and feedback.created_at < dia + interval '1 day'
        group by dia
        order by dia
      `,
    ),
  ]);

  return {
    ...resumen.rows[0],
    tendencia: tendencia.rows,
  };
}

export async function listarEntrenadores(): Promise<EntrenadorPanel[]> {
  const resultado = await pool.query<EntrenadorPanel>(
    `
      select
        usuarios.id,
        usuarios.discord_user_id as "discordUserId",
        nombre,
        rol,
        puede_entrenar as "puedeEntrenar",
        importancia::int,
        consentimiento,
        (
          select count(*)::int
          from ejemplos_estilo
          where ejemplos_estilo.creado_por = usuarios.id
        ) as "ejemplosAportados",
        (
          select count(*)::int
          from feedback
          where feedback.discord_user_id = usuarios.discord_user_id
        ) as "votosEmitidos",
        (usuarios.discord_user_id = $1) as "esPrincipal"
      from usuarios
      order by
        case when rol = 'administrador' then 0 else 1 end,
        nombre asc
    `,
    [configuracion.adminDiscordId()],
  );

  return resultado.rows;
}

export async function crearEntrenador(
  discordUserId: string,
  nombre: string,
  rol: UsuarioEntrenador["rol"],
  importancia: number,
): Promise<EntrenadorPanel | null> {
  await pool.query(
    `
      insert into usuarios (
        discord_user_id,
        nombre,
        rol,
        puede_entrenar,
        importancia
      ) values ($1, $2, $3, true, $4)
      on conflict (discord_user_id) do update set
        nombre = excluded.nombre,
        rol = case
          when usuarios.discord_user_id = $5 then 'administrador'
          else excluded.rol
        end,
        puede_entrenar = true,
        importancia = excluded.importancia
    `,
    [discordUserId, nombre, rol, importancia, configuracion.adminDiscordId()],
  );

  const entrenadores = await listarEntrenadores();
  return entrenadores.find((entrenador) => entrenador.discordUserId === discordUserId) ?? null;
}

export async function actualizarEntrenador(
  id: string,
  rol: UsuarioEntrenador["rol"],
  puedeEntrenar: boolean,
  importancia: number,
): Promise<boolean> {
  const resultado = await pool.query(
    `
      update usuarios
      set
        rol = case
          when discord_user_id = $5 then 'administrador'
          else $2
        end,
        puede_entrenar = case
          when discord_user_id = $5 then true
          else $3
        end,
        importancia = $4
      where id = $1
      returning id
    `,
    [id, rol, puedeEntrenar, importancia, configuracion.adminDiscordId()],
  );

  return resultado.rowCount === 1;
}

export async function asegurarAdministradorPrincipal(): Promise<void> {
  await pool.query(
    `
      update usuarios
      set rol = 'administrador', puede_entrenar = true
      where discord_user_id = $1
    `,
    [configuracion.adminDiscordId()],
  );
}

export async function crearImportacionMensajes(
  nombreArchivo: string,
  formato: ImportacionMensajesPanel["formato"],
  nombreObjetivo: string,
  contenido: string,
  aportadoPorId: string,
  creadorDiscordUserId: string,
): Promise<string | null> {
  const resultado = await pool.query<{ id: string }>(
    `
      insert into importaciones_mensajes (
        nombre_archivo,
        formato,
        nombre_objetivo,
        contenido,
        aportado_por,
        creado_por
      )
      select $1, $2, $3, $4, aportante.id, creador.id
      from usuarios as aportante
      join usuarios as creador on creador.discord_user_id = $6
      where aportante.id = $5
        and aportante.puede_entrenar = true
        and creador.rol = 'administrador'
        and creador.puede_entrenar = true
      returning id
    `,
    [
      nombreArchivo,
      formato,
      nombreObjetivo,
      contenido,
      aportadoPorId,
      creadorDiscordUserId,
    ],
  );

  return resultado.rows[0]?.id ?? null;
}

export async function listarImportacionesMensajes(
  limite = 30,
): Promise<ImportacionMensajesPanel[]> {
  const limiteSeguro = Math.min(Math.max(Math.trunc(limite), 1), 100);
  const resultado = await pool.query<ImportacionMensajesPanel>(
    `
      select
        importaciones_mensajes.id,
        importaciones_mensajes.nombre_archivo as "nombreArchivo",
        importaciones_mensajes.formato,
        importaciones_mensajes.nombre_objetivo as "nombreObjetivo",
        importaciones_mensajes.estado,
        importaciones_mensajes.resumen,
        importaciones_mensajes.patrones,
        importaciones_mensajes.error,
        usuarios.nombre as "aportadoPor",
        usuarios.importancia::int,
        count(propuestas_entrenamiento.id)::int as propuestas,
        count(propuestas_entrenamiento.id) filter (
          where propuestas_entrenamiento.estado = 'pendiente'
        )::int as pendientes,
        importaciones_mensajes.analisis_iniciado_at as "analisisIniciadoAt",
        importaciones_mensajes.created_at as "createdAt"
      from importaciones_mensajes
      join usuarios on usuarios.id = importaciones_mensajes.aportado_por
      left join propuestas_entrenamiento
        on propuestas_entrenamiento.importacion_id = importaciones_mensajes.id
      group by importaciones_mensajes.id, usuarios.id
      order by importaciones_mensajes.created_at desc
      limit $1
    `,
    [limiteSeguro],
  );

  return resultado.rows;
}

export async function listarPropuestasEntrenamiento(
  limite = 100,
): Promise<PropuestaEntrenamientoPanel[]> {
  const limiteSeguro = Math.min(Math.max(Math.trunc(limite), 1), 200);
  const resultado = await pool.query<PropuestaEntrenamientoPanel>(
    `
      select
        propuestas_entrenamiento.id,
        propuestas_entrenamiento.importacion_id as "importacionId",
        propuestas_entrenamiento.entrada,
        propuestas_entrenamiento.respuesta_ideal as "respuestaIdeal",
        propuestas_entrenamiento.estado,
        importaciones_mensajes.nombre_archivo as "nombreArchivo",
        usuarios.nombre as "aportadoPor",
        usuarios.importancia::int,
        propuestas_entrenamiento.created_at as "createdAt"
      from propuestas_entrenamiento
      join importaciones_mensajes
        on importaciones_mensajes.id = propuestas_entrenamiento.importacion_id
      join usuarios on usuarios.id = importaciones_mensajes.aportado_por
      order by
        case propuestas_entrenamiento.estado when 'pendiente' then 0 else 1 end,
        propuestas_entrenamiento.created_at desc
      limit $1
    `,
    [limiteSeguro],
  );

  return resultado.rows;
}

export async function iniciarAnalisisImportacion(
  id: string,
): Promise<ImportacionParaAnalisis | null> {
  const resultado = await pool.query<ImportacionParaAnalisis>(
    `
      update importaciones_mensajes
      set
        estado = 'analizando',
        error = null,
        analisis_iniciado_at = now()
      where id = $1
        and (
          estado in ('pendiente', 'error')
          or (
            estado = 'analizando'
            and analisis_iniciado_at < now() - interval '10 minutes'
          )
        )
      returning
        id,
        contenido,
        nombre_objetivo as "nombreObjetivo"
    `,
    [id],
  );

  return resultado.rows[0] ?? null;
}

export async function guardarAnalisisImportacion(
  id: string,
  resumen: string,
  patrones: string[],
  propuestas: Array<{ entrada: string; respuestaIdeal: string }>,
): Promise<void> {
  const cliente = await pool.connect();

  try {
    await cliente.query("begin");
    await cliente.query(
      `
        update importaciones_mensajes
        set
          estado = 'listo',
          resumen = $2,
          patrones = $3::jsonb,
          error = null,
          analisis_iniciado_at = null,
          analizado_at = now()
        where id = $1
          and estado = 'analizando'
      `,
      [id, resumen, JSON.stringify(patrones)],
    );

    for (const propuesta of propuestas) {
      await cliente.query(
        `
          insert into propuestas_entrenamiento (
            importacion_id,
            entrada,
            respuesta_ideal
          ) values ($1, $2, $3)
          on conflict do nothing
        `,
        [id, propuesta.entrada, propuesta.respuestaIdeal],
      );
    }

    await cliente.query("commit");
  } catch (error) {
    await cliente.query("rollback");
    throw error;
  } finally {
    cliente.release();
  }
}

export async function marcarErrorAnalisisImportacion(
  id: string,
  mensaje: string,
): Promise<void> {
  await pool.query(
    `
      update importaciones_mensajes
      set estado = 'error', error = $2, analisis_iniciado_at = null
      where id = $1
    `,
    [id, mensaje.slice(0, 500)],
  );
}

export async function actualizarEstadoPropuesta(
  id: string,
  estado: "aprobada" | "rechazada",
): Promise<boolean> {
  const cliente = await pool.connect();

  try {
    await cliente.query("begin");
    const propuesta = await cliente.query<{
      entrada: string;
      respuestaIdeal: string;
      ejemploId: string | null;
      aportadoPorId: string;
    }>(
      `
        select
          propuestas_entrenamiento.entrada,
          propuestas_entrenamiento.respuesta_ideal as "respuestaIdeal",
          propuestas_entrenamiento.ejemplo_id as "ejemploId",
          importaciones_mensajes.aportado_por as "aportadoPorId"
        from propuestas_entrenamiento
        join importaciones_mensajes
          on importaciones_mensajes.id = propuestas_entrenamiento.importacion_id
        where propuestas_entrenamiento.id = $1
        for update of propuestas_entrenamiento
      `,
      [id],
    );
    const fila = propuesta.rows[0];

    if (!fila) {
      await cliente.query("rollback");
      return false;
    }

    let ejemploId = fila.ejemploId;

    if (estado === "aprobada" && ejemploId) {
      await cliente.query(
        `update ejemplos_estilo set aprobado = true where id = $1`,
        [ejemploId],
      );
    } else if (estado === "aprobada") {
      const ejemplo = await cliente.query<{ id: string }>(
        `
          insert into ejemplos_estilo (
            entrada,
            respuesta_ideal,
            origen,
            aprobado,
            creado_por
          ) values ($1, $2, 'importacion', true, $3)
          on conflict do nothing
          returning id
        `,
        [fila.entrada, fila.respuestaIdeal, fila.aportadoPorId],
      );
      ejemploId = ejemplo.rows[0]?.id ?? null;
    } else if (ejemploId) {
      await cliente.query(
        `update ejemplos_estilo set aprobado = false where id = $1`,
        [ejemploId],
      );
    }

    await cliente.query(
      `
        update propuestas_entrenamiento
        set estado = $2, ejemplo_id = $3, updated_at = now()
        where id = $1
      `,
      [id, estado, ejemploId],
    );
    await cliente.query("commit");
    return true;
  } catch (error) {
    await cliente.query("rollback");
    throw error;
  } finally {
    cliente.release();
  }
}

export async function registrarUsuario(
  discordUserId: string,
  nombre: string,
): Promise<UsuarioEntrenador> {
  const esAdministrador = discordUserId === configuracion.adminDiscordId();
  const resultado = await pool.query<UsuarioEntrenador>(
    `
      insert into usuarios (
        discord_user_id,
        nombre,
        rol,
        puede_entrenar,
        importancia
      ) values ($1, $2, $3, $4, 3)
      on conflict (discord_user_id) do update set
        nombre = excluded.nombre,
        rol = case
          when usuarios.rol = 'administrador' then usuarios.rol
          when excluded.rol = 'administrador' then excluded.rol
          else usuarios.rol
        end,
        puede_entrenar = case
          when excluded.rol = 'administrador' then true
          else usuarios.puede_entrenar
        end
      returning
        id,
        discord_user_id as "discordUserId",
        nombre,
        rol,
        puede_entrenar as "puedeEntrenar",
        importancia,
        consentimiento
    `,
    [
      discordUserId,
      nombre,
      esAdministrador ? "administrador" : "entrenador",
      esAdministrador,
    ],
  );

  return resultado.rows[0];
}

export async function registrarFeedback(
  discordMessageId: string,
  discordUserId: string,
  voto: Voto,
): Promise<ResultadoFeedback> {
  const [mensaje, usuarioAutorizado] = await Promise.all([
    pool.query<{
      id: string;
      mensaje_usuario: string;
      respuesta_bot: string;
    }>(
      `
        select id, mensaje_usuario, respuesta_bot
        from mensajes_bot
        where discord_message_id = $1
      `,
      [discordMessageId],
    ),
    pool.query(
      `
        select 1
        from usuarios
        where discord_user_id = $1
          and puede_entrenar = true
      `,
      [discordUserId],
    ),
  ]);

  if (mensaje.rowCount === 0) {
    return {
      encontrado: false,
      autorizado: usuarioAutorizado.rowCount === 1,
      aceptado: false,
      positivos: 0,
      negativos: 0,
    };
  }

  if (usuarioAutorizado.rowCount !== 1) {
    return {
      encontrado: true,
      autorizado: false,
      aceptado: false,
      positivos: 0,
      negativos: 0,
    };
  }

  const insercion = await pool.query(
    `
      insert into feedback (mensaje_id, discord_user_id, voto)
      values ($1, $2, $3)
      on conflict (mensaje_id, discord_user_id) do nothing
      returning id
    `,
    [mensaje.rows[0].id, discordUserId, voto],
  );

  if (insercion.rowCount === 1 && voto === "positivo") {
    await pool.query(
      `
        insert into ejemplos_estilo (
          entrada,
          respuesta_ideal,
          origen,
          aprobado,
          creado_por
        )
        values (
          $1,
          $2,
          'feedback',
          true,
          (select id from usuarios where discord_user_id = $3)
        )
        on conflict do nothing
      `,
      [
        mensaje.rows[0].mensaje_usuario,
        mensaje.rows[0].respuesta_bot,
        discordUserId,
      ],
    );
  }

  const conteo = await pool.query<{ voto: Voto; total: string }>(
    `
      select voto, count(*)::text as total
      from feedback
      where mensaje_id = $1
      group by voto
    `,
    [mensaje.rows[0].id],
  );

  const conteos = { positivos: 0, negativos: 0 };

  for (const fila of conteo.rows) {
    if (fila.voto === "positivo") {
      conteos.positivos = Number(fila.total);
    } else {
      conteos.negativos = Number(fila.total);
    }
  }

  return {
    encontrado: true,
    autorizado: true,
    aceptado: insercion.rowCount === 1,
    ...conteos,
  };
}
