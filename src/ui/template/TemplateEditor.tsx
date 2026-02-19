import { DEFAULT_STEP_COLOR, STEP_COLOR_PRESETS, normalizeStepColor } from "../../domain/colors";
import { validateTemplateSteps } from "../../domain/validation";
import type { OperatorInvolvement, Step } from "../../domain/types";

interface TemplateEditorProps {
  steps: Step[];
  onChange: (steps: Step[]) => void;
}

const OPERATOR_INVOLVEMENT_OPTIONS: Array<{ value: OperatorInvolvement; label: string }> = [
  { value: "NONE", label: "None" },
  { value: "WHOLE", label: "Whole step" },
  { value: "START", label: "Start only" },
  { value: "END", label: "End only" },
  { value: "START_END", label: "Start + End" },
];

let stepIdCounter = 1000;

function nextStepId(): string {
  stepIdCounter += 1;
  return `step-${stepIdCounter}`;
}

function TemplateEditor({ steps, onChange }: TemplateEditorProps) {
  const stepErrors = validateTemplateSteps(steps);

  const updateStep = (index: number, updatedStep: Step) => {
    const nextSteps = steps.map((step, currentIndex) =>
      currentIndex === index ? updatedStep : step,
    );
    onChange(nextSteps);
  };

  const addStep = () => {
    onChange([
      ...steps,
      {
        id: nextStepId(),
        name: `Step ${steps.length + 1}`,
        durationMin: 1,
        operatorInvolvement: "NONE",
        color: DEFAULT_STEP_COLOR,
      },
    ]);
  };

  const deleteStep = (index: number) => {
    onChange(steps.filter((_, currentIndex) => currentIndex !== index));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= steps.length) {
      return;
    }

    const nextSteps = [...steps];
    const [movedStep] = nextSteps.splice(index, 1);
    nextSteps.splice(nextIndex, 0, movedStep);
    onChange(nextSteps);
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
            <th>Color</th>
            <th>Actions</th>
            <th>Validation</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step, index) => {
            const errors = stepErrors[index] ?? [];

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
                  <div className="step-color-cell">
                    <input
                      aria-label={`Color ${index + 1}`}
                      type="color"
                      value={normalizeStepColor(step.color)}
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
          })}
        </tbody>
      </table>
      <div className="template-actions">
        <button type="button" onClick={addStep}>
          Add step
        </button>
      </div>
    </section>
  );
}

export default TemplateEditor;
