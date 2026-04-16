import fastify, { type FastifyInstance } from 'fastify';
import { modelTierRoutes } from './routes';
import { setAgentTier } from './service';

describe('Model Tier routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = fastify({ logger: false });
    await app.register(modelTierRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns top-level tier data for the tier catalog', async () => {
    const response = await app.inject({ method: 'GET', url: '/model-tier/tiers' });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload.success).toBe(true);
    expect(payload.tiers).toHaveLength(6);
    expect(payload.data).toEqual(payload.tiers);
  });

  it('returns structured tier-insufficient claim failures', async () => {
    setAgentTier('route-claim-agent-low', 1);

    const response = await app.inject({
      method: 'POST',
      url: '/model-tier/agents/route-claim-agent-low/claim',
      payload: { min_model_tier: 3 },
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.payload)).toEqual(
      expect.objectContaining({
        success: false,
        error: 'TIER_INSUFFICIENT',
        current_tier: 1,
        required_tier: 3,
        message: 'This action requires Tier 3. Your current tier is Tier 1.',
      }),
    );
  });

  it('surfaces allowed-model bypasses and top-level claim data', async () => {
    setAgentTier('route-claim-agent-match', 0);

    const response = await app.inject({
      method: 'POST',
      url: '/model-tier/agents/route-claim-agent-match/claim',
      payload: {
        min_model_tier: 5,
        allowed_models: ['custom-model'],
        model: 'custom-model',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      claim: {
        allowed: true,
        current_tier: 0,
        matched_model: 'custom-model',
      },
      data: {
        allowed: true,
        current_tier: 0,
        matched_model: 'custom-model',
      },
    });
  });

  it('includes top-level evaluation output for declared-model checks', async () => {
    setAgentTier('route-eval-agent', 1);

    const response = await app.inject({
      method: 'POST',
      url: '/model-tier/agents/route-eval-agent/evaluate',
      payload: {
        required_capabilities: ['publish_gene'],
        declared_model: 'gpt-5',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      evaluation: {
        eligible: true,
        current_tier: 4,
        reason: undefined,
        required_tier: 2,
      },
      data: {
        eligible: true,
        current_tier: 4,
        reason: undefined,
        required_tier: 2,
      },
    });
  });
});
