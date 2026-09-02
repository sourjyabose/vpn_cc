/**
 * CloudVPN+ Admin Authentication Module
 * Manages admin login form validation, credential verification with ccserver.py,
 * session storage persistence, and authentication guards.
 */

(function (global) {
    'use strict';

    const AdminAuth = {
        STORAGE_KEY: 'cloudvpn_admin_session',

        /**
         * Validates admin identity input.
         * Valid if input is exactly "root" (case-insensitive or exact) OR matches email format.
         * @param {string} input 
         * @returns {{isValid: boolean, message: string}}
         */
        validateAdminIdentity: function (input) {
            if (!input || typeof input !== 'string') {
                return { isValid: false, message: 'Admin username or email is required.' };
            }
            const trimmed = input.trim();
            if (trimmed.toLowerCase() === 'root') {
                return { isValid: true, message: '' };
            }

            // Standard RFC 5322 compliant email regex pattern
            const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
            
            if (emailRegex.test(trimmed)) {
                return { isValid: true, message: '' };
            }

            return { 
                isValid: false, 
                message: 'Please enter a valid email address (e.g. admin@cloudvpn.com) or "root".' 
            };
        },

        /**
         * Validates password presence.
         * @param {string} password 
         * @returns {{isValid: boolean, message: string}}
         */
        validatePassword: function (password) {
            if (!password || password.length === 0) {
                return { isValid: false, message: 'Password cannot be empty.' };
            }
            return { isValid: true, message: '' };
        },

        /**
         * Retrieves active session from sessionStorage.
         * @returns {{email: string, password: string, loggedInAt: string}|null}
         */
        getSession: function () {
            try {
                const raw = sessionStorage.getItem(this.STORAGE_KEY);
                if (!raw) return null;
                const session = JSON.parse(raw);
                if (session && session.email && session.password) {
                    return session;
                }
            } catch (e) {
                console.error('Failed to parse admin session', e);
            }
            return null;
        },

        /**
         * Saves active session to sessionStorage.
         * @param {string} email 
         * @param {string} password 
         */
        saveSession: function (email, password) {
            const session = {
                email: email.trim(),
                password: password,
                loggedInAt: new Date().toISOString()
            };
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
        },

        /**
         * Clears active admin session.
         */
        clearSession: function () {
            sessionStorage.removeItem(this.STORAGE_KEY);
        },

        /**
         * Verifies credentials against ccserver.py and saves session on success.
         * @param {string} identity Admin email or 'root'
         * @param {string} password Admin password
         * @returns {Promise<{success: boolean, message?: string}>}
         */
        login: async function (identity, password) {
            const idCheck = this.validateAdminIdentity(identity);
            if (!idCheck.isValid) {
                return { success: false, message: idCheck.message };
            }

            const pwCheck = this.validatePassword(password);
            if (!pwCheck.isValid) {
                return { success: false, message: pwCheck.message };
            }

            const emailParam = identity.trim();

            try {
                if (typeof CloudVPNApi === 'undefined') {
                    throw new Error('CloudVPNApi module is not loaded.');
                }

                const response = await CloudVPNApi.verifyLogin(emailParam, password);

                if (response && response.status === 'success') {
                    this.saveSession(emailParam, password);
                    return { success: true };
                } else {
                    return { 
                        success: false, 
                        message: response.message || 'Authentication failed. Please verify your credentials.' 
                    };
                }
            } catch (err) {
                return { 
                    success: false, 
                    message: err.message || 'Unable to connect to CloudVPN+ backend server.' 
                };
            }
        },

        /**
         * Logs out current admin and redirects to login page.
         */
        logout: function () {
            this.clearSession();
            window.location.href = 'admin_login.html';
        },

        /**
         * Route guard: redirects to admin_login.html if session is missing.
         * @returns {{email: string, password: string}|null}
         */
        requireAuth: function () {
            const session = this.getSession();
            if (!session) {
                window.location.href = 'admin_login.html';
                return null;
            }
            return session;
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AdminAuth;
    } else {
        global.AdminAuth = AdminAuth;
    }
})(typeof window !== 'undefined' ? window : globalThis);
