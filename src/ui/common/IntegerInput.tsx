import { useEffect, useState } from "react";

interface IntegerInputProps {
  value: number;
  min?: number;
  max?: number;
  className?: string;
  ariaLabel: string;
  onCommit: (value: number) => void;
}

function clamp(value: number, min?: number, max?: number): number {
  if (typeof min === "number" && value < min) {
    return min;
  }
  if (typeof max === "number" && value > max) {
    return max;
  }
  return value;
}

function normalizeIntegerString(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) {
    return "";
  }
  return String(Number.parseInt(digitsOnly, 10));
}

function IntegerInput({ value, min, max, className, ariaLabel, onCommit }: IntegerInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(String(value));
    }
  }, [isFocused, value]);

  const commit = (rawValue: string) => {
    const normalized = normalizeIntegerString(rawValue);
    const parsedValue = normalized ? Number.parseInt(normalized, 10) : min ?? 0;
    const bounded = clamp(Number.isNaN(parsedValue) ? min ?? 0 : parsedValue, min, max);
    onCommit(bounded);
    setDraft(String(bounded));
  };

  return (
    <input
      aria-label={ariaLabel}
      className={className}
      inputMode="numeric"
      pattern="[0-9]*"
      type="text"
      value={draft}
      onBlur={(event) => {
        setIsFocused(false);
        commit(event.target.value);
      }}
      onChange={(event) => {
        setDraft(event.target.value.replace(/\D/g, ""));
      }}
      onFocus={() => setIsFocused(true)}
      onKeyDown={(event) => {
        if ([".", "e", "E", "+", "-", ","].includes(event.key)) {
          event.preventDefault();
        }
      }}
    />
  );
}

export default IntegerInput;
