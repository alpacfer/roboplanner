import { Fragment, useMemo, useState } from "react";
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

let stepIdCounter = 1000;
let stepGroupIdCounter = 1000;

function nextStepId(): string {
  stepIdCounter += 1;
  return `step-${stepIdCounter}`;
}

function nextStepGroupId(): string {
  stepGroupIdCounter += 1;
  return `group-${stepGroupIdCounter}`;
}

function TemplateEditor({ steps, stepGroups, onChange }: TemplateEditorProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const stepErrors = validateTemplateSteps(steps);
  const groupErrors = validateStepGroups(stepGroups);

  const groupsById = useMemo(
    () => Object.fromEntries(stepGroups.map((group) => [group.id, group])),
    [stepGroups],
  );

  const emitChange = (nextSteps: Step[], nextStepGroups: StepGroup[]) => {
    onChange({ steps: nextSteps, stepGroups: nextStepGroups });
  };

  const updateStep = (index: number, updatedStep: Step) => {
    const nextSteps = steps.map((step, currentIndex) => (currentIndex === index ? updatedStep : step));
    emitChange(nextSteps, stepGroups);
  };

  const addStep = () => {
    emitChange(
      [
        ...steps,
        {
          id: nextStepId(),
          name: `Step ${steps.length + 1}`,
          durationMin: 1,
          operatorInvolvement: "NONE",
          groupId: null,
          color: DEFAULT_STEP_COLOR,
        },
      ],
      stepGroups,
    );
  };

  const deleteStep = (index: number) => {
    emitChange(
      steps.filter((_, currentIndex) => currentIndex !== index),
      stepGroups,
    );
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= steps.length) {
      return;
    }

    const nextSteps = [...steps];
    const [movedStep] = nextSteps.splice(index, 1);
    nextSteps.splice(nextIndex, 0, movedStep);
    emitChange(nextSteps, stepGroups);
  };

  const updateStepGroup = (stepIndex: number, groupIdValue: string) => {
    const nextGroupId = groupIdValue.trim() === "" ? null : groupIdValue;
    updateStep(stepIndex, { ...steps[stepIndex], groupId: nextGroupId });
  };

  const addGroup = () => {
    emitChange(steps, [
      ...stepGroups,
      {
        id: nextStepGroupId(),
        name: `Group ${stepGroups.length + 1}`,
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
      const { [groupId]: _, ...rest } = current;
      return rest;
    });
  };

  const renderStepRow = (step: Step, index: number) => {
    const errors = stepErrors[index] ?? [];
    const group = step.groupId ? groupsById[step.groupId] : undefined;
    const effectiveColor = normalizeStepColor(group?.color ?? step.color);
    const ownColor = normalizeStepColor(step.color);
    const grouped = Boolean(group);

    return (
      <tr data-testid="step-row" key={step.id}>
        <td>
          <input
            aria-label={`Name ${index + 1}`}
            type="text"
            value={step.name}
            onChange={(event) => {
              updateStep(index, { ...step, name: event.target.value });
            }}
          />
        </td>
        <td>
          <input
            aria-label={`Duration ${index + 1}`}
            min={0}
            step={1}
            type="number"
            value={step.durationMin}
            onChange={(event) => {
              const parsedValue = Number.parseInt(event.target.value, 10);
              updateStep(index, {
                ...step,
                durationMin: Number.isNaN(parsedValue) ? 0 : parsedValue,
              });
            }}
          />
        </td>
        <td>
          <select
            aria-label={`Operator involvement ${index + 1}`}
            value={step.operatorInvolvement}
            onChange={(event) => {
              updateStep(index, {
                ...step,
                operatorInvolvement: event.target.value as OperatorInvolvement,
              });
            }}
          >
            {OPERATOR_INVOLVEMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </td>
        <td>
          <select
            aria-label={`Group ${index + 1}`}
            value={step.groupId ?? ""}
            onChange={(event) => updateStepGroup(index, event.target.value)}
          >
            <option value="">None</option>
            {stepGroups.map((groupOption) => (
              <option key={groupOption.id} value={groupOption.id}>
                {groupOption.name}
              </option>
            ))}
          </select>
        </td>
        <td>
          <div className="step-color-cell">
            <input
              aria-label={`Color ${index + 1}`}
              disabled={grouped}
              type="color"
              value={grouped ? effectiveColor : ownColor}
              onChange={(event) => {
                updateStep(index, {
                  ...step,
                  color: event.target.value,
                });
              }}
            />
            <div className="step-color-presets">
              {STEP_COLOR_PRESETS.map((presetColor) => (
                <button
                  key={presetColor}
                  aria-label={`Preset ${index + 1} ${presetColor}`}
                  className="color-preset-button"
                  disabled={grouped}
                  style={{ backgroundColor: presetColor }}
                  type="button"
                  onClick={() => {
                    updateStep(index, {
                      ...step,
                      color: presetColor,
                    });
                  }}
                />
              ))}
            </div>
            {grouped ? <small>Color overridden by group</small> : null}
          </div>
        </td>
        <td>
          <div className="row-actions">
            <button
              aria-label={`Move step ${index + 1} up`}
              disabled={index === 0}
              type="button"
              onClick={() => moveStep(index, -1)}
            >
              Up
            </button>
            <button
              aria-label={`Move step ${index + 1} down`}
              disabled={index === steps.length - 1}
              type="button"
              onClick={() => moveStep(index, 1)}
            >
              Down
            </button>
            <button
              aria-label={`Delete step ${index + 1}`}
              disabled={steps.length <= 1}
              type="button"
              onClick={() => deleteStep(index)}
            >
              Delete
            </button>
          </div>
        </td>
        <td>
          {errors.length > 0 ? (
            <ul className="inline-errors">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : (
            <span className="valid-step">OK</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <section>
      <h2>Template Steps</h2>
      <table className="template-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Duration (min)</th>
            <th>Operator involvement</th>
            <th>Group</th>
            <th>Color</th>
            <th>Actions</th>
            <th>Validation</th>
          </tr>
        </thead>
        <tbody>
          {stepGroups.map((group, groupIndex) => {
            const groupedSteps = steps
              .map((step, stepIndex) => ({ step, stepIndex }))
              .filter(({ step }) => step.groupId === group.id);
            const collapsed = collapsedGroups[group.id] ?? false;
            const errors = groupErrors[groupIndex] ?? [];

            return (
              <Fragment key={group.id}>
                <tr className="step-group-row" data-testid="step-group-row">
                  <td colSpan={3}>
                    <button
                      aria-label={`${collapsed ? "Expand" : "Collapse"} group ${group.name}`}
                      type="button"
                      onClick={() =>
                        setCollapsedGroups((current) => ({ ...current, [group.id]: !collapsed }))
                      }
                    >
                      {collapsed ? "Expand" : "Collapse"}
                    </button>{" "}
                    <strong>{group.name}</strong> ({groupedSteps.length} steps)
                  </td>
                  <td>
                    <input
                      aria-label={`Group name ${groupIndex + 1}`}
                      type="text"
                      value={group.name}
                      onChange={(event) =>
                        updateGroup(groupIndex, {
                          ...group,
                          name: event.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Group color ${groupIndex + 1}`}
                      type="color"
                      value={normalizeStepColor(group.color)}
                      onChange={(event) =>
                        updateGroup(groupIndex, {
                          ...group,
                          color: event.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      aria-label={`Delete group ${groupIndex + 1}`}
                      type="button"
                      onClick={() => deleteGroup(group.id)}
                    >
                      Delete group
                    </button>
                  </td>
                  <td>
                    {errors.length > 0 ? (
                      <ul className="inline-errors">
                        {errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="valid-step">OK</span>
                    )}
                  </td>
                </tr>
                {!collapsed ? groupedSteps.map(({ step, stepIndex }) => renderStepRow(step, stepIndex)) : null}
              </Fragment>
            );
          })}
          {steps
            .map((step, index) => ({ step, index }))
            .filter(({ step }) => step.groupId === null)
            .map(({ step, index }) => renderStepRow(step, index))}
        </tbody>
      </table>
      <div className="template-actions">
        <button type="button" onClick={addStep}>
          Add step
        </button>
        <button type="button" onClick={addGroup}>
          Add group
        </button>
      </div>
    </section>
  );
}

export default TemplateEditor;
