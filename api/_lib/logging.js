import { randomUUID } from 'node:crypto';

function safeError(error) {
  return error instanceof Error ? error.message.slice(0, 300) : String(error || 'unknown').slice(0, 300);
}

export function requestContext(request, route) {
  return {
    route,
    requestId: String(request.headers?.['x-vercel-id'] || request.headers?.['x-request-id'] || randomUUID()),
    startedAt: Date.now()
  };
}

export function logInfo(context, message, extra = {}) {
  console.log(JSON.stringify({
    level: 'info', message, route: context.route, requestId: context.requestId,
    durationMs: Date.now() - context.startedAt, ...extra
  }));
}

export function logError(context, message, error, extra = {}) {
  console.error(JSON.stringify({
    level: 'error', message, route: context.route, requestId: context.requestId,
    durationMs: Date.now() - context.startedAt, error: safeError(error), ...extra
  }));
}
