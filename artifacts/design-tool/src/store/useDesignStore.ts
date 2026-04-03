import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type ToolType = 'select' | 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow' | 'text' | 'pencil';

export interface Shape {
  id: string;
  type: ToolType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  radiusX?: number;
  radiusY?: number;
  points?: number[];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  rotation?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  isLocked?: boolean;
  name?: string;
}

interface DesignState {
  shapes: Shape[];
  selectedIds: string[];
  tool: ToolType;
  zoom: number;
  pan: { x: number; y: number };
  canvasColor: string;
  showGrid: boolean;
  history: Shape[][];
  historyStep: number;
  clipboard: Shape[];

  // Actions
  setTool: (tool: ToolType) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setCanvasColor: (color: string) => void;
  toggleGrid: () => void;
  
  // Shape Actions
  addShape: (shape: Omit<Shape, 'id'>) => void;
  updateShape: (id: string, attrs: Partial<Shape>) => void;
  updateSelectedShapes: (attrs: Partial<Shape>) => void;
  deleteSelectedShapes: () => void;
  selectShape: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
  reorderShape: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  
  // History Actions
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Clipboard
  copy: () => void;
  paste: () => void;
  duplicate: () => void;

  // Load/Save
  loadState: (state: Partial<DesignState>) => void;
}

export const useDesignStore = create<DesignState>((set, get) => ({
  shapes: [],
  selectedIds: [],
  tool: 'select',
  zoom: 1,
  pan: { x: 0, y: 0 },
  canvasColor: '#1e1e24', // Default dark canvas
  showGrid: true,
  history: [[]],
  historyStep: 0,
  clipboard: [],

  setTool: (tool) => set({ tool, selectedIds: tool === 'select' ? get().selectedIds : [] }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  setCanvasColor: (canvasColor) => set({ canvasColor }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

  pushHistory: () => {
    const { shapes, history, historyStep } = get();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(JSON.parse(JSON.stringify(shapes)));
    set({ history: newHistory, historyStep: newHistory.length - 1 });
  },

  undo: () => {
    const { historyStep, history } = get();
    if (historyStep > 0) {
      set({
        historyStep: historyStep - 1,
        shapes: JSON.parse(JSON.stringify(history[historyStep - 1])),
        selectedIds: [],
      });
    }
  },

  redo: () => {
    const { historyStep, history } = get();
    if (historyStep < history.length - 1) {
      set({
        historyStep: historyStep + 1,
        shapes: JSON.parse(JSON.stringify(history[historyStep + 1])),
        selectedIds: [],
      });
    }
  },

  addShape: (shapeConfig) => {
    const id = uuidv4();
    const newShape: Shape = {
      ...shapeConfig,
      id,
      name: `${shapeConfig.type.charAt(0).toUpperCase() + shapeConfig.type.slice(1)} ${get().shapes.length + 1}`,
      opacity: 1,
      rotation: 0,
    };
    set((state) => {
      const newShapes = [...state.shapes, newShape];
      return { shapes: newShapes, selectedIds: [id] };
    });
    get().pushHistory();
  },

  updateShape: (id, attrs) => {
    set((state) => ({
      shapes: state.shapes.map((shape) => (shape.id === id ? { ...shape, ...attrs } : shape)),
    }));
  },

  updateSelectedShapes: (attrs) => {
    set((state) => ({
      shapes: state.shapes.map((shape) => 
        state.selectedIds.includes(shape.id) && !shape.isLocked ? { ...shape, ...attrs } : shape
      ),
    }));
    // Don't push history immediately on drag, caller should handle it onDragEnd
  },

  deleteSelectedShapes: () => {
    const { selectedIds, shapes } = get();
    if (selectedIds.length === 0) return;
    
    set({
      shapes: shapes.filter((shape) => !selectedIds.includes(shape.id) || shape.isLocked),
      selectedIds: [],
    });
    get().pushHistory();
  },

  selectShape: (id, multi = false) => {
    set((state) => {
      if (multi) {
        return {
          selectedIds: state.selectedIds.includes(id)
            ? state.selectedIds.filter((sid) => sid !== id)
            : [...state.selectedIds, id],
        };
      }
      return { selectedIds: [id] };
    });
  },

  clearSelection: () => set({ selectedIds: [] }),

  reorderShape: (id, direction) => {
    const shapes = [...get().shapes];
    const index = shapes.findIndex((s) => s.id === id);
    if (index === -1) return;

    const shape = shapes.splice(index, 1)[0];

    if (direction === 'top') shapes.push(shape);
    else if (direction === 'bottom') shapes.unshift(shape);
    else if (direction === 'up' && index < shapes.length) shapes.splice(index + 1, 0, shape);
    else if (direction === 'down' && index > 0) shapes.splice(index - 1, 0, shape);
    else shapes.splice(index, 0, shape); // put back if boundary hit

    set({ shapes });
    get().pushHistory();
  },

  copy: () => {
    const { shapes, selectedIds } = get();
    const toCopy = shapes.filter(s => selectedIds.includes(s.id));
    set({ clipboard: JSON.parse(JSON.stringify(toCopy)) });
  },

  paste: () => {
    const { clipboard, shapes } = get();
    if (clipboard.length === 0) return;

    const newShapes = clipboard.map(shape => ({
      ...shape,
      id: uuidv4(),
      x: shape.x + 20,
      y: shape.y + 20,
      name: `${shape.name} (copy)`,
    }));

    set({
      shapes: [...shapes, ...newShapes],
      selectedIds: newShapes.map(s => s.id)
    });
    get().pushHistory();
  },

  duplicate: () => {
    get().copy();
    get().paste();
  },

  loadState: (newState) => {
    set({ ...newState, history: [newState.shapes || []], historyStep: 0 });
  }
}));
