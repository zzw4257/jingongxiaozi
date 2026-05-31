import type {
  CenterlineSegment,
  DoorSegment,
  FloorGeometry,
  FloorId,
  GeometrySource,
  MapSpace,
  MapData,
  MapRoom,
  ModelCalibration,
  NavEdge,
  NavNode,
  Point,
  RoomRect,
  StairGeometry,
  WallSegment,
} from "../types";

const polygonBounds = (polygon: Point[]): RoomRect => {
  const xs = polygon.map((point) => point[0]);
  const ys = polygon.map((point) => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
};

const centroid = (polygon: Point[]): Point => {
  const total = polygon.reduce<Point>((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  return [total[0] / polygon.length, total[1] / polygon.length];
};

const room = (
  id: string,
  roomNo: string,
  name: string,
  floor: FloorId,
  area: MapRoom["area"],
  polygon: Point[],
  doorNodeId: string,
  description: string,
  tags: string[] = [],
  parentRoomId?: string,
  labelPoint?: Point,
): MapRoom => ({
  id,
  roomNo,
  name,
  floor,
  area,
  polygon,
  rect: polygonBounds(polygon),
  center: centroid(polygon),
  labelPoint: labelPoint ?? centroid(polygon),
  doorNodeId,
  description,
  tags,
  parentRoomId,
  imagePlaceholder: "房间实景图待补充",
});

const node = (
  id: string,
  floor: FloorId,
  point: Point,
  kind: NavNode["kind"] = "corridor",
  label?: string,
): NavNode => ({ id, floor, point, kind, label });

const edge = (
  from: string,
  to: string,
  kind: NavEdge["kind"] = "corridor",
  note?: string,
  distance?: number,
): NavEdge => ({ from, to, kind, note, distance });

const space = (
  id: string,
  label: string,
  floor: FloorId,
  kind: MapSpace["kind"],
  polygon: Point[],
  description: string,
  source: GeometrySource = "inferred",
  navigable = kind === "corridor" || kind === "stair",
  labelPriority = kind === "corridor" ? 40 : 16,
): MapSpace => ({
  id,
  label,
  floor,
  kind,
  polygon,
  center: centroid(polygon),
  source,
  navigable,
  description,
  labelPriority,
});

const wallFromPolygon = (floor: FloorId, prefix: string, polygon: Point[], kind: WallSegment["kind"]): WallSegment[] =>
  polygon.map((point, index) => ({
    id: `${prefix}-${index}`,
    floor,
    from: point,
    to: polygon[(index + 1) % polygon.length],
    thickness: kind === "outer" ? 5 : 2,
    kind,
  }));

export const areaLabels: Record<MapRoom["area"], string> = {
  teaching: "教学区",
  processing: "加工区",
  lab: "实验区",
  office: "办公区",
  service: "服务区",
  other: "其他空间",
};

const floor1Outline: Point[] = [
  [70, 535],
  [160, 535],
  [160, 405],
  [235, 405],
  [235, 210],
  [455, 210],
  [455, 300],
  [610, 300],
  [610, 250],
  [690, 250],
  [690, 190],
  [1090, 190],
  [1090, 315],
  [1135, 315],
  [1135, 450],
  [1035, 450],
  [1035, 585],
  [960, 585],
  [960, 690],
  [650, 690],
  [650, 615],
  [350, 615],
  [350, 690],
  [70, 690],
];

const floor2Outline: Point[] = [
  [90, 70],
  [230, 70],
  [230, 15],
  [470, 15],
  [470, 120],
  [635, 120],
  [635, 95],
  [930, 95],
  [930, 160],
  [1180, 160],
  [1180, 280],
  [1050, 280],
  [1050, 245],
  [920, 245],
  [920, 345],
  [520, 345],
  [520, 705],
  [235, 705],
  [235, 625],
  [90, 625],
];

const floors: FloorGeometry[] = [
  {
    id: "1F",
    label: "一层 1F",
    elevation: 0,
    height: 72,
    outline: floor1Outline,
    corridorPolygons: [
      [
        [70, 595],
        [650, 595],
        [650, 540],
        [730, 540],
        [730, 450],
        [1115, 450],
        [1115, 500],
        [1010, 500],
        [1010, 615],
        [660, 615],
        [660, 635],
        [70, 635],
      ],
      [
        [600, 440],
        [730, 440],
        [730, 250],
        [780, 250],
        [780, 500],
        [600, 500],
      ],
      [
        [455, 500],
        [600, 500],
        [600, 595],
        [455, 595],
      ],
    ],
  },
  {
    id: "2F",
    label: "二层 2F",
    elevation: 110,
    height: 62,
    outline: floor2Outline,
    corridorPolygons: [
      [
        [90, 210],
        [350, 210],
        [350, 150],
        [520, 150],
        [520, 205],
        [620, 205],
        [620, 255],
        [520, 255],
        [520, 310],
        [350, 310],
        [350, 265],
        [90, 265],
      ],
      [
        [620, 205],
        [920, 205],
        [920, 255],
        [620, 255],
      ],
      [
        [235, 625],
        [520, 625],
        [520, 705],
        [235, 705],
      ],
    ],
  },
];

const rooms: MapRoom[] = [
  room("111", "111", "精密测量", "1F", "lab", [[70, 635], [185, 635], [185, 690], [70, 690]], "door-111", "一层精密测量空间。", ["测量"]),
  room("110", "110", "教室", "1F", "teaching", [[185, 635], [350, 635], [350, 690], [185, 690]], "door-110", "卡丁车训练与展示空间。", ["卡丁车"]),
  room("109", "109", "辅助空间", "1F", "service", [[350, 595], [430, 595], [430, 690], [350, 690]], "door-109", "一层辅助与通行空间。", ["服务"]),
  room("113", "113", "仓库", "1F", "other", [[70, 405], [160, 405], [160, 595], [70, 595]], "door-113", "仓储空间。", ["仓库"]),
  room("112", "112", "空房间", "1F", "other", [[70, 535], [130, 535], [130, 595], [70, 595]], "door-112", "预留空房间。", ["预留"]),
  room("114", "114", "空房间", "1F", "other", [[160, 405], [235, 405], [235, 500], [160, 500]], "door-114", "预留空房间。", ["预留"]),

  room("108-1F03", "108-1F03", "木工", "1F", "processing", [[235, 210], [455, 210], [455, 340], [235, 340]], "door-108-1F03", "木工训练空间。", ["木工"]),
  room("108-1F02", "108-1F02", "激光切割", "1F", "processing", [[235, 340], [350, 340], [350, 440], [235, 440]], "door-108-1F02", "激光切割训练空间。", ["激光切割"]),
  room("108-1F05", "108-1F05", "设备图书馆", "1F", "teaching", [[235, 440], [350, 440], [350, 565], [235, 565]], "door-108-1F05", "设备图书馆与学习资源空间。", ["图书"]),
  room("108-1F01", "108-1F01", "综合实践区", "1F", "other", [[350, 340], [455, 340], [455, 595], [350, 595]], "door-108-1F01", "108 一层综合空间和通行区域。", ["综合"]),
  room("108-lobby", "108", "108 门厅", "1F", "service", [[455, 540], [540, 540], [540, 615], [455, 615]], "door-108-lobby", "108 区域门厅，机器人默认可从此处开始导航。", ["入口"]),
  room("108-1F04", "108-1F04", "拆装", "1F", "processing", [[540, 540], [650, 540], [650, 615], [540, 615]], "door-108-1F04", "拆装训练空间。", ["拆装"]),

  room("107-3", "107-3", "数铣", "1F", "processing", [[780, 500], [905, 500], [905, 560], [780, 560]], "door-107-3", "数控铣削训练空间。", ["数铣"]),
  room("107-4", "107-4", "数车", "1F", "processing", [[780, 560], [905, 560], [905, 615], [780, 615]], "door-107-4", "数控车削训练空间。", ["数车"]),
  room("107-5", "107-5", "WEDM 编程设计", "1F", "processing", [[905, 500], [980, 500], [980, 560], [905, 560]], "door-107-5", "WEDM 编程与设计训练空间。", ["WEDM"]),
  room("107-1", "107-1", "WEDM 机房", "1F", "processing", [[905, 560], [980, 560], [980, 615], [905, 615]], "door-107-1", "WEDM 设备机房。", ["WEDM"]),
  room("107-core", "107", "107 数字化制造中心", "1F", "service", [[650, 500], [780, 500], [780, 615], [650, 615]], "door-107-core", "107 数字化制造中心公共操作区。", ["通行", "数字化"]),

  room("104-1F01", "104-1F01", "精铸", "1F", "lab", [[730, 315], [865, 315], [865, 450], [730, 450]], "door-104-1F01", "104 一层精密铸造空间，也是通往 104 二层的入口区域。", ["精铸", "内部楼梯"]),
  room("104-1F02", "104-1F02", "铸造", "1F", "processing", [[865, 315], [1000, 315], [1000, 450], [865, 450]], "door-104-1F02", "铸造训练空间。", ["铸造"]),
  room("104-1F03", "104-1F03", "普铣", "1F", "processing", [[1000, 315], [1135, 315], [1135, 450], [1000, 450]], "door-104-1F03", "普通铣削训练空间。", ["普铣"]),
  room("102-1", "102-1", "焊接", "1F", "processing", [[780, 450], [890, 450], [890, 540], [780, 540]], "door-102-1", "焊接训练工位。", ["焊接"]),
  room("102-2", "102-2", "普车", "1F", "processing", [[890, 450], [1000, 450], [1000, 540], [890, 540]], "door-102-2", "普通车削训练工位。", ["普车"]),
  room("102-3", "102-3", "热处理", "1F", "processing", [[1000, 450], [1115, 450], [1115, 540], [1000, 540]], "door-102-3", "热处理训练工位。", ["热处理"]),
  room("101", "101", "CAD/CAM 云设计中心", "1F", "service", [[780, 585], [960, 585], [960, 690], [780, 690]], "door-101", "CAD/CAM 设计、云端建模与基础数字化训练空间。", ["CAD/CAM"]),
  room("ibe", "IBE", "IBE 服务中心", "1F", "service", [[730, 540], [780, 540], [780, 690], [730, 690]], "door-ibe", "工程训练服务空间。", ["服务"]),
  room("106", "106", "智能制造创新创业实验室", "1F", "lab", [[690, 190], [1090, 190], [1090, 315], [690, 315]], "door-106", "智能制造创新创业实验室主空间。", ["智能制造"]),

  room("209", "209", "智能产线", "2F", "lab", [[90, 70], [230, 70], [230, 150], [90, 150]], "door-209", "智能产线训练空间。", ["智能产线"]),
  room("208", "208", "多媒体教室", "2F", "teaching", [[90, 150], [230, 150], [230, 265], [90, 265]], "door-208", "二层多媒体教室。", ["多媒体"]),
  room("108-2F04", "108-2F04", "钳工", "2F", "processing", [[230, 15], [360, 15], [360, 150], [230, 150]], "door-108-2F04", "钳工训练空间。", ["钳工", "独立二层"], "108-lobby"),
  room("108-2F05", "108-2F05", "陶艺", "2F", "processing", [[360, 15], [470, 15], [470, 80], [360, 80]], "door-108-2F05", "陶艺训练空间。", ["陶艺", "独立二层"], "108-lobby"),
  room("108-2F06", "108-2F06", "工程场景数字化", "2F", "lab", [[360, 80], [470, 80], [470, 150], [360, 150]], "door-108-2F06", "工程场景数字化训练空间。", ["数字化", "独立二层"], "108-lobby"),
  room("108-2F07", "108-2F07", "机电", "2F", "processing", [[470, 80], [635, 80], [635, 150], [470, 150]], "door-108-2F07", "机电综合训练空间。", ["机电", "独立二层"], "108-lobby"),
  room("108-2F01", "108-2F01", "考拉工作室", "2F", "office", [[350, 255], [520, 255], [520, 345], [350, 345]], "door-108-2F01", "108 二层考拉工作室，只能由 108 内部楼梯到达。", ["工作室", "独立二层"], "108-lobby"),
  room("108-2F03", "108-2F03", "多媒体教室", "2F", "teaching", [[230, 255], [350, 255], [350, 345], [230, 345]], "door-108-2F03", "多媒体教学空间。", ["多媒体", "独立二层"], "108-lobby"),

  room("202-9", "202-9", "开放打印", "2F", "lab", [[635, 95], [735, 95], [735, 150], [635, 150]], "door-202-9", "开放打印空间。", ["开放打印"]),
  room("202-1", "202-1", "开放打印", "2F", "lab", [[635, 150], [690, 150], [690, 205], [635, 205]], "door-202-1", "202 开放打印小间。", ["3D打印"]),
  room("202-2", "202-2", "实验室", "2F", "lab", [[690, 150], [745, 150], [745, 205], [690, 205]], "door-202-2", "202 实验空间。", ["实验"]),
  room("202-3", "202-3", "实验室", "2F", "lab", [[745, 150], [800, 150], [800, 205], [745, 205]], "door-202-3", "202 实验空间。", ["实验"]),
  room("202-4", "202-4", "实验室", "2F", "lab", [[800, 150], [855, 150], [855, 205], [800, 205]], "door-202-4", "202 实验空间。", ["实验"]),
  room("202-10", "202-10", "实验室", "2F", "lab", [[855, 150], [910, 150], [910, 205], [855, 205]], "door-202-10", "202 实验空间。", ["实验"]),
  room("202-11", "202-11", "实验室", "2F", "lab", [[910, 150], [970, 150], [970, 205], [910, 205]], "door-202-11", "202 实验空间。", ["实验"]),
  room("202-12", "202-12", "实验室", "2F", "lab", [[970, 150], [1050, 150], [1050, 205], [970, 205]], "door-202-12", "202 实验空间。", ["实验"]),
  room("202-5", "202-5", "3D 打印", "2F", "lab", [[635, 255], [800, 255], [800, 345], [635, 345]], "door-202-5", "3D 打印与逆向实训室。", ["3D打印", "逆向扫描"]),
  room("202-6", "202-6", "实验室", "2F", "lab", [[800, 255], [860, 255], [860, 345], [800, 345]], "door-202-6", "202 实验空间。", ["实验"]),
  room("202-7", "202-7", "实验室", "2F", "lab", [[860, 255], [920, 255], [920, 345], [860, 345]], "door-202-7", "202 实验空间。", ["实验"]),
  room("201", "201", "教室", "2F", "teaching", [[920, 205], [1050, 205], [1050, 255], [920, 255]], "door-201", "二层教室。", ["教学"]),

  room("204", "204", "办公室", "2F", "office", [[235, 625], [290, 625], [290, 705], [235, 705]], "door-204", "二层办公室。", ["办公"]),
  room("205", "205", "办公室", "2F", "office", [[290, 625], [345, 625], [345, 705], [290, 705]], "door-205", "二层办公室。", ["办公"]),
  room("206", "206", "办公室", "2F", "office", [[345, 625], [400, 625], [400, 705], [345, 705]], "door-206", "二层办公室。", ["办公"]),
  room("207", "207", "办公室", "2F", "office", [[400, 625], [455, 625], [455, 705], [400, 705]], "door-207", "二层办公室。", ["办公"]),
  room("210", "210", "会议室", "2F", "office", [[455, 625], [520, 625], [520, 705], [455, 705]], "door-210", "二层会议室。", ["会议"]),
  room("104-2F01", "104-2F01", "精密测量", "2F", "lab", [[1050, 160], [1180, 160], [1180, 280], [1050, 280]], "door-104-2F01", "104 二层独立精密测量空间，只能从 104 一层内部楼梯到达。", ["精密测量", "独立二层"], "104-1F01"),
  room("106-2F", "106-2F", "106 二层平台", "2F", "lab", [[760, 15], [930, 15], [930, 95], [760, 95]], "door-106-2F", "106 内部独立二层平台，只能经 106 内部楼梯到达。", ["独立二层"], "106"),
];

const stairPolygon = (x: number, y: number, width: number, height: number): Point[] => [
  [x, y],
  [x + width, y],
  [x + width, y + height],
  [x, y + height],
];

const stairs: StairGeometry[] = [
  {
    id: "stair-public",
    label: "公共楼梯",
    access: "public",
    lowerFloor: "1F",
    upperFloor: "2F",
    lowerLanding: stairPolygon(690, 500, 40, 40),
    upperLanding: stairPolygon(520, 205, 55, 50),
    lowerNodeId: "stair-public-1f",
    upperNodeId: "stair-public-2f",
  },
  {
    id: "stair-104",
    label: "104 内部楼梯",
    access: "internal",
    ownerRoomId: "104-1F01",
    lowerFloor: "1F",
    upperFloor: "2F",
    lowerLanding: stairPolygon(730, 315, 42, 55),
    upperLanding: stairPolygon(1050, 220, 42, 55),
    lowerNodeId: "stair-104-1f",
    upperNodeId: "stair-104-2f",
  },
  {
    id: "stair-106",
    label: "106 内部楼梯",
    access: "internal",
    ownerRoomId: "106",
    lowerFloor: "1F",
    upperFloor: "2F",
    lowerLanding: stairPolygon(1015, 260, 48, 45),
    upperLanding: stairPolygon(880, 50, 45, 45),
    lowerNodeId: "stair-106-1f",
    upperNodeId: "stair-106-2f",
  },
  {
    id: "stair-108",
    label: "108 内部楼梯",
    access: "internal",
    ownerRoomId: "108-lobby",
    lowerFloor: "1F",
    upperFloor: "2F",
    lowerLanding: stairPolygon(455, 500, 52, 40),
    upperLanding: stairPolygon(470, 205, 50, 50),
    lowerNodeId: "stair-108-1f",
    upperNodeId: "stair-108-2f",
  },
];

const nodes: NavNode[] = [
  node("c1-main-west", "1F", [115, 615], "corridor", "一层西侧走廊转折点"),
  node("c1-108", "1F", [470, 595], "corridor", "108 门厅外走廊"),
  node("c1-107", "1F", [650, 595], "corridor", "107 前走廊转折点"),
  node("c1-104", "1F", [740, 450], "corridor", "104 前走廊转折点"),
  node("c1-east", "1F", [1015, 500], "corridor", "东侧走廊转折点"),
  node("c1-101", "1F", [835, 615], "corridor", "101 门外走廊"),
  node("stair-public-1f", "1F", [710, 520], "stair", "公共楼梯一层"),
  node("stair-104-1f", "1F", [750, 342], "stair", "104 内部楼梯一层"),
  node("stair-106-1f", "1F", [1040, 282], "stair", "106 内部楼梯一层"),
  node("stair-108-1f", "1F", [482, 520], "stair", "108 内部楼梯一层"),
  node("c2-108", "2F", [350, 235], "corridor", "108 二层走廊转折点"),
  node("c2-main", "2F", [575, 230], "corridor", "二层公共走廊转折点"),
  node("c2-202", "2F", [780, 230], "corridor", "202 二层半过道"),
  node("c2-west", "2F", [160, 235], "corridor", "二层西侧走廊转折点"),
  node("c2-office", "2F", [380, 665], "corridor", "二层办公走廊"),
  node("stair-public-2f", "2F", [548, 232], "stair", "公共楼梯二层"),
  node("stair-104-2f", "2F", [1070, 250], "stair", "104 内部楼梯二层"),
  node("stair-106-2f", "2F", [902, 72], "stair", "106 内部楼梯二层"),
  node("stair-108-2f", "2F", [495, 230], "stair", "108 内部楼梯二层"),
];

const edges: NavEdge[] = [
  edge("c1-main-west", "c1-108"),
  edge("c1-108", "c1-107"),
  edge("c1-107", "c1-101"),
  edge("c1-107", "stair-public-1f"),
  edge("stair-public-1f", "stair-public-2f", "stair", "通过公共楼梯到达二层公共走廊", 24),
  edge("stair-public-2f", "c2-main"),
  edge("c2-main", "c2-202", "corridor", "沿蓝色高亮过道进入 202 二层半平台"),
  edge("c2-main", "c2-108"),
  edge("c2-108", "c2-west"),
  edge("c2-108", "stair-108-2f"),
  edge("c2-108", "c2-office"),
  edge("c1-107", "c1-104"),
  edge("c1-104", "c1-east"),
  edge("c1-east", "c1-101"),
  edge("c1-104", "stair-104-1f", "door", "进入 104 一层内部楼梯区域"),
  edge("stair-104-1f", "stair-104-2f", "internal-stair", "104 二层只能通过 104 内部楼梯到达", 18),
  edge("c1-east", "stair-106-1f", "door", "进入 106 内部楼梯区域"),
  edge("stair-106-1f", "stair-106-2f", "internal-stair", "106 二层只能通过 106 内部楼梯到达", 18),
  edge("c1-108", "stair-108-1f", "door", "进入 108 内部楼梯区域"),
  edge("stair-108-1f", "stair-108-2f", "internal-stair", "108 二层只能通过 108 内部楼梯到达", 20),
];

const walls: WallSegment[] = [
  ...wallFromPolygon("1F", "outer-1f", floor1Outline, "outer"),
  ...wallFromPolygon("2F", "outer-2f", floor2Outline, "outer"),
  ...rooms.flatMap((target) => wallFromPolygon(target.floor, `wall-${target.id}`, target.polygon, "inner")),
  ...stairs.flatMap((stair) => [
    ...wallFromPolygon(stair.lowerFloor, `wall-${stair.id}-lower`, stair.lowerLanding, stair.access === "internal" ? "low" : "inner"),
    ...wallFromPolygon(stair.upperFloor, `wall-${stair.id}-upper`, stair.upperLanding, stair.access === "internal" ? "low" : "inner"),
  ]),
];

const serviceSpaces: MapSpace[] = [
  space(
    "restroom-1f-east",
    "一层卫生间",
    "1F",
    "restroom",
    [
      [1035, 540],
      [1115, 540],
      [1115, 585],
      [1035, 585],
    ],
    "一层东侧公共卫生间，作为地图服务空间显示，默认不作为语音导航目的地。",
    "inferred",
    false,
    20,
  ),
  space(
    "service-1f-ibe-corner",
    "工程服务角",
    "1F",
    "service",
    [
      [650, 615],
      [730, 615],
      [730, 690],
      [650, 690],
    ],
    "一层工程训练服务与等候区域，按服务空间弱标注。",
    "reference",
    true,
    28,
  ),
  space(
    "storage-1f-west",
    "西侧仓储",
    "1F",
    "storage",
    [
      [130, 535],
      [160, 535],
      [160, 595],
      [130, 595],
    ],
    "西侧未开放小仓储/预留空间，保留物理占位。",
    "inferred",
    false,
    12,
  ),
  space(
    "reserved-2f-west",
    "二层预留",
    "2F",
    "reserved",
    [
      [90, 265],
      [230, 265],
      [230, 345],
      [90, 345],
    ],
    "二层西侧预留区域，按低优先级空间标注。",
    "inferred",
    false,
    14,
  ),
  space(
    "restroom-2f-east",
    "二层卫生间",
    "2F",
    "restroom",
    [
      [970, 205],
      [1050, 205],
      [1050, 255],
      [970, 255],
    ],
    "二层东侧卫生间/服务空间占位，后续用 CAD/SKP 校准。",
    "inferred",
    false,
    18,
  ),
];

const spaces: MapSpace[] = [
  ...floors.flatMap((floor) =>
    floor.corridorPolygons.map((polygon, index) => {
      const isRaised202Corridor = floor.id === "2F" && centroid(polygon)[0] >= 620 && centroid(polygon)[1] >= 205 && centroid(polygon)[1] <= 255;
      return space(
        `${floor.id.toLowerCase()}-corridor-${index}`,
        isRaised202Corridor ? "202 二层半过道" : `${floor.label}过道 ${index + 1}`,
        floor.id,
        "corridor",
        polygon,
        isRaised202Corridor
          ? "202 二层半平台内部过道；从二层公共走廊进入后再到各 202 房间门口。"
          : "公共走廊面，路线只沿中心线或门到中心线的短连接通行。",
        "reference",
        true,
        isRaised202Corridor ? 58 : 42,
      );
    }),
  ),
  ...stairs.flatMap((stair) => [
    space(`${stair.id}-lower-space`, `${stair.label}下口`, stair.lowerFloor, "stair", stair.lowerLanding, "楼梯 landing，与对应楼层走廊或内部房间相接。", "reference", true, 46),
    space(`${stair.id}-upper-space`, `${stair.label}上口`, stair.upperFloor, "stair", stair.upperLanding, "楼梯 landing，与对应楼层走廊或内部房间相接。", "reference", true, 46),
  ]),
  ...rooms.map((target) =>
    space(`space-${target.id}`, `${target.roomNo} ${target.name}`, target.floor, "room", target.polygon, target.description, "reference", true, 30),
  ),
  ...serviceSpaces,
];

const nearestConnectorForRoom = (target: MapRoom): string => {
  if (target.id === "104-2F01") return "stair-104-2f";
  if (target.id === "106-2F") return "stair-106-2f";
  if (target.id.startsWith("108-2F")) return "stair-108-2f";
  if (target.floor === "2F" && target.id.startsWith("202")) return "c2-202";
  if (target.floor === "2F" && ["204", "205", "206", "207", "210"].includes(target.id)) return "c2-office";
  if (target.floor === "2F" && ["208", "209"].includes(target.id)) return "c2-west";
  if (target.floor === "2F" && target.id === "201") return "c2-202";
  if (target.id.startsWith("104-1F") || target.id.startsWith("102")) return "c1-104";
  if (target.id === "106") return "c1-east";
  if (target.id.startsWith("107")) return "c1-107";
  if (target.id.startsWith("108")) return "c1-108";
  if (["110", "111", "112", "113", "114", "109"].includes(target.id)) return "c1-main-west";
  if (target.id === "101" || target.id === "ibe") return "c1-101";
  return "c1-107";
};

const roomDoorPoint = (target: MapRoom): Point => {
  const connector = nodes.find((candidate) => candidate.id === nearestConnectorForRoom(target));
  if (!connector) return target.center;
  const bounds = target.rect;
  const x = Math.max(bounds.x + 8, Math.min(bounds.x + bounds.width - 8, connector.point[0]));
  const y = Math.max(bounds.y + 8, Math.min(bounds.y + bounds.height - 8, connector.point[1]));
  return [x, y];
};

const doorLineForRoom = (target: MapRoom, point: Point): { from: Point; to: Point; normal: Point; width: number } => {
  const bounds = target.rect;
  const width = Math.min(26, Math.max(14, Math.min(bounds.width, bounds.height) * 0.34));
  const edgeDistances = [
    { side: "left", distance: Math.abs(point[0] - bounds.x) },
    { side: "right", distance: Math.abs(point[0] - (bounds.x + bounds.width)) },
    { side: "top", distance: Math.abs(point[1] - bounds.y) },
    { side: "bottom", distance: Math.abs(point[1] - (bounds.y + bounds.height)) },
  ].sort((a, b) => a.distance - b.distance);
  const side = edgeDistances[0].side;
  if (side === "left" || side === "right") {
    const half = width / 2;
    const y = Math.max(bounds.y + half, Math.min(bounds.y + bounds.height - half, point[1]));
    const x = side === "left" ? bounds.x : bounds.x + bounds.width;
    return {
      from: [x, y - half],
      to: [x, y + half],
      normal: side === "left" ? [-1, 0] : [1, 0],
      width,
    };
  }
  const half = width / 2;
  const x = Math.max(bounds.x + half, Math.min(bounds.x + bounds.width - half, point[0]));
  const y = side === "top" ? bounds.y : bounds.y + bounds.height;
  return {
    from: [x - half, y],
    to: [x + half, y],
    normal: side === "top" ? [0, -1] : [0, 1],
    width,
  };
};

const midpoint = (from: Point, to: Point): Point => [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];

const doorGeometryForRoom = (target: MapRoom) => {
  const connectorPoint = roomDoorPoint(target);
  const line = doorLineForRoom(target, connectorPoint);
  return {
    ...line,
    point: midpoint(line.from, line.to),
  };
};

const doorSourceForRoom = (target: MapRoom): GeometrySource => {
  if (target.id === "101" || target.id === "104-1F01" || target.id === "106" || target.id === "108-lobby" || target.id.startsWith("202")) {
    return "reference";
  }
  if (target.id === "104-2F01" || target.id === "106-2F" || target.id.startsWith("108-2F")) return "cad";
  return "inferred";
};

const roomDoorNodes: NavNode[] = rooms.map((target) => node(target.doorNodeId, target.floor, doorGeometryForRoom(target).point, "door", target.name));

const roomCenterNodes: NavNode[] = rooms.map((target) => node(`center-${target.id}`, target.floor, target.center, "room-center", target.name));

const spaceCenterNodes: NavNode[] = serviceSpaces.map((target) => node(`center-${target.id}`, target.floor, target.center, "space-center", target.label));

const doors: DoorSegment[] = rooms.map((target) => {
  const line = doorGeometryForRoom(target);
  const connector = nearestConnectorForRoom(target);
  return {
    id: `door-shape-${target.id}`,
    floor: target.floor,
    point: line.point,
    from: line.from,
    to: line.to,
    width: line.width,
    normal: line.normal,
    connects: [target.id, connector],
    source: doorSourceForRoom(target),
    wallId: `wall-${target.id}`,
    nodeId: target.doorNodeId,
    label: `${target.roomNo} 门`,
  };
});

const roomDoorEdges = rooms.map((target) => edge(target.doorNodeId, nearestConnectorForRoom(target), "door", `从 ${target.roomNo} 门进入公共通行线`));

const roomEntryEdges = rooms.map((target) => edge(`center-${target.id}`, target.doorNodeId, "room-entry", `从 ${target.roomNo} 中心移动到门口`));

const serviceSpaceEdges = serviceSpaces
  .filter((target) => target.navigable)
  .map((target) => edge(`center-${target.id}`, target.floor === "2F" ? "c2-202" : "c1-101", "door", `进入 ${target.label}`));

const centerlines: CenterlineSegment[] = edges
  .filter((target) => target.kind === "corridor" || target.kind === "door")
  .map((target, index) => ({
    id: `centerline-${index + 1}`,
    floor: nodes.find((candidate) => candidate.id === target.from)?.floor ?? "1F",
    from: target.from,
    to: target.to,
    kind: target.kind === "door" ? "stair-approach" : "corridor",
    source: "reference",
  }));

const calibrationPoint = (
  id: string,
  label: string,
  floor: FloorId,
  mapPoint: Point,
  role: ModelCalibration["controlPoints"][number]["role"],
  source: GeometrySource,
): ModelCalibration["controlPoints"][number] => ({
  id,
  label,
  floor,
  mapPoint,
  modelPoint: [
    (mapPoint[0] - 620) * 0.00815,
    floor === "2F" ? 0.92 : 0.08,
    (mapPoint[1] - 360) * 0.00815,
  ],
  role,
  source,
  tolerance: source === "model" ? 0.18 : source === "cad" ? 0.26 : 0.38,
});

const calibration: ModelCalibration = {
  sourcePriority: ["model", "cad", "reference", "inferred"],
  controlPoints: [
    calibrationPoint("1f-outline-west-south", "一层西南外轮廓", "1F", [70, 690], "outline", "cad"),
    calibrationPoint("1f-outline-east-south", "一层东南外轮廓", "1F", [960, 690], "outline", "cad"),
    calibrationPoint("1f-outline-east", "一层东侧外轮廓", "1F", [1135, 450], "outline", "cad"),
    calibrationPoint("1f-outline-north", "一层北侧外轮廓", "1F", [690, 190], "outline", "cad"),
    calibrationPoint("1f-public-stair", "公共楼梯一层口", "1F", [710, 520], "stair", "reference"),
    calibrationPoint("1f-104-door", "104 一层门洞", "1F", [740, 450], "door", "reference"),
    calibrationPoint("1f-106-stair", "106 内梯一层", "1F", [1040, 282], "stair", "reference"),
    calibrationPoint("1f-108-stair", "108 内梯一层", "1F", [482, 520], "stair", "reference"),
    calibrationPoint("2f-outline-west-north", "二层西北外轮廓", "2F", [90, 70], "outline", "cad"),
    calibrationPoint("2f-outline-east", "二层东侧外轮廓", "2F", [1050, 245], "outline", "cad"),
    calibrationPoint("2f-public-stair", "公共楼梯二层口", "2F", [548, 232], "stair", "reference"),
    calibrationPoint("2f-202-platform", "202 二层半平台中心", "2F", [820, 228], "platform", "reference"),
    calibrationPoint("2f-104-stair", "104 内梯二层", "2F", [1070, 250], "stair", "reference"),
    calibrationPoint("2f-106-stair", "106 内梯二层", "2F", [902, 72], "stair", "reference"),
    calibrationPoint("2f-108-stair", "108 内梯二层", "2F", [495, 230], "stair", "reference"),
    calibrationPoint("2f-202-door", "202-5 门洞", "2F", [780, 255], "door", "reference"),
  ],
  maxError: 0.24,
  averageError: 0.09,
  modelScale: 0.00815,
  mapCenter: [620, 360],
  rotationRadians: 0,
  floorHeight: 0.92,
  runtimeFit: {
    rawBBoxMin: [-16630.345892815385, -14096.999788284247, -790843.3252320997],
    rawBBoxMax: [777437.8305115551, 47373.05497700465, 17519.504009344382],
    rawBBoxCenter: [380403.74230936985, 16638.027594360203, -386661.9106113777],
    rawBBoxSize: [794068.1764043705, 61470.05476528889, 808362.8292414441],
    centeredScale: 8.6 / 808362.8292414441,
  },
  note:
    "首轮校准将 3DS/GLB bbox fit、CAD/示意图控制点和语义拓扑放入同一门禁；source=inferred 的门洞必须在后续 CAD/SKP 复核中逐步替换。",
};

const mapData: MapData = {
  scaleMetersPerUnit: 0.08,
  defaultStartRoomId: "101",
  floors,
  rooms,
  spaces,
  walls,
  doors,
  stairs,
  centerlines,
  calibration,
  nodes: [...nodes, ...roomDoorNodes, ...roomCenterNodes, ...spaceCenterNodes],
  edges: [...edges, ...roomDoorEdges, ...roomEntryEdges, ...serviceSpaceEdges],
};

export const jingongMapData = mapData;
