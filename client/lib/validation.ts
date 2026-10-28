export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_QUESTION_LENGTH = 1000;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that a file is a PDF and does not exceed the max size.
 * Pure function — no side effects.
 */
export function validatePdfFile(file: File): ValidationResult {
  if (file.type !== "application/pdf") {
    return { valid: false, error: "Only PDF files are accepted." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: "File exceeds the maximum allowed size of 10 MB.",
    };
  }
  return { valid: true };
}

/**
 * Validates that a question is non-empty (after trimming) and within the
 * character limit. Pure function — no side effects.
 */
export function validateQuestion(question: string): ValidationResult {
  if (question.trim().length === 0) {
    return { valid: false, error: "Please enter a question." };
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return {
      valid: false,
      error: `Question must be at most ${MAX_QUESTION_LENGTH} characters.`,
    };
  }
  return { valid: true };
}
