const landing = document.querySelector("#landing");
const dashboard = document.querySelector("#dashboard");
const estado = document.querySelector("#estado");
const alertaGlobal = document.querySelector("#alerta-global");
const formulario = document.querySelector("#form-ejemplo");
const botonGuardar = document.querySelector("#guardar-ejemplo");
const resultadoFormulario = document.querySelector("#resultado-formulario");
const formularioRasgo = document.querySelector("#form-rasgo");
const botonGuardarRasgo = document.querySelector("#guardar-rasgo");
const resultadoRasgo = document.querySelector("#resultado-rasgo");
const buscador = document.querySelector("#buscar-ejemplo");
const formularioEntrenador = document.querySelector("#form-entrenador");
const botonGuardarEntrenador = document.querySelector("#guardar-entrenador");
const resultadoEntrenador = document.querySelector("#resultado-entrenador");
const formularioImportacion = document.querySelector("#form-importacion");
const archivoMensajes = document.querySelector("#archivo-mensajes");
const botonGuardarImportacion = document.querySelector("#guardar-importacion");
const resultadoImportacion = document.querySelector("#resultado-importacion");
const tutorial = document.querySelector("#tutorial");
const botonTutorialAnterior = document.querySelector("#tutorial-anterior");
const botonTutorialSiguiente = document.querySelector("#tutorial-siguiente");
const maximoArchivoMensajesBytes = 2 * 1024 * 1024;

const secciones = {
  entrenar: ["Entrenar", "Crea ejemplos claros para definir el estilo."],
  ejemplos: ["Ejemplos", "Revisa lo que PokeBot está usando para aprender."],
  mensajes: ["Mensajes", "Importa conversaciones y revisa lo que Gemini propone."],
  analiticas: ["Analíticas", "Observa cómo responden los amigos en Discord."],
  entrenadores: ["Entrenadores", "Administra accesos y el peso de cada persona."],
};

const estadoApp = {
  usuario: null,
  datos: null,
  filtro: "",
  pasoTutorial: 0,
  pasosTutorial: [],
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

function crearPasosTutorial() {
  return [
    {
      tab: "entrenar",
      titulo: "Enséñale con ejemplos",
      descripcion: "Escribe un mensaje y la respuesta que mejor representa a Poke. Mientras más natural sea el ejemplo, mejor aprenderá su forma de hablar.",
    },
    {
      tab: "ejemplos",
      titulo: "Mira lo que aprende",
      descripcion: "Aquí quedan los ejemplos que usa PokeBot. Puedes revisar los aportes del resto y pausar los que ya no suenen a Poke.",
    },
    {
      tab: "analiticas",
      titulo: "Dale feedback en Discord",
      descripcion: "Cuando PokeBot responda, usa 👍 si acertó o 👎 si no. Es la forma más rápida de ayudarle a mejorar.",
    },
  ];
}

function renderTutorial() {
  const paso = estadoApp.pasosTutorial[estadoApp.pasoTutorial];
  seleccionarTab(paso.tab);
  document.querySelector("#tutorial-paso").textContent = `Paso ${estadoApp.pasoTutorial + 1} de ${estadoApp.pasosTutorial.length}`;
  document.querySelector("#tutorial-titulo").textContent = paso.titulo;
  document.querySelector("#tutorial-descripcion").textContent = paso.descripcion;
  botonTutorialAnterior.hidden = estadoApp.pasoTutorial === 0;
  botonTutorialSiguiente.textContent = estadoApp.pasoTutorial === estadoApp.pasosTutorial.length - 1 ? "Empezar" : "Continuar";

  const progreso = document.querySelector("#tutorial-progreso");
  progreso.replaceChildren();
  estadoApp.pasosTutorial.forEach((_, indice) => {
    const indicador = crearElemento("span", indice <= estadoApp.pasoTutorial ? "is-complete" : "");
    progreso.append(indicador);
  });
}

function iniciarTutorial() {
  estadoApp.pasosTutorial = crearPasosTutorial();
  estadoApp.pasoTutorial = 0;
  dashboard.inert = true;
  document.body.classList.add("is-tutorial-active");
  tutorial.hidden = false;
  renderTutorial();
  botonTutorialSiguiente.focus();
}

function cerrarTutorial() {
  tutorial.hidden = true;
  dashboard.inert = false;
  document.body.classList.remove("is-tutorial-active");
  seleccionarTab("entrenar");
  document.querySelector('[data-tab="entrenar"]').focus();
}

async function avanzarTutorial(direccion) {
  const siguientePaso = estadoApp.pasoTutorial + direccion;
  if (siguientePaso < 0) return;

  if (siguientePaso >= estadoApp.pasosTutorial.length) {
    botonTutorialSiguiente.disabled = true;
    botonTutorialSiguiente.textContent = "Guardando...";

    try {
      await solicitar("/api/onboarding/complete", { method: "POST" });
      estadoApp.datos.tutorialCompletado = true;
      cerrarTutorial();
    } catch (error) {
      mostrarAlerta("No se pudo guardar el tutorial. Inténtalo de nuevo.");
      botonTutorialSiguiente.textContent = "Empezar";
    } finally {
      botonTutorialSiguiente.disabled = false;
    }
    return;
  }

  estadoApp.pasoTutorial = siguientePaso;
  renderTutorial();
}

function crearElemento(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function mostrarAlerta(mensaje, esExito = false) {
  alertaGlobal.textContent = mensaje;
  alertaGlobal.classList.toggle("is-success", esExito);
  alertaGlobal.hidden = false;
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

function renderRasgos() {
  const contenedor = document.querySelector("#lista-rasgos");
  const rasgos = estadoApp.datos?.rasgos ?? [];
  contenedor.replaceChildren();

  if (rasgos.length === 0) {
    contenedor.append(crearElemento("p", "traits-empty", "Todavía no hay rasgos guardados."));
    return;
  }

  for (const rasgo of rasgos) {
    const fila = crearElemento("article", "trait-row");
    const meta = crearElemento("div", "trait-meta");
    const detalles = [
      rasgo.creadoPor ?? "Entrenador desconocido",
      `Peso ${rasgo.importancia}`,
      fechaCorta(rasgo.createdAt),
    ].join(" · ");
    meta.append(crearElemento("span", "", detalles));

    const acciones = crearElemento("div", "trait-actions");
    acciones.append(crearElemento(
      "span",
      `status-badge${rasgo.activo ? "" : " is-paused"}`,
      rasgo.activo ? "Activo" : "Pausado",
    ));

    if (estadoApp.usuario.rol === "administrador") {
      const boton = crearElemento("button", "example-action", rasgo.activo ? "Pausar" : "Activar");
      boton.type = "button";
      boton.addEventListener("click", () => cambiarEstadoRasgo(rasgo, boton));
      acciones.append(boton);
    }

    meta.append(acciones);
    fila.append(crearElemento("p", "", rasgo.contenido), meta);
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
    mostrarAlerta(error.message);
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

function renderAportantes() {
  const selector = document.querySelector("#aportado-por");
  const valorActual = selector.value;
  selector.replaceChildren();

  for (const entrenador of estadoApp.datos.entrenadores.filter(
    (item) => item.puedeEntrenar,
  )) {
    const opcion = crearElemento(
      "option",
      "",
      `${entrenador.nombre} · peso ${entrenador.importancia}`,
    );
    opcion.value = entrenador.id;
    opcion.selected = entrenador.id === valorActual;
    selector.append(opcion);
  }
}

async function analizarImportacion(importacion, boton, evento) {
  evento.preventDefault();
  evento.stopPropagation();
  boton.disabled = true;
  boton.textContent = "Analizando...";

  try {
    const resultado = await solicitar(`/api/message-imports/${importacion.id}/analyze`, {
      method: "POST",
    });
    await cargarDashboard();
    mostrarAlerta(`${resultado.propuestas} propuestas listas para revisar.`, true);
  } catch (error) {
    mostrarAlerta(error.message);
    boton.disabled = false;
    boton.textContent = importacion.estado === "error" ? "Reintentar" : "Analizar";
  }
}

function renderImportaciones() {
  const lista = document.querySelector("#lista-importaciones");
  const importaciones = estadoApp.datos.importaciones ?? [];
  lista.replaceChildren();
  document.querySelector("#conteo-importaciones").textContent = `${importaciones.length} archivos`;

  if (importaciones.length === 0) {
    const vacio = crearElemento("div", "empty-state");
    vacio.append(
      crearElemento("strong", "", "Todavía no hay conversaciones"),
      crearElemento("p", "", "Importa un archivo para iniciar el análisis."),
    );
    lista.append(vacio);
    return;
  }

  const nombresEstado = {
    pendiente: "Pendiente",
    analizando: "Analizando",
    listo: "Analizado",
    error: "Error",
  };

  for (const importacion of importaciones) {
    const analisisExpirado = importacion.estado === "analizando"
      && importacion.analisisIniciadoAt
      && Date.now() - new Date(importacion.analisisIniciadoAt).getTime() > 10 * 60 * 1000;
    const fila = crearElemento("details", "import-row");
    const resumen = crearElemento("summary", "import-summary");
    const archivo = crearElemento("div", "import-file");
    archivo.append(
      crearElemento("strong", "", importacion.nombreArchivo),
      crearElemento("span", "", `${importacion.formato.toUpperCase()} · Poke aparece como ${importacion.nombreObjetivo}`),
    );
    const aporte = crearElemento("span", "import-meta", `${importacion.aportadoPor} · peso ${importacion.importancia}`);
    const estado = crearElemento(
      "span",
      `import-status${importacion.estado === "listo" ? " is-ready" : ""}${importacion.estado === "error" ? " is-error" : ""}`,
      nombresEstado[importacion.estado],
    );
    resumen.append(archivo, aporte, estado);

    if (importacion.estado === "pendiente" || importacion.estado === "error" || analisisExpirado) {
      const boton = crearElemento(
        "button",
        "analyze-button",
        importacion.estado === "pendiente" ? "Analizar" : "Reintentar",
      );
      boton.type = "button";
      boton.addEventListener("click", (evento) => analizarImportacion(importacion, boton, evento));
      resumen.append(boton);
    } else {
      resumen.append(crearElemento("span", "import-meta", `${importacion.propuestas} propuestas`));
    }

    const detalle = crearElemento("div", "import-detail");
    detalle.append(crearElemento("p", "", importacion.error ?? importacion.resumen ?? "Esperando análisis."));
    if (importacion.patrones?.length) {
      const patrones = crearElemento("div", "pattern-list");
      for (const patron of importacion.patrones) patrones.append(crearElemento("span", "", patron));
      detalle.append(patrones);
    }
    fila.append(resumen, detalle);
    lista.append(fila);
  }
}

async function cambiarEstadoPropuesta(propuesta, estado, botones) {
  for (const boton of botones) boton.disabled = true;

  try {
    await solicitar(`/api/training-proposals/${propuesta.id}`, {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    });
    await cargarDashboard();
  } catch (error) {
    mostrarAlerta(error.message);
    for (const boton of botones) boton.disabled = false;
  }
}

function renderPropuestas() {
  const lista = document.querySelector("#lista-propuestas");
  const propuestas = estadoApp.datos.propuestas ?? [];
  const pendientes = propuestas.filter((propuesta) => propuesta.estado === "pendiente").length;
  lista.replaceChildren();
  document.querySelector("#conteo-propuestas").textContent = `${pendientes} pendientes de ${propuestas.length}`;

  if (propuestas.length === 0) {
    const vacio = crearElemento("div", "empty-state");
    vacio.append(
      crearElemento("strong", "", "No hay propuestas"),
      crearElemento("p", "", "Analiza una conversación para generarlas."),
    );
    lista.append(vacio);
    return;
  }

  for (const propuesta of propuestas) {
    const fila = crearElemento("article", "proposal-row");
    const entrada = crearElemento("div", "proposal-copy");
    entrada.append(crearElemento("span", "", "Mensaje"), crearElemento("p", "", propuesta.entrada));
    const respuesta = crearElemento("div", "proposal-copy");
    respuesta.append(crearElemento("span", "", "Respuesta de Poke"), crearElemento("p", "", propuesta.respuestaIdeal));
    const fuente = crearElemento(
      "div",
      "proposal-source",
      `${propuesta.nombreArchivo}\n${propuesta.aportadoPor} · peso ${propuesta.importancia}`,
    );
    const acciones = crearElemento("div", "proposal-actions");

    if (propuesta.estado === "pendiente") {
      const aprobar = crearElemento("button", "proposal-action is-approve", "Aprobar");
      const rechazar = crearElemento("button", "proposal-action", "Rechazar");
      aprobar.type = "button";
      rechazar.type = "button";
      const botones = [aprobar, rechazar];
      aprobar.addEventListener("click", () => cambiarEstadoPropuesta(propuesta, "aprobada", botones));
      rechazar.addEventListener("click", () => cambiarEstadoPropuesta(propuesta, "rechazada", botones));
      acciones.append(aprobar, rechazar);
    } else {
      acciones.append(crearElemento(
        "span",
        `status-badge${propuesta.estado === "rechazada" ? " is-paused" : ""}`,
        propuesta.estado === "aprobada" ? "Aprobada" : "Rechazada",
      ));
    }

    fila.append(entrada, respuesta, fuente, acciones);
    lista.append(fila);
  }
}

function renderTodo() {
  renderEjemplos();
  renderRasgos();
  renderAnaliticas();
  renderGestionEntrenadores();
  if (estadoApp.usuario.rol === "administrador") {
    renderAportantes();
    renderImportaciones();
    renderPropuestas();
  }
}

async function cargarDashboard() {
  try {
    estadoApp.datos = await solicitar("/api/dashboard");
    renderTodo();
    alertaGlobal.hidden = true;
    return true;
  } catch (error) {
    mostrarAlerta(error.message);
    return false;
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
    mostrarAlerta(error.message);
  } finally {
    boton.disabled = false;
  }
}

async function cambiarEstadoRasgo(rasgo, boton) {
  boton.disabled = true;
  try {
    await solicitar(`/api/traits/${rasgo.id}`, {
      method: "PATCH",
      body: JSON.stringify({ activo: !rasgo.activo }),
    });
    await cargarDashboard();
  } catch (error) {
    mostrarAlerta(error.message);
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

formularioRasgo.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  botonGuardarRasgo.disabled = true;
  botonGuardarRasgo.textContent = "Guardando...";
  resultadoRasgo.textContent = "";
  resultadoRasgo.className = "form-result";

  const datos = new FormData(formularioRasgo);

  try {
    await solicitar("/api/traits", {
      method: "POST",
      body: JSON.stringify({ contenido: datos.get("contenido") }),
    });
    formularioRasgo.reset();
    resultadoRasgo.textContent = "Rasgo guardado.";
    resultadoRasgo.classList.add("is-success");
    await cargarDashboard();
  } catch (error) {
    resultadoRasgo.textContent = error.message;
    resultadoRasgo.classList.add("is-error");
  } finally {
    botonGuardarRasgo.disabled = false;
    botonGuardarRasgo.textContent = "Guardar rasgo";
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

archivoMensajes.addEventListener("change", () => {
  const archivo = archivoMensajes.files[0];
  document.querySelector("#archivo-nombre").textContent = archivo?.name ?? "Seleccionar archivo";

  if (archivo && archivo.size > maximoArchivoMensajesBytes) {
    resultadoImportacion.textContent = "El archivo no puede superar los 2 MB.";
    resultadoImportacion.className = "form-result is-error";
  }
});

formularioImportacion.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const archivo = archivoMensajes.files[0];
  const extension = archivo?.name.split(".").pop()?.toLowerCase();

  if (!archivo || !["txt", "json", "csv"].includes(extension)) {
    resultadoImportacion.textContent = "Selecciona un archivo TXT, JSON o CSV.";
    resultadoImportacion.className = "form-result is-error";
    return;
  }

  if (archivo.size > maximoArchivoMensajesBytes) {
    resultadoImportacion.textContent = "El archivo no puede superar los 2 MB.";
    resultadoImportacion.className = "form-result is-error";
    return;
  }

  botonGuardarImportacion.disabled = true;
  botonGuardarImportacion.textContent = "Importando...";
  resultadoImportacion.textContent = "";
  resultadoImportacion.className = "form-result";
  const datos = new FormData(formularioImportacion);

  try {
    const texto = await archivo.text();
    await solicitar("/api/message-imports", {
      method: "POST",
      body: JSON.stringify({
        nombreArchivo: archivo.name,
        formato: extension,
        nombreObjetivo: datos.get("nombreObjetivo"),
        aportadoPorId: datos.get("aportadoPorId"),
        texto,
      }),
    });
    formularioImportacion.reset();
    document.querySelector("#archivo-nombre").textContent = "Seleccionar archivo";
    resultadoImportacion.textContent = "Conversación importada.";
    resultadoImportacion.classList.add("is-success");
    await cargarDashboard();
  } catch (error) {
    resultadoImportacion.textContent = error.message;
    resultadoImportacion.classList.add("is-error");
  } finally {
    botonGuardarImportacion.disabled = false;
    botonGuardarImportacion.textContent = "Importar";
  }
});

for (const boton of document.querySelectorAll("[data-tab]")) {
  boton.addEventListener("click", () => seleccionarTab(boton.dataset.tab));
}

botonTutorialAnterior.addEventListener("click", () => avanzarTutorial(-1));
botonTutorialSiguiente.addEventListener("click", () => avanzarTutorial(1));

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
    document.querySelector("#tab-mensajes").hidden = usuario.rol !== "administrador";
    mostrarAvatar(usuario);
    landing.hidden = true;
    dashboard.hidden = false;
    dashboard.inert = true;
    const panelListo = await cargarDashboard();
    if (panelListo && !estadoApp.datos.tutorialCompletado) {
      iniciarTutorial();
    } else {
      dashboard.inert = false;
    }
  } catch {
    estado.textContent = "PokeBot no disponible";
    document.body.dataset.health = "error";
  }
}

iniciar();
