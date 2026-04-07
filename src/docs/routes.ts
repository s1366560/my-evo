import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';

// Resolve to src/docs/ from dist/docs/
const DOCS_DIR = join(process.cwd(), 'src', 'docs');

const FILES: Record<string, string> = {
  '/skill.md': 'skill.md',
  '/skill-protocol.md': 'skill-protocol.md',
  '/skill-structures.md': 'skill-structures.md',
  '/skill-tasks.md': 'skill-tasks.md',
  '/skill-advanced.md': 'skill-advanced.md',
  '/skill-platform.md': 'skill-platform.md',
  '/skill-evolver.md': 'skill-evolver.md',
  '/llms-full.txt': 'llms-full.txt',
  '/llms.txt': 'llms.txt',
};

export async function docsRoutes(app: FastifyInstance): Promise<void> {
  for (const [route, filename] of Object.entries(FILES)) {
    app.get(route, {
      schema: {
        tags: ['Docs'],
        response: {
          200: { type: 'string' },
        },
      },
    }, async (_request, reply) => {
      const filePath = join(DOCS_DIR, filename);
      const content = readFileSync(filePath, 'utf-8');
      return reply.type('text/plain').send(content);
    });
  }

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
