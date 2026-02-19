import { useMemo, useRef, useState } from "react";
import { normalizeStepColor } from "./domain/colors";
import { normalizeOperatorInvolvement } from "./domain/operator";
import type { PlanSettings, Run, Segment, SimulationMetrics, Step, StepGroup } from "./domain/types";
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
    initialPlan.template.map((step) => ({
      ...step,
      operatorInvolvement: normalizeOperatorInvolvement(step),
      groupId: step.groupId ?? null,
      color: normalizeStepColor(step.color),
    })),
  );
  const [stepGroups, setStepGroups] = useState<StepGroup[]>(initialPlan.stepGroups ?? []);
  const [runs, setRuns] = useState(initialPlan.runs);
  const [settings, setSettings] = useState<PlanSettings>(initialPlan.settings);
  const [showWaits, setShowWaits] = useState(true);
  const [pxPerMin, setPxPerMin] = useState(10);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [isDebugDrawerOpen, setIsDebugDrawerOpen] = useState(false);
  const timelineBoxRef = useRef<HTMLDivElement | null>(null);

  const simulate = () => {
    const result = simulateDES({
      ...initialPlan,
      template,
      stepGroups,
      runs,
      settings,
    });
    setSegments(result.segments);
    setMetrics(result.metrics);
  };

  const applyImportedScenario = (payload: {
    template: Step[];
    stepGroups: StepGroup[];
    runs: Run[];
    settings: PlanSettings;
  }) => {
    setTemplate(
      payload.template.map((step) => ({
        ...step,
        operatorInvolvement: normalizeOperatorInvolvement(step),
        groupId: step.groupId ?? null,
        color: normalizeStepColor(step.color),
      })),
    );
    setStepGroups(payload.stepGroups);
    setRuns(payload.runs);
    setSettings(payload.settings);
    setSegments([]);
    setMetrics(null);
  };

  const visibleSegments = showWaits ? segments : segments.filter((segment) => segment.kind !== "wait");
  const stepGroupsById = useMemo(
    () => Object.fromEntries(stepGroups.map((group) => [group.id, group])),
    [stepGroups],
  );
  const stepGroupNamesByStepId = useMemo(
    () =>
      Object.fromEntries(
        template.map((step) => [
          step.id,
          step.groupId ? stepGroupsById[step.groupId]?.name : undefined,
        ]),
      ),
    [template, stepGroupsById],
  );
  const stepColorsById = useMemo(
    () =>
      Object.fromEntries(
        template.map((step) => {
          const groupColor = step.groupId ? stepGroupsById[step.groupId]?.color : undefined;
          return [step.id, normalizeStepColor(groupColor ?? step.color)];
        }),
      ),
    [template, stepGroupsById],
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
      <header className="panel-card app-hero">
        <div className="app-hero-content">
          <p className="app-eyebrow">RoboPlanner</p>
          <h1>Test Timeline Planner</h1>
        </div>
        <p className="plan-pill">Current plan: {initialPlan.name}</p>
      </header>

      <div className="workspace-grid">
        <section className="workspace-main" data-testid="workspace-main">
          <div className="panel-card utility-card utility-portability-card" data-testid="utility-portability-card">
            <ImportExportPanel
              settings={settings}
              template={template}
              stepGroups={stepGroups}
              runs={runs}
              onImport={applyImportedScenario}
            />
          </div>
          <div className="panel-card">
            <TemplateEditor
              steps={template}
              stepGroups={stepGroups}
              onChange={({ steps, stepGroups: nextStepGroups }) => {
                setTemplate(steps);
                setStepGroups(nextStepGroups);
              }}
            />
          </div>
        </section>

        <aside className="workspace-side" data-testid="workspace-side">
          <div className="panel-card utility-card">
            <RunsEditor onChange={setRuns} runs={runs} templateId={initialPlan.id} />
          </div>
          <section className="panel-card utility-card utility-settings-card settings-panel" data-testid="utility-settings-card">
            <h2>Simulation Settings</h2>
            <div className="settings-fields">
              <label className="field-row" htmlFor="operator-capacity">
                <span>Operator capacity</span>
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
              </label>
              <label className="checkbox-label" htmlFor="show-waits">
                <input
                  checked={showWaits}
                  id="show-waits"
                  type="checkbox"
                  onChange={(event) => setShowWaits(event.target.checked)}
                />
                Show wait segments
              </label>
            </div>
            <button className="simulate-button" data-testid="simulate-button" type="button" onClick={simulate}>
              Simulate
            </button>
          </section>

          <div className="panel-card utility-card utility-metrics-card" data-testid="utility-metrics-card">
            <MetricsPanel metrics={metrics} />
          </div>
        </aside>
      </div>

      <section className="panel-card timeline-panel" data-testid="timeline-panel">
        <div className="timeline-panel-header">
          <div className="timeline-panel-title">
            <h2>Timeline</h2>
            <p>{visibleSegments.length} segments visible</p>
          </div>
          <div className="viewport-actions" data-testid="timeline-controls">
            <button type="button" onClick={() => zoom(1.25)}>
              Zoom in
            </button>
            <button type="button" onClick={() => zoom(0.8)}>
              Zoom out
            </button>
            <button type="button" onClick={fitToWindow}>
              Fit
            </button>
          </div>
        </div>
        <div ref={timelineBoxRef} className="timeline-box" data-testid="timeline-box">
          <TimelineSvg
            pxPerMin={pxPerMin}
            runs={runs}
            segments={visibleSegments}
            stepColorsById={stepColorsById}
            stepGroupNamesByStepId={stepGroupNamesByStepId}
            viewStartMin={timelineStartMin}
            viewEndMin={timelineEndMin}
          />
        </div>
      </section>

      <section className="panel-card debug-panel">
        <button
          aria-controls="developer-tools-body"
          aria-expanded={isDebugDrawerOpen}
          className="debug-toggle"
          data-testid="debug-drawer-toggle"
          type="button"
          onClick={() => setIsDebugDrawerOpen((current) => !current)}
        >
          {isDebugDrawerOpen ? "Hide developer tools" : "Show developer tools"}
        </button>
        <div
          id="developer-tools-body"
          className={`debug-drawer-content ${isDebugDrawerOpen ? "is-open" : ""}`}
          data-testid="debug-drawer-content"
        >
          <div className="debug-state-grid">
            <section className="debug-state-card">
              <h3>Template State</h3>
              <pre data-testid="template-state">{JSON.stringify(template)}</pre>
            </section>
            <section className="debug-state-card">
              <h3>Runs State</h3>
              <pre data-testid="runs-state">{JSON.stringify(runs)}</pre>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
