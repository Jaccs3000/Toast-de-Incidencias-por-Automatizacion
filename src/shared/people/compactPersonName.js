export function compactPersonName(value) {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= 2) return words.join(' ');

  const logicalWords = [];
  for (let index = 0; index < words.length; index += 1) {
    const current = words[index];
    const normalized = current.toLocaleLowerCase('es-CO');
    if (normalized === 'del' && words[index + 1]) {
      logicalWords.push(`${current} ${words[index + 1]}`);
      index += 1;
    } else if (normalized === 'de' && ['la', 'las', 'los'].includes(words[index + 1]?.toLocaleLowerCase('es-CO')) && words[index + 2]) {
      logicalWords.push(`${current} ${words[index + 1]} ${words[index + 2]}`);
      index += 2;
    } else {
      logicalWords.push(current);
    }
  }

  if (logicalWords.length === 3) return `${logicalWords[0]} ${logicalWords[1]}`;
  if (logicalWords.length >= 4) return `${logicalWords[0]} ${logicalWords[2]}`;
  return logicalWords.join(' ');
}
