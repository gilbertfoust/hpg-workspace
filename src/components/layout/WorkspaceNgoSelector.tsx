import { useState } from "react";
import { Building2, Check, ChevronsUpDown, Globe2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";
import { cn } from "@/lib/utils";

const formatStatus = (status: string) => status.replace(/_/g, " ");

export function WorkspaceNgoSelector({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { ngos, selectedNgo, selectedNgoId, isLoading, error, selectNgo } = useWorkspaceNgo();
  const selectedName = selectedNgo?.common_name || selectedNgo?.legal_name || "All HPG";

  const chooseNgo = (ngoId: string | null) => {
    selectNgo(ngoId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={`Viewing ${selectedName}. Select an NGO.`}
          title={`Viewing: ${selectedName}`}
          className={cn("h-10 justify-between bg-background", className)}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="animate-spin" />
          ) : selectedNgo ? (
            <Building2 />
          ) : (
            <Globe2 />
          )}
          <span className="hidden min-w-0 flex-1 flex-col items-start text-left xl:flex">
            <span className="text-[10px] font-semibold uppercase leading-none tracking-wide text-muted-foreground">
              Viewing
            </span>
            <span className="mt-1 max-w-full truncate leading-none">{selectedName}</span>
          </span>
          <ChevronsUpDown className="hidden opacity-50 xl:block" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <Command>
          <CommandInput placeholder="Search NGOs..." />
          <CommandList>
            <CommandEmpty>{error ? "NGOs could not be loaded." : "No NGOs found."}</CommandEmpty>
            <CommandGroup heading="Workspace scope">
              <CommandItem value="all hpg consolidated workspace" onSelect={() => chooseNgo(null)}>
                <Globe2 className="mr-2" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">All HPG</span>
                  <span className="text-xs text-muted-foreground">Consolidated workspace view</span>
                </span>
                <Check className={cn("ml-2", selectedNgoId === null ? "opacity-100" : "opacity-0")} />
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={`Organizations (${ngos.length})`}>
              {ngos.map((ngo) => {
                const displayName = ngo.common_name || ngo.legal_name;
                return (
                  <CommandItem
                    key={ngo.id}
                    value={`${displayName} ${ngo.legal_name} ${ngo.status}`}
                    onSelect={() => chooseNgo(ngo.id)}
                  >
                    <Building2 className="mr-2" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{displayName}</span>
                      <span className="truncate text-xs capitalize text-muted-foreground">
                        {displayName !== ngo.legal_name ? `${ngo.legal_name} · ` : ""}
                        {formatStatus(ngo.status)}
                      </span>
                    </span>
                    <Check className={cn("ml-2", selectedNgoId === ngo.id ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
