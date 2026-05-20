/**
 * Arena Module Routes
 * Arena rankings and AI agent competition
 */

import type { FastifyInstance } from 'fastify';

interface RankingEntry {
  rank: number;
  node_id: string;
  name: string;
  score: number;
  wins: number;
  losses: number;
  win_rate: number;
}

interface MatchEntry {
  match_id: string;
  agent_a: string;
  agent_b: string;
  winner: string;
  score_a: number;
  score_b: number;
  timestamp: string;
}

interface ArenaStats {
  total_matches: number;
  active_competitors: number;
  total_prize_pool: number;
  current_season: string;
}

// Mock data for arena rankings
const mockRankings: RankingEntry[] = [
  { rank: 1, node_id: 'node-champion-001', name: 'Alpha Champion', score: 2850, wins: 45, losses: 5, win_rate: 0.9 },
  { rank: 2, node_id: 'node-champion-002', name: 'Beta Challenger', score: 2720, wins: 40, losses: 8, win_rate: 0.833 },
  { rank: 3, node_id: 'node-champion-003', name: 'Gamma Contender', score: 2650, wins: 38, losses: 10, win_rate: 0.792 },
  { rank: 4, node_id: 'node-champion-004', name: 'Delta Striker', score: 2580, wins: 35, losses: 12, win_rate: 0.745 },
  { rank: 5, node_id: 'node-champion-005', name: 'Epsilon Tactician', score: 2510, wins: 32, losses: 15, win_rate: 0.681 },
];

// Mock match history
const mockMatches: MatchEntry[] = [
  { match_id: 'match-001', agent_a: 'node-champion-001', agent_b: 'node-champion-002', winner: 'node-champion-001', score_a: 3, score_b: 1, timestamp: '2025-04-20T14:00:00Z' },
  { match_id: 'match-002', agent_a: 'node-champion-003', agent_b: 'node-champion-001', winner: 'node-champion-003', score_a: 3, score_b: 2, timestamp: '2025-04-20T13:00:00Z' },
  { match_id: 'match-003', agent_a: 'node-champion-002', agent_b: 'node-champion-004', winner: 'node-champion-002', score_a: 2, score_b: 2, timestamp: '2025-04-20T12:00:00Z' },
];

// Mock arena stats
const mockStats: ArenaStats = {
  total_matches: 15420,
  active_competitors: 892,
  total_prize_pool: 50000,
  current_season: 'Season 7',
};

export async function arenaRoutes(app: FastifyInstance): Promise<void> {
  // Get arena rankings
  app.get('/rankings', {
    schema: {
      tags: ['Arena'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          category: { type: 'string', default: 'all' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                items: { type: 'array' },
                meta: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request) => {
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
    const start = (page - 1) * limit;
    const end = start + limit;
    const items = mockRankings.slice(start, end);
    return {
      success: true,
      data: {
        items,
        meta: {
          total: mockRankings.length,
          page,
          limit,
        },
      },
    };
  });

  // Get match history
  app.get('/matches', {
    schema: {
      tags: ['Arena'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                items: { type: 'array' },
              },
            },
          },
        },
      },
    },
  }, async (request) => {
    const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number };
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
      success: true,
      data: {
        items: mockMatches.slice(start, end),
      },
    };
  });

  // Get arena statistics
  app.get('/stats', {
    schema: {
      tags: ['Arena'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
      },
    },
  }, async () => {
    return {
      success: true,
      data: mockStats,
    };
  });

  // Get specific competitor details
  app.get<{ Params: { nodeId: string } }>('/competitor/:nodeId', {
    schema: {
      tags: ['Arena'],
      params: {
        type: 'object',
        properties: {
          nodeId: { type: 'string' },
        },
        required: ['nodeId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
      },
    },
  }, async (request) => {
    const { nodeId } = request.params;
    const competitor = mockRankings.find((r) => r.node_id === nodeId);
    if (!competitor) {
      return {
        success: false,
        error: 'Competitor not found',
      };
    }
    return {
      success: true,
      data: competitor,
    };
  });
}
