import React from 'react';
import { useDesignStore, Shape } from '../../store/useDesignStore';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { ColorPicker } from '../ui/color-picker';
import { Slider } from '../ui/slider';
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Type, Lock, Unlock, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';

export function RightProperties() {
  const { shapes, selectedIds, updateSelectedShapes, deleteSelectedShapes, canvasColor, setCanvasColor, showGrid, toggleGrid } = useDesignStore();

  const selectedShapes = shapes.filter(s => selectedIds.includes(s.id));
  const isMultiSelection = selectedShapes.length > 1;
  const activeShape = selectedShapes.length === 1 ? selectedShapes[0] : null;

  const handleChange = (key: keyof Shape, value: any) => {
    updateSelectedShapes({ [key]: value });
    useDesignStore.getState().pushHistory();
  };

  const handleNumberChange = (key: keyof Shape, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      handleChange(key, num);
    }
  };

  if (selectedShapes.length === 0) {
    return (
      <div className="w-72 border-l bg-card flex flex-col z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-4 border-b font-medium text-sm flex items-center">
          Canvas Properties
        </div>
        <ScrollArea className="flex-1 p-4 space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Background</h3>
              <ColorPicker color={canvasColor} onChange={setCanvasColor} />
            </div>
            <div className="pt-4 border-t">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">View</h3>
              <label className="flex items-center space-x-2 text-sm cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showGrid} 
                  onChange={toggleGrid}
                  className="rounded border-border bg-background text-primary focus:ring-primary h-4 w-4"
                />
                <span>Show Grid Overlay</span>
              </label>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="w-72 border-l bg-card flex flex-col z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
      <div className="p-4 border-b flex items-center justify-between">
        <span className="font-medium text-sm">
          {isMultiSelection ? `${selectedShapes.length} Items Selected` : activeShape?.name}
        </span>
        <div className="flex items-center space-x-1">
          {activeShape && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => handleChange('isLocked', !activeShape.isLocked)}
            >
              {activeShape.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-destructive hover:bg-destructive/10"
            onClick={deleteSelectedShapes}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          
          {/* POSITION & SIZE */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Layout</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground w-3">X</span>
                <Input 
                  type="number" 
                  value={Math.round(activeShape?.x || 0)} 
                  onChange={(e) => handleNumberChange('x', e.target.value)}
                  className="h-8 text-xs font-mono"
                  disabled={isMultiSelection || activeShape?.isLocked}
                />
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground w-3">Y</span>
                <Input 
                  type="number" 
                  value={Math.round(activeShape?.y || 0)} 
                  onChange={(e) => handleNumberChange('y', e.target.value)}
                  className="h-8 text-xs font-mono"
                  disabled={isMultiSelection || activeShape?.isLocked}
                />
              </div>
              {(activeShape?.type === 'rectangle' || activeShape?.type === 'circle' || activeShape?.type === 'triangle') && (
                <>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-muted-foreground w-3">W</span>
                    <Input 
                      type="number" 
                      value={Math.round(activeShape?.width || (activeShape?.radius ? activeShape.radius * 2 : 0))} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if(activeShape.type === 'circle') handleChange('radius', val/2);
                        else handleNumberChange('width', e.target.value);
                      }}
                      className="h-8 text-xs font-mono"
                      disabled={isMultiSelection || activeShape?.isLocked}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-muted-foreground w-3">H</span>
                    <Input 
                      type="number" 
                      value={Math.round(activeShape?.height || (activeShape?.radius ? activeShape.radius * 2 : 0))} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if(activeShape.type === 'circle') handleChange('radius', val/2);
                        else handleNumberChange('height', e.target.value);
                      }}
                      className="h-8 text-xs font-mono"
                      disabled={isMultiSelection || activeShape?.isLocked}
                    />
                  </div>
                </>
              )}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground w-3">°</span>
                <Input 
                  type="number" 
                  value={Math.round(activeShape?.rotation || 0)} 
                  onChange={(e) => handleNumberChange('rotation', e.target.value)}
                  className="h-8 text-xs font-mono"
                  disabled={isMultiSelection || activeShape?.isLocked}
                />
              </div>
            </div>
          </div>

          {/* APPEARANCE */}
          <div className="pt-4 border-t border-border/50">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Appearance</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Opacity</span>
                  <span className="font-mono">{Math.round((activeShape?.opacity || 1) * 100)}%</span>
                </div>
                <Slider 
                  value={[(activeShape?.opacity || 1) * 100]} 
                  max={100} 
                  step={1}
                  onValueChange={(vals) => handleChange('opacity', vals[0] / 100)}
                  disabled={activeShape?.isLocked}
                />
              </div>

              {activeShape?.type !== 'line' && activeShape?.type !== 'pencil' && (
                <ColorPicker 
                  label="Fill Color"
                  color={activeShape?.fill || 'transparent'} 
                  onChange={(c) => handleChange('fill', c)} 
                />
              )}

              <ColorPicker 
                label="Stroke Color"
                color={activeShape?.stroke || 'transparent'} 
                onChange={(c) => handleChange('stroke', c)} 
              />

              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground w-12">Width</span>
                <Input 
                  type="number" 
                  value={activeShape?.strokeWidth || 0} 
                  onChange={(e) => handleNumberChange('strokeWidth', e.target.value)}
                  className="h-8 text-xs font-mono flex-1"
                  disabled={isMultiSelection || activeShape?.isLocked}
                  min={0}
                />
              </div>
            </div>
          </div>

          {/* TEXT PROPERTIES */}
          {activeShape?.type === 'text' && (
            <div className="pt-4 border-t border-border/50">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Typography</h3>
              <div className="space-y-3">
                <Input 
                  value={activeShape.text || ''} 
                  onChange={(e) => handleChange('text', e.target.value)}
                  className="text-sm"
                  placeholder="Enter text..."
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input 
                    type="number" 
                    value={activeShape.fontSize || 16} 
                    onChange={(e) => handleNumberChange('fontSize', e.target.value)}
                    className="h-8 text-xs font-mono"
                    placeholder="Size"
                  />
                  <select 
                    className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={activeShape.fontFamily || 'Inter'}
                    onChange={(e) => handleChange('fontFamily', e.target.value)}
                  >
                    <option value="Inter">Inter</option>
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Courier New">Courier New</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
