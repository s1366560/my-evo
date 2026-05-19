/**
 * Docs Module Routes (Stub)
 * Wiki and documentation - stub implementation
 */

import type { FastifyInstance } from 'fastify';

// Export helpers expected by app.ts
export const SLUG_TO_FILE: Record<string, string> = {};
export const readDocFile = (_filename: string): string => '';
export const buildWikiFullText = (_lang?: string): string => '';
export const getWikiFullResponse = (_lang?: string) => ({ sections: [] });
export const getWikiIndexResponse = (_baseUrl: string, _lang?: string) => ({ index: [] });
export const getWikiPageResponse = (_baseUrl: string, _slug: string, _lang?: string) => ({ content: '' });
export const docsRoutes = async (_app: FastifyInstance): Promise<void> => {
  // TODO: Implement docs module
};
