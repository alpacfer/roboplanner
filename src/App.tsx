import { createInitialPlans } from "./state/planState";

function App() {
  const plans = createInitialPlans();
  const currentPlan = plans[0];

  return (
    <main>
      <h1>Test Timeline Planner</h1>
      <p>Current plan: {currentPlan.name}</p>
    </main>
  );
}

export default App;
