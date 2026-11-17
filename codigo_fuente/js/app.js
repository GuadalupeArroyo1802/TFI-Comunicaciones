/**
 * TFI Comunicaciones - Comparador de Métodos de Paridad (VRC / LRC / Bidimensional)
 * UTN FRT - Ingeniería en Sistemas de Información
 *
 * Interfaz web. Equivale a la clase ComparadorParidadApp de main.py (Tkinter):
 * toda la matemática vive en paridad_logica.js (objeto global `Paridad`).
 */
(function () {
  'use strict';

  const P = window.Paridad;
  const $ = (id) => document.getElementById(id);

  // ---------------- Estado de la trama generada ----------------
  const estado = {
    generada: false,
    verificado: false,
    modo: 'texto',
    texto: '',
    relleno: 0,
    tipo: 'par',
    filas: 0,
    columnas: 0,
    // Lo que envió el emisor
    matrizOriginal: null,
    vrcTx: null,
    lrcTx: null,
    esquinaTx: null,
    // Lo que hay ahora en la grilla (lo que "recibe" el receptor)
    datos: null,
    vrc: null,
    lrc: null,
    esquina: null,
    // Referencias a los botones de la grilla
    celdasDatos: {},
    celdasVRC: {},
    celdasLRC: {},
    celdaEsquina: null,
    etiFilas: {},
    etiCols: {},
  };

  const GENERADORES = {
    simple: { fn: P.errorSimpleAleatorio, nombre: 'Error simple' },
    fila: { fn: P.errorDobleMismaFila, nombre: 'Error doble en la misma fila' },
    columna: { fn: P.errorDobleMismaColumna, nombre: 'Error doble en la misma columna' },
    rectangulo: { fn: P.errorRectanguloNoDetectable, nombre: 'Error de rectángulo' },
  };

  // ---------------- Elementos ----------------
  const el = {
    entrada: $('entrada'),
    lblEntrada: $('lbl-entrada'),
    contador: $('contador'),
    columnas: $('columnas'),
    hintColumnas: $('hint-columnas'),
    matriz: $('matriz'),
    vacio: $('vacio'),
    scroll: $('scroll-matriz'),
    resumen: $('resumen'),
    registro: $('registro'),
    tabla: $('tabla-cuerpo'),
    conclusion: $('conclusion'),
    desactualizado: $('desactualizado'),
    avisos: $('toasts'),
    estEmisor: $('est-emisor'),
    estCanal: $('est-canal'),
    estReceptor: $('est-receptor'),
  };

  // ---------------- Avisos (reemplazan a messagebox) ----------------
  function avisar(tipo, titulo, mensaje) {
    const n = document.createElement('div');
    n.className = 'toast ' + tipo;
    const s = document.createElement('strong');
    s.textContent = titulo;
    n.append(s, document.createTextNode(mensaje));
    el.avisos.append(n);
    setTimeout(() => n.remove(), tipo === 'error' ? 5200 : 4000);
  }

  // ---------------- Panel 1: Configuración ----------------
  const modoActual = () => document.querySelector('input[name="modo"]:checked').value;
  const paridadActual = () => document.querySelector('input[name="paridad"]:checked').value;

  function actualizarLabelEntrada() {
    if (modoActual() === 'texto') {
      el.lblEntrada.textContent = 'Ingresá el texto:';
      el.columnas.value = 8;
      el.columnas.disabled = true;
      el.hintColumnas.textContent = '(fijo en modo texto: 8 bits = 1 carácter ASCII)';
      el.entrada.classList.remove('bits');
      el.entrada.placeholder = 'Ej.: HOLA';
      el.entrada.inputMode = 'text';
    } else {
      el.lblEntrada.textContent = 'Ingresá los bits (solo 0 y 1):';
      el.columnas.disabled = false;
      el.hintColumnas.textContent = '(elegí cualquier valor ≥ 2)';
      el.entrada.classList.add('bits');
      el.entrada.placeholder = 'Ej.: 101100111010';
      el.entrada.inputMode = 'numeric';
    }
    el.entrada.value = '';
    ultimoValido = '';
    actualizarContador();
    el.entrada.focus();
  }

  // Validación en vivo: en modo bits solo deja escribir 0 y 1.
  let ultimoValido = el.entrada.value;
  function validarTeclaEntrada() {
    if (modoActual() === 'bits' && !/^[01]*$/.test(el.entrada.value)) {
      const pos = Math.max(0, el.entrada.selectionStart - (el.entrada.value.length - ultimoValido.length));
      el.entrada.value = ultimoValido;
      el.entrada.setSelectionRange(pos, pos);
      el.entrada.classList.remove('rechazo');
      void el.entrada.offsetWidth; // reinicia la animación
      el.entrada.classList.add('rechazo');
    }
    ultimoValido = el.entrada.value;
    actualizarContador();
  }

  function actualizarContador() {
    const v = el.entrada.value;
    if (!v) { el.contador.textContent = ''; return; }
    const cols = parseInt(el.columnas.value, 10);
    const nBits = modoActual() === 'texto' ? P.textoABits(v).length : v.length;
    const extra = modoActual() === 'texto' ? `${[...v].length} carácter(es) · ` : '';
    if (cols >= 2) {
      const filas = Math.ceil(nBits / cols);
      const rell = (cols - (nBits % cols)) % cols;
      el.contador.textContent = `${extra}${nBits} bits → ${filas} fila(s) de ${cols}` + (rell ? ` · +${rell} de relleno` : '');
    } else {
      el.contador.textContent = `${extra}${nBits} bits`;
    }
  }

  // ---------------- Generación de trama ----------------
  function generarTrama({ silencioso = false } = {}) {
    const modo = modoActual();
    const dato = el.entrada.value;
    const columnas = Number(el.columnas.value);

    if (!Number.isInteger(columnas) || columnas < 2) {
      avisar('error', 'Error', 'La cantidad de columnas debe ser un número entero mayor o igual a 2.');
      el.columnas.focus();
      return;
    }

    let bitsStr;
    if (modo === 'texto') {
      if (!dato) {
        avisar('error', 'Error', 'Debe ingresar un texto.');
        el.entrada.focus();
        return;
      }
      bitsStr = P.textoABits(dato);
    } else {
      if (!P.validarBits(dato)) {
        avisar('error', 'Error', 'Debe ingresar una secuencia válida de bits (solo 0 y 1, no vacía).');
        el.entrada.focus();
        return;
      }
      bitsStr = dato;
    }

    const { matriz, relleno } = P.armarMatriz(bitsStr, columnas);
    const tx = P.calcularBidimensional(matriz, paridadActual());

    Object.assign(estado, {
      generada: true,
      verificado: false,
      modo,
      texto: dato,
      relleno,
      tipo: paridadActual(),
      filas: matriz.length,
      columnas,
      matrizOriginal: matriz,
      vrcTx: tx.vrc,
      lrcTx: tx.lrc,
      esquinaTx: tx.esquina,
    });
    copiarTransmitidoAGrilla();

    if (relleno && !silencioso) {
      avisar('info', 'Aviso', `Se agregaron ${relleno} bit(s) de relleno (0) para completar la última fila.`);
    }

    dibujarGrilla();
    dibujarResumen();
    limpiarResultados();
    registrar('Sin errores aplicados.');
    el.scroll.scrollTo(0, 0);
  }

  function copiarTransmitidoAGrilla() {
    estado.datos = estado.matrizOriginal.map((f) => f.slice());
    estado.vrc = estado.vrcTx.slice();
    estado.lrc = estado.lrcTx.slice();
    estado.esquina = estado.esquinaTx;
  }

  // Si cada fila es exactamente un carácter ASCII, se muestra al costado.
  function caracteresPorFila() {
    if (estado.modo !== 'texto' || estado.columnas !== 8) return null;
    const chars = [...estado.texto];
    if (chars.some((c) => c.codePointAt(0) > 255)) return null;
    return chars.map((c) => {
      const cp = c.codePointAt(0);
      if (c === ' ') return '␠';
      if (cp < 32 || cp === 127) return '·';
      return c;
    });
  }

  function crearBit(valor, clases, etiqueta, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bit ' + clases;
    b.textContent = valor;
    b.setAttribute('aria-label', `${etiqueta}, valor ${valor}`);
    b.dataset.etiqueta = etiqueta;
    b.addEventListener('click', onClick);
    return b;
  }

  function eti(texto, clase = '') {
    const d = document.createElement('div');
    d.className = 'eti ' + clase;
    d.textContent = texto;
    return d;
  }

  function dibujarGrilla() {
    const { filas, columnas } = estado;
    const chars = caracteresPorFila();
    const m = el.matriz;
    m.replaceChildren();
    estado.celdasDatos = {};
    estado.celdasVRC = {};
    estado.celdasLRC = {};
    estado.etiFilas = {};
    estado.etiCols = {};

    const colsCss = `2.2rem repeat(${columnas}, var(--cell)) calc(var(--cell) + 8px)` + (chars ? ' auto' : '');
    m.style.gridTemplateColumns = colsCss;

    // Encabezado
    m.append(eti(''));
    for (let c = 0; c < columnas; c++) {
      const e = eti('c' + c);
      estado.etiCols[c] = e;
      m.append(e);
    }
    const eVRC = eti('VRC', 'par');
    eVRC.style.paddingLeft = '8px';
    m.append(eVRC);
    if (chars) m.append(eti('ASCII'));

    // Filas de datos
    for (let f = 0; f < filas; f++) {
      const ef = eti('f' + f);
      estado.etiFilas[f] = ef;
      m.append(ef);
      for (let c = 0; c < columnas; c++) {
        const b = crearBit(estado.datos[f][c], 'dato', `Dato fila ${f} columna ${c}`, () => alternar('dato', f, c));
        estado.celdasDatos[f + ',' + c] = b;
        m.append(b);
      }
      const bv = crearBit(estado.vrc[f], 'paridad vrc', `VRC de la fila ${f}`, () => alternar('vrc', f));
      estado.celdasVRC[f] = bv;
      m.append(bv);
      if (chars) {
        const ch = document.createElement('div');
        ch.className = 'car';
        ch.textContent = chars[f] ?? '';
        m.append(ch);
      }
    }

    // Fila LRC + esquina
    const eLRC = eti('LRC', 'par');
    eLRC.style.paddingTop = '8px';
    m.append(eLRC);
    for (let c = 0; c < columnas; c++) {
      const bl = crearBit(estado.lrc[c], 'paridad lrc', `LRC de la columna ${c}`, () => alternar('lrc', c));
      estado.celdasLRC[c] = bl;
      m.append(bl);
    }
    estado.celdaEsquina = crearBit(estado.esquina, 'esquina vrc lrc', 'Bit de esquina', () => alternar('esquina'));
    estado.celdaEsquina.title = 'Bit de esquina: paridad de la columna VRC (coincide con la paridad de la fila LRC).';
    m.append(estado.celdaEsquina);
    if (chars) m.append(document.createElement('div'));

    el.vacio.hidden = true;
    m.hidden = false;
  }

  function dibujarResumen() {
    const { modo, texto, filas, columnas, tipo, relleno } = estado;
    const bitsDatos = filas * columnas - relleno;
    const entrada = modo === 'texto'
      ? `"${texto.length > 18 ? texto.slice(0, 18) + '…' : texto}"`
      : `${bitsDatos} bits manuales`;
    const items = [
      ['Entrada', entrada],
      ['Matriz', `${filas} × ${columnas}`],
      ['Paridad', tipo],
      ['Relleno', `${relleno} bit(s)`],
    ];
    el.resumen.replaceChildren(...items.map(([k, v]) => {
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = v;
      li.append(k + ' ', b);
      return li;
    }));
    el.estEmisor.textContent = `${filas}×${columnas} · ${tipo}`;
  }

  // ---------------- Clic en un bit (toggle) ----------------
  function alternar(tipo, a, b) {
    let celda;
    if (tipo === 'dato') {
      estado.datos[a][b] = 1 - estado.datos[a][b];
      celda = estado.celdasDatos[a + ',' + b];
      celda.textContent = estado.datos[a][b];
      registrar(`Bit f${a}·c${b} invertido a mano.`);
    } else if (tipo === 'vrc') {
      estado.vrc[a] = 1 - estado.vrc[a];
      celda = estado.celdasVRC[a];
      celda.textContent = estado.vrc[a];
      registrar(`Bit VRC de la fila ${a} invertido a mano.`);
    } else if (tipo === 'lrc') {
      estado.lrc[a] = 1 - estado.lrc[a];
      celda = estado.celdasLRC[a];
      celda.textContent = estado.lrc[a];
      registrar(`Bit LRC de la columna ${a} invertido a mano.`);
    } else {
      estado.esquina = 1 - estado.esquina;
      celda = estado.celdaEsquina;
      celda.textContent = estado.esquina;
      registrar('Bit de esquina invertido a mano.');
    }
    // Igual que en Tkinter: el bit tocado vuelve a su color base.
    celda.classList.remove('err', 'corr');
    celda.setAttribute('aria-label', `${celda.dataset.etiqueta}, valor ${celda.textContent}`);
    marcarAlterados();
    if (estado.verificado) el.desactualizado.hidden = false;
  }

  /** Marca con borde punteado los bits que difieren de lo transmitido. */
  function marcarAlterados() {
    let n = 0;
    for (let f = 0; f < estado.filas; f++) {
      for (let c = 0; c < estado.columnas; c++) {
        const alt = estado.datos[f][c] !== estado.matrizOriginal[f][c];
        estado.celdasDatos[f + ',' + c].classList.toggle('alterado', alt);
        n += alt;
      }
      const altV = estado.vrc[f] !== estado.vrcTx[f];
      estado.celdasVRC[f].classList.toggle('alterado', altV);
      n += altV;
    }
    for (let c = 0; c < estado.columnas; c++) {
      const altL = estado.lrc[c] !== estado.lrcTx[c];
      estado.celdasLRC[c].classList.toggle('alterado', altL);
      n += altL;
    }
    const altE = estado.esquina !== estado.esquinaTx;
    estado.celdaEsquina.classList.toggle('alterado', altE);
    n += altE;

    el.estCanal.textContent = n === 0 ? 'Sin errores' : `${n} bit(s) alterado(s)`;
    el.estCanal.className = 'estado' + (n ? ' aviso' : '');
    return n;
  }

  function registrar(texto) {
    el.registro.textContent = texto;
  }

  // ---------------- Simulación de errores predefinidos ----------------
  function simularError(clave) {
    if (!estado.generada) {
      avisar('info', 'Atención', 'Primero generá una trama.');
      return;
    }
    restaurarOriginal({ mostrarAviso: false });
    const { fn, nombre } = GENERADORES[clave];
    const posiciones = fn(estado.filas, estado.columnas);
    if (posiciones === null) {
      avisar('info', 'Aviso',
        'La matriz es demasiado pequeña para este tipo de error (se necesitan al menos 2 filas y 2 columnas).');
      return;
    }
    for (const [f, c] of posiciones) {
      estado.datos[f][c] = 1 - estado.datos[f][c];
      const b = estado.celdasDatos[f + ',' + c];
      b.textContent = estado.datos[f][c];
      b.setAttribute('aria-label', `${b.dataset.etiqueta}, valor ${b.textContent}`);
    }
    marcarAlterados();
    registrar(`${nombre}: se invirtió ${posiciones.map(([f, c]) => `f${f}·c${c}`).join(', ')}.`);
  }

  function restaurarOriginal({ mostrarAviso = true } = {}) {
    if (!estado.generada) return;
    copiarTransmitidoAGrilla();
    for (let f = 0; f < estado.filas; f++) {
      for (let c = 0; c < estado.columnas; c++) {
        estado.celdasDatos[f + ',' + c].textContent = estado.datos[f][c];
      }
      estado.celdasVRC[f].textContent = estado.vrc[f];
    }
    for (let c = 0; c < estado.columnas; c++) estado.celdasLRC[c].textContent = estado.lrc[c];
    estado.celdaEsquina.textContent = estado.esquina;
    limpiarResaltado();
    marcarAlterados();
    limpiarResultados();
    registrar('Sin errores aplicados.');
    if (mostrarAviso) avisar('ok', 'Listo', 'Se restauró la trama original (sin errores).');
  }

  // ---------------- Verificación ----------------
  function verificar() {
    if (!estado.generada) {
      avisar('info', 'Atención', 'Primero generá una trama.');
      return;
    }
    const resultado = P.compararMetodos(
      estado.matrizOriginal, estado.tipo,
      estado.datos.map((f) => f.slice()),
      estado.vrc.slice(), estado.lrc.slice()
    );
    const alterados = marcarAlterados();
    resaltarResultado(resultado);
    llenarTabla(resultado, alterados);
    estado.verificado = true;
    el.desactualizado.hidden = true;
  }

  function limpiarResaltado() {
    el.matriz.querySelectorAll('.err, .corr').forEach((n) => n.classList.remove('err', 'corr'));
    el.matriz.querySelectorAll('.marcada').forEach((n) => n.classList.remove('marcada'));
  }

  function resaltarResultado(r) {
    limpiarResaltado();
    for (const f of r.vrc.filasError) {
      estado.celdasVRC[f].classList.add('err');
      estado.etiFilas[f].classList.add('marcada');
    }
    for (const c of r.lrc.columnasError) {
      estado.celdasLRC[c].classList.add('err');
      estado.etiCols[c].classList.add('marcada');
    }
    for (let f = 0; f < estado.filas; f++) {
      for (let c = 0; c < estado.columnas; c++) {
        if (estado.datos[f][c] !== estado.matrizOriginal[f][c]) {
          estado.celdasDatos[f + ',' + c].classList.add('err');
        }
      }
    }
    if (r.bidimensional.corrige) {
      const [f, c] = r.bidimensional.posicionCorregida;
      const b = estado.celdasDatos[f + ',' + c];
      b.classList.remove('err');
      b.classList.add('corr');
      b.dataset.orig = 1 - estado.datos[f][c];
      b.title = `El receptor invierte este bit: ${estado.datos[f][c]} → ${1 - estado.datos[f][c]}`;
    }
  }

  function pill(texto, clase) {
    const s = document.createElement('span');
    s.className = 'pill ' + clase;
    s.textContent = texto;
    return s;
  }

  function llenarTabla(r, alterados) {
    const fmtFilas = (l) => (l.length ? l.map((f) => `fila ${f}`).join(', ') : '—');
    const fmtCols = (l) => (l.length ? l.map((c) => `columna ${c}`).join(', ') : '—');
    const huboCambios = alterados > 0;
    const pillDetecta = (v) => (v ? pill('Sí', 'si') : pill('No', huboCambios ? 'no' : 'neutro'));

    const bidim = r.bidimensional;
    let posBidim;
    if (bidim.corrige) posBidim = `fila ${bidim.posicionCorregida[0]}, columna ${bidim.posicionCorregida[1]}`;
    else if (bidim.detecta) posBidim = fmtFilas(r.vrc.filasError) + ' / ' + fmtCols(r.lrc.columnasError);
    else posBidim = '—';

    const filas = [
      ['VRC', 'Paridad por fila', pillDetecta(r.vrc.detecta), pill('No corrige (solo detecta)', 'neutro'), fmtFilas(r.vrc.filasError)],
      ['LRC', 'Paridad por columna', pillDetecta(r.lrc.detecta), pill('No corrige (solo detecta)', 'neutro'), fmtCols(r.lrc.columnasError)],
      ['Bidimensional', 'VRC + LRC', pillDetecta(bidim.detecta),
        bidim.corrige ? pill('Sí', 'si') : pill('No', huboCambios ? 'no' : 'neutro'), posBidim],
    ];

    el.tabla.replaceChildren(...filas.map(([nombre, sub, det, cor, pos]) => {
      const tr = document.createElement('tr');
      const tdM = document.createElement('td');
      tdM.className = 'metodo';
      const small = document.createElement('small');
      small.textContent = sub;
      tdM.append(nombre, small);
      const tdD = document.createElement('td'); tdD.append(det);
      const tdC = document.createElement('td'); tdC.append(cor);
      const tdP = document.createElement('td'); tdP.className = 'pos'; tdP.textContent = pos;
      tr.append(tdM, tdD, tdC, tdP);
      return tr;
    }));

    let texto, tono, receptor, tonoRec;
    if (!huboCambios) {
      texto = 'La trama llegó intacta: no hay bits alterados y ningún método reporta error.';
      tono = 'bien'; receptor = 'Trama correcta'; tonoRec = 'bien';
    } else if (!bidim.detecta) {
      texto = 'Ningún método detectó error. Si aplicaste el patrón de rectángulo (4 bits), esto es esperado: ' +
        'cada fila y columna afectada cambia una cantidad PAR de bits, por lo que la paridad se mantiene y ' +
        'el error pasa inadvertido para los tres métodos.';
      tono = 'mal'; receptor = 'Error no detectado'; tonoRec = 'mal';
    } else if (bidim.corrige) {
      texto = 'La paridad bidimensional pudo detectar Y corregir el error automáticamente, porque afectó a un ' +
        'único bit (intersección única entre la fila y la columna marcadas).';
      tono = 'bien'; receptor = 'Detectado y corregido'; tonoRec = 'bien';
    } else {
      texto = 'El error fue detectado pero no puede corregirse automáticamente, porque no hay una única ' +
        'intersección fila/columna (por ejemplo, errores dobles en la misma fila o columna). ' +
        'VRC y LRC por separado solo detectan errores, nunca los corrigen.';
      tono = 'aviso'; receptor = 'Detectado, sin corregir'; tonoRec = 'aviso';
    }
    el.conclusion.textContent = texto;
    el.conclusion.className = 'conclusion ' + tono;
    el.estReceptor.textContent = receptor;
    el.estReceptor.className = 'estado ' + tonoRec;
  }

  function limpiarResultados() {
    estado.verificado = false;
    const tr = document.createElement('tr');
    tr.className = 'sin-datos';
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = 'Simulá un error y tocá «Verificar y comparar métodos» para ver el resultado de cada método.';
    tr.append(td);
    el.tabla.replaceChildren(tr);
    el.conclusion.textContent = 'Todavía no se verificó la trama.';
    el.conclusion.className = 'conclusion';
    el.desactualizado.hidden = true;
    el.estReceptor.textContent = 'Sin verificar';
    el.estReceptor.className = 'estado';
    if (estado.generada) {
      el.estCanal.textContent = el.estCanal.textContent === '—' ? 'Sin errores' : el.estCanal.textContent;
    }
  }

  // ---------------- Eventos ----------------
  document.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener('change', actualizarLabelEntrada));
  el.entrada.addEventListener('input', validarTeclaEntrada);
  el.entrada.addEventListener('animationend', () => el.entrada.classList.remove('rechazo'));
  el.entrada.addEventListener('keydown', (e) => { if (e.key === 'Enter') generarTrama(); });
  el.columnas.addEventListener('input', actualizarContador);
  $('btn-generar').addEventListener('click', () => generarTrama());
  $('btn-restaurar').addEventListener('click', () => restaurarOriginal());
  $('btn-verificar').addEventListener('click', verificar);
  document.querySelectorAll('[data-error]').forEach((b) =>
    b.addEventListener('click', () => simularError(b.dataset.error)));

  // Abre con una trama de ejemplo ("HOLA") para que la matriz se vea desde el inicio.
  actualizarContador();
  generarTrama({ silencioso: true });
  marcarAlterados();
})();
