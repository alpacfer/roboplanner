import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { STEP_COLOR_PRESETS } from "../domain/colors";
import { buildScenarioFromTestStandHtml, parseTestStandHtml } from "./teststandHtml";

function readFixture(name: string): string {
  return readFileSync(resolve(process.cwd(), "import_example", name), "utf8");
}

describe("teststandHtml parser", () => {
  it("parses sequence and step order from TestStand HTML fixture", () => {
    const parsed = parseTestStandHtml(readFixture("setup_documentation.html"));

    expect(parsed.sequences).toHaveLength(15);
    expect(parsed.totalSteps).toBe(156);

    expect(parsed.sequences[0]?.name).toBe("MainSequence");
    expect(parsed.sequences[1]?.name).toBe("# BLE CONNECTION");
    expect(parsed.sequences[14]?.name).toBe("Display results");
    expect(parsed.sequences[0]?.steps.slice(0, 4)).toEqual([
      "Add FACTS information",
      "Prepare test",
      "Debug setup",
      "Resume setup",
    ]);
    expect(parsed.sequences[1]?.steps[0]).toBe("TODO - Scan/enter PCB SN number");
  });

  it("decodes entities and normalizes whitespace", () => {
    const parsed = parseTestStandHtml(
      `
      <B>Sequence:  A&nbsp;&amp;&nbsp;B  </B>
      <B>Step:  Call &lt;Current&nbsp;File&gt;  </B>
      <B>Step:  Item&#35;1 &#x26; more </B>
      `,
    );

    expect(parsed.sequences).toEqual([
      {
        name: "A & B",
        steps: ["Call <Current File>", "Item#1 & more"],
      },
    ]);
    expect(parsed.totalSteps).toBe(2);
  });

  it("keeps unknown or malformed entities unchanged and applies fallback names", () => {
    const parsed = parseTestStandHtml(
      `
      <B>Sequence:   </B>
      <B>Step: &unknown;</B>
      <B>Step: &#xZZ;</B>
      <B>Step: &#bad;</B>
      `,
    );

    expect(parsed.sequences[0]?.name).toBe("Sequence 1");
    expect(parsed.sequences[0]?.steps).toEqual(["&unknown;", "&#xZZ;", "&#bad;"]);
  });

  it("throws clear errors when sequences or steps are missing", () => {
    expect(() => parseTestStandHtml("<B>Step: Lone step</B>")).toThrow(
      "TestStand HTML does not contain any sequences.",
    );
    expect(() => parseTestStandHtml("<B>Sequence: Only sequence</B>")).toThrow(
      "TestStand HTML does not contain any steps.",
    );
  });

  it("builds grouped planner template with defaults and preserves order", () => {
    const built = buildScenarioFromTestStandHtml(readFixture("setup_documentation.html"), {
      defaultDurationMin: 10,
      defaultOperatorInvolvement: "NONE",
    });

    expect(built.stepGroups).toHaveLength(15);
    expect(built.template).toHaveLength(156);

    expect(built.stepGroups[0]).toEqual({
      id: "group-1",
      name: "MainSequence",
      color: STEP_COLOR_PRESETS[0],
    });
    expect(built.stepGroups[10]).toEqual({
      id: "group-11",
      name: "# TEST",
      color: STEP_COLOR_PRESETS[0],
    });

    expect(built.template[0]).toMatchObject({
      id: "step-1",
      name: "Add FACTS information",
      durationMin: 10,
      operatorInvolvement: "NONE",
      groupId: "group-1",
    });
    expect(built.template[155]).toMatchObject({
      id: "step-156",
      name: "End",
      durationMin: 10,
      operatorInvolvement: "NONE",
      groupId: "group-15",
    });
  });

  it("falls back to default duration and operator involvement when options are invalid or omitted", () => {
    const builtWithInvalidDuration = buildScenarioFromTestStandHtml(
      "<B>Sequence: Main</B><B>Step: Prep</B>",
      {
        defaultDurationMin: 0,
      },
    );
    expect(builtWithInvalidDuration.template[0]?.durationMin).toBe(10);
    expect(builtWithInvalidDuration.template[0]?.operatorInvolvement).toBe("NONE");

    const builtWithFractionalDuration = buildScenarioFromTestStandHtml(
      "<B>Sequence: Main</B><B>Step: Prep</B>",
      {
        defaultDurationMin: 2.5,
        defaultOperatorInvolvement: "START_END",
      },
    );
    expect(builtWithFractionalDuration.template[0]?.durationMin).toBe(10);
    expect(builtWithFractionalDuration.template[0]?.operatorInvolvement).toBe("START_END");
  });
});
