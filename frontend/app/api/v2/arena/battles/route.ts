import { NextResponse } from "next/server";

export async function GET() {
  // Return mock arena battles
  const mockBattles = [
    {
      id: 'battle_001',
      challenger: 'node_alpha',
      defender: 'node_beta',
      challenger_elo: 1847,
      defender_elo: 1723,
      status: 'pending',
      created_at: new Date().toISOString(),
    },
  ];

  return NextResponse.json({
    battles: mockBattles,
    total: mockBattles.length,
  });
}
