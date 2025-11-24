// PregnaCare Lab Results System - Without Message Functionality
// Version: 4.0.0 COMPLETE - ALL FIXES INTEGRATED - Real Data Notifications Only
// Admin User: Eot0CErzLgetsS0bBCBtrkRCvXD2
// Updated: Notifications now use ONLY real data - no sample/hardcoded data
// Sub-Admin User: SeffMwIHCDOyyU5REpQtGX2Vv622

// ========================================
// CONFIGURATION
// ========================================

const ADMIN_USER_ID = "0GcKKrWpYkW1WyoSCdQiuwc9HDK2";
const SUB_ADMIN_USER_ID = "pnU0HliFenYYDpP3aLqfIxkkf3Z2";

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
let database;
let labResultsRef;
let patientsRef;
let notificationsRef;
let auth;
let currentUser = { uid: 'lab-system', displayName: 'Lab Results System' };
// Storage not needed - removed

// Global state for filtering  
let currentFilter = 'all';
let allLabResults = [];

// Firebase Initialization Function
function initializeFirebaseServices() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        database = firebase.database();
        auth = firebase.auth();
        // storage = firebase.storage(); // Not needed, commented out
        
        labResultsRef = database.ref('labResults');
        patientsRef = database.ref('patients');
        notificationsRef = database.ref('notifications');
        
        console.log('✅ Firebase Database initialized');
        console.log('✅ Firebase Auth initialized');
        
        
        return true;
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        return false;
    }
}

// Initialize immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFirebaseServices);
} else {
    initializeFirebaseServices();
}

// ========================================
// AUTHENTICATION MANAGER
// ========================================

class AuthenticationManager {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.isSubAdmin = false;
        this.userDisplayName = '';
        this.userEmail = '';
        this.isAuthenticated = false;
        this.setupAuthListener();
    }

    setupAuthListener() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                this.userEmail = user.email;
                this.isAdmin = user.uid === ADMIN_USER_ID;
                this.isSubAdmin = user.uid === SUB_ADMIN_USER_ID;
                this.isAuthenticated = true;
                
                await this.setUserDisplayName(user);
                
                console.log('User authenticated:', {
                    uid: user.uid,
                    email: user.email,
                    displayName: this.userDisplayName,
                    isAdmin: this.isAdmin,
                    isSubAdmin: this.isSubAdmin
                });
                
                this.updateUserInterface();
                this.logUserActivity('access_lab_results_module');
                
                if (window.labResultsApp) {
                    window.labResultsApp.onAuthenticated();
                }
                
            } else {
                console.log('No user authenticated, redirecting to login...');
                this.isAuthenticated = false;
                this.showAuthRequiredModal();
            }
        });
    }

    async setUserDisplayName(user) {
        try {
            if (user.displayName && user.displayName.trim()) {
                this.userDisplayName = user.displayName.trim();
                return;
            }

            const userSnapshot = await database.ref(`users/${user.uid}`).once('value');
            const userData = userSnapshot.val();
            
            if (userData && userData.fullName && userData.fullName.trim()) {
                this.userDisplayName = userData.fullName.trim();
                return;
            }

            if (userData && userData.firstName && userData.lastName) {
                this.userDisplayName = `${userData.firstName.trim()} ${userData.lastName.trim()}`;
                return;
            }

            if (user.email) {
                const emailParts = user.email.split('@')[0];
                const nameFromEmail = emailParts
                    .replace(/[._-]/g, ' ')
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
                
                this.userDisplayName = nameFromEmail;
                return;
            }

            this.userDisplayName = 'User';

        } catch (error) {
            console.error('Error getting user display name:', error);
            this.userDisplayName = 'User';
        }
    }

    updateUserInterface() {
        const sidebarUserInfo = document.querySelector('.user p');
        if (sidebarUserInfo) {
            sidebarUserInfo.textContent = this.userDisplayName;
        }
        
        const sidebarUserRole = document.querySelector('.user span');
        if (sidebarUserRole) {
            let role = 'User';
            if (this.isAdmin) role = 'Admin';
            else if (this.isSubAdmin) role = 'Sub-Admin';
            sidebarUserRole.textContent = role;
        }
        
        const sidebarUserInitials = document.querySelector('.user .circle');
        if (sidebarUserInitials) {
            const initials = this.userDisplayName
                .split(' ')
                .map(name => name[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
            sidebarUserInitials.textContent = initials || 'US';
        }
    }

    showAuthRequiredModal() {
        const modal = document.getElementById('authRequiredModal');
        if (modal) {
            modal.style.display = 'block';
            document.body.classList.add('modal-open');
        } else {
            this.redirectToLogin();
        }
    }

    async logUserActivity(action, details = {}) {
        if (!this.currentUser) return;
        
        try {
            const activityLog = {
                userId: this.currentUser.uid,
                userEmail: this.currentUser.email,
                userName: this.userDisplayName,
                action: action,
                module: 'lab_results',
                details: details,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                isAdmin: this.isAdmin,
                isSubAdmin: this.isSubAdmin
            };
            
            await database.ref('activityLogs').push(activityLog);
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    }

    async logout() {
        try {
            await this.logUserActivity('logout');
            await auth.signOut();
            this.redirectToLogin();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    redirectToLogin() {
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
        window.location.href = 'Admin login.html';
    }

    hasPermission(action) {
        const adminPermissions = ['all'];
        const subAdminPermissions = ['view', 'add', 'edit'];
        const userPermissions = ['view'];

        if (this.isAdmin) return true;
        
        if (this.isSubAdmin) {
            return subAdminPermissions.includes(action) || action === 'all';
        }
        
        return userPermissions.includes(action);
    }
}

// ========================================
// TOP BAR FUNCTIONS MANAGER - WITHOUT MESSAGES
// ========================================

class TopBarManager {
    constructor() {
        this.notificationsLoaded = false;
        this.helpContentLoaded = false;
        this.activeDropdown = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        console.log('Setting up top bar event listeners...');
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeTopBar());
        } else {
            this.initializeTopBar();
        }
    }

    initializeTopBar() {
        console.log('Initializing top bar...');
        
        // Get elements
        const notifIcon = document.getElementById('notifIcon');
        const helpIcon = document.getElementById('helpIcon');

        // Remove existing event listeners to prevent duplicates
        if (notifIcon) {
            notifIcon.replaceWith(notifIcon.cloneNode(true));
        }
        if (helpIcon) {
            helpIcon.replaceWith(helpIcon.cloneNode(true));
        }

        // Re-get elements after cloning
        const newNotifIcon = document.getElementById('notifIcon');
        const newHelpIcon = document.getElementById('helpIcon');

        // Add new event listeners
        if (newNotifIcon) {
            newNotifIcon.addEventListener('click', (e) => this.handleNotificationIconClick(e));
            console.log('Notification icon event listener added');
        }

        if (newHelpIcon) {
            newHelpIcon.addEventListener('click', (e) => this.handleHelpIconClick(e));
            console.log('Help icon event listener added');
        }

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => this.handleDocumentClick(e));

        // Prevent dropdown from closing when clicking inside
        document.querySelectorAll('.dropdown').forEach(dropdown => {
            dropdown.addEventListener('click', (e) => e.stopPropagation());
        });

        // Setup action buttons
        this.setupActionButtons();

        console.log('Top bar initialized successfully');
    }

    handleNotificationIconClick(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Notification icon clicked');
        this.toggleDropdown('notifDropdown');
        
        if (!this.notificationsLoaded) {
            this.loadNotifications();
        }
    }

    handleHelpIconClick(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Help icon clicked');
        this.toggleDropdown('helpDropdown');
    }

    handleDocumentClick(e) {
        // Close all dropdowns when clicking outside
        if (!e.target.closest('.icon-dropdown-group') && !e.target.closest('.dropdown')) {
            this.closeAllDropdowns();
        }
    }

    toggleDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) {
            console.error(`Dropdown ${dropdownId} not found`);
            return;
        }

        // Close other dropdowns first
        this.closeAllDropdowns(dropdownId);

        // Toggle the requested dropdown
        const isCurrentlyOpen = dropdown.classList.contains('show');
        
        if (isCurrentlyOpen) {
            dropdown.classList.remove('show');
            this.activeDropdown = null;
            console.log(`Closed dropdown: ${dropdownId}`);
        } else {
            dropdown.classList.add('show');
            this.activeDropdown = dropdownId;
            console.log(`Opened dropdown: ${dropdownId}`);
        }
    }

    closeAllDropdowns(except = null) {
        const dropdowns = document.querySelectorAll('.dropdown');
        dropdowns.forEach(dropdown => {
            if (except && dropdown.id === except) return;
            dropdown.classList.remove('show');
        });
        
        if (!except) {
            this.activeDropdown = null;
        }
    }

    // Load notifications using ONLY real data from Firebase and lab results
    async loadNotifications() {
        console.log('Loading notifications...');
        const notificationsList = document.getElementById('notificationsList');
        const notifBadge = document.getElementById('notifBadge');
        
        if (!notificationsList) return;

        // Show loading
        notificationsList.innerHTML = '<li style="text-align: center; color: #666;"><i class="fas fa-spinner fa-spin"></i> Loading notifications...</li>';

        try {
            if (notificationsRef && window.labResultsApp?.authManager?.currentUser) {
                // Load notifications from Firebase
                const notificationsSnapshot = await notificationsRef
                    .orderByChild('userId')
                    .equalTo(window.labResultsApp.authManager.currentUser.uid)
                    .limitToLast(10)
                    .once('value');

                const notifications = [];
                notificationsSnapshot.forEach(child => {
                    notifications.unshift({
                        id: child.key,
                        ...child.val()
                    });
                });

                // Also get lab-specific notifications
                const labNotifications = await this.getLabResultNotifications();
                const allNotifications = [...notifications, ...labNotifications]
                    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                    .slice(0, 10);

                this.displayNotifications(allNotifications);
                this.updateNotificationBadge(allNotifications.filter(n => !n.read).length);
                
            } else {
                // Use real lab data for notifications
                const sampleNotifications = this.getSampleNotifications();
                this.displayNotifications(sampleNotifications);
                this.updateNotificationBadge(sampleNotifications.filter(n => !n.read).length);
            }
            
            this.notificationsLoaded = true;
            
        } catch (error) {
            console.error('Error loading notifications:', error);
            notificationsList.innerHTML = '<li style="color: #e74c3c;">Error loading notifications</li>';
        }
    }

    async getLabResultNotifications() {
        const notifications = [];
        
        try {
            if (window.labResultsApp?.allResults) {
                const abnormalResults = window.labResultsApp.allResults.filter(result => 
                    result.status === 'abnormal' && !result.acknowledged
                );

                const recentResults = window.labResultsApp.allResults.filter(result => {
                    const resultDate = new Date(result.createdAt || result.date);
                    const daysDiff = (Date.now() - resultDate.getTime()) / (1000 * 60 * 60 * 24);
                    return daysDiff <= 1; // Results from last 24 hours
                });

                // Add abnormal result notifications
                abnormalResults.forEach(result => {
                    notifications.push({
                        id: `abnormal_${result.id}`,
                        type: 'abnormal_result',
                        title: 'Abnormal Lab Result',
                        message: `${result.patientName} - ${result.test} requires attention`,
                        timestamp: new Date(result.createdAt || result.date).getTime(),
                        urgent: true,
                        read: false,
                        relatedId: result.id
                    });
                });

                // Add new result notifications
                recentResults.forEach(result => {
                    notifications.push({
                        id: `new_${result.id}`,
                        type: 'new_result',
                        title: 'New Lab Result',
                        message: `${result.patientName} - ${result.test} result available`,
                        timestamp: new Date(result.createdAt || result.date).getTime(),
                        read: false,
                        relatedId: result.id
                    });
                });
            }
        } catch (error) {
            console.error('Error getting lab result notifications:', error);
        }

        return notifications;
    }

    displayNotifications(notifications) {
        const notificationsList = document.getElementById('notificationsList');
        if (!notificationsList) return;

        if (notifications.length === 0) {
            notificationsList.innerHTML = '<li style="text-align: center; color: #666; font-style: italic;">No notifications found</li>';
            return;
        }

        notificationsList.innerHTML = notifications.map(notification => `
            <li class="notification-item ${notification.urgent ? 'urgent' : ''}" data-notification-id="${notification.id}">
                <i class="fas ${this.getNotificationIcon(notification.type)}"></i>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #333; margin-bottom: 2px; font-size: 13px;">
                        ${notification.title || notification.message}
                    </div>
                    ${notification.message && notification.title ? `
                        <div style="font-size: 12px; color: #666; line-height: 1.3;">
                            ${notification.message}
                        </div>
                    ` : ''}
                    <div style="font-size: 11px; color: #999; margin-top: 4px;">
                        ${this.formatTimestamp(notification.timestamp)}
                    </div>
                </div>
                ${!notification.read ? '<div style="width: 6px; height: 6px; background: #e91e63; border-radius: 50%; margin-left: 8px;"></div>' : ''}
            </li>
        `).join('');

        // Add click handlers
        notificationsList.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => this.handleNotificationClick(item.dataset.notificationId, notifications));
        });
    }

    getNotificationIcon(type) {
        const icons = {
            'abnormal_result': 'fa-exclamation-triangle',
            'new_result': 'fa-flask',
            'appointment': 'fa-calendar',
            'system': 'fa-cog',
            'reminder': 'fa-bell',
            'urgent': 'fa-exclamation-circle',
            'info': 'fa-info-circle'
        };
        return icons[type] || 'fa-bell';
    }

    updateNotificationBadge(count) {
        const notifBadge = document.getElementById('notifBadge');
        if (notifBadge) {
            notifBadge.textContent = count;
            if (count === 0) {
                notifBadge.style.display = 'none';
            } else {
                notifBadge.style.display = 'flex';
            }
        }
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return 'Unknown time';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }

    getSampleNotifications() {
        const notifications = [];
        
        // This function now returns ONLY real data from lab results - NO SAMPLE DATA
        if (window.labResultsApp?.allResults && window.labResultsApp.allResults.length > 0) {
            const results = window.labResultsApp.allResults;
            
            // Get abnormal results
            const abnormalResults = results.filter(result => 
                result.status === 'abnormal'
            ); // Get ALL abnormal results - REAL DATA ONLY
            
            // Add notifications for abnormal results
            abnormalResults.forEach((result, index) => {
                const resultDate = result.createdAt ? new Date(result.createdAt).getTime() : 
                                   result.date ? new Date(result.date).getTime() : Date.now();
                
                notifications.push({
                    id: `abnormal_${result.id || index}`,
                    type: 'abnormal_result',
                    title: 'Abnormal Lab Result Alert',
                    message: `Patient ${result.patientName} (${result.patientId}) has abnormal ${result.test} requiring immediate attention`,
                    timestamp: resultDate,
                    urgent: true,
                    read: false,
                    relatedId: result.id
                });
            });
            
            // Count new lab results (results from last 24 hours)
            const recentResults = results.filter(result => {
                const resultDate = result.createdAt ? new Date(result.createdAt) : 
                                   result.date ? new Date(result.date) : new Date();
                const daysDiff = (Date.now() - resultDate.getTime()) / (1000 * 60 * 60 * 24);
                return daysDiff <= 1;
            });
            
            // Add notification for new lab results ready
            if (recentResults.length > 0) {
                const latestResult = recentResults[0];
                const resultDate = latestResult.createdAt ? new Date(latestResult.createdAt).getTime() : 
                                   latestResult.date ? new Date(latestResult.date).getTime() : Date.now();
                
                notifications.push({
                    id: 'lab_results_ready',
                    type: 'new_result',
                    title: 'Lab Results Ready',
                    message: `${recentResults.length} new lab result${recentResults.length > 1 ? 's are' : ' is'} ready for review`,
                    timestamp: resultDate,
                    read: false
                });
            }
            
            // Add reminder for pending results if any
            const pendingResults = results.filter(result => result.status === 'pending');
            if (pendingResults.length > 0) {
                notifications.push({
                    id: 'pending_reminder',
                    type: 'reminder',
                    title: 'Pending Lab Results',
                    message: `${pendingResults.length} lab result${pendingResults.length > 1 ? 's' : ''} pending review`,
                    timestamp: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago
                    read: true
                });
            }
            
        } else {
            // Fallback if no real data available
            notifications.push({
                id: 'no_data',
                type: 'info',
                title: 'No Lab Results',
                message: 'No lab results available yet. Add your first lab result to get started.',
                timestamp: Date.now(),
                read: false
            });
        }
        
        // Sort by timestamp (most recent first)
        return notifications.sort((a, b) => b.timestamp - a.timestamp);
    }

    setupActionButtons() {
        // Mark all as read button
        const markAllRead = document.getElementById('markAllRead');
        if (markAllRead) {
            markAllRead.addEventListener('click', () => this.markAllNotificationsRead());
        }

        // View all notifications button
        const viewAllNotifications = document.getElementById('viewAllNotifications');
        if (viewAllNotifications) {
            viewAllNotifications.addEventListener('click', () => this.viewAllNotifications());
        }

        // Help items
        document.querySelectorAll('.help-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                if (action) {
                    this.showHelpContent(action);
                }
            });
        });
    }

    handleNotificationClick(notificationId, notifications) {
        console.log('Notification clicked:', notificationId);
        
        const notification = notifications.find(n => n.id === notificationId);
        if (notification) {
            // Handle different notification types
            if (notification.type === 'abnormal_result' || notification.type === 'new_result') {
                if (notification.relatedId && window.viewResult) {
                    this.closeAllDropdowns();
                    setTimeout(() => window.viewResult(notification.relatedId), 100);
                }
            }
        }
        
        // Mark as read
        this.markNotificationRead(notificationId);
    }

    markAllNotificationsRead() {
        window.labResultsApp?.showMessage('All notifications marked as read', 'success');
        this.updateNotificationBadge(0);
        this.closeAllDropdowns();
    }

    viewAllNotifications() {
        window.labResultsApp?.showMessage('Opening all notifications...', 'info');
        this.closeAllDropdowns();
    }

    markNotificationRead(notificationId) {
        // In a real implementation, this would update the database
        console.log('Marking notification as read:', notificationId);
    }

    showHelpContent(action) {
        const helpModal = document.getElementById('helpContentModal');
        const helpModalTitle = document.getElementById('helpModalTitle');
        const helpModalContent = document.getElementById('helpModalContent');
        
        if (!helpModal || !helpModalTitle || !helpModalContent) {
            console.error('Help modal elements not found');
            return;
        }

        const content = this.getHelpContent(action);
        helpModalTitle.textContent = content.title;
        helpModalContent.innerHTML = content.content;
        
        helpModal.style.display = 'block';
        this.closeAllDropdowns();
    }

    getHelpContent(action) {
        const helpContent = {
            'quick-guide': {
                title: 'Lab Results Quick Start Guide',
                content: `
                    <div class="help-content">
                        <h3>Welcome to the Lab Results Module</h3>
                        <p>This guide will help you get started with managing lab results efficiently.</p>
                        
                        <h4>Main Features:</h4>
                        <ul>
                            <li><strong>View Results:</strong> Browse all lab results in an organized table</li>
                            <li><strong>Add Results:</strong> Enter new lab results manually or import from files</li>
                            <li><strong>Import Results:</strong> Upload CSV, Excel files, or scan lab result images</li>
                            <li><strong>Search & Filter:</strong> Find specific results quickly</li>
                            <li><strong>Status Tracking:</strong> Monitor normal, abnormal, and pending results</li>
                        </ul>

                        <h4>Quick Actions:</h4>
                        <ul>
                            <li>Click <strong>"Add Lab Result"</strong> to enter a new result</li>
                            <li>Click <strong>"Import Results"</strong> to upload multiple results</li>
                            <li>Use the search bar to find specific patients or tests</li>
                            <li>Click <strong>"View"</strong> on any result to see detailed information</li>
                        </ul>

                        <div class="tip">
                            <strong>💡 Tip:</strong> Use the search function to quickly find patients by name or ID. You can also search by test type or status.
                        </div>
                    </div>
                `
            },
            'add-result': {
                title: 'How to Add Lab Results',
                content: `
                    <div class="help-content">
                        <h3>Adding New Lab Results</h3>
                        
                        <h4>Step-by-Step Process:</h4>
                        <ol>
                            <li><strong>Click "Add Lab Result" button</strong> in the top-right corner</li>
                            <li><strong>Select Patient:</strong> Type in the patient search field to find and select a patient</li>
                            <li><strong>Choose Test Type:</strong> Select from the dropdown of available lab tests</li>
                            <li><strong>Set Status:</strong> Choose Pending, Normal, or Abnormal</li>
                            <li><strong>Enter Results:</strong> Add the actual test values and ranges</li>
                            <li><strong>Set Date:</strong> Choose the test date</li>
                            <li><strong>Add Notes:</strong> Include any additional doctor's notes (optional)</li>
                            <li><strong>Save:</strong> Click "Save Result" to add to the system</li>
                        </ol>

                        <h4>Patient Selection Tips:</h4>
                        <ul>
                            <li>Start typing the patient's name or ID</li>
                            <li>Select from the dropdown that appears</li>
                            <li>Use arrow keys to navigate the dropdown</li>
                            <li>Press Enter to select a patient</li>
                        </ul>

                        <div class="important">
                            <strong>⚠️ Important:</strong> Always double-check patient information before saving. Incorrect results can affect patient care.
                        </div>

                        <h4>Available Test Types:</h4>
                        <ul>
                            <li><strong>Prenatal Tests:</strong> Glucose Screening, Genetic Screening, Group B Strep, etc.</li>
                            <li><strong>Gynecological Tests:</strong> Pap Smear, HPV Test, STD Screening, etc.</li>
                            <li><strong>General Lab Tests:</strong> CBC, Urinalysis, Blood Type, Thyroid Function, etc.</li>
                        </ul>
                    </div>
                `
            },
            'import-guide': {
                title: 'Import Results Guide',
                content: `
                    <div class="help-content">
                        <h3>Importing Lab Results</h3>
                        <p>Import multiple results at once using data files or scan lab result images.</p>
                        
                        <h4>Data File Import (CSV/Excel/JSON):</h4>
                        <ol>
                            <li>Click <strong>"Import Results"</strong> button</li>
                            <li>Select <strong>"Data Files"</strong> option</li>
                            <li>Choose your file (CSV, Excel, or JSON)</li>
                            <li>Click <strong>"Preview Data"</strong> to review</li>
                            <li>Verify the data looks correct</li>
                            <li>Click <strong>"Import Results"</strong> to complete</li>
                        </ol>

                        <h4>Required Columns for Data Import:</h4>
                        <ul>
                            <li><code>patientName</code> - Full name of the patient</li>
                            <li><code>patientId</code> - Patient ID (e.g., PT001)</li>
                            <li><code>test</code> - Type of lab test</li>
                            <li><code>status</code> - pending, normal, or abnormal</li>
                            <li><code>results</code> - Test results and values</li>
                            <li><code>date</code> - Test date (YYYY-MM-DD format)</li>
                        </ul>

                        <h4>Image Import (OCR):</h4>
                        <ol>
                            <li>Select <strong>"Lab Result Images"</strong> option</li>
                            <li>Upload JPG, PNG, PDF, or TIFF files</li>
                            <li>Use the rotate button if needed</li>
                            <li>Click <strong>"Process Image"</strong></li>
                            <li>Review extracted data</li>
                            <li>Edit if necessary and save</li>
                        </ol>

                        <div class="tip">
                            <strong>💡 Image Tips:</strong> Use high-resolution, well-lit images for best OCR results. Ensure text is horizontal and clearly visible.
                        </div>

                        <h4>Sample CSV Format:</h4>
                        <code>patientName,patientId,test,status,results,date<br>
                        "Sarah Johnson",PT001,"Glucose Screening",normal,"85 mg/dL (Normal: 70-100)",2024-01-15</code>
                    </div>
                `
            },
            'status-guide': {
                title: 'Understanding Status Types',
                content: `
                    <div class="help-content">
                        <h3>Lab Result Status Types</h3>
                        
                        <h4>Status Definitions:</h4>
                        
                        <div style="margin: 15px 0; padding: 12px; background: #e8f5e8; border-left: 4px solid #4caf50; border-radius: 4px;">
                            <strong>🟢 NORMAL</strong><br>
                            Test results are within expected ranges. No immediate action required.
                        </div>
                        
                        <div style="margin: 15px 0; padding: 12px; background: #ffebee; border-left: 4px solid #f44336; border-radius: 4px;">
                            <strong>🔴 ABNORMAL</strong><br>
                            Test results are outside normal ranges. Requires immediate attention and follow-up.
                        </div>
                        
                        <div style="margin: 15px 0; padding: 12px; background: #fff3e0; border-left: 4px solid #ff9800; border-radius: 4px;">
                            <strong>🟡 PENDING</strong><br>
                            Test has been ordered but results are not yet available or being processed.
                        </div>

                        <h4>When to Use Each Status:</h4>
                        <ul>
                            <li><strong>Pending:</strong> Test samples collected, waiting for lab processing</li>
                            <li><strong>Normal:</strong> All values within reference ranges</li>
                            <li><strong>Abnormal:</strong> One or more values outside reference ranges</li>
                        </ul>

                        <h4>Abnormal Result Actions:</h4>
                        <ul>
                            <li>Red alert appears at top of page</li>
                            <li>Automatic notifications sent to relevant staff</li>
                            <li>Results flagged for immediate review</li>
                            <li>Can be acknowledged after review</li>
                        </ul>

                        <div class="warning">
                            <strong>⚠️ Critical:</strong> Always review abnormal results immediately. Patient safety depends on timely response to critical values.
                        </div>
                    </div>
                `
            },
            'abnormal-results': {
                title: 'Managing Abnormal Results',
                content: `
                    <div class="help-content">
                        <h3>Managing Abnormal Lab Results</h3>
                        
                        <h4>Immediate Actions for Abnormal Results:</h4>
                        <ol>
                            <li><strong>Review Alert Banner:</strong> Check the red alert at the top of the page</li>
                            <li><strong>Click "View Abnormal Results"</strong> to see all flagged results</li>
                            <li><strong>Open Each Result:</strong> Click "View" to see detailed information</li>
                            <li><strong>Contact Patient/Doctor:</strong> Follow your facility's protocols</li>
                            <li><strong>Acknowledge Result:</strong> Mark as reviewed when action is taken</li>
                        </ol>

                        <h4>Critical Value Protocols:</h4>
                        <ul>
                            <li><strong>Glucose > 400 mg/dL:</strong> Immediate notification required</li>
                            <li><strong>Hemoglobin < 7 g/dL:</strong> Critical low value</li>
                            <li><strong>Platelet count < 50,000:</strong> Bleeding risk</li>
                            <li><strong>Any critical values:</strong> Follow facility-specific protocols</li>
                        </ul>

                        <h4>Documentation Requirements:</h4>
                        <ul>
                            <li>Time of notification</li>
                            <li>Person contacted</li>
                            <li>Actions taken</li>
                            <li>Follow-up orders</li>
                        </ul>

                        <h4>System Features for Abnormal Results:</h4>
                        <ul>
                            <li><strong>Auto-Alerts:</strong> System automatically flags abnormal values</li>
                            <li><strong>Notifications:</strong> Real-time alerts to relevant staff</li>
                            <li><strong>Tracking:</strong> Monitor acknowledgment and follow-up</li>
                            <li><strong>Reporting:</strong> Generate reports on abnormal result handling</li>
                        </ul>

                        <div class="important">
                            <strong>🚨 Emergency Protocol:</strong> For life-threatening results, follow your facility's emergency notification procedures immediately.
                        </div>

                        <h4>Quality Assurance:</h4>
                        <ul>
                            <li>Double-check patient identification</li>
                            <li>Verify test methodology</li>
                            <li>Consider sample quality issues</li>
                            <li>Review previous results for trends</li>
                        </ul>
                    </div>
                `
            },
            'search-tips': {
                title: 'Search & Filter Tips',
                content: `
                    <div class="help-content">
                        <h3>Search & Filter Tips</h3>
                        
                        <h4>Search Functionality:</h4>
                        <ul>
                            <li><strong>Patient Name:</strong> Type any part of the patient's name</li>
                            <li><strong>Patient ID:</strong> Search by ID (e.g., PT001, PT002)</li>
                            <li><strong>Test Type:</strong> Find by test name (e.g., "glucose", "CBC")</li>
                            <li><strong>Status:</strong> Search by "normal", "abnormal", or "pending"</li>
                        </ul>

                        <h4>Search Tips:</h4>
                        <ul>
                            <li>Search is case-insensitive</li>
                            <li>Partial matches work (e.g., "john" finds "Johnson")</li>
                            <li>Clear search to see all results</li>
                            <li>Search updates results in real-time</li>
                        </ul>

                        <h4>Quick Search Examples:</h4>
                        <ul>
                            <li><code>PT001</code> - Find specific patient by ID</li>
                            <li><code>Smith</code> - Find all patients with "Smith" in name</li>
                            <li><code>abnormal</code> - Show only abnormal results</li>
                            <li><code>glucose</code> - Find all glucose tests</li>
                            <li><code>2024-01</code> - Find results from January 2024</li>
                        </ul>

                        <h4>Advanced Filtering:</h4>
                        <ul>
                            <li><strong>Date Range:</strong> Include dates in search</li>
                            <li><strong>Multiple Terms:</strong> Combine search terms</li>
                            <li><strong>Status Filter:</strong> Use status names to filter</li>
                        </ul>

                        <h4>Pagination:</h4>
                        <ul>
                            <li>Results are shown 8 per page</li>
                            <li>Use navigation buttons to browse pages</li>
                            <li>Page information shows current position</li>
                            <li>Search results maintain pagination</li>
                        </ul>

                        <div class="tip">
                            <strong>💡 Pro Tip:</strong> Bookmark common searches by copying the URL after searching. The search terms are preserved in the URL.
                        </div>

                        <h4>Keyboard Shortcuts:</h4>
                        <ul>
                            <li><span class="keyboard-shortcut">Ctrl+F</span> - Focus on search box</li>
                            <li><span class="keyboard-shortcut">Escape</span> - Clear search</li>
                            <li><span class="keyboard-shortcut">Enter</span> - Execute search</li>
                        </ul>
                    </div>
                `
            },
            'history-guide': {
                title: 'Using History Feature',
                content: `
                    <div class="help-content">
                        <h3>Lab Result History</h3>
                        
                        <h4>Viewing Result History:</h4>
                        <ul>
                            <li>Click the "History" button on any lab result</li>
                            <li>View chronological timeline of all versions</li>
                            <li>See who made changes and when</li>
                            <li>Compare different versions side-by-side</li>
                        </ul>

                        <h4>History Information Includes:</h4>
                        <ul>
                            <li>Original result entry date and time</li>
                            <li>All modification timestamps</li>
                            <li>User who made each change</li>
                            <li>What fields were modified</li>
                            <li>Previous and new values</li>
                        </ul>

                        <h4>Using Version Comparison:</h4>
                        <ol>
                            <li>Open the history for any result</li>
                            <li>Click "Compare" between two versions</li>
                            <li>Review highlighted differences</li>
                            <li>Understand what changed and why</li>
                        </ol>

                        <div class="tip">
                            <strong>💡 Audit Trail:</strong> All changes are permanently logged for compliance and quality assurance purposes.
                        </div>
                    </div>
                `
            },
            'troubleshooting': {
                title: 'Troubleshooting',
                content: `
                    <div class="help-content">
                        <h3>Common Issues & Solutions</h3>
                        
                        <h4>Login & Access Issues:</h4>
                        <ul>
                            <li><strong>Can't access page:</strong> Ensure you're logged in with proper credentials</li>
                            <li><strong>Permission denied:</strong> Contact your administrator for access rights</li>
                            <li><strong>Session expired:</strong> Refresh page and log in again</li>
                        </ul>

                        <h4>Data Loading Issues:</h4>
                        <ul>
                            <li><strong>Results not loading:</strong> Check internet connection and refresh page</li>
                            <li><strong>Slow loading:</strong> Large datasets may take time to load</li>
                            <li><strong>Missing data:</strong> Verify data was saved correctly</li>
                        </ul>

                        <h4>Import Problems:</h4>
                        <ul>
                            <li><strong>CSV not importing:</strong> Check file format and required columns</li>
                            <li><strong>Excel errors:</strong> Save as CSV for best compatibility</li>
                            <li><strong>Image OCR issues:</strong> Use high-quality, well-lit images</li>
                            <li><strong>Duplicate data:</strong> System will flag duplicates during import</li>
                        </ul>

                        <h4>Patient Search Issues:</h4>
                        <ul>
                            <li><strong>Patient not found:</strong> Check spelling and try partial names</li>
                            <li><strong>Dropdown not working:</strong> Refresh page and try again</li>
                            <li><strong>Search too slow:</strong> Type at least 2 characters before searching</li>
                        </ul>

                        <h4>Performance Tips:</h4>
                        <ul>
                            <li>Use Chrome, Firefox, or Safari for best performance</li>
                            <li>Clear browser cache if experiencing issues</li>
                            <li>Ensure JavaScript is enabled</li>
                            <li>Close other browser tabs to free memory</li>
                        </ul>

                        <h4>Error Messages:</h4>
                        <ul>
                            <li><strong>"Authentication Required":</strong> Log in again</li>
                            <li><strong>"Permission Denied":</strong> Contact administrator</li>
                            <li><strong>"Network Error":</strong> Check internet connection</li>
                            <li><strong>"Invalid Data":</strong> Check input format and try again</li>
                        </ul>

                        <div class="warning">
                            <strong>⚠️ Still Having Issues?</strong> Contact technical support with specific error messages and steps to reproduce the problem.
                        </div>

                        <h4>Browser Requirements:</h4>
                        <ul>
                            <li>Chrome 90+ (Recommended)</li>
                            <li>Firefox 88+</li>
                            <li>Safari 14+</li>
                            <li>Edge 90+</li>
                            <li>JavaScript enabled</li>
                            <li>Cookies enabled</li>
                        </ul>
                    </div>
                `
            },
            'contact-support': {
                title: 'Contact Support',
                content: `
                    <div class="help-content">
                        <h3>Contact Support</h3>
                        
                        <h4>Emergency Support (24/7):</h4>
                        <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <strong>🚨 Emergency Hotline:</strong><br>
                            <strong>Phone:</strong> +63 917 123 4567<br>
                            <em>For critical system issues affecting patient care</em>
                        </div>

                        <h4>Technical Support:</h4>
                        <ul>
                            <li><strong>Email:</strong> support@pregnacare.com</li>
                            <li><strong>Phone:</strong> +63 917 123 4567</li>
                            <li><strong>Hours:</strong> Monday-Friday, 8:00 AM - 6:00 PM</li>
                            <li><strong>Response Time:</strong> Within 4 hours during business hours</li>
                        </ul>

                        <h4>Lab Results Module Support:</h4>
                        <ul>
                            <li><strong>Lab Manager:</strong> lab.manager@pregnacare.com</li>
                            <li><strong>Data Issues:</strong> data.support@pregnacare.com</li>
                            <li><strong>Training:</strong> training@pregnacare.com</li>
                        </ul>

                        <h4>When Contacting Support, Please Provide:</h4>
                        <ul>
                            <li>Your name and role</li>
                            <li>Specific error messages (screenshots helpful)</li>
                            <li>Steps you took before the issue occurred</li>
                            <li>Browser and version you're using</li>
                            <li>Time the issue occurred</li>
                            <li>Patient ID (if relevant, without personal info)</li>
                        </ul>

                        <h4>Self-Service Resources:</h4>
                        <ul>
                            <li><strong>User Manual:</strong> Complete documentation available</li>
                            <li><strong>Video Tutorials:</strong> Step-by-step guides</li>
                            <li><strong>FAQ:</strong> Common questions and answers</li>
                            <li><strong>System Status:</strong> Check for known issues</li>
                        </ul>

                        <h4>Feature Requests & Feedback:</h4>
                        <ul>
                            <li><strong>Email:</strong> feedback@pregnacare.com</li>
                            <li><strong>Subject:</strong> "Lab Results Module - Feature Request"</li>
                            <li>Describe the feature and how it would help</li>
                            <li>Include mockups or examples if available</li>
                        </ul>

                        <div class="tip">
                            <strong>💡 Tip:</strong> Before contacting support, try refreshing the page or logging out and back in. Many issues are resolved with these simple steps.
                        </div>

                        <h4>Training & Onboarding:</h4>
                        <ul>
                            <li><strong>New User Training:</strong> Schedule with training@pregnacare.com</li>
                            <li><strong>Group Sessions:</strong> Available for teams</li>
                            <li><strong>Custom Training:</strong> Tailored to your facility's needs</li>
                        </ul>

                        <h4>Office Hours:</h4>
                        <ul>
                            <li><strong>Monday-Friday:</strong> 8:00 AM - 6:00 PM (Philippine Time)</li>
                            <li><strong>Saturday:</strong> 9:00 AM - 1:00 PM (Limited support)</li>
                            <li><strong>Sunday:</strong> Emergency support only</li>
                            <li><strong>Holidays:</strong> Emergency support only</li>
                        </ul>
                    </div>
                `
            }
        };

        return helpContent[action] || {
            title: 'Help',
            content: '<p>Help content not found.</p>'
        };
    }
}

// ========================================
// IMAGE PROCESSING CLASS
// ========================================

class ImageProcessor {
    constructor() {
        this.currentImage = null;
        this.rotation = 0;
        this.canvas = null;
        this.ctx = null;
        this.setupCanvas();
    }

    setupCanvas() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    async processImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.currentImage = img;
                    this.rotation = 0;
                    resolve(this.extractLabData(img));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    rotateImage() {
        if (!this.currentImage) return null;
        
        this.rotation = (this.rotation + 90) % 360;
        
        // Create rotated canvas
        const { width, height } = this.getRotatedDimensions();
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.ctx.clearRect(0, 0, width, height);
        this.ctx.save();
        this.ctx.translate(width / 2, height / 2);
        this.ctx.rotate((this.rotation * Math.PI) / 180);
        this.ctx.drawImage(this.currentImage, -this.currentImage.width / 2, -this.currentImage.height / 2);
        this.ctx.restore();
        
        return this.canvas.toDataURL();
    }

    getRotatedDimensions() {
        if (this.rotation % 180 === 0) {
            return { width: this.currentImage.width, height: this.currentImage.height };
        } else {
            return { width: this.currentImage.height, height: this.currentImage.width };
        }
    }

    async extractLabData(image) {
        // Simulate OCR processing with realistic lab result patterns
        await this.simulateProcessingSteps();
        
        // Mock extracted data - in real implementation, this would use OCR
        const mockExtractedData = {
            patientName: this.extractPatientName(),
            patientId: this.extractPatientId(),
            testType: this.extractTestType(),
            results: this.extractResults(),
            date: this.extractDate(),
            confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
            rawText: this.generateMockOCRText()
        };
        
        return mockExtractedData;
    }

    async simulateProcessingSteps() {
        const steps = ['step1', 'step2', 'step3', 'step4'];
        const stepTexts = [
            'Enhancing image quality...',
            'Extracting text content...',
            'Identifying patient information...',
            'Parsing lab results...'
        ];
        
        for (let i = 0; i < steps.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
            
            const currentStep = document.getElementById(steps[i]);
            if (currentStep) {
                currentStep.style.color = '#4caf50';
                currentStep.innerHTML = `<i class="fas fa-check-circle" style="color: #4caf50;"></i><span>${stepTexts[i]} Complete</span>`;
            }
            
            if (i < steps.length - 1) {
                const nextStep = document.getElementById(steps[i + 1]);
                if (nextStep) {
                    nextStep.style.color = '#2196f3';
                    nextStep.innerHTML = `<i class="fas fa-circle-notch fa-spin" style="color: #2196f3;"></i><span>${stepTexts[i + 1]}</span>`;
                }
            }
        }
    }

    extractPatientName() {
        const names = [
            'Sarah Johnson', 'Maria Garcia', 'Jennifer Chen', 'Lisa Wong', 
            'Anna Smith', 'Emma Martinez', 'Sophia Rodriguez', 'Isabella Brown'
        ];
        return names[Math.floor(Math.random() * names.length)];
    }

    extractPatientId() {
        return `PT${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
    }

    extractTestType() {
        const tests = [
            'Complete Blood Count (CBC)', 'Glucose Screening', 'Thyroid Function Test',
            'Urinalysis', 'Iron/Ferritin Levels', 'Vitamin D Level', 'Genetic Screening'
        ];
        return tests[Math.floor(Math.random() * tests.length)];
    }

    extractResults() {
        const results = [
            'WBC: 7.2 K/uL (Normal: 4.5-11.0)\nRBC: 4.1 M/uL (Normal: 3.8-5.2)\nHemoglobin: 12.8 g/dL (Normal: 12.0-16.0)',
            'Glucose: 85 mg/dL (Normal: 70-100 mg/dL)\nFasting: Yes',
            'TSH: 2.1 mIU/L (Normal: 0.4-4.0)\nT4: 8.9 ug/dL (Normal: 4.5-12.0)',
            'Protein: Negative\nGlucose: Negative\nBacteria: Few',
            'Iron: 95 ug/dL (Normal: 60-170)\nFerritin: 45 ng/mL (Normal: 15-200)',
            'Vitamin D: 32 ng/mL (Normal: 30-100)'
        ];
        return results[Math.floor(Math.random() * results.length)];
    }

    extractDate() {
        const today = new Date();
        const daysAgo = Math.floor(Math.random() * 30);
        const testDate = new Date(today.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        return testDate.toISOString().split('T')[0];
    }

    generateMockOCRText() {
        return `LABORATORY RESULTS
Patient: ${this.extractPatientName()}
ID: ${this.extractPatientId()}
Date: ${this.extractDate()}
Test: ${this.extractTestType()}
Results: ${this.extractResults()}
`;
    }
}

// ========================================
// MAIN LAB RESULTS APPLICATION
// ========================================


// ========================================
// ENHANCED FILE IMPORT SYSTEM (Based on Messages.js)
// ========================================

// File Import State
let importFileState = {
    selectedFile: null,
    fileFormat: 'csv',
    previewedData: null,
    isProcessing: false
};

const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function setupFileImportHandlers() {
    console.log('🔧 Setting up file import handlers...');
    
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileInput');
    
    if (!fileUploadArea || !fileInput) {
        console.warn('⚠️ File upload elements not found, will retry...');
        return false;
    }
    
    // Clone to remove old listeners
    const newUploadArea = fileUploadArea.cloneNode(true);
    fileUploadArea.parentNode.replaceChild(newUploadArea, fileUploadArea);
    
    // Click handler
    newUploadArea.addEventListener('click', function(e) {
        console.log('📁 Upload area clicked');
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('fileInput').click();
    });
    
    // File input change
    document.getElementById('fileInput').addEventListener('change', function(e) {
        console.log('📄 File selected');
        const file = e.target.files[0];
        if (file) handleImportFileSelection(file);
    });
    
    // Drag and drop
    newUploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.borderColor = '#ee5968';
        this.style.background = '#fff5f7';
    });
    
    newUploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.borderColor = '#ddd';
        this.style.background = '#fafafa';
    });
    
    newUploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.borderColor = '#ddd';
        this.style.background = '#fafafa';
        
        console.log('📦 File dropped');
        const file = e.dataTransfer.files[0];
        if (file) handleImportFileSelection(file);
    });
    
    console.log('✅ Handlers setup complete');
    return true;
}

function handleImportFileSelection(file) {
    console.log('📎 Handling file:', file.name);
    
    if (file.size > MAX_IMPORT_FILE_SIZE) {
        showMessage(`File too large. Max ${MAX_IMPORT_FILE_SIZE/1024/1024}MB`, 'error');
        return;
    }
    
    const format = importFileState.fileFormat;
    const validExts = format === 'csv' ? ['.csv'] : ['.jpg','.jpeg','.png','.pdf','.tiff'];
    const fileName = file.name.toLowerCase();
    
    if (!validExts.some(ext => fileName.endsWith(ext))) {
        showMessage('Invalid file type', 'error');
        return;
    }
    
    importFileState.selectedFile = file;
    displayImportSelectedFile(file);
    updateImportButtons();
    
    console.log('✅ File selected:', file.name);
}

function displayImportSelectedFile(file) {
    const container = document.getElementById('selectedFileName');
    const nameText = document.getElementById('fileNameText');
    const sizeText = document.getElementById('fileSizeText');
    
    if (container && nameText && sizeText) {
        nameText.textContent = file.name;
        sizeText.textContent = `Size: ${formatImportFileSize(file.size)} • Type: ${file.type || 'Unknown'}`;
        container.style.display = 'block';
    }
}

function formatImportFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function updateImportButtons() {
    const previewBtn = document.getElementById('previewBtn');
    const processImageBtn = document.getElementById('processImageBtn');
    const importBtn = document.getElementById('importBtn');
    
    const hasFile = importFileState.selectedFile !== null;
    const format = importFileState.fileFormat;
    
    if (previewBtn) {
        previewBtn.disabled = !hasFile || format !== 'csv';
        previewBtn.style.display = format === 'csv' ? 'inline-flex' : 'none';
    }
    
    if (processImageBtn) {
        processImageBtn.disabled = !hasFile || format === 'csv';
        processImageBtn.style.display = format === 'image' ? 'inline-flex' : 'none';
    }
    
    if (importBtn) {
        importBtn.disabled = !hasFile || !importFileState.previewedData;
    }
}

// REMOVED DUPLICATE: OLD handleFormatChange (lines 1481-1509)

// REMOVED DUPLICATE: OLD clearFileSelection (lines 1511-1528)

// REMOVED DUPLICATE: OLD previewFile (lines 1530-1560)

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

function displayImportPreview(data) {
    const previewSection = document.getElementById('previewSection');
    const dataPreview = document.getElementById('dataPreview');
    const previewStats = document.getElementById('previewStats');
    
    if (!previewSection || !dataPreview || !previewStats) return;
    
    previewSection.style.display = 'block';
    
    let html = '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="background:#f0f0f0;">';
    html += '<th style="padding:8px;border:1px solid #ddd;">Patient ID</th>';
    html += '<th style="padding:8px;border:1px solid #ddd;">Patient Name</th>';
    html += '<th style="padding:8px;border:1px solid #ddd;">Test</th>';
    html += '<th style="padding:8px;border:1px solid #ddd;">Status</th>';
    html += '<th style="padding:8px;border:1px solid #ddd;">Date</th>';
    html += '</tr></thead><tbody>';
    
    const previewCount = Math.min(5, data.length);
    for (let i = 0; i < previewCount; i++) {
        const row = data[i];
        const statusClass = row.status === 'abnormal' ? 'abnormal' : row.status === 'normal' ? 'normal' : 'pending';
        const statusBg = statusClass === 'abnormal' ? '#ffebee' : statusClass === 'normal' ? '#e8f5e9' : '#fff3e0';
        const statusColor = statusClass === 'abnormal' ? '#c62828' : statusClass === 'normal' ? '#2e7d32' : '#e65100';
        
        html += '<tr>';
        html += `<td style="padding:8px;border:1px solid #ddd;">${escapeHtml(row.patientId)}</td>`;
        html += `<td style="padding:8px;border:1px solid #ddd;">${escapeHtml(row.patientName)}</td>`;
        html += `<td style="padding:8px;border:1px solid #ddd;">${escapeHtml(row.test)}</td>`;
        html += `<td style="padding:8px;border:1px solid #ddd;"><span style="padding:4px 8px;border-radius:12px;font-size:11px;font-weight:bold;background:${statusBg};color:${statusColor};">${capitalizeFirst(row.status)}</span></td>`;
        html += `<td style="padding:8px;border:1px solid #ddd;">${escapeHtml(row.date)}</td>`;
        html += '</tr>';
    }
    
    html += '</tbody></table>';
    
    if (data.length > 5) {
        html += `<p style="margin-top:10px;text-align:center;color:#666;font-size:12px;">Showing ${previewCount} of ${data.length} records</p>`;
    }
    
    dataPreview.innerHTML = html;
    
    const statusCounts = data.reduce((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
    }, {});
    
    let statsHtml = `<strong>📊 Statistics:</strong> `;
    statsHtml += `Total: <strong>${data.length}</strong> | `;
    statsHtml += `Pending: <strong>${statusCounts.pending || 0}</strong> | `;
    statsHtml += `Normal: <strong>${statusCounts.normal || 0}</strong> | `;
    statsHtml += `Abnormal: <strong>${statusCounts.abnormal || 0}</strong>`;
    
    previewStats.innerHTML = statsHtml;
}

function parseImportCSVContent(csvContent) {
    console.log('📊 Parsing CSV...');
    
    const lines = csvContent.trim().split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
        throw new Error('CSV file is empty or has no data rows');
    }
    
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    console.log('📋 Headers:', headers);
    
    const columnMap = {
        patientName: -1,
        patientId: -1,
        test: -1,
        status: -1,
        results: -1,
        date: -1,
        patientType: -1,
        notes: -1
    };
    
    const patterns = {
        patientName: ['patient name', 'patientname', 'name', 'patient', 'full name'],
        patientId: ['patient id', 'patientid', 'id', 'patient_id', 'pid'],
        test: ['test', 'test type', 'testtype', 'test_type', 'lab test'],
        status: ['status', 'result status', 'test status'],
        results: ['results', 'result', 'findings', 'test results', 'value'],
        date: ['date', 'test date', 'testdate', 'test_date'],
        patientType: ['patient type', 'patienttype', 'type', 'patient_type', 'category'],
        notes: ['notes', 'comments', 'remarks']
    };
    
    for (const [field, fieldPatterns] of Object.entries(patterns)) {
        const index = headers.findIndex(h => 
            fieldPatterns.some(p => h.includes(p) || p.includes(h))
        );
        if (index !== -1) columnMap[field] = index;
    }
    
    console.log('🗺️ Column map:', columnMap);
    
    if (columnMap.patientId === -1) throw new Error('Missing required column: Patient ID');
    if (columnMap.patientName === -1) throw new Error('Missing required column: Patient Name');
    if (columnMap.test === -1) throw new Error('Missing required column: Test');
    if (columnMap.results === -1) throw new Error('Missing required column: Results');
    if (columnMap.date === -1) throw new Error('Missing required column: Date');
    
    const results = [];
    const errors = [];
    
    for (let i = 1; i < lines.length; i++) {
        try {
            const values = parseCSVLine(lines[i]);
            
            if (values.length < 3) continue;
            
            const result = {
                patientName: values[columnMap.patientName]?.trim() || '',
                patientId: values[columnMap.patientId]?.trim() || '',
                test: values[columnMap.test]?.trim() || '',
                status: (values[columnMap.status]?.trim() || 'pending').toLowerCase(),
                results: values[columnMap.results]?.trim() || '',
                date: values[columnMap.date]?.trim() || '',
                patientType: columnMap.patientType >= 0 ? 
                    (values[columnMap.patientType]?.trim() || 'Gynecology') : 'Gynecology',
                notes: columnMap.notes >= 0 ? 
                    (values[columnMap.notes]?.trim() || '') : ''
            };
            
            if (!result.patientName || !result.patientId || !result.test || 
                !result.results || !result.date) {
                errors.push(`Row ${i + 1}: Missing required data`);
                continue;
            }
            
            if (!['pending', 'normal', 'abnormal'].includes(result.status)) {
                result.status = 'pending';
            }
            
            if (!/^\d{4}-\d{2}-\d{2}$/.test(result.date)) {
                const parsed = new Date(result.date);
                if (!isNaN(parsed.getTime())) {
                    const year = parsed.getFullYear();
                    const month = String(parsed.getMonth() + 1).padStart(2, '0');
                    const day = String(parsed.getDate()).padStart(2, '0');
                    result.date = `${year}-${month}-${day}`;
                } else {
                    errors.push(`Row ${i + 1}: Invalid date`);
                    continue;
                }
            }
            
            results.push(result);
            
        } catch (error) {
            errors.push(`Row ${i + 1}: ${error.message}`);
        }
    }
    
    console.log(`✅ Parsed ${results.length} rows (${errors.length} errors)`);
    
    if (errors.length > 0) {
        console.warn('⚠️ Errors:', errors.slice(0, 5));
    }
    
    if (results.length === 0) {
        throw new Error('No valid data rows found');
    }
    
    return results;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

// REMOVED DUPLICATE: window.importLabResults = async function() {

window.processImage = function() {
    console.log('🖼️ Process image');
    showMessage('Image processing with OCR coming soon!', 'info');
};

// REMOVED DUPLICATE: OLD openImportModal (lines 1776-1798)

// Initialize handlers
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM loaded - initializing import');
    setTimeout(setupFileImportHandlers, 500);
    setTimeout(setupFileImportHandlers, 1000);
    setTimeout(setupFileImportHandlers, 2000);
});

// REMOVED OLD IMPORT BUTTON LISTENER - Using new clean version below

console.log('✅ Lab Results Import System v5.0.1 Loaded!');

class LabResultsApplication {
    constructor() {
        this.authManager = null;
        this.topBarManager = null;
        this.imageProcessor = new ImageProcessor();
        
        this.currentPage = 1;
        this.recordsPerPage = 8;
        this.filteredResults = [];
        this.allResults = [];
        this.allPatients = [];

        this.importedData = [];
        this.validationErrors = [];
        this.importStats = {
            total: 0,
            valid: 0,
            invalid: 0,
            duplicates: 0
        };

        this.patientSearchState = {
            isOpen: false,
            selectedPatient: null,
            filteredPatients: [],
            currentQuery: ''
        };

        this.patientSearchInput = null;
        this.patientDropdownList = null;
        this.searchableDropdown = null;
        
        // Image import state
        this.currentImageFile = null;
        this.currentImageData = null;
        this.importType = 'data'; // 'data' or 'image'
    }

    async initialize() {
        try {
            console.log('🚀 Initializing Lab Results System...');
            
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            auth = firebase.auth();
            database = firebase.database();
            labResultsRef = database.ref('labResults');
            patientsRef = database.ref('patients');
            notificationsRef = database.ref('notifications');
            
            console.log('Firebase initialized successfully');
            
            this.authManager = new AuthenticationManager();
            this.topBarManager = new TopBarManager();
            await this.initializeNotificationSystem();
            this.setupSidebarDropdown();
            
        } catch (error) {
            console.error('Firebase initialization error:', error);
            this.initializeLocalStorage();
        }
    }

    onAuthenticated() {
        if (!this.authManager?.isAuthenticated) {
            console.log('User not authenticated');
            return;
        }

        console.log('🚀 Initializing Lab Results for authenticated user...');
        this.initializeLabResultsSystem();
    }

    async initializeLabResultsSystem() {
        try {
            this.setupRealtimeListeners();
            this.loadPatients();
            this.loadLabResults();
            this.startAbnormalResultsMonitoring();
            this.setupEventListeners();
            
            console.log('✅ Lab Results System initialized successfully');
            
        } catch (error) {
            console.error('⚠️ Error initializing Lab Results System:', error);
            this.handleFirebaseError(error);
        }
    }

    setupSidebarDropdown() {
        console.log('Setting up sidebar dropdown...');
        
        const sidebarUser = document.querySelector('.sidebar .user');
        const sidebarDropdown = document.querySelector('.sidebar .dropdown-menu');
        
        if (!sidebarUser || !sidebarDropdown) {
            console.error('Sidebar elements not found');
            return;
        }

        sidebarDropdown.classList.remove('show');

        sidebarUser.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebarDropdown.classList.toggle('show');
            console.log('Sidebar dropdown toggled');
        });

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (confirm('Are you sure you want to logout?')) {
                    sidebarDropdown.classList.remove('show');
                    await this.authManager?.logout();
                }
            });
        }

        document.addEventListener('click', () => {
            sidebarDropdown.classList.remove('show');
        });

        sidebarDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    async initializeNotificationSystem() {
        if (database && window.notificationSystem) {
            try {
                await window.notificationSystem.initialize(database, currentUser);
                console.log('✅ Notification system initialized for Lab Results');
            } catch (error) {
                console.error('Failed to initialize notification system:', error);
            }
        }
    }

    startAbnormalResultsMonitoring() {
        setInterval(() => {
            this.checkForCriticalResults();
        }, 15 * 60 * 1000);
        
        setTimeout(() => {
            this.checkForCriticalResults();
        }, 5000);
    }

    checkForCriticalResults() {
        const criticalResults = this.allResults.filter(result => 
            result.status === 'abnormal' && !result.acknowledged
        );
        
        criticalResults.forEach(result => {
            const notificationKey = `lab_critical_${result.id}`;
            if (!this.hasRecentNotification(notificationKey)) {
                if (window.NotificationIntegration && window.NotificationIntegration.labResults) {
                    window.NotificationIntegration.labResults.notifyAbnormalResult(result);
                }
                
                if (result.test && result.test.toLowerCase().includes('drug level')) {
                    this.triggerMedicationReview(result);
                }
                
                this.markNotificationSent(notificationKey);
            }
        });
    }

    triggerMedicationReview(labResult) {
        if (window.notificationSystem) {
            window.notificationSystem.createNotification({
                title: 'Medication Review Required',
                message: `Abnormal drug levels detected for ${labResult.patientName}. Please review current medications immediately.`,
                type: 'warning',
                category: 'medications',
                priority: 'urgent',
                metadata: {
                    patientId: labResult.patientId,
                    labResultId: labResult.id,
                    testType: labResult.test,
                    triggerModule: 'lab-results'
                },
                actionUrl: 'Medications.html',
                actionText: 'Review Medications Now'
            });
        }
    }

    hasRecentNotification(key) {
        const sent = localStorage.getItem(`notif_sent_${key}`);
        if (!sent) return false;
        
        const sentTime = parseInt(sent);
        const hoursSince = (Date.now() - sentTime) / (1000 * 60 * 60);
        
        return hoursSince < 24;
    }

    markNotificationSent(key) {
        localStorage.setItem(`notif_sent_${key}`, Date.now().toString());
    }

    async loadPatients() {
        console.log('📚 Loading patients from Firebase...');
        
        try {
            patientsRef.on('value', (snapshot) => {
                console.log('👥 Patients data received. Exists:', snapshot.exists());
                
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    this.allPatients = Object.entries(data).map(([key, value]) => ({
                        key: key,
                        patientId: value.patientId || value.id || key,
                        fullName: value.fullName || value.name || 'Unknown',
                        firstName: value.firstName || '',
                        lastName: value.lastName || '',
                        middleName: value.middleName || '',
                        age: value.age || 'N/A',
                        status: value.status || 'Unknown',
                        birthdate: value.birthdate || '',
                        dueDate: value.dueDate || value.expectedDueDate || '',
                        phone: value.phone || value.phoneNumber || '',
                        email: value.email || '',
                        ...value
                    }));
                    
                    this.allPatients.sort((a, b) => {
                        const aNum = parseInt(a.patientId.replace('PT', ''));
                        const bNum = parseInt(b.patientId.replace('PT', ''));
                        return aNum - bNum;
                    });
                    
                    console.log(`✅ Loaded ${this.allPatients.length} patients`);
                } else {
                    this.allPatients = [];
                    console.log('🔭 No patients found in database');
                }
                
                if (this.patientDropdownList) {
                    this.populatePatientDropdown();
                }
                
            }, (error) => {
                console.error('❌ Firebase patients database error:', error);
                this.allPatients = [];
            });
        } catch (error) {
            console.error('❌ Error setting up patients Firebase listener:', error);
            this.allPatients = [];
        }
    }

    setupRealtimeListeners() {
        if (!labResultsRef) return;
        
        labResultsRef.on('value', (snapshot) => {
            const data = snapshot.val();
            this.allResults = [];
            
            if (data) {
                Object.keys(data).forEach(key => {
                    this.allResults.push({
                        id: key,
                        ...data[key]
                    });
                });
            }
            
            this.filteredResults = [...this.allResults];
            this.renderTable();
            this.updatePagination();
            this.updateAbnormalCount();
        });
        
        labResultsRef.on('child_added', (snapshot) => {
            console.log('New lab result added:', snapshot.key);
            
            const result = snapshot.val();
            if (result && window.NotificationIntegration && window.NotificationIntegration.labResults) {
                window.NotificationIntegration.labResults.notifyNewLabResult({
                    id: snapshot.key,
                    ...result
                });
                
                if (result.status === 'abnormal') {
                    window.NotificationIntegration.labResults.notifyAbnormalResult({
                        id: snapshot.key,
                        ...result
                    });
                }
            }
        });
        
        labResultsRef.on('child_changed', (snapshot) => {
            console.log('Lab result updated:', snapshot.key);
            
            const updatedResult = snapshot.val();
            if (updatedResult && updatedResult.status === 'abnormal') {
                const notificationKey = `lab_status_change_${snapshot.key}`;
                if (!this.hasRecentNotification(notificationKey)) {
                    if (window.NotificationIntegration && window.NotificationIntegration.labResults) {
                        window.NotificationIntegration.labResults.notifyAbnormalResult({
                            id: snapshot.key,
                            ...updatedResult
                        });
                    }
                    this.markNotificationSent(notificationKey);
                }
            }
        });
        
        labResultsRef.on('child_removed', (snapshot) => {
            console.log('Lab result removed:', snapshot.key);
        });
    }

    initializeLocalStorage() {
        console.log('Using localStorage as fallback');
        this.loadFromLocalStorage();
    }

    loadLabResults() {
        if (!labResultsRef) {
            // If Firebase is not available, use localStorage
            console.log('Firebase not available, loading from localStorage');
            this.loadFromLocalStorage();
        } else {
            // Firebase is available, listeners are already set up in setupRealtimeListeners()
            console.log('Firebase available, using realtime listeners for lab results');
        }
    }

    loadFromLocalStorage() {
        const stored = localStorage.getItem('labResults');
        if (stored) {
            this.allResults = JSON.parse(stored);
        } else {
            this.allResults = [];
            this.saveToLocalStorage();
        }
        
        const storedPatients = localStorage.getItem('patients');
        if (storedPatients) {
            try {
                const patientsObj = JSON.parse(storedPatients);
                this.allPatients = Object.entries(patientsObj).map(([key, value]) => ({
                    key: key,
                    patientId: value.patientId || value.id || key,
                    fullName: value.fullName || value.name || 'Unknown',
                    ...value
                }));
            } catch (error) {
                console.error('Error parsing stored patients:', error);
                this.allPatients = [];
            }
        }
        
        this.filteredResults = [...this.allResults];
        this.renderTable();
        this.updatePagination();
        this.updateAbnormalCount();
    }

    saveToLocalStorage() {
        localStorage.setItem('labResults', JSON.stringify(this.allResults));
    }

    handleFirebaseError(error) {
        console.error('Firebase error:', error);
        this.initializeLocalStorage();
    }

    renderTable() {
        const tableBody = document.getElementById('labTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        const startIndex = (this.currentPage - 1) * this.recordsPerPage;
        const endIndex = startIndex + this.recordsPerPage;
        const pageResults = this.filteredResults.slice(startIndex, endIndex);
        
        pageResults.forEach(result => {
            const row = this.createTableRow(result);
            tableBody.appendChild(row);
        });
        
        if (this.filteredResults.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td colspan="6" class="no-data">
                    <i class="fas fa-flask"></i>
                    <h3>No lab results found</h3>
                    <p>Add a new lab result to get started</p>
                </td>
            `;
            tableBody.appendChild(emptyRow);
        }
    }

    createTableRow(result) {
        const row = document.createElement('tr');
        row.dataset.resultId = result.id;
        
        row.innerHTML = `
            <td>
                <span class="patient-id-cell">${result.patientId || 'N/A'}</span>
            </td>
            <td>
                <span class="patient-name-cell">${result.patientName || 'Unknown'}</span>
            </td>
            <td>
                ${result.patientType ? `<span class="patient-type-badge ${result.patientType.toLowerCase()}">${result.patientType}</span>` : '<span>-</span>'}
            </td>
            <td>${result.test || 'N/A'}</td>
            <td>
                <div class="results-value ${(result.status || 'pending').toLowerCase()}">
                    ${result.results || 'Results pending...'}
                    ${result.notes ? `<br><small>${result.notes}</small>` : ''}
                </div>
            </td>
            <td>${result.date || 'N/A'}</td>
            <td>
                <span class="status ${(result.status || 'pending').toLowerCase()}">${result.status || 'Pending'}</span>
            </td>
            <td>
                <div class="actions">
                    <button class="btn view" onclick="viewResult('${result.id}')">View</button>
                    ${this.authManager?.hasPermission('edit') ? `<button class="btn edit" onclick="editResult('${result.id}')">Edit</button>` : ''}
                    ${this.authManager?.hasPermission('delete') || this.authManager?.isAdmin ? `<button class="btn delete" onclick="deleteResult('${result.id}')">Delete</button>` : ''}
                </div>
            </td>
        `;
        
        return row;
    }

    async addLabResult(resultData) {
        console.log('🔍 addLabResult called with data:', resultData);
        
        if (!this.authManager?.hasPermission('add')) {
            console.error('❌ Permission denied');
            this.showMessage('You do not have permission to add lab results', 'error');
            return;
        }
        
        console.log('✅ Permission check passed');

        const newResult = {
            patientName: resultData.patientName,
            patientId: resultData.patientId,
            patientType: resultData.patientType,
            test: resultData.test,
            status: resultData.status,
            results: resultData.results,
            notes: resultData.notes || '',
            date: resultData.date,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            acknowledged: false,
            createdBy: this.authManager?.currentUser?.uid,
            createdByName: this.authManager?.userDisplayName,
            imageData: resultData.imageData || null, // Store image data if available
            // Store imported file information
            importedFile: resultData.importedFile || null // { fileName, fileType, fileData, fileSize }
        };
        
        console.log('📝 New result object created:', newResult);
        
        if (labResultsRef) {
            console.log('💾 Saving to Firebase...');
            try {
                await labResultsRef.push(newResult);
                console.log('✅ Successfully saved to Firebase');
                this.showMessage('Lab result added successfully!', 'success');
                this.closeModal('addLabModal');
                
                this.authManager?.logUserActivity('add_lab_result', {
                    patientId: newResult.patientId,
                    testType: newResult.test,
                    status: newResult.status,
                    fromImage: !!resultData.imageData
                });
            } catch (error) {
                console.error('❌ Error adding lab result:', error);
                this.showMessage('Error adding lab result: ' + error.message, 'error');
            }
        } else {
            console.log('💾 Saving to localStorage (Firebase not available)...');
            newResult.id = Date.now().toString();
            this.allResults.push(newResult);
            this.saveToLocalStorage();
            this.loadFromLocalStorage();
            console.log('✅ Successfully saved to localStorage');
            this.showMessage('Lab result added successfully!', 'success');
            this.closeModal('addLabModal');
        }
    }

    async updateLabResult(id, resultData) {
        if (!this.authManager?.hasPermission('edit')) {
            this.showMessage('You do not have permission to edit lab results', 'error');
            return;
        }

        const updatedResult = {
            ...resultData,
            updatedAt: new Date().toISOString(),
            updatedBy: this.authManager?.currentUser?.uid,
            updatedByName: this.authManager?.userDisplayName
        };
        
        if (labResultsRef) {
            labResultsRef.child(id).update(updatedResult)
                .then(() => {
                    this.showMessage('Lab result updated successfully!', 'success');
                    this.closeModal('resultModal');
                    
                    this.authManager?.logUserActivity('update_lab_result', {
                        resultId: id,
                        patientId: updatedResult.patientId,
                        testType: updatedResult.test
                    });
                })
                .catch((error) => {
                    console.error('Error updating lab result:', error);
                    this.showMessage('Error updating lab result. Please try again.', 'error');
                });
        } else {
            const index = this.allResults.findIndex(result => result.id === id);
            if (index !== -1) {
                this.allResults[index] = { ...this.allResults[index], ...updatedResult };
                this.saveToLocalStorage();
                this.loadFromLocalStorage();
                this.showMessage('Lab result updated successfully!', 'success');
                this.closeModal('resultModal');
            }
        }
    }

    async deleteLabResult(id) {
        if (!this.authManager?.hasPermission('delete') && !this.authManager?.isAdmin) {
            this.showMessage('You do not have permission to delete lab results', 'error');
            return;
        }

        if (!confirm('Are you sure you want to delete this lab result? This action cannot be undone.')) {
            return;
        }
        
        if (labResultsRef) {
            labResultsRef.child(id).remove()
                .then(() => {
                    this.showMessage('Lab result deleted successfully!', 'success');
                    
                    this.authManager?.logUserActivity('delete_lab_result', {
                        resultId: id
                    });
                })
                .catch((error) => {
                    console.error('Error deleting lab result:', error);
                    this.showMessage('Error deleting lab result. Please try again.', 'error');
                });
        } else {
            this.allResults = this.allResults.filter(result => result.id !== id);
            this.saveToLocalStorage();
            this.loadFromLocalStorage();
            this.showMessage('Lab result deleted successfully!', 'success');
        }
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e));
        }

        const addLabBtn = document.getElementById('addLabBtn');
        if (addLabBtn) {
            addLabBtn.addEventListener('click', () => this.showAddLabModal());
        }

        // Initialize the clean import system
        if (typeof initializeImportSystem === 'function') {
            initializeImportSystem();
            console.log('✅ Import system initialized from setupEventListeners');
        }

        const viewAbnormalBtn = document.getElementById('viewAbnormalBtn');
        if (viewAbnormalBtn) {
            viewAbnormalBtn.addEventListener('click', () => this.showAbnormalResults());
        }

        this.setupModalEvents();
    }

    handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        
        if (searchTerm === '') {
            this.filteredResults = [...this.allResults];
        } else {
            this.filteredResults = this.allResults.filter(result => 
                (result.patientName && result.patientName.toLowerCase().includes(searchTerm)) ||
                (result.patientId && result.patientId.toLowerCase().includes(searchTerm)) ||
                (result.test && result.test.toLowerCase().includes(searchTerm)) ||
                (result.status && result.status.toLowerCase().includes(searchTerm))
            );
        }
        
        this.currentPage = 1;
        this.renderTable();
        this.updatePagination();
    }

    showAddLabModal() {
        if (!this.authManager?.hasPermission('add')) {
            this.showMessage('You do not have permission to add lab results', 'error');
            return;
        }

        const modal = document.getElementById('addLabModal');
        const form = document.getElementById('addLabForm');
        
        if (!modal) {
            console.error('Add Lab Modal not found');
            return;
        }
        
        if (form) {
            form.reset();
            
            const today = new Date().toISOString().split('T')[0];
            const dateInput = document.getElementById('testDate');
            if (dateInput) {
                dateInput.value = today;
            }
        }
        
        this.clearPatientSelection();
        
        setTimeout(() => {
            this.initializeSearchableDropdown();
            const patientInput = document.getElementById('patientSelect');
            if (patientInput) {
                patientInput.value = '';
                patientInput.classList.remove('has-selection');
            }
        }, 100);
        
        this.setupAddLabFormSubmission();
        
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
        this.setupModalEvents();
    }

    setupAddLabFormSubmission() {
        const form = document.getElementById('addLabForm');
        if (!form) {
            console.error('❌ Add Lab Form not found');
            return;
        }
        
        console.log('✅ Setting up form submission handler');
        
        const self = this;
        
        // Remove any existing submit event listeners by cloning
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        // Add the submit event listener
        newForm.addEventListener('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('📝 Form submitted');
            
            // Get all form values
            const patientSelectValue = document.getElementById('patientSelect')?.value.trim();
            const patientType = document.getElementById('patientType')?.value;
            const testType = document.getElementById('testType')?.value;
            const status = document.getElementById('status')?.value;
            const results = document.getElementById('results')?.value.trim();
            const doctorNotes = document.getElementById('doctorNotes')?.value.trim();
            const testDate = document.getElementById('testDate')?.value;
            
            // Validation
            if (!patientSelectValue) {
                self.showMessage('Please select a patient from the dropdown.', 'error');
                console.error('❌ No patient selected');
                return false;
            }
            
            if (!self.patientSearchState.selectedPatient) {
                self.showMessage('Please select a valid patient from the dropdown list.', 'error');
                console.error('❌ Selected patient not found in state');
                return false;
            }
            
            if (!testType) {
                self.showMessage('Please select a test type.', 'error');
                console.error('❌ No test type selected');
                return false;
            }
            
            if (!status) {
                self.showMessage('Please select a status.', 'error');
                console.error('❌ No status selected');
                return false;
            }
            
            if (!results) {
                self.showMessage('Please enter test results.', 'error');
                console.error('❌ No results entered');
                return false;
            }
            
            if (!testDate) {
                self.showMessage('Please select a test date.', 'error');
                console.error('❌ No test date selected');
                return false;
            }
            
            console.log('✅ All validations passed');
            
            const selectedPatient = self.patientSearchState.selectedPatient;
            
            const resultData = {
                patientName: selectedPatient.name,
                patientId: selectedPatient.patientId,
                patientType: patientType,
                test: testType,
                status: status,
                results: results,
                notes: doctorNotes || '',
                date: testDate,
                imageData: self.currentImageData || null,
                importedFile: self.currentImportedFile || null
            };
            
            console.log('📊 Result data prepared:', resultData);
            
            // Call addLabResult
            self.addLabResult(resultData);
            
            // Reset form
            newForm.reset();
            self.clearPatientSelection();
            self.currentImageData = null;
            self.currentImportedFile = null;
            
            return false;
        });
        
        console.log('✅ Form submission handler setup complete');
    }


    updatePagination() {
        const totalRecords = this.filteredResults.length;
        const totalPages = Math.ceil(totalRecords / this.recordsPerPage);
        
        const paginationInfo = document.getElementById('paginationInfo');
        if (paginationInfo) {
            const startRecord = totalRecords === 0 ? 0 : ((this.currentPage - 1) * this.recordsPerPage) + 1;
            const endRecord = Math.min(this.currentPage * this.recordsPerPage, totalRecords);
            paginationInfo.textContent = `Showing ${startRecord}-${endRecord} of ${totalRecords} entries`;
        }

        this.updatePaginationButtons(totalPages);
    }

    updatePaginationButtons(totalPages) {
        const paginationControls = document.querySelector('.pagination-controls');
        if (!paginationControls) return;

        paginationControls.innerHTML = `
            <button class="pagination-btn" onclick="changePage(-1)" ${this.currentPage === 1 || totalPages === 0 ? 'disabled' : ''}>‹</button>
            <button class="pagination-btn active" onclick="goToPage(${this.currentPage})">${this.currentPage}</button>
            <button class="pagination-btn" onclick="changePage(1)" ${this.currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}>›</button>
        `;
    }

    showAbnormalResults() {
        const abnormalResults = this.allResults.filter(result => 
            result.status && result.status.toLowerCase() === 'abnormal'
        );
        
        if (abnormalResults.length === 0) {
            this.showMessage('No abnormal results found.', 'success');
            return;
        }
        
        this.filteredResults = abnormalResults;
        this.currentPage = 1;
        this.renderTable();
        this.updatePagination();
        
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.style.border = '2px solid #e91e63';
            setTimeout(() => {
                tableContainer.style.border = '';
            }, 3000);
        }
        
        this.showMessage(`Found ${abnormalResults.length} abnormal result(s)`, 'success');
    }

    updateAbnormalCount() {
        const abnormalCount = this.allResults.filter(result => 
            result.status && result.status.toLowerCase() === 'abnormal'
        ).length;
        
        const abnormalCountElement = document.getElementById('abnormalCount');
        if (abnormalCountElement) {
            abnormalCountElement.textContent = `${abnormalCount} abnormal lab results require immediate review`;
        }
        
        const alert = document.querySelector('.alert');
        if (alert) {
            alert.style.display = abnormalCount > 0 ? 'flex' : 'none';
        }
    }

    setupModalEvents() {
        // Remove existing event listeners to prevent duplicates
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.replaceWith(closeBtn.cloneNode(true));
        });
        
        // Add new event listeners
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const modal = closeBtn.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    
                    if (modal.id === 'editModal' || modal.id === 'addLabModal') {
                        this.clearPatientSelection();
                    }
                    
                    if (modal.id === 'importModal') {
                        this.resetImportState();
                    }
                }
            });
        });
        
        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    
                    if (modal.id === 'editModal' || modal.id === 'addLabModal') {
                        this.clearPatientSelection();
                    }
                    
                    if (modal.id === 'importModal') {
                        this.resetImportState();
                    }
                }
            });
        });
        
        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModals = document.querySelectorAll('.modal[style*="block"]');
                openModals.forEach(modal => {
                    if (modal.id !== 'authRequiredModal') {
                        modal.style.display = 'none';
                        document.body.classList.remove('modal-open');
                        
                        if (modal.id === 'editModal' || modal.id === 'addLabModal') {
                            this.clearPatientSelection();
                        }
                        
                        if (modal.id === 'importModal') {
                            this.resetImportState();
                        }
                    }
                });
            }
        });
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
            
            // Clear states based on modal type
            if (modalId === 'editModal' || modalId === 'addLabModal') {
                this.clearPatientSelection();
            }
            
            if (modalId === 'importModal') {
                this.resetImportState();
            }
            
            if (modalId === 'imageProcessingModal') {
                // Reset processing steps
                const steps = ['step1', 'step2', 'step3', 'step4'];
                steps.forEach((stepId, index) => {
                    const stepElement = document.getElementById(stepId);
                    if (stepElement) {
                        if (index === 0) {
                            stepElement.style.color = '#2196f3';
                            stepElement.innerHTML = `<i class="fas fa-circle-notch fa-spin" style="color: #2196f3;"></i><span>Enhancing image quality...</span>`;
                        } else {
                            stepElement.style.color = '#ccc';
                            stepElement.innerHTML = `<i class="fas fa-circle" style="color: #ccc;"></i><span>${stepElement.textContent}</span>`;
                        }
                    }
                });
            }
        }
    }

    // SEARCHABLE PATIENT DROPDOWN FUNCTIONALITY
    initializeSearchableDropdown() {
        console.log('Initializing searchable dropdown functionality...');
        
        setTimeout(() => {
            this.patientSearchInput = document.getElementById("patientSelect");
            this.patientDropdownList = document.getElementById("patientDropdown");
            this.searchableDropdown = document.getElementById("patientSelectContainer");
            
            if (!this.patientSearchInput || !this.patientDropdownList || !this.searchableDropdown) {
                console.log('Searchable dropdown elements not found, retrying...', {
                    input: !!this.patientSearchInput,
                    dropdown: !!this.patientDropdownList,
                    container: !!this.searchableDropdown
                });
                setTimeout(() => this.initializeSearchableDropdown(), 1000);
                return;
            }
            
            console.log('Searchable dropdown elements found, setting up event listeners...');
            
            // Remove existing event listeners by cloning
            const newInput = this.patientSearchInput.cloneNode(true);
            this.patientSearchInput.parentNode.replaceChild(newInput, this.patientSearchInput);
            this.patientSearchInput = newInput;
            
            const newDropdown = this.patientDropdownList.cloneNode(true);
            this.patientDropdownList.parentNode.replaceChild(newDropdown, this.patientDropdownList);
            this.patientDropdownList = newDropdown;
            
            // Add event listeners
            this.patientSearchInput.addEventListener('input', (e) => this.handlePatientSearch(e));
            this.patientSearchInput.addEventListener('focus', (e) => this.handlePatientFocus(e));
            this.patientSearchInput.addEventListener('blur', (e) => this.handlePatientBlur(e));
            this.patientSearchInput.addEventListener('keydown', (e) => this.handlePatientKeydown(e));
            
            this.patientDropdownList.addEventListener('click', (e) => this.handlePatientOptionClick(e));
            
            this.patientDropdownList.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });
            
            console.log('Searchable dropdown initialized successfully');
        }, 500);
    }

    handlePatientSearch(e) {
        const query = e.target.value.trim();
        this.patientSearchState.currentQuery = query;
        
        console.log('Patient search query:', query);
        
        if (query.length === 0) {
            this.closeDropdown();
            this.clearPatientSelection();
        } else if (query.length >= 1) {
            const allPatientsForDropdown = this.getAllPatientsForDropdown();
            this.patientSearchState.filteredPatients = allPatientsForDropdown.filter(patient => {
                const nameMatch = patient.name.toLowerCase().includes(query.toLowerCase());
                const idMatch = patient.patientId.toLowerCase().includes(query.toLowerCase());
                return nameMatch || idMatch;
            });
            
            this.updateDropdownDisplay();
            this.openDropdown();
        }
        
        if (this.patientSearchState.selectedPatient) {
            const selectedMatches = this.patientSearchState.selectedPatient.name.toLowerCase().includes(query.toLowerCase()) ||
                                  this.patientSearchState.selectedPatient.patientId.toLowerCase().includes(query.toLowerCase());
            if (!selectedMatches && query.length > 0) {
                this.clearPatientSelection();
            }
        }
    }

    handlePatientFocus(e) {
        console.log('Patient input focused');
        
        const query = e.target.value.trim();
        if (query.length > 0) {
            if (this.patientSearchState.filteredPatients.length === 0) {
                this.patientSearchState.filteredPatients = this.getAllPatientsForDropdown();
                this.updateDropdownDisplay();
            }
            this.openDropdown();
        } else {
            this.updateDropdownPlaceholder();
            this.openDropdown();
        }
    }

    handlePatientBlur(e) {
        console.log('Patient input blurred');
        
        setTimeout(() => {
            this.closeDropdown();
        }, 200);
    }

    handlePatientKeydown(e) {
        const options = this.patientDropdownList.querySelectorAll('.dropdown-item:not(.no-results)');
        const currentSelected = this.patientDropdownList.querySelector('.dropdown-item.selected');
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (options.length === 0) break;
                
                let nextIndex = 0;
                if (currentSelected) {
                    const currentIndex = Array.from(options).indexOf(currentSelected);
                    nextIndex = (currentIndex + 1) % options.length;
                    currentSelected.classList.remove('selected');
                }
                options[nextIndex].classList.add('selected');
                options[nextIndex].scrollIntoView({ block: 'nearest' });
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                if (options.length === 0) break;
                
                let prevIndex = options.length - 1;
                if (currentSelected) {
                    const currentIndex = Array.from(options).indexOf(currentSelected);
                    prevIndex = currentIndex === 0 ? options.length - 1 : currentIndex - 1;
                    currentSelected.classList.remove('selected');
                }
                options[prevIndex].classList.add('selected');
                options[prevIndex].scrollIntoView({ block: 'nearest' });
                break;
                
            case 'Enter':
                e.preventDefault();
                if (currentSelected) {
                    this.selectPatientFromOption(currentSelected);
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                this.closeDropdown();
                break;
        }
    }

    handlePatientOptionClick(e) {
        const option = e.target.closest('.dropdown-item');
        if (option && !option.classList.contains('no-results')) {
            this.selectPatientFromOption(option);
        }
    }

    selectPatientFromOption(option) {
        const patientKey = option.dataset.patientKey;
        const patientId = option.dataset.patientId;
        const patientName = option.dataset.patientName;
        
        if (!patientKey || !patientId || !patientName) {
            console.error('Invalid patient option data', option.dataset);
            return;
        }
        
        this.patientSearchState.selectedPatient = {
            key: patientKey,
            patientId: patientId,
            name: patientName,
            age: option.dataset.age,
            status: option.dataset.status,
            dueDate: option.dataset.dueDate,
            phone: option.dataset.phone,
            email: option.dataset.email
        };
        
        this.patientSearchInput.value = patientName;
        this.patientSearchInput.classList.add('has-selection');
        
        const selectedPatientIdInput = document.getElementById('selectedPatientId');
        if (selectedPatientIdInput) {
            selectedPatientIdInput.value = patientId;
        }
        
        this.closeDropdown();
        this.showSelectedPatientInfo();
        
        console.log('Patient selected:', this.patientSearchState.selectedPatient);
    }

    clearPatientSelection() {
        this.patientSearchState.selectedPatient = null;
        
        if (this.patientSearchInput) {
            this.patientSearchInput.classList.remove('has-selection');
            this.patientSearchInput.value = '';
        }
        
        const selectedPatientIdInput = document.getElementById('selectedPatientId');
        if (selectedPatientIdInput) {
            selectedPatientIdInput.value = '';
        }
        
        const existingInfo = document.querySelector('.patient-confirmation');
        if (existingInfo) {
            existingInfo.remove();
        }
    }

    openDropdown() {
        if (!this.searchableDropdown || !this.patientDropdownList) return;
        
        this.patientSearchState.isOpen = true;
        this.searchableDropdown.classList.add('open');
        this.patientDropdownList.style.display = 'block';
        
        console.log('Dropdown opened');
    }

    closeDropdown() {
        if (!this.searchableDropdown || !this.patientDropdownList) return;
        
        this.patientSearchState.isOpen = false;
        this.searchableDropdown.classList.remove('open');
        this.patientDropdownList.style.display = 'none';
        
        const selectedOption = this.patientDropdownList.querySelector('.dropdown-item.selected');
        if (selectedOption) {
            selectedOption.classList.remove('selected');
        }
        
        console.log('Dropdown closed');
    }

    getAllPatientsForDropdown() {
        const patients = [];
        
        if (!this.allPatients || this.allPatients.length === 0) {
            console.log('No patients data available for dropdown');
            return patients;
        }
        
        try {
            this.allPatients.forEach(patient => {
                const patientInfo = this.processPatientData(patient);
                if (patientInfo) {
                    patients.push(patientInfo);
                }
            });
            
            patients.sort((a, b) => {
                const aIsActive = a.status === 'Ongoing' || a.status === 'Active' || a.status === 'Scheduled';
                const bIsActive = b.status === 'Ongoing' || b.status === 'Active' || b.status === 'Scheduled';
                
                if (aIsActive && !bIsActive) return -1;
                if (!aIsActive && bIsActive) return 1;
                
                return a.name.localeCompare(b.name);
            });
            
        } catch (error) {
            console.error('Error processing patients for dropdown', error);
        }
        
        console.log(`Prepared ${patients.length} patients for dropdown`);
        return patients;
    }

    processPatientData(patient) {
        if (!patient) return null;
        
        try {
            const name = patient.fullName || patient.name || 'Unknown Patient';
            const patientId = patient.patientId || patient.id || 'Unknown ID';
            
            return {
                key: patient.key,
                name: name,
                patientId: patientId,
                age: patient.age || 'N/A',
                status: patient.status || 'Unknown',
                dueDate: patient.dueDate || 'N/A',
                phone: patient.phone || 'N/A',
                email: patient.email || 'N/A'
            };
        } catch (error) {
            console.error('Error processing patient data', error);
            return null;
        }
    }

    updateDropdownPlaceholder() {
        if (!this.patientDropdownList) return;
        
        this.patientDropdownList.innerHTML = '';
        
        const placeholderOption = document.createElement('div');
        placeholderOption.className = 'dropdown-item no-results search-prompt';
        placeholderOption.innerHTML = `
            <i class="fas fa-search" style="margin-bottom: 8px; font-size: 24px; opacity: 0.3;"></i>
            <div>Start typing to search patients...</div>
            <small style="opacity: 0.7; margin-top: 4px; display: block;">Search by name or patient ID</small>
        `;
        
        this.patientDropdownList.appendChild(placeholderOption);
        
        console.log('Updated dropdown with placeholder message');
    }

    updateDropdownDisplay() {
        if (!this.patientDropdownList) return;
        
        this.patientDropdownList.innerHTML = '';
        
        if (this.patientSearchState.filteredPatients.length === 0) {
            const noResultsOption = document.createElement('div');
            noResultsOption.className = 'dropdown-item no-results';
            
            if (this.patientSearchState.currentQuery && this.patientSearchState.currentQuery.length > 0) {
                noResultsOption.className += ' no-matches';
                noResultsOption.innerHTML = `
                    <i class="fas fa-exclamation-circle" style="margin-bottom: 8px; font-size: 20px;"></i>
                    <div>No patients found for "${this.patientSearchState.currentQuery}"</div>
                    <small style="opacity: 0.7; margin-top: 4px; display: block;">Try a different search term</small>
                `;
            } else {
                noResultsOption.className += ' search-prompt';
                noResultsOption.innerHTML = `
                    <i class="fas fa-search" style="margin-bottom: 8px; font-size: 24px; opacity: 0.3;"></i>
                    <div>Start typing to search patients...</div>
                    <small style="opacity: 0.7; margin-top: 4px; display: block;">Search by name or patient ID</small>
                `;
            }
            
            this.patientDropdownList.appendChild(noResultsOption);
            return;
        }
        
        this.patientSearchState.filteredPatients.forEach(patient => {
            const option = this.createPatientDropdownOption(patient);
            this.patientDropdownList.appendChild(option);
        });
        
        console.log(`Updated dropdown with ${this.patientSearchState.filteredPatients.length} patients`);
    }

    createPatientDropdownOption(patientInfo) {
        const option = document.createElement('div');
        option.className = 'dropdown-item';
        
        option.dataset.patientKey = patientInfo.key;
        option.dataset.patientId = patientInfo.patientId;
        option.dataset.patientName = patientInfo.name;
        option.dataset.age = patientInfo.age;
        option.dataset.status = patientInfo.status;
        option.dataset.dueDate = patientInfo.dueDate;
        option.dataset.phone = patientInfo.phone;
        option.dataset.email = patientInfo.email;
        
        const patientDisplay = document.createElement('div');
        patientDisplay.className = 'patient-info-dropdown';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'patient-name-dropdown';
        nameDiv.textContent = patientInfo.name;
        
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'patient-details-dropdown';
        
        const idSpan = document.createElement('span');
        idSpan.className = 'patient-id-dropdown';
        idSpan.textContent = `ID: ${patientInfo.patientId}`;
        
        const statusSpan = document.createElement('span');
        statusSpan.className = `patient-status-dropdown ${patientInfo.status === 'Ongoing' || patientInfo.status === 'Active' || patientInfo.status === 'Scheduled' ? 'active' : 'other'}`;
        statusSpan.textContent = patientInfo.status;
        
        detailsDiv.appendChild(idSpan);
        detailsDiv.appendChild(statusSpan);
        
        if (patientInfo.age !== 'N/A') {
            const ageSpan = document.createElement('span');
            ageSpan.textContent = `Age: ${patientInfo.age}`;
            detailsDiv.appendChild(ageSpan);
        }
        
        patientDisplay.appendChild(nameDiv);
        patientDisplay.appendChild(detailsDiv);
        option.appendChild(patientDisplay);
        
        return option;
    }

    showSelectedPatientInfo() {
        if (!this.patientSearchState.selectedPatient) return;
        
        const existingInfo = document.querySelector('.patient-confirmation');
        if (existingInfo) {
            existingInfo.remove();
        }
        
        // Find the correct form group container
        const patientContainer = document.getElementById('patientSelectContainer')?.closest('.form-group');
        if (!patientContainer) {
            console.warn('Patient container not found');
            return;
        }
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'patient-confirmation';
        
        const checkIcon = document.createElement('span');
        checkIcon.className = 'check-icon';
        checkIcon.textContent = '✓';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'patient-name';
        nameSpan.textContent = `${this.patientSearchState.selectedPatient.name} (ID: ${this.patientSearchState.selectedPatient.patientId})`;
        
        infoDiv.appendChild(checkIcon);
        infoDiv.appendChild(nameSpan);
        
        patientContainer.appendChild(infoDiv);
        
        console.log('Patient info display created');
    }

    populatePatientDropdown() {
        console.log('Populating patient dropdown...');
        
        this.patientSearchState.filteredPatients = this.getAllPatientsForDropdown();
        
        if (this.patientDropdownList) {
            this.updateDropdownDisplay();
        }
        
        console.log(`Patient dropdown populated with ${this.patientSearchState.filteredPatients.length} patients`);
    }

    // ========================================
    // IMAGE IMPORT FUNCTIONALITY
    // ========================================

    showImportModal() {
        if (!this.authManager?.hasPermission('add')) {
            this.showMessage('You do not have permission to import lab results', 'error');
            return;
        }

        const modal = document.getElementById('importModal');
        if (!modal) return;
        
        this.resetImportState();
        this.setupImportModalEvents();
        
        modal.style.display = 'block';
        this.setupModalEvents();
    }

    resetImportState() {
        this.importedData = [];
        this.validationErrors = [];
        this.importStats = { total: 0, valid: 0, invalid: 0, duplicates: 0 };
        this.currentImageFile = null;
        this.currentImageData = null;
        this.importType = 'data';
        
        // Reset UI elements
        const fileInput = document.getElementById('fileInput');
        const previewSection = document.getElementById('previewSection');
        const progressSection = document.getElementById('progressSection');
        const previewBtn = document.getElementById('previewBtn');
        const importBtn = document.getElementById('importBtn');
        const processImageBtn = document.getElementById('processImageBtn');
        const imagePreviewContainer = document.getElementById('imagePreviewContainer');
        
        if (fileInput) fileInput.value = '';
        if (previewSection) previewSection.style.display = 'none';
        if (progressSection) progressSection.style.display = 'none';
        if (previewBtn) previewBtn.disabled = true;
        if (importBtn) importBtn.disabled = true;
        if (processImageBtn) processImageBtn.disabled = true;
        if (imagePreviewContainer) imagePreviewContainer.classList.remove('active');
        
        // Reset file type selection
        const dataImportRadio = document.getElementById('dataImport');
        const imageImportRadio = document.getElementById('imageImport');
        if (dataImportRadio) dataImportRadio.checked = true;
        if (imageImportRadio) imageImportRadio.checked = false;
        
        this.updateImportTypeUI();
    }

    setupImportModalEvents() {
        // File type selection
        const fileTypeOptions = document.querySelectorAll('.file-type-option');
        fileTypeOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                const radio = option.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                    this.importType = radio.value;
                    this.updateImportTypeUI();
                }
            });
        });
        
        // Radio button change events
        const dataImportRadio = document.getElementById('dataImport');
        const imageImportRadio = document.getElementById('imageImport');
        
        if (dataImportRadio) {
            dataImportRadio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.importType = 'data';
                    this.updateImportTypeUI();
                }
            });
        }
        
        if (imageImportRadio) {
            imageImportRadio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.importType = 'image';
                    this.updateImportTypeUI();
                }
            });
        }
        
        // File input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        }
    }

    updateImportTypeUI() {
        const fileInput = document.getElementById('fileInput');
        const fileInputHint = document.getElementById('fileInputHint');
        const dataFormatGuide = document.getElementById('dataFormatGuide');
        const imageProcessingGuide = document.getElementById('imageProcessingGuide');
        const previewBtn = document.getElementById('previewBtn');
        const processImageBtn = document.getElementById('processImageBtn');
        const imagePreviewContainer = document.getElementById('imagePreviewContainer');
        
        // Update file type options styling
        document.querySelectorAll('.file-type-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        if (this.importType === 'data') {
            document.querySelector('.file-type-option[data-type="data"]')?.classList.add('selected');
            
            if (fileInput) {
                fileInput.accept = '.csv,.xlsx,.xls,.json';
            }
            if (fileInputHint) {
                fileInputHint.textContent = 'Supported formats: CSV, Excel (.xlsx, .xls), JSON';
            }
            if (dataFormatGuide) dataFormatGuide.style.display = 'block';
            if (imageProcessingGuide) imageProcessingGuide.style.display = 'none';
            if (previewBtn) previewBtn.style.display = 'inline-block';
            if (processImageBtn) processImageBtn.style.display = 'none';
            if (imagePreviewContainer) imagePreviewContainer.classList.remove('active');
            
        } else if (this.importType === 'image') {
            document.querySelector('.file-type-option[data-type="image"]')?.classList.add('selected');
            
            if (fileInput) {
                fileInput.accept = '.jpg,.jpeg,.png,.pdf,.tiff,.tif';
            }
            if (fileInputHint) {
                fileInputHint.textContent = 'Supported formats: JPG, PNG, PDF, TIFF';
            }
            if (dataFormatGuide) dataFormatGuide.style.display = 'none';
            if (imageProcessingGuide) imageProcessingGuide.style.display = 'block';
            if (previewBtn) previewBtn.style.display = 'none';
            if (processImageBtn) processImageBtn.style.display = 'inline-block';
        }
        
        // Reset file input
        if (fileInput) {
            fileInput.value = '';
            this.resetFileButtons();
        }
    }

    handleFileSelection(e) {
        const file = e.target.files[0];
        if (!file) {
            this.resetFileButtons();
            return;
        }
        
        console.log('File selected:', file.name, 'Type:', file.type, 'Size:', file.size);
        
        if (this.importType === 'data') {
            this.handleDataFileSelection(file);
        } else if (this.importType === 'image') {
            this.handleImageFileSelection(file);
        }
    }

    handleDataFileSelection(file) {
        const previewBtn = document.getElementById('previewBtn');
        const importBtn = document.getElementById('importBtn');
        const previewSection = document.getElementById('previewSection');
        
        if (previewBtn) previewBtn.disabled = false;
        if (importBtn) importBtn.disabled = true;
        if (previewSection) previewSection.style.display = 'none';
    }

    async handleImageFileSelection(file) {
        const processImageBtn = document.getElementById('processImageBtn');
        const imagePreviewContainer = document.getElementById('imagePreviewContainer');
        const imagePreview = document.getElementById('imagePreview');
        
        this.currentImageFile = file;
        
        if (processImageBtn) processImageBtn.disabled = false;
        
        // Show image preview
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (imagePreview && imagePreviewContainer) {
                    imagePreview.innerHTML = `
                        <img src="${e.target.result}" alt="Lab Result Preview" class="image-preview" id="previewImg">
                        <div class="image-info">
                            <span><strong>File:</strong> ${file.name}</span>
                            <span><strong>Size:</strong> ${(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            <span><strong>Type:</strong> ${file.type}</span>
                        </div>
                    `;
                    imagePreviewContainer.classList.add('active');
                    
                    // Show image actions
                    const imageActions = document.getElementById('imageActions');
                    if (imageActions) {
                        imageActions.style.display = 'flex';
                    }
                }
            };
            reader.readAsDataURL(file);
        } else {
            // For PDF and other non-image files
            if (imagePreview && imagePreviewContainer) {
                imagePreview.innerHTML = `
                    <div style="padding: 20px; text-align: center;">
                        <i class="fas fa-file-pdf" style="font-size: 48px; color: #d32f2f; margin-bottom: 10px;"></i>
                        <div class="image-info">
                            <span><strong>File:</strong> ${file.name}</span>
                            <span><strong>Size:</strong> ${(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            <span><strong>Type:</strong> ${file.type}</span>
                        </div>
                    </div>
                `;
                imagePreviewContainer.classList.add('active');
            }
        }
    }

    resetFileButtons() {
        const previewBtn = document.getElementById('previewBtn');
        const importBtn = document.getElementById('importBtn');
        const processImageBtn = document.getElementById('processImageBtn');
        const previewSection = document.getElementById('previewSection');
        const imagePreviewContainer = document.getElementById('imagePreviewContainer');
        
        if (previewBtn) previewBtn.disabled = true;
        if (importBtn) importBtn.disabled = true;
        if (processImageBtn) processImageBtn.disabled = true;
        if (previewSection) previewSection.style.display = 'none';
        if (imagePreviewContainer) imagePreviewContainer.classList.remove('active');
    }

    showMessage(message, type = 'success') {
        if (window.showNotification) {
            window.showNotification(message, type, 'lab-results');
        } else {
            const notification = document.createElement('div');
            notification.className = 'fallback-notification';
            
            const colors = {
                success: '#10b981',
                error: '#e63946',
                warning: '#f59e0b',
                info: '#3b82f6'
            };

            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${colors[type] || colors.info};
                color: white;
                padding: 15px 20px;
                border-radius: 12px;
                font-weight: 600;
                z-index: 10000;
                box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                max-width: 400px;
                animation: slideIn 0.4s ease-out;
                font-size: 14px;
                border-left: 4px solid rgba(255,255,255,0.3);
                white-space: pre-line;
                cursor: pointer;
            `;
            
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => notification.remove(), 300);
            }, type === 'error' ? 7000 : 4000);

            notification.addEventListener('click', () => {
                notification.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => notification.remove(), 300);
            });
        }
    }
}

// ========================================
// GLOBAL FUNCTIONS
// ========================================

function changePage(direction) {
    const totalPages = Math.ceil(window.labResultsApp.filteredResults.length / window.labResultsApp.recordsPerPage);
    const newPage = window.labResultsApp.currentPage + direction;
    
    if (newPage >= 1 && newPage <= totalPages) {
        window.labResultsApp.currentPage = newPage;
        window.labResultsApp.renderTable();
        window.labResultsApp.updatePagination();
    }
}

function goToPage(page) {
    const totalPages = Math.ceil(window.labResultsApp.filteredResults.length / window.labResultsApp.recordsPerPage);
    
    if (page >= 1 && page <= totalPages) {
        window.labResultsApp.currentPage = page;
        window.labResultsApp.renderTable();
        window.labResultsApp.updatePagination();
    }
}

// ========================================
// HELPER FUNCTION FOR DISPLAYING IMPORTED FILES
// ========================================

function getImportedFileDisplay(importedFile) {
    if (!importedFile) return '';
    
    const { fileName, fileType, fileData, fileSize } = importedFile;
    const fileSizeFormatted = formatFileSize(fileSize);
    
    let display = `
        <div class="imported-file-info">
            <div class="file-icon">
                ${getFileIcon(fileType)}
            </div>
            <div class="file-details">
                <p class="file-name"><strong>${fileName}</strong></p>
                <p class="file-meta">${fileType} • ${fileSizeFormatted}</p>
            </div>
        </div>
    `;
    
    // Display based on file type
    if (fileType.includes('image')) {
        // Display image
        display += `
            <div class="file-preview">
                <img src="${fileData}" alt="${fileName}" style="max-width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-top: 15px;">
            </div>
        `;
    } else if (fileType.includes('csv') || fileType.includes('excel') || fileType.includes('spreadsheet')) {
        // Display CSV/Excel data in a table
        const tableData = parseFileDataForDisplay(fileData, fileType);
        if (tableData) {
            display += `
                <div class="file-preview">
                    <div style="max-height: 400px; overflow: auto; margin-top: 15px; border: 1px solid #ddd; border-radius: 8px;">
                        ${tableData}
                    </div>
                </div>
            `;
        }
        display += `
            <div style="margin-top: 15px;">
                <button class="btn-download" onclick="downloadImportedFile('${fileName}', '${fileType}', '${fileData}')">
                    <i class="fas fa-download"></i> Download Original File
                </button>
            </div>
        `;
    } else if (fileType.includes('pdf')) {
        // For PDF, provide download link
        display += `
            <div style="margin-top: 15px;">
                <button class="btn-download" onclick="downloadImportedFile('${fileName}', '${fileType}', '${fileData}')">
                    <i class="fas fa-download"></i> Download PDF
                </button>
            </div>
        `;
    } else {
        // For other file types, provide download link
        display += `
            <div style="margin-top: 15px;">
                <button class="btn-download" onclick="downloadImportedFile('${fileName}', '${fileType}', '${fileData}')">
                    <i class="fas fa-download"></i> Download File
                </button>
            </div>
        `;
    }
    
    return display;
}

function getFileIcon(fileType) {
    if (fileType.includes('image')) {
        return '<i class="fas fa-image" style="font-size: 32px; color: #4caf50;"></i>';
    } else if (fileType.includes('csv')) {
        return '<i class="fas fa-file-csv" style="font-size: 32px; color: #2196f3;"></i>';
    } else if (fileType.includes('excel') || fileType.includes('spreadsheet')) {
        return '<i class="fas fa-file-excel" style="font-size: 32px; color: #4caf50;"></i>';
    } else if (fileType.includes('pdf')) {
        return '<i class="fas fa-file-pdf" style="font-size: 32px; color: #f44336;"></i>';
    } else {
        return '<i class="fas fa-file" style="font-size: 32px; color: #757575;"></i>';
    }
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function parseFileDataForDisplay(fileData, fileType) {
    try {
        if (fileType.includes('csv')) {
            // Parse CSV data
            const lines = fileData.split('\n').filter(line => line.trim());
            if (lines.length === 0) return null;
            
            let tableHTML = '<table style="width: 100%; border-collapse: collapse; background: white;">';
            
            // Header row
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            tableHTML += '<thead><tr>';
            headers.forEach(header => {
                tableHTML += `<th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5; text-align: left;">${header}</th>`;
            });
            tableHTML += '</tr></thead>';
            
            // Data rows
            tableHTML += '<tbody>';
            for (let i = 1; i < Math.min(lines.length, 50); i++) { // Show first 50 rows
                const cells = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                tableHTML += '<tr>';
                cells.forEach(cell => {
                    tableHTML += `<td style="border: 1px solid #ddd; padding: 8px;">${cell}</td>`;
                });
                tableHTML += '</tr>';
            }
            tableHTML += '</tbody></table>';
            
            if (lines.length > 50) {
                tableHTML += `<p style="text-align: center; margin-top: 10px; color: #666;"><em>Showing first 50 of ${lines.length - 1} rows</em></p>`;
            }
            
            return tableHTML;
        }
        
        // For Excel, the data should already be in a parseable format
        // This is a simplified version - in production you'd use a library like SheetJS
        return '<p style="color: #666; padding: 20px; text-align: center;"><em>Excel file preview not available. Please download to view.</em></p>';
        
    } catch (error) {
        console.error('Error parsing file data:', error);
        return null;
    }
}

window.downloadImportedFile = function(fileName, fileType, fileData) {
    try {
        const link = document.createElement('a');
        link.href = fileData;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        if (window.labResultsApp?.showMessage) {
            window.labResultsApp.showMessage('File download started', 'success');
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        if (window.labResultsApp?.showMessage) {
            window.labResultsApp.showMessage('Error downloading file', 'error');
        }
    }
};

// ========================================
// VIEW, EDIT, DELETE FUNCTIONS
// ========================================

function viewResult(id) {
    const result = window.labResultsApp.allResults.find(r => r.id === id);
    if (!result) return;
    
    showResultModal({
        ...result,
        action: 'view'
    });
}

function editResult(id) {
    if (!window.labResultsApp.authManager?.hasPermission('edit')) {
        window.labResultsApp.showMessage('You do not have permission to edit lab results', 'error');
        return;
    }

    const result = window.labResultsApp.allResults.find(r => r.id === id);
    if (!result) return;
    
    showResultModal({
        ...result,
        action: 'edit'
    });
}

function deleteResult(id) {
    window.labResultsApp.deleteLabResult(id);
}

function showResultModal(data) {
    let modal = document.getElementById('resultModal');
    
    if (!modal) {
        modal = createResultModal();
    }
    
    const modalContent = modal.querySelector('.modal-content');
    
    if (data.action === 'view') {
        modalContent.innerHTML = `
            <span class="close">&times;</span>
            <h2>Lab Result Details</h2>
            <div class="detail-section">
                <h3>Patient Information</h3>
                <div class="detail-item">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value">${data.patientName || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Patient ID:</span>
                    <span class="detail-value">${data.patientId || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Patient Type:</span>
                    <span class="detail-value">${data.patientType || 'N/A'}</span>
                </div>
            </div>
            <div class="detail-section">
                <h3>Test Information</h3>
                <div class="detail-item">
                    <span class="detail-label">Test Type:</span>
                    <span class="detail-value">${data.test || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">
                        <span class="status ${(data.status || 'pending').toLowerCase()}">${data.status || 'Pending'}</span>
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Date:</span>
                    <span class="detail-value">${data.date || 'N/A'}</span>
                </div>
            </div>
            <div class="detail-section">
                <h3>Results</h3>
                <div class="detail-item">
                    <div class="detail-value">${data.results || 'No results available'}</div>
                </div>
                ${data.notes ? `
                <div class="detail-item">
                    <span class="detail-label">Notes:</span>
                    <div class="detail-value">${data.notes}</div>
                </div>
                ` : ''}
            </div>
            ${(data.importedFiles && data.importedFiles.length > 0) || data.importedFile || data.imageData ? `
            <div class="detail-section">
                <h3><i class="fas fa-file-import"></i> Imported Files (${getFileCount(data)})</h3>
                <div class="imported-file-display">
                    ${getImportedFilesDisplayForView(data)}
                </div>
            </div>
            ` : ''}
            <div class="detail-section">
                <h3>Timestamps</h3>
                <div class="detail-item">
                    <span class="detail-label">Created:</span>
                    <span class="detail-value">${data.createdAt ? new Date(data.createdAt).toLocaleString() : 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Last Updated:</span>
                    <span class="detail-value">${data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'N/A'}</span>
                </div>
            </div>
            ${data.status === 'abnormal' && !data.acknowledged ? `
            <div class="detail-section">
                <button class="form-btn primary" onclick="acknowledgeAbnormalResult('${data.id}')">
                    <i class="fas fa-check-circle"></i> Acknowledge Abnormal Result
                </button>
            </div>
            ` : ''}
        `;
    } else if (data.action === 'edit') {
        modalContent.innerHTML = `
            <span class="close">&times;</span>
            <h2>Edit Lab Result</h2>
            <form id="editResultForm">
                <div class="form-group">
                    <label>Patient Name:</label>
                    <input type="text" id="editPatientName" value="${data.patientName || ''}" required>
                </div>
                <div class="form-group">
                    <label>Patient ID:</label>
                    <input type="text" id="editPatientId" value="${data.patientId || ''}" required>
                </div>
                <div class="form-group">
                    <label>Patient Type:</label>
                    <select id="editPatientType" required>
                        <option value="">Select patient type</option>
                        <option value="Gynecology" ${data.patientType === 'Gynecology' ? 'selected' : ''}>Gynecology</option>
                        <option value="Prenatal" ${data.patientType === 'Prenatal' ? 'selected' : ''}>Prenatal</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Test Type:</label>
                    <input type="text" id="editTest" value="${data.test || ''}" required>
                </div>
                <div class="form-group">
                    <label>Status:</label>
                    <select id="editStatus" required>
                        <option value="pending" ${(data.status || 'pending') === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="normal" ${data.status === 'normal' ? 'selected' : ''}>Normal</option>
                        <option value="abnormal" ${data.status === 'abnormal' ? 'selected' : ''}>Abnormal</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Results:</label>
                    <textarea id="editResults" rows="4" required>${data.results || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Notes:</label>
                    <textarea id="editNotes" rows="2">${data.notes || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Date:</label>
                    <input type="date" id="editDate" value="${data.date || ''}" required>
                </div>
                
                <!-- Imported Files Section -->
                <div class="form-group" style="border-top: 2px solid #f0f0f0; padding-top: 20px; margin-top: 20px;">
                    <label><i class="fas fa-file-import"></i> Imported Files:</label>
                    <div id="currentFilesDisplay" style="margin-top: 10px;">
                        ${getImportedFilesDisplayForEdit(data)}
                    </div>
                    <button type="button" class="form-btn primary" onclick="showImportFileSection()" style="margin-top: 10px; width: 100%; background: linear-gradient(135deg, #28a745, #20c997);">
                        <i class="fas fa-file-import"></i> Import Additional File
                    </button>
                </div>
                
                <!-- File Upload Section (Hidden by default, shown when importing) -->
                <div class="form-group" id="editFileUploadSection" style="display: none; border: 2px dashed #28a745; padding: 20px; border-radius: 8px; margin-top: 15px; background: #f0fff4;">
                    <label><i class="fas fa-upload"></i> Import New File:</label>
                    <input type="file" id="editFileInput" accept=".csv,.jpg,.jpeg,.png,.pdf,.tiff,.tif" multiple style="margin-top: 10px;">
                    <p style="font-size: 12px; color: #666; margin-top: 5px;">You can select multiple files</p>
                    <div id="editFilePreview" style="margin-top: 15px;"></div>
                    <button type="button" class="form-btn secondary" onclick="cancelFileImport()" style="margin-top: 10px;">
                        <i class="fas fa-times"></i> Cancel Import
                    </button>
                </div>
                
                <div class="form-buttons">
                    <button type="button" class="form-btn secondary" onclick="closeModal('resultModal')">Cancel</button>
                    <button type="submit" class="form-btn primary">Save Changes</button>
                </div>
            </form>
        `;
        
        // Store current data for file management
        window.currentEditData = data;
        window.editModeDeletedFiles = [];
        
        const form = document.getElementById('editResultForm');
        form.onsubmit = function(e) {
            e.preventDefault();
            const updatedData = {
                patientName: document.getElementById('editPatientName').value,
                patientId: document.getElementById('editPatientId').value,
                patientType: document.getElementById('editPatientType').value,
                test: document.getElementById('editTest').value,
                status: document.getElementById('editStatus').value,
                results: document.getElementById('editResults').value,
                notes: document.getElementById('editNotes').value,
                date: document.getElementById('editDate').value
            };
            
            // Build files array from existing and new files
            let filesArray = [];
            
            // Get existing files
            if (data.importedFiles && Array.isArray(data.importedFiles)) {
                filesArray = [...data.importedFiles];
            } else if (data.importedFile) {
                filesArray = [data.importedFile];
            } else if (data.imageData) {
                filesArray = [{
                    fileName: data.importedFrom || 'Imported Image',
                    fileType: data.fileType || 'image',
                    fileData: data.imageData,
                    fileSize: data.fileSize || 0
                }];
            }
            
            // Remove deleted files
            if (window.editModeDeletedFiles && window.editModeDeletedFiles.length > 0) {
                filesArray = filesArray.filter((_, index) => !window.editModeDeletedFiles.includes(index));
                console.log(`🗑️ Removed ${window.editModeDeletedFiles.length} file(s)`);
            }
            
            // Add new files
            if (window.editModeNewFiles && window.editModeNewFiles.length > 0) {
                filesArray.push(...window.editModeNewFiles);
                console.log(`📎 Added ${window.editModeNewFiles.length} new file(s)`);
            }
            
            // Store files in the updated data
            if (filesArray.length > 0) {
                updatedData.importedFiles = filesArray;
                
                // Keep backward compatibility - store first file in old format too
                const firstFile = filesArray[0];
                updatedData.importedFile = firstFile;
                updatedData.imageData = firstFile.fileData;
                updatedData.importedFrom = firstFile.fileName;
                updatedData.fileType = firstFile.fileType;
                updatedData.fileSize = firstFile.fileSize;
            } else {
                // No files - clear all file data
                updatedData.importedFiles = [];
                updatedData.importedFile = null;
                updatedData.imageData = null;
                updatedData.importedFrom = null;
                updatedData.fileType = null;
                updatedData.fileSize = null;
            }
            
            console.log(`💾 Saving lab result with ${filesArray.length} file(s)`);
            
            window.labResultsApp.updateLabResult(data.id, updatedData);
            
            // Clear temporary data
            window.editModeNewFiles = [];
            window.editModeDeletedFiles = [];
            window.currentEditData = null;
        };
    }
    
    modal.style.display = 'block';
    setupModalEvents();
}

function createResultModal() {
    const modal = document.createElement('div');
    modal.id = 'resultModal';
    modal.className = 'modal';
    modal.innerHTML = '<div class="modal-content"></div>';
    document.body.appendChild(modal);
    return modal;
}

function setupModalEvents() {
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.onclick = function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        };
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.onclick = function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    });
}

async function acknowledgeAbnormalResult(id) {
    if (!window.labResultsApp.authManager?.hasPermission('edit')) {
        window.labResultsApp.showMessage('You do not have permission to acknowledge results', 'error');
        return;
    }

    if (labResultsRef) {
        labResultsRef.child(id).update({
            acknowledged: true,
            acknowledgedAt: new Date().toISOString(),
            acknowledgedBy: window.labResultsApp.authManager?.userDisplayName
        }).then(() => {
            window.labResultsApp.showMessage('Abnormal result acknowledged', 'success');
            closeModal('resultModal');
        }).catch((error) => {
            console.error('Error acknowledging result:', error);
            window.labResultsApp.showMessage('Error acknowledging result', 'error');
        });
    }
}

function closeModal(modalId) {
    if (window.labResultsApp) {
        window.labResultsApp.closeModal(modalId);
    } else {
        // Fallback if app not initialized
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    }
}

function toggleFormatGuide() {
    const guide = document.getElementById('formatGuide');
    if (guide) {
        guide.style.display = guide.style.display === 'none' ? 'block' : 'none';
    }
}

async function previewFile() {
    const fileInput = document.getElementById('fileInput');
    const previewSection = document.getElementById('previewSection');
    const dataPreview = document.getElementById('dataPreview');
    const previewStats = document.getElementById('previewStats');
    const importBtn = document.getElementById('importBtn');
    
    if (!fileInput?.files[0]) {
        window.labResultsApp?.showMessage('Please select a file first', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    
    // Show preview section
    if (previewSection) previewSection.style.display = 'block';
    if (dataPreview) {
        dataPreview.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div class="loading-spinner" style="margin: 20px auto;"></div>
                <p>Processing file...</p>
            </div>
        `;
    }
    
    try {
        // Read and parse file
        let parsedResults = [];
        
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            const fileData = await readFileAsText(file);
            parsedResults = parseCSVData(fileData);
        } else {
            window.labResultsApp?.showMessage('Please select a CSV file for preview', 'warning');
            if (previewSection) previewSection.style.display = 'none';
            return;
        }
        
        // Display preview
        if (parsedResults.length > 0) {
            // Create table with actual data
            let tableHTML = `
                <table style="width: 100%; border-collapse: collapse; background: white;">
                    <thead>
                        <tr>
                            <th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5; text-align: left;">Patient Name</th>
                            <th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5; text-align: left;">Patient ID</th>
                            <th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5; text-align: left;">Test</th>
                            <th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5; text-align: left;">Status</th>
                            <th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5; text-align: left;">Date</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            // Show first 5 rows
            const previewCount = Math.min(5, parsedResults.length);
            for (let i = 0; i < previewCount; i++) {
                const result = parsedResults[i];
                const statusClass = result.status === 'abnormal' ? 'color: #d32f2f; font-weight: bold;' : 
                                   result.status === 'normal' ? 'color: #2e7d32;' : 'color: #f57c00;';
                tableHTML += `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px;">${result.patientName || 'N/A'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${result.patientId || 'N/A'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${result.test || 'N/A'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px; ${statusClass}">${result.status || 'N/A'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${result.date || 'N/A'}</td>
                    </tr>
                `;
            }
            
            tableHTML += `
                    </tbody>
                </table>
            `;
            
            if (dataPreview) {
                dataPreview.innerHTML = tableHTML;
            }
            
            // Show statistics
            if (previewStats) {
                const normalCount = parsedResults.filter(r => r.status === 'normal').length;
                const abnormalCount = parsedResults.filter(r => r.status === 'abnormal').length;
                const pendingCount = parsedResults.filter(r => r.status === 'pending').length;
                
                previewStats.innerHTML = `
                    <strong>File Statistics:</strong> 
                    Total: ${parsedResults.length} results | 
                    Normal: ${normalCount} | 
                    Abnormal: ${abnormalCount} | 
                    Pending: ${pendingCount}
                    ${parsedResults.length > 5 ? ` | Showing first 5 of ${parsedResults.length} rows` : ''}
                `;
            }
            
            // Enable import button
            if (importBtn) importBtn.disabled = false;
            
            window.labResultsApp?.showMessage('File preview loaded successfully', 'success');
            
        } else {
            if (dataPreview) {
                dataPreview.innerHTML = '<p style="text-align: center; color: #d32f2f; padding: 20px;">No valid data found in file. Please check the format.</p>';
            }
            window.labResultsApp?.showMessage('No valid data found in file', 'error');
        }
        
    } catch (error) {
        console.error('Error previewing file:', error);
        if (dataPreview) {
            dataPreview.innerHTML = `
                <p style="text-align: center; color: #d32f2f; padding: 20px;">
                    <i class="fas fa-exclamation-triangle"></i><br><br>
                    Error: ${error.message}<br><br>
                    Please ensure your CSV has the required columns:<br>
                    patientName, patientId, test, status, results, date
                </p>
            `;
        }
        window.labResultsApp?.showMessage('Error previewing file: ' + error.message, 'error');
    }
}

// REMOVED DUPLICATE: async function importLabResults() {

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function parseCSVData(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        throw new Error('CSV file is empty or contains only headers');
    }
    
    // Helper function to parse CSV line with quoted fields
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        
        return result.map(field => field.replace(/^"|"$/g, ''));
    }
    
    // Parse headers
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    
    console.log('CSV Headers:', headers);
    
    // Required headers (flexible matching)
    const requiredFields = {
        patientName: ['patientname', 'patient name', 'name', 'patient'],
        patientId: ['patientid', 'patient id', 'id', 'patient_id'],
        test: ['test', 'testtype', 'test type', 'test_type', 'lab test'],
        status: ['status', 'result status', 'test status'],
        results: ['results', 'result', 'test results', 'test result', 'values'],
        date: ['date', 'testdate', 'test date', 'test_date', 'date tested']
    };
    
    // Find column indices for each required field
    const columnMap = {};
    for (const [field, possibleHeaders] of Object.entries(requiredFields)) {
        const index = headers.findIndex(h => 
            possibleHeaders.some(ph => h.includes(ph) || ph.includes(h))
        );
        if (index === -1) {
            throw new Error(`Missing required column: ${field}. CSV must contain: patientName, patientId, test, status, results, date`);
        }
        columnMap[field] = index;
    }
    
    // Optional fields
    const optionalFields = {
        patientType: ['patienttype', 'patient type', 'type', 'patient_type'],
        notes: ['notes', 'note', 'comments', 'doctornotes', 'doctor notes']
    };
    
    for (const [field, possibleHeaders] of Object.entries(optionalFields)) {
        const index = headers.findIndex(h => 
            possibleHeaders.some(ph => h.includes(ph) || ph.includes(h))
        );
        if (index !== -1) {
            columnMap[field] = index;
        }
    }
    
    console.log('Column mapping:', columnMap);
    
    // Parse data rows
    const results = [];
    const errors = [];
    
    for (let i = 1; i < lines.length; i++) {
        try {
            const values = parseCSVLine(lines[i]);
            
            if (values.length < headers.length - 2) {
                // Allow some flexibility in column count
                continue;
            }
            
            const result = {
                patientName: values[columnMap.patientName]?.trim() || '',
                patientId: values[columnMap.patientId]?.trim() || '',
                test: values[columnMap.test]?.trim() || '',
                status: values[columnMap.status]?.trim().toLowerCase() || 'pending',
                results: values[columnMap.results]?.trim() || '',
                date: values[columnMap.date]?.trim() || '',
                patientType: columnMap.patientType ? (values[columnMap.patientType]?.trim() || 'Gynecology') : 'Gynecology',
                notes: columnMap.notes ? (values[columnMap.notes]?.trim() || '') : ''
            };
            
            // Validate required fields
            if (!result.patientName || !result.patientId || !result.test || !result.results || !result.date) {
                errors.push(`Row ${i + 1}: Missing required data`);
                continue;
            }
            
            // Validate status
            if (!['pending', 'normal', 'abnormal'].includes(result.status)) {
                result.status = 'pending';
            }
            
            // Validate and format date
            if (result.date) {
                // Try to parse various date formats
                const dateFormats = [
                    /^\d{4}-\d{2}-\d{2}$/,  // YYYY-MM-DD
                    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
                    /^\d{2}-\d{2}-\d{4}$/    // DD-MM-YYYY
                ];
                
                if (!dateFormats.some(format => format.test(result.date))) {
                    // Try to convert to ISO format
                    const parsedDate = new Date(result.date);
                    if (!isNaN(parsedDate.getTime())) {
                        result.date = parsedDate.toISOString().split('T')[0];
                    } else {
                        errors.push(`Row ${i + 1}: Invalid date format`);
                        continue;
                    }
                }
            }
            
            results.push(result);
            
        } catch (error) {
            errors.push(`Row ${i + 1}: ${error.message}`);
        }
    }
    
    console.log(`Parsed ${results.length} valid results from ${lines.length - 1} rows`);
    if (errors.length > 0) {
        console.warn('Parsing errors:', errors);
    }
    
    if (results.length === 0) {
        throw new Error('No valid data found in CSV file. Errors: ' + errors.join('; '));
    }
    
    return results;
}

// IMAGE PROCESSING FUNCTIONS
async function processImage() {
    const imageProcessingModal = document.getElementById('imageProcessingModal');
    if (!imageProcessingModal) return;
    
    // Show processing modal
    imageProcessingModal.style.display = 'block';
    
    try {
        const extractedData = await window.labResultsApp.imageProcessor.processImage(window.labResultsApp.currentImageFile);
        
        // Close processing modal
        imageProcessingModal.style.display = 'none';
        
        // Close import modal
        closeModal('importModal');
        
        // Fill the add lab form with extracted data
        fillLabFormWithImageData(extractedData);
        
        // Show add lab modal
        window.labResultsApp.showAddLabModal();
        
    } catch (error) {
        console.error('Error processing image:', error);
        imageProcessingModal.style.display = 'none';
        window.labResultsApp.showMessage('Error processing image. Please try again.', 'error');
    }
}

function fillLabFormWithImageData(data) {
    setTimeout(() => {
        // Fill form fields with extracted data
        const patientNameInput = document.getElementById('patientName');
        const patientIdInput = document.getElementById('patientId');
        const testTypeSelect = document.getElementById('testType');
        const testResultsTextarea = document.getElementById('testResults');
        const testDateInput = document.getElementById('testDate');
        const doctorNotesTextarea = document.getElementById('doctorNotes');
        
        if (patientNameInput && data.patientName) {
            patientNameInput.value = data.patientName;
        }
        
        if (patientIdInput && data.patientId) {
            patientIdInput.value = data.patientId;
        }
        
        if (testTypeSelect && data.testType) {
            // Try to match extracted test type with select options
            const options = testTypeSelect.querySelectorAll('option');
            for (let option of options) {
                if (option.textContent.toLowerCase().includes(data.testType.toLowerCase()) ||
                    data.testType.toLowerCase().includes(option.textContent.toLowerCase())) {
                    option.selected = true;
                    break;
                }
            }
        }
        
        if (testResultsTextarea && data.results) {
            testResultsTextarea.value = data.results;
        }
        
        if (testDateInput && data.date) {
            testDateInput.value = data.date;
        }
        
        if (doctorNotesTextarea) {
            doctorNotesTextarea.value = `Extracted from image with ${Math.round(data.confidence * 100)}% confidence.\n\nOriginal OCR Text:\n${data.rawText}`;
        }
        
        // Store image data for saving with the result
        window.labResultsApp.currentImageData = window.labResultsApp.imageProcessor.canvas.toDataURL();
        
        // Store imported file information
        if (window.labResultsApp.currentImageFile) {
            window.labResultsApp.currentImportedFile = {
                fileName: window.labResultsApp.currentImageFile.name,
                fileType: window.labResultsApp.currentImageFile.type,
                fileData: window.labResultsApp.currentImageData,
                fileSize: window.labResultsApp.currentImageFile.size
            };
        }
        
        // Show success message
        window.labResultsApp.showMessage(`Image processed successfully! Confidence: ${Math.round(data.confidence * 100)}%`, 'success');
        
        // Auto-select patient if found
        if (data.patientName) {
            window.labResultsApp.patientSearchState.selectedPatient = {
                key: 'extracted',
                patientId: data.patientId,
                name: data.patientName
            };
            
            if (patientNameInput) {
                patientNameInput.classList.add('has-selection');
            }
            
            window.labResultsApp.showSelectedPatientInfo();
        }
        
    }, 100);
}

function rotateImage() {
    if (!window.labResultsApp.imageProcessor.currentImage) return;
    
    const rotatedDataURL = window.labResultsApp.imageProcessor.rotateImage();
    if (rotatedDataURL) {
        const previewImg = document.getElementById('previewImg');
        if (previewImg) {
            previewImg.src = rotatedDataURL;
        }
    }
}

function removeImage() {
    const fileInput = document.getElementById('fileInput');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const processImageBtn = document.getElementById('processImageBtn');
    
    if (fileInput) fileInput.value = '';
    if (imagePreviewContainer) imagePreviewContainer.classList.remove('active');
    if (processImageBtn) processImageBtn.disabled = true;
    
    window.labResultsApp.currentImageFile = null;
    window.labResultsApp.currentImageData = null;
    
    window.labResultsApp.showMessage('Image removed', 'info');
}

// ========================================
// INITIALIZATION
// ========================================

window.labResultsApp = new LabResultsApplication();

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing PregnaCare Lab Results System WITHOUT Message Icon...');
    console.log('Admin User ID:', ADMIN_USER_ID);
    console.log('Sub-Admin User ID:', SUB_ADMIN_USER_ID);
    
    window.labResultsApp.initialize();
    
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            const modalId = event.target.id;
            if (modalId !== 'authRequiredModal') {
                window.labResultsApp.closeModal(modalId);
            }
        }
    });
    
    console.log('✅ Lab Results System ready, waiting for authentication...');
});

console.log('PregnaCare Lab Results System WITHOUT Message Icon loaded successfully');
console.log('🔧 UPDATED FEATURES:');
console.log('   ✅ Message Icon and Functions COMPLETELY REMOVED');
console.log('   ✅ Notifications Dropdown - Still works properly');
console.log('   ✅ Help Dropdown - Comprehensive help content for lab results');
console.log('   ✅ Clean top bar with only notifications and help');
console.log('   ✅ All remaining dropdowns close properly when clicking outside');
console.log('   ✅ Event listeners properly initialized without message functionality');
console.log('   ✅ Top bar icons respond correctly to clicks (notifications + help only)');
console.log('📚 HELP SYSTEM FEATURES:');
console.log('   ✅ Quick Start Guide');
console.log('   ✅ How to Add Lab Results');
console.log('   ✅ Import Results Guide');
console.log('   ✅ Understanding Status Types');
console.log('   ✅ Managing Abnormal Results');
console.log('   ✅ Search & Filter Tips');
console.log('   ✅ Troubleshooting Guide');
console.log('   ✅ Contact Support Information');
console.log('🔔 NOTIFICATION FEATURES:');
console.log('   ✅ Real-time Firebase integration');
console.log('   ✅ Lab-specific notifications');
console.log('   ✅ Notification badge updates');
console.log('   ✅ Click to view related results');
console.log('   ✅ Mark as read functionality');
console.log('❌ REMOVED FEATURES:');
console.log('   ❌ Message Icon completely removed from HTML');
console.log('   ❌ Message dropdown functionality removed');
console.log('   ❌ Message loading functions removed');
console.log('   ❌ Message badge and counter removed');
console.log('   ❌ All message-related event listeners removed');
console.log('   ❌ Message action buttons removed');
console.log('   ❌ Sample message data removed');
// ========================================
// LAB RESULTS HISTORY FUNCTIONALITY
// ========================================

// Global variable to store filtered history
let filteredHistoryResults = [];

// Show history modal with all lab results
window.showHistoryModal = function() {
    const modal = document.getElementById('historyModal');
    if (!modal) return;
    
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
    
    loadHistoryData();
};

// Load all lab results into history
function loadHistoryData() {
    if (!labResultsRef) {
        showMessage('Unable to load history. Please try again.', 'error');
        return;
    }
    
    labResultsRef.once('value')
        .then(snapshot => {
            const results = [];
            snapshot.forEach(childSnapshot => {
                const result = childSnapshot.val();
                result.id = childSnapshot.key;
                results.push(result);
            });
            
            // Sort by date (newest first)
            results.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            filteredHistoryResults = results;
            displayHistoryResults(results);
            updateHistoryStats(results);
        })
        .catch(error => {
            console.error('Error loading history:', error);
            showMessage('Failed to load history', 'error');
        });
}

// Display history results in timeline
function displayHistoryResults(results) {
    const timeline = document.getElementById('historyTimeline');
    if (!timeline) return;
    
    if (results.length === 0) {
        timeline.innerHTML = `
            <div class="history-empty">
                <i class="fas fa-history"></i>
                <h3>No Results Found</h3>
                <p>No lab results match your search criteria</p>
            </div>
        `;
        return;
    }
    
    timeline.innerHTML = results.map(result => {
        const statusClass = result.status || 'pending';
        const statusIcon = statusClass === 'normal' ? 'check-circle' : 
                          statusClass === 'abnormal' ? 'exclamation-circle' : 'clock';
        
        return `
            <div class="history-item" data-status="${statusClass}">
                <div class="history-item-header">
                    <h3 class="history-item-title">
                        <i class="fas fa-${statusIcon}" style="color: ${getStatusColor(statusClass)}"></i>
                        ${escapeHtml(result.test || 'Unknown Test')}
                    </h3>
                    <span class="history-item-date">
                        <i class="fas fa-calendar"></i>
                        ${formatDate(result.date)}
                    </span>
                </div>
                
                <div class="history-item-content">
                    <div class="history-info-item">
                        <span class="history-info-label">Patient</span>
                        <span class="history-info-value">${escapeHtml(result.patientName || 'Unknown')}</span>
                    </div>
                    <div class="history-info-item">
                        <span class="history-info-label">Patient ID</span>
                        <span class="history-info-value">${escapeHtml(result.patientId || 'N/A')}</span>
                    </div>
                    <div class="history-info-item">
                        <span class="history-info-label">Status</span>
                        <span class="history-info-value">
                            <span class="status ${statusClass}">${capitalizeFirst(statusClass)}</span>
                        </span>
                    </div>
                    <div class="history-info-item">
                        <span class="history-info-label">Results</span>
                        <span class="history-info-value">${escapeHtml(result.results ? result.results.substring(0, 50) + '...' : 'No results')}</span>
                    </div>
                </div>
                
                <div class="history-item-actions">
                    <button class="history-action-btn view" onclick="viewResultFromHistory('${result.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="history-action-btn edit" onclick="editResultFromHistory('${result.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="history-action-btn delete" onclick="deleteResultFromHistory('${result.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Update history statistics
function updateHistoryStats(results) {
    const stats = {
        total: results.length,
        normal: results.filter(r => r.status === 'normal').length,
        abnormal: results.filter(r => r.status === 'abnormal').length,
        pending: results.filter(r => r.status === 'pending').length
    };
    
    document.getElementById('historyTotalCount').textContent = stats.total;
    document.getElementById('historyNormalCount').textContent = stats.normal;
    document.getElementById('historyAbnormalCount').textContent = stats.abnormal;
    document.getElementById('historyPendingCount').textContent = stats.pending;
}

// Apply filters to history
window.applyHistoryFilters = function() {
    const searchTerm = document.getElementById('historySearch').value.toLowerCase();
    const statusFilter = document.getElementById('historyStatusFilter').value;
    const dateFrom = document.getElementById('historyDateFrom').value;
    const dateTo = document.getElementById('historyDateTo').value;
    
    let filtered = [...filteredHistoryResults];
    
    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(result => 
            (result.patientName && result.patientName.toLowerCase().includes(searchTerm)) ||
            (result.patientId && result.patientId.toLowerCase().includes(searchTerm)) ||
            (result.test && result.test.toLowerCase().includes(searchTerm)) ||
            (result.date && result.date.includes(searchTerm))
        );
    }
    
    // Apply status filter
    if (statusFilter) {
        filtered = filtered.filter(result => result.status === statusFilter);
    }
    
    // Apply date range filter
    if (dateFrom) {
        filtered = filtered.filter(result => new Date(result.date) >= new Date(dateFrom));
    }
    if (dateTo) {
        filtered = filtered.filter(result => new Date(result.date) <= new Date(dateTo));
    }
    
    displayHistoryResults(filtered);
    updateHistoryStats(filtered);
};

// Clear all filters
window.clearHistoryFilters = function() {
    document.getElementById('historySearch').value = '';
    document.getElementById('historyStatusFilter').value = '';
    document.getElementById('historyDateFrom').value = '';
    document.getElementById('historyDateTo').value = '';
    
    displayHistoryResults(filteredHistoryResults);
    updateHistoryStats(filteredHistoryResults);
};

// View result from history
window.viewResultFromHistory = function(resultId) {
    closeModal('historyModal');
    setTimeout(() => {
        if (window.viewResult) {
            window.viewResult(resultId);
        }
    }, 300);
};

// Edit result from history
window.editResultFromHistory = function(resultId) {
    closeModal('historyModal');
    setTimeout(() => {
        if (window.editResult) {
            window.editResult(resultId);
        }
    }, 300);
};

// Delete result from history
window.deleteResultFromHistory = function(resultId) {
    if (window.deleteResult) {
        window.deleteResult(resultId);
    }
};

// Export history to CSV
window.exportHistory = function() {
    if (filteredHistoryResults.length === 0) {
        showMessage('No data to export', 'warning');
        return;
    }
    
    const headers = ['Date', 'Patient Name', 'Patient ID', 'Test', 'Status', 'Results', 'Doctor Notes'];
    const rows = filteredHistoryResults.map(result => [
        result.date || '',
        result.patientName || '',
        result.patientId || '',
        result.test || '',
        result.status || '',
        (result.results || '').replace(/\n/g, ' '),
        (result.doctorNotes || '').replace(/\n/g, ' ')
    ]);
    
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lab_results_history_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    showMessage('History exported successfully', 'success');
};

// Helper function to get status color
function getStatusColor(status) {
    switch (status) {
        case 'normal': return '#2e7d32';
        case 'abnormal': return '#c62828';
        case 'pending': return '#ef6c00';
        default: return '#666';
    }
}

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to capitalize first letter
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ========================================
// MOBILE MENU FUNCTIONALITY
// ========================================

// Initialize mobile menu
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            sidebar.classList.toggle('open');
            document.body.classList.toggle('sidebar-open');
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                    sidebar.classList.remove('open');
                    document.body.classList.remove('sidebar-open');
                }
            }
        });
        
        // Close sidebar when clicking nav links
        const navLinks = sidebar.querySelectorAll('.nav a');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    document.body.classList.remove('sidebar-open');
                }
            });
        });
    }
    
    // Add data labels for responsive table
    const table = document.getElementById('labTable');
    if (table) {
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
        
        function updateTableLabels() {
            const rows = table.querySelectorAll('tbody tr:not(.loading-row)');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                cells.forEach((cell, index) => {
                    if (headers[index] && !cell.hasAttribute('data-label')) {
                        cell.setAttribute('data-label', headers[index]);
                    }
                });
            });
        }
        
        // Initial update
        updateTableLabels();
        
        // Update on table changes (using MutationObserver)
        const observer = new MutationObserver(updateTableLabels);
        observer.observe(table.querySelector('tbody'), { 
            childList: true, 
            subtree: true 
        });
    }
});

console.log('✅ Lab Results History functionality added');
console.log('✅ Mobile responsive menu functionality added');
console.log('✅ Enhanced responsive table functionality added');
// ========================================
// PATIENT TYPE FILTER FUNCTIONALITY
// ========================================

let currentFilterType = 'All';

window.filterResultsByType = function(type) {
    currentFilterType = type;
    
    console.log(`Filtering lab results by type: ${type}`);
    
    // Update button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (type === 'Gynecology') {
        const btn = document.querySelector('.gynecology-btn');
        if (btn) btn.classList.add('active');
    } else if (type === 'Prenatal') {
        const btn = document.querySelector('.prenatal-btn');
        if (btn) btn.classList.add('active');
    } else {
        const btn = document.querySelector('.all-btn');
        if (btn) btn.classList.add('active');
    }
    
    // Check if labResultsApp exists
    if (!window.labResultsApp) {
        console.error('Lab Results App not initialized');
        return;
    }
    
    // Filter results based on patient type
    if (type === 'All') {
        window.labResultsApp.filteredResults = [...window.labResultsApp.allResults];
    } else {
        // Filter by matching patient type directly from the result
        window.labResultsApp.filteredResults = window.labResultsApp.allResults.filter(result => {
            // First check if result has patientType field directly
            if (result.patientType) {
                return result.patientType.toLowerCase() === type.toLowerCase();
            }
            
            // If no patientType in result, try to find the patient
            const patient = window.labResultsApp.allPatients.find(p => 
                p.patientId === result.patientId || p.key === result.patientKey
            );
            
            if (patient && patient.patientType) {
                // Check if patient type matches (case-insensitive)
                return patient.patientType.toLowerCase() === type.toLowerCase();
            }
            
            
            // If no patient found or no patient type, check test type
            if (result.test) {
                const testType = result.test.toLowerCase();
                if (type === 'Gynecology') {
                    return testType.includes('pap') || 
                           testType.includes('hpv') || 
                           testType.includes('std') || 
                           testType.includes('hormone') ||
                           testType.includes('pregnancy test');
                } else if (type === 'Prenatal') {
                    return testType.includes('glucose') || 
                           testType.includes('genetic') || 
                           testType.includes('group b') || 
                           testType.includes('rh factor') || 
                           testType.includes('nipt') || 
                           testType.includes('amnio') || 
                           testType.includes('afp') ||
                           testType.includes('alpha-fetoprotein');
                }
            }
            
            return false;
        });
    }
    
    // Reset to first page
    window.labResultsApp.currentPage = 1;
    
    // Re-render table and pagination
    window.labResultsApp.renderTable();
    window.labResultsApp.updatePagination();
    
    // Show message
    const count = window.labResultsApp.filteredResults.length;
    const message = type === 'All' 
        ? `Showing all ${count} lab results` 
        : `Showing ${count} ${type} lab results`;
    
    if (window.labResultsApp.showMessage) {
        window.labResultsApp.showMessage(message, 'info');
    }
    
    console.log(`Filter applied: ${count} results shown`);
};

// ========================================
// ENHANCED NOTIFICATION FUNCTIONS
// ========================================

window.markAllNotificationsRead = function() {
    console.log('Marking all notifications as read...');
    
    // Update all notification items to read status
    const notificationItems = document.querySelectorAll('.notification-item');
    notificationItems.forEach(item => {
        item.classList.remove('unread', 'urgent');
    });
    
    // Update badge count
    const badge = document.getElementById('notifBadge');
    if (badge) {
        badge.textContent = '0';
        badge.style.display = 'none';
    }
    
    // Update using TopBarManager if available
    if (window.labResultsApp?.topBarManager) {
        window.labResultsApp.topBarManager.updateNotificationBadge(0);
    }
    
    // Show success message
    if (window.labResultsApp?.showMessage) {
        window.labResultsApp.showMessage('All notifications marked as read', 'success');
    }
    
    // Update Firebase if available
    if (typeof notificationsRef !== 'undefined' && notificationsRef && window.labResultsApp?.authManager?.currentUser) {
        notificationsRef
            .orderByChild('userId')
            .equalTo(window.labResultsApp.authManager.currentUser.uid)
            .once('value', snapshot => {
                const updates = {};
                snapshot.forEach(child => {
                    updates[child.key + '/read'] = true;
                });
                if (Object.keys(updates).length > 0) {
                    notificationsRef.update(updates)
                        .then(() => {
                            console.log('Notifications marked as read in Firebase');
                        })
                        .catch(error => {
                            console.error('Error updating notifications in Firebase:', error);
                        });
                }
            });
    }
    
    console.log('All notifications marked as read');
};

// Initialize filter on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing patient type filter...');
    
    // Set initial filter state
    currentFilterType = 'All';
    
    // Ensure All button is active by default
    setTimeout(() => {
        const allBtn = document.querySelector('.all-btn');
        if (allBtn) {
            allBtn.classList.add('active');
        }
    }, 500);
});

console.log('✅ Patient type filter functionality loaded');
console.log('✅ Enhanced notification functions loaded');// ====================================================
// FIX for Lab Results Import Functionality
// Add this code at the end of Lab_Results.js before the closing script tag
// ====================================================

console.log('🔧 Loading Import Functionality Fixes...');

// Global function declarations to ensure they're accessible
window.previewFile = previewFile;
// REMOVED DUPLICATE: window.importLabResults = importLabResults;
window.processImage = processImage;
window.readFileAsText = readFileAsText;
window.parseCSVData = parseCSVData;

// Enhanced file preview with better error handling
async function previewFile() {
    console.log('📋 Preview File Function Called');
    const fileInput = document.getElementById('fileInput');
    const previewSection = document.getElementById('previewSection');
    const dataPreview = document.getElementById('dataPreview');
    const previewStats = document.getElementById('previewStats');
    const importBtn = document.getElementById('importBtn');
    
    if (!fileInput?.files[0]) {
        console.error('❌ No file selected');
        if (window.labResultsApp) {
            window.labResultsApp.showMessage('Please select a file first', 'error');
        } else {
            alert('Please select a file first');
        }
        return;
    }
    
    const file = fileInput.files[0];
    console.log('📄 File selected:', file.name, 'Type:', file.type, 'Size:', file.size);
    
    // Show preview section
    if (previewSection) previewSection.style.display = 'block';
    if (dataPreview) {
        dataPreview.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div class="loading-spinner" style="margin: 20px auto; border: 4px solid #f3f3f3; border-top: 4px solid #ee5968; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
                <p>Processing file...</p>
            </div>
        `;
    }
    
    try {
        // Read and parse file
        let parsedResults = [];
        
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            console.log('📊 Processing CSV file...');
            const fileData = await readFileAsText(file);
            console.log('📝 File data length:', fileData.length);
            parsedResults = parseCSVData(fileData);
            console.log('✅ Parsed results:', parsedResults.length);
        } else {
            console.warn('⚠️ Invalid file type:', file.type);
            if (window.labResultsApp) {
                window.labResultsApp.showMessage('Please select a CSV file for preview', 'warning');
            } else {
                alert('Please select a CSV file for preview');
            }
            if (previewSection) previewSection.style.display = 'none';
            return;
        }
        
        // Display preview
        if (parsedResults.length > 0) {
            console.log('✨ Displaying preview for', parsedResults.length, 'results');
            // Create table with actual data
            let tableHTML = `
                <table style="width: 100%; border-collapse: collapse; background: white;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Patient Name</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Patient ID</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Test</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Status</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            // Show first 5 rows
            const previewCount = Math.min(5, parsedResults.length);
            for (let i = 0; i < previewCount; i++) {
                const result = parsedResults[i];
                const statusClass = result.status === 'abnormal' ? 'color: #d32f2f; font-weight: bold;' : 
                                   result.status === 'normal' ? 'color: #2e7d32;' : 'color: #f57c00;';
                tableHTML += `
                    <tr style="background: ${i % 2 === 0 ? 'white' : '#f9f9f9'};">
                        <td style="border: 1px solid #ddd; padding: 8px;">${result.patientName || 'N/A'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${result.patientId || 'N/A'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${result.test || 'N/A'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px; ${statusClass}">${result.status || 'N/A'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${result.date || 'N/A'}</td>
                    </tr>
                `;
            }
            
            tableHTML += `
                    </tbody>
                </table>
            `;
            
            if (dataPreview) {
                dataPreview.innerHTML = tableHTML;
            }
            
            // Show statistics
            if (previewStats) {
                const normalCount = parsedResults.filter(r => r.status === 'normal').length;
                const abnormalCount = parsedResults.filter(r => r.status === 'abnormal').length;
                const pendingCount = parsedResults.filter(r => r.status === 'pending').length;
                
                previewStats.innerHTML = `
                    <strong>File Statistics:</strong> 
                    Total: <span style="font-weight: bold; color: #2c5aa0;">${parsedResults.length}</span> results | 
                    Normal: <span style="color: #2e7d32;">${normalCount}</span> | 
                    Abnormal: <span style="color: #d32f2f;">${abnormalCount}</span> | 
                    Pending: <span style="color: #f57c00;">${pendingCount}</span>
                    ${parsedResults.length > 5 ? ` | Showing first 5 of ${parsedResults.length} rows` : ''}
                `;
            }
            
            // Enable import button
            if (importBtn) {
                importBtn.disabled = false;
                console.log('✅ Import button enabled');
            }
            
            if (window.labResultsApp) {
                window.labResultsApp.showMessage('File preview loaded successfully', 'success');
            }
            
        } else {
            console.error('❌ No valid data found');
            if (dataPreview) {
                dataPreview.innerHTML = '<p style="text-align: center; color: #d32f2f; padding: 20px;">No valid data found in file. Please check the format.</p>';
            }
            if (window.labResultsApp) {
                window.labResultsApp.showMessage('No valid data found in file', 'error');
            }
        }
        
    } catch (error) {
        console.error('❌ Error previewing file:', error);
        if (dataPreview) {
            dataPreview.innerHTML = `
                <p style="text-align: center; color: #d32f2f; padding: 20px;">
                    <i class="fas fa-exclamation-triangle"></i><br><br>
                    Error: ${error.message}<br><br>
                    Please ensure your CSV has the required columns:<br>
                    <strong>patientName, patientId, test, status, results, date</strong>
                </p>
            `;
        }
        if (window.labResultsApp) {
            window.labResultsApp.showMessage('Error previewing file: ' + error.message, 'error');
        } else {
            alert('Error previewing file: ' + error.message);
        }
    }
}

// Enhanced import with progress tracking
// REMOVED DUPLICATE: async function importLabResults() {

// File reader helper
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('✅ File read as text, length:', e.target.result.length);
            resolve(e.target.result);
        };
        reader.onerror = (error) => {
            console.error('❌ Error reading file:', error);
            reject(error);
        };
        reader.readAsText(file);
    });
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Enhanced CSV parser with better error handling
function parseCSVData(csvText) {
    console.log('📊 Parsing CSV data, length:', csvText.length);
    
    const lines = csvText.split('\n').filter(line => line.trim());
    console.log('📄 Found', lines.length, 'lines');
    
    if (lines.length < 2) {
        throw new Error('CSV file is empty or contains only headers');
    }
    
    // Helper function to parse CSV line with quoted fields
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        
        return result.map(field => field.replace(/^"|"$/g, ''));
    }
    
    // Parse headers
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    console.log('📋 CSV Headers:', headers);
    
    // Required headers (flexible matching)
    const requiredFields = {
        patientName: ['patientname', 'patient name', 'name', 'patient'],
        patientId: ['patientid', 'patient id', 'id', 'patient_id'],
        test: ['test', 'testtype', 'test type', 'test_type', 'lab test'],
        status: ['status', 'result status', 'test status'],
        results: ['results', 'result', 'test results', 'test result', 'values'],
        date: ['date', 'testdate', 'test date', 'test_date', 'date tested']
    };
    
    // Find column indices for each required field
    const columnMap = {};
    for (const [field, possibleHeaders] of Object.entries(requiredFields)) {
        const index = headers.findIndex(h => 
            possibleHeaders.some(ph => h.includes(ph) || ph.includes(h))
        );
        if (index === -1) {
            throw new Error(`Missing required column: ${field}. CSV must contain: patientName, patientId, test, status, results, date`);
        }
        columnMap[field] = index;
    }
    
    // Optional fields
    const optionalFields = {
        patientType: ['patienttype', 'patient type', 'type', 'patient_type'],
        notes: ['notes', 'note', 'comments', 'doctornotes', 'doctor notes']
    };
    
    for (const [field, possibleHeaders] of Object.entries(optionalFields)) {
        const index = headers.findIndex(h => 
            possibleHeaders.some(ph => h.includes(ph) || ph.includes(h))
        );
        if (index !== -1) {
            columnMap[field] = index;
        }
    }
    
    console.log('🗺️ Column mapping:', columnMap);
    
    // Parse data rows
    const results = [];
    const errors = [];
    
    for (let i = 1; i < lines.length; i++) {
        try {
            const values = parseCSVLine(lines[i]);
            
            if (values.length < headers.length - 2) {
                // Allow some flexibility in column count
                continue;
            }
            
            const result = {
                patientName: values[columnMap.patientName]?.trim() || '',
                patientId: values[columnMap.patientId]?.trim() || '',
                test: values[columnMap.test]?.trim() || '',
                status: values[columnMap.status]?.trim().toLowerCase() || 'pending',
                results: values[columnMap.results]?.trim() || '',
                date: values[columnMap.date]?.trim() || '',
                patientType: columnMap.patientType ? (values[columnMap.patientType]?.trim() || 'Gynecology') : 'Gynecology',
                notes: columnMap.notes ? (values[columnMap.notes]?.trim() || '') : ''
            };
            
            // Validate required fields
            if (!result.patientName || !result.patientId || !result.test || !result.results || !result.date) {
                errors.push(`Row ${i + 1}: Missing required data`);
                continue;
            }
            
            // Validate status
            if (!['pending', 'normal', 'abnormal'].includes(result.status)) {
                result.status = 'pending';
            }
            
            // Validate and format date
            if (result.date) {
                // Try to parse various date formats
                const dateFormats = [
                    /^\d{4}-\d{2}-\d{2}$/,  // YYYY-MM-DD
                    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
                    /^\d{2}-\d{2}-\d{4}$/    // DD-MM-YYYY
                ];
                
                if (!dateFormats.some(format => format.test(result.date))) {
                    // Try to convert to ISO format
                    const parsedDate = new Date(result.date);
                    if (!isNaN(parsedDate.getTime())) {
                        result.date = parsedDate.toISOString().split('T')[0];
                    } else {
                        errors.push(`Row ${i + 1}: Invalid date format`);
                        continue;
                    }
                }
            }
            
            results.push(result);
            
        } catch (error) {
            errors.push(`Row ${i + 1}: ${error.message}`);
        }
    }
    
    console.log(`✅ Parsed ${results.length} valid results from ${lines.length - 1} rows`);
    if (errors.length > 0) {
        console.warn('⚠️ Parsing errors:', errors);
    }
    
    if (results.length === 0) {
        throw new Error('No valid data found in CSV file. Errors: ' + errors.join('; '));
    }
    
    return results;
}

// ========================================
// COMPLETE LAB RESULTS SYSTEM FIX
// ADD THIS ENTIRE CODE TO THE END OF Lab Results.js
// Version: 4.0 - Final Complete Fix
// ========================================

console.log('🔧 LOADING COMPLETE LAB RESULTS FIXES v4.0...');

// ========================================
// FIX 1: PATIENT TYPE FILTER - COMPLETE
// ========================================


// ========================================
// FIX 2: FILE UPLOAD - COMPLETE
// ========================================

let fileUploadInitialized = false;

function initializeFileUpload() {
    if (fileUploadInitialized) return;
    
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileInput');
    
    if (!fileUploadArea || !fileInput) {
        setTimeout(initializeFileUpload, 500);
        return;
    }
    
    console.log('📁 Initializing file upload...');
    
    // Click handler
    fileUploadArea.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('📁 Upload area clicked');
        fileInput.click();
    });
    
    // File selection handler
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    ['dragover', 'dragenter'].forEach(eventName => {
        fileUploadArea.addEventListener(eventName, function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.style.borderColor = '#e91e63';
            this.style.backgroundColor = '#fff5f7';
        });
    });
    
    ['dragleave', 'dragend'].forEach(eventName => {
        fileUploadArea.addEventListener(eventName, function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.style.borderColor = '';
            this.style.backgroundColor = '';
        });
    });
    
    fileUploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.borderColor = '';
        this.style.backgroundColor = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelect({ target: fileInput });
        }
    });
    
    fileUploadInitialized = true;
    console.log('✅ File upload initialized');
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    console.log('📄 File selected:', file.name, file.type);
    
    const selectedFileName = document.getElementById('selectedFileName');
    const fileNameText = document.getElementById('fileNameText');
    const previewBtn = document.getElementById('previewBtn');
    
    // Show file name
    if (selectedFileName && fileNameText) {
        fileNameText.textContent = file.name;
        selectedFileName.style.display = 'block';
    }
    
    // Enable preview for CSV
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        if (previewBtn) {
            previewBtn.disabled = false;
            console.log('✅ Preview button enabled');
        }
    }
}

// Initialize on DOM ready and after delays
document.addEventListener('DOMContentLoaded', initializeFileUpload);
setTimeout(initializeFileUpload, 500);
setTimeout(initializeFileUpload, 1000);
setTimeout(initializeFileUpload, 2000);

// ========================================
// FIX 3: PREVIEW FILE - COMPLETE
// ========================================

// REMOVED DUPLICATE: OLD previewFile (lines 5397-5527)

// ========================================
// FIX 4: IMPORT LAB RESULTS - COMPLETE
// ========================================

// REMOVED DUPLICATE: window.importLabResults = async function() {

// ========================================
// HELPER FUNCTIONS
// ========================================

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function parseCSVData(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error('CSV is empty');
    
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result.map(f => f.replace(/^"|"$/g, ''));
    }
    
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    
    const required = {
        patientName: ['patientname', 'patient name', 'name'],
        patientId: ['patientid', 'patient id', 'id'],
        test: ['test', 'testtype', 'test type'],
        status: ['status'],
        results: ['results', 'result'],
        date: ['date', 'testdate']
    };
    
    const map = {};
    for (const [field, options] of Object.entries(required)) {
        const index = headers.findIndex(h => options.some(o => h.includes(o)));
        if (index === -1) throw new Error(`Missing column: ${field}`);
        map[field] = index;
    }
    
    const optional = {
        patientType: ['patienttype', 'type'],
        notes: ['notes', 'note']
    };
    
    for (const [field, options] of Object.entries(optional)) {
        const index = headers.findIndex(h => options.some(o => h.includes(o)));
        if (index !== -1) map[field] = index;
    }
    
    const results = [];
    for (let i = 1; i < lines.length; i++) {
        try {
            const values = parseCSVLine(lines[i]);
            if (values.length < 3) continue;
            
            const result = {
                patientName: values[map.patientName]?.trim() || '',
                patientId: values[map.patientId]?.trim() || '',
                test: values[map.test]?.trim() || '',
                status: (values[map.status]?.trim() || 'pending').toLowerCase(),
                results: values[map.results]?.trim() || '',
                date: values[map.date]?.trim() || '',
                patientType: map.patientType ? (values[map.patientType]?.trim() || '') : '',
                notes: map.notes ? (values[map.notes]?.trim() || '') : ''
            };
            
            if (!result.patientName || !result.patientId || !result.test || !result.results || !result.date) {
                continue;
            }
            
            if (!['pending', 'normal', 'abnormal'].includes(result.status)) {
                result.status = 'pending';
            }
            
            if (!/^\d{4}-\d{2}-\d{2}$/.test(result.date)) {
                const parsed = new Date(result.date);
                if (!isNaN(parsed.getTime())) {
                    result.date = parsed.toISOString().split('T')[0];
                } else {
                    continue;
                }
            }
            
            results.push(result);
        } catch (error) {
            console.warn(`Row ${i + 1}: ${error.message}`);
        }
    }
    
    if (results.length === 0) throw new Error('No valid data rows');
    
    return results;
}

function showSuccess(msg) {
    if (window.labResultsApp?.showMessage) {
        window.labResultsApp.showMessage(msg, 'success');
    } else {
        alert(msg);
    }
}

function showError(msg) {
    if (window.labResultsApp?.showMessage) {
        window.labResultsApp.showMessage(msg, 'error');
    } else {
        alert(msg);
    }
}

console.log('✅ Lab Results fixes loaded!');
console.log('📋 Fixed:');
console.log('   ✓ Gynecology/Prenatal filters');
console.log('   ✓ CSV import');
console.log('   ✓ File upload area');
console.log('   ✓ Preview functionality');

// ====================================================
// COMPLETE LAB RESULTS IMPORT FIX - FINAL VERSION
// Version: 5.0 - WORKING SOLUTION
// ====================================================

console.log('🔧 LOADING COMPLETE IMPORT FIX v5.0...');

// ====================================================
// GLOBAL STATE FOR IMPORT
// ====================================================

window.labImportState = {
    selectedFile: null,
    previewedData: null,
    isProcessing: false
};

// ====================================================
// FIX 1: FILE UPLOAD AREA - COMPLETE REWRITE
// ====================================================

function initializeFileUploadArea() {
    console.log('📁 Initializing file upload area...');
    
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileInput');
    
    if (!fileUploadArea || !fileInput) {
        console.warn('⚠️ Upload elements not found, retrying...');
        setTimeout(initializeFileUploadArea, 500);
        return;
    }
    
    // Remove any existing event listeners by cloning
    const newFileUploadArea = fileUploadArea.cloneNode(true);
    fileUploadArea.parentNode.replaceChild(newFileUploadArea, fileUploadArea);
    
    const newFileInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(newFileInput, fileInput);
    
    // Get the new elements
    const uploadArea = document.getElementById('fileUploadArea');
    const input = document.getElementById('fileInput');
    
    // Make upload area visually interactive
    uploadArea.style.cursor = 'pointer';
    uploadArea.style.transition = 'all 0.3s ease';
    
    // Click handler - DIRECT AND SIMPLE
    uploadArea.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🖱️ Upload area CLICKED!');
        input.click();
    }, true); // Use capture phase
    
    // File selection handler
    input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        console.log('📄 File selected:', file.name, file.type, file.size);
        handleFileSelection(file);
    });
    
    // Drag and drop handlers
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.borderColor = '#e91e63';
        this.style.backgroundColor = '#fff5f7';
    });
    
    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.borderColor = '#e0e0e0';
        this.style.backgroundColor = '';
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.style.borderColor = '#e0e0e0';
        this.style.backgroundColor = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelection(files[0]);
        }
    });
    
    console.log('✅ File upload area initialized successfully');
}

// ====================================================
// FIX 2: FILE SELECTION HANDLER
// ====================================================

function handleFileSelection(file) {
    console.log('📋 Handling file selection:', file.name);
    
    window.labImportState.selectedFile = file;
    
    // Show file name
    const selectedFileName = document.getElementById('selectedFileName');
    const fileNameText = document.getElementById('fileNameText');
    
    if (selectedFileName && fileNameText) {
        fileNameText.textContent = file.name;
        selectedFileName.style.display = 'block';
    }
    
    // Enable appropriate buttons based on file type
    const previewBtn = document.getElementById('previewBtn');
    const importBtn = document.getElementById('importBtn');
    const processImageBtn = document.getElementById('processImageBtn');
    
    // Reset all buttons first
    if (previewBtn) previewBtn.disabled = true;
    if (importBtn) importBtn.disabled = true;
    if (processImageBtn) processImageBtn.disabled = true;
    
    // Enable based on file type
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();
    
    if (fileName.endsWith('.csv') || fileType === 'text/csv') {
        console.log('✅ CSV detected - enabling preview and import');
        if (previewBtn) previewBtn.disabled = false;
        if (importBtn) importBtn.disabled = false; // Enable direct import
    } else if (fileName.match(/\.(jpg|jpeg|png|pdf|tiff?)$/i) || 
               fileType.match(/^image\//)) {
        console.log('✅ Image detected - enabling process');
        if (processImageBtn) processImageBtn.disabled = false;
    }
    
    // Show success message
    showMessage(`File "${file.name}" selected successfully`, 'success');
}

// ====================================================
// FIX 3: PREVIEW FILE FUNCTION
// ====================================================

// REMOVED DUPLICATE: OLD previewFile (lines 5813-5990)

// ====================================================
// FIX 4: IMPORT LAB RESULTS FUNCTION
// ====================================================

// REMOVED DUPLICATE: window.importLabResults = async function() {

// ====================================================
// HELPER FUNCTIONS
// ====================================================

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('✅ File read, length:', e.target.result.length);
            resolve(e.target.result);
        };
        reader.onerror = (error) => {
            console.error('❌ File read error:', error);
            reject(new Error('Failed to read file'));
        };
        reader.readAsText(file);
    });
}

function parseCSVData(csvText) {
    console.log('📊 Parsing CSV, length:', csvText.length);
    
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
        throw new Error('CSV file is empty or contains only headers');
    }
    
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result.map(f => f.replace(/^"|"$/g, ''));
    }
    
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    console.log('📋 Headers:', headers);
    
    // Define required and optional columns
    const columnDefs = {
        required: {
            patientName: ['patientname', 'patient name', 'patient_name', 'name'],
            patientId: ['patientid', 'patient id', 'patient_id', 'id'],
            test: ['test', 'testtype', 'test type', 'test_type'],
            status: ['status', 'resultstatus', 'result status'],
            results: ['results', 'result', 'testresult', 'test result'],
            date: ['date', 'testdate', 'test date', 'test_date']
        },
        optional: {
            patientType: ['patienttype', 'patient type', 'patient_type', 'type'],
            notes: ['notes', 'note', 'comments', 'doctornotes']
        }
    };
    
    // Find column indices
    const columnMap = {};
    
    for (const [field, patterns] of Object.entries(columnDefs.required)) {
        const index = headers.findIndex(h => 
            patterns.some(p => h.includes(p) || p.includes(h))
        );
        if (index === -1) {
            throw new Error(`Missing required column: ${field}`);
        }
        columnMap[field] = index;
    }
    
    for (const [field, patterns] of Object.entries(columnDefs.optional)) {
        const index = headers.findIndex(h => 
            patterns.some(p => h.includes(p) || p.includes(h))
        );
        if (index !== -1) columnMap[field] = index;
    }
    
    console.log('🗺️ Column map:', columnMap);
    
    // Parse data rows
    const results = [];
    const errors = [];
    
    for (let i = 1; i < lines.length; i++) {
        try {
            const values = parseCSVLine(lines[i]);
            
            if (values.length < 3) continue;
            
            const result = {
                patientName: values[columnMap.patientName]?.trim() || '',
                patientId: values[columnMap.patientId]?.trim() || '',
                test: values[columnMap.test]?.trim() || '',
                status: (values[columnMap.status]?.trim() || 'pending').toLowerCase(),
                results: values[columnMap.results]?.trim() || '',
                date: values[columnMap.date]?.trim() || '',
                patientType: columnMap.patientType ? 
                    (values[columnMap.patientType]?.trim() || 'Gynecology') : 'Gynecology',
                notes: columnMap.notes ? 
                    (values[columnMap.notes]?.trim() || '') : ''
            };
            
            // Validate
            if (!result.patientName || !result.patientId || !result.test || 
                !result.results || !result.date) {
                errors.push(`Row ${i + 1}: Missing required data`);
                continue;
            }
            
            // Validate status
            if (!['pending', 'normal', 'abnormal'].includes(result.status)) {
                result.status = 'pending';
            }
            
            // Validate date
            if (!/^\d{4}-\d{2}-\d{2}$/.test(result.date)) {
                const parsed = new Date(result.date);
                if (!isNaN(parsed.getTime())) {
                    result.date = parsed.toISOString().split('T')[0];
                } else {
                    errors.push(`Row ${i + 1}: Invalid date`);
                    continue;
                }
            }
            
            results.push(result);
            
        } catch (error) {
            errors.push(`Row ${i + 1}: ${error.message}`);
        }
    }
    
    console.log(`✅ Parsed ${results.length} rows (${errors.length} errors)`);
    
    if (results.length === 0) {
        throw new Error('No valid data rows found');
    }
    
    return results;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function showMessage(msg, type) {
    if (window.labResultsApp && window.labResultsApp.showMessage) {
        window.labResultsApp.showMessage(msg, type);
    } else {
        console.log(`${type.toUpperCase()}: ${msg}`);
        alert(msg);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
}

// ====================================================
// INITIALIZE ON LOAD
// ====================================================

// Multiple initialization attempts to ensure it works
document.addEventListener('DOMContentLoaded', initializeFileUploadArea);
setTimeout(initializeFileUploadArea, 500);
setTimeout(initializeFileUploadArea, 1000);
setTimeout(initializeFileUploadArea, 2000);

// Re-initialize when import modal opens
const importLabBtn = document.getElementById('importLabBtn');
if (importLabBtn) {
    importLabBtn.addEventListener('click', function() {
        console.log('🔵 Import button clicked');
        openImportModal();
    });
    console.log('✅ Import button click handler attached');
}

console.log('✅ Complete Import Fix v5.0 Loaded!');
console.log('📋 Features:');
console.log('  ✓ Click to upload');
console.log('  ✓ Drag and drop');
console.log('  ✓ CSV preview with stats');
console.log('  ✓ Direct import');
console.log('  ✓ Progress tracking');
console.log('  ✓ Error handling');
console.log('🎯 Ready to import lab results!');
// ====================================================
// GLOBAL WRAPPER FUNCTION FOR IMPORT MODAL
// ====================================================

// REMOVED DUPLICATE: OLD openImportModal (lines 6209-6222)

// ====================================================
// MISSING GLOBAL FUNCTIONS
// ====================================================

// REMOVED DUPLICATE: OLD handleFormatChange (lines 6228-6261)

// REMOVED DUPLICATE: OLD clearFileSelection (lines 6263-6287)

window.processImage = function() {
    console.log('🖼️ Process image called');
    showMessage('Image processing feature coming soon!', 'info');
    // This would integrate with OCR/image processing
};

console.log('✅ openImportModal function added!');
console.log('✅ handleFormatChange function added!');
console.log('✅ clearFileSelection function added!');
console.log('✅ processImage function added!');// =============================================

// ========================================================================
// IMPORT SYSTEM - CLEAN VERSION (ALL DUPLICATES REMOVED)
// ========================================================================

// ========================================================================
// CLEAN IMPORT SYSTEM - SINGLE SOURCE OF TRUTH
// ========================================================================

// Import state variables
let selectedImportFile = null;
let previewedData = null;

// ========================================================================
// 1. INITIALIZE FILE UPLOAD AREA
// ========================================================================
function initializeFileUploadArea() {
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileInput');
    
    if (!fileUploadArea || !fileInput) {
        console.error('❌ File upload elements not found');
        return;
    }
    
    // Click to upload
    fileUploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Drag and drop
    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.style.borderColor = '#2196f3';
        fileUploadArea.style.background = '#e3f2fd';
    });
    
    fileUploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        fileUploadArea.style.borderColor = '#ddd';
        fileUploadArea.style.background = 'white';
    });
    
    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.style.borderColor = '#ddd';
        fileUploadArea.style.background = 'white';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelection(files[0]);
        }
    });
    
    // File selection handler
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });
    
    console.log('✅ File upload area initialized');
}

// ========================================================================
// 2. HANDLE FILE SELECTION
// ========================================================================
function handleFileSelection(file) {
    console.log('📁 File selected:', file.name);
    
    selectedImportFile = file;
    
    const selectedFileName = document.getElementById('selectedFileName');
    const fileNameText = document.getElementById('fileNameText');
    const fileSizeText = document.getElementById('fileSizeText');
    const previewBtn = document.getElementById('previewBtn');
    const processImageBtn = document.getElementById('processImageBtn');
    
    // Show file info
    if (fileNameText) fileNameText.textContent = file.name;
    if (fileSizeText) fileSizeText.textContent = `Size: ${(file.size / 1024).toFixed(2)} KB`;
    if (selectedFileName) selectedFileName.style.display = 'block';
    
    // Get current format
    const format = document.querySelector('input[name="importFormat"]:checked')?.value || 'csv';
    
    // Enable appropriate button
    if (format === 'csv') {
        if (previewBtn) previewBtn.disabled = false;
        if (processImageBtn) processImageBtn.disabled = true;
    } else if (format === 'image') {
        if (previewBtn) previewBtn.disabled = true;
        if (processImageBtn) processImageBtn.disabled = false;
    }
}

// ========================================================================
// 3. PREVIEW FILE
// ========================================================================
window.previewFile = async function() {
    console.log('👁️ Previewing file...');
    
    if (!selectedImportFile) {
        alert('Please select a file first');
        return;
    }
    
    const previewSection = document.getElementById('previewSection');
    const previewDiv = document.getElementById('dataPreview');
    const previewStats = document.getElementById('previewStats');
    const importBtn = document.getElementById('importBtn');
    
    try {
        const text = await selectedImportFile.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        console.log(`📊 Found ${lines.length} lines`);
        
        // Parse CSV
        const headers = lines[0].split(',').map(h => h.trim());
        const dataRows = lines.slice(1);
        
        // Show preview (first 5 rows)
        let previewHTML = '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        previewHTML += '<thead><tr>';
        headers.forEach(header => {
            previewHTML += `<th style="border: 1px solid #ddd; padding: 8px; background: #f0f0f0;">${header}</th>`;
        });
        previewHTML += '</tr></thead><tbody>';
        
        dataRows.slice(0, 5).forEach(row => {
            const cells = row.split(',').map(cell => cell.trim());
            previewHTML += '<tr>';
            cells.forEach(cell => {
                previewHTML += `<td style="border: 1px solid #ddd; padding: 8px;">${cell}</td>`;
            });
            previewHTML += '</tr>';
        });
        
        previewHTML += '</tbody></table>';
        
        if (previewDiv) {
            previewDiv.innerHTML = previewHTML;
        }
        
        // Show stats
        if (previewStats) {
            previewStats.innerHTML = `
                <strong>Preview:</strong> Showing 5 of ${dataRows.length} rows | 
                <strong>Columns:</strong> ${headers.length} | 
                <strong>File:</strong> ${selectedImportFile.name}
            `;
        }
        
        if (previewSection) {
            previewSection.style.display = 'block';
        }
        
        // Store data for import
        previewedData = lines;
        
        // Enable import button
        if (importBtn) {
            importBtn.disabled = false;
            console.log('✅ Import button enabled');
        }
        
        console.log('✅ Preview complete');
        
    } catch (error) {
        console.error('❌ Preview error:', error);
        alert('Error reading file: ' + error.message);
    }
};

// ========================================================================
// 4. IMPORT LAB RESULTS
// ========================================================================
window.importLabResults = async function() {
    console.log('📥 Starting import...');
    
    if (!previewedData || previewedData.length === 0) {
        alert('Please preview the file first');
        return;
    }
    
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const importBtn = document.getElementById('importBtn');
    
    // Show progress
    if (progressSection) progressSection.style.display = 'block';
    if (importBtn) importBtn.disabled = true;
    
    try {
        // Get headers (first line)
        const headers = previewedData[0].split(',').map(h => h.trim().toLowerCase());
        console.log('📋 Headers:', headers);
        
        let imported = 0;
        let failed = 0;
        
        // Process each data row
        for (let i = 1; i < previewedData.length; i++) {
            const values = previewedData[i].split(',').map(v => v.trim());
            
            if (values.length !== headers.length) {
                console.warn(`⚠️ Row ${i} skipped: column count mismatch`);
                failed++;
                continue;
            }
            
            // Create object from headers and values
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index];
            });
            
            // Map to lab result object
            const labResult = {
                patientName: row['patient_name'] || row['name'] || row['patient name'] || 'Unknown',
                patientId: row['patient_id'] || row['id'] || row['patient id'] || `PT${Date.now()}${i}`,
                patientType: row['patient_type'] || row['type'] || row['patient type'] || 'Prenatal',
                test: row['test'] || row['test_type'] || row['test type'] || row['test_name'] || 'Lab Test',
                status: (row['status'] || 'pending').toLowerCase(),
                results: row['results'] || row['result'] || row['value'] || 'Pending',
                notes: row['notes'] || row['note'] || row['comments'] || '',
                date: row['date'] || row['test_date'] || row['test date'] || new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                acknowledged: false,
                importedFrom: selectedImportFile.name,
                importedAt: new Date().toISOString()
            };
            
            // Save to Firebase
            try {
                if (typeof labResultsRef !== 'undefined' && labResultsRef) {
                    await labResultsRef.push(labResult);
                    imported++;
                    console.log(`✅ Row ${i}: ${labResult.patientName} - ${labResult.test}`);
                } else {
                    console.error('❌ Firebase not initialized');
                    throw new Error('Firebase not available');
                }
            } catch (error) {
                console.error(`❌ Error saving row ${i}:`, error);
                failed++;
            }
            
            // Update progress
            const progress = Math.round((i / (previewedData.length - 1)) * 100);
            if (progressBar) progressBar.style.width = progress + '%';
            if (progressText) progressText.textContent = `Importing... ${progress}%`;
        }
        
        // Show results
        if (progressText) {
            progressText.textContent = `✅ Import complete! Imported: ${imported}, Failed: ${failed}`;
            progressText.style.color = '#2e7d32';
        }
        
        console.log(`✅ Import complete: ${imported} imported, ${failed} failed`);
        
        // Show success message
        if (window.labResultsApp && window.labResultsApp.showMessage) {
            window.labResultsApp.showMessage(`Successfully imported ${imported} lab results!`, 'success');
        }
        
        // Close modal and reload after 2 seconds
        setTimeout(() => {
            closeModal('importModal');
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('❌ Import error:', error);
        if (progressText) {
            progressText.textContent = '❌ Import failed: ' + error.message;
            progressText.style.color = '#d32f2f';
        }
        alert('Import failed: ' + error.message);
        if (importBtn) importBtn.disabled = false;
    }
};

// ========================================================================
// 5. MODERN FILE IMPORTER SYSTEM
// ========================================================================

// File type definitions
const ACCEPTED_FILE_TYPES = {
    'text/csv': { icon: 'fa-file-csv', label: 'CSV', color: 'csv' },
    'application/pdf': { icon: 'fa-file-pdf', label: 'PDF', color: 'pdf' },
    'image/jpeg': { icon: 'fa-file-image', label: 'JPG', color: 'jpg' },
    'image/png': { icon: 'fa-file-image', label: 'PNG', color: 'png' },
    'image/tiff': { icon: 'fa-file-image', label: 'TIFF', color: 'tiff' },
};

// Global state for selected files
let selectedFiles = [];

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get file type info
function getFileTypeInfo(file) {
    const type = file.type;
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (type in ACCEPTED_FILE_TYPES) return ACCEPTED_FILE_TYPES[type];
    
    const extMap = {
        'csv': ACCEPTED_FILE_TYPES['text/csv'],
        'pdf': ACCEPTED_FILE_TYPES['application/pdf'],
        'jpg': ACCEPTED_FILE_TYPES['image/jpeg'],
        'jpeg': ACCEPTED_FILE_TYPES['image/jpeg'],
        'png': ACCEPTED_FILE_TYPES['image/png'],
        'tiff': ACCEPTED_FILE_TYPES['image/tiff'],
        'tif': ACCEPTED_FILE_TYPES['image/tiff'],
    };
    
    return extMap[ext] || null;
}

// Show import error
function showImportError(message) {
    const container = document.getElementById('importErrorContainer');
    if (!container) return;
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'import-error-item';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;
    container.appendChild(errorDiv);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 4000);
}

// Process dropped/selected files
function processSelectedFiles(fileList) {
    const newFiles = [];
    const errors = [];
    
    Array.from(fileList).forEach((file) => {
        const fileType = getFileTypeInfo(file);
        
        if (!fileType) {
            errors.push(`"${file.name}" is not a supported file type`);
            return;
        }
        
        // Check for duplicates
        const isDuplicate = selectedFiles.some(
            (f) => f.file.name === file.name && f.file.size === file.size
        );
        
        if (isDuplicate) {
            errors.push(`"${file.name}" has already been added`);
            return;
        }
        
        // Create preview for images
        let preview = null;
        if (file.type.startsWith('image/')) {
            preview = URL.createObjectURL(file);
        }
        
        newFiles.push({
            id: `${file.name}-${Date.now()}-${Math.random()}`,
            file: file,
            type: fileType,
            preview: preview
        });
    });
    
    // Add new files to selected files array
    if (newFiles.length > 0) {
        selectedFiles = [...selectedFiles, ...newFiles];
        updateFilesUI();
    }
    
    // Show errors
    errors.forEach(error => showImportError(error));
}

// Update the files list UI
function updateFilesUI() {
    const filesSection = document.getElementById('selectedFilesSection');
    const filesList = document.getElementById('filesList');
    const fileCount = document.getElementById('fileCount');
    const importBtnText = document.getElementById('importBtnText');
    
    if (!filesSection || !filesList) return;
    
    if (selectedFiles.length === 0) {
        filesSection.style.display = 'none';
        if (importBtnText) importBtnText.textContent = 'Import Results';
        return;
    }
    
    filesSection.style.display = 'block';
    
    // Update file count
    const countText = `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''} selected`;
    if (fileCount) fileCount.textContent = countText;
    if (importBtnText) importBtnText.textContent = `Import ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`;
    
    // Clear and rebuild files list
    filesList.innerHTML = '';
    
    selectedFiles.forEach((item) => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        fileDiv.dataset.fileId = item.id;
        
        // File preview/icon
        let previewHTML;
        if (item.preview) {
            previewHTML = `<img src="${item.preview}" alt="${item.file.name}" class="file-preview-thumb" />`;
        } else {
            const ext = item.file.name.split('.').pop().toLowerCase();
            previewHTML = `
                <div class="file-icon-box ${ext}">
                    <i class="fas ${item.type.icon}"></i>
                </div>
            `;
        }
        
        fileDiv.innerHTML = `
            ${previewHTML}
            <div class="file-info">
                <p class="file-name">${item.file.name}</p>
                <p class="file-meta">${item.type.label} • ${formatFileSize(item.file.size)}</p>
            </div>
            <i class="fas fa-check-circle file-check"></i>
            <button type="button" class="file-remove-btn" onclick="removeFile('${item.id}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        filesList.appendChild(fileDiv);
    });
}

// Remove a single file
window.removeFile = function(fileId) {
    const fileToRemove = selectedFiles.find(f => f.id === fileId);
    if (fileToRemove && fileToRemove.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
    }
    selectedFiles = selectedFiles.filter(f => f.id !== fileId);
    updateFilesUI();
};

// Clear all files
window.clearAllFiles = function() {
    selectedFiles.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
    });
    selectedFiles = [];
    updateFilesUI();
};

// Import selected files
window.importSelectedFiles = async function() {
    if (selectedFiles.length === 0) {
        showImportError('Please select at least one file');
        return;
    }
    
    // Get form field values
    const patientId = document.getElementById('importPatientId')?.value?.trim() || '';
    const status = document.getElementById('importStatus')?.value || 'pending';
    const doctor = document.getElementById('importDoctor')?.value?.trim() || '';
    const notes = document.getElementById('importNotes')?.value?.trim() || '';
    
    // Validate required fields
    if (!patientId) {
        showImportError('Please enter or search for a Patient ID');
        document.getElementById('importPatientId')?.focus();
        return;
    }
    
    if (!status) {
        showImportError('Please select a status');
        document.getElementById('importStatus')?.focus();
        return;
    }
    
    const progressSection = document.getElementById('importProgressSection');
    const progressBar = document.getElementById('importProgressBar');
    const progressText = document.getElementById('importProgressText');
    const filesSection = document.getElementById('selectedFilesSection');
    const dropZone = document.getElementById('dropZone');
    const formButtons = document.querySelector('.form-buttons');
    
    // Show progress, hide other elements
    if (progressSection) progressSection.style.display = 'block';
    if (filesSection) filesSection.style.display = 'none';
    if (dropZone) dropZone.style.display = 'none';
    if (formButtons) formButtons.style.display = 'none';
    
    let imported = 0;
    let failed = 0;
    const total = selectedFiles.length;
    
    // Initialize array to collect files
    window.importFilesForPatient = [];
    
    // Use selected patient info if available
    let patientName = selectedImportPatient?.name || 'Unknown';
    let patientType = selectedImportPatient?.type || 'Prenatal';
    let existingTestType = 'Lab Test'; // Default test type
    
    // Fetch the patient's existing test type from their lab result matching BOTH patient ID AND type
    try {
        if (typeof labResultsRef !== 'undefined' && labResultsRef) {
            const labSnapshot = await labResultsRef.orderByChild('patientId').equalTo(patientId).once('value');
            if (labSnapshot.exists()) {
                // Find lab result that matches both patient ID AND patient type
                let matchingResult = null;
                let mostRecentDate = null;
                
                labSnapshot.forEach((child) => {
                    const result = child.val();
                    // Only consider results that match the selected patient type
                    if (result.patientType === patientType) {
                        const resultDate = result.createdAt || result.date || '';
                        
                        if (!mostRecentDate || resultDate > mostRecentDate) {
                            mostRecentDate = resultDate;
                            matchingResult = result;
                        }
                    }
                });
                
                if (matchingResult) {
                    existingTestType = matchingResult.test || 'Lab Test';
                    patientName = matchingResult.patientName || patientName;
                    console.log(`✅ Found existing test type: ${existingTestType} for patient ${patientId} (${patientType})`);
                } else {
                    // If no matching type found, get any result for this patient
                    labSnapshot.forEach((child) => {
                        const result = child.val();
                        const resultDate = result.createdAt || result.date || '';
                        
                        if (!mostRecentDate || resultDate > mostRecentDate) {
                            mostRecentDate = resultDate;
                            matchingResult = result;
                        }
                    });
                    
                    if (matchingResult) {
                        existingTestType = matchingResult.test || 'Lab Test';
                        patientName = matchingResult.patientName || patientName;
                        console.log(`⚠️ No matching type found, using: ${existingTestType} for patient ${patientId}`);
                    }
                }
            }
        }
    } catch (error) {
        console.warn('Could not fetch existing test type:', error);
    }
    
    // If still no patient info, try to fetch from patients table
    if (patientName === 'Unknown') {
        try {
            if (typeof patientsRef !== 'undefined' && patientsRef) {
                const snapshot = await patientsRef.orderByChild('patientId').equalTo(patientId).once('value');
                if (snapshot.exists()) {
                    const patientData = Object.values(snapshot.val())[0];
                    patientName = patientData.fullName || patientData.name || 'Unknown';
                }
            }
        } catch (error) {
            console.warn('Could not fetch patient info:', error);
        }
    }
    
    // NOTE: We no longer delete old results - instead we ADD files to existing results
    // This allows multiple files to accumulate in the importedFiles array
    console.log(`📁 Import mode: Adding files to existing result for patient ${patientId} (${patientType}, ${existingTestType})`);
    
    for (let i = 0; i < selectedFiles.length; i++) {
        const item = selectedFiles[i];
        const file = item.file;
        
        try {
            // Update progress
            const progress = Math.round(((i + 1) / total) * 100);
            if (progressBar) progressBar.style.width = progress + '%';
            if (progressText) progressText.textContent = `Processing ${file.name}...`;
            
            // Check if it's a CSV file for data import
            if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                // Read and process CSV
                const csvData = await readFileAsText(file);
                const lines = csvData.split('\n').filter(line => line.trim());
                
                if (lines.length > 1) {
                    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                    
                    for (let j = 1; j < lines.length; j++) {
                        const values = lines[j].split(',').map(v => v.trim());
                        
                        if (values.length === headers.length) {
                            const row = {};
                            headers.forEach((header, index) => {
                                row[header] = values[index];
                            });
                            
                            // Get status from CSV or form, ensure it's valid
                            let rowStatus = row['status']?.toLowerCase() || status;
                            // Validate status - must be one of the allowed values
                            if (!['pending', 'normal', 'abnormal', 'reviewed', 'completed'].includes(rowStatus)) {
                                rowStatus = 'pending';
                            }
                            
                            const labResult = {
                                patientName: row['patient_name'] || row['name'] || row['patient name'] || patientName,
                                patientId: row['patient_id'] || row['id'] || row['patient id'] || patientId,
                                patientType: row['patient_type'] || row['type'] || row['patient type'] || patientType,
                                test: row['test'] || row['test_type'] || row['test type'] || row['test_name'] || existingTestType,
                                status: rowStatus,
                                results: row['results'] || row['result'] || row['value'] || 'Pending',
                                notes: notes || row['notes'] || row['note'] || row['comments'] || '',
                                date: row['date'] || row['test_date'] || row['test date'] || new Date().toISOString().split('T')[0],
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                                acknowledged: false,
                                importedAt: new Date().toISOString(),
                                importedFrom: file.name
                            };
                            
                            // Add optional doctor field if provided
                            if (doctor) {
                                labResult.doctor = doctor;
                            }
                            
                            if (typeof labResultsRef !== 'undefined' && labResultsRef) {
                                await labResultsRef.push(labResult);
                            }
                        }
                    }
                    imported++;
                }
            } else {
                // For images/PDFs, store in importedFiles array format
                let fileData = null;
                
                // If it's an image, convert to base64 (with compression for large images)
                if (file.type.startsWith('image/')) {
                    try {
                        // Check file size - if over 500KB, compress it
                        if (file.size > 500 * 1024) {
                            console.log(`📦 Compressing large image: ${file.name} (${formatFileSize(file.size)})`);
                            fileData = await compressImage(file, 800, 0.7);
                        } else {
                            fileData = await readFileAsBase64(file);
                        }
                        console.log(`✅ Image processed: ${file.name}`);
                    } catch (err) {
                        console.warn('Could not read image as base64:', err);
                        // Continue without file data
                    }
                } else {
                    // For PDFs and other files
                    try {
                        fileData = await readFileAsBase64(file);
                    } catch (err) {
                        console.warn('Could not read file as base64:', err);
                    }
                }
                
                // Create file object
                const fileObject = {
                    fileName: file.name,
                    fileType: file.type || item.type.label,
                    fileData: fileData,
                    fileSize: file.size
                };
                
                // Store in importedFiles array (will be added to existing or create new)
                if (!window.importFilesForPatient) {
                    window.importFilesForPatient = [];
                }
                window.importFilesForPatient.push(fileObject);
                imported++;
            }
        } catch (error) {
            console.error(`Error importing ${file.name}:`, error);
            showImportError(`Failed to import ${file.name}: ${error.message || 'Unknown error'}`);
            failed++;
        }
    }
    
    // After processing all files, create or update the lab result
    if (window.importFilesForPatient && window.importFilesForPatient.length > 0) {
        try {
            // Check if there's an existing lab result for this patient/type/test
            let existingResultKey = null;
            if (typeof labResultsRef !== 'undefined' && labResultsRef) {
                const labSnapshot = await labResultsRef.orderByChild('patientId').equalTo(patientId).once('value');
                if (labSnapshot.exists()) {
                    labSnapshot.forEach((child) => {
                        const result = child.val();
                        const resultTestType = (result.test || '').trim().toLowerCase();
                        const searchTestType = (existingTestType || '').trim().toLowerCase();
                        if (result.patientType === patientType && resultTestType === searchTestType) {
                            existingResultKey = child.key;
                        }
                    });
                }
            }
            
            if (existingResultKey) {
                // Update existing result by adding files to importedFiles array
                console.log(`📝 Updating existing result: ${existingResultKey}`);
                const existingSnapshot = await labResultsRef.child(existingResultKey).once('value');
                const existingData = existingSnapshot.val();
                
                let existingFiles = [];
                if (existingData.importedFiles && Array.isArray(existingData.importedFiles)) {
                    existingFiles = existingData.importedFiles;
                } else if (existingData.importedFile) {
                    existingFiles = [existingData.importedFile];
                } else if (existingData.imageData) {
                    existingFiles = [{
                        fileName: existingData.importedFrom || 'Imported file',
                        fileType: existingData.fileType || 'image',
                        fileData: existingData.imageData,
                        fileSize: existingData.fileSize || 0
                    }];
                }
                
                // Add new files
                const allFiles = [...existingFiles, ...window.importFilesForPatient];
                
                // Prepare update data
                const updateData = {
                    importedFiles: allFiles,
                    importedFile: allFiles[0], // Backward compatibility
                    imageData: allFiles[0].fileData,
                    importedFrom: allFiles[0].fileName,
                    fileType: allFiles[0].fileType,
                    fileSize: allFiles[0].fileSize,
                    status: status,
                    updatedAt: new Date().toISOString()
                };
                
                // Only update results if notes were provided
                if (notes && notes.trim()) {
                    updateData.results = notes;
                    updateData.notes = notes;
                } else {
                    // Keep existing notes
                    if (existingData.notes) {
                        updateData.notes = existingData.notes;
                    }
                    
                    // Clear results if it's the auto-generated "Imported document:" text
                    if (existingData.results && 
                        (existingData.results.startsWith('Imported document:') || 
                         existingData.results.startsWith('Imported documents:'))) {
                        updateData.results = ''; // Clear auto-generated text
                    } else if (!existingData.results || existingData.results.trim() === '') {
                        updateData.results = '';
                    }
                    // If results has actual content (not auto-generated), keep it
                }
                
                await labResultsRef.child(existingResultKey).update(updateData);
                
                console.log(`✅ Updated result with ${allFiles.length} total files`);
            } else {
                // Create new lab result
                console.log(`📝 Creating new lab result`);
                const fileNames = window.importFilesForPatient.map(f => f.fileName).join(', ');
                
                const labResult = {
                    patientName: patientName,
                    patientId: patientId,
                    patientType: patientType,
                    test: existingTestType,
                    status: status,
                    results: notes || '',
                    notes: notes || '',
                    date: new Date().toISOString().split('T')[0],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    acknowledged: false,
                    importedAt: new Date().toISOString(),
                    importedFiles: window.importFilesForPatient,
                    // Backward compatibility - store first file in old format
                    importedFile: window.importFilesForPatient[0],
                    imageData: window.importFilesForPatient[0].fileData,
                    importedFrom: window.importFilesForPatient[0].fileName,
                    fileType: window.importFilesForPatient[0].fileType,
                    fileSize: window.importFilesForPatient[0].fileSize
                };
                
                // Add optional doctor field if provided
                if (doctor) {
                    labResult.doctor = doctor;
                }
                
                try {
                    if (typeof labResultsRef !== 'undefined' && labResultsRef) {
                        await labResultsRef.push(labResult);
                        console.log(`✅ Created new result with ${window.importFilesForPatient.length} files`);
                    } else {
                        console.error('❌ labResultsRef not available');
                        failed = window.importFilesForPatient.length;
                    }
                } catch (fbError) {
                    console.error(`❌ Firebase save error:`, fbError);
                    failed = window.importFilesForPatient.length;
                }
            }
            
            // Clear the import files array
            window.importFilesForPatient = [];
            
        } catch (error) {
            console.error(`Error saving imported files:`, error);
            failed = window.importFilesForPatient ? window.importFilesForPatient.length : 0;
            window.importFilesForPatient = [];
        }
    }
    
    // Show completion status
    if (progressBar) progressBar.style.width = '100%';
    if (progressText) {
        if (failed === 0 && imported > 0) {
            progressText.textContent = `✅ Successfully imported ${imported} file${imported !== 1 ? 's' : ''}!`;
            progressText.className = 'progress-text success';
        } else if (imported === 0) {
            progressText.textContent = `❌ Import failed. Please check the console for details.`;
            progressText.className = 'progress-text error';
        } else {
            progressText.textContent = `⚠️ Imported: ${imported}, Failed: ${failed}`;
            progressText.className = 'progress-text';
        }
    }
    
    // Show success/error message
    if (imported > 0) {
        if (window.labResultsApp && window.labResultsApp.showMessage) {
            window.labResultsApp.showMessage(`Successfully imported ${imported} file${imported !== 1 ? 's' : ''}!`, 'success');
        }
        
        // Close modal and reload after 2 seconds
        setTimeout(() => {
            closeModal('importModal');
            resetImportModal();
            window.location.reload();
        }, 2000);
    } else {
        // Don't auto-close on failure, let user see the error
        const formButtons = document.querySelector('.form-buttons');
        const dropZone = document.getElementById('dropZone');
        if (formButtons) formButtons.style.display = 'flex';
        if (dropZone) dropZone.style.display = 'block';
    }
};

// Read file as text
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Read file as base64
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file as base64'));
        reader.readAsDataURL(file);
    });
}

// Compress image to reduce size for Firebase storage
function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Calculate new dimensions
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to base64 with compression
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                console.log(`📦 Compressed: ${formatFileSize(file.size)} → ~${formatFileSize(compressedDataUrl.length * 0.75)}`);
                resolve(compressedDataUrl);
            };
            img.onerror = () => reject(new Error('Failed to load image for compression'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Failed to read file for compression'));
        reader.readAsDataURL(file);
    });
}

// Format file size for display (global function for details modal)
window.formatFileSizeDisplay = function(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Initialize drag and drop
function initializeDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    
    if (!dropZone || !fileInput) return;
    
    // Handle drag events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragging');
    });
    
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragging');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragging');
        processSelectedFiles(e.dataTransfer.files);
    });
    
    // Handle file input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files) {
            processSelectedFiles(e.target.files);
            e.target.value = '';
        }
    });
}

// Reset import modal to initial state
function resetImportModal() {
    // Clear files
    clearAllFiles();
    
    // Reset selected patient
    selectedImportPatient = null;
    
    // Reset form fields
    const patientId = document.getElementById('importPatientId');
    const status = document.getElementById('importStatus');
    const testType = document.getElementById('importTestType');
    const doctor = document.getElementById('importDoctor');
    const notes = document.getElementById('importNotes');
    const suggestions = document.getElementById('patientSuggestions');
    
    if (patientId) patientId.value = '';
    if (status) status.value = '';
    if (testType) testType.value = '';
    if (doctor) doctor.value = '';
    if (notes) notes.value = '';
    if (suggestions) suggestions.style.display = 'none';
    
    // Reset UI elements
    const progressSection = document.getElementById('importProgressSection');
    const dropZone = document.getElementById('dropZone');
    const progressBar = document.getElementById('importProgressBar');
    const progressText = document.getElementById('importProgressText');
    const formButtons = document.querySelector('.form-buttons');
    const importBtnText = document.getElementById('importBtnText');
    
    if (progressSection) progressSection.style.display = 'none';
    if (dropZone) dropZone.style.display = 'block';
    if (progressBar) progressBar.style.width = '0%';
    if (formButtons) formButtons.style.display = 'flex';
    if (importBtnText) importBtnText.textContent = 'Import Results';
    if (progressText) {
        progressText.textContent = 'Processing...';
        progressText.className = 'progress-text';
    }
    
    // Clear error container
    const errorContainer = document.getElementById('importErrorContainer');
    if (errorContainer) errorContainer.innerHTML = '';
}

// Open import modal (updated)
window.openImportModal = function() {
    console.log('🔵 openImportModal() called');
    
    const modal = document.getElementById('importModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
        
        // Initialize drag and drop
        setTimeout(initializeDragAndDrop, 100);
        
        // Initialize patient search for import modal
        setTimeout(initializeImportPatientSearch, 100);
        
        // Reset modal to initial state
        resetImportModal();
    } else {
        console.error('❌ Import modal not found');
    }
};

// ========================================================================
// IMPORT MODAL PATIENT SEARCH
// ========================================================================

let importPatientsList = [];
let selectedImportPatient = null;

// Initialize patient search for import modal
function initializeImportPatientSearch() {
    const patientInput = document.getElementById('importPatientId');
    const suggestionsContainer = document.getElementById('patientSuggestions');
    
    if (!patientInput || !suggestionsContainer) {
        console.warn('Import patient search elements not found');
        return;
    }
    
    // Load patients from database
    loadPatientsForImport();
    
    // Remove existing listeners by cloning
    const newInput = patientInput.cloneNode(true);
    patientInput.parentNode.replaceChild(newInput, patientInput);
    
    // Add event listeners
    newInput.addEventListener('input', handleImportPatientSearch);
    newInput.addEventListener('focus', handleImportPatientFocus);
    newInput.addEventListener('blur', handleImportPatientBlur);
    newInput.addEventListener('keydown', handleImportPatientKeydown);
    
    console.log('✅ Import patient search initialized');
}

// Load patients from Firebase - EXCLUDE patients who already have files uploaded
async function loadPatientsForImport() {
    try {
        importPatientsList = [];
        const uniquePatients = new Map(); // Use Map to store unique patients by ID + Type
        const patientsWithFiles = new Set(); // Track patients who already have files
        
        // First, identify patients who already have files
        if (typeof labResultsRef !== 'undefined' && labResultsRef) {
            try {
                const labSnapshot = await labResultsRef.once('value');
                if (labSnapshot.exists()) {
                    labSnapshot.forEach((child) => {
                        const result = child.val();
                        const patientId = result.patientId || '';
                        const patientType = result.patientType || 'Prenatal';
                        
                        // Check if this result has files
                        const hasFiles = (result.importedFiles && Array.isArray(result.importedFiles) && result.importedFiles.length > 0) ||
                                        result.importedFile ||
                                        result.imageData;
                        
                        if (patientId && hasFiles) {
                            // Mark this patient+type combination as having files
                            const uniqueKey = `${patientId}-${patientType}`;
                            patientsWithFiles.add(uniqueKey);
                        }
                    });
                }
                console.log(`📁 Found ${patientsWithFiles.size} patient(s) with uploaded files (will be excluded)`);
            } catch (err) {
                console.warn('Could not check for patients with files:', err);
            }
        }
        
        // Now load patients WITHOUT files from lab results
        if (typeof labResultsRef !== 'undefined' && labResultsRef) {
            try {
                const labSnapshot = await labResultsRef.once('value');
                if (labSnapshot.exists()) {
                    labSnapshot.forEach((child) => {
                        const result = child.val();
                        const patientId = result.patientId || '';
                        const patientName = result.patientName || 'Unknown';
                        const patientType = result.patientType || 'Prenatal';
                        
                        if (patientId) {
                            const uniqueKey = `${patientId}-${patientType}`;
                            
                            // EXCLUDE if patient already has files
                            if (!patientsWithFiles.has(uniqueKey) && !uniquePatients.has(uniqueKey)) {
                                uniquePatients.set(uniqueKey, {
                                    patientId: patientId,
                                    name: patientName,
                                    type: patientType
                                });
                            }
                        }
                    });
                }
                console.log(`✅ Found ${uniquePatients.size} patient(s) WITHOUT files (available for import)`);
            } catch (err) {
                console.warn('Could not load from lab results:', err);
            }
        }
        
        // NOTE: We do NOT load from patients table
        // Only show patients who already have lab results (but no files yet)
        // This ensures Import is only for adding files to existing lab results
        console.log('ℹ️ Only showing patients with existing lab results (without files)');
        
        // Convert map to array
        importPatientsList = Array.from(uniquePatients.values());
        
        // Sort by patient ID then by type
        importPatientsList.sort((a, b) => {
            const idCompare = a.patientId.localeCompare(b.patientId);
            if (idCompare !== 0) return idCompare;
            return a.type.localeCompare(b.type);
        });
        
        console.log(`✅ Total ${importPatientsList.length} unique patient entries available for import search`);
        console.log('📋 Patients:', importPatientsList.map(p => `${p.patientId} (${p.type}): ${p.name}`).join(', '));
    } catch (error) {
        console.error('Error loading patients for import:', error);
    }
}

// Handle patient search input
function handleImportPatientSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    const suggestionsContainer = document.getElementById('patientSuggestions');
    
    if (!suggestionsContainer) return;
    
    if (searchTerm.length === 0) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    
    // Filter patients
    const matches = importPatientsList.filter(patient => 
        patient.patientId.toLowerCase().includes(searchTerm) ||
        patient.name.toLowerCase().includes(searchTerm)
    ).slice(0, 10); // Limit to 10 results
    
    if (matches.length === 0) {
        suggestionsContainer.innerHTML = `
            <div class="search-dropdown-item no-results" style="color: #999; text-align: center; padding: 15px;">
                <i class="fas fa-search" style="margin-right: 8px;"></i>
                No patients found
            </div>
        `;
        suggestionsContainer.style.display = 'block';
        return;
    }
    
    // Build suggestions HTML
    suggestionsContainer.innerHTML = matches.map(patient => `
        <div class="search-dropdown-item" 
             data-patient-id="${patient.patientId}" 
             data-patient-name="${patient.name}"
             data-patient-type="${patient.type}">
            <div class="patient-id-highlight">${patient.patientId}</div>
            <div class="patient-name-text">
                ${patient.name}
                <span class="patient-type-badge patient-type-${patient.type.toLowerCase()}">${patient.type}</span>
            </div>
        </div>
    `).join('');
    
    // Add click handlers to suggestions
    suggestionsContainer.querySelectorAll('.search-dropdown-item:not(.no-results)').forEach(item => {
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectImportPatient(item);
        });
    });
    
    suggestionsContainer.style.display = 'block';
}

// Handle focus on patient input
function handleImportPatientFocus(e) {
    const searchTerm = e.target.value.trim();
    if (searchTerm.length > 0) {
        handleImportPatientSearch(e);
    }
}

// Handle blur on patient input
function handleImportPatientBlur(e) {
    // Delay hiding to allow click on suggestion
    setTimeout(() => {
        const suggestionsContainer = document.getElementById('patientSuggestions');
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }
    }, 200);
}

// Handle keyboard navigation
function handleImportPatientKeydown(e) {
    const suggestionsContainer = document.getElementById('patientSuggestions');
    if (!suggestionsContainer || suggestionsContainer.style.display === 'none') return;
    
    const items = suggestionsContainer.querySelectorAll('.search-dropdown-item:not(.no-results)');
    if (items.length === 0) return;
    
    const currentSelected = suggestionsContainer.querySelector('.search-dropdown-item.selected');
    let currentIndex = -1;
    
    items.forEach((item, index) => {
        if (item === currentSelected) currentIndex = index;
    });
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items.forEach(item => item.classList.remove('selected'));
        items[nextIndex].classList.add('selected');
        items[nextIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items.forEach(item => item.classList.remove('selected'));
        items[prevIndex].classList.add('selected');
        items[prevIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentSelected) {
            selectImportPatient(currentSelected);
        } else if (items.length > 0) {
            selectImportPatient(items[0]);
        }
    } else if (e.key === 'Escape') {
        suggestionsContainer.style.display = 'none';
    }
}

// Select a patient from suggestions
function selectImportPatient(item) {
    const patientId = item.dataset.patientId;
    const patientName = item.dataset.patientName;
    const patientType = item.dataset.patientType;
    
    const patientInput = document.getElementById('importPatientId');
    const suggestionsContainer = document.getElementById('patientSuggestions');
    
    if (patientInput) {
        patientInput.value = patientId;
    }
    
    if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
    }
    
    // Store selected patient info
    selectedImportPatient = {
        patientId: patientId,
        name: patientName,
        type: patientType
    };
    
    console.log('✅ Selected patient for import:', selectedImportPatient);
}

// Legacy function compatibility
window.clearFileSelection = function() {
    clearAllFiles();
};

window.handleFormatChange = function(format) {
    console.log('📋 Format changed to:', format);
    // No longer needed with new importer, but kept for compatibility
};

window.processImage = function() {
    console.log('🖼️ Process image called');
    if (window.labResultsApp && window.labResultsApp.showMessage) {
        window.labResultsApp.showMessage('Image processing feature coming soon!', 'info');
    } else {
        alert('Image processing feature coming soon!');
    }
};

console.log('✅ Modern file importer system loaded');
// ========================================
// DUPLICATE CLEANUP UTILITY
// ========================================

/**
 * Manually remove duplicate lab results for the same patient, type, and test
 * Keeps only the most recent entry
 */
window.removeDuplicateLabResults = async function() {
    if (!window.labResultsApp || !labResultsRef) {
        console.error('Lab Results App or Firebase not initialized');
        return;
    }
    
    try {
        console.log('🔍 Scanning for duplicate lab results...');
        
        const snapshot = await labResultsRef.once('value');
        if (!snapshot.exists()) {
            console.log('No lab results found');
            return;
        }
        
        // Group results by patientId + patientType + test
        const resultGroups = new Map();
        
        snapshot.forEach((child) => {
            const result = child.val();
            const key = child.key;
            
            // Create unique key for grouping
            const patientId = (result.patientId || '').trim();
            const patientType = (result.patientType || '').trim();
            const testType = (result.test || '').trim().toLowerCase();
            
            if (!patientId || !testType) return; // Skip invalid entries
            
            const groupKey = `${patientId}|${patientType}|${testType}`;
            
            if (!resultGroups.has(groupKey)) {
                resultGroups.set(groupKey, []);
            }
            
            resultGroups.get(groupKey).push({
                key: key,
                data: result,
                timestamp: result.createdAt || result.date || '0'
            });
        });
        
        // Find and remove duplicates (keep most recent)
        let duplicatesFound = 0;
        let duplicatesRemoved = 0;
        
        for (const [groupKey, entries] of resultGroups.entries()) {
            if (entries.length > 1) {
                duplicatesFound++;
                console.log(`📋 Found ${entries.length} duplicates for: ${groupKey}`);
                
                // Sort by timestamp (most recent first)
                entries.sort((a, b) => {
                    if (a.timestamp > b.timestamp) return -1;
                    if (a.timestamp < b.timestamp) return 1;
                    return 0;
                });
                
                // Keep the first (most recent), delete the rest
                for (let i = 1; i < entries.length; i++) {
                    try {
                        await labResultsRef.child(entries[i].key).remove();
                        console.log(`🗑️ Removed duplicate: ${entries[i].key}`);
                        duplicatesRemoved++;
                    } catch (error) {
                        console.error(`Error removing duplicate ${entries[i].key}:`, error);
                    }
                }
            }
        }
        
        console.log(`✅ Cleanup complete: Found ${duplicatesFound} groups with duplicates, removed ${duplicatesRemoved} duplicate entries`);
        
        if (duplicatesRemoved > 0 && window.labResultsApp) {
            // Reload data
            await window.labResultsApp.loadLabResults();
            
            if (window.labResultsApp.showMessage) {
                window.labResultsApp.showMessage(
                    `Removed ${duplicatesRemoved} duplicate lab result(s)`,
                    'success'
                );
            }
        } else {
            console.log('No duplicates found');
            if (window.labResultsApp && window.labResultsApp.showMessage) {
                window.labResultsApp.showMessage('No duplicate lab results found', 'info');
            }
        }
        
    } catch (error) {
        console.error('Error removing duplicates:', error);
        if (window.labResultsApp && window.labResultsApp.showMessage) {
            window.labResultsApp.showMessage('Error removing duplicates: ' + error.message, 'error');
        }
    }
};

console.log('✅ Duplicate cleanup utility loaded. Run removeDuplicateLabResults() in console to clean up existing duplicates.');

// ========================================
// EDIT MODE FILE DISPLAY AND UPLOAD FUNCTIONS
// ========================================

/**
 * Display imported file in edit mode
 */
function getImportedFileDisplayForEdit(data) {
    let html = '';
    
    // Check for imageData (base64 image)
    if (data.imageData) {
        const fileType = data.imageData.startsWith('data:image/png') ? 'PNG' : 
                        data.imageData.startsWith('data:image/jpeg') || data.imageData.startsWith('data:image/jpg') ? 'JPEG' :
                        data.imageData.startsWith('data:image/tiff') ? 'TIFF' :
                        data.imageData.startsWith('data:application/pdf') ? 'PDF' : 'Image';
        
        html += `
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <i class="fas fa-image" style="color: #28a745; font-size: 24px;"></i>
                        <div>
                            <div style="font-weight: 600; color: #333;">${data.importedFrom || 'Imported Image'}</div>
                            <div style="font-size: 12px; color: #888;">Type: ${fileType}</div>
                        </div>
                    </div>
                </div>
                <button type="button" class="btn view" class="file-view-btn" data-file-data="${data.imageData}" onclick="viewFileWithData(this)" style="white-space: nowrap;">
                    <i class="fas fa-eye"></i> Preview
                </button>
            </div>
            ${fileType !== 'PDF' ? `
            <div style="margin-top: 15px;">
                <img src="${data.imageData}" alt="Lab Result" style="max-width: 100%; max-height: 200px; border-radius: 8px; border: 2px solid #dee2e6; cursor: pointer;" class="clickable-image" data-img-src="${data.imageData}" onclick="viewImageFromElement(this)">
                <p style="font-size: 11px; color: #999; margin-top: 5px; text-align: center;">Click to view full size</p>
            </div>
            ` : ''}
        `;
    }
    // Check for importedFile structure
    else if (data.importedFile) {
        const file = data.importedFile;
        const fileName = file.fileName || 'Unknown File';
        const fileType = file.fileType || 'Unknown';
        const fileSize = file.fileSize ? formatFileSizeDisplay(file.fileSize) : 'Unknown size';
        
        const icon = fileType.includes('csv') ? 'fa-file-csv' :
                    fileType.includes('pdf') ? 'fa-file-pdf' :
                    fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg') ? 'fa-file-image' :
                    'fa-file';
        
        html += `
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas ${icon}" style="color: #28a745; font-size: 24px;"></i>
                        <div>
                            <div style="font-weight: 600; color: #333;">${fileName}</div>
                            <div style="font-size: 12px; color: #888;">${fileType} • ${fileSize}</div>
                        </div>
                    </div>
                </div>
                ${file.fileData ? `
                <button type="button" class="btn view" onclick="downloadFileFromData('${file.fileData}', '${fileName}', '${fileType}')" style="white-space: nowrap;">
                    <i class="fas fa-download"></i> Download
                </button>
                ` : ''}
            </div>
        `;
        
        // Show preview for images
        if (file.fileData && (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg'))) {
            html += `
                <div style="margin-top: 15px;">
                    <img src="${file.fileData}" alt="Lab Result" style="max-width: 100%; max-height: 200px; border-radius: 8px; border: 2px solid #dee2e6; cursor: pointer;" class="clickable-image" data-img-src="${file.fileData}" onclick="viewImageFromElement(this)">
                    <p style="font-size: 11px; color: #999; margin-top: 5px; text-align: center;">Click to view full size</p>
                </div>
            `;
        }
    }
    // Check for old importedFrom field
    else if (data.importedFrom) {
        html += `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-file-import" style="color: #28a745; font-size: 24px;"></i>
                <div>
                    <div style="font-weight: 600; color: #333;">${data.importedFrom}</div>
                    <div style="font-size: 12px; color: #888;">
                        ${data.fileType || 'Imported File'}
                        ${data.fileSize ? ` • ${formatFileSizeDisplay(data.fileSize)}` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    else {
        html = '<p style="color: #999; font-style: italic;"><i class="fas fa-info-circle"></i> No file attached</p>';
    }
    
    return html;
}

/**
 * Show file import options
 */
window.showImportFileSection = function() {
    const uploadSection = document.getElementById('editFileUploadSection');
    
    if (uploadSection) {
        uploadSection.style.display = 'block';
        
        // Setup file input handler
        const fileInput = document.getElementById('editFileInput');
        if (fileInput) {
            // Remove old listeners
            const newFileInput = fileInput.cloneNode(true);
            fileInput.parentNode.replaceChild(newFileInput, fileInput);
            
            // Add new listener
            newFileInput.addEventListener('change', handleEditFileSelection);
        }
        
        // Scroll to the upload section
        uploadSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
};

/**
 * Cancel file import
 */
window.cancelFileImport = function() {
    const uploadSection = document.getElementById('editFileUploadSection');
    const fileInput = document.getElementById('editFileInput');
    const preview = document.getElementById('editFilePreview');
    
    if (uploadSection) {
        uploadSection.style.display = 'none';
    }
    
    if (fileInput) {
        fileInput.value = '';
    }
    
    if (preview) {
        preview.innerHTML = '';
    }
    
    // Clear new files
    editModeNewFiles = [];
};

/**
 * Handle file selection in edit mode (supports multiple files)
 */
let editModeNewFiles = [];

function handleEditFileSelection(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const preview = document.getElementById('editFilePreview');
    if (!preview) return;
    
    // Clear previous selections
    editModeNewFiles = [];
    
    // Process each file
    let processedCount = 0;
    let previewHTML = '<div style="display: flex; flex-direction: column; gap: 10px;">';
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileType = file.type;
        const fileName = file.name;
        const fileSize = formatFileSizeDisplay(file.size);
        
        // Read file as base64
        const reader = new FileReader();
        reader.onload = function(event) {
            const fileData = event.target.result;
            
            editModeNewFiles.push({
                fileName: fileName,
                fileType: fileType,
                fileData: fileData,
                fileSize: file.size
            });
            
            processedCount++;
            
            // Update preview when all files are loaded
            if (processedCount === files.length) {
                displayEditFilesPreviews();
            }
        };
        
        reader.readAsDataURL(file);
    }
}

/**
 * Display previews for all selected files in edit mode
 */
function displayEditFilesPreviews() {
    const preview = document.getElementById('editFilePreview');
    if (!preview || editModeNewFiles.length === 0) return;
    
    let previewHTML = `
        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; border: 2px solid #4caf50; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <i class="fas fa-check-circle" style="color: #4caf50; font-size: 20px;"></i>
                <div>
                    <div style="font-weight: 600; color: #2e7d32;">
                        ${editModeNewFiles.length} file${editModeNewFiles.length > 1 ? 's' : ''} selected for import
                    </div>
                    <div style="font-size: 12px; color: #555;">These files will be added to the lab result</div>
                </div>
            </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
    `;
    
    editModeNewFiles.forEach((file, index) => {
        const icon = file.fileType.includes('csv') ? 'fa-file-csv' :
                    file.fileType.includes('pdf') ? 'fa-file-pdf' :
                    file.fileType.startsWith('image/') ? 'fa-file-image' :
                    'fa-file';
        
        previewHTML += `
            <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #dee2e6; display: flex; align-items: center; gap: 12px;">
                <i class="fas ${icon}" style="color: #28a745; font-size: 24px;"></i>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #333;">${file.fileName}</div>
                    <div style="font-size: 12px; color: #888;">${file.fileType} • ${formatFileSizeDisplay(file.fileSize)}</div>
                </div>
                <button type="button" onclick="removeEditFile(${index})" style="background: #dc3545; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Show image preview if it's an image
        if (file.fileType.startsWith('image/')) {
            previewHTML += `
                <div style="margin-left: 40px; margin-top: -5px; margin-bottom: 5px;">
                    <img src="${file.fileData}" alt="Preview" style="max-width: 100%; max-height: 150px; border-radius: 8px; border: 2px solid #dee2e6;">
                </div>
            `;
        }
    });
    
    previewHTML += '</div>';
    preview.innerHTML = previewHTML;
}

/**
 * Remove a file from the import list
 */
window.removeEditFile = function(index) {
    editModeNewFiles.splice(index, 1);
    
    if (editModeNewFiles.length === 0) {
        const preview = document.getElementById('editFilePreview');
        if (preview) preview.innerHTML = '';
        const fileInput = document.getElementById('editFileInput');
        if (fileInput) fileInput.value = '';
    } else {
        displayEditFilesPreviews();
    }
};

/**
 * Download file from base64 data
 */
window.downloadFileFromData = function(fileData, fileName, fileType) {
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Format file size for display
 */
function formatFileSizeDisplay(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

console.log('✅ Edit mode file display and upload functions loaded');

// ========================================
// MULTIPLE FILES DISPLAY FUNCTION
// ========================================

/**
 * Display all imported files in edit mode
 */
function getImportedFilesDisplayForEdit(data) {
    console.log('🔍 getImportedFilesDisplayForEdit called with data:', data);
    let html = '';
    let filesArray = [];
    
    // Check for multiple files stored in array
    if (data.importedFiles && Array.isArray(data.importedFiles)) {
        console.log('✅ Found importedFiles array with', data.importedFiles.length, 'files');
        filesArray = data.importedFiles;
    } 
    // Check for single file in importedFile
    else if (data.importedFile) {
        console.log('✅ Found single importedFile');
        filesArray = [data.importedFile];
    }
    // Check for imageData (old format)
    else if (data.imageData) {
        filesArray = [{
            fileName: data.importedFrom || 'Imported Image',
            fileType: data.imageData.startsWith('data:image/png') ? 'image/png' : 
                     data.imageData.startsWith('data:image/jpeg') ? 'image/jpeg' :
                     data.imageData.startsWith('data:application/pdf') ? 'application/pdf' : 'image',
            fileData: data.imageData,
            fileSize: data.fileSize || 0
        }];
    }
    
    if (filesArray.length === 0) {
        console.log('⚠️ No files found in filesArray');
        return '<p style="color: #999; font-style: italic; padding: 15px; background: #f8f9fa; border-radius: 8px;"><i class="fas fa-info-circle"></i> No files imported yet. Click "Import Additional File" to add files.</p>';
    }
    
    console.log('📁 Displaying', filesArray.length, 'file(s)');
    
    html += '<div style="display: flex; flex-direction: column; gap: 12px;">';
    
    filesArray.forEach((file, index) => {
        const fileName = file.fileName || 'Unknown File';
        const fileType = file.fileType || 'Unknown';
        const fileSize = file.fileSize ? formatFileSizeDisplay(file.fileSize) : 'Unknown size';
        
        const icon = fileType.includes('csv') ? 'fa-file-csv' :
                    fileType.includes('pdf') ? 'fa-file-pdf' :
                    fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg') ? 'fa-file-image' :
                    'fa-file';
        
        const iconColor = fileType.includes('csv') ? '#17a2b8' :
                         fileType.includes('pdf') ? '#dc3545' :
                         fileType.includes('image') ? '#28a745' : '#6c757d';
        
        html += `
            <div style="background: white; padding: 15px; border-radius: 8px; border: 2px solid #e0e0e0;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <i class="fas ${icon}" style="color: ${iconColor}; font-size: 28px;"></i>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${fileName}</div>
                        <div style="font-size: 12px; color: #888;">${fileType} • ${fileSize}</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        ${file.fileData ? `
                            <button type="button" class="btn view file-view-btn" data-file-data="${file.fileData}" data-file-name="${fileName}" onclick="viewFileWithData(this)" style="padding: 8px 12px; font-size: 13px;">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button type="button" class="btn edit" onclick="downloadFileFromData('${file.fileData}', '${fileName}', '${fileType}')" style="padding: 8px 12px; font-size: 13px;">
                                <i class="fas fa-download"></i>
                            </button>
                        ` : ''}
                        <button type="button" class="btn delete" onclick="removeImportedFile(${index})" style="padding: 8px 12px; font-size: 13px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
        `;
        
        // Show image preview for image files
        if (file.fileData && (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg'))) {
            html += `
                <div style="margin-top: 15px; text-align: center;">
                    <img src="${file.fileData}" alt="${fileName}" style="max-width: 100%; max-height: 200px; border-radius: 8px; border: 2px solid #dee2e6; cursor: pointer;" class="clickable-image" data-img-src="${file.fileData}" onclick="viewImageFromElement(this)">
                    <p style="font-size: 11px; color: #999; margin-top: 5px;">Click to view full size</p>
                </div>
            `;
        }
        
        html += `</div>`;
    });
    
    html += '</div>';
    
    return html;
}

/**
 * Remove an imported file from the current lab result
 */
window.removeImportedFile = function(index) {
    if (!confirm('Are you sure you want to remove this file?')) {
        return;
    }
    
    // Get current data from the modal
    const modal = document.getElementById('resultModal');
    if (!modal) return;
    
    // Mark file for deletion
    if (!window.editModeDeletedFiles) {
        window.editModeDeletedFiles = [];
    }
    window.editModeDeletedFiles.push(index);
    
    // Refresh the display
    const currentFilesDisplay = document.getElementById('currentFilesDisplay');
    if (currentFilesDisplay) {
        // Get the data from window context (stored when modal opened)
        if (window.currentEditData) {
            let filesArray = window.currentEditData.importedFiles || 
                           (window.currentEditData.importedFile ? [window.currentEditData.importedFile] : []);
            
            // Filter out deleted files
            filesArray = filesArray.filter((_, i) => !window.editModeDeletedFiles.includes(i));
            
            // Update display
            const tempData = { ...window.currentEditData, importedFiles: filesArray };
            currentFilesDisplay.innerHTML = getImportedFilesDisplayForEdit(tempData);
        }
    }
};

console.log('✅ Multiple files display functions loaded');

// ========================================
// VIEW MODE MULTIPLE FILES FUNCTIONS
// ========================================

/**
 * Get file count for display
 */
function getFileCount(data) {
    if (data.importedFiles && Array.isArray(data.importedFiles)) {
        return data.importedFiles.length;
    } else if (data.importedFile || data.imageData) {
        return 1;
    }
    return 0;
}

/**
 * Display all imported files in view mode
 */
function getImportedFilesDisplayForView(data) {
    console.log('👁️ getImportedFilesDisplayForView called with data:', data);
    let html = '';
    let filesArray = [];
    
    // Check for multiple files stored in array
    if (data.importedFiles && Array.isArray(data.importedFiles)) {
        console.log('✅ Found importedFiles array with', data.importedFiles.length, 'files for view');
        filesArray = data.importedFiles;
    } 
    // Check for single file in importedFile
    else if (data.importedFile) {
        console.log('✅ Found single importedFile');
        filesArray = [data.importedFile];
    }
    // Check for imageData (old format)
    else if (data.imageData) {
        filesArray = [{
            fileName: data.importedFrom || 'Imported Image',
            fileType: data.imageData.startsWith('data:image/png') ? 'image/png' : 
                     data.imageData.startsWith('data:image/jpeg') ? 'image/jpeg' :
                     data.imageData.startsWith('data:application/pdf') ? 'application/pdf' : 'image',
            fileData: data.imageData,
            fileSize: data.fileSize || 0
        }];
    }
    
    if (filesArray.length === 0) {
        return '<p style="color: #999; font-style: italic;"><i class="fas fa-info-circle"></i> No files attached</p>';
    }
    
    html += '<div style="display: flex; flex-direction: column; gap: 15px;">';
    
    filesArray.forEach((file, index) => {
        const fileName = file.fileName || 'Unknown File';
        const fileType = file.fileType || 'Unknown';
        const fileSize = file.fileSize ? formatFileSizeDisplay(file.fileSize) : 'Unknown size';
        
        const icon = fileType.includes('csv') ? 'fa-file-csv' :
                    fileType.includes('pdf') ? 'fa-file-pdf' :
                    fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg') ? 'fa-file-image' :
                    'fa-file';
        
        const iconColor = fileType.includes('csv') ? '#17a2b8' :
                         fileType.includes('pdf') ? '#dc3545' :
                         fileType.includes('image') ? '#28a745' : '#6c757d';
        
        html += `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                    <i class="fas ${icon}" style="color: ${iconColor}; font-size: 32px;"></i>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #333; font-size: 15px; margin-bottom: 4px;">${fileName}</div>
                        <div style="font-size: 13px; color: #666;">
                            <i class="fas fa-tag" style="margin-right: 4px;"></i> ${fileType}
                            <span style="margin: 0 8px;">•</span>
                            <i class="fas fa-hdd" style="margin-right: 4px;"></i> ${fileSize}
                        </div>
                    </div>
                    ${file.fileData ? `
                        <div style="display: flex; gap: 8px;">
                            <button type="button" class="file-view-btn" data-file-data="${file.fileData}" data-file-name="${fileName}" onclick="viewFileWithData(this)" style="background: linear-gradient(135deg, #28a745, #20c997); color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                <i class="fas fa-external-link-alt"></i> Open
                            </button>
                            <button type="button" onclick="downloadFileFromData('${file.fileData}', '${fileName}', '${fileType}')" style="background: linear-gradient(135deg, #007bff, #0056b3); color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                <i class="fas fa-download"></i> Download
                            </button>
                        </div>
                    ` : ''}
                </div>
        `;
        
        // Show image preview for image files
        if (file.fileData && (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg'))) {
            html += `
                <div style="margin-top: 15px; text-align: center; background: white; padding: 10px; border-radius: 8px;">
                    <img src="${file.fileData}" alt="${fileName}" style="max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); cursor: pointer;" class="clickable-image" data-img-src="${file.fileData}" onclick="viewImageFromElement(this)">
                    <p style="font-size: 12px; color: #888; margin-top: 8px;"><i class="fas fa-info-circle"></i> Click image to view full size</p>
                </div>
            `;
        }
        
        html += `</div>`;
    });
    
    html += '</div>';
    
    return html;
}

console.log('✅ View mode multiple files display functions loaded');

// ========================================
// FILE VIEWING FUNCTIONS
// ========================================

/**
 * View file in new tab using Blob URL (fixes large base64 issue)
 */
window.viewFileWithData = function(buttonElement) {
    try {
        const fileData = buttonElement.dataset.fileData;
        const fileName = buttonElement.dataset.fileName;
        
        if (!fileData) {
            console.error('No file data found');
            return;
        }
        
        // Convert base64 to blob
        const base64Data = fileData.split(',')[1];
        const mimeType = fileData.match(/data:([^;]+);/)[1];
        
        // Decode base64
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        
        // Create blob
        const blob = new Blob([byteArray], { type: mimeType });
        
        // Create object URL
        const blobUrl = URL.createObjectURL(blob);
        
        // Open in new window
        const newWindow = window.open(blobUrl, '_blank');
        
        // Clean up blob URL after window loads
        if (newWindow) {
            newWindow.onload = function() {
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            };
        }
        
        console.log('✅ Opened file in new tab:', fileName);
    } catch (error) {
        console.error('❌ Error opening file:', error);
        alert('Error opening file. The file may be too large or corrupted.');
    }
};

/**
 * View image from element
 */
window.viewImageFromElement = function(imgElement) {
    const fileData = imgElement.dataset.imgSrc;
    if (fileData) {
        viewFileWithData({ dataset: { fileData: fileData, fileName: 'image' } });
    }
};

/**
 * View file inline (for images in modals)
 */
window.viewFileInline = function(fileData) {
    try {
        // Same blob conversion
        const base64Data = fileData.split(',')[1];
        const mimeType = fileData.match(/data:([^;]+);/)[1];
        
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        
        window.open(blobUrl, '_blank');
        
    } catch (error) {
        console.error('❌ Error viewing file:', error);
        alert('Error viewing file.');
    }
};

console.log('✅ File viewing functions loaded');

// ========================================
// AUTO-HIDE TOPBAR FUNCTIONALITY
// ========================================

(function initAutoHideTopbar() {
    const searchHeader = document.querySelector('.search-header');
    if (!searchHeader) {
        console.warn('Search header not found for auto-hide');
        return;
    }
    
    let lastScrollTop = 0;
    let scrollThreshold = 100; // Start hiding after scrolling 100px
    let isScrolling;
    let isMouseNearTop = false;
    
    // Add initial visible class
    searchHeader.classList.add('visible');
    
    function handleScroll() {
        const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
        
        // Clear timeout for scroll end detection
        window.clearTimeout(isScrolling);
        
        // At the top of the page - always show
        if (currentScroll <= scrollThreshold) {
            searchHeader.classList.remove('hidden');
            searchHeader.classList.add('visible');
            lastScrollTop = currentScroll;
            return;
        }
        
        // Don't hide if mouse is near top
        if (isMouseNearTop) {
            searchHeader.classList.remove('hidden');
            searchHeader.classList.add('visible');
            lastScrollTop = currentScroll;
            return;
        }
        
        // Apply auto-hide logic when scrolled past threshold
        if (currentScroll > lastScrollTop && currentScroll > scrollThreshold) {
            // Scrolling DOWN - hide topbar
            searchHeader.classList.add('hidden');
            searchHeader.classList.remove('visible');
        } else if (currentScroll < lastScrollTop) {
            // Scrolling UP - show topbar
            searchHeader.classList.remove('hidden');
            searchHeader.classList.add('visible');
        }
        
        lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
        
        // REMOVED: Auto-show timeout after scrolling stops
        // This was causing the topbar to show while still scrolled down
    }
    
    // Throttle scroll events for better performance
    let ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(function() {
                handleScroll();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
    
    // Show topbar when mouse is near the top
    document.addEventListener('mousemove', function(e) {
        if (e.clientY < 50) { // Mouse within 50px of top
            isMouseNearTop = true;
            searchHeader.classList.remove('hidden');
            searchHeader.classList.add('visible');
        } else {
            isMouseNearTop = false;
            // Trigger scroll handler to reapply hide state if needed
            if (window.pageYOffset > scrollThreshold) {
                handleScroll();
            }
        }
    });
    
    // REMOVED: Click anywhere to show
    // This was causing unwanted reveals
    
    console.log('✅ Auto-hide topbar initialized');
})();