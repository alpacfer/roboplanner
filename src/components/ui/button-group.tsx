import * as React from "react"
import { cva } from "class-variance-authority"
import { Separator as SeparatorPrimitive, Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonGroupVariants = cva(
  "inline-flex w-fit items-stretch",
  {
    variants: {
      orientation: {
        horizontal:
          "[&>[data-slot='button']:not(:first-child)]:rounded-l-none [&>[data-slot='button']:not(:last-child)]:rounded-r-none [&>[data-slot='button']:not(:first-child)]:border-l-0",
        vertical:
          "flex-col [&>[data-slot='button']:not(:first-child)]:rounded-t-none [&>[data-slot='button']:not(:last-child)]:rounded-b-none [&>[data-slot='button']:not(:first-child)]:border-t-0",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  }
)

function ButtonGroup({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical"
}) {
  return (
    <div
      data-orientation={orientation}
      data-slot="button-group"
      role="group"
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  )
}

function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-orientation={orientation}
      data-slot="button-group-separator"
      decorative
      orientation={orientation}
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className
      )}
      {...props}
    />
  )
}

function ButtonGroupText({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="button-group-text"
      className={cn(
        "inline-flex items-center rounded-md border bg-muted px-3 text-sm font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText }
