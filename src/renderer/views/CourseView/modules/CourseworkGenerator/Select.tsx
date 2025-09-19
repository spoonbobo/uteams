import React, { useState, useEffect } from 'react';
import { Typography, Box, Paper, Button, TextField, Chip, Stack, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { useIntl } from 'react-intl';
import { HTabPanel } from '@/components/HTabsPanel';
import type { CourseSessionContext } from '@/stores/useContextStore';
import { useMoodleStore } from '@/stores/useMoodleStore';
import { useCourseworkGeneratorStore } from '@/stores/useCourseworkGeneratorStore';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SchoolIcon from '@mui/icons-material/School';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AddIcon from '@mui/icons-material/Add';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DescriptionIcon from '@mui/icons-material/Description';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DataObjectIcon from '@mui/icons-material/DataObject';
import HighlightIcon from '@mui/icons-material/Highlight';
import InfoIcon from '@mui/icons-material/Info';
import PDFJsonDialog from '@/components/PDFPreview/PDFJsonDialog';

interface SelectProps {
  sessionContext: CourseSessionContext;
  examType: string;
  onExamTypeChange: (type: string) => void;
  examInstructions: string;
  onExamInstructionsChange: (instructions: string) => void;
  onProceedToGenerate: () => void;
  isGenerating: boolean;
}

function Select({
  sessionContext,
  examType,
  onExamTypeChange,
  examInstructions,
  onExamInstructionsChange,
  onProceedToGenerate,
  isGenerating,
}: SelectProps) {
  const intl = useIntl();
  const { getCourseContent } = useMoodleStore();
  const [generationType, setGenerationType] = useState('current');
  const [assignmentAttachments, setAssignmentAttachments] = useState<Record<string, any[]>>({});
  const [loadingAttachments, setLoadingAttachments] = useState<Record<string, boolean>>({});
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [pdfJsonData, setPdfJsonData] = useState<any>(null);
  const [jsonLoading, setJsonLoading] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [selectedJsonFilename, setSelectedJsonFilename] = useState<string>('');
  const [highlightLoading, setHighlightLoading] = useState(false);
  const [currentPdfData, setCurrentPdfData] = useState<any>(null);

  const sessionId = sessionContext.sessionId;
  const courseContent = getCourseContent(sessionId);

  // Use store for PDF preview state and assignment selection
  const {
    setSelectedPdf,
    setPdfLoading,
    setPdfError,
    pdfLoading,
    clearPdfPreview,
    selectedPdfPath,
    getSelectedAssignments,
    toggleAssignment,
    // New granular PDF methods
    setAssignmentPdf,
    setCurrentPreviewPdf,
    getCurrentPreviewPdf,
    getAssignmentPdfs,
    // Parsed content methods
    setParsedContent,
    getAllParsedContent,
    // Legacy methods for backward compatibility
    setPreviewPdf,
    getPreviewPdf
  } = useCourseworkGeneratorStore();

  // Get current course selections from store
  const selectedCoursework = getSelectedAssignments(sessionId);

  // Handle assignment toggle
  const onCourseworkToggle = (assignmentId: string) => {
    toggleAssignment(sessionId, assignmentId);
  };

  const handleGenerationTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGenerationType(event.target.value);
  };

  // Check if a file is a PDF
  const isPdfFile = (filename: string, mimetype?: string): boolean => {
    const filenameLower = filename.toLowerCase();
    return filenameLower.endsWith('.pdf') || mimetype === 'application/pdf';
  };

  // Check if any selected assignments have PDF attachments
  const hasPdfAttachments = (): boolean => {
    return selectedCoursework.some(assignmentId => {
      const attachments = assignmentAttachments[assignmentId] || [];
      return attachments.some(attachment => isPdfFile(attachment.filename, attachment.mimetype));
    });
  };

  // Handle PDF preview - download PDF and show in left panel
  const handlePdfPreview = async (attachment: any, assignmentId: string) => {
    if (!attachment.fileurl || !attachment.filename) {
      console.error('PDF attachment missing required fields');
      return;
    }

    setPdfLoading(true);
    setPdfError(null);

    try {
      // Get Moodle config for API key
      const { config } = useMoodleStore.getState();
      if (!config.apiKey) {
        throw new Error('No Moodle API key available');
      }

      // Check if we already have this PDF downloaded
      const existingPdfs = getAssignmentPdfs(sessionId, assignmentId);
      const existingPdf = existingPdfs[attachment.filename];

      if (existingPdf) {
        console.log('📄 Using cached PDF:', attachment.filename);
        // Set the PDF in the store to show in left panel
        setSelectedPdf(existingPdf.filePath, existingPdf.filename);
        // Set as current preview
        setCurrentPreviewPdf(sessionId, assignmentId, attachment.filename);

        // Try to parse for highlighting if not already done
        if (!currentPdfData) {
          await parsePdfForHighlighting(existingPdf.filePath);
        }

        setPdfLoading(false);
        return;
      }

      // Prepare download URL with token
      let downloadUrl = attachment.fileurl;
      if (downloadUrl && !downloadUrl.includes('token=')) {
        const separator = downloadUrl.includes('?') ? '&' : '?';
        downloadUrl = `${downloadUrl}${separator}token=${config.apiKey}`;
      }

      // Create unique filename for temp storage
      const uniqueFilename = `pdf_preview_${sessionId}_${assignmentId}_${attachment.filename}`;

      console.log('📄 Downloading PDF for preview:', attachment.filename);

      // Download PDF to temp directory
      const downloadResult = await window.electron.ipcRenderer.invoke('fileio:download-file', {
        url: downloadUrl,
        filename: uniqueFilename,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MoodleApp)',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!downloadResult.success) {
        throw new Error(downloadResult.error || 'Failed to download PDF');
      }

      console.log('✅ PDF downloaded successfully:', downloadResult.filePath);

      // Store the PDF in the granular store
      setAssignmentPdf(sessionId, assignmentId, attachment.filename, downloadResult.filePath);

      // Set as current preview
      setCurrentPreviewPdf(sessionId, assignmentId, attachment.filename);

      // Set the PDF in the store to show in left panel
      setSelectedPdf(downloadResult.filePath, attachment.filename);

      // Also parse the PDF structure for potential highlighting
      try {
        const parseResult = await window.electron.ipcRenderer.invoke('pdf:parse-to-json', {
          filePath: downloadResult.filePath,
          includeText: true,
          includeMetadata: true,
          includeStructure: false
        });

        if (parseResult.success) {
          setCurrentPdfData(parseResult.data);
        }
      } catch (parseError) {
        console.warn('Could not parse PDF for highlighting:', parseError);
      }

    } catch (error: any) {
      console.error('❌ Error downloading PDF for preview:', error);
      setPdfError(error.message || 'Failed to download PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  // Handle PDF parsing to JSON
  const handlePdfParseJson = async (attachment: any, assignmentId: string) => {
    if (!attachment.fileurl || !attachment.filename) {
      console.error('PDF attachment missing required fields');
      return;
    }

    setJsonLoading(true);
    setJsonError(null);

    try {
      // Get Moodle config for API key
      const { config } = useMoodleStore.getState();
      if (!config.apiKey) {
        throw new Error('No Moodle API key available');
      }

      // Prepare download URL with token
      let downloadUrl = attachment.fileurl;
      if (downloadUrl && !downloadUrl.includes('token=')) {
        const separator = downloadUrl.includes('?') ? '&' : '?';
        downloadUrl = `${downloadUrl}${separator}token=${config.apiKey}`;
      }

      // Create unique filename for temp storage
      const uniqueFilename = `pdf_parse_${sessionId}_${attachment.filename}`;

      console.log('📄 Downloading PDF for parsing:', attachment.filename);

      // Download PDF to temp directory
      const downloadResult = await window.electron.ipcRenderer.invoke('fileio:download-file', {
        url: downloadUrl,
        filename: uniqueFilename,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MoodleApp)',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!downloadResult.success) {
        throw new Error(downloadResult.error || 'Failed to download PDF');
      }

      console.log('✅ PDF downloaded successfully, parsing to JSON...');

      // Parse PDF to JSON using PDF.js
      const parseResult = await window.electron.ipcRenderer.invoke('pdf:parse-to-json', {
        filePath: downloadResult.filePath,
        includeText: true,
        includeMetadata: true,
        includeStructure: true
      });

      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Failed to parse PDF');
      }

      console.log('✅ PDF parsed successfully (AI-optimized format):', parseResult.data);

      // Store the parsed content in the store for later use in generation
      console.log('💾 Storing parsed PDF content for assignment:', assignmentId, attachment.filename);
      setParsedContent(sessionId, assignmentId, attachment.filename, parseResult.data);

      // Open the AI-optimized JSON dialog (no data saving)
      setPdfJsonData(parseResult.data);
      setSelectedJsonFilename(attachment.filename);
      setJsonDialogOpen(true);

    } catch (error: any) {
      console.error('❌ Error parsing PDF to JSON:', error);
      setJsonError(error.message || 'Failed to parse PDF');
    } finally {
      setJsonLoading(false);
    }
  };

  // Close JSON dialog
  const handleCloseJsonDialog = () => {
    setJsonDialogOpen(false);
    setPdfJsonData(null);
    setSelectedJsonFilename('');
    setJsonError(null);
  };

  // Helper function to sanitize text for PDF creation (remove problematic Unicode characters)
  const sanitizeTextForPdf = (text: string): string => {
    if (!text || typeof text !== 'string') return '';

    try {
      return text
      // First, remove null characters and other control characters (0x00-0x1F except tab, newline, carriage return)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // Remove control characters except \t, \n, \r
      .replace(/\x00/g, '')  // Explicitly remove null bytes
      // Replace problematic Unicode characters with ASCII equivalents
      .replace(/[−–—]/g, '-')  // Various dashes to hyphen
      .replace(/['']/g, "'")   // Smart quotes to straight quotes
      .replace(/[""]/g, '"')   // Smart quotes to straight quotes
      .replace(/[…]/g, '...')  // Ellipsis to three dots
      .replace(/[©]/g, '(c)')  // Copyright symbol
      .replace(/[®]/g, '(r)')  // Registered trademark
      .replace(/[™]/g, '(tm)') // Trademark
      .replace(/[°]/g, ' deg') // Degree symbol
      .replace(/[µ]/g, 'u')    // Micro symbol
      .replace(/[×]/g, 'x')    // Multiplication sign
      .replace(/[÷]/g, '/')    // Division sign

      // Mathematical symbols - convert to readable ASCII equivalents
      .replace(/[∗]/g, '*')    // Mathematical asterisk to regular asterisk
      .replace(/[∙•]/g, '*')   // Bullet points to asterisk
      .replace(/[≤]/g, '<=')   // Less than or equal
      .replace(/[≥]/g, '>=')   // Greater than or equal
      .replace(/[≠]/g, '!=')   // Not equal
      .replace(/[≈]/g, '~=')   // Approximately equal
      .replace(/[≡]/g, '===')  // Identical to
      .replace(/[∞]/g, 'inf')  // Infinity
      .replace(/[∑]/g, 'SUM')  // Summation
      .replace(/[∏]/g, 'PROD') // Product
      .replace(/[∫]/g, 'INT')  // Integral
      .replace(/[√]/g, 'sqrt') // Square root
      .replace(/[∛]/g, 'cbrt') // Cube root
      .replace(/[±]/g, '+/-')  // Plus-minus
      .replace(/[∓]/g, '-/+')  // Minus-plus
      .replace(/[∝]/g, 'prop') // Proportional to
      .replace(/[∀]/g, 'forall') // For all
      .replace(/[∃]/g, 'exists') // There exists
      .replace(/[∅]/g, 'empty') // Empty set
      .replace(/[∈]/g, 'in')   // Element of
      .replace(/[∉]/g, 'notin') // Not element of
      .replace(/[⊂]/g, 'subset') // Subset of
      .replace(/[⊃]/g, 'superset') // Superset of
      .replace(/[∪]/g, 'union') // Union
      .replace(/[∩]/g, 'intersect') // Intersection
      .replace(/[∧]/g, 'AND')  // Logical and
      .replace(/[∨]/g, 'OR')   // Logical or
      .replace(/[¬]/g, 'NOT')  // Logical not
      .replace(/[→]/g, '->')   // Right arrow
      .replace(/[←]/g, '<-')   // Left arrow
      .replace(/[↔]/g, '<->')  // Left-right arrow
      .replace(/[⇒]/g, '=>')   // Right double arrow
      .replace(/[⇐]/g, '<=')   // Left double arrow
      .replace(/[⇔]/g, '<=>') // Left-right double arrow

      // Greek letters commonly used in mathematics
      .replace(/[α]/g, 'alpha')   // Greek alpha
      .replace(/[β]/g, 'beta')    // Greek beta
      .replace(/[γ]/g, 'gamma')   // Greek gamma
      .replace(/[δ]/g, 'delta')   // Greek delta
      .replace(/[ε]/g, 'epsilon') // Greek epsilon
      .replace(/[ζ]/g, 'zeta')    // Greek zeta
      .replace(/[η]/g, 'eta')     // Greek eta
      .replace(/[θ]/g, 'theta')   // Greek theta
      .replace(/[ι]/g, 'iota')    // Greek iota
      .replace(/[κ]/g, 'kappa')   // Greek kappa
      .replace(/[λ]/g, 'lambda')  // Greek lambda
      .replace(/[μ]/g, 'mu')      // Greek mu
      .replace(/[ν]/g, 'nu')      // Greek nu
      .replace(/[ξ]/g, 'xi')      // Greek xi
      .replace(/[π]/g, 'pi')      // Greek pi
      .replace(/[ρ]/g, 'rho')     // Greek rho
      .replace(/[σ]/g, 'sigma')   // Greek sigma
      .replace(/[τ]/g, 'tau')     // Greek tau
      .replace(/[υ]/g, 'upsilon') // Greek upsilon
      .replace(/[φ]/g, 'phi')     // Greek phi
      .replace(/[χ]/g, 'chi')     // Greek chi
      .replace(/[ψ]/g, 'psi')     // Greek psi
      .replace(/[ω]/g, 'omega')   // Greek omega

      // Capital Greek letters
      .replace(/[Α]/g, 'Alpha')   // Greek capital alpha
      .replace(/[Β]/g, 'Beta')    // Greek capital beta
      .replace(/[Γ]/g, 'Gamma')   // Greek capital gamma
      .replace(/[Δ]/g, 'Delta')   // Greek capital delta
      .replace(/[Ε]/g, 'Epsilon') // Greek capital epsilon
      .replace(/[Ζ]/g, 'Zeta')    // Greek capital zeta
      .replace(/[Η]/g, 'Eta')     // Greek capital eta
      .replace(/[Θ]/g, 'Theta')   // Greek capital theta
      .replace(/[Ι]/g, 'Iota')    // Greek capital iota
      .replace(/[Κ]/g, 'Kappa')   // Greek capital kappa
      .replace(/[Λ]/g, 'Lambda')  // Greek capital lambda
      .replace(/[Μ]/g, 'Mu')      // Greek capital mu
      .replace(/[Ν]/g, 'Nu')      // Greek capital nu
      .replace(/[Ξ]/g, 'Xi')      // Greek capital xi
      .replace(/[Π]/g, 'Pi')      // Greek capital pi
      .replace(/[Ρ]/g, 'Rho')     // Greek capital rho
      .replace(/[Σ]/g, 'Sigma')   // Greek capital sigma
      .replace(/[Τ]/g, 'Tau')     // Greek capital tau
      .replace(/[Υ]/g, 'Upsilon') // Greek capital upsilon
      .replace(/[Φ]/g, 'Phi')     // Greek capital phi
      .replace(/[Χ]/g, 'Chi')     // Greek capital chi
      .replace(/[Ψ]/g, 'Psi')     // Greek capital psi
      .replace(/[Ω]/g, 'Omega')   // Greek capital omega

      // Superscript and subscript numbers (common in math)
      .replace(/[⁰]/g, '^0')  // Superscript 0
      .replace(/[¹]/g, '^1')  // Superscript 1
      .replace(/[²]/g, '^2')  // Superscript 2
      .replace(/[³]/g, '^3')  // Superscript 3
      .replace(/[⁴]/g, '^4')  // Superscript 4
      .replace(/[⁵]/g, '^5')  // Superscript 5
      .replace(/[⁶]/g, '^6')  // Superscript 6
      .replace(/[⁷]/g, '^7')  // Superscript 7
      .replace(/[⁸]/g, '^8')  // Superscript 8
      .replace(/[⁹]/g, '^9')  // Superscript 9
      .replace(/[₀]/g, '_0')  // Subscript 0
      .replace(/[₁]/g, '_1')  // Subscript 1
      .replace(/[₂]/g, '_2')  // Subscript 2
      .replace(/[₃]/g, '_3')  // Subscript 3
      .replace(/[₄]/g, '_4')  // Subscript 4
      .replace(/[₅]/g, '_5')  // Subscript 5
      .replace(/[₆]/g, '_6')  // Subscript 6
      .replace(/[₇]/g, '_7')  // Subscript 7
      .replace(/[₈]/g, '_8')  // Subscript 8
      .replace(/[₉]/g, '_9')  // Subscript 9

      // Fractions
      .replace(/[½]/g, '1/2')  // One half
      .replace(/[⅓]/g, '1/3')  // One third
      .replace(/[⅔]/g, '2/3')  // Two thirds
      .replace(/[¼]/g, '1/4')  // One quarter
      .replace(/[¾]/g, '3/4')  // Three quarters
      .replace(/[⅕]/g, '1/5')  // One fifth
      .replace(/[⅖]/g, '2/5')  // Two fifths
      .replace(/[⅗]/g, '3/5')  // Three fifths
      .replace(/[⅘]/g, '4/5')  // Four fifths
      .replace(/[⅙]/g, '1/6')  // One sixth
      .replace(/[⅚]/g, '5/6')  // Five sixths
      .replace(/[⅐]/g, '1/7')  // One seventh
      .replace(/[⅛]/g, '1/8')  // One eighth
      .replace(/[⅜]/g, '3/8')  // Three eighths
      .replace(/[⅝]/g, '5/8')  // Five eighths
      .replace(/[⅞]/g, '7/8')  // Seven eighths
      .replace(/[⅑]/g, '1/9')  // One ninth
      .replace(/[⅒]/g, '1/10') // One tenth

      // Remove other problematic Unicode ranges (mathematical operators, symbols, etc.)
      .replace(/[\u2000-\u206F\u2070-\u209F\u20A0-\u20CF\u2100-\u214F\u2150-\u218F\u2190-\u21FF\u2200-\u22FF\u2300-\u23FF\u2460-\u24FF\u25A0-\u25FF\u2600-\u26FF]/g, ' ')

      // Remove any remaining non-ASCII characters as last resort
      .replace(/[^\x00-\x7F]/g, '?')

      // Remove any remaining null characters that might have been introduced
      .replace(/\0/g, '')

      // Normalize whitespace and clean up
      .replace(/\s+/g, ' ')
      .replace(/\t/g, '    ')  // Convert tabs to spaces
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\r/g, '\n')    // Convert remaining carriage returns
      .trim();
    } catch (error) {
      console.warn('[PDF Sanitizer] Error sanitizing text:', error);
      // Fallback: return a safe version of the text
      return String(text || '')
        .replace(/[\x00-\x1F\x7F]/g, '')  // Remove all control characters
        .replace(/[^\x20-\x7E]/g, '?')    // Replace non-printable ASCII with ?
        .trim() || 'Unable to process text content';
    }
  };

  // Handle real-time highlighting of current PDF
  const handleHighlightCurrentPdf = async () => {
    if (!selectedPdfPath) {
      alert('No PDF currently loaded for highlighting');
      return;
    }

    // If we don't have PDF data yet, try to parse it first
    if (!currentPdfData) {
      console.log('🔍 PDF data not available, attempting to parse...');
      await parsePdfForHighlighting(selectedPdfPath);

      // Check again after parsing
      if (!currentPdfData) {
        alert('Could not parse PDF data for highlighting. The file may no longer exist or be corrupted.');
        return;
      }
    }

    setHighlightLoading(true);

    try {
      console.log('🎯 Applying intelligent highlights to current PDF...');

      // Generate AI-style patches for key content
      const aiPatches: any[] = [];

      // Find mathematical and important content to highlight
      currentPdfData.elements?.forEach((element: any, index: number) => {
        const shouldHighlight =
          element.content.type === 'math_symbol' ||
          element.content.type === 'formula' ||
          element.content.type === 'greek_letter' ||
          element.content.type === 'theorem' ||
          element.content.type === 'solution' ||
          (element.content.type === 'number' && element.content.text.includes('.')) ||
          element.content.type === 'variable';

        if (shouldHighlight && aiPatches.length < 8) { // Limit to 8 highlights
          aiPatches.push({
            elementId: element.elementId,
            action: 'annotate',
            data: {
              comment: getSmartComment(element),
              highlightColor: getHighlightColor(element.content.type),
              importance: element.content.type.includes('formula') ? 'high' : 'medium'
            }
          });
        }
      });

      if (aiPatches.length === 0) {
        alert('No suitable content found for highlighting in this PDF');
        return;
      }

      // Apply the highlights using our AI patches handler
      const highlightResult = await window.electron.ipcRenderer.invoke('pdf:apply-ai-patches', {
        filePath: selectedPdfPath,
        outputPath: selectedPdfPath.replace('.pdf', '_highlighted.pdf'),
        pdfStructure: currentPdfData,
        patches: aiPatches
      });

      if (!highlightResult.success) {
        throw new Error(highlightResult.error || 'Failed to apply highlights');
      }

      console.log('✅ Highlights applied successfully:', highlightResult.data);

      // Update the preview to show the highlighted version
      setSelectedPdf(highlightResult.data.outputPath, `Highlighted - ${currentPdfData.document.metadata?.title || 'PDF'}`);

      alert(`✅ Applied ${highlightResult.data.patchesApplied} highlights to PDF!\n\nHighlighted version now showing in preview.`);

    } catch (error: any) {
      console.error('❌ Error highlighting PDF:', error);
      alert(`Error applying highlights: ${error.message}`);
    } finally {
      setHighlightLoading(false);
    }
  };

  // Helper function to get smart comments based on element type
  const getSmartComment = (element: any): string => {
    switch (element.content.type) {
      case 'math_symbol': return 'Mathematical symbol';
      case 'formula': return 'Key formula';
      case 'greek_letter': return 'Greek letter';
      case 'theorem': return 'Important theorem';
      case 'solution': return 'Solution method';
      case 'variable': return 'Variable';
      case 'number': return 'Numerical value';
      default: return 'Important content';
    }
  };

  // Helper function to get highlight color based on content type
  const getHighlightColor = (type: string): 'yellow' | 'green' | 'blue' | 'red' => {
    if (type.includes('formula') || type.includes('theorem')) return 'red';
    if (type.includes('math') || type.includes('greek')) return 'yellow';
    if (type.includes('solution')) return 'green';
    return 'blue';
  };

  // Fetch attachments for a specific assignment
  const fetchAssignmentAttachments = async (assignmentId: string) => {
    if (assignmentAttachments[assignmentId] || loadingAttachments[assignmentId]) {
      return; // Already loaded or loading
    }

    const { config } = useMoodleStore.getState();
    if (!config.apiKey) {
      return; // No API key available
    }

    setLoadingAttachments(prev => ({ ...prev, [assignmentId]: true }));

    try {
      const result = await window.electron.ipcRenderer.invoke('moodle:get-assignment-attachments', {
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        assignmentId,
        courseId: sessionId
      });

      if (result.success) {
        setAssignmentAttachments(prev => ({
          ...prev,
          [assignmentId]: result.data || []
        }));
      }
    } catch (error) {
      console.error('Error fetching assignment attachments:', error);
      setAssignmentAttachments(prev => ({
        ...prev,
        [assignmentId]: []
      }));
    } finally {
      setLoadingAttachments(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  // Fetch attachments when assignments are selected
  useEffect(() => {
    selectedCoursework.forEach(assignmentId => {
      fetchAssignmentAttachments(assignmentId);
    });
  }, [selectedCoursework]);

  // Function to parse PDF data for highlighting
  const parsePdfForHighlighting = async (filePath: string) => {
    try {
      const parseResult = await window.electron.ipcRenderer.invoke('pdf:parse-to-json', {
        filePath,
        includeText: true,
        includeMetadata: true,
        includeStructure: false
      });

      if (parseResult.success) {
        setCurrentPdfData(parseResult.data);
        console.log('✅ PDF parsed for highlighting:', parseResult.data);
      } else {
        console.warn('Could not parse PDF for highlighting:', parseResult.error);
      }
    } catch (parseError) {
      console.warn('Could not parse PDF for highlighting:', parseError);
    }
  };

  // Restore previously selected PDF on component mount or course change
  useEffect(() => {
    const currentPreview = getCurrentPreviewPdf(sessionId);
    if (currentPreview.filePath && currentPreview.filename) {
      console.log(`📄 Restoring PDF preview for course ${sessionId}:`, currentPreview.filename);
      setSelectedPdf(currentPreview.filePath, currentPreview.filename);

      // Also parse the PDF for highlighting if the file still exists
      parsePdfForHighlighting(currentPreview.filePath);
    } else {
      console.log(`📄 No saved PDF preview for course ${sessionId}`);
    }
  }, [sessionId, getCurrentPreviewPdf, setSelectedPdf]);

  // Auto-preview first PDF when assignments change (only if no PDF is currently selected)
  useEffect(() => {
    if (selectedCoursework.length === 0) {
      // Clear preview when no assignments selected
      clearPdfPreview();
      setCurrentPdfData(null); // Also clear PDF data for highlighting
      return;
    }

    // Only auto-preview if no PDF is currently selected
    if (!selectedPdfPath) {
      // Find first PDF attachment from selected assignments
      for (const assignmentId of selectedCoursework) {
        const attachments = assignmentAttachments[assignmentId];
        if (attachments && attachments.length > 0) {
          const firstPdf = attachments.find(att => isPdfFile(att.filename, att.mimetype));
          if (firstPdf && firstPdf.fileurl) {
            handlePdfPreview(firstPdf, assignmentId);
            break; // Only preview the first PDF found
          }
        }
      }
    }
  }, [selectedCoursework, assignmentAttachments, selectedPdfPath, sessionId, clearPdfPreview]);

  return (
    <HTabPanel
      title={intl.formatMessage({ id: 'courseworkGenerator.selectCoursework.title' })}
    >
      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {intl.formatMessage({ id: 'courseworkGenerator.selectCoursework.description' })}
        </Typography>
      </Box>

      {/* Generation Type Selection */}
      <Box sx={{ mb: 4 }}>
        <FormControl component="fieldset">
          <FormLabel component="legend" sx={{ mb: 2, fontWeight: 500 }}>
            <Typography variant="h6">
              {intl.formatMessage({ id: 'courseworkGenerator.generationType.title' })}
            </Typography>
          </FormLabel>
          <RadioGroup
            value={generationType}
            onChange={handleGenerationTypeChange}
            sx={{ gap: 2 }}
          >
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
              <Paper
                sx={{
                  p: 2,
                  border: '2px solid',
                  borderColor: generationType === 'current' ? 'primary.main' : 'divider',
                  backgroundColor: generationType === 'current' ? 'action.selected' : 'background.paper',
                  transition: 'all 0.2s ease',
                  flex: 1,
                }}
              >
                <FormControlLabel
                  value="current"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AssignmentIcon color="primary" />
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                          {intl.formatMessage({ id: 'courseworkGenerator.generationType.current' })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {intl.formatMessage({ id: 'courseworkGenerator.generationType.currentDescription' })}
                        </Typography>
                      </Box>
                    </Box>
                  }
                  sx={{ m: 0, width: '100%' }}
                />
              </Paper>

              <Paper
                sx={{
                  p: 2,
                  border: '2px solid',
                  borderColor: generationType === 'new' ? 'primary.main' : 'divider',
                  backgroundColor: generationType === 'new' ? 'action.selected' : 'background.paper',
                  opacity: 0.5,
                  transition: 'all 0.2s ease',
                  flex: 1,
                }}
              >
                <FormControlLabel
                  value="new"
                  control={<Radio />}
                  disabled
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AddIcon />
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                          {intl.formatMessage({ id: 'courseworkGenerator.generationType.new' })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {intl.formatMessage({ id: 'courseworkGenerator.generationType.newDescription' })}
                        </Typography>
                        <Chip
                          size="small"
                          label={intl.formatMessage({ id: 'courseworkGenerator.comingSoon' })}
                          variant="outlined"
                          sx={{ mt: 1 }}
                        />
                      </Box>
                    </Box>
                  }
                  sx={{ m: 0, width: '100%' }}
                />
              </Paper>
            </Box>
          </RadioGroup>
        </FormControl>
      </Box>

      {/* Available Assignments - Only show when current assignments is selected */}
      {generationType === 'current' && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
            {intl.formatMessage({ id: 'courseworkGenerator.selectCoursework.availableAssignments' })}
          </Typography>

        {courseContent?.assignments && courseContent.assignments.length > 0 ? (
          <Stack spacing={2}>
            {courseContent.assignments.map((assignment) => (
              <Paper
                key={assignment.id}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  border: '2px solid',
                  borderColor: selectedCoursework.includes(assignment.id.toString())
                    ? 'primary.main'
                    : 'divider',
                  backgroundColor: selectedCoursework.includes(assignment.id.toString())
                    ? 'action.selected'
                    : 'background.paper',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'action.hover',
                  },
                }}
                onClick={() => onCourseworkToggle(assignment.id.toString())}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 500, mb: 1 }}>
                      {assignment.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {assignment.intro && assignment.intro.length > 200
                        ? `${assignment.intro.substring(0, 200)}...`
                        : assignment.intro || intl.formatMessage({ id: 'courseworkGenerator.noDescription' })}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        size="small"
                        label={`${intl.formatMessage({ id: 'courseworkGenerator.dueDate' })}: ${new Date(assignment.duedate * 1000).toLocaleDateString()}`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={`${intl.formatMessage({ id: 'courseworkGenerator.maxGrade' })}: ${assignment.grade}`}
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                  {selectedCoursework.includes(assignment.id.toString()) && (
                    <SchoolIcon color="primary" sx={{ ml: 2 }} />
                  )}
                </Box>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {intl.formatMessage({ id: 'courseworkGenerator.noAssignments' })}
            </Typography>
          </Paper>
        )}
        </Box>
      )}

      {/* Selected Assignments with Attachments */}
      {generationType === 'current' && selectedCoursework.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
            {intl.formatMessage({ id: 'courseworkGenerator.selectedAssignments' })} ({selectedCoursework.length})
          </Typography>

          <Stack spacing={2}>
            {selectedCoursework.map((assignmentId) => {
              const assignment = courseContent?.assignments?.find(a => a.id.toString() === assignmentId);
              const attachments = assignmentAttachments[assignmentId] || [];
              const isLoading = loadingAttachments[assignmentId];

              if (!assignment) return null;

              return (
                <Paper
                  key={assignmentId}
                  sx={{
                    p: 3,
                    border: '2px solid',
                    borderColor: 'primary.main',
                    backgroundColor: 'action.selected',
                  }}
                >
                  {/* Assignment Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <SchoolIcon color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: 500, flex: 1 }}>
                      {assignment.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={`${attachments.length} ${intl.formatMessage({ id: 'courseworkGenerator.attachments' })}`}
                      variant="outlined"
                      color="primary"
                    />
                  </Box>

                  {/* Assignment Description */}
                  {assignment.intro && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {assignment.intro.length > 300
                          ? `${assignment.intro.substring(0, 300)}...`
                          : assignment.intro}
                      </Typography>
                    </Box>
                  )}

                  {/* Attachments */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AttachFileIcon fontSize="small" />
                      {intl.formatMessage({ id: 'courseworkGenerator.attachments' })}
                    </Typography>

                    {isLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
                        <CircularProgress size={16} />
                        <Typography variant="body2" color="text.secondary">
                          {intl.formatMessage({ id: 'courseworkGenerator.loadingAttachments' })}
                        </Typography>
                      </Box>
                    ) : attachments.length > 0 ? (
                      <Stack spacing={1}>
                        {attachments.map((attachment, index) => {
                          const isPdf = isPdfFile(attachment.filename, attachment.mimetype);
                          // Check if this PDF has been parsed
                          const hasParsedContent = isPdf && getAllParsedContent(sessionId)
                            .some(pc => pc.assignmentId === assignmentId && pc.filename === attachment.filename);

                          return (
                            <Paper
                              key={index}
                              sx={{
                                p: 1.5,
                                border: '1px solid',
                                borderColor: hasParsedContent ? 'success.main' : 'divider',
                                backgroundColor: hasParsedContent ? 'success.light' : 'background.paper',
                                opacity: hasParsedContent ? 1 : 0.9,
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {isPdf ? (
                                  <PictureAsPdfIcon fontSize="small" color="error" />
                                ) : (
                                  <DescriptionIcon fontSize="small" color="action" />
                                )}
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {attachment.filename}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {attachment.filesize > 0 && `${(attachment.filesize / 1024).toFixed(1)} KB`}
                                    {attachment.mimetype && ` • ${attachment.mimetype}`}
                                  </Typography>
                                </Box>

                                {/* PDF Actions */}
                                {isPdf && attachment.fileurl && (
                                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    <Tooltip title={pdfLoading ? "Loading PDF..." : "Preview PDF"}>
                                      <span>
                                        <IconButton
                                          size="small"
                                          onClick={() => handlePdfPreview(attachment, assignmentId)}
                                          disabled={pdfLoading || jsonLoading}
                                        >
                                          {pdfLoading ? (
                                            <CircularProgress size={16} />
                                          ) : (
                                            <VisibilityIcon fontSize="small" />
                                          )}
                                        </IconButton>
                                      </span>
                                    </Tooltip>

                                    <Tooltip title={jsonLoading ? "Parsing PDF..." : "Parse to AI-Ready JSON"}>
                                      <span>
                                        <IconButton
                                          size="small"
                                          onClick={() => handlePdfParseJson(attachment, assignmentId)}
                                          disabled={pdfLoading || jsonLoading}
                                        >
                                          {jsonLoading ? (
                                            <CircularProgress size={16} />
                                          ) : (
                                            <DataObjectIcon fontSize="small" />
                                          )}
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  </Box>
                                )}

                                <Chip
                                  size="small"
                                  label={isPdf ? (hasParsedContent ? 'PDF ✓' : 'PDF') : (attachment.type || 'file')}
                                  variant="outlined"
                                  color={hasParsedContent ? 'success' : (isPdf ? 'error' : 'default')}
                                />
                              </Box>
                            </Paper>
                          );
                        })}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {intl.formatMessage({ id: 'courseworkGenerator.noAttachments' })}
                      </Typography>
                    )}
                  </Box>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      )}


      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        {/* Highlight Current PDF Button */}
        <Button
          variant="outlined"
          size="large"
          disabled={!selectedPdfPath || highlightLoading}
          onClick={handleHighlightCurrentPdf}
          startIcon={highlightLoading ? <CircularProgress size={20} /> : <HighlightIcon />}
        >
          {highlightLoading ? 'Highlighting...' : 'Highlight PDF'}
        </Button>

        {/* Generate Button */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="contained"
            size="large"
            disabled={
              generationType !== 'current' ||
              selectedCoursework.length === 0 ||
              isGenerating
            }
            onClick={onProceedToGenerate}
          >
            {intl.formatMessage({ id: 'courseworkGenerator.proceedToGenerate' })}
          </Button>
          <Tooltip
            title={intl.formatMessage({ id: 'courseworkGenerator.pdfFormatNotice' })}
            placement="top"
            arrow
          >
            <InfoIcon
              sx={{
                color: 'info.main',
                fontSize: 20,
                cursor: 'help'
              }}
            />
          </Tooltip>
        </Box>
      </Box>

      {/* PDF JSON Structure Dialog */}
      <PDFJsonDialog
        open={jsonDialogOpen}
        onClose={handleCloseJsonDialog}
        filename={selectedJsonFilename}
        jsonData={pdfJsonData}
        loading={jsonLoading}
        error={jsonError}
      />


      {/* JSON Parse Error Display */}
      {jsonError && (
        <Box sx={{ position: 'fixed', top: 140, right: 20, zIndex: 9999 }}>
          <Paper sx={{ p: 2, bgcolor: 'warning.light', color: 'warning.contrastText', maxWidth: 300 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              PDF Parse Error
            </Typography>
            <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
              {jsonError}
            </Typography>
            <Button
              size="small"
              onClick={() => setJsonError(null)}
              sx={{ mt: 1, color: 'inherit' }}
            >
              Dismiss
            </Button>
          </Paper>
        </Box>
      )}

    </HTabPanel>
  );
}

export default Select;
