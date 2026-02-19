import { useMemo, useState } from "react";
import type { Run, Segment, Step } from "./domain/types";
import { scheduleLinear } from "./simulation/engine";
import { createInitialPlans } from "./state/planState";
import RunsEditor from "./ui/runs/RunsEditor";
import TemplateEditor from "./ui/template/TemplateEditor";
import TimelineSvg from "./ui/timeline/TimelineSvg";

function App() {
  const initialPlan = useMemo(() => createInitialPlans()[0], []);
  const [template, setTemplate] = useState<Step[]>(initialPlan.template);
  const [runs, setRuns] = useState<Run[]>(initialPlan.runs);
  const [segments, setSegments] = useState<Segment[]>([]);

  const simulate = () => {
    setSegments(
      scheduleLinear({
        ...initialPlan,
        template,
        runs,
      }),
    );
  };

  const viewStartMin =
    segments.length > 0 ? Math.min(...segments.map((segment) => segment.startMin)) : 0;

  return (
    <main className="app-shell">
      <h1>Test Timeline Planner</h1>
      <p>Current plan: {initialPlan.name}</p>
      <TemplateEditor steps={template} onChange={setTemplate} />
      <RunsEditor onChange={setRuns} runs={runs} templateId={initialPlan.id} />
      <div className="simulate-panel">
        <button type="button" onClick={simulate}>
          Simulate
        </button>
      </div>
      <h2>Timeline</h2>
      <TimelineSvg pxPerMin={10} runs={runs} segments={segments} viewStartMin={viewStartMin} />
      <h2>Template State</h2>
      <pre data-testid="template-state">{JSON.stringify(template)}</pre>
      <h2>Runs State</h2>
      <pre data-testid="runs-state">{JSON.stringify(runs)}</pre>
    </main>
  );
}

export default App;
