/**
 * API Route: POST /api/v2/maps/[mapId]/save
 * Saves all nodes and edges for a map.
 * Request body: { nodes: ApiMapNode[], edges: ApiMapEdge[] }
 * Returns: { success: true, data: { nodes: ApiMapNode[], edges: ApiMapEdge[] } }
 */
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

type Params = { params: Promise<{ mapId: string }> };

interface ApiMapNode {
  id?: string;
  name: string;
  type: string;
  description?: string;
  metadata?: Record<string, unknown>;
  position?: { x: number; y: number };
}

interface ApiMapEdge {
  id?: string;
  source: string;
  target: string;
  type?: string;
  weight?: number;
  description?: string;
}

interface SavePayload {
  nodes: ApiMapNode[];
  edges: ApiMapEdge[];
}

export async function POST(request: NextRequest, { params }: Params) {
  const { mapId } = await params;
  const body: SavePayload = await request.json();
  const { nodes, edges } = body;

  const authHeader = request.headers.get("Authorization") ?? "";

  try {
    // Save nodes: create or update each
    const savedNodes: ApiMapNode[] = [];
    for (const node of nodes ?? []) {
      const url = node.id
        ? `${BACKEND}/api/v1/map/nodes/${node.id}`
        : `${BACKEND}/api/v1/map/nodes`;
      const method = node.id ? "PATCH" : "POST";
      const reqBody = node.id
        ? { label: node.name, description: node.description, metadata: node.metadata }
        : { mapId, label: node.name, description: node.description, nodeType: node.type || 'concept', positionX: node.position?.x ?? 0, positionY: node.position?.y ?? 0, metadata: node.metadata ?? {} };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        credentials: "include",
        body: JSON.stringify(reqBody),
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({ error: `Node save failed: ${data?.error?.message ?? res.statusText}` }, { status: res.status });
      }
      savedNodes.push(data.success ? data.data : data);
    }

    // Save edges: create each
    const savedEdges: ApiMapEdge[] = [];
    for (const edge of edges ?? []) {
      const url = `${BACKEND}/api/v1/map/edges`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        credentials: "include",
        body: JSON.stringify({ mapId, sourceId: edge.source, targetId: edge.target, label: edge.description, metadata: { weight: edge.weight } }),
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({ error: `Edge save failed: ${data?.error?.message ?? res.statusText}` }, { status: res.status });
      }
      savedEdges.push(data.success ? data.data : data);
    }

    return NextResponse.json({ success: true, data: { nodes: savedNodes, edges: savedEdges } });
  } catch {
    return NextResponse.json({ error: "Backend unreachable during save" }, { status: 502 });
  }
}
