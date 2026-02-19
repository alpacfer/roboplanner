import { DEFAULT_STEP_COLOR, normalizeStepColor } from "../../domain/colors";
import { validateStep } from "../../domain/validation";
import type { Step } from "../../domain/types";

interface TemplateEditorProps {
  steps: Step[];
  onChange: (steps: Step[]) => void;
}

const STEP_COLOR_PRESETS = [
  "#4f7cff",
  "#00b894",
  "#ff7675",
  "#f39c12",
  "#8e44ad",
  "#16a085",
  "#e84393",
  "#2d3436",
  "#0984e3",
  "#e17055",
];

let stepIdCounter = 1000;

function nextStepId(): string {
  stepIdCounter += 1;
  return `step-${stepIdCounter}`;
}

function TemplateEditor({ steps, onChange }: TemplateEditorProps) {
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
        requiresOperator: false,
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
      <button type="button" onClick={addStep}>
        Add step
      </button>
      <table className="template-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Duration (min)</th>
            <th>Operator</th>
            <th>Color</th>
            <th>Actions</th>
            <th>Validation</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step, index) => {
            const errors = validateStep(step);

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
                  <input
                    aria-label={`Requires operator ${index + 1}`}
                    checked={step.requiresOperator}
                    type="checkbox"
                    onChange={(event) => {
                      updateStep(index, {
                        ...step,
                        requiresOperator: event.target.checked,
                      });
                    }}
                  />
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
    </section>
  );
}

export default TemplateEditor;
