// MSW browser setup — dev mode only.
// Import this in app/providers.tsx via dynamic import.

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { authHandlers } from './handlers-auth';

export const worker = setupWorker(...handlers, ...authHandlers);
