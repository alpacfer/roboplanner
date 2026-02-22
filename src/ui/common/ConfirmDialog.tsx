import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
          <DialogClose asChild>
            <Button aria-label={`Cancel ${title}`} type="button" variant="outline">
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button aria-label={`Confirm ${title}`} type="button" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmDialog;
