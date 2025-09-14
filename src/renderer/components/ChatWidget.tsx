import React, { useEffect, useMemo, useState } from 'react';
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
  Chip,
  LinearProgress,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { Send as SendIcon, Close as CloseIcon } from '@mui/icons-material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useIntl } from 'react-intl';
import { useChatStore } from '../stores/useChatStore';

interface ChatWidgetProps {
  sessionId: string;
  sessionName: string;
  courseId?: string;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  sessionId,
  sessionName,
  courseId,
}) => {
  const theme = useTheme();
  const intl = useIntl();
  const [newMessage, setNewMessage] = useState('');
  const {
    messagesBySession,
    loadMessages,
    sendUserMessage,
    beginStream,
    appendStream,
    endStream,
    streamingBySession,
    deleteMessage,
    clearAllMessages,
  } = useChatStore();

  useEffect(() => {
    loadMessages(sessionId);
  }, [sessionId]);

  const streaming = streamingBySession[sessionId];
  const chatMessages = useMemo(() => {
    const base = messagesBySession[sessionId] ?? [];
    if (streaming) {
      return [
        ...base,
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
    return base;
  }, [messagesBySession, sessionId, streaming]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    const text = newMessage;
    setNewMessage('');
    sendUserMessage(sessionId, text, courseId);
  };


  return (
    <Paper
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1,
        backdropFilter: 'blur(10px)',
        backgroundColor:
          theme.palette.mode === 'dark'
            ? 'rgba(30, 41, 59, 0.9)'
            : 'rgba(255, 255, 255, 0.9)',
        border: `1px solid ${theme.palette.divider}`,
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 8px 32px rgba(0, 0, 0, 0.5)'
            : '0 8px 32px rgba(0, 0, 0, 0.1)',
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
          backgroundColor: 'transparent',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Toolbar variant="dense" sx={{ minHeight: '40px !important' }}>
          <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }}>
            {intl.formatMessage({ id: 'chat.title' })}
          </Typography>
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
        {chatMessages.map((message) => {
          const createdTime = new Date(message.createdAt).toLocaleString();
          const isUser = message.sender === 'user';
          const isThinking = message.type === 'thinking';
          if (isThinking) {
            return (
              <Box key={message.id} sx={{ mb: 0.5, alignSelf: 'flex-start', maxWidth: '85%' }}>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: theme.palette.text.secondary,
                    lineHeight: 1.1,
                    fontSize: '0.68rem',
                    px: 0.25,
                  }}
                >
                  {message.text}
                </Typography>
              </Box>
            );
          }
          return (
            <Tooltip key={message.id} title={createdTime} arrow placement="top">
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
                  '&:hover .chat-delete': { opacity: 1, visibility: 'visible' },
                }}
              >
                <IconButton
                  className="chat-delete"
                  size="small"
                  onClick={() => deleteMessage(sessionId, message.id)}
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    width: 20,
                    height: 20,
                    color: theme.palette.text.disabled,
                    '&:hover': { color: theme.palette.error.main },
                    backgroundColor: 'transparent',
                    opacity: 0,
                    visibility: 'hidden',
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  <CloseIcon sx={{ fontSize: '0.9rem' }} />
                </IconButton>
                <Typography variant="body2" sx={{ mb: 0, fontSize: '0.75rem' }}>
                  {message.text}
                </Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* Chat Input */}
      <Box sx={{ p: 1.5, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <TextField
            size="small"
            fullWidth
            value={newMessage}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewMessage(e.target.value)
            }
            onKeyPress={(e: React.KeyboardEvent) =>
              e.key === 'Enter' && handleSendMessage()
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
            onClick={handleSendMessage}
            sx={{
              width: 32,
              height: 32,
              color: theme.palette.primary.main,
            }}
          >
            <SendIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
};
