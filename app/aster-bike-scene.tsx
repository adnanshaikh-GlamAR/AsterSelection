"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { appendAssetVersion } from "./asset-version";

type IntroPhase = "loading" | "cinematic" | "ready";
type ComponentKey =
  | "groupset"
  | "crankset"
  | "cassette"
  | "wheel"
  | "cockpit"
  | "pedals"
  | "storage"
  | "seatAdjustment"
  | "saddle";
type ToneMappingKey = "none" | "linear" | "reinhard" | "cineon" | "aces" | "agx" | "neutral";
type HdriAssetKind = "exr" | "hdr" | "image";
type BackgroundMode = "color" | "hdri";
type HomeSceneId = "scene-01";
type LampProductId = "floor-lamp-4-heads" | "floor-lamp-3-heads" | "floor-lamp-2-heads";
type EmissionColorKey = "warm" | "neutral" | "cool";
type CameraVectorTuple = [number, number, number];
type HomeSceneCameraPose = {
  camera: CameraVectorTuple;
  look: CameraVectorTuple;
};
type HomeSceneCameraAction =
  | "pan-left"
  | "pan-right"
  | "pan-up"
  | "pan-down"
  | "orbit-left"
  | "orbit-right"
  | "tilt-up"
  | "tilt-down"
  | "zoom-in"
  | "zoom-out"
  | "save";
type HomeSceneCameraCommand = {
  action: HomeSceneCameraAction;
  id: number;
};

type PaintOption = {
  id: string;
  name: string;
  finish: string;
  frame: string;
  accent: string;
  decal: string;
  priceDelta: number;
};

type ComponentOption = {
  id: string;
  name: string;
  subtitle: string;
  priceDelta: number;
  visual: {
    metal?: string;
    rimDepth?: number;
    saddle?: string;
    cockpit?: string;
  };
};

type ComponentGroup = {
  key: ComponentKey;
  label: string;
  focus: "drivetrain" | "rear" | "front" | "cockpit" | "saddle";
  options: ComponentOption[];
};

type ConfigState = {
  paint: string;
  size: string;
  components: Record<ComponentKey, string>;
};

type ViewerSettings = {
  toneMapping: ToneMappingKey;
  exposure: number;
  environmentIntensity: number;
  environmentRotation: number;
  environmentContrast: number;
  environmentColor: string;
  ambientIntensity: number;
  keyIntensity: number;
  fillIntensity: number;
  rimIntensity: number;
  shadows: boolean;
  vsmBlurSamples: number;
  aoIntensity: number;
  modelAoIntensity: number;
  cameraFov: number;
  pixelRatio: number;
  floorGlow: number;
  backdropGlow: number;
  bloom: number;
  bloomRadius: number;
  bloomThreshold: number;
  emissionStrength: number;
  emissionColor: EmissionColorKey;
  hdriIntensity: number;
  hdriRotation: number;
  hdriScale: number;
};

type StudioSurfaces = {
  backdropMaterial: THREE.MeshBasicMaterial;
  contactAo: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  contactAoMaterial: THREE.MeshBasicMaterial;
  dome: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  domeMaterial: THREE.MeshBasicMaterial;
  floorGlow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  floorGlowMaterial: THREE.MeshBasicMaterial;
  group: THREE.Group;
  stageRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  stageRingMaterial: THREE.MeshBasicMaterial;
  stageRingHighlight: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
};

type BodyFramePaintMaterial = {
  defaultMap: THREE.Texture | null;
  material: THREE.MeshStandardMaterial;
};

type SelectiveBloomCompositePass = ShaderPass & {
  uniforms: {
    baseTexture: { value: THREE.Texture | null };
    bloomIntensity: { value: number };
    bloomTexture: { value: THREE.Texture | null };
    maskTexture: { value: THREE.Texture | null };
  };
};

type HdriAsset = {
  kind: HdriAssetKind;
  name: string;
  url: string;
};

type ViewerHotspot = {
  anchor: [number, number, number];
  description?: string;
  id: string;
  label: string;
};

type HdriDomeMaterial = THREE.ShaderMaterial & {
  uniforms: {
    hdriIntensity: { value: number };
    hdriMap: { value: THREE.Texture | null };
    hdriRotation: { value: number };
    hdriScale: { value: number };
  };
};

type ModelAssetId =
  | "baseFrame"
  | "bottle01"
  | "bottleCage"
  | "duraAce105Di2"
  | "keoClassic3"
  | "sramRedAxsE1"
  | "vittoriaRubino32Mm"
  | "mavicCosmicSl45"
  | "zipp303SwCarbon";

type ModelAsset = {
  id: ModelAssetId;
  path: string;
  preload?: boolean;
  sourceGroundY?: number;
};

type ComponentAddonAssetEntry = ModelAsset | ModelAsset[];

const paintOptions: PaintOption[] = [
  {
    id: "iridescent-white-metallic",
    name: "Iridescent White Metallic",
    finish: "Iridescent white metallic",
    frame: "#f1eee6",
    accent: "#d9e7f4",
    decal: "#9d998f",
    priceDelta: 0,
  },
  {
    id: "damson-metallic",
    name: "Damson Metallic",
    finish: "Damson metallic",
    frame: "#3a1426",
    accent: "#7b3048",
    decal: "#f0e8df",
    priceDelta: 0,
  },
  {
    id: "slate-grey-metallic",
    name: "Slate Grey Metallic",
    finish: "Slate grey metallic",
    frame: "#555d5f",
    accent: "#22272a",
    decal: "#f3efe6",
    priceDelta: 0,
  },
];

const frameSizeMorphValues: Record<string, number> = {
  L: 1,
  M: 0.5,
  S: 0,
};

const handlebarSizeMorphValues: Record<string, number> = {
  "handlebar-38-80": 0,
  "handlebar-42-110": 1,
  "handlebar-42-120": 0.5,
};

const seatAdjustmentMorphValues: Record<string, number> = {
  "seat-high": 1,
  "seat-low": 0,
  "seat-med": 0.5,
};

const baseDimensionText = "30cm";
const viewerDimensionAnchors: Array<Omit<ViewerHotspot, "label">> = [
  { anchor: [0.82, 0.94, 0.5], id: "height" },
  { anchor: [0.2, 0.08, 0.5], id: "base" },
];

const defaultViewerSettings: ViewerSettings = {
  ambientIntensity: 0,
  aoIntensity: 0,
  backdropGlow: 0,
  bloom: 0.5,
  bloomRadius: 0.3,
  bloomThreshold: 0.55,
  cameraFov: 35,
  emissionColor: "warm",
  emissionStrength: 4.5,
  environmentColor: "#ffffff",
  environmentContrast: 1.08,
  environmentIntensity: 1.06,
  environmentRotation: -40,
  exposure: 0.61,
  fillIntensity: 1.9,
  floorGlow: 0.75,
  hdriIntensity: 1.15,
  hdriRotation: 107,
  hdriScale: 0.5,
  keyIntensity: 1.55,
  modelAoIntensity: 0.89,
  pixelRatio: 3,
  rimIntensity: 0.95,
  shadows: true,
  toneMapping: "aces",
  vsmBlurSamples: 24,
};

const toneMappingValues: Record<ToneMappingKey, number> = {
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
  cineon: THREE.CineonToneMapping,
  linear: THREE.LinearToneMapping,
  neutral: THREE.NeutralToneMapping,
  none: THREE.NoToneMapping,
  reinhard: THREE.ReinhardToneMapping,
};

const componentGroups: ComponentGroup[] = [
  {
    key: "groupset",
    label: "Groupset",
    focus: "drivetrain",
    options: [
      {
        id: "shimano-105-di2",
        name: "Dura-Ace 105 Di2",
        subtitle: "Electronic 12 speed",
        priceDelta: 0,
        visual: { metal: "#b9bec4" },
      },
      {
        id: "sram-force-axs",
        name: "SRAM RED AXS E1",
        subtitle: "Wireless 12 speed",
        priceDelta: 0,
        visual: { metal: "#1f2428" },
      },
    ],
  },
  {
    key: "crankset",
    label: "Crankset",
    focus: "drivetrain",
    options: [
      {
        id: "compact-50-34",
        name: "Compact 50/34T",
        subtitle: "Balanced climbing setup",
        priceDelta: 0,
        visual: {},
      },
      {
        id: "semi-compact-52-36",
        name: "Semi Compact 52/36T",
        subtitle: "Fast road gearing",
        priceDelta: 90,
        visual: {},
      },
      {
        id: "power-meter",
        name: "Power Meter 52/36T",
        subtitle: "Integrated dual-sided meter",
        priceDelta: 420,
        visual: { metal: "#202126" },
      },
    ],
  },
  {
    key: "cassette",
    label: "Cassette",
    focus: "rear",
    options: [
      {
        id: "11-30",
        name: "11-30T",
        subtitle: "Fast rolling road range",
        priceDelta: 0,
        visual: {},
      },
      {
        id: "11-34",
        name: "11-34T",
        subtitle: "Extra climbing range",
        priceDelta: 65,
        visual: {},
      },
    ],
  },
  {
    key: "wheel",
    label: "Wheels",
    focus: "front",
    options: [
      {
        id: "level-db40",
        name: "Vittoria Rubino 32",
        subtitle: "32 mm road tire",
        priceDelta: 0,
        visual: { rimDepth: 32 },
      },
      {
        id: "mavic-cosmic",
        name: "Mavic Cosmic SL 45",
        subtitle: "45 mm carbon wheelset",
        priceDelta: 0,
        visual: { rimDepth: 45 },
      },
      {
        id: "zipp-404",
        name: "Zipp 303 SW Carbon",
        subtitle: "Carbon road wheelset",
        priceDelta: 0,
        visual: { rimDepth: 40 },
      },
    ],
  },
  {
    key: "pedals",
    label: "Pedals",
    focus: "drivetrain",
    options: [
      {
        id: "keo-classic-3",
        name: "Keo Classic 3",
        subtitle: "Road clip-in pedals",
        priceDelta: 0,
        visual: {},
      },
      {
        id: "wahoo-speedplay-comp",
        name: "Wahoo Speedplay Comp Pedals",
        subtitle: "Dual-sided road pedals",
        priceDelta: 0,
        visual: {},
      },
    ],
  },
  {
    key: "storage",
    label: "Bottle & Cage",
    focus: "drivetrain",
    options: [
      {
        id: "bottle-cage",
        name: "AERO BOTTLE CAGE BUNDLE",
        subtitle: "Cage Bundle",
        priceDelta: 0,
        visual: {},
      },
      {
        id: "water-bottle-500ml",
        name: "Water Bottle 500 ML",
        subtitle: "Bottle and cage add-on",
        priceDelta: 0,
        visual: {},
      },
    ],
  },
  {
    key: "cockpit",
    label: "Handlebar Size",
    focus: "cockpit",
    options: [
      {
        id: "handlebar-38-80",
        name: "38CM x 80MM",
        subtitle: "Compact reach",
        priceDelta: 0,
        visual: { cockpit: "#191b1d" },
      },
      {
        id: "handlebar-42-120",
        name: "42CM x 120MM",
        subtitle: "Extended race fit",
        priceDelta: 0,
        visual: { cockpit: "#050607" },
      },
      {
        id: "handlebar-42-110",
        name: "42CM x 110MM",
        subtitle: "Balanced road fit",
        priceDelta: 0,
        visual: { cockpit: "#050607" },
      },
    ],
  },
  {
    key: "seatAdjustment",
    label: "Seat Adjustment",
    focus: "saddle",
    options: [
      {
        id: "seat-low",
        name: "LOW",
        subtitle: "Low saddle position",
        priceDelta: 0,
        visual: {},
      },
      {
        id: "seat-med",
        name: "MED",
        subtitle: "Medium saddle position",
        priceDelta: 0,
        visual: {},
      },
      {
        id: "seat-high",
        name: "HIGH",
        subtitle: "High saddle position",
        priceDelta: 0,
        visual: {},
      },
    ],
  },
  {
    key: "saddle",
    label: "Saddle",
    focus: "saddle",
    options: [
      {
        id: "prologo",
        name: "Prologo Dimension",
        subtitle: "Short-fit performance saddle",
        priceDelta: 0,
        visual: { saddle: "#161616" },
      },
      {
        id: "selle-italia",
        name: "Selle Italia SLR Boost",
        subtitle: "Carbon rail upgrade",
        priceDelta: 210,
        visual: { saddle: "#f1eee7" },
      },
    ],
  },
];

const publicAsset = (path: string, options: { version?: boolean } = {}) => {
  const assetPath = `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

  return options.version === false || path.endsWith("/") ? assetPath : appendAssetVersion(assetPath);
};
const bodyFramePaintMaterialName = "Plane.012_QB_Baked_Material.004";
const bodyFrameDiffuseMaps: Partial<Record<string, string>> = {
  "damson-metallic": "textures/skins/damson-metallic.jpg",
  "slate-grey-metallic": "textures/skins/slate-grey-metallic.jpg",
};
const modelAssets = {
  baseFrame: {
    id: "baseFrame",
    path: "models/base/frame.glb",
  },
  bottle01: {
    id: "bottle01",
    path: "models/storage/bottle-01.glb",
  },
  bottleCage: {
    id: "bottleCage",
    path: "models/storage/bottle-cage.glb",
  },
  duraAce105Di2: {
    id: "duraAce105Di2",
    path: "models/groupset/dura-ace-105-di2.glb",
  },
  sramRedAxsE1: {
    id: "sramRedAxsE1",
    path: "models/groupset/sram-red-axs-e1.glb",
  },
  keoClassic3: {
    id: "keoClassic3",
    path: "models/pedals/keo-classic-3.glb",
  },
  mavicCosmicSl45: {
    id: "mavicCosmicSl45",
    path: "models/wheels/mavic-cosmic-sl-45.glb",
    sourceGroundY: -2.2691,
  },
  vittoriaRubino32Mm: {
    id: "vittoriaRubino32Mm",
    path: "models/wheels/vittoria-rubino-32-mm.glb",
    sourceGroundY: -2.2691,
  },
  zipp303SwCarbon: {
    id: "zipp303SwCarbon",
    path: "models/wheels/zipp-303-sw-carbon.glb",
    sourceGroundY: -2.2886,
  },
} satisfies Record<ModelAssetId, ModelAsset>;
const bikeModelUrl = publicAsset(modelAssets.baseFrame.path);
const componentAddonAssets: Partial<Record<ComponentKey, Partial<Record<string, ComponentAddonAssetEntry>>>> = {
  groupset: {
    "shimano-105-di2": modelAssets.duraAce105Di2,
    "sram-force-axs": modelAssets.sramRedAxsE1,
  },
  pedals: {
    "keo-classic-3": modelAssets.keoClassic3,
  },
  storage: {
    "bottle-cage": modelAssets.bottleCage,
    "water-bottle-500ml": [modelAssets.bottleCage, modelAssets.bottle01],
  },
  wheel: {
    "level-db40": modelAssets.vittoriaRubino32Mm,
    "mavic-cosmic": modelAssets.mavicCosmicSl45,
    "zipp-404": modelAssets.zipp303SwCarbon,
  },
};
// Aster Collection should not load the inherited Ribble GLB models.
const loadExternalGlbModels = false;
const lampModelUrlsByHeight: Record<string, string> = {
  "60 CM": publicAsset("models/lamp/table-lamp-with-4-heads-red-90cm.glb"),
  "A 60 CM": publicAsset("models/lamp/table-lamp-with-4-heads-red-90cm.glb"),
  "B 60 CM": publicAsset("models/lamp/table-lamp-with-4-heads-red-90cm.glb"),
  "90 CM": publicAsset("models/lamp/table-lamp-with-4-heads-red-90cm.glb"),
  "130 CM": publicAsset("models/lamp/table-lamp-4-heads-a-red-130cm.glb"),
  "A 130 CM": publicAsset("models/lamp/table-lamp-4-heads-a-red-130cm.glb"),
  "B 130 CM": publicAsset("models/lamp/table-lamp-4-heads-a-red-130cm.glb"),
  "160 CM": publicAsset("models/lamp/floor-lamp-4-heads-a-red-160cm.glb"),
  "A 160 CM": publicAsset("models/lamp/floor-lamp-4-heads-a-red-160cm.glb"),
};
const lampModelUrlsByColorAndHeight: Record<string, Partial<Record<string, string>>> = {
  green: {
    "90 CM": publicAsset("models/lamp/table-lamp-with-4-heads-green-90cm.glb"),
    "A 130 CM": publicAsset("models/lamp/table-lamp-4-heads-a-green-130cm.glb"),
    "B 130 CM": publicAsset("models/lamp/table-lamp-4-heads-b-green-130cm.glb"),
    "160 CM": publicAsset("models/lamp/floor-lamp-with-4-heads-green-160cm.glb"),
    "A 160 CM": publicAsset("models/lamp/floor-lamp-4-heads-a-green-160cm.glb"),
  },
  white: {
    "130 CM": publicAsset("models/lamp/table-lamp-4-heads-a-white-130cm.glb"),
    "160 CM": publicAsset("models/lamp/floor-lamp-4-heads-a-white-160cm.glb"),
  },
  black: {
    "130 CM": publicAsset("models/lamp/table-lamp-4-heads-b-black-130cm.glb"),
    "160 CM": publicAsset("models/lamp/floor-lamp-with-4-heads-black-160cm.glb"),
  },
  orange: {
    "90 CM": publicAsset("models/lamp/table-lamp-with-4-heads-orange-90cm.glb"),
    "160 CM": publicAsset("models/lamp/floor-lamp-with-4-heads-orange-160cm.glb"),
  },
};
const lampModelUrlsByProductColorAndHeight: Partial<
  Record<LampProductId, Partial<Record<string, Partial<Record<string, string>>>>>
> = {
  "floor-lamp-2-heads": {
    twoHead: {
      "50 CM": publicAsset("models/lamp/table-lamp-2-heads-50cm.glb"),
    },
  },
  "floor-lamp-3-heads": {
    S: {
      "A 60 CM": publicAsset("models/lamp/table-lamp-3-heads-a-red-60cm.glb"),
      "B 60 CM": publicAsset("models/lamp/table-lamp-3-heads-b-red-60cm.glb"),
    },
    green: {
      "60 CM": publicAsset("models/lamp/table-lamp-3-heads-a-green-60cm.glb"),
    },
    black: {
      "60 CM": publicAsset("models/lamp/table-lamp-3-heads-b-black-60cm.glb"),
    },
  },
};
const homeSceneModelUrls: Record<HomeSceneId, string> = {
  "scene-01": publicAsset("models/home/home02.glb"),
};
const fallbackLampHeight = "160 CM";
const lampEmissionTextureNames: Record<EmissionColorKey, string> = {
  cool: "Lamp_Texture_Cool.png",
  neutral: "Lamp_Texture_Neutral.png",
  warm: "Lamp_Texture.png",
};
const lampEmissionTextureUrls: Record<EmissionColorKey, string> = {
  cool: publicAsset(`textures/lamp/${lampEmissionTextureNames.cool}`),
  neutral: publicAsset(`textures/lamp/${lampEmissionTextureNames.neutral}`),
  warm: publicAsset(`textures/lamp/${lampEmissionTextureNames.warm}`),
};
const lampEmissionMaterialPattern = /^emision(?:\.\d+)?$/i;
const lampEmissionColors: Record<EmissionColorKey, string> = {
  cool: "#d9ecff",
  neutral: "#fffaf0",
  warm: "#fff4da",
};
const startupCameraDistance = 4.85;
const startupCameraX = 0.86;
const mobileStartupCameraX = 0;
const mobileCameraBreakpoint = 900;
const startupCameraHeightOffset = 0.48;
const startupLookHeightOffset = 0.02;
const productViewportFit = 2;
const productCameraHeightOffset = 1.36;
const productLookHeightOffset = 0.42;
// Authored GLB wheel-contact height. Keep the studio floor fixed and move assets to this line.
const bikeSourceGroundY = -2.28;
const modelGroundY = -0.82;
const studioFloorClearance = 0.012;
const studioFloorY = modelGroundY - studioFloorClearance;
const modelRenderOrder = 10;
const studioDomeRadius = 36;

function getStartupCameraX(viewportWidth?: number) {
  return typeof viewportWidth === "number" && viewportWidth <= mobileCameraBreakpoint
    ? mobileStartupCameraX
    : startupCameraX;
}

function getEffectivePixelRatio(pixelRatio: number, viewportWidth?: number) {
  const requestedPixelRatio = THREE.MathUtils.clamp(
    Number.isFinite(pixelRatio) ? pixelRatio : defaultViewerSettings.pixelRatio,
    1,
    3,
  );
  const devicePixelRatio = typeof window !== "undefined" && window.devicePixelRatio
    ? window.devicePixelRatio
    : requestedPixelRatio;
  const viewportCap =
    typeof viewportWidth === "number" && viewportWidth <= mobileCameraBreakpoint
      ? 1.5
      : typeof viewportWidth === "number" && viewportWidth <= 1180
        ? 1.75
        : 2;

  return Math.max(1, Math.min(requestedPixelRatio, devicePixelRatio, viewportCap));
}

function getLampModelUrl(lampProductId: LampProductId, sizeId: string, lampHeight: string) {
  return lampModelUrlsByProductColorAndHeight[lampProductId]?.[sizeId]?.[lampHeight]
    ?? lampModelUrlsByColorAndHeight[sizeId]?.[lampHeight]
    ?? lampModelUrlsByHeight[lampHeight];
}

function getLampEmissionColor(emissionColor: EmissionColorKey) {
  return lampEmissionColors[emissionColor] ?? lampEmissionColors.warm;
}

function getLampEmissionTextureName(emissionColor: EmissionColorKey) {
  return lampEmissionTextureNames[emissionColor] ?? lampEmissionTextureNames.warm;
}

function getLampEmissionTexture(
  textures: Partial<Record<EmissionColorKey, THREE.Texture>>,
  emissionColor: EmissionColorKey,
) {
  const activeTexture = textures[emissionColor];
  if (activeTexture) {
    return activeTexture;
  }

  const activeTextureName = getLampEmissionTextureName(emissionColor);
  if (activeTextureName === lampEmissionTextureNames.warm) {
    return textures.warm ?? textures.neutral ?? null;
  }

  return null;
}

function vectorFromCameraTuple(tuple: CameraVectorTuple) {
  return new THREE.Vector3(tuple[0], tuple[1], tuple[2]);
}

function vectorToCameraTuple(vector: THREE.Vector3): CameraVectorTuple {
  return [
    Number(vector.x.toFixed(4)),
    Number(vector.y.toFixed(4)),
    Number(vector.z.toFixed(4)),
  ];
}

function getHomeSceneCameraPose(savedPose?: HomeSceneCameraPose | null) {
  if (savedPose) {
    return {
      camera: vectorFromCameraTuple(savedPose.camera),
      look: vectorFromCameraTuple(savedPose.look),
    };
  }

  return {
    camera: new THREE.Vector3(1.42, modelGroundY + 1.5, 4.35),
    look: new THREE.Vector3(0.46, modelGroundY + 1.08, -0.58),
  };
}

function formatCameraVector(vector: THREE.Vector3) {
  return vector.toArray().map((value) => value.toFixed(2)).join(",");
}

function formatCameraRotation(rotation: THREE.Euler) {
  return [rotation.x, rotation.y, rotation.z].map((value) => value.toFixed(3)).join(",");
}

function captureHomeSceneCameraPose(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
): HomeSceneCameraPose {
  return {
    camera: vectorToCameraTuple(camera.position),
    look: vectorToCameraTuple(controls.target),
  };
}

function writeHomeSceneCameraData(
  container: HTMLDivElement,
  camera: THREE.PerspectiveCamera,
  look: THREE.Vector3,
) {
  container.dataset.homeSceneCamera = formatCameraVector(camera.position);
  container.dataset.homeSceneLook = formatCameraVector(look);
  container.dataset.homeSceneCameraRotation = formatCameraRotation(camera.rotation);
}

const defaultConfig: ConfigState = {
  paint: "iridescent-white-metallic",
  size: "S",
  components: {
    groupset: "shimano-105-di2",
    crankset: "compact-50-34",
    cassette: "11-30",
    wheel: "level-db40",
    cockpit: "handlebar-38-80",
    pedals: "keo-classic-3",
    storage: "bottle-cage",
    seatAdjustment: "seat-low",
    saddle: "prologo",
  },
};

function getPaint(id: string) {
  return paintOptions.find((option) => option.id === id) ?? paintOptions[0];
}

function getComponent(group: ComponentGroup, id: string) {
  return group.options.find((option) => option.id === id) ?? group.options[0];
}

function getComponentGroup(groupKey: ComponentKey) {
  return componentGroups.find((group) => group.key === groupKey) ?? componentGroups[0];
}

function tubeBetween(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  material: THREE.Material,
) {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 24, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createLabelSprite(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    context.font = "700 58px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.65, 0.42, 1);
  return sprite;
}

function createWheel(x: number, rimDepth: number, materials: Record<string, THREE.Material>) {
  const group = new THREE.Group();
  const rimScale = 1 + Math.max(0, rimDepth - 40) / 260;
  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.045, 20, 96),
    materials.tire,
  );
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.025 * rimScale, 16, 96),
    materials.rim,
  );
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.18, 24), materials.metal);

  tire.rotation.y = Math.PI / 2;
  rim.rotation.y = Math.PI / 2;
  hub.rotation.z = Math.PI / 2;
  group.add(tire, rim, hub);

  for (let index = 0; index < 20; index += 1) {
    const angle = (Math.PI * 2 * index) / 20;
    const y = Math.sin(angle) * 0.73;
    const z = Math.cos(angle) * 0.73;
    group.add(tubeBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, y, z), 0.005, materials.spoke));
  }

  group.position.set(x, 0.86, 0);
  return group;
}

function buildBike(config: ConfigState, focus: string) {
  const paint = getPaint(config.paint);
  const wheelOption = getComponent(getComponentGroup("wheel"), config.components.wheel);
  const groupsetOption = getComponent(getComponentGroup("groupset"), config.components.groupset);
  const cockpitOption = getComponent(getComponentGroup("cockpit"), config.components.cockpit);
  const saddleOption = getComponent(getComponentGroup("saddle"), config.components.saddle);

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: paint.frame,
    emissive: paint.frame,
    emissiveIntensity: 0.08,
    metalness: 0.62,
    roughness: 0.32,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: paint.accent,
    metalness: 0.42,
    roughness: 0.26,
  });
  const blackMaterial = new THREE.MeshStandardMaterial({
    color: "#121313",
    emissive: "#101010",
    emissiveIntensity: 0.05,
    metalness: 0.55,
    roughness: 0.44,
  });
  const tireMaterial = new THREE.MeshStandardMaterial({
    color: "#0c0c0c",
    emissive: "#080808",
    emissiveIntensity: 0.04,
    metalness: 0.12,
    roughness: 0.7,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: groupsetOption.visual.metal ?? "#c9ced2",
    metalness: 0.85,
    roughness: 0.26,
  });
  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: cockpitOption.visual.cockpit ?? "#141515",
    metalness: 0.5,
    roughness: 0.32,
  });
  const saddleMaterial = new THREE.MeshStandardMaterial({
    color: saddleOption.visual.saddle ?? "#161616",
    metalness: 0.12,
    roughness: 0.52,
  });

  const group = new THREE.Group();
  const rear = new THREE.Vector3(-1.72, 0.86, 0);
  const front = new THREE.Vector3(1.72, 0.86, 0);
  const bottom = new THREE.Vector3(-0.16, 0.92, 0);
  const seatTop = new THREE.Vector3(-0.86, 2.1, 0);
  const headTop = new THREE.Vector3(0.96, 2.0, 0);
  const headLow = new THREE.Vector3(1.16, 1.45, 0);

  group.add(createWheel(rear.x, wheelOption.visual.rimDepth ?? 40, {
    metal: metalMaterial,
    rim: blackMaterial,
    spoke: metalMaterial,
    tire: tireMaterial,
  }));
  group.add(createWheel(front.x, wheelOption.visual.rimDepth ?? 40, {
    metal: metalMaterial,
    rim: blackMaterial,
    spoke: metalMaterial,
    tire: tireMaterial,
  }));

  [
    [bottom, seatTop, 0.055, frameMaterial],
    [bottom, headLow, 0.065, frameMaterial],
    [seatTop, headTop, 0.055, frameMaterial],
    [headTop, headLow, 0.06, frameMaterial],
    [seatTop, rear, 0.038, frameMaterial],
    [bottom, rear, 0.04, frameMaterial],
    [headLow, front, 0.045, frameMaterial],
    [headTop, front, 0.038, frameMaterial],
  ].forEach(([from, to, radius, material]) => {
    group.add(tubeBetween(from as THREE.Vector3, to as THREE.Vector3, radius as number, material as THREE.Material));
  });

  group.add(tubeBetween(new THREE.Vector3(-0.9, 2.06, 0), new THREE.Vector3(-0.85, 2.45, 0), 0.035, blackMaterial));
  group.add(tubeBetween(new THREE.Vector3(0.95, 2.0, 0), new THREE.Vector3(1.22, 2.34, 0), 0.032, cockpitMaterial));
  group.add(tubeBetween(new THREE.Vector3(1.22, 2.34, -0.58), new THREE.Vector3(1.22, 2.34, 0.58), 0.032, cockpitMaterial));
  group.add(tubeBetween(new THREE.Vector3(1.22, 2.34, -0.58), new THREE.Vector3(1.3, 2.12, -0.7), 0.028, cockpitMaterial));
  group.add(tubeBetween(new THREE.Vector3(1.22, 2.34, 0.58), new THREE.Vector3(1.3, 2.12, 0.7), 0.028, cockpitMaterial));

  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.28), saddleMaterial);
  saddle.position.set(-0.93, 2.52, 0);
  saddle.rotation.z = -0.08;
  group.add(saddle);

  const chainring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 16, 60), metalMaterial);
  chainring.position.copy(bottom);
  chainring.rotation.y = Math.PI / 2;
  group.add(chainring);

  const crank = tubeBetween(bottom, new THREE.Vector3(-0.16, 0.48, 0.06), 0.015, blackMaterial);
  group.add(crank);
  group.add(tubeBetween(new THREE.Vector3(-1.7, 0.86, 0.06), new THREE.Vector3(-0.16, 0.92, 0.06), 0.012, metalMaterial));
  group.add(tubeBetween(new THREE.Vector3(-1.7, 0.8, 0.06), new THREE.Vector3(-0.16, 0.86, 0.06), 0.012, metalMaterial));

  const cassette = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 12, 48), metalMaterial);
  cassette.position.set(-1.72, 0.86, 0.08);
  cassette.rotation.y = Math.PI / 2;
  group.add(cassette);

  const logo = createLabelSprite("ASTER", paint.decal);
  logo.position.set(0.21, 1.28, 0.075);
  logo.rotation.z = -0.56;
  group.add(logo);

  for (let index = 0; index < 3; index += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.018), accentMaterial);
    stripe.position.set(0.78 + index * 0.08, 1.82 - index * 0.03, 0.076);
    stripe.rotation.z = -0.58;
    group.add(stripe);
  }

  const forkStripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.02), accentMaterial);
  forkStripe.position.set(1.2, 1.38, 0.08);
  forkStripe.rotation.z = -0.3;
  group.add(forkStripe);

  group.position.y = -0.78;
  group.rotation.x = focus === "saddle" ? -0.05 : 0;
  return group;
}

function disposeMaterial(material: THREE.Material) {
  Object.values(material as unknown as Record<string, unknown>).forEach((value) => {
    const texture = value as THREE.Texture | null | undefined;

    if (texture?.isTexture) {
      texture.dispose();
    }
  });

  material.dispose();
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const material = mesh.material;

    mesh.geometry?.dispose();

    if (Array.isArray(material)) {
      material.forEach((item) => disposeMaterial(item));
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

function tuneStudioMaterial(material: THREE.Material, anisotropy: number) {
  const pbrMaterial = material as THREE.MeshStandardMaterial;

  if ("envMapIntensity" in pbrMaterial) {
    pbrMaterial.envMapIntensity = 1.45;
  }

  const texturedMaterial = material as unknown as Record<string, THREE.Texture | null | undefined>;
  ["aoMap", "map", "metalnessMap", "normalMap", "roughnessMap"].forEach((key) => {
    const texture = texturedMaterial[key];

    if (texture?.isTexture) {
      texture.anisotropy = Math.min(anisotropy, 8);
      texture.needsUpdate = true;
    }
  });

  material.needsUpdate = true;
}

function collectModelMaterials(object: THREE.Object3D) {
  const materials = new Set<THREE.Material>();

  object.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (!mesh.isMesh || !mesh.material) {
      return;
    }

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => materials.add(material));
    } else {
      materials.add(mesh.material);
    }
  });

  return Array.from(materials);
}

function applyModelAmbientOcclusion(materials: THREE.Material[], intensity: number) {
  const occlusion = THREE.MathUtils.clamp(intensity, 0, 2);
  const shadowColor = new THREE.Color("#14130f");

  materials.forEach((material) => {
    const pbrMaterial = material as THREE.MeshStandardMaterial;
    const materialState = material.userData as {
      studioBaseAoMapIntensity?: number;
      studioBaseColor?: string;
      studioBaseEmissiveIntensity?: number;
      studioBaseEnvMapIntensity?: number;
      studioBaseRoughness?: number;
      studioLampEmissionMaterial?: boolean;
    };

    if ("aoMapIntensity" in pbrMaterial) {
      materialState.studioBaseAoMapIntensity ??= pbrMaterial.aoMapIntensity;
      pbrMaterial.aoMapIntensity = materialState.studioBaseAoMapIntensity + occlusion;
    }

    if ("envMapIntensity" in pbrMaterial) {
      materialState.studioBaseEnvMapIntensity ??= pbrMaterial.envMapIntensity;
      pbrMaterial.envMapIntensity = materialState.studioBaseEnvMapIntensity * (1 - occlusion * 0.06);
    }

    if ("roughness" in pbrMaterial) {
      materialState.studioBaseRoughness ??= pbrMaterial.roughness;
      pbrMaterial.roughness = Math.min(1, materialState.studioBaseRoughness + occlusion * 0.025);
    }

    if ("emissiveIntensity" in pbrMaterial && !materialState.studioLampEmissionMaterial) {
      materialState.studioBaseEmissiveIntensity ??= pbrMaterial.emissiveIntensity;
      pbrMaterial.emissiveIntensity = materialState.studioBaseEmissiveIntensity * (1 - occlusion * 0.1);
    }

    if ("color" in pbrMaterial && pbrMaterial.color?.isColor) {
      materialState.studioBaseColor ??= `#${pbrMaterial.color.getHexString()}`;
      pbrMaterial.color.set(materialState.studioBaseColor).lerp(shadowColor, occlusion * 0.035);
    }

    material.needsUpdate = true;
  });
}

function configureLampEmissionTexture(texture: THREE.Texture, anisotropy: number) {
  texture.anisotropy = Math.min(anisotropy, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;
}

function isLampEmissionMaterial(material: THREE.Material) {
  return lampEmissionMaterialPattern.test(material.name.trim());
}

function collectLampEmissionMaterials(object: THREE.Object3D) {
  const materials = new Set<THREE.MeshStandardMaterial>();

  object.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (!mesh.isMesh || !mesh.material) {
      return;
    }

    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    meshMaterials.forEach((material) => {
      if (isLampEmissionMaterial(material)) {
        materials.add(material as THREE.MeshStandardMaterial);
      }
    });
  });

  return Array.from(materials);
}

function getBloomSettingValue(bloom: number) {
  return Number.isFinite(bloom) ? bloom : defaultViewerSettings.bloom;
}

function getBloomRadiusSettingValue(bloomRadius: number) {
  return Number.isFinite(bloomRadius) ? bloomRadius : defaultViewerSettings.bloomRadius;
}

function getBloomThresholdSettingValue(bloomThreshold: number) {
  return Number.isFinite(bloomThreshold) ? bloomThreshold : defaultViewerSettings.bloomThreshold;
}

function getEmissionStrengthSettingValue(emissionStrength: number) {
  return Number.isFinite(emissionStrength) ? emissionStrength : defaultViewerSettings.emissionStrength;
}

function getComposerBloomTexture(composer: EffectComposer) {
  return (composer as EffectComposer & { renderTarget2: THREE.WebGLRenderTarget }).renderTarget2.texture;
}

function createSelectiveBloomCompositePass(
  bloomComposer: EffectComposer,
  maskRenderTarget: THREE.WebGLRenderTarget,
): SelectiveBloomCompositePass {
  return new ShaderPass(
    new THREE.ShaderMaterial({
      name: "SelectiveLampBloomComposite",
      uniforms: {
        baseTexture: { value: null },
        bloomIntensity: { value: 1 },
        bloomTexture: { value: getComposerBloomTexture(bloomComposer) },
        maskTexture: { value: maskRenderTarget.texture },
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D baseTexture;
        uniform float bloomIntensity;
        uniform sampler2D bloomTexture;
        uniform sampler2D maskTexture;
        varying vec2 vUv;

        void main() {
          vec4 baseColor = texture2D(baseTexture, vUv);
          vec4 bloomColor = texture2D(bloomTexture, vUv);
          vec3 maskColor = texture2D(maskTexture, vUv).rgb;
          float modelMask = smoothstep(0.02, 0.35, max(max(maskColor.r, maskColor.g), maskColor.b));
          gl_FragColor = baseColor + bloomColor * bloomIntensity * modelMask;
        }
      `,
    }),
    "baseTexture",
  ) as SelectiveBloomCompositePass;
}

function resizeSelectiveBloomMaskTarget(
  target: THREE.WebGLRenderTarget,
  width: number,
  height: number,
  pixelRatio: number,
) {
  target.setSize(
    Math.max(1, Math.floor(width * pixelRatio)),
    Math.max(1, Math.floor(height * pixelRatio)),
  );
}

function applyLampEmissionSettings(
  materials: THREE.MeshStandardMaterial[],
  texture: THREE.Texture | null,
  bloom: number,
  emissionStrength: number,
  emissionColor: EmissionColorKey,
) {
  const bloomLevel = THREE.MathUtils.clamp(getBloomSettingValue(bloom), 0, 3);
  const emissionLevel = THREE.MathUtils.clamp(
    getEmissionStrengthSettingValue(emissionStrength),
    0,
    8,
  );
  const selectedEmissionColor = getLampEmissionColor(emissionColor);

  materials.forEach((material) => {
    const materialState = material.userData as { studioLampEmissionMaterial?: boolean };
    materialState.studioLampEmissionMaterial = true;
    material.emissive.set(selectedEmissionColor);
    material.emissiveMap = texture;
    material.emissiveIntensity = texture ? bloomLevel * emissionLevel : 0;
    material.toneMapped = false;
    material.needsUpdate = true;
  });
}

function applyBloomPassSettings(
  bloomPass: UnrealBloomPass | null,
  compositePass: SelectiveBloomCompositePass | null,
  bloom: number,
  bloomRadius: number,
  bloomThreshold: number,
) {
  const bloomLevel = THREE.MathUtils.clamp(getBloomSettingValue(bloom), 0, 3);
  const bloomSpread = THREE.MathUtils.clamp(getBloomRadiusSettingValue(bloomRadius), 0, 1);
  const bloomCutoff = THREE.MathUtils.clamp(
    getBloomThresholdSettingValue(bloomThreshold),
    0,
    1,
  );

  if (!bloomPass) {
    if (compositePass) {
      compositePass.uniforms.bloomIntensity.value = 0;
    }

    return;
  }

  bloomPass.enabled = true;
  bloomPass.strength = bloomLevel;
  bloomPass.radius = bloomSpread;
  bloomPass.threshold = bloomCutoff;

  if (compositePass) {
    compositePass.uniforms.bloomIntensity.value = bloomLevel > 0 ? 1 : 0;
  }
}

function getEmissionOnlyMaterialReplacement(
  mesh: THREE.Mesh,
  emissionMaterial: THREE.Material,
  darkMaterial: THREE.Material,
) {
  const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const hasEmissionMaterial = meshMaterials.some(isLampEmissionMaterial);

  if (!hasEmissionMaterial) {
    return darkMaterial;
  }

  if (!Array.isArray(mesh.material)) {
    return emissionMaterial;
  }

  return meshMaterials.map((material) =>
    isLampEmissionMaterial(material) ? emissionMaterial : darkMaterial,
  );
}

function withSwappedMeshMaterials(
  scene: THREE.Scene,
  getMaterial: (mesh: THREE.Mesh) => THREE.Material | THREE.Material[] | null,
  render: () => void,
) {
  const originalMaterials: Array<{
    material: THREE.Material | THREE.Material[];
    mesh: THREE.Mesh;
  }> = [];

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;

    if (!mesh.isMesh || !mesh.material) {
      return;
    }

    const replacement = getMaterial(mesh);

    if (!replacement) {
      return;
    }

    originalMaterials.push({ material: mesh.material, mesh });
    mesh.material = replacement;
  });

  try {
    render();
  } finally {
    originalMaterials.forEach(({ material, mesh }) => {
      mesh.material = material;
    });
  }
}

function renderSelectiveModelBloom({
  bloom,
  bloomComposer,
  camera,
  darkMaterial,
  finalComposer,
  maskMaterial,
  maskRenderTarget,
  renderer,
  scene,
}: {
  bloom: number;
  bloomComposer: EffectComposer;
  camera: THREE.Camera;
  darkMaterial: THREE.Material;
  finalComposer: EffectComposer;
  maskMaterial: THREE.Material;
  maskRenderTarget: THREE.WebGLRenderTarget;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
}) {
  const bloomLevel = THREE.MathUtils.clamp(getBloomSettingValue(bloom), 0, 3);

  if (bloomLevel > 0) {
    const originalBackground = scene.background;
    scene.background = null;

    try {
      withSwappedMeshMaterials(
        scene,
        (mesh) => {
          const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const hasEmissionMaterial = meshMaterials.some(isLampEmissionMaterial);

          if (!hasEmissionMaterial) {
            return darkMaterial;
          }

          if (!Array.isArray(mesh.material)) {
            return null;
          }

          return meshMaterials.map((material) =>
            isLampEmissionMaterial(material) ? material : darkMaterial,
          );
        },
        () => bloomComposer.render(),
      );

      const previousRenderTarget = renderer.getRenderTarget();
      const previousClearColor = new THREE.Color();
      renderer.getClearColor(previousClearColor);
      const previousClearAlpha = renderer.getClearAlpha();

      withSwappedMeshMaterials(
        scene,
        (mesh) => getEmissionOnlyMaterialReplacement(mesh, maskMaterial, darkMaterial),
        () => {
          try {
            renderer.setRenderTarget(maskRenderTarget);
            renderer.setClearColor("#000000", 1);
            renderer.clear(true, true, true);
            renderer.render(scene, camera);
          } finally {
            renderer.setRenderTarget(previousRenderTarget);
            renderer.setClearColor(previousClearColor, previousClearAlpha);
          }
        },
      );
    } finally {
      scene.background = originalBackground;
    }
  }

  finalComposer.render();
}

function getTintedColor(baseColor: string, tintColor: string, amount: number) {
  return new THREE.Color(baseColor).lerp(new THREE.Color(tintColor), amount);
}

function getLampHeightDimensionText(lampHeight: string) {
  const heightMatch = lampHeight.match(/(\d+(?:\.\d+)?)\s*cm/i);

  return heightMatch ? `${heightMatch[1]}cm` : "90cm";
}

function getViewerDimensionHotspots(lampHeight: string): ViewerHotspot[] {
  return [
    {
      ...viewerDimensionAnchors[0],
      label: `H: ${getLampHeightDimensionText(lampHeight)}`,
    },
    {
      ...viewerDimensionAnchors[1],
      label: `B: ${baseDimensionText}`,
    },
  ];
}

function updateViewerHotspots({
  bounds,
  camera,
  container,
  elements,
  point,
  hotspots,
}: {
  bounds: THREE.Box3 | null;
  camera: THREE.PerspectiveCamera;
  container: HTMLElement;
  elements: Map<string, HTMLDivElement>;
  point: THREE.Vector3;
  hotspots: ViewerHotspot[];
}) {
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (!bounds || width <= 0 || height <= 0) {
    elements.forEach((element) => {
      element.style.opacity = "0";
      element.style.visibility = "hidden";
    });
    return;
  }

  hotspots.forEach((hotspot) => {
    const element = elements.get(hotspot.id);
    if (!element) {
      return;
    }

    point.set(
      THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, hotspot.anchor[0]),
      THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, hotspot.anchor[1]),
      THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, hotspot.anchor[2]),
    );
    point.project(camera);

    const screenX = (point.x * 0.5 + 0.5) * width;
    const screenY = (-point.y * 0.5 + 0.5) * height;
    const isVisible =
      point.z > -1 &&
      point.z < 1 &&
      screenX > -80 &&
      screenX < width + 80 &&
      screenY > -60 &&
      screenY < height + 60;

    element.style.opacity = isVisible ? "1" : "0";
    element.style.transform = `translate3d(${screenX}px, ${screenY}px, 0)`;
    element.style.visibility = isVisible ? "visible" : "hidden";
  });
}

function createHdriDomeMaterial(settings: ViewerSettings): HdriDomeMaterial {
  const material = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fog: false,
    fragmentShader: `
      uniform sampler2D hdriMap;
      uniform float hdriIntensity;
      uniform float hdriRotation;
      uniform float hdriScale;
      varying vec3 vWorldDirection;
      #include <common>

      void main() {
        vec3 direction = normalize(vWorldDirection);
        float rotationCos = cos(hdriRotation);
        float rotationSin = sin(hdriRotation);
        direction.xz = mat2(rotationCos, -rotationSin, rotationSin, rotationCos) * direction.xz;

        vec2 sampleUV = equirectUv(direction);
        float scale = clamp(hdriScale, 0.5, 2.5);
        sampleUV = (sampleUV - 0.5) / scale + 0.5;
        sampleUV.x = fract(sampleUV.x);
        sampleUV.y = clamp(sampleUV.y, 0.0, 1.0);

        gl_FragColor = texture2D(hdriMap, sampleUV);
        gl_FragColor.rgb *= hdriIntensity;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    uniforms: {
      hdriIntensity: { value: settings.hdriIntensity },
      hdriMap: { value: null },
      hdriRotation: { value: THREE.MathUtils.degToRad(settings.hdriRotation) },
      hdriScale: { value: settings.hdriScale },
    },
    vertexShader: `
      varying vec3 vWorldDirection;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldDirection = normalize(worldPosition.xyz - cameraPosition);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  });

  material.toneMapped = true;
  return material as HdriDomeMaterial;
}

function applyViewerEnvironment({
  backgroundMode,
  backdropMaterial,
  hdriBackgroundMap,
  defaultEnvironmentMap,
  hdriDome,
  hdriDomeMaterial,
  hdriEnvironmentMap,
  scene,
  viewerSettings,
}: {
  backgroundMode: BackgroundMode;
  backdropMaterial: THREE.MeshBasicMaterial | null;
  defaultEnvironmentMap: THREE.Texture | null;
  hdriBackgroundMap: THREE.Texture | null;
  hdriDome: THREE.Mesh<THREE.SphereGeometry, HdriDomeMaterial> | null;
  hdriDomeMaterial: HdriDomeMaterial | null;
  hdriEnvironmentMap: THREE.Texture | null;
  scene: THREE.Scene;
  viewerSettings: ViewerSettings;
}) {
  const hasHdri = backgroundMode === "hdri" && Boolean(hdriBackgroundMap && hdriEnvironmentMap);
  const environmentColor = new THREE.Color(viewerSettings.environmentColor);

  scene.environment = hasHdri ? hdriEnvironmentMap : defaultEnvironmentMap;
  scene.environmentIntensity = hasHdri
    ? viewerSettings.hdriIntensity
    : viewerSettings.environmentIntensity;
  scene.environmentRotation.y = THREE.MathUtils.degToRad(
    hasHdri ? viewerSettings.hdriRotation : viewerSettings.environmentRotation,
  );

  scene.background = null;
  scene.backgroundIntensity = 1;
  scene.backgroundRotation.y = 0;
  scene.backgroundBlurriness = 0;

  if (!(scene.fog instanceof THREE.Fog)) {
    scene.fog = new THREE.Fog(
      getTintedColor("#ffffff", viewerSettings.environmentColor, 0.38),
      7.5,
      16,
    );
  } else {
    scene.fog.color.copy(getTintedColor("#ffffff", viewerSettings.environmentColor, 0.38));
  }

  if (hdriDome) {
    hdriDome.visible = false;
    hdriDome.scale.setScalar(32 * viewerSettings.hdriScale);
  }

  if (hdriDomeMaterial) {
    hdriDomeMaterial.uniforms.hdriMap.value = null;
    hdriDomeMaterial.uniforms.hdriIntensity.value = Math.max(0.05, viewerSettings.hdriIntensity);
    hdriDomeMaterial.uniforms.hdriRotation.value = THREE.MathUtils.degToRad(
      viewerSettings.hdriRotation,
    );
    hdriDomeMaterial.uniforms.hdriScale.value = viewerSettings.hdriScale;
  }

  if (backdropMaterial) {
    backdropMaterial.color.copy(getTintedColor("#ffffff", viewerSettings.environmentColor, 0.36));
    backdropMaterial.opacity = viewerSettings.backdropGlow;
  }

  return environmentColor;
}

function prepareModelForViewport(model: THREE.Object3D, anisotropy = 1) {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = modelRenderOrder;

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => tuneStudioMaterial(material, anisotropy));
    } else if (mesh.material) {
      tuneStudioMaterial(mesh.material, anisotropy);
    }
  });
}

function prepareViewportModel(model: THREE.Object3D, anisotropy = 1, cameraX = startupCameraX) {
  prepareModelForViewport(model, anisotropy);

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  const viewportFit = 2.35;
  const scale = viewportFit / maxAxis;
  const group = new THREE.Group();

  model.position.sub(center);
  group.add(model);
  group.scale.setScalar(scale);
  group.position.y = modelGroundY - (bikeSourceGroundY - center.y) * scale;

  const look = new THREE.Vector3(cameraX, group.position.y + startupLookHeightOffset, 0);
  const camera = new THREE.Vector3(
    cameraX,
    group.position.y + startupCameraHeightOffset,
    startupCameraDistance,
  );

  return { camera, group, look, sourceCenter: center };
}

function prepareProductModelForViewport(model: THREE.Object3D, anisotropy = 1, cameraX = startupCameraX) {
  prepareModelForViewport(model, anisotropy);

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  const scale = productViewportFit / maxAxis;
  const group = new THREE.Group();

  model.position.sub(center);
  group.add(model);
  group.scale.setScalar(scale);
  group.position.y = modelGroundY - (bounds.min.y - center.y) * scale;

  const look = new THREE.Vector3(cameraX, group.position.y + productLookHeightOffset, 0);
  const camera = new THREE.Vector3(
    cameraX,
    group.position.y + productCameraHeightOffset,
    startupCameraDistance,
  );

  return { camera, group, look };
}

function prepareHomeSceneModel(model: THREE.Object3D, anisotropy = 1) {
  prepareModelForViewport(model, anisotropy);

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  const sceneFit = 6.8;
  const scale = sceneFit / maxAxis;
  const group = new THREE.Group();

  model.position.sub(center);
  group.add(model);
  group.name = "home-scene-01";
  group.scale.setScalar(scale);
  group.position.y = modelGroundY - (bounds.min.y - center.y) * scale;

  return group;
}

function prepareAttachedModel(
  model: THREE.Object3D,
  sourceCenter: THREE.Vector3,
  asset: ModelAsset,
  anisotropy = 1,
) {
  prepareModelForViewport(model, anisotropy);
  model.position.sub(sourceCenter);

  if (typeof asset.sourceGroundY === "number") {
    model.position.y += bikeSourceGroundY - asset.sourceGroundY;
  }

  return model;
}

function getModelAssetUrl(asset: ModelAsset) {
  return publicAsset(asset.path);
}

function getModelCacheKey(asset: ModelAsset, sourceCenter: THREE.Vector3) {
  const centerKey = sourceCenter
    .toArray()
    .map((value) => value.toFixed(4))
    .join(":");

  return `${asset.id}:${centerKey}`;
}

function getAddonAssetList(entry: ComponentAddonAssetEntry | undefined) {
  if (!entry) {
    return [];
  }

  return Array.isArray(entry) ? entry : [entry];
}

function getPreloadAddonAssets() {
  const assets = new Map<ModelAssetId, ModelAsset>();

  Object.values(componentAddonAssets).forEach((componentAssets) => {
    Object.values(componentAssets ?? {}).forEach((entry) => {
      getAddonAssetList(entry).forEach((asset) => {
        if (asset.preload) {
          assets.set(asset.id, asset);
        }
      });
    });
  });

  return Array.from(assets.values());
}

function getFrameSizeMorphValue(sizeId: string) {
  return frameSizeMorphValues[sizeId] ?? frameSizeMorphValues.S;
}

function getHandlebarSizeMorphValue(optionId: string) {
  return handlebarSizeMorphValues[optionId] ?? handlebarSizeMorphValues["handlebar-38-80"];
}

function getSeatAdjustmentMorphValue(optionId: string) {
  return seatAdjustmentMorphValues[optionId] ?? seatAdjustmentMorphValues["seat-low"];
}

function getObjectNameTrail(object: THREE.Object3D) {
  const names = [object.name];
  let parent = object.parent;

  while (parent) {
    names.push(parent.name);
    parent = parent.parent;
  }

  const mesh = object as THREE.Mesh;
  names.push(mesh.geometry?.name ?? "");

  return names.join(" ").toLowerCase();
}

function isBodyFrameMesh(mesh: THREE.Mesh) {
  if (typeof mesh.morphTargetDictionary?.Frame === "number") {
    return true;
  }

  const nameTrail = getObjectNameTrail(mesh);
  return (
    nameTrail.includes("body-frame") ||
    nameTrail.includes("body frame") ||
    nameTrail.includes("body_frame") ||
    nameTrail.includes("body-mesh") ||
    nameTrail.includes("body mesh") ||
    nameTrail.includes("cycle_combined") ||
    nameTrail.includes("cycle combined")
  );
}

function getPrimaryMorphTargetIndex(mesh: THREE.Mesh) {
  const frameIndex = mesh.morphTargetDictionary?.Frame;

  if (typeof frameIndex === "number") {
    return frameIndex;
  }

  const namedIndex = mesh.morphTargetDictionary?.["Key 1"];

  if (typeof namedIndex === "number") {
    return namedIndex;
  }

  const firstIndex = Object.values(mesh.morphTargetDictionary ?? {})[0];
  return typeof firstIndex === "number" ? firstIndex : 0;
}

function getNamedMorphTargetIndex(mesh: THREE.Mesh, targetName: string) {
  const targetIndex = mesh.morphTargetDictionary?.[targetName];
  return typeof targetIndex === "number" ? targetIndex : -1;
}

function collectFrameMorphMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (!mesh.isMesh || !mesh.morphTargetInfluences?.length || !isBodyFrameMesh(mesh)) {
      return;
    }

    meshes.push(mesh);
  });

  return meshes;
}

function cloneMaterialForPaintEditing(material: THREE.Material) {
  const clonedMaterial = material.clone();
  clonedMaterial.needsUpdate = true;
  return clonedMaterial;
}

function prepareBodyFramePaintMaterials(root: THREE.Object3D) {
  const materials: BodyFramePaintMaterial[] = [];

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (!mesh.isMesh || !mesh.material) {
      return;
    }

    const sourceMaterial = mesh.material;

    if (!sourceMaterial) {
      return;
    }

    const hasTargetMaterial = Array.isArray(sourceMaterial)
      ? sourceMaterial.some((material) => material.name === bodyFramePaintMaterialName)
      : sourceMaterial.name === bodyFramePaintMaterialName;

    if (!hasTargetMaterial) {
      return;
    }

    const clonedMaterial = Array.isArray(sourceMaterial)
      ? sourceMaterial.map((material) =>
          material.name === bodyFramePaintMaterialName
            ? cloneMaterialForPaintEditing(material)
            : material,
        )
      : cloneMaterialForPaintEditing(sourceMaterial);

    mesh.material = clonedMaterial;

    const meshMaterials = Array.isArray(clonedMaterial) ? clonedMaterial : [clonedMaterial];

    meshMaterials.forEach((material) => {
      const pbrMaterial = material as THREE.MeshStandardMaterial;

      if (pbrMaterial.name !== bodyFramePaintMaterialName || !("map" in pbrMaterial)) {
        return;
      }

      materials.push({
        defaultMap: pbrMaterial.map ?? null,
        material: pbrMaterial,
      });
    });
  });

  return materials;
}

function configureBodyFrameDiffuseTexture(texture: THREE.Texture, anisotropy: number) {
  texture.anisotropy = Math.min(anisotropy, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;
}

function applyBodyFramePaintTexture(
  materials: BodyFramePaintMaterial[],
  paintId: string,
  textures: Partial<Record<string, THREE.Texture>>,
) {
  const diffuseMapPath = bodyFrameDiffuseMaps[paintId];
  const diffuseMap = diffuseMapPath ? textures[paintId] : null;

  if (diffuseMapPath && !diffuseMap) {
    return false;
  }

  materials.forEach((paintMaterial) => {
    const { material } = paintMaterial;
    material.map = diffuseMap ?? paintMaterial.defaultMap;
    material.needsUpdate = true;
  });

  return materials.length > 0;
}

function collectHandleMorphMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (
      !mesh.isMesh ||
      !mesh.morphTargetInfluences?.length ||
      getNamedMorphTargetIndex(mesh, "Handle") < 0
    ) {
      return;
    }

    meshes.push(mesh);
  });

  return meshes;
}

function collectSeatMorphMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (
      !mesh.isMesh ||
      !mesh.morphTargetInfluences?.length ||
      getNamedMorphTargetIndex(mesh, "Seat") < 0
    ) {
      return;
    }

    meshes.push(mesh);
  });

  return meshes;
}

function applyFrameSizeMorph(meshes: THREE.Mesh[], sizeId: string) {
  const value = getFrameSizeMorphValue(sizeId);

  meshes.forEach((mesh) => {
    const influences = mesh.morphTargetInfluences;

    if (!influences?.length) {
      return;
    }

    const targetIndex = getPrimaryMorphTargetIndex(mesh);

    if (targetIndex >= 0 && targetIndex < influences.length) {
      influences[targetIndex] = value;
    }
  });
}

function applyHandlebarSizeMorph(meshes: THREE.Mesh[], optionId: string) {
  const value = getHandlebarSizeMorphValue(optionId);

  meshes.forEach((mesh) => {
    const influences = mesh.morphTargetInfluences;

    if (!influences?.length) {
      return;
    }

    const targetIndex = getNamedMorphTargetIndex(mesh, "Handle");

    if (targetIndex >= 0 && targetIndex < influences.length) {
      influences[targetIndex] = value;
    }
  });
}

function applySeatAdjustmentMorph(meshes: THREE.Mesh[], optionId: string) {
  const value = getSeatAdjustmentMorphValue(optionId);

  meshes.forEach((mesh) => {
    const influences = mesh.morphTargetInfluences;

    if (!influences?.length) {
      return;
    }

    const targetIndex = getNamedMorphTargetIndex(mesh, "Seat");

    if (targetIndex >= 0 && targetIndex < influences.length) {
      influences[targetIndex] = value;
    }
  });
}

function createStudioGradientTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 640;
  const context = canvas.getContext("2d");

  if (context) {
    const vertical = context.createLinearGradient(0, 0, 0, canvas.height);
    vertical.addColorStop(0, "#d9d7d2");
    vertical.addColorStop(0.44, "#c8cdcd");
    vertical.addColorStop(0.74, "#b9c0bf");
    vertical.addColorStop(1, "#9fa8a8");
    context.fillStyle = vertical;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const centerGlow = context.createRadialGradient(
      canvas.width * 0.5,
      canvas.height * 0.52,
      20,
      canvas.width * 0.5,
      canvas.height * 0.52,
      canvas.width * 0.52,
    );
    centerGlow.addColorStop(0, "rgba(255, 255, 255, 0.32)");
    centerGlow.addColorStop(0.45, "rgba(47, 131, 200, 0.08)");
    centerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = centerGlow;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const edgeShade = context.createLinearGradient(0, 0, canvas.width, 0);
    edgeShade.addColorStop(0, "rgba(16, 24, 33, 0.2)");
    edgeShade.addColorStop(0.32, "rgba(0, 0, 0, 0)");
    edgeShade.addColorStop(0.68, "rgba(0, 0, 0, 0)");
    edgeShade.addColorStop(1, "rgba(16, 24, 33, 0.24)");
    context.fillStyle = edgeShade;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFloorGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  if (context) {
    const glow = context.createRadialGradient(256, 256, 16, 256, 256, 248);
    glow.addColorStop(0, "rgba(255, 255, 245, 0.28)");
    glow.addColorStop(0.32, "rgba(47, 131, 200, 0.1)");
    glow.addColorStop(0.7, "rgba(47, 131, 200, 0.035)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createContactAoTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  if (context) {
    const drawSoftEllipse = (x: number, y: number, radiusX: number, radiusY: number, strength: number) => {
      context.save();
      context.translate(x, y);
      context.rotate(-0.05);
      context.scale(radiusX, radiusY);
      const shadow = context.createRadialGradient(0, 0, 0.02, 0, 0, 1);
      shadow.addColorStop(0, `rgba(255, 255, 255, ${strength})`);
      shadow.addColorStop(0.35, `rgba(255, 255, 255, ${strength * 0.48})`);
      shadow.addColorStop(0.72, `rgba(255, 255, 255, ${strength * 0.12})`);
      shadow.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = shadow;
      context.fillRect(-1, -1, 2, 2);
      context.restore();
    };

    drawSoftEllipse(384, 282, 345, 105, 0.42);
    drawSoftEllipse(220, 292, 138, 42, 0.34);
    drawSoftEllipse(548, 292, 146, 42, 0.34);
    drawSoftEllipse(382, 292, 118, 38, 0.22);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildStudioSurfaces(): StudioSurfaces {
  const group = new THREE.Group();
  const backdropTexture = createStudioGradientTexture();
  const floorGlowTexture = createFloorGlowTexture();
  const contactAoTexture = createContactAoTexture();

  const domeMaterial = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    depthTest: false,
    depthWrite: false,
    fog: false,
    side: THREE.BackSide,
    toneMapped: false,
  });
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(studioDomeRadius, 128, 64),
    domeMaterial,
  );
  dome.position.set(0, modelGroundY + 2.5, 0);
  dome.renderOrder = -200;
  group.add(dome);

  const contactAoMaterial = new THREE.MeshBasicMaterial({
    alphaMap: contactAoTexture,
    color: "#000000",
    depthTest: true,
    depthWrite: false,
    opacity: defaultViewerSettings.aoIntensity,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
    transparent: true,
  });
  const contactAo = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 0.82), contactAoMaterial);
  contactAo.rotation.x = -Math.PI / 2;
  contactAo.position.set(0, studioFloorY + 0.003, 0.16);
  contactAo.renderOrder = 1;
  group.add(contactAo);

  const floorGlowMaterial = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    map: floorGlowTexture,
    opacity: defaultViewerSettings.floorGlow,
    polygonOffset: true,
    polygonOffsetFactor: 3,
    polygonOffsetUnits: 3,
    transparent: true,
  });
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.52, 1.11), floorGlowMaterial);
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(0, studioFloorY + 0.005, 0.2);
  floorGlow.renderOrder = 2;
  group.add(floorGlow);

  const stageRingRadius = 0.92;
  const stageRingMaterial = new THREE.MeshBasicMaterial({
    color: "#c7a550",
    depthTest: true,
    depthWrite: false,
    opacity: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: 4,
    polygonOffsetUnits: 4,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const stageRing = new THREE.Mesh(
    new THREE.RingGeometry(stageRingRadius, stageRingRadius + 0.028, 192),
    stageRingMaterial,
  );
  stageRing.rotation.x = -Math.PI / 2;
  stageRing.position.y = studioFloorY + 0.007;
  stageRing.renderOrder = 3;
  group.add(stageRing);

  const stageRingHighlight = new THREE.Mesh(
    new THREE.RingGeometry(stageRingRadius - 0.004, stageRingRadius + 0.05, 96, 1, 0, Math.PI * 0.34),
    new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: "#f2d982",
      depthTest: true,
      depthWrite: false,
      opacity: 0.13,
      polygonOffset: true,
      polygonOffsetFactor: 5,
      polygonOffsetUnits: 5,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  stageRingHighlight.rotation.x = -Math.PI / 2;
  stageRingHighlight.position.y = studioFloorY + 0.009;
  stageRingHighlight.renderOrder = 4;
  group.add(stageRingHighlight);

  const backdropMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    map: backdropTexture,
    opacity: defaultViewerSettings.backdropGlow,
    toneMapped: false,
    transparent: true,
  });
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 10.5),
    backdropMaterial,
  );
  backdrop.position.set(0, 2.7, -5.6);
  backdrop.visible = false;
  group.add(backdrop);

  return {
    backdropMaterial,
    contactAo,
    contactAoMaterial,
    dome,
    domeMaterial,
    floorGlow,
    floorGlowMaterial,
    group,
    stageRing,
    stageRingMaterial,
    stageRingHighlight,
  };
}

export default function BikeScene({
  backgroundMode,
  config,
  focus,
  hdriAsset,
  homeSceneCameraCommand,
  homeSceneCameraPose,
  homeSceneCameraResetKey,
  introPhase,
  onIntroComplete,
  onHomeSceneCameraPoseChange,
  onSceneReady,
  selectedHomeScene,
  selectedLampHeight,
  selectedLampProduct,
  showLampModel,
  showHotspots,
  viewerSettings,
}: {
  backgroundMode: BackgroundMode;
  config: ConfigState;
  focus: string;
  hdriAsset: HdriAsset | null;
  homeSceneCameraCommand: HomeSceneCameraCommand | null;
  homeSceneCameraPose: HomeSceneCameraPose | null;
  homeSceneCameraResetKey: number;
  introPhase: IntroPhase;
  onIntroComplete: () => void;
  onHomeSceneCameraPoseChange: (pose: HomeSceneCameraPose) => void;
  onSceneReady: () => void;
  selectedHomeScene: HomeSceneId | null;
  selectedLampHeight: string;
  selectedLampProduct: LampProductId;
  showLampModel: boolean;
  showHotspots: boolean;
  viewerSettings: ViewerSettings;
}) {
  const dimensionHotspots = getViewerDimensionHotspots(selectedLampHeight);
  const shouldShowDimensions = showHotspots && showLampModel && !selectedHomeScene;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomComposerRef = useRef<EffectComposer | null>(null);
  const bloomMaskTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const bloomCompositePassRef = useRef<SelectiveBloomCompositePass | null>(null);
  const defaultEnvironmentMapRef = useRef<THREE.Texture | null>(null);
  const hdriBackgroundMapRef = useRef<THREE.Texture | null>(null);
  const hdriEnvironmentMapRef = useRef<THREE.Texture | null>(null);
  const hdriDomeRef = useRef<THREE.Mesh<THREE.SphereGeometry, HdriDomeMaterial> | null>(null);
  const hdriDomeMaterialRef = useRef<HdriDomeMaterial | null>(null);
  const bikeRef = useRef<THREE.Group | null>(null);
  const homeSceneRef = useRef<THREE.Group | null>(null);
  const frameMorphMeshesRef = useRef<THREE.Mesh[]>([]);
  const handleMorphMeshesRef = useRef<THREE.Mesh[]>([]);
  const seatMorphMeshesRef = useRef<THREE.Mesh[]>([]);
  const bodyFramePaintMaterialsRef = useRef<BodyFramePaintMaterial[]>([]);
  const bodyFrameDiffuseTexturesRef = useRef<Partial<Record<string, THREE.Texture>>>({});
  const activeAddonRefs = useRef(new Map<ComponentKey, THREE.Object3D>());
  const addonModelCacheRef = useRef(new Map<string, THREE.Object3D>());
  const addonModelLoadCacheRef = useRef(new Map<string, Promise<THREE.Object3D>>());
  const addonRequestCountersRef = useRef(new Map<ComponentKey, number>());
  const hotspotBoundsRef = useRef<THREE.Box3 | null>(null);
  const hotspotElementsRef = useRef(new Map<string, HTMLDivElement>());
  const hotspotProjectionPointRef = useRef(new THREE.Vector3());
  const dimensionHotspotsRef = useRef(dimensionHotspots);
  const shouldShowDimensionsRef = useRef(shouldShowDimensions);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const paintRef = useRef(config.paint);
  const sizeRef = useRef(config.size);
  const handlebarSizeRef = useRef(config.components.cockpit);
  const seatAdjustmentRef = useRef(config.components.seatAdjustment);
  const componentOptionsRef = useRef(config.components);
  const viewerSettingsRef = useRef(viewerSettings);
  const addonLoaderRef = useRef<GLTFLoader | null>(null);
  const anisotropyRef = useRef(1);
  const assetSourceCenterRef = useRef<THREE.Vector3 | null>(null);
  const syncAddonModelRef = useRef<(componentKey: ComponentKey, optionId: string) => void>(
    () => undefined,
  );
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const ambientLightRef = useRef<THREE.HemisphereLight | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.PointLight | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
  const modelMaterialsRef = useRef<THREE.Material[]>([]);
  const lampEmissionMaterialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const lampEmissionTexturesRef = useRef<Partial<Record<EmissionColorKey, THREE.Texture>>>({});
  const domeMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const floorGlowMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const contactAoMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const backdropMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const stageRingMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const stageRingHighlightMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const assetCameraRef = useRef<{ camera: THREE.Vector3; look: THREE.Vector3 } | null>(null);
  const viewportWidthRef = useRef(0);
  const modelLoadedRef = useRef(false);
  const fallbackRef = useRef(false);
  const targetCameraRef = useRef(
    new THREE.Vector3(startupCameraX, modelGroundY + startupCameraHeightOffset, startupCameraDistance),
  );
  const targetLookRef = useRef(
    new THREE.Vector3(startupCameraX, modelGroundY + startupLookHeightOffset, 0),
  );
  const lookRef = useRef(new THREE.Vector3(startupCameraX, modelGroundY + startupLookHeightOffset, 0));
  const introPhaseRef = useRef(introPhase);
  const introStartedRef = useRef(false);
  const introCompletedRef = useRef(false);
  const introStartTimeRef = useRef(0);
  const introBaseCameraRef = useRef<THREE.Vector3 | null>(null);
  const introBaseLookRef = useRef<THREE.Vector3 | null>(null);
  const lastHomeSceneCameraCommandIdRef = useRef(0);
  const onIntroCompleteRef = useRef(onIntroComplete);
  const onSceneReadyRef = useRef(onSceneReady);

  const refreshHotspotBounds = () => {
    const bike = bikeRef.current;

    if (!bike) {
      hotspotBoundsRef.current = null;
      return;
    }

    const bounds = new THREE.Box3().setFromObject(bike);
    const size = bounds.getSize(new THREE.Vector3());
    hotspotBoundsRef.current = size.lengthSq() > 0 ? bounds : null;
  };

  const applyHomeSceneCameraPose = useCallback(() => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!container || !camera || !controls || !selectedHomeScene || !homeSceneRef.current) {
      return false;
    }

    const pose = getHomeSceneCameraPose(homeSceneCameraPose);
    assetCameraRef.current = {
      camera: pose.camera.clone(),
      look: pose.look.clone(),
    };
    targetCameraRef.current.copy(pose.camera);
    targetLookRef.current.copy(pose.look);
    lookRef.current.copy(pose.look);
    camera.position.copy(pose.camera);
    camera.lookAt(pose.look);
    controls.target.copy(pose.look);
    controls.update();
    writeHomeSceneCameraData(container, camera, pose.look);

    return true;
  }, [homeSceneCameraPose, selectedHomeScene]);

  useEffect(() => {
    introPhaseRef.current = introPhase;

    if (introPhase === "loading") {
      introStartedRef.current = false;
      introCompletedRef.current = false;
      introBaseCameraRef.current = null;
      introBaseLookRef.current = null;
    }
  }, [introPhase]);

  useEffect(() => {
    onIntroCompleteRef.current = onIntroComplete;
  }, [onIntroComplete]);

  useEffect(() => {
    onSceneReadyRef.current = onSceneReady;
  }, [onSceneReady]);

  useEffect(() => {
    dimensionHotspotsRef.current = getViewerDimensionHotspots(selectedLampHeight);
  }, [selectedLampHeight]);

  useEffect(() => {
    shouldShowDimensionsRef.current = shouldShowDimensions;
  }, [shouldShowDimensions]);

  useEffect(() => {
    if (!showHotspots) {
      const frame = window.requestAnimationFrame(() => setActiveHotspotId(null));

      return () => window.cancelAnimationFrame(frame);
    }

    return undefined;
  }, [showHotspots]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const addonModelCache = addonModelCacheRef.current;
    const addonModelLoadCache = addonModelLoadCacheRef.current;
    const addonRequestCounters = addonRequestCountersRef.current;
    const hotspotElements = hotspotElementsRef.current;
    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(
      getTintedColor("#ffffff", viewerSettingsRef.current.environmentColor, 0.38),
      7.5,
      16,
    );
    sceneRef.current = scene;

    const initialCameraX = getStartupCameraX(container.clientWidth || window.innerWidth);
    viewportWidthRef.current = container.clientWidth || window.innerWidth;
    targetCameraRef.current.set(
      initialCameraX,
      modelGroundY + startupCameraHeightOffset,
      startupCameraDistance,
    );
    targetLookRef.current.set(initialCameraX, modelGroundY + startupLookHeightOffset, 0);
    lookRef.current.set(initialCameraX, modelGroundY + startupLookHeightOffset, 0);

    const initialSettings = viewerSettingsRef.current;
    const camera = new THREE.PerspectiveCamera(initialSettings.cameraFov, 1, 0.1, 100);
    camera.position.set(initialCameraX, modelGroundY + startupCameraHeightOffset, startupCameraDistance);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    rendererRef.current = renderer;
    anisotropyRef.current = renderer.capabilities.getMaxAnisotropy();
    renderer.setClearColor("#ffffff", 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = toneMappingValues[initialSettings.toneMapping];
    renderer.toneMappingExposure = initialSettings.exposure;
    const initialPixelRatio = getEffectivePixelRatio(
      initialSettings.pixelRatio,
      container.clientWidth || window.innerWidth,
    );
    renderer.setPixelRatio(initialPixelRatio);
    renderer.shadowMap.enabled = initialSettings.shadows;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    container.appendChild(renderer.domElement);

    const bloomComposer = new EffectComposer(renderer);
    const bloomRenderPass = new RenderPass(scene, camera);
    const initialBloom = getBloomSettingValue(initialSettings.bloom);
    const bloomMaskTarget = new THREE.WebGLRenderTarget(1, 1);
    bloomMaskTarget.texture.name = "SelectiveLampBloom.mask";
    bloomMaskTarget.texture.generateMipmaps = false;
    resizeSelectiveBloomMaskTarget(
      bloomMaskTarget,
      container.clientWidth || 1,
      container.clientHeight || 1,
      initialPixelRatio,
    );
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth || 1, container.clientHeight || 1),
      initialBloom,
      getBloomRadiusSettingValue(initialSettings.bloomRadius),
      getBloomThresholdSettingValue(initialSettings.bloomThreshold),
    );
    bloomComposer.renderToScreen = false;
    bloomComposer.setPixelRatio(initialPixelRatio);
    bloomComposer.addPass(bloomRenderPass);
    bloomComposer.addPass(bloomPass);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const bloomCompositePass = createSelectiveBloomCompositePass(bloomComposer, bloomMaskTarget);
    const outputPass = new OutputPass();
    composer.setPixelRatio(initialPixelRatio);
    composer.addPass(renderPass);
    composer.addPass(bloomCompositePass);
    composer.addPass(outputPass);
    composerRef.current = composer;
    bloomComposerRef.current = bloomComposer;
    bloomMaskTargetRef.current = bloomMaskTarget;
    bloomPassRef.current = bloomPass;
    bloomCompositePassRef.current = bloomCompositePass;
    applyBloomPassSettings(
      bloomPass,
      bloomCompositePass,
      initialBloom,
      initialSettings.bloomRadius,
      initialSettings.bloomThreshold,
    );

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const studioEnvironment = new RoomEnvironment();
    const environmentMap = pmremGenerator.fromScene(studioEnvironment, 0.04).texture;
    defaultEnvironmentMapRef.current = environmentMap;
    scene.environment = environmentMap;
    scene.environmentIntensity = initialSettings.environmentIntensity;
    scene.environmentRotation.y = THREE.MathUtils.degToRad(initialSettings.environmentRotation);
    studioEnvironment.dispose();
    pmremGenerator.dispose();

    const hdriDomeMaterial = createHdriDomeMaterial(initialSettings);
    const hdriDome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 48),
      hdriDomeMaterial,
    );
    hdriDome.renderOrder = -100;
    hdriDome.visible = false;
    hdriDome.scale.setScalar(32 * initialSettings.hdriScale);
    hdriDomeRef.current = hdriDome;
    hdriDomeMaterialRef.current = hdriDomeMaterial;
    scene.add(hdriDome);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.maxDistance = 12;
    controls.minDistance = 1.2;
    controls.panSpeed = 0.55;
    controls.rotateSpeed = 0.65;
    controls.screenSpacePanning = true;
    controls.target.copy(lookRef.current);
    controls.update();
    controlsRef.current = controls;

    const ambient = new THREE.HemisphereLight("#f7f1e4", "#151615", initialSettings.ambientIntensity);
    ambientLightRef.current = ambient;
    scene.add(ambient);

    const key = new THREE.DirectionalLight("#ffffff", initialSettings.keyIntensity);
    key.position.set(3.4, 5.2, 3.6);
    key.castShadow = initialSettings.shadows;
    key.shadow.bias = -0.00008;
    key.shadow.blurSamples = initialSettings.vsmBlurSamples;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.normalBias = 0.025;
    const keyShadowCamera = key.shadow.camera as THREE.OrthographicCamera;
    keyShadowCamera.left = -5;
    keyShadowCamera.right = 5;
    keyShadowCamera.top = 5;
    keyShadowCamera.bottom = -5;
    keyShadowCamera.near = 0.4;
    keyShadowCamera.far = 18;
    keyShadowCamera.updateProjectionMatrix();
    keyLightRef.current = key;
    scene.add(key);

    const rim = new THREE.DirectionalLight("#f1413c", initialSettings.rimIntensity);
    rim.position.set(-4, 2.4, -3);
    rimLightRef.current = rim;
    scene.add(rim);

    const fill = new THREE.PointLight("#f7f1e4", initialSettings.fillIntensity, 7);
    fill.position.set(-1.5, 1.8, 2.8);
    fillLightRef.current = fill;
    scene.add(fill);

    const studioSurfaces = buildStudioSurfaces();
    domeMaterialRef.current = studioSurfaces.domeMaterial;
    floorGlowMaterialRef.current = studioSurfaces.floorGlowMaterial;
    contactAoMaterialRef.current = studioSurfaces.contactAoMaterial;
    backdropMaterialRef.current = studioSurfaces.backdropMaterial;
    stageRingMaterialRef.current = studioSurfaces.stageRingMaterial;
    stageRingHighlightMaterialRef.current = studioSurfaces.stageRingHighlight.material;
    scene.add(studioSurfaces.group);

    const selectiveBloomDarkMaterial = new THREE.MeshBasicMaterial({ color: "#000000" });
    selectiveBloomDarkMaterial.toneMapped = false;
    const selectiveBloomMaskMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    selectiveBloomMaskMaterial.toneMapped = false;

    let cancelled = false;
    const emissionTextureLoader = new THREE.TextureLoader();
    (Object.entries(lampEmissionTextureUrls) as Array<[EmissionColorKey, string]>).forEach(
      ([emissionColor, textureUrl]) => {
        emissionTextureLoader.load(
          textureUrl,
          (texture) => {
            if (cancelled) {
              texture.dispose();
              return;
            }

            configureLampEmissionTexture(texture, anisotropyRef.current);
            lampEmissionTexturesRef.current[emissionColor] = texture;
            const activeEmissionColor = viewerSettingsRef.current.emissionColor;
            const activeEmissionTexture = getLampEmissionTexture(
              lampEmissionTexturesRef.current,
              activeEmissionColor,
            );
            applyLampEmissionSettings(
              lampEmissionMaterialsRef.current,
              activeEmissionTexture,
              viewerSettingsRef.current.bloom,
              viewerSettingsRef.current.emissionStrength,
              activeEmissionColor,
            );
            container.dataset.emissionMap = activeEmissionTexture
              ? getLampEmissionTextureName(activeEmissionColor)
              : "pending";
            container.dataset.emissionColor = activeEmissionColor;
            container.dataset.emissionSlot = lampEmissionMaterialsRef.current.length
              ? lampEmissionMaterialsRef.current.map((material) => material.name).join(",")
              : "pending";
          },
          undefined,
          () => {
            if (!cancelled && viewerSettingsRef.current.emissionColor === emissionColor) {
              container.dataset.emissionMap = "load-error";
            }
          },
        );
      },
    );

    const refreshModelMaterials = () => {
      modelMaterialsRef.current = bikeRef.current ? collectModelMaterials(bikeRef.current) : [];
      applyModelAmbientOcclusion(modelMaterialsRef.current, viewerSettingsRef.current.modelAoIntensity);
    };

    const detachActiveAddonModels = () => {
      activeAddonRefs.current.forEach((addon) => {
        addon.parent?.remove(addon);
      });
      activeAddonRefs.current.clear();
    };

    const replaceBike = (nextBike: THREE.Group) => {
      if (bikeRef.current) {
        detachActiveAddonModels();
        scene.remove(bikeRef.current);
        disposeObject(bikeRef.current);
      }

      bikeRef.current = nextBike;
      refreshModelMaterials();
      scene.add(nextBike);
      refreshHotspotBounds();
    };

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(publicAsset("draco/gltf/", { version: false }));

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    addonLoaderRef.current = loader;
    let preloadTimer: number | undefined;

    const removeAddonModel = (componentKey: ComponentKey) => {
      const addon = activeAddonRefs.current.get(componentKey);

      if (!addon) {
        return;
      }

      addon.parent?.remove(addon);
      activeAddonRefs.current.delete(componentKey);
      refreshModelMaterials();
      refreshHotspotBounds();
    };

    const loadCachedAddonModel = (
      asset: ModelAsset,
      sourceCenter: THREE.Vector3,
    ): Promise<THREE.Object3D> => {
      const cacheKey = getModelCacheKey(asset, sourceCenter);
      const cachedModel = addonModelCacheRef.current.get(cacheKey);

      if (cachedModel) {
        return Promise.resolve(cachedModel);
      }

      const pendingModel = addonModelLoadCacheRef.current.get(cacheKey);

      if (pendingModel) {
        return pendingModel;
      }

      if (!addonLoaderRef.current) {
        return Promise.reject(new Error("3D add-on loader is not ready."));
      }

      const modelPromise = new Promise<THREE.Object3D>((resolve, reject) => {
        addonLoaderRef.current?.load(
          getModelAssetUrl(asset),
          (gltf) => {
            if (cancelled) {
              disposeObject(gltf.scene);
              reject(new Error("3D add-on load was cancelled."));
              return;
            }

            const addon = prepareAttachedModel(gltf.scene, sourceCenter, asset, anisotropyRef.current);
            addon.name = `addon-${asset.id}`;
            addonModelCacheRef.current.set(cacheKey, addon);
            resolve(addon);
          },
          undefined,
          reject,
        );
      }).finally(() => {
        addonModelLoadCacheRef.current.delete(cacheKey);
      });

      addonModelLoadCacheRef.current.set(cacheKey, modelPromise);
      return modelPromise;
    };

    const syncAddonModel = (componentKey: ComponentKey, optionId: string) => {
      const assets = getAddonAssetList(componentAddonAssets[componentKey]?.[optionId]);
      const requestId = (addonRequestCountersRef.current.get(componentKey) ?? 0) + 1;
      addonRequestCountersRef.current.set(componentKey, requestId);
      removeAddonModel(componentKey);

      if (assets.length === 0 || !bikeRef.current || !assetSourceCenterRef.current) {
        return;
      }

      const sourceCenter = assetSourceCenterRef.current.clone();

      Promise.all(assets.map((asset) => loadCachedAddonModel(asset, sourceCenter.clone())))
        .then((addons) => {
          if (
            cancelled ||
            requestId !== addonRequestCountersRef.current.get(componentKey) ||
            componentOptionsRef.current[componentKey] !== optionId ||
            !bikeRef.current
          ) {
            return;
          }

          const addonGroup = new THREE.Group();
          addonGroup.name = `addon-${componentKey}-${optionId}`;
          addons.forEach((addon) => addonGroup.add(addon));
          activeAddonRefs.current.set(componentKey, addonGroup);
          bikeRef.current.add(addonGroup);
          refreshModelMaterials();
          refreshHotspotBounds();
        })
        .catch(() => {
          if (requestId === addonRequestCountersRef.current.get(componentKey)) {
            activeAddonRefs.current.delete(componentKey);
          }
        });
    };

    const preloadAddonModels = () => {
      const sourceCenter = assetSourceCenterRef.current;

      if (!sourceCenter) {
        return;
      }

      getPreloadAddonAssets().forEach((asset) => {
        loadCachedAddonModel(asset, sourceCenter.clone()).catch(() => undefined);
      });
    };

    syncAddonModelRef.current = syncAddonModel;

    if (loadExternalGlbModels) {
      loader.load(
        bikeModelUrl,
        (gltf) => {
          if (cancelled) {
            return;
          }

          const { camera: assetCamera, group, look, sourceCenter } = prepareViewportModel(
            gltf.scene,
            anisotropyRef.current,
            getStartupCameraX(container.clientWidth || window.innerWidth),
          );
          modelLoadedRef.current = true;
          fallbackRef.current = false;
          assetSourceCenterRef.current = sourceCenter;
          assetCameraRef.current = { camera: assetCamera, look };
          targetCameraRef.current.copy(assetCamera);
          targetLookRef.current.copy(look);
          lookRef.current.copy(look);
          camera.position.copy(assetCamera);
          controls.target.copy(look);
          controls.update();
          frameMorphMeshesRef.current = collectFrameMorphMeshes(group);
          bodyFramePaintMaterialsRef.current = prepareBodyFramePaintMaterials(group);
          handleMorphMeshesRef.current = collectHandleMorphMeshes(group);
          seatMorphMeshesRef.current = collectSeatMorphMeshes(group);
          applyFrameSizeMorph(frameMorphMeshesRef.current, sizeRef.current);
          applyHandlebarSizeMorph(handleMorphMeshesRef.current, handlebarSizeRef.current);
          applySeatAdjustmentMorph(seatMorphMeshesRef.current, seatAdjustmentRef.current);
          applyBodyFramePaintTexture(
            bodyFramePaintMaterialsRef.current,
            paintRef.current,
            bodyFrameDiffuseTexturesRef.current,
          );
          container.dataset.viewerModel = "bike";
          delete container.dataset.viewerHeight;
          replaceBike(group);
          syncAddonModel("groupset", componentOptionsRef.current.groupset);
          syncAddonModel("pedals", componentOptionsRef.current.pedals);
          syncAddonModel("storage", componentOptionsRef.current.storage);
          syncAddonModel("wheel", componentOptionsRef.current.wheel);
          preloadTimer = window.setTimeout(preloadAddonModels, 450);
          onSceneReadyRef.current();
        },
        undefined,
        () => {
          if (cancelled) {
            return;
          }

          fallbackRef.current = true;
          frameMorphMeshesRef.current = [];
          bodyFramePaintMaterialsRef.current = [];
          handleMorphMeshesRef.current = [];
          seatMorphMeshesRef.current = [];
          assetSourceCenterRef.current = null;
          container.dataset.viewerModel = "fallback-bike";
          delete container.dataset.viewerHeight;
          replaceBike(buildBike(defaultConfig, "default"));
          onSceneReadyRef.current();
        },
      );
    } else {
      fallbackRef.current = false;
      frameMorphMeshesRef.current = [];
      bodyFramePaintMaterialsRef.current = [];
      handleMorphMeshesRef.current = [];
      seatMorphMeshesRef.current = [];
      assetSourceCenterRef.current = null;
      container.dataset.viewerModel = "lamp-pending";
      delete container.dataset.viewerHeight;
    }

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      viewportWidthRef.current = clientWidth;
      const effectivePixelRatio = getEffectivePixelRatio(
        viewerSettingsRef.current.pixelRatio,
        clientWidth,
      );
      renderer.setPixelRatio(effectivePixelRatio);
      renderer.setSize(clientWidth, clientHeight);
      composer.setPixelRatio(effectivePixelRatio);
      composer.setSize(clientWidth, clientHeight);
      bloomComposer.setPixelRatio(effectivePixelRatio);
      bloomComposer.setSize(clientWidth, clientHeight);
      resizeSelectiveBloomMaskTarget(
        bloomMaskTarget,
        clientWidth,
        clientHeight,
        effectivePixelRatio,
      );
      camera.fov = clientWidth < 560 ? Math.max(viewerSettingsRef.current.cameraFov, 40) : viewerSettingsRef.current.cameraFov;
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
      controls.update();
    };

    window.addEventListener("resize", resize);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(container);
    resize();

    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const activeCamera = cameraRef.current;
      const elapsed = clock.getElapsedTime();

      if (introPhaseRef.current === "cinematic" && activeCamera) {
        if (!introStartedRef.current) {
          introStartedRef.current = true;
          introStartTimeRef.current = elapsed;
          introBaseCameraRef.current = targetCameraRef.current.clone();
          introBaseLookRef.current = targetLookRef.current.clone();

          if (controlsRef.current) {
            controlsRef.current.enabled = false;
          }
        }

        const baseCamera = introBaseCameraRef.current ?? targetCameraRef.current;
        const baseLook = introBaseLookRef.current ?? targetLookRef.current;
        const duration = 0.85;
        const progress = THREE.MathUtils.clamp((elapsed - introStartTimeRef.current) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const orbitOffset = baseCamera.clone().sub(baseLook);
        const revealAngle = THREE.MathUtils.degToRad(30 * (1 - eased));
        const revealDistance = THREE.MathUtils.lerp(1.08, 1, eased);
        const rotatedOffset = orbitOffset
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), revealAngle)
          .multiplyScalar(revealDistance);

        activeCamera.position.copy(baseLook).add(rotatedOffset);
        activeCamera.position.y = THREE.MathUtils.lerp(baseCamera.y + 0.16, baseCamera.y, eased);
        lookRef.current.copy(baseLook);
        activeCamera.lookAt(baseLook);

        if (controlsRef.current) {
          controlsRef.current.target.copy(baseLook);
          controlsRef.current.update();
        }

        if (progress >= 1 && !introCompletedRef.current) {
          introCompletedRef.current = true;
          activeCamera.position.copy(baseCamera);
          activeCamera.lookAt(baseLook);
          targetCameraRef.current.copy(baseCamera);
          targetLookRef.current.copy(baseLook);

          if (controlsRef.current) {
            controlsRef.current.enabled = true;
            controlsRef.current.target.copy(baseLook);
            controlsRef.current.update();
          }

          onIntroCompleteRef.current();
        }
      } else if (controlsRef.current) {
        controlsRef.current.enabled = true;
        controlsRef.current.update();
      } else if (activeCamera) {
        activeCamera.position.lerp(targetCameraRef.current, 0.065);
        lookRef.current.lerp(targetLookRef.current, 0.07);
        activeCamera.lookAt(lookRef.current);
      }

      if (activeCamera) {
        const shouldShowDimensionsOverlay = shouldShowDimensionsRef.current;
        updateViewerHotspots({
          bounds: shouldShowDimensionsOverlay ? hotspotBoundsRef.current : null,
          camera: activeCamera,
          container,
          elements: hotspotElements,
          hotspots: dimensionHotspotsRef.current,
          point: hotspotProjectionPointRef.current,
        });
      }

      studioSurfaces.stageRingHighlight.rotation.z = elapsed * 0.22;

      const finalComposer = composerRef.current;
      const activeBloomComposer = bloomComposerRef.current;
      const activeMaskTarget = bloomMaskTargetRef.current;

      if (finalComposer && activeBloomComposer && activeMaskTarget && activeCamera) {
        renderSelectiveModelBloom({
          bloom: viewerSettingsRef.current.bloom,
          bloomComposer: activeBloomComposer,
          camera: activeCamera,
          darkMaterial: selectiveBloomDarkMaterial,
          finalComposer,
          maskMaterial: selectiveBloomMaskMaterial,
          maskRenderTarget: activeMaskTarget,
          renderer,
          scene,
        });
      }
    };

    animate();

    return () => {
      cancelled = true;
      if (preloadTimer) {
        window.clearTimeout(preloadTimer);
      }
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      resizeObserver?.disconnect();
      detachActiveAddonModels();
      if (bikeRef.current) {
        disposeObject(bikeRef.current);
      }
      if (homeSceneRef.current) {
        disposeObject(homeSceneRef.current);
      }
      if (hdriDomeRef.current) {
        disposeObject(hdriDomeRef.current);
      }
      addonModelCache.forEach((addon) => disposeObject(addon));
      addonModelCache.clear();
      addonModelLoadCache.clear();
      addonRequestCounters.clear();
      disposeObject(studioSurfaces.group);
      hdriBackgroundMapRef.current?.dispose();
      hdriBackgroundMapRef.current = null;
      hdriEnvironmentMapRef.current?.dispose();
      hdriEnvironmentMapRef.current = null;
      hdriDomeRef.current = null;
      hdriDomeMaterialRef.current = null;
      frameMorphMeshesRef.current = [];
      bodyFramePaintMaterialsRef.current = [];
      Object.values(bodyFrameDiffuseTexturesRef.current).forEach((texture) => texture?.dispose());
      bodyFrameDiffuseTexturesRef.current = {};
      handleMorphMeshesRef.current = [];
      seatMorphMeshesRef.current = [];
      homeSceneRef.current = null;
      lampEmissionMaterialsRef.current = [];
      Object.values(lampEmissionTexturesRef.current).forEach((texture) => texture?.dispose());
      lampEmissionTexturesRef.current = {};
      rendererRef.current = null;
      composerRef.current = null;
      bloomComposerRef.current = null;
      bloomMaskTargetRef.current = null;
      bloomPassRef.current = null;
      bloomCompositePassRef.current = null;
      ambientLightRef.current = null;
      keyLightRef.current = null;
      fillLightRef.current = null;
      rimLightRef.current = null;
      modelMaterialsRef.current = [];
      domeMaterialRef.current = null;
      floorGlowMaterialRef.current = null;
      contactAoMaterialRef.current = null;
      backdropMaterialRef.current = null;
      stageRingMaterialRef.current = null;
      stageRingHighlightMaterialRef.current = null;
      environmentMap.dispose();
      defaultEnvironmentMapRef.current = null;
      syncAddonModelRef.current = () => undefined;
      addonLoaderRef.current = null;
      assetSourceCenterRef.current = null;
      hotspotBoundsRef.current = null;
      hotspotElements.clear();
      controls.dispose();
      controlsRef.current = null;
      dracoLoader.dispose();
      delete container.dataset.viewerModel;
      delete container.dataset.viewerHeight;
      delete container.dataset.homeScene;
      delete container.dataset.homeSceneMode;
      delete container.dataset.homeSceneCamera;
      delete container.dataset.homeSceneCameraRotation;
      delete container.dataset.homeSceneCameraReset;
      delete container.dataset.homeSceneLook;
      delete container.dataset.bloom;
      delete container.dataset.bloomScope;
      delete container.dataset.effectivePixelRatio;
      delete container.dataset.emissionColor;
      delete container.dataset.emissionMap;
      delete container.dataset.emissionSlot;
      selectiveBloomDarkMaterial.dispose();
      selectiveBloomMaskMaterial.dispose();
      bloomMaskTarget.dispose();
      bloomCompositePass.dispose();
      outputPass.dispose();
      bloomPass.dispose();
      bloomComposer.dispose();
      composer.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      scene.clear();
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const container = containerRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!scene || !container || !camera || !controls) {
      return undefined;
    }

    if (!selectedHomeScene) {
      if (homeSceneRef.current) {
        scene.remove(homeSceneRef.current);
        disposeObject(homeSceneRef.current);
        homeSceneRef.current = null;
      }

      delete container.dataset.homeScene;
      delete container.dataset.homeSceneMode;
      delete container.dataset.homeSceneCamera;
      delete container.dataset.homeSceneCameraRotation;
      delete container.dataset.homeSceneCameraReset;
      delete container.dataset.homeSceneLook;
      return undefined;
    }

    activeAddonRefs.current.forEach((addon) => addon.parent?.remove(addon));
    activeAddonRefs.current.clear();
    if (bikeRef.current) {
      scene.remove(bikeRef.current);
      disposeObject(bikeRef.current);
      bikeRef.current = null;
    }
    modelLoadedRef.current = false;
    fallbackRef.current = false;
    assetSourceCenterRef.current = null;
    assetCameraRef.current = null;
    frameMorphMeshesRef.current = [];
    bodyFramePaintMaterialsRef.current = [];
    handleMorphMeshesRef.current = [];
    seatMorphMeshesRef.current = [];
    modelMaterialsRef.current = [];
    lampEmissionMaterialsRef.current = [];
    refreshHotspotBounds();
    container.dataset.viewerModel = `${selectedHomeScene}-loading`;
    container.dataset.homeSceneMode = "scene-only";
    delete container.dataset.viewerHeight;
    delete container.dataset.emissionColor;
    delete container.dataset.emissionSlot;
    delete container.dataset.homeSceneCamera;
    delete container.dataset.homeSceneCameraRotation;
    delete container.dataset.homeSceneCameraReset;
    delete container.dataset.homeSceneLook;

    const homeSceneUrl = homeSceneModelUrls[selectedHomeScene];

    if (!homeSceneUrl) {
      container.dataset.homeScene = "missing";
      return undefined;
    }

    let cancelled = false;
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(publicAsset("draco/gltf/", { version: false }));

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    container.dataset.homeScene = `${selectedHomeScene}-loading`;

    loader.load(
      homeSceneUrl,
      (gltf) => {
        if (cancelled) {
          disposeObject(gltf.scene);
          return;
        }

        if (homeSceneRef.current) {
          scene.remove(homeSceneRef.current);
          disposeObject(homeSceneRef.current);
        }

        const homeScene = prepareHomeSceneModel(gltf.scene, anisotropyRef.current);
        homeSceneRef.current = homeScene;
        scene.add(homeScene);
        applyHomeSceneCameraPose();
        container.dataset.homeScene = selectedHomeScene;
        container.dataset.viewerModel = selectedHomeScene;
        container.dataset.homeSceneCameraReset = "loaded";
        onSceneReadyRef.current();
      },
      undefined,
      () => {
        if (!cancelled) {
          container.dataset.homeScene = `${selectedHomeScene}-load-error`;
          onSceneReadyRef.current();
        }
      },
    );

    return () => {
      cancelled = true;
      dracoLoader.dispose();
    };
  }, [applyHomeSceneCameraPose, selectedHomeScene]);

  useEffect(() => {
    const container = containerRef.current;

    if (!selectedHomeScene || !container || !homeSceneRef.current) {
      return;
    }

    if (applyHomeSceneCameraPose()) {
      container.dataset.homeSceneCameraReset = String(homeSceneCameraResetKey);
    }
  }, [applyHomeSceneCameraPose, homeSceneCameraResetKey, selectedHomeScene]);

  useEffect(() => {
    if (!homeSceneCameraCommand || !selectedHomeScene || !homeSceneRef.current) {
      return;
    }

    const container = containerRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!container || !camera || !controls) {
      return;
    }

    if (lastHomeSceneCameraCommandIdRef.current === homeSceneCameraCommand.id) {
      return;
    }

    lastHomeSceneCameraCommandIdRef.current = homeSceneCameraCommand.id;

    if (homeSceneCameraCommand.action === "save") {
      onHomeSceneCameraPoseChange(captureHomeSceneCameraPose(camera, controls));
      return;
    }

    const offset = camera.position.clone().sub(controls.target);
    const distance = Math.max(offset.length(), 0.1);
    const forward = controls.target.clone().sub(camera.position).normalize();
    const cameraUp = camera.up.clone().normalize();
    const right = new THREE.Vector3().crossVectors(forward, cameraUp).normalize();

    if (right.lengthSq() < 0.0001) {
      right.set(1, 0, 0);
    }

    const panStep = Math.max(distance * 0.045, 0.08);
    const zoomStep = Math.max(distance * 0.09, 0.18);
    const orbitStep = THREE.MathUtils.degToRad(3.5);
    const tiltStep = THREE.MathUtils.degToRad(2.5);

    switch (homeSceneCameraCommand.action) {
      case "pan-left":
        camera.position.addScaledVector(right, -panStep);
        controls.target.addScaledVector(right, -panStep);
        break;
      case "pan-right":
        camera.position.addScaledVector(right, panStep);
        controls.target.addScaledVector(right, panStep);
        break;
      case "pan-up":
        camera.position.addScaledVector(cameraUp, panStep);
        controls.target.addScaledVector(cameraUp, panStep);
        break;
      case "pan-down":
        camera.position.addScaledVector(cameraUp, -panStep);
        controls.target.addScaledVector(cameraUp, -panStep);
        break;
      case "orbit-left":
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), orbitStep);
        camera.position.copy(controls.target).add(offset);
        break;
      case "orbit-right":
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), -orbitStep);
        camera.position.copy(controls.target).add(offset);
        break;
      case "tilt-up":
        offset.applyAxisAngle(right, tiltStep);
        camera.position.copy(controls.target).add(offset);
        break;
      case "tilt-down":
        offset.applyAxisAngle(right, -tiltStep);
        camera.position.copy(controls.target).add(offset);
        break;
      case "zoom-in":
        camera.position.addScaledVector(forward, Math.min(zoomStep, Math.max(distance - 0.45, 0)));
        break;
      case "zoom-out":
        camera.position.addScaledVector(forward, -zoomStep);
        break;
      default:
        break;
    }

    lookRef.current.copy(controls.target);
    targetCameraRef.current.copy(camera.position);
    targetLookRef.current.copy(controls.target);
    assetCameraRef.current = {
      camera: camera.position.clone(),
      look: controls.target.clone(),
    };
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    controls.update();
    writeHomeSceneCameraData(container, camera, controls.target);
    container.dataset.homeSceneCameraCommand = `${homeSceneCameraCommand.action}:${homeSceneCameraCommand.id}`;
  }, [homeSceneCameraCommand, onHomeSceneCameraPoseChange, selectedHomeScene]);

  useEffect(() => {
    if (selectedHomeScene) {
      return undefined;
    }

    if (!showLampModel) {
      return undefined;
    }

    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const container = containerRef.current;

    if (!scene || !camera || !controls || !container) {
      return undefined;
    }

    let cancelled = false;
    const activeLampHeight = getLampModelUrl(selectedLampProduct, config.size, selectedLampHeight)
      ? selectedLampHeight
      : fallbackLampHeight;
    const activeLampModelUrl = getLampModelUrl(selectedLampProduct, config.size, activeLampHeight) ?? lampModelUrlsByHeight[fallbackLampHeight];
    const activeLampModelName =
      `${selectedLampProduct}-${config.size}-${activeLampHeight.toLowerCase().replace(/\s+/g, "-")}`;
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(publicAsset("draco/gltf/", { version: false }));

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    container.dataset.viewerModel = "lamp-loading";
    container.dataset.viewerHeight = activeLampHeight;
    loader.load(
      activeLampModelUrl,
      (gltf) => {
        if (cancelled) {
          disposeObject(gltf.scene);
          return;
        }

        activeAddonRefs.current.forEach((addon) => addon.parent?.remove(addon));
        activeAddonRefs.current.clear();

        if (bikeRef.current) {
          scene.remove(bikeRef.current);
          disposeObject(bikeRef.current);
        }

        const { camera: modelCamera, group, look } = prepareProductModelForViewport(
          gltf.scene,
          anisotropyRef.current,
          getStartupCameraX(container.clientWidth || window.innerWidth),
        );
        modelLoadedRef.current = true;
        fallbackRef.current = false;
        assetSourceCenterRef.current = null;
        assetCameraRef.current = { camera: modelCamera, look };
        frameMorphMeshesRef.current = [];
        bodyFramePaintMaterialsRef.current = [];
        handleMorphMeshesRef.current = [];
        seatMorphMeshesRef.current = [];
        bikeRef.current = group;
        modelMaterialsRef.current = collectModelMaterials(group);
        lampEmissionMaterialsRef.current = collectLampEmissionMaterials(group);
        applyModelAmbientOcclusion(modelMaterialsRef.current, viewerSettingsRef.current.modelAoIntensity);
        const activeEmissionTexture = getLampEmissionTexture(
          lampEmissionTexturesRef.current,
          viewerSettingsRef.current.emissionColor,
        );
        applyLampEmissionSettings(
          lampEmissionMaterialsRef.current,
          activeEmissionTexture,
          viewerSettingsRef.current.bloom,
          viewerSettingsRef.current.emissionStrength,
          viewerSettingsRef.current.emissionColor,
        );
        scene.add(group);
        container.dataset.viewerModel = activeLampModelName;
        container.dataset.viewerHeight = activeLampHeight;
        container.dataset.bloom = getBloomSettingValue(viewerSettingsRef.current.bloom).toFixed(2);
        container.dataset.bloomScope = "model-emission-mask";
        container.dataset.emissionMap = activeEmissionTexture
          ? getLampEmissionTextureName(viewerSettingsRef.current.emissionColor)
          : "pending";
        container.dataset.emissionColor = viewerSettingsRef.current.emissionColor;
        container.dataset.emissionSlot = lampEmissionMaterialsRef.current.length
          ? lampEmissionMaterialsRef.current.map((material) => material.name).join(",")
          : "missing";
        refreshHotspotBounds();
        targetCameraRef.current.copy(modelCamera);
        targetLookRef.current.copy(look);
        lookRef.current.copy(look);
        camera.position.copy(modelCamera);
        controls.target.copy(look);
        controls.update();
        onSceneReadyRef.current();
      },
      undefined,
      () => {
        if (!cancelled) {
          container.dataset.viewerModel = "lamp-load-error";
          container.dataset.viewerHeight = activeLampHeight;
          onSceneReadyRef.current();
        }
      },
    );

    return () => {
      cancelled = true;
      dracoLoader.dispose();
    };
  }, [config.size, selectedHomeScene, selectedLampHeight, selectedLampProduct, showLampModel]);

  useEffect(() => {
    componentOptionsRef.current = config.components;
  }, [config.components]);

  useEffect(() => {
    paintRef.current = config.paint;
    const diffuseMapPath = bodyFrameDiffuseMaps[config.paint];
    const didApply = applyBodyFramePaintTexture(
      bodyFramePaintMaterialsRef.current,
      config.paint,
      bodyFrameDiffuseTexturesRef.current,
    );

    if (didApply) {
      applyModelAmbientOcclusion(modelMaterialsRef.current, viewerSettingsRef.current.modelAoIntensity);
    }

    if (!diffuseMapPath || bodyFrameDiffuseTexturesRef.current[config.paint]) {
      return undefined;
    }

    let cancelled = false;
    const paintId = config.paint;
    const textureLoader = new THREE.TextureLoader();

    textureLoader.load(publicAsset(diffuseMapPath), (texture) => {
      if (cancelled) {
        texture.dispose();
        return;
      }

      configureBodyFrameDiffuseTexture(texture, anisotropyRef.current);
      bodyFrameDiffuseTexturesRef.current[paintId] = texture;

      if (paintRef.current !== paintId) {
        return;
      }

      const didApplyLoadedTexture = applyBodyFramePaintTexture(
        bodyFramePaintMaterialsRef.current,
        paintId,
        bodyFrameDiffuseTexturesRef.current,
      );

      if (didApplyLoadedTexture) {
        applyModelAmbientOcclusion(modelMaterialsRef.current, viewerSettingsRef.current.modelAoIntensity);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [config.paint]);

  useEffect(() => {
    sizeRef.current = config.size;
    applyFrameSizeMorph(frameMorphMeshesRef.current, config.size);
    refreshHotspotBounds();
  }, [config.size]);

  useEffect(() => {
    handlebarSizeRef.current = config.components.cockpit;
    applyHandlebarSizeMorph(handleMorphMeshesRef.current, config.components.cockpit);
    refreshHotspotBounds();
  }, [config.components.cockpit]);

  useEffect(() => {
    seatAdjustmentRef.current = config.components.seatAdjustment;
    applySeatAdjustmentMorph(seatMorphMeshesRef.current, config.components.seatAdjustment);
    refreshHotspotBounds();
  }, [config.components.seatAdjustment]);

  useEffect(() => {
    syncAddonModelRef.current("wheel", config.components.wheel);
  }, [config.components.wheel]);

  useEffect(() => {
    syncAddonModelRef.current("groupset", config.components.groupset);
  }, [config.components.groupset]);

  useEffect(() => {
    syncAddonModelRef.current("pedals", config.components.pedals);
  }, [config.components.pedals]);

  useEffect(() => {
    syncAddonModelRef.current("storage", config.components.storage);
  }, [config.components.storage]);

  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;

    if (!scene || !renderer) {
      return undefined;
    }

    let cancelled = false;

    const disposeUploadedHdri = () => {
      hdriBackgroundMapRef.current?.dispose();
      hdriBackgroundMapRef.current = null;
      hdriEnvironmentMapRef.current?.dispose();
      hdriEnvironmentMapRef.current = null;

      if (hdriDomeMaterialRef.current) {
        hdriDomeMaterialRef.current.uniforms.hdriMap.value = null;
      }
    };

    const refreshEnvironment = () => {
      applyViewerEnvironment({
        backgroundMode,
        backdropMaterial: backdropMaterialRef.current,
        defaultEnvironmentMap: defaultEnvironmentMapRef.current,
        hdriBackgroundMap: hdriBackgroundMapRef.current,
        hdriDome: hdriDomeRef.current,
        hdriDomeMaterial: hdriDomeMaterialRef.current,
        hdriEnvironmentMap: hdriEnvironmentMapRef.current,
        scene,
        viewerSettings: viewerSettingsRef.current,
      });
    };

    if (!hdriAsset) {
      disposeUploadedHdri();
      refreshEnvironment();
      return undefined;
    }

    const applyLoadedHdriTexture = (sourceTexture: THREE.Texture) => {
      if (cancelled) {
        sourceTexture.dispose();
        return;
      }

      if (hdriAsset.kind === "image") {
        sourceTexture.colorSpace = THREE.SRGBColorSpace;
      }

      sourceTexture.mapping = THREE.EquirectangularReflectionMapping;
      sourceTexture.needsUpdate = true;

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const hdriEnvironmentMap = pmremGenerator.fromEquirectangular(sourceTexture).texture;
      pmremGenerator.dispose();

      const hdriBackgroundMap = sourceTexture;

      disposeUploadedHdri();

      hdriBackgroundMapRef.current = hdriBackgroundMap;
      hdriEnvironmentMapRef.current = hdriEnvironmentMap;

      if (hdriDomeMaterialRef.current) {
        hdriDomeMaterialRef.current.uniforms.hdriMap.value = null;
      }

      refreshEnvironment();
    };

    const handleLoadError = () => {
      if (!cancelled) {
        refreshEnvironment();
      }
    };

    if (hdriAsset.kind === "hdr") {
      new RGBELoader().load(hdriAsset.url, applyLoadedHdriTexture, undefined, handleLoadError);
    } else if (hdriAsset.kind === "exr") {
      new EXRLoader().load(hdriAsset.url, applyLoadedHdriTexture, undefined, handleLoadError);
    } else {
      new THREE.TextureLoader().load(hdriAsset.url, applyLoadedHdriTexture, undefined, handleLoadError);
    }

    return () => {
      cancelled = true;
    };
  }, [backgroundMode, hdriAsset]);

  useEffect(() => {
    viewerSettingsRef.current = viewerSettings;

    const container = containerRef.current;
    const effectivePixelRatio = getEffectivePixelRatio(
      viewerSettings.pixelRatio,
      container?.clientWidth ?? viewportWidthRef.current,
    );
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.toneMapping = toneMappingValues[viewerSettings.toneMapping];
      renderer.toneMappingExposure = viewerSettings.exposure;
      renderer.setPixelRatio(effectivePixelRatio);
      renderer.shadowMap.enabled = viewerSettings.shadows;
      renderer.shadowMap.type = THREE.VSMShadowMap;
      renderer.shadowMap.needsUpdate = true;
      renderer.domElement.style.filter = `contrast(${viewerSettings.environmentContrast})`;

      if (container) {
        renderer.setSize(container.clientWidth, container.clientHeight);
      }
    }

    const composer = composerRef.current;
    if (composer) {
      composer.setPixelRatio(effectivePixelRatio);

      if (container) {
        composer.setSize(container.clientWidth, container.clientHeight);
      }
    }

    const bloomComposer = bloomComposerRef.current;
    if (bloomComposer) {
      bloomComposer.setPixelRatio(effectivePixelRatio);

      if (container) {
        bloomComposer.setSize(container.clientWidth, container.clientHeight);
      }
    }

    const bloomMaskTarget = bloomMaskTargetRef.current;
    if (bloomMaskTarget) {
      const container = containerRef.current;
      if (container) {
        resizeSelectiveBloomMaskTarget(
          bloomMaskTarget,
          container.clientWidth,
          container.clientHeight,
          effectivePixelRatio,
        );
      }
    }

    applyBloomPassSettings(
      bloomPassRef.current,
      bloomCompositePassRef.current,
      viewerSettings.bloom,
      viewerSettings.bloomRadius,
      viewerSettings.bloomThreshold,
    );
    const activeEmissionTexture = getLampEmissionTexture(
      lampEmissionTexturesRef.current,
      viewerSettings.emissionColor,
    );
    applyLampEmissionSettings(
      lampEmissionMaterialsRef.current,
      activeEmissionTexture,
      viewerSettings.bloom,
      viewerSettings.emissionStrength,
      viewerSettings.emissionColor,
    );

    if (containerRef.current) {
      containerRef.current.dataset.bloom = getBloomSettingValue(viewerSettings.bloom).toFixed(2);
      containerRef.current.dataset.bloomScope = "model-emission-mask";
      containerRef.current.dataset.effectivePixelRatio = effectivePixelRatio.toFixed(2);
      containerRef.current.dataset.emissionMap = activeEmissionTexture
        ? getLampEmissionTextureName(viewerSettings.emissionColor)
        : "pending";
      containerRef.current.dataset.emissionColor = viewerSettings.emissionColor;
      containerRef.current.dataset.emissionSlot = lampEmissionMaterialsRef.current.length
        ? lampEmissionMaterialsRef.current.map((material) => material.name).join(",")
        : "missing";
    }

    const scene = sceneRef.current;
    let environmentColor = new THREE.Color(viewerSettings.environmentColor);
    if (scene) {
      environmentColor = applyViewerEnvironment({
        backgroundMode,
        backdropMaterial: backdropMaterialRef.current,
        defaultEnvironmentMap: defaultEnvironmentMapRef.current,
        hdriBackgroundMap: hdriBackgroundMapRef.current,
        hdriDome: hdriDomeRef.current,
        hdriDomeMaterial: hdriDomeMaterialRef.current,
        hdriEnvironmentMap: hdriEnvironmentMapRef.current,
        scene,
        viewerSettings,
      });
    }

    if (ambientLightRef.current) {
      const tintColor = backgroundMode === "color" ? viewerSettings.environmentColor : "#ffffff";

      ambientLightRef.current.color.copy(getTintedColor("#f7f1e4", tintColor, 0.12));
      ambientLightRef.current.intensity = viewerSettings.ambientIntensity;
    }

    if (keyLightRef.current) {
      keyLightRef.current.intensity = viewerSettings.keyIntensity;
      keyLightRef.current.castShadow = viewerSettings.shadows;
      keyLightRef.current.shadow.blurSamples = viewerSettings.vsmBlurSamples;
      keyLightRef.current.shadow.needsUpdate = true;
    }

    if (fillLightRef.current) {
      const tintColor = backgroundMode === "color" ? viewerSettings.environmentColor : "#ffffff";

      fillLightRef.current.color.copy(getTintedColor("#f7f1e4", tintColor, 0.18));
      fillLightRef.current.intensity = viewerSettings.fillIntensity;
    }

    if (rimLightRef.current) {
      const tintColor = backgroundMode === "color" ? viewerSettings.environmentColor : "#ffffff";

      rimLightRef.current.color.copy(getTintedColor("#f1413c", tintColor, 0.25));
      rimLightRef.current.intensity = viewerSettings.rimIntensity;
    }

    applyModelAmbientOcclusion(modelMaterialsRef.current, viewerSettings.modelAoIntensity);

    if (domeMaterialRef.current) {
      const tintColor = backgroundMode === "color" ? viewerSettings.environmentColor : "#ffffff";

      domeMaterialRef.current.color.copy(getTintedColor("#ffffff", tintColor, 0.08));
      domeMaterialRef.current.needsUpdate = true;
    }

    if (floorGlowMaterialRef.current) {
      floorGlowMaterialRef.current.color.copy(environmentColor);
      floorGlowMaterialRef.current.opacity = viewerSettings.floorGlow;
    }

    if (contactAoMaterialRef.current) {
      contactAoMaterialRef.current.opacity = viewerSettings.aoIntensity;
    }

    if (stageRingMaterialRef.current) {
      stageRingMaterialRef.current.color.copy(environmentColor);
    }

    if (stageRingHighlightMaterialRef.current) {
      const tintColor = backgroundMode === "color" ? viewerSettings.environmentColor : "#ffffff";

      stageRingHighlightMaterialRef.current.color.copy(getTintedColor("#ffffff", tintColor, 0.72));
    }

    if (cameraRef.current) {
      cameraRef.current.fov = viewerSettings.cameraFov;
      cameraRef.current.updateProjectionMatrix();
    }
  }, [backgroundMode, viewerSettings]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || modelLoadedRef.current || !fallbackRef.current) {
      return;
    }

    if (bikeRef.current) {
      scene.remove(bikeRef.current);
      disposeObject(bikeRef.current);
    }

    const bike = buildBike(config, focus);
    bikeRef.current = bike;
    scene.add(bike);
    refreshHotspotBounds();
  }, [config, focus]);

  useEffect(() => {
    if (assetCameraRef.current) {
      targetCameraRef.current.copy(assetCameraRef.current.camera);
      targetLookRef.current.copy(assetCameraRef.current.look);
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.copy(assetCameraRef.current.camera);
        controlsRef.current.target.copy(assetCameraRef.current.look);
        controlsRef.current.update();
      }
      return;
    }

    const responsiveStartupCameraX = getStartupCameraX(
      viewportWidthRef.current || (typeof window !== "undefined" ? window.innerWidth : undefined),
    );
    const cameraTargets: Record<string, [THREE.Vector3, THREE.Vector3]> = {
      cockpit: [new THREE.Vector3(1.28, 1.8, 3.15), new THREE.Vector3(1.05, 1.48, 0)],
      default: [
        new THREE.Vector3(
          responsiveStartupCameraX,
          modelGroundY + startupCameraHeightOffset,
          startupCameraDistance,
        ),
        new THREE.Vector3(responsiveStartupCameraX, modelGroundY + startupLookHeightOffset, 0),
      ],
      drivetrain: [new THREE.Vector3(-0.55, 0.74, 2.35), new THREE.Vector3(-0.38, 0.38, 0)],
      front: [new THREE.Vector3(1.28, 0.9, 2.65), new THREE.Vector3(1.36, 0.2, 0)],
      rear: [new THREE.Vector3(-1.35, 0.85, 2.55), new THREE.Vector3(-1.35, 0.18, 0)],
      saddle: [new THREE.Vector3(-1.05, 1.72, 2.5), new THREE.Vector3(-0.86, 1.72, 0)],
    };
    const [cameraTarget, lookTarget] = cameraTargets[focus] ?? cameraTargets.default;
    targetCameraRef.current.copy(cameraTarget);
    targetLookRef.current.copy(lookTarget);
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.copy(cameraTarget);
      controlsRef.current.target.copy(lookTarget);
      controlsRef.current.update();
    }
  }, [focus]);

  return (
    <div
      className="bike-stage"
      data-background-mode={backgroundMode}
      data-hdri-display="hidden"
      data-hdri-name={hdriAsset?.name ?? ""}
      ref={containerRef}
    >
      <div
        aria-hidden={!shouldShowDimensions}
        aria-label="Model dimensions"
        className="viewer-hotspots"
        hidden={!shouldShowDimensions}
      >
        {dimensionHotspots.map((hotspot) => (
          <div
            aria-label={
              hotspot.description
                ? `${hotspot.label}: ${hotspot.description}`
                : hotspot.label
            }
            aria-expanded={hotspot.description ? activeHotspotId === hotspot.id : undefined}
            className={`viewer-hotspot ${hotspot.id}-hotspot ${
              activeHotspotId === hotspot.id ? "active" : ""
            }`}
            key={hotspot.id}
            onClick={() => {
              if (!hotspot.description) {
                return;
              }

              setActiveHotspotId((current) => current === hotspot.id ? null : hotspot.id);
            }}
            onKeyDown={(event) => {
              if (!hotspot.description || (event.key !== "Enter" && event.key !== " ")) {
                return;
              }

              event.preventDefault();
              setActiveHotspotId((current) => current === hotspot.id ? null : hotspot.id);
            }}
            ref={(element) => {
              if (element) {
                hotspotElementsRef.current.set(hotspot.id, element);
              } else {
                hotspotElementsRef.current.delete(hotspot.id);
              }
            }}
            role={hotspot.description ? "button" : undefined}
            tabIndex={hotspot.description ? 0 : -1}
          >
            <span className="viewer-hotspot-dot" />
            <span className="viewer-hotspot-label">{hotspot.label}</span>
            {hotspot.description ? (
              <span className="viewer-hotspot-card">
                <strong>{hotspot.label}</strong>
                <span>{hotspot.description}</span>
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
