import React, { useState } from 'react';
import { Typography, Box } from '@mui/material';
import { useIntl } from 'react-intl';
import { AssignmentsPanel, StudentsPanel, MaterialsPanel } from '../components';
import type { SortOrder } from '../components/AssignmentsPanel';
import { useMoodleStore } from '@/stores/useMoodleStore';
import type { CourseSessionContext } from '@/stores/useContextStore';
import { HTabsPanel, HTabPanel, type TabSection, type PanelControlConfig } from '@/components/HTabsPanel';

interface CourseOverviewProps {
  sessionContext: CourseSessionContext;
}

export const CourseOverview: React.FC<CourseOverviewProps> = ({
  sessionContext,
}) => {
  const intl = useIntl();
  const { fetchCourseContent, getCourseContent } = useMoodleStore();
  const [selectedTab, setSelectedTab] = useState(0);

  // Search states for each section
  const [searchTerms, setSearchTerms] = useState({
    assignments: '',
    materials: '',
    students: '',
  });

  // Sort state for assignments
  const [assignmentSortOrder, setAssignmentSortOrder] = useState<SortOrder>('newest');

  // Filter state for materials (multi-select)
  const [materialsTypeFilter, setMaterialsTypeFilter] = useState<string[]>([]);

  const sessionId = sessionContext.sessionId;

  // Get course content from Moodle (already fetched by parent CourseView)
  const courseContent = getCourseContent(sessionId);

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

  const updateSearchTerm = (sectionId: string, value: string) => {
    setSearchTerms(prev => ({ ...prev, [sectionId]: value }));
  };

  // Get available material types
  const getAvailableMaterialTypes = () => {
    const activities = courseContent?.activities || [];
    const types = new Set(activities.map(activity => activity.modname));
    return Array.from(types).sort();
  };

  const getMaterialTypeLabel = (modname: string) => {
    const labelKey = `courseOverview.materials.types.${modname}`;
    const fallback = modname.charAt(0).toUpperCase() + modname.slice(1);

    // Try to get the translated label, fallback to capitalized modname if not found
    try {
      return intl.formatMessage({ id: labelKey });
    } catch {
      return fallback;
    }
  };

  const sections: TabSection[] = [
    {
      id: 'assignments',
      title: intl.formatMessage({ id: 'courseOverview.assignments.title' }),
      component: (
        <HTabPanel
          title={intl.formatMessage({ id: 'courseOverview.assignments.title' })}
          controlsConfig={{
            search: {
              enabled: true,
              placeholder: intl.formatMessage({ id: 'courseOverview.search.placeholder' }, {
                section: intl.formatMessage({ id: 'courseOverview.assignments.title' }).toLowerCase()
              }),
              value: searchTerms.assignments,
              onChange: (value: string) => updateSearchTerm('assignments', value)
            },
            sort: {
              enabled: true,
              order: assignmentSortOrder,
              onOrderChange: setAssignmentSortOrder,
              tooltips: {
                newest: intl.formatMessage({ id: 'courseOverview.assignments.sortNewest' }),
                oldest: intl.formatMessage({ id: 'courseOverview.assignments.sortOldest' })
              }
            }
          }}
        >
          <AssignmentsPanel
            assignments={courseContent?.assignments || []}
            isLoading={courseContent?.isLoading || false}
            error={courseContent?.error || null}
            searchTerm={searchTerms.assignments}
            onSearchChange={(value: string) => updateSearchTerm('assignments', value)}
            sortOrder={assignmentSortOrder}
            onSortChange={setAssignmentSortOrder}
          />
        </HTabPanel>
      ),
    },
    {
      id: 'materials',
      title: intl.formatMessage({ id: 'courseOverview.materials.title' }),
      component: (
        <HTabPanel
          title={intl.formatMessage({ id: 'courseOverview.materials.title' })}
          controlsConfig={{
            search: {
              enabled: true,
              placeholder: intl.formatMessage({ id: 'courseOverview.search.placeholder' }, {
                section: intl.formatMessage({ id: 'courseOverview.materials.title' }).toLowerCase()
              }),
              value: searchTerms.materials,
              onChange: (value: string) => updateSearchTerm('materials', value)
            },
            filter: {
              enabled: true,
              selectedTypes: materialsTypeFilter,
              availableTypes: getAvailableMaterialTypes(),
              onTypeChange: setMaterialsTypeFilter,
              getTypeLabel: getMaterialTypeLabel,
              allTypesLabel: intl.formatMessage({ id: 'courseOverview.materials.allTypes' })
            }
          }}
        >
          <MaterialsPanel
            activities={courseContent?.activities || []}
            isLoading={courseContent?.isLoading || false}
            error={courseContent?.error || null}
            searchTerm={searchTerms.materials}
            onSearchChange={(value: string) => updateSearchTerm('materials', value)}
            typeFilter={materialsTypeFilter}
            onTypeFilterChange={setMaterialsTypeFilter}
          />
        </HTabPanel>
      ),
    },
    {
      id: 'students',
      title: intl.formatMessage({ id: 'courseOverview.students.title' }),
      component: (
        <HTabPanel
          title={intl.formatMessage({ id: 'courseOverview.students.title' })}
          controlsConfig={{
            search: {
              enabled: true,
              placeholder: intl.formatMessage({ id: 'courseOverview.search.placeholder' }, {
                section: intl.formatMessage({ id: 'courseOverview.students.title' }).toLowerCase()
              }),
              value: searchTerms.students,
              onChange: (value: string) => updateSearchTerm('students', value)
            }
          }}
        >
          <StudentsPanel
            students={courseContent?.students || []}
            isLoading={courseContent?.isLoading || false}
            error={courseContent?.error || null}
            searchTerm={searchTerms.students}
            onSearchChange={(value: string) => updateSearchTerm('students', value)}
          />
        </HTabPanel>
      ),
    },
  ];

  const isLoading = courseContent?.isLoading || false;

  // Handle tab change
  const handleTabChange = (newValue: number) => {
    setSelectedTab(newValue);
  };

  return (
    <Box
      sx={{
        p: 3,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'inherit',
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 500 }}>
          {courseCode} {intl.formatMessage({ id: 'courseOverview.title' })} • {sessionContext.sessionName}
        </Typography>
      </Box>

      {/* Horizontal Tabs Panel */}
      <HTabsPanel
        sections={sections}
        selectedTab={selectedTab}
        onTabChange={handleTabChange}
      />
    </Box>
  );
};
