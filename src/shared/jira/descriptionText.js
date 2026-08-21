function joinDescriptionParts(parts, separator = ' ') {
  return parts
    .map((part) => jiraDescriptionToText(part))
    .filter((part) => part !== null && part !== '')
    .join(separator);
}

/** Converts Jira rich-text descriptions to plain text before persistence. */
export function jiraDescriptionToText(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '[object Object]') {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return jiraDescriptionToText(parsed);
      }
    } catch {
      // Jira can return a regular plain-text description.
    }

    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return joinDescriptionParts(value);
  }

  if (typeof value === 'object') {
    if (typeof value.text === 'string') {
      return value.text;
    }

    if (Array.isArray(value.content)) {
      const separator = ['doc', 'paragraph', 'heading', 'blockquote', 'codeBlock'].includes(value.type)
        ? '\n'
        : '';
      return joinDescriptionParts(value.content, separator);
    }

    return joinDescriptionParts(
      Object.entries(value)
        .filter(([key]) => !['type', 'version', 'attrs', 'marks'].includes(key))
        .map(([, child]) => child),
    );
  }

  return String(value);
}
