import { validateRun } from "../../domain/validation";
import type { Run } from "../../domain/types";

interface RunsEditorProps {
  runs: Run[];
  templateId: string;
  onChange: (runs: Run[]) => void;
}

let runIdCounter = 1000;

function nextRunId(): string {
  runIdCounter += 1;
  return `run-${runIdCounter}`;
}

function RunsEditor({ runs, templateId, onChange }: RunsEditorProps) {
  const updateRun = (index: number, updatedRun: Run) => {
    const nextRuns = runs.map((run, currentIndex) => (currentIndex === index ? updatedRun : run));
    onChange(nextRuns);
  };

  const addRun = () => {
    onChange([
      ...runs,
      {
        id: nextRunId(),
        label: `R${runs.length + 1}`,
        startMin: 0,
        templateId,
      },
    ]);
  };

  const deleteRun = (index: number) => {
    onChange(runs.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <section>
      <h2>Runs</h2>
      <button type="button" onClick={addRun}>
        Add run
      </button>
      <table className="runs-table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Start (min)</th>
            <th>Actions</th>
            <th>Validation</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run, index) => {
            const errors = validateRun(run);

            return (
              <tr data-testid="run-row" key={run.id}>
                <td>
                  <input
                    aria-label={`Run label ${index + 1}`}
                    type="text"
                    value={run.label}
                    onChange={(event) => {
                      updateRun(index, { ...run, label: event.target.value });
                    }}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Run start ${index + 1}`}
                    min={0}
                    step={1}
                    type="number"
                    value={run.startMin}
                    onChange={(event) => {
                      const parsedValue = Number.parseInt(event.target.value, 10);
                      updateRun(index, {
                        ...run,
                        startMin: Number.isNaN(parsedValue) ? 0 : parsedValue,
                      });
                    }}
                  />
                </td>
                <td>
                  <button
                    aria-label={`Delete run ${index + 1}`}
                    disabled={runs.length <= 1}
                    type="button"
                    onClick={() => deleteRun(index)}
                  >
                    Delete
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
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export default RunsEditor;
