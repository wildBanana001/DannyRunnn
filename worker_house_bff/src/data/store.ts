import type { CardOrder, Profile, Registration } from '../types/index.js';

export interface MemoryStoreState {
  cardOrders: CardOrder[];
  profiles: Profile[];
  registrations: Registration[];
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function now() {
  return new Date().toISOString();
}

export const memoryStore: MemoryStoreState = {
  cardOrders: [],
  profiles: [],
  registrations: [],
};
