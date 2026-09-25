function normalizeIssueType(value) {
  const text = String(value ?? '').trim();
  return text || 'Sin tipo';
}

function colorForIndex(index) {
  const hue = (index * 137.508) % 360;
  const cycle = Math.floor(index / 360);
  const saturation = 68 + ((cycle % 4) * 5);
  const lightness = 68 + ((Math.floor(cycle / 4) % 4) * 4);
  return `hsl(${hue.toFixed(3)}deg ${saturation}% ${lightness}%)`;
}

export function buildIssueTypeColorMap(issues = []) {
  const types = [...new Set(issues.map((issue) => normalizeIssueType(issue?.issueType ?? issue)))].sort(
    (left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' }),
  );
  return new Map(types.map((type, index) => [type, colorForIndex(index)]));
}

export function getIssueTypeColor(value, colorMap) {
  const type = normalizeIssueType(value);
  return colorMap?.get(type) ?? colorForIndex(0);
}
