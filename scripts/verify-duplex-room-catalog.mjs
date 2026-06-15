import { createServer } from "vite";

const server = await createServer({
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { jingongMapData } = await server.ssrLoadModule("/src/features/map/data/mapData.ts");
  const { JINGONG_ROOMS, JINGONG_ACCESS_RULES, jingongRoomKnowledgeText } = await server.ssrLoadModule(
    "/vendor/DuplexKit/src/jingongRooms.ts",
  );

  const frontendRooms = new Map(jingongMapData.rooms.map((room) => [room.id, room]));
  const backendRooms = new Map(JINGONG_ROOMS.map((room) => [room.id, room]));
  const missingInBackend = [...frontendRooms.keys()].filter((id) => !backendRooms.has(id));
  const extraInBackend = [...backendRooms.keys()].filter((id) => !frontendRooms.has(id));
  if (missingInBackend.length > 0 || extraInBackend.length > 0) {
    throw new Error(`DuplexKit room catalog drift: missing=${missingInBackend.join(",") || "-"} extra=${extraInBackend.join(",") || "-"}`);
  }

  for (const [id, room] of frontendRooms) {
    const backend = backendRooms.get(id);
    if (backend.roomNo !== room.roomNo) throw new Error(`${id}: backend roomNo ${backend.roomNo} does not match frontend ${room.roomNo}`);
    if (backend.name !== room.name) throw new Error(`${id}: backend name ${backend.name} does not match frontend ${room.name}`);
    if (backend.floor !== room.floor) throw new Error(`${id}: backend floor ${backend.floor} does not match frontend ${room.floor}`);
  }

  const knowledge = jingongRoomKnowledgeText();
  for (const required of ["108-2F03", "108-2F04", "104-2F01", "106-2F", "202-5", "公共楼梯", "内部楼梯"]) {
    if (!knowledge.includes(required)) throw new Error(`DuplexKit room knowledge is missing required token: ${required}`);
  }
  if (!JINGONG_ACCESS_RULES.some((rule) => rule.includes("不能直接到达104、106、108"))) {
    throw new Error("DuplexKit access rules must forbid public stair access to independent second floors.");
  }

  console.log(`DuplexKit room catalog verified: ${backendRooms.size} rooms, ${JINGONG_ACCESS_RULES.length} access rules.`);
} finally {
  await server.close();
}
