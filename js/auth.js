/**
 * CloudVPN+ Authentication Controller
 * Handles Signup and Login page workflows, live validation binding,
 * credential submission, and the global login_succ() callback.
 */

// Global login success handler required by specifications
window.login_succ = function(userData) {
  console.log('[CloudVPN+] login_succ() invoked successfully with payload:', userData);

  const alertBanner = document.getElementById('alertBanner');
  if (alertBanner) {
    alertBanner.className = 'alert-banner success';
    alertBanner.textContent = '✓ Login verified successfully! Redirecting to CloudVPN+ Recharge...';
    alertBanner.style.display = 'flex';
  }

  // Persist session flag if user data provided
  if (userData && userData.user) {
    window.CloudVPNAPI.setSession(userData.token || 'auth_token_active', userData.user);
  } else if (!window.CloudVPNAPI.getCurrentUser()) {
    window.CloudVPNAPI.setSession('auth_token_active', { email: 'user@cloudvpn.plus', role: 'member' });
  }

  // Redirect to the Recharge page after a brief smooth delay
  setTimeout(() => {
    window.location.href = 'recharge.html';
  }, 800);
};

document.addEventListener('DOMContentLoaded', () => {
  // Determine if we are on Signup or Login page
  const signupForm = document.getElementById('signupForm');
  const loginForm = document.getElementById('loginForm');

  // Password visibility toggle buttons
  const toggleButtons = document.querySelectorAll('.toggle-password-btn');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.textContent = isPassword ? 'Hide' : 'Show';
      }
    });
  });

  /* ==========================================================================
     Signup Page Flow
     ========================================================================== */
  if (signupForm) {
    const emailInput = document.getElementById('signupEmail');
    const emailFeedback = document.getElementById('signupEmailFeedback');

    const passwordInput = document.getElementById('signupPassword');
    const passwordFeedback = document.getElementById('signupPasswordFeedback');

    const reenterPasswordInput = document.getElementById('signupReenterPassword');
    const reenterPasswordFeedback = document.getElementById('signupReenterPasswordFeedback');

    const submitBtn = document.getElementById('signupSubmitBtn');
    const alertBanner = document.getElementById('alertBanner');

    // Live Email Validation
    emailInput.addEventListener('input', () => {
      const result = window.FormValidator.validateEmail(emailInput.value);
      if (emailInput.value.length > 0) {
        window.FormValidator.applyFieldStatus(emailInput, emailFeedback, result.isValid, result.message);
      } else {
        window.FormValidator.clearFieldStatus(emailInput, emailFeedback);
      }
    });

    // Live Password Validation
    passwordInput.addEventListener('input', () => {
      const result = window.FormValidator.validatePassword(passwordInput.value);
      if (passwordInput.value.length > 0) {
        window.FormValidator.applyFieldStatus(passwordInput, passwordFeedback, result.isValid, result.message);
      } else {
        window.FormValidator.clearFieldStatus(passwordInput, passwordFeedback);
      }

      // Also re-validate match if re-enter has content
      if (reenterPasswordInput.value.length > 0) {
        const matchResult = window.FormValidator.validatePasswordMatch(passwordInput.value, reenterPasswordInput.value);
        window.FormValidator.applyFieldStatus(reenterPasswordInput, reenterPasswordFeedback, matchResult.isValid, matchResult.message);
      }
    });

    // Live Re-enter Password Validation
    reenterPasswordInput.addEventListener('input', () => {
      if (reenterPasswordInput.value.length > 0) {
        const matchResult = window.FormValidator.validatePasswordMatch(passwordInput.value, reenterPasswordInput.value);
        window.FormValidator.applyFieldStatus(reenterPasswordInput, reenterPasswordFeedback, matchResult.isValid, matchResult.message);
      } else {
        window.FormValidator.clearFieldStatus(reenterPasswordInput, reenterPasswordFeedback);
      }
    });

    // Signup Form Submission
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const emailVal = emailInput.value.trim();
      const passVal = passwordInput.value;
      const reenterVal = reenterPasswordInput.value;

      const emailRes = window.FormValidator.validateEmail(emailVal);
      const passRes = window.FormValidator.validatePassword(passVal);
      const matchRes = window.FormValidator.validatePasswordMatch(passVal, reenterVal);

      window.FormValidator.applyFieldStatus(emailInput, emailFeedback, emailRes.isValid, emailRes.message);
      window.FormValidator.applyFieldStatus(passwordInput, passwordFeedback, passRes.isValid, passRes.message);
      window.FormValidator.applyFieldStatus(reenterPasswordInput, reenterPasswordFeedback, matchRes.isValid, matchRes.message);

      if (!emailRes.isValid || !passRes.isValid || !matchRes.isValid) {
        alertBanner.className = 'alert-banner error';
        alertBanner.textContent = '⚠ Please fix the errors highlighted above.';
        alertBanner.style.display = 'flex';
        return;
      }

      // Disable button during submission
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating Account...';
      alertBanner.style.display = 'none';

      try {
        const response = await window.CloudVPNAPI.signup({
          email: emailVal,
          password: passVal
        });

        alertBanner.className = 'alert-banner success';
        alertBanner.textContent = '✓ ' + (response.message || 'Account successfully created!');
        alertBanner.style.display = 'flex';

        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1200);
      } catch (err) {
        alertBanner.className = 'alert-banner error';
        alertBanner.textContent = '⚠ ' + (err.message || 'Signup failed. Please try again.');
        alertBanner.style.display = 'flex';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create CloudVPN+ Account';
      }
    });
  }

  /* ==========================================================================
     Login Page Flow
     ========================================================================== */
  if (loginForm) {
    const emailInput = document.getElementById('loginEmail');
    const emailFeedback = document.getElementById('loginEmailFeedback');

    const passwordInput = document.getElementById('loginPassword');
    const passwordFeedback = document.getElementById('loginPasswordFeedback');

    const submitBtn = document.getElementById('loginSubmitBtn');
    const alertBanner = document.getElementById('alertBanner');

    // Live Email Validation
    emailInput.addEventListener('input', () => {
      const result = window.FormValidator.validateEmail(emailInput.value);
      if (emailInput.value.length > 0) {
        window.FormValidator.applyFieldStatus(emailInput, emailFeedback, result.isValid, result.message);
      } else {
        window.FormValidator.clearFieldStatus(emailInput, emailFeedback);
      }
    });

    // Password input event
    passwordInput.addEventListener('input', () => {
      if (passwordInput.value.length > 0) {
        window.FormValidator.applyFieldStatus(passwordInput, passwordFeedback, true, 'Password entered.');
      } else {
        window.FormValidator.clearFieldStatus(passwordInput, passwordFeedback);
      }
    });

    // Login Form Submission
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const emailVal = emailInput.value.trim();
      const passVal = passwordInput.value;

      const emailRes = window.FormValidator.validateEmail(emailVal);
      if (!emailRes.isValid) {
        window.FormValidator.applyFieldStatus(emailInput, emailFeedback, false, emailRes.message);
        alertBanner.className = 'alert-banner error';
        alertBanner.textContent = '⚠ ' + emailRes.message;
        alertBanner.style.display = 'flex';
        return;
      }

      if (!passVal) {
        window.FormValidator.applyFieldStatus(passwordInput, passwordFeedback, false, 'Password is required.');
        alertBanner.className = 'alert-banner error';
        alertBanner.textContent = '⚠ Please enter your password.';
        alertBanner.style.display = 'flex';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating...';
      alertBanner.style.display = 'none';

      try {
        const response = await window.CloudVPNAPI.login({
          email: emailVal,
          password: passVal
        });

        // Trigger specified login_succ callback on success
        window.login_succ(response);
      } catch (err) {
        alertBanner.className = 'alert-banner error';
        alertBanner.textContent = '⚠ ' + (err.message || 'Login failed. Please check credentials.');
        alertBanner.style.display = 'flex';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to CloudVPN+';
      }
    });
  }
});
