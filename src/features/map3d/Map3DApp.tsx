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
import type { FloorId, MapRoom, MapSessionState, RouteResult } from "../map/types";
import { mapPointToModel, modelAlignment } from "./modelAlignment";

type Props = {
  initialRequest?: MapDirectRequest;
  entrySource: "manual" | "backend";
  onExit?: () => void;
  onOpenLegacy?: () => void;
};

type PanelId = "none" | "route" | "layers" | "view" | "room" | "debug";
type CameraMode = "perspective" | "orthographic";
type LoadState = "loading" | "ready" | "fallback" | "error";

const DEFAULT_LAYER: MapSessionState["layerMode"] = "allFloors";

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

function makeTextSprite(text: string, active: boolean) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Sprite();

  const fontSize = active ? 28 : 22;
  context.font = `900 ${fontSize}px system-ui, PingFang SC, sans-serif`;
  const width = Math.ceil(context.measureText(text).width + 28);
  const height = active ? 48 : 40;
  canvas.width = Math.max(96, width) * 2;
  canvas.height = height * 2;
  context.scale(2, 2);
  context.font = `900 ${fontSize}px system-ui, PingFang SC, sans-serif`;
  context.textBaseline = "middle";
  context.lineJoin = "round";

  context.fillStyle = active ? "rgba(11, 108, 255, 0.94)" : "rgba(255, 255, 255, 0.9)";
  context.strokeStyle = active ? "rgba(255, 255, 255, 0.76)" : "rgba(184, 199, 219, 0.96)";
  context.lineWidth = 2;
  const radius = 16;
  const w = canvas.width / 2;
  const h = canvas.height / 2;
  context.beginPath();
  context.moveTo(radius, 1);
  context.lineTo(w - radius, 1);
  context.quadraticCurveTo(w - 1, 1, w - 1, radius);
  context.lineTo(w - 1, h - radius);
  context.quadraticCurveTo(w - 1, h - 1, w - radius, h - 1);
  context.lineTo(radius, h - 1);
  context.quadraticCurveTo(1, h - 1, 1, h - radius);
  context.lineTo(1, radius);
  context.quadraticCurveTo(1, 1, radius, 1);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = active ? "#ffffff" : "#17253a";
  context.fillText(text, 17, h / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set((canvas.width / 2) / 132, (canvas.height / 2) / 132, 1);
  return sprite;
}

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

  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRootRef = useRef<THREE.Object3D | null>(null);
  const semanticRootRef = useRef<THREE.Group | null>(null);
  const routeRootRef = useRef<THREE.Group | null>(null);
  const interactiveObjectsRef = useRef<THREE.Object3D[]>([]);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setSession(defaultSession(entrySource, initialRequest));
    setPanel(initialRequest?.targetRoomId ? "route" : "none");
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

  const fitCamera = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const target = new THREE.Vector3(...modelAlignment.defaultCamera.target);
    if (camera instanceof THREE.OrthographicCamera) {
      camera.position.set(7.6, 7.8, 7.6);
      camera.zoom = 0.92;
      camera.updateProjectionMatrix();
    } else if (camera instanceof THREE.PerspectiveCamera) {
      camera.position.fromArray(modelAlignment.defaultCamera.position);
      camera.fov = modelAlignment.defaultCamera.fov;
      camera.updateProjectionMatrix();
    }
    controls.target.copy(target);
    controls.update();
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
    controls.rotateSpeed = 0.62;
    controls.zoomSpeed = 0.9;
    controls.panSpeed = 0.72;
    controls.minDistance = 3;
    controls.maxDistance = 34;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI * 0.47;
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
    scene.background = new THREE.Color(0xf4f8fd);
    scene.fog = new THREE.Fog(0xf4f8fd, 18, 46);
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

    scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb3ca, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(5, 8, 6);
    sun.castShadow = true;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9fc8ff, 0.52);
    fill.position.set(-6, 4, -5);
    scene.add(fill);

    const grid = new THREE.GridHelper(14, 14, 0x8da7c5, 0xd3dfed);
    grid.position.y = -0.03;
    grid.material.transparent = true;
    grid.material.opacity = 0.42;
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
          const scale = 9.4 / maxAxis;

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
                material.needsUpdate = true;
              });
            }
          });
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
      semanticRootRef.current = null;
      routeRootRef.current = null;
      interactiveObjectsRef.current = [];
    };
  }, [attachControls, fitCamera]);

  useEffect(() => {
    const host = hostRef.current;
    const oldCamera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!host || !oldCamera || !renderer) return;
    const camera = createCamera(cameraMode, host.clientWidth, host.clientHeight);
    cameraRef.current = camera;
    attachControls();
    fitCamera();
  }, [attachControls, cameraMode, fitCamera]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const model = modelRootRef.current;
    if (!renderer || !model) return;

    const faded = session.layerMode === "single" || session.layerMode === "section";
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      materialList(mesh.material).forEach((material) => {
        material.transparent = faded;
        material.opacity = faded ? 0.34 : 1;
        material.depthWrite = !faded;
        material.needsUpdate = true;
      });
    });

    renderer.clippingPlanes =
      session.layerMode === "section"
        ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.42)]
        : [];
  }, [session.layerMode]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (semanticRootRef.current) {
      scene.remove(semanticRootRef.current);
      disposeObject(semanticRootRef.current);
    }

    const root = new THREE.Group();
    root.name = "semantic-hotspots";
    const floorMaterial = new THREE.MeshBasicMaterial({
      color: 0x5f8cc8,
      transparent: true,
      opacity: session.layerMode === "single" ? 0.16 : 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (const floor of jingongMapData.floors) {
      if (session.layerMode === "single" && session.activeFloor !== floor.id) continue;
      const shape = new THREE.Shape(floor.outline.map((point) => new THREE.Vector2(...mapPointToModel(point, floor.id).filter((_, index) => index !== 1) as [number, number])));
      const geometry = new THREE.ShapeGeometry(shape);
      geometry.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geometry, floorMaterial.clone());
      mesh.position.y = floor.id === "2F" ? modelAlignment.hotspotLift * 0.08 : 0.02;
      root.add(mesh);
    }

    const roomMaterial = new THREE.MeshBasicMaterial({ color: 0x0b6cff, transparent: true, opacity: 0.14, depthWrite: false });
    const selectedMaterial = new THREE.MeshBasicMaterial({ color: 0xff3f6c, transparent: true, opacity: 0.42, depthWrite: false });
    const startMaterial = new THREE.MeshBasicMaterial({ color: 0x18a058, transparent: true, opacity: 0.48, depthWrite: false });
    const interactive: THREE.Object3D[] = [];

    for (const room of visibleRooms) {
      const [x, y, z] = mapPointToModel(room.center, room.floor);
      const active = room.id === session.selectedRoomId || room.id === session.targetRoomId;
      const start = room.id === startRoomId;
      const radius = active || start ? 0.22 : 0.14;
      const hotspot = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, 0.045, 24),
        active ? selectedMaterial.clone() : start ? startMaterial.clone() : roomMaterial.clone(),
      );
      hotspot.position.set(x, y + modelAlignment.hotspotLift, z);
      hotspot.userData.roomId = room.id;
      root.add(hotspot);
      interactive.push(hotspot);

      if (shouldShowRoomLabel(room, session, startRoomId)) {
        const labelSprite = makeTextSprite(compactRoomName(room), active || start);
        labelSprite.position.set(x, y + modelAlignment.hotspotLift + (active || start ? 0.42 : 0.28), z);
        labelSprite.userData.roomId = room.id;
        root.add(labelSprite);
        interactive.push(labelSprite);
      }
    }

    semanticRootRef.current = root;
    interactiveObjectsRef.current = interactive;
    scene.add(root);
  }, [session.activeFloor, session.layerMode, session.selectedRoomId, session.targetRoomId, startRoomId, visibleRooms]);

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
      const points = route.points.map((routePoint) => {
        const [x, y, z] = mapPointToModel(routePoint.point, routePoint.floor);
        return new THREE.Vector3(x, y + modelAlignment.routeLift, z);
      });
      const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.08);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(8, points.length * 18), 0.045, 10, false),
        new THREE.MeshBasicMaterial({ color: 0x0b6cff }),
      );
      root.add(tube);

      const start = getRoomById(jingongMapData, route.startRoomId);
      const target = getRoomById(jingongMapData, route.targetRoomId);
      [start, target].forEach((room, index) => {
        if (!room) return;
        const [x, y, z] = mapPointToModel(room.center, room.floor);
        const pin = new THREE.Mesh(
          index === 0 ? new THREE.CylinderGeometry(0.13, 0.13, 0.32, 18) : new THREE.ConeGeometry(0.18, 0.46, 24),
          new THREE.MeshBasicMaterial({ color: index === 0 ? 0x18a058 : 0xff3f6c }),
        );
        pin.position.set(x, y + 0.7, z);
        root.add(pin);
      });
    }
    routeRootRef.current = root;
    scene.add(root);
  }, [route]);

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
    setPanel("route");
    setRoutePage("setup");
  };

  const roomOptions = jingongMapData.rooms;
  const loadLabel =
    loadState === "ready" ? "3D 精确模型" : loadState === "fallback" ? "STL 备用模型" : loadState === "error" ? "语义导航模式" : "模型加载中";

  return (
    <div className={`map3d-app panel-${panel}`}>
      <section className="map3d-stage" aria-label="3D 精确模型地图">
        <div className="map3d-canvas-host" ref={hostRef} onPointerDown={handleCanvasPointerDown} onPointerUp={handleCanvasPointerUp} />
        <div className="map3d-status-chip">
          <Box size={17} />
          <span>{loadLabel}</span>
          <small>{statusText}</small>
        </div>
        <div className="map3d-room-chip">
          <Crosshair size={17} />
          <span>{selectedRoom ? compactRoomName(selectedRoom) : "金工中心总览"}</span>
        </div>
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
