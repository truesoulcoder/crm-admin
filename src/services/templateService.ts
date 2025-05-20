/**
 * Renders a template string by replacing {{key}} placeholders with values from context.
 */
export function renderTemplate(
  template: string,
  context: Record<string, unknown>
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = context[key];
    if (value === undefined || value === null) {
      return '';
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return String(value);
  });
}
