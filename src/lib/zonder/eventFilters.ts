import { Abi } from 'viem';

type TakeAbiEvents<T extends Abi> = Extract<T[number], { type: 'event' }>;
type TakeAbiEventNames<T extends Abi> = TakeAbiEvents<T>['name'];

export function includeEvents<T extends Abi>(abi: T, events: TakeAbiEventNames<T>[]): Abi {
  return abi.filter((item) => {
    if (item.type !== 'event') return true;
    return events.includes(item.name);
  }) as Abi;
}

export function excludeEvents<T extends Abi>(abi: T, events: TakeAbiEventNames<T>[]): Abi {
  return abi.filter((item) => {
    if (item.type !== 'event') return true;
    return !events.includes(item.name);
  }) as Abi;
}
