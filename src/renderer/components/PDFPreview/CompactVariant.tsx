import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Popover,
  Divider,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  ZoomIn as ZoomIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
} from '@mui/icons-material';
import { PDFContent, PDFAnnotation } from './types';
import { formatFileSize, formatPageNumber, generatePDFSummary } from './utils';

interface CompactVariantProps {
  content: PDFContent;
  showStats: boolean;
  showHoverPreview: boolean;
  annotations: PDFAnnotation[];
  currentPage: number;
  anchorEl: HTMLElement | null;
  open: boolean;
  onPopoverOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onPopoverClose: () => void;
  onPageChange: (pageNumber: number) => void;
  sx?: any;
}

function CompactVariant({
  content,
  showStats,
  showHoverPreview,
  annotations,
  currentPage,
  anchorEl,
  open,
  onPopoverOpen,
  onPopoverClose,
  onPageChange,
  sx,
}: CompactVariantProps) {
  const handlePreviousPage = () => {
    if (currentPage > 0) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < content.info.pageCount - 1) {
      onPageChange(currentPage + 1);
    }
  };

  const pageAnnotations = annotations.filter(
    (ann) => ann.pageNumber === currentPage,
  );

  return (
    <Box sx={sx}>
      <Paper
        sx={{
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          cursor: showHoverPreview ? 'pointer' : 'default',
          transition: 'all 0.2s ease-in-out',
          '&:hover': showHoverPreview
            ? {
                borderColor: 'primary.main',
                boxShadow: 1,
              }
            : {},
        }}
        onMouseEnter={onPopoverOpen}
        onMouseLeave={onPopoverClose}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <PdfIcon sx={{ color: 'error.main', fontSize: 32, flexShrink: 0 }} />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {content.info.title || 'PDF Document'}
            </Typography>

            {showStats && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {generatePDFSummary(content.info)}
              </Typography>
            )}
          </Box>

          <Tooltip title="View full PDF">
            <IconButton size="small" sx={{ color: 'text.secondary' }}>
              <ZoomIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Current page preview */}
        <Box
          sx={{
            position: 'relative',
            bgcolor: 'grey.50',
            borderRadius: 1,
            minHeight: 120,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {/* PDF page placeholder */}
          <Box
            sx={{
              width: '80%',
              height: 100,
              bgcolor: 'white',
              border: '1px solid',
              borderColor: 'grey.300',
              borderRadius: 0.5,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              textAlign="center"
            >
              Page {currentPage + 1}
              <br />
              PDF Preview
            </Typography>

            {/* Show annotation indicators */}
            {pageAnnotations.length > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  bgcolor: 'secondary.main',
                  color: 'white',
                  borderRadius: '50%',
                  width: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 600,
                }}
              >
                {pageAnnotations.length}
              </Box>
            )}
          </Box>

          {/* Page navigation overlay */}
          {content.info.pageCount > 1 && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
              }}
            >
              <IconButton
                size="small"
                onClick={handlePreviousPage}
                disabled={currentPage === 0}
                sx={{ color: 'white', p: 0.25 }}
              >
                <PrevIcon fontSize="small" />
              </IconButton>

              <Typography
                variant="caption"
                sx={{ minWidth: 40, textAlign: 'center' }}
              >
                {formatPageNumber(currentPage, content.info.pageCount)}
              </Typography>

              <IconButton
                size="small"
                onClick={handleNextPage}
                disabled={currentPage === content.info.pageCount - 1}
                sx={{ color: 'white', p: 0.25 }}
              >
                <NextIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
        </Box>

        {/* Footer with additional info */}
        {(content.info.author || annotations.length > 0) && (
          <Box
            sx={{
              mt: 2,
              pt: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              {content.info.author && (
                <Typography variant="caption" color="text.secondary">
                  by {content.info.author}
                </Typography>
              )}

              {annotations.length > 0 && (
                <Chip
                  size="small"
                  label={`${annotations.length} annotation${annotations.length !== 1 ? 's' : ''}`}
                  variant="outlined"
                  color="secondary"
                />
              )}
            </Box>
          </Box>
        )}
      </Paper>

      {/* Hover Preview Popover */}
      {showHoverPreview && (
        <Popover
          sx={{ pointerEvents: 'none' }}
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
          onClose={onPopoverClose}
          disableRestoreFocus
        >
          <Paper sx={{ p: 2, maxWidth: 400, maxHeight: 300 }}>
            <Typography
              variant="subtitle2"
              gutterBottom
              sx={{ fontWeight: 600 }}
            >
              PDF Document Preview
            </Typography>
            <Divider sx={{ mb: 1 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {content.info.title && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>
                    Title:
                  </Typography>
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    {content.info.title}
                  </Typography>
                </Box>
              )}

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                  Pages:
                </Typography>
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {content.info.pageCount}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                  Size:
                </Typography>
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {formatFileSize(content.info.fileSize)}
                </Typography>
              </Box>

              {content.info.author && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>
                    Author:
                  </Typography>
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    {content.info.author}
                  </Typography>
                </Box>
              )}

              {annotations.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>
                    Annotations:
                  </Typography>
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    {annotations.length} annotation
                    {annotations.length !== 1 ? 's' : ''}
                  </Typography>
                </Box>
              )}
            </Box>

            <Box
              sx={{
                mt: 2,
                pt: 1,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Click to open full PDF viewer
              </Typography>
            </Box>
          </Paper>
        </Popover>
      )}
    </Box>
  );
}

CompactVariant.defaultProps = {
  sx: {},
};

export default CompactVariant;
