export type QueuePolicy = "FIFO";
export type OperatorInvolvement = "NONE" | "WHOLE" | "START" | "END" | "START_END";
export type OperatorPhase = "START" | "END" | "WHOLE";

export interface Step {
  id: string;
  name: string;
  durationMin: number;
  operatorInvolvement: OperatorInvolvement;
  groupId: string | null;
  resourceIds?: string[];
  requiresOperator?: boolean;
  color?: string;
}

export interface StepGroup {
  id: string;
  name: string;
  color: string;
}

export interface Run {
  id: string;
  label: string;
  startMin: number;
  templateId: string;
}

export interface SharedResource {
  id: string;
  name: string;
  quantity: number;
}

export interface PlanSettings {
  operatorCapacity: number;
  queuePolicy: QueuePolicy;
}

export interface Plan {
  id: string;
  name: string;
  template: Step[];
  stepGroups: StepGroup[];
  runs: Run[];
  settings: PlanSettings;
}

export type SegmentKind = "step" | "wait" | "operator_checkpoint";

export interface Segment {
  runId: string;
  stepId?: string;
  name: string;
  startMin: number;
  endMin: number;
  kind: SegmentKind;
  requiresOperator: boolean;
  operatorInvolvement?: OperatorInvolvement;
  operatorPhase?: OperatorPhase;
  operatorCheckpointAtStart?: boolean;
  operatorCheckpointAtEnd?: boolean;
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
  phase?: OperatorPhase;
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
