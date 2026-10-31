"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { cn } from "cn"

export type SelectOption = { value: string; label: React.ReactNode }

type SelectProps = {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  id?: string
  disabled?: boolean
  title?: string
  className?: string
  "aria-label"?: string
}

/** shadcn-styled select menu (Base UI) with a native-select-like API. */
function Select({ value, onValueChange, options, id, disabled, title, className, "aria-label": ariaLabel }: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(v) => onValueChange(v ?? "")}
      items={options}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        title={title}
        aria-label={ariaLabel}
        data-slot="select-trigger"
        className={cn(
          "flex h-8 w-fit min-w-36 items-center justify-between gap-3 rounded-lg border border-input bg-transparent py-1 pr-3 pl-3 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
          className
        )}
      >
        <SelectPrimitive.Value className="truncate" />
        <SelectPrimitive.Icon>
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={4} alignItemWithTrigger={false} className="z-50">
          <SelectPrimitive.Popup
            data-slot="select-content"
            className="max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 transition-[opacity,scale] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
          >
            <SelectPrimitive.List>
              {options.map((o) => (
                <SelectPrimitive.Item
                  key={o.value}
                  value={o.value}
                  className="relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50"
                >
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
                    <CheckIcon className="size-4" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export { Select }
