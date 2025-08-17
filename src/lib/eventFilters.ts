import { Abi } from 'viem';

type ExtractAbiEvents<T extends Abi> = Extract<T[number], { type: 'event' }>;
type ExtractAbiEventNames<T extends Abi> = ExtractAbiEvents<T>['name'];

export function includeEvents<T extends Abi>(abi: T, events: ExtractAbiEventNames<T>[]): Abi {
  return abi.filter((item) => {
    if (item.type !== 'event') return true;
    return events.includes(item.name);
  }) as Abi;
}

export function excludeEvents<T extends Abi>(abi: T, events: ExtractAbiEventNames<T>[]): Abi {
  return abi.filter((item) => {
    if (item.type !== 'event') return true;
    return !events.includes(item.name);
  }) as Abi;
}
