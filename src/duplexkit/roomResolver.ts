import { jingongMapData } from "../features/map/data/mapData";
import type { MapRoom } from "../features/map/types";

const fallbackDestinationIds = ["108-2F04", "202-5", "104-2F01", "106-2F", "208", "210"];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。,.、：:;；（）()\-－—–_]/g, "");
}

function scoreRoom(room: MapRoom, query: string): number {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;
  const normalizedId = normalize(room.id);
  const normalizedRoomNo = normalize(room.roomNo);
  const normalizedName = normalize(room.name);
  const fields = [room.id, room.roomNo, room.name, room.description, ...room.tags].map(normalize);
  if (normalizedId && normalizedQuery === normalizedId) return 120;
  if (normalizedRoomNo && normalizedQuery === normalizedRoomNo) return 118;
  if (normalizedId && normalizedQuery.startsWith(normalizedId)) return 110 + Math.min(20, normalizedId.length);
  if (normalizedRoomNo && normalizedQuery.startsWith(normalizedRoomNo)) return 100 + Math.min(20, normalizedRoomNo.length);
  if (fields.some((field) => field === normalizedQuery)) return 100;
  if (normalizedRoomNo && normalizedName && normalizedQuery.includes(normalizedRoomNo) && normalizedQuery.includes(normalizedName)) return 98;
  if (fields.some((field) => field.includes(normalizedQuery))) return 80;
  if (fields.some((field) => normalizedQuery.includes(field) && field.length >= 2)) return 65;
  const tokenHits = fields.flatMap((field) => [...normalizedQuery].filter((char) => field.includes(char))).length;
  return tokenHits >= 2 ? Math.min(55, tokenHits * 8) : 0;
}

export function resolveRoomId(place?: string, fallbackId?: string): string {
  const fallback = fallbackId || fallbackDestinationIds.find((id) => jingongMapData.rooms.some((room) => room.id === id)) || jingongMapData.defaultStartRoomId;
  if (!place?.trim()) return fallback;
  let best: { room: MapRoom; score: number } | undefined;
  for (const room of jingongMapData.rooms) {
    const score = scoreRoom(room, place);
    if (!best || score > best.score) best = { room, score };
  }
  return best && best.score > 0 ? best.room.id : fallback;
}

export function roomLabel(roomId?: string): string {
  const room = jingongMapData.rooms.find((candidate) => candidate.id === roomId);
  return room ? `${room.roomNo} ${room.name}` : roomId || "目标地点";
}
