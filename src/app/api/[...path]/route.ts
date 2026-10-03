const API_ORIGIN = "https://next-js-login-red.vercel.app";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function isSupportedRequest(path: string[], method: string) {
  if (path.length === 1 && path[0] === "login") return method === "POST";
  if (path.length === 1 && path[0] === "me") return method === "GET";
  if (path.length === 2 && path[0] === "admin" && path[1] === "vouchers") {
    return method === "GET" || method === "POST";
  }
  if (path.length === 2 && path[0] === "admin" && path[1] === "users") {
    return method === "GET";
  }
  if (
    path.length === 3 &&
    path[0] === "admin" &&
    path[1] === "vouchers" &&
    path[2].length > 0
  ) {
    return method === "PUT";
  }
  if (
    path.length === 4 &&
    path[0] === "admin" &&
    path[1] === "vouchers" &&
    path[2].length > 0 &&
    path[3] === "status"
  ) {
    return method === "PATCH";
  }
  return false;
}

async function proxyRequest(request: Request, context: RouteContext) {
  const { path } = await context.params;

  if (!isSupportedRequest(path, request.method)) {
    return Response.json(
      { message: "Endpoint atau metode API tidak didukung." },
      { status: 404 },
    );
  }

  const upstreamUrl = new URL(
    `/api/${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`,
    API_ORIGIN,
  );
  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");

  if (authorization) headers.set("authorization", authorization);
  if (contentType) headers.set("content-type", contentType);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.text(),
      cache: "no-store",
      redirect: "manual",
    });
    const responseHeaders = new Headers({
      "cache-control": "no-store",
    });
    const upstreamContentType = upstreamResponse.headers.get("content-type");
    if (upstreamContentType) {
      responseHeaders.set("content-type", upstreamContentType);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("API proxy request failed:", error);
    return Response.json(
      { message: "Tidak dapat terhubung ke layanan API." },
      { status: 502 },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
