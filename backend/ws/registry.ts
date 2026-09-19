import type { WebSocket } from "ws";

// generatorId -> the actual open socket for that generator
export const liveGenerators = new Map<string, WebSocket>();

export function isGeneratorLive(generatorId: string): boolean {
  const ws = liveGenerators.get(generatorId);
  return ws !== undefined && ws.readyState === ws.OPEN;
}

export function sendToGenerator(generatorId: string, message: object): boolean {
  const ws = liveGenerators.get(generatorId);
  if (!ws || ws.readyState !== ws.OPEN) return false;
  ws.send(JSON.stringify(message));
  return true;
}