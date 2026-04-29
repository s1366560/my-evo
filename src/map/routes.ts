/**
 * Map Routes - REST API for EvoMap
 */
import type { FastifyInstance } from 'fastify';
import { mapService } from './service';
import { mapComputeService } from './graph-compute-service';
import type { CreateMapInput, UpdateMapInput, AddNodeInput, AddEdgeInput } from './types';

interface ApiResponse<T = unknown> {
  success: boolean; data?: T; error?: { code: string; message: string };
  meta: { timestamp: string; request_id: string };
}
const resp = <T>(ok: boolean, data?: T, err?: ApiResponse['error']): ApiResponse<T> =>
  ({ success: ok, data, error: err, meta: { timestamp: new Date().toISOString(), request_id: `req_${Date.now()}` } });
const oid = (r: any) => (r.headers['x-user-id'] as string) || 'anonymous';
const map404 = (m: string) => m === 'Map not found';
const map403 = (m: string) => m === 'Forbidden';

export default async function mapRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => resp(true, { status: 'ok' }));

  // CRUD
  app.post<{ Body: CreateMapInput }>('/', async (r, rep) => {
    try { const m = await mapService.createMap(oid(r), r.body as CreateMapInput); return rep.status(201).send(resp(true, m)); }
    catch (e) { return rep.status(400).send(resp(false, undefined, { code: 'BAD_REQUEST', message: (e as Error).message })); }
  });
  app.get<{ Querystring: { public?: boolean; limit?: number; offset?: number } }>('/', async (r, rep) => {
    try { const { public: pub, limit, offset } = r.query; return rep.send(resp(true, await mapService.listMaps(oid(r), { public: pub, limit, offset }))); }
    catch (e) { return rep.status(500).send(resp(false, undefined, { code: 'INTERNAL', message: (e as Error).message })); }
  });
  app.get<{ Params: { id: string } }>('/:id', async (r, rep) => {
    const m = await mapService.getMap(r.params.id);
    return m ? rep.send(resp(true, m)) : rep.status(404).send(resp(false, undefined, { code: 'NOT_FOUND', message: 'Map not found' }));
  });
  app.patch<{ Params: { id: string }; Body: UpdateMapInput }>('/:id', async (r, rep) => {
    try { return rep.send(resp(true, await mapService.updateMap(r.params.id, oid(r), r.body as UpdateMapInput))); }
    catch (e) { const m = (e as Error).message;
      return rep.status(map404(m) ? 404 : map403(m) ? 403 : 400).send(resp(false, undefined, { code: map404(m) ? 'NOT_FOUND' : map403(m) ? 'FORBIDDEN' : 'BAD_REQUEST', message: m })); }
  });
  app.delete<{ Params: { id: string } }>('/:id', async (r, rep) => {
    try { await mapService.deleteMap(r.params.id, oid(r)); return rep.status(204).send(); }
    catch (e) { const m = (e as Error).message;
      return rep.status(map404(m) ? 404 : map403(m) ? 403 : 400).send(resp(false, undefined, { code: map404(m) ? 'NOT_FOUND' : map403(m) ? 'FORBIDDEN' : 'BAD_REQUEST', message: m })); }
  });

  // Nodes
  app.post<{ Params: { id: string }; Body: AddNodeInput }>('/:id/nodes', async (r, rep) => {
    try { const n = await mapService.addNode(r.params.id, r.body as AddNodeInput); return rep.status(201).send(resp(true, n)); }
    catch (e) { return rep.status(400).send(resp(false, undefined, { code: 'BAD_REQUEST', message: (e as Error).message })); }
  });
  app.patch<{ Params: { id: string; nodeId: string }; Body: any }>('/:id/nodes/:nodeId', async (r, rep) => {
    try { const pos = r.body as { x?: number; y?: number }; await mapService.updateNodePosition(r.params.id, r.params.nodeId, pos as any); return rep.send(resp(true, { updated: true })); }
    catch (e) { return rep.status(400).send(resp(false, undefined, { code: 'BAD_REQUEST', message: (e as Error).message })); }
  });
  app.delete<{ Params: { id: string; nodeId: string } }>('/:id/nodes/:nodeId', async (r, rep) => {
    try { await mapService.deleteNode(r.params.id, r.params.nodeId); return rep.status(204).send(); }
    catch (e) { return rep.status(400).send(resp(false, undefined, { code: 'BAD_REQUEST', message: (e as Error).message })); }
  });

  // Edges
  app.post<{ Params: { id: string }; Body: AddEdgeInput }>('/:id/edges', async (r, rep) => {
    try { const e = await mapService.addEdge(r.params.id, r.body as AddEdgeInput); return rep.status(201).send(resp(true, e)); }
    catch (e) { return rep.status(400).send(resp(false, undefined, { code: 'BAD_REQUEST', message: (e as Error).message })); }
  });
  app.delete<{ Params: { id: string; edgeId: string } }>('/:id/edges/:edgeId', async (r, rep) => {
    try { await mapService.deleteEdge(r.params.id, r.params.edgeId); return rep.status(204).send(); }
    catch (e) { return rep.status(400).send(resp(false, undefined, { code: 'BAD_REQUEST', message: (e as Error).message })); }
  });

  // Layout
  app.post<{ Params: { id: string }; Body: any }>('/:id/layout', async (r, rep) => {
    try { const { algorithm, options } = r.body as { algorithm?: string; options?: any }; return rep.send(resp(true, await mapComputeService.computeLayout(r.params.id, oid(r), (algorithm ?? 'force-directed') as 'force-directed' | 'radial' | 'tree' | 'grid', options))); }
    catch (e) { const m = (e as Error).message;
      return rep.status(map404(m) ? 404 : map403(m) ? 403 : 400).send(resp(false, undefined, { code: map404(m) ? 'NOT_FOUND' : map403(m) ? 'FORBIDDEN' : 'BAD_REQUEST', message: m })); }
  });

  // Import/Export
  app.get<{ Params: { id: string } }>('/:id/export', async (r, rep) => {
    try { return rep.send(resp(true, await mapComputeService.exportMap(r.params.id, oid(r)))); }
    catch (e) { const m = (e as Error).message;
      return rep.status(map404(m) ? 404 : map403(m) ? 403 : 500).send(resp(false, undefined, { code: map404(m) ? 'NOT_FOUND' : map403(m) ? 'FORBIDDEN' : 'INTERNAL', message: m })); }
  });
  app.post<{ Body: any }>('/import', async (r, rep) => {
    try { const m = await mapComputeService.importMap(oid(r), r.body as CreateMapInput); return rep.status(201).send(resp(true, m)); }
    catch (e) { return rep.status(400).send(resp(false, undefined, { code: 'BAD_REQUEST', message: (e as Error).message })); }
  });
}
