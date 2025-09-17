import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Popover,
  Divider,
  Chip,
} from '@mui/material';
import { DocxPreviewProps, DocxPreviewRef, ElementHighlight, DocxContent } from './types';
import { useOverflowDetection, useElementHover } from './hooks';
import { renderFormattedContent } from './utils';
import { DocxPreviewHeader } from './DocxPreviewHeader';
import { HtmlContentRenderer } from './HtmlContentRenderer';
import { ElementTooltip } from './ElementTooltip';
import { CompactVariant } from './CompactVariant';
import { useIntl } from 'react-intl';

export const DocxPreview = React.forwardRef<DocxPreviewRef, DocxPreviewProps>(({
  content,
  maxPreviewLength = 500,
  showStats = true,
  showHoverPreview = true,
  showDebugInfo = false,
  variant = 'full',
  highlights = [],
  showTestButton = false,
  showToggleButton = true,
  tooltipMode = 'default',
  onHighlightAdd,
  sx,
}, ref) => {
  const intl = useIntl();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [showFullContent, setShowFullContent] = useState(true);
  const [testHighlights, setTestHighlights] = useState<ElementHighlight[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animateHighlights, setAnimateHighlights] = useState(true);
  const [processedHighlights, setProcessedHighlights] = useState<ElementHighlight[]>([]);
  const [newHighlights, setNewHighlights] = useState<ElementHighlight[]>([]);

  // Custom hooks
  const { isOverflowing, contentRef } = useOverflowDetection(showFullContent, content.html, content.text);
  const { elementHover } = useElementHover(showFullContent, content.html, contentRef);

  const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (showHoverPreview && !showFullContent) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
  };

  const handleToggleFullContent = () => {
    setShowFullContent(!showFullContent);
    setAnchorEl(null);
  };

  // Test button functionality - generates random highlights or clears them
  const handleTestHighlights = () => {
    // If highlights exist, clear them; otherwise generate new ones
    if (testHighlights.length > 0) {
      setTestHighlights([]);
      setIsAnimating(false);
      return;
    }
    
    setIsAnimating(true);

    // Use actual element counts from the document to avoid invalid highlights
    const elementCounts = content.elementCounts;
    if (!elementCounts) {
      console.warn('[DocxPreview] No element counts available for test highlights');
      return;
    }

    const availableElements = [
      { type: 'paragraph', count: elementCounts.paragraph },
      { type: 'heading1', count: elementCounts.heading1 },
      { type: 'heading2', count: elementCounts.heading2 },
      { type: 'heading3', count: elementCounts.heading3 },
    ].filter(e => e.count > 0); // Only include element types that exist

    if (availableElements.length === 0) {
      console.warn('[DocxPreview] No valid elements found for test highlights');
      return;
    }

    const colors: ('red' | 'green' | 'yellow')[] = ['red', 'green', 'yellow'];
    const comments = {
      red: [
        'This needs improvement.',
        'Grammar issue here.',
        'Consider revising this section.',
        'Unclear explanation.',
        'Missing supporting evidence.',
        'Could be more concise.',
        'Awkward phrasing.'
      ],
      green: [
        'Excellent work!',
        'Good opening paragraph!',
        'Clear heading',
        'Well structured.',
        'Great supporting evidence.',
        'Clear and concise.',
        'Excellent analysis!'
      ],
      yellow: [
        'Consider expanding this point.',
        'Could use more detail.',
        'Good start, needs development.',
        'Minor issue here.',
        'Consider alternative phrasing.',
        'Adequate but could be stronger.',
        'Room for improvement.'
      ]
    };

    // Generate 2-4 random highlights based on available elements
    const maxHighlights = Math.min(4, Math.floor(availableElements.reduce((sum, e) => sum + e.count, 0) / 2));
    const numHighlights = Math.floor(Math.random() * (maxHighlights - 1)) + 2;
    const testData: ElementHighlight[] = [];

    for (let i = 0; i < numHighlights; i++) {
      const elementInfo = availableElements[Math.floor(Math.random() * availableElements.length)];
      const elementType = elementInfo.type;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const elementIndex = Math.floor(Math.random() * elementInfo.count); // Use actual count
      const comment = comments[color][Math.floor(Math.random() * comments[color].length)];

      // Avoid duplicate highlights on same element
      const exists = testData.some(h => h.elementType === elementType && h.elementIndex === elementIndex);
      if (!exists) {
        testData.push({ elementType, elementIndex, color, comment });
      }
    }

    console.log('[DocxPreview] Generated test highlights:', testData);
    setTestHighlights(testData);
  };

  // Utility function to add a highlight programmatically
  const addHighlight = (elementType: string, elementIndex: number, color: 'red' | 'green' | 'yellow', comment?: string) => {
    const newHighlight: ElementHighlight = {
      elementType,
      elementIndex,
      color,
      comment
    };
    
    // If callback provided, use it; otherwise add to test highlights
    if (onHighlightAdd) {
      onHighlightAdd(newHighlight);
    } else {
      setTestHighlights(prev => {
        // Remove existing highlight on same element, then add new one
        const filtered = prev.filter(h => !(h.elementType === elementType && h.elementIndex === elementIndex));
        return [...filtered, newHighlight];
      });
    }
  };

  // Clear all test highlights
  const clearHighlights = () => {
    setTestHighlights([]);
    setIsAnimating(false);
  };
  
  // Handle animation completion
  const handleAnimationComplete = () => {
    setIsAnimating(false);
    setNewHighlights([]); // Clear new highlights after animation
  };
  
  // Toggle animation mode
  const toggleAnimations = () => {
    setAnimateHighlights(!animateHighlights);
  };

  // Expose utility functions via ref
  React.useImperativeHandle(ref, () => ({
    addHighlight,
    clearHighlights,
    toggleAnimations,
    setAnimationMode: setAnimateHighlights
  }), [onHighlightAdd, animateHighlights]);

  // Combine prop highlights with test highlights using useMemo to prevent unnecessary re-renders
  const allHighlights = useMemo(() => [...highlights, ...testHighlights], [highlights, testHighlights]);

  // Effect to track new highlights and trigger animations only for them
  useEffect(() => {
    // Find highlights that weren't in the previous processed set
    const currentHighlightKeys = allHighlights.map(h => `${h.elementType}-${h.elementIndex}`);
    const processedHighlightKeys = processedHighlights.map(h => `${h.elementType}-${h.elementIndex}`);
    
    // Check if there are actually changes to avoid unnecessary updates
    const currentHighlightKeysSet = new Set(currentHighlightKeys);
    const processedHighlightKeysSet = new Set(processedHighlightKeys);
    const hasChanges = currentHighlightKeys.length !== processedHighlightKeys.length ||
      !currentHighlightKeys.every(key => processedHighlightKeysSet.has(key));
    
    if (!hasChanges) {
      return; // No changes, exit early
    }
    
    const newHighlightKeys = currentHighlightKeys.filter(key => !processedHighlightKeys.includes(key));
    const newHighlightItems = allHighlights.filter(h => 
      newHighlightKeys.includes(`${h.elementType}-${h.elementIndex}`)
    );
    
    if (newHighlightItems.length > 0) {
      console.log(`🎨 [DocxPreview] Found ${newHighlightItems.length} new highlights:`, newHighlightItems);
      setNewHighlights(newHighlightItems);
      setIsAnimating(true);
    }
    
    // Update processed highlights to current state
    setProcessedHighlights([...allHighlights]);
  }, [allHighlights]); // Remove processedHighlights from dependencies to prevent infinite loop

  const open = Boolean(anchorEl);

  if (variant === 'compact') {
    return (
      <CompactVariant
        content={content}
        showStats={showStats}
        showHoverPreview={showHoverPreview}
        anchorEl={anchorEl}
        open={open}
        onPopoverOpen={handlePopoverOpen}
        onPopoverClose={handlePopoverClose}
        sx={sx}
      />
    );
  }

  return (
    <Box sx={sx}>
      {/* Header with stats and toggle */}
      <DocxPreviewHeader
        content={content}
        showStats={showStats}
        showTestButton={showTestButton}
        showToggleButton={showToggleButton}
        showFullContent={showFullContent}
        testHighlights={testHighlights}
        onToggleFullContent={handleToggleFullContent}
        onTestHighlights={handleTestHighlights}
      />

      {/* Color Legend - Show only if there are highlights */}
      {(highlights.length > 0 || testHighlights.length > 0) && (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2, 
          mb: 2, 
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: 'action.hover'
        }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            {intl.formatMessage({ id: 'grading.ai.legend.title' })}:
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: 1,
                  bgcolor: 'success.main',
                  border: '1px solid',
                  borderColor: 'success.dark'
                }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {intl.formatMessage({ id: 'grading.ai.legend.green' })}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: 1,
                  bgcolor: 'warning.main',
                  border: '1px solid',
                  borderColor: 'warning.dark'
                }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {intl.formatMessage({ id: 'grading.ai.legend.yellow' })}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: 1,
                  bgcolor: 'error.main',
                  border: '1px solid',
                  borderColor: 'error.dark'
                }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {intl.formatMessage({ id: 'grading.ai.legend.red' })}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Content Display */}
      <Box
        className="docx-content-container"
        sx={{ 
          p: 2, 
          maxHeight: showFullContent ? 'none' : 200, 
          overflow: showFullContent ? 'auto' : 'hidden',
          position: 'relative',
          ...( !showFullContent && isOverflowing ? {
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)',
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)'
          } : {} )
        }}
        onMouseEnter={handlePopoverOpen}
        onMouseLeave={handlePopoverClose}
        ref={contentRef}
        data-content-ref="true"
      >
        {content.html && content.html.trim() ? (
          <HtmlContentRenderer 
            html={content.html} 
            highlights={allHighlights} 
            newHighlights={newHighlights}
            isPreview={!showFullContent}
            animateHighlights={animateHighlights && isAnimating}
            onAnimationComplete={handleAnimationComplete}
          />
        ) : (
          <Typography 
            variant="body2" 
            component="div"
            sx={{ 
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
              fontSize: '0.875rem'
            }}
          >
            {renderFormattedContent(content.text, false)}
          </Typography>
        )}
      </Box>

      {/* Hover Preview for Full Variant */}
      {showHoverPreview && !showFullContent && (
        <Popover
          sx={{
            pointerEvents: 'none',
          }}
          open={open}
          anchorEl={anchorEl}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'center',
          }}
          onClose={handlePopoverClose}
          disableRestoreFocus
        >
          <Paper sx={{ p: 2, maxWidth: 600, maxHeight: 500, overflow: 'auto' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Full Document Preview
            </Typography>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ fontSize: '0.85rem' }}>
              {content.html && content.html.trim() ? 
                <HtmlContentRenderer 
                  html={content.html} 
                  highlights={allHighlights} 
                  newHighlights={[]} // No new highlights in popover
                  isPreview={false}
                  animateHighlights={false} // No animation in popover
                /> :
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {renderFormattedContent(content.text, false)}
                </Typography>
              }
            </Box>
          </Paper>
        </Popover>
      )}

      {/* Element Type Tooltip */}
      {elementHover && (
        <ElementTooltip
          elementHover={elementHover}
          showDebugInfo={showDebugInfo}
          tooltipMode={tooltipMode}
        />
      )}
    </Box>
  );
});

DocxPreview.displayName = 'DocxPreview';
