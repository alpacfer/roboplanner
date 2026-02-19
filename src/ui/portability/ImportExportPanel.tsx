import { useState } from "react";
import type { PlanSettings, Run, Step } from "../../domain/types";
import { deserializeScenarioData, serializeScenarioData } from "../../storage/schema";

interface ImportExportPanelProps {
  template: Step[];
  runs: Run[];
  settings: PlanSettings;
  onImport: (payload: { template: Step[]; runs: Run[]; settings: PlanSettings }) => void;
}

function ImportExportPanel({ template, runs, settings, onImport }: ImportExportPanelProps) {
  const [scenarioText, setScenarioText] = useState("");
  const [status, setStatus] = useState("");

  const handleExport = () => {
    setScenarioText(serializeScenarioData({ template, runs, settings }));
    setStatus("Scenario exported.");
  };

  const handleImport = () => {
    try {
      const parsed = deserializeScenarioData(scenarioText);
      onImport({
        template: parsed.template,
        runs: parsed.runs,
        settings: parsed.settings,
      });
      setStatus("Scenario imported.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    }
  };

  return (
    <section className="portability-panel">
      <h2>Import / Export Scenario</h2>
      <div className="portability-actions">
        <button type="button" onClick={handleExport}>
          Export scenario
        </button>
        <button type="button" onClick={handleImport}>
          Import scenario
        </button>
      </div>
      <label htmlFor="scenario-json">Scenario JSON</label>
      <textarea
        id="scenario-json"
        aria-label="Scenario JSON"
        data-testid="scenario-json"
        rows={14}
        value={scenarioText}
        onChange={(event) => setScenarioText(event.target.value)}
      />
      <p data-testid="scenario-status">{status}</p>
    </section>
  );
}

export default ImportExportPanel;
