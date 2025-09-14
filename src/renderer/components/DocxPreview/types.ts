export interface DocxContent {
  text: string;
  html: string;
  wordCount: number;
  characterCount: number;
  filename?: string;
  elementCounts?: {
    paragraph: number;
    heading1: number;
    heading2: number;
    heading3: number;
    heading4: number;
    heading5: number;
    heading6: number;
    list: number;
    listItem: number;
    table: number;
    tableRow: number;
    tableCell: number;
  };
}

export interface ElementHighlight {
  elementType: string; // e.g., 'paragraph', 'heading1', etc.
  elementIndex: number; // 0-based index within that element type
  color: 'red' | 'green' | 'yellow';
  comment?: string;
}

export interface DocxPreviewRef {
  addHighlight: (elementType: string, elementIndex: number, color: 'red' | 'green' | 'yellow', comment?: string) => void;
  clearHighlights: () => void;
  toggleAnimations: () => void;
  setAnimationMode: (animate: boolean) => void;
}

export interface DocxPreviewProps {
  content: DocxContent;
  maxPreviewLength?: number;
  showStats?: boolean;
  showHoverPreview?: boolean;
  showDebugInfo?: boolean;
  variant?: 'compact' | 'full';
  highlights?: ElementHighlight[];
  showTestButton?: boolean;
  showToggleButton?: boolean; // Control whether to show the preview/full toggle
  tooltipMode?: 'default' | 'comment-only'; // Control tooltip content display mode
  onHighlightAdd?: (highlight: ElementHighlight) => void; // Callback for adding highlights
  sx?: any;
}

export interface ElementHoverState {
  element: { 
    type: string; 
    details: string;
    debugInfo?: {
      tagName: string;
      attributes: {
        'data-element-type': string | null;
        'data-element-index': string | null;
        'data-paragraph-index': string | null;
      };
      rect: {
        left: number;
        top: number;
        width: number;
        height: number;
      };
      textContent: string;
    };
  };
  position: { x: number; y: number };
  highlightInfo?: {
    comment: string;
    color: 'red' | 'green';
  };
}

export interface ElementTypeInfo {
  type: string;
  details: string;
}
