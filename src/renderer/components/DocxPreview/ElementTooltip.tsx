import React from 'react';
import { Box } from '@mui/material';
import { ElementHoverState } from './types';

interface ElementTooltipProps {
  elementHover: ElementHoverState;
  showDebugInfo: boolean;
  tooltipMode?: 'default' | 'comment-only';
}

export const ElementTooltip: React.FC<ElementTooltipProps> = ({
  elementHover,
  showDebugInfo,
  tooltipMode = 'default',
}) => {
  // If comment-only mode and no highlight comment, don't show tooltip
  if (tooltipMode === 'comment-only' && !elementHover.highlightInfo?.comment) {
    return null;
  }

  return (
    <Box
      data-tooltip="true"
      sx={{
        position: 'fixed',
        left: elementHover.position.x,
        top: elementHover.position.y,
        transform: 'translate(-50%, -100%)',
        backgroundColor: (theme) => theme.palette.mode === 'dark' 
          ? 'rgba(50, 50, 50, 0.95)' 
          : 'rgba(0, 0, 0, 0.9)',
        color: (theme) => theme.palette.mode === 'dark' 
          ? theme.palette.common.white 
          : theme.palette.common.white,
        padding: tooltipMode === 'comment-only' ? '6px 10px' : '8px 12px',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 500,
        zIndex: 9999,
        pointerEvents: 'none',
        whiteSpace: tooltipMode === 'comment-only' ? 'normal' : 'nowrap',
        maxWidth: tooltipMode === 'comment-only' ? '300px' : '350px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        border: (theme) => theme.palette.mode === 'dark' 
          ? '1px solid rgba(255,255,255,0.2)' 
          : '1px solid rgba(255,255,255,0.1)',
        marginTop: '-8px', // Additional offset from mouse
      }}
    >
      {tooltipMode === 'comment-only' ? (
        // Comment-only mode: Show only the comment text
        elementHover.highlightInfo && (
          <Box sx={{ 
            fontSize: '0.75rem', 
            color: 'white',
            lineHeight: 1.4
          }}>
            {elementHover.highlightInfo.comment}
          </Box>
        )
      ) : (
        // Default mode: Show all information
        <>
          <Box sx={{ fontWeight: 600, color: '#ffd700', mb: 0.5 }}>
            {elementHover.element.type}
            {elementHover.element.debugInfo?.attributes['data-element-type'] && 
             elementHover.element.debugInfo?.attributes['data-element-index'] && (
              <Box component="span" sx={{ fontSize: '0.65rem', color: '#ffeb3b', ml: 1 }}>
                [{elementHover.element.debugInfo.attributes['data-element-type']}-{elementHover.element.debugInfo.attributes['data-element-index']}]
              </Box>
            )}
          </Box>
          <Box sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', mb: 0.5 }}>
            {elementHover.element.details}
          </Box>
          {elementHover.highlightInfo && (
            <Box sx={{
              fontSize: '0.75rem', 
              color: elementHover.highlightInfo.color === 'red' 
              ? '#ffb3b3' 
              : elementHover.highlightInfo.color === 'yellow' 
                ? '#ffeb99' 
                : '#b3ffb3',
              borderTop: '1px solid rgba(255,255,255,0.2)',
              pt: 0.5,
              mt: 0.5,
              fontWeight: 600
            }}>
              <Box sx={{ color: '#ffd700', fontSize: '0.7rem', mb: 0.3 }}>
                💬 Comment:
              </Box>
              <Box sx={{ whiteSpace: 'normal', maxWidth: '250px' }}>
                {elementHover.highlightInfo.comment}
              </Box>
            </Box>
          )}
          {showDebugInfo && elementHover.element.debugInfo && (
            <Box sx={{ 
              fontSize: '0.65rem', 
              color: 'rgba(255,255,255,0.6)',
              borderTop: '1px solid rgba(255,255,255,0.2)',
              pt: 0.5,
              mt: 0.5
            }}>
              <Box>Tag: {elementHover.element.debugInfo.tagName}</Box>
              {elementHover.element.debugInfo.attributes['data-element-type'] && (
                <Box>Type: {elementHover.element.debugInfo.attributes['data-element-type']}</Box>
              )}
              {elementHover.element.debugInfo.attributes['data-element-index'] && (
                <Box>Index: {elementHover.element.debugInfo.attributes['data-element-index']}</Box>
              )}
              {elementHover.element.debugInfo.attributes['data-paragraph-index'] && (
                <Box>Para: {elementHover.element.debugInfo.attributes['data-paragraph-index']}</Box>
              )}
              <Box>Pos: {Math.round(elementHover.element.debugInfo.rect.left)},{Math.round(elementHover.element.debugInfo.rect.top)}</Box>
              <Box>Size: {Math.round(elementHover.element.debugInfo.rect.width)}×{Math.round(elementHover.element.debugInfo.rect.height)}</Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};