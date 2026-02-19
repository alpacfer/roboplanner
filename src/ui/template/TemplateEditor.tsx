import { useMemo, useState, type CSSProperties } from "react";
import { DEFAULT_STEP_COLOR, STEP_COLOR_PRESETS, normalizeStepColor } from "../../domain/colors";
import { validateStepGroups, validateTemplateSteps } from "../../domain/validation";
import type { OperatorInvolvement, Step, StepGroup } from "../../domain/types";

interface TemplateEditorProps {
  steps: Step[];
  stepGroups: StepGroup[];
  onChange: (payload: { steps: Step[]; stepGroups: StepGroup[] }) => void;
}

const OPERATOR_INVOLVEMENT_OPTIONS: Array<{ value: OperatorInvolvement; label: string }> = [
  { value: "NONE", label: "Operator involvement: None" },
  { value: "WHOLE", label: "Operator involvement: Whole step" },
  { value: "START", label: "Operator involvement: Start only" },
  { value: "END", label: "Operator involvement: End only" },
  { value: "START_END", label: "Operator involvement: Start + End" },
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

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const nextItems = [...items];
  const [moved] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, moved);
  return nextItems;
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
  onDelete,
}: StepItemProps) {
  return (
    <article className="template-step-item" data-testid="step-item" data-step-id={step.id}>
      <div className="template-step-top">
        <div className="template-step-title-row">
          <label className="field-row step-name-field">
            <input
              aria-label={`Step name ${step.id}`}
              placeholder="Step name"
              type="text"
              value={step.name}
              onChange={(event) => onUpdate(step.id, { ...step, name: event.target.value })}
            />
          </label>
          <label className="field-row duration-field">
            <input
              aria-label={`Step duration ${step.id}`}
              className="step-duration-input"
              min={0}
              max={99}
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
            <select
              aria-label={`Operator involvement ${step.id}`}
              className="operator-select"
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
        <button
          aria-label={`Delete step ${stepIndex + 1}`}
          className="icon-button danger-ghost-button step-delete-button"
          disabled={totalSteps <= 1}
          title={`Delete step ${step.name}`}
          type="button"
          onClick={() => onDelete(step.id)}
        >
          <span aria-hidden="true" className="icon-glyph">
            ×
          </span>
        </button>
      </div>

      <div className="template-step-lower">
        {!isGrouped ? (
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
        ) : null}

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

function TemplateEditor({ steps, stepGroups, onChange }: TemplateEditorProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [openGroupColorMenuId, setOpenGroupColorMenuId] = useState<string | null>(null);
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
    nextStepsByBucketKey[bucketKeyValue] = moveItem(nextStepsByBucketKey[bucketKeyValue], sourceIndex, destinationIndex);
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
    setOpenGroupColorMenuId((current) => (current === groupId ? null : current));
  };
  const areAllCollapsed = orderedBucketKeys.every((key) => collapsedGroups[key]);
  const toggleCollapseAll = () => {
    if (areAllCollapsed) {
      setCollapsedGroups({});
      return;
    }
    setCollapsedGroups(Object.fromEntries(orderedBucketKeys.map((key) => [key, true])));
  };

  return (
    <section className="template-editor">
      <div className="template-editor-header">
        <div className="template-editor-title-group">
          <h2>Template Steps</h2>
          <p>Organize and reorder your process as sequence cards.</p>
        </div>
        <div className="template-editor-actions">
          <button
            aria-label={areAllCollapsed ? "Expand all sequences" : "Collapse all sequences"}
            className="icon-button"
            title={areAllCollapsed ? "Expand all sequences" : "Collapse all sequences"}
            type="button"
            onClick={toggleCollapseAll}
          >
            <span aria-hidden="true" className="icon-glyph">
              {areAllCollapsed ? "▾" : "▸"}
            </span>
          </button>
        <button
          aria-label="Add sequence"
          className="template-add-sequence-button icon-button"
          title="Add sequence"
          type="button"
          onClick={addGroup}
        >
          <span aria-hidden="true" className="icon-glyph">
            +
          </span>
        </button>
        </div>
      </div>
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
                  className="group-toggle-button icon-button"
                  title={`${collapsed ? "Expand" : "Collapse"} sequence ${group.name}`}
                  type="button"
                  onClick={() => setCollapsedGroups((current) => ({ ...current, [key]: !collapsed }))}
                >
                  <span aria-hidden="true" className="icon-glyph">
                    {collapsed ? "▸" : "▾"}
                  </span>
                </button>
                <label className="field-row">
                  <input
                    aria-label={`Sequence name ${groupIndex + 1}`}
                    placeholder="Sequence name"
                    type="text"
                    value={group.name}
                    onChange={(event) => updateGroup(groupIndex, { ...group, name: event.target.value })}
                  />
                </label>
                <div className="group-color-field">
                  <div className="group-color-picker">
                    <button
                      aria-expanded={openGroupColorMenuId === group.id}
                      aria-label={`Open sequence color menu ${groupIndex + 1}`}
                      className="group-color-trigger"
                      style={{ backgroundColor: groupColor }}
                      title={`Open sequence color menu for ${group.name}`}
                      type="button"
                      onClick={() => setOpenGroupColorMenuId((current) => (current === group.id ? null : group.id))}
                    />
                    {openGroupColorMenuId === group.id ? (
                      <div aria-label={`Sequence color menu ${groupIndex + 1}`} className="group-color-menu" role="menu">
                        <input
                          aria-label={`Sequence color ${groupIndex + 1}`}
                          type="color"
                          value={groupColor}
                          onChange={(event) => updateGroup(groupIndex, { ...group, color: event.target.value })}
                        />
                        <div className="step-color-presets">
                          {STEP_COLOR_PRESETS.map((presetColor) => (
                            <button
                              key={presetColor}
                              aria-label={`Sequence preset ${groupIndex + 1} ${presetColor}`}
                              className="color-preset-button"
                              style={{ backgroundColor: presetColor }}
                              type="button"
                              onClick={() => {
                                updateGroup(groupIndex, { ...group, color: presetColor });
                                setOpenGroupColorMenuId(null);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <span className={`group-error-pill ${errorCount > 0 ? "has-errors" : ""}`}>
                  {errorCount > 0 ? `${errorCount} issues` : "No issues"}
                </span>
                <span className="group-count-label">{groupSteps.length} steps</span>
                <button
                  aria-label={`Delete sequence ${groupIndex + 1}`}
                  className="group-delete-button icon-button"
                  title={`Delete sequence ${group.name}`}
                  type="button"
                  onClick={() => deleteGroup(group.id)}
                >
                  <span aria-hidden="true" className="icon-glyph">
                    ×
                  </span>
                </button>
              </div>
              {!collapsed ? (
                <div className="template-group-body" data-testid={`group-body-${key}`}>
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
                      onUpdate={updateStep}
                      onMoveWithinGroup={moveStepWithinGroup}
                      onDelete={deleteStep}
                    />
                  ))}
                  {groupSteps.length === 0 ? <p className="group-empty-state">No steps in this sequence yet. Add one below.</p> : null}
                </div>
              ) : null}
              {!collapsed ? (
                <div className="group-footer-actions">
                  <button
                    aria-label={`Add step to ${group.name}`}
                    className="add-step-button icon-button"
                    title={`Add step to ${group.name}`}
                    type="button"
                    onClick={() => addStep(key)}
                  >
                    <span aria-hidden="true" className="icon-glyph">
                      +
                    </span>
                  </button>
                </div>
              ) : null}
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
                  className="group-toggle-button icon-button"
                  title={`${collapsed ? "Expand" : "Collapse"} sequence Unsequenced`}
                  type="button"
                  onClick={() => setCollapsedGroups((current) => ({ ...current, [UNGROUPED_KEY]: !collapsed }))}
                >
                  <span aria-hidden="true" className="icon-glyph">
                    {collapsed ? "▸" : "▾"}
                  </span>
                </button>
                <h3>Unsequenced</h3>
                <span className={`group-error-pill ${ungroupedErrorCount > 0 ? "has-errors" : ""}`}>
                  {ungroupedErrorCount > 0 ? `${ungroupedErrorCount} issues` : "No issues"}
                </span>
                <span className="group-count-label">{ungroupedSteps.length} steps</span>
              </div>
              {!collapsed ? (
                <div className="template-group-body" data-testid={`group-body-${UNGROUPED_KEY}`}>
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
                      onUpdate={updateStep}
                      onMoveWithinGroup={moveStepWithinGroup}
                      onDelete={deleteStep}
                    />
                  ))}
                  {ungroupedSteps.length === 0 ? (
                    <p className="group-empty-state">No unsequenced steps. Move one here or create a new step.</p>
                  ) : null}
                </div>
              ) : null}
              {!collapsed ? (
                <div className="group-footer-actions">
                  <button
                    aria-label="Add unsequenced step"
                    className="add-step-button icon-button"
                    title="Add unsequenced step"
                    type="button"
                    onClick={() => addStep(UNGROUPED_KEY)}
                  >
                    <span aria-hidden="true" className="icon-glyph">
                      +
                    </span>
                  </button>
                </div>
              ) : null}
            </article>
          );
        })()}
      </div>
    </section>
  );
}

export default TemplateEditor;
