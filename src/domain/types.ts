export type QueuePolicy = "FIFO" | "SPT" | "PRIORITY";

export interface Step {
  id: string;
  name: string;
  durationMin: number;
  requiresOperator: boolean;
}

export interface Run {
  id: string;
  label: string;
  startMin: number;
  templateId: string;
}

export interface PlanSettings {
  operatorCapacity: number;
  queuePolicy: QueuePolicy;
}

export interface Plan {
  id: string;
  name: string;
  template: Step[];
  runs: Run[];
  settings: PlanSettings;
}

export type SegmentKind = "step" | "wait";

export interface Segment {
  runId: string;
  stepId?: string;
  name: string;
  startMin: number;
  endMin: number;
  kind: SegmentKind;
  requiresOperator: boolean;
}

export type SimulationEventType =
  | "RUN_READY"
  | "STEP_START"
  | "STEP_END"
  | "OP_ACQUIRE"
  | "OP_RELEASE"
  | "WAIT_START"
  | "WAIT_END";

export interface SimulationEvent {
  timeMin: number;
  type: SimulationEventType;
  runId: string;
  stepId?: string;
}

export interface SimulationMetrics {
  makespan: number;
  operatorBusyMin: number;
  operatorUtilization: number;
  totalWaitingMin: number;
}

export interface SimulationResult {
  segments: Segment[];
  events: SimulationEvent[];
  metrics: SimulationMetrics;
}
