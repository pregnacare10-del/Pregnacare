// PregnaCare Admin Log History System - No Admin Verification Required
// Author: PregnaCare Development Team
// Version: 2.0 - DIRECT ACCESS
// Description: Direct access admin activity log tracking and history viewing system

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyABrKEsHES3slgR8040ZAMa3_8tYeGf4uM",
    authDomain: "pregnacare-f3c44.firebaseapp.com",
    databaseURL: "https://pregnacare-f3c44-default-rtdb.firebaseio.com",
    projectId: "pregnacare-f3c44",
    storageBucket: "pregnacare-f3c44.firebasestorage.app",
    messagingSenderId: "981150593337",
    appId: "1:981150593337:web:4ae9b3215529ee340ff8e8",
    measurementId: "G-VDEERGWBCD"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Global State Variables
let allLogs = [];
let filteredLogs = [];
let currentPage = 1;
let pageSize = 25;
let currentSort = { field: 'timestamp', direction: 'desc' };
let currentFilters = {};
let isLoading = false;

// DOM Elements
let elements = {};

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    console.log('PregnaCare Admin Log History System initializing...');
    
    try {
        initializeElements();
        setupEventListeners();
        loadLogs(); // Start loading logs immediately
        
        console.log('System initialization complete');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        showError('Failed to initialize system. Please refresh the page.');
    }
});

// Initialize DOM Elements
function initializeElements() {
    elements = {
        // Navigation
        refreshBtn: document.getElementById('refreshBtn'),
        exportBtn: document.getElementById('exportBtn'),
        backBtn: document.getElementById('backBtn'),
        
        // Statistics
        totalCreations: document.getElementById('totalCreations'),
        totalLogins: document.getElementById('totalLogins'),
        totalSecurity: document.getElementById('totalSecurity'),
        todayActivity: document.getElementById('todayActivity'),
        
        // Filters
        actionFilter: document.getElementById('actionFilter'),
        statusFilter: document.getElementById('statusFilter'),
        dateFromFilter: document.getElementById('dateFromFilter'),
        dateToFilter: document.getElementById('dateToFilter'),
        adminFilter: document.getElementById('adminFilter'),
        applyFiltersBtn: document.getElementById('applyFiltersBtn'),
        clearFiltersBtn: document.getElementById('clearFiltersBtn'),
        clearFiltersEmptyBtn: document.getElementById('clearFiltersEmptyBtn'),
        
        // Search
        searchInput: document.getElementById('searchInput'),
        searchBtn: document.getElementById('searchBtn'),
        
        // Table and states
        loadingState: document.getElementById('loadingState'),
        errorState: document.getElementById('errorState'),
        emptyState: document.getElementById('emptyState'),
        tableContainer: document.getElementById('tableContainer'),
        logTableBody: document.getElementById('logTableBody'),
        retryBtn: document.getElementById('retryBtn'),
        
        // Pagination
        paginationInfo: document.getElementById('paginationInfo'),
        pageSizeSelect: document.getElementById('pageSizeSelect'),
        paginationContainer: document.getElementById('paginationContainer'),
        prevPageBtn: document.getElementById('prevPageBtn'),
        nextPageBtn: document.getElementById('nextPageBtn'),
        pageNumbers: document.getElementById('pageNumbers'),
        
        // Modal
        logDetailsModal: document.getElementById('logDetailsModal'),
        modalBody: document.getElementById('modalBody'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        closeModalFooterBtn: document.getElementById('closeModalFooterBtn'),
        
        // Error display
        errorMessage: document.getElementById('errorMessage')
    };
    
    console.log('DOM elements initialized');
}

// Setup Event Listeners
function setupEventListeners() {
    // Navigation
    if (elements.refreshBtn) {
        elements.refreshBtn.addEventListener('click', refreshLogs);
    }
    
    if (elements.exportBtn) {
        elements.exportBtn.addEventListener('click', exportLogs);
    }
    
    if (elements.backBtn) {
        elements.backBtn.addEventListener('click', () => {
            window.location.href = 'DashBoard.html';
        });
    }
    
    // Filters
    if (elements.applyFiltersBtn) {
        elements.applyFiltersBtn.addEventListener('click', applyFilters);
    }
    
    if (elements.clearFiltersBtn) {
        elements.clearFiltersBtn.addEventListener('click', clearFilters);
    }
    
    if (elements.clearFiltersEmptyBtn) {
        elements.clearFiltersEmptyBtn.addEventListener('click', clearFilters);
    }
    
    // Search
    if (elements.searchBtn) {
        elements.searchBtn.addEventListener('click', performSearch);
    }
    
    if (elements.searchInput) {
        elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
        
        // Debounced search
        elements.searchInput.addEventListener('input', debounce(performSearch, 500));
    }
    
    // Table sorting
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortField = header.getAttribute('data-sort');
            toggleSort(sortField);
        });
    });
    
    // Pagination
    if (elements.pageSizeSelect) {
        elements.pageSizeSelect.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value);
            currentPage = 1;
            renderTable();
        });
    }
    
    if (elements.prevPageBtn) {
        elements.prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });
    }
    
    if (elements.nextPageBtn) {
        elements.nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredLogs.length / pageSize);
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        });
    }
    
    // Modal
    if (elements.closeModalBtn) {
        elements.closeModalBtn.addEventListener('click', closeModal);
    }
    
    if (elements.closeModalFooterBtn) {
        elements.closeModalFooterBtn.addEventListener('click', closeModal);
    }
    
    if (elements.logDetailsModal) {
        elements.logDetailsModal.addEventListener('click', (e) => {
            if (e.target === elements.logDetailsModal) {
                closeModal();
            }
        });
    }
    
    // Retry button
    if (elements.retryBtn) {
        elements.retryBtn.addEventListener('click', loadLogs);
    }
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.logDetailsModal && elements.logDetailsModal.classList.contains('show')) {
                closeModal();
            }
        }
        
        if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
            e.preventDefault();
            refreshLogs();
        }
    });
    
    console.log('Event listeners setup complete');
}

// Load Logs from Firebase - Direct access without authentication
async function loadLogs() {
    if (isLoading) return;
    
    isLoading = true;
    showLoading();
    
    try {
        console.log('Loading admin logs from Firebase...');
        
        // Get logs from Firebase
        const snapshot = await database.ref('adminLogs').orderByChild('timestamp').once('value');
        const logsData = snapshot.val();
        
        if (!logsData) {
            allLogs = [];
            console.log('No logs found in database');
        } else {
            // Convert to array and add keys
            allLogs = Object.keys(logsData).map(key => ({
                id: key,
                ...logsData[key]
            }));
            
            // Sort by timestamp (newest first)
            allLogs.sort((a, b) => {
                const timeA = a.timestamp || a.date || 0;
                const timeB = b.timestamp || b.date || 0;
                return new Date(timeB) - new Date(timeA);
            });
            
            console.log(`Loaded ${allLogs.length} logs from database`);
        }
        
        // Also load user activity logs if they exist in a different location
        await loadUserActivityLogs();
        
        // Process and display logs
        processLogs();
        updateStatistics();
        populateAdminFilter();
        applyFiltersAndSearch();
        showTable();
        
        // Log this access for tracking
        await logDirectAccess();
        
    } catch (error) {
        console.error('Error loading logs:', error);
        showError('Failed to load admin logs. Please check your connection and try again.');
    } finally {
        isLoading = false;
    }
}

// Log Direct Access
async function logDirectAccess() {
    try {
        await database.ref('adminLogs').push({
            action: 'LOG_HISTORY_DIRECT_ACCESS',
            performedBy: 'anonymous',
            performedByEmail: 'direct-access',
            performedByName: 'Direct Access User',
            targetUID: 'system',
            targetEmail: 'system',
            targetName: 'Log History System',
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            date: new Date().toISOString(),
            details: {
                accessType: 'direct_access',
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                sessionStart: new Date().toISOString(),
                noVerificationRequired: true
            },
            status: 'success',
            type: 'system_access'
        });

        console.log('Direct log history access logged');
    } catch (error) {
        console.warn('Failed to log direct access:', error);
        // Don't fail the whole operation if logging fails
    }
}

// Load additional user activity logs
async function loadUserActivityLogs() {
    try {
        // Check for logs in adminUsers (login activities)
        const usersSnapshot = await database.ref('adminUsers').once('value');
        const usersData = usersSnapshot.val();
        
        if (usersData) {
            Object.keys(usersData).forEach(uid => {
                const userData = usersData[uid];
                
                // Add user creation log if not already present
                if (userData.createdAt && userData.createdBy) {
                    const existingCreationLog = allLogs.find(log => 
                        (log.action === 'CREATE_SUB_ADMIN' || log.action === 'CREATE_ADMIN_ACCOUNT') && 
                        log.targetUID === uid
                    );
                    
                    if (!existingCreationLog) {
                        allLogs.push({
                            id: `user_creation_${uid}`,
                            action: userData.createdBy === 'system' ? 'CREATE_ADMIN_ACCOUNT' : 'CREATE_SUB_ADMIN',
                            performedBy: userData.createdBy,
                            performedByEmail: userData.createdByEmail || 'Unknown',
                            performedByName: userData.createdByName || 'Unknown Admin',
                            targetUID: uid,
                            targetEmail: userData.email,
                            targetName: userData.fullName || userData.email,
                            timestamp: userData.createdTimestamp || userData.createdAt,
                            date: userData.createdAt,
                            status: 'success',
                            type: 'user_management',
                            details: {
                                role: userData.role,
                                permissions: userData.permissions,
                                registrationSource: userData.registrationSource || 'admin-panel',
                                nameFields: {
                                    firstName: userData.firstName,
                                    middleName: userData.middleName,
                                    lastName: userData.lastName
                                }
                            }
                        });
                    }
                }
                
                // Add login logs if available
                if (userData.lastLogin) {
                    const recentLoginLog = allLogs.find(log => 
                        log.action === 'LOGIN' && 
                        log.performedBy === uid &&
                        Math.abs(new Date(log.date) - new Date(userData.lastLogin)) < 60000 // Within 1 minute
                    );
                    
                    if (!recentLoginLog) {
                        allLogs.push({
                            id: `user_login_${uid}_${Date.now()}`,
                            action: 'LOGIN',
                            performedBy: uid,
                            performedByEmail: userData.email,
                            performedByName: userData.fullName || userData.email,
                            targetUID: uid,
                            targetEmail: userData.email,
                            targetName: userData.fullName || userData.email,
                            timestamp: userData.lastLoginTimestamp || userData.lastLogin,
                            date: userData.lastLogin,
                            status: 'success',
                            type: 'auth_event',
                            details: {
                                role: userData.role,
                                loginCount: userData.loginCount || 1
                            }
                        });
                    }
                }
            });
        }
        
        console.log(`Total logs after merging user data: ${allLogs.length}`);
    } catch (error) {
        console.warn('Could not load user activity logs:', error);
    }
}

// Process Logs
function processLogs() {
    allLogs.forEach(log => {
        // Ensure consistent timestamp format
        if (log.timestamp && typeof log.timestamp === 'object') {
            // Firebase timestamp object
            log.processedDate = new Date(log.timestamp.seconds * 1000);
        } else if (log.timestamp) {
            log.processedDate = new Date(log.timestamp);
        } else if (log.date) {
            log.processedDate = new Date(log.date);
        } else {
            log.processedDate = new Date();
        }
        
        // Add display-friendly action names
        log.displayAction = getActionDisplayName(log.action);
        
        // Ensure status
        if (!log.status) {
            log.status = 'success';
        }
        
        // Clean up user names
        if (!log.performedByName || log.performedByName === 'Unknown') {
            log.performedByName = log.performedByEmail || 'System';
        }
        
        if (!log.targetName || log.targetName === 'Unknown') {
            log.targetName = log.targetEmail || 'N/A';
        }
    });
    
    // Sort again after processing
    allLogs.sort((a, b) => b.processedDate - a.processedDate);
    
    console.log('Logs processed successfully');
}

// Get Action Display Name
function getActionDisplayName(action) {
    const actionMap = {
        'CREATE_SUB_ADMIN': 'Sub-Admin Creation',
        'CREATE_ADMIN_ACCOUNT': 'Admin Account Creation',
        'REGISTRATION_SYSTEM_ACCESS': 'Registration Access',
        'REGISTRATION_ACCESS_FAILED': 'Failed Access',
        'LOG_HISTORY_ACCESS': 'Log History Access',
        'LOG_HISTORY_DIRECT_ACCESS': 'Direct Log Access',
        'LOGIN': 'Admin Login',
        'LOGOUT': 'Admin Logout',
        'UPDATE_PROFILE': 'Profile Update',
        'DELETE_ACCOUNT': 'Account Deletion',
        'PASSWORD_CHANGE': 'Password Change',
        'EMAIL_VERIFICATION': 'Email Verification',
        'ROLE_CHANGE': 'Role Change',
        'PERMISSIONS_UPDATE': 'Permissions Update',
        'SYSTEM_MAINTENANCE': 'System Maintenance',
        'BACKUP_CREATED': 'Backup Created',
        'DATA_EXPORT': 'Data Export',
        'SETTINGS_UPDATE': 'Settings Update'
    };
    
    return actionMap[action] || action.replace(/_/g, ' ').toLowerCase()
        .replace(/\b\w/g, l => l.toUpperCase());
}

// Update Statistics
function updateStatistics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const stats = {
        totalCreations: allLogs.filter(log => 
            (log.action === 'CREATE_SUB_ADMIN' || log.action === 'CREATE_ADMIN_ACCOUNT') && log.status === 'success'
        ).length,
        
        totalLogins: allLogs.filter(log => 
            log.action === 'LOGIN' || log.action === 'REGISTRATION_SYSTEM_ACCESS' || log.action === 'LOG_HISTORY_ACCESS' || log.action === 'LOG_HISTORY_DIRECT_ACCESS'
        ).length,
        
        totalSecurity: allLogs.filter(log => 
            log.status === 'failed' || log.action.includes('FAILED')
        ).length,
        
        todayActivity: allLogs.filter(log => 
            log.processedDate >= today
        ).length
    };
    
    // Animate counters
    animateCounter(elements.totalCreations, stats.totalCreations);
    animateCounter(elements.totalLogins, stats.totalLogins);
    animateCounter(elements.totalSecurity, stats.totalSecurity);
    animateCounter(elements.todayActivity, stats.todayActivity);
}

// Animate Counter
function animateCounter(element, targetValue) {
    if (!element) return;
    
    const startValue = 0;
    const duration = 1000;
    const increment = targetValue / (duration / 16);
    let currentValue = startValue;
    
    const timer = setInterval(() => {
        currentValue += increment;
        
        if (currentValue >= targetValue) {
            currentValue = targetValue;
            clearInterval(timer);
        }
        
        element.textContent = Math.floor(currentValue);
    }, 16);
}

// Populate Admin Filter
function populateAdminFilter() {
    if (!elements.adminFilter) return;
    
    const admins = new Set();
    
    allLogs.forEach(log => {
        if (log.performedByName && log.performedByName !== 'System' && log.performedByName !== 'Direct Access User') {
            admins.add(`${log.performedByName}|${log.performedByEmail}`);
        }
    });
    
    // Clear existing options except "All Admins"
    const allOption = elements.adminFilter.querySelector('option[value=""]');
    elements.adminFilter.innerHTML = '';
    if (allOption) {
        elements.adminFilter.appendChild(allOption);
    } else {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'All Admins';
        elements.adminFilter.appendChild(defaultOption);
    }
    
    // Add admin options
    Array.from(admins).sort().forEach(adminInfo => {
        const [name, email] = adminInfo.split('|');
        const option = document.createElement('option');
        option.value = email;
        option.textContent = `${name} (${email})`;
        elements.adminFilter.appendChild(option);
    });
}

// Apply Filters and Search
function applyFiltersAndSearch() {
    let filtered = [...allLogs];
    
    // Apply filters
    if (currentFilters.action) {
        filtered = filtered.filter(log => log.action === currentFilters.action);
    }
    
    if (currentFilters.status) {
        filtered = filtered.filter(log => log.status === currentFilters.status);
    }
    
    if (currentFilters.admin) {
        filtered = filtered.filter(log => log.performedByEmail === currentFilters.admin);
    }
    
    if (currentFilters.dateFrom) {
        const fromDate = new Date(currentFilters.dateFrom);
        filtered = filtered.filter(log => log.processedDate >= fromDate);
    }
    
    if (currentFilters.dateTo) {
        const toDate = new Date(currentFilters.dateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        filtered = filtered.filter(log => log.processedDate <= toDate);
    }
    
    // Apply search
    if (currentFilters.search && currentFilters.search.trim()) {
        const searchTerm = currentFilters.search.toLowerCase();
        filtered = filtered.filter(log => {
            return (
                log.displayAction.toLowerCase().includes(searchTerm) ||
                log.performedByName.toLowerCase().includes(searchTerm) ||
                log.performedByEmail.toLowerCase().includes(searchTerm) ||
                log.targetName.toLowerCase().includes(searchTerm) ||
                log.targetEmail.toLowerCase().includes(searchTerm) ||
                log.status.toLowerCase().includes(searchTerm) ||
                (log.details && JSON.stringify(log.details).toLowerCase().includes(searchTerm))
            );
        });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
        let aVal = a[currentSort.field];
        let bVal = b[currentSort.field];
        
        if (currentSort.field === 'timestamp') {
            aVal = a.processedDate;
            bVal = b.processedDate;
        }
        
        if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    filteredLogs = filtered;
    currentPage = 1;
    
    renderTable();
}

// Apply Filters
function applyFilters() {
    currentFilters = {
        action: elements.actionFilter?.value || '',
        status: elements.statusFilter?.value || '',
        admin: elements.adminFilter?.value || '',
        dateFrom: elements.dateFromFilter?.value || '',
        dateTo: elements.dateToFilter?.value || '',
        search: currentFilters.search || ''
    };
    
    applyFiltersAndSearch();
}

// Clear Filters
function clearFilters() {
    // Reset filter form
    if (elements.actionFilter) elements.actionFilter.value = '';
    if (elements.statusFilter) elements.statusFilter.value = '';
    if (elements.adminFilter) elements.adminFilter.value = '';
    if (elements.dateFromFilter) elements.dateFromFilter.value = '';
    if (elements.dateToFilter) elements.dateToFilter.value = '';
    if (elements.searchInput) elements.searchInput.value = '';
    
    // Reset filters object
    currentFilters = {};
    
    applyFiltersAndSearch();
}

// Perform Search
function performSearch() {
    currentFilters.search = elements.searchInput?.value || '';
    applyFiltersAndSearch();
}

// Toggle Sort
function toggleSort(field) {
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'desc';
    }
    
    // Update UI
    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('sorted');
        const icon = header.querySelector('.sort-icon');
        if (icon) {
            icon.className = 'fas fa-sort sort-icon';
        }
    });
    
    const currentHeader = document.querySelector(`[data-sort="${field}"]`);
    if (currentHeader) {
        currentHeader.classList.add('sorted');
        const icon = currentHeader.querySelector('.sort-icon');
        if (icon) {
            icon.className = `fas fa-sort-${currentSort.direction === 'asc' ? 'up' : 'down'} sort-icon`;
        }
    }
    
    applyFiltersAndSearch();
}

// Render Table
function renderTable() {
    if (!elements.logTableBody) return;
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = filteredLogs.slice(startIndex, endIndex);
    
    elements.logTableBody.innerHTML = '';
    
    if (pageData.length === 0) {
        showEmpty();
        return;
    }
    
    pageData.forEach(log => {
        const row = createLogRow(log);
        elements.logTableBody.appendChild(row);
    });
    
    updatePagination();
    updatePaginationInfo();
    showTable();
}

// Create Log Row
function createLogRow(log) {
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td>
            <div class="log-timestamp">
                ${formatDateTime(log.processedDate)}
            </div>
        </td>
        <td>
            <span class="log-action ${getActionClass(log.action)}">
                <i class="${getActionIcon(log.action)}"></i>
                ${log.displayAction}
            </span>
        </td>
        <td>
            <div class="log-user">
                ${escapeHtml(log.performedByName)}
            </div>
            <div class="log-user-email">
                ${escapeHtml(log.performedByEmail || 'N/A')}
            </div>
        </td>
        <td>
            <div class="log-target">
                ${escapeHtml(log.targetName || 'N/A')}
            </div>
            <div class="log-target-email">
                ${escapeHtml(log.targetEmail || 'N/A')}
            </div>
        </td>
        <td>
            <span class="log-status ${log.status}">
                <i class="${getStatusIcon(log.status)}"></i>
                ${log.status.charAt(0).toUpperCase() + log.status.slice(1)}
            </span>
        </td>
        <td>
            <div class="log-details-preview">
                ${getDetailsPreview(log.details)}
            </div>
        </td>
        <td>
            <div class="log-actions">
                <button class="action-btn view-details-btn" onclick="showLogDetails('${log.id}')">
                    <i class="fas fa-eye"></i>
                    Details
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// Get Action Class
function getActionClass(action) {
    const classMap = {
        'CREATE_SUB_ADMIN': 'create',
        'CREATE_ADMIN_ACCOUNT': 'create',
        'REGISTRATION_SYSTEM_ACCESS': 'access',
        'LOG_HISTORY_ACCESS': 'access',
        'LOG_HISTORY_DIRECT_ACCESS': 'access',
        'REGISTRATION_ACCESS_FAILED': 'failed',
        'LOGIN': 'access',
        'LOGOUT': 'access',
        'UPDATE_PROFILE': 'update',
        'DELETE_ACCOUNT': 'delete'
    };
    
    return classMap[action] || 'update';
}

// Get Action Icon
function getActionIcon(action) {
    const iconMap = {
        'CREATE_SUB_ADMIN': 'fas fa-heart',
        'CREATE_ADMIN_ACCOUNT': 'fas fa-heart',
        'REGISTRATION_SYSTEM_ACCESS': 'fas fa-heartbeat',
        'LOG_HISTORY_ACCESS': 'fas fa-heart',
        'LOG_HISTORY_DIRECT_ACCESS': 'fas fa-heart',
        'REGISTRATION_ACCESS_FAILED': 'fas fa-heart-broken',
        'LOGIN': 'fas fa-heartbeat',
        'LOGOUT': 'fas fa-sign-out-alt',
        'UPDATE_PROFILE': 'fas fa-heart',
        'DELETE_ACCOUNT': 'fas fa-heart-broken'
    };
    
    return iconMap[action] || 'fas fa-heart';
}

// Get Status Icon
function getStatusIcon(status) {
    const iconMap = {
        'success': 'fas fa-check',
        'failed': 'fas fa-times',
        'pending': 'fas fa-clock',
        'warning': 'fas fa-exclamation-triangle'
    };
    
    return iconMap[status] || 'fas fa-question';
}

// Get Details Preview
function getDetailsPreview(details) {
    if (!details) return 'No additional details';
    
    if (typeof details === 'string') return escapeHtml(details);
    
    if (typeof details === 'object') {
        const keys = Object.keys(details);
        if (keys.length === 0) return 'No additional details';
        
        const firstKey = keys[0];
        const firstValue = details[firstKey];
        
        if (typeof firstValue === 'string') {
            return `${firstKey}: ${escapeHtml(firstValue)}`;
        } else {
            return `${keys.length} detail${keys.length === 1 ? '' : 's'} available`;
        }
    }
    
    return 'Details available';
}

// Show Log Details
window.showLogDetails = function(logId) {
    const log = allLogs.find(l => l.id === logId);
    if (!log) return;
    
    const modalBody = elements.modalBody;
    if (!modalBody) return;
    
    modalBody.innerHTML = `
        <div class="detail-grid">
            <div class="detail-section">
                <h4><i class="fas fa-info-circle"></i> Basic Information</h4>
                <div class="detail-row">
                    <div class="detail-label">Action:</div>
                    <div class="detail-value">${escapeHtml(log.displayAction)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Date & Time:</div>
                    <div class="detail-value">${formatDateTime(log.processedDate)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Status:</div>
                    <div class="detail-value">
                        <span class="log-status ${log.status}">
                            <i class="${getStatusIcon(log.status)}"></i>
                            ${log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                        </span>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Log ID:</div>
                    <div class="detail-value code">${escapeHtml(log.id)}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-user"></i> Performed By</h4>
                <div class="detail-row">
                    <div class="detail-label">Name:</div>
                    <div class="detail-value">${escapeHtml(log.performedByName || 'Unknown')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Email:</div>
                    <div class="detail-value">${escapeHtml(log.performedByEmail || 'N/A')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">User ID:</div>
                    <div class="detail-value code">${escapeHtml(log.performedBy || 'N/A')}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-bullseye"></i> Target</h4>
                <div class="detail-row">
                    <div class="detail-label">Name:</div>
                    <div class="detail-value">${escapeHtml(log.targetName || 'N/A')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Email:</div>
                    <div class="detail-value">${escapeHtml(log.targetEmail || 'N/A')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">User ID:</div>
                    <div class="detail-value code">${escapeHtml(log.targetUID || 'N/A')}</div>
                </div>
            </div>
            
            ${log.details ? `
            <div class="detail-section">
                <h4><i class="fas fa-list"></i> Additional Details</h4>
                <div class="detail-row">
                    <div class="detail-label">Full Details:</div>
                    <div class="detail-value json">${JSON.stringify(log.details, null, 2)}</div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    showModal();
};

// Show Modal
function showModal() {
    if (elements.logDetailsModal) {
        elements.logDetailsModal.classList.add('show');
        elements.logDetailsModal.style.display = 'flex';
    }
}

// Close Modal
function closeModal() {
    if (elements.logDetailsModal) {
        elements.logDetailsModal.classList.remove('show');
        elements.logDetailsModal.style.display = 'none';
    }
}

// Update Pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredLogs.length / pageSize);
    
    if (elements.prevPageBtn) {
        elements.prevPageBtn.disabled = currentPage <= 1;
    }
    
    if (elements.nextPageBtn) {
        elements.nextPageBtn.disabled = currentPage >= totalPages;
    }
    
    if (elements.pageNumbers) {
        elements.pageNumbers.innerHTML = generatePageNumbers(currentPage, totalPages);
    }
    
    if (elements.paginationContainer) {
        elements.paginationContainer.style.display = totalPages > 1 ? 'flex' : 'none';
    }
}

// Generate Page Numbers
function generatePageNumbers(current, total) {
    if (total <= 1) return '';
    
    let html = '';
    const delta = 2;
    
    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
        html += `<button class="page-number ${i === current ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    
    if (current - delta > 2) {
        html = '<span class="page-ellipsis">...</span>' + html;
    }
    
    if (current + delta < total - 1) {
        html = html + '<span class="page-ellipsis">...</span>';
    }
    
    html = `<button class="page-number ${current === 1 ? 'active' : ''}" onclick="goToPage(1)">1</button>` + html;
    
    if (total > 1) {
        html = html + `<button class="page-number ${current === total ? 'active' : ''}" onclick="goToPage(${total})">${total}</button>`;
    }
    
    return html;
}

// Go to Page
window.goToPage = function(page) {
    currentPage = page;
    renderTable();
};

// Update Pagination Info
function updatePaginationInfo() {
    if (!elements.paginationInfo) return;
    
    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(startIndex + pageSize - 1, filteredLogs.length);
    const total = filteredLogs.length;
    
    elements.paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${total} entries`;
}

// Show/Hide States
function showLoading() {
    hideAllStates();
    if (elements.loadingState) {
        elements.loadingState.style.display = 'block';
    }
}

function showError(message) {
    hideAllStates();
    if (elements.errorState) {
        elements.errorState.style.display = 'block';
    }
    if (elements.errorMessage) {
        elements.errorMessage.textContent = message;
    }
}

function showEmpty() {
    hideAllStates();
    if (elements.emptyState) {
        elements.emptyState.style.display = 'block';
    }
}

function showTable() {
    hideAllStates();
    if (elements.tableContainer) {
        elements.tableContainer.style.display = 'block';
    }
}

function hideAllStates() {
    if (elements.loadingState) elements.loadingState.style.display = 'none';
    if (elements.errorState) elements.errorState.style.display = 'none';
    if (elements.emptyState) elements.emptyState.style.display = 'none';
    if (elements.tableContainer) elements.tableContainer.style.display = 'none';
}

// Refresh Logs
function refreshLogs() {
    allLogs = [];
    filteredLogs = [];
    currentPage = 1;
    loadLogs();
}

// Export Logs
function exportLogs() {
    if (filteredLogs.length === 0) {
        alert('No logs available to export.');
        return;
    }
    
    try {
        const csvContent = generateCSV(filteredLogs);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `admin_logs_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export logs. Please try again.');
    }
}

// Generate CSV
function generateCSV(logs) {
    const headers = [
        'Date/Time',
        'Action',
        'Performed By',
        'Performed By Email',
        'Target',
        'Target Email',
        'Status',
        'Type',
        'Details'
    ];
    
    let csv = headers.join(',') + '\n';
    
    logs.forEach(log => {
        const row = [
            formatDateTime(log.processedDate),
            log.displayAction,
            log.performedByName || 'N/A',
            log.performedByEmail || 'N/A',
            log.targetName || 'N/A',
            log.targetEmail || 'N/A',
            log.status,
            log.type || 'N/A',
            log.details ? JSON.stringify(log.details).replace(/"/g, '""') : 'N/A'
        ];
        
        csv += row.map(field => `"${field}"`).join(',') + '\n';
    });
    
    return csv;
}

// Format Date Time
function formatDateTime(date) {
    if (!date) return 'N/A';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    
    return d.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    
    return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize system when page loads
console.log('PregnaCare Admin Log History System loaded successfully');
console.log('Version: 2.0 - DIRECT ACCESS | Features: No admin verification required, Direct log access, Filtering, Search, Export, Real-time display');