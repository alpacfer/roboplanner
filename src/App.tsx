import { useMemo, useRef, useState } from "react";
import { normalizeStepColor } from "./domain/colors";
import type { PlanSettings, Run, Segment, SimulationMetrics, Step } from "./domain/types";
import { simulateDES } from "./simulation/engine";
import { createInitialPlans } from "./state/planState";
import MetricsPanel from "./ui/metrics/MetricsPanel";
import ImportExportPanel from "./ui/portability/ImportExportPanel";
import RunsEditor from "./ui/runs/RunsEditor";
import TemplateEditor from "./ui/template/TemplateEditor";
import TimelineSvg, { TIMELINE_LEFT_PAD, TIMELINE_RIGHT_PAD } from "./ui/timeline/TimelineSvg";

const MIN_PX_PER_MIN = 0.1;
const MAX_PX_PER_MIN = 40;

function App() {
  const initialPlan = useMemo(() => createInitialPlans()[0], []);
  const [template, setTemplate] = useState<Step[]>(
    initialPlan.template.map((step) => ({ ...step, color: normalizeStepColor(step.color) })),
  );
  const [runs, setRuns] = useState(initialPlan.runs);
  const [settings, setSettings] = useState<PlanSettings>(initialPlan.settings);
  const [showWaits, setShowWaits] = useState(true);
  const [pxPerMin, setPxPerMin] = useState(10);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const timelineBoxRef = useRef<HTMLDivElement | null>(null);

  const simulate = () => {
    const result = simulateDES({
      ...initialPlan,
      template,
      runs,
      settings,
    });
    setSegments(result.segments);
    setMetrics(result.metrics);
  };

  const applyImportedScenario = (payload: {
    template: Step[];
    runs: Run[];
    settings: PlanSettings;
  }) => {
    setTemplate(payload.template.map((step) => ({ ...step, color: normalizeStepColor(step.color) })));
    setRuns(payload.runs);
    setSettings(payload.settings);
    setSegments([]);
    setMetrics(null);
  };

  const visibleSegments = showWaits ? segments : segments.filter((segment) => segment.kind !== "wait");
  const stepColorsById = useMemo(
    () => Object.fromEntries(template.map((step) => [step.id, normalizeStepColor(step.color)])),
    [template],
  );
  const timelineStartMin =
    visibleSegments.length > 0 ? Math.min(...visibleSegments.map((segment) => segment.startMin)) : 0;
  const timelineEndMin =
    visibleSegments.length > 0 ? Math.max(...visibleSegments.map((segment) => segment.endMin)) : timelineStartMin;

  const zoom = (factor: number) => {
    setPxPerMin((current) => {
      const next = current * factor;
      return Math.max(MIN_PX_PER_MIN, Math.min(MAX_PX_PER_MIN, next));
    });
  };

  const fitToWindow = () => {
    if (!timelineBoxRef.current) {
      return;
    }

    const spanMin = Math.max(1, timelineEndMin - timelineStartMin);
    const availablePx = Math.max(
      40,
      timelineBoxRef.current.clientWidth - TIMELINE_LEFT_PAD - TIMELINE_RIGHT_PAD,
    );
    const fitted = availablePx / spanMin;
    setPxPerMin(Math.max(MIN_PX_PER_MIN, Math.min(MAX_PX_PER_MIN, fitted)));
    timelineBoxRef.current.scrollTo({ left: 0, top: 0, behavior: "auto" });
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
          max={MAX_PX_PER_MIN}
          min={MIN_PX_PER_MIN}
          step={0.1}
          type="number"
          value={pxPerMin.toFixed(1)}
          onChange={(event) => {
            const value = Number.parseFloat(event.target.value);
            if (Number.isNaN(value)) {
              return;
            }
            setPxPerMin(Math.max(MIN_PX_PER_MIN, Math.min(MAX_PX_PER_MIN, value)));
          }}
        />
        <button type="button" onClick={() => zoom(1.25)}>
          Zoom in
        </button>
        <button type="button" onClick={() => zoom(0.8)}>
          Zoom out
        </button>
        <button type="button" onClick={fitToWindow}>
          Fit to window
        </button>
      </section>
      <h2>Timeline</h2>
      <div ref={timelineBoxRef} className="timeline-box" data-testid="timeline-box">
        <TimelineSvg
          pxPerMin={pxPerMin}
          runs={runs}
          segments={visibleSegments}
          stepColorsById={stepColorsById}
          viewStartMin={timelineStartMin}
          viewEndMin={timelineEndMin}
        />
      </div>
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
