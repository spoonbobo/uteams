import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PdfPreview {
  filePath: string;
  filename: string;
  parsedContent?: any; // Parsed JSON content from PDF
}

interface AssignmentData {
  selectedFiles: Record<string, PdfPreview>; // filename -> PdfPreview
  currentPreviewFile: string | null; // currently previewed filename
}

interface GenerationRecord {
  id: string;
  sessionId: string;
  courseId: string;
  selectedAssignments: string[];
  examType: string;
  examInstructions: string;
  generatedAt: number;
  rawResponse: string;
  parsedResult?: any;
  status: 'completed' | 'failed' | 'aborted';
  error?: string;
}

interface CourseAssignmentSelection {
  selectedAssignments: string[];
  assignmentData: Record<string, AssignmentData>; // assignmentId -> AssignmentData
  generationRecords: GenerationRecord[]; // Store generation history
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

  // Granular PDF preview actions
  setAssignmentPdf: (courseId: string, assignmentId: string, filename: string, filePath: string, parsedContent?: any) => void;
  setCurrentPreviewPdf: (courseId: string, assignmentId: string, filename: string | null) => void;
  getCurrentPreviewPdf: (courseId: string) => { assignmentId: string | null; filePath: string | null; filename: string | null };
  getAssignmentPdfs: (courseId: string, assignmentId: string) => Record<string, PdfPreview>;

  // Parsed content actions
  setParsedContent: (courseId: string, assignmentId: string, filename: string, parsedContent: any) => void;
  getParsedContent: (courseId: string, assignmentId: string, filename: string) => any | null;
  getAllParsedContent: (courseId: string) => Array<{ assignmentId: string; filename: string; content: any }>;

  // Generation record actions
  saveGenerationRecord: (record: Omit<GenerationRecord, 'id' | 'generatedAt'>) => string;
  getGenerationRecords: (courseId: string) => GenerationRecord[];
  getLatestGenerationRecord: (courseId: string) => GenerationRecord | null;
  updateGenerationRecord: (courseId: string, recordId: string, updates: Partial<GenerationRecord>) => void;
  clearGenerationRecords: (courseId: string) => void;
  clearAllGenerationRecords: () => void;

  // Legacy methods for backward compatibility
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
            selectedAssignments: assignments,
            assignmentData: state.courseSelections[courseId]?.assignmentData || {},
            generationRecords: state.courseSelections[courseId]?.generationRecords || []
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
              selectedAssignments: newSelections,
              assignmentData: state.courseSelections[courseId]?.assignmentData || {},
              generationRecords: state.courseSelections[courseId]?.generationRecords || []
            }
          }
        };
      }),

      // Granular PDF preview actions
      setAssignmentPdf: (courseId, assignmentId, filename, filePath, parsedContent) => set((state) => ({
        courseSelections: {
          ...state.courseSelections,
          [courseId]: {
            ...state.courseSelections[courseId],
            selectedAssignments: state.courseSelections[courseId]?.selectedAssignments || [],
            assignmentData: {
              ...state.courseSelections[courseId]?.assignmentData,
              [assignmentId]: {
                ...state.courseSelections[courseId]?.assignmentData?.[assignmentId],
                selectedFiles: {
                  ...state.courseSelections[courseId]?.assignmentData?.[assignmentId]?.selectedFiles,
                  [filename]: { filePath, filename, parsedContent }
                },
                currentPreviewFile: state.courseSelections[courseId]?.assignmentData?.[assignmentId]?.currentPreviewFile || null
              }
            }
          }
        }
      })),

      setCurrentPreviewPdf: (courseId, assignmentId, filename) => set((state) => ({
        courseSelections: {
          ...state.courseSelections,
          [courseId]: {
            ...state.courseSelections[courseId],
            selectedAssignments: state.courseSelections[courseId]?.selectedAssignments || [],
            assignmentData: {
              ...state.courseSelections[courseId]?.assignmentData,
              [assignmentId]: {
                ...state.courseSelections[courseId]?.assignmentData?.[assignmentId],
                selectedFiles: state.courseSelections[courseId]?.assignmentData?.[assignmentId]?.selectedFiles || {},
                currentPreviewFile: filename
              }
            }
          }
        }
      })),

      getCurrentPreviewPdf: (courseId) => {
        const state = get();
        const courseData = state.courseSelections[courseId];

        if (!courseData?.assignmentData) {
          return { assignmentId: null, filePath: null, filename: null };
        }

        // Find the assignment with a current preview file
        for (const [assignmentId, assignmentData] of Object.entries(courseData.assignmentData)) {
          if (assignmentData.currentPreviewFile) {
            const previewFile = assignmentData.selectedFiles[assignmentData.currentPreviewFile];
            if (previewFile) {
              return {
                assignmentId,
                filePath: previewFile.filePath,
                filename: previewFile.filename
              };
            }
          }
        }

        return { assignmentId: null, filePath: null, filename: null };
      },

      getAssignmentPdfs: (courseId, assignmentId) => {
        const state = get();
        return state.courseSelections[courseId]?.assignmentData?.[assignmentId]?.selectedFiles || {};
      },

      // Parsed content actions
      setParsedContent: (courseId, assignmentId, filename, parsedContent) => set((state) => {
        const existingFile = state.courseSelections[courseId]?.assignmentData?.[assignmentId]?.selectedFiles?.[filename];
        if (existingFile) {
          return {
            courseSelections: {
              ...state.courseSelections,
              [courseId]: {
                ...state.courseSelections[courseId],
                assignmentData: {
                  ...state.courseSelections[courseId]?.assignmentData,
                  [assignmentId]: {
                    ...state.courseSelections[courseId]?.assignmentData?.[assignmentId],
                    selectedFiles: {
                      ...state.courseSelections[courseId]?.assignmentData?.[assignmentId]?.selectedFiles,
                      [filename]: { ...existingFile, parsedContent }
                    }
                  }
                }
              }
            }
          };
        }
        return state;
      }),

      getParsedContent: (courseId, assignmentId, filename) => {
        const state = get();
        return state.courseSelections[courseId]?.assignmentData?.[assignmentId]?.selectedFiles?.[filename]?.parsedContent || null;
      },

      getAllParsedContent: (courseId) => {
        const state = get();
        const courseData = state.courseSelections[courseId];
        const results: Array<{ assignmentId: string; filename: string; content: any }> = [];

        if (courseData?.assignmentData) {
          Object.entries(courseData.assignmentData).forEach(([assignmentId, assignmentData]) => {
            if (assignmentData?.selectedFiles) {
              Object.entries(assignmentData.selectedFiles).forEach(([filename, fileData]) => {
                if (fileData.parsedContent) {
                  results.push({
                    assignmentId,
                    filename,
                    content: fileData.parsedContent
                  });
                }
              });
            }
          });
        }

        return results;
      },

      // Generation record actions
      saveGenerationRecord: (record) => {
        const recordId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fullRecord: GenerationRecord = {
          ...record,
          id: recordId,
          generatedAt: Date.now()
        };

        set((state) => ({
          courseSelections: {
            ...state.courseSelections,
            [record.courseId]: {
              ...state.courseSelections[record.courseId],
              selectedAssignments: state.courseSelections[record.courseId]?.selectedAssignments || [],
              assignmentData: state.courseSelections[record.courseId]?.assignmentData || {},
              generationRecords: [
                ...(state.courseSelections[record.courseId]?.generationRecords || []),
                fullRecord
              ]
            }
          }
        }));

        return recordId;
      },

      getGenerationRecords: (courseId) => {
        const state = get();
        return state.courseSelections[courseId]?.generationRecords || [];
      },

      getLatestGenerationRecord: (courseId) => {
        const records = get().getGenerationRecords(courseId);
        return records.length > 0 ? records[records.length - 1] : null;
      },

      updateGenerationRecord: (courseId, recordId, updates) => set((state) => {
        const courseData = state.courseSelections[courseId];
        if (!courseData?.generationRecords) return state;

        const updatedRecords = courseData.generationRecords.map(record =>
          record.id === recordId ? { ...record, ...updates } : record
        );

        return {
          courseSelections: {
            ...state.courseSelections,
            [courseId]: {
              ...courseData,
              generationRecords: updatedRecords
            }
          }
        };
      }),

      clearGenerationRecords: (courseId) => set((state) => ({
        courseSelections: {
          ...state.courseSelections,
          [courseId]: {
            ...state.courseSelections[courseId],
            selectedAssignments: state.courseSelections[courseId]?.selectedAssignments || [],
            assignmentData: state.courseSelections[courseId]?.assignmentData || {},
            generationRecords: []
          }
        }
      })),

      clearAllGenerationRecords: () => set((state) => {
        const updatedSelections = Object.entries(state.courseSelections).reduce((acc, [courseId, courseData]) => {
          acc[courseId] = {
            ...courseData,
            generationRecords: []
          };
          return acc;
        }, {} as Record<string, CourseAssignmentSelection>);

        return {
          courseSelections: updatedSelections
        };
      }),

      // Legacy methods for backward compatibility
      setPreviewPdf: (courseId, filePath, filename) => set((state) => {
        // For legacy compatibility, set as the first assignment's first PDF
        const courseData = state.courseSelections[courseId];
        const firstAssignmentId = courseData?.selectedAssignments?.[0];

        if (firstAssignmentId && filePath && filename) {
          return {
            courseSelections: {
              ...state.courseSelections,
              [courseId]: {
                ...courseData,
                assignmentData: {
                  ...courseData?.assignmentData,
                  [firstAssignmentId]: {
                    ...courseData?.assignmentData?.[firstAssignmentId],
                    selectedFiles: {
                      ...courseData?.assignmentData?.[firstAssignmentId]?.selectedFiles,
                      [filename]: { filePath, filename }
                    },
                    currentPreviewFile: filename
                  }
                }
              }
            }
          };
        }

        return state;
      }),

      getPreviewPdf: (courseId) => {
        const state = get();
        const previewData = get().getCurrentPreviewPdf(courseId);
        return {
          filePath: previewData.filePath,
          filename: previewData.filename
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
