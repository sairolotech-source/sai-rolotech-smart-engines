import React, { useState } from 'react';
import { 
  MousePointer2, Square, Circle, Triangle, 
  Minus, ArrowRight, Type, Pencil, Layers, Blocks
} from 'lucide-react';
import { useDesignStore, ToolType } from '../../store/useDesignStore';
import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { ScrollArea } from '../ui/scroll-area';

export function LeftToolbar() {
  const { tool, setTool, shapes, selectedIds, selectShape, reorderShape } = useDesignStore();
  const [activeTab, setActiveTab] = useState<'tools' | 'layers'>('tools');

  const tools: { id: ToolType; icon: React.FC<any>; label: string; shortcut: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
    { id: 'rectangle', icon: Square, label: 'Rectangle', shortcut: 'R' },
    { id: 'circle', icon: Circle, label: 'Circle', shortcut: 'O' },
    { id: 'triangle', icon: Triangle, label: 'Triangle', shortcut: 'T' },
    { id: 'line', icon: Minus, label: 'Line', shortcut: 'L' },
    { id: 'arrow', icon: ArrowRight, label: 'Arrow', shortcut: 'A' },
    { id: 'text', icon: Type, label: 'Text', shortcut: 'T' },
    { id: 'pencil', icon: Pencil, label: 'Pencil', shortcut: 'P' },
  ];

  return (
    <div className="w-64 border-r bg-card flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      <div className="flex border-b">
        <button 
          className={cn("flex-1 py-3 text-xs font-medium border-b-2 flex items-center justify-center transition-colors", activeTab === 'tools' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          onClick={() => setActiveTab('tools')}
        >
          <Blocks className="w-4 h-4 mr-2" />
          Tools
        </button>
        <button 
          className={cn("flex-1 py-3 text-xs font-medium border-b-2 flex items-center justify-center transition-colors", activeTab === 'layers' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          onClick={() => setActiveTab('layers')}
        >
          <Layers className="w-4 h-4 mr-2" />
          Layers
        </button>
      </div>

      <ScrollArea className="flex-1">
        {activeTab === 'tools' ? (
          <div className="p-4 grid grid-cols-2 gap-2">
            {tools.map((t) => {
              const Icon = t.icon;
              const isActive = tool === t.id;
              return (
                <Tooltip key={t.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setTool(t.id)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 border",
                        isActive 
                          ? "bg-primary/10 border-primary/30 text-primary shadow-inner" 
                          : "bg-background border-transparent text-muted-foreground hover:bg-muted hover:text-foreground border-border/50"
                      )}
                    >
                      <Icon className="w-5 h-5 mb-1.5" />
                      <span className="text-[10px] font-medium">{t.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {t.label} <span className="opacity-50 ml-1">({t.shortcut})</span>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ) : (
          <div className="p-2 flex flex-col space-y-1">
            {shapes.length === 0 && (
              <div className="text-center p-8 text-sm text-muted-foreground">
                No layers yet. Start drawing!
              </div>
            )}
            {/* Show layers in reverse order (top to bottom visually matches z-index) */}
            {[...shapes].reverse().map((shape) => {
              const isSelected = selectedIds.includes(shape.id);
              return (
                <div 
                  key={shape.id}
                  onClick={(e) => selectShape(shape.id, e.ctrlKey || e.metaKey)}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm transition-colors border",
                    isSelected 
                      ? "bg-primary/10 border-primary/20 text-primary" 
                      : "bg-transparent border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex items-center truncate">
                    <div className="w-4 h-4 mr-2 flex-shrink-0 opacity-70">
                      {shape.type === 'rectangle' && <Square className="w-full h-full" />}
                      {shape.type === 'circle' && <Circle className="w-full h-full" />}
                      {shape.type === 'triangle' && <Triangle className="w-full h-full" />}
                      {shape.type === 'line' && <Minus className="w-full h-full" />}
                      {shape.type === 'arrow' && <ArrowRight className="w-full h-full" />}
                      {shape.type === 'text' && <Type className="w-full h-full" />}
                      {shape.type === 'pencil' && <Pencil className="w-full h-full" />}
                    </div>
                    <span className="truncate">{shape.name}</span>
                  </div>
                  {isSelected && (
                    <div className="flex items-center space-x-1 opacity-60">
                      <button onClick={(e) => { e.stopPropagation(); reorderShape(shape.id, 'top'); }} className="hover:text-foreground">↑</button>
                      <button onClick={(e) => { e.stopPropagation(); reorderShape(shape.id, 'bottom'); }} className="hover:text-foreground">↓</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
