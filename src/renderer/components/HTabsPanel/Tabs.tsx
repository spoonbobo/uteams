import React, { useState, useEffect, useRef, ReactNode } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  SxProps,
  Theme,
  useTheme,
  alpha,
} from '@mui/material';

export interface TabSection {
  id: string;
  title: string;
  component: ReactNode;
  disabled?: boolean;
}

interface HTabsPanelProps {
  sections: TabSection[];
  selectedTab?: number;
  onTabChange?: (index: number) => void;
  children?: ReactNode;
  sx?: SxProps<Theme>;
}

export function HTabsPanel({
  sections,
  selectedTab: externalSelectedTab,
  onTabChange,
  children,
  sx,
}: HTabsPanelProps) {
  const theme = useTheme();
  const [internalSelectedTab, setInternalSelectedTab] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isScrollingProgrammatically = useRef(false);

  // Use external selectedTab if provided, otherwise use internal state
  const selectedTab =
    externalSelectedTab !== undefined
      ? externalSelectedTab
      : internalSelectedTab;

  // Scroll to specific section
  const scrollToSection = (index: number) => {
    const sectionElement = sectionRefs.current[index];
    if (sectionElement && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      // Set flag to prevent scroll handler from interfering
      isScrollingProgrammatically.current = true;

      // Use scrollLeft directly from the section element's position
      const targetScrollLeft = index * container.clientWidth;
      container.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth',
      });

      // Clear the flag after scroll completes
      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 500); // Give enough time for smooth scroll to complete
    }
  };

  // Handle tab change and scroll to section
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    if (externalSelectedTab === undefined) {
      setInternalSelectedTab(newValue);
    }
    onTabChange?.(newValue);
    scrollToSection(newValue);
  };

  // Sync scroll position when external selectedTab changes
  useEffect(() => {
    if (externalSelectedTab !== undefined) {
      const container = scrollContainerRef.current;
      if (container) {
        const currentScrollIndex = Math.round(
          container.scrollLeft / container.clientWidth,
        );
        if (currentScrollIndex !== externalSelectedTab) {
          scrollToSection(externalSelectedTab);
        }
      }
    }
  }, [externalSelectedTab]);

  // Handle scroll to update active tab
  useEffect(() => {
    const handleScroll = () => {
      // Don't update tabs during programmatic scrolling
      if (isScrollingProgrammatically.current || !scrollContainerRef.current)
        return;

      const container = scrollContainerRef.current;
      const { scrollLeft, clientWidth: containerWidth } = container;

      // Calculate which section we're closest to based on scroll position
      const currentIndex = Math.round(scrollLeft / containerWidth);
      const clampedIndex = Math.max(
        0,
        Math.min(sections.length - 1, currentIndex),
      );

      if (clampedIndex !== selectedTab) {
        if (externalSelectedTab === undefined) {
          setInternalSelectedTab(clampedIndex);
        }
        onTabChange?.(clampedIndex);
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
    return undefined;
  }, [selectedTab, sections.length, externalSelectedTab, onTabChange]);

  return (
    <Box
      sx={[
        { height: '100%', display: 'flex', flexDirection: 'column' },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {/* Horizontal Tabs - Sticky positioned */}
      <Paper
        sx={{
          position: 'sticky',
          top: 64, // TopBar height (64px) to avoid overlap
          zIndex: theme.zIndex.appBar - 1, // Below TopBar but above content
          mb: 2,
          borderRadius: 2,
          backgroundColor: theme.palette.background.paper,
          boxShadow: theme.shadows[2], // Slightly more shadow when sticky
          transition: theme.transitions.create('box-shadow', {
            duration: theme.transitions.duration.short,
          }),
        }}
      >
        <Tabs
          value={selectedTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.9rem',
              minHeight: 48,
              color: theme.palette.text.secondary,
              transition: theme.transitions.create(
                ['background-color', 'color'],
                {
                  duration: theme.transitions.duration.short,
                },
              ),
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                color: theme.palette.primary.main,
              },
              '&.Mui-selected': {
                color: theme.palette.primary.main,
                fontWeight: 600,
              },
              '&.Mui-disabled': {
                color: theme.palette.text.disabled,
                opacity: 0.5,
              },
            },
            '& .MuiTabs-indicator': {
              height: 3,
              backgroundColor: theme.palette.primary.main,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          {sections.map((section) => (
            <Tab
              key={section.id}
              disabled={section.disabled}
              label={section.title}
            />
          ))}
        </Tabs>
      </Paper>

      {/* Horizontal Scrollable Content */}
      <Box
        ref={scrollContainerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          scrollBehavior: 'smooth',
          // Add padding top to account for sticky tabs
          pt: 0,
          // Style the horizontal scrollbar for this container
          '&::-webkit-scrollbar': {
            height: 4, // Very thin horizontal scrollbar
            width: 4, // Very thin vertical scrollbar (if ever needed)
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent', // No background
            borderRadius: 2,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: alpha(theme.palette.action.disabled, 0.4),
            borderRadius: 2,
            transition: theme.transitions.create('background-color'),
            '&:hover': {
              backgroundColor: alpha(theme.palette.action.disabled, 0.6),
            },
            '&:active': {
              backgroundColor: alpha(theme.palette.primary.main, 0.6),
            },
          },
          // Firefox scrollbar styling
          scrollbarWidth: 'thin',
          scrollbarColor: `${alpha(theme.palette.action.disabled, 0.4)} transparent`,
          // Hide all scrollbars for nested content
          '& *': {
            '&::-webkit-scrollbar': {
              display: 'none', // Hide scrollbar for WebKit browsers
            },
            scrollbarWidth: 'none', // Hide scrollbar for Firefox
            msOverflowStyle: 'none', // Hide scrollbar for IE/Edge
          },
        }}
      >
        {sections.map((section, index) => {
          const setSectionRef = (el: HTMLDivElement | null) => {
            sectionRefs.current[index] = el;
          };

          return (
            <Box
              key={section.id}
              ref={setSectionRef}
              sx={{
                minWidth: '100%',
                width: '100%',
                flexShrink: 0,
                p: 3,
              }}
            >
              {section.component}
            </Box>
          );
        })}
      </Box>

      {/* Additional children can be rendered here if needed */}
      {children}
    </Box>
  );
}

HTabsPanel.defaultProps = {
  selectedTab: undefined,
  onTabChange: undefined,
  children: undefined,
  sx: undefined,
};
