/**
 * Formats a string to snake case
 */
export function formatToSnakeCase(eventName: string) {
  if (typeof eventName !== 'string') {
    throw new Error('Event name must be a string');
  }

  return (
    eventName
      // Camel case to snake case
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      // Pascal case to snake case
      .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
      .toLowerCase()
  );
}
