const landing = document.querySelector("#landing");
const dashboard = document.querySelector("#dashboard");
const estado = document.querySelector("#estado");
const alertaGlobal = document.querySelector("#alerta-global");
const formulario = document.querySelector("#form-ejemplo");
const botonGuardar = document.querySelector("#guardar-ejemplo");
const resultadoFormulario = document.querySelector("#resultado-formulario");
const buscador = document.querySelector("#buscar-ejemplo");
const formularioEntrenador = document.querySelector("#form-entrenador");
const botonGuardarEntrenador = document.querySelector("#guardar-entrenador");
const resultadoEntrenador = document.querySelector("#resultado-entrenador");

const secciones = {
  entrenar: ["Entrenar", "Crea ejemplos claros para definir el estilo."],
  ejemplos: ["Ejemplos", "Revisa lo que PokeBot está usando para aprender."],
  analiticas: ["Analíticas", "Observa cómo responden los amigos en Discord."],
  entrenadores: ["Entrenadores", "Administra accesos y el peso de cada persona."],
  caracteristicas: ["Características", "Consulta el modelo, permisos y equipo actual."],
};

const estadoApp = {
  usuario: null,
  datos: null,
  filtro: "",
};

async function solicitar(url, opciones = {}) {
  const respuesta = await fetch(url, {
    ...opciones,
    headers: {
      ...(opciones.body ? { "Content-Type": "application/json" } : {}),
      ...opciones.headers,
    },
  });
  const contenido = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(contenido.error ?? "No se pudo completar la petición.");
  }

  return contenido;
}

function mostrarAvatar(usuario) {
  const imagen = document.querySelector("#usuario-imagen");
  const inicial = document.querySelector("#usuario-inicial");
  inicial.textContent = usuario.nombre.trim().charAt(0).toUpperCase() || "U";

  if (!usuario.avatarUrl) return;

  imagen.src = usuario.avatarUrl;
  imagen.hidden = false;
  inicial.hidden = true;
  imagen.addEventListener("error", () => {
    imagen.hidden = true;
    inicial.hidden = false;
  }, { once: true });
}

function seleccionarTab(nombre) {
  for (const boton of document.querySelectorAll("[data-tab]")) {
    const activo = boton.dataset.tab === nombre;
    boton.classList.toggle("is-active", activo);
    boton.setAttribute("aria-selected", String(activo));
  }

  for (const panel of document.querySelectorAll("[data-panel]")) {
    panel.hidden = panel.dataset.panel !== nombre;
  }

  document.querySelector("#seccion-titulo").textContent = secciones[nombre][0];
  document.querySelector("#seccion-descripcion").textContent = secciones[nombre][1];
}

function crearElemento(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function fechaCorta(valor) {
  return new Intl.DateTimeFormat("es", { day: "2-digit", month: "short" }).format(new Date(valor));
}

function renderEjemplos() {
  const contenedor = document.querySelector("#lista-ejemplos");
  const ejemplos = estadoApp.datos?.ejemplos ?? [];
  const filtro = estadoApp.filtro.toLowerCase();
  const filtrados = ejemplos.filter((ejemplo) =>
    `${ejemplo.entrada} ${ejemplo.respuestaIdeal}`.toLowerCase().includes(filtro),
  );

  contenedor.replaceChildren();
  document.querySelector("#conteo-ejemplos").textContent = `${filtrados.length} de ${ejemplos.length}`;

  if (filtrados.length === 0) {
    const vacio = crearElemento("div", "empty-state");
    vacio.append(
      crearElemento("strong", "", filtro ? "No hay coincidencias" : "Todavía no hay ejemplos"),
      crearElemento("p", "", filtro ? "Prueba con otra búsqueda." : "Añade el primero desde la pestaña Entrenar."),
    );
    contenedor.append(vacio);
    return;
  }

  for (const ejemplo of filtrados) {
    const fila = crearElemento("article", "example-row");
    const entrada = crearElemento("div", "example-copy");
    entrada.append(crearElemento("span", "", "Mensaje"), crearElemento("p", "", ejemplo.entrada));

    const respuesta = crearElemento("div", "example-copy");
    respuesta.append(crearElemento("span", "", "Respuesta"), crearElemento("p", "", ejemplo.respuestaIdeal));
    const meta = crearElemento("div", "example-meta");
    meta.append(
      crearElemento("span", "", ejemplo.origen === "manual" ? "Manual" : "Feedback"),
      crearElemento("span", "", fechaCorta(ejemplo.createdAt)),
      crearElemento("span", "", `Peso ${ejemplo.importancia}`),
    );
    if (ejemplo.creadoPor) meta.append(crearElemento("span", "", ejemplo.creadoPor));
    respuesta.append(meta);

    const acciones = crearElemento("div", "example-actions");
    const estado = crearElemento("span", `status-badge${ejemplo.aprobado ? "" : " is-paused"}`, ejemplo.aprobado ? "Activo" : "Pausado");
    acciones.append(estado);

    if (estadoApp.usuario.rol === "administrador") {
      const boton = crearElemento("button", "example-action", ejemplo.aprobado ? "Pausar" : "Activar");
      boton.type = "button";
      boton.addEventListener("click", () => cambiarEstadoEjemplo(ejemplo, boton));
      acciones.append(boton);
    }

    fila.append(entrada, respuesta, acciones);
    contenedor.append(fila);
  }
}

function renderAnaliticas() {
  const analiticas = estadoApp.datos.analiticas;
  document.querySelector("#metrica-mensajes").textContent = analiticas.mensajes;
  document.querySelector("#metrica-positivos").textContent = analiticas.positivos;
  document.querySelector("#metrica-negativos").textContent = analiticas.negativos;
  document.querySelector("#metrica-ejemplos").textContent = analiticas.ejemplosAprobados;
  document.querySelector("#metrica-entrenadores").textContent = analiticas.entrenadores;

  const totalVotos = analiticas.positivos + analiticas.negativos;
  const ratio = totalVotos === 0 ? 0 : Math.round((analiticas.positivos / totalVotos) * 100);
  document.querySelector("#ratio-positivo").textContent = `${ratio}%`;

  const grafico = document.querySelector("#grafico-feedback");
  const maximo = Math.max(1, ...analiticas.tendencia.flatMap((dia) => [dia.positivos, dia.negativos]));
  grafico.replaceChildren();

  for (const dia of analiticas.tendencia) {
    const grupo = crearElemento("div", "chart-day");
    const barras = crearElemento("div", "chart-bars");
    const positiva = crearElemento("span", "chart-bar");
    const negativa = crearElemento("span", "chart-bar is-negative");
    positiva.style.height = `${Math.max(2, (dia.positivos / maximo) * 100)}%`;
    negativa.style.height = `${Math.max(2, (dia.negativos / maximo) * 100)}%`;
    positiva.title = `${dia.positivos} positivos`;
    negativa.title = `${dia.negativos} negativos`;
    barras.append(positiva, negativa);
    grupo.append(barras, crearElemento("span", "chart-label", fechaCorta(`${dia.fecha}T12:00:00`)));
    grafico.append(grupo);
  }
}

function renderCaracteristicas() {
  document.querySelector("#modelo-actual").textContent = estadoApp.datos.caracteristicas.modelo;
  const entrenadores = estadoApp.datos.entrenadores;
  const lista = document.querySelector("#lista-entrenadores");
  lista.replaceChildren();
  document.querySelector("#total-equipo").textContent = `${entrenadores.length} personas`;

  for (const entrenador of entrenadores) {
    const fila = crearElemento("div", "team-row");
    fila.append(
      crearElemento("strong", "", entrenador.nombre),
      crearElemento(
        "span",
        "",
        entrenador.puedeEntrenar
          ? `${entrenador.rol} · importancia ${entrenador.importancia}`
          : "sin acceso",
      ),
    );
    lista.append(fila);
  }
}

function crearSelector(opciones, valorActual, etiqueta) {
  const selector = crearElemento("select");
  selector.setAttribute("aria-label", etiqueta);

  for (const [valor, texto] of opciones) {
    const opcion = crearElemento("option", "", texto);
    opcion.value = valor;
    opcion.selected = String(valorActual) === valor;
    selector.append(opcion);
  }

  return selector;
}

async function guardarCambiosEntrenador(entrenador, controles, boton) {
  boton.disabled = true;
  boton.textContent = "Guardando...";

  try {
    await solicitar(`/api/trainers/${entrenador.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        rol: controles.rol.value,
        puedeEntrenar: controles.acceso.checked,
        importancia: Number(controles.importancia.value),
      }),
    });
    await cargarDashboard();
  } catch (error) {
    alertaGlobal.textContent = error.message;
    alertaGlobal.hidden = false;
    boton.disabled = false;
    boton.textContent = "Guardar";
  }
}

function renderGestionEntrenadores() {
  const lista = document.querySelector("#lista-gestion-entrenadores");

  if (estadoApp.usuario.rol !== "administrador") {
    lista.replaceChildren();
    return;
  }

  const entrenadores = estadoApp.datos.entrenadores;
  const activos = entrenadores.filter((entrenador) => entrenador.puedeEntrenar).length;
  document.querySelector("#resumen-entrenadores").textContent = `${activos} con acceso de ${entrenadores.length}`;
  lista.replaceChildren();

  for (const entrenador of entrenadores) {
    const fila = crearElemento("article", "trainer-row");
    const identidad = crearElemento("div", "trainer-identity");
    identidad.append(
      crearElemento("strong", "", entrenador.nombre),
      crearElemento("span", entrenador.esPrincipal ? "principal-label" : "", entrenador.esPrincipal ? "Creador · acceso total" : entrenador.discordUserId),
    );

    const estadisticas = crearElemento("div", "trainer-stats");
    estadisticas.append(
      crearElemento("span", "", `${entrenador.ejemplosAportados} ejemplos`),
      crearElemento("span", "", `${entrenador.votosEmitidos} votos`),
    );

    const rol = crearSelector([
      ["entrenador", "Entrenador"],
      ["administrador", "Administrador"],
    ], entrenador.rol, `Rol de ${entrenador.nombre}`);
    const importancia = crearSelector([
      ["1", "Peso 1"],
      ["2", "Peso 2"],
      ["3", "Peso 3"],
      ["4", "Peso 4"],
      ["5", "Peso 5"],
    ], entrenador.importancia, `Importancia de ${entrenador.nombre}`);
    const acceso = crearElemento("input");
    acceso.type = "checkbox";
    acceso.checked = entrenador.puedeEntrenar;
    acceso.disabled = entrenador.esPrincipal;
    rol.disabled = entrenador.esPrincipal;

    const etiquetaAcceso = crearElemento("label", "access-toggle");
    etiquetaAcceso.append(acceso, crearElemento("span", "", "Acceso"));

    const controles = crearElemento("div", "trainer-controls");
    controles.append(rol, importancia, etiquetaAcceso);

    const guardar = crearElemento("button", "trainer-save", "Guardar");
    guardar.type = "button";
    guardar.addEventListener("click", () => guardarCambiosEntrenador(
      entrenador,
      { rol, importancia, acceso },
      guardar,
    ));

    fila.append(identidad, estadisticas, controles, guardar);
    lista.append(fila);
  }
}

function renderTodo() {
  renderEjemplos();
  renderAnaliticas();
  renderCaracteristicas();
  renderGestionEntrenadores();
}

async function cargarDashboard() {
  try {
    estadoApp.datos = await solicitar("/api/dashboard");
    renderTodo();
    alertaGlobal.hidden = true;
  } catch (error) {
    alertaGlobal.textContent = error.message;
    alertaGlobal.hidden = false;
  }
}

async function cambiarEstadoEjemplo(ejemplo, boton) {
  boton.disabled = true;
  try {
    await solicitar(`/api/examples/${ejemplo.id}`, {
      method: "PATCH",
      body: JSON.stringify({ aprobado: !ejemplo.aprobado }),
    });
    await cargarDashboard();
  } catch (error) {
    alertaGlobal.textContent = error.message;
    alertaGlobal.hidden = false;
  } finally {
    boton.disabled = false;
  }
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  botonGuardar.disabled = true;
  botonGuardar.textContent = "Guardando...";
  resultadoFormulario.textContent = "";
  resultadoFormulario.className = "form-result";

  const datos = new FormData(formulario);

  try {
    await solicitar("/api/examples", {
      method: "POST",
      body: JSON.stringify({
        entrada: datos.get("entrada"),
        respuestaIdeal: datos.get("respuestaIdeal"),
      }),
    });
    formulario.reset();
    resultadoFormulario.textContent = "Ejemplo guardado.";
    resultadoFormulario.classList.add("is-success");
    await cargarDashboard();
  } catch (error) {
    resultadoFormulario.textContent = error.message;
    resultadoFormulario.classList.add("is-error");
  } finally {
    botonGuardar.disabled = false;
    botonGuardar.textContent = "Guardar ejemplo";
  }
});

buscador.addEventListener("input", () => {
  estadoApp.filtro = buscador.value.trim();
  renderEjemplos();
});

formularioEntrenador.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  botonGuardarEntrenador.disabled = true;
  botonGuardarEntrenador.textContent = "Autorizando...";
  resultadoEntrenador.textContent = "";
  resultadoEntrenador.className = "form-result";
  const datos = new FormData(formularioEntrenador);

  try {
    await solicitar("/api/trainers", {
      method: "POST",
      body: JSON.stringify({
        nombre: datos.get("nombre"),
        discordUserId: datos.get("discordUserId"),
        rol: datos.get("rol"),
        importancia: Number(datos.get("importancia")),
      }),
    });
    formularioEntrenador.reset();
    resultadoEntrenador.textContent = "Entrenador autorizado.";
    resultadoEntrenador.classList.add("is-success");
    await cargarDashboard();
  } catch (error) {
    resultadoEntrenador.textContent = error.message;
    resultadoEntrenador.classList.add("is-error");
  } finally {
    botonGuardarEntrenador.disabled = false;
    botonGuardarEntrenador.textContent = "Autorizar";
  }
});

for (const boton of document.querySelectorAll("[data-tab]")) {
  boton.addEventListener("click", () => seleccionarTab(boton.dataset.tab));
}

async function iniciar() {
  try {
    const { usuario } = await solicitar("/api/me");

    if (!usuario) {
      estado.textContent = "PokeBot disponible";
      document.body.dataset.health = "ok";
      return;
    }

    estadoApp.usuario = usuario;
    document.querySelector("#usuario-nombre").textContent = usuario.nombre;
    document.querySelector("#usuario-rol").textContent = usuario.rol;
    document.querySelector("#tab-entrenadores").hidden = usuario.rol !== "administrador";
    mostrarAvatar(usuario);
    landing.hidden = true;
    dashboard.hidden = false;
    await cargarDashboard();
  } catch {
    estado.textContent = "PokeBot no disponible";
    document.body.dataset.health = "error";
  }
}

iniciar();
