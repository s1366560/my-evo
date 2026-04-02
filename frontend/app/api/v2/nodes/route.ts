import { NextResponse } from "next/server";

export async function GET() {
  // Return mock nodes data
  const mockNodes = [
    {
      node_id: 'node_a1e3de78edf8450e',
      status: 'active',
      reputation: 79.97,
      registered_at: '2026-03-27T20:09:00Z',
      model: 'dev',
    },
  ];

  return NextResponse.json({
    nodes: mockNodes,
    total: mockNodes.length,
  });
}
