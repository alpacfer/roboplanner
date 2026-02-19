import type { SimulationMetrics } from "../../domain/types";

interface MetricsPanelProps {
  metrics: SimulationMetrics | null;
}

function formatUtilization(value: number): string {
  return value.toFixed(2);
}

function MetricsPanel({ metrics }: MetricsPanelProps) {
  const makespan = metrics?.makespan ?? 0;
  const operatorBusyMin = metrics?.operatorBusyMin ?? 0;
  const operatorUtilization = metrics?.operatorUtilization ?? 0;
  const totalWaitingMin = metrics?.totalWaitingMin ?? 0;

  return (
    <section className="metrics-panel">
      <h2>Metrics</h2>
      <dl className="metrics-grid">
        <div className="metric-tile">
          <dt>Makespan</dt>
          <dd data-testid="metric-makespan">{makespan}</dd>
        </div>
        <div className="metric-tile">
          <dt>Operator Busy Time</dt>
          <dd data-testid="metric-operator-busy">{operatorBusyMin}</dd>
        </div>
        <div className="metric-tile">
          <dt>Operator Utilization</dt>
          <dd data-testid="metric-operator-utilization">{formatUtilization(operatorUtilization)}</dd>
        </div>
        <div className="metric-tile">
          <dt>Total Waiting Time</dt>
          <dd data-testid="metric-total-waiting">{totalWaitingMin}</dd>
        </div>
      </dl>
    </section>
  );
}

export default MetricsPanel;
