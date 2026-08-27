/**
 * CloudVPN+ Form Validation Module
 * Standard HTTP-compatible, pure Vanilla JavaScript module for input sanitization,
 * RFC-compliant email checking, password complexity, and live DOM feedback.
 */

class FormValidator {
  /**
   * Validates email address format
   * @param {string} email - The email string to validate
   * @returns {{isValid: boolean, message: string}} Result object
   */
  static validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { isValid: false, message: 'Email address is required.' };
    }
    const cleanEmail = email.trim();
    if (cleanEmail.length === 0) {
      return { isValid: false, message: 'Email address cannot be blank.' };
    }
    // RFC 5322 standard compliant regular expression
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    
    if (!emailRegex.test(cleanEmail)) {
      return { isValid: false, message: 'Please enter a valid email (e.g. name@domain.com).' };
    }
    if (cleanEmail.length > 254) {
      return { isValid: false, message: 'Email address exceeds maximum allowed length.' };
    }
    return { isValid: true, message: 'Valid email address.' };
  }

  /**
   * Validates password strength and constraints
   * @param {string} password - The raw password string
   * @returns {{isValid: boolean, message: string, score: number}} Result object
   */
  static validatePassword(password) {
    if (!password || typeof password !== 'string') {
      return { isValid: false, message: 'Password is required.', score: 0 };
    }
    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long.', score: 1 };
    }
    if (password.length > 128) {
      return { isValid: false, message: 'Password is too long (max 128 characters).', score: 1 };
    }

    let score = 0;
    const hasLetters = /[a-zA-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);

    if (hasLetters) score += 1;
    if (hasNumbers) score += 1;
    if (hasSpecial) score += 1;
    if (password.length >= 10) score += 1;

    if (!hasLetters || !hasNumbers) {
      return { 
        isValid: false, 
        message: 'Password must contain both letters and numbers.', 
        score: Math.min(score, 2) 
      };
    }

    return { 
      isValid: true, 
      message: score >= 3 ? 'Strong password.' : 'Acceptable password.', 
      score: score 
    };
  }

  /**
   * Validates if the confirmation password matches the primary password
   * @param {string} password - The primary password
   * @param {string} reenterPassword - The re-entered password
   * @returns {{isValid: boolean, message: string}} Result object
   */
  static validatePasswordMatch(password, reenterPassword) {
    if (!reenterPassword || typeof reenterPassword !== 'string') {
      return { isValid: false, message: 'Please re-enter your password.' };
    }
    if (password !== reenterPassword) {
      return { isValid: false, message: 'Passwords do not match.' };
    }
    return { isValid: true, message: 'Passwords match perfectly.' };
  }

  /**
   * Applies visual state and feedback text to an input element
   * @param {HTMLInputElement} inputEl - Target input element
   * @param {HTMLElement} feedbackEl - Target feedback label element
   * @param {boolean} isValid - Validity state
   * @param {string} message - Message to display
   */
  static applyFieldStatus(inputEl, feedbackEl, isValid, message) {
    if (!inputEl) return;
    
    if (isValid) {
      inputEl.classList.remove('is-invalid');
      inputEl.classList.add('is-valid');
      if (feedbackEl) {
        feedbackEl.className = 'field-feedback success';
        feedbackEl.textContent = '✓ ' + message;
      }
    } else {
      inputEl.classList.remove('is-valid');
      inputEl.classList.add('is-invalid');
      if (feedbackEl) {
        feedbackEl.className = 'field-feedback error';
        feedbackEl.textContent = '⚠ ' + message;
      }
    }
  }

  /**
   * Clears validity classes and feedback text from an input
   * @param {HTMLInputElement} inputEl 
   * @param {HTMLElement} feedbackEl 
   */
  static clearFieldStatus(inputEl, feedbackEl) {
    if (inputEl) {
      inputEl.classList.remove('is-valid', 'is-invalid');
    }
    if (feedbackEl) {
      feedbackEl.className = 'field-feedback empty';
      feedbackEl.textContent = '';
    }
  }
}

// Attach to window object for global HTTP script accessibility
window.FormValidator = FormValidator;
