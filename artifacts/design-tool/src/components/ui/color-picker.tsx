import * as React from "react"
import { HexColorPicker } from "react-colorful"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover"

interface ColorPickerProps {
  value?: string
  color?: string
  label?: string
  onChange?: (color: string) => void
  className?: string
}

export function ColorPicker({ value, color, label, onChange, className }: ColorPickerProps) {
  const resolvedValue = value ?? color ?? "#000000";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "h-8 w-8 rounded-md border border-input shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
          style={{ backgroundColor: resolvedValue }}
          aria-label={label || "Pick color"}
        />
      </PopoverTrigger>
      <PopoverContent className="z-50 p-2 bg-popover border border-border rounded-md shadow-md">
        <HexColorPicker color={resolvedValue} onChange={onChange} />
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">{resolvedValue}</span>
        </div>
      </PopoverContent>
    </Popover>
  )
}
