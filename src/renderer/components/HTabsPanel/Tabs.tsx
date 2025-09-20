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
  const isRenderingHeavyContent = useRef(false);

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

      // Clear the flag after scroll completes with a more reliable mechanism
      const clearFlag = () => {
        isScrollingProgrammatically.current = false;
      };

      // Use both timeout and scroll end detection for better reliability
      const timeoutId = setTimeout(clearFlag, 800); // Increased timeout for safety

      // Also clear flag when scroll animation actually completes
      const handleScrollEnd = () => {
        const currentScrollLeft = container.scrollLeft;
        const expectedScrollLeft = index * container.clientWidth;

        // If we're close to the target position, clear the flag
        if (Math.abs(currentScrollLeft - expectedScrollLeft) < 5) {
          clearTimeout(timeoutId);
          clearFlag();
          container.removeEventListener('scroll', handleScrollEnd);
        }
      };

      // Add temporary scroll listener to detect when animation completes
      container.addEventListener('scroll', handleScrollEnd, { passive: true });
    }
  };

  // Handle tab change and scroll to section
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    // Set flag to prevent interference during tab switching
    isRenderingHeavyContent.current = true;

    if (externalSelectedTab === undefined) {
      setInternalSelectedTab(newValue);
    }
    onTabChange?.(newValue);
    scrollToSection(newValue);

    // Clear the heavy rendering flag after a delay to allow content to stabilize
    setTimeout(() => {
      isRenderingHeavyContent.current = false;
    }, 1000);
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
      // Don't update tabs during programmatic scrolling or heavy rendering
      if (
        isScrollingProgrammatically.current ||
        isRenderingHeavyContent.current ||
        !scrollContainerRef.current
      )
        return;

      const container = scrollContainerRef.current;
      const { scrollLeft, clientWidth: containerWidth } = container;

      // Calculate which section we're closest to based on scroll position
      // Use a more precise calculation to avoid incorrect tab switching
      const scrollProgress = scrollLeft / containerWidth;
      const currentIndex = Math.round(scrollProgress);
      const clampedIndex = Math.max(
        0,
        Math.min(sections.length - 1, currentIndex),
      );

      // Only update if we're significantly close to the target position
      // This prevents premature tab switching during smooth scroll animations
      const threshold = 0.1; // 10% threshold
      const distanceFromTarget = Math.abs(scrollProgress - currentIndex);

      if (clampedIndex !== selectedTab && distanceFromTarget < threshold) {
        if (externalSelectedTab === undefined) {
          setInternalSelectedTab(clampedIndex);
        }
        onTabChange?.(clampedIndex);
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      // Use passive listener for better performance
      container.addEventListener('scroll', handleScroll, { passive: true });
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
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          scrollBehavior: 'smooth',
          // Add padding top to account for sticky tabs
          pt: 0,
          // Style the horizontal scrollbar for this container
          '&::-webkit-scrollbar': {
            height: 2, // Ultra-thin horizontal scrollbar
            width: 2, // Ultra-thin vertical scrollbar (if ever needed)
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent', // No background
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor:
              theme.palette.mode === 'dark'
                ? alpha(theme.palette.grey[500], 0.4)
                : alpha(theme.palette.grey[400], 0.4),
            borderRadius: 1,
            transition: theme.transitions.create(['background-color'], {
              duration: theme.transitions.duration.short,
            }),
            '&:hover': {
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.grey[400], 0.6)
                  : alpha(theme.palette.grey[500], 0.6),
            },
            '&:active': {
              backgroundColor: alpha(theme.palette.primary.main, 0.7),
            },
          },
          // Firefox scrollbar styling
          scrollbarWidth: 'thin',
          scrollbarColor:
            theme.palette.mode === 'dark'
              ? `${alpha(theme.palette.grey[500], 0.4)} transparent`
              : `${alpha(theme.palette.grey[400], 0.4)} transparent`,
        }}
      >
        {sections.map((section, index) => {
          const setSectionRef = (el: HTMLDivElement | null) => {
            sectionRefs.current[index] = el;
          };

          // Lazy load content: only render the current tab and adjacent tabs
          // This prevents heavy computations in non-visible tabs during scroll animations
          const isCurrentTab = index === selectedTab;
          const isAdjacentTab = Math.abs(index - selectedTab) <= 1;
          const shouldRenderContent = isCurrentTab || isAdjacentTab;

          return (
            <Box
              key={section.id}
              ref={setSectionRef}
              sx={{
                minWidth: '100%',
                width: '100%',
                flexShrink: 0,
                p: 3,
                height: '100%',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  // Hide vertical scrollbar while allowing scroll
                  '&::-webkit-scrollbar': {
                    display: 'none', // Hide scrollbar for WebKit browsers
                  },
                  scrollbarWidth: 'none', // Hide scrollbar for Firefox
                  msOverflowStyle: 'none', // Hide scrollbar for IE/Edge
                }}
              >
                {shouldRenderContent ? (
                  section.component
                ) : (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      height: '200px',
                      color: 'text.secondary',
                    }}
                  >
                    Loading...
                  </Box>
                )}
              </Box>
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
