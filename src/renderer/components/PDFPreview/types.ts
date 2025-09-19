export interface PDFInfo {
  filePath: string;
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  firstPageDimensions: {
    width: number;
    height: number;
  };
  fileSize: number;
}

export interface PDFPageInfo {
  pageNumber: number;
  dimensions: {
    width: number;
    height: number;
  };
  originalDimensions: {
    width: number;
    height: number;
  };
  scale: number;
  hasText: boolean;
}

export interface PDFContent {
  info: PDFInfo;
  currentPage: number;
  pages: PDFPageInfo[];
  extractedText?: {
    totalPages: number;
    extractedPages: Array<{
      pageNumber: number;
      dimensions: { width: number; height: number };
      hasText: boolean;
    }>;
  };
}

export interface PDFAnnotation {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: { r: number; g: number; b: number };
  type: 'annotation' | 'text' | 'highlight';
  timestamp: string;
}

export interface PDFPreviewProps {
  content: PDFContent | null;
  loading: boolean;
  error: string | null;
  showControls?: boolean;
  showInfo?: boolean;
  showPageNavigation?: boolean;
  variant?: 'full' | 'compact';
  annotations?: PDFAnnotation[];
  onPageChange?: (pageNumber: number) => void;
  onAnnotationAdd?: (annotation: Omit<PDFAnnotation, 'id' | 'timestamp'>) => void;
  onAnnotationRemove?: (annotationId: string) => void;
  sx?: any;
}

export interface PDFPreviewRef {
  goToPage: (pageNumber: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  addAnnotation: (annotation: Omit<PDFAnnotation, 'id' | 'timestamp'>) => void;
  clearAnnotations: () => void;
}

export interface PDFDialogProps {
  open: boolean;
  onClose: () => void;
  studentName?: string;
  filename?: string;
  filePath: string;
  pdfContent?: PDFContent | null;
  loading?: boolean;
  error?: string | null;
  annotations?: PDFAnnotation[];
  onAnnotationAdd?: (annotation: Omit<PDFAnnotation, 'id' | 'timestamp'>) => void;
}

export interface PDFPreviewHeaderProps {
  content: PDFContent;
  showInfo: boolean;
  showControls: boolean;
  currentPage: number;
  scale: number;
  onPageChange: (pageNumber: number) => void;
  onZoomChange: (scale: number) => void;
  onToggleInfo: () => void;
}

export interface PDFPageRendererProps {
  pageInfo: PDFPageInfo;
  annotations: PDFAnnotation[];
  scale: number;
  isActive: boolean;
  onAnnotationAdd?: (annotation: Omit<PDFAnnotation, 'id' | 'timestamp'>) => void;
}

export type PDFViewMode = 'single' | 'continuous' | 'facing';
export type PDFZoomMode = 'fit-width' | 'fit-page' | 'actual-size' | 'custom';

export interface PDFViewerState {
  currentPage: number;
  scale: number;
  viewMode: PDFViewMode;
  zoomMode: PDFZoomMode;
  showAnnotations: boolean;
  showInfo: boolean;
}
