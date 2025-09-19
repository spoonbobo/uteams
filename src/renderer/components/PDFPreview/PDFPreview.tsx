import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import { PDFPreviewProps, PDFPreviewRef } from './types';
import { usePDFViewer, usePDFKeyboardShortcuts } from './hooks';
import PDFPreviewHeader from './PDFPreviewHeader';
import CompactVariant from './CompactVariant';
import PDFPageRenderer from './PDFPageRenderer';

const PDFPreview = React.forwardRef<PDFPreviewRef, PDFPreviewProps>(
  (
    {
      content,
      loading,
      error,
      showControls = true,
      showPageNavigation = true,
      variant = 'full',
      annotations = [],
      onPageChange,
      onAnnotationAdd,
      sx,
    },
    ref,
  ) => {
    const [showAnnotations] = useState(true);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Use PDF viewer hook for state management
    const {
      viewerState,
      annotations: localAnnotations,
      goToPage,
      nextPage,
      previousPage,
      zoomIn,
      zoomOut,
      resetZoom,
      setZoom,
      addAnnotation,
      clearAnnotations,
      toggleInfo,
      canGoNext,
      canGoPrevious,
    } = usePDFViewer(content);

    // Combine local and external annotations
    const allAnnotations = [...annotations, ...localAnnotations];

    // Enable keyboard shortcuts
    usePDFKeyboardShortcuts(true, {
      nextPage,
      previousPage,
      zoomIn,
      zoomOut,
      resetZoom,
    });

    // Handle page change
    const handlePageChange = useCallback(
      (pageNumber: number) => {
        goToPage(pageNumber);
        if (onPageChange) {
          onPageChange(pageNumber);
        }
      },
      [goToPage, onPageChange],
    );

    // Handle zoom change
    const handleZoomChange = useCallback(
      (scale: number) => {
        setZoom(scale);
      },
      [setZoom],
    );

    // Expose methods via ref
    React.useImperativeHandle(
      ref,
      () => ({
        goToPage,
        nextPage,
        previousPage,
        zoomIn,
        zoomOut,
        resetZoom,
        addAnnotation: (annotation) => {
          addAnnotation(annotation);
          if (onAnnotationAdd) {
            onAnnotationAdd(annotation);
          }
        },
        clearAnnotations,
      }),
      [
        goToPage,
        nextPage,
        previousPage,
        zoomIn,
        zoomOut,
        resetZoom,
        addAnnotation,
        clearAnnotations,
        onAnnotationAdd,
      ],
    );

    // Popover handlers for compact variant
    const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>) => {
      if (variant === 'compact') {
        setAnchorEl(event.currentTarget);
      }
    };

    const handlePopoverClose = () => {
      setAnchorEl(null);
    };

    const open = Boolean(anchorEl);

    if (loading) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 200,
            flexDirection: 'column',
            gap: 2,
            ...sx,
          }}
        >
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Loading PDF...
          </Typography>
        </Box>
      );
    }

    if (error) {
      return (
        <Box sx={{ ...sx }}>
          <Alert severity="error">
            <Typography variant="body2">{error}</Typography>
          </Alert>
        </Box>
      );
    }

    if (!content) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 200,
            flexDirection: 'column',
            gap: 2,
            ...sx,
          }}
        >
          <Typography variant="h6" color="text.secondary">
            No PDF Available
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            The PDF could not be loaded or does not exist.
          </Typography>
        </Box>
      );
    }

    const currentPageInfo = content.pages[viewerState.currentPage];
    const pageAnnotations = allAnnotations.filter(
      (ann) => ann.pageNumber === viewerState.currentPage,
    );

    // Render compact variant
    if (variant === 'compact') {
      return (
        <CompactVariant
          content={content}
          showStats
          showHoverPreview
          annotations={allAnnotations}
          currentPage={viewerState.currentPage}
          anchorEl={anchorEl}
          open={open}
          onPopoverOpen={handlePopoverOpen}
          onPopoverClose={handlePopoverClose}
          onPageChange={handlePageChange}
          sx={sx}
        />
      );
    }

    return (
      <Box sx={{ position: 'relative', ...sx }}>
        {/* Header with controls and info */}
        {variant === 'full' && (
          <PDFPreviewHeader
            content={content}
            showInfo={viewerState.showInfo}
            showControls={showControls}
            currentPage={viewerState.currentPage}
            scale={viewerState.scale}
            onPageChange={handlePageChange}
            onZoomChange={handleZoomChange}
            onToggleInfo={toggleInfo}
          />
        )}

        {/* PDF Viewer Container */}
        <Box
          ref={containerRef}
          sx={{
            position: 'relative',
            bgcolor: 'grey.100',
            borderRadius: 1,
            overflow: 'auto',
            minHeight: variant === 'full' ? 600 : 400,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'default',
          }}
        >
          {content?.info?.filePath ? (
            <Box sx={{ position: 'relative' }}>
              {/* Actual PDF Renderer */}
              <PDFPageRenderer
                filePath={content.info.filePath}
                pageNumber={viewerState.currentPage + 1} // react-pdf uses 1-based indexing
                scale={viewerState.scale}
                annotations={showAnnotations ? pageAnnotations : []}
                onLoadSuccess={() => {
                  // PDF loaded successfully
                }}
                onLoadError={() => {
                  // PDF load error
                }}
              />
            </Box>
          ) : (
            /* Fallback when no file path available */
            <Paper
              sx={{
                width: currentPageInfo
                  ? currentPageInfo.dimensions.width * viewerState.scale
                  : 595,
                height: currentPageInfo
                  ? currentPageInfo.dimensions.height * viewerState.scale
                  : 842,
                bgcolor: 'white',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                boxShadow: 3,
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 2,
                  p: 4,
                }}
              >
                <Typography variant="h6" color="text.secondary">
                  PDF Page {viewerState.currentPage + 1}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign="center"
                >
                  PDF file path not available. Please ensure the PDF is
                  downloaded locally first.
                </Typography>
                {currentPageInfo && (
                  <Typography variant="caption" color="text.secondary">
                    Dimensions: {Math.round(currentPageInfo.dimensions.width)} ×{' '}
                    {Math.round(currentPageInfo.dimensions.height)} pts
                  </Typography>
                )}
              </Box>
            </Paper>
          )}
        </Box>

        {/* Compact variant page navigation */}
        {showPageNavigation && (
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
              px: 2,
              py: 1,
              borderRadius: 2,
            }}
          >
            <IconButton
              size="small"
              onClick={previousPage}
              disabled={!canGoPrevious}
              sx={{ color: 'white' }}
            >
              ←
            </IconButton>
            <Typography variant="body2">
              {viewerState.currentPage + 1} / {content.info.pageCount}
            </Typography>
            <IconButton
              size="small"
              onClick={nextPage}
              disabled={!canGoNext}
              sx={{ color: 'white' }}
            >
              →
            </IconButton>
          </Box>
        )}
      </Box>
    );
  },
);

PDFPreview.displayName = 'PDFPreview';

export default PDFPreview;
