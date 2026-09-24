export interface ValidationErrorItem {
  fieldId: string;
  fieldName: string;
  message: string;
  element?: HTMLElement | null;
}

/**
 * Focuses and scrolls an element into view smoothly.
 */
export function focusAndScrollErrorField(element?: HTMLElement | null): boolean {
  if (!element) return false;
  try {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.focus();
    // Add brief highlight animation class if supported
    element.classList.add('ring-2', 'ring-red-500', 'transition-all');
    setTimeout(() => {
      element.classList.remove('ring-2', 'ring-red-500');
    }, 2000);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Formats user-friendly error messages, avoiding database or programming jargon.
 */
export function formatUserFriendlyError(rawError: string): string {
  if (!rawError) return 'Please check this field.';
  const lower = rawError.toLowerCase();

  if (lower.includes('null constraint') || lower.includes('violates not-null')) {
    return 'Please fill in this required field.';
  }
  if (lower.includes('pgrst303') || lower.includes('jwt') || lower.includes('auth')) {
    return 'Your session needs to reconnect. Your work is still here.';
  }
  if (lower.includes('uuid') || lower.includes('invalid input syntax for type uuid')) {
    return "We couldn't recognize that record. Please check your selection.";
  }
  if (lower.includes('duplicate key') || lower.includes('already exists')) {
    return 'This record already exists in the system.';
  }
  if (lower.includes('foreign key')) {
    return 'Selected reference could not be found. Please re-select.';
  }

  return rawError;
}
