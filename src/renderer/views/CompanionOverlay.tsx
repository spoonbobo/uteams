import React from 'react';
import { Box, IconButton, Typography, alpha, useTheme, Tooltip, Button } from '@mui/material';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import { useIntl } from 'react-intl';
import { ChatWidget } from '@/components/ChatWidget';
import { useCompanionStore } from '@/stores/useCompanionStore';
import { useChatStore } from '@/stores/useChatStore';
import { useOcrStore } from '@/stores/useOcrStore';

interface CompanionOverlayProps {
  sessionId: string;
  sessionName: string;
}

export const CompanionOverlay: React.FC<CompanionOverlayProps> = ({
  sessionId,
  sessionName,
}) => {
  const intl = useIntl();
  const theme = useTheme();
  const { updateBounds } = useCompanionStore();
  const { addMessage } = useChatStore();
  const { performScreenshotOcr, isProcessing } = useOcrStore();

  const handleExit = React.useCallback(() => {
    try {
      (window as any)?.electron?.companion?.close?.();
    } catch {}
  }, []);

  const handleOcrTest = React.useCallback(async () => {
    if (isProcessing) {
      await addMessage(sessionId, {
        id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
        text: '⏳ OCR processing is already in progress...',
        sender: 'companion',
        type: 'normal',
      });
      return;
    }

    try {
      // Add a message to chat indicating OCR is starting
      await addMessage(sessionId, {
        id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
        text: '🔍 Taking screenshot for OCR analysis...',
        sender: 'companion',
        type: 'normal',
      });

      // Use OCR store for better state management
      const result = await performScreenshotOcr({
        language: 'eng', // Tesseract.js language code for English
        timeout: 30000, // 30 second timeout
      });

      if (result?.success) {
        const extractedText = result.text || 'No text found';
        const confidence = result.confidence || 0;
        const language = result.language || 'unknown';

        // Format the result message
        const imageInfo = result.imageInfo ?
          `- Original Size: ${result.imageInfo.originalSize}
- Processed Size: ${result.imageInfo.processedSize}
- Scale Factor: ${result.imageInfo.scaleFactor}` : '';

        const debugInfo = result.debug ?
          `- Processing Time: ${result.debug.processingTime}
- Engine Created: ${result.debug.ocrEngineCreated}
- Language Used: ${result.debug.actualLanguageUsed || 'N/A'}
- Approach: ${result.debug.approach || 'Standard'}` : '';

        const resultMessage = `✅ **OCR Results**

📝 **Extracted Text:**
${extractedText}

📊 **Details:**
- API: ${result.apiType || 'Windows OCR'}
- Language: ${language}
- Confidence: ${Math.round(confidence * 100)}%
- Words Found: ${result.wordCount || 0}
${imageInfo}
${debugInfo}

*This text was extracted from a screenshot of your entire screen using ${result.apiType || 'Tesseract.js'}.*`;

        await addMessage(sessionId, {
          id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
          text: resultMessage,
          sender: 'companion',
          type: 'normal',
        });
      } else {
        await addMessage(sessionId, {
          id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
          text: `❌ **OCR Failed**

Error: ${result?.error || 'Unknown error occurred'}

**Possible causes:**
- First-time use: Tesseract.js needs to download language data (~2-3MB for English)
- Network connectivity issues during language data download
- System resources being low (WebAssembly requires sufficient memory)
- Worker initialization timeout (language files downloading)
- Screen capture permissions not granted

**Solutions:**
- Ensure stable internet connection for first-time language data download
- Wait longer on first use (files are cached after initial download - 54% faster on subsequent uses)
- Check that Node.js v14+ is supported in your Electron version
- Try again after a few seconds if worker creation failed`,
          sender: 'companion',
          type: 'normal',
        });
      }

    } catch (error) {
      await addMessage(sessionId, {
        id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
        text: `💥 **Unexpected OCR Error**

An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}

This might be due to:
- Application permissions issues
- System-level screenshot capture problems
- Tesseract.js initialization failure

Please try restarting the application.`,
        sender: 'companion',
        type: 'normal',
      });
    }
  }, [sessionId, addMessage, performScreenshotOcr, isProcessing]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleExit]);

  // Listen for bounds changes from main process
  React.useEffect(() => {
    const handleBoundsChanged = (bounds: { x: number; y: number; width: number; height: number }) => {
      updateBounds(bounds);
    };

    // Use a global handler approach to avoid IPC cleanup issues
    (window as any).companionBoundsHandler = handleBoundsChanged;


    return () => {
      // Clean up the global handler
      delete (window as any).companionBoundsHandler;
    };
  }, [updateBounds]);

  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        p: 0,
        boxSizing: 'border-box',
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
      }}
    >
      {/* Single container with one translucent background */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          borderRadius: 1,
          overflow: 'hidden',
          backgroundColor: theme.palette.background.paper,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: 'none',
          outline: 'none',
          boxShadow: theme.shadows[8],
        }}
      >
        {/* Title bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1,
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.background.default, 0.8)
              : alpha(theme.palette.background.default, 0.9),
            WebkitAppRegion: 'drag',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.primary,
            }}
          >
            {sessionName || intl.formatMessage({ id: 'overlay.companionTitle' })}
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5, WebkitAppRegion: 'no-drag' }}>
            <Tooltip title={isProcessing ? "OCR in progress..." : "Take screenshot and extract text"} placement="bottom">
              <IconButton
                size="small"
                onClick={handleOcrTest}
                disabled={isProcessing}
                sx={{
                  color: isProcessing ? theme.palette.action.disabled : theme.palette.text.secondary,
                  '&:hover': !isProcessing ? {
                    color: theme.palette.primary.main,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  } : {},
                }}
              >
                <TextFieldsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={intl.formatMessage({ id: 'overlay.backToApp', defaultMessage: 'Back to app' })} placement="bottom">
              <IconButton
                size="small"
                onClick={handleExit}
                sx={{
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    color: theme.palette.text.primary,
                    backgroundColor: alpha(theme.palette.action.hover, 0.1),
                  },
                }}
              >
                <LoginOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{
          p: 1,
          flex: 1,
          minHeight: 0,
          backgroundColor: theme.palette.background.paper,
          '& .MuiAppBar-root': { display: 'none' },
        }}>
          <ChatWidget sessionId={sessionId} sessionName={sessionName} />
        </Box>
      </Box>
    </Box>
  );
};


