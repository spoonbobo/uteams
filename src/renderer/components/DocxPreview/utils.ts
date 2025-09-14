import { ElementHighlight, ElementTypeInfo } from './types';

// Import CSS animations
import './animations.css';

// Element type mapping for tooltips with detailed info
export const getElementType = (tagName: string, element: HTMLElement): ElementTypeInfo => {
  const tag = tagName.toLowerCase();
  let type = '';
  let details = '';
  
  // Get element text content for context
  const textContent = element.textContent?.trim().substring(0, 50) || '';
  const hasText = textContent.length > 0;
  
  // Get element attributes for additional context
  const className = element.className || '';
  const id = element.id || '';
  
  // Get custom mammoth indexing attributes
  const elementType = element.getAttribute('data-element-type') || '';
  const elementIndex = element.getAttribute('data-element-index') || '';
  const paragraphIndex = element.getAttribute('data-paragraph-index') || '';
  
  // Create index information
  let indexInfo = '';
  if (elementType && elementIndex) {
    indexInfo = `[${elementType}${elementIndex}]`;
    if (paragraphIndex && elementType.startsWith('heading')) {
      indexInfo += ` [paragraph${paragraphIndex}]`;
    }
  }
  
  switch (tag) {
    case 'h1': 
      type = 'Heading 1';
      details = `${indexInfo} ${hasText ? `"${textContent}${textContent.length >= 50 ? '...' : ''}"` : 'Empty heading'}`.trim();
      break;
    case 'h2': 
      type = 'Heading 2';
      details = `${indexInfo} ${hasText ? `"${textContent}${textContent.length >= 50 ? '...' : ''}"` : 'Empty heading'}`.trim();
      break;
    case 'h3': 
      type = 'Heading 3';
      details = `${indexInfo} ${hasText ? `"${textContent}${textContent.length >= 50 ? '...' : ''}"` : 'Empty heading'}`.trim();
      break;
    case 'h4': 
      type = 'Heading 4';
      details = `${indexInfo} ${hasText ? `"${textContent}${textContent.length >= 50 ? '...' : ''}"` : 'Empty heading'}`.trim();
      break;
    case 'h5': 
      type = 'Heading 5';
      details = `${indexInfo} ${hasText ? `"${textContent}${textContent.length >= 50 ? '...' : ''}"` : 'Empty heading'}`.trim();
      break;
    case 'h6': 
      type = 'Heading 6';
      details = `${indexInfo} ${hasText ? `"${textContent}${textContent.length >= 50 ? '...' : ''}"` : 'Empty heading'}`.trim();
      break;
    case 'p': 
      type = 'Paragraph';
      details = `${indexInfo} ${hasText ? `${textContent.split(' ').length} words` : 'Empty paragraph'}`.trim();
      break;
    case 'ul': 
      type = 'Unordered List';
      details = `${indexInfo} ${element.children.length} items`.trim();
      break;
    case 'ol': 
      type = 'Ordered List';
      details = `${indexInfo} ${element.children.length} items`.trim();
      break;
    case 'li': 
      type = 'List Item';
      details = `${indexInfo} ${hasText ? `"${textContent}${textContent.length >= 50 ? '...' : ''}"` : 'Empty item'}`.trim();
      break;
    case 'table': 
      type = 'Table';
      const rows = element.querySelectorAll('tr').length;
      const cols = element.querySelector('tr')?.children.length || 0;
      details = `${indexInfo} ${rows} rows × ${cols} columns`.trim();
      break;
    case 'thead': 
      type = 'Table Header';
      details = `${indexInfo} ${element.children.length} rows`.trim();
      break;
    case 'tbody': 
      type = 'Table Body';
      details = `${indexInfo} ${element.children.length} rows`.trim();
      break;
    case 'tr': 
      type = 'Table Row';
      details = `${indexInfo} ${element.children.length} cells`.trim();
      break;
    case 'th': 
      type = 'Table Header Cell';
      details = `${indexInfo} ${hasText ? `"${textContent}${textContent.length >= 50 ? '...' : ''}"` : 'Empty header'}`.trim();
      break;
    case 'td': 
      type = 'Table Cell';
      details = `${indexInfo} ${hasText ? `"${textContent}${textContent.length >= 50 ? '...' : ''}"` : 'Empty cell'}`.trim();
      break;
    case 'blockquote': 
      type = 'Quote Block';
      details = `${indexInfo} ${hasText ? `${textContent.split(' ').length} words` : 'Empty quote'}`.trim();
      break;
    case 'pre': 
      type = 'Code Block';
      details = `${indexInfo} ${textContent.split('\n').length} lines`.trim();
      break;
    case 'code': 
      type = 'Inline Code';
      details = `${indexInfo} ${hasText ? `"${textContent}"` : 'Empty code'}`.trim();
      break;
    case 'strong':
    case 'b': 
      type = 'Bold Text';
      details = `${indexInfo} ${hasText ? `"${textContent}"` : 'Empty bold'}`.trim();
      break;
    case 'em':
    case 'i': 
      type = 'Italic Text';
      details = `${indexInfo} ${hasText ? `"${textContent}"` : 'Empty italic'}`.trim();
      break;
    case 'u': 
      type = 'Underlined Text';
      details = `${indexInfo} ${hasText ? `"${textContent}"` : 'Empty underline'}`.trim();
      break;
    case 's':
    case 'strike': 
      type = 'Strikethrough Text';
      details = `${indexInfo} ${hasText ? `"${textContent}"` : 'Empty strikethrough'}`.trim();
      break;
    case 'sup': 
      type = 'Superscript';
      details = `${indexInfo} ${hasText ? `"${textContent}"` : 'Empty superscript'}`.trim();
      break;
    case 'sub': 
      type = 'Subscript';
      details = `${indexInfo} ${hasText ? `"${textContent}"` : 'Empty subscript'}`.trim();
      break;
    case 'a': 
      type = 'Link';
      const href = element.getAttribute('href') || '';
      details = `${indexInfo} ${href ? `→ ${href.substring(0, 40)}${href.length > 40 ? '...' : ''}` : 'No URL'}`.trim();
      break;
    case 'img': 
      type = 'Image';
      const alt = element.getAttribute('alt') || '';
      const src = element.getAttribute('src') || '';
      details = `${indexInfo} ${alt || src.split('/').pop() || 'No description'}`.trim();
      break;
    case 'br': 
      type = 'Line Break';
      details = `${indexInfo} Single line break`.trim();
      break;
    case 'div': 
      if (element.classList.contains('footnote')) {
        type = 'Footnote';
        details = `${indexInfo} ${hasText ? `"${textContent}${textContent.length >= 50 ? '...' : ''}"` : 'Empty footnote'}`.trim();
      } else if (element.classList.contains('endnote')) {
        type = 'Endnote';
        details = `${indexInfo} ${hasText ? `"${textContent}${textContent.length >= 50 ? '...' : ''}"` : 'Empty endnote'}`.trim();
      } else if (element.classList.contains('textbox')) {
        type = 'Text Box';
        details = `${indexInfo} ${hasText ? `${textContent.split(' ').length} words` : 'Empty text box'}`.trim();
      } else {
        type = 'Division';
        details = `${indexInfo} ${className ? `class: ${className}` : (id ? `id: ${id}` : 'Generic container')}`.trim();
      }
      break;
    default: 
      type = `${tag.toUpperCase()} Element`;
      details = `${indexInfo} ${hasText ? `"${textContent}${textContent.length >= 50 ? '...' : ''}"` : 'Custom element'}`.trim();
  }
  
  return { type, details };
};

// Function to apply highlights to HTML content using CSS classes with animation support
export const applyHighlights = (html: string, highlights: ElementHighlight[], options?: {
  animate?: boolean;
  staggerDelay?: boolean;
  animationDelay?: number;
}): string => {
  let processedHtml = html;
  const { animate = false, staggerDelay = true, animationDelay = 0 } = options || {};
  
  highlights.forEach((highlight, index) => {
    const { elementType, elementIndex, color, comment } = highlight;
    
    // Create data attribute selector for the specific element
    const dataElementType = `data-element-type="${elementType}"`;
    const dataElementIndex = `data-element-index="${elementIndex}"`;
    
    // Find elements with both attributes
    const regex = new RegExp(
      `(<[^>]*${dataElementType}[^>]*${dataElementIndex}[^>]*>)`,
      'gi'
    );
    
    processedHtml = processedHtml.replace(regex, (match) => {
      // Extract the tag name and attributes
      const tagMatch = match.match(/<(\w+)([^>]*)>/);
      if (!tagMatch) return match;
      
      const [, tagName, attributes] = tagMatch;
      
      // Build CSS classes for highlighting
      const baseClasses = ['docx-highlight-base', `docx-highlight-${color}`];
      
      // Add animation classes if requested
      if (animate) {
        baseClasses.push('animate');
        
        // Add staggered delay for multiple highlights
        if (staggerDelay && index < 10) {
          baseClasses.push(`docx-highlight-delay-${index}`);
        }
      } else {
        // If not animating, show complete state immediately
        baseClasses.push('complete');
      }
      
      // Add comment indicator class
      if (comment) {
        baseClasses.push('docx-highlight-with-comment');
      }
      
      // Combine with existing classes
      const existingClass = attributes.match(/class="([^"]*)"/)?.[1] || '';
      const allClasses = existingClass ? `${existingClass} ${baseClasses.join(' ')}` : baseClasses.join(' ');
      
      // Add highlight data attributes
      const commentAttr = comment ? ` data-highlight-comment="${comment.replace(/"/g, '&quot;')}"` : '';
      const highlightAttr = ` data-highlight-color="${color}" data-highlight-id="${elementType}-${elementIndex}"`;
      const animationAttr = animate ? ` data-highlight-animated="true"` : '';
      
      // Reconstruct the opening tag with class and data attributes
      const cleanAttributes = attributes.replace(/class="[^"]*"/, '').trim();
      return `<${tagName}${cleanAttributes ? ' ' + cleanAttributes : ''} class="${allClasses}"${highlightAttr}${commentAttr}${animationAttr}>`;
    });
  });
  
  return processedHtml;
};

// Function to trigger highlight animations after DOM update
export const triggerHighlightAnimations = (containerElement: HTMLElement, highlights: ElementHighlight[]) => {
  if (!containerElement) return;
  
  highlights.forEach((highlight, index) => {
    const { elementType, elementIndex } = highlight;
    const selector = `[data-highlight-id="${elementType}-${elementIndex}"]`;
    const element = containerElement.querySelector(selector) as HTMLElement;
    
    if (element) {
      // Remove any existing animation classes
      element.classList.remove('animate', 'complete');
      
      // Force reflow
      element.offsetHeight;
      
      // Add animation class with delay
      setTimeout(() => {
        element.classList.add('animate');
        
        // Mark as complete when animation finishes
        setTimeout(() => {
          element.classList.remove('animate');
          element.classList.add('complete');
        }, 800); // Match CSS animation duration (0.8s)
      }, index * 100); // Stagger animations
    }
  });
};

// Function to add pulse effect to newly added highlights
export const pulseNewHighlights = (containerElement: HTMLElement, newHighlights: ElementHighlight[]) => {
  if (!containerElement) return;
  
  newHighlights.forEach(highlight => {
    const { elementType, elementIndex } = highlight;
    const selector = `[data-highlight-id="${elementType}-${elementIndex}"]`;
    const element = containerElement.querySelector(selector) as HTMLElement;
    
    if (element) {
      element.classList.add('docx-highlight-pulse');
      
      // Remove pulse class after animation
      setTimeout(() => {
        element.classList.remove('docx-highlight-pulse');
      }, 1000); // 0.5s * 2 iterations
    }
  });
};

export const renderFormattedContent = (text: string, isPreview = false) => {
  // Fallback for plain text when HTML is not available
  let formattedText = text;
  
  // Replace common HTML entities
  formattedText = formattedText
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  // Clean up excessive whitespace
  formattedText = formattedText
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Multiple newlines to double
    .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
    .trim();

  // Do not string-truncate; rely on container height + mask fade

  return formattedText;
};
