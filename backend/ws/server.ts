import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { db } from "../db/index";
import { generators } from "../db/schema";
import { eq } from "drizzle-orm";
import { liveGenerators } from "./registry";
import { handleInboundMessage } from "./orchestrator";
import type { InboundMessage, RegisterMessage } from "./types";

export function attachWsServer(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/generator" });

  wss.on("connection", (ws: WebSocket) => {
    let generatorId: string | null = null;

    ws.on("message", async (raw) => {
      let msg: InboundMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        return;
      }

      if (msg.type === "register") {
        generatorId = await handleRegister(ws, msg);
        return;
      }

      if (!generatorId) {
        ws.send(JSON.stringify({ type: "error", message: "Must register first" }));
        return;
      }

      await handleInboundMessage(generatorId, msg);
    });

    ws.on("close", async () => {
      if (!generatorId) return;
      liveGenerators.delete(generatorId);
      await db
        .update(generators)
        .set({ status: "offline" })
        .where(eq(generators.id, generatorId));
      console.log(`Generator ${generatorId} disconnected`);
    });

    ws.on("error", (err) => {
      console.error("WS connection error:", err.message);
    });
  });

  return wss;
}

async function handleRegister(ws: WebSocket, msg: RegisterMessage): Promise<string> {
  const existing = await db
    .select()
    .from(generators)
    .where(eq(generators.name, msg.name))
    .limit(1);

  let generatorId: string;

  if (existing.length > 0) {
    generatorId = existing[0].id;
    await db
      .update(generators)
      .set({ status: "online", capacity: msg.capacity, lastSeenAt: new Date() })
      .where(eq(generators.id, generatorId));
  } else {
    const inserted = await db
      .insert(generators)
      .values({
        name: msg.name,
        status: "online",
        capacity: msg.capacity,
        lastSeenAt: new Date(),
      })
      .returning();
    generatorId = inserted[0].id;
  }

  liveGenerators.set(generatorId, ws);
  ws.send(JSON.stringify({ type: "registered", generatorId }));
  console.log(`Generator ${msg.name} registered as ${generatorId}`);
  return generatorId;
}