export const STEP_COLOR_PRESETS = [
  "#4e79a7",
  "#f28e2b",
  "#e15759",
  "#76b7b2",
  "#59a14f",
  "#edc948",
  "#b07aa1",
  "#ff9da7",
  "#9c755f",
  "#bab0ac",
];

export const DEFAULT_STEP_COLOR = STEP_COLOR_PRESETS[0];

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function normalizeStepColor(color: string | undefined): string {
  if (!color) {
    return DEFAULT_STEP_COLOR;
  }
  return HEX_COLOR_PATTERN.test(color) ? color : DEFAULT_STEP_COLOR;
}
