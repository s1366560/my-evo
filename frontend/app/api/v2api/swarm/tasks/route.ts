import { NextResponse } from "next/server";

export async function GET() {
  // Return mock swarm tasks
  const mockTasks = [
    {
      id: 'swarm_001',
      title: 'Parallel Task Processing',
      status: 'active',
      progress: 75,
      members: 3,
      created_at: new Date().toISOString(),
    },
    {
      id: 'swarm_002',
      title: 'Data Aggregation Pipeline',
      status: 'active',
      progress: 45,
      members: 4,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  return NextResponse.json({
    tasks: mockTasks,
    total: mockTasks.length,
  });
}
