import { useMemo, useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
        <h2>Add Tests in Parallel</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Add test"
              className="runs-add-button"
              type="button"
              variant="outline"
              onClick={addRun}
            >
              <PlusIcon aria-hidden="true" />
              <span>Test</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add test</TooltipContent>
        </Tooltip>
      </div>
      <div className="table-wrap">
        <Table className="runs-table">
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Start (min)</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run, index) => {
              const errors = validateRun(run);

              return (
                <TableRow data-testid="run-row" key={run.id}>
                  <TableCell>
                    <Input
                      aria-label={`Run label ${index + 1}`}
                      className="runs-input"
                      type="text"
                      value={run.label}
                      onChange={(event) => {
                        updateRun(index, { ...run, label: event.target.value });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <IntegerInput
                      ariaLabel={`Run start ${index + 1}`}
                      className="runs-input runs-input-numeric"
                      min={0}
                      value={run.startMin}
                      onCommit={(startMinValue) => {
                        updateRun(index, {
                          ...run,
                          startMin: startMinValue,
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="run-actions-cell">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="run-action-tooltip-trigger">
                            <Button
                              aria-label={`Delete run ${index + 1}`}
                              className="delete-action-button icon-button"
                              disabled={runs.length <= 1}
                              size="icon"
                              type="button"
                              variant="outline"
                              onClick={() => setPendingDeleteRunId(run.id)}
                            >
                              <Trash2Icon aria-hidden="true" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right">{`Delete run ${run.label}`}</TooltipContent>
                      </Tooltip>
                      {errors.length > 0 ? (
                        <ul className="inline-errors run-inline-errors">
                          {errors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
