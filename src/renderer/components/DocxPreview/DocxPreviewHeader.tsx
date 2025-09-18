import React from 'react';
import { Box, Typography, Chip, Tooltip, IconButton } from '@mui/material';
import {
  Description as DescriptionIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { DocxContent, ElementHighlight } from './types';

interface DocxPreviewHeaderProps {
  content: DocxContent;
  showStats: boolean;
  showTestButton: boolean;
  showToggleButton: boolean;
  showFullContent: boolean;
  testHighlights: ElementHighlight[];
  onToggleFullContent: () => void;
  onTestHighlights: () => void;
}

function DocxPreviewHeader({
  content,
  showStats,
  showTestButton,
  showToggleButton,
  showFullContent,
  testHighlights,
  onToggleFullContent,
  onTestHighlights,
}: DocxPreviewHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DescriptionIcon color="primary" />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {content.filename || 'Document Content'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {showStats && (
          <>
            <Chip
              label={`${content.wordCount} words`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`${content.characterCount} chars`}
              size="small"
              variant="outlined"
            />
          </>
        )}

        {showTestButton && (
          <Tooltip
            title={
              testHighlights.length > 0
                ? 'Clear test highlights'
                : 'Generate random highlights'
            }
          >
            <IconButton
              size="small"
              onClick={onTestHighlights}
              sx={{
                ml: 1,
                bgcolor:
                  testHighlights.length > 0 ? 'error.light' : 'warning.light',
                color:
                  testHighlights.length > 0 ? 'error.dark' : 'warning.dark',
                '&:hover': {
                  bgcolor:
                    testHighlights.length > 0 ? 'error.main' : 'warning.main',
                  color: 'white',
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, fontSize: '0.7rem' }}
              >
                {testHighlights.length > 0 ? 'CLEAR' : 'TEST'}
              </Typography>
            </IconButton>
          </Tooltip>
        )}

        {showToggleButton && (
          <Tooltip
            title={showFullContent ? 'Show preview' : 'Show full content'}
          >
            <IconButton
              size="small"
              onClick={onToggleFullContent}
              sx={{ ml: 1 }}
            >
              {showFullContent ? <VisibilityOffIcon /> : <VisibilityIcon />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

export default DocxPreviewHeader;
