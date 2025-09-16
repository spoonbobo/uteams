import React, { useState, useEffect, useRef } from 'react';
import { Typography, Box, Fade } from '@mui/material';
import { ChatWidget } from '@/components/ChatWidget';
import { PlanWidget } from '@/components/PlanWidget';
import { useChatStore } from '@/stores/useChatStore';
import { useIntl } from 'react-intl';
import type { CourseSessionContext } from '@/stores/useContextStore';

interface AskViewProps {
  sessionContext: CourseSessionContext;
}

export const AskView: React.FC<AskViewProps> = ({
  sessionContext,
}) => {
  const intl = useIntl();
  const { todosBySession, planBySession } = useChatStore();
  const [showPlan, setShowPlan] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout>();
  
  const sessionId = sessionContext.sessionId;
  const todos = todosBySession[sessionId] || [];
  const plan = planBySession?.[sessionId];
  
  // More reactive plan visibility
  useEffect(() => {
    const hasPlan = todos.length > 0 || plan;
    
    if (hasPlan) {
      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = undefined;
      }
      // Show immediately
      setShowPlan(true);
    } else if (!hasPlan && showPlan) {
      // Hide with a small delay for smoother transition
      hideTimeoutRef.current = setTimeout(() => {
        setShowPlan(false);
      }, 300);
    }
    
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [todos, plan, showPlan]);

  // Auto-hide after completion with better timing
  useEffect(() => {
    if (todos.length > 0 && todos.every(t => t.completed)) {
      // All todos completed, hide after 5 seconds (increased from 3)
      hideTimeoutRef.current = setTimeout(() => {
        setShowPlan(false);
      }, 5000);
      
      return () => {
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
      };
    }
  }, [todos]);

  // Extract course code for the title
  const courseName = sessionContext.sessionName;
  
  // Session ID should now be the course shortname (e.g., COMP7404)
  // If not available, extract from course name or create abbreviation
  let courseCode = sessionId;
  
  // Check if sessionId looks like a proper course code
  if (!/^[A-Z]{2,10}\d{0,6}$/i.test(sessionId)) {
    // Try to extract course code from the course name
    const courseCodeMatch = courseName.match(/^([A-Z]{2,10}\d{0,6})/i);
    if (courseCodeMatch) {
      courseCode = courseCodeMatch[1].toUpperCase();
    } else {
      // Last resort: create abbreviation from course name
      courseCode = courseName
        .split(' ')
        .filter(word => word.length > 0)
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 4);
    }
  } else {
    // Session ID is already a course code, just ensure uppercase
    courseCode = sessionId.toUpperCase();
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Ask {courseCode}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {sessionContext.sessionName}
      </Typography>
      
      {/* Main content area with improved layout */}
      <Box 
        sx={{ 
          mt: 4,
          display: 'flex',
          gap: 2,
          alignItems: 'stretch',
          minHeight: '600px',
          position: 'relative',
        }}
      >
        {/* Chat Widget - smoother transitions */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            transition: 'all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)',
            transform: showPlan ? 'translateX(0)' : 'translateX(0)',
            opacity: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ChatWidget 
            sessionId={sessionContext.sessionId}
            sessionName={sessionContext.sessionName}
            courseId={sessionContext.sessionId}
          />
          
          {/* Hint text positioned under ChatWidget */}
          <Typography 
            variant="caption" 
            sx={{ 
              mt: 1,
              color: 'text.disabled',
              fontSize: '0.75rem',
              fontStyle: 'italic',
              alignSelf: 'flex-start',
            }}
          >
            {intl.formatMessage({ id: 'chat.hint' })}
          </Typography>
        </Box>

        {/* Plan Widget - reactive slide animation */}
        <Box
          sx={{
            width: showPlan ? 350 : 0,
            transition: 'width 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Fade in={showPlan} timeout={400}>
            <Box
              sx={{
                width: 350,
                height: '100%',
                position: 'absolute',
                right: 0,
                top: 0,
                transform: showPlan ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)',
              }}
            >
              {showPlan && (
                <PlanWidget 
                  sessionId={sessionContext.sessionId}
                  onClose={() => {
                    setShowPlan(false);
                  }}
                />
              )}
            </Box>
          </Fade>
        </Box>
      </Box>
    </Box>
  );
};

