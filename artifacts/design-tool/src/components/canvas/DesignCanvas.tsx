import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, RegularPolygon, Line, Arrow, Text, Transformer } from 'react-konva';
import { useDesignStore, Shape } from '../../store/useDesignStore';
import { v4 as uuidv4 } from 'uuid';

interface DesignCanvasProps {
  stageRef: React.RefObject<any>;
}

export function DesignCanvas({ stageRef }: DesignCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<any>(null);
  const selectionRectRef = useRef<any>(null);

  const { 
    shapes, selectedIds, tool, zoom, pan, canvasColor, showGrid,
    setPan, setZoom, addShape, updateShape, selectShape, clearSelection, pushHistory
  } = useDesignStore();

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingShapeId, setDrawingShapeId] = useState<string | null>(null);
  const [selectionBox, setSelectionBox] = useState<{visible: boolean, x1: number, y1: number, x2: number, y2: number}>({ visible: false, x1: 0, y1: 0, x2: 0, y2: 0 });

  // Update dimensions on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Update transformer nodes when selection changes
  useEffect(() => {
    if (transformerRef.current) {
      const nodes = selectedIds
        .map(id => stageRef.current?.findOne(`#${id}`))
        .filter(Boolean);
      
      transformerRef.current.nodes(nodes);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [selectedIds, shapes]);

  const getPointerPos = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    return {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY()
    };
  };

  const handleMouseDown = (e: any) => {
    // If panning with middle mouse or spacebar (not fully implemented spacebar, just middle click for now)
    if (e.evt.button === 1 || e.evt.spaceKey) {
       return;
    }

    const pos = getPointerPos(e);
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.hasName('bg-grid');

    if (tool === 'select') {
      if (clickedOnEmpty) {
        // Start multi-selection box
        setSelectionBox({ visible: true, x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
        clearSelection();
      }
      return;
    }

    // Drawing new shape
    setIsDrawing(true);
    const id = uuidv4();
    setDrawingShapeId(id);

    const baseAttrs = {
      id,
      x: pos.x,
      y: pos.y,
      fill: tool === 'pencil' || tool === 'line' || tool === 'arrow' ? 'transparent' : '#e4e4e7',
      stroke: '#3f3f46',
      strokeWidth: 2,
    };

    switch (tool) {
      case 'rectangle':
        addShape({ ...baseAttrs, type: 'rectangle', width: 0, height: 0 });
        break;
      case 'circle':
        addShape({ ...baseAttrs, type: 'circle', radius: 0 });
        break;
      case 'triangle':
        addShape({ ...baseAttrs, type: 'triangle', radius: 0 });
        break;
      case 'line':
      case 'arrow':
        addShape({ ...baseAttrs, type: tool, points: [pos.x, pos.y, pos.x, pos.y] });
        break;
      case 'pencil':
        addShape({ ...baseAttrs, type: 'pencil', points: [pos.x, pos.y] });
        break;
      case 'text':
        addShape({ 
          ...baseAttrs, 
          type: 'text', 
          text: 'Double click to edit', 
          fontSize: 24, 
          fontFamily: 'Inter',
          fill: '#ffffff',
          stroke: 'transparent'
        });
        setIsDrawing(false); // Text is instant placement
        setDrawingShapeId(null);
        selectShape(id);
        break;
    }
  };

  const handleMouseMove = (e: any) => {
    // Handling selection box
    if (selectionBox.visible && tool === 'select') {
      const pos = getPointerPos(e);
      setSelectionBox(prev => ({ ...prev, x2: pos.x, y2: pos.y }));
      return;
    }

    if (!isDrawing || !drawingShapeId) return;

    const pos = getPointerPos(e);
    const shape = shapes.find(s => s.id === drawingShapeId);
    if (!shape) return;

    if (tool === 'rectangle') {
      updateShape(drawingShapeId, { 
        width: pos.x - shape.x, 
        height: pos.y - shape.y 
      });
    } else if (tool === 'circle' || tool === 'triangle') {
      const radius = Math.sqrt(Math.pow(pos.x - shape.x, 2) + Math.pow(pos.y - shape.y, 2));
      updateShape(drawingShapeId, { radius });
    } else if (tool === 'line' || tool === 'arrow') {
      updateShape(drawingShapeId, { 
        points: [shape.points![0], shape.points![1], pos.x, pos.y] 
      });
    } else if (tool === 'pencil') {
      updateShape(drawingShapeId, { 
        points: [...(shape.points || []), pos.x, pos.y] 
      });
    }
  };

  const handleMouseUp = (e: any) => {
    // Handle end of multi-selection
    if (selectionBox.visible && tool === 'select') {
      setSelectionBox(prev => ({ ...prev, visible: false }));
      
      // Select shapes within the box
      const box = selectionRectRef.current?.getClientRect();
      if (box) {
        const selected = shapes.filter(shape => {
          const node = stageRef.current?.findOne(`#${shape.id}`);
          if (!node) return false;
          const shapeBox = node.getClientRect();
          return (
            shapeBox.x >= box.x &&
            shapeBox.y >= box.y &&
            shapeBox.x + shapeBox.width <= box.x + box.width &&
            shapeBox.y + shapeBox.height <= box.y + box.height
          );
        });
        if (selected.length > 0) {
          useDesignStore.setState({ selectedIds: selected.map(s => s.id) });
        }
      }
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (drawingShapeId) {
      selectShape(drawingShapeId);
      pushHistory();
    }
    setDrawingShapeId(null);
    useDesignStore.getState().setTool('select'); // Auto switch back to select after draw
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    if (e.evt.ctrlKey || e.evt.metaKey) {
      // Zoom
      const scaleBy = 1.1;
      const stage = e.target.getStage();
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      setZoom(Math.max(0.1, Math.min(newScale, 5)));

      setPan({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    } else {
      // Pan
      setPan({
        x: pan.x - e.evt.deltaX,
        y: pan.y - e.evt.deltaY,
      });
    }
  };

  // Render individual shapes based on their type
  const renderShape = (shape: Shape) => {
    const commonProps = {
      id: shape.id,
      name: 'shape',
      x: shape.x,
      y: shape.y,
      fill: shape.fill,
      stroke: shape.stroke,
      strokeWidth: shape.strokeWidth,
      opacity: shape.opacity,
      rotation: shape.rotation,
      draggable: !shape.isLocked && tool === 'select',
      onClick: (e: any) => {
        if (tool !== 'select') return;
        selectShape(shape.id, e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      },
      onDragEnd: (e: any) => {
        if (shape.isLocked) return;
        updateShape(shape.id, { x: e.target.x(), y: e.target.y() });
        pushHistory();
      },
      onTransformEnd: (e: any) => {
        const node = e.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);

        if (shape.type === 'rectangle' || shape.type === 'text') {
          updateShape(shape.id, {
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            width: Math.max(5, (shape.width || 0) * scaleX),
            height: Math.max(5, (shape.height || 0) * scaleY),
          });
        } else if (shape.type === 'circle' || shape.type === 'triangle') {
          updateShape(shape.id, {
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            radius: Math.max(5, (shape.radius || 0) * Math.max(scaleX, scaleY)),
          });
        }
        pushHistory();
      }
    };

    switch (shape.type) {
      case 'rectangle':
        return <Rect key={shape.id} {...commonProps} width={shape.width} height={shape.height} cornerRadius={shape.radius} />;
      case 'circle':
        return <Circle key={shape.id} {...commonProps} radius={shape.radius} />;
      case 'triangle':
        return <RegularPolygon key={shape.id} {...commonProps} sides={3} radius={shape.radius ?? 50} />;
      case 'line':
        return <Line key={shape.id} {...commonProps} x={0} y={0} points={shape.points || []} hitStrokeWidth={10} />;
      case 'arrow':
        return <Arrow key={shape.id} {...commonProps} x={0} y={0} points={shape.points || []} pointerLength={10} pointerWidth={10} hitStrokeWidth={10} />;
      case 'pencil':
        return <Line key={shape.id} {...commonProps} x={0} y={0} points={shape.points || []} tension={0.5} lineCap="round" lineJoin="round" />;
      case 'text':
        return (
          <Text 
            key={shape.id} 
            {...commonProps} 
            text={shape.text} 
            fontSize={shape.fontSize} 
            fontFamily={shape.fontFamily}
            width={shape.width}
            onDblClick={(e) => {
              // Basic implementation for double click edit (ideally replace with HTML textarea overlay)
              const newText = prompt('Edit text:', shape.text);
              if (newText !== null) {
                updateShape(shape.id, { text: newText });
                pushHistory();
              }
            }}
          />
        );
      default:
        return null;
    }
  };

  // Generate grid lines
  const renderGrid = () => {
    if (!showGrid) return null;
    const gridSize = 40;
    const lines = [];
    const width = dimensions.width / zoom;
    const height = dimensions.height / zoom;
    const startX = -pan.x / zoom;
    const startY = -pan.y / zoom;

    for (let i = startX - (startX % gridSize); i < startX + width; i += gridSize) {
      lines.push(<Line key={`v${i}`} points={[i, startY, i, startY + height]} stroke="rgba(255,255,255,0.05)" strokeWidth={1} name="bg-grid" listening={false} />);
    }
    for (let j = startY - (startY % gridSize); j < startY + height; j += gridSize) {
      lines.push(<Line key={`h${j}`} points={[startX, j, startX + width, j]} stroke="rgba(255,255,255,0.05)" strokeWidth={1} name="bg-grid" listening={false} />);
    }
    return lines;
  };

  return (
    <div 
      ref={containerRef} 
      className="flex-1 overflow-hidden relative cursor-crosshair"
      style={{ backgroundColor: canvasColor, cursor: tool === 'select' ? 'default' : 'crosshair' }}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
      >
        <Layer>
          <Rect
            x={-pan.x / zoom}
            y={-pan.y / zoom}
            width={dimensions.width / zoom}
            height={dimensions.height / zoom}
            fill={canvasColor}
            name="bg-grid"
          />
          {renderGrid()}
        </Layer>
        <Layer>
          {shapes.map(renderShape)}
          
          <Transformer 
            ref={transformerRef} 
            boundBoxFunc={(oldBox, newBox) => {
              // limit resize
              if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
                return oldBox;
              }
              return newBox;
            }}
            borderStroke="#3b82f6"
            anchorStroke="#3b82f6"
            anchorFill="#ffffff"
            anchorSize={8}
            rotateAnchorOffset={30}
            ignoreStroke={true}
          />

          {selectionBox.visible && (
            <Rect
              ref={selectionRectRef}
              x={Math.min(selectionBox.x1, selectionBox.x2)}
              y={Math.min(selectionBox.y1, selectionBox.y2)}
              width={Math.abs(selectionBox.x1 - selectionBox.x2)}
              height={Math.abs(selectionBox.y1 - selectionBox.y2)}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="rgba(59, 130, 246, 0.5)"
              strokeWidth={1}
              listening={false}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}
