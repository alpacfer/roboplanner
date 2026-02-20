import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MetricsPanel from "./MetricsPanel";

describe("MetricsPanel", () => {
  it("renders metrics with explicit units and percent", () => {
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

    expect(screen.getByTestId("metric-makespan").textContent).toBe("50 min");
    expect(screen.getByTestId("metric-operator-busy").textContent).toBe("40 min");
    expect(screen.getByTestId("metric-operator-utilization").textContent).toBe("80.0%");
    expect(screen.getByTestId("metric-total-waiting").textContent).toBe("10 min");
  });

  it("formats long durations as hours and minutes", () => {
    render(
      <MetricsPanel
        metrics={{
          makespan: 125,
          operatorBusyMin: 60,
          operatorUtilization: 0.5,
          totalWaitingMin: 181,
        }}
      />,
    );

    expect(screen.getByTestId("metric-makespan").textContent).toBe("2 h 5 min");
    expect(screen.getByTestId("metric-operator-busy").textContent).toBe("1 h 0 min");
    expect(screen.getByTestId("metric-total-waiting").textContent).toBe("3 h 1 min");
  });
});
