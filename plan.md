# Test timeline planner (web app)
A web app for planning linear device testing sequences and visualizing capacity over time as a timeline (Gantt-style) with a shared **operator** resource. The app models multiple device runs executing the same step template. Some steps require an operator. When operator capacity is saturated, runs queue and wait. Output is rendered as a **custom SVG timeline**.

## Core goals
- Define a **step template** (linear sequence).
- Define **device runs** (instances of the template) with start times.
- Simulate execution with a **discrete event simulation (DES)**.
- Visualize results as a **custom SVG timeline**:
  - One lane per run
  - Step segments + optional wait segments
  - Clear marking of operator-required steps
- Support **import/export of scenario data** (template + runs + settings) using a readable, manually editable format.

## Non-goals
- Collaboration or multi-user accounts
- Backend required for MVPs
- Complex dependency graphs (steps are strictly sequential within a run)
- Optimization solver (no “best schedule”, only policy-based simulation)

## Assumptions
- Internal time unit: **minutes** (integer).
- Steps have fixed durations (integer minutes) in early MVPs.
- Operator requirement is a boolean: operator is required for the **entire step**.
- Operator capacity is a small integer (default 1).
- Queue policy starts as FIFO. Add optional policies later.

## Proposed tech stack
- Frontend: React + TypeScript + Vite
- State: Zustand (or React state for early MVPs)
- Persistence: LocalStorage (later upgrade to IndexedDB if needed)
- Tests:
  - Unit: Vitest
  - Component: React Testing Library
  - E2E: Playwright
- Lint/format: ESLint + Prettier

## Project structure (suggested)
- src/
  - app/
    - App.tsx
    - routes/
  - domain/
    - types.ts
    - validation.ts
  - simulation/
    - engine.ts
    - pq.ts
    - policies.ts
    - metrics.ts
    - fixtures.ts
  - ui/
    - portability/
      - ImportExportPanel.tsx
    - template/
      - TemplateEditor.tsx
    - runs/
      - RunsEditor.tsx
    - timeline/
      - TimelineSvg.tsx
      - scale.ts
      - viewport.ts
      - tooltip.ts
  - storage/
    - localStorageRepo.ts
    - schema.ts
  - test/
    - testUtils.ts
- playwright/
  - e2e.spec.ts

## Domain model
### Step template
- id: string
- name: string
- durationMin: number (integer, > 0)
- requiresOperator: boolean

### Run (device instance)
- id: string
- label: string
- startMin: number (integer, >= 0)
- templateId: string

### Plan
- id: string
- name: string
- template: Step[]
- runs: Run[]
- settings:
  - operatorCapacity: number (integer, >= 1)
  - queuePolicy: "FIFO" | "SPT" | "PRIORITY" (start with FIFO)
- optional later:
  - baseStartDateTimeISO: string

### Simulation output
A schedule is a list of segments.
- runId: string
- stepId?: string (undefined for waits)
- name: string
- startMin: number
- endMin: number
- kind: "step" | "wait"
- requiresOperator: boolean

Also produce an event log (useful for debugging).
- timeMin: number
- type: "RUN_READY" | "STEP_START" | "STEP_END" | "OP_ACQUIRE" | "OP_RELEASE" | "WAIT_START" | "WAIT_END"
- runId: string
- stepId?: string

## Simulation rules (DES)
- Each run executes steps in order.
- A non-operator step starts as soon as the run is ready.
- An operator step starts when the run is ready AND operator capacity is available.
- If operator capacity is not available:
  - run enters a queue (policy-defined)
  - run is considered waiting from queue-enter time until operator acquired
- When an operator step ends:
  - operator capacity is released
  - queued runs may acquire capacity at the same timestamp until capacity is filled

## Rendering rules (SVG timeline)
- Time axis is horizontal, lanes vertical.
- Each run is a lane.
- Each segment is a rectangle:
  - x = (startMin - viewStartMin) * pxPerMin
  - width = (endMin - startMin) * pxPerMin
- Label rendering:
  - draw text only when width exceeds a threshold (avoid clutter)
- Visibility:
  - only render segments intersecting the viewport time window

## MVP roadmap
Implement in order. After each MVP, all tests for that MVP must pass.

### MVP 0: Repository scaffold
Deliverables
- Vite + React + TS project
- ESLint + Prettier
- Vitest setup
- Playwright setup
- CI-style scripts:
  - npm run lint
  - npm run test
  - npm run test:e2e

Tests to pass
- Unit smoke test: 1 trivial test runs in Vitest
- E2E smoke test: app loads and shows a placeholder title

### MVP 1: Data model + validation
Deliverables
- Domain types (Step, Run, Plan, Segment)
- Validation functions:
  - durationMin is integer > 0
  - startMin is integer >= 0
  - operatorCapacity is integer >= 1
  - step names not empty
  - run labels not empty
- Basic in-memory plan state with one default plan

Unit tests (Vitest)
- validation rejects:
  - durationMin = 0, -1, 1.5
  - startMin = -1, 2.2
  - operatorCapacity = 0
  - empty names
- validation accepts:
  - durationMin = 1, 30
  - startMin = 0, 120
- snapshot test of a default plan object shape

E2E tests (Playwright)
- app loads
- default plan is visible

### MVP 2: Template editor (no simulation yet)
Deliverables
- UI to edit template steps:
  - add step
  - edit name, durationMin, requiresOperator
  - delete step
  - reorder steps (drag/drop optional; buttons OK for MVP)
- Validation errors shown inline

Component tests (RTL)
- adding a step adds a row
- editing duration updates state
- invalid duration shows error

E2E tests
- user creates 3 steps and sees them persisted in UI state

### MVP 3: Deterministic schedule without operator constraint (baseline)
Deliverables
- Pure function: scheduleLinear(plan) -> Segment[]
  - each run: steps execute sequentially starting from run.startMin
  - ignores operator capacity and queues
  - no wait segments
- Timeline SVG renders segments for one run

Unit tests (important)
Use this fixture:
Template:
1) "Prep" 10, operator=true
2) "Soak" 30, operator=false
3) "Measure" 20, operator=true

Run:
- R1 startMin=0

Expected output segments (exact):
[
  {"runId":"R1","name":"Prep","startMin":0,"endMin":10,"kind":"step","requiresOperator":true},
  {"runId":"R1","name":"Soak","startMin":10,"endMin":40,"kind":"step","requiresOperator":false},
  {"runId":"R1","name":"Measure","startMin":40,"endMin":60,"kind":"step","requiresOperator":true}
]

Add tests:
- total time equals last endMin (60)
- segments are contiguous (endMin of i equals startMin of i+1)

SVG component tests
- renders 3 rects for R1
- rect x/width scale matches pxPerMin within tolerance

E2E tests
- create template + run
- click "simulate" (even if it just runs baseline)
- timeline shows 3 bars

### MVP 4: Runs editor + multi-run baseline visualization
Deliverables
- UI to add/edit runs:
  - add run (label, startMin)
  - edit run startMin
  - delete run
- Timeline shows lanes for multiple runs
- Viewport window (simple: auto-fit to full schedule)

Unit tests
Fixture:
- Same template as MVP3
Runs:
- R1 startMin=0
- R2 startMin=15

Expected segments for R2 (exact):
[
  {"runId":"R2","name":"Prep","startMin":15,"endMin":25,"kind":"step","requiresOperator":true},
  {"runId":"R2","name":"Soak","startMin":25,"endMin":55,"kind":"step","requiresOperator":false},
  {"runId":"R2","name":"Measure","startMin":55,"endMin":75,"kind":"step","requiresOperator":true}
]

Chart tests
- two lanes exist
- segments render only in their lane group

E2E tests
- add R2
- timeline updates with 2 lanes

### MVP 5: DES engine with operator resource (FIFO, capacity=1)
Deliverables
- Pure function: simulateDES(plan) -> { segments, events, metrics }
- Operator capacity enforced
- Queue is FIFO
- Wait segments produced when runs queue for operator steps
- UI toggle: show/hide wait segments

Unit tests (core correctness)
Use this fixture (small but revealing):
Template:
1) "OpA" 10, operator=true
2) "AutoB" 20, operator=false
3) "OpC" 10, operator=true

Settings:
- operatorCapacity=1
- queuePolicy="FIFO"

Runs:
- R1 startMin=0
- R2 startMin=0

Expected schedule (exact):
R1:
- OpA: 0–10
- AutoB: 10–30
- OpC: 30–40

R2:
- WAIT for OpA: 0–10
- OpA: 10–20
- AutoB: 20–40
- WAIT for OpC: 40–40  (do NOT create zero-length waits; expect no wait here)
- OpC: 40–50

So expected segments for R2 (exact):
[
  {"runId":"R2","name":"wait: operator","startMin":0,"endMin":10,"kind":"wait","requiresOperator":false},
  {"runId":"R2","name":"OpA","startMin":10,"endMin":20,"kind":"step","requiresOperator":true},
  {"runId":"R2","name":"AutoB","startMin":20,"endMin":40,"kind":"step","requiresOperator":false},
  {"runId":"R2","name":"OpC","startMin":40,"endMin":50,"kind":"step","requiresOperator":true}
]

Add assertions:
- No overlap of operator steps across runs:
  - collect all operator step intervals, verify they do not overlap when capacity=1
- FIFO behavior:
  - If R2 queues first, it gets the next slot (in this fixture it does)
- Wait segments:
  - created only when delay > 0
  - wait end equals operator step start

Event log tests
- There is an OP_ACQUIRE at t=0 for R1 OpA
- There is an OP_ACQUIRE at t=10 for R2 OpA
- There is an OP_ACQUIRE at t=30 for R1 OpC
- There is an OP_ACQUIRE at t=40 for R2 OpC

E2E tests
- user sets capacity=1
- runs start together
- timeline shows R2 initial wait block from 0 to 10 (visible)

### MVP 6: Metrics panel
Deliverables
Compute and display:
- makespan (max endMin across all segments)
- total operator busy time
- operator utilization = busyTime / (capacity * makespan)
- total waiting time across all runs

Unit tests
Using MVP5 fixture:
- makespan = 50
- operator busy time = OpA(10+10) + OpC(10+10) = 40
- utilization = 40 / (1 * 50) = 0.8
- total waiting time = 10 (R2 waited 10)

UI tests
- metrics render with correct values

### MVP 7: Import/Export scenario data
Deliverables
- Export current scenario (template + runs + settings) to a human-readable JSON format
- Import scenario from edited JSON text
- Include schema version in exported payload (e.g., version=1)
- Validate imported payload shape and show user-friendly error on invalid input
- Applying imported scenario updates editors and timeline inputs

Unit tests
- serialization/deserialization round-trip for exported scenario payload
- schema migration stub (version number)

E2E tests
- export scenario JSON and verify readability (indented keys, version field present)
- edit JSON manually, import it, and verify UI state reflects imported values

### MVP 8: Timeline interaction (zoom/pan + visible-range rendering)
Deliverables
- Zoom control changes pxPerMin
- Pan changes viewStartMin
- Only visible segments are rendered

Unit tests
- viewport filtering: segments outside window are excluded
- zoom math: pxPerMin scaling affects x/width

E2E tests
- zoom in makes bars wider
- pan shifts bars horizontally

## Extended test suite (add after MVP5)
### Property-based tests (optional but valuable)
Generate random plans with:
- 1–10 runs
- 1–10 steps
- random operator flags
Check invariants:
- For each run, step segments are sequential and non-overlapping
- Operator steps never exceed capacity overlap
- All durations are preserved: sum(step durations) equals (endMin - startMin - waitTime) for each run

### Performance tests (dev-only)
Fixture:
- 100 runs
- 30 steps each
- 30% operator steps
Expect:
- simulateDES completes under a target threshold on a typical dev machine
- SVG renders only visible subset under zoom/pan

### Import/Export robustness tests (add after MVP7)
- Invalid JSON import shows clear error and does not mutate current state
- Unsupported schema version triggers migration-path error message
- Missing required fields (template/runs/settings) fail validation

## Codex implementation workflow
- Implement MVPs in order.
- After each MVP:
  - run unit tests
  - run E2E tests (or at least the smoke test early)
  - add fixtures and expected outputs exactly as specified above
- Keep simulation engine pure (no UI dependencies).

## Definition of done per MVP
A MVP is done when:
- All tests listed for that MVP pass
- Manual sanity check matches expected schedule for the fixture(s)
- No TypeScript errors

