import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  Maximize2Icon,
  MoonIcon,
  SunIcon,
  UploadIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_STEP_COLOR, STEP_COLOR_PRESETS, normalizeStepColor } from "./domain/colors";
import { normalizeOperatorInvolvement } from "./domain/operator";
import type {
  PlanSettings,
  Run,
  Segment,
  SharedResource,
  SimulationMetrics,
  Step,
  StepGroup,
} from "./domain/types";
import { simulateDES } from "./simulation/engine";
import { createInitialPlans } from "./state/planState";
import { SCENARIO_SCHEMA_VERSION } from "./storage/schema";
import MetricsPanel from "./ui/metrics/MetricsPanel";
import IntegerInput from "./ui/common/IntegerInput";
import { exportScenarioAsDownload, importScenarioFromFile } from "./ui/portability/portability";
import SharedResourcesEditor from "./ui/resources/SharedResourcesEditor";
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
const THEME_STORAGE_KEY = "roboplanner-theme";
const THEME_TRANSITION_MS = 180;

type AppTheme = "light" | "dark";

function assignDefaultSequenceColorsInOrder(stepGroups: StepGroup[]): StepGroup[] {
  return stepGroups.map((group, index) => ({
    ...group,
    color: STEP_COLOR_PRESETS[index % STEP_COLOR_PRESETS.length] ?? DEFAULT_STEP_COLOR,
  }));
}

function normalizeStepResourceIds(resourceIds: Step["resourceIds"]): string[] {
  if (!Array.isArray(resourceIds)) {
    return [];
  }
  return resourceIds.filter((resourceId): resourceId is string => typeof resourceId === "string");
}

function pruneDeletedResourceIdsFromSteps(steps: Step[], resources: SharedResource[]): Step[] {
  const availableResourceIds = new Set(resources.map((resource) => resource.id));
  let didChange = false;

  const nextSteps = steps.map((step) => {
    const currentResourceIds = normalizeStepResourceIds(step.resourceIds);
    const nextResourceIds = currentResourceIds.filter((resourceId) => availableResourceIds.has(resourceId));
    if (nextResourceIds.length === currentResourceIds.length) {
      return step;
    }
    didChange = true;
    return {
      ...step,
      resourceIds: nextResourceIds,
    };
  });

  return didChange ? nextSteps : steps;
}

function getInitialTheme(): AppTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function App() {
  const initialPlan = useMemo(() => createInitialPlans()[0], []);
  const [template, setTemplate] = useState<Step[]>(
    initialPlan.template.map((step) => ({
      ...step,
      operatorInvolvement: normalizeOperatorInvolvement(step),
      groupId: step.groupId ?? null,
      color: normalizeStepColor(step.color),
      resourceIds: normalizeStepResourceIds(step.resourceIds),
    })),
  );
  const [stepGroups, setStepGroups] = useState<StepGroup[]>(initialPlan.stepGroups ?? []);
  const [runs, setRuns] = useState(initialPlan.runs);
  const [sharedResources, setSharedResources] = useState<SharedResource[]>([]);
  const [settings, setSettings] = useState<PlanSettings>(initialPlan.settings);
  const [showWaits, setShowWaits] = useState(true);
  const [pxPerMin, setPxPerMin] = useState(10);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [isDebugDrawerOpen, setIsDebugDrawerOpen] = useState(false);
  const [portabilityStatus, setPortabilityStatus] = useState("");
  const [theme, setTheme] = useState<AppTheme>(getInitialTheme);
  const timelineBoxRef = useRef<HTMLDivElement | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const themeTransitionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const isDark = theme === "dark";
    const root = document.documentElement;
    root.classList.add("theme-animating");
    root.classList.toggle("dark", isDark);
    root.style.colorScheme = isDark ? "dark" : "light";
    if (themeTransitionTimerRef.current !== null) {
      window.clearTimeout(themeTransitionTimerRef.current);
    }
    themeTransitionTimerRef.current = window.setTimeout(() => {
      document.documentElement.classList.remove("theme-animating");
      themeTransitionTimerRef.current = null;
    }, THEME_TRANSITION_MS);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(
    () => () => {
      if (themeTransitionTimerRef.current !== null) {
        window.clearTimeout(themeTransitionTimerRef.current);
      }
    },
    [],
  );

  const simulate = () => {
    const result = simulateDES({
      ...initialPlan,
      template,
      stepGroups,
      runs,
      settings,
      sharedResources,
    });
    setSegments(result.segments);
    setMetrics(result.metrics);
  };

  const applyImportedScenario = (payload: {
    template: Step[];
    stepGroups: StepGroup[];
    runs: Run[];
    settings: PlanSettings;
    sharedResources: SharedResource[];
  }) => {
    setTemplate(
      payload.template.map((step) => ({
        ...step,
        operatorInvolvement: normalizeOperatorInvolvement(step),
        groupId: step.groupId ?? null,
        color: normalizeStepColor(step.color),
        resourceIds: normalizeStepResourceIds(step.resourceIds),
      })),
    );
    setStepGroups(assignDefaultSequenceColorsInOrder(payload.stepGroups));
    setRuns(payload.runs);
    setSettings(payload.settings);
    setSharedResources(payload.sharedResources);
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
        sharedResources,
      });
      setPortabilityStatus(`Scenario downloaded (${fileName}).`);
    } catch {
      setPortabilityStatus("Export failed.");
    }
  };

  const handleImportClick = () => {
    importFileInputRef.current?.click();
  };

  const handleSharedResourcesChange = (nextResources: SharedResource[]) => {
    setSharedResources(nextResources);
    setTemplate((currentTemplate) => pruneDeletedResourceIdsFromSteps(currentTemplate, nextResources));
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
        sharedResources,
      });

      applyImportedScenario({
        template: imported.template,
        stepGroups: imported.stepGroups,
        runs: imported.runs,
        settings: imported.settings,
        sharedResources: imported.sharedResources,
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

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  return (
    <main className="app-shell mx-auto grid max-w-[1350px] gap-5">
      <Card className="panel-card app-hero">
        <div className="app-hero-inline">
          <h1>Test Timeline Planner</h1>
          <div className="app-hero-inline-right">
            <p className="plan-pill">Version {SCENARIO_SCHEMA_VERSION}</p>
            <div className="app-hero-action-cluster">
              <ButtonGroup aria-label="Scenario portability actions" className="app-hero-portability-actions">
                <Button
                  aria-label="Import scenario"
                  className="portability-action-button"
                  type="button"
                  variant="outline"
                  onClick={handleImportClick}
                >
                  <DownloadIcon aria-hidden="true" />
                  <span>Import</span>
                </Button>
                <Button
                  aria-label="Export scenario"
                  className="portability-action-button"
                  type="button"
                  variant="outline"
                  onClick={handleExportClick}
                >
                  <UploadIcon aria-hidden="true" />
                  <span>Export</span>
                </Button>
              </ButtonGroup>
              <span aria-hidden="true" className="hero-action-divider" />
              <Button
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                className="theme-toggle-button"
                type="button"
                variant="outline"
                onClick={toggleTheme}
              >
                {theme === "dark" ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
                <span>{theme === "dark" ? "Light" : "Dark"}</span>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="workspace-grid grid gap-5">
        <section className="workspace-main" data-testid="workspace-main">
          <Card className="panel-card">
            <TemplateEditor
              portabilityStatus={portabilityStatus}
              stepGroups={stepGroups}
              sharedResources={sharedResources}
              steps={template}
              onChange={({ steps, stepGroups: nextStepGroups }) => {
                setTemplate(steps);
                setStepGroups(nextStepGroups);
              }}
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
          </Card>
        </section>

        <aside className="workspace-side" data-testid="workspace-side">
          <Card className="panel-card utility-card">
            <RunsEditor onChange={setRuns} runs={runs} templateId={initialPlan.id} />
          </Card>

          <Card className="panel-card utility-card" data-testid="utility-shared-resources-card">
            <SharedResourcesEditor resources={sharedResources} onChange={handleSharedResourcesChange} />
          </Card>

          <Card className="panel-card utility-card utility-settings-card settings-panel" data-testid="utility-settings-card">
            <CardHeader className="pb-2 px-0">
              <CardTitle>Simulation Settings</CardTitle>
            </CardHeader>
            <CardContent className="settings-content px-0">
              <div className="settings-fields">
                <label className="field-row settings-field" htmlFor="operator-capacity">
                  <span>Operator capacity</span>
                  <IntegerInput
                    ariaLabel="Operator capacity"
                    className="settings-input"
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

              <div className="settings-actions">
                <Button
                  className="simulate-button"
                  data-testid="simulate-button"
                  disabled={template.length === 0}
                  type="button"
                  onClick={simulate}
                >
                  Simulate
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>

        <Card className="panel-card timeline-panel" data-testid="timeline-panel">
          <div className="timeline-panel-header">
            <div className="timeline-panel-title">
              <h2>Timeline</h2>
              <p>{visibleSegments.length} segments visible</p>
            </div>
            <div className="viewport-actions" data-testid="timeline-controls">
              <Button
                aria-label={showWaits ? "Hide wait segments" : "Show wait segments"}
                aria-pressed={showWaits}
                className="icon-button"
                size="icon"
                type="button"
                variant="outline"
                onClick={() => setShowWaits((current) => !current)}
              >
                {showWaits ? <EyeIcon aria-hidden="true" /> : <EyeOffIcon aria-hidden="true" />}
              </Button>
              <ButtonGroup aria-label="Timeline zoom controls" className="timeline-zoom-group">
                <Button aria-label="Zoom in" className="icon-button" size="icon" type="button" variant="outline" onClick={() => zoom(1.25)}>
                  <ZoomInIcon aria-hidden="true" />
                </Button>
                <Button aria-label="Zoom out" className="icon-button" size="icon" type="button" variant="outline" onClick={() => zoom(0.8)}>
                  <ZoomOutIcon aria-hidden="true" />
                </Button>
                <Button aria-label="Fit" className="icon-button" size="icon" type="button" variant="outline" onClick={fitToWindow}>
                  <Maximize2Icon aria-hidden="true" />
                </Button>
              </ButtonGroup>
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
        </Card>

        <div className="utility-card utility-metrics-card" data-testid="utility-metrics-card">
          <MetricsPanel metrics={metrics} />
        </div>
      </div>

      <Card className="panel-card debug-panel">
        <Button
          aria-controls="developer-tools-body"
          aria-expanded={isDebugDrawerOpen}
          className="debug-toggle"
          data-testid="debug-drawer-toggle"
          type="button"
          variant="default"
          onClick={() => setIsDebugDrawerOpen((current) => !current)}
        >
          {isDebugDrawerOpen ? "Hide developer tools" : "Show developer tools"}
        </Button>
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
      </Card>
    </main>
  );
}

export default App;
