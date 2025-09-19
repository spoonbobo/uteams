import type { CourseSessionContext } from '@/stores/useContextStore';

// Type definitions for question variant generation
export interface QuestionVariantContext {
  pageContents: string[]; // Full page text content from PDFs
  specialInstructions?: string;
}

export interface QuestionVariant {
  id: string;
  questionId: string; // ID of the original question being varied
  originalQuestion: string; // For string search later (not included in prompt)
  variantQuestion: string;  // The generated variant
  difficulty: 'same'; // Always same difficulty for variants
  variantType: 'rephrase' | 'parameter_change' | 'context_change' | 'approach_change';
  explanation?: string; // Why this variant was created
  sourcePageIndex?: number; // Which page the original question came from
}

/**
 * Generate question variants from current assignment content
 * This prompt analyzes existing questions and creates variants for assessment
 */
export function generateQuestionVariantsFromCurrent(context: QuestionVariantContext): string {
  const { pageContents, specialInstructions } = context;

  return `You are an expert question variant generator for academic assignments. Your task is to analyze assignment content and generate variants of existing questions while maintaining the same difficulty level and testing the same concepts.

## Assignment Content:
${pageContents.map((content, index) => `
### Page ${index + 1} Content:
${content}

---
`).join('\n')}

${specialInstructions ? `
## Special Instructions:
${specialInstructions}
` : ''}

## Your Task:
**CRITICAL**: Complete this task in MAXIMUM 3 STEPS. Work efficiently and output all results in one comprehensive response.

### Step 1: Content Analysis (1 step only)
- **Scan all assignment content** to identify every question, problem, and exercise
- **Create a mental inventory** of all assessable content without detailed analysis
- **Note question types and patterns** for efficient variant generation

### Step 2: Batch Variant Generation (1 step only)
- **Generate 2-3 variants for ALL questions simultaneously** in one comprehensive pass
- **Work systematically through your mental inventory** from Step 1
- **Apply all variant types** (rephrase, parameter change, context change, approach change) efficiently

### Step 3: Complete JSON Output (1 step only)
- **Output ALL variants immediately** in the required JSON format
- **No incremental outputs** - provide the complete result in one response
- **Include all required fields** for every variant identified

## Variant Types to Create:
1. **Rephrase**: Same question with different wording but identical concept
2. **Parameter Change**: Change numbers, variables, or specific values while keeping the same method
3. **Context Change**: Change the scenario/context but maintain the same mathematical or conceptual approach
4. **Approach Change**: Present the same problem from a different angle or perspective

## Mathematical Content Requirements:
- **Use LaTeX notation** for all mathematical expressions
- **Preserve mathematical accuracy** in all variants
- **Maintain the same solution complexity** - variants should require the same level of effort
- **Keep the same mathematical concepts** being tested
- **Ensure all calculations remain valid** with parameter changes

## Output Format:
Return a JSON array of question variants with original question text for element matching:
\`\`\`json
[
  {
    "id": "q1_variant_1",
    "questionId": "q1",
    "originalQuestion": "Calculate the derivative of f(x) = 2x^2 + x - 3",
    "variantQuestion": "Calculate the derivative of $f(x) = 3x^2 + 2x - 1$ using the power rule.",
    "difficulty": "same",
    "variantType": "parameter_change",
    "explanation": "Changed coefficients while maintaining the same differentiation concept"
  },
  {
    "id": "q1_variant_2",
    "questionId": "q1",
    "originalQuestion": "Calculate the derivative of f(x) = 2x^2 + x - 3",
    "variantQuestion": "Find $\\frac{d}{dx}[2x^3 - 5x + 7]$ and evaluate at $x = 1$.",
    "difficulty": "same",
    "variantType": "approach_change",
    "explanation": "Same differentiation concept but asks for evaluation at a point"
  }
]
\`\`\`

**Important**: Include the exact original question text as it appears in the content for accurate element index matching during post-processing.

## Verification Requirements:
Before finalizing your response, verify that you have:
1. **Found ALL questions** - Re-scan each page to ensure no questions were missed
2. **Generated variants for EVERY question** - Count your variants vs. original questions
3. **Covered all question types** - Mathematical, theoretical, analytical, computational
4. **Included sub-questions** - Each part of multi-part questions has variants
5. **Maintained completeness** - No partial or incomplete variant generations

## Quality Standards:
- Each variant tests the **exact same concept** as the original
- Mathematical notation uses proper LaTeX formatting
- Variants have **identical difficulty level** to originals
- Parameter changes maintain mathematical validity
- Questions are suitable for general academic assignments
- All variants are complete and standalone

## Execution Instructions:
**WORK EFFICIENTLY IN 3 STEPS MAXIMUM:**
1. **Scan & Inventory** (Step 1) - Identify all questions
2. **Batch Generate** (Step 2) - Create all variants at once
3. **Output JSON** (Step 3) - Provide complete results immediately

**NO INCREMENTAL PROCESSING** - Complete the entire task and output all variants in one comprehensive JSON response.

## Final Instruction:
**GENERATE VARIANTS FOR EVERY SINGLE QUESTION YOU FIND IN ONE SHOT.** Work systematically through all content, generate all variants, and output the complete JSON array immediately. Do not provide partial results or ask for confirmation - deliver the complete set of variants in your first and only response.

Generate variants that provide assessment variety while testing identical concepts and maintaining consistent difficulty.`;
}

/**
 * Helper function to find element indices for original questions in PDF structure
 * This enables highlighting of original questions in the PDF preview
 */
export function findQuestionElementIndices(
  variants: QuestionVariant[],
  pdfStructure: any
): Array<{ variant: QuestionVariant; elementIds: string[] }> {

  return variants.map(variant => {
    const elementIds: string[] = [];

    // Search through all elements to find matches with the original question
    pdfStructure.elements?.forEach((element: any) => {
      const elementText = element.content.text.toLowerCase().trim();
      const originalText = variant.originalQuestion.toLowerCase().trim();

      // Check if this element contains part of the original question
      if (elementText.length > 5 && originalText.includes(elementText)) {
        elementIds.push(element.elementId);
      } else if (elementText.length > 5 && elementText.includes(originalText.substring(0, 20))) {
        // Also check for partial matches (first 20 chars of original question)
        elementIds.push(element.elementId);
      }
    });

    return {
      variant,
      elementIds
    };
  });
}

/**
 * Generate new coursework based on course content (not assignments)
 * This is a placeholder for future implementation
 */
export function generateNewCourseworkFromCourse(context: {
  pageContents: string[];
  specialInstructions?: string;
}): string {
  const { pageContents, specialInstructions } = context;

  return `You are an expert academic coursework generator. Your task is to create entirely new coursework based on course content.

## Course Content:
${pageContents.map((content, index) => `
### Content ${index + 1}:
${content}
`).join('\n')}

${specialInstructions ? `
## Special Instructions:
${specialInstructions}
` : ''}

[PLACEHOLDER - This prompt will be implemented when new coursework generation is needed]

## Output Format:
Return a JSON array of new questions.

Note: This prompt is currently a placeholder and will be fully implemented in a future update.`;
}

/**
 * Utility function to validate generated question variants
 */
export function validateQuestionVariants(variants: any[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(variants)) {
    errors.push('Variants must be an array');
    return { isValid: false, errors };
  }

  if (variants.length === 0) {
    errors.push('At least one variant is required');
  }

  variants.forEach((variant: any, index: number) => {
    if (!variant.id || typeof variant.id !== 'string') {
      errors.push(`Variant ${index + 1} is missing or has invalid id`);
    }

    if (!variant.questionId || typeof variant.questionId !== 'string') {
      errors.push(`Variant ${index + 1} is missing or has invalid questionId`);
    }

    if (!variant.variantQuestion || typeof variant.variantQuestion !== 'string') {
      errors.push(`Variant ${index + 1} is missing or has invalid variantQuestion`);
    }

    if (variant.difficulty !== 'same') {
      errors.push(`Variant ${index + 1} must have difficulty 'same' (variants should maintain original difficulty)`);
    }

    if (!['rephrase', 'parameter_change', 'context_change', 'approach_change'].includes(variant.variantType)) {
      errors.push(`Variant ${index + 1} has invalid variantType (must be: rephrase, parameter_change, context_change, approach_change)`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}
