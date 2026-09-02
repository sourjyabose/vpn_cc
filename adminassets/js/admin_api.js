/**
 * CloudVPN+ Admin API Client
 * Core communication layer for interacting with ccserver.py backend.
 * Provides nonce retrieval, authentication hashing, and route wrappers.
 * Fully compatible with plain HTTP environments.
 */

(function (global) {
    'use strict';

    const CloudVPNApi = {
        /**
         * Extracts and returns the Base URL from the current browser window location.
         * Allows user override if custom base URL is stored in sessionStorage.
         * @returns {string} Base URL (e.g., http://localhost:8000)
         */
        getBaseUrl: function () {
            if (typeof window === 'undefined') return 'http://localhost:8000';
            
            const customUrl = sessionStorage.getItem('cloudvpn_custom_base_url');
            if (customUrl && customUrl.trim() !== '') {
                return customUrl.trim().replace(/\/+$/, '');
            }

            // Parse location origin or construct from protocol + host
            let origin = window.location.origin;
            if (!origin || origin === 'null' || origin.startsWith('file:')) {
                // Fallback for local files or older browsers
                origin = window.location.protocol && window.location.host 
                    ? `${window.location.protocol}//${window.location.host}` 
                    : 'http://localhost:8000';
            }
            return origin.replace(/\/+$/, '');
        },

        /**
         * Sets a custom Base URL in sessionStorage.
         * @param {string} url 
         */
        setCustomBaseUrl: function (url) {
            if (url && url.trim() !== '') {
                sessionStorage.setItem('cloudvpn_custom_base_url', url.trim().replace(/\/+$/, ''));
            } else {
                sessionStorage.removeItem('cloudvpn_custom_base_url');
            }
        },

        /**
         * Retrieves the latest administrative nonce for a given admin email from ccserver.py.
         * Sends GET request with JSON body {"UEmail": email} using XMLHttpRequest.
         * @param {string} email 
         * @returns {Promise<number>} Nonce value
         */
        getAdminNonce: function (email) {
            const self = this;
            return new Promise((resolve, reject) => {
                const baseUrl = self.getBaseUrl();
                const endpoint = `${baseUrl}/admin/nonce`;

                const xhr = new XMLHttpRequest();
                xhr.open('POST', endpoint, true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.setRequestHeader('Accept', 'application/json');

                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const response = JSON.parse(xhr.responseText);
                                if (response && typeof response.nonce !== 'undefined') {
                                    resolve(Number(response.nonce));
                                } else {
                                    reject(new Error(response.message || 'Nonce not found in server response.'));
                                }
                            } catch (err) {
                                reject(new Error('Invalid JSON response while requesting admin nonce.'));
                            }
                        } else if (xhr.status === 0) {
                            reject(new Error('Unable to connect to CloudVPN+ server at ' + baseUrl + '. Please check if ccserver.py is running.'));
                        } else {
                            reject(new Error(`Server returned HTTP ${xhr.status}: ${xhr.statusText || 'Error retrieving nonce'}`));
                        }
                    }
                };

                xhr.onerror = function () {
                    reject(new Error('Network error occurred while contacting ' + endpoint));
                };

                // Send JSON payload with UEmail parameter as required by ccserver.py
                xhr.send(JSON.stringify({ "UEmail": email }));
            });
        },

        /**
         * Encodes password with current admin nonce using SHA-256.
         * Translates python:
         * def encodeNonce(email,value):
         *     nonce=requests.get(url+"/admin/nonce",json={"UEmail":email}).json()["nonce"]
         *     return hashlib.sha256((value+str(nonce)).encode("utf-8")).hexdigest()
         * 
         * @param {string} email 
         * @param {string} actualPassword 
         * @returns {Promise<string>} Hexadecimal SHA-256 string
         */
        encodeNonce: async function (email, actualPassword) {
            const nonce = await this.getAdminNonce(email);
            if (typeof sha256 !== 'function') {
                throw new Error('sha256 hashing library is not loaded.');
            }
            return sha256(actualPassword + String(nonce));
        },

        /**
         * Performs an administrative GET request to ccserver.py.
         * Automatically fetches fresh nonce and generates hashed password token.
         * @param {string} routeTemplate Function that takes (email, encodedPasswd) and returns full URL
         * @param {string} adminEmail 
         * @param {string} adminPassword 
         * @returns {Promise<object>} JSON response data
         */
        adminGetRequest: async function (routeTemplate, adminEmail, adminPassword) {
            const hashedPasswd = await this.encodeNonce(adminEmail, adminPassword);
            const url = routeTemplate(adminEmail, hashedPasswd);

            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.setRequestHeader('Accept', 'application/json');

                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const json = JSON.parse(xhr.responseText);
                                resolve(json);
                            } catch (e) {
                                resolve({ status: 'success', raw: xhr.responseText });
                            }
                        } else if (xhr.status === 0) {
                            reject(new Error('Network connection failed. Verify server status.'));
                        } else {
                            try {
                                const errJson = JSON.parse(xhr.responseText);
                                reject(new Error(errJson.message || `HTTP ${xhr.status} Error`));
                            } catch (e) {
                                reject(new Error(`HTTP ${xhr.status} Error`));
                            }
                        }
                    }
                };

                xhr.onerror = function () {
                    reject(new Error('Network error while executing request to ' + url));
                };

                xhr.send();
            });
        },

        /* ==================== ADMINISTRATIVE ROUTE IMPLEMENTATIONS ==================== */

        /**
         * Verifies admin credentials via /adminPanel/loginVerification/{email}/{passwd}/
         * @param {string} email 
         * @param {string} password 
         * @returns {Promise<{status: string, message?: string}>}
         */
        verifyLogin: async function (email, password) {
            const baseUrl = this.getBaseUrl();
            return this.adminGetRequest(
                (em, pw) => `${baseUrl}/adminPanel/loginVerification/${encodeURIComponent(em)}/${pw}/`,
                email,
                password
            );
        },

        /**
         * Queries all registered routing server names via /adminPanel/serverquery/{email}/{passwd}/
         * @param {string} email 
         * @param {string} password 
         * @returns {Promise<{status: string, serverlist?: string[], message?: string}>}
         */
        fetchServers: async function (email, password) {
            const baseUrl = this.getBaseUrl();
            return this.adminGetRequest(
                (em, pw) => `${baseUrl}/adminPanel/serverquery/${encodeURIComponent(em)}/${pw}/`,
                email,
                password
            );
        },

        /**
         * Registers a new server via /adminPanel/registerServer/{email}/{passwd}/{servername}/{serverkey}
         * @param {string} email 
         * @param {string} password 
         * @param {string} serverName 
         * @param {string} serverKey 
         * @returns {Promise<{status: string, message?: string}>}
         */
        registerServer: async function (email, password, serverName, serverKey) {
            const baseUrl = this.getBaseUrl();
            return this.adminGetRequest(
                (em, pw) => `${baseUrl}/adminPanel/registerServer/${encodeURIComponent(em)}/${pw}/${encodeURIComponent(serverName)}/${encodeURIComponent(serverKey)}`,
                email,
                password
            );
        },

        /**
         * Removes a server from registry via /adminPanel/removeServer/{email}/{passwd}/{servername}
         * @param {string} email 
         * @param {string} password 
         * @param {string} serverName 
         * @returns {Promise<{status: string, message?: string}>}
         */
        removeServer: async function (email, password, serverName) {
            const baseUrl = this.getBaseUrl();
            return this.adminGetRequest(
                (em, pw) => `${baseUrl}/adminPanel/removeServer/${encodeURIComponent(em)}/${pw}/${encodeURIComponent(serverName)}`,
                email,
                password
            );
        },

        /**
         * Fetches paginated list of users via /adminPanel/listusers/{email}/{passwd}/{startingRange}/{endingRange}
         * @param {string} email 
         * @param {string} password 
         * @param {number} startingRange 
         * @param {number} endingRange 
         * @returns {Promise<{status: string, data?: object, message?: string}>}
         */
        listUsers: async function (email, password, startingRange, endingRange) {
            const baseUrl = this.getBaseUrl();
            return this.adminGetRequest(
                (em, pw) => `${baseUrl}/adminPanel/listusers/${encodeURIComponent(em)}/${pw}/${startingRange}/${endingRange}`,
                email,
                password
            );
        },

        /**
         * Queries detailed single user data via /adminPanel/query/{email}/{passwd}/{userEmail}
         * @param {string} email 
         * @param {string} password 
         * @param {string} userEmail 
         * @returns {Promise<{status: string, data?: object, message?: string}>}
         */
        queryUser: async function (email, password, userEmail) {
            const baseUrl = this.getBaseUrl();
            return this.adminGetRequest(
                (em, pw) => `${baseUrl}/adminPanel/query/${encodeURIComponent(em)}/${pw}/${encodeURIComponent(userEmail)}`,
                email,
                password
            );
        },

        /**
         * Blocks a user account via /adminPanel/blockUser/{email}/{passwd}/{userEmail}
         * @param {string} email 
         * @param {string} password 
         * @param {string} userEmail 
         * @returns {Promise<{status: string, message?: string}>}
         */
        blockUser: async function (email, password, userEmail) {
            const baseUrl = this.getBaseUrl();
            return this.adminGetRequest(
                (em, pw) => `${baseUrl}/adminPanel/blockUser/${encodeURIComponent(em)}/${pw}/${encodeURIComponent(userEmail)}`,
                email,
                password
            );
        },

        /**
         * Unblocks a user account via /adminPanel/unblockUser/{email}/{passwd}/{userEmail}
         * @param {string} email 
         * @param {string} password 
         * @param {string} userEmail 
         * @returns {Promise<{status: string, message?: string}>}
         */
        unblockUser: async function (email, password, userEmail) {
            const baseUrl = this.getBaseUrl();
            return this.adminGetRequest(
                (em, pw) => `${baseUrl}/adminPanel/unblockUser/${encodeURIComponent(em)}/${pw}/${encodeURIComponent(userEmail)}`,
                email,
                password
            );
        },

        /**
         * Deletes a user account via /adminPanel/deleteUser/{email}/{passwd}/{userEmail}
         * @param {string} email 
         * @param {string} password 
         * @param {string} userEmail 
         * @returns {Promise<{status: string, message?: string}>}
         */
        deleteUser: async function (email, password, userEmail) {
            const baseUrl = this.getBaseUrl();
            return this.adminGetRequest(
                (em, pw) => `${baseUrl}/adminPanel/deleteUser/${encodeURIComponent(em)}/${pw}/${encodeURIComponent(userEmail)}`,
                email,
                password
            );
        },

        /**
         * Changes a user email address via /adminPanel/changeUserEmail/{email}/{passwd}/{userEmail}/{newUserEmail}
         * @param {string} email 
         * @param {string} password 
         * @param {string} userEmail 
         * @param {string} newUserEmail 
         * @returns {Promise<{status: string, message?: string}>}
         */
        changeUserEmail: async function (email, password, userEmail, newUserEmail) {
            const baseUrl = this.getBaseUrl();
            return this.adminGetRequest(
                (em, pw) => `${baseUrl}/adminPanel/changeUserEmail/${encodeURIComponent(em)}/${pw}/${encodeURIComponent(userEmail)}/${encodeURIComponent(newUserEmail)}`,
                email,
                password
            );
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CloudVPNApi;
    } else {
        global.CloudVPNApi = CloudVPNApi;
    }
})(typeof window !== 'undefined' ? window : globalThis);
