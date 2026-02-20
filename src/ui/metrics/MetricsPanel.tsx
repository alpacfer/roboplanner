import type { SimulationMetrics } from "../../domain/types";

interface MetricsPanelProps {
  metrics: SimulationMetrics | null;
}

function formatDurationMinutes(value: number): string {
  const totalMinutes = Math.max(0, Math.round(value));
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} h ${minutes} min`;
  }
  return `${totalMinutes} min`;
}

function formatUtilizationPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
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
          <dd data-testid="metric-makespan">{formatDurationMinutes(makespan)}</dd>
        </div>
        <div className="metric-tile">
          <dt>Operator Busy Time</dt>
          <dd data-testid="metric-operator-busy">{formatDurationMinutes(operatorBusyMin)}</dd>
        </div>
        <div className="metric-tile">
          <dt>Operator Utilization</dt>
          <dd data-testid="metric-operator-utilization">{formatUtilizationPercent(operatorUtilization)}</dd>
        </div>
        <div className="metric-tile">
          <dt>Total Waiting Time</dt>
          <dd data-testid="metric-total-waiting">{formatDurationMinutes(totalWaitingMin)}</dd>
        </div>
      </dl>
    </section>
  );
}

export default MetricsPanel;
