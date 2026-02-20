import { useRef, useState, type ChangeEvent } from "react";
import type { PlanSettings, Run, Step, StepGroup } from "../../domain/types";
import { exportScenarioAsDownload, importScenarioFromFile } from "./portability";

interface ImportExportPanelProps {
  template: Step[];
  stepGroups: StepGroup[];
  runs: Run[];
  settings: PlanSettings;
  onImport: (payload: {
    template: Step[];
    stepGroups: StepGroup[];
    runs: Run[];
    settings: PlanSettings;
  }) => void;
}

function ImportExportPanel({ template, stepGroups, runs, settings, onImport }: ImportExportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  const handleExport = () => {
    try {
      const fileName = exportScenarioAsDownload({ template, stepGroups, runs, settings });
      setStatus(`Scenario downloaded (${fileName}).`);
    } catch {
      setStatus("Export failed.");
    }
  };

  const handleImportSelect = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setStatus("No file selected.");
      return;
    }
    try {
      const imported = await importScenarioFromFile({
        file,
        runs,
        settings,
      });
      onImport({
        template: imported.template,
        stepGroups: imported.stepGroups,
        runs: imported.runs,
        settings: imported.settings,
      });
      setStatus(imported.statusMessage);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <section className="portability-panel">
      <h2>Import / Export Scenario</h2>
      <div className="portability-layout">
        <div className="portability-actions">
          <button
            aria-label="Export scenario"
            className="portability-action-button"
            title="Export scenario"
            type="button"
            onClick={handleExport}
          >
            <span aria-hidden="true" className="icon-glyph">
              ⤴
            </span>
            <span>Export</span>
          </button>
          <button
            aria-label="Import scenario"
            className="portability-action-button"
            title="Import scenario"
            type="button"
            onClick={handleImportSelect}
          >
            <span aria-hidden="true" className="icon-glyph">
              ⤵
            </span>
            <span>Import</span>
          </button>
        </div>
        <div className="portability-info">
          <p>Import supports scenario JSON and TestStand HTML exports.</p>
          <p className="portability-status" data-testid="scenario-status">
            {status}
          </p>
        </div>
      </div>
      <input
        ref={fileInputRef}
        className="portability-file-input"
        type="file"
        accept="application/json,.json,text/html,.html,.htm,text/plain"
        aria-label="Scenario import file"
        data-testid="scenario-file-input"
        onChange={handleImportFile}
      />
    </section>
  );
}

export default ImportExportPanel;
