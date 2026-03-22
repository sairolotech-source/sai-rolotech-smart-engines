import React from 'react';
import { 
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize, 
  Download, Save, Upload, Menu, Palette
} from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { saveAs } from 'file-saver';

interface TopBarProps {
  stageRef: React.RefObject<any>;
}

export function TopBar({ stageRef }: TopBarProps) {
  const { undo, redo, zoom, setZoom, setPan, shapes, loadState } = useDesignStore();

  const handleZoomIn = () => setZoom(Math.min(zoom * 1.2, 5));
  const handleZoomOut = () => setZoom(Math.max(zoom / 1.2, 0.1));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const exportCanvas = (format: 'png' | 'svg' | 'json') => {
    if (format === 'json') {
      const data = JSON.stringify(useDesignStore.getState().shapes, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      saveAs(blob, 'design.json');
      return;
    }

    if (stageRef.current) {
      // Deselect all before exporting to hide transformer
      useDesignStore.getState().clearSelection();
      
      setTimeout(() => {
        const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
        saveAs(dataURL, `design.${format}`);
      }, 100);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const shapes = JSON.parse(event.target?.result as string);
        loadState({ shapes });
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-14 border-b bg-card flex items-center justify-between px-4 z-10 relative shadow-sm">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-primary">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Palette className="w-5 h-5" />
          </div>
          <span className="font-semibold text-foreground tracking-tight hidden md:block">StudioFlow</span>
        </div>
        
        <div className="h-6 w-px bg-border mx-2"></div>
        
        <div className="flex items-center space-x-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={undo} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Undo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={redo} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Redo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center space-x-1 bg-muted/50 rounded-lg p-1 border border-border/50">
        <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <div className="text-xs font-medium w-12 text-center text-muted-foreground">
          {Math.round(zoom * 100)}%
        </div>
        <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <div className="h-4 w-px bg-border mx-1"></div>
        <Button variant="ghost" size="icon" onClick={handleResetZoom} className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background">
          <Maximize className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <input 
          type="file" 
          id="import-json" 
          className="hidden" 
          accept=".json"
          onChange={handleFileUpload} 
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground" onClick={() => document.getElementById('import-json')?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Import</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Import JSON</TooltipContent>
        </Tooltip>

        <Button variant="outline" size="sm" className="h-8 border-border hover:bg-muted" onClick={() => exportCanvas('json')}>
          <Save className="w-4 h-4 mr-2 text-muted-foreground" />
          <span className="hidden sm:inline">Save JSON</span>
        </Button>
        
        <Button size="sm" className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20" onClick={() => exportCanvas('png')}>
          <Download className="w-4 h-4 mr-2" />
          Export PNG
        </Button>
      </div>
    </div>
  );
}
