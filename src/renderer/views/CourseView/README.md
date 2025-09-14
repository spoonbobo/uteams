# CourseView Subviews

This folder contains the decomposed CourseView components, organized by functionality to support future tabs and views.

## Structure

```
CourseView/
├── index.ts                    # Barrel exports
├── CourseView.tsx              # Main view controller
├── AskView.tsx                 # Ask {CourseCode} chat functionality
├── CourseOverview.tsx          # Course overview with left-side tabs
├── components/                 # Course content components
│   ├── index.ts               # Component exports
│   ├── AssignmentsPanel.tsx   # Assignments display
│   ├── StudentsPanel.tsx      # Students list with search
│   └── MaterialsPanel.tsx     # Course materials organized by sections
└── README.md                  # This documentation
```

## Adding New Tabs/Views

To add a new tab view to the CourseView:

1. **Create the new view component** (e.g., `MaterialsView.tsx`):
```tsx
import React from 'react';
import { Box, Typography } from '@mui/material';
import type { CourseSessionContext } from '../../stores/useContextStore';

interface MaterialsViewProps {
  sessionContext: CourseSessionContext;
}

export const MaterialsView: React.FC<MaterialsViewProps> = ({
  sessionContext,
}) => {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Course Materials
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {sessionContext.sessionName}
      </Typography>
      {/* Your materials content here */}
    </Box>
  );
};
```

2. **Export it from index.ts**:
```tsx
export { CourseView } from './CourseView';
export { OverviewView } from './OverviewView';
export { MaterialsView } from './MaterialsView'; // Add this line
```

3. **Update CourseView.tsx** to handle the new view:
```tsx
import { MaterialsView } from './MaterialsView'; // Add import

// In the renderContent function:
const renderContent = () => {
  switch (sessionContext.view) {
    case 'overview':
      return <OverviewView sessionContext={sessionContext} />;
    case 'materials': // Add new case
      return <MaterialsView sessionContext={sessionContext} />;
    default:
      return <OverviewView sessionContext={sessionContext} />;
  }
};
```

4. **Update the context store** to include the new tab in the configuration (in `useContextStore.ts`).

## Current Views

### AskView (Top Bar Tab: "Ask {CourseCode}")
- **Ask {CourseCode}** chat functionality
- Includes **ChatWidget** and **PlanWidget** with reactive animations
- Handles course code extraction and display logic
- Original course Q&A interface

### CourseOverview (Top Bar Tab: "Overview")
- **Left-side tabbed interface** with vertical navigation
- **Three main sections:**
  1. **Assignments** - Shows course assignments with due dates, grades, and status
  2. **Students** - Lists enrolled students with search functionality
  3. **Materials** - Displays course content organized by sections
- Integrates with **MoodleStore** for real-time course content
- Dedicated view for browsing course materials and information

### Components
- `AssignmentsPanel` - Displays assignments with due date tracking
- `StudentsPanel` - Shows student list with search and filtering
- `MaterialsPanel` - Organizes course materials by sections with activity types

## Tab Structure

The CourseView now has **two separate tabs** in the top bar:
1. **Ask {CourseCode}** - Chat interface for asking questions about the course
2. **Overview** - Browse assignments, students, and course materials
