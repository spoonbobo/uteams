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
  generatedAt: number;
  resultSummary: string;
  parsedResult?: any;
  status: 'completed' | 'failed' | 'aborted';
  error?: string;
}

interface CourseAssignmentSelection {
  selectedAssignments: string[];
  assignmentData: Record<string, AssignmentData>; // assignmentId -> AssignmentData
  generationRecord?: GenerationRecord; // Store single generation record
}

interface CourseworkGeneratorState {
  // PDF Preview state
  selectedPdfPath: string | null;
  selectedPdfFilename: string | null;
  pdfLoading: boolean;
  pdfError: string | null;

  // Generation progress tracking (similar to grading store)
  generationInProgress: Set<string>; // Set of courseId-sessionId combinations currently generating
  activeGenerationCourse: string | null; // The course whose generation process should be displayed

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
  getGenerationRecord: (courseId: string) => GenerationRecord | null;
  updateGenerationRecord: (courseId: string, updates: Partial<GenerationRecord>) => void;
  clearGenerationRecord: (courseId: string) => void;
  clearAllGenerationRecords: () => void;

  // Generation progress actions (similar to grading store)
  startGeneration: (courseId: string) => void;
  finishGeneration: (courseId: string) => void;
  setGenerationError: (courseId: string, errorMessage?: string) => void;
  abortGeneration: (courseId: string) => void;
  isGenerationInProgress: (courseId: string) => boolean;
  clearAllGenerationProgress: () => void;
  setActiveGenerationCourse: (courseId: string | null) => void;

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
      generationInProgress: new Set<string>(),
      activeGenerationCourse: null,
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
            generationRecord: state.courseSelections[courseId]?.generationRecord
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
            generationRecord: state.courseSelections[courseId]?.generationRecord
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
              generationRecord: fullRecord
            }
          }
        }));

        return recordId;
      },

      getGenerationRecord: (courseId) => {
        const state = get();
        return state.courseSelections[courseId]?.generationRecord || null;
      },

      updateGenerationRecord: (courseId, updates) => set((state) => {
        console.log('📝 [Store] Updating generation record:', {
          courseId,
          updates,
          hasRecord: !!state.courseSelections[courseId]?.generationRecord
        });

        const courseData = state.courseSelections[courseId];
        if (!courseData?.generationRecord) {
          console.warn('⚠️ [Store] No generation record found for course:', courseId);
          return state;
        }

        const updatedRecord = { ...courseData.generationRecord, ...updates };
        console.log('✅ [Store] Updated record:', {
          before: courseData.generationRecord,
          after: updatedRecord
        });

        const newState = {
          courseSelections: {
            ...state.courseSelections,
            [courseId]: {
              ...courseData,
              generationRecord: updatedRecord
            }
          }
        };

        console.log('📝 [Store] New state after update:', {
          courseId,
          updatedRecord
        });

        return newState;
      }),

      clearGenerationRecord: (courseId) => set((state) => ({
        courseSelections: {
          ...state.courseSelections,
          [courseId]: {
            ...state.courseSelections[courseId],
            selectedAssignments: state.courseSelections[courseId]?.selectedAssignments || [],
            assignmentData: state.courseSelections[courseId]?.assignmentData || {},
            generationRecord: undefined
          }
        }
      })),

      clearAllGenerationRecords: () => set((state) => {
        const updatedSelections = Object.entries(state.courseSelections).reduce((acc, [courseId, courseData]) => {
          acc[courseId] = {
            ...courseData,
            generationRecord: undefined
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

      // Generation progress actions (similar to grading store)
      startGeneration: (courseId: string) => {
        console.log(`[CourseworkStore] 🚀 Starting generation for course: ${courseId}`);
        set(state => ({
          generationInProgress: new Set(state.generationInProgress).add(courseId),
          activeGenerationCourse: courseId // Set as active when starting
        }));
        console.log(`[CourseworkStore] Courses currently generating:`, Array.from(get().generationInProgress));
        console.log(`[CourseworkStore] Active generation course:`, courseId);
      },

      finishGeneration: (courseId: string) => {
        console.log(`[CourseworkStore] ✅ Finishing generation for course: ${courseId}`);
        set(state => {
          const newSet = new Set(state.generationInProgress);
          newSet.delete(courseId);
          // Clear active course if it was this one
          const newActiveCourse = state.activeGenerationCourse === courseId ? null : state.activeGenerationCourse;
          return {
            generationInProgress: newSet,
            activeGenerationCourse: newActiveCourse
          };
        });
        console.log(`[CourseworkStore] Courses still generating:`, Array.from(get().generationInProgress));
      },

      setGenerationError: (courseId: string, errorMessage?: string) => {
        console.log(`[CourseworkStore] ❌ Generation error for course: ${courseId}`, errorMessage ? `Error: ${errorMessage}` : '');

        // Update the generation record with error status
        const currentRecord = get().getGenerationRecord(courseId);
        if (currentRecord) {
          get().updateGenerationRecord(courseId, {
            status: 'failed',
            error: errorMessage || 'Unknown generation error occurred'
          });
        }

        set(state => {
          const newSet = new Set(state.generationInProgress);
          newSet.delete(courseId);
          // Clear active course if it was this one
          const newActiveCourse = state.activeGenerationCourse === courseId ? null : state.activeGenerationCourse;
          return {
            generationInProgress: newSet,
            activeGenerationCourse: newActiveCourse
          };
        });
        console.log(`[CourseworkStore] Courses still generating:`, Array.from(get().generationInProgress));
      },

      abortGeneration: (courseId: string) => {
        console.log(`[CourseworkStore] 🛑 Aborting generation for course: ${courseId}`);

        // Update the generation record with aborted status
        const currentRecord = get().getGenerationRecord(courseId);
        if (currentRecord) {
          get().updateGenerationRecord(courseId, {
            status: 'aborted'
          });
        }

        // Send abort request to backend
        const sessionId = `coursework-generation-${courseId}`;
        window.electron.ipcRenderer.invoke('chat:agent:abort', {
          sessionId,
          reason: 'User stopped generation'
        }).then(result => {
          console.log(`[CourseworkStore] Abort request result:`, result);
        }).catch(error => {
          console.error(`[CourseworkStore] Failed to abort session:`, error);
        });

        set(state => {
          const newSet = new Set(state.generationInProgress);
          newSet.delete(courseId);
          // Clear active course if it was this one
          const newActiveCourse = state.activeGenerationCourse === courseId ? null : state.activeGenerationCourse;
          return {
            generationInProgress: newSet,
            activeGenerationCourse: newActiveCourse
          };
        });
        console.log(`[CourseworkStore] Courses still generating after abort:`, Array.from(get().generationInProgress));
      },

      isGenerationInProgress: (courseId: string): boolean => {
        return get().generationInProgress.has(courseId);
      },

      clearAllGenerationProgress: () => {
        console.log(`[CourseworkStore] Clearing all generation progress`);
        set({
          generationInProgress: new Set<string>(),
          activeGenerationCourse: null
        });
      },

      setActiveGenerationCourse: (courseId: string | null) => {
        console.log(`[CourseworkStore] Setting active generation course:`, courseId);
        set({ activeGenerationCourse: courseId });
      },
    }),
    {
      name: 'coursework-generator-store',
      partialize: (state) => ({
        courseSelections: state.courseSelections,
        // Persist generation progress state so it survives context changes
        generationInProgress: Array.from(state.generationInProgress), // Convert Set to Array for serialization
        activeGenerationCourse: state.activeGenerationCourse,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Restore generation progress state from persistence
          // Convert generationInProgress array back to Set
          if (state.generationInProgress && Array.isArray(state.generationInProgress)) {
            state.generationInProgress = new Set(state.generationInProgress);
          } else {
            // Ensure it's initialized as an empty Set if not found
            state.generationInProgress = new Set<string>();
          }

          if (!state.activeGenerationCourse) {
            state.activeGenerationCourse = null;
          }
        }
      },
    }
  )
);
