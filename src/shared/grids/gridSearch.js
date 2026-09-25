function normalizeGridSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CO');
}

function valueContainsSearch(value, normalizedSearch) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) {
    return value.some((item) => valueContainsSearch(item, normalizedSearch));
  }
  if (typeof value === 'object') {
    return Object.values(value).some((item) => valueContainsSearch(item, normalizedSearch));
  }
  return normalizeGridSearchText(value).includes(normalizedSearch);
}

export function gridRowMatchesSearch(row, columns, search) {
  const normalizedSearch = normalizeGridSearchText(search).trim();
  if (!normalizedSearch) return true;

  return (columns ?? []).some((column) => {
    const value = column?.field === 'estadoGeneral'
      ? row?.estadoGeneral
      : row?.[`${column?.issueType}::${column?.field}`];
    return valueContainsSearch(value, normalizedSearch);
  });
}

