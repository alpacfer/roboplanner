export const DEFAULT_STEP_COLOR = "#4f7cff";

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function normalizeStepColor(color: string | undefined): string {
  if (!color) {
    return DEFAULT_STEP_COLOR;
  }
  return HEX_COLOR_PATTERN.test(color) ? color : DEFAULT_STEP_COLOR;
}
