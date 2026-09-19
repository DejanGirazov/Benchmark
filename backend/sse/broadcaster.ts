import type { Response } from "express";

export type StreamPayload =
  | { type: "status"; status: string; reason?: string; summary?: unknown }
  | { type: "metrics"; data: unknown };

const END_STATUSES = new Set(["completed", "failed", "cancelled"]);
const HEARTBEAT_MS = 15_000;

// testId -> every dashboard connection currently watching that test
const subscribers = new Map<string, Set<Response>>();

export function isEndStatus(status: string): boolean {
    return END_STATUSES.has(status);
}

// Writes one SSE frame. Returns false if the client is already gone.
export function sendEvent(res: Response, event: string, data: unknown): boolean {
  if (res.writableEnded || res.destroyed) return false;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

// Sets SSE headers and starts the heartbeat. Call once per connection.
export function openStream(res: Response): void {
  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // stop nginx-style proxies from buffering
  });
  res.flushHeaders();
  res.write("retry: 3000\n\n"); // client reconnect delay if the stream drops

  // A comment line, ignored by clients, keeps idle proxies from closing the stream
  const heartbeat = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) res.write(": ping\n\n");
  }, HEARTBEAT_MS);

  res.on("close", () => clearInterval(heartbeat));
}      

// Registers a connection to receive live events for a test.
export function subscribeToTest(testId: string, res: Response): void {
  let set = subscribers.get(testId);
  if (!set) {
    set = new Set();
    subscribers.set(testId, set);
  }
  set.add(res);

  res.on("close", () => {
    const current = subscribers.get(testId);
    if (!current) return;
    current.delete(res);
    if (current.size === 0) subscribers.delete(testId); // don't leak empty sets
  });
}

// This is the function orchestrator.ts already imports.
export function broadcastToTestSubscribers(
  testId: string,
  payload: StreamPayload,
): void {
  const set = subscribers.get(testId);
  if (!set) return;

  for (const res of set) {
    sendEvent(res, payload.type, payload);
  }

  // After completed/failed/cancelled nothing more will arrive: close the streams
  if (payload.type === "status" && isEndStatus(payload.status)) {
    subscribers.delete(testId);
    for (const res of set) res.end();
  }
}