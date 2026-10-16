/**
 * Empresa Demo - Sistema de Reporte de Horas de Operarios (FO-000)
 * Backend Google Apps Script
 *
 * Las listas desplegables (Trabajadores, Centro de trabajo, Actividad, Maquina y,
 * opcionalmente, Festivos) se leen en cada carga desde la hoja 'Consolidado Codigos'.
 * Para dar de alta un trabajador nuevo basta con agregarlo en la columna "Trabajadores"
 * con el formato "CODIGO NOMBRE COMPLETO" (ej: "192 OPERARIO NUEVO DEMO"); la app lo
 * mostrará la próxima vez que se abra o se seleccione un trabajador.
 */

const CONFIG = {
  // Libro de Google Sheets. Si el script está vinculado al libro se usa el libro activo;
  // si no (script independiente), se abre por ID.
  SPREADSHEET_ID: 'TU_SPREADSHEET_ID',
  HOJA_REGISTROS: 'Registros',
  HOJAS_CONSOLIDADO: ['Consolidado Codigos', 'Consolidado Códigos', 'Consolidado'],
  ZONA_HORARIA: 'America/Bogota',
  MAX_MINUTOS_JORNADA: 16 * 60, // Límite estricto de 16 horas (960 minutos)
  MINUTOS_JORNADA_ORDINARIA: (9 * 60) + 19, // 9 horas y 19 minutos (559 min)
  DIAS_VENTANA_PENDIENTES: 20, // Días calendario hacia atrás para buscar planillas faltantes
  ESPERA_BLOQUEO_MS: 30000, // Espera máxima para escribir cuando varios operarios envían a la vez
  MAQUINA_PAUSA: '98 - OTROS', // Máquina que registran los botones Desayuno, Almuerzo, Permiso y Cierre
  CABECERAS: [
    'Día de registro',
    'Trabajador',
    'Fecha - laborada',
    'N° Labor',
    'Hora Inicio',
    'Hora Fin',
    'Horas Dedicada',
    'N° Orden',
    'Centro de Trabajo',
    'Actividad / Labor',
    'Máquina'
  ]
};

// LISTAS DE RESPALDO: solo se usan si la hoja 'Consolidado Codigos' no existe o una columna está vacía.
const LISTAS_DEFAULT = {
  trabajadores: [
    "501 OPERARIO DEMO 501",
    "502 OPERARIO DEMO 502",
    "503 OPERARIO DEMO 503",
    "504 OPERARIO DEMO 504",
    "505 OPERARIO DEMO 505",
    "506 OPERARIO DEMO 506",
    "507 OPERARIO DEMO 507",
    "508 OPERARIO DEMO 508",
    "509 OPERARIO DEMO 509",
    "510 OPERARIO DEMO 510",
    "511 OPERARIO DEMO 511",
    "512 OPERARIO DEMO 512",
    "513 OPERARIO DEMO 513",
    "514 OPERARIO DEMO 514",
    "515 OPERARIO DEMO 515",
    "516 OPERARIO DEMO 516",
    "517 OPERARIO DEMO 517",
    "518 OPERARIO DEMO 518",
    "519 OPERARIO DEMO 519",
    "520 OPERARIO DEMO 520",
    "521 OPERARIO DEMO 521",
    "522 OPERARIO DEMO 522",
    "523 OPERARIO DEMO 523",
    "524 OPERARIO DEMO 524",
    "525 OPERARIO DEMO 525",
    "526 OPERARIO DEMO 526",
    "527 OPERARIO DEMO 527",
    "528 OPERARIO DEMO 528",
    "529 OPERARIO DEMO 529",
    "530 OPERARIO DEMO 530",
    "531 OPERARIO DEMO 531",
    "532 OPERARIO DEMO 532"
  ],
  centros: [
    "0 - OTROS", "1 - CENTRO 1", "2 - CENTRO 2", "3 - CENTRO 3", "4 - CENTRO 4", "5 - CENTRO 5",
    "6 - CENTRO 6", "7 - CENTRO 7", "8 - CENTRO 8", "9 - CENTRO 9", "10 - CENTRO 10",
    "11 - CENTRO 11", "12 - CENTRO 12"
  ],
  actividades: [
    "10 - ALISTAMIENTO", "11 - FABRICACIÓN", "12 - MANUAL", "13 - ASEO", "14 - MANTENIMIENTO",
    "15 - REVISIÓN", "16 - ALMACENAMIENTO", "17 - DESPACHOS", "18 - INVENTARIO", "19 - REUNIÓN",
    "20 - DESCANSO", "21 - MENSAJERÍA", "22 - CHATARRA", "23 - PERMISO", "24 - LOGÍSTICA"
  ],
  maquinas: [
    "0 - NINGUNA",
    "98 - OTROS",
    "1 - MAQUINA 01",
    "2 - MAQUINA 02",
    "3 - MAQUINA 03",
    "4 - MAQUINA 04",
    "5 - MAQUINA 05",
    "6 - MAQUINA 06",
    "7 - MAQUINA 07",
    "8 - MAQUINA 08",
    "9 - MAQUINA 09",
    "10 - MAQUINA 10",
    "11 - MAQUINA 11",
    "12 - MAQUINA 12",
    "13 - MAQUINA 13",
    "14 - MAQUINA 14",
    "15 - MAQUINA 15",
    "16 - MAQUINA 16",
    "17 - MAQUINA 17",
    "18 - MAQUINA 18",
    "19 - MAQUINA 19",
    "20 - MAQUINA 20",
    "21 - MAQUINA 21",
    "22 - MAQUINA 22",
    "23 - MAQUINA 23",
    "24 - MAQUINA 24",
    "25 - MAQUINA 25",
    "26 - MAQUINA 26",
    "27 - MAQUINA 27",
    "28 - MAQUINA 28",
    "29 - MAQUINA 29",
    "30 - MAQUINA 30",
    "31 - MAQUINA 31",
    "32 - MAQUINA 32"
  ],
  // Festivos de Colombia. Se pueden ampliar sin tocar código agregando una columna
  // "Festivos" (fechas) en la hoja 'Consolidado Codigos'.
  festivos: [
    "2025-01-01", "2025-01-06", "2025-03-24", "2025-04-17", "2025-04-18", "2025-05-01",
    "2025-06-02", "2025-06-23", "2025-06-30", "2025-07-20", "2025-08-07", "2025-08-18",
    "2025-10-13", "2025-11-03", "2025-11-17", "2025-12-08", "2025-12-25",
    "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01",
    "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29", "2026-07-20", "2026-08-07",
    "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25",
    "2027-01-01", "2027-01-11", "2027-03-22", "2027-03-25", "2027-03-26", "2027-05-01",
    "2027-05-10", "2027-05-31", "2027-06-07", "2027-07-05", "2027-07-20", "2027-08-07",
    "2027-08-16", "2027-10-18", "2027-11-01", "2027-11-15", "2027-12-08", "2027-12-25"
  ]
};

function doGet() {
  // Las listas se inyectan en la página al cargarla, así un trabajador nuevo aparece de inmediato.
  const plantilla = HtmlService.createTemplateFromFile('Index');
  plantilla.datosIniciales = JSON.stringify(obtenerListasConsolidado()).replace(/</g, '\\u003c');
  return plantilla.evaluate()
    .setTitle('Reporte de Horas - Empresa Demo (FO-000)')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

function obtenerLibro_() {
  const activo = SpreadsheetApp.getActiveSpreadsheet();
  return activo || SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function obtenerZonaHoraria_() {
  return Session.getScriptTimeZone() || CONFIG.ZONA_HORARIA;
}

/** Devuelve el código inicial de un texto tipo "98 - OTROS" o "501 OPERARIO DEMO 501" */
function extraerCodigo_(texto) {
  return String(texto || '').trim().split(/[\s-]/)[0];
}

/**
 * Lee la hoja 'Consolidado Codigos' en tiempo real. Las columnas se identifican por su
 * cabecera (Trabajadores, Centro de trabajo, Actividad, Maquina, Festivos); si una cabecera
 * no se reconoce se usa la posición A, B, C, D.
 * @returns {Object} { trabajadores, centros, actividades, maquinas, festivos, fuente }
 */
function obtenerListasConsolidado() {
  const listas = {
    trabajadores: LISTAS_DEFAULT.trabajadores.slice(),
    centros: LISTAS_DEFAULT.centros.slice(),
    actividades: LISTAS_DEFAULT.actividades.slice(),
    maquinas: LISTAS_DEFAULT.maquinas.slice(),
    festivos: LISTAS_DEFAULT.festivos.slice(),
    fuente: 'predeterminado'
  };

  try {
    const ss = obtenerLibro_();
    let hoja = null;
    for (let i = 0; i < CONFIG.HOJAS_CONSOLIDADO.length && !hoja; i++) {
      hoja = ss.getSheetByName(CONFIG.HOJAS_CONSOLIDADO[i]);
    }
    if (!hoja) return listas;

    const valores = hoja.getDataRange().getValues();
    if (valores.length <= 1) return listas;

    const cols = { trabajadores: -1, centros: -1, actividades: -1, maquinas: -1, festivos: -1 };
    valores[0].forEach((c, idx) => {
      const cab = String(c || '').trim().toLowerCase();
      if (/festivo/.test(cab)) cols.festivos = idx;
      else if (/trabajador|operario|nombre/.test(cab)) cols.trabajadores = idx;
      else if (/centro/.test(cab)) cols.centros = idx;
      else if (/actividad/.test(cab)) cols.actividades = idx;
      else if (/m[aá]quina/.test(cab)) cols.maquinas = idx;
    });

    // Respaldo posicional si las cabeceras varían: Col A=0, B=1, C=2, D=3
    ['trabajadores', 'centros', 'actividades', 'maquinas'].forEach((clave, pos) => {
      if (cols[clave] === -1 && valores[0].length > pos) cols[clave] = pos;
    });

    const tz = obtenerZonaHoraria_();
    function extraerColumna(colIdx, esFecha) {
      const res = [];
      const vistos = {};
      if (colIdx === -1) return res;
      for (let i = 1; i < valores.length; i++) {
        const celda = valores[i][colIdx];
        const val = esFecha ? fechaCeldaAISO_(celda, tz) : String(celda === null || celda === undefined ? '' : celda).trim();
        if (val && !vistos[val]) {
          vistos[val] = true;
          res.push(val);
        }
      }
      return res;
    }

    ['trabajadores', 'centros', 'actividades', 'maquinas'].forEach(clave => {
      const leidos = extraerColumna(cols[clave], false);
      if (leidos.length > 0) listas[clave] = leidos;
    });

    // Festivos de la hoja se suman a los predeterminados
    extraerColumna(cols.festivos, true).forEach(f => {
      if (listas.festivos.indexOf(f) === -1) listas.festivos.push(f);
    });

    // Los accesos rápidos (Desayuno, Almuerzo, Permiso, Cierre) registran exactamente CONFIG.MAQUINA_PAUSA;
    // si la hoja no la tiene con ese texto se agrega, y siempre existe '0 - NINGUNA'
    if (listas.maquinas.indexOf(CONFIG.MAQUINA_PAUSA) === -1) listas.maquinas.unshift(CONFIG.MAQUINA_PAUSA);
    if (listas.maquinas.map(extraerCodigo_).indexOf('0') === -1) listas.maquinas.unshift('0 - NINGUNA');

    listas.fuente = hoja.getName();
  } catch (e) {
    Logger.log('Error en obtenerListasConsolidado: ' + e.toString());
    listas.fuente = 'fallback';
  }
  return listas;
}

/**
 * Lee de la hoja "Registros" solo las columnas B (Trabajador) y C (Fecha laborada)
 * y devuelve un mapa { 'yyyy-MM-dd': true } con las fechas reportadas por el trabajador.
 */
function leerFechasTrabajador_(hoja, trabajador, tz) {
  const fechas = {};
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return fechas;

  const datos = hoja.getRange(2, 2, ultimaFila - 1, 2).getValues();
  const buscado = String(trabajador).trim();
  for (let i = 0; i < datos.length; i++) {
    if (String(datos[i][0] || '').trim() === buscado) {
      const iso = fechaCeldaAISO_(datos[i][1], tz);
      if (iso) fechas[iso] = true;
    }
  }
  return fechas;
}

function estadoVacio_() {
  return {
    fechasReportadas: [],
    ultimaFechaRegistrada: null,
    primerDiaPendiente: null,
    diasPendientesHistoricos: [],
    totalDiasPendientes: 0
  };
}

/**
 * Devuelve para el trabajador:
 * 1. Fechas reportadas
 * 2. Última fecha registrada
 * 3. Días hábiles pendientes (lunes a viernes, sin festivos) en la ventana de
 *    CONFIG.DIAS_VENTANA_PENDIENTES días, sin contar hoy (la jornada aún no termina).
 * @param {string} trabajador
 * @param {Array<string>} [festivos] Si no se envía se leen de la hoja Consolidado.
 */
function obtenerEstadoTrabajador(trabajador, festivos) {
  if (!trabajador) return estadoVacio_();

  try {
    const hoja = obtenerLibro_().getSheetByName(CONFIG.HOJA_REGISTROS);
    if (!hoja) return estadoVacio_();

    const tz = obtenerZonaHoraria_();
    const fechas = leerFechasTrabajador_(hoja, trabajador, tz);
    const arrayFechas = Object.keys(fechas).sort();

    const listaFestivos = festivos || obtenerListasConsolidado().festivos;
    const esFestivo = {};
    listaFestivos.forEach(f => { esFestivo[f] = true; });

    const hoy = new Date();
    const huecos = [];
    for (let i = CONFIG.DIAS_VENTANA_PENDIENTES; i >= 1; i--) {
      const d = new Date(hoy.getTime() - i * 86400000);
      const iso = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
      const diaSemana = Number(Utilities.formatDate(d, tz, 'u')); // 1 = lunes ... 7 = domingo
      if (diaSemana <= 5 && !esFestivo[iso] && !fechas[iso]) huecos.push(iso);
    }

    return {
      fechasReportadas: arrayFechas,
      ultimaFechaRegistrada: arrayFechas.length ? arrayFechas[arrayFechas.length - 1] : null,
      primerDiaPendiente: huecos.length ? huecos[0] : null,
      diasPendientesHistoricos: huecos,
      totalDiasPendientes: huecos.length
    };
  } catch (e) {
    Logger.log('Error en obtenerEstadoTrabajador: ' + e.toString());
    return estadoVacio_();
  }
}

function obtenerFechasReportadas(trabajador) {
  return obtenerEstadoTrabajador(trabajador).fechasReportadas;
}

function obtenerDatosIniciales(trabajador) {
  const listas = obtenerListasConsolidado();
  return {
    listas: listas,
    estadoTrabajador: obtenerEstadoTrabajador(trabajador, listas.festivos)
  };
}

/**
 * Recibe las labores de UNA jornada (un trabajador, una fecha) y las guarda en "Registros".
 * Validaciones en servidor: horas militares válidas, tope de 16 h por labor y por jornada,
 * fecha no futura, un solo trabajador/fecha por lote y que la jornada no exista ya.
 * @param {Array<Object>} filas - Registros de la planilla diaria
 * @returns {Object} Resultado con horas trabajadas, ordinarias, extras y estado
 */
function guardarPlanillaLote(filas) {
  let lock = null;
  try {
    if (!filas || !Array.isArray(filas) || filas.length === 0) {
      return { success: false, count: 0, mensaje: 'No hay labores para guardar en la planilla.' };
    }

    const tz = obtenerZonaHoraria_();
    const trabajador = String(filas[0].trabajador || '').trim();
    const fechaReporte = String(filas[0].fechaReporte || '').trim();
    const hoyIso = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

    if (!trabajador) return errorLote_('Falta el trabajador en la planilla.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaReporte)) return errorLote_('La fecha de la jornada no es válida.');
    if (fechaReporte > hoyIso) return errorLote_('No se puede reportar una fecha futura (' + fechaReporte + ').');

    // 1. VALIDACIÓN ESTRICTA (horas y tope de 16 h) ANTES DE TOCAR LA HOJA
    let minutosTotalesLote = 0;
    const minutosPorFila = [];
    let finAnterior = null; // minutos de la hora fin de la labor anterior (null tras un cierre)
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      const etiqueta = '#' + (f.item || (i + 1));

      if (String(f.trabajador || '').trim() !== trabajador || String(f.fechaReporte || '').trim() !== fechaReporte) {
        return errorLote_('Todas las labores deben ser del mismo trabajador y la misma fecha (labor ' + etiqueta + ').');
      }

      const minI = horaAMinutos(f.horaInicio);
      if (minI === null) {
        return errorLote_('Error de validación: Formato de hora militar inválido en la labor ' + etiqueta);
      }

      // Cadena de horario: cada labor inicia cuando termina la anterior
      if (finAnterior !== null && minI !== finAnterior) {
        return errorLote_(`Error de validación: La labor ${etiqueta} inicia a las ${minutosAHHMMSS(minI).slice(0, 5)}, pero la anterior termina a las ${minutosAHHMMSS(finAnterior).slice(0, 5)}. Las horas deben coincidir.`);
      }

      const esCierre = f.esCierre || !f.horaFin;
      if (esCierre) {
        minutosPorFila.push(null);
        finAnterior = null;
        continue;
      }

      const minF = horaAMinutos(f.horaFin);
      if (minF === null) {
        return errorLote_('Error de validación: Formato de hora militar inválido en la labor ' + etiqueta);
      }

      const diff = diferenciaMinutos_(minI, minF);
      if (diff > CONFIG.MAX_MINUTOS_JORNADA) {
        return errorLote_(`Error en Base de Datos: La labor ${etiqueta} dura ${Math.floor(diff / 60)}h ${diff % 60}m, superando el tope máximo de 16 horas.`);
      }
      minutosPorFila.push(diff);
      minutosTotalesLote += diff;
      finAnterior = minF;
    }

    if (minutosTotalesLote > CONFIG.MAX_MINUTOS_JORNADA) {
      return errorLote_(`Error en Base de Datos: El tiempo total de la jornada (${Math.floor(minutosTotalesLote / 60)}h ${minutosTotalesLote % 60}m) supera el tope máximo permitido de 16 horas.`);
    }

    // 2. ESCRITURA CON BLOQUEO: evita que dos envíos simultáneos escriban en la misma fila
    lock = LockService.getScriptLock();
    if (!lock.tryLock(CONFIG.ESPERA_BLOQUEO_MS)) {
      lock = null;
      return errorLote_('El servidor está ocupado guardando otras planillas. Intenta de nuevo en unos segundos.');
    }

    const ss = obtenerLibro_();
    let hoja = ss.getSheetByName(CONFIG.HOJA_REGISTROS);
    if (!hoja) {
      hoja = ss.insertSheet(CONFIG.HOJA_REGISTROS);
      hoja.appendRow(CONFIG.CABECERAS);
      hoja.getRange(1, 1, 1, CONFIG.CABECERAS.length)
        .setFontWeight('bold')
        .setBackground('#004b87')
        .setFontColor('#ffffff');
    }

    // Anti-duplicados: la jornada no puede enviarse dos veces (doble toque, otro dispositivo, etc.)
    if (leerFechasTrabajador_(hoja, trabajador, tz)[fechaReporte]) {
      return errorLote_('La jornada del ' + fechaReporte + ' de ' + trabajador + ' ya fue registrada. Si requieres modificarla, comunícate con tu supervisor.');
    }

    const partesFecha = fechaReporte.split('-');
    const fechaLaborada = new Date(Number(partesFecha[0]), Number(partesFecha[1]) - 1, Number(partesFecha[2]));
    const marcaTiempo = new Date();

    const datosParaHoja = filas.map((datos, index) => {
      const minutos = minutosPorFila[index];
      const orden = parseInt(datos.numeroOrden, 10);
      return [
        marcaTiempo,                                                     // A: Día de registro
        trabajador,                                                      // B: Trabajador
        fechaLaborada,                                                   // C: Fecha - laborada
        parseInt(datos.item, 10) || (index + 1),                         // D: N° Labor
        minutosAHHMMSS(horaAMinutos(datos.horaInicio)),                  // E: Hora Inicio
        minutos === null ? '' : minutosAHHMMSS(horaAMinutos(datos.horaFin)), // F: Hora Fin (vacío si es Cierre)
        minutos === null ? '' : minutosAHHMMSS(minutos),                 // G: Horas Dedicada (recalculada en servidor)
        isNaN(orden) ? 0 : orden,                                        // H: N° Orden
        String(datos.centroTrabajo || '').trim(),                        // I: Centro de Trabajo
        String(datos.actividad || '').trim(),                            // J: Actividad / Labor
        String(datos.maquina || '').trim()                               // K: Máquina
      ];
    });

    const filaDestino = hoja.getLastRow() + 1;
    const numFilas = datosParaHoja.length;
    const numCols = CONFIG.CABECERAS.length;

    if (hoja.getMaxColumns() < numCols) {
      hoja.insertColumnsAfter(hoja.getMaxColumns(), numCols - hoja.getMaxColumns());
    }
    if (filaDestino + numFilas - 1 > hoja.getMaxRows()) {
      hoja.insertRowsAfter(hoja.getMaxRows(), (filaDestino + numFilas - 1) - hoja.getMaxRows() + 20);
    }

    hoja.getRange(filaDestino, 1, numFilas, numCols).setValues(datosParaHoja);
    hoja.getRange(filaDestino, 1, numFilas, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    hoja.getRange(filaDestino, 3, numFilas, 1).setNumberFormat('yyyy-mm-dd');
    hoja.getRange(filaDestino, 4, numFilas, 1).setNumberFormat('0');
    hoja.getRange(filaDestino, 5, numFilas, 3).setNumberFormat('@');
    hoja.getRange(filaDestino, 8, numFilas, 1).setNumberFormat('0');
    SpreadsheetApp.flush();
    lock.releaseLock();
    lock = null;

    const minutosOrd = Math.min(minutosTotalesLote, CONFIG.MINUTOS_JORNADA_ORDINARIA);
    const minutosExt = Math.max(0, minutosTotalesLote - CONFIG.MINUTOS_JORNADA_ORDINARIA);

    return {
      success: true,
      count: numFilas,
      mensaje: '¡Planilla guardada exitosamente! ' + numFilas + ' labores registradas.',
      resumen: {
        totalHoras: minutosAHHMMSS(minutosTotalesLote),
        horasOrdinarias: minutosAHHMMSS(minutosOrd),
        horasExtras: minutosAHHMMSS(minutosExt),
        minutosTotales: minutosTotalesLote,
        minutosExtras: minutosExt,
        hExtras: Math.floor(minutosExt / 60),
        mExtras: minutosExt % 60
      },
      estadoTrabajador: obtenerEstadoTrabajador(trabajador)
    };
  } catch (error) {
    Logger.log('Error en guardarPlanillaLote: ' + error.toString());
    return errorLote_('Error en el servidor al guardar: ' + error.message);
  } finally {
    if (lock) lock.releaseLock();
  }
}

function errorLote_(mensaje) {
  return { success: false, count: 0, mensaje: mensaje };
}

function minutosAHHMMSS(totalMinutos) {
  if (totalMinutos === null || totalMinutos === undefined || isNaN(totalMinutos)) return '00:00:00';
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/** Diferencia en minutos entre dos horas; si fin < inicio se asume cruce de medianoche. */
function diferenciaMinutos_(minI, minF) {
  return minF >= minI ? minF - minI : (1440 - minI) + minF;
}

/** Convierte "730" / "0730" / "07:30" a "07:30:00". Devuelve '' si la hora es inválida. */
function normalizarHoraA_HHMMSS(horaMilitar) {
  const min = horaAMinutos(horaMilitar);
  return min === null ? '' : minutosAHHMMSS(min);
}

function calcularHorasDedicadas(horaInicio, horaFin) {
  if (!horaFin) return '';
  const minI = horaAMinutos(horaInicio);
  const minF = horaAMinutos(horaFin);
  if (minI === null || minF === null) return '00:00:00';
  return minutosAHHMMSS(diferenciaMinutos_(minI, minF));
}

function horaAMinutos(hora) {
  if (!hora && hora !== 0) return null;
  const str = hora.toString().replace(/[^0-9]/g, '');
  if (str.length < 3 || str.length > 4) return null;
  const corte = str.length - 2;
  const h = parseInt(str.substring(0, corte), 10);
  const m = parseInt(str.substring(corte), 10);
  if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return null;
  return (h * 60) + m;
}

/** Convierte una celda (Date o texto) a 'yyyy-MM-dd'. Devuelve null si no es una fecha. */
function fechaCeldaAISO_(valor, tz) {
  if (valor instanceof Date) {
    return isNaN(valor.getTime()) ? null : Utilities.formatDate(valor, tz, 'yyyy-MM-dd');
  }
  if (typeof valor === 'string' && valor.trim() !== '') return parsearFechaString(valor);
  return null;
}

function parsearFechaString(cadena) {
  if (!cadena) return null;
  cadena = cadena.toString().trim();
  // Formato YYYY-MM-DD o YYYY/MM/DD
  const matchIso = cadena.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (matchIso) {
    return `${matchIso[1]}-${matchIso[2].padStart(2, '0')}-${matchIso[3].padStart(2, '0')}`;
  }
  // Formato DD-MM-YYYY o DD/MM/YYYY (Estándar en Colombia)
  const matchLatam = cadena.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (matchLatam) {
    return `${matchLatam[3]}-${matchLatam[2].padStart(2, '0')}-${matchLatam[1].padStart(2, '0')}`;
  }
  return null;
}
