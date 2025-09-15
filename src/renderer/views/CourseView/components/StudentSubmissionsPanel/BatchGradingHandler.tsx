import type { StudentSubmissionData } from '../../../../stores/useGradingStore';
import type { SubmissionFile, CategorizedStudents } from './types';

export const useBatchGradingHandler = (
  selectedAssignment: string,
  categorizedStudents: CategorizedStudents,
  batchGradingActive: boolean,
  batchGradingProgress: { completed: number; failed: number; total: number; currentStudent: string | null },
  startBatchGrading: (total: number) => void,
  updateBatchGradingProgress: (completed: number, failed: number, currentStudent: string | null) => void,
  endBatchGrading: () => void,
  getGradingRecord: (assignmentId: string, studentId: string) => any,
  handleStartGrading: (studentId: string, studentFiles: Record<string, SubmissionFile[]>, loadStudentFiles: (id: string) => Promise<SubmissionFile[]>) => Promise<void>
) => {
  const handleBatchGrading = async (studentFiles: Record<string, SubmissionFile[]>, loadStudentFiles: (id: string) => Promise<SubmissionFile[]>) => {
    if (!selectedAssignment || batchGradingActive) return;
    
    // Get all students ready to grade
    const studentsToGrade = categorizedStudents.notGradedSubmitted;
    
    if (studentsToGrade.length === 0) {
      console.log('No students ready to grade');
      return;
    }
    
    // Use store to track batch grading state
    startBatchGrading(studentsToGrade.length);
    
    console.log(`🚀 Starting batch grading for ${studentsToGrade.length} students:`, 
      studentsToGrade.map(s => ({ id: s.student.id, name: s.student.fullname }))
    );
    
    // Process students with controlled concurrency
    const MAX_CONCURRENT = 2; // Process 2 students in parallel for efficiency
    const queue = [...studentsToGrade];
    const inProgress = new Map<string, Promise<void>>();
    let processedCount = 0;
    
    console.log('🚀 Batch grading configuration:', {
      maxConcurrent: MAX_CONCURRENT,
      totalStudents: studentsToGrade.length,
      parallelExecution: true
    });
    
    while (queue.length > 0 || inProgress.size > 0) {
      // Start new grading tasks up to the limit
      while (queue.length > 0 && inProgress.size < MAX_CONCURRENT) {
        const student = queue.shift()!;
        const studentId = student.student.id;
        const studentName = student.student.fullname;
        
        // Update batch progress with current student
        updateBatchGradingProgress(
          batchGradingProgress.completed,
          batchGradingProgress.failed,
          studentName
        );
        
        // During batch grading, DON'T change the selected submission
        // This keeps the AIGradingPanel focused on the originally selected student
        // The activeGradingStudent in the store will track which student is being graded
        
        console.log(`📝 [${++processedCount}/${studentsToGrade.length}] Starting grading for ${studentName} (ID: ${studentId})`);
        console.log(`   Queue remaining: ${queue.length}, In progress: ${inProgress.size}`);
        console.log(`   🔄 Parallel tasks running:`, Array.from(inProgress.keys()).join(', '));
        
        const gradingPromise = handleStartGrading(studentId, studentFiles, loadStudentFiles)
          .then(() => {
            console.log(`✅ [${processedCount}/${studentsToGrade.length}] Completed grading for ${studentName}`);
            
            // Verify the result was saved
            const savedResult = getGradingRecord(selectedAssignment, studentId);
            console.log(`   Result saved: ${!!savedResult}, Has AI result: ${!!savedResult?.aiGradeResult}`);
            
            // Update batch progress
            const newCompleted = batchGradingProgress.completed + 1;
            const nextStudent = newCompleted < batchGradingProgress.total ? batchGradingProgress.currentStudent : null;
            updateBatchGradingProgress(newCompleted, batchGradingProgress.failed, nextStudent);
          })
          .catch((error) => {
            console.error(`❌ [${processedCount}/${studentsToGrade.length}] Failed grading for ${studentName}:`, error);
            
            // Update batch progress
            const newFailed = batchGradingProgress.failed + 1;
            const nextStudent = (batchGradingProgress.completed + newFailed) < batchGradingProgress.total ? batchGradingProgress.currentStudent : null;
            updateBatchGradingProgress(batchGradingProgress.completed, newFailed, nextStudent);
          })
          .finally(() => {
            console.log(`🔄 Removing ${studentName} from in-progress map`);
            inProgress.delete(studentId);
          });
        
        inProgress.set(studentId, gradingPromise);
        
        // Add a small delay between starting concurrent tasks to avoid race conditions
        if (queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Wait for at least one task to complete before continuing
      if (inProgress.size > 0) {
        console.log(`⏳ Waiting for one of ${inProgress.size} tasks to complete...`);
        await Promise.race(inProgress.values());
      }
    }
    
    console.log('🎉 Batch grading completed:', {
      completed: batchGradingProgress.completed,
      failed: batchGradingProgress.failed,
      total: studentsToGrade.length
    });
    
    // End batch grading in store
    endBatchGrading();
  };

  return { handleBatchGrading };
};
