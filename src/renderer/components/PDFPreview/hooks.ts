import { useState, useEffect, useCallback, useRef } from 'react';
import { PDFContent, PDFInfo, PDFAnnotation, PDFViewerState } from './types';

// Hook for loading PDF content
export const usePDFLoader = (filePath?: string) => {
  const [content, setContent] = useState<PDFContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPDF = useCallback(async (path: string) => {
    if (!path) return;

    setLoading(true);
    setError(null);

    try {
      // Get PDF info
      const infoResult = await window.electron.ipcRenderer.invoke('pdf:get-info', {
        filePath: path
      });

      if (!infoResult.success) {
        throw new Error(infoResult.error);
      }

      const pdfInfo: PDFInfo = infoResult.data;

      // Get page previews for all pages
      const pages = [];
      for (let i = 0; i < pdfInfo.pageCount; i++) {
        const pageResult = await window.electron.ipcRenderer.invoke('pdf:get-page-preview', {
          filePath: path,
          pageNumber: i,
          scale: 1.0
        });

        if (pageResult.success) {
          pages.push(pageResult.data);
        }
      }

      // Try to extract text information
      let extractedText;
      try {
        const textResult = await window.electron.ipcRenderer.invoke('pdf:extract-text', {
          filePath: path
        });
        if (textResult.success) {
          extractedText = textResult.data;
        }
      } catch (textError) {
        console.warn('Text extraction failed:', textError);
      }

      const pdfContent: PDFContent = {
        info: { ...pdfInfo, filePath: path }, // Add filePath to info
        currentPage: 0,
        pages,
        extractedText
      };

      setContent(pdfContent);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load PDF';
      setError(errorMessage);
      console.error('[PDF Loader] Error loading PDF:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (filePath) {
      loadPDF(filePath);
    } else {
      // Clear content when filePath is undefined
      setContent(null);
      setError(null);
      setLoading(false);
    }
  }, [filePath]); // Remove loadPDF from dependencies to prevent infinite loop

  return {
    content,
    loading,
    error,
    loadPDF,
    reload: () => filePath && loadPDF(filePath)
  };
};

// Hook for PDF viewer state management
export const usePDFViewer = (initialContent: PDFContent | null) => {
  const [viewerState, setViewerState] = useState<PDFViewerState>({
    currentPage: 0,
    scale: 1.0,
    viewMode: 'single',
    zoomMode: 'fit-width',
    showAnnotations: true,
    showInfo: false
  });

  const [annotations, setAnnotations] = useState<PDFAnnotation[]>([]);

  // Page navigation
  const goToPage = useCallback((pageNumber: number) => {
    if (!initialContent) return;

    const validPageNumber = Math.max(0, Math.min(pageNumber, initialContent.info.pageCount - 1));
    setViewerState(prev => ({
      ...prev,
      currentPage: validPageNumber
    }));
  }, [initialContent]);

  const nextPage = useCallback(() => {
    if (!initialContent) return;
    goToPage(viewerState.currentPage + 1);
  }, [initialContent, viewerState.currentPage, goToPage]);

  const previousPage = useCallback(() => {
    goToPage(viewerState.currentPage - 1);
  }, [viewerState.currentPage, goToPage]);

  // Zoom controls
  const zoomIn = useCallback(() => {
    setViewerState(prev => ({
      ...prev,
      scale: Math.min(prev.scale * 1.2, 3.0),
      zoomMode: 'custom'
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewerState(prev => ({
      ...prev,
      scale: Math.max(prev.scale / 1.2, 0.25),
      zoomMode: 'custom'
    }));
  }, []);

  const resetZoom = useCallback(() => {
    setViewerState(prev => ({
      ...prev,
      scale: 1.0,
      zoomMode: 'actual-size'
    }));
  }, []);

  const setZoom = useCallback((scale: number) => {
    setViewerState(prev => ({
      ...prev,
      scale: Math.max(0.25, Math.min(scale, 3.0)),
      zoomMode: 'custom'
    }));
  }, []);

  // Annotation management
  const addAnnotation = useCallback((annotation: Omit<PDFAnnotation, 'id' | 'timestamp'>) => {
    const newAnnotation: PDFAnnotation = {
      ...annotation,
      id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };
    setAnnotations(prev => [...prev, newAnnotation]);
  }, []);

  const removeAnnotation = useCallback((annotationId: string) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== annotationId));
  }, []);

  const clearAnnotations = useCallback(() => {
    setAnnotations([]);
  }, []);

  // View mode controls
  const setViewMode = useCallback((mode: PDFViewerState['viewMode']) => {
    setViewerState(prev => ({ ...prev, viewMode: mode }));
  }, []);

  const toggleAnnotations = useCallback(() => {
    setViewerState(prev => ({ ...prev, showAnnotations: !prev.showAnnotations }));
  }, []);

  const toggleInfo = useCallback(() => {
    setViewerState(prev => ({ ...prev, showInfo: !prev.showInfo }));
  }, []);

  return {
    viewerState,
    annotations,
    goToPage,
    nextPage,
    previousPage,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoom,
    addAnnotation,
    removeAnnotation,
    clearAnnotations,
    setViewMode,
    toggleAnnotations,
    toggleInfo,
    canGoNext: initialContent ? viewerState.currentPage < initialContent.info.pageCount - 1 : false,
    canGoPrevious: viewerState.currentPage > 0
  };
};

// Hook for PDF keyboard shortcuts
export const usePDFKeyboardShortcuts = (
  enabled: boolean,
  handlers: {
    nextPage: () => void;
    previousPage: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
  }
) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key) {
        case 'ArrowRight':
        case ' ': // Spacebar
          event.preventDefault();
          handlers.nextPage();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          handlers.previousPage();
          break;
        case '+':
        case '=':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handlers.zoomIn();
          }
          break;
        case '-':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handlers.zoomOut();
          }
          break;
        case '0':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handlers.resetZoom();
          }
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handlers]);
};

// Hook for PDF drag and drop annotation creation
export const usePDFAnnotationDrag = (
  enabled: boolean,
  onAnnotationAdd?: (annotation: Omit<PDFAnnotation, 'id' | 'timestamp'>) => void
) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLElement>(null);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (!enabled || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setDragStart({ x, y });
    setIsDragging(true);
  }, [enabled]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging || !dragStart || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setDragEnd({ x, y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback((event: React.MouseEvent) => {
    if (!isDragging || !dragStart || !dragEnd || !onAnnotationAdd) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    const minX = Math.min(dragStart.x, dragEnd.x);
    const minY = Math.min(dragStart.y, dragEnd.y);
    const width = Math.abs(dragEnd.x - dragStart.x);
    const height = Math.abs(dragEnd.y - dragStart.y);

    // Only create annotation if drag area is significant
    if (width > 10 && height > 10) {
      onAnnotationAdd({
        pageNumber: 0, // This should be set based on current page
        x: minX,
        y: minY,
        width,
        height,
        content: 'New annotation',
        color: { r: 255, g: 255, b: 0 },
        type: 'annotation'
      });
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, onAnnotationAdd]);

  const dragRect = dragStart && dragEnd ? {
    x: Math.min(dragStart.x, dragEnd.x),
    y: Math.min(dragStart.y, dragEnd.y),
    width: Math.abs(dragEnd.x - dragStart.x),
    height: Math.abs(dragEnd.y - dragStart.y)
  } : null;

  return {
    containerRef,
    isDragging,
    dragRect,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  };
};
