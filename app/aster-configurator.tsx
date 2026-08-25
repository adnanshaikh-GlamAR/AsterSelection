"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { appendAssetVersion } from "./asset-version";

const BikeScene = lazy(() => import("./aster-bike-scene"));

type StepId = "home" | "size" | "components" | "summary" | "light" | "studio";
type StageId = "home" | "build" | "review" | "light";
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
type ComponentIconKey = "frame" | "wheel" | "groupset" | "cockpit" | "pedals" | "saddle" | "storage";
type ToneMappingKey = "none" | "linear" | "reinhard" | "cineon" | "aces" | "agx" | "neutral";
type HdriAssetKind = "exr" | "hdr" | "image";
type BackgroundMode = "color" | "hdri";
type HomeSceneId = "scene-01";
type LampProductId = "floor-lamp-4-heads" | "floor-lamp-3-heads" | "floor-lamp-2-heads";
type HomeLampProductId = Exclude<LampProductId, "floor-lamp-2-heads">;
type EmissionColorKey = "warm" | "neutral" | "cool";
type CameraVectorTuple = [number, number, number];
type HomeSceneCameraPose = {
  camera: CameraVectorTuple;
  look: CameraVectorTuple;
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

const stageTabOffsets: Record<StageId, string> = {
  build: "0%",
  light: "100%",
  home: "200%",
  review: "300%",
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
  depthOfField: boolean;
  dofFocus: number;
  dofAperture: number;
  dofMaxBlur: number;
  emissionStrength: number;
  emissionColor: EmissionColorKey;
  hdriIntensity: number;
  hdriRotation: number;
  hdriScale: number;
};

type HdriAsset = {
  kind: HdriAssetKind;
  name: string;
  url: string;
};

type TestingModelAsset = {
  name: string;
  url: string;
};

type HdriPreset = HdriAsset & {
  id: string;
  label: string;
  settings: Pick<ViewerSettings, "hdriIntensity" | "hdriRotation" | "hdriScale">;
  swatch: string;
};

type NumericViewerSettingKey = {
  [Key in keyof ViewerSettings]: ViewerSettings[Key] extends number ? Key : never;
}[keyof ViewerSettings];

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

const sizeOptions = [
  { dimensions: "", id: "S", label: "Red" },
  { dimensions: "", id: "green", label: "Green" },
  { dimensions: "", id: "white", label: "White" },
  { dimensions: "", id: "black", label: "Black" },
  { dimensions: "", id: "orange", label: "Orange" },
  { dimensions: "", id: "twoHead", label: "Floor Lamp 2 Head" },
];
const sizeOptionIdsByLampProduct: Record<LampProductId, string[]> = {
  "floor-lamp-2-heads": ["twoHead"],
  "floor-lamp-3-heads": ["S", "green", "black"],
  "floor-lamp-4-heads": ["S", "green", "white", "black", "orange"],
};
const lampHeightOptionsBySize: Record<string, string[]> = {
  S: ["90 CM", "130 CM", "160 CM"],
  green: ["90 CM", "A 130 CM", "B 130 CM", "160 CM", "A 160 CM"],
  white: ["130 CM", "160 CM"],
  black: ["130 CM", "160 CM"],
  orange: ["90 CM", "160 CM"],
};
const lampHeightOptionsByProductAndSize: Partial<Record<LampProductId, Record<string, string[]>>> = {
  "floor-lamp-2-heads": {
    twoHead: ["50 CM"],
  },
  "floor-lamp-3-heads": {
    black: ["60 CM"],
    green: ["60 CM"],
    S: ["A 60 CM", "B 60 CM"],
  },
};
const homeLampProductLabels: Record<HomeLampProductId, string> = {
  "floor-lamp-3-heads": "Floor Lamp 3 Heads",
  "floor-lamp-4-heads": "Floor Lamp 4 Heads",
};
const homeLampProductIds: HomeLampProductId[] = ["floor-lamp-4-heads", "floor-lamp-3-heads"];
const homeSceneCameraStorageKey = "aster-home-scene-01-build-framing-camera";

function isCameraVectorTuple(value: unknown): value is CameraVectorTuple {
  return Array.isArray(value)
    && value.length === 3
    && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function readStoredHomeSceneCameraPose(): HomeSceneCameraPose | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedPose = window.localStorage.getItem(homeSceneCameraStorageKey);

    if (!storedPose) {
      return null;
    }

    const parsedPose = JSON.parse(storedPose) as unknown;

    if (!parsedPose || typeof parsedPose !== "object") {
      return null;
    }

    const candidate = parsedPose as { camera?: unknown; look?: unknown };

    if (!isCameraVectorTuple(candidate.camera) || !isCameraVectorTuple(candidate.look)) {
      return null;
    }

    return {
      camera: candidate.camera,
      look: candidate.look,
    };
  } catch {
    return null;
  }
}

function getLampHeightOptions(sizeId: string, lampProductId: LampProductId = "floor-lamp-4-heads") {
  const productOptions = lampHeightOptionsByProductAndSize[lampProductId]?.[sizeId];

  if (productOptions) {
    return productOptions;
  }

  return lampHeightOptionsBySize[sizeId] ?? lampHeightOptionsBySize.S;
}

function getHdriAssetKindFromFile(file: File): HdriAssetKind {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "hdr") {
    return "hdr";
  }

  if (extension === "exr") {
    return "exr";
  }

  return "image";
}

function getSizeOptionsForLampProduct(lampProductId: LampProductId) {
  const enabledSizeIds = sizeOptionIdsByLampProduct[lampProductId];

  return sizeOptions.filter((option) => enabledSizeIds.includes(option.id));
}

type HomeProductVariant = {
  colorLabel: string;
  height: string;
  id: string;
  productId: HomeLampProductId;
  productLabel: string;
  sizeId: string;
};

const homeProductVariants: HomeProductVariant[] = homeLampProductIds.flatMap((productId) => {
  return getSizeOptionsForLampProduct(productId).flatMap((size) => {
    return getLampHeightOptions(size.id, productId).map((height) => ({
      colorLabel: size.label,
      height,
      id: `${productId}-${size.id}-${height}`,
      productId,
      productLabel: homeLampProductLabels[productId],
      sizeId: size.id,
    }));
  });
});

const defaultHomeProductVariantIndex = Math.max(
  0,
  homeProductVariants.findIndex((variant) => (
    variant.productId === "floor-lamp-4-heads"
    && variant.sizeId === "S"
    && variant.height === "160 CM"
  )),
);

const defaultViewerSettings: ViewerSettings = {
  ambientIntensity: 0,
  aoIntensity: 0,
  backdropGlow: 0,
  bloom: 0.5,
  bloomRadius: 1,
  bloomThreshold: 1,
  cameraFov: 35,
  depthOfField: false,
  dofAperture: 0.025,
  dofFocus: 8,
  dofMaxBlur: 0,
  emissionColor: "warm",
  emissionStrength: 8,
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

const defaultHomeSceneSettings: ViewerSettings = {
  ...defaultViewerSettings,
  ambientIntensity: 0.35,
  backdropGlow: 0,
  bloomRadius: 1,
  bloomThreshold: 1,
  depthOfField: false,
  dofAperture: 0.025,
  dofFocus: 8,
  dofMaxBlur: 0,
  emissionStrength: 8,
  environmentColor: "#ffffff",
  fillIntensity: 0,
  floorGlow: 0.55,
  hdriIntensity: 1.15,
  hdriRotation: 107,
  hdriScale: 0.5,
  keyIntensity: 0,
  rimIntensity: 0,
  toneMapping: "aces",
};

const toneMappingLabels: Array<{ id: ToneMappingKey; label: string }> = [
  { id: "aces", label: "ACES Filmic" },
  { id: "agx", label: "AgX" },
  { id: "neutral", label: "Neutral" },
  { id: "reinhard", label: "Reinhard" },
  { id: "cineon", label: "Cineon" },
  { id: "linear", label: "Linear" },
  { id: "none", label: "None" },
];

const emissionColorOptions: Array<{ color: string; id: EmissionColorKey; label: string }> = [
  { color: "#ffdca8", id: "warm", label: "Warm" },
  { color: "#fffaf0", id: "neutral", label: "Neutral" },
  { color: "#d9ecff", id: "cool", label: "Cool" },
];

const getSizeLabel = (sizeId: string) => {
  return sizeOptions.find((size) => size.id === sizeId)?.label ?? sizeId;
};

const getLampHeightDimensionText = (lampHeight: string) => {
  const heightMatch = lampHeight.match(/(\d+(?:\.\d+)?)\s*cm/i);

  return heightMatch ? `${heightMatch[1]}cm` : "90cm";
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

const basePrice = 399.99;
const formatter = new Intl.NumberFormat("en-IE", {
  currency: "EUR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});
const brandName = "Aster Collection";
const modelName = "DESIGNER FLOOR LAMP";
const publicAsset = (path: string, options: { version?: boolean } = {}) => {
  const assetPath = `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

  return options.version === false || path.endsWith("/") ? assetPath : appendAssetVersion(assetPath);
};
const homeSceneHdriAsset: HdriAsset = {
  kind: "hdr",
  name: "cayley_interior_1k.hdr",
  url: publicAsset("hdri/home/cayley_interior_1k.hdr"),
};
const hdriPresets: HdriPreset[] = [
  {
    id: "brown-photostudio",
    kind: "hdr",
    label: "Brown Photostudio",
    name: "brown_photostudio_01_1k.hdr",
    settings: { hdriIntensity: 1.15, hdriRotation: 107, hdriScale: 0.5 },
    swatch: "linear-gradient(145deg, #d7c0a6 0%, #8b6848 48%, #2f241c 100%)",
    url: publicAsset("hdri/brown_photostudio_01_1k.hdr"),
  },
  {
    id: "german-town-street",
    kind: "hdr",
    label: "German Town",
    name: "german_town_street_1k.hdr",
    settings: { hdriIntensity: 1.1, hdriRotation: 0, hdriScale: 0.5 },
    swatch: "linear-gradient(145deg, #d8e7f2 0%, #8a9da4 46%, #39464a 100%)",
    url: publicAsset("hdri/german_town_street_1k.hdr"),
  },
  {
    id: "tree-lined-driveway",
    kind: "hdr",
    label: "Tree Lined",
    name: "tree_lined_driveway_1k.hdr",
    settings: { hdriIntensity: 1, hdriRotation: 0, hdriScale: 0.5 },
    swatch: "linear-gradient(145deg, #d7e1c7 0%, #6f7f5f 44%, #2b342a 100%)",
    url: publicAsset("hdri/tree_lined_driveway_1k.hdr"),
  },
  {
    id: "studio-small",
    kind: "hdr",
    label: "Studio Small",
    name: "studio_small_08_1k.hdr",
    settings: { hdriIntensity: 1.15, hdriRotation: 0, hdriScale: 0.5 },
    swatch: "linear-gradient(145deg, #f1ede3 0%, #9a958c 48%, #2d2c2a 100%)",
    url: publicAsset("hdri/studio_small_08_1k.hdr"),
  },
];
const defaultHiddenHdriPreset =
  hdriPresets.find((preset) => preset.id === "brown-photostudio") ?? hdriPresets[0];
const backgroundColorPresets = [
  { color: defaultViewerSettings.environmentColor, id: "default", label: "Default" },
  { color: "#000000", id: "black", label: "Black" },
  { color: "#296E85", id: "teal-blue", label: "Teal Blue" },
];
const mobileCameraBreakpoint = 900;
const arVisualizationUrl =
  "https://cdn.glamar.io/sdk/ar?skuId=0010991&accessKey=6ea59e6d-7599-4a8a-8450-d775500b6536";

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

function getFocusForGroup(groupKey: ComponentKey | null) {
  if (!groupKey) {
    return "default";
  }

  return componentGroups.find((group) => group.key === groupKey)?.focus ?? "default";
}

function getComponentIconKey(key: ComponentKey | "frame"): ComponentIconKey {
  if (key === "wheel") {
    return "wheel";
  }

  if (key === "cockpit") {
    return "cockpit";
  }

  if (key === "pedals") {
    return "pedals";
  }

  if (key === "storage") {
    return "storage";
  }

  if (key === "seatAdjustment" || key === "saddle") {
    return "saddle";
  }

  if (key === "groupset" || key === "crankset" || key === "cassette") {
    return "groupset";
  }

  return "frame";
}

function PartIcon({ kind }: { kind: ComponentIconKey }) {
  if (kind === "wheel") {
    return (
      <svg aria-hidden="true" className="part-icon-svg" focusable="false" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="15" />
        <circle cx="24" cy="24" r="3.4" />
        <path d="M24 9v30M9 24h30M13.4 13.4l21.2 21.2M34.6 13.4 13.4 34.6" />
      </svg>
    );
  }

  if (kind === "cockpit") {
    return (
      <svg aria-hidden="true" className="part-icon-svg" focusable="false" viewBox="0 0 48 48">
        <path d="M13 25h10c3.8 0 5.4-3.7 8.9-3.7H36" />
        <path d="M13 25c-4.2 0-6.7 2.6-6.7 6.3 0 3.1 2.1 5.1 5 5.1" />
        <path d="M36 21.3c4 0 6.7 2.9 6.7 6.8 0 3.4-2 5.7-5.1 5.7" />
        <path d="M22.5 25v-7h8.8" />
      </svg>
    );
  }

  if (kind === "saddle") {
    return (
      <svg aria-hidden="true" className="part-icon-svg" focusable="false" viewBox="0 0 48 48">
        <path d="M8 23.5c5.4-4.5 17.3-5.5 29.5-1.8 2.4.7 3.4 3.6 1.6 5.4-3.5 3.4-13.3 4.2-25.5.8-3.8-1.1-6-2.3-5.6-4.4Z" />
        <path d="M20 29.4 17.4 38M29 29.8 32.2 38M17.4 38h14.8" />
      </svg>
    );
  }

  if (kind === "groupset") {
    return (
      <svg aria-hidden="true" className="part-icon-svg" focusable="false" viewBox="0 0 48 48">
        <circle cx="20" cy="25" r="10.5" />
        <circle cx="20" cy="25" r="4" />
        <path d="M20 14.5v21M9.5 25h21M12.6 17.6l14.8 14.8M27.4 17.6 12.6 32.4" />
        <path d="M28.3 30.8 38.8 37M38.8 37l2.4-4.2" />
      </svg>
    );
  }

  if (kind === "pedals") {
    return (
      <svg aria-hidden="true" className="part-icon-svg" focusable="false" viewBox="0 0 48 48">
        <path d="M24 14v20M14 18h20M14 30h20" />
        <path d="M7.5 14.5h12v7h-12zM28.5 26.5h12v7h-12z" />
        <path d="M19.5 18h9M19.5 30h9" />
      </svg>
    );
  }

  if (kind === "storage") {
    return (
      <svg aria-hidden="true" className="part-icon-svg" focusable="false" viewBox="0 0 48 48">
        <path d="M20 12h8l2.5 6h-13L20 12Z" />
        <path d="M17.5 18h13l1.5 17c.2 2.4-1.7 4.5-4.1 4.5h-7.8c-2.4 0-4.3-2.1-4.1-4.5l1.5-17Z" />
        <path d="M14 23c2.8 2.4 17.2 2.4 20 0M15 33c3.2 2.7 14.8 2.7 18 0" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="part-icon-svg" focusable="false" viewBox="0 0 48 48">
      <path d="M24 15v23" />
      <path d="M16 38h16M13 42h22" />
      <path d="M24 15 14 11M24 15l10-4M24 21l-10 4M24 21l10 4" />
      <path d="M10.5 6.5h8l-1.8 7h-4.4l-1.8-7ZM29.5 6.5h8l-1.8 7h-4.4l-1.8-7ZM10.5 20.5h8l-1.8 7h-4.4l-1.8-7ZM29.5 20.5h8l-1.8 7h-4.4l-1.8-7Z" />
    </svg>
  );
}

function formatStudioValue(value: number, suffix = "") {
  if (suffix === " deg") {
    return `${Math.round(value)} deg`;
  }

  if (suffix === "x") {
    return `${value.toFixed(2)}x`;
  }

  return Number.isInteger(value) ? `${value}${suffix}` : `${value.toFixed(2)}${suffix}`;
}

function StudioRange({
  label,
  max,
  min,
  onChange,
  step,
  suffix,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  suffix?: string;
  value: number;
}) {
  const safeValue = Number.isFinite(value) ? value : min;

  return (
    <label className="studio-control">
      <span>
        <em>{label}</em>
        <strong>{formatStudioValue(safeValue, suffix)}</strong>
      </span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        onInput={(event) => onChange(Number(event.currentTarget.value))}
        step={step}
        type="range"
        value={safeValue}
      />
    </label>
  );
}

function StudioColorPalette({
  active,
  onChange,
  value,
}: {
  active: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const colorValue = /^#[0-9a-f]{6}$/i.test(value) ? value : defaultViewerSettings.environmentColor;

  return (
    <div className={active ? "studio-color-control active" : "studio-color-control"}>
      <span>
        <em>Environment Color</em>
        <strong>{colorValue.toUpperCase()}</strong>
      </span>
      <div className="studio-background-presets" aria-label="Background color presets">
        {backgroundColorPresets.map((preset) => {
          const presetColor = preset.color.toUpperCase();
          const isActive = active && colorValue.toUpperCase() === presetColor;

          return (
            <button
              aria-label={`${preset.label} background color`}
              aria-pressed={isActive}
              className={isActive ? "studio-background-preset active" : "studio-background-preset"}
              key={preset.id}
              onClick={() => onChange(presetColor)}
              title={preset.label}
              type="button"
            >
              <span style={{ backgroundColor: preset.color }} />
              <em>{preset.label}</em>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StudioEmissionColorRadios({
  onChange,
  value,
}: {
  onChange: (value: EmissionColorKey) => void;
  value: EmissionColorKey;
}) {
  return (
    <div className="studio-emission-control" role="radiogroup" aria-label="Emission color">
      {emissionColorOptions.map((option) => (
        <label
          className="studio-emission-radio"
          key={option.id}
          style={{ "--emission-color": option.color } as CSSProperties}
          title={option.label}
        >
          <input
            aria-label={option.label}
            checked={value === option.id}
            name="emission-color"
            onChange={() => onChange(option.id)}
            type="radio"
            value={option.id}
          />
          <span className="studio-emission-label">{option.label}</span>
        </label>
      ))}
    </div>
  );
}

export default function ConfiguratorClient() {
  const [activeStep, setActiveStep] = useState<StepId>("components");
  const [editingGroup, setEditingGroup] = useState<ComponentKey | null>(null);
  const [config, setConfig] = useState<ConfigState>(defaultConfig);
  const [status, setStatus] = useState("");
  const [hdriAsset, setHdriAsset] = useState<HdriAsset | null>(() => ({
    kind: defaultHiddenHdriPreset.kind,
    name: defaultHiddenHdriPreset.name,
    url: defaultHiddenHdriPreset.url,
  }));
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("hdri");
  const [showHotspots, setShowHotspots] = useState(false);
  const [isArModalOpen, setIsArModalOpen] = useState(false);
  const [introPhase, setIntroPhase] = useState<IntroPhase>("loading");
  const [loaderProgress, setLoaderProgress] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [showLampModel, setShowLampModel] = useState(true);
  const [selectedLampProduct, setSelectedLampProduct] = useState<LampProductId>("floor-lamp-4-heads");
  const [isLampHeightOpen, setIsLampHeightOpen] = useState(false);
  const [selectedLampHeight, setSelectedLampHeight] = useState("90 CM");
  const [selectedHomeScene, setSelectedHomeScene] = useState<HomeSceneId | null>("scene-01");
  const [selectedHomeProductVariantIndex, setSelectedHomeProductVariantIndex] = useState(
    defaultHomeProductVariantIndex,
  );
  const [homeSceneCameraResetKey, setHomeSceneCameraResetKey] = useState(0);
  const [homeSceneCameraPose, setHomeSceneCameraPose] = useState<HomeSceneCameraPose | null>(
    () => readStoredHomeSceneCameraPose(),
  );
  const [homeSceneSettings, setHomeSceneSettings] =
    useState<ViewerSettings>(defaultHomeSceneSettings);
  const [testingModelAsset, setTestingModelAsset] = useState<TestingModelAsset | null>(null);
  const [testingHdriAsset, setTestingHdriAsset] = useState<HdriAsset | null>(null);
  const [viewerSettings, setViewerSettings] = useState<ViewerSettings>(defaultViewerSettings);

  useEffect(() => {
    if (introPhase !== "loading") {
      return undefined;
    }

    let frame = 0;
    const start = performance.now();
    const duration = 1800;

    const tick = (time: number) => {
      const progress = Math.min(100, Math.round(((time - start) / duration) * 100));
      setLoaderProgress(progress);

      if (progress < 100) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [introPhase]);

  useEffect(() => {
    if (introPhase !== "loading" || !sceneReady || loaderProgress < 100) {
      return undefined;
    }

    const timer = window.setTimeout(() => setIntroPhase("cinematic"), 40);

    return () => window.clearTimeout(timer);
  }, [introPhase, loaderProgress, sceneReady]);

  useEffect(() => {
    return () => {
      if (testingModelAsset?.url.startsWith("blob:")) {
        URL.revokeObjectURL(testingModelAsset.url);
      }
    };
  }, [testingModelAsset]);

  useEffect(() => {
    return () => {
      if (testingHdriAsset?.url.startsWith("blob:")) {
        URL.revokeObjectURL(testingHdriAsset.url);
      }
    };
  }, [testingHdriAsset]);

  const paint = getPaint(config.paint);
  const total = useMemo(() => {
    const componentTotal = componentGroups.reduce((sum, group) => {
      return sum + getComponent(group, config.components[group.key]).priceDelta;
    }, 0);

    return basePrice + paint.priceDelta + componentTotal;
  }, [config, paint]);

  const activeStage: StageId =
    activeStep === "home"
      ? "home"
      : activeStep === "summary"
        ? "review"
        : activeStep === "light"
          ? "light"
          : "build";
  const stageTabStyle = {
    "--active-tab-offset": stageTabOffsets[activeStage],
  } as CSSProperties;
  const activeHomeScene = activeStage === "home" ? selectedHomeScene : null;
  const focus =
    activeStep === "components"
      ? getFocusForGroup(editingGroup)
      : activeStep === "size"
        ? "default"
        : activeStep === "summary"
          ? "default"
          : "default";

  const visibleComponentOrder: ComponentKey[] = [];
  const selectedLampDimensions = `H: ${getLampHeightDimensionText(selectedLampHeight)} / B: 30cm`;

  const summaryRows = [
    ["Model", modelName],
    ["Size", getSizeLabel(config.size)],
    ["Dimensions", selectedLampDimensions],
    ...visibleComponentOrder
      .map((groupKey) => getComponentGroup(groupKey))
      .map((group) => [
        group.label,
        getComponent(group, config.components[group.key]).name,
      ]),
  ];

  const buildComponentOrder = visibleComponentOrder;
  const visibleSizeOptions = getSizeOptionsForLampProduct(selectedLampProduct);

  const openLampSelector = (lampProductId: LampProductId) => {
    const nextSizeOptions = getSizeOptionsForLampProduct(lampProductId);
    const nextSizeId = nextSizeOptions.some((option) => option.id === config.size)
      ? config.size
      : nextSizeOptions[0]?.id ?? "S";
    const nextHeightOptions = getLampHeightOptions(nextSizeId, lampProductId);

    setSelectedLampProduct(lampProductId);
    setConfig((current) => ({ ...current, size: nextSizeId }));

    if (!nextHeightOptions.includes(selectedLampHeight)) {
      setSelectedLampHeight(nextHeightOptions[0]);
    }

    setShowLampModel(true);
    setIsLampHeightOpen(nextSizeOptions.length === 1);
    setEditingGroup(null);
    setActiveStep("size");
  };

  const buildCards = [
    {
      id: "floor-lamp-2-heads",
      icon: getComponentIconKey("frame"),
      label: "Floor Lamp 2 Head",
      value: "",
      meta: "",
      thumb: "frame",
      onClick: () => {
        openLampSelector("floor-lamp-2-heads");
      },
    },
    {
      id: "floor-lamp-3-heads",
      icon: getComponentIconKey("frame"),
      label: "Floor Lamp 3 Heads",
      value: "",
      meta: "",
      thumb: "frame",
      onClick: () => {
        openLampSelector("floor-lamp-3-heads");
      },
    },
    {
      id: "frame",
      icon: getComponentIconKey("frame"),
      label: "Floor Lamp 4 Heads",
      value: "",
      meta: "",
      thumb: "frame",
      onClick: () => {
        openLampSelector("floor-lamp-4-heads");
      },
    },
    ...buildComponentOrder
      .map((groupKey) => getComponentGroup(groupKey))
      .map((group) => {
        const selected = getComponent(group, config.components[group.key]);

        return {
          id: group.key,
          icon: getComponentIconKey(group.key),
          label: group.label === "Wheel" ? "Wheels" : group.label,
          value: selected.name,
          meta: selected.priceDelta ? `+${formatter.format(selected.priceDelta)}` : "Included",
          thumb: group.key === "seatAdjustment" ? "saddle" : group.key,
          onClick: () => {
            setActiveStep("components");
            setEditingGroup(group.key);
          },
        };
      }),
  ];
  const updateComponent = (group: ComponentGroup, optionId: string) => {
    setConfig((current) => ({
      ...current,
      components: {
        ...current.components,
        [group.key]: optionId,
      },
    }));
  };

  const updateViewerNumber = (key: NumericViewerSettingKey, value: number) => {
    setViewerSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateHomeSceneNumber = (key: NumericViewerSettingKey, value: number) => {
    setHomeSceneSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateToneMapping = (toneMapping: ToneMappingKey) => {
    setViewerSettings((current) => ({
      ...current,
      toneMapping,
    }));
  };

  const updateEmissionColor = (emissionColor: EmissionColorKey) => {
    setViewerSettings((current) => ({
      ...current,
      emissionColor,
    }));
  };

  const updateTestingModelUpload = (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".glb")) {
      setStatus("Choose a GLB file for testing.");
      return;
    }

    setTestingModelAsset({
      name: file.name,
      url: URL.createObjectURL(file),
    });
    setStatus("Testing GLB loaded.");
  };

  const updateTestingHdriUpload = (file: File | null) => {
    if (!file) {
      return;
    }

    setTestingHdriAsset({
      kind: getHdriAssetKindFromFile(file),
      name: file.name,
      url: URL.createObjectURL(file),
    });
    setStatus("Testing HDRI loaded.");
  };

  const clearTestingModelUpload = () => {
    setTestingModelAsset(null);
    setStatus("Testing GLB cleared.");
  };

  const clearTestingHdriUpload = () => {
    setTestingHdriAsset(null);
    setStatus("Testing HDRI cleared.");
  };

  const updateHomeEmissionColor = (emissionColor: EmissionColorKey) => {
    setHomeSceneSettings((current) => ({
      ...current,
      emissionColor,
    }));
  };

  const updateViewerColor = (environmentColor: string) => {
    setBackgroundMode("color");
    setHdriAsset(null);
    setViewerSettings((current) => ({
      ...current,
      environmentColor,
    }));
    setStatus("");
  };

  const applyHdriPreset = (preset: HdriPreset) => {
    setBackgroundMode("hdri");
    setHdriAsset({
      kind: preset.kind,
      name: preset.name,
      url: preset.url,
    });
    setViewerSettings((current) => ({
      ...current,
      ...preset.settings,
    }));
    setStatus("");
  };

  const nextStep = () => {
    if (editingGroup) {
      setEditingGroup(null);
      return;
    }

    if (activeStep === "summary") {
      setStatus("");
      return;
    }

    if (activeStep === "light") {
      setSelectedHomeScene("scene-01");
      setHomeSceneCameraResetKey((current) => current + 1);
      setActiveStep("home");
      return;
    }

    setEditingGroup(null);
    if (activeStep === "home") {
      setActiveStep("summary");
    } else if (activeStep === "size") {
      setActiveStep("components");
    } else {
      setActiveStep("light");
    }
  };

  const previousStep = () => {
    if (editingGroup) {
      setEditingGroup(null);
      return;
    }

    if (activeStep === "light") {
      setActiveStep("components");
    } else if (activeStep === "summary") {
      setActiveStep("home");
    } else if (activeStep === "home") {
      setActiveStep("light");
    } else {
      setActiveStep("components");
    }
  };

  const setStage = (stage: StageId) => {
    setEditingGroup(null);
    setStatus("");

    if (stage === "light") {
      setActiveStep("light");
      return;
    }

    if (stage === "review") {
      setActiveStep("summary");
      return;
    }

    if (stage === "home") {
      setSelectedHomeScene("scene-01");
      setHomeSceneCameraResetKey((current) => current + 1);
      setActiveStep("home");
      return;
    }

    setActiveStep("components");
  };

  const selectHomeScene = (scene: HomeSceneId) => {
    setSelectedHomeScene(scene);
    setHomeSceneCameraResetKey((current) => current + 1);
  };

  const storeHomeSceneCameraPose = useCallback((pose: HomeSceneCameraPose | null) => {
    setHomeSceneCameraPose(pose);

    if (typeof window === "undefined") {
      return;
    }

    if (pose) {
      window.localStorage.setItem(homeSceneCameraStorageKey, JSON.stringify(pose));
      return;
    }

    window.localStorage.removeItem(homeSceneCameraStorageKey);
  }, []);

  const saveHomeSceneCameraPose = useCallback((pose: HomeSceneCameraPose) => {
    storeHomeSceneCameraPose(pose);
    setStatus("Home camera saved.");
  }, [storeHomeSceneCameraPose]);

  const openArExperience = () => {
    if (typeof window !== "undefined" && window.innerWidth <= mobileCameraBreakpoint) {
      window.location.assign(arVisualizationUrl);
      return;
    }

    setIsArModalOpen(true);
  };

  const activeHdriPreset = backgroundMode === "hdri" && hdriAsset
    ? hdriPresets.find((preset) => preset.url === hdriAsset.url)
    : null;
  const testingUploadPreviewActive = activeStage === "build" || activeStage === "light";
  const productViewerBackgroundMode: BackgroundMode = testingUploadPreviewActive && testingHdriAsset
    ? "hdri"
    : backgroundMode;
  const productViewerHdriAsset = testingUploadPreviewActive && testingHdriAsset
    ? testingHdriAsset
    : hdriAsset;
  const activeSceneBackgroundMode: BackgroundMode = activeHomeScene ? "hdri" : productViewerBackgroundMode;
  const activeSceneHdriAsset = activeHomeScene ? homeSceneHdriAsset : productViewerHdriAsset;
  const activeSceneViewerSettings = useMemo<ViewerSettings>(() => {
    if (!activeHomeScene) {
      return viewerSettings;
    }

    return homeSceneSettings;
  }, [activeHomeScene, homeSceneSettings, viewerSettings]);
  const selectedHomeProductVariant =
    homeProductVariants[selectedHomeProductVariantIndex] ?? homeProductVariants[0];
  const activeSceneLampProduct = activeHomeScene
    ? selectedHomeProductVariant.productId
    : selectedLampProduct;
  const activeSceneLampHeight = activeHomeScene
    ? selectedHomeProductVariant.height
    : selectedLampHeight;
  const activeTestingModelName = testingUploadPreviewActive ? testingModelAsset?.name ?? null : null;
  const activeTestingModelUrl = testingUploadPreviewActive ? testingModelAsset?.url ?? null : null;
  const changeHomeProductVariant = (direction: -1 | 1) => {
    setSelectedHomeScene("scene-01");
    setSelectedHomeProductVariantIndex((current) => {
      return (current + direction + homeProductVariants.length) % homeProductVariants.length;
    });
  };

  return (
    <main className={`configurator-shell intro-${introPhase}`} aria-busy={introPhase !== "ready"}>
      <section className="studio-area" aria-label="3D floor lamp preview">
        <Suspense fallback={<div className="bike-stage bike-stage-loading" aria-hidden="true" />}>
          <BikeScene
            backgroundMode={activeSceneBackgroundMode}
            config={config}
            focus={focus}
            hdriAsset={activeSceneHdriAsset}
            homeSceneCameraCommand={null}
            homeSceneCameraPose={homeSceneCameraPose}
            introPhase={introPhase}
            onIntroComplete={() => setIntroPhase("ready")}
            onHomeSceneCameraPoseChange={saveHomeSceneCameraPose}
            onSceneReady={() => setSceneReady(true)}
            homeSceneCameraResetKey={homeSceneCameraResetKey}
            selectedHomeScene={activeHomeScene}
            selectedHomeLampSize={selectedHomeProductVariant.sizeId}
            selectedLampHeight={activeSceneLampHeight}
            selectedLampProduct={activeSceneLampProduct}
            showLampModel={showLampModel}
            showHotspots={showHotspots}
            testingModelName={activeTestingModelName}
            testingModelUrl={activeTestingModelUrl}
            viewerSettings={activeSceneViewerSettings}
          />
        </Suspense>

        {introPhase === "ready" && (
          <button
            aria-haspopup="dialog"
            aria-label="Open AR barcode"
            className="ar-launch-button"
            onClick={openArExperience}
            type="button"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" aria-hidden="true" className="ar-launch-icon" src={publicAsset("ar/ar-icon.jpg")} />
          </button>
        )}

        {isArModalOpen && (
          <div className="ar-modal-backdrop">
            <div aria-label="AR barcode" aria-modal="true" className="ar-modal" role="dialog">
              <button
                aria-label="Close AR barcode"
                className="ar-modal-close"
                onClick={() => setIsArModalOpen(false)}
                type="button"
              >
                Close
              </button>
              <small>AR View</small>
              <strong>Scan to view in AR</strong>
              {/* Static GitHub Pages build cannot use next/image here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="QR code to open the AR viewer"
                className="ar-qr-code"
                height={160}
                src={publicAsset("ar/qr-code-6.png")}
                width={160}
              />
              <p>Point your phone camera at this code to launch the lamp in AR.</p>
            </div>
          </div>
        )}
      </section>

      <aside className="control-panel" aria-hidden={introPhase === "loading"} aria-label="Aster Selection floor lamp configurator">
        <header className="panel-header">
          <span
            aria-label={brandName}
            className="panel-brand-logo"
            role="img"
            style={{ backgroundImage: `url(${publicAsset("brand/logo-white.png")})` }}
          />
          <span className="panel-product-name">{modelName}</span>
        </header>

        <nav className="stage-tabs" aria-label="Configuration stages" style={stageTabStyle}>
          <button
            className={activeStage === "build" ? "active" : ""}
            onClick={() => setStage("build")}
            type="button"
          >
            Build
          </button>
          <button
            className={activeStage === "light" ? "active" : ""}
            onClick={() => setStage("light")}
            type="button"
          >
            Light
          </button>
          <button
            className={activeStage === "home" ? "active" : ""}
            onClick={() => setStage("home")}
            type="button"
          >
            Home
          </button>
          <button
            className={activeStage === "review" ? "active" : ""}
            onClick={() => setStage("review")}
            type="button"
          >
            Review
          </button>
        </nav>

        <div className="panel-body">
          {activeStep === "home" && (
            <section className="build-list home-list" aria-label="Home scene selection">
              <div className="section-title">
                <p>Home</p>
                <strong>Scene</strong>
              </div>
              <button
                aria-pressed={selectedHomeScene === "scene-01"}
                className={
                  selectedHomeScene === "scene-01"
                    ? "build-card scene-card selected"
                    : "build-card scene-card"
                }
                onClick={() => selectHomeScene("scene-01")}
                type="button"
              >
                <span className="part-thumb frame-thumb">
                  <PartIcon kind="frame" />
                </span>
                <span>
                  <strong>Scene 01</strong>
                </span>
                <em>{selectedHomeScene === "scene-01" ? "Selected" : "Select"}</em>
              </button>
              <div className="home-product-carousel" aria-label="Home product selection">
                <div className="section-title">
                  <p>Product</p>
                  <strong>{selectedHomeProductVariantIndex + 1}/{homeProductVariants.length}</strong>
                </div>
                <div className="home-product-card">
                  <button
                    aria-label="Previous product model"
                    className="home-product-arrow home-product-arrow-prev"
                    onClick={() => changeHomeProductVariant(-1)}
                    type="button"
                  >
                    <span aria-hidden="true" />
                  </button>
                  <span className="home-product-copy">
                    <strong>{selectedHomeProductVariant.productLabel}</strong>
                    <small>{selectedHomeProductVariant.colorLabel} / {selectedHomeProductVariant.height}</small>
                  </span>
                  <button
                    aria-label="Next product model"
                    className="home-product-arrow home-product-arrow-next"
                    onClick={() => changeHomeProductVariant(1)}
                    type="button"
                  >
                    <span aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="home-render-controls" aria-label="Scene 01 render controls">
                <div className="section-title">
                  <p>Scene 01 Setup</p>
                  <div className="section-title-actions">
                    <strong>Render</strong>
                    <button
                      className="studio-reset"
                      onClick={() => setHomeSceneSettings(defaultHomeSceneSettings)}
                      type="button"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="studio-group">
                  <p>Post Processing</p>
                  <StudioRange
                    label="Bloom Intensity"
                    max={3}
                    min={0}
                    onChange={(value) => updateHomeSceneNumber("bloom", value)}
                    step={0.01}
                    value={homeSceneSettings.bloom}
                  />
                  <StudioEmissionColorRadios
                    onChange={updateHomeEmissionColor}
                    value={homeSceneSettings.emissionColor}
                  />
                </div>

                <div className="studio-group">
                  <p>HDRI</p>
                  <StudioRange
                    label="HDRI Intensity"
                    max={4}
                    min={0}
                    onChange={(value) => updateHomeSceneNumber("hdriIntensity", value)}
                    step={0.01}
                    value={homeSceneSettings.hdriIntensity}
                  />
                  <StudioRange
                    label="HDRI Rotation"
                    max={180}
                    min={-180}
                    onChange={(value) => updateHomeSceneNumber("hdriRotation", value)}
                    step={1}
                    suffix=" deg"
                    value={homeSceneSettings.hdriRotation}
                  />
                </div>
              </div>
            </section>
          )}

          {activeStage === "build" && !editingGroup && activeStep !== "size" && (
            <section className="build-list" aria-label="Build selections">
              <button
                aria-pressed={showHotspots}
                className={`hotspot-toggle ${showHotspots ? "active" : ""}`}
                onClick={() => setShowHotspots((current) => !current)}
                type="button"
              >
                <span className="hotspot-toggle-dot" />
                {showHotspots ? "Hide Dimension" : "Show Dimension"}
              </button>
              {buildCards.map((card) => (
                <button
                  className="build-card"
                  key={card.id}
                  onClick={card.onClick}
                  type="button"
                >
                  <span className={`part-thumb ${card.thumb}-thumb`}>
                    <PartIcon kind={card.icon} />
                  </span>
                  <span>
                    <strong>{card.label}</strong>
                    {card.value ? <small>{card.value}</small> : null}
                  </span>
                  <em>{card.meta}</em>
                  <i className="edit-icon" />
                </button>
              ))}

            </section>
          )}

          {activeStep === "size" && (
            <section className="step-content" aria-label="Size selection">
              <button className="back-link" onClick={previousStep} type="button">
                Back
              </button>
              <div className="size-grid">
                {visibleSizeOptions.map((size) => (
                  <div className="size-dropdown-item" key={size.id}>
                    <button
                      aria-expanded={isLampHeightOpen && config.size === size.id}
                      aria-pressed={config.size === size.id}
                      className={config.size === size.id ? "selected" : ""}
                      onClick={() => {
                        const isSelectedSize = config.size === size.id;
                        const nextHeightOptions = getLampHeightOptions(size.id, selectedLampProduct);
                        setConfig((current) => ({ ...current, size: size.id }));
                        setSelectedLampHeight(nextHeightOptions[0]);
                        setShowLampModel(true);
                        setIsLampHeightOpen((current) => (isSelectedSize ? !current : true));
                      }}
                      type="button"
                    >
                      <strong>{size.label}</strong>
                      {size.dimensions ? <span>{size.dimensions}</span> : null}
                    </button>
                    {isLampHeightOpen && config.size === size.id && (
                      <div className="lamp-height-dropdown" role="radiogroup" aria-label="Lamp height">
                        {getLampHeightOptions(size.id, selectedLampProduct).map((height) => (
                          <label className="lamp-height-option" key={height}>
                            <input
                              checked={selectedLampHeight === height}
                              name="lamp-height"
                              onChange={() => {
                                setSelectedLampHeight(height);
                                setShowLampModel(true);
                              }}
                              type="radio"
                              value={height}
                            />
                            <span>{height}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeStep === "components" && editingGroup && (
            <section className="step-content" aria-label="Component options">
              {(() => {
                const group = componentGroups.find((item) => item.key === editingGroup);

                if (!group) {
                  return null;
                }

                return (
                  <>
                    <button className="back-link" onClick={previousStep} type="button">
                      Back
                    </button>
                    <div className="option-stack">
                      {group.options.map((option) => (
                        <button
                          className={
                            config.components[group.key] === option.id
                              ? "option-row selected"
                              : "option-row"
                          }
                          key={option.id}
                          onClick={() => updateComponent(group, option.id)}
                          type="button"
                        >
                          <span className="option-thumb">
                            <PartIcon kind={getComponentIconKey(group.key)} />
                          </span>
                          <span>
                            <strong>{option.name}</strong>
                            <small>{option.subtitle}</small>
                          </span>
                          <em>{option.priceDelta ? `+${formatter.format(option.priceDelta)}` : "Included"}</em>
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </section>
          )}

          {activeStep === "summary" && (
            <section className="summary-list" aria-label="Configuration summary">
              {summaryRows.map(([label, value]) => (
                <div className="summary-row" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </section>
          )}

          {activeStep === "light" && (
            <section className="studio-settings" aria-label="Light settings">
              <div className="section-title">
                <p>Light</p>
                <div className="section-title-actions">
                  <strong>Emission</strong>
                  <button
                    className="studio-reset"
                    onClick={() => setViewerSettings(defaultViewerSettings)}
                    type="button"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="studio-group">
                <p>Bloom</p>
                <StudioRange
                  label="Bloom Intensity"
                  max={3}
                  min={0}
                  onChange={(value) => updateViewerNumber("bloom", value)}
                  step={0.01}
                  value={viewerSettings.bloom}
                />
                <StudioEmissionColorRadios
                  onChange={updateEmissionColor}
                  value={viewerSettings.emissionColor}
                />
              </div>

              <div className="studio-group testing-upload-group">
                <p>Testing Uploads</p>
                <div className="testing-upload-grid">
                  <label className="testing-upload-slot">
                    <span>
                      <em>GLB</em>
                      <strong>{testingModelAsset?.name ?? "Choose file"}</strong>
                    </span>
                    <input
                      accept=".glb,model/gltf-binary"
                      onChange={(event) => {
                        updateTestingModelUpload(event.currentTarget.files?.[0] ?? null);
                        event.currentTarget.value = "";
                      }}
                      type="file"
                    />
                  </label>
                  <label className="testing-upload-slot">
                    <span>
                      <em>HDRI</em>
                      <strong>{testingHdriAsset?.name ?? "Choose file"}</strong>
                    </span>
                    <input
                      accept=".hdr,.exr,.jpg,.jpeg,.png,.webp,image/*"
                      onChange={(event) => {
                        updateTestingHdriUpload(event.currentTarget.files?.[0] ?? null);
                        event.currentTarget.value = "";
                      }}
                      type="file"
                    />
                  </label>
                </div>
                {(testingModelAsset || testingHdriAsset) && (
                  <div className="testing-upload-actions">
                    {testingModelAsset && (
                      <button onClick={clearTestingModelUpload} type="button">
                        Clear GLB
                      </button>
                    )}
                    {testingHdriAsset && (
                      <button onClick={clearTestingHdriUpload} type="button">
                        Clear HDRI
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeStep === "studio" && (
            <section className="studio-settings" aria-label="Studio environment settings">
              <div className="section-title">
                <p>Studio</p>
                <div className="section-title-actions">
                  <strong>Render Setup</strong>
                  <button
                    className="studio-reset"
                    onClick={() => setViewerSettings(defaultViewerSettings)}
                    type="button"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="studio-select-row">
                <label>
                  <span>Tone Mapping</span>
                  <select
                    onChange={(event) => updateToneMapping(event.currentTarget.value as ToneMappingKey)}
                    value={viewerSettings.toneMapping}
                  >
                    {toneMappingLabels.map((mode) => (
                      <option key={mode.id} value={mode.id}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="studio-group">
                <p>HDRI Dome</p>
                <div className="studio-hdri-presets" aria-label="Preset HDRI domes">
                  <span>Preset HDRI</span>
                  <div className="studio-hdri-preset-row">
                    {hdriPresets.map((preset) => {
                      const isActivePreset = activeHdriPreset?.id === preset.id;

                      return (
                        <button
                          aria-label={`${preset.label} HDRI preset. Intensity ${preset.settings.hdriIntensity.toFixed(2)}, scale ${preset.settings.hdriScale.toFixed(2)}, rotation ${preset.settings.hdriRotation} degrees`}
                          aria-pressed={isActivePreset}
                          className={isActivePreset ? "studio-hdri-preset active" : "studio-hdri-preset"}
                          key={preset.id}
                          onClick={() => applyHdriPreset(preset)}
                          style={{ "--preset-swatch": preset.swatch } as CSSProperties}
                          title={`${preset.label}: ${preset.settings.hdriIntensity.toFixed(2)} intensity, ${preset.settings.hdriScale.toFixed(2)}x scale, ${preset.settings.hdriRotation} deg`}
                          type="button"
                        >
                          <span aria-hidden="true" />
                          <em>{preset.label}</em>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <StudioRange
                  label="HDRI Intensity"
                  max={4}
                  min={0}
                  onChange={(value) => updateViewerNumber("hdriIntensity", value)}
                  step={0.01}
                  value={viewerSettings.hdriIntensity}
                />
                <StudioRange
                  label="HDRI Scale"
                  max={2.5}
                  min={0.5}
                  onChange={(value) => updateViewerNumber("hdriScale", value)}
                  step={0.01}
                  suffix="x"
                  value={viewerSettings.hdriScale}
                />
                <StudioRange
                  label="HDRI Rotation"
                  max={180}
                  min={-180}
                  onChange={(value) => updateViewerNumber("hdriRotation", value)}
                  step={1}
                  suffix=" deg"
                  value={viewerSettings.hdriRotation}
                />
              </div>

              <div className="studio-group">
                <p>Environment</p>
                <StudioColorPalette
                  active={backgroundMode === "color"}
                  onChange={updateViewerColor}
                  value={viewerSettings.environmentColor}
                />
                <StudioRange
                  label="Exposure"
                  max={2.4}
                  min={0.2}
                  onChange={(value) => updateViewerNumber("exposure", value)}
                  step={0.01}
                  value={viewerSettings.exposure}
                />
                <StudioRange
                  label="Environment Intensity"
                  max={3}
                  min={0}
                  onChange={(value) => updateViewerNumber("environmentIntensity", value)}
                  step={0.01}
                  value={viewerSettings.environmentIntensity}
                />
                <StudioRange
                  label="Environment Rotation"
                  max={180}
                  min={-180}
                  onChange={(value) => updateViewerNumber("environmentRotation", value)}
                  step={1}
                  suffix=" deg"
                  value={viewerSettings.environmentRotation}
                />
                <StudioRange
                  label="Environment Contrast"
                  max={1.7}
                  min={0.7}
                  onChange={(value) => updateViewerNumber("environmentContrast", value)}
                  step={0.01}
                  value={viewerSettings.environmentContrast}
                />
              </div>

            </section>
          )}
        </div>

        <footer className="panel-footer">
          <div className="price-block">
            <span>{modelName}</span>
            <strong>{formatter.format(total)}</strong>
            <small>Delivery in 4-6 weeks</small>
          </div>
          <div className="footer-actions">
            <button className="primary-action" onClick={nextStep} type="button">
              {activeStep === "summary"
                ? "Buy it now"
                : editingGroup
                  ? "Confirm"
                  : "Next"}
            </button>
          </div>
        </footer>
        {status && <p className="status-line">{status}</p>}
      </aside>

      {introPhase === "loading" ? (
        <div className="experience-loader" role="status" aria-label="Loading Aster Collection configurator">
          <span
            aria-label={brandName}
            className="loader-mark loader-brand-logo"
            role="img"
            style={{ backgroundImage: `url(${publicAsset("brand/logo-white.png")})` }}
          />
          <div className="loader-track" aria-hidden="true">
            <span style={{ width: `${loaderProgress}%` }} />
          </div>
        </div>
      ) : null}

    </main>
  );
}
