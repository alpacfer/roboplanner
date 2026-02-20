interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
}

function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  testId,
}: ConfirmDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="confirm-modal-overlay" data-testid={testId}>
      <div aria-label={title} aria-modal="true" className="confirm-modal" role="dialog">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-modal-actions">
          <button aria-label={`Cancel ${title}`} type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button aria-label={`Confirm ${title}`} className="danger-ghost-button" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
