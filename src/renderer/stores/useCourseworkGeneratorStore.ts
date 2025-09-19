import { create } from 'zustand';

interface CourseworkGeneratorState {
  // PDF Preview state
  selectedPdfPath: string | null;
  selectedPdfFilename: string | null;
  pdfLoading: boolean;
  pdfError: string | null;

  // Actions
  setSelectedPdf: (filePath: string | null, filename: string | null) => void;
  setPdfLoading: (loading: boolean) => void;
  setPdfError: (error: string | null) => void;
  clearPdfPreview: () => void;
}

export const useCourseworkGeneratorStore = create<CourseworkGeneratorState>((set) => ({
  // Initial state
  selectedPdfPath: null,
  selectedPdfFilename: null,
  pdfLoading: false,
  pdfError: null,

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
}));
