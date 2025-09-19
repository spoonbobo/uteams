import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  Typography,
  Alert,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { PDFDialogProps } from './types';
import { usePDFLoader } from './hooks';

function PDFDialog({
  open,
  onClose,
  studentName,
  filename,
  filePath,
  pdfContent,
  loading: externalLoading,
  error: externalError,
}: PDFDialogProps) {
  // Only use PDF loader hook when we don't have external content and dialog is open
  const shouldLoadPDF = !pdfContent && open && filePath;
  const {
    content: loadedContent,
    loading: loadingPDF,
    error: loadError,
  } = usePDFLoader(shouldLoadPDF ? filePath : undefined);

  // Determine which content and loading state to use
  const content = pdfContent || loadedContent;
  const loading = externalLoading || loadingPDF;
  const error = externalError || loadError;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: '90vh',
          width: '85vw',
          maxWidth: '1400px',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          pb: 2,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" component="div" sx={{ mb: 0.5 }}>
            PDF Preview{studentName ? ` - ${studentName}` : ''}
          </Typography>

          {filename && (
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {filename}
            </Typography>
          )}
        </Box>

        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          p: 0,
          overflow: 'hidden',
          '&.MuiDialogContent-root': {
            paddingTop: 0,
          },
        }}
      >
        {error && (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">
              <Typography variant="body2">{error}</Typography>
            </Alert>
          </Box>
        )}

        {!error && (
          <Box
            sx={{
              flex: 1,
              p: 2,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Direct PDF Renderer without any controls */}
            {content?.info?.filePath ? (
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <iframe
                  src={`app-file://${content.info.filePath}#page=1&zoom=120&view=FitH`}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: 'white',
                  }}
                  title="PDF Document"
                />
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <Typography variant="h6" color="text.secondary">
                  No PDF Available
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign="center"
                >
                  The PDF could not be loaded or does not exist.
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {!loading && !error && !content && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flex: 1,
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Typography variant="h6" color="text.secondary">
              No PDF Available
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              textAlign="center"
            >
              The PDF could not be loaded or does not exist.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PDFDialog;
