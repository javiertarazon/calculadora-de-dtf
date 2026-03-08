const DEFAULT_SETTINGS = {
  safetySideMm: 10,
  defaultSpacingMm: 5,
  fixedCost: 0,
  prices: {300: 0, 450: 0, 600: 0},
};

function roundValue(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function displayLengthFromMm(value, unitSystem) {
  return unitSystem === 'cm' ? roundValue(value / 10, 2) : roundValue(value, 2);
}

function cloneSettings(settings) {
  return {
    safetySideMm: settings.safetySideMm,
    defaultSpacingMm: settings.defaultSpacingMm,
    fixedCost: settings.fixedCost,
    prices: {
      300: settings.prices[300],
      450: settings.prices[450],
      600: settings.prices[600],
    },
  };
}

function loadSettingsFromObject(stored) {
  if (!stored || typeof stored !== 'object') {
    return cloneSettings(DEFAULT_SETTINGS);
  }

  return {
    safetySideMm: Number.isFinite(stored.safetySideMm) ? Math.max(0, stored.safetySideMm) : DEFAULT_SETTINGS.safetySideMm,
    defaultSpacingMm: Number.isFinite(stored.defaultSpacingMm) ? Math.max(0, stored.defaultSpacingMm) : DEFAULT_SETTINGS.defaultSpacingMm,
    fixedCost: Number.isFinite(stored.fixedCost) ? Math.max(0, stored.fixedCost) : DEFAULT_SETTINGS.fixedCost,
    prices: {
      300: Number.isFinite(stored.prices?.[300]) ? Math.max(0, stored.prices[300]) : DEFAULT_SETTINGS.prices[300],
      450: Number.isFinite(stored.prices?.[450]) ? Math.max(0, stored.prices[450]) : DEFAULT_SETTINGS.prices[450],
      600: Number.isFinite(stored.prices?.[600]) ? Math.max(0, stored.prices[600]) : DEFAULT_SETTINGS.prices[600],
    },
  };
}

function getDefaultDesigns() {
  return [
    {name: 'Frente pequeño', width: 9, height: 12, quantity: 12},
    {name: 'Espalda mediana', width: 28, height: 35, quantity: 4},
  ];
}

function sanitizeStoredState(state, currentSettings) {
  const normalizedUnit = state.unitSystem === 'mm' ? 'mm' : 'cm';
  const normalizedDesigns = Array.isArray(state.designs)
    ? state.designs.map((design) => ({
        name: typeof design?.name === 'string' ? design.name : '',
        width: Number.isFinite(design?.width) ? design.width : '',
        height: Number.isFinite(design?.height) ? design.height : '',
        quantity: Number.isFinite(design?.quantity) ? Math.max(0, Math.round(design.quantity)) : 0,
      }))
    : getDefaultDesigns();

  return {
    unitSystem: normalizedUnit,
    rollWidth: Number.isFinite(state.rollWidth) ? Math.max(0, state.rollWidth) : displayLengthFromMm(600, normalizedUnit),
    margin: Number.isFinite(state.margin) ? Math.max(0, state.margin) : displayLengthFromMm(currentSettings.defaultSpacingMm, normalizedUnit),
    allowRotate: state.allowRotate !== false,
    mode: 'optimized',
    profitMargin: Number.isFinite(state.profitMargin) ? Math.max(0, state.profitMargin) : 30,
    designs: normalizedDesigns.length > 0 ? normalizedDesigns : getDefaultDesigns(),
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const fallback = loadSettingsFromObject(null);
  assert(fallback.safetySideMm === 10, 'Sin datos debe usar configuracion base');
  assert(fallback.defaultSpacingMm === 5, 'Separacion base debe mantenerse');

  const corruptedSettings = loadSettingsFromObject({
    safetySideMm: -12,
    defaultSpacingMm: NaN,
    fixedCost: -99,
    prices: {300: -1, 450: 500, 600: Infinity},
  });
  assert(corruptedSettings.safetySideMm === 0, 'Seguridad negativa debe corregirse a 0');
  assert(corruptedSettings.defaultSpacingMm === 5, 'Separacion invalida debe volver al default');
  assert(corruptedSettings.fixedCost === 0, 'Costo fijo negativo debe corregirse a 0');
  assert(corruptedSettings.prices[300] === 0, 'Tarifa 300 negativa debe corregirse a 0');
  assert(corruptedSettings.prices[450] === 500, 'Tarifa valida debe mantenerse');
  assert(corruptedSettings.prices[600] === 0, 'Tarifa invalida debe volver al default');

  const state = sanitizeStoredState({
    unitSystem: 'otra',
    rollWidth: -30,
    margin: NaN,
    allowRotate: false,
    profitMargin: -10,
    designs: [{name: 42, width: NaN, height: 12, quantity: 2.8}],
  }, fallback);
  assert(state.unitSystem === 'cm', 'Unidad invalida debe normalizarse a cm');
  assert(state.rollWidth === 0, 'Ancho negativo debe corregirse a 0');
  assert(state.margin === 0.5, 'Margen invalido debe volver al default visible en cm');
  assert(state.allowRotate === false, 'allowRotate=false debe mantenerse');
  assert(state.profitMargin === 0, 'Margen negativo debe corregirse a 0');
  assert(state.mode === 'optimized', 'El modo debe quedar fijo en optimized');
  assert(state.designs[0].name === '', 'Nombre invalido debe vaciarse');
  assert(state.designs[0].width === '', 'Ancho invalido debe vaciarse');
  assert(state.designs[0].height === 12, 'Altura valida debe mantenerse');
  assert(state.designs[0].quantity === 3, 'Cantidad decimal debe redondearse');

  const emptyDesignState = sanitizeStoredState({unitSystem: 'mm', designs: []}, fallback);
  assert(Array.isArray(emptyDesignState.designs), 'Debe devolver una lista de diseños');
  assert(emptyDesignState.designs.length === 2, 'Lista vacia debe volver a diseños por defecto');
  assert(emptyDesignState.unitSystem === 'mm', 'Unidad mm valida debe mantenerse');

  console.log('PERSISTENCIA OK');
  console.log('- Fallback a configuracion base: OK');
  console.log('- Saneamiento de configuracion corrupta: OK');
  console.log('- Saneamiento de formulario corrupto: OK');
  console.log('- Recuperacion de diseños por defecto: OK');
}

run();
