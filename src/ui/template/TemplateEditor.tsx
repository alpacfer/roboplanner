import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DEFAULT_STEP_COLOR, STEP_COLOR_PRESETS, normalizeStepColor } from "../../domain/colors";
import { validateStepGroups, validateTemplateSteps } from "../../domain/validation";
import type { OperatorInvolvement, Step, StepGroup } from "../../domain/types";

interface TemplateEditorProps {
  steps: Step[];
  stepGroups: StepGroup[];
  onChange: (payload: { steps: Step[]; stepGroups: StepGroup[] }) => void;
}

const OPERATOR_INVOLVEMENT_OPTIONS: Array<{ value: OperatorInvolvement; label: string }> = [
  { value: "NONE", label: "None" },
  { value: "WHOLE", label: "Whole step" },
  { value: "START", label: "Start only" },
  { value: "END", label: "End only" },
  { value: "START_END", label: "Start + End" },
];
const UNGROUPED_KEY = "ungrouped";

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

function flattenBuckets(orderedKeys: string[], buckets: Record<string, Step[]>): Step[] {
  return orderedKeys.flatMap((key) => buckets[key] ?? []);
}

function StepCardDropZone({ bucketKeyValue, children }: { bucketKeyValue: string; children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: `bucket:${bucketKeyValue}` });

  return (
    <div
      ref={setNodeRef}
      className={`template-group-body ${isOver ? "is-drop-target" : ""}`}
      data-testid={`group-body-${bucketKeyValue}`}
    >
      {children}
    </div>
  );
}

interface StepItemProps {
  step: Step;
  isGrouped: boolean;
  stepIndex: number;
  errors: string[];
  totalSteps: number;
  onUpdate: (stepId: string, next: Step) => void;
  onMoveWithinGroup: (stepId: string, direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveAcrossGroups: (stepId: string, direction: -1 | 1) => void;
  canMoveToPreviousGroup: boolean;
  canMoveToNextGroup: boolean;
  onDelete: (stepId: string) => void;
}

function StepItem({
  step,
  isGrouped,
  stepIndex,
  errors,
  totalSteps,
  onUpdate,
  onMoveWithinGroup,
  canMoveUp,
  canMoveDown,
  onMoveAcrossGroups,
  canMoveToPreviousGroup,
  canMoveToNextGroup,
  onDelete,
}: StepItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`template-step-item ${isDragging ? "is-dragging" : ""}`}
      data-testid="step-item"
      data-step-id={step.id}
    >
      <div className="template-step-top">
        <button
          type="button"
          className="drag-handle"
          aria-label={`Drag step ${step.name}`}
          {...attributes}
          {...listeners}
        >
          Drag
        </button>
        <div className="template-step-title-row">
          <label className="field-row">
            <span>Name</span>
            <input
              aria-label={`Step name ${step.id}`}
              type="text"
              value={step.name}
              onChange={(event) => onUpdate(step.id, { ...step, name: event.target.value })}
            />
          </label>
          <label className="field-row duration-field">
            <span>Duration (min)</span>
            <input
              aria-label={`Step duration ${step.id}`}
              min={0}
              step={1}
              type="number"
              value={step.durationMin}
              onChange={(event) => {
                const parsedValue = Number.parseInt(event.target.value, 10);
                onUpdate(step.id, {
                  ...step,
                  durationMin: Number.isNaN(parsedValue) ? 0 : parsedValue,
                });
              }}
            />
          </label>
          <label className="field-row operator-field">
            <span>Operator involvement</span>
            <select
              aria-label={`Operator involvement ${step.id}`}
              value={step.operatorInvolvement}
              onChange={(event) =>
                onUpdate(step.id, {
                  ...step,
                  operatorInvolvement: event.target.value as OperatorInvolvement,
                })
              }
            >
              {OPERATOR_INVOLVEMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="template-step-lower">
        {isGrouped ? (
          <div className="inherited-color-note">
            <small>Step color is inherited from the sequence.</small>
          </div>
        ) : (
          <div className="step-color-cell">
            <label className="field-row color-field">
              <span>Step color</span>
              <input
                aria-label={`Step color ${step.id}`}
                type="color"
                value={normalizeStepColor(step.color)}
                onChange={(event) => {
                  onUpdate(step.id, {
                    ...step,
                    color: event.target.value,
                  });
                }}
              />
            </label>
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
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="row-actions">
          <button
            aria-label={`Move step ${stepIndex + 1} up`}
            disabled={!canMoveUp}
            type="button"
            onClick={() => onMoveWithinGroup(step.id, -1)}
          >
            Up
          </button>
          <button
            aria-label={`Move step ${stepIndex + 1} down`}
            disabled={!canMoveDown}
            type="button"
            onClick={() => onMoveWithinGroup(step.id, 1)}
          >
            Down
          </button>
          <button
            aria-label={`Move step ${stepIndex + 1} to previous sequence`}
            disabled={!canMoveToPreviousGroup}
            type="button"
            onClick={() => onMoveAcrossGroups(step.id, -1)}
          >
            Previous sequence
          </button>
          <button
            aria-label={`Move step ${stepIndex + 1} to next sequence`}
            disabled={!canMoveToNextGroup}
            type="button"
            onClick={() => onMoveAcrossGroups(step.id, 1)}
          >
            Next sequence
          </button>
          <button
            aria-label={`Delete step ${stepIndex + 1}`}
            disabled={totalSteps <= 1}
            type="button"
            onClick={() => onDelete(step.id)}
          >
            Delete
          </button>
        </div>
      </div>
      {errors.length > 0 ? (
        <ul className="inline-errors">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : (
        <span className="valid-step">OK</span>
      )}
    </article>
  );
}

function TemplateEditor({ steps, stepGroups, onChange }: TemplateEditorProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const stepErrors = validateTemplateSteps(steps);
  const groupErrors = validateStepGroups(stepGroups);

  const orderedBucketKeys = useMemo(() => [...stepGroups.map((group) => group.id), UNGROUPED_KEY], [stepGroups]);
  const groupsById = useMemo(() => Object.fromEntries(stepGroups.map((group) => [group.id, group])), [stepGroups]);
  const stepIndexById = useMemo(() => Object.fromEntries(steps.map((step, index) => [step.id, index])), [steps]);
  const stepsByBucketKey = useMemo(() => {
    const initial = Object.fromEntries(orderedBucketKeys.map((key) => [key, [] as Step[]]));
    for (const step of steps) {
      const key = step.groupId && groupsById[step.groupId] ? step.groupId : UNGROUPED_KEY;
      initial[key].push(step);
    }
    return initial;
  }, [groupsById, orderedBucketKeys, steps]);
  const bucketKeyByStepId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(stepsByBucketKey).flatMap(([key, bucketSteps]) => bucketSteps.map((step) => [step.id, key])),
      ),
    [stepsByBucketKey],
  );
  const activeStep = useMemo(() => steps.find((step) => step.id === activeStepId) ?? null, [activeStepId, steps]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const emitChange = (nextSteps: Step[], nextStepGroups: StepGroup[]) => {
    onChange({ steps: nextSteps, stepGroups: nextStepGroups });
  };

  const updateStep = (stepId: string, updatedStep: Step) => {
    const nextSteps = steps.map((step) => (step.id === stepId ? updatedStep : step));
    emitChange(nextSteps, stepGroups);
  };

  const addStep = (targetBucketKey: string) => {
    const targetGroupId = targetBucketKey === UNGROUPED_KEY ? null : targetBucketKey;
    const nextStepsByBucketKey = Object.fromEntries(
      orderedBucketKeys.map((key) => [key, [...(stepsByBucketKey[key] ?? [])]]),
    );
    nextStepsByBucketKey[targetBucketKey].push({
      id: nextStepId(steps),
      name: `Step ${steps.length + 1}`,
      durationMin: 1,
      operatorInvolvement: "NONE",
      groupId: targetGroupId,
      color: DEFAULT_STEP_COLOR,
    });
    emitChange(flattenBuckets(orderedBucketKeys, nextStepsByBucketKey), stepGroups);
  };

  const deleteStep = (stepId: string) => {
    emitChange(
      steps.filter((step) => step.id !== stepId),
      stepGroups,
    );
  };

  const moveStepWithinGroup = (stepId: string, direction: -1 | 1) => {
    const bucketKeyValue = bucketKeyByStepId[stepId];
    if (!bucketKeyValue) {
      return;
    }
    const sourceBucket = stepsByBucketKey[bucketKeyValue];
    const sourceIndex = sourceBucket.findIndex((step) => step.id === stepId);
    const destinationIndex = sourceIndex + direction;
    if (sourceIndex < 0 || destinationIndex < 0 || destinationIndex >= sourceBucket.length) {
      return;
    }
    const nextStepsByBucketKey = Object.fromEntries(
      orderedBucketKeys.map((key) => [key, [...(stepsByBucketKey[key] ?? [])]]),
    );
    nextStepsByBucketKey[bucketKeyValue] = arrayMove(nextStepsByBucketKey[bucketKeyValue], sourceIndex, destinationIndex);
    emitChange(flattenBuckets(orderedBucketKeys, nextStepsByBucketKey), stepGroups);
  };

  const moveStepAcrossGroups = (stepId: string, direction: -1 | 1) => {
    const sourceBucketKey = bucketKeyByStepId[stepId];
    if (!sourceBucketKey) {
      return;
    }
    const sourceBucketIndex = orderedBucketKeys.indexOf(sourceBucketKey);
    const targetBucketIndex = sourceBucketIndex + direction;
    if (sourceBucketIndex < 0 || targetBucketIndex < 0 || targetBucketIndex >= orderedBucketKeys.length) {
      return;
    }
    const targetBucketKey = orderedBucketKeys[targetBucketIndex];
    const nextStepsByBucketKey = Object.fromEntries(
      orderedBucketKeys.map((key) => [key, [...(stepsByBucketKey[key] ?? [])]]),
    );
    const sourceSteps = nextStepsByBucketKey[sourceBucketKey];
    const stepIndex = sourceSteps.findIndex((step) => step.id === stepId);
    if (stepIndex < 0) {
      return;
    }
    const [movedStep] = sourceSteps.splice(stepIndex, 1);
    nextStepsByBucketKey[targetBucketKey].push({
      ...movedStep,
      groupId: targetBucketKey === UNGROUPED_KEY ? null : targetBucketKey,
    });
    emitChange(flattenBuckets(orderedBucketKeys, nextStepsByBucketKey), stepGroups);
  };

  const addGroup = () => {
    emitChange(steps, [
      ...stepGroups,
      {
        id: nextStepGroupId(stepGroups),
        name: `Sequence ${stepGroups.length + 1}`,
        color: DEFAULT_STEP_COLOR,
      },
    ]);
  };

  const updateGroup = (groupIndex: number, updatedGroup: StepGroup) => {
    const nextGroups = stepGroups.map((group, currentIndex) =>
      currentIndex === groupIndex ? updatedGroup : group,
    );
    emitChange(steps, nextGroups);
  };

  const deleteGroup = (groupId: string) => {
    const nextGroups = stepGroups.filter((group) => group.id !== groupId);
    const nextSteps = steps.map((step) => (step.groupId === groupId ? { ...step, groupId: null } : step));
    emitChange(nextSteps, nextGroups);
    setCollapsedGroups((current) => {
      const next = { ...current };
      delete next[groupId];
      return next;
    });
  };

  const onDragStart = (event: DragStartEvent) => {
    setActiveStepId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveStepId(null);
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId) {
      return;
    }

    const sourceBucketKey = bucketKeyByStepId[activeId];
    if (!sourceBucketKey) {
      return;
    }

    let destinationBucketKey = sourceBucketKey;
    let destinationIndex = stepsByBucketKey[sourceBucketKey].length - 1;

    if (overId.startsWith("bucket:")) {
      destinationBucketKey = overId.slice("bucket:".length);
      destinationIndex = stepsByBucketKey[destinationBucketKey].length;
    } else {
      const targetBucketKey = bucketKeyByStepId[overId];
      if (!targetBucketKey) {
        return;
      }
      destinationBucketKey = targetBucketKey;
      destinationIndex = stepsByBucketKey[targetBucketKey].findIndex((step) => step.id === overId);
      if (destinationIndex < 0) {
        destinationIndex = stepsByBucketKey[targetBucketKey].length;
      }
    }

    const nextStepsByBucketKey = Object.fromEntries(
      orderedBucketKeys.map((key) => [key, [...(stepsByBucketKey[key] ?? [])]]),
    );
    const sourceSteps = nextStepsByBucketKey[sourceBucketKey];
    const sourceIndex = sourceSteps.findIndex((step) => step.id === activeId);
    if (sourceIndex < 0) {
      return;
    }

    const [movedStep] = sourceSteps.splice(sourceIndex, 1);
    if (sourceBucketKey === destinationBucketKey) {
      const normalizedDestinationIndex = Math.max(0, Math.min(destinationIndex, sourceSteps.length));
      sourceSteps.splice(normalizedDestinationIndex, 0, movedStep);
    } else {
      const targetSteps = nextStepsByBucketKey[destinationBucketKey];
      const normalizedDestinationIndex = Math.max(0, Math.min(destinationIndex, targetSteps.length));
      targetSteps.splice(normalizedDestinationIndex, 0, {
        ...movedStep,
        groupId: destinationBucketKey === UNGROUPED_KEY ? null : destinationBucketKey,
      });
    }

    emitChange(flattenBuckets(orderedBucketKeys, nextStepsByBucketKey), stepGroups);
  };

  return (
    <section className="template-editor">
      <div className="template-editor-header">
        <h2>Template Steps</h2>
        <button type="button" onClick={addGroup}>
          Add sequence
        </button>
      </div>
      <DndContext
        collisionDetection={closestCenter}
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="template-groups-grid">
          {stepGroups.map((group, groupIndex) => {
            const key = group.id;
            const groupSteps = stepsByBucketKey[key] ?? [];
            const collapsed = collapsedGroups[key] ?? false;
            const ownErrors = groupErrors[groupIndex] ?? [];
            const stepErrorCount = groupSteps.reduce((count, step) => {
              const stepErrorsForRow = stepErrors[stepIndexById[step.id]] ?? [];
              return count + stepErrorsForRow.length;
            }, 0);
            const errorCount = ownErrors.length + stepErrorCount;
            const groupColor = normalizeStepColor(group.color);

            return (
              <article
                key={group.id}
                className="template-group-card"
                style={{
                  "--group-color": groupColor,
                } as CSSProperties}
                data-testid="template-group-card"
              >
                <div className="template-group-header">
                  <button
                    aria-label={`${collapsed ? "Expand" : "Collapse"} sequence ${group.name}`}
                    type="button"
                    onClick={() => setCollapsedGroups((current) => ({ ...current, [key]: !collapsed }))}
                  >
                    {collapsed ? "Expand" : "Collapse"}
                  </button>
                  <label className="field-row">
                    <span>Sequence name</span>
                    <input
                      aria-label={`Sequence name ${groupIndex + 1}`}
                      type="text"
                      value={group.name}
                      onChange={(event) => updateGroup(groupIndex, { ...group, name: event.target.value })}
                    />
                  </label>
                  <div className="field-row group-color-field">
                    <span>Sequence color</span>
                    <div className="group-color-controls">
                      <input
                        aria-label={`Sequence color ${groupIndex + 1}`}
                        type="color"
                        value={groupColor}
                        onChange={(event) => updateGroup(groupIndex, { ...group, color: event.target.value })}
                      />
                      <button
                        aria-label={`Reset sequence color ${groupIndex + 1} to default`}
                        type="button"
                        onClick={() =>
                          updateGroup(groupIndex, {
                            ...group,
                            color: DEFAULT_STEP_COLOR,
                          })
                        }
                      >
                        Default
                      </button>
                    </div>
                    <div className="step-color-presets">
                      {STEP_COLOR_PRESETS.map((presetColor) => (
                        <button
                          key={presetColor}
                          aria-label={`Sequence preset ${groupIndex + 1} ${presetColor}`}
                          className="color-preset-button"
                          style={{ backgroundColor: presetColor }}
                          type="button"
                          onClick={() => updateGroup(groupIndex, { ...group, color: presetColor })}
                        />
                      ))}
                    </div>
                  </div>
                  <span className={`group-error-pill ${errorCount > 0 ? "has-errors" : ""}`}>
                    {errorCount > 0 ? `${errorCount} issues` : "No issues"}
                  </span>
                  <span className="group-count-label">{groupSteps.length} steps</span>
                  <button aria-label={`Delete sequence ${groupIndex + 1}`} type="button" onClick={() => deleteGroup(group.id)}>
                    Delete sequence
                  </button>
                </div>
                {!collapsed ? (
                  <StepCardDropZone bucketKeyValue={key}>
                    <SortableContext items={groupSteps.map((step) => step.id)} strategy={verticalListSortingStrategy}>
                      {groupSteps.map((step, index) => (
                        <StepItem
                          key={step.id}
                          step={step}
                          isGrouped
                          stepIndex={index}
                          errors={stepErrors[stepIndexById[step.id]] ?? []}
                          totalSteps={steps.length}
                          canMoveUp={index > 0}
                          canMoveDown={index < groupSteps.length - 1}
                          canMoveToPreviousGroup={orderedBucketKeys.indexOf(key) > 0}
                          canMoveToNextGroup={orderedBucketKeys.indexOf(key) < orderedBucketKeys.length - 1}
                          onUpdate={updateStep}
                          onMoveWithinGroup={moveStepWithinGroup}
                          onMoveAcrossGroups={moveStepAcrossGroups}
                          onDelete={deleteStep}
                        />
                      ))}
                    </SortableContext>
                    {groupSteps.length === 0 ? <p className="group-empty-state">No steps in this sequence yet. Add one below.</p> : null}
                  </StepCardDropZone>
                ) : null}
                <div className="group-footer-actions">
                  <button type="button" onClick={() => addStep(key)}>
                    Add step to {group.name}
                  </button>
                </div>
              </article>
            );
          })}

          {(() => {
            const ungroupedSteps = stepsByBucketKey[UNGROUPED_KEY] ?? [];
            const collapsed = collapsedGroups[UNGROUPED_KEY] ?? false;
            const ungroupedErrorCount = ungroupedSteps.reduce((count, step) => {
              const stepErrorsForRow = stepErrors[stepIndexById[step.id]] ?? [];
              return count + stepErrorsForRow.length;
            }, 0);

            return (
              <article className="template-group-card ungrouped-card" data-testid="template-ungrouped-card">
                <div className="template-group-header">
                  <button
                    aria-label={`${collapsed ? "Expand" : "Collapse"} sequence Unsequenced`}
                    type="button"
                    onClick={() => setCollapsedGroups((current) => ({ ...current, [UNGROUPED_KEY]: !collapsed }))}
                  >
                    {collapsed ? "Expand" : "Collapse"}
                  </button>
                  <h3>Unsequenced</h3>
                  <span className={`group-error-pill ${ungroupedErrorCount > 0 ? "has-errors" : ""}`}>
                    {ungroupedErrorCount > 0 ? `${ungroupedErrorCount} issues` : "No issues"}
                  </span>
                  <span className="group-count-label">{ungroupedSteps.length} steps</span>
                </div>
                {!collapsed ? (
                  <StepCardDropZone bucketKeyValue={UNGROUPED_KEY}>
                    <SortableContext items={ungroupedSteps.map((step) => step.id)} strategy={verticalListSortingStrategy}>
                      {ungroupedSteps.map((step, index) => (
                        <StepItem
                          key={step.id}
                          step={step}
                          isGrouped={false}
                          stepIndex={index}
                          errors={stepErrors[stepIndexById[step.id]] ?? []}
                          totalSteps={steps.length}
                          canMoveUp={index > 0}
                          canMoveDown={index < ungroupedSteps.length - 1}
                          canMoveToPreviousGroup={orderedBucketKeys.indexOf(UNGROUPED_KEY) > 0}
                          canMoveToNextGroup={false}
                          onUpdate={updateStep}
                          onMoveWithinGroup={moveStepWithinGroup}
                          onMoveAcrossGroups={moveStepAcrossGroups}
                          onDelete={deleteStep}
                        />
                      ))}
                    </SortableContext>
                    {ungroupedSteps.length === 0 ? (
                      <p className="group-empty-state">No unsequenced steps. Move one here or create a new step.</p>
                    ) : null}
                  </StepCardDropZone>
                ) : null}
                <div className="group-footer-actions">
                  <button type="button" onClick={() => addStep(UNGROUPED_KEY)}>
                    Add unsequenced step
                  </button>
                </div>
              </article>
            );
          })()}
        </div>
        <DragOverlay>
          {activeStep ? (
            <div className="template-step-item is-overlay">
              <strong>{activeStep.name}</strong>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}

export default TemplateEditor;
