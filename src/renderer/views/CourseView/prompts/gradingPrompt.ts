/**
 * AI Grading Prompt Generator
 *
 * Creates a structured prompt for AI-powered academic grading that analyzes
 * student submissions against rubric criteria and provides detailed feedback.
 */

export interface GradingPromptParams {
  rubricData: string;
  submissionData: string;
}

/**
 * Creates a comprehensive grading prompt for AI analysis
 * @param params - Object containing rubric and submission data
 * @returns Formatted grading prompt string
 */
export const createGradingPrompt = (params: GradingPromptParams): string => {
  const { rubricData, submissionData } = params;

  return `You are an expert academic grader. Analyze the student submission against the provided rubric and provide detailed feedback.

## GRADING RUBRIC:
${rubricData}

## STUDENT SUBMISSION:
${submissionData}

## GRADING TASK:
Carefully evaluate the student submission against each rubric criterion. Provide specific, constructive feedback that helps the student understand their strengths and areas for improvement.

IMPORTANT: Complete the grading efficiently in MAXIMUM 2 STEPS:
- Step 1: Analyze the submission against rubric criteria
- Step 2: Generate the final grading feedback
Do not overcomplicate the process - focus on providing accurate, constructive feedback quickly.

## REQUIRED OUTPUT FORMAT:
You MUST respond with ONLY a valid JSON object (no markdown code blocks, no explanations) with this exact structure:

{
  "comments": [
    {
      "elementType": "paragraph",
      "elementIndex": "0",
      "color": "green",
      "comment": "Strong thesis statement that clearly addresses the assignment requirements"
    },
    {
      "elementType": "paragraph",
      "elementIndex": "2",
      "color": "yellow",
      "comment": "Good analysis but could benefit from more specific examples"
    },
    {
      "elementType": "paragraph",
      "elementIndex": "5",
      "color": "red",
      "comment": "Missing citations - please add proper references for this claim"
    }
  ],
  "overallScore": 85,
  "scoreBreakdown": [
    {
      "criteriaName": "Content Quality",
      "score": 20,
      "maxScore": 25,
      "feedback": "Good understanding of topic but lacks depth in some areas"
    },
    {
      "criteriaName": "Organization & Structure",
      "score": 22,
      "maxScore": 25,
      "feedback": "Well-organized with clear introduction and conclusion"
    },
    {
      "criteriaName": "Evidence & Support",
      "score": 18,
      "maxScore": 25,
      "feedback": "Some good examples but needs more supporting evidence"
    },
    {
      "criteriaName": "Writing Quality",
      "score": 25,
      "maxScore": 25,
      "feedback": "Excellent grammar, spelling, and sentence structure"
    }
  ],
  "shortFeedback": "Well-structured essay with clear arguments. Main strengths include strong introduction and logical flow. Areas for improvement: add more supporting evidence in body paragraphs and strengthen the conclusion."
}

## GUIDELINES:
1. ELEMENT TYPES to use:
   - "paragraph" for p tags
   - "heading1", "heading2", "heading3" for h1, h2, h3 tags
   - "list" for ul/ol tags
   - "table" for tables

2. COLOR CODING:
   - "green" = Excellent (meets/exceeds expectations)
   - "yellow" = Adequate (meets basic requirements, room for improvement)
   - "red" = Needs improvement (does not meet requirements)

3. Provide at least 5-10 specific comments tied to actual elements in the submission
4. Make comments constructive and actionable
5. Overall score should be out of 100
6. Score breakdown should include individual criteria with their scores, max scores, and specific feedback
7. Ensure score breakdown totals match or are close to the overall score
8. Short feedback should be 2-3 sentences summarizing overall performance

IMPORTANT: Return ONLY the JSON object, nothing else.`;
};
