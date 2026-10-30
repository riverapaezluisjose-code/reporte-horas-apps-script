// Simulador mínimo de los servicios de Google Apps Script usados por Codigo.gs
(function (g) {
  const TZ = 'America/Bogota';
  g.__errores = [];
  g.addEventListener('error', e => g.__errores.push(e.message + ' @ ' + e.filename + ':' + e.lineno + ':' + e.colno));

  function crearHoja(nombre, datos) {
    const hoja = {
      _nombre: nombre,
      _datos: datos.map(f => f.slice()),
      _maxRows: Math.max(1000, datos.length),
      _maxCols: Math.max(26, ...datos.map(f => f.length)),
      _formatos: [],
      getName() { return this._nombre; },
      getLastRow() {
        for (let i = this._datos.length - 1; i >= 0; i--) {
          if (this._datos[i].some(v => v !== '' && v !== null && v !== undefined)) return i + 1;
        }
        return 0;
      },
      getLastColumn() { return Math.max(0, ...this._datos.map(f => f.length)); },
      getMaxRows() { return this._maxRows; },
      getMaxColumns() { return this._maxCols; },
      insertRowsAfter(_, n) { this._maxRows += n; },
      insertColumnsAfter(_, n) { this._maxCols += n; },
      appendRow(fila) { this._datos[this.getLastRow()] = fila.slice(); },
      getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); },
      getRange(r, c, nr, nc) {
        nr = nr || 1; nc = nc || 1;
        const hojaRef = this;
        if (r + nr - 1 > hojaRef._maxRows) throw new Error('Rango fuera de la hoja (filas)');
        const rango = {
          getValues() {
            const res = [];
            for (let i = 0; i < nr; i++) {
              const fila = hojaRef._datos[r - 1 + i] || [];
              const out = [];
              for (let j = 0; j < nc; j++) {
                const v = fila[c - 1 + j];
                out.push(v === undefined || v === null ? '' : v);
              }
              res.push(out);
            }
            return res;
          },
          setValues(vals) {
            if (vals.length !== nr || vals.some(f => f.length !== nc)) throw new Error('Dimensiones de setValues no coinciden');
            for (let i = 0; i < nr; i++) {
              const idx = r - 1 + i;
              hojaRef._datos[idx] = hojaRef._datos[idx] || [];
              for (let j = 0; j < nc; j++) hojaRef._datos[idx][c - 1 + j] = vals[i][j];
            }
            return rango;
          },
          setNumberFormat(f) { hojaRef._formatos.push([r, c, nr, nc, f]); return rango; },
          setFontWeight() { return rango; },
          setBackground() { return rango; },
          setFontColor() { return rango; }
        };
        return rango;
      }
    };
    return hoja;
  }

  const libro = {
    _hojas: {},
    getSheetByName(n) { return this._hojas[n] || null; },
    insertSheet(n) { this._hojas[n] = crearHoja(n, []); return this._hojas[n]; },
    _set(n, datos) { this._hojas[n] = crearHoja(n, datos); return this._hojas[n]; },
    _del(n) { delete this._hojas[n]; }
  };

  g.__libro = libro;
  g.__activo = true;
  g.__lockOcupado = false;
  g.__locksLiberados = 0;
  g.__logs = [];

  g.SpreadsheetApp = {
    getActiveSpreadsheet() { return g.__activo ? libro : null; },
    openById(id) { g.__openByIdLlamado = id; return libro; },
    flush() {}
  };
  g.Session = { getScriptTimeZone() { return TZ; } };
  g.Logger = { log(m) { g.__logs.push(m); console.log('[Logger]', m); } };
  g.LockService = {
    getScriptLock() {
      return {
        tryLock() { return !g.__lockOcupado; },
        waitLock() { if (g.__lockOcupado) throw new Error('timeout'); },
        releaseLock() { g.__locksLiberados++; }
      };
    }
  };
  g.Utilities = {
    formatDate(fecha, tz, formato) {
      const partes = {};
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23'
      }).formatToParts(fecha).forEach(p => { partes[p.type] = p.value; });
      const u = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[partes.weekday];
      return formato
        .replace('yyyy', partes.year).replace('MM', partes.month).replace('dd', partes.day)
        .replace('HH', partes.hour).replace('mm', partes.minute).replace('ss', partes.second)
        .replace(/\bu\b/, String(u));
    }
  };
  g.HtmlService = {
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
    createTemplateFromFile(nombre) {
      const t = {
        _archivo: nombre,
        evaluate() {
          const salida = { _t: t, setTitle() { return salida; }, setXFrameOptionsMode() { return salida; }, addMetaTag() { return salida; } };
          return salida;
        }
      };
      return t;
    },
    createHtmlOutputFromFile(nombre) {
      const salida = { _archivo: nombre, setTitle() { return salida; }, setXFrameOptionsMode() { return salida; }, addMetaTag() { return salida; } };
      return salida;
    }
  };
})(window);
