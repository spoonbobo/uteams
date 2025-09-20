import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useIntl } from 'react-intl';
import { useMoodleStore } from '@/stores/useMoodleStore';
import { useGradingStore } from '@/stores/useGradingStore';
import type { CourseSessionContext } from '@/stores/useContextStore';
import { HTabsPanel, type TabSection } from '@/components/HTabsPanel';

import {
  AssignmentSelectionPanel,
} from './AssignmentSelectionPanel';
import { AIGradingPanel } from './AIGradingPanel';
import { StudentSubmissionsPanel } from './StudentSubmissionsPanel';

interface GradingViewProps {
  sessionContext: CourseSessionContext;
}

export const GradingView: React.FC<GradingViewProps> = ({ sessionContext }) => {
  const intl = useIntl();
  const theme = useTheme();
  const { getCourseContent, config } = useMoodleStore();
  const [selectedTab, setSelectedTab] = useState(0);


  // Use grading store
  const {
    selectedAssignment,
    selectedSubmission,
    uploadedFile,
    studentData,
    loading,
    submissions,
    grades,
    aiGradeResult,
    isGrading,
    rubricFile,
    rubricContent,
    rubricLoading,
    rubricError,
    setSelectedAssignment,
    setSelectedSubmission,
    setUploadedFile,
    setAiGradeResult,
    setDetailedAIGradeResult,
    setIsGrading,
    setRubricFile,
    setRubricContent,
    setRubricLoading,
    setRubricError,
    loadRubricContent,
    getRubricForAssignment,
    saveRubricForAssignment,
    clearRubricForAssignment,
    getGradingRecord,
    saveGradingRecord,
    clearGradingRecord,
    isStudentAIGraded,
    getStats,
    getSelectedSubmissionData,
    processStudentData,
    loadAssignmentData,
    initializeFromPersistedData,
  } = useGradingStore();

  const sessionId = sessionContext.sessionId;
  const courseContent = getCourseContent(sessionId);
  const assignments = courseContent?.assignments || [];
  const students = courseContent?.students || [];

  // Initialize persisted data on component mount
  useEffect(() => {
    initializeFromPersistedData();
  }, [initializeFromPersistedData]);

  // Validate selectedAssignment exists in current assignments
  useEffect(() => {
    if (assignments.length > 0 && selectedAssignment) {
      const assignmentExists = assignments.some(assignment => assignment.id === selectedAssignment);
      if (!assignmentExists) {
        // Reset to empty if the persisted assignment doesn't exist
        setSelectedAssignment('');
      }
    }
  }, [assignments, selectedAssignment, setSelectedAssignment]);


  // Load assignment submissions and grades when assignment is selected
  useEffect(() => {
    if (selectedAssignment && students.length > 0) {
      loadAssignmentData(selectedAssignment, config);
    }
  }, [selectedAssignment, students.length, loadAssignmentData, config]);

  // Process student data whenever submissions or grades change
  useEffect(() => {
    if (selectedAssignment && students.length > 0) {
      processStudentData(students);
    }
  }, [selectedAssignment, students.length, submissions, grades, processStudentData]);

  // loadAssignmentData and processStudentData are now handled by the store

  // Get computed stats from store
  const stats = getStats();

  const handleAssignmentChange = async (event: any) => {
    const assignmentId = event.target.value as string;
    await setSelectedAssignment(assignmentId);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleUploadClick = () => {
    // This will be handled by the AIGradingPanel component
  };

  const handleSubmissionSelect = (submissionId: string) => {
    setSelectedSubmission(submissionId);

    // Load existing grading record for this student-assignment combination
    if (selectedAssignment && submissionId) {
      const existingRecord = getGradingRecord(selectedAssignment, submissionId);
      if (existingRecord) {
        setAiGradeResult(existingRecord.aiGradeResult);
        // Also restore detailed AI results if available
        if (existingRecord.detailedAIGradeResult) {
          setDetailedAIGradeResult(existingRecord.detailedAIGradeResult);
        }
      } else {
        // Clear previous grading data if no record exists
        setAiGradeResult(null);
        setDetailedAIGradeResult(null);
      }
    }
  };

  // Status functions moved to individual panel components

  // Get selected submission data from store
  const selectedSubmissionData = getSelectedSubmissionData();
  const selectedAssignmentData = assignments.find(a => a.id === selectedAssignment);


  // Handle tab change
  const handleTabChange = (newValue: number) => {
    setSelectedTab(newValue);
  };

  const canProceedToTab = (tabIndex: number) => {
    switch (tabIndex) {
      case 0: return true; // Select Assignment - always available
      case 1: return !!selectedAssignment; // Student Submissions
      case 2: {
        // AI Grading - requires assignment, submission, and student must have submitted work
        if (!selectedAssignment || !selectedSubmission) return false;
        const selectedSubmissionData = getSelectedSubmissionData();
        const hasSubmittedWork = selectedSubmissionData?.submission?.status === 'submitted';
        return hasSubmittedWork;
      }
      default: return false;
    }
  };

  const runAIGrading = () => {
    if (!selectedAssignment || !selectedSubmission) return;

    setIsGrading(true);
    // Simulate AI grading
    setTimeout(() => {
      const grade = Math.floor(Math.random() * 30) + 70;
      const feedback = 'Good understanding of core concepts. Code structure is well-organized. Consider adding more comments for complex logic sections.';

      const aiResult = { grade, feedback };

      // Save the AI grading result to the grading record
      saveGradingRecord(selectedAssignment, selectedSubmission, aiResult);

      setIsGrading(false);
    }, 2000);
  };

  const sections: TabSection[] = [
    {
      id: 'assignment-selection',
      title: intl.formatMessage({ id: 'grading.steps.selectAssignment' }),
      disabled: !canProceedToTab(0),
      component: (
        <Box sx={{ position: 'relative' }}>
          <AssignmentSelectionPanel
            assignments={assignments}
            selectedAssignment={selectedAssignment}
            selectedAssignmentData={selectedAssignmentData}
            stats={stats}
            rubricFile={rubricFile}
            rubricContent={rubricContent}
            rubricLoading={rubricLoading}
            rubricError={rubricError}
            onAssignmentChange={handleAssignmentChange}
            onRubricFileChange={setRubricFile}
            onLoadRubricContent={loadRubricContent}
            onClearRubric={() => {
              if (selectedAssignment) {
                clearRubricForAssignment(selectedAssignment);
              } else {
                setRubricContent(null);
                setRubricError(null);
              }
            }}
            onNext={() => handleTabChange(1)}
          />
          {!canProceedToTab(0) && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: alpha(theme.palette.background.default, 0.8),
                backdropFilter: 'blur(4px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Typography variant="h6" color="text.secondary" textAlign="center">
                {intl.formatMessage({ id: 'grading.completeSteps' })}
              </Typography>
            </Box>
          )}
        </Box>
      ),
    },
    {
      id: 'student-submissions',
      title: intl.formatMessage({ id: 'grading.steps.studentSubmissions' }),
      disabled: !canProceedToTab(1),
      component: (
        <Box sx={{ position: 'relative' }}>
          <StudentSubmissionsPanel
            selectedAssignment={selectedAssignment}
            selectedSubmission={selectedSubmission}
            selectedAssignmentData={selectedAssignmentData}
            selectedSubmissionData={selectedSubmissionData}
            studentData={studentData}
            loading={loading}
            stats={stats}
            onSubmissionSelect={handleSubmissionSelect}
            onBack={() => handleTabChange(0)}
            onNext={() => handleTabChange(2)}
            onViewGradingDetail={(studentId: string) => {
              // Select the student and navigate to AI Grading tab
              setSelectedSubmission(studentId);
              handleTabChange(2);
            }}
          />
          {!canProceedToTab(1) && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: alpha(theme.palette.background.default, 0.8),
                backdropFilter: 'blur(4px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Typography variant="h6" color="text.secondary" textAlign="center">
                {intl.formatMessage({ id: 'grading.selectAssignmentFirst' })}
              </Typography>
            </Box>
          )}
        </Box>
      ),
    },
    {
      id: 'ai-grading',
      title: intl.formatMessage({ id: 'grading.steps.aiGrading' }),
      disabled: !canProceedToTab(2),
      component: (
        <Box sx={{ position: 'relative' }}>
          <AIGradingPanel
            selectedAssignment={selectedAssignment}
            selectedSubmission={selectedSubmission}
            selectedAssignmentData={selectedAssignmentData}
            selectedSubmissionData={selectedSubmissionData}
            rubricContent={rubricContent}
            aiGradeResult={aiGradeResult}
            isGrading={isGrading}
            onRunAIGrading={runAIGrading}
            onBack={() => handleTabChange(1)}
            onNext={() => {}}
          />
          {!canProceedToTab(2) && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: alpha(theme.palette.background.default, 0.8),
                backdropFilter: 'blur(4px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Typography variant="h6" color="text.secondary" textAlign="center">
                {intl.formatMessage({ id: 'grading.selectSubmissionFirst' })}
              </Typography>
            </Box>
          )}
        </Box>
      ),
    },
  ];

  if (courseContent?.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Horizontal Tabs Panel */}
      <HTabsPanel
        sections={sections}
        selectedTab={selectedTab}
        onTabChange={handleTabChange}
      />
    </Box>
  );
};
