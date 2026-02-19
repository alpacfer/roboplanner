import { useMemo, useState } from "react";
import type { PlanSettings, Run, Segment, SimulationMetrics, Step } from "./domain/types";
import { simulateDES } from "./simulation/engine";
import { createInitialPlans } from "./state/planState";
import MetricsPanel from "./ui/metrics/MetricsPanel";
import ImportExportPanel from "./ui/portability/ImportExportPanel";
import RunsEditor from "./ui/runs/RunsEditor";
import TemplateEditor from "./ui/template/TemplateEditor";
import TimelineSvg from "./ui/timeline/TimelineSvg";

function App() {
  const VIEW_WINDOW_MIN = 80;
  const initialPlan = useMemo(() => createInitialPlans()[0], []);
  const [template, setTemplate] = useState<Step[]>(initialPlan.template);
  const [runs, setRuns] = useState(initialPlan.runs);
  const [settings, setSettings] = useState<PlanSettings>(initialPlan.settings);
  const [showWaits, setShowWaits] = useState(true);
  const [pxPerMin, setPxPerMin] = useState(10);
  const [viewStartMin, setViewStartMin] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);

  const simulate = () => {
    const result = simulateDES({
      ...initialPlan,
      template,
      runs,
      settings,
    });
    setSegments(result.segments);
    setMetrics(result.metrics);
    const initialVisible = showWaits
      ? result.segments
      : result.segments.filter((segment) => segment.kind !== "wait");
    const minStart = initialVisible.length > 0 ? Math.min(...initialVisible.map((segment) => segment.startMin)) : 0;
    setViewStartMin(minStart);
  };

  const applyImportedScenario = (payload: {
    template: Step[];
    runs: Run[];
    settings: PlanSettings;
  }) => {
    setTemplate(payload.template);
    setRuns(payload.runs);
    setSettings(payload.settings);
    setSegments([]);
    setMetrics(null);
    setViewStartMin(0);
  };

  const visibleSegments = showWaits ? segments : segments.filter((segment) => segment.kind !== "wait");
  const maxEndMin = visibleSegments.length > 0 ? Math.max(...visibleSegments.map((segment) => segment.endMin)) : 0;
  const maxViewStart = Math.max(0, maxEndMin - VIEW_WINDOW_MIN);
  const clampedViewStartMin = Math.min(Math.max(0, viewStartMin), maxViewStart);
  const viewEndMin = clampedViewStartMin + VIEW_WINDOW_MIN;

  const pan = (deltaMin: number) => {
    setViewStartMin((current) => Math.max(0, current + deltaMin));
  };

  const zoom = (factor: number) => {
    setPxPerMin((current) => {
      const next = current * factor;
      return Math.max(2, Math.min(40, next));
    });
  };

  return (
    <main className="app-shell">
      <h1>Test Timeline Planner</h1>
      <p>Current plan: {initialPlan.name}</p>
      <TemplateEditor steps={template} onChange={setTemplate} />
      <RunsEditor onChange={setRuns} runs={runs} templateId={initialPlan.id} />
      <section className="settings-panel">
        <h2>Simulation Settings</h2>
        <label htmlFor="operator-capacity">Operator capacity</label>
        <input
          id="operator-capacity"
          min={1}
          step={1}
          type="number"
          value={settings.operatorCapacity}
          onChange={(event) => {
            const value = Number.parseInt(event.target.value, 10);
            setSettings((prev) => ({
              ...prev,
              operatorCapacity: Number.isNaN(value) ? 1 : Math.max(1, value),
            }));
          }}
        />
        <label className="checkbox-label" htmlFor="show-waits">
          <input
            checked={showWaits}
            id="show-waits"
            type="checkbox"
            onChange={(event) => setShowWaits(event.target.checked)}
          />
          Show wait segments
        </label>
      </section>
      <div className="simulate-panel">
        <button type="button" onClick={simulate}>
          Simulate
        </button>
      </div>
      <section className="viewport-panel">
        <h2>Viewport</h2>
        <label htmlFor="zoom-px-per-min">Zoom (px/min)</label>
        <input
          id="zoom-px-per-min"
          aria-label="Zoom (px/min)"
          max={40}
          min={2}
          step={1}
          type="number"
          value={Math.round(pxPerMin)}
          onChange={(event) => {
            const value = Number.parseInt(event.target.value, 10);
            if (Number.isNaN(value)) {
              return;
            }
            setPxPerMin(Math.max(2, Math.min(40, value)));
          }}
        />
        <button type="button" onClick={() => zoom(1.25)}>
          Zoom in
        </button>
        <button type="button" onClick={() => zoom(0.8)}>
          Zoom out
        </button>
        <button type="button" onClick={() => pan(-10)}>
          Pan left
        </button>
        <button type="button" onClick={() => pan(10)}>
          Pan right
        </button>
      </section>
      <h2>Timeline</h2>
      <TimelineSvg
        pxPerMin={pxPerMin}
        runs={runs}
        segments={visibleSegments}
        viewStartMin={clampedViewStartMin}
        viewEndMin={viewEndMin}
      />
      <MetricsPanel metrics={metrics} />
      <ImportExportPanel
        settings={settings}
        template={template}
        runs={runs}
        onImport={applyImportedScenario}
      />
      <h2>Template State</h2>
      <pre data-testid="template-state">{JSON.stringify(template)}</pre>
      <h2>Runs State</h2>
      <pre data-testid="runs-state">{JSON.stringify(runs)}</pre>
    </main>
  );
}

export default App;
