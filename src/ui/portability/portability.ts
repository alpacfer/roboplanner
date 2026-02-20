import type { PlanSettings, Run, Step, StepGroup } from "../../domain/types";
import { deserializeScenarioData, serializeScenarioData } from "../../storage/schema";
import { buildScenarioFromTestStandHtml } from "../../storage/teststandHtml";

export type ImportFormat = "json" | "teststand_html" | "unknown";

export function readFileAsText(file: File): Promise<string> {
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

export function detectImportFormat(fileName: string, input: string): ImportFormat {
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

export function exportScenarioAsDownload(payload: {
  template: Step[];
  stepGroups: StepGroup[];
  runs: Run[];
  settings: PlanSettings;
}): string {
  const scenarioText = serializeScenarioData(payload);
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

  return fileName;
}

export async function importScenarioFromFile(input: {
  file: File;
  runs: Run[];
  settings: PlanSettings;
}): Promise<{
  template: Step[];
  stepGroups: StepGroup[];
  runs: Run[];
  settings: PlanSettings;
  statusMessage: string;
}> {
  const scenarioText = await readFileAsText(input.file);
  const format = detectImportFormat(input.file.name, scenarioText);

  if (format === "json") {
    const parsed = deserializeScenarioData(scenarioText);
    return {
      template: parsed.template,
      stepGroups: parsed.stepGroups,
      runs: parsed.runs,
      settings: parsed.settings,
      statusMessage: `Scenario imported from ${input.file.name}.`,
    };
  }

  if (format === "teststand_html") {
    const imported = buildScenarioFromTestStandHtml(scenarioText, {
      defaultDurationMin: 10,
      defaultOperatorInvolvement: "NONE",
    });

    return {
      template: imported.template,
      stepGroups: imported.stepGroups,
      runs: input.runs,
      settings: input.settings,
      statusMessage: `Imported TestStand HTML from ${input.file.name} (${imported.stepGroups.length} sequences, ${imported.template.length} steps).`,
    };
  }

  throw new Error("Unsupported import format. Please import a scenario JSON file or TestStand HTML export.");
}
