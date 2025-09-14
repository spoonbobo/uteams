import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Popover,
  Divider,
} from '@mui/material';
import {
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { DocxContent } from './types';
import { HtmlContentRenderer } from './HtmlContentRenderer';
import { renderFormattedContent } from './utils';

interface CompactVariantProps {
  content: DocxContent;
  showStats: boolean;
  showHoverPreview: boolean;
  anchorEl: HTMLElement | null;
  open: boolean;
  onPopoverOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onPopoverClose: () => void;
  sx?: any;
}

export const CompactVariant: React.FC<CompactVariantProps> = ({
  content,
  showStats,
  showHoverPreview,
  anchorEl,
  open,
  onPopoverOpen,
  onPopoverClose,
  sx,
}) => {
  return (
    <Box sx={sx}>
      <Box
        onMouseEnter={onPopoverOpen}
        onMouseLeave={onPopoverClose}
        sx={{ 
          cursor: showHoverPreview ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <DescriptionIcon color="primary" fontSize="small" />
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
          {content.filename || 'Document Content'}
        </Typography>
        {showStats && (
          <Chip 
            label={`${content.wordCount} words`} 
            size="small" 
            variant="outlined" 
          />
        )}
      </Box>

      {/* Hover Preview Popover */}
      {showHoverPreview && (
        <Popover
          sx={{
            pointerEvents: 'none',
          }}
          open={open}
          anchorEl={anchorEl}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          onClose={onPopoverClose}
          disableRestoreFocus
        >
          <Paper sx={{ p: 2, maxWidth: 500, maxHeight: 400, overflow: 'auto' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Document Preview
            </Typography>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ fontSize: '0.8rem' }}>
              {content.html && content.html.trim() ? 
                <HtmlContentRenderer 
                  html={content.html} 
                  highlights={[]} 
                  isPreview={true} 
                /> :
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {renderFormattedContent(content.text, true)}
                </Typography>
              }
            </Box>
          </Paper>
        </Popover>
      )}
    </Box>
  );
};
