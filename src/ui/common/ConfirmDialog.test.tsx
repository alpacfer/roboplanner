import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConfirmDialog from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders nothing when closed", () => {
    render(
      <ConfirmDialog
        confirmLabel="Delete"
        isOpen={false}
        message="Are you sure?"
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Delete run?"
      />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders a dialog with accessible name from title", () => {
    render(
      <ConfirmDialog
        confirmLabel="Delete"
        isOpen
        message="Are you sure?"
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Delete run?"
      />,
    );

    expect(screen.getByRole("dialog", { name: "Delete run?" })).toBeTruthy();
  });

  it("calls onConfirm when confirm is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        confirmLabel="Delete"
        isOpen
        message="Are you sure?"
        onCancel={() => {}}
        onConfirm={onConfirm}
        title="Delete run?"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Confirm Delete run?" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        confirmLabel="Delete"
        isOpen
        message="Are you sure?"
        onCancel={onCancel}
        onConfirm={() => {}}
        title="Delete run?"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel Delete run?" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when escape closes dialog", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        confirmLabel="Delete"
        isOpen
        message="Are you sure?"
        onCancel={onCancel}
        onConfirm={() => {}}
        title="Delete run?"
      />,
    );

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
