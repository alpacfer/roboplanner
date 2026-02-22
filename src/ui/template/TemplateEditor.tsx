import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsDownIcon,
  ChevronsUpIcon,
  DownloadIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DEFAULT_STEP_COLOR, STEP_COLOR_PRESETS, normalizeStepColor } from "../../domain/colors";
import { validateStepGroups, validateTemplateSteps } from "../../domain/validation";
import type { OperatorInvolvement, SharedResource, Step, StepGroup } from "../../domain/types";
import ConfirmDialog from "../common/ConfirmDialog";
import IntegerInput from "../common/IntegerInput";

interface TemplateEditorProps {
  steps: Step[];
  stepGroups: StepGroup[];
  sharedResources: SharedResource[];
  onChange: (payload: { steps: Step[]; stepGroups: StepGroup[] }) => void;
  onImportClick: () => void;
  onExportClick: () => void;
  portabilityStatus: string;
}

const OPERATOR_INVOLVEMENT_OPTIONS: Array<{ value: OperatorInvolvement; label: string }> = [
  { value: "NONE", label: "None" },
  { value: "WHOLE", label: "Whole step" },
  { value: "START", label: "Start only" },
  { value: "END", label: "End only" },
  { value: "START_END", label: "Start + End" },
];

type TopLevelBlock = { type: "sequence"; groupId: string } | { type: "step"; stepId: string };

type PendingDelete =
  | { kind: "step"; stepId: string }
  | { kind: "group"; groupId: string }
  | { kind: "all-groups" }
  | null;

function nextStepId(steps: Step[]): string {
  const maxExisting = steps.reduce((maxId, step) => {
    const match = /^step-(\d+)$/.exec(step.id);
    if (!match) {
      return maxId;
    }
    return Math.max(maxId, Number.parseInt(match[1], 10));
  }, 0);
  return `step-${maxExisting + 1}`;
}

function nextStepGroupId(stepGroups: StepGroup[]): string {
  const maxExisting = stepGroups.reduce((maxId, group) => {
    const match = /^group-(\d+)$/.exec(group.id);
    if (!match) {
      return maxId;
    }
    return Math.max(maxId, Number.parseInt(match[1], 10));
  }, 0);
  return `group-${maxExisting + 1}`;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const nextItems = [...items];
  const [moved] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, moved);
  return nextItems;
}

function deriveTopLevelBlocks(steps: Step[], stepGroups: StepGroup[]): TopLevelBlock[] {
  const blocks: TopLevelBlock[] = [];
  const seenGroups = new Set<string>();
  const knownGroups = new Set(stepGroups.map((group) => group.id));

  for (const step of steps) {
    if (step.groupId && knownGroups.has(step.groupId)) {
      if (!seenGroups.has(step.groupId)) {
        seenGroups.add(step.groupId);
        blocks.push({ type: "sequence", groupId: step.groupId });
      }
      continue;
    }

    blocks.push({ type: "step", stepId: step.id });
  }

  for (const group of stepGroups) {
    if (!seenGroups.has(group.id)) {
      blocks.push({ type: "sequence", groupId: group.id });
    }
  }

  return blocks;
}

function reorderGroupsByBlocks(stepGroups: StepGroup[], blocks: TopLevelBlock[]): StepGroup[] {
  const groupsById = Object.fromEntries(stepGroups.map((group) => [group.id, group]));
  const orderedIds = blocks.filter((block) => block.type === "sequence").map((block) => block.groupId);
  const orderedGroups = orderedIds.flatMap((groupId) => {
    const group = groupsById[groupId];
    return group ? [group] : [];
  });
  const orderedIdSet = new Set(orderedIds);
  const remainder = stepGroups.filter((group) => !orderedIdSet.has(group.id));
  return [...orderedGroups, ...remainder];
}

function buildStepsFromBlocks(blocks: TopLevelBlock[], stepById: Record<string, Step>, groupStepsById: Record<string, Step[]>): Step[] {
  return blocks.flatMap((block) => {
    if (block.type === "step") {
      const step = stepById[block.stepId];
      return step ? [step] : [];
    }
    return groupStepsById[block.groupId] ?? [];
  });
}

function firstIndexForBlock(
  block: TopLevelBlock,
  stepIndexById: Record<string, number>,
  groupStepsById: Record<string, Step[]>,
): number | null {
  if (block.type === "step") {
    const index = stepIndexById[block.stepId];
    return Number.isFinite(index) ? index : null;
  }

  const groupSteps = groupStepsById[block.groupId] ?? [];
  if (groupSteps.length === 0) {
    return null;
  }
  const index = stepIndexById[groupSteps[0].id];
  return Number.isFinite(index) ? index : null;
}

function resolveInsertionStepIndex(
  blocks: TopLevelBlock[],
  blockInsertIndex: number,
  steps: Step[],
  stepIndexById: Record<string, number>,
  groupStepsById: Record<string, Step[]>,
): number {
  if (blockInsertIndex >= blocks.length) {
    return steps.length;
  }

  for (let index = blockInsertIndex; index < blocks.length; index += 1) {
    const firstIndex = firstIndexForBlock(blocks[index], stepIndexById, groupStepsById);
    if (firstIndex !== null) {
      return firstIndex;
    }
  }

  return steps.length;
}

function useOverflowTitle<T extends HTMLElement>(value: string) {
  const ref = useRef<T | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      setHasOverflow(false);
      return;
    }

    const checkOverflow = () => {
      setHasOverflow(element.scrollWidth > element.clientWidth + 1);
    };

    checkOverflow();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);

  return {
    ref,
    hasOverflow: hasOverflow && value.trim().length > 0,
  };
}

interface SequenceNameInputProps {
  group: StepGroup;
  onChange: (name: string) => void;
}

function SequenceNameInput({ group, onChange }: SequenceNameInputProps) {
  const { ref, hasOverflow } = useOverflowTitle<HTMLInputElement>(group.name);

  const input = (
    <Input
      aria-label={`Sequence name ${group.name}`}
      placeholder="Sequence name"
      ref={ref}
      type="text"
      value={group.name}
      onChange={(event) => onChange(event.target.value)}
    />
  );

  if (!hasOverflow) {
    return input;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{input}</TooltipTrigger>
      <TooltipContent>{group.name}</TooltipContent>
    </Tooltip>
  );
}

interface TopLevelInsertActionsProps {
  position: number;
  onAddStep: () => void;
  onAddSequence: () => void;
}

function TopLevelInsertActions({ position, onAddStep, onAddSequence }: TopLevelInsertActionsProps) {
  return (
    <ButtonGroup aria-label={`Top level insertion controls at position ${position}`} className="insertion-action-group">
      <Button
        aria-label={`Add step at top level position ${position}`}
        className="insertion-action-button"
        size="xs"
        type="button"
        variant="ghost"
        onClick={onAddStep}
      >
        Add step
      </Button>
      <Button
        aria-label={`Add sequence at top level position ${position}`}
        className="insertion-action-button"
        size="xs"
        type="button"
        variant="ghost"
        onClick={onAddSequence}
      >
        Add sequence
      </Button>
    </ButtonGroup>
  );
}

interface StepItemProps {
  step: Step;
  isGrouped: boolean;
  stepIndex: number;
  errors: string[];
  sharedResources: SharedResource[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdate: (stepId: string, next: Step) => void;
  onMove: (stepId: string, direction: -1 | 1) => void;
  onRequestDelete: (stepId: string) => void;
}

function StepItem({
  step,
  isGrouped,
  stepIndex,
  errors,
  sharedResources,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onMove,
  onRequestDelete,
}: StepItemProps) {
  const [isStepColorMenuOpen, setIsStepColorMenuOpen] = useState(false);
  const stepColor = normalizeStepColor(step.color);
  const { ref: stepNameRef, hasOverflow: stepNameOverflow } = useOverflowTitle<HTMLInputElement>(step.name);
  const resourceOptions = useMemo(
    () =>
      sharedResources.map((resource) => ({
        id: resource.id,
        label: resource.name,
      })),
    [sharedResources],
  );
  const resourceOptionById = useMemo(
    () => Object.fromEntries(resourceOptions.map((option) => [option.id, option])),
    [resourceOptions],
  );
  const selectedResourceOptions = (step.resourceIds ?? []).map(
    (resourceId) =>
      resourceOptionById[resourceId] ?? {
        id: resourceId,
        label: resourceId,
      },
  );
  const resourceAnchor = useComboboxAnchor();

  return (
    <article
      className={`template-step-item ${isGrouped ? "" : "is-standalone"}`}
      data-testid="step-item"
      data-step-id={step.id}
      style={!isGrouped ? ({ "--step-color": stepColor } as CSSProperties) : undefined}
    >
      <div className="template-step-top">
        <div className="template-step-title-row has-color-picker">
          {!isGrouped ? (
            <label className="field-row step-color-field">
              <Popover open={isStepColorMenuOpen} onOpenChange={setIsStepColorMenuOpen}>
                <div className="group-color-picker">
                  <PopoverTrigger asChild>
                    <button
                      aria-expanded={isStepColorMenuOpen}
                      aria-label={`Open step color menu ${step.id}`}
                      className="group-color-trigger"
                      style={{ backgroundColor: stepColor }}
                      type="button"
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    aria-label={`Step color menu ${step.id}`}
                    className="group-color-menu w-auto p-2"
                    role="menu"
                  >
                    <input
                      aria-label={`Step color ${step.id}`}
                      type="color"
                      value={stepColor}
                      onChange={(event) => {
                        onUpdate(step.id, {
                          ...step,
                          color: event.target.value,
                        });
                      }}
                    />
                    <div className="step-color-presets">
                      {STEP_COLOR_PRESETS.map((presetColor) => (
                        <button
                          key={presetColor}
                          aria-label={`Preset ${step.id} ${presetColor}`}
                          className="color-preset-button"
                          style={{ backgroundColor: presetColor }}
                          type="button"
                          onClick={() => {
                            onUpdate(step.id, {
                              ...step,
                              color: presetColor,
                            });
                            setIsStepColorMenuOpen(false);
                          }}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </div>
              </Popover>
            </label>
          ) : null}

          <label className="field-row step-name-field">
            <span>Step name</span>
            {stepNameOverflow ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input
                    aria-label={`Step name ${step.id}`}
                    placeholder="Step name"
                    ref={stepNameRef}
                    type="text"
                    value={step.name}
                    onChange={(event) => onUpdate(step.id, { ...step, name: event.target.value })}
                  />
                </TooltipTrigger>
                <TooltipContent>{step.name}</TooltipContent>
              </Tooltip>
            ) : (
              <Input
                aria-label={`Step name ${step.id}`}
                placeholder="Step name"
                ref={stepNameRef}
                type="text"
                value={step.name}
                onChange={(event) => onUpdate(step.id, { ...step, name: event.target.value })}
              />
            )}
          </label>

          <label className="field-row duration-field">
            <span>Duration</span>
            <div className="duration-input-wrap">
              <IntegerInput
                ariaLabel={`Step duration ${step.id}`}
                className="step-duration-input"
                max={99}
                min={0}
                value={step.durationMin}
                onCommit={(durationValue) => {
                  onUpdate(step.id, {
                    ...step,
                    durationMin: durationValue,
                  });
                }}
              />
              <span className="duration-unit">min</span>
            </div>
          </label>

          <label className="field-row operator-field">
            <span>Operator involvement</span>
            <Combobox
              items={OPERATOR_INVOLVEMENT_OPTIONS}
              itemToStringValue={(option) => option.label}
              value={
                OPERATOR_INVOLVEMENT_OPTIONS.find((option) => option.value === step.operatorInvolvement) ??
                OPERATOR_INVOLVEMENT_OPTIONS[0]
              }
              onValueChange={(nextValue) => {
                if (!nextValue) {
                  return;
                }
                onUpdate(step.id, {
                  ...step,
                  operatorInvolvement: nextValue.value,
                });
              }}
            >
              <ComboboxInput aria-label={`Operator involvement ${step.id}`} className="operator-select" />
              <ComboboxContent>
                <ComboboxEmpty>No options found.</ComboboxEmpty>
                <ComboboxList>
                  {(option) => (
                    <ComboboxItem key={option.value} value={option}>
                      {option.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </label>

          <label className="field-row resources-field">
            <span>Shared resources</span>
            <Combobox
              autoHighlight
              itemToStringValue={(resource) => resource.label}
              items={resourceOptions}
              multiple
              value={selectedResourceOptions}
              onValueChange={(nextResources) => {
                onUpdate(step.id, {
                  ...step,
                  resourceIds: nextResources.map((resource) => resource.id),
                });
              }}
            >
              <ComboboxChips ref={resourceAnchor} className="step-resources-chips w-full">
                <ComboboxValue>
                  {(values) => (
                    <>
                      {values.map((resource) => (
                        <ComboboxChip key={resource.id}>{resource.label}</ComboboxChip>
                      ))}
                      <ComboboxChipsInput
                        aria-label={`Resources ${step.id}`}
                        className="step-resources-chip-input"
                      />
                    </>
                  )}
                </ComboboxValue>
              </ComboboxChips>
              <ComboboxContent anchor={resourceAnchor}>
                <ComboboxEmpty>No resources found.</ComboboxEmpty>
                <ComboboxList>
                  {(resource) => (
                    <ComboboxItem key={resource.id} value={resource}>
                      {resource.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </label>

          <ButtonGroup aria-label={`Actions for step ${stepIndex + 1}`} className="step-header-actions">
            <ButtonGroup>
              <Button
                aria-label={`Move step ${stepIndex + 1} up`}
                disabled={!canMoveUp}
                variant="outline"
                type="button"
                onClick={() => onMove(step.id, -1)}
              >
                <ChevronUpIcon aria-hidden="true" />
              </Button>
              <Button
                aria-label={`Move step ${stepIndex + 1} down`}
                disabled={!canMoveDown}
                variant="outline"
                type="button"
                onClick={() => onMove(step.id, 1)}
              >
                <ChevronDownIcon aria-hidden="true" />
              </Button>
            </ButtonGroup>
            <ButtonGroup>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={`Delete step ${stepIndex + 1}`}
                    className="delete-action-button icon-button"
                    size="icon"
                    type="button"
                    variant="outline"
                    onClick={() => onRequestDelete(step.id)}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{`Delete step ${step.name || stepIndex + 1}`}</TooltipContent>
              </Tooltip>
            </ButtonGroup>
          </ButtonGroup>
        </div>
      </div>

      {errors.length > 0 ? (
        <ul className="inline-errors">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function TemplateEditor({
  steps,
  stepGroups,
  sharedResources,
  onChange,
  onImportClick,
  onExportClick,
  portabilityStatus,
}: TemplateEditorProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [openGroupColorMenuId, setOpenGroupColorMenuId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const stepErrors = validateTemplateSteps(steps);
  const groupErrors = validateStepGroups(stepGroups);

  const groupsById = useMemo(() => Object.fromEntries(stepGroups.map((group) => [group.id, group])), [stepGroups]);
  const stepById = useMemo(() => Object.fromEntries(steps.map((step) => [step.id, step])), [steps]);
  const stepIndexById = useMemo(() => Object.fromEntries(steps.map((step, index) => [step.id, index])), [steps]);
  const stepErrorsById = useMemo(
    () => Object.fromEntries(steps.map((step, index) => [step.id, stepErrors[index] ?? []])),
    [stepErrors, steps],
  );
  const groupErrorsById = useMemo(
    () => Object.fromEntries(stepGroups.map((group, index) => [group.id, groupErrors[index] ?? []])),
    [groupErrors, stepGroups],
  );

  const groupStepsById = useMemo(() => {
    const initial = Object.fromEntries(stepGroups.map((group) => [group.id, [] as Step[]]));
    for (const step of steps) {
      if (step.groupId && initial[step.groupId]) {
        initial[step.groupId].push(step);
      }
    }
    return initial;
  }, [stepGroups, steps]);

  const topLevelBlocks = useMemo(() => deriveTopLevelBlocks(steps, stepGroups), [steps, stepGroups]);

  const emitChange = (nextSteps: Step[], nextStepGroups: StepGroup[]) => {
    onChange({ steps: nextSteps, stepGroups: nextStepGroups });
  };

  const createStep = (groupId: string | null): Step => ({
    id: nextStepId(steps),
    name: `Step ${steps.length + 1}`,
    durationMin: 1,
    operatorInvolvement: "NONE",
    groupId,
    resourceIds: [],
    color: DEFAULT_STEP_COLOR,
  });

  const insertStepAtTopLevel = (blockInsertIndex: number) => {
    const insertionIndex = resolveInsertionStepIndex(topLevelBlocks, blockInsertIndex, steps, stepIndexById, groupStepsById);
    const nextSteps = [...steps];
    nextSteps.splice(insertionIndex, 0, createStep(null));
    emitChange(nextSteps, stepGroups);
  };

  const insertSequenceAtTopLevel = (blockInsertIndex: number) => {
    const nextGroupColor = STEP_COLOR_PRESETS[stepGroups.length % STEP_COLOR_PRESETS.length] ?? DEFAULT_STEP_COLOR;
    const nextGroup: StepGroup = {
      id: nextStepGroupId(stepGroups),
      name: `Sequence ${stepGroups.length + 1}`,
      color: nextGroupColor,
    };

    const insertionIndex = resolveInsertionStepIndex(topLevelBlocks, blockInsertIndex, steps, stepIndexById, groupStepsById);
    const nextSteps = [...steps];
    nextSteps.splice(insertionIndex, 0, createStep(nextGroup.id));

    const sequenceBlocksBefore = topLevelBlocks
      .slice(0, blockInsertIndex)
      .filter((block) => block.type === "sequence").length;
    const nextGroups = [...stepGroups];
    nextGroups.splice(sequenceBlocksBefore, 0, nextGroup);

    emitChange(nextSteps, nextGroups);
  };

  const insertStepInSequence = (groupId: string, groupInsertIndex: number) => {
    const groupSteps = groupStepsById[groupId] ?? [];
    const nextGroupSteps = [...groupSteps];
    nextGroupSteps.splice(groupInsertIndex, 0, createStep(groupId));

    const nextSteps = topLevelBlocks.flatMap((block) => {
      if (block.type === "step") {
        const step = stepById[block.stepId];
        return step ? [step] : [];
      }

      return block.groupId === groupId ? nextGroupSteps : groupStepsById[block.groupId] ?? [];
    });

    emitChange(nextSteps, stepGroups);
  };

  const updateStep = (stepId: string, updatedStep: Step) => {
    const nextSteps = steps.map((step) => (step.id === stepId ? updatedStep : step));
    emitChange(nextSteps, stepGroups);
  };

  const moveStep = (stepId: string, direction: -1 | 1) => {
    const target = stepById[stepId];
    if (!target) {
      return;
    }

    if (target.groupId) {
      const groupSteps = groupStepsById[target.groupId] ?? [];
      const sourceIndex = groupSteps.findIndex((step) => step.id === stepId);
      const destinationIndex = sourceIndex + direction;
      if (sourceIndex < 0 || destinationIndex < 0 || destinationIndex >= groupSteps.length) {
        return;
      }

      const nextGroupSteps = moveItem(groupSteps, sourceIndex, destinationIndex);
      const nextSteps = topLevelBlocks.flatMap((block) => {
        if (block.type === "step") {
          const step = stepById[block.stepId];
          return step ? [step] : [];
        }
        return block.groupId === target.groupId ? nextGroupSteps : groupStepsById[block.groupId] ?? [];
      });

      emitChange(nextSteps, stepGroups);
      return;
    }

    const sourceBlockIndex = topLevelBlocks.findIndex((block) => block.type === "step" && block.stepId === stepId);
    const destinationBlockIndex = sourceBlockIndex + direction;
    if (
      sourceBlockIndex < 0 ||
      destinationBlockIndex < 0 ||
      destinationBlockIndex >= topLevelBlocks.length
    ) {
      return;
    }

    const nextBlocks = moveItem(topLevelBlocks, sourceBlockIndex, destinationBlockIndex);
    const nextSteps = buildStepsFromBlocks(nextBlocks, stepById, groupStepsById);
    const nextGroups = reorderGroupsByBlocks(stepGroups, nextBlocks);
    emitChange(nextSteps, nextGroups);
  };

  const moveSequence = (groupId: string, direction: -1 | 1) => {
    const sourceBlockIndex = topLevelBlocks.findIndex((block) => block.type === "sequence" && block.groupId === groupId);
    const destinationBlockIndex = sourceBlockIndex + direction;
    if (
      sourceBlockIndex < 0 ||
      destinationBlockIndex < 0 ||
      destinationBlockIndex >= topLevelBlocks.length
    ) {
      return;
    }

    const nextBlocks = moveItem(topLevelBlocks, sourceBlockIndex, destinationBlockIndex);
    const nextSteps = buildStepsFromBlocks(nextBlocks, stepById, groupStepsById);
    const nextGroups = reorderGroupsByBlocks(stepGroups, nextBlocks);
    emitChange(nextSteps, nextGroups);
  };

  const confirmDeleteStep = (stepId: string) => {
    const step = stepById[stepId];
    if (!step) {
      return;
    }

    const nextSteps = steps.filter((candidate) => candidate.id !== stepId);
    const nextGroups = [...stepGroups];

    if (step.groupId) {
      const remainingGroupSteps = (groupStepsById[step.groupId] ?? []).filter((candidate) => candidate.id !== stepId);
      if (remainingGroupSteps.length === 0) {
        const groupIndex = nextGroups.findIndex((group) => group.id === step.groupId);
        if (groupIndex >= 0) {
          nextGroups.splice(groupIndex, 1);
        }
        setCollapsedGroups((current) => {
          const next = { ...current };
          delete next[step.groupId!];
          return next;
        });
        setOpenGroupColorMenuId((current) => (current === step.groupId ? null : current));
      }
    }

    emitChange(nextSteps, nextGroups);
    setPendingDelete(null);
  };

  const confirmDeleteGroup = (groupId: string) => {
    const nextGroups = stepGroups.filter((group) => group.id !== groupId);
    const nextSteps = steps.filter((step) => step.groupId !== groupId);
    emitChange(nextSteps, nextGroups);
    setCollapsedGroups((current) => {
      const next = { ...current };
      delete next[groupId];
      return next;
    });
    setOpenGroupColorMenuId((current) => (current === groupId ? null : current));
    setPendingDelete(null);
  };

  const confirmDeleteAllGroups = () => {
    emitChange([], []);
    setCollapsedGroups({});
    setOpenGroupColorMenuId(null);
    setPendingDelete(null);
  };

  const confirmPendingDelete = () => {
    if (!pendingDelete) {
      return;
    }

    if (pendingDelete.kind === "step") {
      confirmDeleteStep(pendingDelete.stepId);
      return;
    }

    if (pendingDelete.kind === "group") {
      confirmDeleteGroup(pendingDelete.groupId);
      return;
    }

    confirmDeleteAllGroups();
  };

  const pendingDeleteCopy = useMemo(() => {
    if (!pendingDelete) {
      return null;
    }

    if (pendingDelete.kind === "step") {
      const step = stepById[pendingDelete.stepId];
      const group = step?.groupId ? groupsById[step.groupId] : null;
      return {
        title: "Delete step?",
        message: group
          ? `Delete ${step?.name ?? "this step"}? This also deletes the sequence if it becomes empty.`
          : `Delete ${step?.name ?? "this step"}?`,
        confirmLabel: "Delete step",
      };
    }

    if (pendingDelete.kind === "group") {
      const group = groupsById[pendingDelete.groupId];
      return {
        title: "Delete sequence?",
        message: `Delete ${group?.name ?? "this sequence"} and all steps inside it?`,
        confirmLabel: "Delete sequence",
      };
    }

    return {
      title: "Delete all steps and sequences?",
      message: "All steps and sequences will be deleted.",
      confirmLabel: "Delete all",
    };
  }, [groupsById, pendingDelete, stepById]);

  const areAllCollapsed = stepGroups.length > 0 && stepGroups.every((group) => collapsedGroups[group.id]);
  const hasPortabilityStatus = portabilityStatus.trim().length > 0;
  const hasNoSteps = steps.length === 0;

  const toggleCollapseAll = () => {
    if (areAllCollapsed) {
      setCollapsedGroups({});
      return;
    }
    setOpenGroupColorMenuId(null);
    setCollapsedGroups(Object.fromEntries(stepGroups.map((group) => [group.id, true])));
  };

  return (
    <section className={`template-editor ${hasNoSteps ? "is-empty-steps" : ""}`}>
      <div className="template-editor-header">
        <div className="template-editor-title-group">
          <h2>Template Steps</h2>
          <p>Organize and reorder sequences and standalone steps in one flow.</p>
        </div>

        <div className="template-editor-actions">
          <ButtonGroup aria-label="Template step actions" className="row-actions">
            <ButtonGroup>
              <Button
                aria-label="Import scenario"
                className="portability-action-button"
                type="button"
                variant="outline"
                onClick={onImportClick}
              >
                <DownloadIcon aria-hidden="true" />
                <span>Import</span>
              </Button>
              <Button
                aria-label="Export scenario"
                className="portability-action-button"
                type="button"
                variant="outline"
                onClick={onExportClick}
              >
                <UploadIcon aria-hidden="true" />
                <span>Export</span>
              </Button>
            </ButtonGroup>
            <ButtonGroup>
              <Button
                aria-label={areAllCollapsed ? "Expand all sequences" : "Collapse all sequences"}
                className="portability-action-button"
                disabled={stepGroups.length === 0}
                type="button"
                variant="outline"
                onClick={toggleCollapseAll}
              >
                {areAllCollapsed ? <ChevronsDownIcon aria-hidden="true" /> : <ChevronsUpIcon aria-hidden="true" />}
                <span>{areAllCollapsed ? "Expand all" : "Collapse all"}</span>
              </Button>
            </ButtonGroup>
            <ButtonGroup>
              <Button
                aria-label="Delete all steps and sequences"
                className="delete-action-button icon-button"
                disabled={stepGroups.length === 0 && steps.length === 0}
                size="icon"
                type="button"
                variant="outline"
                onClick={() => setPendingDelete({ kind: "all-groups" })}
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
            </ButtonGroup>
          </ButtonGroup>
        </div>
      </div>

      <div className="template-flow-grid">
        <div className="insertion-rail insertion-rail-top-level" data-testid="top-level-insert-0">
          <TopLevelInsertActions
            position={1}
            onAddSequence={() => insertSequenceAtTopLevel(0)}
            onAddStep={() => insertStepAtTopLevel(0)}
          />
        </div>

        {topLevelBlocks.map((block, blockIndex) => {
          if (block.type === "sequence") {
            const group = groupsById[block.groupId];
            if (!group) {
              return null;
            }

            const groupSteps = groupStepsById[group.id] ?? [];
            const collapsed = collapsedGroups[group.id] ?? false;
            const ownErrors = groupErrorsById[group.id] ?? [];
            const stepErrorCount = groupSteps.reduce((count, step) => count + (stepErrorsById[step.id]?.length ?? 0), 0);
            const errorCount = ownErrors.length + stepErrorCount;
            const groupColor = normalizeStepColor(group.color);

            return (
              <Fragment key={group.id}>
                <article
                  className="template-group-card"
                  style={{
                    "--group-color": groupColor,
                  } as CSSProperties}
                  data-testid="template-group-card"
                >
                  <div className="template-group-header">
                    <Button
                      aria-label={`${collapsed ? "Expand" : "Collapse"} sequence ${group.name}`}
                      className="group-toggle-button icon-button"
                      size="icon"
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        const nextCollapsed = !collapsed;
                        setCollapsedGroups((current) => ({ ...current, [group.id]: nextCollapsed }));
                        if (nextCollapsed) {
                          setOpenGroupColorMenuId((current) => (current === group.id ? null : current));
                        }
                      }}
                    >
                      {collapsed ? <ChevronsDownIcon aria-hidden="true" /> : <ChevronsUpIcon aria-hidden="true" />}
                    </Button>

                    <label className="field-row group-color-field">
                      <Popover
                        open={openGroupColorMenuId === group.id}
                        onOpenChange={(open) => setOpenGroupColorMenuId(open ? group.id : null)}
                      >
                        <div className="group-color-picker" data-group-color-picker-id={group.id}>
                          <PopoverTrigger asChild>
                            <button
                              aria-expanded={openGroupColorMenuId === group.id}
                              aria-label={`Open sequence color menu ${group.name}`}
                              className="group-color-trigger"
                              style={{ backgroundColor: groupColor }}
                              type="button"
                            />
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            aria-label={`Sequence color menu ${group.name}`}
                            className="group-color-menu w-auto p-2"
                            role="menu"
                          >
                            <input
                              aria-label={`Sequence color ${group.name}`}
                              type="color"
                              value={groupColor}
                              onChange={(event) => {
                                const nextGroups = stepGroups.map((candidate) =>
                                  candidate.id === group.id ? { ...candidate, color: event.target.value } : candidate,
                                );
                                emitChange(steps, nextGroups);
                              }}
                            />
                            <div className="step-color-presets">
                              {STEP_COLOR_PRESETS.map((presetColor) => (
                                <button
                                  key={presetColor}
                                  aria-label={`Sequence preset ${group.name} ${presetColor}`}
                                  className="color-preset-button"
                                  style={{ backgroundColor: presetColor }}
                                  type="button"
                                  onClick={() => {
                                    const nextGroups = stepGroups.map((candidate) =>
                                      candidate.id === group.id ? { ...candidate, color: presetColor } : candidate,
                                    );
                                    emitChange(steps, nextGroups);
                                    setOpenGroupColorMenuId(null);
                                  }}
                                />
                              ))}
                            </div>
                          </PopoverContent>
                        </div>
                      </Popover>
                    </label>

                    <label className="field-row sequence-name-field">
                      <SequenceNameInput
                        group={group}
                        onChange={(name) => {
                          const nextGroups = stepGroups.map((candidate) =>
                            candidate.id === group.id ? { ...candidate, name } : candidate,
                          );
                          emitChange(steps, nextGroups);
                        }}
                      />
                    </label>

                    {errorCount > 0 ? <Badge className="group-error-pill has-errors">{errorCount} issues</Badge> : null}
                    <div className="group-meta-actions">
                      <Badge className="group-count-label" variant="secondary">
                        {groupSteps.length} steps
                      </Badge>

                      <ButtonGroup aria-label={`Actions for sequence ${group.name}`} className="group-header-actions">
                        <ButtonGroup>
                          <Button
                            aria-label={`Move sequence ${group.name} up`}
                            disabled={blockIndex === 0}
                            variant="outline"
                            type="button"
                            onClick={() => moveSequence(group.id, -1)}
                          >
                            <ChevronUpIcon aria-hidden="true" />
                          </Button>
                          <Button
                            aria-label={`Move sequence ${group.name} down`}
                            disabled={blockIndex >= topLevelBlocks.length - 1}
                            variant="outline"
                            type="button"
                            onClick={() => moveSequence(group.id, 1)}
                          >
                            <ChevronDownIcon aria-hidden="true" />
                          </Button>
                        </ButtonGroup>
                        <ButtonGroup>
                          <Button
                            aria-label={`Delete sequence ${group.name}`}
                            className="delete-action-button icon-button"
                            size="icon"
                            type="button"
                            variant="outline"
                            onClick={() => setPendingDelete({ kind: "group", groupId: group.id })}
                          >
                            <Trash2Icon aria-hidden="true" />
                          </Button>
                        </ButtonGroup>
                      </ButtonGroup>
                    </div>
                  </div>

                  {!collapsed ? (
                    <div className="template-group-body" data-testid={`group-body-${group.id}`}>
                      {Array.from({ length: groupSteps.length + 1 }).map((_, groupInsertIndex) => (
                        <Fragment key={`${group.id}-insert-${groupInsertIndex}`}>
                          <div className="insertion-rail insertion-rail-group" data-testid={`group-${group.id}-insert-${groupInsertIndex}`}>
                            <Button
                              aria-label={`Add step in ${group.name} at position ${groupInsertIndex + 1}`}
                              className="insertion-action-button"
                              size="xs"
                              type="button"
                              variant="ghost"
                              onClick={() => insertStepInSequence(group.id, groupInsertIndex)}
                            >
                              Add step
                            </Button>
                          </div>

                          {groupInsertIndex < groupSteps.length ? (
                            <StepItem
                              key={groupSteps[groupInsertIndex].id}
                              canMoveDown={groupInsertIndex < groupSteps.length - 1}
                              canMoveUp={groupInsertIndex > 0}
                              errors={stepErrorsById[groupSteps[groupInsertIndex].id] ?? []}
                              isGrouped
                              sharedResources={sharedResources}
                              step={groupSteps[groupInsertIndex]}
                              stepIndex={groupInsertIndex}
                              onMove={moveStep}
                              onRequestDelete={(stepId) => setPendingDelete({ kind: "step", stepId })}
                              onUpdate={updateStep}
                            />
                          ) : null}
                        </Fragment>
                      ))}
                    </div>
                  ) : null}
                </article>

                <div className="insertion-rail insertion-rail-top-level" data-testid={`top-level-insert-${blockIndex + 1}`}>
                  <TopLevelInsertActions
                    position={blockIndex + 2}
                    onAddSequence={() => insertSequenceAtTopLevel(blockIndex + 1)}
                    onAddStep={() => insertStepAtTopLevel(blockIndex + 1)}
                  />
                </div>
              </Fragment>
            );
          }

          const step = stepById[block.stepId];
          if (!step) {
            return null;
          }

          return (
            <Fragment key={step.id}>
              <article className="template-standalone-card" data-testid="template-standalone-card">
                <StepItem
                  canMoveDown={blockIndex < topLevelBlocks.length - 1}
                  canMoveUp={blockIndex > 0}
                  errors={stepErrorsById[step.id] ?? []}
                  isGrouped={false}
                  sharedResources={sharedResources}
                  step={step}
                  stepIndex={stepIndexById[step.id] ?? 0}
                  onMove={moveStep}
                  onRequestDelete={(stepId) => setPendingDelete({ kind: "step", stepId })}
                  onUpdate={updateStep}
                />
              </article>

              <div className="insertion-rail insertion-rail-top-level" data-testid={`top-level-insert-${blockIndex + 1}`}>
                <TopLevelInsertActions
                  position={blockIndex + 2}
                  onAddSequence={() => insertSequenceAtTopLevel(blockIndex + 1)}
                  onAddStep={() => insertStepAtTopLevel(blockIndex + 1)}
                />
              </div>
            </Fragment>
          );
        })}
      </div>

      <div className={`template-portability-footer ${hasPortabilityStatus ? "" : "is-empty"}`}>
        <p className="portability-status" data-testid="scenario-status">
          {portabilityStatus}
        </p>
      </div>

      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel={pendingDeleteCopy?.confirmLabel ?? "Delete"}
        isOpen={Boolean(pendingDelete)}
        message={pendingDeleteCopy?.message ?? ""}
        title={pendingDeleteCopy?.title ?? "Confirm"}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmPendingDelete}
      />
    </section>
  );
}

export default TemplateEditor;
