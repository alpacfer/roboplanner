import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { DEFAULT_STEP_COLOR, STEP_COLOR_PRESETS, normalizeStepColor } from "./domain/colors";
import { normalizeOperatorInvolvement } from "./domain/operator";
import type { PlanSettings, Run, Segment, SimulationMetrics, Step, StepGroup } from "./domain/types";
import { simulateDES } from "./simulation/engine";
import { createInitialPlans } from "./state/planState";
import { SCENARIO_SCHEMA_VERSION } from "./storage/schema";
import MetricsPanel from "./ui/metrics/MetricsPanel";
import IntegerInput from "./ui/common/IntegerInput";
import { exportScenarioAsDownload, importScenarioFromFile } from "./ui/portability/portability";
import RunsEditor from "./ui/runs/RunsEditor";
import TemplateEditor from "./ui/template/TemplateEditor";
import TimelineSvg, {
  TIMELINE_LEFT_PAD,
  TIMELINE_RIGHT_PAD,
} from "./ui/timeline/TimelineSvg";

const MIN_PX_PER_MIN = 0.1;
const MAX_PX_PER_MIN = 40;
const TIMELINE_TOP_PAD = 18;
const TIMELINE_AXIS_HEIGHT = 26;
const TIMELINE_LANE_HEIGHT = 44;
const TIMELINE_LANE_GAP = 10;
const TIMELINE_BOTTOM_PAD = 18;

function assignDefaultSequenceColorsInOrder(stepGroups: StepGroup[]): StepGroup[] {
  return stepGroups.map((group, index) => ({
    ...group,
    color: STEP_COLOR_PRESETS[index % STEP_COLOR_PRESETS.length] ?? DEFAULT_STEP_COLOR,
  }));
}

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
  const [portabilityStatus, setPortabilityStatus] = useState("");
  const timelineBoxRef = useRef<HTMLDivElement | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

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
    setStepGroups(assignDefaultSequenceColorsInOrder(payload.stepGroups));
    setRuns(payload.runs);
    setSettings(payload.settings);
    setSegments([]);
    setMetrics(null);
  };

  const handleExportClick = () => {
    try {
      const fileName = exportScenarioAsDownload({
        template,
        stepGroups,
        runs,
        settings,
      });
      setPortabilityStatus(`Scenario downloaded (${fileName}).`);
    } catch {
      setPortabilityStatus("Export failed.");
    }
  };

  const handleImportClick = () => {
    importFileInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      setPortabilityStatus("No file selected.");
      return;
    }

    try {
      const imported = await importScenarioFromFile({
        file,
        runs,
        settings,
      });

      applyImportedScenario({
        template: imported.template,
        stepGroups: imported.stepGroups,
        runs: imported.runs,
        settings: imported.settings,
      });
      setPortabilityStatus(imported.statusMessage);
    } catch (error) {
      setPortabilityStatus(error instanceof Error ? error.message : "Import failed.");
    } finally {
      event.target.value = "";
    }
  };

  const visibleSegments = showWaits ? segments : segments.filter((segment) => segment.kind !== "wait");
  const timelineHeightPx =
    TIMELINE_TOP_PAD +
    TIMELINE_AXIS_HEIGHT +
    runs.length * (TIMELINE_LANE_HEIGHT + TIMELINE_LANE_GAP) +
    TIMELINE_BOTTOM_PAD;
  const stepGroupsById = useMemo(
    () => Object.fromEntries(stepGroups.map((group) => [group.id, group])),
    [stepGroups],
  );
  const stepGroupNamesByStepId = useMemo(
    () =>
      Object.fromEntries(
        template.map((step) => [step.id, step.groupId ? stepGroupsById[step.groupId]?.name : undefined]),
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
        <p className="plan-pill">Version {SCENARIO_SCHEMA_VERSION}</p>
      </header>

      <div className="workspace-grid">
        <section className="workspace-main" data-testid="workspace-main">
          <div className="panel-card">
            <TemplateEditor
              portabilityStatus={portabilityStatus}
              stepGroups={stepGroups}
              steps={template}
              onChange={({ steps, stepGroups: nextStepGroups }) => {
                setTemplate(steps);
                setStepGroups(nextStepGroups);
              }}
              onExportClick={handleExportClick}
              onImportClick={handleImportClick}
            />
            <input
              ref={importFileInputRef}
              accept="application/json,.json,text/html,.html,.htm,text/plain"
              aria-label="Scenario import file"
              className="portability-file-input"
              data-testid="scenario-file-input"
              type="file"
              onChange={handleImportFile}
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
                <IntegerInput
                  ariaLabel="Operator capacity"
                  min={1}
                  value={settings.operatorCapacity}
                  onCommit={(capacity) => {
                    setSettings((prev) => ({
                      ...prev,
                      operatorCapacity: Math.max(1, capacity),
                    }));
                  }}
                />
              </label>
            </div>

            <button
              className="simulate-button"
              data-testid="simulate-button"
              disabled={template.length === 0}
              type="button"
              onClick={simulate}
            >
              Simulate
            </button>
          </section>
        </aside>

        <section className="panel-card timeline-panel" data-testid="timeline-panel">
          <div className="timeline-panel-header">
            <div className="timeline-panel-title">
              <h2>Timeline</h2>
              <p>{visibleSegments.length} segments visible</p>
            </div>
            <div className="viewport-actions" data-testid="timeline-controls">
              <label className="checkbox-label timeline-checkbox-label" htmlFor="show-waits">
                <input
                  checked={showWaits}
                  id="show-waits"
                  type="checkbox"
                  onChange={(event) => setShowWaits(event.target.checked)}
                />
                Show wait segments
              </label>
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
          <div
            ref={timelineBoxRef}
            className="timeline-box"
            data-testid="timeline-box"
            style={{ height: `${timelineHeightPx}px` }}
          >
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

        <div className="panel-card utility-card utility-metrics-card" data-testid="utility-metrics-card">
          <MetricsPanel metrics={metrics} />
        </div>
      </div>

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
