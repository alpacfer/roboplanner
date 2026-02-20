import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import IntegerInput from "./IntegerInput";

function IntegerInputHarness({
  initialValue,
  min,
  max,
  ariaLabel,
  onCommitSpy,
}: {
  initialValue: number;
  min?: number;
  max?: number;
  ariaLabel: string;
  onCommitSpy?: (value: number) => void;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <IntegerInput
      ariaLabel={ariaLabel}
      max={max}
      min={min}
      value={value}
      onCommit={(nextValue) => {
        setValue(nextValue);
        onCommitSpy?.(nextValue);
      }}
    />
  );
}

describe("IntegerInput", () => {
  it("keeps draft while typing and commits on blur", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(
      <IntegerInputHarness ariaLabel="Count" initialValue={0} onCommitSpy={onCommit} />,
    );
    const input = screen.getByLabelText("Count");

    await user.clear(input);
    await user.type(input, "0012");
    expect((input as HTMLInputElement).value).toBe("0012");
    expect(onCommit).not.toHaveBeenCalled();

    await user.tab();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenLastCalledWith(12);
    expect((input as HTMLInputElement).value).toBe("12");
  });

  it("clamps committed value to min and max", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(
      <IntegerInputHarness
        ariaLabel="Bounded count"
        initialValue={10}
        max={20}
        min={5}
        onCommitSpy={onCommit}
      />,
    );
    const input = screen.getByLabelText("Bounded count");

    await user.clear(input);
    await user.type(input, "999");
    await user.tab();
    expect(onCommit).toHaveBeenLastCalledWith(20);

    await user.clear(input);
    await user.type(input, "1");
    await user.tab();
    expect(onCommit).toHaveBeenLastCalledWith(5);
  });

  it("commits fallback value for invalid input", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(
      <IntegerInputHarness ariaLabel="Fallback count" initialValue={7} min={3} onCommitSpy={onCommit} />,
    );
    const input = screen.getByLabelText("Fallback count");

    await user.clear(input);
    await user.type(input, "abc");
    expect((input as HTMLInputElement).value).toBe("");

    await user.tab();
    expect(onCommit).toHaveBeenLastCalledWith(3);
    expect((input as HTMLInputElement).value).toBe("3");
  });
});
