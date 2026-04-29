// MSW browser setup — dev mode only.
// Import this in app/providers.tsx via dynamic import.

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { authHandlers, bffAuthHandlers, sessionHandlers } from './handlers-auth';
import { bountyHandlers } from './handlers-bounty';
import { bountyBffHandlers } from './handlers-bounty-bff';
import { a2aBffHandlers } from './handlers-a2a-bff';
import { workspaceHandlers } from './handlers-workspace';
import { creditsHandlers } from './handlers-credits';
import { gdiHandlers } from './handlers-gdi';
import { marketplaceHandlers } from './handlers-marketplace';
import { dashboardHandlers } from './handlers-dashboard';

export const worker = setupWorker(
  ...handlers,
  ...authHandlers,
  ...bffAuthHandlers,
  ...sessionHandlers,
  ...bountyHandlers,
  ...bountyBffHandlers,
  ...a2aBffHandlers,
  ...workspaceHandlers,
  ...creditsHandlers,
  ...gdiHandlers,
  ...marketplaceHandlers,
  ...dashboardHandlers,
);
