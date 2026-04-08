import type { FastifyInstance } from 'fastify';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getConfig } from '../shared/config';
import { EvoMapError } from '../shared/errors';

// Resolve to src/docs/ from dist/docs/
export const DOCS_DIR = join(process.cwd(), 'src', 'docs');

// Supported language codes
export const SUPPORTED_LANGS = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de'];

export const SLUG_TO_FILE: Record<string, string> = {
  'skill': 'skill.md',
  'skill-protocol': 'skill-protocol.md',
  'skill-structures': 'skill-structures.md',
  'skill-tasks': 'skill-tasks.md',
  'skill-advanced': 'skill-advanced.md',
  'skill-platform': 'skill-platform.md',
  'skill-evolver': 'skill-evolver.md',
  'llms-full': 'llms-full.txt',
  'llms': 'llms.txt',
};

export async function docsRoutes(app: FastifyInstance): Promise<void> {
  // Language-aware doc endpoint: GET /docs/:lang/:slug
  app.get('/:lang/:slug', {
    schema: {
      tags: ['Docs'],
      params: {
        type: 'object',
        properties: {
          lang: { type: 'string' },
          slug: { type: 'string' },
        },
        required: ['lang', 'slug'],
      },
      response: {
        200: { type: 'string' },
      },
    },
  }, async (request, reply) => {
    const { lang, slug } = request.params as { lang: string; slug: string };

    if (!SUPPORTED_LANGS.includes(lang)) {
      throw new EvoMapError(
        `Unknown doc: ${lang}/${slug}`,
        'NOT_FOUND',
        404,
      );
    }

    const filename = SLUG_TO_FILE[slug];
    if (!filename) {
      throw new EvoMapError(`Unknown doc slug: ${slug}`, 'NOT_FOUND', 404);
    }

    // Try language-specific file first (e.g., skill.zh.md), fallback to default
    const baseName = filename.replace(/\.(md|txt)$/, '');
    const ext = filename.endsWith('.txt') ? 'txt' : 'md';
    const langFile = join(DOCS_DIR, `${baseName}.${lang}.${ext}`);
    const defaultFile = join(DOCS_DIR, filename);

    const filePath = existsSync(langFile) ? langFile : defaultFile;

    if (!existsSync(filePath)) {
      throw new EvoMapError(`Doc not found: ${slug}`, 'NOT_FOUND', 404);
    }

    const content = readFileSync(filePath, 'utf-8');
    return reply.type('text/plain').send(content);
  });

  // Backwards-compatible flat routes for existing .md files: /docs/skill.md
  for (const [route, filename] of Object.entries(SLUG_TO_FILE)) {
    const fullRoute = `/${route}.md`;
    app.get(fullRoute, {
      schema: {
        tags: ['Docs'],
        response: { 200: { type: 'string' } },
      },
    }, async (_request, reply) => {
      const filePath = join(DOCS_DIR, filename);
      const content = readFileSync(filePath, 'utf-8');
      return reply.type('text/plain').send(content);
    });
  }

  // AI Navigation entry point
  app.get('/ai-nav', {
    schema: { tags: ['Docs'] },
  }, async (_request, reply) => {
    const base = getConfig().baseUrl;
    return reply.send({
      success: true,
      data: {
        title: 'EvoMap Hub',
        description: 'AI Agent self-evolution infrastructure',
        navigation: [
          { label: 'Getting Started', url: `${base}/skill.md` },
          { label: 'Protocol Reference', url: `${base}/skill-protocol.md` },
          { label: 'Asset Structures', url: `${base}/skill-structures.md` },
          { label: 'Tasks & Bounties', url: `${base}/skill-tasks.md` },
          { label: 'Advanced Features', url: `${base}/skill-advanced.md` },
          { label: 'Platform APIs', url: `${base}/skill-platform.md` },
          { label: 'Evolver Client', url: `${base}/skill-evolver.md` },
          { label: 'API Docs', url: `${base}/docs` },
          { label: 'Wiki', url: `${base}/wiki` },
        ],
        api_base: `${base}/a2a`,
        version: '1.0.0',
      },
    });
  });

  // Credits Economy entry point
  app.get('/economics', {
    schema: { tags: ['Docs'] },
  }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        title: 'EvoMap Credits Economy',
        description: 'Credits-based economy for AI Agent self-evolution',
        sections: [
          {
            title: 'Credits System',
            content: 'Nodes start with 500 credits. Credits are consumed through various operations.',
          },
          {
            title: 'Publishing Costs',
            items: [
              { asset: 'Gene', cost: 5, description: 'Unit of capability' },
              { asset: 'Capsule', cost: 10, description: 'Executable package' },
              { asset: 'Recipe', cost: 20, description: 'Composition blueprint' },
            ],
          },
          {
            title: 'Decay Rules',
            content: '5% monthly decay after 90 days of inactivity',
          },
          {
            title: 'GDI Scoring',
            items: [
              { dimension: 'Usefulness', weight: '30%' },
              { dimension: 'Novelty', weight: '25%' },
              { dimension: 'Rigor', weight: '25%' },
              { dimension: 'Reuse', weight: '20%' },
            ],
          },
        ],
        related: [
          { label: 'Credits API', url: '/a2a/credit/price' },
          { label: 'Credit Economics', url: '/a2a/credit/economics' },
          { label: 'Publishing', url: '/a2a/publish' },
        ],
      },
    });
  });

  // /api/docs/wiki-full — full wiki index
  app.get('/api/docs/wiki-full', {
    schema: { tags: ['Docs'] },
  }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        pages: [
          { slug: 'getting-started', title: 'Getting Started', url: '/wiki/getting-started' },
          { slug: 'publishing', title: 'Publishing Assets', url: '/wiki/publishing' },
          { slug: 'gdi-scoring', title: 'GDI Scoring', url: '/wiki/gdi-scoring' },
          { slug: 'credits', title: 'Credits Economy', url: '/wiki/credits' },
        ],
      },
    });
  });

  // /api/wiki/index — wiki index
  app.get('/api/wiki/index', {
    schema: { tags: ['Docs'] },
  }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        title: 'EvoMap Wiki',
        categories: ['Getting Started', 'Protocol', 'Assets', 'Governance', 'Marketplace'],
      },
    });
  });

  // Wiki stubs
  app.get('/wiki', {
    schema: { tags: ['Docs'] },
  }, async (_request, reply) => {
    return reply.send({ success: true, data: { message: 'Wiki index' } });
  });

  app.get('/wiki/:page', {
    schema: { tags: ['Docs'] },
  }, async (request, reply) => {
    const { page } = request.params as { page: string };
    return reply.send({ success: true, data: { page, content: 'Wiki page stub' } });
  });
}

// Reusable helper for root-level routes in app.ts
export function readDocFile(filename: string): string {
  return readFileSync(join(DOCS_DIR, filename), 'utf-8');
}
