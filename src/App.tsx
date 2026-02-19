import { useMemo, useState } from "react";
import type { Segment, Step } from "./domain/types";
import { scheduleLinear } from "./simulation/engine";
import { createInitialPlans } from "./state/planState";
import TemplateEditor from "./ui/template/TemplateEditor";
import TimelineSvg from "./ui/timeline/TimelineSvg";

function App() {
  const initialPlan = useMemo(() => createInitialPlans()[0], []);
  const [template, setTemplate] = useState<Step[]>(initialPlan.template);
  const [segments, setSegments] = useState<Segment[]>([]);

  const simulate = () => {
    setSegments(
      scheduleLinear({
        ...initialPlan,
        template,
      }),
    );
  };

  return (
    <main className="app-shell">
      <h1>Test Timeline Planner</h1>
      <p>Current plan: {initialPlan.name}</p>
      <TemplateEditor steps={template} onChange={setTemplate} />
      <div className="simulate-panel">
        <button type="button" onClick={simulate}>
          Simulate
        </button>
      </div>
      <h2>Timeline</h2>
      <TimelineSvg pxPerMin={10} runs={initialPlan.runs} segments={segments} viewStartMin={0} />
      <h2>Template State</h2>
      <pre data-testid="template-state">{JSON.stringify(template)}</pre>
    </main>
  );
}

export default App;
