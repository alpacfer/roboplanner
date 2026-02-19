import { validateRun } from "../../domain/validation";
import type { Run } from "../../domain/types";

interface RunsEditorProps {
  runs: Run[];
  templateId: string;
  onChange: (runs: Run[]) => void;
}

function nextRunId(runs: Run[]): string {
  const maxExisting = runs.reduce((maxId, run) => {
    const match = /^run-(\d+)$/.exec(run.id);
    if (!match) {
      return maxId;
    }
    return Math.max(maxId, Number.parseInt(match[1], 10));
  }, 0);
  return `run-${maxExisting + 1}`;
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
        id: nextRunId(runs),
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
    <section className="runs-editor">
      <div className="runs-editor-header">
        <h2>Runs</h2>
        <button aria-label="Add run" className="icon-button" title="Add run" type="button" onClick={addRun}>
          <span aria-hidden="true" className="icon-glyph">
            +
          </span>
        </button>
      </div>
      <div className="table-wrap">
        <table className="runs-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Start (min)</th>
              <th>Actions</th>
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
                    <div className="run-actions-cell">
                      <button
                        aria-label={`Delete run ${index + 1}`}
                        className="danger-ghost-button icon-button"
                        disabled={runs.length <= 1}
                        title={`Delete run ${run.label}`}
                        type="button"
                        onClick={() => deleteRun(index)}
                      >
                        <span aria-hidden="true" className="icon-glyph">
                          ×
                        </span>
                      </button>
                    {errors.length > 0 ? (
                      <ul className="inline-errors run-inline-errors">
                        {errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default RunsEditor;
