# RoboPlanner

RoboPlanner is a React + TypeScript app for building test-process templates, simulating run timelines, and inspecting operator utilization and waits.

## Features

- Sequence-based template editor with drag-and-drop step ordering
- Per-sequence color coding reflected in timeline output
- Run editor and simulation controls
- Timeline visualization with tooltips
- Metrics panel
- Scenario import/export (JSON)

## Tech Stack

- React 18
- TypeScript
- Vite
- Vitest + Testing Library
- Playwright (E2E)

## Getting Started

### Prerequisites

- Node.js 20+ (recommended)
- npm 10+

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Then open the local Vite URL (typically `http://localhost:5173`).

## Scripts

- `npm run dev` - start development server
- `npm run build` - type-check and production build
- `npm run preview` - preview production build
- `npm run lint` - run ESLint
- `npm run test` - run unit/integration tests once
- `npm run test:ui` - run Vitest in watch/UI mode
- `npm run test:e2e` - run Playwright tests

## Project Structure

- `src/ui/template/TemplateEditor.tsx` - sequence editor UI
- `src/simulation/engine.ts` - discrete-event simulation engine
- `src/ui/timeline/TimelineSvg.tsx` - timeline rendering
- `src/storage/schema.ts` - scenario import/export schema and migration logic
- `src/state/planState.ts` - initial/default plan state

## Notes

- Internal domain fields still use `group`/`groupId` names for compatibility, while the UI refers to them as **sequences**.
- Scenario JSON import/export is versioned and validated.
