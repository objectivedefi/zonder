export function formatEventSignature(event: any): string {
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
      const name = input.name || 'param';
      return `${type}${indexedKeyword} ${name}`;
    })
    .join(', ');

  return `${event.name}(${params})`;
}

function formatTupleComponent(component: any): string {
  let type = component.type;
  if (type.startsWith('tuple')) {
    const subComponents = component.components.map((c: any) => formatTupleComponent(c)).join(',');
    type = `(${subComponents})${type.slice(5)}`;
  }
  return type;
}
