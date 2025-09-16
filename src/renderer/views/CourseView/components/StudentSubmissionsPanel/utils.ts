import type { StudentSubmissionData } from '../../../../types/grading';
import type { SubmissionStatus, GradeStatus, CategorizedStudents } from './types';

export const getSubmissionStatus = (data: StudentSubmissionData): SubmissionStatus => {
  if (!data.submission) {
    return { status: 'not_submitted', label: 'Not Submitted', color: 'error' as const };
  }
  
  switch (data.submission.status) {
    case 'submitted':
      return { status: 'submitted', label: 'Submitted', color: 'success' as const };
    case 'draft':
      return { status: 'draft', label: 'Draft', color: 'warning' as const };
    default:
      return { status: 'pending', label: 'Pending', color: 'default' as const };
  }
};

export const getGradeStatus = (data: StudentSubmissionData): GradeStatus => {
  if (data.grade && data.grade.grade > 0) {
    return { status: 'published', label: `Graded: ${data.grade.grade}`, color: 'primary' as const };
  } else if (data.currentGrade && data.currentGrade !== '0' && data.currentGrade !== '') {
    return { status: 'unpublished', label: `Draft: ${data.currentGrade}`, color: 'secondary' as const };
  } else {
    return { status: 'ungraded', label: 'Not Graded', color: 'default' as const };
  }
};

export const getInitials = (fullname: string): string => {
  return fullname
    .split(' ')
    .map((name) => name[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const getAvatarColor = (name: string): string => {
  // More balanced colors that work well in both light and dark themes
  const colors = [
    '#e57373', '#f06292', '#ba68c8', '#9575cd',
    '#7986cb', '#64b5f6', '#4fc3f7', '#4dd0e1',
    '#4db6ac', '#81c784', '#aed581', '#dce775',
    '#fff176', '#ffd54f', '#ffb74d', '#ff8a65',
  ];
  
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
};

export const categorizeStudents = (students: StudentSubmissionData[]): CategorizedStudents => {
  const notGradedSubmitted: StudentSubmissionData[] = [];
  const graded: StudentSubmissionData[] = [];
  const notGradedNotSubmitted: StudentSubmissionData[] = [];

  students.forEach(student => {
    const hasSubmission = student.submission && student.submission.status === 'submitted';
    const isGraded = (student.grade && student.grade.grade > 0) || 
                    (student.currentGrade && student.currentGrade !== '0' && student.currentGrade !== '');

    if (hasSubmission && !isGraded) {
      notGradedSubmitted.push(student);
    } else if (isGraded) {
      graded.push(student);
    } else {
      notGradedNotSubmitted.push(student);
    }
  });

  return {
    notGradedSubmitted,
    graded,
    notGradedNotSubmitted
  };
};
