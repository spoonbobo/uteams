import React, { ReactNode } from 'react';
import { Typography, Box, TextField, InputAdornment, IconButton, Tooltip, Select, MenuItem, FormControl, Chip } from '@mui/material';
import { Search as SearchIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon } from '@mui/icons-material';
import { useIntl } from 'react-intl';

export interface PanelControlConfig {
  // Search configuration
  search?: {
    enabled: boolean;
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
  };
  
  // Sort configuration (for assignments-like panels)
  sort?: {
    enabled: boolean;
    order: 'newest' | 'oldest';
    onOrderChange: (order: 'newest' | 'oldest') => void;
    tooltips: {
      newest: string;
      oldest: string;
    };
  };
  
  // Filter configuration (for materials-like panels)
  filter?: {
    enabled: boolean;
    selectedTypes: string[];
    availableTypes: string[];
    onTypeChange: (types: string[]) => void;
    getTypeLabel: (type: string) => string;
    allTypesLabel: string;
  };
}

interface HTabPanelProps {
  title: string;
  count: number;
  isLoading?: boolean;
  showControls?: boolean;
  controlsConfig?: PanelControlConfig;
  children: ReactNode;
}

export const HTabPanel: React.FC<HTabPanelProps> = ({
  title,
  count,
  isLoading = false,
  showControls = true,
  controlsConfig,
  children
}) => {
  const intl = useIntl();
  
  // Determine if controls should be shown based on count and configuration
  const shouldShowControls = showControls && 
    count > (controlsConfig?.filter?.enabled ? 2 : 1) && 
    (controlsConfig?.search || controlsConfig?.sort || controlsConfig?.filter);

  return (
    <Box>
      {/* Panel Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 500 }}>
          {title}
          {!isLoading && (
            <Typography
              component="span"
              variant="body2"
              color="text.secondary"
              sx={{ ml: 2 }}
            >
              ({count})
            </Typography>
          )}
        </Typography>
        
        {/* Controls */}
        {shouldShowControls && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {/* Sort Control */}
            {controlsConfig?.sort?.enabled && (
              <Tooltip 
                title={controlsConfig.sort.order === 'newest' 
                  ? controlsConfig.sort.tooltips.newest
                  : controlsConfig.sort.tooltips.oldest
                }
              >
                <IconButton
                  onClick={() => controlsConfig.sort!.onOrderChange(
                    controlsConfig.sort!.order === 'newest' ? 'oldest' : 'newest'
                  )}
                  size="small"
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  {controlsConfig.sort.order === 'newest' ? (
                    <ArrowDownwardIcon fontSize="small" />
                  ) : (
                    <ArrowUpwardIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            )}

            {/* Filter Control */}
            {controlsConfig?.filter?.enabled && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <Select
                  multiple
                  value={controlsConfig.filter.selectedTypes}
                  onChange={(e) => {
                    const value = typeof e.target.value === 'string' 
                      ? e.target.value.split(',') 
                      : e.target.value;
                    controlsConfig.filter!.onTypeChange(value);
                  }}
                  displayEmpty
                  renderValue={(selected) => {
                    if (selected.length === 0) {
                      return (
                        <Typography variant="body2" color="text.secondary">
                          {controlsConfig.filter!.allTypesLabel}
                        </Typography>
                      );
                    }
                    return (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip
                            key={value}
                            label={controlsConfig.filter!.getTypeLabel(value)}
                            size="small"
                            sx={{ 
                              height: 20,
                              fontSize: '0.7rem',
                              '& .MuiChip-label': {
                                px: 1,
                              },
                            }}
                          />
                        ))}
                      </Box>
                    );
                  }}
                  sx={{
                    '& .MuiSelect-select': {
                      py: 1,
                    },
                  }}
                >
                  {controlsConfig.filter.availableTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {controlsConfig.filter!.getTypeLabel(type)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            
            {/* Search Control */}
            {controlsConfig?.search?.enabled && (
              <TextField
                variant="outlined"
                placeholder={controlsConfig.search.placeholder || `Search ${title.toLowerCase()}...`}
                value={controlsConfig.search.value}
                onChange={(e) => controlsConfig.search!.onChange(e.target.value)}
                size="small"
                sx={{ width: 250 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            )}
          </Box>
        )}
      </Box>
      
      {/* Panel Content */}
      {children}
    </Box>
  );
};
