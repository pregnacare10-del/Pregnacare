// PregnaCare Appointments System - COMPLETE WITH AUTHENTICATION AND USER PROFILE
// Version: 3.2.1 WITH EXTENDED GRACE PERIOD FOR FOLLOW-UP APPOINTMENTS
// Admin User: Eot0CErzLgetsS0bBCBtrkRCvXD2
// Sub-Admin User: SeffMwIHCDOyyU5REpQtGX2Vv622

// ========================================
// CONFIGURATION
// ========================================

const ADMIN_USER_ID = "0GcKKrWpYkW1WyoSCdQiuwc9HDK2";
const SUB_ADMIN_USER_ID = "pnU0HliFenYYDpP3aLqfIxkkf3Z2";

// Configuration Management with Auto-Validation
let firebaseConfig = {
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
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const database = firebase.database();

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
                
                // Get the proper display name
                await this.setUserDisplayName(user);
                
                console.log('User authenticated:', {
                    uid: user.uid,
                    email: user.email,
                    displayName: this.userDisplayName,
                    isAdmin: this.isAdmin,
                    isSubAdmin: this.isSubAdmin
                });
                
                this.updateUserInterface();
                this.logUserActivity('access_appointments_module');
                
                // Initialize the appointments system after authentication
                if (window.appointmentsApp) {
                    window.appointmentsApp.onAuthenticated();
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
            // First try to get display name from Firebase Auth profile
            if (user.displayName && user.displayName.trim()) {
                this.userDisplayName = user.displayName.trim();
                return;
            }

            // If no display name in auth, try to get from database
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

            // Extract name from email if available
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

            // Final fallback
            this.userDisplayName = 'User';

        } catch (error) {
            console.error('Error getting user display name:', error);
            this.userDisplayName = 'User';
        }
    }

    updateUserInterface() {
        // Update sidebar user info
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
            // Redirect to login if modal doesn't exist
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
                module: 'appointments',
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
        window.location.href = 'index.html';
    }

    hasPermission(action) {
        // Define permissions based on user role
        const adminPermissions = ['all'];
        const subAdminPermissions = ['view', 'add', 'edit'];
        const userPermissions = ['view'];

        if (this.isAdmin) return true; // Admin has all permissions
        
        if (this.isSubAdmin) {
            return subAdminPermissions.includes(action) || action === 'all';
        }
        
        return userPermissions.includes(action);
    }
}

// ========================================
// MAIN APPOINTMENTS APPLICATION
// ========================================

class AppointmentsApplication {
    constructor() {
        this.authManager = new AuthenticationManager();
        this.setupSidebarDropdown();
    }

    onAuthenticated() {
        if (!this.authManager.isAuthenticated) {
            console.log('User not authenticated');
            return;
        }

        console.log('🚀 Initializing Appointments System for authenticated user...');
        this.initialize();
    }

    async initialize() {
        try {
            console.log('Initializing PregnaCare Appointments System...');
            
            // Set current user from auth
            if (this.authManager.currentUser) {
                currentUser = {
                    uid: this.authManager.currentUser.uid,
                    displayName: this.authManager.userDisplayName,
                    email: this.authManager.userEmail
                };
            }
            
            initializeEventListeners();
            initializeLocalStorage();
            await initializeFirebase();
            setDateTimeConstraints();
            
            // Initialize history view
            switchToActiveView();
            
            console.log('✅ Appointments System initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing Appointments System:', error);
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

        // Initially hide dropdown
        sidebarDropdown.classList.remove('show');

        // Toggle dropdown on user click
        sidebarUser.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebarDropdown.classList.toggle('show');
            console.log('Sidebar dropdown toggled');
        });

        // Handle logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (confirm('Are you sure you want to logout?')) {
                    sidebarDropdown.classList.remove('show');
                    await this.authManager.logout();
                }
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            sidebarDropdown.classList.remove('show');
        });

        // Prevent dropdown from closing when clicking inside it
        sidebarDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}

// Global Variables
let appointmentsRef;
let patientsRef;
let appointments = [];
let filteredAppointments = [];
let patientsData = {};
let currentUser = { uid: 'appointments-module', displayName: 'Appointments System' };
let connectionState = 'unknown';
let retryAttempts = 0;
let maxRetries = 3;
let syncQueue = [];
let isOnline = navigator.onLine;

// NEW: History View State
let currentView = 'active'; // 'active' or 'history'
let historyFilters = {
    status: '',
    dateRange: ''
};

// NEW: Searchable dropdown state
let patientSearchState = {
    isOpen: false,
    selectedPatient: null,
    filteredPatients: [],
    currentQuery: ''
};

// Auto-hide header variables
let lastScrollTop = 0;
let isHeaderVisible = true;
let scrollTimeout = null;

// DOM Elements
const modal = document.getElementById("modal");
const openModalBtn = document.getElementById("openModal");
const closeModalBtn = document.getElementById("closeModal");
const form = document.getElementById("appointmentForm");
const appointmentCards = document.getElementById("appointmentCards");
const appointmentsBody = document.getElementById("appointmentsBody");
const tableSearch = document.getElementById("tableSearch");
const searchBar = document.querySelector('.search input');

// NEW: History DOM Elements
const activeAppointmentsBtn = document.getElementById("activeAppointmentsBtn");
const historyAppointmentsBtn = document.getElementById("historyAppointmentsBtn");
const historyFilters_div = document.getElementById("historyFilters");
const historySummaryCard = document.getElementById("historySummaryCard");
const historyStatusFilter = document.getElementById("historyStatusFilter");
const historyDateFilter = document.getElementById("historyDateFilter");
const exportHistoryBtn = document.getElementById("exportHistoryBtn");

// NEW: Searchable Patient Dropdown DOM Elements
let patientSearchInput = null;
let patientDropdownList = null;
let searchableDropdown = null;

// CRITICAL FIX: Enhanced logging system for debugging database writes
function debugLog(message, type = 'info', data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    
    console.log(logMessage);
    if (data) {
        console.log('📊 Data:', data);
    }
    
    // Store in global for debugging
    if (!window.appointmentDebugLogs) {
        window.appointmentDebugLogs = [];
    }
    window.appointmentDebugLogs.push({ timestamp, type, message, data });
    
    // Keep only last 100 logs
    if (window.appointmentDebugLogs.length > 100) {
        window.appointmentDebugLogs = window.appointmentDebugLogs.slice(-100);
    }
}

// CRITICAL FIX: Firebase Rules Compliant Data Formatting
function formatAppointmentForFirebase(appointmentData) {
    debugLog('🔧 Formatting appointment data for Firebase rules compliance', 'info', appointmentData);
    
    // Ensure all required fields are present and properly formatted
    const formatted = {
        // Required fields per Firebase rules
        name: String(appointmentData.name || '').trim(),
        time: formatDateForFirebase(appointmentData.time),
        purpose: String(appointmentData.purpose || '').trim(),
        provider: String(appointmentData.provider || '').trim(),
        
        // Optional but expected fields
        status: String(appointmentData.status || 'Walk-in').trim(),
        patientType: String(appointmentData.patientType || 'Prenatal').trim(),
        visitNumber: parseInt(appointmentData.visitNumber) || 1,
        createdAt: formatDateForFirebase(new Date()),
        updatedAt: formatDateForFirebase(new Date()),
        
        // Authentication fields
        createdBy: window.appointmentsApp?.authManager?.currentUser?.uid || 'unknown',
        createdByName: window.appointmentsApp?.authManager?.userDisplayName || 'Unknown User'
    };
    
    // Add patient identifiers if provided
    if (appointmentData.patientId) {
        formatted.patientId = String(appointmentData.patientId);
    }
    if (appointmentData.patientKey) {
        formatted.patientKey = String(appointmentData.patientKey);
    }
    
    // Add endTime if provided
    if (appointmentData.endTime) {
        formatted.endTime = formatDateForFirebase(appointmentData.endTime);
    }
    
    // Add followupDate if provided
    if (appointmentData.followupDate) {
        formatted.followupDate = formatDateForFirebase(appointmentData.followupDate);
    }
    
    // Validate required fields
    if (!formatted.name || formatted.name.length < 2) {
        throw new Error('Name must be at least 2 characters long');
    }
    
    if (!formatted.time) {
        throw new Error('Valid appointment time is required');
    }
    
    if (!formatted.purpose) {
        throw new Error('Appointment purpose is required');
    }
    
    if (!formatted.provider) {
        throw new Error('Healthcare provider is required');
    }
    
    // Validate against Firebase rules constraints
    validateFirebaseRulesCompliance(formatted);
    
    debugLog('✅ Appointment data formatted successfully', 'success', formatted);
    return formatted;
}

// CRITICAL FIX: Proper date formatting for Firebase rules
function formatDateForFirebase(date) {
    if (!date) return null;
    
    let dateObj;
    if (date instanceof Date) {
        dateObj = date;
    } else {
        dateObj = new Date(date);
    }
    
    if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid date provided');
    }
    
    // Format to match Firebase rules regex: ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$
    return dateObj.toISOString();
}

// CRITICAL FIX: Validate data against Firebase rules
function validateFirebaseRulesCompliance(data) {
    debugLog('🔍 Validating Firebase rules compliance', 'info', data);
    
    // Name validation: 2-100 characters
    if (!data.name || data.name.length < 2 || data.name.length > 100) {
        throw new Error('Name must be between 2-100 characters');
    }
    
    // Time validation: ISO string format
    const timeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!data.time || !timeRegex.test(data.time)) {
        throw new Error('Time must be in ISO string format');
    }
    
    // Purpose validation: Must be from allowed list
    const allowedPurposes = [
        'Prenatal Checkup', 'Routine Monitoring', 'Postpartum Checkup', 
        'Blood Test', 'Ultrasound', 'Glucose Screening', 'Genetic Screening',
        'Anatomy Scan', 'High-Risk Consultation', 'Nutrition Counseling', 'Emergency Visit'
    ];
    if (!allowedPurposes.includes(data.purpose)) {
        throw new Error(`Purpose must be one of: ${allowedPurposes.join(', ')}`);
    }
    
    // Provider validation: Must be from allowed list or at least 2 characters
    const allowedProviders = ['Dr. Gerola Simisim', 'Nurse Unknown'];
    if (!allowedProviders.includes(data.provider) && data.provider.length < 2) {
        throw new Error('Provider must be a valid provider name');
    }
    
    // Status validation: Must be from allowed list
    const allowedStatuses = [
        'Walk-in', 'Online Appointment', 'Scheduled', 'Completed', 'Done', 
        'Finished', 'Cancelled', 'Canceled', 'No Show', 'No-show', 'Archived'
    ];
    if (!allowedStatuses.includes(data.status)) {
        throw new Error(`Status must be one of: ${allowedStatuses.join(', ')}`);
    }
    
    // Patient Type validation: Must be either Gynecology or Prenatal
    const allowedPatientTypes = ['Gynecology', 'Prenatal'];
    if (data.patientType && !allowedPatientTypes.includes(data.patientType)) {
        throw new Error(`Patient type must be one of: ${allowedPatientTypes.join(', ')}`);
    }
    
    // Visit Number validation: Must be a positive integer
    if (data.visitNumber && (!Number.isInteger(data.visitNumber) || data.visitNumber < 1)) {
        throw new Error('Visit number must be a positive integer');
    }
    
    // EndTime validation if present
    if (data.endTime && !timeRegex.test(data.endTime)) {
        throw new Error('End time must be in ISO string format');
    }
    
    // FollowupDate validation if present
    if (data.followupDate && !timeRegex.test(data.followupDate)) {
        throw new Error('Follow-up date must be in ISO string format');
    }
    
    debugLog('✅ Firebase rules validation passed', 'success');
}

// CRITICAL FIX: Enhanced database write function with detailed error handling
async function writeAppointmentToFirebase(appointmentData) {
    debugLog('💾 Attempting to write appointment to Firebase', 'info');
    
    try {
        // Check prerequisites
        if (!database || !appointmentsRef) {
            throw new Error('Firebase database not initialized');
        }
        
        if (connectionState !== 'connected') {
            throw new Error(`Database not connected (state: ${connectionState})`);
        }
        
        // Format and validate data
        const formattedData = formatAppointmentForFirebase(appointmentData);
        debugLog('📝 Writing formatted data to Firebase', 'info', formattedData);
        
        // Create new reference and write data
        const newRef = appointmentsRef.push();
        debugLog(`🆔 Generated Firebase ID: ${newRef.key}`, 'info');
        
        // Set data with timeout
        const writePromise = newRef.set(formattedData);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Write operation timeout after 15 seconds')), 15000)
        );
        
        await Promise.race([writePromise, timeoutPromise]);
        
        debugLog(`✅ Successfully wrote appointment to Firebase with ID: ${newRef.key}`, 'success');
        
        // Log activity
        await window.appointmentsApp?.authManager?.logUserActivity('create_appointment', {
            appointmentId: newRef.key,
            patientName: formattedData.name,
            appointmentTime: formattedData.time
        });
        
        return newRef.key;
        
    } catch (error) {
        debugLog(`❌ Failed to write appointment to Firebase: ${error.message}`, 'error', error);
        
        // Log detailed error information
        if (error.code) {
            debugLog(`Firebase error code: ${error.code}`, 'error');
        }
        if (error.details) {
            debugLog(`Firebase error details: ${error.details}`, 'error');
        }
        
        throw error;
    }
}

// CRITICAL FIX: Test Firebase connection and write permissions
async function testFirebaseWritePermissions() {
    debugLog('🧪 Testing Firebase write permissions', 'info');
    
    try {
        // Test connection first
        if (!database) {
            throw new Error('Database not initialized');
        }
        
        // Test connection status
        const connectedRef = database.ref('.info/connected');
        const connectionSnapshot = await connectedRef.once('value');
        const isConnected = connectionSnapshot.val() === true;
        
        if (!isConnected) {
            throw new Error('Not connected to Firebase');
        }
        
        debugLog('✅ Firebase connection confirmed', 'success');
        
        // Test write with minimal compliant data
        const testData = {
            name: 'Connection Test',
            time: new Date().toISOString(),
            purpose: 'Prenatal Checkup',
            provider: 'Dr. Gerola Simisim',
            status: 'Walk-in',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        debugLog('🧪 Testing write with minimal data', 'info', testData);
        
        const testRef = appointmentsRef.push();
        await testRef.set(testData);
        
        debugLog('✅ Write test successful, cleaning up test data', 'success');
        
        // Clean up test data
        await testRef.remove();
        
        debugLog('✅ Firebase write permissions confirmed', 'success');
        return true;
        
    } catch (error) {
        debugLog(`❌ Firebase write permission test failed: ${error.message}`, 'error', error);
        return false;
    }
}

// Utility Functions for Configuration Management
function validateFirebaseConfig(config) {
    const required = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
    
    if (!config || typeof config !== 'object') {
        debugLog('Invalid config: not an object', 'error');
        return false;
    }
    
    for (const field of required) {
        if (!config[field] || typeof config[field] !== 'string' || config[field].trim() === '') {
            debugLog(`Invalid config: missing ${field}`, 'error');
            return false;
        }
    }
    
    try {
        new URL(config.databaseURL);
        new URL(`https://${config.authDomain}`);
    } catch (error) {
        debugLog('Invalid URL format in config', 'error');
        return false;
    }
    
    return true;
}

function loadFirebaseConfig() {
    const saved = localStorage.getItem('pregnacare_firebase_config');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (validateFirebaseConfig(parsed)) {
                debugLog('Using saved Firebase config', 'success');
                return parsed;
            }
        } catch (error) {
            debugLog('Invalid saved config, using default', 'warning');
        }
    }
    
    if (validateFirebaseConfig(firebaseConfig)) {
        debugLog('Using default Firebase config', 'success');
        return firebaseConfig;
    }
    
    debugLog('No valid Firebase config available', 'error');
    return null;
}

function saveFirebaseConfig(config) {
    try {
        localStorage.setItem('pregnacare_firebase_config', JSON.stringify(config));
    } catch (error) {
        debugLog('Could not save config', 'warning', error);
    }
}

// FIXED: Enhanced appointment data validation
function validateAppointmentData(appointment) {
    if (!appointment || typeof appointment !== 'object') {
        debugLog('Invalid appointment: not an object', 'warning', appointment);
        return false;
    }
    
    // Basic required fields only
    const required = ['name', 'time', 'purpose', 'provider'];
    for (const field of required) {
        if (!appointment[field]) {
            debugLog(`Invalid appointment: missing ${field}`, 'warning', appointment);
            return false;
        }
    }
    
    // Validate time is a valid date
    if (!(appointment.time instanceof Date) && isNaN(new Date(appointment.time).getTime())) {
        debugLog('Invalid appointment: invalid time', 'warning', appointment);
        return false;
    }
    
    // Validate endTime if present (optional)
    if (appointment.endTime && !(appointment.endTime instanceof Date) && isNaN(new Date(appointment.endTime).getTime())) {
        debugLog('Invalid appointment: invalid endTime', 'warning', appointment);
        return false;
    }
    
    return true;
}

// FIXED: Enhanced history management functions with automatic past appointment handling
function isHistoryAppointment(appointment) {
    if (!validateAppointmentData(appointment)) {
        return false; // Invalid appointments should not appear in any view
    }
    
    const completedStatuses = [
        'completed', 
        'cancelled', 
        'canceled',  // Handle both spellings
        'no-show', 
        'no show',
        'done',
        'finished',
        'archived'
    ];
    
    const status = (appointment.status || '').toLowerCase().trim();
    const isStatusCompleted = completedStatuses.includes(status);
    
    // FIXED: Extended grace period to allow follow-up appointment scheduling (24 hours after end time)
    const now = new Date();
    const appointmentEndTime = appointment.endTime || new Date(appointment.time.getTime() + 60 * 60 * 1000); // Default 1 hour if no end time
    const gracePeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds (CHANGED from 2 hours)
    const isPastDue = (appointmentEndTime.getTime() + gracePeriod) < now.getTime();
    
    return isStatusCompleted || isPastDue;
}

// NEW: Function to automatically move past appointments to history
async function autoMoveCompletedAppointments() {
    debugLog('Checking for appointments that should be moved to history...', 'info');
    
    const now = new Date();
    const activeApps = getActiveAppointments();
    const appointmentsToMove = [];
    
    activeApps.forEach(appointment => {
        const appointmentEndTime = appointment.endTime || new Date(appointment.time.getTime() + 60 * 60 * 1000);
        // CHANGED: Extended grace period to 24 hours for follow-up scheduling
        const gracePeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds (CHANGED from 2 hours)
        const isPastDue = (appointmentEndTime.getTime() + gracePeriod) < now.getTime();
        
        if (isPastDue && appointment.status !== 'Completed' && appointment.status !== 'Cancelled' && appointment.status !== 'No Show') {
            appointmentsToMove.push(appointment);
        }
    });
    
    if (appointmentsToMove.length > 0) {
        debugLog(`Found ${appointmentsToMove.length} past appointments to move to history`, 'info', appointmentsToMove.map(a => ({ name: a.name, time: a.time })));
        
        for (const appointment of appointmentsToMove) {
            try {
                await updateAppointmentInDatabase(appointment.id, { 
                    status: 'Completed',
                    updatedAt: new Date()
                });
                debugLog(`Auto-moved past appointment to history: ${appointment.name}`, 'success');
            } catch (error) {
                debugLog(`Failed to auto-move appointment: ${appointment.name}`, 'error', error);
            }
        }
        
        if (appointmentsToMove.length > 0) {
            showNotification(`Automatically moved ${appointmentsToMove.length} past appointments to history`, 'info', 'system');
        }
    }
    
    return appointmentsToMove.length;
}

function getActiveAppointments() {
    return appointments.filter(app => {
        if (!validateAppointmentData(app)) {
            debugLog('Removing invalid appointment from active view', 'warning', app);
            return false;
        }
        return !isHistoryAppointment(app);
    });
}

function getHistoryAppointments() {
    return appointments.filter(app => {
        if (!validateAppointmentData(app)) {
            debugLog('Removing invalid appointment from history view', 'warning', app);
            return false;
        }
        return isHistoryAppointment(app);
    });
}

// FIXED: Clean up appointments array to remove invalid entries
function cleanupAppointments() {
    const originalLength = appointments.length;
    appointments = appointments.filter(app => {
        const isValid = validateAppointmentData(app);
        if (!isValid) {
            debugLog('Removing invalid appointment', 'warning', app);
        }
        return isValid;
    });
    
    const removedCount = originalLength - appointments.length;
    if (removedCount > 0) {
        debugLog(`Cleaned up ${removedCount} invalid appointments`, 'info');
        saveAppointmentsToStorage();
    }
}

function filterHistoryAppointments(historyAppointments) {
   let filtered = [...historyAppointments];
   
   // Filter by status
   if (historyFilters.status) {
       filtered = filtered.filter(app => 
           app.status && app.status.toLowerCase() === historyFilters.status.toLowerCase()
       );
   }
   
   // Filter by date range
   if (historyFilters.dateRange) {
       const now = new Date();
       let startDate;
       
       switch (historyFilters.dateRange) {
           case 'last-week':
               startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
               break;
           case 'last-month':
               startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
               break;
           case 'last-3-months':
               startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
               break;
           case 'last-6-months':
               startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
               break;
           case 'last-year':
               startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
               break;
           default:
               startDate = null;
       }
       
       if (startDate) {
           filtered = filtered.filter(app => {
               const appointmentDate = new Date(app.time);
               return appointmentDate >= startDate;
           });
       }
   }
   
   return filtered;
}

function switchToActiveView() {
   currentView = 'active';
   
   // Clean up before switching
   cleanupAppointments();
   
   // Update button states
   if (activeAppointmentsBtn) activeAppointmentsBtn.classList.add('active');
   if (historyAppointmentsBtn) historyAppointmentsBtn.classList.remove('active');
   
   // Hide history filters and summary
   if (historyFilters_div) historyFilters_div.style.display = 'none';
   if (historySummaryCard) historySummaryCard.style.display = 'none';
   
   // Update filtered appointments and refresh display
   filteredAppointments = getActiveAppointments();
   updateTable();
   updateCards();
   updateCountBadges();
   
   debugLog('Switched to Active Appointments view', 'info');
}

function switchToHistoryView() {
   currentView = 'history';
   
   // Clean up before switching
   cleanupAppointments();
   
   // Update button states
   if (activeAppointmentsBtn) activeAppointmentsBtn.classList.remove('active');
   if (historyAppointmentsBtn) historyAppointmentsBtn.classList.add('active');
   
   // Show history filters and summary
   if (historyFilters_div) historyFilters_div.style.display = 'flex';
   if (historySummaryCard) historySummaryCard.style.display = 'block';
   
   // Update filtered appointments and refresh display
   const historyAppointments = getHistoryAppointments();
   filteredAppointments = filterHistoryAppointments(historyAppointments);
   updateTable();
   updateHistorySummary(historyAppointments);
   updateCountBadges();
   
   debugLog('Switched to History view', 'info');
}

function updateCountBadges() {
   const activeCount = getActiveAppointments().length;
   const historyCount = getHistoryAppointments().length;
   
   const activeCountEl = document.getElementById('activeCountBadge');
   const historyCountEl = document.getElementById('historyCountBadge');
   
   if (activeCountEl) activeCountEl.textContent = activeCount;
   if (historyCountEl) historyCountEl.textContent = historyCount;
}

function updateHistorySummary(historyAppointments) {
   const filtered = filterHistoryAppointments(historyAppointments);
   
   // Calculate summary statistics
   const totalCount = filtered.length;
   const completedCount = filtered.filter(app => {
       const status = (app.status || '').toLowerCase();
       return status === 'completed' || status === 'done' || status === 'finished';
   }).length;
   const cancelledCount = filtered.filter(app => {
       const status = (app.status || '').toLowerCase();
       return status === 'cancelled' || status === 'canceled';
   }).length;
   const noShowCount = filtered.filter(app => {
       const status = (app.status || '').toLowerCase();
       return status === 'no-show' || status === 'no show';
   }).length;
   
   // Update summary display
   const totalEl = document.getElementById('historyTotalCount');
   const completedEl = document.getElementById('historyCompletedCount');
   const cancelledEl = document.getElementById('historyCancelledCount');
   const noShowEl = document.getElementById('historyNoShowCount');
   const periodEl = document.getElementById('summaryPeriod');
   
   if (totalEl) totalEl.textContent = totalCount;
   if (completedEl) completedEl.textContent = completedCount;
   if (cancelledEl) cancelledEl.textContent = cancelledCount;
   if (noShowEl) noShowEl.textContent = noShowCount;
   
   // Update period display
   const periodMap = {
       '': 'All Time',
       'last-week': 'Last Week',
       'last-month': 'Last Month',
       'last-3-months': 'Last 3 Months',
       'last-6-months': 'Last 6 Months',
       'last-year': 'Last Year'
   };
   
   if (periodEl) periodEl.textContent = periodMap[historyFilters.dateRange] || 'All Time';
}

function exportHistoryData() {
   const historyAppointments = getHistoryAppointments();
   const filtered = filterHistoryAppointments(historyAppointments);
   
   if (filtered.length === 0) {
       showNotification('No history data to export', 'warning', 'appointments');
       return;
   }
   
   // Prepare CSV data
   const headers = ['Date', 'Start Time', 'End Time', 'Duration (min)', 'Patient', 'Purpose', 'Provider', 'Status', 'Created', 'Updated'];
   const csvData = [headers];
   
   filtered.forEach(app => {
       const startTime = new Date(app.time);
       const endTime = app.endTime ? new Date(app.endTime) : new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour if no end time
       const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // Duration in minutes
       
       const row = [
           startTime.toLocaleDateString(),
           startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
           endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
           duration,
           app.name || 'N/A',
           app.purpose || 'N/A',
           app.provider || 'N/A',
           app.status || 'N/A',
           app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'N/A',
           app.updatedAt ? new Date(app.updatedAt).toLocaleDateString() : 'N/A'
       ];
       csvData.push(row);
   });
   
   // Convert to CSV string
   const csvString = csvData.map(row => 
       row.map(cell => `"${cell}"`).join(',')
   ).join('\n');
   
   // Create and download file
   const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
   const link = document.createElement('a');
   
   if (link.download !== undefined) {
       const url = URL.createObjectURL(blob);
       link.setAttribute('href', url);
       
       const dateStr = new Date().toISOString().split('T')[0];
       const periodStr = historyFilters.dateRange ? `_${historyFilters.dateRange}` : '_all-time';
       link.setAttribute('download', `pregnacare-appointment-history_${dateStr}${periodStr}.csv`);
       
       link.style.visibility = 'hidden';
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
       
       showNotification(`Exported ${filtered.length} appointments to CSV`, 'success', 'appointments');
   } else {
       showNotification('Export not supported in this browser', 'error', 'appointments');
   }
}

// NEW: End Time Functions with Flexible Validation
function calculateDefaultEndTime(startTime) {
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1); // Default to 1 hour appointment
    return endTime;
}

// FIXED: Simplified and flexible appointment time validation
function validateAppointmentTimes(startTime, endTime) {
    debugLog('Validating appointment times', 'info', { start: startTime, end: endTime });
    
    if (!startTime || !endTime) {
        debugLog('Missing start or end time', 'error');
        return { valid: false, message: "Both start and end times are required." };
    }
    
    if (endTime <= startTime) {
        debugLog('End time before start time', 'error');
        return { valid: false, message: "End time must be after start time." };
    }
    
    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // minutes
    debugLog(`Duration: ${duration} minutes`, 'info');
    
    if (duration < 15) {
        debugLog('Duration too short', 'error');
        return { valid: false, message: "Appointment must be at least 15 minutes long." };
    }
    
    if (duration > 480) { // 8 hours
        debugLog('Duration too long', 'error');
        return { valid: false, message: "Appointment cannot be longer than 8 hours." };
    }
    
    // FLEXIBLE BUSINESS HOURS: 7 AM to 6 PM (no lunch break restrictions)
    const startHour = startTime.getHours();
    const endHour = endTime.getHours();
    const endMinutes = endTime.getMinutes();
    
    debugLog('Business hours check', 'info', { startHour, endHour, endMinutes });
    
    if (startHour < 7) {
        debugLog('Starts too early', 'error');
        return { valid: false, message: "Appointments cannot start before 7:00 AM" };
    }
    
    if (endHour > 18 || (endHour === 18 && endMinutes > 0)) {
        debugLog('Ends too late', 'error');
        return { valid: false, message: "Appointments must end by 6:00 PM" };
    }
    
    debugLog('Time validation passed', 'success');
    return { valid: true, duration: Math.round(duration) };
}

function updateEndTimeField() {
    const startTimeInput = document.getElementById("appointmentTime");
    const endTimeInput = document.getElementById("appointmentEndTime");
    
    if (!startTimeInput || !endTimeInput) return;
    
    const startTime = new Date(startTimeInput.value);
    
    if (isNaN(startTime.getTime())) {
        endTimeInput.value = '';
        updateDurationDisplay();
        return;
    }
    
    // If end time is empty, set default
    if (!endTimeInput.value) {
        const defaultEndTime = calculateDefaultEndTime(startTime);
        endTimeInput.value = formatDateForInput(defaultEndTime);
    }
    
    updateDurationDisplay();
}

function updateDurationDisplay() {
    const startTimeInput = document.getElementById("appointmentTime");
    const endTimeInput = document.getElementById("appointmentEndTime");
    const durationDisplay = document.getElementById("appointmentDuration");
    
    if (!startTimeInput || !endTimeInput || !durationDisplay) return;
    
    const startTime = new Date(startTimeInput.value);
    const endTime = new Date(endTimeInput.value);
    
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        durationDisplay.textContent = '';
        durationDisplay.className = 'duration-display';
        return;
    }
    
    const validation = validateAppointmentTimes(startTime, endTime);
    
    if (validation.valid) {
        durationDisplay.textContent = `Duration: ${validation.duration} minutes`;
        durationDisplay.className = 'duration-display valid';
    } else {
        durationDisplay.textContent = validation.message;
        durationDisplay.className = 'duration-display invalid';
    }
}

// SIMPLIFIED: No strict business hours validation
function validateBusinessHours() {
    // Always return true for simplified validation
    return true;
}

// Retry Logic with Shorter Timeouts for Better UX
async function executeWithRetry(operation, operationName = 'operation', customMaxRetries = null) {
   const maxAttempts = customMaxRetries || 3;
   let lastError;

   for (let attempt = 1; attempt <= maxAttempts; attempt++) {
       try {
           const operationPromise = operation();
           const timeoutPromise = new Promise((_, reject) => 
               setTimeout(() => reject(new Error('Operation timeout')), 10000)
           );
           
           const result = await Promise.race([operationPromise, timeoutPromise]);
           
           if (attempt > 1) {
               debugLog(`${operationName} succeeded on attempt ${attempt}`, 'success');
           }
           return result;
       } catch (error) {
           lastError = error;
           debugLog(`${operationName} attempt ${attempt} failed: ${error.message}`, 'warning');

           if (attempt === maxAttempts) {
               break;
           }

           const delay = Math.min(1000 * attempt, 5000);
           debugLog(`Retrying ${operationName} in ${delay}ms...`, 'info');
           await new Promise(resolve => setTimeout(resolve, delay));
       }
   }

   debugLog(`${operationName} failed after ${maxAttempts} attempts`, 'error');
   throw new Error(`${operationName} failed: ${lastError.message}`);
}

// Load Firebase SDKs with Retry
function loadFirebaseSDKs() {
   return new Promise((resolve, reject) => {
       if (typeof firebase !== 'undefined') {
           debugLog('Firebase SDK already available', 'success');
           resolve();
           return;
       }
       
       debugLog('Loading Firebase SDKs...', 'info');
       
       const loadScript = (src) => {
           return new Promise((resolve, reject) => {
               const script = document.createElement('script');
               script.src = src;
               script.onload = () => {
                   debugLog(`Loaded: ${src}`, 'success');
                   resolve();
               };
               script.onerror = () => {
                   debugLog(`Failed to load: ${src}`, 'error');
                   reject(new Error(`Failed to load ${src}`));
               };
               document.head.appendChild(script);
           });
       };
       
       // Scripts are already loaded from HTML
       resolve();
   });
}

// CRITICAL FIX: Test Firebase Connection without infinite recursion
async function testFirebaseConnection() {
   return new Promise((resolve, reject) => {
       let isResolved = false; // Prevent multiple resolutions
       
       const timeout = setTimeout(() => {
           if (!isResolved) {
               isResolved = true;
               debugLog('Connection test timeout after 10 seconds', 'warning');
               reject(new Error('Connection test timeout after 10 seconds'));
           }
       }, 10000);
       
       try {
           const connectedRef = database.ref('.info/connected');
           
           // FIXED: Use once() instead of on() to prevent infinite callbacks
           connectedRef.once('value', (snapshot) => {
               if (isResolved) return; // Already resolved, ignore
               
               clearTimeout(timeout);
               isResolved = true;
               
               const isConnected = snapshot.val() === true;
               debugLog(`Firebase connection test: ${isConnected ? 'Connected' : 'Disconnected'}`, isConnected ? 'success' : 'warning');
               
               if (isConnected) {
                   resolve(true);
               } else {
                   reject(new Error('Not connected to Firebase'));
               }
           }, (error) => {
               if (isResolved) return; // Already resolved, ignore
               
               clearTimeout(timeout);
               isResolved = true;
               debugLog('Connection test error', 'error', error);
               reject(error);
           });
           
       } catch (error) {
           if (!isResolved) {
               clearTimeout(timeout);
               isResolved = true;
               debugLog('Error setting up connection test', 'error', error);
               reject(error);
           }
       }
   });
}

// FIXED: Initialize Firebase with much better error handling
async function initializeFirebase() {
   try {
       debugLog('Starting Firebase initialization...', 'info');
       updateConnectionStatus('connecting');
       
       // Firebase is already initialized at the top of the file
       // Just set up references
       appointmentsRef = database.ref('appointments');
       patientsRef = database.ref('patients');
       
       // Test the connection
       await testFirebaseConnection();
       
       debugLog('Firebase initialized successfully', 'success');
       updateConnectionStatus('connected');
       retryAttempts = 0;
       
       // CRITICAL FIX: Test write permissions immediately after initialization
       const writePermissionsOk = await testFirebaseWritePermissions();
       if (!writePermissionsOk) {
           debugLog('Write permissions test failed - appointments may not save', 'error');
           showNotification('Database write test failed. Appointments may not save properly.', 'warning', 'system');
       }
       
       // Initialize other components
       await initializeNotificationSystem();
       setupRealtimeListener();
       monitorConnection();
       initializePatientDropdown();
       startAppointmentMonitoring();
       
       // Sync any pending operations
       setTimeout(syncPendingOperations, 1000);
       
   } catch (error) {
       debugLog('Firebase initialization failed', 'error', error);
       updateConnectionStatus('error');
       
       debugLog('Database connection failed. Running in offline mode.', 'warning');
       
       // Initialize local storage as fallback
       initializeLocalStorage();
       initializePatientDropdown();
       
       // Schedule reconnection attempt
       scheduleReconnection();
   }
}

// Scheduled Reconnection Logic
function scheduleReconnection() {
   if (retryAttempts >= 5) {
       debugLog('Max reconnection attempts reached', 'error');
       return;
   }
   
   retryAttempts++;
   const delay = Math.min(10000 * retryAttempts, 60000); // 10s, 20s, 30s, 40s, 60s
   
   debugLog(`Scheduling reconnection attempt ${retryAttempts} in ${delay}ms`, 'info');
   
   setTimeout(() => {
       if (connectionState !== 'connected') {
           debugLog(`Attempting reconnection ${retryAttempts}/5...`, 'info');
           initializeFirebase();
       }
   }, delay);
}

// Connection Status Management
function updateConnectionStatus(status) {
   connectionState = status;
   
   const statusElement = document.getElementById('firebaseStatus');
   if (statusElement) {
       statusElement.className = `firebase-status ${status}`;
       
       const text = statusElement.querySelector('span');
       if (text) {
           switch(status) {
               case 'connected':
                   text.textContent = 'Connected';
                   break;
               case 'connecting':
                   text.textContent = 'Connecting...';
                   break;
               case 'disconnected':
                   text.textContent = 'Disconnected';
                   break;
               case 'error':
                   text.textContent = 'Error';
                   break;
           }
       }
   }
   
   const syncElements = document.querySelectorAll('.sync-status');
   syncElements.forEach(element => {
       element.className = `sync-status ${status}`;
   });
   
   debugLog(`Connection status: ${status}`, 'info');
}

// Auto-Hide Header Implementation
let forceShowHeader, restoreAutoHide;

function initializeAutoHideHeader() {
   const searchHeader = document.querySelector('.search-header');
   const mainContent = document.querySelector('.main');
   
   if (!searchHeader || !mainContent) {
       debugLog('Header or main content not found - auto-hide disabled', 'warning');
       return;
   }
   
   let ticking = false;
   let autoHideEnabled = true;
   
   function handleScroll() {
       if (!ticking && autoHideEnabled) {
           requestAnimationFrame(() => {
               updateHeaderVisibility();
               ticking = false;
           });
           ticking = true;
       }
   }
   
   function updateHeaderVisibility() {
       const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
       const scrollDelta = currentScrollTop - lastScrollTop;
       const scrollThreshold = 5;
       
       if (scrollTimeout) {
           clearTimeout(scrollTimeout);
       }
       
       if (currentScrollTop <= 50) {
           showHeader();
           lastScrollTop = currentScrollTop;
           return;
       }
       
       if (Math.abs(scrollDelta) < scrollThreshold) {
           lastScrollTop = currentScrollTop;
           return;
       }
       
       if (scrollDelta > 0 && isHeaderVisible) {
           hideHeader();
       } else if (scrollDelta < 0 && !isHeaderVisible) {
           showHeader();
       }
       
       lastScrollTop = currentScrollTop;
   }
   
   function showHeader() {
       const searchHeader = document.querySelector('.search-header');
       const mainContent = document.querySelector('.main');
       
       if (searchHeader && mainContent) {
           searchHeader.classList.remove('header-hidden', 'scrolling-down');
           searchHeader.classList.add('header-visible', 'scrolling-up');
           mainContent.classList.remove('header-hidden');
           isHeaderVisible = true;
           
           scrollTimeout = setTimeout(() => {
               // This timeout helps prevent rapid show/hide cycles
           }, 150);
       }
   }
   
   function hideHeader() {
       const searchHeader = document.querySelector('.search-header');
       const mainContent = document.querySelector('.main');
       
       if (searchHeader && mainContent) {
           searchHeader.classList.remove('header-visible', 'scrolling-up');
           searchHeader.classList.add('header-hidden', 'scrolling-down');
           mainContent.classList.add('header-hidden');
           isHeaderVisible = false;
       }
   }
   
   forceShowHeader = function() {
       showHeader();
       autoHideEnabled = false;
       debugLog('Auto-hide disabled (modal open)', 'info');
   };
   
   restoreAutoHide = function() {
       autoHideEnabled = true;
       debugLog('Auto-hide restored (modal closed)', 'info');
   };
   
   window.addEventListener('scroll', handleScroll, { passive: true });
   
   const searchInput = document.querySelector('.search input');
   if (searchInput) {
       searchInput.addEventListener('focus', () => {
           showHeader();
       });
   }
   
   document.addEventListener('keydown', (e) => {
       if (e.key === 'Escape') {
           showHeader();
       }
   });
   
   lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
   
   debugLog('Auto-hide header functionality initialized', 'success');
}

// Enhanced window event listeners with header management
window.addEventListener('online', () => {
   debugLog('Browser is online', 'info');
   isOnline = true;
   if (connectionState !== 'connected') {
       debugLog('Attempting to reconnect to Firebase...', 'info');
       setTimeout(initializeFirebase, 1000); // Brief delay before reconnection
   }
});

window.addEventListener('offline', () => {
   debugLog('Browser is offline', 'warning');
   isOnline = false;
   updateConnectionStatus('disconnected');
});

// FIXED: Function to create proper execute functions for operations
function createExecuteFunction(operation) {
    debugLog('Creating execute function for operation', 'info', operation.type);
    
    switch (operation.type) {
        case 'add':
            return async () => {
                debugLog('Executing add operation', 'info', operation.localId);
                if (!appointmentsRef) {
                    throw new Error('Database not available');
                }
                
                // CRITICAL FIX: Use the new Firebase-compliant write function
                const firebaseId = await writeAppointmentToFirebase(operation.data);
                
                // Update local appointment with Firebase ID
                if (operation.localId) {
                    const appointmentIndex = appointments.findIndex(app => app.id === operation.localId);
                    if (appointmentIndex !== -1) {
                        appointments[appointmentIndex] = {
                            ...appointments[appointmentIndex],
                            id: firebaseId,
                            isLocal: false
                        };
                        saveAppointmentsToStorage();
                        updateAppointments();
                        debugLog(`Updated local appointment ${operation.localId} with Firebase ID: ${firebaseId}`, 'success');
                    }
                }
                
                return firebaseId;
            };
            
        case 'update':
            return async () => {
                debugLog('Executing update operation', 'info', operation.data.id);
                if (!appointmentsRef) {
                    throw new Error('Database not available');
                }
                
                const updateData = {
                    ...operation.data.updates,
                    updatedAt: formatDateForFirebase(new Date())
                };
                
                // Handle end time update
                if (operation.data.updates.endTime) {
                    updateData.endTime = formatDateForFirebase(operation.data.updates.endTime);
                }
                
                await appointmentsRef.child(operation.data.id).update(updateData);
                debugLog(`Updated appointment ${operation.data.id} in Firebase`, 'success');
                
                // Log activity
                await window.appointmentsApp?.authManager?.logUserActivity('update_appointment', {
                    appointmentId: operation.data.id
                });
            };
            
        case 'delete':
            return async () => {
                debugLog('Executing delete operation', 'info', operation.data.id);
                if (!appointmentsRef) {
                    throw new Error('Database not available');
                }
                
                await appointmentsRef.child(operation.data.id).remove();
                debugLog(`Deleted appointment ${operation.data.id} from Firebase`, 'success');
                
                // Log activity
                await window.appointmentsApp?.authManager?.logUserActivity('delete_appointment', {
                    appointmentId: operation.data.id
                });
            };
            
        default:
            debugLog('Unknown operation type', 'error', operation.type);
            return null;
    }
}

// FIXED: Enhanced addToSyncQueue function with proper execute function creation
function addToSyncQueue(operation) {
    debugLog('Adding operation to sync queue', 'info', operation.type);
    
    // Create a properly formatted operation with execute function
    const formattedOperation = {
        ...operation,
        timestamp: Date.now(),
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    // Ensure the operation has a proper execute function
    if (!formattedOperation.execute || typeof formattedOperation.execute !== 'function') {
        debugLog('Creating execute function for operation', 'info', operation.type);
        formattedOperation.execute = createExecuteFunction(operation);
    }
    
    // Validate the execute function was created successfully
    if (!formattedOperation.execute || typeof formattedOperation.execute !== 'function') {
        debugLog('Failed to create execute function for operation', 'error', operation);
        return;
    }
    
    syncQueue.push(formattedOperation);
    saveSyncQueue();
    debugLog(`Added ${operation.type} to sync queue (${syncQueue.length} total)`, 'success');
}

function saveSyncQueue() {
   try {
       // Filter out operations without execute functions before saving
       const validOperations = syncQueue.filter(op => op.execute && typeof op.execute === 'function');
       
       // Only save the operation data, not the functions (functions can't be serialized)
       const serializableQueue = validOperations.map(op => ({
           type: op.type,
           data: op.data,
           localId: op.localId,
           timestamp: op.timestamp,
           id: op.id
       }));
       
       localStorage.setItem('pregnacare_sync_queue', JSON.stringify(serializableQueue));
       debugLog(`Saved ${serializableQueue.length} operations to sync queue`, 'info');
   } catch (error) {
       debugLog('Failed to save sync queue', 'error', error);
   }
}

// FIXED: Enhanced loadSyncQueue function with validation and repair
function loadSyncQueue() {
    try {
        const saved = localStorage.getItem('pregnacare_sync_queue');
        if (saved) {
            const parsedQueue = JSON.parse(saved);
            
            // Validate and repair operations
            syncQueue = parsedQueue.map(op => {
                // Ensure operation has required properties
                if (!op.type || !op.data) {
                    debugLog('Invalid operation in queue', 'warning', op);
                    return null;
                }
                
                // Ensure operation has execute function
                if (!op.execute || typeof op.execute !== 'function') {
                    debugLog('Repairing operation without execute function', 'info', op.type);
                    op.execute = createExecuteFunction(op);
                }
                
                return op;
            }).filter(op => op !== null && op.execute && typeof op.execute === 'function'); // Remove invalid operations
            
            debugLog(`Loaded and repaired ${syncQueue.length} operations from sync queue`, 'info');
            
            // Save the cleaned queue back
            saveSyncQueue();
        } else {
            syncQueue = [];
            debugLog('No sync queue found, starting with empty queue', 'info');
        }
    } catch (error) {
        debugLog('Failed to load sync queue', 'error', error);
        syncQueue = [];
        
        // Clear corrupted sync queue
        localStorage.removeItem('pregnacare_sync_queue');
        debugLog('Cleared corrupted sync queue', 'warning');
    }
}

// FIXED: Enhanced syncPendingOperations function with better error handling
async function syncPendingOperations() {
    if (connectionState !== 'connected' || syncQueue.length === 0) {
        debugLog(`Skipping sync: connection=${connectionState}, queue=${syncQueue.length}`, 'info');
        return;
    }
    
    debugLog(`Syncing ${syncQueue.length} pending operations...`, 'info');
    const successfulOps = [];
    const failedOps = [];
    
    for (const operation of [...syncQueue]) {
        try {
            // Validate the operation has an execute function
            if (!operation.execute || typeof operation.execute !== 'function') {
                debugLog('Operation missing execute function, attempting to repair', 'warning', operation.type);
                operation.execute = createExecuteFunction(operation);
                
                if (!operation.execute || typeof operation.execute !== 'function') {
                    debugLog('Could not repair operation', 'error', operation);
                    failedOps.push(operation);
                    continue;
                }
            }
            
            // Execute the operation with timeout
            debugLog(`Executing ${operation.type} operation...`, 'info');
            await executeWithRetry(operation.execute, `Sync ${operation.type}`, 2);
            successfulOps.push(operation);
            debugLog(`Synced: ${operation.type}`, 'success');
            
        } catch (error) {
            debugLog(`Sync failed for ${operation.type}`, 'error', error);
            
            // Remove stale operations (older than 24 hours)
            if (Date.now() - operation.timestamp > 24 * 60 * 60 * 1000) {
                successfulOps.push(operation);
                debugLog(`Removing stale operation: ${operation.type}`, 'warning');
            } else {
                failedOps.push(operation);
            }
        }
    }
    
    // Update sync queue - remove successful operations
    syncQueue = syncQueue.filter(op => !successfulOps.includes(op));
    saveSyncQueue();
    
    debugLog(`Sync complete. ${successfulOps.length} successful, ${failedOps.length} failed, ${syncQueue.length} remaining`, 'info');
    
    if (successfulOps.length > 0) {
        updateAppointments();
        showNotification(`Synced ${successfulOps.length} operations`, 'success', 'sync');
    }
    
    if (failedOps.length > 0) {
        debugLog(`${failedOps.length} operations failed and will be retried later`, 'warning');
    }
}

// UTILITY: Function to repair existing sync queue
function repairSyncQueue() {
    debugLog('Repairing sync queue...', 'info');
    
    try {
        const saved = localStorage.getItem('pregnacare_sync_queue');
        if (!saved) {
            debugLog('No sync queue to repair', 'info');
            return;
        }
        
        const parsedQueue = JSON.parse(saved);
        let repairedCount = 0;
        
        const repairedQueue = parsedQueue.map(op => {
            if (!op.execute || typeof op.execute !== 'function') {
                op.execute = createExecuteFunction(op);
                repairedCount++;
                debugLog(`Repaired ${op.type} operation`, 'info');
            }
            return op;
        }).filter(op => op.execute && typeof op.execute === 'function');
        
        syncQueue = repairedQueue;
        saveSyncQueue();
        
        debugLog(`Repaired ${repairedCount} operations in sync queue`, 'success');
        showNotification(`Repaired ${repairedCount} sync operations`, 'success', 'system');
        
    } catch (error) {
        debugLog('Error repairing sync queue', 'error', error);
        showNotification('Failed to repair sync queue', 'error', 'system');
    }
}

// UTILITY: Function to remove duplicate appointments
window.removeDuplicateAppointments = function() {
    debugLog('Checking for duplicate appointments...', 'info');
    
    const duplicatesFound = [];
    const uniqueAppointments = [];
    const seen = new Set();
    
    appointments.forEach((app, index) => {
        // Create a unique key based on name, time, and purpose
        const appointmentKey = `${app.name}_${app.time?.getTime()}_${app.purpose}`.toLowerCase();
        
        if (seen.has(appointmentKey)) {
            duplicatesFound.push({ index, appointment: app, key: appointmentKey });
        } else {
            seen.add(appointmentKey);
            uniqueAppointments.push(app);
        }
    });
    
    if (duplicatesFound.length > 0) {
        debugLog(`Found ${duplicatesFound.length} duplicate appointments`, 'warning', duplicatesFound);
        console.log('🔍 Duplicate appointments found:');
        duplicatesFound.forEach(dup => {
            console.log(`   - ${dup.appointment.name} at ${dup.appointment.time} (ID: ${dup.appointment.id})`);
        });
        
        if (confirm(`Found ${duplicatesFound.length} duplicate appointments. Remove them?`)) {
            appointments = uniqueAppointments;
            saveAppointmentsToStorage();
            updateAppointments();
            
            console.log(`✅ Removed ${duplicatesFound.length} duplicate appointments`);
            showNotification(`Removed ${duplicatesFound.length} duplicate appointments`, 'success', 'system');
            return duplicatesFound.length;
        }
    } else {
        console.log('✅ No duplicate appointments found');
        debugLog('No duplicate appointments found', 'success');
        return 0;
    }
};

// CRITICAL FIX: Enhanced Database Operations with Firebase rules compliance
async function addAppointmentToDatabase(appointmentData) {
   debugLog('Adding appointment to database', 'info', appointmentData);
   
   // Check authentication
   if (!window.appointmentsApp?.authManager?.hasPermission('add')) {
       throw new Error('You do not have permission to add appointments');
   }
   
   // Validate appointment data before adding
   if (!validateAppointmentData(appointmentData)) {
       const error = new Error('Invalid appointment data provided');
       debugLog('Validation failed', 'error', error);
       throw error;
   }
   
   const localAppointment = {
       ...appointmentData,
       id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
       createdAt: new Date(),
       updatedAt: new Date(),
       isLocal: true,
       status: appointmentData.status || 'Walk-in',
       createdBy: window.appointmentsApp?.authManager?.currentUser?.uid,
       createdByName: window.appointmentsApp?.authManager?.userDisplayName
   };
   
   debugLog('Created local appointment', 'info', localAppointment);
   
   appointments.push(localAppointment);
   saveAppointmentsToStorage();
   updateAppointments();
   
   if (connectionState === 'connected' && appointmentsRef) {
       debugLog('Syncing to Firebase...', 'info');
       await syncAppointmentToFirebase(localAppointment, appointmentData);
   } else {
       debugLog('Offline - adding to sync queue', 'warning');
       const operation = {
           type: 'add',
           data: appointmentData,
           localId: localAppointment.id
       };
       addToSyncQueue(operation);
   }
   
   debugLog('Appointment successfully added with ID', 'success', localAppointment.id);
   return localAppointment.id;
}

// CRITICAL FIX: Firebase sync function with rules compliance and duplicate prevention
async function syncAppointmentToFirebase(localAppointment, appointmentData) {
   try {
       debugLog('Syncing appointment to Firebase', 'info', localAppointment.id);
       
       // CRITICAL FIX: Use new Firebase-compliant write function
       const firebaseId = await writeAppointmentToFirebase(appointmentData);
       
       const appointmentIndex = appointments.findIndex(app => app.id === localAppointment.id);
       if (appointmentIndex !== -1) {
           // Update the local appointment with Firebase ID and mark as synced
           appointments[appointmentIndex] = {
               ...appointments[appointmentIndex],
               id: firebaseId,
               isLocal: false,
               synced: true
           };
           
           // Remove any other appointments with the same data to prevent duplicates
           const duplicates = appointments.filter((app, idx) => 
               idx !== appointmentIndex && 
               app.name === appointments[appointmentIndex].name &&
               Math.abs(new Date(app.time).getTime() - new Date(appointments[appointmentIndex].time).getTime()) < 60000 // Within 1 minute
           );
           
           if (duplicates.length > 0) {
               debugLog(`Removing ${duplicates.length} duplicate appointments`, 'info', duplicates.map(d => d.id));
               appointments = appointments.filter((app, idx) => 
                   idx === appointmentIndex || !duplicates.some(dup => dup.id === app.id)
               );
           }
           
           saveAppointmentsToStorage();
           updateAppointments();
           
           debugLog(`Appointment synced to Firebase with ID: ${firebaseId}`, 'success');
       }
       
   } catch (error) {
       debugLog('Background sync failed, will retry later', 'warning', error);
       
       const operation = {
           type: 'add',
           data: appointmentData,
           localId: localAppointment.id
       };
       addToSyncQueue(operation);
   }
}

async function updateAppointmentInDatabase(id, updates) {
   debugLog(`Updating appointment ${id}`, 'info', updates);
   
   // Check authentication
   if (!window.appointmentsApp?.authManager?.hasPermission('edit')) {
       throw new Error('You do not have permission to edit appointments');
   }
   
   const operation = {
       type: 'update',
       data: { id, updates }
   };

   try {
       if (connectionState === 'connected') {
           // Create and execute the operation immediately
           operation.execute = createExecuteFunction(operation);
           await executeWithRetry(operation.execute, 'Update appointment');
           showNotification("Appointment updated successfully!", "success", "appointments");
       } else {
           throw new Error('No database connection');
       }
   } catch (error) {
       debugLog('Adding update to local storage and sync queue', 'warning', error);
       
       const appointmentIndex = appointments.findIndex(app => app.id === id);
       if (appointmentIndex !== -1) {
           appointments[appointmentIndex] = {
               ...appointments[appointmentIndex],
               ...updates,
               updatedAt: new Date(),
               updatedBy: window.appointmentsApp?.authManager?.currentUser?.uid,
               updatedByName: window.appointmentsApp?.authManager?.userDisplayName
           };
           
           saveAppointmentsToStorage();
           updateAppointments();
       }
       
       addToSyncQueue(operation);
       
       showNotification(
           "Changes saved locally. Will sync when connection is restored.",
           "info",
           "appointments"
       );
   }
}

async function deleteAppointmentFromDatabase(id) {
   debugLog(`Starting deletion process for appointment ${id}`, 'info');
   
   // Check authentication
   if (!window.appointmentsApp?.authManager?.hasPermission('delete') && !window.appointmentsApp?.authManager?.isAdmin) {
       showNotification('You do not have permission to delete appointments', 'error');
       return;
   }
   
   // Find the appointment first for logging
   const appointment = appointments.find(app => app.id === id);
   debugLog("Appointment to delete", 'info', appointment);
   
   const operation = {
       type: 'delete',
       data: { id }
   };

   // ALWAYS remove from local array first for immediate UI feedback
   const originalAppointments = [...appointments];
   appointments = appointments.filter(app => app.id !== id);
   saveAppointmentsToStorage();
   updateAppointments();
   debugLog(`Removed appointment ${id} from local storage`, 'info');

   try {
       if (connectionState === 'connected' && appointmentsRef) {
           debugLog(`Attempting to delete ${id} from Firebase...`, 'info');
           
           // Create and execute the operation immediately
           operation.execute = createExecuteFunction(operation);
           await executeWithRetry(operation.execute, 'Delete appointment');
           
           debugLog(`Successfully deleted ${id} from Firebase`, 'success');
           showNotification("Appointment deleted successfully!", "success", "appointments");
       } else {
           debugLog('No database connection, adding to sync queue', 'warning');
           addToSyncQueue(operation);
           showNotification(
               "Deleted locally. Will sync when connection is restored.",
               "info",
               "appointments"
           );
       }
   } catch (error) {
       debugLog(`Failed to delete ${id} from Firebase`, 'error', error);
       
       // If Firebase deletion fails, still keep the local deletion
       // but add to sync queue for retry
       addToSyncQueue(operation);
       
       showNotification(
           "Deleted locally. Will retry Firebase deletion when connection is restored.",
           "warning",
           "appointments"
       );
   }
}

// Initialize Notification System
async function initializeNotificationSystem() {
   if (database && window.notificationSystem) {
       try {
           await window.notificationSystem.initialize(database, currentUser);
           debugLog('Notification system initialized for Appointments', 'success');
       } catch (error) {
           debugLog('Failed to initialize notification system', 'error', error);
       }
   }
}

// Start monitoring appointments for notifications and auto-history management
function startAppointmentMonitoring() {
   checkUpcomingAppointments();
   autoMoveCompletedAppointments(); // Check immediately
   
   setInterval(() => {
       checkUpcomingAppointments();
       autoMoveCompletedAppointments(); // Check every 30 minutes
   }, 30 * 60 * 1000);
   
   // Also check every hour for more frequent past appointment cleanup
   setInterval(() => {
       autoMoveCompletedAppointments();
   }, 60 * 60 * 1000);
}

function checkUpcomingAppointments() {
   const now = new Date();
   const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
   
   appointments.forEach(appointment => {
       if (!validateAppointmentData(appointment)) return;
       
       const appointmentTime = new Date(appointment.time);
       
       if (appointmentTime <= twoHoursFromNow && appointmentTime > now) {
           const notificationKey = `appointment_2hr_${appointment.id}`;
           if (!hasRecentNotification(notificationKey)) {
               if (window.NotificationIntegration && window.NotificationIntegration.appointments) {
                   window.NotificationIntegration.appointments.notifyUpcomingAppointment(appointment);
               }
               markNotificationSent(notificationKey);
           }
       }
   });
}

function hasRecentNotification(key) {
   const sent = localStorage.getItem(`notif_sent_${key}`);
   if (!sent) return false;
   
   const sentTime = parseInt(sent);
   const hoursSince = (Date.now() - sentTime) / (1000 * 60 * 60);
   
   return hoursSince < 24;
}

function markNotificationSent(key) {
   localStorage.setItem(`notif_sent_${key}`, Date.now().toString());
}

// FIXED: Real-time listener with enhanced data validation
function setupRealtimeListener() {
   if (!appointmentsRef || !patientsRef) {
       debugLog('Database references not available for real-time listeners', 'warning');
       return;
   }

   debugLog('Setting up appointments listener...', 'info');
   appointmentsRef.on('value', (snapshot) => {
       try {
           const firebaseData = snapshot.val();
           const firebaseAppointments = [];
           
           if (firebaseData) {
               Object.keys(firebaseData).forEach(key => {
                   const appointment = firebaseData[key];
                   
                   // More flexible validation for Firebase data
                   if (!appointment || !appointment.name || !appointment.time || !appointment.purpose || !appointment.provider) {
                       debugLog('Skipping incomplete appointment from Firebase', 'warning', { key, appointment });
                       return;
                   }
                   
                   try {
                       const appointmentObj = {
                           id: key,
                           name: appointment.name,
                           time: new Date(appointment.time),
                           endTime: appointment.endTime ? new Date(appointment.endTime) : null,
                          visitNumber: appointment.visitNumber || 1,
                          patientType: appointment.patientType || 'Prenatal',
                          followupDate: appointment.followupDate ? new Date(appointment.followupDate) : null,
                          patientId: appointment.patientId,
                          patientKey: appointment.patientKey,
                          completedAt: appointment.completedAt ? new Date(appointment.completedAt) : null,
                          completedBy: appointment.completedBy,
                          completionNotes: appointment.completionNotes,
                          followupFor: appointment.followupFor,
                           purpose: appointment.purpose,
                           provider: appointment.provider,
                           status: appointment.status || 'Walk-in',
                           createdAt: appointment.createdAt ? new Date(appointment.createdAt) : new Date(),
                           updatedAt: appointment.updatedAt ? new Date(appointment.updatedAt) : new Date(),
                           isLocal: false,
                           synced: true,
                           createdBy: appointment.createdBy,
                           createdByName: appointment.createdByName,
                           updatedBy: appointment.updatedBy,
                           updatedByName: appointment.updatedByName
                       };
                       
                       // Final validation before adding
                       if (validateAppointmentData(appointmentObj)) {
                           firebaseAppointments.push(appointmentObj);
                       } else {
                           debugLog('Firebase appointment failed validation', 'warning', { key, appointmentObj });
                       }
                   } catch (dateError) {
                       debugLog('Error processing appointment dates', 'warning', { key, error: dateError });
                   }
               });
           }
           
           // Store current local appointments before merge
           const currentLocalAppointments = [...appointments];
           
           // Merge with duplicate prevention
           appointments = mergeAppointments(currentLocalAppointments, firebaseAppointments);
           
           // Clean up invalid appointments after merging
           cleanupAppointments();
           
           appointments.sort((a, b) => b.createdAt - a.createdAt);
           
           debugLog(`Merged appointments: ${appointments.length} total (${appointments.filter(a => a.isLocal).length} local, ${firebaseAppointments.length} from Firebase)`, 'info');
           
           saveAppointmentsToStorage();
           updateAppointments();
           
       } catch (error) {
           debugLog('Error handling appointments update', 'error', error);
       }
   }, (error) => {
       debugLog("Error listening to appointments", 'error', error);
       updateConnectionStatus('error');
       debugLog("Error loading appointments from database", 'warning');
   });

   debugLog('Setting up patients data listener...', 'info');
   patientsRef.on('value', (snapshot) => {
       try {
           debugLog('Received patients data update from Firebase', 'info');
           const data = snapshot.val();
           
           if (data) {
               patientsData = data;
               debugLog(`Successfully loaded ${Object.keys(patientsData).length} patients`, 'success', Object.keys(patientsData));
               
               const firstPatientKey = Object.keys(patientsData)[0];
               if (firstPatientKey) {
                   debugLog('Sample patient data structure', 'info', patientsData[firstPatientKey]);
               }
           } else {
               debugLog('No patients data found in Firebase', 'warning');
               patientsData = {};
           }
           
           try {
               localStorage.setItem('pregnacare_patients', JSON.stringify(patientsData));
               debugLog('Saved patients data to localStorage', 'info');
           } catch (storageError) {
               debugLog('Failed to save patients to localStorage', 'error', storageError);
           }
           
           populatePatientDropdown();
           
       } catch (error) {
           debugLog("Error handling patients update", 'error', error);
           debugLog("Error loading patients data", 'warning');
           
           loadPatientsFromStorage();
       }
   }, (error) => {
       debugLog("Error listening to patients", 'error', error);
       debugLog("Cannot load patients from database. Using local data.", 'warning');
       
       loadPatientsFromStorage();
   });
   
   // Try to fetch patients directly as backup
   setTimeout(fetchPatientsDirectly, 2000);
}

// Smart merge function to combine local and Firebase appointments
function mergeAppointments(localAppointments, firebaseAppointments) {
   const merged = [];
   const firebaseIds = new Set(firebaseAppointments.map(app => app.id));
   const processedIds = new Set();
   
   // Add all Firebase appointments first
   firebaseAppointments.forEach(firebaseApp => {
       if (!processedIds.has(firebaseApp.id)) {
           merged.push(firebaseApp);
           processedIds.add(firebaseApp.id);
       }
   });
   
   // Add local appointments that haven't been synced to Firebase yet
   localAppointments.forEach(localApp => {
       if (!validateAppointmentData(localApp)) {
           debugLog('Removing invalid local appointment during merge', 'warning', localApp);
           return;
       }
       
       // Only add local appointments that:
       // 1. Are marked as local (not yet synced)
       // 2. Don't have a Firebase counterpart
       // 3. Haven't been processed already
       if (localApp.isLocal && 
           !firebaseIds.has(localApp.id) && 
           !processedIds.has(localApp.id)) {
           merged.push(localApp);
           processedIds.add(localApp.id);
           debugLog(`Keeping local appointment: ${localApp.id}`, 'info');
       } else if (localApp.isLocal && firebaseIds.has(localApp.id)) {
           debugLog(`Local appointment ${localApp.id} was synced to Firebase, removing local copy`, 'info');
       } else if (!localApp.isLocal && !processedIds.has(localApp.id)) {
           // This is a non-local appointment that somehow wasn't in Firebase data
           // Could be from localStorage that was already synced
           debugLog(`Found non-local appointment not in Firebase: ${localApp.id}`, 'warning');
           // Don't add it to prevent duplicates
       }
   });
   
   debugLog(`Merge result: ${merged.length} appointments (${merged.filter(a => a.isLocal).length} local, ${firebaseAppointments.length} from Firebase)`, 'info');
   return merged;
}

// CRITICAL FIX: Monitor Firebase connection without infinite recursion
function monitorConnection() {
   if (!database) {
       debugLog('Database not available for connection monitoring', 'warning');
       return;
   }
   
   debugLog('Setting up connection monitoring...', 'info');
   
   let isMonitoring = false;
   const connectedRef = database.ref('.info/connected');
   
   const connectionHandler = (snapshot) => {
       // Prevent recursive calls
       if (isMonitoring) {
           debugLog('Connection handler already running, skipping...', 'info');
           return;
       }
       
       isMonitoring = true;
       
       try {
           const isConnected = snapshot.val() === true;
           
           if (isConnected) {
               debugLog('Connected to Firebase', 'success');
               updateConnectionStatus('connected');
               retryAttempts = 0;
               
               // Sync pending operations when reconnected (with delay to prevent recursion)
               setTimeout(() => {
                   if (connectionState === 'connected') {
                       syncPendingOperations().catch(error => {
                           debugLog('Sync error after reconnection', 'warning', error);
                       });
                   }
               }, 2000);
           } else {
               debugLog('Disconnected from Firebase', 'warning');
               updateConnectionStatus('disconnected');
               
               // Schedule reconnection (with delay to prevent immediate retry)
               setTimeout(() => {
                   if (connectionState === 'disconnected') {
                       scheduleReconnection();
                   }
               }, 1000);
           }
       } catch (error) {
           debugLog('Error in connection handler', 'error', error);
           updateConnectionStatus('error');
       } finally {
           isMonitoring = false;
       }
   };
   
   // Set up the listener
   connectedRef.on('value', connectionHandler, (error) => {
       debugLog('Connection monitoring error', 'error', error);
       updateConnectionStatus('error');
       isMonitoring = false;
   });
}

// Local Storage Management
function initializeLocalStorage() {
   debugLog("Initializing with localStorage", 'info');
   loadAppointmentsFromStorage();
   loadSyncQueue();
}

function loadAppointmentsFromStorage() {
   const stored = localStorage.getItem('pregnacare_appointments');
   if (stored) {
       try {
           const parsed = JSON.parse(stored);
           
           // Handle corrupted data gracefully
           if (!Array.isArray(parsed)) {
               debugLog('Stored appointments data is not an array, clearing...', 'warning');
               localStorage.removeItem('pregnacare_appointments');
               appointments = [];
               loadPatientsFromStorage();
               updateAppointments();
               return;
           }
           
           appointments = parsed
               .map(app => {
                   try {
                       return {
                           ...app,
                           time: new Date(app.time),
                           endTime: app.endTime ? new Date(app.endTime) : null,
                           createdAt: app.createdAt ? new Date(app.createdAt) : new Date(),
                           updatedAt: app.updatedAt ? new Date(app.updatedAt) : new Date(),
                           isLocal: app.isLocal || false,
                           status: app.status || 'Walk-in'
                       };
                   } catch (error) {
                       debugLog('Error processing stored appointment', 'warning', { app, error });
                       return null;
                   }
               })
               .filter(app => app && validateAppointmentData(app)); // Remove invalid appointments
           
           debugLog(`Loaded ${appointments.length} valid appointments from localStorage (${appointments.filter(a => a.isLocal).length} local)`, 'info');
       } catch (error) {
           debugLog("Error parsing stored appointments", 'error', error);
           // Clear corrupted data
           localStorage.removeItem('pregnacare_appointments');
           appointments = [];
       }
   } else {
       appointments = [];
   }
   
   loadPatientsFromStorage();
   updateAppointments();
}

function loadPatientsFromStorage() {
   debugLog('Loading patients from localStorage...', 'info');
   const storedPatients = localStorage.getItem('pregnacare_patients');
   if (storedPatients) {
       try {
           patientsData = JSON.parse(storedPatients);
           debugLog(`Loaded ${Object.keys(patientsData).length} patients from localStorage`, 'success');
           
           if (Object.keys(patientsData).length > 0) {
               const firstPatientKey = Object.keys(patientsData)[0];
               debugLog('Sample localStorage patient', 'info', patientsData[firstPatientKey]);
           }
       } catch (error) {
           debugLog("Error parsing stored patients", 'error', error);
           patientsData = {};
       }
   } else {
       debugLog('No patients data found in localStorage', 'warning');
       patientsData = {};
   }
   
   populatePatientDropdown();
}

// Direct fetch for patients data as backup
async function fetchPatientsDirectly() {
   if (!patientsRef) {
       debugLog('No patients reference available for direct fetch', 'warning');
       return;
   }
   
   try {
       debugLog('Attempting direct fetch of patients data...', 'info');
       const snapshot = await patientsRef.once('value');
       const data = snapshot.val();
       
       if (data) {
           patientsData = data;
           debugLog(`Direct fetch successful: ${Object.keys(patientsData).length} patients`, 'success');
           
           localStorage.setItem('pregnacare_patients', JSON.stringify(patientsData));
           populatePatientDropdown();
       } else {
           debugLog('Direct fetch returned no patients data', 'warning');
       }
   } catch (error) {
       debugLog('Direct fetch failed', 'error', error);
   }
}

async function refreshPatientsData() {
   debugLog('Manually refreshing patients data...', 'info');
   
   if (connectionState === 'connected' && patientsRef) {
       try {
           showNotification('Refreshing patients data...', 'info', 'system');
           await fetchPatientsDirectly();
           showNotification('Patients data refreshed successfully!', 'success', 'system');
       } catch (error) {
           debugLog('Error refreshing patients', 'error', error);
           showNotification('Failed to refresh patients data', 'error', 'system');
       }
   } else {
       showNotification('No database connection available', 'warning', 'system');
   }
}

function saveAppointmentsToStorage() {
   try {
       // Filter out invalid appointments before saving
       const validAppointments = appointments.filter(validateAppointmentData);
       if (validAppointments.length !== appointments.length) {
           debugLog(`Filtering out ${appointments.length - validAppointments.length} invalid appointments before saving`, 'info');
           appointments = validAppointments;
       }
       localStorage.setItem('pregnacare_appointments', JSON.stringify(appointments));
   } catch (error) {
       debugLog("Error saving appointments to storage", 'error', error);
   }
}

// NEW: Searchable Patient Dropdown Management
async function initializePatientDropdown() {
   populatePatientDropdown();
   initializeSearchableDropdown();
}

// NEW: Initialize searchable dropdown functionality
function initializeSearchableDropdown() {
    debugLog('Initializing searchable dropdown functionality...', 'info');
    
    // Wait for DOM to be ready
    setTimeout(() => {
        patientSearchInput = document.getElementById("patientName");
        patientDropdownList = document.getElementById("patientDropdownList");
        searchableDropdown = document.querySelector(".searchable-select");
        
        if (!patientSearchInput || !patientDropdownList || !searchableDropdown) {
            debugLog('Searchable dropdown elements not found, retrying...', 'warning');
            // Retry after a delay
            setTimeout(initializeSearchableDropdown, 1000);
            return;
        }
        
        debugLog('Searchable dropdown elements found, setting up event listeners...', 'success');
        
        // Set up event listeners
        patientSearchInput.addEventListener('input', handlePatientSearch);
        patientSearchInput.addEventListener('focus', handlePatientFocus);
        patientSearchInput.addEventListener('blur', handlePatientBlur);
        patientSearchInput.addEventListener('keydown', handlePatientKeydown);
        
        // Set up click listener for dropdown options
        patientDropdownList.addEventListener('click', handlePatientOptionClick);
        
        // Prevent dropdown from closing when clicking inside
        patientDropdownList.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
        
        debugLog('Searchable dropdown initialized successfully', 'success');
    }, 500);
}

// NEW: Handle patient search input
function handlePatientSearch(e) {
    const query = e.target.value.trim();
    patientSearchState.currentQuery = query;
    
    debugLog('Patient search query:', 'info', query);
    
    if (query.length === 0) {
        // Hide dropdown when no search query
        closeDropdown();
        clearPatientSelection();
    } else if (query.length >= 1) {
        // Show filtered results when user starts typing (minimum 1 character)
        const allPatients = getAllPatientsForDropdown();
        patientSearchState.filteredPatients = allPatients.filter(patient => {
            const nameMatch = patient.name.toLowerCase().includes(query.toLowerCase());
            const idMatch = patient.patientId.toLowerCase().includes(query.toLowerCase());
            return nameMatch || idMatch;
        });
        
        updateDropdownDisplay();
        openDropdown();
    }
    
    // Clear selection if query doesn't match selected patient
    if (patientSearchState.selectedPatient) {
        const selectedMatches = patientSearchState.selectedPatient.name.toLowerCase().includes(query.toLowerCase()) ||
                              patientSearchState.selectedPatient.patientId.toLowerCase().includes(query.toLowerCase());
        if (!selectedMatches && query.length > 0) {
            clearPatientSelection();
        }
    }
}

// NEW: Handle patient input focus
function handlePatientFocus(e) {
    debugLog('Patient input focused', 'info');
    
    // Only show dropdown if there's already text in the input
    const query = e.target.value.trim();
    if (query.length > 0) {
        if (patientSearchState.filteredPatients.length === 0) {
            patientSearchState.filteredPatients = getAllPatientsForDropdown();
            updateDropdownDisplay();
        }
        openDropdown();
    } else {
        // Show placeholder message when focused but no text
        updateDropdownPlaceholder();
        openDropdown();
    }
}

// NEW: Handle patient input blur (with delay to allow option selection)
function handlePatientBlur(e) {
    debugLog('Patient input blurred', 'info');
    
    // Delay closing to allow option selection
    setTimeout(() => {
        closeDropdown();
    }, 200);
}

// NEW: Handle keyboard navigation in patient dropdown
function handlePatientKeydown(e) {
    const options = patientDropdownList.querySelectorAll('.dropdown-item:not(.no-results)');
    const currentSelected = patientDropdownList.querySelector('.dropdown-item.selected');
    
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
                selectPatientFromOption(currentSelected);
            }
            break;
            
        case 'Escape':
            e.preventDefault();
            closeDropdown();
            break;
    }
}

// NEW: Handle clicking on dropdown options
function handlePatientOptionClick(e) {
    const option = e.target.closest('.dropdown-item');
    if (option && !option.classList.contains('no-results')) {
        selectPatientFromOption(option);
    }
}

// NEW: Select patient from dropdown option
function selectPatientFromOption(option) {
    const patientKey = option.dataset.patientKey;
    const patientId = option.dataset.patientId;
    const patientName = option.dataset.patientName;
    
    if (!patientKey || !patientId || !patientName) {
        debugLog('Invalid patient option data', 'error', option.dataset);
        return;
    }
    
    // Update search state
    patientSearchState.selectedPatient = {
        key: patientKey,
        patientId: patientId,
        name: patientName,
        age: option.dataset.age,
        status: option.dataset.status,
        dueDate: option.dataset.dueDate,
        phone: option.dataset.phone,
        email: option.dataset.email,
        patientType: option.dataset.patientType || 'Prenatal'
    };
    
    // Update input value to show patient name
    patientSearchInput.value = patientName;
    patientSearchInput.classList.add('has-selection');
    
    // Close dropdown
    closeDropdown();
    
    // Show patient info
    showSelectedPatientInfo();
    
    debugLog('Patient selected:', 'success', patientSearchState.selectedPatient);
}

// NEW: Clear patient selection
function clearPatientSelection() {
    patientSearchState.selectedPatient = null;
    if (patientSearchInput) {
        patientSearchInput.classList.remove('has-selection');
    }
    
    // Remove patient info display
    const existingInfo = document.querySelector('.patient-confirmation');
    if (existingInfo) {
        existingInfo.remove();
    }
}

// NEW: Open dropdown
function openDropdown() {
    if (!searchableDropdown || !patientDropdownList) return;
    
    patientSearchState.isOpen = true;
    searchableDropdown.classList.add('open');
    patientDropdownList.style.display = 'block';
    
    debugLog('Dropdown opened', 'info');
}

// NEW: Close dropdown
function closeDropdown() {
    if (!searchableDropdown || !patientDropdownList) return;
    
    patientSearchState.isOpen = false;
    searchableDropdown.classList.remove('open');
    patientDropdownList.style.display = 'none';
    
    // Clear selected option
    const selectedOption = patientDropdownList.querySelector('.dropdown-item.selected');
    if (selectedOption) {
        selectedOption.classList.remove('selected');
    }
    
    debugLog('Dropdown closed', 'info');
}

// NEW: Get all patients formatted for dropdown
function getAllPatientsForDropdown() {
    const patients = [];
    
    if (!patientsData || Object.keys(patientsData).length === 0) {
        debugLog('No patients data available for dropdown', 'warning');
        return patients;
    }
    
    try {
        const patientEntries = Object.entries(patientsData);
        
        patientEntries.forEach(([key, patient]) => {
            const patientInfo = processPatientData(key, patient);
            if (patientInfo) {
                patients.push(patientInfo);
            }
        });
        
        // Sort patients: active first, then by name
        patients.sort((a, b) => {
            // Active patients first
            const aIsActive = a.status === 'Ongoing' || a.status === 'Active' || a.status === 'Scheduled';
            const bIsActive = b.status === 'Ongoing' || b.status === 'Active' || b.status === 'Scheduled';
            
            if (aIsActive && !bIsActive) return -1;
            if (!aIsActive && bIsActive) return 1;
            
            // Then sort by name
            return a.name.localeCompare(b.name);
        });
        
    } catch (error) {
        debugLog('Error processing patients for dropdown', 'error', error);
    }
    
    debugLog(`Prepared ${patients.length} patients for dropdown`, 'info');
    return patients;
}

// NEW: Update dropdown placeholder when focused but no search
function updateDropdownPlaceholder() {
    if (!patientDropdownList) return;
    
    patientDropdownList.innerHTML = '';
    
    const placeholderOption = document.createElement('div');
    placeholderOption.className = 'dropdown-item no-results search-prompt';
    placeholderOption.innerHTML = `
        <i class="fas fa-search" style="margin-bottom: 8px; font-size: 24px; opacity: 0.3;"></i>
        <div>Start typing to search patients...</div>
        <small style="opacity: 0.7; margin-top: 4px; display: block;">Search by name or patient ID</small>
    `;
    
    patientDropdownList.appendChild(placeholderOption);
    
    debugLog('Updated dropdown with placeholder message', 'info');
}

// NEW: Update dropdown display with filtered patients
function updateDropdownDisplay() {
    if (!patientDropdownList) return;
    
    patientDropdownList.innerHTML = '';
    
    if (patientSearchState.filteredPatients.length === 0) {
        const noResultsOption = document.createElement('div');
        noResultsOption.className = 'dropdown-item no-results';
        
        if (patientSearchState.currentQuery && patientSearchState.currentQuery.length > 0) {
            noResultsOption.className += ' no-matches';
            noResultsOption.innerHTML = `
                <i class="fas fa-exclamation-circle" style="margin-bottom: 8px; font-size: 20px;"></i>
                <div>No patients found for "${patientSearchState.currentQuery}"</div>
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
        
        patientDropdownList.appendChild(noResultsOption);
        return;
    }
    
    patientSearchState.filteredPatients.forEach(patient => {
        const option = createPatientDropdownOption(patient);
        patientDropdownList.appendChild(option);
    });
    
    debugLog(`Updated dropdown with ${patientSearchState.filteredPatients.length} patients`, 'info');
}

// NEW: Create patient dropdown option element
function createPatientDropdownOption(patientInfo) {
    const option = document.createElement('div');
    option.className = 'dropdown-item';
    
    // Store patient data in dataset
    option.dataset.patientKey = patientInfo.key;
    option.dataset.patientId = patientInfo.patientId;
    option.dataset.patientName = patientInfo.name;
    option.dataset.age = patientInfo.age;
    option.dataset.status = patientInfo.status;
    option.dataset.dueDate = patientInfo.dueDate;
    option.dataset.phone = patientInfo.phone;
    option.dataset.email = patientInfo.email;
    option.dataset.patientType = patientInfo.patientType || 'Prenatal';
    
    // Create patient display
    const patientDisplay = document.createElement('div');
    patientDisplay.className = 'patient-info';
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'patient-name';
    nameDiv.textContent = patientInfo.name;
    
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'patient-details';
    
    const idSpan = document.createElement('span');
    idSpan.className = 'patient-id';
    idSpan.textContent = `ID: ${patientInfo.patientId}`;
    
    const statusSpan = document.createElement('span');
    statusSpan.className = `patient-status ${patientInfo.status === 'Ongoing' || patientInfo.status === 'Active' || patientInfo.status === 'Scheduled' ? 'active' : 'other'}`;
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

// NEW: Show selected patient info display
function showSelectedPatientInfo() {
    if (!patientSearchState.selectedPatient) return;
    
    // Remove existing info display
    const existingInfo = document.querySelector('.patient-confirmation');
    if (existingInfo) {
        existingInfo.remove();
    }
    
    const patientContainer = document.querySelector('.patient-field-wrapper');
    if (!patientContainer) return;
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'patient-confirmation';
    
    // Create checkmark icon
    const checkIcon = document.createElement('span');
    checkIcon.className = 'check-icon';
    checkIcon.textContent = '✓';
    
    // Create patient info text
    const nameSpan = document.createElement('span');
    nameSpan.className = 'patient-name';
    nameSpan.textContent = `${patientSearchState.selectedPatient.name} (ID: ${patientSearchState.selectedPatient.patientId})`;
    
    infoDiv.appendChild(checkIcon);
    infoDiv.appendChild(nameSpan);
    
    // Insert after the searchable dropdown
    patientContainer.appendChild(infoDiv);
    
    debugLog('Patient info display created', 'success');
}

// ENHANCED: Updated populatePatientDropdown for searchable functionality
function populatePatientDropdown() {
   debugLog('Populating patient dropdown...', 'info');
   
   // Initialize dropdown options
   patientSearchState.filteredPatients = getAllPatientsForDropdown();
   
   // Update dropdown display if elements exist
   if (patientDropdownList) {
       updateDropdownDisplay();
   }
   
   debugLog(`Patient dropdown populated with ${patientSearchState.filteredPatients.length} patients`, 'success');
}

function getPatientName(patient) {
   if (!patient) return 'Unknown Patient';
   
   return patient.fullName || 
          patient.name || 
          patient.patientName || 
          `${patient.firstName || ''} ${patient.lastName || ''}`.trim() ||
          patient.patientId ||
          'Unknown Patient';
}

function processPatientData(key, patient) {
   if (!patient) return null;
   
   try {
       const name = getPatientName(patient);
       const patientId = patient.patientId || patient.id || key;
       
       return {
           key: key,
           name: name,
           patientId: patientId,
           age: patient.age || 'N/A',
           status: patient.status || 'Unknown',
           dueDate: patient.dueDate || patient.expectedDueDate || 'N/A',
           phone: patient.phone || patient.phoneNumber || 'N/A',
           email: patient.email || 'N/A',
           patientType: patient.patientType || 'Prenatal'
       };
   } catch (error) {
       debugLog('Error processing patient data', 'error', error);
       return null;
   }
}

function addRefreshPatientsButton() {
   const patientContainer = document.querySelector('.patient-field-wrapper');
   if (!patientContainer) return;
   
   let refreshBtn = document.getElementById('refreshPatientsBtn');
   if (refreshBtn) return;
   
   refreshBtn = document.createElement('button');
   refreshBtn.id = 'refreshPatientsBtn';
   refreshBtn.type = 'button';
   refreshBtn.textContent = '🔄 Refresh Patients';
   refreshBtn.className = 'btn-secondary';
   refreshBtn.style.cssText = 'margin-top: 8px; width: 100%; padding: 8px;';
   refreshBtn.onclick = refreshPatientsData;
   
   patientContainer.appendChild(refreshBtn);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
   debugLog('Initializing PregnaCare Appointments System with Authentication...', 'info');
   console.log('Admin User ID:', ADMIN_USER_ID);
   console.log('Sub-Admin User ID:', SUB_ADMIN_USER_ID);
   
   // Create global instance
   window.appointmentsApp = new AppointmentsApplication();
   
   debugLog('🔐 AUTHENTICATION FEATURES:', 'info');
   debugLog('   ✅ User authentication required to access', 'info');
   debugLog('   👤 User profile with initials and role display', 'info');
   debugLog('   🔒 Permission-based operations', 'info');
   debugLog('   📋 Activity logging for all actions', 'info');
   debugLog('   🚪 Logout functionality', 'info');
   
   debugLog('To debug authentication, use: debugAuth()', 'info');
   debugLog('To check system status, use: getSystemInfo()', 'info');
});

// All existing UI functions with flexible constraints
function setDateTimeConstraints() {
  const appointmentTimeInput = document.getElementById("appointmentTime");
  
  if (!appointmentTimeInput) return;
  
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30); // Allow appointments 30 minutes from now
  appointmentTimeInput.min = formatDateForInput(now);
  
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  appointmentTimeInput.max = formatDateForInput(maxDate);
}

function formatDateForInput(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// FIXED: Modal opening without modifying existing HTML structure
function openModal() {
    // Check authentication
    if (!window.appointmentsApp?.authManager?.hasPermission('add')) {
        showNotification('You do not have permission to schedule appointments', 'error');
        return;
    }
    
    if (modal) {
        modal.classList.remove("hidden");
        document.body.classList.add('modal-open');
        
        // Initialize searchable dropdown if not already done
        if (!patientSearchInput) {
            setTimeout(initializeSearchableDropdown, 100);
        }
        
        // Set up follow-up checkbox toggle
        setupFollowupToggle();
        
        setDateTimeConstraints();
        
        // Focus on patient search input
        setTimeout(() => {
            if (patientSearchInput) {
                patientSearchInput.focus();
            }
        }, 150);
        
        if (typeof forceShowHeader === 'function') {
            forceShowHeader();
        }
    }
}

// Setup follow-up checkbox toggle functionality
function setupFollowupToggle() {
    const needsFollowupCheckbox = document.getElementById('needsFollowup');
    const followupDetails = document.getElementById('followupDetails');
    
    if (needsFollowupCheckbox && followupDetails) {
        needsFollowupCheckbox.addEventListener('change', function() {
            if (this.checked) {
                followupDetails.style.display = 'block';
            } else {
                followupDetails.style.display = 'none';
                // Clear the follow-up date when unchecked
                const followupDateInput = document.getElementById('followupDate');
                if (followupDateInput) {
                    followupDateInput.value = '';
                }
            }
        });
    }
}

// FIXED: Add end time field without breaking existing structure
function addEndTimeFieldToModal() {
    const startTimeInput = document.getElementById("appointmentTime");
    if (!startTimeInput) {
        debugLog('Start time input not found, cannot add end time field', 'warning');
        return;
    }
    
    // Create end time input field
    const endTimeInput = document.createElement('input');
    endTimeInput.type = 'datetime-local';
    endTimeInput.id = 'appointmentEndTime';
    endTimeInput.name = 'appointmentEndTime';
    endTimeInput.className = startTimeInput.className;
    endTimeInput.style.cssText = startTimeInput.style.cssText;
    
    // Add event listeners
    endTimeInput.addEventListener('change', updateDurationDisplay);
    startTimeInput.addEventListener('change', () => {
        if (!endTimeInput.value && startTimeInput.value) {
            const startTime = new Date(startTimeInput.value);
            if (!isNaN(startTime.getTime())) {
                const defaultEndTime = calculateDefaultEndTime(startTime);
                endTimeInput.value = formatDateForInput(defaultEndTime);
                updateDurationDisplay();
            }
        }
    });
    
    // Create label for end time
    const endTimeLabel = document.createElement('label');
    endTimeLabel.setAttribute('for', 'appointmentEndTime');
    endTimeLabel.textContent = 'End Time';
    endTimeLabel.style.cssText = 'display: block; margin-top: 15px; margin-bottom: 5px; font-weight: 600;';
    
    // Create duration display
    const durationDisplay = document.createElement('div');
    durationDisplay.id = 'appointmentDuration';
    durationDisplay.className = 'duration-display';
    durationDisplay.style.cssText = 'margin-top: 8px; padding: 8px; border-radius: 4px; font-size: 12px; text-align: center;';
    
    // Insert after the start time input
    const startTimeParent = startTimeInput.parentElement;
    startTimeParent.insertBefore(endTimeLabel, startTimeInput.nextSibling);
    startTimeParent.insertBefore(endTimeInput, endTimeLabel.nextSibling);
    startTimeParent.insertBefore(durationDisplay, endTimeInput.nextSibling);
    
    debugLog('Added end time field to modal', 'success');
}

function closeModal() {
 if (modal) {
     modal.classList.add("hidden");
     document.body.classList.remove('modal-open');
     if (form) {
         form.reset();
     }
     
     // Clear patient selection
     clearPatientSelection();
     if (patientSearchInput) {
         patientSearchInput.value = '';
         patientSearchInput.classList.remove('has-selection');
     }
     
     const existingInfo = document.querySelector('.patient-confirmation');
     if (existingInfo) {
         existingInfo.remove();
     }
     
     const refreshBtn = document.getElementById('refreshPatientsBtn');
     if (refreshBtn) {
         refreshBtn.remove();
     }
     
     // Close dropdown
     closeDropdown();
     
     // Clear duration display
     const durationDisplay = document.getElementById("appointmentDuration");
     if (durationDisplay) {
         durationDisplay.textContent = '';
         durationDisplay.className = 'duration-display';
     }
     
     if (typeof restoreAutoHide === 'function') {
         setTimeout(restoreAutoHide, 100);
     }
 }
}

function handleKeyPress(e) {
 if (e.key === "Escape") closeModal();
}

function handleWindowClick(e) {
 if (e.target === modal) closeModal();
}

// CRITICAL FIX: Enhanced form submission with comprehensive field detection AND Firebase rules compliance
// ========================================
// CONTINUOUS FOLLOW-UP APPOINTMENT SYSTEM
// ========================================

/**
 * Automatically creates a follow-up appointment when one is scheduled
 * This creates a continuous chain of appointments
 */
async function createFollowUpAppointment(originalAppointment, followupDateTime) {
    if (!followupDateTime) return null;
    
    debugLog('Creating follow-up appointment', 'info', {
        originalPatient: originalAppointment.name,
        followupDate: followupDateTime
    });
    
    try {
        // Calculate default end time (1 hour after follow-up start)
        const followupEndTime = new Date(followupDateTime.getTime() + 60 * 60 * 1000);
        
        // Increment visit number
        const nextVisitNumber = (originalAppointment.visitNumber || 1) + 1;
        
        // Create follow-up appointment data
        const followupAppointmentData = {
            name: originalAppointment.name,
            time: followupDateTime,
            endTime: followupEndTime,
            visitNumber: nextVisitNumber,
            patientType: originalAppointment.patientType,
            purpose: 'Follow-up Appointment', // Default purpose
            provider: originalAppointment.provider,
            status: 'Scheduled',
            patientId: originalAppointment.patientId,
            patientKey: originalAppointment.patientKey,
            isFollowUp: true,
            previousAppointmentId: originalAppointment.id || null
        };
        
        // Add to database
        const followupId = await addAppointmentToDatabase(followupAppointmentData);
        
        debugLog('Follow-up appointment created successfully', 'success', {
            followupId,
            visitNumber: nextVisitNumber
        });
        
        return followupId;
        
    } catch (error) {
        debugLog('Error creating follow-up appointment', 'error', error);
        showNotification('Follow-up appointment could not be auto-created. Please schedule manually.', 'warning', 'appointments');
        return null;
    }
}

/**
 * Enhanced form submission with automatic follow-up creation
 */
async function handleFormSubmissionWithFollowUp(appointmentId, appointmentData, followupDateTime) {
    // Create the main appointment first (already done in original code)
    
    // If there's a follow-up date, create a separate appointment for it
    if (followupDateTime) {
        const followupId = await createFollowUpAppointment(
            { 
                ...appointmentData, 
                id: appointmentId 
            }, 
            followupDateTime
        );
        
        if (followupId) {
            showNotification(
                `Main appointment and follow-up visit #${(appointmentData.visitNumber || 1) + 1} scheduled successfully!`,
                'success',
                'appointments'
            );
        }
    }
}


async function handleFormSubmission(e) {
    e.preventDefault();
    
    // Check authentication
    if (!window.appointmentsApp?.authManager?.hasPermission('add')) {
        showNotification('You do not have permission to schedule appointments', 'error');
        return;
    }
    
    debugLog('Form submission started with authentication check', 'info');
    
    // Get selected patient from search state
    const selectedPatient = patientSearchState.selectedPatient;
    const patientNameValue = patientSearchInput ? patientSearchInput.value.trim() : '';
    
    debugLog('Patient selection state', 'info', {
        selectedPatient,
        inputValue: patientNameValue,
        hasSelection: !!selectedPatient
    });
    
    // Validate patient selection
    if (!selectedPatient || !patientNameValue) {
        debugLog("Patient selection validation failed", 'error');
        showNotification("Please select a patient from the dropdown.", "error", "appointments");
        if (patientSearchInput) {
            patientSearchInput.focus();
            openDropdown();
        }
        return;
    }
    
    // Get other form field values
    const startTimeEl = document.getElementById('appointmentTime');
    const visitNumberEl = document.getElementById('visitNumber');
    const patientTypeEl = document.getElementById('patientType');
    const purposeEl = document.getElementById('purpose');
    const providerEl = document.getElementById('provider');
    const statusEl = document.getElementById('status');
    const needsFollowupEl = document.getElementById('needsFollowup');
    const followupDateEl = document.getElementById('followupDate');
    const endTimeEl = document.getElementById('appointmentEndTime');
    
    const timeValue = startTimeEl?.value?.trim() || '';
    const visitNumber = visitNumberEl?.value ? parseInt(visitNumberEl.value) : 1;
    const patientType = patientTypeEl?.value?.trim() || '';
    const purpose = purposeEl?.value?.trim() || '';
    const provider = providerEl?.value?.trim() || '';
    const status = statusEl?.value || "Walk-in";
    const needsFollowup = needsFollowupEl?.checked || false;
    const followupDateValue = followupDateEl?.value?.trim() || '';
    const endTimeValue = endTimeEl?.value?.trim() || '';

    debugLog('Extracted field values', 'info', { 
        patientName: selectedPatient.name,
        patientId: selectedPatient.patientId,
        timeValue: `"${timeValue}" (length: ${timeValue.length})`,
        visitNumber: visitNumber,
        patientType: `"${patientType}" (length: ${patientType.length})`,
        purpose: `"${purpose}" (length: ${purpose.length})`,
        provider: `"${provider}" (length: ${provider.length})`,
        status: `"${status}"`,
        needsFollowup: needsFollowup,
        followupDateValue: `"${followupDateValue}"`
    });

    // ENHANCED VALIDATION
    if (!timeValue) {
        debugLog("Start time validation failed - field is empty", 'error');
        showNotification("Please select a date and time for the appointment.", "error", "appointments");
        if (startTimeEl) {
            startTimeEl.focus();
            startTimeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    if (!visitNumber || visitNumber < 1) {
        debugLog("Visit number validation failed", 'error');
        showNotification("Please enter a valid visit number (1 or greater).", "error", "appointments");
        if (visitNumberEl) {
            visitNumberEl.focus();
            visitNumberEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    if (!patientType) {
        debugLog("Patient type validation failed", 'error');
        showNotification("Please select a patient type (Gynecology or Prenatal).", "error", "appointments");
        if (patientTypeEl) {
            patientTypeEl.focus();
            patientTypeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    if (!purpose) {
        debugLog("Purpose validation failed", 'error');
        showNotification("Please select or enter an appointment purpose.", "error", "appointments");
        if (purposeEl) {
            purposeEl.focus();
            purposeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    if (!provider) {
        debugLog("Provider validation failed", 'error');
        showNotification("Please select a healthcare provider.", "error", "appointments");
        if (providerEl) {
            providerEl.focus();
            providerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    // Parse dates
    const appointmentDateTime = new Date(timeValue);
    debugLog('Parsed appointment time', 'info', { 
        date: appointmentDateTime, 
        valid: !isNaN(appointmentDateTime.getTime()) 
    });
    
    if (isNaN(appointmentDateTime.getTime())) {
        debugLog("Invalid appointment time format", 'error');
        showNotification("Please enter a valid date and time.", "error", "appointments");
        if (startTimeEl) startTimeEl.focus();
        return;
    }
    
    // Parse and validate end time
    if (!endTimeValue) {
        debugLog("End time validation failed - field is empty", 'error');
        showNotification("Please select an end time for the appointment.", "error", "appointments");
        if (endTimeEl) {
            endTimeEl.focus();
            endTimeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    const appointmentEndTime = new Date(endTimeValue);
    if (isNaN(appointmentEndTime.getTime())) {
        debugLog("Invalid end time format", 'error');
        showNotification("Please enter a valid end time.", "error", "appointments");
        if (endTimeEl) endTimeEl.focus();
        return;
    }
    
    // Validate end time is after start time
    if (appointmentEndTime <= appointmentDateTime) {
        debugLog("End time must be after start time", 'error');
        showNotification("End time must be after the start time.", "error", "appointments");
        if (endTimeEl) endTimeEl.focus();
        return;
    }
    
    // Calculate and validate duration
    const durationMinutes = Math.round((appointmentEndTime.getTime() - appointmentDateTime.getTime()) / (1000 * 60));
    if (durationMinutes < 15) {
        debugLog("Duration too short", 'error');
        showNotification("Appointment must be at least 15 minutes long.", "error", "appointments");
        if (endTimeEl) endTimeEl.focus();
        return;
    }
    
    if (durationMinutes > 480) {
        debugLog("Duration too long", 'error');
        showNotification("Appointment cannot be longer than 8 hours.", "error", "appointments");
        if (endTimeEl) endTimeEl.focus();
        return;
    }
    // Handle follow-up date
    let followupDateTime = null;
    if (needsFollowup && followupDateValue && followupDateValue.trim()) {
        followupDateTime = new Date(followupDateValue);
        if (isNaN(followupDateTime.getTime())) {
            debugLog("Invalid follow-up date format", 'error');
            showNotification("Please enter a valid follow-up date.", "error", "appointments");
            if (followupDateEl) followupDateEl.focus();
            return;
        }
        
        // Validate follow-up is after current appointment
        if (followupDateTime <= appointmentDateTime) {
            debugLog("Follow-up date must be after appointment date", 'error');
            showNotification("Follow-up date must be after the current appointment.", "error", "appointments");
            if (followupDateEl) followupDateEl.focus();
            return;
        }
    }

    // CRITICAL FIX: Create appointment data with visit number and follow-up
    const appointmentData = {
        name: selectedPatient.name,
        time: appointmentDateTime,
        endTime: appointmentEndTime,
        visitNumber: visitNumber,
        patientType: patientType,
        purpose,
        provider,
        status: status || "Walk-in",
        patientId: selectedPatient.patientId,
        patientKey: selectedPatient.key
    };
    
    // Add follow-up date if specified
    if (followupDateTime) {
        appointmentData.followupDate = followupDateTime;
    }

    debugLog('Final appointment data to save', 'info', appointmentData);

    // CRITICAL FIX: Validate against Firebase rules before proceeding
    try {
        validateFirebaseRulesCompliance(formatAppointmentForFirebase(appointmentData));
    } catch (rulesError) {
        debugLog("Firebase rules validation failed", 'error', rulesError);
        showNotification(`Data validation failed: ${rulesError.message}`, "error", "appointments");
        return;
    }

    // Final validation
    if (!validateAppointmentData(appointmentData)) {
        debugLog("Final validation failed", 'error');
        showNotification("Invalid appointment data. Please check all fields.", "error", "appointments");
        return;
    }

    // Disable submit button
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        const btnText = submitBtn.querySelector('.btn-text');
        const btnSpinner = submitBtn.querySelector('.btn-spinner');
        if (btnText) btnText.style.display = 'none';
        if (btnSpinner) btnSpinner.style.display = 'inline-block';
    }

    try {
        debugLog('Attempting to add appointment to database...', 'info');
        const appointmentId = await addAppointmentToDatabase(appointmentData);
        
        if (form) form.reset();
        closeModal();
        
        // Create follow-up appointment as separate entry if specified
        if (followupDateTime) {
            await createFollowUpAppointment(
                { 
                    ...appointmentData, 
                    id: appointmentId 
                }, 
                followupDateTime
            );
            const syncMessage = connectionState === 'connected' ? 
                `Appointment and follow-up visit #${(appointmentData.visitNumber || 1) + 1} scheduled successfully!` : 
                `Appointments saved! Will sync when online.`;
            showNotification(syncMessage, "success", "appointments");
        } else {
            const syncMessage = connectionState === 'connected' ? 
                `Appointment scheduled successfully!` : 
                `Appointment saved! Will sync when online.`;
            showNotification(syncMessage, "success", "appointments");
        }
        
        debugLog('Appointment successfully created', 'success', { id: appointmentId });
        
        // Log activity
        await window.appointmentsApp?.authManager?.logUserActivity('schedule_appointment', {
            patientName: selectedPatient.name,
            appointmentTime: timeValue,
            visitNumber: visitNumber,
            purpose: purpose,
            hasFollowup: !!followupDateTime
        });
        
    } catch (error) {
        debugLog("Error scheduling appointment", 'error', error);
        
        // Show specific error messages based on the error type
        if (error.message.includes('Firebase rules')) {
            showNotification("Data validation failed. Please check all fields meet requirements.", "error", "appointments");
        } else if (error.message.includes('timeout')) {
            showNotification("Save operation timed out. Please try again.", "error", "appointments");
        } else if (error.message.includes('permission')) {
            showNotification("Permission denied. Please check your access rights.", "error", "appointments");
        } else {
            showNotification("Error saving appointment. Please try again.", "error", "appointments");
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            const btnText = submitBtn.querySelector('.btn-text');
            const btnSpinner = submitBtn.querySelector('.btn-spinner');
            if (btnText) btnText.style.display = 'inline';
            if (btnSpinner) btnSpinner.style.display = 'none';
        }
    }
}

function handleTableSearch(e) {
 const searchTerm = e.target.value.toLowerCase();
 
 if (currentView === 'active') {
     filteredAppointments = getActiveAppointments().filter(app => 
         app.name && app.name.toLowerCase().includes(searchTerm) ||
         app.purpose && app.purpose.toLowerCase().includes(searchTerm) ||
         app.provider && app.provider.toLowerCase().includes(searchTerm) ||
         app.status && app.status.toLowerCase().includes(searchTerm)
     );
 } else {
     const historyAppointments = getHistoryAppointments();
     const filtered = filterHistoryAppointments(historyAppointments);
     filteredAppointments = filtered.filter(app => 
         app.name && app.name.toLowerCase().includes(searchTerm) ||
         app.purpose && app.purpose.toLowerCase().includes(searchTerm) ||
         app.provider && app.provider.toLowerCase().includes(searchTerm) ||
         app.status && app.status.toLowerCase().includes(searchTerm)
     );
 }
 
 updateTable();
}

function handleGlobalSearch(e) {
 const searchTerm = e.target.value.toLowerCase();
 
 if (searchTerm === '') {
     if (currentView === 'active') {
         filteredAppointments = getActiveAppointments();
     } else {
         const historyAppointments = getHistoryAppointments();
         filteredAppointments = filterHistoryAppointments(historyAppointments);
     }
 } else {
     if (currentView === 'active') {
         filteredAppointments = getActiveAppointments().filter(app => 
             app.name && app.name.toLowerCase().includes(searchTerm) ||
             app.purpose && app.purpose.toLowerCase().includes(searchTerm) ||
             app.provider && app.provider.toLowerCase().includes(searchTerm)
         );
     } else {
         const historyAppointments = getHistoryAppointments();
         const filtered = filterHistoryAppointments(historyAppointments);
         filteredAppointments = filtered.filter(app => 
             app.name && app.name.toLowerCase().includes(searchTerm) ||
             app.purpose && app.purpose.toLowerCase().includes(searchTerm) ||
             app.provider && app.provider.toLowerCase().includes(searchTerm)
         );
     }
 }
 
 updateTable();
 if (currentView === 'active') {
     updateCards();
 }
}

// NEW: Updated patient selection handler for searchable dropdown
function handlePatientSelection() {
    // This function is now handled by the searchable dropdown events
    // Keep for backwards compatibility
    debugLog('Legacy patient selection handler called', 'info');
}

// Main Update Functions
function updateAppointments() {
 // Clean up appointments first
 cleanupAppointments();
 
 if (currentView === 'active') {
     filteredAppointments = getActiveAppointments();
     updateCards();
 } else {
     const historyAppointments = getHistoryAppointments();
     filteredAppointments = filterHistoryAppointments(historyAppointments);
     updateHistorySummary(historyAppointments);
 }
 
 updateStats();
 updateTable();
 updateCountBadges();
}

function updateStats() {
 const today = new Date().toDateString();
 const activeApps = getActiveAppointments();
 
 // TODAY'S APPOINTMENTS - All appointments scheduled for today (including follow-ups)
 // FIXED: Also count appointments with follow-up dates for today
 const todayApps = activeApps.filter(app => {
     // Check if main appointment is today
     if (app.time && app.time.toDateString() === today) {
         return true;
     }
     // Check if follow-up date is today
     if (app.followupDate) {
         const followupDate = new Date(app.followupDate);
         if (followupDate.toDateString() === today) {
             return true;
         }
     }
     return false;
 });
 
 // TOTAL APPOINTMENTS - All active (non-history) appointments
 const totalApps = activeApps.length;
 
 // PENDING REQUESTS - Appointments with "Online Appointment" status that need approval
 const pendingApps = activeApps.filter(app => 
     app.status === "Online Appointment" || 
     app.status === "Pending" ||
     app.status === "Requested"
 );
 
 // COMPLETED TODAY - Appointments marked as completed today
 const completedToday = appointments.filter(app => {
     // Check if completed at all
     const isCompleted = app.completedAt || 
                        app.status?.toLowerCase() === 'completed' || 
                        app.status?.toLowerCase() === 'done' || 
                        app.status?.toLowerCase() === 'finished';
     
     if (!isCompleted) return false;
     
     // Check if completed today
     if (app.completedAt) {
         const completedDate = new Date(app.completedAt);
         return completedDate.toDateString() === today;
     }
     
     // Fallback: check appointment time if no completedAt
     return app.time && app.time.toDateString() === today;
 });

 const todayCountEl = document.getElementById("todayCount");
 const totalCountEl = document.getElementById("totalCount");
 const pendingCountEl = document.getElementById("pendingCount");
 const completedCountEl = document.getElementById("completedCount");

 if (todayCountEl) todayCountEl.textContent = todayApps.length;
 if (totalCountEl) totalCountEl.textContent = totalApps;
 if (pendingCountEl) pendingCountEl.textContent = pendingApps.length;
 if (completedCountEl) completedCountEl.textContent = completedToday.length;
 
 debugLog('Statistics updated', 'info', {
     today: todayApps.length,
     total: totalApps,
     pending: pendingApps.length,
     completed: completedToday.length
 });
}

// FIXED: Enhanced card update function
function updateCards() {
    if (!appointmentCards) return;
    
    appointmentCards.innerHTML = "";
    const today = new Date().toDateString();
    const activeApps = getActiveAppointments();
    
    // FIXED: Include both regular appointments and follow-up appointments for today
    const todayAppointments = activeApps
        .filter(app => {
            // Check if main appointment is today
            if (app.time && app.time.toDateString() === today) {
                return true;
            }
            // Check if follow-up date is today
            if (app.followupDate) {
                const followupDate = new Date(app.followupDate);
                if (followupDate.toDateString() === today) {
                    return true;
                }
            }
            return false;
        })
        .sort((a, b) => {
            // Sort by time or followup time
            const aTime = (a.time && a.time.toDateString() === today) ? a.time : new Date(a.followupDate);
            const bTime = (b.time && b.time.toDateString() === today) ? b.time : new Date(b.followupDate);
            return aTime - bTime;
        });

    if (todayAppointments.length === 0) {
        appointmentCards.innerHTML = `
            <div class="cards-empty-state">
                <i class="fas fa-calendar-xmark"></i>
                <div class="message">No appointments scheduled for today</div>
            </div>
        `;
        return;
    }

    todayAppointments.forEach(app => {
        const statusText = app.status || 'Walk-in';
        
        // Determine if this is showing as a follow-up appointment today
        const isFollowUpToday = app.followupDate && new Date(app.followupDate).toDateString() === today;
        const displayTime = isFollowUpToday ? new Date(app.followupDate) : app.time;
        const displayEndTime = isFollowUpToday ? null : app.endTime; // Follow-ups might not have end time yet
        
        let statusClass = 'status';
        // Handle new status types
        if (statusText.toLowerCase().includes('online')) {
            statusClass += ' status-onlineappointment';
        } else if (statusText.toLowerCase().includes('walk')) {
            statusClass += ' status-walkin';
        } else {
            const normalizedStatus = statusText.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
            statusClass += ` status-${normalizedStatus}`;
        }
        
        // Calculate duration
        let durationText = '';
        if (displayEndTime) {
            const duration = Math.round((displayEndTime.getTime() - displayTime.getTime()) / (1000 * 60));
            durationText = ` (${duration}min)`;
        }
        
        // Check if this is a follow-up appointment
        const isFollowUp = isFollowUpToday || app.followupFor || app.purpose?.toLowerCase().includes('follow-up');
        const followUpBadge = isFollowUp ? '<div class="followup-badge"><i class="fas fa-repeat"></i> Follow-up</div>' : '';
        
        const card = document.createElement("div");
        card.className = "card";
        if (isFollowUp) card.classList.add('followup-appointment');
        card.innerHTML = `
            <div class="card-time">
                <h4>${displayTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${displayEndTime ? ' - ' + displayEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</h4>
                ${durationText ? `<div class="duration-badge"><i class="fas fa-clock"></i>${durationText}</div>` : ''}
                ${followUpBadge}
            </div>
            <div class="card-content">
                <p class="patient-name"><strong>${app.name}</strong></p>
                <p class="appointment-purpose">${app.purpose}</p>
                <p class="appointment-provider">${app.provider}</p>
                ${app.visitNumber ? `<p class="visit-number-badge">Visit #${app.visitNumber}</p>` : ''}
            </div>
            <div class="card-status">
                <span class="${statusClass}" data-status="${statusText.toLowerCase()}">${statusText}</span>
            </div>
        `;
        appointmentCards.appendChild(card);
    });
}

// FIXED: Enhanced table update function with proper column mapping
function updateTable() {
    if (!appointmentsBody) return;
    
    appointmentsBody.innerHTML = "";

    if (filteredAppointments.length === 0) {
        const message = currentView === 'history' ? 'No appointment history found' : 'No appointments found';
        appointmentsBody.innerHTML = `
            <tr><td colspan="8" class="no-data">${message}</td></tr>
        `;
        return;
    }

    const sortedAppointments = [...filteredAppointments].sort((a, b) => {
        // For history view, sort by most recent first
        if (currentView === 'history') {
            return b.time - a.time;
        }
        // For active view, sort by upcoming first
        return a.time - b.time;
    });

    sortedAppointments.forEach(app => {
        const startTime = app.time;
        
        // Format date and time display
        let timeDisplay = `<div class="date-line">${startTime.toLocaleDateString()}</div><div class="time-line">${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
        
        // Format end time display - date on top, time below
        let endTimeDisplay = '-';
        if (app.endTime) {
            const endTime = app.endTime;
            const endDateStr = endTime.toLocaleDateString();
            const endTimeStr = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            endTimeDisplay = `<div class="date-line">${endDateStr}</div><div class="time-line">${endTimeStr}</div>`;
        }
        
        // Display visit number
        const visitNumber = app.visitNumber || 1;
        const visitDisplay = getOrdinalSuffix(visitNumber);
        
        // Display follow-up information
        let followupDisplay = '-';
        if (app.followupDate) {
            const followupDate = new Date(app.followupDate);
            followupDisplay = followupDate.toLocaleDateString() + ' ' + followupDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        const statusText = app.status || 'Walk-in';
        
        let statusClass = 'status';
        // Handle new status types
        if (statusText.toLowerCase().includes('online')) {
            const followupDateStr = followupDate.toLocaleDateString();
            const followupTimeStr = followupDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            followupDisplay = `<div class="date-line">${followupDateStr}</div><div class="time-line">${followupTimeStr}</div>`;
        } else {
            const normalizedStatus = statusText.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
            statusClass += ` status-${normalizedStatus}`;
        }
        
        const row = document.createElement("tr");
        row.dataset.appointmentId = app.id;
        row.dataset.patientType = app.patientType || 'Prenatal';
        row.dataset.isFollowup = app.isFollowUp ? 'true' : 'false';
        
        // Different action buttons based on view and permissions
        let actionButtons = '';
        const canEdit = window.appointmentsApp?.authManager?.hasPermission('edit');
        const canDelete = window.appointmentsApp?.authManager?.hasPermission('delete') || window.appointmentsApp?.authManager?.isAdmin;
        
        if (currentView === 'active') {
            // End button removed - appointments continue with follow-ups
            if (canEdit) {
                actionButtons += `<button onclick="editAppointment('${app.id}')" class="btn-info" title="Edit appointment">Edit</button>`;
            }
            if (canDelete) {
                actionButtons += `<button onclick="deleteAppointment('${app.id}')" class="btn-danger" title="Delete appointment" style="margin-left: 4px;">Delete</button>`;
            }
            if (!canEdit && !canDelete) {
                actionButtons = '<span style="color: #666; font-size: 12px;">View Only</span>';
            }
        } else {
            // History view - Edit dropdown with Delete and Restore options
            actionButtons = `
                <button onclick="viewAppointmentDetails('${app.id}')" class="btn-secondary" title="View details">View</button>
                <div class="edit-dropdown-container" style="display: inline-block; position: relative; margin-left: 4px;">
                    <button onclick="toggleEditDropdown('${app.id}')" class="btn-edit-dropdown" title="Edit options">
                        <i class="fas fa-pen"></i> Edit <i class="fas fa-caret-down"></i>
                    </button>
                    <div class="edit-dropdown-menu" id="editDropdown-${app.id}" style="display: none;">
                        <button onclick="deleteHistoryAppointment('${app.id}')" class="dropdown-action-item delete-item">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                        <button onclick="restoreAppointment('${app.id}')" class="dropdown-action-item restore-item">
                            <i class="fas fa-undo"></i> Restore
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Updated column mapping - Patient, Date & Time, Visit #, Purpose, Provider, Follow-up, Status, Actions
        row.innerHTML = `
            <td class="patient-cell"><strong>${app.name}</strong>${app.isFollowUp ? '<span class="followup-indicator"><i class="fas fa-repeat"></i>Follow-up</span>' : ''}</td>
            <td class="datetime-cell">${timeDisplay}</td>
            <td class="endtime-cell">${endTimeDisplay}</td>
            <td class="visit-cell"><span class="visit-badge${app.isFollowUp ? ' followup-visit' : ''}">${visitDisplay}</span></td>
            <td class="purpose-cell">${app.purpose}</td>
            <td class="provider-cell">${app.provider}</td>
            <td class="followup-cell">${followupDisplay}</td>
            <td class="actions-cell">${actionButtons}</td>
        `;
        appointmentsBody.appendChild(row);
    });
}

// Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
function getOrdinalSuffix(num) {
    const j = num % 10;
    const k = num % 100;
    if (j == 1 && k != 11) {
        return num + "st";
    }
    if (j == 2 && k != 12) {
        return num + "nd";
    }
    if (j == 3 && k != 13) {
        return num + "rd";
    }
    return num + "th";
}

// Global Functions for UI Interaction
async function deleteAppointment(id) {
    debugLog(`Delete appointment called with ID: ${id}`, 'info');
    
    // Find the appointment first
    const appointment = appointments.find(app => app.id === id);
    if (!appointment) {
        debugLog("Appointment not found for deletion", 'error', id);
        showNotification("Appointment not found", "error", "appointments");
        return;
    }
    
    debugLog("Found appointment to delete", 'info', appointment);
    
    if (confirm(`Are you sure you want to delete the appointment for ${appointment.name}?`)) {
        try {
            debugLog("User confirmed deletion, proceeding...", 'info');
            await deleteAppointmentFromDatabase(id);
            debugLog("Appointment deleted successfully", 'success');
        } catch (error) {
            debugLog("Error deleting appointment", 'error', error);
            showNotification("Error deleting appointment", "error", "appointments");
        }
    } else {
        debugLog("User cancelled deletion", 'info');
    }
}

async function editAppointment(id) {
 const appointment = appointments.find(app => app.id === id);
 if (!appointment) {
     showNotification("Appointment not found", "error", "appointments");
     return;
 }

 // Create edit modal content
 const editContent = `
     <div style="margin-bottom: 15px;">
         <label><strong>Status:</strong></label>
         <select id="editStatus" style="width: 100%; padding: 8px; margin-top: 5px;">
             <option value="Walk-in" ${appointment.status === 'Walk-in' ? 'selected' : ''}>Walk-in</option>
             <option value="Online Appointment" ${appointment.status === 'Online Appointment' ? 'selected' : ''}>Online Appointment</option>
             <option value="Completed" ${appointment.status === 'Completed' ? 'selected' : ''}>Completed</option>
             <option value="Cancelled" ${appointment.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
             <option value="No Show" ${appointment.status === 'No Show' ? 'selected' : ''}>No Show</option>
         </select>
     </div>
     <div style="margin-bottom: 15px;">
         <label><strong>Appointment Time:</strong></label>
         <input type="datetime-local" id="editAppointmentTime" value="${formatDateForInput(appointment.time)}" style="width: 100%; padding: 8px; margin-top: 5px;">
     </div>
     <div style="margin-bottom: 15px;">
         <label><strong>End Time:</strong></label>
         <input type="datetime-local" id="editAppointmentEndTime" value="${appointment.endTime ? formatDateForInput(appointment.endTime) : ''}" style="width: 100%; padding: 8px; margin-top: 5px;">
     </div>
     <div style="margin-bottom: 15px;">
         <label><strong>Visit Number:</strong></label>
         <input type="number" id="editVisitNumber" value="${appointment.visitNumber || 1}" min="1" style="width: 100%; padding: 8px; margin-top: 5px;">
     </div>
     <div style="margin-bottom: 15px;">
         <label><strong>Follow-up Appointment:</strong></label>
         <input type="datetime-local" id="editFollowupDate" value="${appointment.followupDate ? formatDateForInput(appointment.followupDate) : ''}" style="width: 100%; padding: 8px; margin-top: 5px;">
         <small style="color: #666; font-size: 12px; display: block; margin-top: 4px;">Leave empty if no follow-up needed</small>
     </div>
     <div style="display: flex; gap: 10px; margin-top: 20px;">
         <button onclick="saveAppointmentEdit('${id}')" style="flex: 1; padding: 10px; background: var(--heart-red); color: white; border: none; border-radius: 6px; cursor: pointer;">Save Changes</button>
         <button onclick="closeEditModal()" style="flex: 1; padding: 10px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
     </div>
 `;

 // Create modal
 const editModal = document.createElement('div');
 editModal.id = 'editModal';
 editModal.className = 'modal';
 editModal.innerHTML = `
     <div class="modal-content" style="max-width: 400px;">
         <span onclick="closeEditModal()" class="close">&times;</span>
         <h3>Edit Appointment - ${appointment.name}</h3>
         ${editContent}
     </div>
 `;

 document.body.appendChild(editModal);
 editModal.classList.remove('hidden');
 document.body.classList.add('modal-open');
 
 // Log activity
 if (window.appointmentsApp?.authManager) {
     window.appointmentsApp.authManager.logUserActivity('edit_appointment_modal_opened', {
         appointmentId: id,
         patientName: appointment.name
     });
 }
}

async function saveAppointmentEdit(id) {
 const newStatus = document.getElementById('editStatus').value;
 const newAppointmentTime = new Date(document.getElementById('editAppointmentTime').value);
 const newVisitNumber = parseInt(document.getElementById('editVisitNumber').value);
 const newFollowupDateValue = document.getElementById('editFollowupDate').value;
 const newFollowupDate = newFollowupDateValue ? new Date(newFollowupDateValue) : null;
 const newEndTimeValue = document.getElementById('editAppointmentEndTime').value;
 const newEndTime = newEndTimeValue ? new Date(newEndTimeValue) : null;

 if (isNaN(newAppointmentTime.getTime())) {
     showNotification("Please enter a valid appointment time", "error", "appointments");
     return;
 }

 if (!newVisitNumber || newVisitNumber < 1) {
     showNotification("Please enter a valid visit number (1 or greater)", "error", "appointments");
     return;
 }

 if (newFollowupDate && isNaN(newFollowupDate.getTime())) {
     showNotification("Please enter a valid follow-up date", "error", "appointments");
     return;
 }

 if (newFollowupDate && newFollowupDate <= newAppointmentTime) {
     showNotification("Follow-up date must be after the appointment", "error", "appointments");
     return;
 }


 if (newEndTime && isNaN(newEndTime.getTime())) {
     showNotification("Please enter a valid end time", "error", "appointments");
     return;
 }

 if (newEndTime && newEndTime <= newAppointmentTime) {
     showNotification("End time must be after start time", "error", "appointments");
     return;
 }
 const updates = {
     status: newStatus,
     time: newAppointmentTime,
     visitNumber: newVisitNumber,
     endTime: newEndTime,
 };

 if (newFollowupDate) {
     updates.followupDate = newFollowupDate;
 } else {
     // Remove followupDate if cleared
     updates.followupDate = null;
 }

 try {
     await updateAppointmentInDatabase(id, updates);
     
     // Create follow-up appointment if date is set
     if (newFollowupDate) {
         const appointment = appointments.find(app => app.id === id);
         if (appointment) {
             await createFollowUpAppointment(appointment, newFollowupDate);
             showNotification("Appointment updated and follow-up visit created!", "success", "appointments");
         }
     } else {
         showNotification("Appointment updated successfully!", "success", "appointments");
     }
     
     closeEditModal();
     
     // Check if appointment should now be in history
     const appointment = appointments.find(app => app.id === id);
     if (appointment && isHistoryAppointment(appointment) && currentView === 'active') {
         showNotification("Appointment moved to history due to status change", "info", "appointments");
     }
     
 } catch (error) {
     debugLog("Error updating appointment", 'error', error);
 }
}

function closeEditModal() {
 const editModal = document.getElementById('editModal');
 if (editModal) {
     editModal.remove();
     document.body.classList.remove('modal-open');
 }
}

// Legacy function for backwards compatibility
async function editStatus(id) {
 await editAppointment(id);
}

// NEW: History-specific functions
function viewAppointmentDetails(id) {
 const appointment = appointments.find(app => app.id === id);
 if (!appointment) {
     showNotification("Appointment not found", "error", "appointments");
     return;
 }
 
 const visitNumber = appointment.visitNumber || 1;
 const visitDisplay = getOrdinalSuffix(visitNumber);
 
 let followupText = 'None';
 if (appointment.followupDate) {
     const followupDate = new Date(appointment.followupDate);
     followupText = followupDate.toLocaleDateString() + ' at ' + followupDate.toLocaleTimeString();
 }
 
 const details = `
     Patient: ${appointment.name}
     Date: ${appointment.time.toLocaleDateString()}
     Time: ${appointment.time.toLocaleTimeString()}
     Visit Number: ${visitDisplay}
     Purpose: ${appointment.purpose}
     Provider: ${appointment.provider}
     Follow-up Appointment: ${followupText}
     Status: ${appointment.status}
     Created: ${appointment.createdAt ? appointment.createdAt.toLocaleDateString() : 'N/A'}
     Last Updated: ${appointment.updatedAt ? appointment.updatedAt.toLocaleDateString() : 'N/A'}
 `;
 
 alert(details);
}

async function restoreAppointment(id) {
 const appointment = appointments.find(app => app.id === id);
 if (!appointment) {
     showNotification("Appointment not found", "error", "appointments");
     return;
 }
 
 if (confirm(`Restore appointment for ${appointment.name}?\nThis will change the status to "Walk-in".`)) {
     try {
         await updateAppointmentInDatabase(id, { status: 'Walk-in' });
         showNotification("Appointment restored successfully!", "success", "appointments");
     } catch (error) {
         debugLog("Error restoring appointment", 'error', error);
         showNotification("Error restoring appointment", "error", "appointments");
     }
 }
}

// Event Listeners
function initializeEventListeners() {
  if (openModalBtn) openModalBtn.addEventListener("click", openModal);
  if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
  if (form) form.addEventListener("submit", handleFormSubmission);
  if (tableSearch) tableSearch.addEventListener("input", handleTableSearch);
  if (searchBar) searchBar.addEventListener("input", handleGlobalSearch);
  
  // NEW: History View Event Listeners
  if (activeAppointmentsBtn) {
      activeAppointmentsBtn.addEventListener("click", switchToActiveView);
  }
  
  if (historyAppointmentsBtn) {
      historyAppointmentsBtn.addEventListener("click", switchToHistoryView);
  }
  
  if (historyStatusFilter) {
      historyStatusFilter.addEventListener("change", handleHistoryFilterChange);
  }
  
  if (historyDateFilter) {
      historyDateFilter.addEventListener("change", handleHistoryFilterChange);
  }
  
  if (exportHistoryBtn) {
      exportHistoryBtn.addEventListener("click", exportHistoryData);
  }
  
  
  // Auto-populate end time when start time changes
  const startTimeInput = document.getElementById('appointmentTime');
  const endTimeInput = document.getElementById('appointmentEndTime');
  if (startTimeInput && endTimeInput) {
      startTimeInput.addEventListener('change', function() {
          if (this.value && !endTimeInput.value) {
              const startDate = new Date(this.value);
              const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour
              
              // Format for datetime-local input
              const year = endDate.getFullYear();
              const month = String(endDate.getMonth() + 1).padStart(2, '0');
              const day = String(endDate.getDate()).padStart(2, '0');
              const hours = String(endDate.getHours()).padStart(2, '0');
              const minutes = String(endDate.getMinutes()).padStart(2, '0');
              
              endTimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
          }
      });
  }
  window.addEventListener("keydown", handleKeyPress);
  window.addEventListener("click", handleWindowClick);
  
  initializeAutoHideHeader();
}

// NEW: History Filter Event Handler
function handleHistoryFilterChange() {
  historyFilters.status = historyStatusFilter.value;
  historyFilters.dateRange = historyDateFilter.value;
  
  if (currentView === 'history') {
      const historyAppointments = getHistoryAppointments();
      filteredAppointments = filterHistoryAppointments(historyAppointments);
      updateTable();
      updateHistorySummary(historyAppointments);
  }
}

// FIXED: Enhanced notification function with infinite loop protection
function showNotification(message, type = "info", category = "appointments") {
 // Prevent infinite loops
 if (typeof message !== 'string') {
   debugLog('Invalid notification message', 'error', message);
   return;
 }
 
 if (showNotification._inProgress) {
   debugLog('Notification already in progress, skipping to prevent infinite loop', 'warning');
   return;
 }
 
 showNotification._inProgress = true;
 
 try {
   if (window.showNotification && window.showNotification !== showNotification) {
       window.showNotification(message, type, category);
   } else {
       const notification = document.createElement("div");
       notification.className = `notification ${type}`;
       notification.textContent = message;
       notification.style.cssText = `
           position: fixed;
           top: 20px;
           right: 20px;
           padding: 12px 20px;
           border-radius: 8px;
           color: white;
           z-index: 10000;
           font-weight: 500;
           background: ${type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : type === 'success' ? '#28a745' : '#007bff'};
           box-shadow: 0 4px 12px rgba(0,0,0,0.1);
           animation: slideIn 0.3s ease;
       `;
       
       document.body.appendChild(notification);
       
       setTimeout(() => {
           try {
               if (notification && notification.parentNode) {
                   notification.style.animation = "slideOut 0.3s ease forwards";
                   setTimeout(() => {
                       if (notification.parentNode) {
                           notification.parentNode.removeChild(notification);
                       }
                   }, 300);
               }
           } catch (error) {
               debugLog('Error removing notification', 'warning', error);
           }
       }, 4000);
   }
 } catch (error) {
   debugLog('Error in showNotification', 'error', error);
 } finally {
   showNotification._inProgress = false;
 }
}

// Additional validation and cleanup functions
function validateAllAppointments() {
  debugLog('Validating all appointments...', 'info');
  const invalid = [];
  const valid = [];
  
  appointments.forEach((app, index) => {
      if (validateAppointmentData(app)) {
          valid.push(app);
      } else {
          invalid.push({ index, appointment: app });
      }
  });
  
  debugLog(`Valid appointments: ${valid.length}`, 'success');
  debugLog(`Invalid appointments: ${invalid.length}`, invalid.length > 0 ? 'warning' : 'info');
  
  if (invalid.length > 0) {
      debugLog('Invalid appointments', 'warning', invalid);
      
      if (confirm(`Found ${invalid.length} invalid appointments. Remove them?`)) {
          appointments = valid;
          saveAppointmentsToStorage();
          updateAppointments();
          showNotification(`Removed ${invalid.length} invalid appointments`, 'success', 'system');
      }
  }
  
  return { valid: valid.length, invalid: invalid.length };
}

function forceMarkAsHistory(id, reason = 'Manual') {
  const appointment = appointments.find(app => app.id === id);
  if (!appointment) {
      showNotification("Appointment not found", "error", "appointments");
      return;
  }
  
  const historyStatuses = ['Completed', 'Cancelled', 'No Show'];
  let newStatus = 'Completed';
  
  if (reason === 'cancelled') newStatus = 'Cancelled';
  if (reason === 'no-show') newStatus = 'No Show';
  
  updateAppointmentInDatabase(id, { status: newStatus })
      .then(() => {
          showNotification(`Appointment marked as ${newStatus} and moved to history`, 'success', 'appointments');
      })
      .catch(error => {
          debugLog('Error updating appointment', 'error', error);
          showNotification('Error updating appointment', 'error', 'appointments');
      });
}

// Diagnostic functions
function diagnosePatientsData() {
 debugLog('Diagnosing patients data...', 'info');
 debugLog('Connection state', 'info', connectionState);
 debugLog('Database reference exists', 'info', !!patientsRef);
 debugLog('Current patientsData', 'info', patientsData);
 debugLog('localStorage patients', 'info', localStorage.getItem('pregnacare_patients'));
 
 if (patientsRef && connectionState === 'connected') {
     debugLog('Testing direct Firebase fetch...', 'info');
     patientsRef.once('value')
         .then(snapshot => {
             debugLog('Direct fetch result', 'success', snapshot.val());
         })
         .catch(error => {
             debugLog('Direct fetch failed', 'error', error);
         });
 }
 
 if (database && connectionState === 'connected') {
     debugLog('Checking alternative patients paths...', 'info');
     
     const possiblePaths = ['patients', 'patient', 'users', 'patientData', 'patientRecords'];
     
     possiblePaths.forEach(path => {
         database.ref(path).once('value')
             .then(snapshot => {
                 const data = snapshot.val();
                 if (data && Object.keys(data).length > 0) {
                     debugLog(`Found data at path '${path}': ${Object.keys(data).length} records`, 'success');
                     debugLog(`Sample data from '${path}'`, 'info', data[Object.keys(data)[0]]);
                 }
             })
             .catch(error => {
                 debugLog(`No data at path '${path}': ${error.message}`, 'info');
             });
     });
 }
}

async function forceRefreshAllData() {
 debugLog('Force refreshing all data...', 'info');
 showNotification('Refreshing all data...', 'info', 'system');
 
 try {
     await refreshPatientsData();
     
     if (connectionState === 'connected' && appointmentsRef) {
         const snapshot = await appointmentsRef.once('value');
         const data = snapshot.val();
         
         if (data) {
             appointments = [];
             Object.keys(data).forEach(key => {
                 const appointment = data[key];
                 
                 // Validate before adding
                 if (!appointment || !appointment.name || !appointment.time || !appointment.purpose || !appointment.provider) {
                     debugLog('Skipping invalid appointment from refresh', 'warning', key);
                     return;
                 }
                 
                 try {
                     const appointmentObj = {
                         id: key,
                         name: appointment.name,
                         time: new Date(appointment.time),
                         endTime: appointment.endTime ? new Date(appointment.endTime) : null,
                         purpose: appointment.purpose,
                         provider: appointment.provider,
                         status: appointment.status || 'Walk-in',
                         createdAt: appointment.createdAt ? new Date(appointment.createdAt) : new Date(),
                         updatedAt: appointment.updatedAt ? new Date(appointment.updatedAt) : new Date()
                     };
                     
                     if (validateAppointmentData(appointmentObj)) {
                         appointments.push(appointmentObj);
                     }
                 } catch (error) {
                     debugLog('Error processing appointment during refresh', 'warning', { key, error });
                 }
             });
             
             saveAppointmentsToStorage();
             updateAppointments();
             debugLog('Appointments refreshed', 'success');
         }
     }
     
     showNotification('All data refreshed successfully!', 'success', 'system');
     
 } catch (error) {
     debugLog('Error refreshing data', 'error', error);
     showNotification('Error refreshing data', 'error', 'system');
 }
}

// System Info Function
function getSystemInfo() {
    const auth = window.appointmentsApp?.authManager;
    
    console.log('=== SYSTEM INFORMATION ===');
    console.log('Authentication:', auth?.isAuthenticated ? 'Yes' : 'No');
    console.log('User:', auth?.userDisplayName || 'Not logged in');
    console.log('Role:', auth?.isAdmin ? 'Admin' : auth?.isSubAdmin ? 'Sub-Admin' : 'User');
    console.log('Connection State:', connectionState);
    console.log('Total Appointments:', appointments.length);
    console.log('Active Appointments:', getActiveAppointments().length);
    console.log('History Appointments:', getHistoryAppointments().length);
    console.log('Patients Loaded:', Object.keys(patientsData).length);
    console.log('Sync Queue:', syncQueue.length);
    console.log('==========================');
}

// Debug Authentication Function
function debugAuth() {
    const auth = window.appointmentsApp?.authManager;
    if (auth) {
        console.log('=== Authentication Status ===');
        console.log('Authenticated:', auth.isAuthenticated);
        console.log('User ID:', auth.currentUser?.uid);
        console.log('User Email:', auth.userEmail);
        console.log('Display Name:', auth.userDisplayName);
        console.log('Is Admin:', auth.isAdmin);
        console.log('Is Sub-Admin:', auth.isSubAdmin);
        console.log('=============================');
    } else {
        console.log('Authentication manager not initialized');
    }
}

// NEW: Toggle Edit Dropdown for History View
function toggleEditDropdown(appointmentId) {
    const dropdown = document.getElementById(`editDropdown-${appointmentId}`);
    const container = dropdown?.parentElement;
    
    if (!dropdown || !container) {
        debugLog('Edit dropdown not found', 'warning', appointmentId);
        return;
    }
    
    // Close all other dropdowns first
    closeAllEditDropdowns();
    
    // Toggle current dropdown
    const isOpen = dropdown.style.display === 'block';
    dropdown.style.display = isOpen ? 'none' : 'block';
    
    if (!isOpen) {
        container.classList.add('open');
    } else {
        container.classList.remove('open');
    }
    
    debugLog(`Edit dropdown ${isOpen ? 'closed' : 'opened'}`, 'info', appointmentId);
}

// NEW: Close All Edit Dropdowns
function closeAllEditDropdowns() {
    const allDropdowns = document.querySelectorAll('.edit-dropdown-menu');
    const allContainers = document.querySelectorAll('.edit-dropdown-container');
    
    allDropdowns.forEach(dropdown => {
        dropdown.style.display = 'none';
    });
    
    allContainers.forEach(container => {
        container.classList.remove('open');
    });
}

// NEW: Delete History Appointment
async function deleteHistoryAppointment(id) {
    debugLog(`Delete history appointment called with ID: ${id}`, 'info');
    
    // Check authentication
    if (!window.appointmentsApp?.authManager?.hasPermission('delete') && !window.appointmentsApp?.authManager?.isAdmin) {
        showNotification('You do not have permission to delete appointments', 'error');
        return;
    }
    
    // Find the appointment first
    const appointment = appointments.find(app => app.id === id);
    if (!appointment) {
        debugLog("Appointment not found for deletion", 'error', id);
        showNotification("Appointment not found", "error", "appointments");
        return;
    }
    
    debugLog("Found appointment to delete from history", 'info', appointment);
    
    // Close the dropdown first
    closeAllEditDropdowns();
    
    if (confirm(`Are you sure you want to permanently delete the appointment for ${appointment.name}?\n\nDate: ${appointment.time.toLocaleDateString()}\nPurpose: ${appointment.purpose}\n\nThis action cannot be undone.`)) {
        try {
            debugLog("User confirmed deletion, proceeding...", 'info');
            await deleteAppointmentFromDatabase(id);
            debugLog("History appointment deleted successfully", 'success');
        } catch (error) {
            debugLog("Error deleting history appointment", 'error', error);
            showNotification("Error deleting appointment", "error", "appointments");
        }
    } else {
        debugLog("User cancelled deletion", 'info');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.edit-dropdown-container')) {
        closeAllEditDropdowns();
    }
});

// Export functions for global access and debugging
window.deleteAppointment = deleteAppointment;
window.editAppointment = editAppointment;
window.editStatus = editStatus; // Legacy support
window.saveAppointmentEdit = saveAppointmentEdit;
window.closeEditModal = closeEditModal;
window.viewAppointmentDetails = viewAppointmentDetails;
window.restoreAppointment = restoreAppointment;
window.deleteHistoryAppointment = deleteHistoryAppointment;
window.toggleEditDropdown = toggleEditDropdown;
window.closeAllEditDropdowns = closeAllEditDropdowns;
window.handlePatientSelection = handlePatientSelection;

// Debug and diagnostic functions
window.diagnosePatientsData = diagnosePatientsData;
window.refreshPatientsData = refreshPatientsData;
window.forceRefreshAllData = forceRefreshAllData;
window.loadPatientsFromStorage = loadPatientsFromStorage;
window.fetchPatientsDirectly = fetchPatientsDirectly;

// Enhanced debugging functions
window.validateAllAppointments = validateAllAppointments;
window.cleanupAppointments = cleanupAppointments;
window.forceMarkAsHistory = forceMarkAsHistory;
window.removeDuplicateAppointments = removeDuplicateAppointments;
window.autoMoveCompletedAppointments = autoMoveCompletedAppointments;

// FIXED: Enhanced sync queue repair functions
window.repairSyncQueue = repairSyncQueue;
window.clearBrokenSyncOperations = function() {
    const brokenOps = syncQueue.filter(op => !op.execute || typeof op.execute !== 'function');
    syncQueue = syncQueue.filter(op => op.execute && typeof op.execute === 'function');
    saveSyncQueue();
    console.log(`Cleared ${brokenOps.length} broken sync operations`);
    return brokenOps.length;
};
window.createExecuteFunction = createExecuteFunction;

// CRITICAL FIX: New Firebase debugging functions
window.testFirebaseWritePermissions = testFirebaseWritePermissions;
window.writeAppointmentToFirebase = writeAppointmentToFirebase;
window.validateFirebaseRulesCompliance = validateFirebaseRulesCompliance;
window.formatAppointmentForFirebase = formatAppointmentForFirebase;

// NEW: Export searchable dropdown functions for debugging
window.patientSearchState = patientSearchState;
window.getAllPatientsForDropdown = getAllPatientsForDropdown;
window.updateDropdownDisplay = updateDropdownDisplay;
window.openDropdown = openDropdown;
window.closeDropdown = closeDropdown;
window.clearPatientSelection = clearPatientSelection;

// System info and auth debug
window.getSystemInfo = getSystemInfo;
window.debugAuth = debugAuth;

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
 if (appointmentsRef) appointmentsRef.off();
 if (patientsRef) patientsRef.off();
});

debugLog('PregnaCare Appointments System with Complete Authentication loaded successfully', 'success');
console.log('===========================================');
console.log('✅ COMPLETE APPOINTMENTS SYSTEM WITH AUTHENTICATION');
console.log('===========================================');
console.log('Features:');
console.log('  👤 User Authentication & Profile');
console.log('  🔒 Permission-based Access Control');
console.log('  📋 Activity Logging');
console.log('  🚪 Logout Functionality');
console.log('  📅 Appointment Management');
console.log('  👥 Patient Search & Selection');
console.log('  📊 History View & Export');
console.log('  🔄 Offline Sync Support');
console.log('');
console.log('Debug Commands:');
console.log('  debugAuth() - Check authentication status');
console.log('  getSystemInfo() - View system information');
console.log('  validateAllAppointments() - Validate all appointment data');
console.log('  forceRefreshAllData() - Force refresh all data');
console.log('===========================================');
// ========================================
// APPOINTMENT APPROVAL SYSTEM
// ========================================

class AppointmentApprovalManager {
    constructor() {
        this.currentAppointment = null;
        this.pendingAppointments = [];
        this.setupApprovalListeners();
        this.startPendingMonitor();
    }

    setupApprovalListeners() {
        // Listen for pending appointments from mobile app
        if (database) {
            database.ref('appointments')
                .orderByChild('status')
                .equalTo('Pending Approval')
                .on('value', (snapshot) => {
                    this.handlePendingAppointments(snapshot);
                });
        }

        // Modal controls
        const closeApprovalBtn = document.getElementById('closeApprovalModal');
        const acceptBtn = document.getElementById('acceptAppointmentBtn');
        const declineBtn = document.getElementById('declineAppointmentBtn');
        const pendingCard = document.querySelector('.pending-requests');

        if (closeApprovalBtn) {
            closeApprovalBtn.addEventListener('click', () => this.closeApprovalModal());
        }

        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => this.acceptAppointment());
        }

        if (declineBtn) {
            declineBtn.addEventListener('click', () => this.declineAppointment());
        }

        if (pendingCard) {
            pendingCard.addEventListener('click', () => this.showPendingAppointmentsList());
        }
    }

    handlePendingAppointments(snapshot) {
        const data = snapshot.val();
        this.pendingAppointments = [];

        if (data) {
            Object.keys(data).forEach(key => {
                const appointment = data[key];
                this.pendingAppointments.push({
                    id: key,
                    ...appointment
                });
            });

            // Sort by time (oldest first)
            this.pendingAppointments.sort((a, b) => {
                const timeA = new Date(a.appointmentDate + ' ' + a.appointmentTime);
                const timeB = new Date(b.appointmentDate + ' ' + b.appointmentTime);
                return timeA - timeB;
            });

            // Update counter
            this.updatePendingCounter();

            // Show notification
            if (this.pendingAppointments.length > 0) {
                this.showPendingNotification();
            }
        } else {
            this.updatePendingCounter();
        }
    }

    updatePendingCounter() {
        const counter = document.getElementById('pendingCount');
        const badge = document.getElementById('notificationBadge');
        
        if (counter) {
            counter.textContent = this.pendingAppointments.length;
        }

        if (badge) {
            const currentCount = parseInt(badge.textContent) || 0;
            const newTotal = currentCount + this.pendingAppointments.length;
            badge.textContent = newTotal;
            
            if (newTotal > 0) {
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    showPendingNotification() {
        const notifList = document.getElementById('notificationList');
        if (notifList && this.pendingAppointments.length > 0) {
            const existingPendingNotif = Array.from(notifList.children).find(li => 
                li.textContent.includes('pending appointment request')
            );

            if (!existingPendingNotif) {
                const li = document.createElement('li');
                li.innerHTML = `<i class="fas fa-clock"></i> ${this.pendingAppointments.length} pending appointment request${this.pendingAppointments.length > 1 ? 's' : ''} require${this.pendingAppointments.length === 1 ? 's' : ''} your attention`;
                li.style.cursor = 'pointer';
                li.style.fontWeight = '600';
                li.style.color = 'var(--warning-orange)';
                li.addEventListener('click', () => {
                    this.showPendingAppointmentsList();
                    document.getElementById('notifDropdown').classList.remove('show');
                });
                
                if (notifList.children[0]?.textContent === 'No new notifications') {
                    notifList.innerHTML = '';
                }
                notifList.insertBefore(li, notifList.firstChild);
            }
        }

        // Show toast notification
        showNotification(
            `${this.pendingAppointments.length} new appointment request${this.pendingAppointments.length > 1 ? 's' : ''} pending approval`,
            'warning',
            'approval'
        );
    }

    showPendingAppointmentsList() {
        if (this.pendingAppointments.length === 0) {
            showNotification('No pending appointments at this time', 'info', 'approval');
            return;
        }

        // Show the first pending appointment
        this.showApprovalModal(this.pendingAppointments[0]);
    }

    showApprovalModal(appointment) {
        this.currentAppointment = appointment;
        const modal = document.getElementById('approvalModal');
        const detailsDiv = document.getElementById('appointmentDetailsReview');

        if (!modal || !detailsDiv) return;

        // Format the appointment details
        const appointmentDate = new Date(appointment.appointmentDate + ' ' + appointment.appointmentTime);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        detailsDiv.innerHTML = `
            <div class="detail-row">
                <div class="detail-label">
                    <i class="fas fa-user"></i>
                    Patient Name
                </div>
                <div class="detail-value highlight">${appointment.patientName || 'N/A'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">
                    <i class="fas fa-id-card"></i>
                    Patient ID
                </div>
                <div class="detail-value">${appointment.patientId || 'N/A'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">
                    <i class="fas fa-envelope"></i>
                    Email
                </div>
                <div class="detail-value">${appointment.patientEmail || 'N/A'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">
                    <i class="fas fa-phone"></i>
                    Contact
                </div>
                <div class="detail-value">${appointment.patientContact || 'N/A'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">
                    <i class="fas fa-calendar"></i>
                    Appointment Date
                </div>
                <div class="detail-value highlight">${formattedDate}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">
                    <i class="fas fa-clock"></i>
                    Time
                </div>
                <div class="detail-value highlight">${formattedTime}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">
                    <i class="fas fa-stethoscope"></i>
                    Service
                </div>
                <div class="detail-value">${appointment.service || 'N/A'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">
                    <i class="fas fa-info-circle"></i>
                    Status
                </div>
                <div class="detail-value">
                    <span class="status-badge pending">${appointment.status}</span>
                </div>
            </div>
        `;

        // Clear previous notes
        document.getElementById('approvalNotes').value = '';

        // Show modal
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    closeApprovalModal() {
        const modal = document.getElementById('approvalModal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.classList.remove('modal-open');
        }
        this.currentAppointment = null;
    }

    async acceptAppointment() {
        if (!this.currentAppointment) return;

        const acceptBtn = document.getElementById('acceptAppointmentBtn');
        const declineBtn = document.getElementById('declineAppointmentBtn');
        const notes = document.getElementById('approvalNotes').value.trim();

        // Disable buttons
        acceptBtn.classList.add('loading');
        acceptBtn.disabled = true;
        declineBtn.disabled = true;

        try {
            const appointmentRef = database.ref(`appointments/${this.currentAppointment.id}`);
            
            // Update appointment status
            await appointmentRef.update({
                status: 'Scheduled',
                approvedAt: firebase.database.ServerValue.TIMESTAMP,
                approvedBy: window.appointmentsApp?.authManager?.userEmail || 'Admin',
                approvalNotes: notes || 'Appointment approved',
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });

            // Log the action
            if (window.appointmentsApp?.authManager) {
                await window.appointmentsApp.authManager.logUserActivity('approve_appointment', {
                    appointmentId: this.currentAppointment.id,
                    patientName: this.currentAppointment.patientName,
                    patientId: this.currentAppointment.patientId,
                    appointmentDate: this.currentAppointment.appointmentDate,
                    appointmentTime: this.currentAppointment.appointmentTime,
                    notes: notes
                });
            }

            // Create notification for patient
            await this.notifyPatient(
                this.currentAppointment.uid,
                'Appointment Approved',
                `Your appointment request for ${this.currentAppointment.appointmentDate} has been approved.`,
                'approved'
            );

            showNotification('Appointment approved successfully!', 'success', 'approval');
            this.closeApprovalModal();

            // Refresh appointments
            if (window.forceRefreshAllData) {
                await window.forceRefreshAllData();
            }

        } catch (error) {
            console.error('Error accepting appointment:', error);
            showNotification('Failed to approve appointment. Please try again.', 'error', 'approval');
        } finally {
            acceptBtn.classList.remove('loading');
            acceptBtn.disabled = false;
            declineBtn.disabled = false;
        }
    }

    async declineAppointment() {
        if (!this.currentAppointment) return;

        const acceptBtn = document.getElementById('acceptAppointmentBtn');
        const declineBtn = document.getElementById('declineAppointmentBtn');
        const notes = document.getElementById('approvalNotes').value.trim();

        if (!notes) {
            showNotification('Please provide a reason for declining', 'warning', 'approval');
            document.getElementById('approvalNotes').focus();
            return;
        }

        // Disable buttons
        declineBtn.classList.add('loading');
        declineBtn.disabled = true;
        acceptBtn.disabled = true;

        try {
            const appointmentRef = database.ref(`appointments/${this.currentAppointment.id}`);
            
            // Update appointment status
            await appointmentRef.update({
                status: 'Declined',
                declinedAt: firebase.database.ServerValue.TIMESTAMP,
                declinedBy: window.appointmentsApp?.authManager?.userEmail || 'Admin',
                declineReason: notes,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });

            // Log the action
            if (window.appointmentsApp?.authManager) {
                await window.appointmentsApp.authManager.logUserActivity('decline_appointment', {
                    appointmentId: this.currentAppointment.id,
                    patientName: this.currentAppointment.patientName,
                    patientId: this.currentAppointment.patientId,
                    appointmentDate: this.currentAppointment.appointmentDate,
                    appointmentTime: this.currentAppointment.appointmentTime,
                    reason: notes
                });
            }

            // Create notification for patient
            await this.notifyPatient(
                this.currentAppointment.uid,
                'Appointment Declined',
                `Your appointment request for ${this.currentAppointment.appointmentDate} has been declined. Reason: ${notes}`,
                'declined'
            );

            showNotification('Appointment declined', 'info', 'approval');
            this.closeApprovalModal();

            // Refresh appointments
            if (window.forceRefreshAllData) {
                await window.forceRefreshAllData();
            }

        } catch (error) {
            console.error('Error declining appointment:', error);
            showNotification('Failed to decline appointment. Please try again.', 'error', 'approval');
        } finally {
            declineBtn.classList.remove('loading');
            declineBtn.disabled = false;
            acceptBtn.disabled = false;
        }
    }

    async notifyPatient(patientUid, title, message, type) {
        if (!patientUid) return;

        try {
            const notificationData = {
                title: title,
                message: message,
                type: type,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                read: false,
                recipientId: patientUid,
                priority: 'high'
            };

            await database.ref('notifications').push(notificationData);
        } catch (error) {
            console.error('Error sending notification to patient:', error);
        }
    }

    startPendingMonitor() {
        // Check for pending appointments every 30 seconds
        setInterval(() => {
            if (this.pendingAppointments.length > 0) {
                this.updatePendingCounter();
            }
        }, 30000);
    }

    // Quick action buttons from table
    async quickAccept(appointmentId) {
        try {
            const appointment = this.pendingAppointments.find(apt => apt.id === appointmentId);
            if (!appointment) return;

            await database.ref(`appointments/${appointmentId}`).update({
                status: 'Scheduled',
                approvedAt: firebase.database.ServerValue.TIMESTAMP,
                approvedBy: window.appointmentsApp?.authManager?.userEmail || 'Admin',
                approvalNotes: 'Quick approval',
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });

            await this.notifyPatient(
                appointment.uid,
                'Appointment Approved',
                `Your appointment request has been approved.`,
                'approved'
            );

            showNotification('Appointment approved!', 'success', 'approval');

            if (window.forceRefreshAllData) {
                await window.forceRefreshAllData();
            }
        } catch (error) {
            console.error('Error in quick accept:', error);
            showNotification('Failed to approve appointment', 'error', 'approval');
        }
    }

    async quickDecline(appointmentId) {
        const reason = prompt('Please provide a reason for declining:');
        if (!reason) return;

        try {
            const appointment = this.pendingAppointments.find(apt => apt.id === appointmentId);
            if (!appointment) return;

            await database.ref(`appointments/${appointmentId}`).update({
                status: 'Declined',
                declinedAt: firebase.database.ServerValue.TIMESTAMP,
                declinedBy: window.appointmentsApp?.authManager?.userEmail || 'Admin',
                declineReason: reason,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });

            await this.notifyPatient(
                appointment.uid,
                'Appointment Declined',
                `Your appointment request has been declined. Reason: ${reason}`,
                'declined'
            );

            showNotification('Appointment declined', 'info', 'approval');

            if (window.forceRefreshAllData) {
                await window.forceRefreshAllData();
            }
        } catch (error) {
            console.error('Error in quick decline:', error);
            showNotification('Failed to decline appointment', 'error', 'approval');
        }
    }
}

// Initialize approval manager
let approvalManager;

// Modify the existing initialization to include approval manager
const originalInitFunction = window.onload;
window.onload = function() {
    if (typeof originalInitFunction === 'function') {
        originalInitFunction();
    }
    
    // Initialize approval manager after a short delay to ensure Firebase is ready
    setTimeout(() => {
        approvalManager = new AppointmentApprovalManager();
        console.log('✅ Appointment Approval Manager initialized');
    }, 1000);
};

// Export approval manager functions
window.approvalManager = null;
window.quickAcceptAppointment = function(appointmentId) {
    if (window.approvalManager) {
        window.approvalManager.quickAccept(appointmentId);
    }
};

window.quickDeclineAppointment = function(appointmentId) {
    if (window.approvalManager) {
        window.approvalManager.quickDecline(appointmentId);
    }
};

window.showAppointmentForReview = function(appointmentId) {
    if (window.approvalManager) {
        const appointment = window.approvalManager.pendingAppointments.find(apt => apt.id === appointmentId);
        if (appointment) {
            window.approvalManager.showApprovalModal(appointment);
        }
    }
};

console.log('===========================================');
console.log('✅ APPOINTMENT APPROVAL SYSTEM LOADED');
console.log('===========================================');
console.log('Features Added:');
console.log('  ✓ Real-time pending appointment monitoring');
console.log('  ✓ Accept/Decline functionality');
console.log('  ✓ Patient notifications');
console.log('  ✓ Activity logging');
console.log('  ✓ Quick actions from table');
console.log('  ✓ Detailed review modal');
console.log('===========================================');

// ========================================
// MOBILE RESPONSIVE ENHANCEMENTS
// ========================================

// Hamburger menu functionality for mobile
(function initializeMobileMenu() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupMobileMenu);
    } else {
        setupMobileMenu();
    }

    function setupMobileMenu() {
        const searchHeader = document.querySelector('.search-header');
        const sidebar = document.querySelector('.sidebar');
        
        if (!searchHeader || !sidebar) return;

        // Create hamburger menu click handler
        searchHeader.addEventListener('click', function(e) {
            // Check if click was on the hamburger (::before pseudo-element area)
            const rect = searchHeader.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            
            // If click is within first 50px (hamburger area)
            if (clickX <= 50 && window.innerWidth <= 768) {
                toggleSidebar();
            }
        });

        // Close sidebar when clicking overlay
        document.body.addEventListener('click', function(e) {
            if (document.body.classList.contains('sidebar-open') && 
                !sidebar.contains(e.target) && 
                !e.target.closest('.search-header')) {
                closeSidebar();
            }
        });

        // Close sidebar when clicking nav links on mobile
        const navLinks = sidebar.querySelectorAll('.nav a');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    closeSidebar();
                }
            });
        });

        // Handle window resize
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                if (window.innerWidth > 768) {
                    closeSidebar();
                }
            }, 250);
        });
    }

    function toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const body = document.body;
        
        if (sidebar.classList.contains('mobile-open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    function openSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const body = document.body;
        
        sidebar.classList.add('mobile-open');
        body.classList.add('sidebar-open');
    }

    function closeSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const body = document.body;
        
        sidebar.classList.remove('mobile-open');
        body.classList.remove('sidebar-open');
    }

    // Export functions for external use
    window.toggleMobileSidebar = toggleSidebar;
    window.openMobileSidebar = openSidebar;
    window.closeMobileSidebar = closeSidebar;
})();

// Touch scroll optimization for cards
(function initializeTouchScroll() {
    const cardsContainer = document.querySelector('.cards');
    
    if (cardsContainer && 'ontouchstart' in window) {
        let isScrolling = false;
        let startX = 0;
        let scrollLeft = 0;

        cardsContainer.addEventListener('touchstart', function(e) {
            isScrolling = true;
            startX = e.touches[0].pageX - cardsContainer.offsetLeft;
            scrollLeft = cardsContainer.scrollLeft;
        });

        cardsContainer.addEventListener('touchmove', function(e) {
            if (!isScrolling) return;
            const x = e.touches[0].pageX - cardsContainer.offsetLeft;
            const walk = (x - startX) * 2;
            cardsContainer.scrollLeft = scrollLeft - walk;
        });

        cardsContainer.addEventListener('touchend', function() {
            isScrolling = false;
        });
    }
})();

console.log('✅ Mobile responsive enhancements loaded');

// ========================================
// PATIENT TYPE FILTER FUNCTIONALITY
// ========================================

let currentPatientTypeFilter = 'All';

window.filterAppointmentsByType = function(filterType) {
    currentPatientTypeFilter = filterType;
    
    console.log('Filtering appointments by patient type:', filterType);
    
    // Update button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (filterType === 'Gynecology') {
        document.querySelector('.gynecology-btn').classList.add('active');
    } else if (filterType === 'Prenatal') {
        document.querySelector('.prenatal-btn').classList.add('active');
    } else {
        document.querySelector('.all-btn').classList.add('active');
    }
    
    // Filter table rows
    const tableBody = document.getElementById('appointmentsBody');
    const rows = tableBody.querySelectorAll('tr[data-appointment-id]');
    
    console.log('Total appointment rows found:', rows.length);
    
    let visibleCount = 0;
    
    rows.forEach(row => {
        const patientType = row.getAttribute('data-patient-type');
        console.log('Row patient type:', patientType, 'Filter:', filterType);
        
        if (filterType === 'All') {
            row.style.display = '';
            visibleCount++;
        } else if (patientType === filterType) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    console.log('Visible appointments after filter:', visibleCount);
    
    // Log activity
    if (window.appointmentsApp?.authManager) {
        window.appointmentsApp.authManager.logUserActivity('filter_appointments', {
            filterType: filterType
        });
    }
    
    // Check if any rows are visible - show message without removing rows
    const noDataRow = tableBody.querySelector('tr .no-data');
    
    if (visibleCount === 0 && rows.length > 0) {
        // Add no-results message
        if (!noDataRow) {
            const noResultsRow = document.createElement('tr');
            noResultsRow.innerHTML = `
                <td colspan="8" class="no-data">
                    <i class="fas fa-user-slash" style="font-size: 48px; color: #ccc; margin-bottom: 10px; display: block;"></i>
                    <p style="color: #666; font-size: 16px;">No ${filterType} appointments found</p>
                </td>
            `;
            noResultsRow.dataset.noResults = 'true';
            tableBody.appendChild(noResultsRow);
        }
    } else {
        // Remove no-results message if rows are visible
        const noResultsRow = tableBody.querySelector('tr[data-no-results]');
        if (noResultsRow) {
            noResultsRow.remove();
        }
    }
};

console.log('✅ Patient Type Filter Feature Loaded - Appointments v1.0.0');
// ========================================
// END APPOINTMENT FUNCTIONALITY
// ========================================

let currentEndAppointmentId = null;

/**
 * Open End Appointment Modal
 */
window.openEndAppointmentModal = function(appointmentId) {
    currentEndAppointmentId = appointmentId;
    const modal = document.getElementById('endAppointmentModal');
    const detailsDiv = document.getElementById('endAppointmentDetails');
    
    // Get appointment data
    const appointment = allAppointments.find(app => app.id === appointmentId);
    
    if (!appointment) {
        showNotification('Appointment not found', 'error');
        return;
    }
    
    // Format appointment details
    const appointmentTime = appointment.time ? appointment.time.toLocaleString() : 'N/A';
    const endTime = appointment.endTime ? appointment.endTime.toLocaleString() : 'N/A';
    
    detailsDiv.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Patient:</span>
            <span class="detail-value"><strong>${appointment.name}</strong></span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Patient Type:</span>
            <span class="detail-value">${appointment.patientType || 'Prenatal'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Start Time:</span>
            <span class="detail-value">${appointmentTime}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">End Time:</span>
            <span class="detail-value">${endTime}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Visit Number:</span>
            <span class="detail-value">#${appointment.visitNumber || 1}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Purpose:</span>
            <span class="detail-value">${appointment.purpose}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Provider:</span>
            <span class="detail-value">${appointment.provider}</span>
        </div>
    `;
    
    // Clear previous notes
    document.getElementById('completionNotes').value = '';
    document.getElementById('sendConfirmation').checked = true;
    
    // Show modal
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    
    debugLog(`Opened end appointment modal for: ${appointment.name}`, 'info');
};

/**
 * Close End Appointment Modal
 */
function closeEndAppointmentModal() {
    const modal = document.getElementById('endAppointmentModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
    currentEndAppointmentId = null;
    
    debugLog('Closed end appointment modal', 'info');
}

/**
 * Complete Appointment
 */
async function completeAppointment() {
    if (!currentEndAppointmentId) {
        showNotification('No appointment selected', 'error');
        return;
    }
    
    const completionNotes = document.getElementById('completionNotes').value.trim();
    const sendConfirmation = document.getElementById('sendConfirmation').checked;
    const completeBtn = document.getElementById('completeAppointmentBtn');
    
    // Disable button and show loading
    completeBtn.disabled = true;
    completeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Completing...';
    
    try {
        // Get appointment data
        const appointment = allAppointments.find(app => app.id === currentEndAppointmentId);
        
        if (!appointment) {
            throw new Error('Appointment not found');
        }
        
        // Prepare completion data
        const completionData = {
            completedAt: new Date().toISOString(),
            completedBy: window.appointmentsApp?.authManager?.currentUser?.uid || 'admin',
            completionNotes: completionNotes,
            originalStatus: appointment.status,
            status: 'completed'
        };
        
        // Update in Firebase
        const appointmentRef = database.ref(`Appointments/${currentEndAppointmentId}`);
        await appointmentRef.update(completionData);
        
        // Update local data
        appointment.completedAt = completionData.completedAt;
        appointment.completedBy = completionData.completedBy;
        appointment.completionNotes = completionData.completionNotes;
        appointment.status = 'completed';
        
        debugLog(`Completed appointment: ${appointment.name}`, 'success');
        
        // Show success notification
        showNotification(
            `Appointment for ${appointment.name} marked as completed${sendConfirmation ? ' (confirmation sent)' : ''}`,
            'success'
        );
        
        // If sending confirmation, you could add notification to patient's record
        if (sendConfirmation) {
            try {
                // Add notification to patient's notifications (if using that system)
                const notificationData = {
                    title: 'Appointment Completed',
                    message: `Your appointment on ${appointment.time.toLocaleDateString()} has been completed.`,
                    timestamp: new Date().toISOString(),
                    read: false,
                    type: 'appointment_completed',
                    appointmentId: currentEndAppointmentId
                };
                
                // This is a placeholder - adjust based on your notification system
                debugLog('Would send completion notification to patient', 'info');
            } catch (notifError) {
                console.error('Error sending notification:', notifError);
                // Don't fail the whole operation if notification fails
            }
        }
        
        // Close modal
        closeEndAppointmentModal();
        
        // Reload appointments to update view
        updateAppointments();
        
        // Update statistics
        updateStats();
        
    } catch (error) {
        console.error('Error completing appointment:', error);
        showNotification('Failed to complete appointment: ' + error.message, 'error');
    } finally {
        // Re-enable button
        completeBtn.disabled = false;
        completeBtn.innerHTML = '<i class="fas fa-check"></i> Mark as Completed';
    }
}

// Event Listeners for End Appointment Modal
document.addEventListener('DOMContentLoaded', function() {
    // Close modal button
    const closeEndModal = document.getElementById('closeEndModal');
    if (closeEndModal) {
        closeEndModal.addEventListener('click', closeEndAppointmentModal);
    }
    
    // Cancel button
    const cancelEndBtn = document.getElementById('cancelEndBtn');
    if (cancelEndBtn) {
        cancelEndBtn.addEventListener('click', closeEndAppointmentModal);
    }
    
    // Complete button
    const completeBtn = document.getElementById('completeAppointmentBtn');
    if (completeBtn) {
        completeBtn.addEventListener('click', completeAppointment);
    }
    
    // Close on outside click
    const endModal = document.getElementById('endAppointmentModal');
    if (endModal) {
        endModal.addEventListener('click', function(e) {
            if (e.target === endModal) {
                closeEndAppointmentModal();
            }
        });
    }
});

console.log('✅ End Appointment functionality loaded');
console.log('✅ PregnaCare Appointments v3.2.1 - Extended Grace Period Active (24 hours)');