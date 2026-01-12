import { useState } from "react";
import { Search, Command } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground bg-muted/50 border rounded-lg hover:bg-muted transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Search NGOs, work items, documents...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono bg-background border rounded">
          <Command className="w-3 h-3" />K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search everything..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick Actions">
            <CommandItem>
              <span>Create new NGO</span>
            </CommandItem>
            <CommandItem>
              <span>Create work item</span>
            </CommandItem>
            <CommandItem>
              <span>Upload document</span>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Recent NGOs">
            <CommandItem>
              <span>Detroit Community Foundation</span>
            </CommandItem>
            <CommandItem>
              <span>Chicago Youth Initiative</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
