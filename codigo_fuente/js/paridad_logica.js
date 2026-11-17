/**
 * Lógica de cálculo y detección de errores para VRC, LRC y Paridad Bidimensional.
 * TFI Comunicaciones - Comparador de Métodos de Paridad
 *
 * Traducción 1 a 1 de paridad_logica.py. No depende del navegador:
 * se puede usar desde la página (objeto global `Paridad`) o desde Node (module.exports).
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // UTILIDADES (equivalentes a random.randint y random.sample de Python)
  // ---------------------------------------------------------------------------

  /** Entero aleatorio en [a, b], ambos incluidos (como random.randint). */
  function randint(a, b) {
    return a + Math.floor(Math.random() * (b - a + 1));
  }

  /** k elementos distintos elegidos al azar de [0, n) (como random.sample(range(n), k)). */
  function sample(n, k) {
    if (k > n) throw new Error('La muestra es más grande que la población');
    const pool = Array.from({ length: n }, (_, i) => i);
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(Math.random() * (n - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, k);
  }

  // ---------------------------------------------------------------------------
  // CONVERSIÓN Y VALIDACIÓN DE ENTRADA
  // ---------------------------------------------------------------------------

  /**
   * Convierte una cadena de texto a su representación binaria (8 bits por carácter).
   * Igual que format(ord(c), '08b') en Python: si el código supera 255 (por ejemplo,
   * un emoji), se usan los bits necesarios sin truncar.
   */
  function textoABits(texto) {
    let bits = '';
    for (const c of texto) {
      bits += c.codePointAt(0).toString(2).padStart(8, '0');
    }
    return bits;
  }

  /** Valida que la cadena contenga solo '0' y '1', y no esté vacía. */
  function validarBits(cadena) {
    return cadena.length > 0 && /^[01]+$/.test(cadena);
  }

  // ---------------------------------------------------------------------------
  // CÁLCULO DE PARIDAD
  // ---------------------------------------------------------------------------

  /**
   * Calcula el bit de paridad de una secuencia de bits.
   * - tipo 'par'   -> la cantidad total de unos (datos + paridad) debe ser PAR
   * - tipo 'impar' -> la cantidad total de unos (datos + paridad) debe ser IMPAR
   */
  function bitParidad(bits, tipo = 'par') {
    const unos = bits.reduce((s, b) => s + b, 0);
    if (tipo === 'par') return unos % 2 !== 0 ? 1 : 0;
    return unos % 2 !== 0 ? 0 : 1;
  }

  /**
   * Divide una cadena de bits en filas de `columnas` bits cada una.
   * Si la última fila queda incompleta, se rellena con ceros.
   * Devuelve { matriz, relleno }.
   */
  function armarMatriz(bitsStr, columnas) {
    let bits = Array.from(bitsStr, (b) => parseInt(b, 10));
    const relleno = (columnas - (bits.length % columnas)) % columnas;
    if (relleno) bits = bits.concat(new Array(relleno).fill(0));
    const matriz = [];
    for (let i = 0; i < bits.length; i += columnas) matriz.push(bits.slice(i, i + columnas));
    return { matriz, relleno };
  }

  /** VRC: un bit de paridad POR FILA. Devuelve un arreglo, uno por fila. */
  function calcularVRC(matriz, tipo = 'par') {
    return matriz.map((fila) => bitParidad(fila, tipo));
  }

  /** LRC: un bit de paridad POR COLUMNA. Devuelve un arreglo, uno por columna. */
  function calcularLRC(matriz, tipo = 'par') {
    const columnas = matriz[0].length;
    const lrc = [];
    for (let c = 0; c < columnas; c++) lrc.push(bitParidad(matriz.map((fila) => fila[c]), tipo));
    return lrc;
  }

  /**
   * Paridad Bidimensional = VRC (por fila) + LRC (por columna) + bit de esquina
   * (paridad de la columna de bits VRC; por construcción coincide con la paridad de la fila LRC).
   */
  function calcularBidimensional(matriz, tipo = 'par') {
    const vrc = calcularVRC(matriz, tipo);
    const lrc = calcularLRC(matriz, tipo);
    const esquina = bitParidad(vrc, tipo);
    return { vrc, lrc, esquina };
  }

  // ---------------------------------------------------------------------------
  // SIMULACIÓN DE ERRORES
  // ---------------------------------------------------------------------------

  /** Copia de la matriz con los bits en `posiciones` ([[fila, col], ...]) invertidos. */
  function aplicarError(matriz, posiciones) {
    const m = matriz.map((fila) => fila.slice());
    for (const [f, c] of posiciones) m[f][c] = 1 - m[f][c];
    return m;
  }

  /** UNA posición aleatoria [fila, col]. */
  function errorSimpleAleatorio(filas, columnas) {
    return [[randint(0, filas - 1), randint(0, columnas - 1)]];
  }

  /** Dos bits distintos corrompidos dentro de la MISMA fila. */
  function errorDobleMismaFila(filas, columnas) {
    if (columnas < 2) return null;
    const f = randint(0, filas - 1);
    const [c1, c2] = sample(columnas, 2);
    return [[f, c1], [f, c2]];
  }

  /** Dos bits distintos corrompidos dentro de la MISMA columna. */
  function errorDobleMismaColumna(filas, columnas) {
    if (filas < 2) return null; // en Python random.sample fallaba con una sola fila
    const c = randint(0, columnas - 1);
    const [f1, f2] = sample(filas, 2);
    return [[f1, c], [f2, c]];
  }

  /**
   * Caso especial didáctico: 4 bits en las esquinas de un rectángulo.
   * NO es detectado ni por VRC ni por LRC, porque cada fila y cada columna
   * afectada cambia una cantidad PAR de bits (2), preservando su paridad.
   */
  function errorRectanguloNoDetectable(filas, columnas) {
    if (filas < 2 || columnas < 2) return null;
    const [f1, f2] = sample(filas, 2);
    const [c1, c2] = sample(columnas, 2);
    return [[f1, c1], [f1, c2], [f2, c1], [f2, c2]];
  }

  // ---------------------------------------------------------------------------
  // DETECCIÓN Y COMPARACIÓN
  // ---------------------------------------------------------------------------

  /** Recalcula VRC sobre lo recibido y compara con el VRC transmitido. Un booleano por fila. */
  function detectarVRC(matrizRecibida, vrcTransmitido, tipo = 'par') {
    const recalc = calcularVRC(matrizRecibida, tipo);
    return vrcTransmitido.map((v, i) => recalc[i] !== v);
  }

  /** Recalcula LRC sobre lo recibido y compara con el LRC transmitido. Un booleano por columna. */
  function detectarLRC(matrizRecibida, lrcTransmitido, tipo = 'par') {
    const recalc = calcularLRC(matrizRecibida, tipo);
    return lrcTransmitido.map((v, i) => recalc[i] !== v);
  }

  /**
   * Compara el desempeño de VRC, LRC y Bidimensional frente a una matriz recibida.
   *
   * vrcRecibido / lrcRecibido: los bits de paridad tal como llegaron al receptor.
   * Si no se pasan, se asume que llegaron intactos (solo se corrompieron datos).
   * Si se pasan, permite simular que el propio bit de paridad fue el que se corrompió.
   */
  function compararMetodos(matrizOriginal, tipo, matrizRecibida, vrcRecibido = null, lrcRecibido = null) {
    const tx = calcularBidimensional(matrizOriginal, tipo);
    if (vrcRecibido === null) vrcRecibido = tx.vrc;
    if (lrcRecibido === null) lrcRecibido = tx.lrc;

    const filasError = detectarVRC(matrizRecibida, vrcRecibido, tipo);
    const colsError = detectarLRC(matrizRecibida, lrcRecibido, tipo);

    const filasConError = filasError.flatMap((v, i) => (v ? [i] : []));
    const colsConError = colsError.flatMap((v, i) => (v ? [i] : []));

    const detectaVRC = filasConError.length > 0;
    const detectaLRC = colsConError.length > 0;
    const detectaBidim = detectaVRC || detectaLRC;

    // Solo se puede CORREGIR si la intersección fila/columna es única
    // (equivale, en general, a un error de un solo bit).
    const corrige = filasConError.length === 1 && colsConError.length === 1;
    const posicionCorregida = corrige ? [filasConError[0], colsConError[0]] : null;

    return {
      vrc: { detecta: detectaVRC, filasError: filasConError },
      lrc: { detecta: detectaLRC, columnasError: colsConError },
      bidimensional: { detecta: detectaBidim, corrige, posicionCorregida },
    };
  }

  const Paridad = {
    textoABits, validarBits, bitParidad, armarMatriz,
    calcularVRC, calcularLRC, calcularBidimensional,
    aplicarError, errorSimpleAleatorio, errorDobleMismaFila,
    errorDobleMismaColumna, errorRectanguloNoDetectable,
    detectarVRC, detectarLRC, compararMetodos,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Paridad;
  else global.Paridad = Paridad;
})(typeof window !== 'undefined' ? window : globalThis);
