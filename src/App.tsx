import { useMemo, useState } from "react";
import type { PlanSettings, Segment, Step } from "./domain/types";
import { simulateDES } from "./simulation/engine";
import { createInitialPlans } from "./state/planState";
import RunsEditor from "./ui/runs/RunsEditor";
import TemplateEditor from "./ui/template/TemplateEditor";
import TimelineSvg from "./ui/timeline/TimelineSvg";

function App() {
  const initialPlan = useMemo(() => createInitialPlans()[0], []);
  const [template, setTemplate] = useState<Step[]>(initialPlan.template);
  const [runs, setRuns] = useState(initialPlan.runs);
  const [settings, setSettings] = useState<PlanSettings>(initialPlan.settings);
  const [showWaits, setShowWaits] = useState(true);
  const [segments, setSegments] = useState<Segment[]>([]);

  const simulate = () => {
    const result = simulateDES({
      ...initialPlan,
      template,
      runs,
      settings,
    });
    setSegments(result.segments);
  };

  const visibleSegments = showWaits ? segments : segments.filter((segment) => segment.kind !== "wait");
  const viewStartMin =
    visibleSegments.length > 0 ? Math.min(...visibleSegments.map((segment) => segment.startMin)) : 0;

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
      <h2>Timeline</h2>
      <TimelineSvg pxPerMin={10} runs={runs} segments={visibleSegments} viewStartMin={viewStartMin} />
      <h2>Template State</h2>
      <pre data-testid="template-state">{JSON.stringify(template)}</pre>
      <h2>Runs State</h2>
      <pre data-testid="runs-state">{JSON.stringify(runs)}</pre>
    </main>
  );
}

export default App;
