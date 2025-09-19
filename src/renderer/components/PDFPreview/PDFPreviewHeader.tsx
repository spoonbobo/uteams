import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Select,
  MenuItem,
  FormControl,
  Chip,
  Stack,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  ZoomOutMap as FitPageIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Info as InfoIcon,
  InfoOutlined as InfoOutlinedIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { PDFPreviewHeaderProps } from './types';
import {
  formatFileSize,
  formatDimensions,
  formatDate,
  formatPageNumber,
  getPageSizeName,
  getZoomLevels,
} from './utils';

function PDFPreviewHeader({
  content,
  showInfo,
  showControls,
  currentPage,
  scale,
  onPageChange,
  onZoomChange,
  onToggleInfo,
}: PDFPreviewHeaderProps) {
  const zoomLevels = getZoomLevels();

  const handleZoomIn = () => {
    onZoomChange(Math.min(scale * 1.2, 3.0));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(scale / 1.2, 0.25));
  };

  const handleFitPage = () => {
    onZoomChange(1.0);
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < content.info.pageCount - 1) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const pageNum = parseInt(event.target.value, 10) - 1; // Convert to 0-based
    if (
      !Number.isNaN(pageNum) &&
      pageNum >= 0 &&
      pageNum < content.info.pageCount
    ) {
      onPageChange(pageNum);
    }
  };

  const handleZoomSelectChange = (event: any) => {
    onZoomChange(event.target.value);
  };

  const currentZoomLabel = `${Math.round(scale * 100)}%`;
  const pageSize = getPageSizeName(
    content.info.firstPageDimensions.width,
    content.info.firstPageDimensions.height,
  );

  return (
    <Box>
      {/* Main header with title and basic info */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {content.info.title || 'PDF Document'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Chip
              size="small"
              label={formatPageNumber(currentPage, content.info.pageCount)}
              variant="outlined"
            />
            <Chip
              size="small"
              label={formatFileSize(content.info.fileSize)}
              variant="outlined"
            />
            {pageSize && (
              <Chip size="small" label={pageSize} variant="outlined" />
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={showInfo ? 'Hide info' : 'Show info'}>
            <IconButton onClick={onToggleInfo} size="small">
              {showInfo ? <InfoIcon /> : <InfoOutlinedIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Download PDF">
            <IconButton size="small">
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Print PDF">
            <IconButton size="small">
              <PrintIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Controls bar */}
      {showControls && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 1,
            bgcolor: 'action.hover',
            borderRadius: 1,
            mb: 2,
          }}
        >
          {/* Page navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Previous page">
              <span>
                <IconButton
                  onClick={handlePreviousPage}
                  disabled={currentPage === 0}
                  size="small"
                >
                  <PrevIcon />
                </IconButton>
              </span>
            </Tooltip>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2" sx={{ minWidth: 'auto' }}>
                Page
              </Typography>
              <input
                type="number"
                min="1"
                max={content.info.pageCount}
                value={currentPage + 1}
                onChange={handlePageInputChange}
                style={{
                  width: '60px',
                  padding: '4px 8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  textAlign: 'center',
                  fontSize: '14px',
                }}
              />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                of {content.info.pageCount}
              </Typography>
            </Box>

            <Tooltip title="Next page">
              <span>
                <IconButton
                  onClick={handleNextPage}
                  disabled={currentPage === content.info.pageCount - 1}
                  size="small"
                >
                  <NextIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Zoom controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Zoom out">
              <IconButton
                onClick={handleZoomOut}
                disabled={scale <= 0.25}
                size="small"
              >
                <ZoomOutIcon />
              </IconButton>
            </Tooltip>

            <FormControl size="small" sx={{ minWidth: 80 }}>
              <Select
                value={scale}
                onChange={handleZoomSelectChange}
                displayEmpty
                renderValue={() => currentZoomLabel}
              >
                {zoomLevels.map((level) => (
                  <MenuItem key={level.value} value={level.value}>
                    {level.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Tooltip title="Zoom in">
              <IconButton
                onClick={handleZoomIn}
                disabled={scale >= 3.0}
                size="small"
              >
                <ZoomInIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Fit to page">
              <IconButton onClick={handleFitPage} size="small">
                <FitPageIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}

      {/* Detailed info panel */}
      {showInfo && (
        <Box
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            mb: 2,
          }}
        >
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Document Information
          </Typography>

          <Stack spacing={1}>
            {content.info.title && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500, minWidth: 100 }}
                >
                  Title:
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {content.info.title}
                </Typography>
              </Box>
            )}

            {content.info.author && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500, minWidth: 100 }}
                >
                  Author:
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {content.info.author}
                </Typography>
              </Box>
            )}

            {content.info.subject && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500, minWidth: 100 }}
                >
                  Subject:
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {content.info.subject}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 500, minWidth: 100 }}
              >
                Pages:
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {content.info.pageCount}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 500, minWidth: 100 }}
              >
                Dimensions:
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {formatDimensions(
                  content.info.firstPageDimensions.width,
                  content.info.firstPageDimensions.height,
                )}
                {pageSize && ` (${pageSize})`}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 500, minWidth: 100 }}
              >
                File Size:
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {formatFileSize(content.info.fileSize)}
              </Typography>
            </Box>

            {content.info.creationDate && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500, minWidth: 100 }}
                >
                  Created:
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {formatDate(content.info.creationDate)}
                </Typography>
              </Box>
            )}

            {content.info.modificationDate && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500, minWidth: 100 }}
                >
                  Modified:
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {formatDate(content.info.modificationDate)}
                </Typography>
              </Box>
            )}

            {content.info.creator && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500, minWidth: 100 }}
                >
                  Creator:
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {content.info.creator}
                </Typography>
              </Box>
            )}

            {content.info.producer && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500, minWidth: 100 }}
                >
                  Producer:
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {content.info.producer}
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

export default PDFPreviewHeader;
