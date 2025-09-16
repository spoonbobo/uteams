import type { MoodleUser } from './moodle';
import type { MoodleSubmission, MoodleGrade } from './moodle';

// Student submission data type
export interface StudentSubmissionData {
  student: MoodleUser;
  submission?: MoodleSubmission;
  grade?: MoodleGrade;
  currentGrade: string;
  feedback: string;
  isEditing: boolean;
}

// Statistics interface
export interface GradingStats {
  totalStudents: number;
  submitted: number;
  pending: number;
  graded: number;
  ungraded: number;
  published: number;
  unpublished: number;
}

// AI grading result interface
export interface AIGradeResult {
  grade: number;
  feedback: string;
}

// Detailed AI grading result interface
export interface DetailedAIGradeResult {
  comments: Array<{
    elementType: string;
    elementIndex: string;
    color: 'red' | 'yellow' | 'green';
    comment: string;
  }>;
  overallScore: number;
  shortFeedback: string;
}

// Rubric content interface
export interface RubricContent {
  text: string;
  html: string;
  wordCount: number;
  characterCount: number;
  filename: string;
  filePath?: string; // Path to the saved file for persistence
  elementCounts?: {
    paragraph: number;
    heading1: number;
    heading2: number;
    heading3: number;
    heading4: number;
    heading5: number;
    heading6: number;
    list: number;
    listItem: number;
    table: number;
    tableRow: number;
    tableCell: number;
  };
}

// Assignment rubric mapping
export interface AssignmentRubric {
  assignmentId: string;
  rubricContent: RubricContent;
  uploadedAt: number;
}

// Grading status for student-assignment combination
export interface GradingRecord {
  assignmentId: string;
  studentId: string;
  aiGradeResult: AIGradeResult | null;
  detailedAIGradeResult: DetailedAIGradeResult | null; // Store detailed AI grading results
  isAIGraded: boolean;
  gradedAt?: number;
  finalGrade?: string;
  finalFeedback?: string;
}

// Persisted grading data per session
export interface PersistedGradingData {
  selectedAssignment: string;
  selectedSubmission: string | null;
  assignmentRubrics: AssignmentRubric[];
  gradingRecords: GradingRecord[];
}
