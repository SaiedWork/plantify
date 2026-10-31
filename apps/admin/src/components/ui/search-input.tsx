"use client"

import { SearchIcon, XIcon } from "lucide-react"
import { useRef } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type SearchInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value: string
  onValueChange: (value: string) => void
}

/** Text input with a leading magnifier and, once something is typed, a clear button. */
function SearchInput({ value, onValueChange, className, ...props }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className={cn("relative w-full", className)}>
      <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input {...props} ref={inputRef} value={value} onChange={(e) => onValueChange(e.target.value)} className="px-8" />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onValueChange("")
            inputRef.current?.focus()
          }}
          className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  )
}

export { SearchInput }
