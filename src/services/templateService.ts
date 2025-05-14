/**
 * Renders a template string by replacing {{key}} placeholders with values from context.
 */
export function renderTemplate(
  template: string,
  context: Record<string, unknown>
): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
    const value = context[key];
    return value !== undefined && value !== null ? String(value) : '';
  });
}
