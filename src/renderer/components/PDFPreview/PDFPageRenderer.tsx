import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { PDFAnnotation } from './types';
import { getAnnotationColor, getAnnotationBorderColor } from './utils';

interface PDFPageRendererComponentProps {
  filePath: string;
  pageNumber: number;
  scale: number;
  annotations: PDFAnnotation[];
  onLoadSuccess?: (numPages: number) => void;
  onLoadError?: (error: Error) => void;
}

function PDFPageRenderer({
  filePath,
  pageNumber,
  scale,
  annotations,
  onLoadSuccess = undefined,
  onLoadError = undefined,
}: PDFPageRendererComponentProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfInfo, setPdfInfo] = useState<any>(null);

  // Load PDF info when component mounts
  useEffect(() => {
    const loadPdfInfo = async () => {
      if (!filePath) return;

      setLoading(true);
      setError(null);

      try {
        const result = await window.electron.ipcRenderer.invoke(
          'pdf:get-info',
          {
            filePath,
          },
        );

        if (result.success) {
          setPdfInfo(result.data);
          if (onLoadSuccess) {
            onLoadSuccess(result.data.pageCount);
          }
        } else {
          throw new Error(result.error);
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load PDF';
        setError(errorMessage);
        if (onLoadError) {
          onLoadError(err);
        }
      } finally {
        setLoading(false);
      }
    };

    loadPdfInfo();
  }, [filePath, onLoadSuccess, onLoadError]);

  // Filter annotations for current page
  const pageAnnotations = annotations.filter(
    (ann) => ann.pageNumber === pageNumber - 1,
  );

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
          p: 2,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 400 }}>
          <Typography variant="body2">Failed to load PDF: {error}</Typography>
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          minHeight: 400,
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading PDF...
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        minHeight: 400,
      }}
    >
      <Box sx={{ position: 'relative' }}>
        {/* PDF Container */}
        <Box
          sx={{
            width: pdfInfo
              ? pdfInfo.firstPageDimensions.width * scale
              : 595 * scale,
            height: pdfInfo
              ? pdfInfo.firstPageDimensions.height * scale
              : 842 * scale,
            bgcolor: 'white',
            border: '1px solid',
            borderColor: 'grey.300',
            borderRadius: 1,
            boxShadow: 2,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* PDF Viewer using iframe with app-file protocol */}
          <iframe
            src={`app-file://${filePath}#page=${pageNumber}&zoom=${scale * 100}&toolbar=0&navpanes=0`}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'white',
            }}
            title={`PDF Page ${pageNumber}`}
            onLoad={() => {
              // PDF iframe loaded successfully
            }}
            onError={() => {
              // Handle iframe load error - show fallback
              const fallbackElement = document.getElementById(
                `pdf-fallback-${pageNumber}`,
              );
              if (fallbackElement) {
                fallbackElement.style.display = 'flex';
              }
            }}
          />

          {/* Fallback overlay for when PDF can't be displayed */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'none', // Hidden by default, shown via JS if needed
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 2,
              p: 4,
              bgcolor: 'grey.50',
              zIndex: 5,
            }}
            id={`pdf-fallback-${pageNumber}`}
          >
            <Typography variant="h6" color="text.secondary">
              PDF Content
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              textAlign="center"
            >
              {pdfInfo?.title || 'PDF Document'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Page {pageNumber} of {pdfInfo?.pageCount || '?'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {pdfInfo &&
                `${Math.round(pdfInfo.firstPageDimensions.width)} × ${Math.round(pdfInfo.firstPageDimensions.height)} pts`}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              PDF viewer not available. Download to view externally.
            </Typography>
          </Box>

          {/* Custom annotations overlay */}
          {pageAnnotations.length > 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              {pageAnnotations.map((annotation) => (
                <Box
                  key={annotation.id}
                  sx={{
                    position: 'absolute',
                    left: annotation.x * scale,
                    top: annotation.y * scale,
                    width: annotation.width * scale,
                    height: annotation.height * scale,
                    bgcolor: getAnnotationColor(annotation.color),
                    border: `2px solid ${getAnnotationBorderColor(
                      annotation.color,
                    )}`,
                    borderRadius: 1,
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8,
                    },
                  }}
                  onClick={() => {
                    // Handle annotation click
                  }}
                  title={annotation.content}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* Page info overlay */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            bgcolor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            typography: 'caption',
            zIndex: 20,
          }}
        >
          Page {pageNumber} of {pdfInfo?.pageCount || '?'}
        </Box>

        {/* PDF Info overlay */}
        {pdfInfo && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              typography: 'caption',
              zIndex: 20,
            }}
          >
            {Math.round(pdfInfo.firstPageDimensions.width)} ×{' '}
            {Math.round(pdfInfo.firstPageDimensions.height)} pts
          </Box>
        )}
      </Box>
    </Box>
  );
}

PDFPageRenderer.defaultProps = {
  onLoadSuccess: undefined,
  onLoadError: undefined,
};

export default PDFPageRenderer;
