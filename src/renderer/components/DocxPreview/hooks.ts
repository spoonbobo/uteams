import { useState, useEffect, useRef } from 'react';
import { ElementHoverState } from './types';
import { getElementType } from './utils';

// Hook for handling overflow detection
export const useOverflowDetection = (showFullContent: boolean, contentHtml: string, contentText: string) => {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const checkOverflow = () => {
      setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
    };

    // Initial check after paint
    const raf = requestAnimationFrame(checkOverflow);

    // Observe size/content changes
    let resizeObserver: ResizeObserver | undefined;
    if (typeof window !== 'undefined' && (window as any).ResizeObserver) {
      const ro: ResizeObserver = new (window as any).ResizeObserver(checkOverflow);
      ro.observe(el);
      resizeObserver = ro;
    } else {
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', checkOverflow);
      }
      const interval = setInterval(checkOverflow, 300);
      return () => {
        cancelAnimationFrame(raf);
        if (typeof window !== 'undefined') {
          window.removeEventListener('resize', checkOverflow);
        }
        clearInterval(interval);
      };
    }

    return () => {
      cancelAnimationFrame(raf);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [showFullContent, contentHtml, contentText]);

  return { isOverflowing, contentRef };
};

// Hook for handling mouse events and element hover detection
export const useElementHover = (showFullContent: boolean, contentHtml: string, contentRef: React.RefObject<HTMLDivElement>) => {
  const [elementHover, setElementHover] = useState<ElementHoverState | null>(null);

  useEffect(() => {
    let currentElement: HTMLElement | null = null;
    let lastUpdateTime = 0;
    const throttleDelay = 16; // ~60fps for smooth tooltip following

    const handleMouseMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const contentElement = contentRef.current;
      
      if (!target || !contentElement?.contains(target) || target === contentElement) {
        return;
      }

      // Find the most specific element with data attributes
      let targetElement = target;
      
      // Look for element with data-element-type (content element)
      while (targetElement && !targetElement.getAttribute('data-element-type')) {
        targetElement = targetElement.parentElement as HTMLElement;
        if (!targetElement || !contentElement?.contains(targetElement)) {
          targetElement = target; // Fallback to original target
          break;
        }
      }

      // Skip division elements from hover
      if (targetElement.tagName.toLowerCase() === 'div') {
        return;
      }
      
      // Check if this specific element has highlight information
      const highlightComment = targetElement.getAttribute('data-highlight-comment');
      const highlightColor = targetElement.getAttribute('data-highlight-color');
      const highlightId = targetElement.getAttribute('data-highlight-id');
      
      const highlightInfo = highlightComment ? {
        comment: highlightComment,
        color: highlightColor as 'red' | 'green',
        id: highlightId
      } : null;

      // Only update if we're on a different element or enough time has passed for position updates
      const now = Date.now();
      const elementChanged = currentElement !== targetElement;
      const shouldUpdatePosition = now - lastUpdateTime >= throttleDelay;

      if (elementChanged || shouldUpdatePosition) {
        currentElement = targetElement;
        lastUpdateTime = now;

        const rect = targetElement.getBoundingClientRect();
        const elementInfo = getElementType(targetElement.tagName, targetElement);
        
        // For highlighted elements, override the element info with highlight-specific data
        let finalElementInfo = elementInfo;
        if (highlightInfo && highlightInfo.comment && highlightInfo.color) {
          const elementType = targetElement.getAttribute('data-element-type');
          const elementIndex = targetElement.getAttribute('data-element-index');
          
          if (elementType && elementIndex) {
            finalElementInfo = {
              type: `Highlighted ${elementType.charAt(0).toUpperCase() + elementType.slice(1)}`,
              details: `Index: ${elementIndex} (${highlightInfo.color} highlight)`
            };
          }
        }
        
        // Use mouse position for accurate tooltip placement
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        
        setElementHover({
          element: {
            ...finalElementInfo,
            debugInfo: {
              tagName: targetElement.tagName,
              attributes: {
                'data-element-type': targetElement.getAttribute('data-element-type'),
                'data-element-index': targetElement.getAttribute('data-element-index'),
                'data-paragraph-index': targetElement.getAttribute('data-paragraph-index')
              },
              rect: {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
              },
              textContent: targetElement.textContent?.substring(0, 100) || ''
            }
          },
          position: {
            x: mouseX,
            y: mouseY - 15 // Small offset above mouse cursor
          },
          // Add highlight information to hover state
          highlightInfo: highlightInfo && highlightInfo.comment ? {
            comment: highlightInfo.comment,
            color: highlightInfo.color
          } : undefined
        });
      }
    };

    const handleMouseLeave = (event: MouseEvent) => {
      currentElement = null;
      const target = event.target as HTMLElement;
      const relatedTarget = event.relatedTarget as HTMLElement;
      const contentElement = contentRef.current;
      
      // Only hide tooltip if we're leaving the content area entirely
      if (!contentElement?.contains(relatedTarget)) {
        setElementHover(null);
      }
    };

    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener('mousemove', handleMouseMove);
      contentElement.addEventListener('mouseleave', handleMouseLeave);
      
      return () => {
        contentElement.removeEventListener('mousemove', handleMouseMove);
        contentElement.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [showFullContent, contentHtml, contentRef]);

  return { elementHover, setElementHover };
};
