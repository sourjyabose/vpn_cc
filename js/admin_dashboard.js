/**
 * CloudVPN+ Admin Dashboard Controller
 * Handles UI interactions, data fetching, tab switching, modals, user pagination,
 * server fleet management, and live diagnostics.
 */

(function () {
    'use strict';

    let currentSession = null;
    let currentTab = 'overview';
    let userPageStart = 0;
    const userPageSize = 5;

    // Cache
    let cachedServers = [];
    let cachedUsers = {};

    /**
     * Initializes the dashboard when DOM is ready.
     */
    function initDashboard() {
        // Authenticate
        currentSession = AdminAuth.requireAuth();
        if (!currentSession) return;

        // Populate admin identity in UI
        const adminEmailElem = document.getElementById('currentAdminEmail');
        if (adminEmailElem) {
            adminEmailElem.textContent = currentSession.email;
        }

        const baseUrlDisplay = document.getElementById('currentBaseUrlText');
        if (baseUrlDisplay) {
            baseUrlDisplay.textContent = CloudVPNApi.getBaseUrl();
        }

        // Setup Event Listeners
        setupTabNavigation();
        setupModals();
        setupEventListeners();

        // Initial Data Load
        refreshAllData();
    }

    /**
     * Formats bytes to human-readable string (KB, MB, GB).
     * @param {number} bytes 
     * @returns {string}
     */
    function formatBytes(bytes) {
        if (!bytes || isNaN(bytes) || bytes === 0) return '0.00 MB';
        const num = Number(bytes);
        if (num < 1024 * 1024) {
            return (num / 1024).toFixed(2) + ' KB';
        } else if (num < 1024 * 1024 * 1024) {
            return (num / (1024 * 1024)).toFixed(2) + ' MB';
        } else {
            return (num / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
        }
    }

    /**
     * Shows a toast notification on screen.
     * @param {'success'|'danger'|'warning'} type 
     * @param {string} message 
     */
    function showToast(type, message) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconSvg = '';
        if (type === 'success') {
            iconSvg = '<svg class="svg-icon" style="color: var(--primary-green);" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        } else if (type === 'danger') {
            iconSvg = '<svg class="svg-icon" style="color: var(--danger-red);" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
        } else {
            iconSvg = '<svg class="svg-icon" style="color: var(--warning-amber);" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
        }

        toast.innerHTML = `${iconSvg} <span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    /**
     * Sanitizes strings for safe HTML rendering.
     * @param {string} str 
     * @returns {string}
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Sets up sidebar tab switching.
     */
    function setupTabNavigation() {
        const tabBtns = document.querySelectorAll('[data-tab-target]');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const target = btn.getAttribute('data-tab-target');
                switchTab(target);
            });
        });
    }

    /**
     * Switches the active tab view.
     * @param {string} tabName 
     */
    function switchTab(tabName) {
        currentTab = tabName;

        // Update Buttons
        document.querySelectorAll('[data-tab-target]').forEach(btn => {
            if (btn.getAttribute('data-tab-target') === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update Panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            if (pane.id === `tab-${tabName}`) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });

        // Tab-specific loads
        if (tabName === 'users') {
            loadUsersTable();
        } else if (tabName === 'servers') {
            loadServersView();
        } else if (tabName === 'overview') {
            refreshAllData();
        }
    }

    /**
     * Refreshes all overview stats, server list, and recent users.
     */
    async function refreshAllData() {
        try {
            await Promise.all([
                loadServersView(),
                loadOverviewStats()
            ]);
        } catch (e) {
            console.error('Error refreshing dashboard data', e);
        }
    }

    /**
     * Fetches servers and updates server table & metrics.
     */
    async function loadServersView() {
        const serverTbody = document.getElementById('serversTableBody');
        const overviewServerList = document.getElementById('overviewServersList');
        const serverCountStat = document.getElementById('statTotalServers');

        try {
            const resp = await CloudVPNApi.fetchServers(currentSession.email, currentSession.password);
            if (resp && resp.status === 'success' && Array.isArray(resp.serverlist)) {
                cachedServers = resp.serverlist;
                
                if (serverCountStat) {
                    serverCountStat.textContent = cachedServers.length;
                }

                // Render in Full Servers Table
                if (serverTbody) {
                    if (cachedServers.length === 0) {
                        serverTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-light); padding: 2rem;">No VPN routing servers registered yet. Click "Register Server" to add one.</td></tr>`;
                    } else {
                        serverTbody.innerHTML = cachedServers.map((sName, idx) => `
                            <tr>
                                <td><strong>#${idx + 1}</strong></td>
                                <td>
                                    <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(sName)}</div>
                                </td>
                                <td style="text-align: right;">
                                    <button class="btn btn-sm btn-secondary" onclick="CloudVPNDashboard.promptRemoveServer('${escapeHtml(sName)}')">
                                        <svg class="svg-icon" style="width: 1rem; height: 1rem;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        `).join('');
                    }
                }

                // Render in Overview Server Cards
                if (overviewServerList) {
                    if (cachedServers.length === 0) {
                        overviewServerList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-light); padding: 1.5rem;">No servers registered in the fleet.</div>`;
                    } else {
                        overviewServerList.innerHTML = cachedServers.map(sName => `
                            <div class="glass-panel-subtle" style="padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between;">
                                <div>
                                    <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(sName)}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-light);">Routing Node</div>
                                </div>
                                <span class="badge badge-success">Online</span>
                            </div>
                        `).join('');
                    }
                }
            } else {
                showToast('danger', resp.message || 'Failed to fetch server fleet.');
            }
        } catch (err) {
            showToast('danger', err.message);
        }
    }

    /**
     * Loads aggregated user statistics for overview cards.
     */
    async function loadOverviewStats() {
        try {
            // Query 0 to 100 to calculate statistics
            const resp = await CloudVPNApi.listUsers(currentSession.email, currentSession.password, 0, 100);
            if (resp && resp.status === 'success' && resp.data) {
                const users = resp.data;
                const userKeys = Object.keys(users);
                
                let activeCount = 0;
                let blockedCount = 0;
                let totalBytes = 0;

                userKeys.forEach(email => {
                    const u = users[email];
                    if (u.blocked === 1) {
                        blockedCount++;
                    } else {
                        activeCount++;
                    }
                    totalBytes += Number(u.bytesusedsofar || 0);
                });

                const totalUsersElem = document.getElementById('statTotalUsers');
                const activeUsersElem = document.getElementById('statActiveUsers');
                const blockedUsersElem = document.getElementById('statBlockedUsers');
                const totalBandwidthElem = document.getElementById('statTotalBandwidth');

                if (totalUsersElem) totalUsersElem.textContent = userKeys.length;
                if (activeUsersElem) activeUsersElem.textContent = activeCount;
                if (blockedUsersElem) blockedUsersElem.textContent = blockedCount;
                if (totalBandwidthElem) totalBandwidthElem.textContent = formatBytes(totalBytes);
            }
        } catch (e) {
            console.error('Failed to load overview stats', e);
        }
    }

    /**
     * Fetches and renders the paginated users table.
     */
    async function loadUsersTable() {
        const tbody = document.getElementById('usersTableBody');
        const paginationInfo = document.getElementById('userPaginationInfo');
        const prevBtn = document.getElementById('btnPrevUserPage');
        const nextBtn = document.getElementById('btnNextUserPage');

        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-light); padding: 2rem;">Loading users...</td></tr>`;

        try {
            const endRange = userPageStart + userPageSize;
            const resp = await CloudVPNApi.listUsers(currentSession.email, currentSession.password, userPageStart, endRange);

            if (resp && resp.status === 'success' && resp.data) {
                cachedUsers = resp.data;
                const userEmails = Object.keys(cachedUsers);

                if (paginationInfo) {
                    paginationInfo.textContent = `Showing range: ${userPageStart} - ${endRange} (${userEmails.length} users returned)`;
                }

                if (prevBtn) prevBtn.disabled = userPageStart === 0;
                if (nextBtn) nextBtn.disabled = userEmails.length < userPageSize;

                if (userEmails.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-light); padding: 2rem;">No users found in this range (${userPageStart} - ${endRange}).</td></tr>`;
                    return;
                }

                tbody.innerHTML = userEmails.map(uEmail => {
                    const u = cachedUsers[uEmail];
                    const isBlocked = u.blocked === 1;
                    const quotaGb = Number(u.recharge || 0);
                    const bytesUsed = Number(u.bytesusedsofar || 0);
                    const remainingGb = Math.max(0, quotaGb - (bytesUsed / (1000 * 1000 * 1000))).toFixed(2);

                    return `
                        <tr>
                            <td>
                                <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(uEmail)}</div>
                                <div style="font-size: 0.75rem; color: var(--text-light);">Nonce: ${u.nonce || 0}</div>
                            </td>
                            <td>
                                <code style="font-size: 0.8rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${escapeHtml(u.device_id || 'default')}</code>
                            </td>
                            <td>
                                <div><strong>${quotaGb} GB</strong></div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">Total Quota</div>
                            </td>
                            <td>
                                <div>${formatBytes(bytesUsed)}</div>
                                <div style="font-size: 0.75rem; color: var(--text-light);">Rem: ${remainingGb} GB</div>
                            </td>
                            <td>
                                ${isBlocked 
                                    ? '<span class="badge badge-danger">Blocked</span>' 
                                    : '<span class="badge badge-success">Active</span>'}
                            </td>
                            <td style="text-align: right;">
                                <div class="action-btn-group" style="justify-content: flex-end;">
                                    <button class="btn btn-sm btn-secondary" title="Inspect User Query" onclick="CloudVPNDashboard.inspectUser('${escapeHtml(uEmail)}')">
                                        <svg class="svg-icon" style="width: 0.95rem; height: 0.95rem;" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </button>
                                    <button class="btn btn-sm btn-secondary" title="Change Email" onclick="CloudVPNDashboard.promptChangeEmail('${escapeHtml(uEmail)}')">
                                        <svg class="svg-icon" style="width: 0.95rem; height: 0.95rem;" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    ${isBlocked 
                                        ? `<button class="btn btn-sm btn-warning" title="Unblock User" onclick="CloudVPNDashboard.toggleBlockUser('${escapeHtml(uEmail)}', false)">
                                            <svg class="svg-icon" style="width: 0.95rem; height: 0.95rem;" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
                                           </button>`
                                        : `<button class="btn btn-sm btn-secondary" title="Block User" onclick="CloudVPNDashboard.toggleBlockUser('${escapeHtml(uEmail)}', true)">
                                            <svg class="svg-icon" style="width: 0.95rem; height: 0.95rem;" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                           </button>`
                                    }
                                    <button class="btn btn-sm btn-danger" title="Delete User" onclick="CloudVPNDashboard.promptDeleteUser('${escapeHtml(uEmail)}')">
                                        <svg class="svg-icon" style="width: 0.95rem; height: 0.95rem;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            } else {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger-red); padding: 2rem;">${escapeHtml(resp.message || 'Error loading users')}</td></tr>`;
            }
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger-red); padding: 2rem;">${escapeHtml(err.message)}</td></tr>`;
        }
    }

    /**
     * Set up UI Modals.
     */
    function setupModals() {
        document.querySelectorAll('.modal-close, [data-modal-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                closeAllModals();
            });
        });

        // Close on backdrop click
        document.querySelectorAll('.modal-backdrop').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeAllModals();
                }
            });
        });
    }

    function openModal(modalId) {
        closeAllModals();
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    }

    function closeAllModals() {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
    }

    /**
     * Setup General Event Listeners.
     */
    function setupEventListeners() {
        // Logout
        const logoutBtn = document.getElementById('btnLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                AdminAuth.logout();
            });
        }

        // Pagination Buttons
        const prevBtn = document.getElementById('btnPrevUserPage');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (userPageStart >= userPageSize) {
                    userPageStart -= userPageSize;
                    loadUsersTable();
                }
            });
        }

        const nextBtn = document.getElementById('btnNextUserPage');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                userPageStart += userPageSize;
                loadUsersTable();
            });
        }

        // Base URL Config Modal
        const btnOpenBaseUrlModal = document.getElementById('btnOpenBaseUrlModal');
        if (btnOpenBaseUrlModal) {
            btnOpenBaseUrlModal.addEventListener('click', () => {
                const input = document.getElementById('customBaseUrlInput');
                if (input) input.value = CloudVPNApi.getBaseUrl();
                openModal('modalBaseUrl');
            });
        }

        const btnSaveBaseUrl = document.getElementById('btnSaveBaseUrl');
        if (btnSaveBaseUrl) {
            btnSaveBaseUrl.addEventListener('click', () => {
                const input = document.getElementById('customBaseUrlInput');
                if (input) {
                    CloudVPNApi.setCustomBaseUrl(input.value);
                    const baseUrlDisplay = document.getElementById('currentBaseUrlText');
                    if (baseUrlDisplay) baseUrlDisplay.textContent = CloudVPNApi.getBaseUrl();
                    showToast('success', 'Base URL updated to ' + CloudVPNApi.getBaseUrl());
                    closeAllModals();
                    refreshAllData();
                }
            });
        }

        // Register Server Form
        const btnOpenRegisterServer = document.getElementById('btnOpenRegisterServer');
        if (btnOpenRegisterServer) {
            btnOpenRegisterServer.addEventListener('click', () => {
                document.getElementById('regServerName').value = '';
                document.getElementById('regServerKey').value = '';
                openModal('modalRegisterServer');
            });
        }

        const formRegisterServer = document.getElementById('formRegisterServer');
        if (formRegisterServer) {
            formRegisterServer.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('regServerName').value.trim();
                const key = document.getElementById('regServerKey').value.trim();

                if (!name || !key) {
                    showToast('warning', 'Server Name and Server Key are required.');
                    return;
                }

                try {
                    const resp = await CloudVPNApi.registerServer(currentSession.email, currentSession.password, name, key);
                    if (resp && resp.status === 'success') {
                        showToast('success', `Server "${name}" registered successfully.`);
                        closeAllModals();
                        loadServersView();
                    } else {
                        showToast('danger', resp.message || 'Failed to register server.');
                    }
                } catch (err) {
                    showToast('danger', err.message);
                }
            });
        }

        // Single User Search Form
        const formSearchUser = document.getElementById('formSearchUser');
        if (formSearchUser) {
            formSearchUser.addEventListener('submit', async (e) => {
                e.preventDefault();
                const searchInput = document.getElementById('searchUserEmail').value.trim();
                if (!searchInput) {
                    showToast('warning', 'Please enter a user email to search.');
                    return;
                }
                inspectUser(searchInput);
            });
        }

        // Diagnostics Console Runner
        const btnRunDiagnostic = document.getElementById('btnRunDiagnostic');
        if (btnRunDiagnostic) {
            btnRunDiagnostic.addEventListener('click', async () => {
                const endpointType = document.getElementById('diagEndpointSelect').value;
                const paramInput = document.getElementById('diagParamInput').value.trim();
                const resultBox = document.getElementById('diagResultBox');

                resultBox.textContent = 'Executing query with fresh nonce...';

                try {
                    let res;
                    if (endpointType === 'serverquery') {
                        res = await CloudVPNApi.fetchServers(currentSession.email, currentSession.password);
                    } else if (endpointType === 'queryUser') {
                        if (!paramInput) {
                            resultBox.textContent = 'Error: userEmail parameter is required.';
                            return;
                        }
                        res = await CloudVPNApi.queryUser(currentSession.email, currentSession.password, paramInput);
                    } else if (endpointType === 'listusers') {
                        const ranges = paramInput.split(',').map(s => s.trim());
                        const start = ranges[0] || '0';
                        const end = ranges[1] || '10';
                        res = await CloudVPNApi.listUsers(currentSession.email, currentSession.password, start, end);
                    } else if (endpointType === 'nonce') {
                        const nonce = await CloudVPNApi.getAdminNonce(currentSession.email);
                        res = { status: 'success', adminEmail: currentSession.email, nonce: nonce };
                    }
                    resultBox.textContent = JSON.stringify(res, null, 2);
                } catch (err) {
                    resultBox.textContent = 'Error: ' + err.message;
                }
            });
        }
    }

    /* ==================== ACTION MODAL PROMPTS ==================== */

    /**
     * Inspects a single user via /adminPanel/query/{email}/{passwd}/{userEmail}
     * @param {string} userEmail 
     */
    async function inspectUser(userEmail) {
        try {
            const resp = await CloudVPNApi.queryUser(currentSession.email, currentSession.password, userEmail);
            if (resp && resp.status === 'success' && resp.data) {
                const u = resp.data;
                const quotaGb = Number(u.recharge || 0);
                const bytesUsed = Number(u.bytesusedsofar || 0);
                const remainingGb = Math.max(0, quotaGb - (bytesUsed / (1000 * 1000 * 1000))).toFixed(2);

                document.getElementById('inspectUserEmailTitle').textContent = userEmail;
                document.getElementById('inspectUserBody').innerHTML = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                        <div class="glass-panel-subtle" style="padding: 1rem;">
                            <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase;">Device ID</div>
                            <div style="font-weight: 600; margin-top: 0.25rem;">${escapeHtml(u.device_id || 'default')}</div>
                        </div>
                        <div class="glass-panel-subtle" style="padding: 1rem;">
                            <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase;">Status</div>
                            <div style="margin-top: 0.25rem;">
                                ${u.blocked === 1 
                                    ? '<span class="badge badge-danger">Blocked</span>' 
                                    : '<span class="badge badge-success">Active</span>'}
                            </div>
                        </div>
                        <div class="glass-panel-subtle" style="padding: 1rem;">
                            <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase;">Total Recharge Quota</div>
                            <div style="font-size: 1.25rem; font-weight: 700; margin-top: 0.25rem;">${quotaGb} GB</div>
                        </div>
                        <div class="glass-panel-subtle" style="padding: 1rem;">
                            <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase;">Bandwidth Used</div>
                            <div style="font-size: 1.25rem; font-weight: 700; margin-top: 0.25rem;">${formatBytes(bytesUsed)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-light);">Remaining: ${remainingGb} GB</div>
                        </div>
                    </div>
                    <div class="glass-panel-subtle" style="padding: 1rem;">
                        <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase; margin-bottom: 0.5rem;">Raw JSON Payload</div>
                        <pre class="code-box">${escapeHtml(JSON.stringify(u, null, 2))}</pre>
                    </div>
                `;
                openModal('modalInspectUser');
            } else {
                showToast('danger', resp.message || `User "${userEmail}" not found.`);
            }
        } catch (err) {
            showToast('danger', err.message);
        }
    }

    /**
     * Prompts for server removal and executes /adminPanel/removeServer/...
     * @param {string} serverName 
     */
    function promptRemoveServer(serverName) {
        document.getElementById('confirmModalTitle').textContent = 'Remove Server';
        document.getElementById('confirmModalMessage').innerHTML = `Are you sure you want to remove routing server <strong>${escapeHtml(serverName)}</strong> from the registry?`;
        
        const confirmBtn = document.getElementById('btnConfirmAction');
        confirmBtn.className = 'btn btn-danger';
        confirmBtn.textContent = 'Remove Server';
        
        confirmBtn.onclick = async () => {
            try {
                confirmBtn.disabled = true;
                const resp = await CloudVPNApi.removeServer(currentSession.email, currentSession.password, serverName);
                if (resp && resp.status === 'success') {
                    showToast('success', `Server "${serverName}" removed successfully.`);
                    closeAllModals();
                    loadServersView();
                } else {
                    showToast('danger', resp.message || 'Failed to remove server.');
                }
            } catch (err) {
                showToast('danger', err.message);
            } finally {
                confirmBtn.disabled = false;
            }
        };

        openModal('modalConfirm');
    }

    /**
     * Toggles block / unblock status of a user in-place without page reload.
     * @param {string} userEmail 
     * @param {boolean} block 
     */
    async function toggleBlockUser(userEmail, block) {
        try {
            let resp;
            if (block) {
                resp = await CloudVPNApi.blockUser(currentSession.email, currentSession.password, userEmail);
            } else {
                resp = await CloudVPNApi.unblockUser(currentSession.email, currentSession.password, userEmail);
            }

            if (resp && resp.status === 'success') {
                showToast('success', `User "${userEmail}" is now ${block ? 'Blocked' : 'Unblocked'}.`);
                
                // Update in-place in cached users & DOM row
                if (cachedUsers[userEmail]) {
                    cachedUsers[userEmail].blocked = block ? 1 : 0;
                }

                const userRows = document.querySelectorAll('#usersTableBody tr');
                userRows.forEach(row => {
                    if (row.textContent.includes(userEmail)) {
                        const statusBadgeCell = row.cells[4];
                        const actionsCell = row.cells[5];
                        if (statusBadgeCell) {
                            statusBadgeCell.innerHTML = block 
                                ? '<span class="badge badge-danger">Blocked</span>' 
                                : '<span class="badge badge-success">Active</span>';
                        }
                        if (actionsCell) {
                            const btnGroup = actionsCell.querySelector('.action-btn-group');
                            if (btnGroup) {
                                btnGroup.innerHTML = `
                                    <button class="btn btn-sm btn-secondary" title="Inspect User Query" onclick="CloudVPNDashboard.inspectUser('${escapeHtml(userEmail)}')">
                                        <svg class="svg-icon" style="width: 0.95rem; height: 0.95rem;" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </button>
                                    <button class="btn btn-sm btn-secondary" title="Change Email" onclick="CloudVPNDashboard.promptChangeEmail('${escapeHtml(userEmail)}')">
                                        <svg class="svg-icon" style="width: 0.95rem; height: 0.95rem;" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    ${block 
                                        ? `<button class="btn btn-sm btn-warning" title="Unblock User" onclick="CloudVPNDashboard.toggleBlockUser('${escapeHtml(userEmail)}', false)">
                                            <svg class="svg-icon" style="width: 0.95rem; height: 0.95rem;" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
                                           </button>`
                                        : `<button class="btn btn-sm btn-secondary" title="Block User" onclick="CloudVPNDashboard.toggleBlockUser('${escapeHtml(userEmail)}', true)">
                                            <svg class="svg-icon" style="width: 0.95rem; height: 0.95rem;" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                           </button>`
                                    }
                                    <button class="btn btn-sm btn-danger" title="Delete User" onclick="CloudVPNDashboard.promptDeleteUser('${escapeHtml(userEmail)}')">
                                        <svg class="svg-icon" style="width: 0.95rem; height: 0.95rem;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                `;
                            }
                        }
                    }
                });
            } else {
                showToast('danger', resp.message || `Failed to ${block ? 'block' : 'unblock'} user.`);
            }
        } catch (err) {
            showToast('danger', err.message);
        }
    }

    /**
     * Opens modal to change user email.
     * @param {string} userEmail 
     */
    function promptChangeEmail(userEmail) {
        document.getElementById('changeEmailOld').value = userEmail;
        document.getElementById('changeEmailNew').value = '';
        openModal('modalChangeEmail');

        const form = document.getElementById('formChangeEmail');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const newEmail = document.getElementById('changeEmailNew').value.trim();
            if (!newEmail) {
                showToast('warning', 'Please provide a new email address.');
                return;
            }

            try {
                const resp = await CloudVPNApi.changeUserEmail(currentSession.email, currentSession.password, userEmail, newEmail);
                if (resp && resp.status === 'success') {
                    showToast('success', `User email updated from "${userEmail}" to "${newEmail}".`);
                    closeAllModals();
                    loadUsersTable();
                } else {
                    showToast('danger', resp.message || 'Failed to change user email.');
                }
            } catch (err) {
                showToast('danger', err.message);
            }
        };
    }

    /**
     * Prompts for user deletion and removes row in-place.
     * @param {string} userEmail 
     */
    function promptDeleteUser(userEmail) {
        document.getElementById('confirmModalTitle').textContent = 'Delete User Account';
        document.getElementById('confirmModalMessage').innerHTML = `Are you sure you want to permanently delete user <strong>${escapeHtml(userEmail)}</strong>? This action cannot be undone.`;
        
        const confirmBtn = document.getElementById('btnConfirmAction');
        confirmBtn.className = 'btn btn-danger';
        confirmBtn.textContent = 'Delete User';
        
        confirmBtn.onclick = async () => {
            try {
                confirmBtn.disabled = true;
                const resp = await CloudVPNApi.deleteUser(currentSession.email, currentSession.password, userEmail);
                if (resp && resp.status === 'success') {
                    showToast('success', `User "${userEmail}" deleted successfully.`);
                    closeAllModals();

                    // Remove row directly from DOM without page reload
                    delete cachedUsers[userEmail];
                    const userRows = document.querySelectorAll('#usersTableBody tr');
                    userRows.forEach(row => {
                        if (row.textContent.includes(userEmail)) {
                            row.remove();
                        }
                    });
                } else {
                    showToast('danger', resp.message || 'Failed to delete user.');
                }
            } catch (err) {
                showToast('danger', err.message);
            } finally {
                confirmBtn.disabled = false;
            }
        };

        openModal('modalConfirm');
    }

    // Expose dashboard controller to window
    window.CloudVPNDashboard = {
        init: initDashboard,
        refresh: refreshAllData,
        inspectUser: inspectUser,
        promptRemoveServer: promptRemoveServer,
        toggleBlockUser: toggleBlockUser,
        promptChangeEmail: promptChangeEmail,
        promptDeleteUser: promptDeleteUser
    };

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDashboard);
    } else {
        initDashboard();
    }
})();
