export type Rotation = 0 | 90 | 180 | 270;

export type Tool = "pan" | "reveal" | "hide";

export type MediaKind = "image" | "video";

export type GridMode = "pixels" | "count";

export interface MapSettings {
  favourite: boolean;
  grid: boolean;
  gridMode: GridMode;
  cellsWide: number;
  cellsHigh: number;
  cell: number;
  offsetX: number;
  offsetY: number;
  gridColor: string;
  gridOpacity: number;
  fog: boolean;
  muted: boolean;
  rotation: Rotation;
  flipH: boolean;
  flipV: boolean;
  /** epoch ms of the last time this map was displayed on screen */
  lastUsed?: number;
  /** tag ids added by hand on top of the automatic keyword rules */
  tagsAdd?: string[];
  /** tag ids removed by hand from the automatic keyword rules */
  tagsRemove?: string[];
}

export const defaultSettings: MapSettings = {
  favourite: false,
  grid: true,
  gridMode: "pixels",
  cellsWide: 20,
  cellsHigh: 20,
  cell: 100,
  offsetX: 0,
  offsetY: 0,
  gridColor: "#0b0b0f",
  gridOpacity: 0.4,
  fog: false,
  muted: true,
  rotation: 0,
  flipH: false,
  flipV: false,
};

export interface MapEntry {
  /** path relative to the chosen root, e.g. "dungeons/crypt.jpg" */
  path: string;
  name: string;
  kind: MediaKind;
  lastModified: number;
  size: number;
  file: File;
}

export interface FolderNode {
  path: string;
  name: string;
  folders: FolderNode[];
  maps: MapEntry[];
}

export interface StrokePoint {
  x: number;
  y: number;
}

export type FogMode = "reveal" | "hide";
