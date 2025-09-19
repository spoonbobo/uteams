import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CourseAssignmentSelection {
  selectedAssignments: string[];
  previewPdfPath: string | null;
  previewPdfFilename: string | null;
}

interface CourseworkGeneratorState {
  // PDF Preview state
  selectedPdfPath: string | null;
  selectedPdfFilename: string | null;
  pdfLoading: boolean;
  pdfError: string | null;

  // Assignment selections by courseId
  courseSelections: Record<string, CourseAssignmentSelection>;

  // Actions
  setSelectedPdf: (filePath: string | null, filename: string | null) => void;
  setPdfLoading: (loading: boolean) => void;
  setPdfError: (error: string | null) => void;
  clearPdfPreview: () => void;

  // Assignment selection actions
  setSelectedAssignments: (courseId: string, assignments: string[]) => void;
  getSelectedAssignments: (courseId: string) => string[];
  toggleAssignment: (courseId: string, assignmentId: string) => void;
  setPreviewPdf: (courseId: string, filePath: string | null, filename: string | null) => void;
  getPreviewPdf: (courseId: string) => { filePath: string | null; filename: string | null };
  clearCourseData: (courseId: string) => void;
}

export const useCourseworkGeneratorStore = create<CourseworkGeneratorState>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedPdfPath: null,
      selectedPdfFilename: null,
      pdfLoading: false,
      pdfError: null,
      courseSelections: {},

      // Actions
      setSelectedPdf: (filePath, filename) => set({
        selectedPdfPath: filePath,
        selectedPdfFilename: filename,
        pdfError: null
      }),

      setPdfLoading: (loading) => set({ pdfLoading: loading }),

      setPdfError: (error) => set({
        pdfError: error,
        pdfLoading: false
      }),

      clearPdfPreview: () => set({
        selectedPdfPath: null,
        selectedPdfFilename: null,
        pdfLoading: false,
        pdfError: null
      }),

      // Assignment selection actions
      setSelectedAssignments: (courseId, assignments) => set((state) => ({
        courseSelections: {
          ...state.courseSelections,
          [courseId]: {
            ...state.courseSelections[courseId],
            selectedAssignments: assignments
          }
        }
      })),

      getSelectedAssignments: (courseId) => {
        const state = get();
        return state.courseSelections[courseId]?.selectedAssignments || [];
      },

      toggleAssignment: (courseId, assignmentId) => set((state) => {
        const currentSelections = state.courseSelections[courseId]?.selectedAssignments || [];
        const newSelections = currentSelections.includes(assignmentId)
          ? currentSelections.filter(id => id !== assignmentId)
          : [...currentSelections, assignmentId];

        return {
          courseSelections: {
            ...state.courseSelections,
            [courseId]: {
              ...state.courseSelections[courseId],
              selectedAssignments: newSelections
            }
          }
        };
      }),

      setPreviewPdf: (courseId, filePath, filename) => set((state) => ({
        courseSelections: {
          ...state.courseSelections,
          [courseId]: {
            ...state.courseSelections[courseId],
            selectedAssignments: state.courseSelections[courseId]?.selectedAssignments || [],
            previewPdfPath: filePath,
            previewPdfFilename: filename
          }
        }
      })),

      getPreviewPdf: (courseId) => {
        const state = get();
        const courseData = state.courseSelections[courseId];
        return {
          filePath: courseData?.previewPdfPath || null,
          filename: courseData?.previewPdfFilename || null
        };
      },

      clearCourseData: (courseId) => set((state) => {
        const { [courseId]: removed, ...remainingSelections } = state.courseSelections;
        return {
          courseSelections: remainingSelections
        };
      }),
    }),
    {
      name: 'coursework-generator-store',
      partialize: (state) => ({
        courseSelections: state.courseSelections
      })
    }
  )
);
