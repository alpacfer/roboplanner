import { useMemo, useState } from "react";
import { validateRun } from "../../domain/validation";
import type { Run } from "../../domain/types";
import ConfirmDialog from "../common/ConfirmDialog";
import IntegerInput from "../common/IntegerInput";

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
  const [pendingDeleteRunId, setPendingDeleteRunId] = useState<string | null>(null);

  const pendingRun = useMemo(() => runs.find((run) => run.id === pendingDeleteRunId) ?? null, [pendingDeleteRunId, runs]);

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

  const confirmDeleteRun = () => {
    if (!pendingDeleteRunId) {
      return;
    }

    onChange(runs.filter((run) => run.id !== pendingDeleteRunId));
    setPendingDeleteRunId(null);
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
                    <IntegerInput
                      ariaLabel={`Run start ${index + 1}`}
                      min={0}
                      value={run.startMin}
                      onCommit={(startMinValue) => {
                        updateRun(index, {
                          ...run,
                          startMin: startMinValue,
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
                        onClick={() => setPendingDeleteRunId(run.id)}
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

      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel="Delete run"
        isOpen={Boolean(pendingDeleteRunId)}
        message={`Delete ${pendingRun?.label ?? "this run"}?`}
        title="Delete run?"
        onCancel={() => setPendingDeleteRunId(null)}
        onConfirm={confirmDeleteRun}
      />
    </section>
  );
}

export default RunsEditor;
