function getAllowedOrigins() {
  return (process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolveAllowedOrigin(request) {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = request?.headers?.get("origin");

  if (allowedOrigins.length === 0) {
    return "*";
  }

  if (!requestOrigin) {
    return allowedOrigins[0];
  }

  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return "null";
}

export function buildCorsHeaders(request) {
  const allowOrigin = resolveAllowedOrigin(request);

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

export function withCorsJson(data, request, init = {}) {
  const corsHeaders = buildCorsHeaders(request);
  const headers = {
    ...corsHeaders,
    ...(init.headers || {}),
  };

  return Response.json(data, {
    ...init,
    headers,
  });
}

export function corsPreflight(request) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  });
}