import { useRef, useState, type ChangeEvent } from "react";
import type { PlanSettings, Run, Step, StepGroup } from "../../domain/types";
import { deserializeScenarioData, serializeScenarioData } from "../../storage/schema";
import { buildScenarioFromTestStandHtml } from "../../storage/teststandHtml";

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

function readFileAsText(file: File): Promise<string> {
  const fileWithText = file as File & { text?: () => Promise<string> };
  if (typeof fileWithText.text === "function") {
    return fileWithText.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(new Error("Could not read selected file."));
    };
    reader.readAsText(file);
  });
}

type ImportFormat = "json" | "teststand_html" | "unknown";

function detectImportFormat(fileName: string, input: string): ImportFormat {
  const normalizedName = fileName.toLowerCase();
  if (normalizedName.endsWith(".json")) {
    return "json";
  }
  if (normalizedName.endsWith(".html") || normalizedName.endsWith(".htm")) {
    return "teststand_html";
  }

  const trimmed = input.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "json";
  }
  if (/<\s*html[\s>]/i.test(input) || /<b>\s*sequence:/i.test(input)) {
    return "teststand_html";
  }
  return "unknown";
}

function ImportExportPanel({ template, stepGroups, runs, settings, onImport }: ImportExportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  const handleExport = () => {
    try {
      const scenarioText = serializeScenarioData({ template, stepGroups, runs, settings });
      const fileName = `scenario-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.json`;
      const link = document.createElement("a");
      link.download = fileName;
      if (typeof URL.createObjectURL === "function") {
        const blob = new Blob([scenarioText], { type: "application/json" });
        const blobUrl = URL.createObjectURL(blob);
        link.href = blobUrl;
        link.click();
        if (typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(blobUrl);
        }
      } else {
        link.href = `data:application/json;charset=utf-8,${encodeURIComponent(scenarioText)}`;
        link.click();
      }
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
      const scenarioText = await readFileAsText(file);
      const format = detectImportFormat(file.name, scenarioText);

      if (format === "json") {
        const parsed = deserializeScenarioData(scenarioText);
        onImport({
          template: parsed.template,
          stepGroups: parsed.stepGroups,
          runs: parsed.runs,
          settings: parsed.settings,
        });
        setStatus(`Scenario imported from ${file.name}.`);
      } else if (format === "teststand_html") {
        const imported = buildScenarioFromTestStandHtml(scenarioText, {
          defaultDurationMin: 10,
          defaultOperatorInvolvement: "NONE",
        });
        onImport({
          template: imported.template,
          stepGroups: imported.stepGroups,
          runs,
          settings,
        });
        setStatus(
          `Imported TestStand HTML from ${file.name} (${imported.stepGroups.length} sequences, ${imported.template.length} steps).`,
        );
      } else {
        throw new Error("Unsupported import format. Please import a scenario JSON file or TestStand HTML export.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <section className="portability-panel">
      <h2>Import / Export Scenario</h2>
      <div className="portability-actions">
        <button
          aria-label="Export scenario"
          className="icon-button"
          title="Export scenario"
          type="button"
          onClick={handleExport}
        >
          <span aria-hidden="true" className="icon-glyph">
            ⤴
          </span>
        </button>
        <button
          aria-label="Import scenario"
          className="icon-button"
          title="Import scenario"
          type="button"
          onClick={handleImportSelect}
        >
          <span aria-hidden="true" className="icon-glyph">
            ⤵
          </span>
        </button>
      </div>
      <label className="file-input-label">
        Scenario import file
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json,text/html,.html,.htm,text/plain"
          aria-label="Scenario import file"
          data-testid="scenario-file-input"
          onChange={handleImportFile}
        />
      </label>
      <p className="portability-status" data-testid="scenario-status">
        {status}
      </p>
    </section>
  );
}

export default ImportExportPanel;
