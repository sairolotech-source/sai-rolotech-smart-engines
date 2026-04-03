import { useEffect } from 'react';
import { useDesignStore } from '../store/useDesignStore';

export function useKeyboardShortcuts() {
  const { deleteSelectedShapes, undo, redo, copy, paste, duplicate, selectShape, shapes } = useDesignStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        deleteSelectedShapes();
      } else if (ctrlOrCmd && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if (ctrlOrCmd && e.key === 'y') {
        e.preventDefault();
        redo();
      } else if (ctrlOrCmd && e.key === 'c') {
        e.preventDefault();
        copy();
      } else if (ctrlOrCmd && e.key === 'v') {
        e.preventDefault();
        paste();
      } else if (ctrlOrCmd && e.key === 'd') {
        e.preventDefault();
        duplicate();
      } else if (ctrlOrCmd && e.key === 'a') {
        e.preventDefault();
        shapes.forEach(s => selectShape(s.id, true));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelectedShapes, undo, redo, copy, paste, duplicate, selectShape, shapes]);
}
