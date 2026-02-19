import type { Plan, Segment, SimulationEvent, SimulationMetrics, SimulationResult } from "../domain/types";

export function scheduleLinear(plan: Plan): Segment[] {
  const segments: Segment[] = [];

  for (const run of plan.runs) {
    let currentMin = run.startMin;

    for (const step of plan.template) {
      const segment: Segment = {
        runId: run.id,
        name: step.name,
        startMin: currentMin,
        endMin: currentMin + step.durationMin,
        kind: "step",
        requiresOperator: step.requiresOperator,
      };

      segments.push(segment);
      currentMin = segment.endMin;
    }
  }

  return segments;
}

interface RunProgress {
  stepIndex: number;
  readyMin: number;
  queuedAtMin?: number;
  finished: boolean;
}

interface ActiveStep {
  runId: string;
  stepIndex: number;
  endMin: number;
  requiresOperator: boolean;
}

function buildMetrics(segments: Segment[], operatorCapacity: number): SimulationMetrics {
  const makespan = segments.length > 0 ? Math.max(...segments.map((segment) => segment.endMin)) : 0;
  const operatorBusyMin = segments
    .filter((segment) => segment.kind === "step" && segment.requiresOperator)
    .reduce((sum, segment) => sum + (segment.endMin - segment.startMin), 0);
  const totalWaitingMin = segments
    .filter((segment) => segment.kind === "wait")
    .reduce((sum, segment) => sum + (segment.endMin - segment.startMin), 0);
  const operatorUtilization =
    makespan > 0 ? operatorBusyMin / (Math.max(operatorCapacity, 1) * makespan) : 0;

  return {
    makespan,
    operatorBusyMin,
    operatorUtilization,
    totalWaitingMin,
  };
}

export function simulateDES(plan: Plan): SimulationResult {
  const segments: Segment[] = [];
  const events: SimulationEvent[] = [];
  const runOrder = new Map(plan.runs.map((run, index) => [run.id, index]));
  const progressByRunId = new Map<string, RunProgress>(
    plan.runs.map((run) => [
      run.id,
      {
        stepIndex: 0,
        readyMin: run.startMin,
        finished: false,
      },
    ]),
  );
  const queue: string[] = [];
  const activeSteps = new Map<string, ActiveStep>();
  const operatorCapacity = plan.settings.operatorCapacity;
  let operatorInUse = 0;

  const startStep = (runId: string, timeMin: number) => {
    const runProgress = progressByRunId.get(runId);
    if (!runProgress || runProgress.finished) {
      return;
    }

    const step = plan.template[runProgress.stepIndex];
    if (!step) {
      runProgress.finished = true;
      return;
    }

    if (step.requiresOperator) {
      operatorInUse += 1;
      events.push({ timeMin, type: "OP_ACQUIRE", runId, stepId: step.id });
    }

    events.push({ timeMin, type: "STEP_START", runId, stepId: step.id });
    segments.push({
      runId,
      stepId: step.id,
      name: step.name,
      startMin: timeMin,
      endMin: timeMin + step.durationMin,
      kind: "step",
      requiresOperator: step.requiresOperator,
    });

    activeSteps.set(runId, {
      runId,
      stepIndex: runProgress.stepIndex,
      endMin: timeMin + step.durationMin,
      requiresOperator: step.requiresOperator,
    });
  };

  while (true) {
    const unfinishedRuns = [...progressByRunId.values()].some((progress) => !progress.finished);
    if (!unfinishedRuns && activeSteps.size === 0 && queue.length === 0) {
      break;
    }

    const nextEndMin =
      activeSteps.size > 0 ? Math.min(...[...activeSteps.values()].map((active) => active.endMin)) : Infinity;
    const nextReadyMin = Math.min(
      ...plan.runs.map((run) => {
        const progress = progressByRunId.get(run.id)!;
        const isActive = activeSteps.has(run.id);
        const isQueued = typeof progress.queuedAtMin === "number";
        if (progress.finished || isActive || isQueued) {
          return Infinity;
        }
        return progress.readyMin;
      }),
    );
    const currentMin = Math.min(nextEndMin, nextReadyMin);

    if (!Number.isFinite(currentMin)) {
      break;
    }

    const endingRuns = [...activeSteps.values()]
      .filter((activeStep) => activeStep.endMin === currentMin)
      .sort((a, b) => (runOrder.get(a.runId) ?? 0) - (runOrder.get(b.runId) ?? 0));

    for (const ending of endingRuns) {
      const runProgress = progressByRunId.get(ending.runId)!;
      const step = plan.template[ending.stepIndex];

      events.push({ timeMin: currentMin, type: "STEP_END", runId: ending.runId, stepId: step.id });
      if (ending.requiresOperator) {
        operatorInUse -= 1;
        events.push({ timeMin: currentMin, type: "OP_RELEASE", runId: ending.runId, stepId: step.id });
      }

      activeSteps.delete(ending.runId);
      runProgress.stepIndex += 1;

      if (runProgress.stepIndex >= plan.template.length) {
        runProgress.finished = true;
      } else {
        runProgress.readyMin = currentMin;
      }
    }

    const readyRuns = plan.runs
      .map((run) => run.id)
      .filter((runId) => {
        const runProgress = progressByRunId.get(runId)!;
        const isActive = activeSteps.has(runId);
        const isQueued = typeof runProgress.queuedAtMin === "number";
        return !runProgress.finished && !isActive && !isQueued && runProgress.readyMin === currentMin;
      })
      .sort((a, b) => (runOrder.get(a) ?? 0) - (runOrder.get(b) ?? 0));

    for (const runId of readyRuns) {
      const runProgress = progressByRunId.get(runId)!;
      const step = plan.template[runProgress.stepIndex];
      events.push({ timeMin: currentMin, type: "RUN_READY", runId, stepId: step.id });

      if (!step.requiresOperator) {
        startStep(runId, currentMin);
        continue;
      }

      if (operatorInUse < operatorCapacity && queue.length === 0) {
        startStep(runId, currentMin);
      } else {
        runProgress.queuedAtMin = currentMin;
        queue.push(runId);
        events.push({ timeMin: currentMin, type: "WAIT_START", runId, stepId: step.id });
      }
    }

    while (operatorInUse < operatorCapacity && queue.length > 0) {
      const runId = queue.shift()!;
      const runProgress = progressByRunId.get(runId)!;
      const step = plan.template[runProgress.stepIndex];
      const waitStart = runProgress.queuedAtMin ?? currentMin;

      if (currentMin > waitStart) {
        segments.push({
          runId,
          name: "wait: operator",
          startMin: waitStart,
          endMin: currentMin,
          kind: "wait",
          requiresOperator: false,
        });
      }

      events.push({ timeMin: currentMin, type: "WAIT_END", runId, stepId: step.id });
      runProgress.queuedAtMin = undefined;
      startStep(runId, currentMin);
    }
  }

  return {
    segments,
    events,
    metrics: buildMetrics(segments, operatorCapacity),
  };
}
