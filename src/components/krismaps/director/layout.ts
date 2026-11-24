/** column sizes for the Director View (pixels) */

export const DEFAULT_LIBRARY_WIDTH = 256;
const MIN_LIBRARY_WIDTH = 180;
const MAX_LIBRARY_WIDTH = 480;
export const clampLibraryWidth = (w: number) =>
  Math.min(MAX_LIBRARY_WIDTH, Math.max(MIN_LIBRARY_WIDTH, Math.round(w)));

export const DEFAULT_PANEL_WIDTH = 320;
const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 720;
export const clampPanelWidth = (w: number) =>
  Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(w)));
