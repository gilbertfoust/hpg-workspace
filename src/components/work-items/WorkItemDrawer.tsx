// src/components/work-items/WorkItemDrawer.tsx
import React from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export type WorkItemDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItemId?: string | null;
};

export const WorkItemDrawer: React.FC<WorkItemDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Work Item</h2>
          <p className="text-sm text-muted-foreground">
            Detailed work-item drawer content will be restored later. This placeholder
            keeps the app compiling so you can log in, navigate, and continue building
            other parts of the workspace.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WorkItemDrawer;
