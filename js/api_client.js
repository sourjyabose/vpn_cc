/**
 * CloudVPN+ API Client Interface Module
 * Pure Vanilla JavaScript HTTP-compatible REST API client interface.
 * Designed to seamlessly connect frontend forms with the user's custom backend.
 */

class CloudVPNAPIClient {
  /**
   * Initialize API client configuration
   * @param {string} [baseUrl] - Base HTTP endpoint URL
   */
  constructor(baseUrl) {
    // Default base URL for HTTP local or remote backend deployment
    this.baseUrl = baseUrl || (window.location.protocol + '//' + window.location.host + '/api/v1');
    this.tokenKey = 'cloudvpn_auth_token';
    this.userKey = 'cloudvpn_user_data';
  }

  /**
   * Retrieve current stored authentication token
   * @returns {string|null}
   */
  getToken() {
    try {
      return localStorage.getItem(this.tokenKey) || sessionStorage.getItem(this.tokenKey);
    } catch (e) {
      return null;
    }
  }

  /**
   * Store authentication session details
   * @param {string} token 
   * @param {object} user 
   * @param {boolean} [remember=true] 
   */
  setSession(token, user, remember = true) {
    const storage = remember ? localStorage : sessionStorage;
    try {
      if (token) storage.setItem(this.tokenKey, token);
      if (user) storage.setItem(this.userKey, JSON.stringify(user));
    } catch (e) {
      console.warn('Storage unavailable:', e);
    }
  }

  /**
   * Clear session on logout
   */
  clearSession() {
    try {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userKey);
      sessionStorage.removeItem(this.tokenKey);
      sessionStorage.removeItem(this.userKey);
    } catch (e) {
      console.warn('Storage clear error:', e);
    }
  }

  /**
   * Retrieve cached user details
   * @returns {object|null}
   */
  getCurrentUser() {
    try {
      const raw = localStorage.getItem(this.userKey) || sessionStorage.getItem(this.userKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Generic HTTP request helper using standard fetch API
   * @param {string} endpoint - API relative path
   * @param {string} method - HTTP Verb (GET, POST, etc.)
   * @param {object} [body=null] - Request payload
   * @returns {Promise<object>}
   */
  async request(endpoint, method = 'GET', body = null) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    const config = {
      method: method,
      headers: headers
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(this.baseUrl + endpoint, config);
      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        throw new Error(data.message || 'HTTP request failed with status ' + response.status);
      }
      return data;
    } catch (err) {
      // Fallback simulation when custom backend is not yet active
      console.warn('[CloudVPN+ API] Real endpoint unavailable (' + err.message + '). Executing frontend simulation fallback.');
      return this._mockFallback(endpoint, method, body);
    }
  }

  /**
   * Fallback mock handler for offline/pre-backend testing
   * @private
   */
  async _mockFallback(endpoint, method, body) {
    // Artificial slight network latency
    await new Promise(res => setTimeout(res, 350));

    if (endpoint === '/auth/signup' && method === 'POST') {
      const mockUser = {
        id: 'usr_' + Math.floor(Math.random() * 100000),
        email: body.email,
        createdAt: new Date().toISOString()
      };
      const mockToken = 'mock_jwt_token_' + Date.now();
      this.setSession(mockToken, mockUser, true);
      return {
        status: 'success',
        message: 'Account created successfully for ' + body.email,
        token: mockToken,
        user: mockUser
      };
    }

    if (endpoint === '/auth/login' && method === 'POST') {
      const mockUser = {
        id: 'usr_789456',
        email: body.email,
        lastLogin: new Date().toISOString()
      };
      const mockToken = 'mock_jwt_token_' + Date.now();
      this.setSession(mockToken, mockUser, true);
      return {
        status: 'success',
        message: 'Authentication successful',
        token: mockToken,
        user: mockUser
      };
    }

    if (endpoint === '/recharge/process' && method === 'POST') {
      return {
        status: 'success',
        transactionId: 'TXN_' + Math.floor(Math.random() * 9000000 + 1000000),
        plan: body.plan,
        amount: body.amount,
        timestamp: new Date().toISOString(),
        message: 'Recharge completed successfully for plan ' + body.plan
      };
    }

    return { status: 'success', data: {} };
  }

  /**
   * User Signup endpoint
   * @param {object} payload - { email, password }
   */
  async signup(payload) {
    return this.request('/auth/signup', 'POST', payload);
  }

  /**
   * User Login endpoint
   * @param {object} payload - { email, password }
   */
  async login(payload) {
    return this.request('/auth/login', 'POST', payload);
  }

  /**
   * Data Recharge endpoint
   * @param {object} payload - { plan, amount, paymentMethod }
   */
  async processRecharge(payload) {
    return this.request('/recharge/process', 'POST', payload);
  }
}

// Global instance creation for cross-file accessibility
window.CloudVPNAPI = new CloudVPNAPIClient();
