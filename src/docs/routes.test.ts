import {
  buildWikiFullText,
  getWikiFullResponse,
  getWikiIndexResponse,
  getWikiPageResponse,
  readDocBySlug,
} from './routes';

describe('Docs wiki helpers', () => {
  it('should read a document by slug', () => {
    const content = readDocBySlug('skill', 'en');
    const marketplace = readDocBySlug('marketplace', 'en');

    expect(content.length).toBeGreaterThan(0);
    expect(marketplace).toContain('Marketplace APIs');
  });

  it('should build a structured wiki index', () => {
    const result = getWikiIndexResponse('https://evomap.ai', 'en');

    expect(result.lang).toBe('en');
    expect(result.count).toBeGreaterThan(0);
    expect(result.docs[0]!.url_markdown).toContain('/docs/en/');
    expect(result.access.full_wiki_json).toContain('format=json');
    expect(result.docs.some((doc) => doc.slug === 'marketplace')).toBe(true);
    expect(result.docs.some((doc) => doc.slug === 'subscription')).toBe(true);
  });

  it('should build a structured full wiki response', () => {
    const result = getWikiFullResponse('en');

    expect(result.lang).toBe('en');
    expect(result.count).toBe(result.docs.length);
    expect(result.docs[0]!.content.length).toBeGreaterThan(0);
  });

  it('should build concatenated wiki text', () => {
    const text = buildWikiFullText('en');

    expect(text).toContain('<!-- skill -->');
    expect(text).toContain('---');
  });

  it('should build wiki page navigation metadata', () => {
    const page = getWikiPageResponse('https://evomap.ai', 'skill-protocol', 'en');

    expect(page.slug).toBe('skill-protocol');
    expect(page.previous?.slug).toBe('skill');
    expect(page.next?.slug).toBe('skill-structures');
    expect(page.url_markdown).toContain('/docs/en/skill-protocol.md');
  });
});
