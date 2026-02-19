import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MetricsPanel from "./MetricsPanel";

describe("MetricsPanel", () => {
  it("renders the provided metrics values", () => {
    render(
      <MetricsPanel
        metrics={{
          makespan: 50,
          operatorBusyMin: 40,
          operatorUtilization: 0.8,
          totalWaitingMin: 10,
        }}
      />,
    );

    expect(screen.getByTestId("metric-makespan").textContent).toBe("50");
    expect(screen.getByTestId("metric-operator-busy").textContent).toBe("40");
    expect(screen.getByTestId("metric-operator-utilization").textContent).toBe("0.80");
    expect(screen.getByTestId("metric-total-waiting").textContent).toBe("10");
  });
});
