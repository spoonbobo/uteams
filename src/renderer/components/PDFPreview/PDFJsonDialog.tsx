import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';

interface PDFJsonDialogProps {
  open: boolean;
  onClose: () => void;
  filename: string;
  jsonData: any;
  loading: boolean;
  error: string | null;
}

function PDFJsonDialog({
  open,
  onClose,
  filename,
  jsonData,
  loading,
  error,
}: PDFJsonDialogProps) {
  const [selectedTab, setSelectedTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
      // Could show a toast notification here
    } catch {
      // Handle clipboard error silently
    }
  };

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
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1,
        }}
      >
        <Box>
          <Typography variant="h6" component="div">
            PDF Structure Analysis
          </Typography>
          <Typography variant="subtitle2" color="text.secondary">
            {filename}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            onClick={handleCopyJson}
            size="small"
            disabled={!jsonData}
          >
            <CopyIcon />
          </IconButton>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {loading && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: 200,
            }}
          >
            <Typography>Parsing PDF...</Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 3 }}>
            <Typography color="error">{error}</Typography>
          </Box>
        )}

        {jsonData && !loading && !error && (
          <Box sx={{ height: '100%' }}>
            <Tabs
              value={selectedTab}
              onChange={handleTabChange}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Summary" />
              <Tab label="Elements" />
              <Tab label="Pages" />
              <Tab label="AI Instructions" />
            </Tabs>

            <Box sx={{ p: 3, height: 'calc(100% - 48px)', overflow: 'auto' }}>
              {/* Summary Tab */}
              {selectedTab === 0 && jsonData.summary && (
                <Box>
                  <Typography variant="h5" gutterBottom>
                    Document Summary
                  </Typography>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: 2,
                      mb: 3,
                    }}
                  >
                    <Paper
                      variant="outlined"
                      sx={{ p: 2, textAlign: 'center' }}
                    >
                      <Typography variant="h4" color="primary">
                        {jsonData.summary.totalPages}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Pages
                      </Typography>
                    </Paper>
                    <Paper
                      variant="outlined"
                      sx={{ p: 2, textAlign: 'center' }}
                    >
                      <Typography variant="h4" color="primary">
                        {jsonData.summary.totalElements}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Elements
                      </Typography>
                    </Paper>
                    <Paper
                      variant="outlined"
                      sx={{ p: 2, textAlign: 'center' }}
                    >
                      <Typography variant="h4" color="primary">
                        {jsonData.summary.totalWordCount}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Words
                      </Typography>
                    </Paper>
                    <Paper
                      variant="outlined"
                      sx={{ p: 2, textAlign: 'center' }}
                    >
                      <Typography
                        variant="h4"
                        color={
                          jsonData.summary.aiReadyFormat
                            ? 'success.main'
                            : 'warning.main'
                        }
                      >
                        {jsonData.summary.aiReadyFormat ? '✓' : '✗'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        AI Ready
                      </Typography>
                    </Paper>
                  </Box>

                  <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                    Content Types
                  </Typography>
                  <Box
                    sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}
                  >
                    {Object.entries(jsonData.summary.elementTypes || {}).map(
                      ([type, count]: [string, any]) => (
                        <Chip
                          key={type}
                          label={`${type.replace('_', ' ')}: ${count}`}
                          variant="outlined"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      ),
                    )}
                  </Box>
                </Box>
              )}

              {/* Elements Tab */}
              {selectedTab === 1 && jsonData.elements && (
                <Box>
                  <Typography variant="h5" gutterBottom>
                    Text Elements
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    {jsonData.elements.length} elements with unique IDs for AI
                    processing
                  </Typography>

                  {jsonData.elements.slice(0, 15).map((element: any) => (
                    <Paper
                      variant="outlined"
                      key={element.elementId}
                      sx={{ mb: 2, p: 2 }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontFamily: 'monospace',
                            color: 'primary.main',
                          }}
                        >
                          {element.elementId}
                        </Typography>
                        <Chip
                          size="small"
                          label={element.content.type.replace('_', ' ')}
                          sx={{ textTransform: 'capitalize' }}
                        />
                        <Chip
                          size="small"
                          label={`Page ${element.pageNumber}`}
                          variant="outlined"
                        />
                      </Box>

                      <Typography
                        variant="body2"
                        sx={{ mb: 1, fontStyle: 'italic' }}
                      >
                        &quot;{element.content.text}&quot;
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Typography variant="caption" color="text.secondary">
                          Position: ({element.position.x.toFixed(0)},{' '}
                          {element.position.y.toFixed(0)})
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Font: {element.style.fontName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Size: {element.style.fontSize.toFixed(1)}px
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {element.content.wordCount} words
                        </Typography>
                      </Box>
                    </Paper>
                  ))}

                  {jsonData.elements.length > 15 && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ textAlign: 'center', mt: 2 }}
                    >
                      Showing first 15 of {jsonData.elements.length} elements
                    </Typography>
                  )}
                </Box>
              )}

              {/* Pages Tab */}
              {selectedTab === 2 && jsonData.pages && (
                <Box>
                  <Typography variant="h5" gutterBottom>
                    Page Content
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    Full page content for AI analysis and context understanding
                  </Typography>

                  {Object.entries(jsonData.pages).map(
                    ([pageKey, pageData]: [string, any]) => (
                      <Paper variant="outlined" key={pageKey} sx={{ mb: 2 }}>
                        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                          <Typography variant="h6">
                            {pageKey.replace('page_', 'Page ')}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Chip
                              size="small"
                              label={`${pageData.elementCount} elements`}
                            />
                            <Chip
                              size="small"
                              label={`${pageData.dimensions?.width.toFixed(0)} x ${pageData.dimensions?.height.toFixed(0)}`}
                              variant="outlined"
                            />
                            {pageData.error && (
                              <Chip size="small" label="Error" color="error" />
                            )}
                          </Box>
                        </Box>

                        {pageData.fullText && (
                          <Box sx={{ p: 2 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                              Page Content:
                            </Typography>
                            <Box
                              sx={{
                                bgcolor: 'background.default',
                                p: 2,
                                borderRadius: 1,
                                maxHeight: 250,
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap',
                                fontSize: '0.875rem',
                                lineHeight: 1.5,
                                border: '1px solid',
                                borderColor: 'divider',
                              }}
                            >
                              {pageData.fullText}
                            </Box>
                          </Box>
                        )}
                      </Paper>
                    ),
                  )}
                </Box>
              )}

              {/* AI Instructions Tab */}
              {selectedTab === 3 && jsonData.aiInstructions && (
                <Box>
                  <Typography variant="h5" gutterBottom>
                    AI Integration Guide
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    Instructions for AI systems to process this PDF and generate
                    highlight patches
                  </Typography>

                  <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                    Processing Workflow
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      1. Analyze page content (Pages tab) to understand context
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      2. Generate highlight patches using element IDs from
                      Elements tab
                    </Typography>
                    <Typography variant="body1">
                      3. Apply patches using the pdf:apply-ai-patches handler
                    </Typography>
                  </Paper>

                  <Typography variant="h6" gutterBottom>
                    Patch Format
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      bgcolor: 'background.default',
                      p: 2,
                      borderRadius: 1,
                      overflow: 'auto',
                      fontSize: '0.875rem',
                      fontFamily: 'monospace',
                      border: '1px solid',
                      borderColor: 'divider',
                      mb: 2,
                    }}
                  >
                    {JSON.stringify(jsonData.aiReference.examplePatch, null, 2)}
                  </Box>

                  <Typography variant="h6" gutterBottom>
                    Complete API Reference
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      bgcolor: 'background.default',
                      p: 2,
                      borderRadius: 1,
                      overflow: 'auto',
                      maxHeight: 300,
                      fontSize: '0.875rem',
                      fontFamily: 'monospace',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {JSON.stringify(jsonData.aiInstructions, null, 2)}
                  </Box>
                </Box>
              )}
            </Box>
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

export default PDFJsonDialog;
