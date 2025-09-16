export interface MoodleSubmission {
  userid: string;
  status: string;
  timemodified?: number;
  attemptnumber?: number;
}

export interface MoodleGrade {
  userid: string;
  grade: number;
  timemodified?: number;
  feedback?: string;
}

export interface MoodleConfig {
  baseUrl: string;
  apiKey: string;
}

export interface MoodleConnectionInfo {
  userid?: number;
  username?: string;
  firstname?: string;
  lastname?: string;
  fullname?: string;
  email?: string;
  sitename?: string;
  siteurl?: string;
}

export interface MoodleCourse {
  id: string;
  fullname: string;
  shortname: string;
  categoryid?: number;
  summary?: string;
  startdate?: number;
  enddate?: number;
  visible?: boolean;
  enrollmentmethods?: string[];
}

export interface MoodleUser {
  id: string;
  username: string;
  firstname: string;
  lastname: string;
  fullname: string;
  email: string;
  department?: string;
  institution?: string;
}

export interface MoodleAssignment {
  id: string;
  name: string;
  intro: string;
  duedate: number;
  cutoffdate?: number;
  allowsubmissionsfromdate?: number;
  grade: number;
  timemodified: number;
  courseid: string;
  section?: number;
  visible?: boolean;
  cmid?: string; // Course module ID for proper URL generation
}

export interface MoodleActivity {
  id: string;
  name: string;
  modname: string;
  courseid: string;
  section: number;
  visible: boolean;
  url?: string;
  description?: string;
}

export interface CourseContent {
  assignments: MoodleAssignment[];
  students: MoodleUser[];
  activities: MoodleActivity[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
}
