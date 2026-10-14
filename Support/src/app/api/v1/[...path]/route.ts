import { NextRequest, NextResponse } from "next/server";

function resolveBackendOrigin(): string {
  const raw = process.env.BACKEND_URL?.trim() || "http://localhost:8000";
  let origin = raw.replace(/\/+$/, "");
  if (origin.endsWith("/api/v1")) {
    origin = origin.slice(0, -"/api/v1".length);
  }
  return origin;
}

async function proxyRequest(request: NextRequest, pathSegments: string[]) {
  const path = pathSegments.join("/");
  const targetUrl = `${resolveBackendOrigin()}/api/v1/${path}${request.nextUrl.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(targetUrl, init);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Backend request failed";
    console.error("[support-api-proxy]", targetUrl, message);
    return NextResponse.json(
      {
        detail: {
          code: "backend_unreachable",
          message:
            "Support API proxy could not reach the backend. Set BACKEND_URL on the server (e.g. https://api.zynd.shop).",
        },
      },
      { status: 502 },
    );
  }
  const responseHeaders = new Headers(backendResponse.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  const response = new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders,
  });

  const setCookies =
    typeof backendResponse.headers.getSetCookie === "function"
      ? backendResponse.headers.getSetCookie()
      : [];

  response.headers.delete("set-cookie");
  for (const cookie of setCookies) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}
