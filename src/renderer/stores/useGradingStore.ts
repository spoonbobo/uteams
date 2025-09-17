import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { MoodleUser } from '../types/moodle';
import { useChatStore } from './useChatStore';
import type { MoodleSubmission, MoodleGrade } from '@/types/moodle';
import type {
  StudentSubmissionData,
  GradingStats,
  AIGradeResult,
  DetailedAIGradeResult,
  RubricContent,
  AssignmentRubric,
  GradingRecord,
  PersistedGradingData,
} from '@/types/grading';

interface GradingState {
  // Assignment selection
  selectedAssignment: string;
  selectedSubmission: string | null;

  // File upload
  uploadedFile: File | null;

  // Rubric management
  rubricFile: File | null;
  rubricContent: RubricContent | null;
  rubricLoading: boolean;
  rubricError: string | null;
  assignmentRubrics: AssignmentRubric[];
  gradingRecords: GradingRecord[];

  // Data arrays
  studentData: StudentSubmissionData[];
  submissions: MoodleSubmission[];
  grades: MoodleGrade[];

  // UI state
  loading: boolean;
  isGrading: boolean;

  // AI grading results
  aiGradeResult: AIGradeResult | null;
  detailedAIGradeResult: DetailedAIGradeResult | null;
  finalGrade: string;
  finalFeedback: string;

  // Grading progress tracking
  gradingInProgress: Set<string>; // Set of student IDs currently being graded
  activeGradingStudent: string | null; // The student whose grading process should be displayed

  // Grading stream state (for real-time updates)
  gradingStreams: Record<string, {
    streamBuffer: string;
    appliedComments: Set<string>;
    tempResult: DetailedAIGradeResult | null;
  }>;

  // Actions
  setSelectedAssignment: (assignmentId: string) => Promise<void>;
  setSelectedSubmission: (submissionId: string | null) => void;
  setUploadedFile: (file: File | null) => void;

  // Rubric actions
  setRubricFile: (file: File | null) => void;
  setRubricContent: (content: RubricContent | null) => void;
  setRubricLoading: (loading: boolean) => void;
  setRubricError: (error: string | null) => void;
  loadRubricContent: (file: File) => Promise<void>;
  reloadRubricFromPath: (assignmentId: string) => Promise<void>;
  getRubricForAssignment: (assignmentId: string) => RubricContent | null;
  saveRubricForAssignment: (assignmentId: string, rubricContent: RubricContent) => void;
  clearRubricForAssignment: (assignmentId: string) => void;

  // Grading status actions
  getGradingRecord: (assignmentId: string, studentId: string) => GradingRecord | null;
  saveGradingRecord: (assignmentId: string, studentId: string, aiGradeResult: AIGradeResult) => void;
  saveDetailedGradingRecord: (assignmentId: string, studentId: string, detailedResult: DetailedAIGradeResult) => void;
  getDetailedAIGradeResult: (assignmentId: string, studentId: string) => DetailedAIGradeResult | null;
  updateFinalGrading: (assignmentId: string, studentId: string, finalGrade: string, finalFeedback: string) => void;
  clearGradingRecord: (assignmentId: string, studentId: string) => void;
  isStudentAIGraded: (assignmentId: string, studentId: string) => boolean;
  setStudentData: (data: StudentSubmissionData[]) => void;
  setSubmissions: (submissions: MoodleSubmission[]) => void;
  setGrades: (grades: MoodleGrade[]) => void;
  setLoading: (loading: boolean) => void;
  setIsGrading: (isGrading: boolean) => void;
  setAiGradeResult: (result: AIGradeResult | null) => void;
  setDetailedAIGradeResult: (result: DetailedAIGradeResult | null) => void;
  setFinalGrade: (grade: string) => void;
  setFinalFeedback: (feedback: string) => void;

  // Computed getters
  getStats: () => GradingStats;
  getSelectedSubmissionData: () => StudentSubmissionData | undefined;

  // Complex actions
  processStudentData: (students: MoodleUser[]) => void;
  clearGradingData: () => void;
  resetToAssignmentSelection: () => void;

  // API actions
  loadAssignmentData: (assignmentId: string, config: { baseUrl: string; apiKey: string }) => Promise<void>;
  submitGrade: (assignmentId: string, userId: string, grade: number, feedback: string, config: { baseUrl: string; apiKey: string }) => Promise<{ success: boolean; error?: string }>;

  // Initialization
  initializeFromPersistedData: () => void;

  // Grading progress actions
  startGrading: (studentId: string) => void;
  finishGrading: (studentId: string) => void;
  setGradingError: (studentId: string, errorMessage?: string, errorType?: 'parsing' | 'format' | 'network' | 'unknown') => void;
  abortGrading: (studentId: string) => void;
  isStudentBeingGraded: (studentId: string) => boolean;
  clearAllGradingProgress: () => void;
  setActiveGradingStudent: (studentId: string | null) => void;
  // Manual method to clear grading progress (useful for debugging or explicit cleanup)
  manualClearGradingProgress: () => void;

  // Grading stream actions
  initGradingStream: (sessionId: string) => void;
  appendToGradingStream: (sessionId: string, token: string) => void;
  processGradingStream: (sessionId: string, assignmentId: string, studentId: string) => void;
  clearGradingStream: (sessionId: string) => void;
  getGradingStream: (sessionId: string) => { streamBuffer: string; appliedComments: Set<string>; tempResult: DetailedAIGradeResult | null; } | null;
}

export const useGradingStore = create<GradingState>()(
  devtools(
    persist(
      (set, get) => ({
      // Initial state
      selectedAssignment: '',
      selectedSubmission: null,
      uploadedFile: null,
      rubricFile: null,
      rubricContent: null,
      rubricLoading: false,
      rubricError: null,
      assignmentRubrics: [],
      gradingRecords: [],
      studentData: [],
      submissions: [],
      grades: [],
      loading: false,
      isGrading: false,
      aiGradeResult: null,
      detailedAIGradeResult: null,
      finalGrade: '',
      finalFeedback: '',
      gradingInProgress: new Set<string>(),
      activeGradingStudent: null,
      gradingStreams: {},

      // Basic setters
      setSelectedAssignment: async (assignmentId: string) => {
        const { getRubricForAssignment, reloadRubricFromPath, selectedAssignment } = get();

        // Load rubric for this assignment if it exists
        const existingRubric = getRubricForAssignment(assignmentId);

        // Only reset submission if assignment actually changed
        const shouldResetSubmission = selectedAssignment !== assignmentId;

        // Clear grading progress only when assignment actually changes
        const shouldClearGradingProgress = selectedAssignment !== assignmentId;

        set({
          selectedAssignment: assignmentId,
          selectedSubmission: shouldResetSubmission ? null : get().selectedSubmission,
          studentData: shouldResetSubmission ? [] : get().studentData, // Reset student data only if assignment changed
          submissions: shouldResetSubmission ? [] : get().submissions,
          grades: shouldResetSubmission ? [] : get().grades,
          aiGradeResult: null,
          detailedAIGradeResult: null,
          finalGrade: '',
          finalFeedback: '',
          uploadedFile: null,
          // Load existing rubric for this assignment
          rubricContent: existingRubric,
          rubricFile: null, // Don't restore file object
          rubricError: null,
          // Clear grading progress only when assignment changes
          ...(shouldClearGradingProgress && {
            gradingInProgress: new Set<string>(),
            activeGradingStudent: null
          })
        });

        // If rubric exists and has a file path, try to reload from path
        if (existingRubric && existingRubric.filePath) {
          await reloadRubricFromPath(assignmentId);
        }
      },

      setSelectedSubmission: (submissionId: string | null) => {
        // When switching students, clear AI grading results but keep confirmation status
        // The confirmation will be checked again when accessing AI grading tab
        set({
          selectedSubmission: submissionId,
          aiGradeResult: null,
          detailedAIGradeResult: null,
          finalGrade: '',
          finalFeedback: ''
        });
      },

      setUploadedFile: (file: File | null) => {
        set({ uploadedFile: file });
      },

      setStudentData: (data: StudentSubmissionData[]) => {
        set({ studentData: data });
      },

      setSubmissions: (submissions: MoodleSubmission[]) => {
        set({ submissions });
      },

      setGrades: (grades: MoodleGrade[]) => {
        set({ grades });
      },

      setLoading: (loading: boolean) => {
        set({ loading });
      },

      setIsGrading: (isGrading: boolean) => {
        set({ isGrading });
      },

      setAiGradeResult: (result: AIGradeResult | null) => {
        set({ aiGradeResult: result });
      },

      setDetailedAIGradeResult: (result: DetailedAIGradeResult | null) => {
        set({ detailedAIGradeResult: result });
      },

      setFinalGrade: (grade: string) => {
        set({ finalGrade: grade });
      },

      setFinalFeedback: (feedback: string) => {
        set({ finalFeedback: feedback });
      },

      // Rubric management
      setRubricFile: (file: File | null) => {
        set({ rubricFile: file });
      },

      setRubricContent: (content: RubricContent | null) => {
        set({ rubricContent: content });
      },

      setRubricLoading: (loading: boolean) => {
        set({ rubricLoading: loading });
      },

      setRubricError: (error: string | null) => {
        set({ rubricError: error });
      },

      loadRubricContent: async (file: File) => {
        const { selectedAssignment, saveRubricForAssignment } = get();
        set({ rubricLoading: true, rubricError: null });

        try {
          // Save file to temp location first
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Use IPC to save and parse the file
          const saveResult = await window.electron.ipcRenderer.invoke('fileio:save-temp-file', {
            filename: file.name,
            data: Array.from(uint8Array)
          });

          if (!saveResult.success) {
            throw new Error(saveResult.error || 'Failed to save rubric file');
          }

          // Add a small delay before parsing to ensure file is fully written
          await new Promise(resolve => setTimeout(resolve, 100));

          // Parse the DOCX file with retry logic
          let parseResult;
          let parseSuccess = false;
          const maxParseRetries = 2;

          for (let attempt = 1; attempt <= maxParseRetries && !parseSuccess; attempt++) {
            parseResult = await window.electron.ipcRenderer.invoke('docx:parse-file', {
              filePath: saveResult.filePath
            });

            if (parseResult.success) {
              parseSuccess = true;
            } else if (parseResult.error.includes('Corrupted zip') || parseResult.error.includes('End of data reached')) {
              // Wait before retry
              if (attempt < maxParseRetries) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            } else {
              // Non-corruption error, don't retry
              break;
            }
          }

          if (!parseSuccess) {
            throw new Error(parseResult?.error || 'Failed to parse rubric file');
          }

          const rubricContent: RubricContent = {
            ...parseResult.content,
            filename: file.name,
            filePath: saveResult.filePath // Store the file path for persistence
          };

          // Save rubric for the current assignment
          if (selectedAssignment) {
            saveRubricForAssignment(selectedAssignment, rubricContent);
          }

          set({ rubricContent, rubricError: null });
        } catch (error: any) {
          console.error('[GradingStore] Error loading rubric:', error);
          set({ rubricError: error.message || 'Failed to load rubric file' });
        } finally {
          set({ rubricLoading: false });
        }
      },

      // Assignment-specific rubric management
      getRubricForAssignment: (assignmentId: string): RubricContent | null => {
        const { assignmentRubrics } = get();
        const rubric = assignmentRubrics.find(r => r.assignmentId === assignmentId);
        return rubric ? rubric.rubricContent : null;
      },

      saveRubricForAssignment: (assignmentId: string, rubricContent: RubricContent) => {
        const { assignmentRubrics } = get();

        const newRubric: AssignmentRubric = {
          assignmentId,
          rubricContent,
          uploadedAt: Date.now()
        };

        // Remove existing rubric for this assignment and add new one
        const updatedRubrics = assignmentRubrics.filter(r => r.assignmentId !== assignmentId);
        updatedRubrics.push(newRubric);

        set({ assignmentRubrics: updatedRubrics });
      },

      reloadRubricFromPath: async (assignmentId: string) => {
        const { getRubricForAssignment } = get();
        const existingRubric = getRubricForAssignment(assignmentId);

        if (!existingRubric || !existingRubric.filePath) {
          return;
        }
        set({ rubricLoading: true, rubricError: null });

        try {
          // Check if file still exists and re-parse it
          const parseResult = await window.electron.ipcRenderer.invoke('docx:parse-file', {
            filePath: existingRubric.filePath
          });

          if (parseResult.success) {
            const updatedRubricContent: RubricContent = {
              ...parseResult.content,
              filename: existingRubric.filename,
              filePath: existingRubric.filePath
            };

            // Update the stored rubric content
            const { saveRubricForAssignment } = get();
            saveRubricForAssignment(assignmentId, updatedRubricContent);

            set({ rubricContent: updatedRubricContent, rubricError: null });
          } else {
            console.warn('[GradingStore] Could not reload rubric from path:', existingRubric.filePath, parseResult.error);
            set({ rubricError: 'Rubric file no longer available. Please re-upload.' });
          }
        } catch (error: any) {
          console.error('[GradingStore] Error reloading rubric from path:', error);
          set({ rubricError: 'Failed to reload rubric file. Please re-upload.' });
        } finally {
          set({ rubricLoading: false });
        }
      },

      clearRubricForAssignment: (assignmentId: string) => {
        const { assignmentRubrics } = get();
        const updatedRubrics = assignmentRubrics.filter(r => r.assignmentId !== assignmentId);
        set({
          assignmentRubrics: updatedRubrics,
          rubricContent: null,
          rubricFile: null,
          rubricError: null
        });
      },

      // Grading status management
      getGradingRecord: (assignmentId: string, studentId: string): GradingRecord | null => {
        const { gradingRecords } = get();
        return gradingRecords.find(r => r.assignmentId === assignmentId && r.studentId === studentId) || null;
      },

      saveGradingRecord: (assignmentId: string, studentId: string, aiGradeResult: AIGradeResult) => {
        const { gradingRecords, getGradingRecord } = get();

        // Get existing record to preserve confirmation status
        const existingRecord = getGradingRecord(assignmentId, studentId);

        const newRecord: GradingRecord = {
          assignmentId,
          studentId,
          aiGradeResult,
          detailedAIGradeResult: existingRecord?.detailedAIGradeResult || null, // Preserve detailed results
          isAIGraded: true,
          gradedAt: Date.now(),
          finalGrade: String(aiGradeResult.grade),
          finalFeedback: aiGradeResult.feedback,
          // Clear error state when successful results are saved
          hasError: false,
          errorMessage: undefined,
          errorType: undefined
        };

        // Remove existing record for this assignment-student combination and add new one
        const updatedRecords = gradingRecords.filter(r => !(r.assignmentId === assignmentId && r.studentId === studentId));
        updatedRecords.push(newRecord);

        set({
          gradingRecords: updatedRecords,
          aiGradeResult,
          finalGrade: String(aiGradeResult.grade),
          finalFeedback: aiGradeResult.feedback
        });
      },

      updateFinalGrading: (assignmentId: string, studentId: string, finalGrade: string, finalFeedback: string) => {
        const { gradingRecords } = get();

        const updatedRecords = gradingRecords.map(record => {
          if (record.assignmentId === assignmentId && record.studentId === studentId) {
            return {
              ...record,
              finalGrade,
              finalFeedback
            };
          }
          return record;
        });

        set({ gradingRecords: updatedRecords });
      },

      saveDetailedGradingRecord: (assignmentId: string, studentId: string, detailedResult: DetailedAIGradeResult) => {
        const { gradingRecords, getGradingRecord } = get();

        // Get existing record to preserve other data
        const existingRecord = getGradingRecord(assignmentId, studentId);

        const newRecord: GradingRecord = existingRecord ? {
          ...existingRecord,
          detailedAIGradeResult: detailedResult,
          isAIGraded: true,
          gradedAt: Date.now(),
          // Update basic AI result from detailed result
          aiGradeResult: {
            grade: detailedResult.overallScore,
            feedback: detailedResult.shortFeedback
          },
          finalGrade: String(detailedResult.overallScore),
          finalFeedback: detailedResult.shortFeedback,
          // Clear error state when successful results are saved
          hasError: false,
          errorMessage: undefined,
          errorType: undefined
        } : {
          assignmentId,
          studentId,
          aiGradeResult: {
            grade: detailedResult.overallScore,
            feedback: detailedResult.shortFeedback
          },
          detailedAIGradeResult: detailedResult,
          isAIGraded: true,
          gradedAt: Date.now(),
          finalGrade: String(detailedResult.overallScore),
          finalFeedback: detailedResult.shortFeedback,
          // Ensure no error state for new records
          hasError: false,
          errorMessage: undefined,
          errorType: undefined
        };

        // Remove existing record and add updated one
        const updatedRecords = gradingRecords.filter(r => !(r.assignmentId === assignmentId && r.studentId === studentId));
        updatedRecords.push(newRecord);

        set({
          gradingRecords: updatedRecords,
          aiGradeResult: newRecord.aiGradeResult,
          detailedAIGradeResult: detailedResult,
          finalGrade: String(detailedResult.overallScore),
          finalFeedback: detailedResult.shortFeedback
        });
      },

      getDetailedAIGradeResult: (assignmentId: string, studentId: string): DetailedAIGradeResult | null => {
        const { gradingRecords } = get();
        const record = gradingRecords.find(r => r.assignmentId === assignmentId && r.studentId === studentId);
        return record ? record.detailedAIGradeResult : null;
      },


      clearGradingRecord: (assignmentId: string, studentId: string) => {
        console.log('🗑️ [Store] clearGradingRecord called:', { assignmentId, studentId });
        const { gradingRecords } = get();
        console.log('📊 [Store] Before clear - gradingRecords count:', gradingRecords.length);

        const updatedRecords = gradingRecords.filter(r => !(r.assignmentId === assignmentId && r.studentId === studentId));
        console.log('📊 [Store] After filter - gradingRecords count:', updatedRecords.length);

        set({
          gradingRecords: updatedRecords,
          aiGradeResult: null,
          detailedAIGradeResult: null,
          finalGrade: '',
          finalFeedback: ''
        });
        console.log('✅ [Store] clearGradingRecord completed');
      },

      isStudentAIGraded: (assignmentId: string, studentId: string): boolean => {
        const { gradingRecords } = get();
        const record = gradingRecords.find(r => r.assignmentId === assignmentId && r.studentId === studentId);
        return record ? record.isAIGraded : false;
      },


      // Computed getters
      getStats: (): GradingStats => {
        const { studentData, submissions, grades } = get();

        // If no student data yet, try to compute from raw submissions/grades
        if (!studentData.length) {
          // Still return basic stats from raw data if available
          return {
            totalStudents: 0,
            submitted: submissions?.length || 0,
            pending: 0,
            graded: grades?.length || 0,
            ungraded: 0,
            published: grades?.filter(g => g.grade > 0).length || 0,
            unpublished: 0
          };
        }

        const totalStudents = studentData.length;
        let submitted = 0;
        let pending = 0;
        let graded = 0;
        let ungraded = 0;
        let published = 0;
        let unpublished = 0;

        studentData.forEach(data => {
          if (data.submission && data.submission.status === 'submitted') {
            submitted++;
          } else {
            pending++;
          }

          if (data.grade && data.grade.grade > 0) {
            published++;
            graded++;
          } else if (data.currentGrade && data.currentGrade !== '0' && data.currentGrade !== '') {
            unpublished++;
            graded++;
          } else {
            ungraded++;
          }
        });

        // console.log('[GradingStore] Stats computed:', {
        //   totalStudents,
        //   submitted,
        //   pending,
        //   graded,
        //   ungraded,
        //   published,
        //   unpublished
        // });

        return {
          totalStudents,
          submitted,
          pending,
          graded,
          ungraded,
          published,
          unpublished
        };
      },

      getSelectedSubmissionData: (): StudentSubmissionData | undefined => {
        const { studentData, selectedSubmission } = get();
        return studentData.find(s => s.student.id === selectedSubmission);
      },

      // Complex actions
      processStudentData: (students: MoodleUser[]) => {
        const { submissions, grades } = get();

        if (!students.length) return;


        const combinedData: StudentSubmissionData[] = students.map(student => {
          // Ensure student.id is a string for comparison
          const studentId = String(student.id);
          const submission = submissions?.find(sub => sub.userid === studentId);
          const grade = grades?.find(gr => gr.userid === studentId);

          return {
            student,
            submission,
            grade,
            currentGrade: grade ? grade.grade.toString() : '',
            feedback: grade?.feedback || '',
            isEditing: false
          };
        });


        set({ studentData: combinedData });
      },

      clearGradingData: () => {
        set({
          selectedAssignment: '',
          selectedSubmission: null,
          uploadedFile: null,
          rubricFile: null,
          rubricContent: null,
          rubricLoading: false,
          rubricError: null,
          assignmentRubrics: [], // Clear all rubrics
          gradingRecords: [], // Clear all grading records
          studentData: [],
          submissions: [],
          grades: [],
          loading: false,
          isGrading: false,
          aiGradeResult: null,
          detailedAIGradeResult: null,
          finalGrade: '',
          finalFeedback: '',
          // Clear grading progress state when explicitly clearing all data
          gradingInProgress: new Set<string>(),
          activeGradingStudent: null,
        });
      },

      resetToAssignmentSelection: () => {
        set({
          selectedSubmission: null,
          uploadedFile: null,
          aiGradeResult: null,
          detailedAIGradeResult: null,
          finalGrade: '',
          finalFeedback: '',
        });
      },

      // API actions
      loadAssignmentData: async (assignmentId: string, config: { baseUrl: string; apiKey: string }) => {
        if (!assignmentId) return;

        set({ loading: true });

        try {
          // Fetch real submissions and grades from Moodle API
          const [submissionsResult, gradesResult] = await Promise.all([
            window.electron.ipcRenderer.invoke('moodle:get-assignment-submissions', {
              baseUrl: config.baseUrl,
              apiKey: config.apiKey,
              assignmentId,
            }),
            window.electron.ipcRenderer.invoke('moodle:get-assignment-grades', {
              baseUrl: config.baseUrl,
              apiKey: config.apiKey,
              assignmentId,
            }),
          ]);


          // Process submissions - ensure userid is consistently a string
          const realSubmissions: MoodleSubmission[] = submissionsResult.success && submissionsResult.data
            ? submissionsResult.data.map((sub: any) => ({
                userid: String(sub.userid || sub.id),
                status: sub.status || 'new',
                timemodified: sub.timemodified,
                attemptnumber: sub.attemptnumber || 0,
              }))
            : [];

          // Process grades - ensure userid is consistently a string
          const realGrades: MoodleGrade[] = gradesResult.success && gradesResult.data
            ? gradesResult.data.map((grade: any) => ({
                userid: String(grade.userid || grade.id),
                grade: parseFloat(grade.grade) || 0,
                timemodified: grade.timemodified,
                feedback: grade.assignfeedbackcomments || grade.feedback || '',
              }))
            : [];


          set({
            submissions: realSubmissions,
            grades: realGrades
          });

          if (!submissionsResult.success) {
            console.error('[GradingStore] Failed to fetch submissions:', submissionsResult.error);
          }
          if (!gradesResult.success) {
            console.error('[GradingStore] Failed to fetch grades:', gradesResult.error);
          }
        } catch (error) {
          console.error('[GradingStore] Error loading assignment data:', error);
          set({
            submissions: [],
            grades: []
          });
        } finally {
          set({ loading: false });
        }
      },

      submitGrade: async (assignmentId: string, userId: string, grade: number, feedback: string, config: { baseUrl: string; apiKey: string }) => {
        try {
          console.log('[Grading Store] Submitting grade:', { assignmentId, userId, grade });

          const result = await window.electron.ipcRenderer.invoke('moodle:update-assignment-grade', {
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            assignmentId,
            userId,
            grade,
            feedback
          });

          if (result.success) {
            console.log('[Grading Store] Grade submitted successfully');

            // Update the local state to reflect the submitted grade
            const { studentData } = get();
            const updatedStudentData = studentData.map(student => {
              if (student.student.id === userId) {
                return {
                  ...student,
                  currentGrade: grade.toString(),
                  feedback: feedback,
                  grade: {
                    userid: userId,
                    grade: grade,
                    feedback: feedback,
                    timemodified: Date.now()
                  }
                };
              }
              return student;
            });

            set({ studentData: updatedStudentData });

            return { success: true };
          } else {
            console.error('[Grading Store] Failed to submit grade:', result.error);
            return { success: false, error: result.error };
          }
        } catch (error: any) {
          console.error('[Grading Store] Error submitting grade:', error);
          return { success: false, error: error.message || 'Failed to submit grade' };
        }
      },

      // Initialization method to restore state after persistence hydration
      initializeFromPersistedData: () => {
        const { selectedAssignment, assignmentRubrics, getRubricForAssignment } = get();

        // Restore rubric content for the currently selected assignment
        if (selectedAssignment) {
          const rubricContent = getRubricForAssignment(selectedAssignment);
          if (rubricContent && !get().rubricContent) {
            set({ rubricContent });
          }
        }
      },

      // Grading progress actions
      startGrading: (studentId: string) => {
        console.log(`[Store] 🚀 Starting grading for student: ${studentId}`);
        set(state => ({
          gradingInProgress: new Set(state.gradingInProgress).add(studentId),
          activeGradingStudent: studentId // Set as active when starting
        }));
        console.log(`[Store] Students currently grading:`, Array.from(get().gradingInProgress));
        console.log(`[Store] Active grading student:`, studentId);
      },

      finishGrading: (studentId: string) => {
        console.log(`[Store] ✅ Finishing grading for student: ${studentId}`);
        const { selectedAssignment, clearGradingStream, processGradingStream, getGradingStream, getDetailedAIGradeResult } = get();

        // Process any remaining data in the stream before clearing
        if (selectedAssignment) {
          const sessionId = `grading-${selectedAssignment}-${studentId}`;
          console.log(`[Store] Processing final stream data for session: ${sessionId}`);

          // Process the stream one more time to ensure we capture any final results
          processGradingStream(sessionId, selectedAssignment, studentId);

          // Check if there's a temp result in the stream that needs to be saved
          const stream = getGradingStream(sessionId);

          // Log final stream state for debugging
          console.log(`[Store] Final stream state for ${sessionId}:`, {
            hasStream: !!stream,
            bufferLength: stream?.streamBuffer?.length || 0,
            hasTempResult: !!stream?.tempResult,
            tempResultScore: stream?.tempResult?.overallScore,
            appliedCommentsCount: stream?.appliedComments?.size || 0,
            bufferPreview: stream?.streamBuffer ?
              (stream.streamBuffer.length > 200 ?
                stream.streamBuffer.substring(0, 100) + '...' + stream.streamBuffer.substring(stream.streamBuffer.length - 100) :
                stream.streamBuffer) : 'No buffer'
          });

          if (stream?.tempResult) {
            console.log(`[Store] Found temp result in stream, ensuring it's saved for student: ${studentId}`);
            // The processGradingStream should have saved it, but let's make sure
            const { saveDetailedGradingRecord } = get();
            saveDetailedGradingRecord(selectedAssignment, studentId, stream.tempResult);
          }

          // Final check if result was saved
          const finalResult = getDetailedAIGradeResult(selectedAssignment, studentId);
          if (!finalResult) {
            console.error(`[Store] ⚠️ WARNING: No grading result saved for student ${studentId} after finishing!`);
            if (stream?.streamBuffer) {
              console.error(`[Store] Stream buffer was not empty but no result extracted. Buffer content:`, stream.streamBuffer);
            }
          } else {
            console.log(`[Store] ✅ Grading result confirmed for student ${studentId}:`, {
              score: finalResult.overallScore,
              commentsCount: finalResult.comments?.length || 0
            });
          }

          // Now clear plan widget data and grading stream
          console.log(`[Store] Clearing plan widget data and stream for session: ${sessionId}`);

          // Use chat store to clear the session data
          const { clearPlan, clearTodos } = useChatStore.getState();
          clearPlan(sessionId);
          clearTodos(sessionId);

          // Clear the grading stream after ensuring results are saved
          clearGradingStream(sessionId);
        }

        set(state => {
          const newSet = new Set(state.gradingInProgress);
          newSet.delete(studentId);
          // Clear active student if it was this one
          const newActiveStudent = state.activeGradingStudent === studentId ? null : state.activeGradingStudent;
          return {
            gradingInProgress: newSet,
            activeGradingStudent: newActiveStudent
          };
        });
        console.log(`[Store] Students still grading:`, Array.from(get().gradingInProgress));
      },

      setGradingError: (studentId: string, errorMessage?: string, errorType?: 'parsing' | 'format' | 'network' | 'unknown') => {
        console.log(`[Store] ❌ Grading error for student: ${studentId}`, errorMessage ? `Error: ${errorMessage}` : '');
        const { selectedAssignment, clearGradingStream } = get();

        // Clear plan widget data and grading stream for this student's session on error
        if (selectedAssignment) {
          const sessionId = `grading-${selectedAssignment}-${studentId}`;
          console.log(`[Store] Clearing plan widget data and stream for session (error): ${sessionId}`);

          // Use chat store to clear the session data
          const { clearPlan, clearTodos } = useChatStore.getState();
          clearPlan(sessionId);
          clearTodos(sessionId);

          // Clear the grading stream on error
          clearGradingStream(sessionId);

          // Save error information to grading record
          set(state => {
            const existingRecordIndex = state.gradingRecords.findIndex(
              record => record.assignmentId === selectedAssignment && record.studentId === studentId
            );

            const errorRecord = {
              assignmentId: selectedAssignment,
              studentId: studentId,
              aiGradeResult: null,
              detailedAIGradeResult: null,
              isAIGraded: false,
              hasError: true,
              errorMessage: errorMessage || 'Unknown grading error occurred',
              errorType: errorType || 'unknown' as const,
              gradedAt: Date.now(),
            };

            const newRecords = [...state.gradingRecords];
            if (existingRecordIndex >= 0) {
              newRecords[existingRecordIndex] = errorRecord;
            } else {
              newRecords.push(errorRecord);
            }

            const newSet = new Set(state.gradingInProgress);
            newSet.delete(studentId);
            // Clear active student if it was this one
            const newActiveStudent = state.activeGradingStudent === studentId ? null : state.activeGradingStudent;

            return {
              gradingRecords: newRecords,
              gradingInProgress: newSet,
              activeGradingStudent: newActiveStudent
            };
          });
        } else {
          set(state => {
            const newSet = new Set(state.gradingInProgress);
            newSet.delete(studentId);
            // Clear active student if it was this one
            const newActiveStudent = state.activeGradingStudent === studentId ? null : state.activeGradingStudent;
            return {
              gradingInProgress: newSet,
              activeGradingStudent: newActiveStudent
            };
          });
        }

        console.log(`[Store] Students still grading:`, Array.from(get().gradingInProgress));
      },

      abortGrading: (studentId: string) => {
        console.log(`[Store] 🛑 Aborting grading for student: ${studentId}`);
        const { selectedAssignment, clearGradingStream } = get();

        // Clear plan widget data and grading stream for this student's session on abort
        if (selectedAssignment) {
          const sessionId = `grading-${selectedAssignment}-${studentId}`;
          console.log(`[Store] Clearing plan widget data and stream for session (abort): ${sessionId}`);

          // Use chat store to clear the session data
          const { clearPlan, clearTodos, clearThinkingMessages } = useChatStore.getState();
          clearPlan(sessionId);
          clearTodos(sessionId);
          clearThinkingMessages(sessionId);

          // Clear the grading stream on abort
          clearGradingStream(sessionId);

          // Send abort request to backend
          window.electron.ipcRenderer.invoke('chat:agent:abort', {
            sessionId,
            reason: 'User stopped grading'
          }).then(result => {
            console.log(`[Store] Abort request result:`, result);
          }).catch(error => {
            console.error(`[Store] Failed to abort session:`, error);
          });
        }

        set(state => {
          const newSet = new Set(state.gradingInProgress);
          newSet.delete(studentId);
          // Clear active student if it was this one
          const newActiveStudent = state.activeGradingStudent === studentId ? null : state.activeGradingStudent;
          return {
            gradingInProgress: newSet,
            activeGradingStudent: newActiveStudent
          };
        });
        console.log(`[Store] Students still grading after abort:`, Array.from(get().gradingInProgress));
      },

      isStudentBeingGraded: (studentId: string): boolean => {
        return get().gradingInProgress.has(studentId);
      },


      clearAllGradingProgress: () => {
        set({
          gradingInProgress: new Set<string>(),
          activeGradingStudent: null
        });
      },

      setActiveGradingStudent: (studentId: string | null) => {
        console.log(`[Store] Setting active grading student:`, studentId);
        set({ activeGradingStudent: studentId });
      },

      manualClearGradingProgress: () => {
        console.log(`[Store] Manually clearing all grading progress`);
        set({
          gradingInProgress: new Set<string>(),
          activeGradingStudent: null,
        });
      },

      // Grading stream actions
      initGradingStream: (sessionId: string) => {
        const existingStream = get().gradingStreams[sessionId];
        if (!existingStream) {
          console.log(`[Store] Initializing grading stream for session: ${sessionId}`);
          set(state => ({
            gradingStreams: {
              ...state.gradingStreams,
              [sessionId]: {
                streamBuffer: '',
                appliedComments: new Set<string>(),
                tempResult: null,
              }
            }
          }));
        }
      },

      // Track pending updates outside of state to avoid mutations
      _pendingStreamUpdates: {} as Record<string, any>,
      _updateScheduled: false,

      appendToGradingStream: (sessionId: string, token: string) => {
        const stream = get().gradingStreams[sessionId];
        if (!stream) {
          console.warn(`[Store] No stream found for session: ${sessionId}`);
          return;
        }

        // Store the update in the pending updates map
        const store = useGradingStore.getState() as any;
        if (!store._pendingStreamUpdates[sessionId]) {
          store._pendingStreamUpdates[sessionId] = {
            ...stream,
            streamBuffer: stream.streamBuffer + token
          };
        } else {
          // Append to the existing pending update
          store._pendingStreamUpdates[sessionId].streamBuffer += token;
        }

        // Schedule a batch update using microtask if not already scheduled
        if (!store._updateScheduled) {
          store._updateScheduled = true;
          queueMicrotask(() => {
            const pendingUpdates = store._pendingStreamUpdates;
            if (Object.keys(pendingUpdates).length > 0) {
              set(state => ({
                gradingStreams: {
                  ...state.gradingStreams,
                  ...pendingUpdates
                }
              }));
              // Clear pending updates
              store._pendingStreamUpdates = {};
            }
            store._updateScheduled = false;
          });
        }
      },

      processGradingStream: (sessionId: string, assignmentId: string, studentId: string) => {
        const { gradingStreams } = get();
        const stream = gradingStreams[sessionId];

        if (!stream) {
          console.warn(`[Store] No stream to process for session: ${sessionId}`);
          return;
        }

        const buffer = stream.streamBuffer;

        // Try to parse complete JSON for final result
        const jsonStart = buffer.indexOf('{');
        if (jsonStart !== -1) {
          let braceCount = 0;
          let jsonEnd = -1;
          let inString = false;
          let escapeNext = false;

          for (let i = jsonStart; i < buffer.length; i++) {
            const char = buffer[i];

            if (escapeNext) {
              escapeNext = false;
              continue;
            }

            if (char === '\\') {
              escapeNext = true;
              continue;
            }

            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }

            if (!inString) {
              if (char === '{') braceCount++;
              else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                  jsonEnd = i;
                  break;
                }
              }
            }
          }

          // If we have a complete JSON object, parse it
          if (jsonEnd !== -1) {
            const jsonStr = buffer.substring(jsonStart, jsonEnd + 1);
            try {
              const parsed = JSON.parse(jsonStr);
              console.log('[Store] Complete grading result parsed:', parsed);

              // Create the detailed result
              const detailedResult: DetailedAIGradeResult = {
                comments: parsed.comments || [],
                overallScore: parsed.overallScore || 0,
                scoreBreakdown: parsed.scoreBreakdown || [],
                shortFeedback: parsed.shortFeedback || '',
              };

              // Save the detailed result immediately
              const { saveDetailedGradingRecord } = get();
              saveDetailedGradingRecord(assignmentId, studentId, detailedResult);

              // Update stream with temp result
              set(state => ({
                gradingStreams: {
                  ...state.gradingStreams,
                  [sessionId]: {
                    ...stream,
                    tempResult: detailedResult
                  }
                }
              }));
            } catch (e) {
              // JSON not complete yet
            }
          }
        }
      },

      clearGradingStream: (sessionId: string) => {
        console.log(`[Store] Clearing grading stream for session: ${sessionId}`);
        set(state => {
          const { [sessionId]: _, ...rest } = state.gradingStreams;
          return { gradingStreams: rest };
        });
      },

      getGradingStream: (sessionId: string) => {
        return get().gradingStreams[sessionId] || null;
      },
      }),
      {
        name: 'grading-store',
        partialize: (state) => ({
          selectedAssignment: state.selectedAssignment,
          selectedSubmission: state.selectedSubmission,
          assignmentRubrics: state.assignmentRubrics,
          gradingRecords: state.gradingRecords,
          // Persist grading progress state so it survives view changes
          gradingInProgress: Array.from(state.gradingInProgress), // Convert Set to Array for serialization
          activeGradingStudent: state.activeGradingStudent,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Restore rubric content for the selected assignment after hydration
            const { selectedAssignment, selectedSubmission, assignmentRubrics, gradingRecords } = state;

            if (selectedAssignment && assignmentRubrics.length > 0) {
              const rubric = assignmentRubrics.find(r => r.assignmentId === selectedAssignment);
              if (rubric) {
                state.rubricContent = rubric.rubricContent;
              }
            }

            // Restore detailed AI grading results for the current selection
            if (selectedAssignment && selectedSubmission && gradingRecords.length > 0) {
              const gradingRecord = gradingRecords.find(r =>
                r.assignmentId === selectedAssignment && r.studentId === selectedSubmission
              );
              if (gradingRecord) {
                state.aiGradeResult = gradingRecord.aiGradeResult;
                state.detailedAIGradeResult = gradingRecord.detailedAIGradeResult;
                state.finalGrade = gradingRecord.finalGrade || '';
                state.finalFeedback = gradingRecord.finalFeedback || '';
              }
            }

            // Restore grading progress state from persistence
            // Convert gradingInProgress array back to Set
            if (state.gradingInProgress && Array.isArray(state.gradingInProgress)) {
              state.gradingInProgress = new Set(state.gradingInProgress);
            } else {
              // Ensure it's initialized as an empty Set if not found
              state.gradingInProgress = new Set<string>();
            }

            if (!state.activeGradingStudent) {
              state.activeGradingStudent = null;
            }
          }
        },
      }
    ),
    {
      name: 'grading-store-devtools',
    }
  )
);

