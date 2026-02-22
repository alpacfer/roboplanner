import { useMemo, useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SharedResource } from "@/domain/types";
import ConfirmDialog from "@/ui/common/ConfirmDialog";
import IntegerInput from "@/ui/common/IntegerInput";

interface SharedResourcesEditorProps {
  resources: SharedResource[];
  onChange: (resources: SharedResource[]) => void;
}

function nextResourceId(resources: SharedResource[]): string {
  const maxExisting = resources.reduce((maxId, resource) => {
    const match = /^resource-(\d+)$/.exec(resource.id);
    if (!match) {
      return maxId;
    }
    return Math.max(maxId, Number.parseInt(match[1], 10));
  }, 0);

  return `resource-${maxExisting + 1}`;
}

function SharedResourcesEditor({ resources, onChange }: SharedResourcesEditorProps) {
  const [pendingDeleteResourceId, setPendingDeleteResourceId] = useState<string | null>(null);

  const pendingResource = useMemo(
    () => resources.find((resource) => resource.id === pendingDeleteResourceId) ?? null,
    [pendingDeleteResourceId, resources],
  );

  const updateResource = (index: number, updatedResource: SharedResource) => {
    const nextResources = resources.map((resource, currentIndex) =>
      currentIndex === index ? updatedResource : resource,
    );
    onChange(nextResources);
  };

  const addResource = () => {
    onChange([
      ...resources,
      {
        id: nextResourceId(resources),
        name: `Resource ${resources.length + 1}`,
        quantity: 1,
      },
    ]);
  };

  const confirmDeleteResource = () => {
    if (!pendingDeleteResourceId) {
      return;
    }

    onChange(resources.filter((resource) => resource.id !== pendingDeleteResourceId));
    setPendingDeleteResourceId(null);
  };

  return (
    <section className="shared-resources-editor">
      <div className="shared-resources-header">
        <h2>Shared Resources</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Add shared resource"
              className="shared-resources-add-button"
              type="button"
              variant="outline"
              onClick={addResource}
            >
              <PlusIcon aria-hidden="true" />
              <span>Resource</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add shared resource</TooltipContent>
        </Tooltip>
      </div>
      <div className="table-wrap">
        <Table className="shared-resources-table">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Count</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((resource, index) => (
              <TableRow data-testid="resource-row" key={resource.id}>
                <TableCell>
                  <Input
                    aria-label={`Shared resource name ${index + 1}`}
                    className="shared-resource-name-input"
                    type="text"
                    value={resource.name}
                    onChange={(event) => {
                      updateResource(index, {
                        ...resource,
                        name: event.target.value,
                      });
                    }}
                  />
                </TableCell>
                <TableCell>
                  <IntegerInput
                    ariaLabel={`Shared resource count ${index + 1}`}
                    className="shared-resource-qty-input"
                    min={1}
                    value={resource.quantity}
                    onCommit={(quantity) => {
                      updateResource(index, {
                        ...resource,
                        quantity,
                      });
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div className="shared-resource-actions-cell">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          aria-label={`Delete shared resource ${index + 1}`}
                          className="delete-action-button icon-button"
                          size="icon"
                          type="button"
                          variant="outline"
                          onClick={() => setPendingDeleteResourceId(resource.id)}
                        >
                          <Trash2Icon aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{`Delete ${resource.name}`}</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel="Delete resource"
        isOpen={Boolean(pendingDeleteResourceId)}
        message={`Delete ${pendingResource?.name ?? "this resource"}?`}
        title="Delete shared resource?"
        onCancel={() => setPendingDeleteResourceId(null)}
        onConfirm={confirmDeleteResource}
      />
    </section>
  );
}

export default SharedResourcesEditor;
