// Mock for uuid v13 (ESM-only)
// Jest needs CJS, so we provide a manual mock

export function v4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const NIL = '00000000-0000-0000-0000-000000000000';
export const MAX = 'ffffffff-ffff-4fff-bfff-ffffffffffff';

export default { v4 };
