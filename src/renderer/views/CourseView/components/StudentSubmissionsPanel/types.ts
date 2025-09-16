import type { MoodleAssignment } from '../../../../types/moodle';
import type { StudentSubmissionData, GradingStats } from '../../../../types/grading';

export interface StudentSubmissionsPanelProps {
  selectedAssignment: string;
  selectedSubmission: string | null;
  selectedAssignmentData?: MoodleAssignment;
  selectedSubmissionData?: StudentSubmissionData;
  studentData: StudentSubmissionData[];
  loading: boolean;
  stats: GradingStats;
  onSubmissionSelect: (submissionId: string) => void;
  onBack: () => void;
  onNext: () => void;
  onViewGradingDetail?: (studentId: string) => void;
}

export interface SubmissionFile {
  filename: string;
  filesize: number;
  fileurl: string;
  mimetype: string;
  timemodified: number;
}

export interface SubmissionStatus {
  status: 'not_submitted' | 'submitted' | 'draft' | 'pending';
  label: string;
  color: 'error' | 'success' | 'warning' | 'default';
}

export interface GradeStatus {
  status: 'published' | 'unpublished' | 'ungraded';
  label: string;
  color: 'primary' | 'secondary' | 'default';
}


export interface SubmitGradeDialogData {
  assignment: string;
  submission: string;
  assignmentData?: MoodleAssignment;
  submissionData?: StudentSubmissionData;
}

export interface CollapsedCategories {
  readyToGrade: boolean;
  graded: boolean;
  notSubmitted: boolean;
}

export interface CategorizedStudents {
  notGradedSubmitted: StudentSubmissionData[];
  graded: StudentSubmissionData[];
  notGradedNotSubmitted: StudentSubmissionData[];
}

export type CategoryKey = 'readyToGrade' | 'graded' | 'notSubmitted';
