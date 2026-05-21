import { http, HttpResponse } from 'msw';
import { delay } from './handlers';

export const mockGDIWeights = {
  structural: 0.20,
  semantic: 0.25,
  specificity: 0.20,
  strategy: 0.15,
  validation: 0.20,
};

export const mockGDIConfig = {
  score_range: { min: 0, max: 100 },
  confidence_weights: { signals: 0.6, validation: 0.4 },
  decay_enabled: true,
  decay_rate: 0.01,
};

const mockScoreHistory: Record<string, Array<{ overall: number; calculated_at: string }>> = {
  'gene-001': [
    { overall: 78, calculated_at: '2026-04-20T10:00:00Z' },
    { overall: 80, calculated_at: '2026-04-22T10:00:00Z' },
    { overall: 82, calculated_at: '2026-04-25T10:00:00Z' },
  ],
  'gene-002': [
    { overall: 85, calculated_at: '2026-04-18T10:00:00Z' },
    { overall: 88, calculated_at: '2026-04-21T10:00:00Z' },
    { overall: 91, calculated_at: '2026-04-25T10:00:00Z' },
  ],
};

export const gdiHandlers = [
  http.post('/gdi/score/batch', async ({ request }) => {
    await delay(500);
    const body = await request.json() as { assets: Array<{ asset_id: string; asset_type: string; name: string; content?: string; signals: string[]; validation_results?: Array<{ passed: boolean; test: string }>; ancestors: string[]; fork_count?: number; created_at: string }>; customWeights?: Record<string, number> };
    const weights = { ...mockGDIWeights, ...body.customWeights };
    const scores = body.assets.map(asset => {
      const contentLen = asset.content?.length ?? 0;
      const signalCount = asset.signals.length;
      const structural = Math.min(100, (contentLen / 1000) * 40 + signalCount * 3);
      const semantic = Math.min(100, 50 + signalCount * 5);
      const specificity = Math.min(100, 40 + signalCount * 8);
      const strategy = 60 + Math.random() * 20;
      const validation = asset.validation_results 
        ? (asset.validation_results.filter(r => r.passed).length / asset.validation_results.length) * 100 
        : 50;
      const overall = structural * weights.structural + semantic * weights.semantic + specificity * weights.specificity + strategy * weights.strategy + validation * weights.validation;
      return {
        asset_id: asset.asset_id,
        asset_type: asset.asset_type,
        overall: Math.round(overall * 10) / 10,
        dimensions: { structural: Math.round(structural * 10) / 10, semantic: Math.round(semantic * 10) / 10, specificity: Math.round(specificity * 10) / 10, strategy: Math.round(strategy * 10) / 10, validation: Math.round(validation * 10) / 10 },
        weights,
        confidence: 0.75,
        gdi_lower: Math.round(overall * 0.85 * 10) / 10,
        gdi_upper: Math.round(overall * 1.15 * 10) / 10,
        calculated_at: new Date().toISOString(),
      };
    });
    return HttpResponse.json({ scores, failed: [], calculated_at: new Date().toISOString() });
  }),
  http.get('/gdi/score/:assetId/history', async ({ params }) => {
    await delay(200);
    const history = mockScoreHistory[params.assetId as string];
    if (!history) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json({ asset_id: params.assetId, history });
  }),
  http.get('/gdi/config', async () => {
    await delay(100);
    return HttpResponse.json(mockGDIConfig);
  }),
  http.get('/gdi/weights', async () => {
    await delay(100);
    return HttpResponse.json(mockGDIWeights);
  }),
];
