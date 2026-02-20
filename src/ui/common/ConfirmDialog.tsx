import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <DialogContent aria-label={title} className="confirm-modal" data-testid={testId} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle asChild>
            <h3>{title}</h3>
          </DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
          <p>{message}</p>
        </DialogDescription>
        <DialogFooter className="confirm-modal-actions">
          <button aria-label={`Cancel ${title}`} type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button aria-label={`Confirm ${title}`} className="danger-ghost-button" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmDialog;
