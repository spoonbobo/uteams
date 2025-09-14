import React from 'react';
import {
  Box,
  Typography,
  TableRow,
  TableCell,
  IconButton,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import type { CategoryKey } from './types';

interface CategoryHeaderProps {
  title: string;
  count: number;
  categoryKey: CategoryKey;
  isCollapsed: boolean;
  onToggle: (category: CategoryKey) => void;
}

export const CategoryHeader: React.FC<CategoryHeaderProps> = ({
  title,
  count,
  categoryKey,
  isCollapsed,
  onToggle,
}) => {
  if (count === 0) return null;

  return (
    <TableRow>
      <TableCell 
        colSpan={7} 
        sx={{ 
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50',
          borderTop: '1px solid',
          borderTopColor: 'divider',
          py: 1,
          cursor: 'pointer',
          position: 'sticky',
          '&:hover': {
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.700' : 'grey.100'
          }
        }}
        onClick={() => onToggle(categoryKey)}
      >
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <IconButton size="small" sx={{ p: 0 }}>
            {isCollapsed ? <ChevronRightIcon /> : <ExpandMoreIcon />}
          </IconButton>
          <Typography variant="subtitle2" sx={{ 
            fontWeight: 500, 
            color: 'text.primary'
          }}>
            {title} ({count})
          </Typography>
        </Box>
      </TableCell>
    </TableRow>
  );
};
