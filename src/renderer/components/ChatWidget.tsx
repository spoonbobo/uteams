import React, { useEffect, useMemo, useState, useRef, useCallback, useLayoutEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  AppBar,
  Toolbar,
  useTheme,
  Tooltip,
  Button,
  CircularProgress,
} from '@mui/material';
import { Send as SendIcon, Close as CloseIcon, Stop as StopIcon, Translate as TranslateIcon } from '@mui/icons-material';
import { useIntl } from 'react-intl';
import { useChatStore } from '../stores/useChatStore';
import { useOcrStore } from '../stores/useOcrStore';
import { useAppStore } from '../stores/useAppStore';

interface ChatWidgetProps {
  sessionId: string;
  sessionName: string;
  courseId?: string;
  ocrCaptureEnabled?: boolean;
  ocrLanguage?: string;
}

export const ChatWidget: React.FC<ChatWidgetProps> = React.memo(({
  sessionId,
  sessionName,
  courseId,
  ocrCaptureEnabled = false,
  ocrLanguage = 'eng',
}) => {
  const theme = useTheme();
  const intl = useIntl();
  const [newMessage, setNewMessage] = useState('');
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);

  // Custom OCR function with progress tracking
  const performOcrWithProgress = async (options: any) => {
    return new Promise<any>((resolve, reject) => {
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        if (currentProgress < 95) {
          currentProgress += Math.random() * 15 + 5; // Random progress between 5-20%
          setOcrProgress(Math.min(currentProgress, 95));
        }
      }, 300);

      performScreenshotOcr(options)
        .then((result) => {
          clearInterval(progressInterval);
          setOcrProgress(100); // Show 100% briefly
          setTimeout(() => setOcrProgress(null), 500); // Hide after 500ms
          resolve(result);
        })
        .catch((error) => {
          clearInterval(progressInterval);
          setOcrProgress(null);
          reject(error);
        });
    });
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    messagesBySession,
    loadMessages,
    sendUserMessage,
    addMessage,
    beginStream,
    appendStream,
    endStream,
    streamingBySession,
    deleteMessage,
    clearAllMessages,
    isThinkingBySession,
    setThinking,
    abortSession,
  } = useChatStore();
  const { performScreenshotOcr, isProcessing: ocrProcessing } = useOcrStore();

  useEffect(() => {
    loadMessages(sessionId);
  }, [sessionId]);

  const streaming = streamingBySession[sessionId];
  const isThinking = isThinkingBySession?.[sessionId] || false;
  const isExecuting = !!streaming || isThinking;
  const isInputDisabled = isExecuting || ocrProgress !== null;
  // Optimize message list computation with better memoization
  const baseMessages = messagesBySession[sessionId] ?? [];
  const chatMessages = useMemo(() => {
    if (streaming) {
      return [
        ...baseMessages,
        {
          id: streaming.id,
          chatId: sessionId,
          text: streaming.text,
          sender: 'companion' as const,
          createdAt: new Date().toISOString(),
          type: 'normal' as const,
        },
      ];
    }
    return baseMessages;
  }, [baseMessages, sessionId, streaming?.id, streaming?.text]); // More specific dependencies

  // Use requestAnimationFrame for smoother scrolling
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, []);

  // Auto-scroll to bottom when messages change, thinking state changes, or OCR progress changes
  // Use layout effect for immediate scroll on message updates
  useLayoutEffect(() => {
    // Debounce scroll for streaming messages
    if (streaming) {
      const timer = setTimeout(scrollToBottom, 50);
      return () => clearTimeout(timer);
    } else {
      scrollToBottom();
    }
  }, [chatMessages.length, isThinking, ocrProgress, streaming, scrollToBottom]);


  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || isInputDisabled) return;
    const text = newMessage;
    setNewMessage('');

    // If OCR capture is enabled, show user message first, then do OCR
    if (ocrCaptureEnabled) {
      // Show user message immediately
      await addMessage(sessionId, {
        id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
        text,
        sender: 'user',
      });

      try {
        // Perform OCR with progress tracking
        const ocrResult = await performOcrWithProgress({
          language: ocrLanguage,
          timeout: 30000,
        });

        if (ocrResult.success && ocrResult.text) {
          // Send enhanced message to AI (skip adding user message since we already did)
          sendUserMessage(sessionId, text, courseId, ocrResult.text, true);
        } else {
          // Send message without OCR if it failed (skip adding user message)
          console.warn('OCR failed, sending message without OCR context:', ocrResult.error);
          sendUserMessage(sessionId, text, courseId, undefined, true);
        }
      } catch (error) {
        console.error('OCR error:', error);
        // Send message without OCR if there was an error (skip adding user message)
        sendUserMessage(sessionId, text, courseId, undefined, true);
      }
    } else {
      // Send message normally without OCR (original behavior)
      sendUserMessage(sessionId, text, courseId);
    }
  }, [newMessage, isInputDisabled, ocrCaptureEnabled, sessionId, courseId, ocrLanguage, addMessage, sendUserMessage, performOcrWithProgress]);

  const handleAbort = useCallback(async () => {
    try {
      await abortSession(sessionId, 'User cancelled via chat widget');
    } catch (error) {
      console.error('Error aborting session:', error);
    }
  }, [abortSession, sessionId]);


  return (
    <Paper
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1,
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.shadows[8],
        minHeight: 0,
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <AppBar
        position="static"
        elevation={0}
        color="default"
        sx={{
          backgroundColor: theme.palette.background.default,
        }}
      >
        <Toolbar variant="dense" sx={{ minHeight: '40px !important' }}>
          <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }}>
            {intl.formatMessage({ id: 'chat.title' })}
          </Typography>
          {isExecuting && (
            <Button
              size="small"
              onClick={handleAbort}
              startIcon={<StopIcon sx={{ fontSize: '0.8rem' }} />}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                color: theme.palette.error.main,
                '&:hover': {
                  color: theme.palette.error.dark,
                  backgroundColor: 'transparent',
                },
                mr: 1,
              }}
            >
              {intl.formatMessage({ id: 'chat.stop', defaultMessage: 'Stop' })}
            </Button>
          )}
          <Button
            size="small"
            onClick={() => clearAllMessages(sessionId)}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              color: theme.palette.text.secondary,
              '&:hover': {
                color: theme.palette.error.main,
                backgroundColor: 'transparent',
              },
            }}
          >
            {intl.formatMessage({ id: 'chat.clear', defaultMessage: 'Clear' })}
          </Button>
        </Toolbar>
      </AppBar>


      {/* Chat Messages */}
      <Box
        sx={{
          flex: 1,
          p: 1.5,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor:
              theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1',
            borderRadius: '2px',
          },
        }}
      >
        {chatMessages.filter(m => m.type !== 'thinking').map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            sessionId={sessionId}
            deleteMessage={deleteMessage}
            theme={theme}
            isStreaming={message.id === streaming?.id}
          />
        ))}

        {/* Show OCR progress when capturing screen */}
        {ocrProgress !== null && (
          <Box
            sx={{
              mb: 1,
              pl: 1,
              alignSelf: 'flex-start',
              maxWidth: '85%',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.65rem',
                color: theme.palette.text.disabled,
                opacity: 0.8,
                fontStyle: 'italic',
                fontWeight: 500,
              }}
            >
              Recognizing current screen ({Math.round(ocrProgress)}%)
            </Typography>
          </Box>
        )}

        {/* Show thinking spinner when agent is processing - appears after user message */}
        {isThinking && !streaming && (
          <Box
            sx={{
              mb: 1,
              pl: 1,
              alignSelf: 'flex-start',
              maxWidth: '85%',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <CircularProgress
              size={14}
              thickness={5}
              sx={{
                color: theme.palette.text.disabled,
                opacity: 0.6,
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.65rem',
                color: theme.palette.text.disabled,
                opacity: 0.8,
                fontStyle: 'italic',
              }}
            >
              {intl.formatMessage({ id: 'chat.thinking', defaultMessage: 'Agent is working on a response' })}
            </Typography>
          </Box>
        )}

        {/* Invisible element for auto-scrolling */}
        <div ref={messagesEndRef} />
      </Box>

      {/* Chat Input */}
      <Box sx={{ p: 1.5, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <TextField
            size="small"
            fullWidth
            disabled={isInputDisabled}
            value={newMessage}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewMessage(e.target.value)
            }
            onKeyPress={(e: React.KeyboardEvent) =>
              e.key === 'Enter' && !isInputDisabled && handleSendMessage()
            }
            placeholder={intl.formatMessage({ id: 'chat.placeholder' })}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '0.8rem',
                height: '32px',
              },
              '& .MuiOutlinedInput-input': {
                padding: '6px 8px',
              },
            }}
          />
          <IconButton
            size="small"
            disabled={isInputDisabled}
            onClick={handleSendMessage}
            sx={{
              width: 32,
              height: 32,
              color: isInputDisabled
                ? theme.palette.text.disabled
                : theme.palette.primary.main,
              '&:disabled': {
                color: theme.palette.text.disabled,
              },
            }}
          >
            <SendIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
});

// Memoized message item component to prevent unnecessary re-renders
const MessageItem = React.memo<{
  message: any;
  sessionId: string;
  deleteMessage: (sessionId: string, id: string) => void;
  theme: any;
  isStreaming?: boolean;
}>(({ message, sessionId, deleteMessage, theme, isStreaming = false }) => {
  const { locale } = useAppStore();
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  const createdTime = useMemo(() => new Date(message.createdAt).toLocaleString(), [message.createdAt]);
  const isUser = message.sender === 'user';

  const handleDelete = useCallback(() => {
    deleteMessage(sessionId, message.id);
  }, [deleteMessage, sessionId, message.id]);

  const handleTranslate = useCallback(async () => {
    if (isTranslating || !message.text.trim()) return;

    setIsTranslating(true);
    try {
      // Determine target language based on locale
      const targetLanguage = locale === 'zh-TW' ? 'Traditional Chinese' : 'English';

      const result = await window.electron.ipcRenderer.invoke('translate:text', {
        text: message.text,
        targetLanguage: targetLanguage
      });

      if (result.success && result.result) {
        setTranslatedText(result.result);
        setShowTranslation(true);
      } else {
        console.error('Translation failed:', result.error);
        // You could add a toast notification here
      }
    } catch (error) {
      console.error('Translation error:', error);
      // You could add a toast notification here
    } finally {
      setIsTranslating(false);
    }
  }, [isTranslating, message.text, locale]);

  const toggleTranslation = useCallback(() => {
    setShowTranslation(!showTranslation);
  }, [showTranslation]);

  return (
    <Tooltip title={createdTime} arrow placement="top">
      <Box
        sx={{
          mb: 1,
          p: 1,
          borderRadius: 1.5,
          backgroundColor: isUser
            ? theme.palette.primary.main
            : theme.palette.mode === 'dark'
              ? 'rgba(55, 65, 81, 0.8)'
              : 'rgba(243, 244, 246, 0.8)',
          color: isUser
            ? theme.palette.primary.contrastText
            : theme.palette.text.primary,
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          maxWidth: '85%',
          fontSize: '0.8rem',
          textAlign: 'left',
          ml: isUser ? 'auto' : 0,
          cursor: 'default',
          position: 'relative',
          '&:hover .chat-actions': { opacity: 1, visibility: 'visible' },
        }}
      >
        <Box
          className="chat-actions"
          sx={{
            position: 'absolute',
            top: -8,
            right: -8,
            display: 'flex',
            gap: 0.5,
            opacity: 0,
            visibility: 'hidden',
            transition: 'opacity 0.15s ease',
          }}
        >
          <IconButton
            size="small"
            onClick={translatedText ? toggleTranslation : handleTranslate}
            disabled={isTranslating}
            sx={{
              width: 20,
              height: 20,
              color: showTranslation
                ? theme.palette.primary.main
                : theme.palette.text.disabled,
              '&:hover': {
                color: theme.palette.primary.main,
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              },
              backgroundColor: 'transparent',
            }}
          >
            {isTranslating ? (
              <CircularProgress size={12} thickness={6} />
            ) : (
              <TranslateIcon sx={{ fontSize: '0.9rem' }} />
            )}
          </IconButton>
          <IconButton
            size="small"
            onClick={handleDelete}
            sx={{
              width: 20,
              height: 20,
              color: theme.palette.text.disabled,
              '&:hover': {
                color: theme.palette.error.main,
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              },
              backgroundColor: 'transparent',
            }}
          >
            <CloseIcon sx={{ fontSize: '0.9rem' }} />
          </IconButton>
        </Box>
        <Box>
          <Typography
            variant="body2"
            sx={{
              mb: 0,
              fontSize: '0.75rem',
              // Add subtle animation for streaming messages
              ...(isStreaming && {
                '&::after': {
                  content: '"▌"',
                  animation: 'blink 1s infinite',
                  '@keyframes blink': {
                    '0%, 50%': { opacity: 1 },
                    '51%, 100%': { opacity: 0 },
                  },
                },
              }),
            }}
          >
            {showTranslation && translatedText ? translatedText : message.text}
          </Typography>

          {/* Show original text when translation is displayed */}
          {showTranslation && translatedText && (
            <Typography
              variant="body2"
              sx={{
                mt: 1,
                fontSize: '0.65rem',
                opacity: 0.7,
                fontStyle: 'italic',
                borderTop: `1px solid ${theme.palette.divider}`,
                pt: 0.5,
              }}
            >
              Original: {message.text}
            </Typography>
          )}
        </Box>
      </Box>
    </Tooltip>
  );
});
