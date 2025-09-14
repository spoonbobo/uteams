import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  IconButton,
  Fade,
  alpha,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Circle as PendingIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useChatStore } from '../stores/useChatStore';
import { useIntl } from 'react-intl';

interface PlanWidgetProps {
  sessionId: string;
  onClose?: () => void;
}

export const PlanWidget: React.FC<PlanWidgetProps> = ({ sessionId, onClose }) => {
  const intl = useIntl();
  const { todosBySession, planBySession } = useChatStore();
  const todos = todosBySession[sessionId] || [];
  const plan = planBySession?.[sessionId];
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show widget when there are todos
    if (todos.length > 0 || plan) {
      setIsVisible(true);
    }
  }, [todos, plan]);

  // Calculate progress
  const completedCount = todos.filter(t => t.completed).length;
  const totalCount = todos.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Determine current active todo (first incomplete one)
  const activeTodoIndex = todos.findIndex(t => !t.completed);

  if (!isVisible || (todos.length === 0 && !plan)) {
    return null;
  }

  return (
    <Fade in={isVisible} timeout={300}>
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          borderLeft: 1,
          borderColor: 'divider',
          position: 'relative',
        }}
      >
        {/* Minimal Header */}
        <Box
          sx={{
            p: 2,
            pb: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography 
            variant="subtitle2" 
            sx={{ 
              fontWeight: 500,
              color: 'text.secondary',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              fontSize: '0.75rem',
            }}
          >
            {intl.formatMessage({ id: 'plan.title' })}
          </Typography>
          {onClose && (
            <IconButton 
              size="small" 
              onClick={onClose}
              sx={{ 
                p: 0.5,
                color: 'text.secondary',
                '&:hover': {
                  color: 'text.primary',
                },
              }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
        </Box>

        {/* Simple Progress Bar */}
        <Box sx={{ px: 2, pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary',
                fontSize: '0.7rem',
              }}
            >
              {intl.formatMessage({ id: 'plan.progress' })}
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                ml: 'auto',
                color: progress === 100 ? 'success.main' : 'text.secondary',
                fontWeight: progress === 100 ? 600 : 400,
                fontSize: '0.7rem',
              }}
            >
              {completedCount}/{totalCount}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 2,
              borderRadius: 1,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              '& .MuiLinearProgress-bar': {
                borderRadius: 1,
                bgcolor: progress === 100 ? 'success.main' : 'primary.main',
                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              },
            }}
          />
        </Box>

        {/* Plan Reasoning - Minimal */}
        {plan?.reasoning && (
          <Box sx={{ px: 2, pb: 2 }}>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary',
                fontSize: '0.7rem',
                lineHeight: 1.4,
                display: 'block',
              }}
            >
              {plan.reasoning}
            </Typography>
          </Box>
        )}

        {/* Clean Todo List */}
        <Box 
          sx={{ 
            flex: 1, 
            overflow: 'auto',
            px: 2,
            // Custom scrollbar
            '&::-webkit-scrollbar': {
              width: 4,
            },
            '&::-webkit-scrollbar-track': {
              bgcolor: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'divider',
              borderRadius: 2,
            },
          }}
        >
          {todos.map((todo, index) => {
            const isActive = index === activeTodoIndex;
            const isCompleted = todo.completed;

            return (
              <Fade key={todo.id} in={true} timeout={200 * (index + 1)}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    py: 1,
                    borderBottom: index < todos.length - 1 ? 1 : 0,
                    borderColor: 'divider',
                    opacity: isCompleted ? 0.5 : 1,
                    transition: 'all 0.3s ease',
                  }}
                >
                  {/* Simple Status Icon */}
                  <Box
                    sx={{
                      mt: 0.25,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isCompleted ? (
                      <CheckIcon 
                        sx={{ 
                          fontSize: 16,
                          color: 'success.main',
                        }} 
                      />
                    ) : isActive ? (
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                            '@keyframes pulse': {
                              '0%, 100%': {
                                opacity: 1,
                              },
                              '50%': {
                                opacity: 0.5,
                              },
                            },
                          }}
                        />
                      </Box>
                    ) : (
                      <PendingIcon 
                        sx={{ 
                          fontSize: 16,
                          color: 'text.disabled',
                        }} 
                      />
                    )}
                  </Box>

                  {/* Todo Text */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.8rem',
                        lineHeight: 1.4,
                        color: isCompleted 
                          ? 'text.disabled' 
                          : isActive 
                          ? 'text.primary' 
                          : 'text.secondary',
                        textDecoration: 'none',
                        fontWeight: isActive ? 500 : 400,
                      }}
                    >
                      {todo.text}
                    </Typography>
                    {isActive && (
                      <Fade in={true} timeout={500}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.65rem',
                            color: 'primary.main',
                            fontWeight: 500,
                          }}
                        >
                          {intl.formatMessage({ id: 'plan.processing' })}
                        </Typography>
                      </Fade>
                    )}
                  </Box>
                </Box>
              </Fade>
            );
          })}
        </Box>

        {/* Minimal Completion Message */}
        {progress === 100 && (
          <Fade in={true} timeout={800}>
            <Box
              sx={{
                p: 2,
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: (theme) => alpha(theme.palette.success.main, 0.04),
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'success.main',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  display: 'block',
                  textAlign: 'center',
                }}
              >
                {intl.formatMessage({ id: 'plan.allTasksCompleted' })}
              </Typography>
            </Box>
          </Fade>
        )}
      </Box>
    </Fade>
  );
};