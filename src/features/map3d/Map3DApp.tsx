import {
  ArrowLeft,
  Box,
  Bug,
  Compass,
  Crosshair,
  Layers,
  Map as MapIcon,
  Maximize2,
  Navigation,
  Route,
  ScanLine,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MapDirectRequest } from "../../shared/appTypes";
import { areaLabels, jingongMapData } from "../map/data/mapData";
import { calculateRoute, formatSeconds, getRoomById } from "../map/routeService";
import type { AreaType, FloorId, MapRoom, MapSessionState, Point, RouteResult, StairGeometry } from "../map/types";
import { floorBaseY, mapPointToModel, modelAlignment } from "./modelAlignment";

type Props = {
  initialRequest?: MapDirectRequest;
  entrySource: "manual" | "backend";
  onExit?: () => void;
  onOpenLegacy?: () => void;
};

type PanelId = "none" | "route" | "layers" | "view" | "room" | "debug";
type CameraMode = "perspective" | "orthographic";
type LoadState = "loading" | "ready" | "fallback" | "error";
type CameraPreset = "overview" | "lowIso" | "top" | "route";
type LabelAnchor = {
  roomId: string;
  text: string;
  floor: FloorId;
  priority: number;
  active: boolean;
  start: boolean;
  target: boolean;
  position: THREE.Vector3;
};
type LabelLayout = LabelAnchor & {
  x: number;
  y: number;
  visible: boolean;
};

const DEFAULT_LAYER: MapSessionState["layerMode"] = "exploded";
const roomColor: Record<AreaType, number> = {
  teaching: 0x7fc76f,
  processing: 0xff9b59,
  lab: 0xb98be6,
  office: 0xffc857,
  service: 0x74a7f2,
  other: 0xd7dde7,
};
const roomCssClass: Record<AreaType, string> = {
  teaching: "teaching",
  processing: "processing",
  lab: "lab",
  office: "office",
  service: "service",
  other: "other",
};

const defaultSession = (entrySource: "manual" | "backend", request?: MapDirectRequest): MapSessionState => ({
  entrySource,
  selectedRoomId: request?.targetRoomId,
  startRoomId: request?.startRoomId,
  targetRoomId: request?.targetRoomId,
  viewMode: "2_5d",
  layerMode: DEFAULT_LAYER,
  activeFloor: undefined,
  announce: request?.announce ?? [],
});

const floorLabel: Record<FloorId, string> = {
  "1F": "一层",
  "2F": "二层",
};

const compactRoomName = (room: MapRoom): string => {
  const name = room.name
    .replace("智能制造创新创业实验室", "智能制造")
    .replace("CAD/CAM 云设计中心", "CAD/CAM")
    .replace("数字化制造中心", "数字化中心")
    .replace("WEDM 编程设计", "WEDM");
  return `${room.roomNo} ${name}`;
};

const visibleRoomsForSession = (session: MapSessionState): MapRoom[] =>
  jingongMapData.rooms.filter((room) => {
    if (session.layerMode === "single" && session.activeFloor) return room.floor === session.activeFloor;
    return true;
  });

const overviewLabelRoomIds = new Set([
  "101",
  "104-1F01",
  "106",
  "107-core",
  "108-lobby",
  "202-5",
  "208",
  "210",
]);

function shouldShowRoomLabel(room: MapRoom, session: MapSessionState, startRoomId?: string) {
  if (room.id === session.selectedRoomId || room.id === session.targetRoomId || room.id === startRoomId) return true;
  if (session.layerMode === "single" || session.layerMode === "section") return true;
  return overviewLabelRoomIds.has(room.id);
}

function createCamera(mode: CameraMode, width: number, height: number): THREE.PerspectiveCamera | THREE.OrthographicCamera {
  const aspect = Math.max(0.1, width / Math.max(1, height));
  if (mode === "orthographic") {
    const frustum = 10.8;
    const camera = new THREE.OrthographicCamera(
      (-frustum * aspect) / 2,
      (frustum * aspect) / 2,
      frustum / 2,
      -frustum / 2,
      0.05,
      200,
    );
    camera.position.set(8.4, 7.2, 9.2);
    return camera;
  }

  const camera = new THREE.PerspectiveCamera(modelAlignment.defaultCamera.fov, aspect, 0.05, 220);
  camera.position.fromArray(modelAlignment.defaultCamera.position);
  return camera;
}

function shapeFromPolygon(polygon: Point[], floor: FloorId, session: MapSessionState) {
  const first = mapPointToModel(polygon[0], floor, { layerMode: session.layerMode, activeFloor: session.activeFloor });
  const shape = new THREE.Shape();
  shape.moveTo(first[0], first[2]);
  polygon.slice(1).forEach((point) => {
    const [x, , z] = mapPointToModel(point, floor, { layerMode: session.layerMode, activeFloor: session.activeFloor });
    shape.lineTo(x, z);
  });
  shape.closePath();
  return shape;
}

function extrudedPolygonMesh(
  polygon: Point[],
  floor: FloorId,
  session: MapSessionState,
  height: number,
  material: THREE.Material,
) {
  const shape = shapeFromPolygon(polygon, floor, session);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = floorBaseY(floor, { layerMode: session.layerMode, activeFloor: session.activeFloor });
  return mesh;
}

function floorVisibility(roomFloor: FloorId, session: MapSessionState) {
  return !(session.layerMode === "single" && session.activeFloor && roomFloor !== session.activeFloor);
}

function stairCenter(polygon: Point[]): Point {
  const total = polygon.reduce<Point>((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  return [total[0] / polygon.length, total[1] / polygon.length];
}

function stairIsOnRoute(stair: StairGeometry, route?: RouteResult) {
  if (!route) return false;
  return route.steps.some(
    (step) =>
      step.kind.includes("stair") &&
      ((step.fromNodeId === stair.lowerNodeId && step.toNodeId === stair.upperNodeId) ||
        (step.fromNodeId === stair.upperNodeId && step.toNodeId === stair.lowerNodeId)),
  );
}

function tubeBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material) {
  const curve = new THREE.LineCurve3(a, b);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius, 8, false), material);
}

function routePointToVector(point: { floor: FloorId; point: Point; kind: string }, session: MapSessionState) {
  const [x, y, z] = mapPointToModel(point.point, point.floor, {
    layerMode: session.layerMode,
    activeFloor: session.activeFloor,
    lift: modelAlignment.routeLift,
  });
  return new THREE.Vector3(x, y, z);
}

function updateCameraSize(camera: THREE.Camera, width: number, height: number) {
  const aspect = Math.max(0.1, width / Math.max(1, height));
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    return;
  }

  if (camera instanceof THREE.OrthographicCamera) {
    const frustum = 10.8;
    camera.left = (-frustum * aspect) / 2;
    camera.right = (frustum * aspect) / 2;
    camera.top = frustum / 2;
    camera.bottom = -frustum / 2;
    camera.updateProjectionMatrix();
  }
}

function materialList(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (material) {
      materialList(material).forEach((item) => {
        const maybeMap = item as THREE.Material & { map?: THREE.Texture };
        maybeMap.map?.dispose();
        item.dispose();
      });
    }
  });
}

export function Map3DApp({ initialRequest, entrySource, onExit, onOpenLegacy }: Props) {
  const [session, setSession] = useState<MapSessionState>(() => defaultSession(entrySource, initialRequest));
  const [panel, setPanel] = useState<PanelId>("none");
  const [routePage, setRoutePage] = useState<"setup" | "details">("setup");
  const [cameraMode, setCameraMode] = useState<CameraMode>("perspective");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [statusText, setStatusText] = useState("正在加载 3D 精确模型");
  const [labelLayout, setLabelLayout] = useState<LabelLayout[]>([]);
  const [activeCameraPreset, setActiveCameraPreset] = useState<CameraPreset>("overview");

  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRootRef = useRef<THREE.Object3D | null>(null);
  const semanticModelRootRef = useRef<THREE.Group | null>(null);
  const semanticRootRef = useRef<THREE.Group | null>(null);
  const routeRootRef = useRef<THREE.Group | null>(null);
  const interactiveObjectsRef = useRef<THREE.Object3D[]>([]);
  const labelAnchorsRef = useRef<LabelAnchor[]>([]);
  const labelSignatureRef = useRef("");
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setSession(defaultSession(entrySource, initialRequest));
    setPanel("none");
    setRoutePage("setup");
  }, [entrySource, initialRequest]);

  const startRoomId = session.startRoomId ?? (session.targetRoomId ? jingongMapData.defaultStartRoomId : undefined);
  const route = useMemo<RouteResult | undefined>(() => {
    if (!startRoomId || !session.targetRoomId) return undefined;
    return calculateRoute(jingongMapData, startRoomId, session.targetRoomId);
  }, [session.targetRoomId, startRoomId]);

  const selectedRoom = getRoomById(jingongMapData, session.selectedRoomId);
  const targetRoom = getRoomById(jingongMapData, session.targetRoomId);
  const startRoom = getRoomById(jingongMapData, startRoomId);
  const visibleRooms = useMemo(() => visibleRoomsForSession(session), [session]);

  const applyCameraPreset = useCallback((preset: CameraPreset, syncState = true) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const presets: Record<CameraPreset, { position: THREE.Vector3; target: THREE.Vector3; zoom?: number; fov?: number }> = {
      overview: {
        position: new THREE.Vector3(...modelAlignment.defaultCamera.position),
        target: new THREE.Vector3(...modelAlignment.defaultCamera.target),
        fov: modelAlignment.defaultCamera.fov,
        zoom: 0.9,
      },
      lowIso: {
        position: new THREE.Vector3(6.8, 2.65, 7.6),
        target: new THREE.Vector3(0.04, 0.64, 0.06),
        fov: 33,
        zoom: 1,
      },
      top: {
        position: new THREE.Vector3(0.1, 9.2, 0.1),
        target: new THREE.Vector3(0, 0, 0),
        fov: 32,
        zoom: 0.76,
      },
      route: {
        position: new THREE.Vector3(4.2, 3.55, 5.3),
        target: new THREE.Vector3(0.24, 0.7, 0.2),
        fov: 31,
        zoom: 1.08,
      },
    };
    const next = presets[preset];
    if (camera instanceof THREE.OrthographicCamera) {
      camera.position.copy(next.position);
      camera.zoom = next.zoom ?? 0.92;
      camera.updateProjectionMatrix();
    } else if (camera instanceof THREE.PerspectiveCamera) {
      camera.position.copy(next.position);
      camera.fov = next.fov ?? modelAlignment.defaultCamera.fov;
      camera.updateProjectionMatrix();
    }
    controls.target.copy(next.target);
    controls.update();
    if (syncState) setActiveCameraPreset(preset);
  }, []);

  const fitCamera = useCallback(() => {
    applyCameraPreset("overview");
  }, [applyCameraPreset]);

  const updateLabels = useCallback(() => {
    const host = hostRef.current;
    const camera = cameraRef.current;
    if (!host || !camera) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    const projected = labelAnchorsRef.current
      .map((anchor) => {
        const vector = anchor.position.clone().project(camera);
        return {
          ...anchor,
          x: (vector.x * 0.5 + 0.5) * width,
          y: (-vector.y * 0.5 + 0.5) * height,
          visible: vector.z > -1 && vector.z < 1,
        };
      })
      .sort((a, b) => b.priority - a.priority);

    const occupied: Array<{ x: number; y: number; width: number; height: number }> = [];
    const laidOut = projected.map((label) => {
      const widthHint = label.active || label.target || label.start ? 128 : 92;
      const heightHint = 30;
      const box = { x: label.x - widthHint / 2, y: label.y - heightHint / 2, width: widthHint, height: heightHint };
      const outside = box.x < 8 || box.y < 8 || box.x + box.width > width - 84 || box.y + box.height > height - 8;
      const collides = occupied.some(
        (item) =>
          box.x < item.x + item.width &&
          box.x + box.width > item.x &&
          box.y < item.y + item.height &&
          box.y + box.height > item.y,
      );
      const visible = label.visible && !outside && (!collides || label.priority >= 90);
      if (visible) occupied.push(box);
      return { ...label, visible };
    });
    const signature = laidOut
      .filter((label) => label.visible)
      .map((label) => `${label.roomId}:${Math.round(label.x)}:${Math.round(label.y)}:${label.active ? 1 : 0}:${label.start ? 1 : 0}:${label.target ? 1 : 0}`)
      .join("|");
    if (signature === labelSignatureRef.current) return;
    labelSignatureRef.current = signature;
    setLabelLayout(laidOut);
  }, []);

  const attachControls = useCallback(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return;
    controlsRef.current?.dispose();
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.rotateSpeed = 0.82;
    controls.zoomSpeed = 0.9;
    controls.panSpeed = 0.72;
    controls.minDistance = 2.2;
    controls.maxDistance = 34;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI * 0.58;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controls.target.fromArray(modelAlignment.defaultCamera.target);
    controls.update();
    controlsRef.current = controls;
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f9fc);
    scene.fog = new THREE.Fog(0xf7f9fc, 19, 48);
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.localClippingEnabled = true;
    host.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = createCamera("perspective", host.clientWidth, host.clientHeight);
    cameraRef.current = camera;
    attachControls();
    fitCamera();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x879ab2, 1.02));
    const sun = new THREE.DirectionalLight(0xffffff, 1.78);
    sun.position.set(4, 9, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9fc8ff, 0.52);
    fill.position.set(-6, 4, -5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.54);
    rim.position.set(-3, 6, 8);
    scene.add(rim);

    const grid = new THREE.GridHelper(12, 12, 0xabc0d7, 0xe0e8f2);
    grid.position.y = -0.03;
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
    scene.add(grid);

    const loader = new GLTFLoader();
    loader.setResourcePath("/map-models/textures/");
    let cancelled = false;

    const loadModel = (url: string, fallback: boolean) => {
      loader.load(
        url,
        (gltf) => {
          if (cancelled) {
            disposeObject(gltf.scene);
            return;
          }
          modelRootRef.current?.removeFromParent();
          if (modelRootRef.current) disposeObject(modelRootRef.current);

          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          const maxAxis = Math.max(size.x, size.y, size.z, 1);
          const scale = 8.6 / maxAxis;

          model.position.sub(center);
          model.scale.setScalar(scale);
          model.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (mesh.material) {
              materialList(mesh.material).forEach((material) => {
                material.side = THREE.DoubleSide;
                material.transparent = true;
                material.opacity = 0.52;
                material.depthWrite = false;
                material.needsUpdate = true;
              });
            }
          });
          model.position.y = -0.015;
          scene.add(model);
          modelRootRef.current = model;
          setLoadState(fallback ? "fallback" : "ready");
          setStatusText(fallback ? "正在显示 STL 备用几何模型" : "3D 精确模型已加载");
          fitCamera();
        },
        undefined,
        () => {
          if (!fallback) {
            setStatusText("3DS 转换模型加载失败，切换 STL 备用模型");
            loadModel("/map-models/jingong-fallback.glb", true);
            return;
          }
          setLoadState("error");
          setStatusText("模型加载失败，保留语义导航叠加层");
        },
      );
    };

    loadModel("/map-models/jingong.glb", false);

    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = Math.max(1, Math.floor(entry.contentRect.width));
      const height = Math.max(1, Math.floor(entry.contentRect.height));
      renderer.setSize(width, height, false);
      if (cameraRef.current) updateCameraSize(cameraRef.current, width, height);
    });
    resizeObserver.observe(host);

    let frame = 0;
    const animate = () => {
      controlsRef.current?.update();
      updateLabels();
      if (cameraRef.current) renderer.render(scene, cameraRef.current);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controlsRef.current?.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      disposeObject(scene);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      modelRootRef.current = null;
      semanticModelRootRef.current = null;
      semanticRootRef.current = null;
      routeRootRef.current = null;
      interactiveObjectsRef.current = [];
      labelAnchorsRef.current = [];
      labelSignatureRef.current = "";
    };
  }, [attachControls, fitCamera, updateLabels]);

  useEffect(() => {
    const host = hostRef.current;
    const oldCamera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!host || !oldCamera || !renderer) return;
    const camera = createCamera(cameraMode, host.clientWidth, host.clientHeight);
    cameraRef.current = camera;
    attachControls();
    applyCameraPreset(activeCameraPreset, false);
  }, [activeCameraPreset, applyCameraPreset, attachControls, cameraMode]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const model = modelRootRef.current;
    if (!renderer || !model) return;

    const faded = session.layerMode === "single" || session.layerMode === "section" || session.layerMode === "exploded";
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      materialList(mesh.material).forEach((material) => {
        material.transparent = true;
        material.opacity = faded ? 0.18 : 0.44;
        material.depthWrite = false;
        material.needsUpdate = true;
      });
    });

    renderer.clippingPlanes =
      session.layerMode === "section"
        ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.74)]
        : [];
  }, [session.layerMode]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (semanticRootRef.current) {
      scene.remove(semanticRootRef.current);
      disposeObject(semanticRootRef.current);
    }
    if (semanticModelRootRef.current) {
      scene.remove(semanticModelRootRef.current);
      disposeObject(semanticModelRootRef.current);
    }

    const building = new THREE.Group();
    building.name = "semantic-building";
    const markers = new THREE.Group();
    markers.name = "semantic-markers";
    const labels: LabelAnchor[] = [];
    const interactive: THREE.Object3D[] = [];
    const activeRoomId = session.selectedRoomId;
    const modelOptions = { layerMode: session.layerMode, activeFloor: session.activeFloor };

    const corridorMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8eef6,
      roughness: 0.78,
      metalness: 0.02,
      transparent: true,
      opacity: 0.92,
    });
    const floorEdgeMaterial = new THREE.LineBasicMaterial({ color: 0xb5c4d6, transparent: true, opacity: 0.86 });
    const outerWallMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4f7fb,
      roughness: 0.82,
      metalness: 0.02,
      transparent: true,
      opacity: 0.96,
    });
    const innerWallMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0,
      transparent: true,
      opacity: 0.72,
    });

    for (const floor of jingongMapData.floors) {
      if (!floorVisibility(floor.id, session)) continue;
      const slab = extrudedPolygonMesh(
        floor.outline,
        floor.id,
        session,
        modelAlignment.slabThickness,
        new THREE.MeshStandardMaterial({
          color: floor.id === "1F" ? 0xf1f5fb : 0xeaf1fa,
          roughness: 0.74,
          metalness: 0.02,
        }),
      );
      slab.name = `${floor.id}-semantic-slab`;
      slab.receiveShadow = true;
      building.add(slab);

      const outlinePoints = [...floor.outline, floor.outline[0]].map((point) => {
        const [x, y, z] = mapPointToModel(point, floor.id, { ...modelOptions, lift: modelAlignment.slabThickness + 0.012 });
        return new THREE.Vector3(x, y, z);
      });
      building.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outlinePoints), floorEdgeMaterial.clone()));

      floor.corridorPolygons.forEach((corridor, index) => {
        const corridorMesh = extrudedPolygonMesh(corridor, floor.id, session, 0.012, corridorMaterial.clone());
        corridorMesh.name = `${floor.id}-corridor-${index}`;
        corridorMesh.position.y += modelAlignment.slabThickness + 0.01;
        building.add(corridorMesh);
      });

      labels.push({
        roomId: `floor-${floor.id}`,
        text: floor.label,
        floor: floor.id,
        priority: 18,
        active: false,
        start: false,
        target: false,
        position: new THREE.Vector3(...mapPointToModel(floor.outline[0], floor.id, { ...modelOptions, lift: 0.42 })),
      });
    }

    for (const room of visibleRooms) {
      const active = room.id === activeRoomId;
      const target = room.id === session.targetRoomId;
      const start = room.id === startRoomId;
      const material = new THREE.MeshStandardMaterial({
        color: active || target ? 0x0b6cff : start ? 0x19a15f : roomColor[room.area],
        roughness: 0.62,
        metalness: 0.02,
        transparent: true,
        opacity: active || target || start ? 0.88 : 0.66,
      });
      const roomMesh = extrudedPolygonMesh(room.polygon, room.floor, session, 0.05, material);
      roomMesh.position.y += modelAlignment.slabThickness + 0.025;
      roomMesh.name = `room-${room.id}`;
      roomMesh.userData.roomId = room.id;
      roomMesh.castShadow = true;
      roomMesh.receiveShadow = true;
      building.add(roomMesh);
      interactive.push(roomMesh);

      const linePoints = [...room.polygon, room.polygon[0]].map((point) => {
        const [x, y, z] = mapPointToModel(point, room.floor, {
          ...modelOptions,
          lift: modelAlignment.slabThickness + 0.088,
        });
        return new THREE.Vector3(x, y, z);
      });
      building.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints), floorEdgeMaterial.clone()));

      const [x, y, z] = mapPointToModel(room.center, room.floor, { ...modelOptions, lift: modelAlignment.hotspotLift + 0.13 });
      const hotspot = new THREE.Mesh(
        new THREE.CylinderGeometry(active || target || start ? 0.12 : 0.075, active || target || start ? 0.12 : 0.075, 0.05, 24),
        new THREE.MeshStandardMaterial({
          color: target ? 0xff3f6c : start ? 0x18a058 : active ? 0x0b6cff : 0xffffff,
          emissive: target ? 0x5a0012 : active ? 0x06236b : 0x000000,
          roughness: 0.42,
          metalness: 0.02,
        }),
      );
      hotspot.position.set(x, y, z);
      hotspot.userData.roomId = room.id;
      hotspot.castShadow = true;
      markers.add(hotspot);
      interactive.push(hotspot);

      if (shouldShowRoomLabel(room, session, startRoomId)) {
        labels.push({
          roomId: room.id,
          text: compactRoomName(room),
          floor: room.floor,
          priority: active || target || start ? 100 : overviewLabelRoomIds.has(room.id) ? 60 : 32,
          active,
          start,
          target,
          position: new THREE.Vector3(x, y + (active || target || start ? 0.24 : 0.16), z),
        });
      }
    }

    for (const wall of jingongMapData.walls) {
      if (!floorVisibility(wall.floor, session)) continue;
      const height = wall.kind === "outer" ? modelAlignment.outerWallHeight : modelAlignment.wallHeight;
      const start = new THREE.Vector3(...mapPointToModel(wall.from, wall.floor, { ...modelOptions, lift: modelAlignment.slabThickness + height / 2 }));
      const end = new THREE.Vector3(...mapPointToModel(wall.to, wall.floor, { ...modelOptions, lift: modelAlignment.slabThickness + height / 2 }));
      const length = start.distanceTo(end);
      if (length < 0.001) continue;
      const geometry = new THREE.BoxGeometry(length, height, wall.kind === "outer" ? 0.032 : 0.018);
      const mesh = new THREE.Mesh(geometry, wall.kind === "outer" ? outerWallMaterial.clone() : innerWallMaterial.clone());
      const midpoint = start.clone().add(end).multiplyScalar(0.5);
      mesh.position.copy(midpoint);
      mesh.rotation.y = -Math.atan2(end.z - start.z, end.x - start.x);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      building.add(mesh);
    }

    const stairMaterial = new THREE.MeshStandardMaterial({
      color: 0xd3994e,
      roughness: 0.58,
      metalness: 0.02,
      transparent: true,
      opacity: 0.94,
    });
    const stairActiveMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b6cff,
      emissive: 0x072766,
      roughness: 0.46,
      metalness: 0.02,
    });
    for (const stair of jingongMapData.stairs) {
      const onRoute = stairIsOnRoute(stair, route);
      const lowerVisible = floorVisibility(stair.lowerFloor, session);
      const upperVisible = floorVisibility(stair.upperFloor, session);
      if (lowerVisible) {
        const lower = extrudedPolygonMesh(stair.lowerLanding, stair.lowerFloor, session, 0.075, (onRoute ? stairActiveMaterial : stairMaterial).clone());
        lower.position.y += modelAlignment.slabThickness + 0.08;
        lower.name = `${stair.id}-lower`;
        building.add(lower);
      }
      if (upperVisible) {
        const upper = extrudedPolygonMesh(stair.upperLanding, stair.upperFloor, session, 0.075, (onRoute ? stairActiveMaterial : stairMaterial).clone());
        upper.position.y += modelAlignment.slabThickness + 0.08;
        upper.name = `${stair.id}-upper`;
        building.add(upper);
      }
      if (lowerVisible && upperVisible && (session.layerMode !== "single" || onRoute)) {
        const lowerPoint = stairCenter(stair.lowerLanding);
        const upperPoint = stairCenter(stair.upperLanding);
        const lowerVector = new THREE.Vector3(...mapPointToModel(lowerPoint, stair.lowerFloor, { ...modelOptions, lift: 0.22 }));
        const upperVector = new THREE.Vector3(...mapPointToModel(upperPoint, stair.upperFloor, { ...modelOptions, lift: 0.22 }));
        const stairLine = tubeBetween(lowerVector, upperVector, onRoute ? 0.042 : 0.025, (onRoute ? stairActiveMaterial : stairMaterial).clone());
        stairLine.name = `${stair.id}-rise`;
        building.add(stairLine);
      }
      const labelPoint = upperVisible ? stairCenter(stair.upperLanding) : stairCenter(stair.lowerLanding);
      labels.push({
        roomId: stair.id,
        text: stair.access === "internal" ? stair.label.replace("内部楼梯", "内梯") : stair.label,
        floor: upperVisible ? stair.upperFloor : stair.lowerFloor,
        priority: onRoute ? 92 : stair.access === "internal" ? 44 : 40,
        active: onRoute,
        start: false,
        target: false,
        position: new THREE.Vector3(
          ...mapPointToModel(labelPoint, upperVisible ? stair.upperFloor : stair.lowerFloor, {
            ...modelOptions,
            lift: onRoute ? 0.72 : 0.52,
          }),
        ),
      });
    }

    semanticModelRootRef.current = building;
    semanticRootRef.current = markers;
    interactiveObjectsRef.current = interactive;
    labelAnchorsRef.current = labels;
    scene.add(building);
    scene.add(markers);
    updateLabels();
  }, [route, session.activeFloor, session.layerMode, session.selectedRoomId, session.targetRoomId, startRoomId, updateLabels, visibleRooms]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (routeRootRef.current) {
      scene.remove(routeRootRef.current);
      disposeObject(routeRootRef.current);
    }

    const root = new THREE.Group();
    root.name = "route-overlay";
    if (route && route.points.length > 1) {
      const points = route.points.map((routePoint) => routePointToVector(routePoint, session));
      const routeMaterial = new THREE.MeshStandardMaterial({
        color: 0x0b6cff,
        emissive: 0x063a9f,
        roughness: 0.35,
        metalness: 0.02,
      });
      const haloMaterial = new THREE.MeshBasicMaterial({ color: 0x9dccff, transparent: true, opacity: 0.36 });
      const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.04);
      const halo = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(10, points.length * 20), 0.082, 12, false),
        haloMaterial,
      );
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(10, points.length * 20), 0.034, 10, false), routeMaterial);
      root.add(halo);
      root.add(tube);
      points.forEach((point, index) => {
        if (index === 0 || index === points.length - 1) return;
        const pulse = new THREE.Mesh(
          new THREE.SphereGeometry(0.065, 18, 12),
          new THREE.MeshStandardMaterial({
            color: route.points[index].kind.includes("stair") ? 0xffb547 : 0xffffff,
            emissive: route.points[index].kind.includes("stair") ? 0x6b3600 : 0x0b6cff,
            roughness: 0.38,
          }),
        );
        pulse.position.copy(point);
        root.add(pulse);
      });

      const start = getRoomById(jingongMapData, route.startRoomId);
      const target = getRoomById(jingongMapData, route.targetRoomId);
      [start, target].forEach((room, index) => {
        if (!room) return;
        const [x, y, z] = mapPointToModel(room.center, room.floor, {
          layerMode: session.layerMode,
          activeFloor: session.activeFloor,
          lift: 0.58,
        });
        const pin = new THREE.Mesh(
          index === 0 ? new THREE.CylinderGeometry(0.13, 0.13, 0.32, 18) : new THREE.ConeGeometry(0.18, 0.46, 24),
          new THREE.MeshStandardMaterial({
            color: index === 0 ? 0x18a058 : 0xff3f6c,
            emissive: index === 0 ? 0x063b1f : 0x5f0018,
            roughness: 0.4,
          }),
        );
        pin.position.set(x, y, z);
        root.add(pin);
      });
    }
    routeRootRef.current = root;
    scene.add(root);
  }, [route, session.activeFloor, session.layerMode]);

  const pickRoom = useCallback((clientX: number, clientY: number) => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return undefined;
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(interactiveObjectsRef.current, true);
    const hit = hits.find((item) => item.object.userData.roomId);
    return hit?.object.userData.roomId as string | undefined;
  }, []);

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleCanvasPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
    const roomId = pickRoom(event.clientX, event.clientY);
    if (!roomId) return;
    setSession((current) => ({ ...current, selectedRoomId: roomId }));
    setPanel("room");
  };

  const updateRouteEndpoint = (key: "startRoomId" | "targetRoomId", roomId: string) => {
    setSession((current) => ({
      ...current,
      [key]: roomId || undefined,
      selectedRoomId: key === "targetRoomId" ? roomId || current.selectedRoomId : current.selectedRoomId,
      routeId: undefined,
    }));
  };

  const setLayer = (layerMode: MapSessionState["layerMode"], activeFloor?: FloorId) => {
    setSession((current) => ({
      ...current,
      layerMode,
      activeFloor,
    }));
  };

  const startNavigationToSelected = () => {
    if (!session.selectedRoomId) return;
    setSession((current) => ({
      ...current,
      targetRoomId: current.selectedRoomId,
      startRoomId: current.startRoomId,
      routeId: `${current.startRoomId ?? jingongMapData.defaultStartRoomId}->${current.selectedRoomId}`,
    }));
    setPanel("route");
    setRoutePage("setup");
  };

  const clearRoute = () => {
    setSession((current) => ({
      ...current,
      startRoomId: undefined,
      targetRoomId: undefined,
      routeId: undefined,
      announce: [],
    }));
    setRoutePage("setup");
  };

  const openPanel = (next: PanelId) => {
    setPanel((current) => (current === next ? "none" : next));
  };

  const applyMapDirect = (request: MapDirectRequest) => {
    setSession(defaultSession("backend", request));
    setPanel("none");
    setRoutePage("setup");
  };

  const roomOptions = jingongMapData.rooms;
  const loadLabel =
    loadState === "ready" ? "3D 精确模型" : loadState === "fallback" ? "STL 备用模型" : loadState === "error" ? "语义导航模式" : "模型加载中";

  const selectRoomFromLabel = (roomId: string) => {
    const room = getRoomById(jingongMapData, roomId);
    if (!room) return;
    setSession((current) => ({ ...current, selectedRoomId: room.id }));
    setPanel("room");
  };

  return (
    <div className={`map3d-app panel-${panel}`}>
      <section className="map3d-stage" aria-label="3D 精确模型地图">
        <div className="map3d-canvas-host" ref={hostRef} onPointerDown={handleCanvasPointerDown} onPointerUp={handleCanvasPointerUp} />
        <div className="map3d-label-layer" aria-hidden="true">
          {labelLayout
            .filter((label) => label.visible)
            .map((label) => {
              const room = getRoomById(jingongMapData, label.roomId);
              return (
                <button
                  key={`${label.roomId}-${label.x.toFixed(0)}-${label.y.toFixed(0)}`}
                  className={`map3d-label ${label.active ? "active" : ""} ${label.start ? "start" : ""} ${label.target ? "target" : ""} ${room ? roomCssClass[room.area] : "utility"}`}
                  style={{ left: label.x, top: label.y }}
                  onClick={() => selectRoomFromLabel(label.roomId)}
                  tabIndex={-1}
                >
                  {label.text}
                </button>
              );
            })}
        </div>
        <div className="map3d-status-chip">
          <Box size={17} />
          <span>{loadLabel}</span>
          <small>{statusText}</small>
        </div>
        <div className="map3d-room-chip">
          <Crosshair size={17} />
          <span>{selectedRoom ? compactRoomName(selectedRoom) : "金工中心总览"}</span>
        </div>
        {route && panel === "none" && (
          <button className="map3d-route-chip" onClick={() => openPanel("route")} title="打开路线面板">
            <Route size={17} />
            <span>{targetRoom ? compactRoomName(targetRoom) : "路线"}</span>
            <small>{route.totalMeters}m · {formatSeconds(route.estimatedSeconds)}</small>
          </button>
        )}
      </section>

      <nav className="map3d-rail" aria-label="地图操作栏">
        {onExit && (
          <button onClick={onExit} title="返回待机">
            <ArrowLeft size={22} />
            <span>返回</span>
          </button>
        )}
        <button className={panel === "route" ? "active" : ""} onClick={() => openPanel("route")} title="路线">
          <Route size={22} />
          <span>路线</span>
        </button>
        <button className={panel === "layers" ? "active" : ""} onClick={() => openPanel("layers")} title="图层">
          <Layers size={22} />
          <span>图层</span>
        </button>
        <button className={panel === "view" ? "active" : ""} onClick={() => openPanel("view")} title="视角">
          <Compass size={22} />
          <span>视角</span>
        </button>
        <button onClick={fitCamera} title="总览">
          <Maximize2 size={22} />
          <span>总览</span>
        </button>
        <button className={panel === "debug" ? "active" : ""} onClick={() => openPanel("debug")} title="调试">
          <Bug size={22} />
          <span>调试</span>
        </button>
      </nav>

      {panel !== "none" && <button className="material-scrim" aria-label="关闭地图面板" onClick={() => setPanel("none")} />}

      {panel !== "none" && (
        <aside className="material-panel map3d-panel" aria-label="地图面板">
          <div className="material-panel-title">
            <strong>
              {panel === "route" && "路线导航"}
              {panel === "layers" && "图层显示"}
              {panel === "view" && "视角控制"}
              {panel === "room" && "房间信息"}
              {panel === "debug" && "地图调试"}
            </strong>
            <button className="icon-button material-close" onClick={() => setPanel("none")} title="关闭">
              <X size={19} />
            </button>
          </div>

          {panel === "route" && (
            <div className="map3d-panel-page">
              {routePage === "setup" ? (
                <>
                  <div className="route-mode-banner">
                    <Sparkles size={18} />
                    <span>{route ? "路线已贴合语义拓扑显示在 3D 模型上" : "选择终点后，默认从 101 生成路线"}</span>
                  </div>
                  <div className="material-field">
                    <span>起点</span>
                    <select value={startRoomId ?? ""} onChange={(event) => updateRouteEndpoint("startRoomId", event.target.value)}>
                      <option value="">需要路线时使用默认 101</option>
                      {roomOptions.map((room) => (
                        <option key={room.id} value={room.id}>
                          {floorLabel[room.floor]} · {compactRoomName(room)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="material-field">
                    <span>终点</span>
                    <select value={session.targetRoomId ?? ""} onChange={(event) => updateRouteEndpoint("targetRoomId", event.target.value)}>
                      <option value="">选择目的房间</option>
                      {roomOptions.map((room) => (
                        <option key={room.id} value={room.id}>
                          {floorLabel[room.floor]} · {compactRoomName(room)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="route-material-summary">
                    <div>
                      <span>起点</span>
                      <strong>{startRoom ? compactRoomName(startRoom) : "默认 101"}</strong>
                    </div>
                    <div>
                      <span>终点</span>
                      <strong>{targetRoom ? compactRoomName(targetRoom) : "未选择"}</strong>
                    </div>
                    <div>
                      <span>距离</span>
                      <strong>{route ? `${route.totalMeters}m` : "--"}</strong>
                    </div>
                    <div>
                      <span>预计</span>
                      <strong>{route ? formatSeconds(route.estimatedSeconds) : "--"}</strong>
                    </div>
                  </div>
                  <div className="material-action-row">
                    <button className="material-primary" disabled={!session.targetRoomId} onClick={() => setRoutePage("details")}>
                      <Navigation size={18} />
                      开始导航
                    </button>
                    <button className="material-secondary" onClick={clearRoute}>
                      <Trash2 size={18} />
                      清除路线
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="stepper-card">
                    <span>路线详情</span>
                    <strong>{route?.announceLines[0] ?? "尚未生成路线"}</strong>
                    <p>{route?.announceLines[1] ?? "请选择起点和终点。"}</p>
                  </div>
                  <div className="route-step-window">
                    {(route?.announceLines.slice(2, 5) ?? ["选择目的地后显示跨层、楼梯和方向提示。"]).map((line, index) => (
                      <div key={`${line}-${index}`} className="route-step-card">
                        <b>{index + 1}</b>
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                  <div className="material-action-row">
                    <button className="material-secondary" onClick={() => setRoutePage("setup")}>返回设置</button>
                    <button className="material-primary" onClick={() => setPanel("none")}>收起面板</button>
                  </div>
                </>
              )}
            </div>
          )}

          {panel === "layers" && (
            <div className="map3d-panel-page">
              <div className="material-grid two">
                <button className={session.layerMode === "allFloors" ? "material-tile active" : "material-tile"} onClick={() => setLayer("allFloors")}>
                  <MapIcon size={20} />
                  <strong>全楼</strong>
                  <span>完整模型与全部语义点</span>
                </button>
                <button className={session.layerMode === "single" && session.activeFloor === "1F" ? "material-tile active" : "material-tile"} onClick={() => setLayer("single", "1F")}>
                  <Layers size={20} />
                  <strong>一层</strong>
                  <span>只显示一层房间热点</span>
                </button>
                <button className={session.layerMode === "single" && session.activeFloor === "2F" ? "material-tile active" : "material-tile"} onClick={() => setLayer("single", "2F")}>
                  <Layers size={20} />
                  <strong>二层</strong>
                  <span>只显示二层房间热点</span>
                </button>
                <button className={session.layerMode === "exploded" ? "material-tile active" : "material-tile"} onClick={() => setLayer("exploded")}>
                  <Box size={20} />
                  <strong>爆炸分层</strong>
                  <span>强调楼层高度和跨层路线</span>
                </button>
                <button className={session.layerMode === "section" ? "material-tile active wide" : "material-tile wide"} onClick={() => setLayer("section")}>
                  <ScanLine size={20} />
                  <strong>剖切</strong>
                  <span>模型淡化并保留导航语义，适合看内部路线</span>
                </button>
              </div>
            </div>
          )}

          {panel === "view" && (
            <div className="map3d-panel-page">
              <div className="material-grid two">
                <button className={cameraMode === "perspective" ? "material-tile active" : "material-tile"} onClick={() => setCameraMode("perspective")}>
                  <Compass size={20} />
                  <strong>透视</strong>
                  <span>默认 2.5D 斜视角</span>
                </button>
                <button className={cameraMode === "orthographic" ? "material-tile active" : "material-tile"} onClick={() => setCameraMode("orthographic")}>
                  <ScanLine size={20} />
                  <strong>正交</strong>
                  <span>接近平面审图视角</span>
                </button>
              </div>
              <div className="material-grid four camera-preset-grid">
                <button className={activeCameraPreset === "overview" ? "material-mini-chip active" : "material-mini-chip"} onClick={() => applyCameraPreset("overview")}>
                  总览
                </button>
                <button className={activeCameraPreset === "lowIso" ? "material-mini-chip active" : "material-mini-chip"} onClick={() => applyCameraPreset("lowIso")}>
                  低角
                </button>
                <button className={activeCameraPreset === "top" ? "material-mini-chip active" : "material-mini-chip"} onClick={() => applyCameraPreset("top")}>
                  俯视
                </button>
                <button className={activeCameraPreset === "route" ? "material-mini-chip active" : "material-mini-chip"} onClick={() => applyCameraPreset("route")}>
                  路线
                </button>
              </div>
              <div className="view-nudge-grid">
                <button onClick={() => controlsRef.current?.rotateLeft(Math.PI / 8)}>左转</button>
                <button onClick={() => controlsRef.current?.rotateLeft(-Math.PI / 8)}>右转</button>
                <button onClick={() => controlsRef.current?.dollyIn(1.18)}>放大</button>
                <button onClick={() => controlsRef.current?.dollyOut(1.18)}>缩小</button>
                <button onClick={fitCamera}>回到总览</button>
              </div>
            </div>
          )}

          {panel === "room" && selectedRoom && (
            <div className="map3d-panel-page">
              <div className="room-material-card">
                <span>{floorLabel[selectedRoom.floor]} · {areaLabels[selectedRoom.area]}</span>
                <strong>{compactRoomName(selectedRoom)}</strong>
                <p>{selectedRoom.description}</p>
                <div className="tag-row">
                  {selectedRoom.tags.slice(0, 4).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
              <div className="material-action-row">
                <button className="material-secondary" onClick={() => setPanel("none")}>关闭</button>
                <button className="material-primary" onClick={startNavigationToSelected}>设为终点</button>
              </div>
            </div>
          )}

          {panel === "debug" && (
            <div className="map3d-panel-page">
              <div className="debug-material-list">
                <button onClick={() => applyMapDirect({ targetRoomId: "104-2F01", announce: ["summary", "distance", "floorChange"] })}>
                  MapDirect: 去 104 二层
                </button>
                <button onClick={() => applyMapDirect({ targetRoomId: "108-2F04", announce: ["summary", "distance", "floorChange"] })}>
                  MapDirect: 去 108 钳工
                </button>
                <button onClick={() => applyMapDirect({ startRoomId: "108-lobby", targetRoomId: "202-5", announce: ["summary", "distance", "direction"] })}>
                  MapDirect: 108 到 202-5
                </button>
                {onOpenLegacy && <button onClick={onOpenLegacy}>打开旧版演示地图</button>}
              </div>
              <p className="debug-panel-note">这里仅模拟地图启动参数。语音、意图识别和真实后端仍由外部服务接入。</p>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
