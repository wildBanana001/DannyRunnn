export function clone(value) {
    return structuredClone(value);
}
export function now() {
    return new Date().toISOString();
}
export const memoryStore = {
    cardOrders: [],
    profiles: [],
    registrations: [],
};
