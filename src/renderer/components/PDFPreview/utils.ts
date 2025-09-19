import { PDFInfo, PDFAnnotation } from './types';

/**
 * Format file size to human readable string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Format PDF dimensions to readable string
 */
export const formatDimensions = (width: number, height: number): string => {
  return `${Math.round(width)} × ${Math.round(height)} pts`;
};

/**
 * Get standard page size name if it matches common formats
 */
export const getPageSizeName = (width: number, height: number): string | null => {
  const tolerance = 5; // Allow small variations

  const standardSizes = [
    { name: 'A4', width: 595, height: 842 },
    { name: 'A3', width: 842, height: 1191 },
    { name: 'A5', width: 420, height: 595 },
    { name: 'Letter', width: 612, height: 792 },
    { name: 'Legal', width: 612, height: 1008 },
    { name: 'Tabloid', width: 792, height: 1224 },
  ];

  for (const size of standardSizes) {
    if (
      Math.abs(width - size.width) <= tolerance &&
      Math.abs(height - size.height) <= tolerance
    ) {
      return size.name;
    }
    // Check rotated orientation
    if (
      Math.abs(width - size.height) <= tolerance &&
      Math.abs(height - size.width) <= tolerance
    ) {
      return `${size.name} (Landscape)`;
    }
  }

  return null;
};

/**
 * Format date to readable string
 */
export const formatDate = (dateString?: string): string => {
  if (!dateString) return 'Unknown';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid date';
  }
};

/**
 * Generate PDF info summary text
 */
export const generatePDFSummary = (info: PDFInfo): string => {
  const parts = [
    `${info.pageCount} page${info.pageCount !== 1 ? 's' : ''}`,
    formatFileSize(info.fileSize)
  ];

  const pageSize = getPageSizeName(
    info.firstPageDimensions.width,
    info.firstPageDimensions.height
  );
  if (pageSize) {
    parts.push(pageSize);
  }

  if (info.author) {
    parts.push(`by ${info.author}`);
  }

  return parts.join(' • ');
};

/**
 * Calculate optimal scale for fitting PDF page to container
 */
export const calculateFitScale = (
  pageWidth: number,
  pageHeight: number,
  containerWidth: number,
  containerHeight: number,
  fitMode: 'width' | 'height' | 'page' = 'width'
): number => {
  const padding = 40; // Account for padding
  const availableWidth = containerWidth - padding;
  const availableHeight = containerHeight - padding;

  const scaleX = availableWidth / pageWidth;
  const scaleY = availableHeight / pageHeight;

  switch (fitMode) {
    case 'width':
      return scaleX;
    case 'height':
      return scaleY;
    case 'page':
      return Math.min(scaleX, scaleY);
    default:
      return scaleX;
  }
};

/**
 * Convert page coordinates to screen coordinates
 */
export const pageToScreenCoords = (
  pageX: number,
  pageY: number,
  pageWidth: number,
  pageHeight: number,
  scale: number,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } => {
  const scaledWidth = pageWidth * scale;
  const scaledHeight = pageHeight * scale;

  // Center the page in the container
  const offsetX = (containerWidth - scaledWidth) / 2;
  const offsetY = (containerHeight - scaledHeight) / 2;

  return {
    x: offsetX + (pageX * scale),
    y: offsetY + (pageY * scale)
  };
};

/**
 * Convert screen coordinates to page coordinates
 */
export const screenToPageCoords = (
  screenX: number,
  screenY: number,
  pageWidth: number,
  pageHeight: number,
  scale: number,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } => {
  const scaledWidth = pageWidth * scale;
  const scaledHeight = pageHeight * scale;

  // Center the page in the container
  const offsetX = (containerWidth - scaledWidth) / 2;
  const offsetY = (containerHeight - scaledHeight) / 2;

  return {
    x: (screenX - offsetX) / scale,
    y: (screenY - offsetY) / scale
  };
};

/**
 * Validate annotation bounds within page
 */
export const validateAnnotationBounds = (
  annotation: Omit<PDFAnnotation, 'id' | 'timestamp'>,
  pageWidth: number,
  pageHeight: number
): boolean => {
  return (
    annotation.x >= 0 &&
    annotation.y >= 0 &&
    annotation.x + annotation.width <= pageWidth &&
    annotation.y + annotation.height <= pageHeight
  );
};

/**
 * Get annotation color as CSS color string
 */
export const getAnnotationColor = (
  color: { r: number; g: number; b: number },
  alpha = 0.3
): string => {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
};

/**
 * Get annotation border color (darker version)
 */
export const getAnnotationBorderColor = (
  color: { r: number; g: number; b: number }
): string => {
  return `rgb(${Math.max(0, color.r - 50)}, ${Math.max(0, color.g - 50)}, ${Math.max(0, color.b - 50)})`;
};

/**
 * Generate unique filename for PDF exports
 */
export const generateExportFilename = (
  originalFilename: string,
  suffix: string
): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const baseName = originalFilename.replace(/\.pdf$/i, '');
  return `${baseName}_${suffix}_${timestamp}.pdf`;
};

/**
 * Debounce function for performance optimization
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function for performance optimization
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Check if PDF supports text extraction
 */
export const supportsTextExtraction = (info: PDFInfo): boolean => {
  // This is a simple heuristic - in a real implementation,
  // you might want to check the PDF structure more thoroughly
  return info.pageCount > 0;
};

/**
 * Get zoom level options for dropdown
 */
export const getZoomLevels = (): Array<{ value: number; label: string }> => {
  return [
    { value: 0.25, label: '25%' },
    { value: 0.5, label: '50%' },
    { value: 0.75, label: '75%' },
    { value: 1.0, label: '100%' },
    { value: 1.25, label: '125%' },
    { value: 1.5, label: '150%' },
    { value: 2.0, label: '200%' },
    { value: 3.0, label: '300%' },
  ];
};

/**
 * Format page number for display
 */
export const formatPageNumber = (current: number, total: number): string => {
  return `${current + 1} of ${total}`;
};

/**
 * Check if browser supports PDF viewing
 */
export const supportsPDFViewing = (): boolean => {
  // Check if we're in an Electron environment with our PDF handlers
  return !!(window as any).electron?.ipcRenderer;
};

/**
 * Generate annotation summary for accessibility
 */
export const getAnnotationSummary = (annotations: PDFAnnotation[]): string => {
  const count = annotations.length;
  if (count === 0) return 'No annotations';
  if (count === 1) return '1 annotation';
  return `${count} annotations`;
};
