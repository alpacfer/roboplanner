import {
  needsEndCheckpoint,
  needsStartCheckpoint,
  normalizeOperatorInvolvement,
  requiresOperator as involvementRequiresOperator,
} from "../domain/operator";
import type {
  OperatorInvolvement,
  OperatorPhase,
  Plan,
  Segment,
  SimulationEvent,
  SimulationMetrics,
  SimulationResult,
} from "../domain/types";

type RunStatus = "READY_START" | "ACTIVE" | "WAITING_START" | "WAITING_END" | "DONE";

type WaitReason = "operator" | "resources" | "operator/resources";

interface RunState {
  runId: string;
  stepIndex: number;
  readyMin: number;
  status: RunStatus;
  activeStep?: {
    stepId: string;
    involvement: OperatorInvolvement;
    nominalEndMin: number;
    holdsWhole: boolean;
    heldResourceIds: string[];
  };
}

interface QueueRequest {
  runId: string;
  stepIndex: number;
  kind: "START" | "END";
  operatorPhase: OperatorPhase | null;
  requiredResourceIds: string[];
  queuedAtMin: number;
  waitReason: WaitReason;
}

function buildMetrics(segments: Segment[], operatorCapacity: number): SimulationMetrics {
  const makespan = segments.length > 0 ? Math.max(...segments.map((segment) => segment.endMin)) : 0;
  const operatorBusyMin = segments
    .filter(
      (segment) =>
        segment.kind === "step" &&
        segment.operatorInvolvement === "WHOLE" &&
        involvementRequiresOperator(segment.operatorInvolvement),
    )
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

function stepToSegmentBase(step: Plan["template"][number], involvement: OperatorInvolvement) {
  return {
    stepId: step.id,
    name: step.name,
    requiresOperator: involvementRequiresOperator(involvement),
    operatorInvolvement: involvement,
    operatorCheckpointAtStart: involvement === "WHOLE",
    operatorCheckpointAtEnd: involvement === "WHOLE",
  };
}

function buildResourceCapacityMap(plan: Plan): Map<string, number> {
  return new Map(
    (plan.sharedResources ?? [])
      .filter((resource) => Number.isInteger(resource.quantity) && resource.quantity > 0)
      .map((resource) => [resource.id, resource.quantity]),
  );
}

function normalizeStepResourceIds(resourceIds: Plan["template"][number]["resourceIds"]): string[] {
  if (!Array.isArray(resourceIds)) {
    return [];
  }

  return [...new Set(resourceIds.filter((resourceId): resourceId is string => typeof resourceId === "string"))];
}

function waitNameForReason(reason: WaitReason): string {
  if (reason === "operator") {
    return "wait: operator";
  }
  if (reason === "resources") {
    return "wait: resources";
  }
  return "wait: operator/resources";
}

export function scheduleLinear(plan: Plan): Segment[] {
  const segments: Segment[] = [];

  for (const run of plan.runs) {
    let currentMin = run.startMin;

    for (const step of plan.template) {
      const involvement = normalizeOperatorInvolvement(step);
      segments.push({
        runId: run.id,
        ...stepToSegmentBase(step, involvement),
        startMin: currentMin,
        endMin: currentMin + step.durationMin,
        kind: "step",
      });
      currentMin += step.durationMin;
    }
  }

  return segments;
}

export function simulateDES(plan: Plan): SimulationResult {
  if (plan.template.length === 0 || plan.runs.length === 0) {
    return {
      segments: [],
      events: [],
      metrics: {
        makespan: 0,
        operatorBusyMin: 0,
        operatorUtilization: 0,
        totalWaitingMin: 0,
      },
    };
  }

  const events: SimulationEvent[] = [];
  const segments: Segment[] = [];
  const operatorCapacity = plan.settings.operatorCapacity;
  const runOrder = new Map(plan.runs.map((run, index) => [run.id, index]));
  const runStates = new Map<string, RunState>(
    plan.runs.map((run) => [
      run.id,
      {
        runId: run.id,
        stepIndex: 0,
        readyMin: run.startMin,
        status: "READY_START",
      },
    ]),
  );
  const queue: QueueRequest[] = [];
  const resourceAvailableById = buildResourceCapacityMap(plan);
  let operatorInUse = 0;

  const areResourcesAvailable = (resourceIds: string[]) =>
    resourceIds.every((resourceId) => (resourceAvailableById.get(resourceId) ?? 0) > 0);

  const acquireResources = (resourceIds: string[]) => {
    for (const resourceId of resourceIds) {
      resourceAvailableById.set(resourceId, (resourceAvailableById.get(resourceId) ?? 0) - 1);
    }
  };

  const releaseResources = (resourceIds: string[]) => {
    for (const resourceId of resourceIds) {
      resourceAvailableById.set(resourceId, (resourceAvailableById.get(resourceId) ?? 0) + 1);
    }
  };

  const addWaitIfNeeded = (runId: string, waitStartMin: number, nowMin: number, reason: WaitReason) => {
    if (nowMin <= waitStartMin) {
      return;
    }
    segments.push({
      runId,
      name: waitNameForReason(reason),
      startMin: waitStartMin,
      endMin: nowMin,
      kind: "wait",
      requiresOperator: false,
      operatorCheckpointAtStart: false,
      operatorCheckpointAtEnd: false,
      operatorInvolvement: "NONE",
    });
  };

  const addCheckpointSegment = (
    runId: string,
    step: Plan["template"][number],
    involvement: OperatorInvolvement,
    phase: Extract<OperatorPhase, "START" | "END">,
    atMin: number,
  ) => {
    const phaseLabel = phase === "START" ? "start" : "end";
    segments.push({
      runId,
      stepId: step.id,
      name: `${step.name} ${phaseLabel} checkpoint`,
      startMin: atMin,
      endMin: atMin,
      kind: "operator_checkpoint",
      requiresOperator: true,
      operatorInvolvement: involvement,
      operatorPhase: phase,
      operatorCheckpointAtStart: phase === "START",
      operatorCheckpointAtEnd: phase === "END",
    });
  };

  const finishStep = (state: RunState, atMin: number, stepId: string) => {
    if (state.activeStep) {
      releaseResources(state.activeStep.heldResourceIds);
    }

    events.push({ timeMin: atMin, type: "STEP_END", runId: state.runId, stepId });
    state.stepIndex += 1;
    if (state.stepIndex >= plan.template.length) {
      state.status = "DONE";
      state.activeStep = undefined;
      return;
    }
    state.readyMin = atMin;
    state.status = "READY_START";
    state.activeStep = undefined;
  };

  const startStep = (
    state: RunState,
    atMin: number,
    step: Plan["template"][number],
    involvement: OperatorInvolvement,
    heldResourceIds: string[],
  ) => {
    events.push({ timeMin: atMin, type: "STEP_START", runId: state.runId, stepId: step.id });
    segments.push({
      runId: state.runId,
      ...stepToSegmentBase(step, involvement),
      startMin: atMin,
      endMin: atMin + step.durationMin,
      kind: "step",
    });
    state.status = "ACTIVE";
    state.activeStep = {
      stepId: step.id,
      involvement,
      nominalEndMin: atMin + step.durationMin,
      holdsWhole: involvement === "WHOLE",
      heldResourceIds,
    };
  };

  const acquireOperator = (runId: string, stepId: string, atMin: number, phase: OperatorPhase) => {
    operatorInUse += 1;
    events.push({ timeMin: atMin, type: "OP_ACQUIRE", runId, stepId, phase });
  };

  const releaseOperator = (runId: string, stepId: string, atMin: number, phase: OperatorPhase) => {
    operatorInUse -= 1;
    events.push({ timeMin: atMin, type: "OP_RELEASE", runId, stepId, phase });
  };

  while (true) {
    const unfinished = [...runStates.values()].some((state) => state.status !== "DONE");
    if (!unfinished && queue.length === 0) {
      break;
    }

    const nextReadyStart = Math.min(
      ...[...runStates.values()].map((state) =>
        state.status === "READY_START" ? state.readyMin : Number.POSITIVE_INFINITY,
      ),
    );
    const nextNominalEnd = Math.min(
      ...[...runStates.values()].map((state) =>
        state.status === "ACTIVE" && state.activeStep
          ? state.activeStep.nominalEndMin
          : Number.POSITIVE_INFINITY,
      ),
    );
    const currentMin = Math.min(nextReadyStart, nextNominalEnd);
    if (!Number.isFinite(currentMin)) {
      break;
    }

    const endingWhole = [...runStates.values()]
      .filter(
        (state) =>
          state.status === "ACTIVE" &&
          state.activeStep &&
          state.activeStep.nominalEndMin === currentMin &&
          state.activeStep.holdsWhole,
      )
      .sort((a, b) => (runOrder.get(a.runId) ?? 0) - (runOrder.get(b.runId) ?? 0));

    for (const state of endingWhole) {
      const step = plan.template[state.stepIndex];
      releaseOperator(state.runId, step.id, currentMin, "WHOLE");
      finishStep(state, currentMin, step.id);
    }

    const endingNeedEnd = [...runStates.values()]
      .filter(
        (state) =>
          state.status === "ACTIVE" &&
          state.activeStep &&
          state.activeStep.nominalEndMin === currentMin &&
          !state.activeStep.holdsWhole &&
          needsEndCheckpoint(state.activeStep.involvement),
      )
      .sort((a, b) => (runOrder.get(a.runId) ?? 0) - (runOrder.get(b.runId) ?? 0));

    for (const state of endingNeedEnd) {
      const step = plan.template[state.stepIndex];
      state.status = "WAITING_END";
      queue.push({
        runId: state.runId,
        stepIndex: state.stepIndex,
        kind: "END",
        operatorPhase: "END",
        requiredResourceIds: [],
        queuedAtMin: currentMin,
        waitReason: "operator",
      });
      events.push({ timeMin: currentMin, type: "WAIT_START", runId: state.runId, stepId: step.id, phase: "END" });
    }

    const endingNoEnd = [...runStates.values()]
      .filter(
        (state) =>
          state.status === "ACTIVE" &&
          state.activeStep &&
          state.activeStep.nominalEndMin === currentMin &&
          !state.activeStep.holdsWhole &&
          !needsEndCheckpoint(state.activeStep.involvement),
      )
      .sort((a, b) => (runOrder.get(a.runId) ?? 0) - (runOrder.get(b.runId) ?? 0));

    for (const state of endingNoEnd) {
      const step = plan.template[state.stepIndex];
      finishStep(state, currentMin, step.id);
    }

    const readyToStart = [...runStates.values()]
      .filter((state) => state.status === "READY_START" && state.readyMin === currentMin)
      .sort((a, b) => (runOrder.get(a.runId) ?? 0) - (runOrder.get(b.runId) ?? 0));

    for (const state of readyToStart) {
      const step = plan.template[state.stepIndex];
      const involvement = normalizeOperatorInvolvement(step);
      const requiredResourceIds = normalizeStepResourceIds(step.resourceIds);
      const operatorPhase = needsStartCheckpoint(involvement)
        ? ((involvement === "WHOLE" ? "WHOLE" : "START") as OperatorPhase)
        : null;

      events.push({ timeMin: currentMin, type: "RUN_READY", runId: state.runId, stepId: step.id, phase: "START" });

      if (!operatorPhase && requiredResourceIds.length === 0) {
        startStep(state, currentMin, step, involvement, []);
        continue;
      }

      state.status = "WAITING_START";

      const waitReason: WaitReason = operatorPhase
        ? requiredResourceIds.length > 0
          ? "operator/resources"
          : "operator"
        : "resources";

      queue.push({
        runId: state.runId,
        stepIndex: state.stepIndex,
        kind: "START",
        operatorPhase,
        requiredResourceIds,
        queuedAtMin: currentMin,
        waitReason,
      });
      events.push({
        timeMin: currentMin,
        type: "WAIT_START",
        runId: state.runId,
        stepId: step.id,
        phase: operatorPhase ?? undefined,
      });
    }

    while (queue.length > 0) {
      // END checkpoints must be serviced ahead of START requests so finished steps
      // can release held resources and avoid queue deadlocks.
      const endRequestIndex = queue.findIndex((request) => request.kind === "END");
      const requestIndex = endRequestIndex >= 0 ? endRequestIndex : 0;
      const request = queue[requestIndex];
      const state = runStates.get(request.runId)!;
      const step = plan.template[request.stepIndex];
      if (!step || state.stepIndex !== request.stepIndex) {
        queue.splice(requestIndex, 1);
        continue;
      }

      if (request.kind === "END") {
        if (operatorInUse >= operatorCapacity) {
          break;
        }

        queue.splice(requestIndex, 1);
        addWaitIfNeeded(request.runId, request.queuedAtMin, currentMin, request.waitReason);
        events.push({
          timeMin: currentMin,
          type: "WAIT_END",
          runId: request.runId,
          stepId: step.id,
          phase: request.operatorPhase ?? undefined,
        });

        addCheckpointSegment(state.runId, step, normalizeOperatorInvolvement(step), "END", currentMin);
        acquireOperator(state.runId, step.id, currentMin, "END");
        releaseOperator(state.runId, step.id, currentMin, "END");
        finishStep(state, currentMin, step.id);
        continue;
      }

      if (!areResourcesAvailable(request.requiredResourceIds)) {
        break;
      }

      if (request.operatorPhase && operatorInUse >= operatorCapacity) {
        break;
      }

      queue.splice(requestIndex, 1);
      addWaitIfNeeded(request.runId, request.queuedAtMin, currentMin, request.waitReason);
      events.push({
        timeMin: currentMin,
        type: "WAIT_END",
        runId: request.runId,
        stepId: step.id,
        phase: request.operatorPhase ?? undefined,
      });

      acquireResources(request.requiredResourceIds);

      if (request.operatorPhase === "WHOLE") {
        acquireOperator(state.runId, step.id, currentMin, "WHOLE");
        startStep(state, currentMin, step, "WHOLE", request.requiredResourceIds);
        continue;
      }

      if (request.operatorPhase === "START") {
        const involvement = normalizeOperatorInvolvement(step);
        addCheckpointSegment(state.runId, step, involvement, "START", currentMin);
        acquireOperator(state.runId, step.id, currentMin, "START");
        releaseOperator(state.runId, step.id, currentMin, "START");
        startStep(state, currentMin, step, involvement, request.requiredResourceIds);
        continue;
      }

      startStep(state, currentMin, step, normalizeOperatorInvolvement(step), request.requiredResourceIds);
    }
  }

  return {
    segments,
    events,
    metrics: buildMetrics(segments, operatorCapacity),
  };
}
