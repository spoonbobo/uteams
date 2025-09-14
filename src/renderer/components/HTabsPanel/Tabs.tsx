import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { Typography, Box, Paper, Tabs, Tab, Skeleton } from '@mui/material';

export interface TabSection {
  id: string;
  title: string;
  count: number;
  component: ReactNode;
  disabled?: boolean;
}

interface HTabsPanelProps {
  sections: TabSection[];
  isLoading?: boolean;
  selectedTab?: number;
  onTabChange?: (index: number) => void;
  children?: ReactNode;
}

export const HTabsPanel: React.FC<HTabsPanelProps> = ({
  sections,
  isLoading = false,
  selectedTab: externalSelectedTab,
  onTabChange,
  children
}) => {
  const [internalSelectedTab, setInternalSelectedTab] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isScrollingProgrammatically = useRef(false);
  
  // Use external selectedTab if provided, otherwise use internal state
  const selectedTab = externalSelectedTab !== undefined ? externalSelectedTab : internalSelectedTab;
  
  // Handle tab change and scroll to section
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    if (externalSelectedTab === undefined) {
      setInternalSelectedTab(newValue);
    }
    onTabChange?.(newValue);
    scrollToSection(newValue);
  };

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
        behavior: 'smooth'
      });
      
      // Clear the flag after scroll completes
      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 500); // Give enough time for smooth scroll to complete
    }
  };

  // Sync scroll position when external selectedTab changes
  useEffect(() => {
    if (externalSelectedTab !== undefined) {
      const container = scrollContainerRef.current;
      if (container) {
        const currentScrollIndex = Math.round(container.scrollLeft / container.clientWidth);
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
      if (isScrollingProgrammatically.current || !scrollContainerRef.current) return;
      
      const container = scrollContainerRef.current;
      const scrollLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;
      
      // Calculate which section we're closest to based on scroll position
      const currentIndex = Math.round(scrollLeft / containerWidth);
      const clampedIndex = Math.max(0, Math.min(sections.length - 1, currentIndex));
      
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
  }, [selectedTab, sections.length, externalSelectedTab, onTabChange]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Horizontal Tabs */}
      <Paper sx={{ mb: 2, borderRadius: 2 }}>
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
            },
            '& .MuiTabs-indicator': {
              height: 3,
            },
          }}
        >
          {sections.map((section, index) => (
            <Tab
              key={section.id}
              disabled={section.disabled}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>{section.title}</span>
                  {isLoading ? (
                    <Skeleton variant="text" width={20} height={16} sx={{ borderRadius: 1 }} />
                  ) : (
                    <Box
                      sx={{
                        backgroundColor: 'action.hover',
                        color: 'text.secondary',
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        minWidth: 20,
                        textAlign: 'center',
                      }}
                    >
                      {section.count}
                    </Box>
                  )}
                </Box>
              }
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
          '&::-webkit-scrollbar': {
            height: 8,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'action.hover',
            borderRadius: 4,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'action.disabled',
            borderRadius: 4,
            '&:hover': {
              backgroundColor: 'action.active',
            },
          },
        }}
      >
        {sections.map((section, index) => (
          <Box
            key={section.id}
            ref={(el) => (sectionRefs.current[index] = el as HTMLDivElement | null)}
            sx={{
              minWidth: '100%',
              width: '100%',
              flexShrink: 0,
              p: 3,
            }}
          >
            {section.component}
          </Box>
        ))}
      </Box>
      
      {/* Additional children can be rendered here if needed */}
      {children}
    </Box>
  );
};
