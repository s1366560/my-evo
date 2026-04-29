/**
 * BFF Proxy: /api/v1/auth/*
 * Fixes auth API shape mismatch between frontend expectations and backend responses.
 * - Login/register responses are unwrapped from {success, data} → {token, user}
 * - /me response is remapped to {node_id, auth_type, trust_level}
 */
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

type Params = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { path } = await params;
  const subPath = path.join("/");
  const url = `${BACKEND}/api/v1/auth/${subPath}`;

  try {
    const authHeader = request.headers.get("Authorization") ?? "";
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      credentials: "include",
    });
    const data = await res.json();

    // Fix /me response shape for frontend useMe hook
    if (subPath === "me" && data.success && data.data) {
      const user = data.data.user ?? data.data;
      return NextResponse.json({
        node_id: user.userId ?? user.id ?? user.node_id ?? "",
        auth_type: user.role ?? "user",
        trust_level: user.trust_level ?? "unverified",
      }, { status: res.status });
    }

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { path } = await params;
  const subPath = path.join("/");
  const url = `${BACKEND}/api/v1/auth/${subPath}`;
  const body = await request.json();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: request.headers.get("Authorization") ?? "",
      },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json();

    // Fix login response: preserve {success, data} structure for frontend auth store
    if (subPath === "login" && data.success && data.data) {
      return NextResponse.json({
        success: true,
        data: {
          accessToken: data.data.accessToken,
          user: {
            id: data.data.user?.id ?? data.data.userId ?? "",
            email: data.data.user?.email ?? "",
          },
        },
      }, { status: res.status });
    }

    // Fix register response: preserve {success, data} structure
    if (subPath === "register" && data.success) {
      return NextResponse.json({
        success: true,
        data: data.data ?? {},
      }, { status: res.status });
    }

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { path } = await params;
  const subPath = path.join("/");
  const url = `${BACKEND}/api/v1/auth/${subPath}`;

  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: request.headers.get("Authorization") ?? "",
      },
      credentials: "include",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
