import React, { useState, useRef, useCallback, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface KanbanColumn<T> {
  id: string;
  label: string;
  colorClass?: string;
  items: T[];
}

interface DnDKanbanBoardProps<T> {
  columns: KanbanColumn<T>[];
  getItemId: (item: T) => string;
  onDrop: (itemId: string, targetColumnId: string) => void;
  renderCard: (item: T, columnId: string) => ReactNode;
  columnWidth?: number;
}

export function DnDKanbanBoard<T>({
  columns,
  getItemId,
  onDrop,
  renderCard,
  columnWidth = 200,
}: DnDKanbanBoardProps<T>) {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragSourceColumn = useRef<string | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, itemId: string, columnId: string) => {
      setDraggedItemId(itemId);
      dragSourceColumn.current = columnId;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", itemId);
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, columnId: string) => {
      e.preventDefault();
      const itemId = e.dataTransfer.getData("text/plain");
      if (itemId && dragSourceColumn.current !== columnId) {
        onDrop(itemId, columnId);
      }
      setDraggedItemId(null);
      setDragOverColumn(null);
      dragSourceColumn.current = null;
    },
    [onDrop]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedItemId(null);
    setDragOverColumn(null);
    dragSourceColumn.current = null;
  }, []);

  return (
    <div className="overflow-x-auto pb-4">
      <div
        className="flex gap-3"
        style={{ minWidth: `${columns.length * (columnWidth + 12)}px` }}
      >
        {columns.map((col) => (
          <div
            key={col.id}
            className={cn(
              "flex-shrink-0 rounded-lg transition-colors",
              dragOverColumn === col.id && "bg-accent/40 ring-2 ring-primary/30"
            )}
            style={{ width: `${columnWidth}px` }}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="flex items-center gap-2 mb-3 px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide truncate">
                {col.label}
              </h3>
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {col.items.length}
              </Badge>
            </div>
            <div className="space-y-2 min-h-[100px] px-1">
              {col.items.map((item) => {
                const itemId = getItemId(item);
                return (
                  <div
                    key={itemId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, itemId, col.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "transition-opacity cursor-grab active:cursor-grabbing",
                      draggedItemId === itemId && "opacity-40"
                    )}
                  >
                    {renderCard(item, col.id)}
                  </div>
                );
              })}
              {col.items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Empty
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
