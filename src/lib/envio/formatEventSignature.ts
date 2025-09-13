import {
  validateEventParameters,
  validateTupleComponent,
} from '../utils/validateEventParameters.js';

export function formatEventSignature(event: any): string {
  // Validate event parameters have names and check for anonymous events
  const isValidEvent = validateEventParameters(event);
  if (!isValidEvent) {
    throw new Error(
      `Cannot format signature for anonymous event "${event.name}". Anonymous events are not supported.`,
    );
  }

  const params = event.inputs
    .map((input: any) => {
      let type = input.type;

      // Handle tuples recursively
      if (type.startsWith('tuple')) {
        const components = input.components.map((c: any) => formatTupleComponent(c)).join(',');
        type = `(${components})${type.slice(5)}`;
      }

      // Format: "type indexed name" or "type name"
      const indexedKeyword = input.indexed ? ' indexed' : '';
      const name = input.name;
      return `${type}${indexedKeyword} ${name}`;
    })
    .join(', ');

  return `${event.name}(${params})`;
}

function formatTupleComponent(component: any): string {
  // Validate tuple component has a name
  validateTupleComponent(component);

  let type = component.type;
  if (type.startsWith('tuple')) {
    const subComponents = component.components.map((c: any) => formatTupleComponent(c)).join(',');
    type = `(${subComponents})${type.slice(5)}`;
  }
  return type;
}
