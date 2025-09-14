import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { ElementHighlight } from './types';
import { applyHighlights, triggerHighlightAnimations } from './utils';

interface HtmlContentRendererProps {
  html: string;
  highlights: ElementHighlight[];
  newHighlights?: ElementHighlight[];
  isPreview?: boolean;
  animateHighlights?: boolean;
  onAnimationComplete?: () => void;
}

export const HtmlContentRenderer: React.FC<HtmlContentRendererProps> = ({
  html,
  highlights,
  newHighlights = [],
  isPreview = false,
  animateHighlights = false,
  onAnimationComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousHighlightsRef = useRef<ElementHighlight[]>([]);
  const appliedHighlightsRef = useRef<Set<string>>(new Set());
  
  // Apply highlights directly to DOM elements to avoid re-rendering existing ones
  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const currentHighlightKeys = highlights.map(h => `${h.elementType}-${h.elementIndex}`);
    const appliedKeys = appliedHighlightsRef.current;
    
    // Find new highlights that haven't been applied yet
    const newHighlightsToApply = highlights.filter(h => {
      const key = `${h.elementType}-${h.elementIndex}`;
      return !appliedKeys.has(key);
    });
    
    if (newHighlightsToApply.length === 0) return;
    
    console.log(`🎨 [HtmlContentRenderer] Applying ${newHighlightsToApply.length} new highlights via DOM:`, newHighlightsToApply);
    
    // Apply each new highlight directly to the DOM
    newHighlightsToApply.forEach((highlight, index) => {
      const { elementType, elementIndex, color, comment } = highlight;
      
      // Find the target element using data attributes
      const targetElement = container.querySelector(
        `[data-element-type="${elementType}"][data-element-index="${elementIndex}"]`
      ) as HTMLElement;
      
      if (targetElement) {
        // Build CSS classes for highlighting
        const baseClasses = ['docx-highlight-base', `docx-highlight-${color}`];
        
        // Add animation classes if this is a new highlight and animation is enabled
        const isNewHighlight = newHighlights.some(newH => 
          newH.elementType === elementType && newH.elementIndex === elementIndex
        );
        
        if (animateHighlights && isNewHighlight) {
          baseClasses.push('animate');
          // Add staggered delay for multiple new highlights
          const newHighlightIndex = newHighlights.findIndex(newH => 
            newH.elementType === elementType && newH.elementIndex === elementIndex
          );
          if (newHighlightIndex !== -1 && newHighlightIndex < 10) {
            baseClasses.push(`docx-highlight-delay-${newHighlightIndex}`);
          }
        } else {
          // If not animating, show complete state immediately
          baseClasses.push('complete');
        }
        
        // Add comment indicator class
        if (comment) {
          baseClasses.push('docx-highlight-with-comment');
        }
        
        // Apply classes to the element
        const existingClasses = targetElement.className.split(' ').filter(cls => 
          !cls.startsWith('docx-highlight')
        );
        targetElement.className = [...existingClasses, ...baseClasses].join(' ');
        
        // Add highlight data attributes
        targetElement.setAttribute('data-highlight-color', color);
        targetElement.setAttribute('data-highlight-id', `${elementType}-${elementIndex}`);
        if (comment) {
          targetElement.setAttribute('data-highlight-comment', comment);
        }
        if (animateHighlights && isNewHighlight) {
          targetElement.setAttribute('data-highlight-animated', 'true');
        }
        
        // Mark this highlight as applied
        appliedHighlightsRef.current.add(`${elementType}-${elementIndex}`);
        
        console.log(`✅ Applied highlight to ${elementType} #${elementIndex}`);
      } else {
        // Log a more detailed error message with available elements for debugging
        const availableElements = container.querySelectorAll(`[data-element-type="${elementType}"]`);
        const availableIndices = Array.from(availableElements).map(el => el.getAttribute('data-element-index')).join(', ');
        console.warn(`⚠️ Could not find element for ${elementType} #${elementIndex}. Available ${elementType} indices: [${availableIndices}]`);
        
        // Don't mark as applied since the element wasn't found
        // This will prevent infinite retries but also won't block future attempts
      }
    });
    
    // Trigger animation completion callback if needed
    if (animateHighlights && newHighlightsToApply.some(h => 
      newHighlights.some(newH => newH.elementType === h.elementType && newH.elementIndex === h.elementIndex)
    )) {
      const animatedCount = newHighlightsToApply.filter(h => 
        newHighlights.some(newH => newH.elementType === h.elementType && newH.elementIndex === h.elementIndex)
      ).length;
      
      if (onAnimationComplete && animatedCount > 0) {
        const totalDelay = animatedCount * 100 + 800; // stagger + animation duration (0.8s)
        setTimeout(onAnimationComplete, totalDelay);
      }
    }
    
  }, [highlights, newHighlights, animateHighlights, onAnimationComplete]);
  
  // Clean up applied highlights when highlights array changes (removals)
  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const currentKeys = new Set(highlights.map(h => `${h.elementType}-${h.elementIndex}`));
    const appliedKeys = appliedHighlightsRef.current;
    
    // Find highlights that were removed
    const removedKeys = Array.from(appliedKeys).filter(key => !currentKeys.has(key));
    
    if (removedKeys.length > 0) {
      console.log(`🧹 [HtmlContentRenderer] Removing ${removedKeys.length} highlights:`, removedKeys);
      
      removedKeys.forEach(key => {
        const [elementType, elementIndex] = key.split('-');
        const targetElement = container.querySelector(
          `[data-element-type="${elementType}"][data-element-index="${elementIndex}"]`
        ) as HTMLElement;
        
        if (targetElement) {
          // Remove highlight classes
          const existingClasses = targetElement.className.split(' ').filter(cls => 
            !cls.startsWith('docx-highlight')
          );
          targetElement.className = existingClasses.join(' ');
          
          // Remove highlight data attributes
          targetElement.removeAttribute('data-highlight-color');
          targetElement.removeAttribute('data-highlight-id');
          targetElement.removeAttribute('data-highlight-comment');
          targetElement.removeAttribute('data-highlight-animated');
        }
        
        // Remove from applied set
        appliedKeys.delete(key);
      });
    }
  }, [highlights]);

  const renderHtmlContent = (html: string) => {
    // No longer apply highlights via HTML manipulation - they're applied via DOM directly
    // This prevents re-rendering of existing highlights when new ones are added
    
    return (
      <Box
        component="div"
        ref={containerRef}
        sx={{
          // Typography styles
          fontSize: '0.875rem',
          lineHeight: 1.6,
          color: 'text.primary',
          
          // Paragraph styles
          '& p': { 
            margin: '0.75em 0', 
            lineHeight: 1.6,
            '&:first-of-type': { marginTop: 0 },
            '&:last-of-type': { marginBottom: 0 }
          },
          
          // Heading styles with hierarchy
          '& h1': { 
            fontSize: '1.5em', 
            fontWeight: 700, 
            margin: '1.2em 0 0.6em 0',
            color: 'primary.main',
            borderBottom: '2px solid',
            borderColor: 'primary.light',
            paddingBottom: '0.3em'
          },
          '& h2': { 
            fontSize: '1.3em', 
            fontWeight: 600, 
            margin: '1.1em 0 0.5em 0',
            color: 'primary.main'
          },
          '& h3': { 
            fontSize: '1.2em', 
            fontWeight: 600, 
            margin: '1em 0 0.4em 0',
            color: 'text.primary'
          },
          '& h4, & h5, & h6': { 
            fontSize: '1.1em', 
            fontWeight: 600, 
            margin: '0.9em 0 0.3em 0',
            color: 'text.primary'
          },
          
          // List styles
          '& ul, & ol': { 
            margin: '0.75em 0', 
            paddingLeft: '1.5em',
            '& ul, & ol': { margin: '0.25em 0' } // Nested lists
          },
          '& li': { 
            margin: '0.25em 0',
            lineHeight: 1.5
          },
          
          // Text formatting
          '& strong, & b': { fontWeight: 700 },
          '& em, & i': { fontStyle: 'italic' },
          '& u': { textDecoration: 'underline' },
          '& s, & strike': { textDecoration: 'line-through' },
          '& sup': { verticalAlign: 'super', fontSize: '0.8em' },
          '& sub': { verticalAlign: 'sub', fontSize: '0.8em' },
          
          // Link styles
          '& a': {
            color: 'primary.main',
            textDecoration: 'underline',
            '&:hover': {
              color: 'primary.dark',
              textDecoration: 'none'
            }
          },
          
          // Table styles
          '& table': { 
            borderCollapse: 'collapse', 
            width: '100%', 
            margin: '1em 0',
            border: '1px solid',
            borderColor: 'divider',
            fontSize: '0.9em'
          },
          '& thead': {
            backgroundColor: 'action.hover'
          },
          '& th': { 
            padding: '0.75em 0.5em', 
            border: '1px solid',
            borderColor: 'divider',
            textAlign: 'left',
            fontWeight: 600,
            backgroundColor: 'action.hover'
          },
          '& td': { 
            padding: '0.5em', 
            border: '1px solid',
            borderColor: 'divider',
            textAlign: 'left',
            verticalAlign: 'top'
          },
          '& tr:nth-of-type(even)': {
            backgroundColor: 'action.hover'
          },
          
          // Block elements
          '& blockquote': {
            margin: '1em 0',
            padding: '0.5em 1em',
            borderLeft: '4px solid',
            borderColor: 'primary.light',
            backgroundColor: 'action.hover',
            fontStyle: 'italic'
          },
          
          // Code styles
          '& code': {
            fontFamily: 'monospace',
            backgroundColor: 'action.hover',
            padding: '0.2em 0.4em',
            borderRadius: '3px',
            fontSize: '0.9em'
          },
          '& pre': {
            fontFamily: 'monospace',
            backgroundColor: 'action.hover',
            padding: '1em',
            borderRadius: '4px',
            overflow: 'auto',
            margin: '1em 0'
          },
          
          // Line breaks
          '& br': { lineHeight: 1.6 },
          
          // Images (if any)
          '& img': {
            maxWidth: '100%',
            height: 'auto',
            margin: '0.5em 0',
            borderRadius: '4px',
            border: '1px solid',
            borderColor: 'divider'
          },
          
          // Footnotes and comments styling
          '& .footnote, & .endnote': {
            fontSize: '0.8em',
            color: 'text.secondary',
            borderTop: '1px solid',
            borderColor: 'divider',
            paddingTop: '0.5em',
            marginTop: '1em'
          },
          
          // Text boxes
          '& .textbox': {
            border: '1px solid',
            borderColor: 'divider',
            padding: '1em',
            margin: '1em 0',
            backgroundColor: 'background.paper',
            borderRadius: '4px'
          },
          
          // Note: Highlight styles are now handled by animations.css and applied via DOM
          // This allows for more complex animations and better performance without re-rendering
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  return renderHtmlContent(html);
};
