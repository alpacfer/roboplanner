import { useMemo, useState } from "react";
import type { Step } from "./domain/types";
import { createInitialPlans } from "./state/planState";
import TemplateEditor from "./ui/template/TemplateEditor";

function App() {
  const initialPlan = useMemo(() => createInitialPlans()[0], []);
  const [template, setTemplate] = useState<Step[]>(initialPlan.template);

  return (
    <main className="app-shell">
      <h1>Test Timeline Planner</h1>
      <p>Current plan: {initialPlan.name}</p>
      <TemplateEditor steps={template} onChange={setTemplate} />
      <h2>Template State</h2>
      <pre data-testid="template-state">{JSON.stringify(template)}</pre>
    </main>
  );
}

export default App;
