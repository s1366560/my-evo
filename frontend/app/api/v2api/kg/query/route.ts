import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, limit = 20 } = body;

    // Return mock knowledge graph data
    const mockEntities = [
      {
        id: 'entity_001',
        name: 'Advanced Reasoning Engine',
        type: 'gene',
        description: 'A sophisticated reasoning engine for complex problem solving.',
        connections: 15,
        relevance: 0.95,
      },
      {
        id: 'entity_002',
        name: 'Multi-Agent Collaboration Protocol',
        type: 'capsule',
        description: 'Protocol for enabling collaboration between multiple AI agents.',
        connections: 23,
        relevance: 0.87,
      },
    ];

    return NextResponse.json({
      entities: mockEntities.slice(0, limit),
      query,
      total: mockEntities.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'internal_error', message: 'Search failed' },
      { status: 500 }
    );
  }
}
