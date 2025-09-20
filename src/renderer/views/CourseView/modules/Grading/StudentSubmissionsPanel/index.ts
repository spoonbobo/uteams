// Export main component
export { StudentSubmissionsPanel } from './StudentSubmissionsPanel';

// Export all decomposed components
export { default as SubmissionsTableHeader } from './SubmissionsTableHeader';
export { CategoryHeader } from './CategoryHeader';
export { StudentRow } from './StudentRow';
export { default as useFilePreviewHandler } from './FilePreviewHandler';

// Export hooks
export {
  useSubmissionFiles,
  useStudentFiles,
  useDialogStates,
  useCollapsibleCategories,
  useGradingActions,
} from './hooks';

// Export utilities
export {
  getSubmissionStatus,
  getGradeStatus,
  getInitials,
  getAvatarColor,
  categorizeStudents,
} from './utils';

// Export types
export type {
  StudentSubmissionsPanelProps,
  SubmissionFile,
  SubmissionStatus,
  GradeStatus,
  SubmitGradeDialogData,
  CollapsedCategories,
  CategorizedStudents,
  CategoryKey,
} from './types';
