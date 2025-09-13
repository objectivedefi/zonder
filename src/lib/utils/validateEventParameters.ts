/**
 * Validates that all event parameters have names and checks for anonymous events
 * @param event - The event object to validate
 * @param contractName - The name of the contract (for error messages)
 * @throws Error if any parameter is missing a name
 * @returns true if event is valid and not anonymous, false if anonymous
 */
export function validateEventParameters(event: any, contractName?: string): boolean {
  // Check if event is anonymous - these should be ignored
  if (event.anonymous === true) {
    const contractInfo = contractName ? ` in contract "${contractName}"` : '';
    console.warn(
      `⚠️  Anonymous event "${event.name}"${contractInfo} will be ignored. Anonymous events cannot be efficiently indexed.`,
    );
    return false;
  }

  if (!event.inputs) return true;

  event.inputs.forEach((input: any, index: number) => {
    if (!input.name || input.name.trim() === '') {
      const contractInfo = contractName ? ` of contract "${contractName}"` : '';
      throw new Error(
        `Event parameter at index ${index} in event "${event.name}"${contractInfo} is missing a name. All event parameters must have names.`,
      );
    }
  });

  return true;
}

/**
 * Validates that all tuple components have names
 * @param component - The tuple component to validate
 * @throws Error if any component is missing a name
 */
export function validateTupleComponent(component: any): void {
  if (!component.name || component.name.trim() === '') {
    throw new Error(`Tuple component is missing a name. All tuple components must have names.`);
  }
}
