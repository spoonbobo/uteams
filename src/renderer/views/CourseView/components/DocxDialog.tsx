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
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
} from '@mui/icons-material';
import { DocxPreview } from '../../../components/DocxPreview/DocxPreview';
import type { DocxContent } from '../../../components/DocxPreview/types';
import { useIntl } from 'react-intl';

interface DocxDialogProps {
  open: boolean;
  onClose: () => void;
  studentName: string;
  filename?: string;
  docxContent: DocxContent | null;
  loading: boolean;
  error: string | null;
}

export const DocxDialog: React.FC<DocxDialogProps> = ({
  open,
  onClose,
  studentName,
  filename,
  docxContent,
  loading,
  error,
}) => {
  const intl = useIntl();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: '90vh',
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1 
      }}>
        <Box>
          <Typography variant="h6" component="div">
            Document Preview - {studentName}
          </Typography>
          {filename && (
            <Typography variant="caption" color="text.secondary">
              {filename}
            </Typography>
          )}
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        p: 0,
        '&.MuiDialogContent-root': {
          paddingTop: 0,
        }
      }}>
        {loading && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            flex: 1,
            flexDirection: 'column',
            gap: 2
          }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Loading document preview...
            </Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">
              <Typography variant="body2">
                {error}
              </Typography>
            </Alert>
          </Box>
        )}

        {!loading && !error && docxContent && (
          <Box sx={{ 
            flex: 1, 
            p: 2,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <DocxPreview
              content={{
                text: docxContent.text,
                html: docxContent.html,
                wordCount: docxContent.wordCount,
                characterCount: docxContent.characterCount,
                filename: filename || 'Student Submission',
                elementCounts: (docxContent as any).elementCounts
              }}
              variant="full"
              showStats={true}
              showHoverPreview={false}
              showDebugInfo={false}
              maxPreviewLength={1000}
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                '& .docx-content-container': {
                  flex: 1,
                  overflow: 'auto',
                }
              }}
            />
          </Box>
        )}

        {!loading && !error && !docxContent && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            flex: 1,
            flexDirection: 'column',
            gap: 2
          }}>
            <Typography variant="h6" color="text.secondary">
              No Document Available
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              The document could not be loaded or does not exist.
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
};
