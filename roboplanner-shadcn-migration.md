# RoboPlanner → shadcn/ui migration implementation guide (for a Codex agent)

## Scope and intent

Goal: migrate the RoboPlanner UI from a large bespoke global stylesheet (`src/styles.css`) to Tailwind CSS v4 + shadcn/ui component primitives, in incremental checkpoints that keep behavior and automated tests stable.

Non-goals:
- Rewriting domain logic, simulation logic, storage schema, or timeline rendering logic (`TimelineSvg` stays custom).
- Big-bang visual redesign. Start with a behavior-preserving migration, then reduce legacy CSS.

Hard constraints (must not break):
- Preserve accessibility names used by tests (`aria-label`, visible button text, roles).
- Preserve critical `data-testid` attributes (especially timeline + TemplateEditor).
- Preserve Playwright assumptions about native controls where they exist (notably dropdown selection).

## Preflight (checkpoint 0)

### What to accomplish
1. Create a migration branch and capture a baseline “green” commit.
2. Identify all test coupling points that must remain stable during the migration.
3. Lock in the migration rules that Codex must follow for every subsequent checkpoint.

### How
1. Branching
- Create branch: `chore/shadcn-migration`
- Record baseline SHA.

2. Baseline verification
- Install deps.
- Run all gates:
  - `npm run lint`
  - `npm run test`
  - `npm run test:e2e`

3. Coupling inventory (write this into `docs/migration/shadcn-coupling.md`)
- List selectors and patterns used by tests:
  - `data-testid` keys (timeline rects, axis labels, insertion rails, etc.)
  - role/name queries (dialogs, buttons, inputs)
  - Playwright `selectOption()` usage (indicates a native `<select>` must remain)

### Tests to add/update
Add a “guard” test file to prevent accidental removal of key selectors.

Create: `src/ui/__tests__/selectors.guard.test.ts`
- Assert that key elements render with the required `data-testid` and `aria-label` strings in a minimal render of `App`.
- Fail with clear messages if a selector disappears.

### Run
- `npm run lint`
- `npm run test`
- `npm run test:e2e`

### Exit criteria
- All gates green.
- `docs/migration/shadcn-coupling.md` exists and lists the critical selectors.
- `selectors.guard.test.ts` exists and passes.

### Rollback
- Reset branch to baseline SHA.

## Global implementation rules for all checkpoints

1. Each checkpoint is a separate PR/commit series.
2. After each checkpoint: all gates must pass.
3. No “drive-by” refactors. If a file changes, it must be directly required by the checkpoint.
4. Preserve semantics first:
- Prefer keeping DOM structure stable unless the checkpoint explicitly targets it.
- Keep native form controls if Playwright automation depends on them.
5. Keep TimelineSvg logic unchanged:
- Do not change geometry calculations, data mapping, or test IDs.
- Styling changes must be minimal and compatibility-safe.

## Key design decisions (Codex must follow these)

### Dialog choice for confirmations
- Use shadcn `Dialog` (role `dialog`) for confirmation flows by default.
- Do not switch to `AlertDialog` unless you also update tests that query `getByRole("dialog")`.

### Dropdown choice
- Keep the operator involvement dropdown as a native `<select>`.
- If migrating styling, use shadcn `NativeSelect` (still renders a native `<select>`).
- Do not migrate this dropdown to shadcn `Select` until Playwright E2E no longer uses `selectOption()`.

### Styling policy
- Introduce Tailwind v4 without changing behavior first.
- Keep legacy CSS in place initially (as a compatibility layer).
- Reduce legacy CSS only after the equivalent Tailwind/shadcn styles are in place and tests are stable.

## Checkpoint 1: Tailwind v4 foundation with zero behavior change

### What to accomplish
1. Add Tailwind v4 using the official Vite plugin.
2. Import Tailwind in the existing global stylesheet without rewriting existing rules.
3. Add path alias `@/*` required by shadcn component imports.
4. Confirm build + tests remain stable.

### How
1. Dependencies
- Install Tailwind v4 + Vite plugin:
  - `tailwindcss`
  - `@tailwindcss/vite`
- Add `@types/node` (for Vite path alias config).

2. Vite config
Edit: `vite.config.ts`
- Add `tailwindcss()` to the plugins list.
- Add `resolve.alias` mapping `@` → `./src`.

3. TypeScript config
Edit both (Vite splits config):
- `tsconfig.json`
- `tsconfig.app.json`

Add:
- `compilerOptions.baseUrl = "."`
- `compilerOptions.paths = { "@/*": ["./src/*"] }`

4. Tailwind import without churn
Edit: `src/styles.css`
- Add at the very top:
  - `@import "tailwindcss";`
- Keep all existing CSS rules immediately after (no rewrite yet).

### Tests to add/update
- Update `selectors.guard.test.ts` only if importing Tailwind changes any baseline rendering (it should not).
- Add a small build smoke test if you don’t already have one:
  - `npm run build` should be part of the gate for this checkpoint.

### Run
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

### Exit criteria
- All gates green.
- No meaningful DOM or selector changes.

### Rollback
- Revert the Tailwind commit(s).

## Checkpoint 2: Initialize shadcn/ui and add core primitives

### What to accomplish
1. Add shadcn/ui configuration (`components.json`) aligned with this repo.
2. Add the minimal shadcn primitives needed for the next checkpoints.
3. Add `src/lib/utils.ts` (`cn` helper) if the CLI doesn’t generate it in the expected location.

### How
1. Initialize shadcn
- Run `npx shadcn@latest init`
- Choose a style preset (use the default suggested by the CLI unless it conflicts with your current theme constraints).
- Point components to: `src/components/ui`
- Confirm alias: `@/`

2. Add dependencies required by generated components
- If not installed automatically, add:
  - `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`
- Add Tailwind v4 animation utilities:
  - `tw-animate-css` (dev dependency)

3. Add core primitives
Run:
- `npx shadcn@latest add button card badge dialog input table popover native-select checkbox label separator collapsible`

Note:
- If any primitive is not available under the same name, add the closest official equivalent and document the mapping in `docs/migration/shadcn-mapping.md`.

4. Wire animation utilities (only if needed by added components)
Edit: `src/styles.css`
- Add after Tailwind import:
  - `@import "tw-animate-css";`

### Tests to add/update
Create: `src/components/ui/__tests__/ui-smoke.test.tsx`
- Mount one instance of each added primitive in a minimal test render.
- This catches missing peer deps or broken component generation early.

### Run
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

### Exit criteria
- shadcn primitives compile and basic smoke tests pass.
- No behavior changes in the app yet.

### Rollback
- Revert the init + add commits.

## Checkpoint 3: Migrate shared primitives (ConfirmDialog, IntegerInput)

### What to accomplish
1. Replace ConfirmDialog internals with shadcn `Dialog`, preserving:
- Prop API
- role `dialog`
- accessible names used by tests
- `data-testid` pass-through

2. Render IntegerInput using shadcn `Input`, preserving:
- Sanitization/normalization
- commit-on-blur behavior
- `aria-label` usage
- same value semantics (string draft, numeric commit)

### How

1. ConfirmDialog
Edit: `src/ui/common/ConfirmDialog.tsx`
- Replace custom overlay/modal markup with shadcn `Dialog` primitives.
- Keep:
  - `open={isOpen}`
  - `onOpenChange` calling `onCancel()` when closing
  - Confirm and Cancel button `aria-label` strings exactly as before
  - `data-testid` on the outermost rendered DialogContent (or a stable wrapper)

2. IntegerInput
Edit: `src/ui/common/IntegerInput.tsx`
- Replace `<input ...>` with shadcn `<Input ...>`
- Keep event handling logic intact:
  - onFocus/onBlur
  - draft state
  - commit normalization

### Tests to add/update
1. ConfirmDialog tests
If none exist, create: `src/ui/common/ConfirmDialog.test.tsx`
- `renders nothing when closed`
- `renders role=dialog with accessible name = title`
- `confirm calls onConfirm`
- `cancel calls onCancel`
- `closing via overlay/escape triggers onCancel` (if supported)

2. IntegerInput tests
If none exist, create: `src/ui/common/IntegerInput.test.tsx`
- `keeps draft while typing`
- `commits normalized integer on blur`
- `clamps to min/max if component currently does clamping`
- `does not commit invalid input (or commits fallback) according to current behavior`

### Run
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

### Exit criteria
- All unit tests green.
- RunsEditor flows (add/delete run) still pass in E2E.

### Rollback
- Revert the ConfirmDialog/IntegerInput commit.

## Checkpoint 4: Migrate RunsEditor and MetricsPanel

### What to accomplish
1. Migrate RunsEditor table + buttons to shadcn `Table` and `Button`, preserving:
- table semantics
- `aria-label` strings
- confirm-delete flow and selectors

2. Migrate MetricsPanel to shadcn `Card` layout with Tailwind utilities, preserving:
- `data-testid` on metric values (if used)
- semantics (`dl`/`dt`/`dd` is fine to keep)

### How
1. RunsEditor
Edit: `src/ui/runs/RunsEditor.tsx`
- Replace table markup to use shadcn `Table*` primitives.
- Replace action buttons with shadcn `Button` variants:
  - icon buttons: `variant="ghost"` + `size="icon"`
  - destructive actions: `variant="destructive"` where appropriate
- Keep all `aria-label`s and `data-testid`s unchanged.

2. MetricsPanel
Edit: `src/ui/metrics/MetricsPanel.tsx`
- Wrap in `Card`
- Use Tailwind utility layout for grid/spacing
- Keep current DOM test hooks.

### Tests to add/update
1. RunsEditor regression tests
- Add at least one new RTL test that validates:
  - delete opens the dialog
  - confirm deletes
  - cancel does not delete
- Add a test that asserts the operator involvement dropdown remains a native `<select>` (or `NativeSelect` rendering one), if it appears in this surface.

2. MetricsPanel
- Add a snapshot-like structural test only if current suite lacks coverage (avoid fragile CSS snapshots).

### Run
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

### Exit criteria
- RunsEditor unit + E2E tests pass.
- No layout regressions in Playwright geometry assertions (if present).

### Rollback
- Revert RunsEditor/MetricsPanel commit.

## Checkpoint 5: App shell migration (layout, header, common controls)

### What to accomplish
1. Replace “panel-card / workspace-grid” style layout with Tailwind utilities + shadcn `Card`.
2. Migrate common buttons/checkboxes/labels in `App.tsx` to shadcn primitives.
3. Keep critical `data-testid` and layout constraints used by E2E.

### How
Edit: `src/App.tsx`
- Replace outer layout class names with Tailwind grid/flex utilities.
- Wrap major areas (template editor, runs editor, timeline, metrics) in `Card`:
  - use `CardHeader` for titles
  - `CardContent` for body
- Migrate:
  - Simulate button → `Button`
  - checkbox rows → `Checkbox` + `Label` (if used)
  - separators → `Separator` where it replaces purely visual dividers
- Keep stable element IDs and test IDs.

### Tests to add/update
- Extend `selectors.guard.test.ts` to include App shell hooks that Playwright uses.
- Add a focused Playwright test (if missing) that checks:
  - major panels are visible
  - timeline controls render
  - simulate flow still works

### Run
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

### Exit criteria
- Layout-related E2E tests (including geometry assertions) are green.

### Rollback
- Revert App shell commit.

## Checkpoint 6: TemplateEditor migration in slices (do not big-bang)

TemplateEditor is the highest-risk surface. Migrate it in multiple sub-checkpoints. Each sub-checkpoint must be independently green.

### Checkpoint 6.1: Buttons, badges, inputs (no behavior changes)
What to accomplish
- Replace bespoke buttons (move/delete/add) with shadcn `Button`.
- Replace pills/status with `Badge`.
- Replace text inputs with shadcn `Input` (except IntegerInput which is already done).
How
- Edit: `src/ui/template/TemplateEditor.tsx` and any direct child components.
- Keep existing `aria-label` strings and `data-testid`s unchanged.
Tests
- Add/extend TemplateEditor tests:
  - add sequence/step
  - move up/down
  - delete triggers confirm dialog
Run gates and exit criteria as usual.

### Checkpoint 6.2: Color menus → Popover
What to accomplish
- Replace manual open/close state + document event listeners with shadcn `Popover`.
How
- Use `Popover`, `PopoverTrigger`, `PopoverContent`.
- Keep `input type="color"` native.
- Preserve focus/keyboard behavior used by tests.
Tests
- Add a test for:
  - opening the popover by clicking the trigger
  - changing color updates the state (whatever current behavior is)
  - popover closes on outside click / escape (if supported)

### Checkpoint 6.3: Dropdowns
What to accomplish
- Migrate non-Playwright-critical dropdowns to shadcn `Select` only if E2E does not depend on them as native selects.
- Keep the operator involvement dropdown native via `NativeSelect`.
How
- Identify which dropdowns are automated by Playwright.
- Only migrate the others.
Tests
- Add a test asserting operator involvement remains a `<select>`.

### Run
After each 6.x sub-checkpoint:
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

### Rollback
- Revert only the failing sub-checkpoint commit and keep earlier 6.x commits.

## Checkpoint 7: Timeline boundary strategy (preserve TimelineSvg logic)

### What to accomplish
1. Keep `src/ui/timeline/TimelineSvg.tsx` logic unchanged.
2. Migrate the surrounding timeline panel controls to shadcn primitives.
3. Move timeline tooltip/container styling to Tailwind utilities where safe, while keeping any test-required classnames.

### How
1. TimelineSvg
- No changes to calculations or `data-testid` generation.
- If tests depend on `.axis-label` (or other classes), keep them.

2. Timeline panel controls
- Migrate buttons/checkboxes near the timeline to shadcn components.
- Keep `data-testid` on control wrappers used by Playwright.

3. Minimal timeline-only CSS exception (only if needed)
If some SVG styling cannot be replicated without destabilizing tests:
- Create `src/ui/timeline/timeline.css`
- Import it only from `TimelineSvg.tsx`
- Keep it tiny and scoped.

### Tests to add/update
- Add a unit test that asserts timeline critical hooks remain:
  - `data-testid` counts for rects
  - presence of `.axis-label` elements if tests rely on them
- Add/keep Playwright geometry tests that assert:
  - labels and fields do not overlap
  - timeline rail does not stretch unexpectedly

### Run
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

### Exit criteria
- Timeline unit + E2E tests green, no geometry regressions.

### Rollback
- Revert timeline wrapper/control changes first; avoid touching TimelineSvg.

## Checkpoint 8: Portability cleanup (remove unused ImportExportPanel) + test redistribution

### What to accomplish
1. Remove unused UI component:
- delete `src/ui/portability/ImportExportPanel.tsx`
- delete its test file

2. Preserve coverage by moving tests to portability utilities and App-level import/export tests.

### How
1. Delete
- `src/ui/portability/ImportExportPanel.tsx`
- `src/ui/portability/ImportExportPanel.test.tsx` (if present)

2. Add utility-level tests
Create: `src/ui/portability/portability.test.ts`
Cover:
- export fallback behavior
- format detection
- unsupported format handling
- JSON import success + error cases
- TestStand import success + error cases

3. Keep integration coverage
- Update `src/App.test.tsx` (or equivalent) to cover:
  - import flow (file input)
  - export flow (download trigger or callback)

### Run
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

### Exit criteria
- Coverage parity: previous portability scenarios still tested, now at utility/app level.

### Rollback
- Revert the deletion commit if it breaks coverage or runtime flows.

## Checkpoint 9: Legacy CSS reduction and final hardening

### What to accomplish
1. Remove legacy CSS rules that are no longer used.
2. Keep only:
- global tokens (CSS variables)
- minimal base element rules
- timeline-only exception file if it exists
3. Finalize accessibility and stability.

### How
1. Identify dead CSS
- Use IDE “find references” for class names
- Grep for legacy class names (e.g., `panel-card`, `workspace-grid`)
- Delete unused blocks incrementally

2. Add a “no legacy class” assertion (optional but helpful)
Create: `scripts/check-no-legacy-css.ts` (or similar)
- Fail CI if banned legacy classnames still appear in TSX.

3. Accessibility sweep
- Run Testing Library role/name queries locally in key tests.
- Confirm dialogs, buttons, and inputs remain discoverable.

### Tests to add/update
- Add a single test that renders App and asserts no banned legacy class names remain on the key panels (keep it narrow to reduce fragility).

### Run
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

### Exit criteria
- Legacy CSS reduced to a small, understandable file.
- All automated tests green.
- Manual smoke pass:
  - add/edit template steps
  - add/delete runs
  - simulate
  - timeline zoom/fit (if present)
  - import/export

### Rollback
- Revert only the CSS reduction commit(s). Avoid reverting earlier functional migrations.

## Appendix: Standard quality gate commands

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

Optional (if supported by package scripts):
- `npm run test -- <pattern>`
- `npm run test:e2e -- <pattern>`

