// Simula google.script.run (asíncrono, serializa como Apps Script) y la evaluación de la plantilla de doGet
(function () {
  if (!__libro._hojas['Consolidado Codigos']) {
    const extra = JSON.parse(sessionStorage.getItem('__extraTrab') || '[]');
    __libro._set('Consolidado Codigos', armarConsolidado(extra));
    __libro._set('Registros', armarRegistros());
  }
  window.__retraso = 150;
  window.__llamadas = [];
  window.__retrasosPorLlamada = [];   // para pruebas de carrera: retrasos para las próximas llamadas
  function crearRunner(ok, fail) {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'withSuccessHandler') return h => crearRunner(h, fail);
        if (prop === 'withFailureHandler') return h => crearRunner(ok, h);
        return function () {
          const args = JSON.parse(JSON.stringify(Array.from(arguments)));
          window.__llamadas.push({ fn: prop, args });
          const retraso = window.__retrasosPorLlamada.length ? window.__retrasosPorLlamada.shift() : window.__retraso;
          setTimeout(() => {
            try {
              if (window.__fallarServidor) throw new Error('Sin conexión simulada');
              const res = window[prop].apply(null, args);
              ok && ok(JSON.parse(JSON.stringify(res === undefined ? null : res)));
            } catch (e) { fail && fail(e); }
          }, retraso);
        };
      }
    });
  }
  window.google = { script: { get run() { return crearRunner(null, null); } } };

  // Equivalente a plantilla.evaluate(): inyecta las listas en <script id="datosServidor">
  const salida = doGet();
  if (salida._t && !sessionStorage.getItem('__sinPlantilla')) {
    document.write('<script type="application/json" id="datosServidor">' + salida._t.datosIniciales + '<\/script>');
  }
})();
