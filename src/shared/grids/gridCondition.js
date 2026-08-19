function normalizedText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function gridConditionMatches(value, operator, expected, field = null) {
  if (operator === 'IS NULL') return value === null || value === '';
  if (operator === 'IS NOT NULL') return value !== null && value !== '';
  if (value === null || value === undefined) return false;

  if (['>', '<', '>=', '<='].includes(operator)) {
    const left = Number(value);
    const right = Number(expected);
    if (Number.isFinite(left) && Number.isFinite(right)) {
      return operator === '>' ? left > right
        : operator === '<' ? left < right
          : operator === '>=' ? left >= right : left <= right;
    }
    const leftDate = new Date(value).getTime();
    const rightDate = new Date(expected).getTime();
    if (!Number.isFinite(leftDate) || !Number.isFinite(rightDate)) return false;
    return operator === '>' ? leftDate > rightDate
      : operator === '<' ? leftDate < rightDate
        : operator === '>=' ? leftDate >= rightDate : leftDate <= rightDate;
  }

  const left = normalizedText(value);
  const right = normalizedText(expected);
  if (['assignee', 'reporter'].includes(field) && ['=', '<>'].includes(operator)) {
    const matchesPerson = right.split(/\s+/).filter(Boolean).every((token) => left.includes(token));
    return operator === '=' ? matchesPerson : !matchesPerson;
  }
  return operator === 'LIKE' ? left.includes(right) : operator === '<>' ? left !== right : left === right;
}
