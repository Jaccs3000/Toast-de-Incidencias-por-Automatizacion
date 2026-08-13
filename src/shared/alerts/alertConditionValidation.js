const DEFAULT_EVENTS = new Set(['created', 'updated', 'removed']);
const EMPTY_OPERATORS = new Set(['IS NULL', 'IS NOT NULL']);
const TEXT_OPERATORS = new Set(['=', '<>', 'LIKE', 'IS NULL', 'IS NOT NULL']);
const VALUE_OPERATORS = new Set(['=', '<>', '>', '<', '>=', '<=', 'IS NULL', 'IS NOT NULL']);

function fieldMap(fields = []) {
  return new Map((Array.isArray(fields) ? fields : []).map((field) => [field.field, field]));
}

function operatorMap(operators = []) {
  return new Map((Array.isArray(operators) ? operators : []).map((operator) => [operator.value, operator]));
}

function isDateValue(value) {
  const text = String(value ?? '').trim();
  const colombian = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (colombian) {
    const [, day, month, year, hour = '00', minute = '00', second = '00'] = colombian;
    const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`);
    return parsed.getFullYear() === Number(year)
      && parsed.getMonth() + 1 === Number(month)
      && parsed.getDate() === Number(day)
      && parsed.getHours() === Number(hour)
      && parsed.getMinutes() === Number(minute)
      && parsed.getSeconds() === Number(second);
  }

  return /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(text)
    && !Number.isNaN(Date.parse(text));
}

function isNumberValue(value) {
  return /^-?\d+(?:[.,]\d+)?$/.test(String(value ?? '').trim());
}

export function validateAlertConditionConfig(config, { fields = [], operators = [] } = {}) {
  const errors = [];
  let parsed = config;

  if (typeof config === 'string') {
    try {
      parsed = JSON.parse(config);
    } catch {
      return { ok: false, errors: ['La configuración de condiciones no tiene un formato válido.'] };
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, errors: ['La configuración de condiciones es obligatoria.'] };
  }

  if (!DEFAULT_EVENTS.has(parsed.event)) {
    errors.push('El evento de la alerta no es válido.');
  }

  const availableFields = fieldMap(fields);
  const availableOperators = operatorMap(operators);
  if (!Array.isArray(parsed.conditions) || parsed.conditions.length === 0) {
    errors.push('Agrega al menos una condición.');
    return { ok: errors.length === 0, errors };
  }

  parsed.conditions.forEach((condition, index) => {
    const position = `Condición ${index + 1}`;
    const field = availableFields.get(condition?.field);
    const operator = availableOperators.get(condition?.operator);
    const value = String(condition?.value ?? '').trim();

    if (!field) {
      errors.push(`${position}: el campo seleccionado no existe en la configuración.`);
      return;
    }

    if (!operator) {
      errors.push(`${position}: el operador seleccionado no es válido.`);
      return;
    }

    const allowedOperators = field.type === 'text' ? TEXT_OPERATORS : VALUE_OPERATORS;
    if (!allowedOperators.has(operator.value)) {
      errors.push(`${position}: el operador seleccionado no aplica al campo "${field.label}".`);
      return;
    }

    if (!EMPTY_OPERATORS.has(operator.value) && !value) {
      errors.push(`${position}: debes indicar un valor para "${field.label}".`);
      return;
    }

    if (EMPTY_OPERATORS.has(operator.value)) {
      return;
    }

    if (field.type === 'datetime' && !isDateValue(value)) {
      errors.push(`${position}: "${field.label}" debe tener una fecha válida, por ejemplo 2026-08-13 o 2026-08-13T14:30:00.`);
    }

    if (field.type === 'number' && !isNumberValue(value)) {
      errors.push(`${position}: "${field.label}" debe contener únicamente un número.`);
    }
  });

  return { ok: errors.length === 0, errors };
}
