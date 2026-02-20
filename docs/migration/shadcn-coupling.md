# shadcn Migration Coupling Inventory

This document captures selector and accessibility couplings that migration changes must preserve.

## Critical `data-testid` selectors

- `workspace-main`
- `workspace-side`
- `utility-settings-card`
- `utility-metrics-card`
- `simulate-button`
- `timeline-panel`
- `timeline-controls`
- `timeline-box`
- `timeline-svg`
- `timeline-axis`
- `timeline-lane`
- `timeline-rect`
- `timeline-tooltip`
- `timeline-operator-pattern`
- `top-level-insert-0`
- `step-item`
- `template-group-card`
- `scenario-file-input`
- `scenario-status`
- `debug-drawer-toggle`
- `template-state`
- `runs-state`

## Role/name and aria-label couplings

- Heading: `Test Timeline Planner`
- Buttons:
  - `Import scenario`
  - `Export scenario`
  - `Simulate`
  - `Zoom in`
  - `Zoom out`
  - `Fit`
  - `Add run`
  - `Add step at top level position X`
- Inputs:
  - `Operator capacity`
  - `Scenario import file`
  - `Step name step-*`
  - `Step duration step-*`
  - `Operator involvement step-*`
  - `Step color step-*`
  - `Run label N`
  - `Run start N`
- Dialogs:
  - Confirm flows queried with `role="dialog"` in unit tests.

## Native `<select>` coupling (Playwright)

Playwright smoke tests use `selectOption()` with:

- `Operator involvement step-*`

This requires the control to remain a native `<select>` (or a wrapper that still renders native `<select>`), and not migrate to a fully custom select widget yet.
