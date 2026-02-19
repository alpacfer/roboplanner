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

  const handleCopy = async () => {
    if (!scenarioText.trim()) {
      setStatus("Nothing to copy.");
      return;
    }

    if (!navigator.clipboard) {
      setStatus("Clipboard unavailable.");
      return;
    }

    try {
      await navigator.clipboard.writeText(scenarioText);
      setStatus("Scenario JSON copied.");
    } catch {
      setStatus("Clipboard unavailable.");
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
        <button type="button" onClick={handleCopy}>
          Copy JSON
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
