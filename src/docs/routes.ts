import type { FastifyInstance } from 'fastify';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getConfig } from '../shared/config';
import { EvoMapError } from '../shared/errors';

// Resolve to src/docs/ from dist/docs/
export const DOCS_DIR = join(process.cwd(), 'src', 'docs');

export const SUPPORTED_LANGS = ['en', 'zh', 'zh-HK', 'ja', 'ko', 'es', 'fr', 'de'] as const;

export const SLUG_TO_FILE: Record<string, string> = {
  skill: 'skill.md',
  'skill-protocol': 'skill-protocol.md',
  'skill-structures': 'skill-structures.md',
  'skill-tasks': 'skill-tasks.md',
  'skill-advanced': 'skill-advanced.md',
  'skill-platform': 'skill-platform.md',
  'skill-evolver': 'skill-evolver.md',
  marketplace: 'marketplace.md',
  subscription: 'subscription.md',
  'llms-full': 'llms-full.txt',
  llms: 'llms.txt',
};

type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export interface WikiDocDescriptor {
  order: number;
  slug: string;
  title: string;
  description: string;
  filename: string;
}

export interface WikiIndexResponse {
  lang: string;
  count: number;
  access: {
    individual_docs: string;
    full_wiki_text: string;
    full_wiki_json: string;
    site_nav: string;
  };
  docs: Array<{
    order: number;
    slug: string;
    title: string;
    description: string;
    url_markdown: string;
    url_wiki: string;
  }>;
}

export interface WikiFullResponse {
  lang: string;
  count: number;
  docs: Array<{
    slug: string;
    content: string;
  }>;
}

export interface WikiPageResponse {
  lang: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  url_markdown: string;
  previous: { slug: string; title: string; url: string } | null;
  next: { slug: string; title: string; url: string } | null;
}

export const WIKI_DOCS: WikiDocDescriptor[] = [
  {
    order: 1,
    slug: 'skill',
    title: 'Getting Started',
    description: 'Overview of EvoMap Hub and the quickest path to first use.',
    filename: 'skill.md',
  },
  {
    order: 2,
    slug: 'skill-protocol',
    title: 'Protocol Reference',
    description: 'GEP-A2A message envelope, protocol concepts, and interoperability rules.',
    filename: 'skill-protocol.md',
  },
  {
    order: 3,
    slug: 'skill-structures',
    title: 'Asset Structures',
    description: 'Gene, Capsule, Recipe, and related asset shapes used by the platform.',
    filename: 'skill-structures.md',
  },
  {
    order: 4,
    slug: 'skill-tasks',
    title: 'Tasks and Bounties',
    description: 'Task routing, bounty workflows, and collaboration primitives.',
    filename: 'skill-tasks.md',
  },
  {
    order: 5,
    slug: 'skill-advanced',
    title: 'Advanced Features',
    description: 'Advanced capabilities such as governance, analytics, and orchestration.',
    filename: 'skill-advanced.md',
  },
  {
    order: 6,
    slug: 'skill-platform',
    title: 'Platform APIs',
    description: 'High-level API guide for the EvoMap Hub platform services.',
    filename: 'skill-platform.md',
  },
  {
    order: 7,
    slug: 'skill-evolver',
    title: 'Evolver Client',
    description: 'How the Evolver client integrates with EvoMap Hub.',
    filename: 'skill-evolver.md',
  },
  {
    order: 8,
    slug: 'marketplace',
    title: 'Marketplace APIs',
    description: 'Canonical service marketplace routes plus legacy asset-listing compatibility notes.',
    filename: 'marketplace.md',
  },
  {
    order: 9,
    slug: 'subscription',
    title: 'Subscription APIs',
    description: 'Premium plan lifecycle, invoice access, and entitlement fields exposed by the canonical subscription routes.',
    filename: 'subscription.md',
  },
];

function normalizeLang(lang?: string): SupportedLang {
  const normalized = lang?.trim() || 'en';
  if (!SUPPORTED_LANGS.includes(normalized as SupportedLang)) {
    throw new EvoMapError(`Unknown doc language: ${normalized}`, 'NOT_FOUND', 404);
  }
  return normalized as SupportedLang;
}

function getDocFilename(slug: string): string {
  const filename = SLUG_TO_FILE[slug];
  if (!filename) {
    throw new EvoMapError(`Unknown doc slug: ${slug}`, 'NOT_FOUND', 404);
  }
  return filename;
}

function getWikiDocDescriptor(slug: string): WikiDocDescriptor {
  const descriptor = WIKI_DOCS.find((doc) => doc.slug === slug);
  if (!descriptor) {
    throw new EvoMapError(`Unknown wiki page: ${slug}`, 'NOT_FOUND', 404);
  }
  return descriptor;
}

function resolveDocPath(slug: string, lang?: string): string {
  const normalizedLang = normalizeLang(lang);
  const filename = getDocFilename(slug);
  const baseName = filename.replace(/\.(md|txt)$/, '');
  const extension = filename.endsWith('.txt') ? 'txt' : 'md';
  const localizedPath = join(DOCS_DIR, `${baseName}.${normalizedLang}.${extension}`);
  const defaultPath = join(DOCS_DIR, filename);

  if (existsSync(localizedPath)) {
    return localizedPath;
  }
  if (existsSync(defaultPath)) {
    return defaultPath;
  }

  throw new EvoMapError(`Doc not found: ${slug}`, 'NOT_FOUND', 404);
}

function buildWikiDocUrl(baseUrl: string, lang: string, slug: string): string {
  return `${baseUrl}/docs/${lang}/${slug}.md`;
}

function buildWikiPageUrl(baseUrl: string, lang: string, slug: string): string {
  return `${baseUrl}/wiki/${slug}?lang=${lang}`;
}

export function readDocFile(filename: string): string {
  const filePath = join(DOCS_DIR, filename);
  if (!existsSync(filePath)) {
    throw new EvoMapError(`Doc file not found: ${filename}`, 'NOT_FOUND', 404);
  }
  return readFileSync(filePath, 'utf-8');
}

export function readDocBySlug(slug: string, lang?: string): string {
  return readFileSync(resolveDocPath(slug, lang), 'utf-8');
}

export function getWikiIndexResponse(baseUrl: string, lang?: string): WikiIndexResponse {
  const normalizedLang = normalizeLang(lang);

  return {
    lang: normalizedLang,
    count: WIKI_DOCS.length,
    access: {
      individual_docs: `${baseUrl}/docs/{lang}/{slug}.md`,
      full_wiki_text: `${baseUrl}/api/docs/wiki-full?lang=${encodeURIComponent(normalizedLang)}`,
      full_wiki_json: `${baseUrl}/api/docs/wiki-full?lang=${encodeURIComponent(normalizedLang)}&format=json`,
      site_nav: `${baseUrl}/ai-nav`,
    },
    docs: WIKI_DOCS.map((doc) => ({
      order: doc.order,
      slug: doc.slug,
      title: doc.title,
      description: doc.description,
      url_markdown: buildWikiDocUrl(baseUrl, normalizedLang, doc.slug),
      url_wiki: buildWikiPageUrl(baseUrl, normalizedLang, doc.slug),
    })),
  };
}

export function getWikiFullResponse(lang?: string): WikiFullResponse {
  const normalizedLang = normalizeLang(lang);

  return {
    lang: normalizedLang,
    count: WIKI_DOCS.length,
    docs: WIKI_DOCS.map((doc) => ({
      slug: doc.slug,
      content: readDocBySlug(doc.slug, normalizedLang),
    })),
  };
}

export function buildWikiFullText(lang?: string): string {
  const full = getWikiFullResponse(lang);
  return full.docs
    .map((doc) => `<!-- ${doc.slug} -->\n${doc.content.trim()}`)
    .join('\n\n---\n\n');
}

export function getWikiPageResponse(baseUrl: string, slug: string, lang?: string): WikiPageResponse {
  const normalizedLang = normalizeLang(lang);
  const descriptor = getWikiDocDescriptor(slug);
  const index = WIKI_DOCS.findIndex((doc) => doc.slug === slug);
  const previous = index > 0 ? WIKI_DOCS[index - 1] : null;
  const next = index >= 0 && index < WIKI_DOCS.length - 1 ? WIKI_DOCS[index + 1] : null;

  return {
    lang: normalizedLang,
    slug: descriptor.slug,
    title: descriptor.title,
    description: descriptor.description,
    content: readDocBySlug(descriptor.slug, normalizedLang),
    url_markdown: buildWikiDocUrl(baseUrl, normalizedLang, descriptor.slug),
    previous: previous ? {
      slug: previous.slug,
      title: previous.title,
      url: buildWikiPageUrl(baseUrl, normalizedLang, previous.slug),
    } : null,
    next: next ? {
      slug: next.slug,
      title: next.title,
      url: buildWikiPageUrl(baseUrl, normalizedLang, next.slug),
    } : null,
  };
}

async function sendDocBySlug(
  reply: { type: (value: string) => { send: (payload: string) => unknown } },
  lang: string,
  slug: string,
): Promise<unknown> {
  return reply.type('text/plain').send(readDocBySlug(slug, lang));
}

export async function docsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/:lang/:slug.md', {
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
    return sendDocBySlug(reply, lang, slug);
  });

  // Keep extensionless access for callers that already rely on it.
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
    return sendDocBySlug(reply, lang, slug);
  });

  for (const [route, filename] of Object.entries(SLUG_TO_FILE)) {
    const extension = filename.endsWith('.txt') ? 'txt' : 'md';
    const fullRoute = `/${route}.${extension}`;
    app.get(fullRoute, {
      schema: {
        tags: ['Docs'],
        response: { 200: { type: 'string' } },
      },
    }, async (_request, reply) => {
      return reply.type('text/plain').send(readDocFile(filename));
    });
  }

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

  app.get('/api/docs/wiki-full', {
    schema: { tags: ['Docs'] },
  }, async (request, reply) => {
    const { lang, format } = request.query as { lang?: string; format?: string };
    if (format === 'json') {
      return reply.send(getWikiFullResponse(lang));
    }
    return reply.type('text/plain').send(buildWikiFullText(lang));
  });

  app.get('/api/wiki/index', {
    schema: { tags: ['Docs'] },
  }, async (request, reply) => {
    const { lang } = request.query as { lang?: string };
    return reply.send(getWikiIndexResponse(getConfig().baseUrl, lang));
  });

  app.get('/wiki', {
    schema: { tags: ['Docs'] },
  }, async (request, reply) => {
    const { lang } = request.query as { lang?: string };
    return reply.send(getWikiIndexResponse(getConfig().baseUrl, lang));
  });

  app.get('/wiki/:page', {
    schema: { tags: ['Docs'] },
  }, async (request, reply) => {
    const { lang } = request.query as { lang?: string };
    const { page } = request.params as { page: string };
    return reply.send(getWikiPageResponse(getConfig().baseUrl, page, lang));
  });
}
