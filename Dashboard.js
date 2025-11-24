// PregnaCare Dashboard - Complete JavaScript with Messages Feature
// Version: 9.0.0 - MESSAGES CARD UPDATE - FIXED

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
                this.isAuthenticated = true;
                
                await this.setUserDisplayName(user);
                
                console.log('User authenticated:', {
                    uid: user.uid,
                    email: user.email,
                    displayName: this.userDisplayName,
                    isAdmin: this.isAdmin
                });
                
                this.updateUserInterface();
                this.showAdminSectionIfAuthorized();
                this.logUserActivity('login');
                
                if (window.dashboardApp) {
                    window.dashboardApp.initialize();
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

            if (userData && userData.firstName) {
                this.userDisplayName = userData.firstName.trim();
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
            if (user.email) {
                const emailParts = user.email.split('@')[0];
                this.userDisplayName = emailParts
                    .replace(/[._-]/g, ' ')
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
            } else {
                this.userDisplayName = 'User';
            }
        }
    }

    updateUserInterface() {
        const sidebarUserInfo = document.querySelector('.user p');
        if (sidebarUserInfo) {
            sidebarUserInfo.textContent = this.userDisplayName;
        }
        
        const sidebarUserRole = document.querySelector('.user span');
        if (sidebarUserRole) {
            const role = this.isAdmin ? 'Admin' : 'Sub-Admin';
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
        
        const userNameElements = document.querySelectorAll('[data-user-name]');
        userNameElements.forEach(element => {
            element.textContent = this.userDisplayName;
        });
    }

    showAdminSectionIfAuthorized() {
        const adminSection = document.getElementById('adminSection');
        if (!adminSection) return;
        
        if (this.isAdmin) {
            adminSection.style.display = 'block';
            console.log('Admin section ENABLED for admin');
        } else {
            adminSection.style.display = 'none';
            console.log('Admin section HIDDEN');
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
                module: 'dashboard',
                details: details,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                isAdmin: this.isAdmin
            };
            
            await database.ref('activityLogs').push(activityLog);
            
            if (this.isAdmin) {
                await database.ref('adminActivityLogs').push({
                    ...activityLog,
                    adminAction: true
                });
            }
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
        if (this.isAdmin) return true;
        const allowedActions = ['view', 'read'];
        return allowedActions.includes(action);
    }
}

// ========================================
// DATA MANAGER
// ========================================

class DataManager {
    constructor(authManager) {
        this.authManager = authManager;
        this.data = {
            patients: {},
            appointments: {},
            labResults: {},
            medications: {},
            referrals: {}
        };
        this.listeners = {};
    }

    // Helper function to calculate gestational age in weeks from LMP
    calculateGestationalAge(lmpDate) {
        if (!lmpDate) return 0;
        
        const lmp = new Date(lmpDate);
        const today = new Date();
        const diffTime = Math.abs(today - lmp);
        const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
        
        return diffWeeks;
    }

    // Helper function to calculate trimester from gestational age
    calculateTrimester(gestationalWeeks) {
        if (gestationalWeeks <= 12) return 1;
        if (gestationalWeeks <= 27) return 2;
        if (gestationalWeeks <= 40) return 3;
        return 3; // After 40 weeks still consider as 3rd trimester
    }

    // Helper function to get trimester from patient data
    getPatientTrimester(patient) {
        // Check if gestational age is provided as a string (e.g., "16 weeks")
        if (patient.gestationalAge) {
            const weeks = parseInt(patient.gestationalAge);
            if (!isNaN(weeks)) {
                return this.calculateTrimester(weeks);
            }
        }

        // Calculate from LMP if available
        if (patient.lastMenstrualPeriod) {
            const weeks = this.calculateGestationalAge(patient.lastMenstrualPeriod);
            return this.calculateTrimester(weeks);
        }

        // Fallback: calculate from expected due date (work backwards)
        if (patient.expectedDueDate || patient.expectedDeliveryDate) {
            const dueDate = new Date(patient.expectedDueDate || patient.expectedDeliveryDate);
            const today = new Date();
            const diffTime = dueDate - today;
            const weeksRemaining = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
            const gestationalWeeks = 40 - weeksRemaining;
            
            if (gestationalWeeks > 0) {
                return this.calculateTrimester(gestationalWeeks);
            }
        }

        return 0; // Unknown
    }

    // Helper function to check if patient is high risk
    isHighRiskPatient(patient) {
        // Check for high-risk indicators in medical history or obstetric history
        const highRiskKeywords = [
            'high risk', 'hypertension', 'diabetes', 'preeclampsia', 
            'multiple gestation', 'twins', 'triplets', 'complications',
            'previous cesarean', 'previous loss', 'advanced maternal age'
        ];

        const medicalHistory = (patient.medicalHistory || '').toLowerCase();
        const obstetricHistory = (patient.obstetricHistory || '').toLowerCase();
        
        return highRiskKeywords.some(keyword => 
            medicalHistory.includes(keyword) || obstetricHistory.includes(keyword)
        );
    }

    async initialize() {
        if (!this.authManager.currentUser) return false;
        
        try {
            await this.setupFirebaseListeners();
            await this.loadInitialData();
            
            if (Object.keys(this.data.appointments).length === 0) {
                this.generateSampleData();
            }
            
            return true;
        } catch (error) {
            console.error('Data Manager error:', error);
            this.generateSampleData();
            return false;
        }
    }

    async setupFirebaseListeners() {
        const dataTypes = ['patients', 'appointments', 'labResults', 'medications'];
        
        for (const dataType of dataTypes) {
            this.listeners[dataType] = database.ref(dataType).on('value', 
                (snapshot) => {
                    this.data[dataType] = snapshot.val() || {};
                    this.notifyDataUpdate(dataType, this.data[dataType]);
                },
                (error) => {
                    console.error(`Error loading ${dataType}:`, error);
                }
            );
        }
    }

    async loadInitialData() {
        const dataTypes = ['patients', 'appointments', 'labResults', 'medications', 'referrals'];
        
        for (const dataType of dataTypes) {
            try {
                const snapshot = await database.ref(dataType).once('value');
                this.data[dataType] = snapshot.val() || {};
            } catch (error) {
                console.error(`Error loading ${dataType}:`, error);
            }
        }
    }

    generateSampleData() {
        const today = new Date();
        
        this.data.patients = {
            'PAT001': {
                patientId: 'PAT001',
                fullName: 'Sarah Johnson',
                age: 28,
                dueDate: '2025-03-15',
                registrationDate: new Date(2024, 8, 15).toISOString(), // Sept 2024
                status: 'active',
                trimester: 3,
                riskLevel: 'normal'
            },
            'PAT002': {
                patientId: 'PAT002',
                fullName: 'Emily Davis',
                age: 32,
                dueDate: '2025-02-28',
                registrationDate: new Date(2024, 9, 5).toISOString(), // Oct 2024
                status: 'active',
                trimester: 3,
                riskLevel: 'high'
            },
            'PAT003': {
                patientId: 'PAT003',
                fullName: 'Jessica Wilson',
                age: 25,
                dueDate: '2025-04-10',
                registrationDate: new Date(2024, 9, 20).toISOString(), // Oct 2024
                status: 'active',
                trimester: 2,
                riskLevel: 'normal'
            },
            'PAT004': {
                patientId: 'PAT004',
                fullName: 'Amanda Brown',
                age: 29,
                dueDate: '2025-05-20',
                registrationDate: new Date(2024, 10, 10).toISOString(), // Nov 2024
                status: 'active',
                trimester: 2,
                riskLevel: 'normal'
            },
            'PAT005': {
                patientId: 'PAT005',
                fullName: 'Jennifer Garcia',
                age: 26,
                dueDate: '2025-02-14',
                registrationDate: new Date(2024, 11, 3).toISOString(), // Dec 2024
                status: 'active',
                trimester: 3,
                riskLevel: 'high'
            },
            'PAT006': {
                patientId: 'PAT006',
                fullName: 'Maria Rodriguez',
                age: 30,
                dueDate: '2025-03-25',
                registrationDate: new Date(2025, 0, 15).toISOString(), // Jan 2025
                status: 'active',
                trimester: 2,
                riskLevel: 'normal'
            },
            'PAT007': {
                patientId: 'PAT007',
                fullName: 'Lisa Thompson',
                age: 27,
                dueDate: '2025-04-05',
                registrationDate: new Date(2025, 1, 8).toISOString(), // Feb 2025
                status: 'active',
                trimester: 2,
                riskLevel: 'normal'
            }
        };

        this.data.appointments = {};
        
        for (let i = 0; i < 50; i++) {
            const appointmentDate = new Date(today);
            appointmentDate.setDate(today.getDate() - 90 + Math.floor(Math.random() * 180));
            appointmentDate.setHours(9 + Math.floor(Math.random() * 8));
            appointmentDate.setMinutes([0, 15, 30, 45][Math.floor(Math.random() * 4)]);
            
            const patientKeys = Object.keys(this.data.patients);
            const patient = this.data.patients[patientKeys[Math.floor(Math.random() * patientKeys.length)]];
            
            this.data.appointments[`APT${String(i + 1).padStart(3, '0')}`] = {
                id: `APT${String(i + 1).padStart(3, '0')}`,
                patientName: patient.fullName,
                patientId: patient.patientId,
                date: appointmentDate.toISOString(),
                time: appointmentDate.toTimeString().slice(0, 5),
                type: ['Checkup', 'Ultrasound', 'Lab Work', 'Consultation'][Math.floor(Math.random() * 4)],
                status: appointmentDate < today ? 'Completed' : 'Scheduled',
                provider: 'Dr. Smith'
            };
        }
    }

    getDashboardStatistics() {
        const allPatients = Object.values(this.data.patients);
        
        // Filter for prenatal patients only (active pregnancies)
        const prenatalPatients = allPatients.filter(p => 
            p.patientType === 'Prenatal' && 
            (p.status === 'Ongoing' || p.status === 'active')
        );
        
        const appointments = Object.values(this.data.appointments);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayAppointments = appointments.filter(apt => {
            const aptDate = new Date(apt.date);
            aptDate.setHours(0, 0, 0, 0);
            return aptDate.getTime() === today.getTime();
        });

        // Calculate trimester counts for prenatal patients
        const trimesterCount = { 1: 0, 2: 0, 3: 0 };
        let highRiskCount = 0;
        let dueThisMonthCount = 0;

        prenatalPatients.forEach(patient => {
            // Calculate trimester using helper function
            const trimester = this.getPatientTrimester(patient);
            if (trimester > 0 && trimester <= 3) {
                trimesterCount[trimester]++;
            }

            // Check if high risk
            if (this.isHighRiskPatient(patient)) {
                highRiskCount++;
            }

            // Check if due this month
            const dueDate = new Date(patient.expectedDueDate || patient.expectedDeliveryDate);
            if (!isNaN(dueDate.getTime()) && dueDate.getMonth() === today.getMonth() && dueDate.getFullYear() === today.getFullYear()) {
                dueThisMonthCount++;
            }
        });

        const referrals = Object.values(this.data.referrals || {});
        
        return {
            patients: {
                total: allPatients.length,
                prenatalTotal: prenatalPatients.length,
                active: prenatalPatients.length,
                highRisk: highRiskCount,
                dueThisMonth: dueThisMonthCount,
                trimester1: trimesterCount[1],
                trimester2: trimesterCount[2],
                trimester3: trimesterCount[3]
            },
            appointments: {
                total: appointments.length,
                today: todayAppointments.length,
                completed: appointments.filter(a => a.status === 'Completed').length,
                scheduled: appointments.filter(a => a.status === 'Scheduled').length
            },
            referrals: {
                total: referrals.length,
                pending: referrals.filter(r => r.status === 'pending').length,
                accepted: referrals.filter(r => r.status === 'accepted').length,
                declined: referrals.filter(r => r.status === 'declined').length
            }
        };
    }

    getMonthlyAppointmentsData() {
        const appointments = Object.values(this.data.appointments);
        const patients = Object.values(this.data.patients);
        const monthlyData = {};
        const monthKeys = [];
        
        // Initialize last 6 months with 0 counts
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            date.setDate(1); // Set to first day to avoid month overflow issues
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyData[key] = 0;
            monthKeys.push(key);
        }
        
        // Count appointments per month
        appointments.forEach(appointment => {
            if (appointment && appointment.date) {
                const date = new Date(appointment.date);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (monthlyData.hasOwnProperty(key)) {
                    monthlyData[key]++;
                }
            }
        });
        
        // Count patient registrations as visits per month
        patients.forEach(patient => {
            if (patient && patient.registrationDate) {
                const date = new Date(patient.registrationDate);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (monthlyData.hasOwnProperty(key)) {
                    monthlyData[key]++;
                }
            } else if (patient && patient.createdAt) {
                // Fallback to createdAt if registrationDate not available
                const date = new Date(patient.createdAt);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (monthlyData.hasOwnProperty(key)) {
                    monthlyData[key]++;
                }
            } else if (patient && patient.dateAdded) {
                // Fallback to dateAdded if other dates not available
                const date = new Date(patient.dateAdded);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (monthlyData.hasOwnProperty(key)) {
                    monthlyData[key]++;
                }
            }
        });
        
        console.log('Monthly Data (Appointments + Patient Visits):', monthlyData);
        return monthlyData;
    }

    notifyDataUpdate(dataType, data) {
        if (this.onDataUpdate) {
            this.onDataUpdate(dataType, data);
        }
    }

    cleanup() {
        Object.keys(this.listeners).forEach(dataType => {
            database.ref(dataType).off('value', this.listeners[dataType]);
        });
    }
}

// ========================================
// NOTIFICATIONS MANAGER
// ========================================

class NotificationsManager {
    constructor(authManager, dataManager) {
        this.authManager = authManager;
        this.dataManager = dataManager;
        this.notifications = [];
        this.unreadCount = 0;
        this.notificationListeners = {};
        this.storageKey = 'pregnacare_notifications_read';
        this.readNotifications = this.loadReadNotifications();
    }

    initialize() {
        if (!this.authManager.isAuthenticated) return;
        
        console.log('🔔 Initializing Notifications Manager...');
        this.generateNotifications();
        this.updateNotificationBadge();
        this.renderNotifications();
        
        // Start monitoring for changes
        this.startNotificationMonitoring();
        
        console.log('✅ Notifications Manager initialized');
    }

    loadReadNotifications() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Error loading read notifications:', error);
            return {};
        }
    }

    saveReadNotifications() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.readNotifications));
        } catch (error) {
            console.error('Error saving read notifications:', error);
        }
    }

    startNotificationMonitoring() {
        // Check for new notifications every 30 seconds
        setInterval(() => {
            const previousCount = this.notifications.length;
            this.generateNotifications();
            this.updateNotificationBadge();
            
            const newCount = this.notifications.length;
            if (newCount > previousCount) {
                console.log(`🔔 ${newCount - previousCount} new notification(s)`);
            }
        }, 30000);

        // Also regenerate when dropdown is opened
        const notifIcon = document.getElementById('notifIcon');
        if (notifIcon) {
            notifIcon.addEventListener('click', () => {
                this.generateNotifications();
                this.renderNotifications();
            });
        }
    }

    generateNotifications() {
        this.notifications = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const now = new Date();

        // 1. TODAY'S APPOINTMENTS
        const appointments = Object.values(this.dataManager.data.appointments || {});
        const todayAppointments = appointments.filter(apt => {
            if (!apt.date) return false;
            const aptDate = new Date(apt.date);
            aptDate.setHours(0, 0, 0, 0);
            return aptDate.getTime() === today.getTime() && apt.status !== 'Completed' && apt.status !== 'Cancelled';
        });

        if (todayAppointments.length > 0) {
            const upcomingToday = todayAppointments.filter(apt => {
                const aptDateTime = new Date(apt.date);
                return aptDateTime > now;
            });

            this.notifications.push({
                id: 'today-appointments',
                type: 'appointment',
                icon: 'fa-calendar-check',
                title: `${todayAppointments.length} appointment${todayAppointments.length > 1 ? 's' : ''} scheduled today`,
                message: upcomingToday.length > 0 ? `${upcomingToday.length} upcoming` : 'All completed',
                timestamp: new Date().toISOString(),
                read: this.readNotifications['today-appointments'] || false,
                priority: 'high',
                color: '#f59e0b'
            });
        }

        // 2. NEW APPOINTMENTS (Last 24 hours)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const newAppointments = appointments.filter(apt => {
            if (!apt.createdAt && !apt.dateCreated) return false;
            const createdDate = new Date(apt.createdAt || apt.dateCreated);
            return createdDate >= yesterday && apt.status === 'Scheduled';
        });

        if (newAppointments.length > 0) {
            this.notifications.push({
                id: 'new-appointments',
                type: 'appointment',
                icon: 'fa-calendar-plus',
                title: `${newAppointments.length} new appointment${newAppointments.length > 1 ? 's' : ''} scheduled`,
                message: 'Added in last 24 hours',
                timestamp: new Date().toISOString(),
                read: this.readNotifications['new-appointments'] || false,
                priority: 'medium',
                color: '#3b82f6'
            });
        }

        // 3. LAB RESULTS READY
        const labResults = Object.values(this.dataManager.data.labResults || {});
        const pendingLabResults = labResults.filter(lab => 
            lab.status === 'Ready' || lab.status === 'Completed' || lab.status === 'Available'
        );

        if (pendingLabResults.length > 0) {
            this.notifications.push({
                id: 'lab-results-ready',
                type: 'lab',
                icon: 'fa-flask',
                title: `${pendingLabResults.length} lab result${pendingLabResults.length > 1 ? 's' : ''} ready`,
                message: 'Awaiting review',
                timestamp: new Date().toISOString(),
                read: this.readNotifications['lab-results-ready'] || false,
                priority: 'high',
                color: '#8b5cf6'
            });
        }

        // 4. PENDING LAB RESULTS
        const pendingLabs = labResults.filter(lab => 
            lab.status === 'Pending' || lab.status === 'In Progress' || lab.status === 'Processing'
        );

        if (pendingLabs.length > 0) {
            this.notifications.push({
                id: 'lab-results-pending',
                type: 'lab',
                icon: 'fa-hourglass-half',
                title: `${pendingLabs.length} lab test${pendingLabs.length > 1 ? 's' : ''} in progress`,
                message: 'Results pending',
                timestamp: new Date().toISOString(),
                read: this.readNotifications['lab-results-pending'] || false,
                priority: 'low',
                color: '#6b7280'
            });
        }

        // 5. HIGH-RISK PATIENTS
        const patients = Object.values(this.dataManager.data.patients || {});
        const highRiskPatients = patients.filter(p => 
            p.riskLevel === 'high' && p.status === 'active'
        );

        if (highRiskPatients.length > 0) {
            this.notifications.push({
                id: 'high-risk-patients',
                type: 'alert',
                icon: 'fa-exclamation-triangle',
                title: `${highRiskPatients.length} high-risk patient${highRiskPatients.length > 1 ? 's' : ''}`,
                message: 'Require attention',
                timestamp: new Date().toISOString(),
                read: this.readNotifications['high-risk-patients'] || false,
                priority: 'urgent',
                color: '#e63946'
            });
        }

        // 6. MEDICATION REFILLS (Next 7 days)
        const medications = Object.values(this.dataManager.data.medications || {});
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(today.getDate() + 7);
        
        const refillNeeded = medications.filter(med => {
            if (!med.refillDate && !med.nextRefillDate) return false;
            const refillDate = new Date(med.refillDate || med.nextRefillDate);
            refillDate.setHours(0, 0, 0, 0);
            return refillDate >= today && refillDate <= sevenDaysFromNow;
        });

        if (refillNeeded.length > 0) {
            const urgentRefills = refillNeeded.filter(med => {
                const refillDate = new Date(med.refillDate || med.nextRefillDate);
                const daysUntil = Math.ceil((refillDate - today) / (1000 * 60 * 60 * 24));
                return daysUntil <= 3;
            });

            this.notifications.push({
                id: 'medication-refills',
                type: 'medication',
                icon: 'fa-pills',
                title: `${refillNeeded.length} medication${refillNeeded.length > 1 ? 's need' : ' needs'} refill`,
                message: urgentRefills.length > 0 ? `${urgentRefills.length} urgent` : 'Within 7 days',
                timestamp: new Date().toISOString(),
                read: this.readNotifications['medication-refills'] || false,
                priority: urgentRefills.length > 0 ? 'high' : 'medium',
                color: urgentRefills.length > 0 ? '#f59e0b' : '#3b82f6'
            });
        }

        // 7. PATIENTS DUE SOON (Next 7 days)
        const patientsDueSoon = patients.filter(p => {
            if (!p.dueDate) return false;
            const dueDate = new Date(p.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate >= today && dueDate <= sevenDaysFromNow && p.status === 'active';
        });

        if (patientsDueSoon.length > 0) {
            const dueTomorrow = patientsDueSoon.filter(p => {
                const dueDate = new Date(p.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                return dueDate.getTime() === tomorrow.getTime();
            });

            this.notifications.push({
                id: 'patients-due-soon',
                type: 'delivery',
                icon: 'fa-baby',
                title: `${patientsDueSoon.length} patient${patientsDueSoon.length > 1 ? 's' : ''} due within 7 days`,
                message: dueTomorrow.length > 0 ? `${dueTomorrow.length} due tomorrow` : 'Monitor closely',
                timestamp: new Date().toISOString(),
                read: this.readNotifications['patients-due-soon'] || false,
                priority: 'high',
                color: '#f59e0b'
            });
        }

        // 8. PATIENTS DUE TODAY
        const patientsDueToday = patients.filter(p => {
            if (!p.dueDate) return false;
            const dueDate = new Date(p.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate.getTime() === today.getTime() && p.status === 'active';
        });

        if (patientsDueToday.length > 0) {
            this.notifications.push({
                id: 'patients-due-today',
                type: 'delivery',
                icon: 'fa-baby-carriage',
                title: `${patientsDueToday.length} patient${patientsDueToday.length > 1 ? 's' : ''} due TODAY`,
                message: 'Immediate attention required',
                timestamp: new Date().toISOString(),
                read: this.readNotifications['patients-due-today'] || false,
                priority: 'urgent',
                color: '#e63946'
            });
        }

        // 9. MISSED APPOINTMENTS (Last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        
        const missedAppointments = appointments.filter(apt => {
            if (!apt.date) return false;
            const aptDate = new Date(apt.date);
            return aptDate >= sevenDaysAgo && aptDate < now && 
                   apt.status === 'Scheduled' && aptDate < now;
        });

        if (missedAppointments.length > 0) {
            this.notifications.push({
                id: 'missed-appointments',
                type: 'appointment',
                icon: 'fa-calendar-times',
                title: `${missedAppointments.length} missed appointment${missedAppointments.length > 1 ? 's' : ''}`,
                message: 'Requires follow-up',
                timestamp: new Date().toISOString(),
                read: this.readNotifications['missed-appointments'] || false,
                priority: 'medium',
                color: '#f59e0b'
            });
        }

        // Sort by priority
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        this.notifications.sort((a, b) => {
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        // Calculate unread count
        this.unreadCount = this.notifications.filter(n => !n.read).length;
        
        console.log(`📊 Generated ${this.notifications.length} notifications (${this.unreadCount} unread)`);
    }

    updateNotificationBadge() {
        const badge = document.querySelector('#notifIcon .notification-badge');
        if (badge) {
            badge.textContent = this.unreadCount;
            badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
            
            // Add pulse animation for new notifications
            if (this.unreadCount > 0) {
                badge.style.animation = 'pulse 2s infinite';
            } else {
                badge.style.animation = 'none';
            }
        }
    }

    renderNotifications() {
        const notifDropdown = document.getElementById('notifDropdown');
        if (!notifDropdown) return;

        let notifList = notifDropdown.querySelector('ul');
        if (!notifList) {
            notifList = document.createElement('ul');
            notifDropdown.appendChild(notifList);
        }

        if (this.notifications.length === 0) {
            notifList.innerHTML = `
                <li style="text-align: center; padding: 30px 20px; color: #888; border: none;">
                    <i class="fas fa-check-circle" style="font-size: 20px; color: #10b981; margin-bottom: -2px; display: block;"></i>
                    <p style="margin: 0; font-weight: 300; color: #6b7280;">All caught up!</p>
                    <small style="color: #9ca3af; font-size: 12px; margin-bottom: -2px;">No new notifications</small>
                </li>
            `;
            return;
        }

        notifList.innerHTML = this.notifications.map(notif => {
            const timeAgo = this.getTimeAgo(notif.timestamp);
            
            return `
                <li onclick="handleNotificationClick('${notif.id}')" 
                    style="cursor: pointer; position: relative; padding: 14px 16px; border-bottom: 1px solid #f3f4f6; transition: all 0.2s; ${!notif.read ? 'background: linear-gradient(90deg, rgba(250, 49, 74, 0.05) 0%, rgba(250, 49, 74, 0.02) 100%); border-left: 3px solid ' + notif.color + ';' : 'border-left: 3px solid transparent;'}"
                    data-notification-id="${notif.id}"
                    onmouseover="this.style.background='rgba(250, 49, 74, 0.08)'; this.style.transform='translateX(5px)';"
                    onmouseout="this.style.background='${!notif.read ? 'linear-gradient(90deg, rgba(250, 49, 74, 0.05) 0%, rgba(250, 49, 74, 0.02) 100%)' : 'transparent'}'; this.style.transform='translateX(0)';">
                    <div style="display: flex; align-items: start; gap: 12px;">
                        <div style="width: 36px; height: 36px; border-radius: 8px; background: ${notif.color}15; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="fas ${notif.icon}" style="color: ${notif.color}; font-size: 16px;"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; font-size: 13px; color: #1f2937; margin-bottom: 4px; line-height: 1.4;">
                                ${notif.title}
                            </div>
                            <div style="font-size: 12px; color: #6b7280; line-height: 1.4; margin-bottom: 4px;">
                                ${notif.message}
                            </div>
                            <div style="font-size: 11px; color: #9ca3af; font-weight: 500;">
                                ${timeAgo}
                            </div>
                        </div>
                        ${!notif.read ? '<div style="width: 10px; height: 10px; background: ' + notif.color + '; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 8px ' + notif.color + '80;"></div>' : ''}
                    </div>
                </li>
            `;
        }).join('');
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification && !notification.read) {
            notification.read = true;
            this.readNotifications[notificationId] = true;
            this.saveReadNotifications();
            this.unreadCount = this.notifications.filter(n => !n.read).length;
            this.updateNotificationBadge();
            console.log(`✅ Notification '${notificationId}' marked as read`);
        }
    }

    markAllAsRead() {
        let marked = 0;
        this.notifications.forEach(n => {
            if (!n.read) {
                n.read = true;
                this.readNotifications[n.id] = true;
                marked++;
            }
        });
        
        if (marked > 0) {
            this.saveReadNotifications();
            this.unreadCount = 0;
            this.updateNotificationBadge();
            this.renderNotifications();
            console.log(`✅ Marked ${marked} notifications as read`);
            
            // Show success message
            if (window.dashboardApp) {
                window.dashboardApp.showNotification('All notifications marked as read', 'success');
            }
        }
    }

    handleNotificationAction(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (!notification) return;

        this.markAsRead(notificationId);
        this.renderNotifications();

        // Close dropdown
        const notifDropdown = document.getElementById('notifDropdown');
        if (notifDropdown) {
            notifDropdown.classList.remove('show');
        }

        // Route to appropriate page based on notification type
        setTimeout(() => {
            switch (notification.type) {
                case 'appointment':
                    window.location.href = 'Appointments.html';
                    break;
                case 'lab':
                    window.location.href = 'Lab Results.html';
                    break;
                case 'medication':
                    window.location.href = 'Prescriptions.html';
                    break;
                case 'alert':
                case 'delivery':
                    window.location.href = 'Patients.html';
                    break;
                default:
                    console.log('Unknown notification type');
            }
        }, 200);
    }

    clearAllNotifications() {
        this.notifications = [];
        this.readNotifications = {};
        this.unreadCount = 0;
        this.saveReadNotifications();
        this.updateNotificationBadge();
        this.renderNotifications();
        console.log('🗑️ All notifications cleared');
    }
}

class MessagesManager {
    constructor(authManager) {
        this.authManager = authManager;
        this.conversations = {};
        this.unreadCount = 0;
        this.totalCount = 0;
        this.messageListeners = {};
    }

    initialize() {
        if (!this.authManager.isAuthenticated) return;
        
        console.log('📨 Initializing Messages Manager...');
        this.startMessageCountMonitoring();
    }

    startMessageCountMonitoring() {
        if (!database || !this.authManager.currentUser) return;
        
        console.log('👁️ Starting message count monitoring...');
        
        database.ref('conversations')
            .on('value', snapshot => {
                let unread = 0;
                let total = 0;
                
                snapshot.forEach(childSnapshot => {
                    const conversation = childSnapshot.val();
                    
                    if (conversation && 
                        conversation.participants && 
                        conversation.participants[this.authManager.currentUser.uid]) {
                        
                        total++;
                        
                        if (conversation.lastMessage) {
                            const isUnread = conversation.lastMessage.senderId !== this.authManager.currentUser.uid && 
                                            (!conversation.lastReadBy || 
                                             !conversation.lastReadBy[this.authManager.currentUser.uid] ||
                                             conversation.lastReadBy[this.authManager.currentUser.uid] < conversation.lastMessage.timestamp);
                            
                            if (isUnread) {
                                unread++;
                            }
                        }
                    }
                });
                
                this.unreadCount = unread;
                this.totalCount = total;
                this.updateMessageBadges(unread);
                this.updateMessagesCard(total, unread);
            }, error => {
                console.warn('⚠️ Error monitoring message count:', error);
            });
    }

    updateMessageBadges(count) {
        const sidebarBadge = document.getElementById('sidebarMessageBadge');
        if (sidebarBadge) {
            sidebarBadge.textContent = count;
            sidebarBadge.style.display = count > 0 ? 'inline-block' : 'none';
        }
        
        console.log(`📊 Unread messages: ${count}`);
    }

    updateMessagesCard(total, unread) {
        const messagesCount = document.getElementById('messagesCount');
        const unreadMessagesCount = document.getElementById('unreadMessagesCount');
        
        if (messagesCount) {
            messagesCount.textContent = total;
        }
        
        if (unreadMessagesCount) {
            unreadMessagesCount.textContent = unread;
        }
        
        console.log(`📬 Total conversations: ${total}, Unread: ${unread}`);
    }

    cleanup() {
        if (!database) return;
        
        console.log('🧹 Cleaning up message listeners...');
        
        try {
            database.ref('conversations').off();
            database.ref('messages').off();
        } catch (error) {
            console.warn('⚠️ Error cleaning up message listeners:', error);
        }
    }
}

// ========================================
// MAIN DASHBOARD APPLICATION
// ========================================

class PregnaCareDashboard {
    constructor() {
        this.authManager = new AuthenticationManager();
        this.dataManager = new DataManager(this.authManager);
        this.notificationsManager = null; // Initialize after dataManager
        this.messagesManager = new MessagesManager(this.authManager);
        this.chart = null;
        this.isInitialized = false;
        this.activeDropdowns = new Set();
    }

    async initialize() {
        if (!this.authManager.isAuthenticated) {
            console.log('User not authenticated, waiting...');
            return;
        }
        
        await this.dataManager.initialize();
        
        // Initialize Notifications Manager after dataManager
        this.notificationsManager = new NotificationsManager(this.authManager, this.dataManager);
        this.notificationsManager.initialize();
        
        this.dataManager.onDataUpdate = (dataType, data) => {
            this.handleDataUpdate(dataType, data);
        };
        
        this.setupEventListeners();
        this.setupSidebarDropdown();
        this.updateAllDisplays();
        this.initializeChart();
        this.setupAutoHideNavbar();
        this.setupScrollProgress();
        
        // Initialize Messages Feature
        this.messagesManager.initialize();
        
        setTimeout(() => {
            this.authManager.showAdminSectionIfAuthorized();
        }, 100);
        
        this.isInitialized = true;
        console.log('Dashboard initialized successfully');
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
            
            const isShowing = sidebarDropdown.classList.contains('show');
            
            this.closeAllDropdowns();
            
            if (!isShowing) {
                sidebarDropdown.classList.add('show');
                sidebarUser.classList.add('active');
                this.activeDropdowns.add('sidebar');
                console.log('Sidebar dropdown shown');
            }
        });

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Logout button clicked');
                this.closeSidebarDropdown();
                
                if (this.authManager) {
                    await this.authManager.logout();
                } else {
                    if (confirm('Are you sure you want to logout?')) {
                        try {
                            await auth.signOut();
                            window.location.href = 'Admin login.html';
                        } catch (error) {
                            console.error('Logout error:', error);
                            window.location.href = 'Admin login.html';
                        }
                    }
                }
            });
        }

        document.addEventListener('click', (e) => {
            if (!sidebarUser.contains(e.target) && !sidebarDropdown.contains(e.target)) {
                this.closeSidebarDropdown();
            }
        });

        sidebarDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        console.log('Sidebar dropdown setup complete');
    }

    closeSidebarDropdown() {
        const sidebarUser = document.querySelector('.sidebar .user');
        const sidebarDropdown = document.querySelector('.sidebar .dropdown-menu');
        
        if (sidebarDropdown && sidebarUser) {
            sidebarDropdown.classList.remove('show');
            sidebarUser.classList.remove('active');
            this.activeDropdowns.delete('sidebar');
            console.log('Sidebar dropdown closed');
        }
    }

    closeAllDropdowns() {
        this.closeSidebarDropdown();
        
        const dropdowns = [
            { element: document.getElementById('notifDropdown'), name: 'notification' },
            { element: document.getElementById('helpDropdown'), name: 'help' }
        ];
        
        dropdowns.forEach(({ element, name }) => {
            if (element) {
                element.classList.remove('show');
                this.activeDropdowns.delete(name);
            }
        });
    }

    setupEventListeners() {
        const notifIcon = document.getElementById('notifIcon');
        const notifDropdown = document.getElementById('notifDropdown');
        
        if (notifIcon && notifDropdown) {
            notifIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const isShowing = notifDropdown.classList.contains('show');
                this.closeAllDropdowns();
                
                if (!isShowing) {
                    notifDropdown.classList.add('show');
                    this.activeDropdowns.add('notification');
                    
                    // Render notifications when dropdown opens
                    if (this.notificationsManager) {
                        this.notificationsManager.renderNotifications();
                    }
                }
            });
        }
        
        const helpIcon = document.getElementById('helpIcon');
        const helpDropdown = document.getElementById('helpDropdown');
        
        if (helpIcon && helpDropdown) {
            helpIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const isShowing = helpDropdown.classList.contains('show');
                this.closeAllDropdowns();
                
                if (!isShowing) {
                    helpDropdown.classList.add('show');
                    this.activeDropdowns.add('help');
                }
            });
        }
        
        document.addEventListener('click', (e) => {
            const clickedInsideDropdown = Array.from(this.activeDropdowns).some(dropdownType => {
                switch (dropdownType) {
                    case 'sidebar':
                        return document.querySelector('.sidebar .user')?.contains(e.target) || 
                               document.querySelector('.sidebar .dropdown-menu')?.contains(e.target);
                    case 'notification':
                        return notifIcon?.contains(e.target) || notifDropdown?.contains(e.target);
                    case 'help':
                        return helpIcon?.contains(e.target) || helpDropdown?.contains(e.target);
                    default:
                        return false;
                }
            });
            
            if (!clickedInsideDropdown) {
                this.closeAllDropdowns();
            }
        });
        
        const scrollToTop = document.getElementById('scrollToTop');
        if (scrollToTop) {
            scrollToTop.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            
            window.addEventListener('scroll', () => {
                if (window.pageYOffset > 300) {
                    scrollToTop.classList.add('visible');
                    scrollToTop.style.display = 'flex';
                } else {
                    scrollToTop.classList.remove('visible');
                    scrollToTop.style.display = 'none';
                }
            });
        }
        
        const timeFilter = document.getElementById('timeFilter');
        if (timeFilter) {
            timeFilter.addEventListener('change', () => {
                this.updateAllDisplays();
                console.log('Time filter changed to:', timeFilter.value);
            });
        }
    }

    setupAutoHideNavbar() {
        let lastScrollTop = 0;
        const searchHeader = document.querySelector('.search-header');
        
        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > lastScrollTop && scrollTop > 100) {
                searchHeader?.classList.add('header-hidden');
            } else {
                searchHeader?.classList.remove('header-hidden');
            }
            
            lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
        });
    }

    setupScrollProgress() {
        const scrollProgressBar = document.getElementById('scrollProgressBar');
        
        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrollProgress = (scrollTop / scrollHeight) * 100;
            
            if (scrollProgressBar) {
                scrollProgressBar.style.width = scrollProgress + '%';
                scrollProgressBar.style.background = 'linear-gradient(90deg, var(--heart-red), var(--deep-red))';
            }
        });
    }

    updateAllDisplays() {
        const stats = this.dataManager.getDashboardStatistics();
        
        this.updateElement('todayCount', stats.appointments.today);
        this.updateElement('totalCount', stats.appointments.total);
        this.updateElement('referralCount', stats.referrals.total);
        
        // Update referral trend
        const referralTrend = document.getElementById('referralTrend');
        if (referralTrend) {
            const pendingCount = stats.referrals.pending;
            if (pendingCount > 0) {
                referralTrend.innerHTML = `<span style="color: #f59e0b;">${pendingCount} pending</span>`;
            } else {
                referralTrend.textContent = 'For Hospital Delivery';
                referralTrend.className = 'card-trend';
            }
        }
        
        this.updatePregnancyTracker(stats.patients);
        this.updateRecentPatientsTable();
        this.updateTodaysScheduleTable();
        this.updateUpcomingDeliveries();
        
        const dateElement = document.querySelector('[data-current-date]');
        if (dateElement) {
            dateElement.textContent = new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    updatePregnancyTracker(patientStats) {
        const pregnancyStats = document.getElementById('pregnancyStats');
        if (pregnancyStats) {
            pregnancyStats.innerHTML = `
                <li>1st Trimester - <strong>${patientStats.trimester1}</strong> Patients</li>
                <li>2nd Trimester - <strong>${patientStats.trimester2}</strong> Patients</li>
                <li>3rd Trimester - <strong>${patientStats.trimester3}</strong> Patients</li>
                <li>High Risk - <strong>${patientStats.highRisk}</strong> Patients</li>
                <li>Due this month - <strong>${patientStats.dueThisMonth}</strong> Patients</li>
            `;
        }

        const trimesterBars = document.getElementById('trimesterBars');
        if (trimesterBars) {
            const total = patientStats.trimester1 + patientStats.trimester2 + patientStats.trimester3;
            const t1Percent = total > 0 ? (patientStats.trimester1 / total * 100) : 0;
            const t2Percent = total > 0 ? (patientStats.trimester2 / total * 100) : 0;
            const t3Percent = total > 0 ? (patientStats.trimester3 / total * 100) : 0;

            trimesterBars.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>1st Trimester</span>
                    <span>${t1Percent.toFixed(0)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress" style="width: ${t1Percent}%; background-color: #4caf50;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px; margin-top: 10px;">
                    <span>2nd Trimester</span>
                    <span>${t2Percent.toFixed(0)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress" style="width: ${t2Percent}%; background-color: #2196f3;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px; margin-top: 10px;">
                    <span>3rd Trimester</span>
                    <span>${t3Percent.toFixed(0)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress" style="width: ${t3Percent}%; background-color: #ff9800;"></div>
                </div>
            `;
        }

        this.updateElement('totalPatientCount', patientStats.total);
        this.updateElement('activePregnancyCount', patientStats.active);
        this.updateElement('completedPregnancyCount', patientStats.total - patientStats.active);
        
        const progressBar = document.getElementById('pregnancyProgress');
        if (progressBar) {
            const progressPercent = patientStats.total > 0 ? 
                ((patientStats.total - patientStats.active) / patientStats.total * 100) : 0;
            progressBar.style.width = `${progressPercent}%`;
        }
    }

    updateRecentPatientsTable() {
        const tbody = document.getElementById('recentPatientsTable');
        if (!tbody) return;

        // Get prenatal patients, sorted by most recent update
        const patients = Object.values(this.dataManager.data.patients)
            .filter(p => p.patientType === 'Prenatal')
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .slice(0, 5);
        
        if (patients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;"><i class="fas fa-user-slash" style="opacity: 0.3; font-size: 24px;"></i><br/><small style="color: #888;">No prenatal patients found</small></td></tr>';
            return;
        }

        tbody.innerHTML = patients.map(patient => {
            const isHighRisk = this.dataManager.isHighRiskPatient(patient);
            const lastVisitDate = patient.updatedAt ? new Date(patient.updatedAt).toLocaleDateString() : 'N/A';
            const dueDate = patient.expectedDueDate || patient.expectedDeliveryDate;
            
            return `
            <tr style="transition: background 0.2s;" onmouseover="this.style.background='#fef5f7'" onmouseout="this.style.background='white'">
                <td>
                    <div style="font-weight: 500;">${patient.fullName || 'Unknown'}</div>
                    <small style="color: #888;"><i class="fas fa-id-card" style="margin-right: 5px;"></i>${patient.patientId || 'N/A'}</small>
                </td>
                <td>
                    <span class="status-badge priority-${isHighRisk ? 'high' : 'normal'}" style="font-size: 11px;">
                        ${patient.status || 'Unknown'} ${isHighRisk ? '⚠️' : ''}
                    </span>
                </td>
                <td>
                    <div style="font-size: 13px;">${lastVisitDate}</div>
                    ${dueDate ? `<small style="color: #666;"><i class="fas fa-calendar-alt" style="margin-right: 5px;"></i>Due: ${new Date(dueDate).toLocaleDateString()}</small>` : ''}
                </td>
                <td>
                    <button class="action-btn" onclick="window.location.href='Patients.html'" title="View Patient Records" style="padding: 8px 12px; border-radius: 6px;">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
        }).join('');
    }

    updateTodaysScheduleTable() {
        const tbody = document.getElementById('todaysScheduleTable');
        if (!tbody) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayAppointments = Object.values(this.dataManager.data.appointments)
            .filter(apt => {
                const aptDate = new Date(apt.date);
                aptDate.setHours(0, 0, 0, 0);
                return aptDate.getTime() === today.getTime();
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 5);

        if (todayAppointments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No appointments today</td></tr>';
            return;
        }

        tbody.innerHTML = todayAppointments.map(apt => `
            <tr>
                <td>${apt.time}</td>
                <td>
                    <div>${apt.patientName}</div>
                    <small style="color: #666;">${apt.type}</small>
                </td>
                <td>
                    <span class="status-badge priority-normal">${apt.status}</span>
                </td>
            </tr>
        `).join('');
    }

    updateUpcomingDeliveries() {
        const deliveryList = document.getElementById('deliveryList');
        if (!deliveryList) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        thirtyDaysFromNow.setHours(23, 59, 59, 999);

        // Filter prenatal patients with upcoming deliveries
        const upcomingDeliveries = Object.values(this.dataManager.data.patients)
            .filter(patient => {
                // Only prenatal patients
                if (patient.patientType !== 'Prenatal') return false;
                if (patient.status !== 'Ongoing' && patient.status !== 'active') return false;
                
                // Get the expected due date
                const dueDateStr = patient.expectedDueDate || patient.expectedDeliveryDate;
                if (!dueDateStr) return false;
                
                const dueDate = new Date(dueDateStr);
                if (isNaN(dueDate.getTime())) return false;
                
                return dueDate >= today && dueDate <= thirtyDaysFromNow;
            })
            .sort((a, b) => {
                const dateA = new Date(a.expectedDueDate || a.expectedDeliveryDate);
                const dateB = new Date(b.expectedDueDate || b.expectedDeliveryDate);
                return dateA - dateB;
            })
            .slice(0, 10); // Show up to 10 upcoming deliveries

        if (upcomingDeliveries.length === 0) {
            deliveryList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><i class="fas fa-calendar-check" style="font-size: 48px; opacity: 0.3; margin-bottom: 10px;"></i><br/>No deliveries in the next 30 days</div>';
            return;
        }

        // Update referral card counts
        const dueThisWeekCount = upcomingDeliveries.filter(patient => {
            const dueDate = new Date(patient.expectedDueDate || patient.expectedDeliveryDate);
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(today.getDate() + 7);
            return dueDate <= sevenDaysFromNow;
        }).length;

        // Update the referral form card stats
        this.updateElement('dueThisWeekCount', dueThisWeekCount);
        this.updateElement('readyForReferralCount', upcomingDeliveries.length);
        this.updateElement('highRiskCount', upcomingDeliveries.filter(p => this.dataManager.isHighRiskPatient(p)).length);

        deliveryList.innerHTML = upcomingDeliveries.map(patient => {
            const dueDate = new Date(patient.expectedDueDate || patient.expectedDeliveryDate);
            const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            const isHighRisk = this.dataManager.isHighRiskPatient(patient);
            const trimester = this.dataManager.getPatientTrimester(patient);
            
            return `
                <div class="delivery-item" style="padding: 15px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;" onmouseover="this.style.background='#fef5f7'" onmouseout="this.style.background='white'">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #333; display: flex; align-items: center; gap: 8px;">
                            ${patient.fullName || 'Unknown Patient'}
                            ${isHighRisk ? '<span style="background: #ff4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: bold;">HIGH RISK</span>' : ''}
                        </div>
                        <small style="color: #888;">
                            <i class="fas fa-id-card" style="margin-right: 5px;"></i>ID: ${patient.patientId || 'N/A'}
                            <span style="margin-left: 15px;"><i class="fas fa-calendar" style="margin-right: 5px;"></i>Trimester ${trimester}</span>
                        </small>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: ${daysUntil <= 7 ? '#e63946' : daysUntil <= 14 ? '#ff9800' : '#666'}; font-weight: 600; font-size: 16px;">
                            ${daysUntil === 0 ? '🚨 Due Today!' : daysUntil === 1 ? '⚠️ Tomorrow' : `${daysUntil} days`}
                        </div>
                        <small>${dueDate.toLocaleDateString()}</small>
                    </div>
                </div>
            `;
        }).join('');
    }

    initializeChart() {
        const ctx = document.getElementById('monthlyVisitsChart');
        if (!ctx) {
            console.error('Chart canvas not found');
            return;
        }
        
        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded');
            return;
        }

        const monthlyData = this.dataManager.getMonthlyAppointmentsData();
        const labels = Object.keys(monthlyData).map(key => {
            const [year, month] = key.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${monthNames[parseInt(month) - 1]} '${year.slice(-2)}`;
        });
        const data = Object.values(monthlyData);

        console.log('Chart Labels:', labels);
        console.log('Chart Data:', data);

        // Destroy existing chart if it exists
        if (this.chart) {
            this.chart.destroy();
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Monthly Visits (Appointments + New Patients)',
                    data: data,
                    borderColor: '#e63946',
                    backgroundColor: 'rgba(230, 57, 70, 0.1)',
                    borderWidth: 3,
                    pointRadius: 6,
                    pointBackgroundColor: '#e63946',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 8,
                    pointHoverBackgroundColor: '#e63946',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 3,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#6b7280',
                            font: {
                                size: 12,
                                weight: '600'
                            },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#e63946',
                        borderWidth: 2,
                        cornerRadius: 8,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                return ` Total Visits: ${context.parsed.y}`;
                            },
                            afterLabel: function(context) {
                                return '(Appointments + New Patients)';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f3f4f6',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6b7280',
                            font: {
                                size: 11,
                                weight: '500'
                            },
                            padding: 8,
                            stepSize: 1,
                            callback: function(value) {
                                return Number.isInteger(value) ? value : '';
                            }
                        },
                        title: {
                            display: true,
                            text: 'Total Visits (Appointments + New Patients)',
                            color: '#6b7280',
                            font: {
                                size: 12,
                                weight: '600'
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: '#f3f4f6',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6b7280',
                            font: {
                                size: 11,
                                weight: '500'
                            },
                            padding: 8
                        },
                        title: {
                            display: true,
                            text: 'Month',
                            color: '#6b7280',
                            font: {
                                size: 12,
                                weight: '600'
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        });

        // Update statistics
        const total = data.reduce((sum, val) => sum + val, 0);
        const avg = data.length > 0 ? Math.round(total / data.length) : 0;
        const max = data.length > 0 ? Math.max(...data) : 0;
        const maxMonthIndex = data.indexOf(max);
        const completionRate = this.calculateCompletionRate();
        
        this.updateElement('totalVisitsCount', total);
        this.updateElement('avgVisitsCount', avg);
        this.updateElement('completionRate', completionRate + '%');
        this.updateElement('peakMonth', labels[maxMonthIndex] || '-');
        
        console.log('Chart initialized successfully');
        console.log('Total Visits:', total);
        console.log('Average Visits:', avg);
        console.log('Peak Month:', labels[maxMonthIndex]);
    }

    calculateCompletionRate() {
        const appointments = Object.values(this.dataManager.data.appointments);
        if (appointments.length === 0) return 0;
        
        const completed = appointments.filter(apt => apt.status === 'Completed').length;
        const rate = Math.round((completed / appointments.length) * 100);
        return rate;
    }

    handleDataUpdate(dataType, data) {
        console.log(`Data updated: ${dataType}`);
        this.updateAllDisplays();
        
        // Regenerate notifications when data changes
        if (this.notificationsManager) {
            this.notificationsManager.generateNotifications();
            this.notificationsManager.updateNotificationBadge();
        }
        
        // Update chart when appointments data changes
        if (dataType === 'appointments' && this.chart) {
            console.log('Updating chart with new appointment data...');
            
            const monthlyData = this.dataManager.getMonthlyAppointmentsData();
            const chartData = Object.values(monthlyData);
            const labels = Object.keys(monthlyData).map(key => {
                const [year, month] = key.split('-');
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return `${monthNames[parseInt(month) - 1]} '${year.slice(-2)}`;
            });
            
            // Update chart
            this.chart.data.labels = labels;
            this.chart.data.datasets[0].data = chartData;
            this.chart.update('active');
            
            // Update statistics
            const total = chartData.reduce((sum, val) => sum + val, 0);
            const avg = chartData.length > 0 ? Math.round(total / chartData.length) : 0;
            const max = chartData.length > 0 ? Math.max(...chartData) : 0;
            const maxMonthIndex = chartData.indexOf(max);
            const completionRate = this.calculateCompletionRate();
            
            this.updateElement('totalVisitsCount', total);
            this.updateElement('avgVisitsCount', avg);
            this.updateElement('completionRate', completionRate + '%');
            this.updateElement('peakMonth', labels[maxMonthIndex] || '-');
            
            console.log('Chart updated with new data');
        }
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'notification';
        
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
            cursor: pointer;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, type === 'error' ? 7000 : 4000);

        notification.addEventListener('click', () => {
            notification.remove();
        });
    }
}

// ========================================
// GLOBAL FUNCTIONS
// ========================================

window.refreshChart = function() {
    if (window.dashboardApp && window.dashboardApp.chart) {
        console.log('Refreshing chart...');
        
        // Get fresh data
        const monthlyData = window.dashboardApp.dataManager.getMonthlyAppointmentsData();
        const data = Object.values(monthlyData);
        
        // Update chart data
        window.dashboardApp.chart.data.datasets[0].data = data;
        window.dashboardApp.chart.update('active');
        
        // Recalculate and update statistics
        const total = data.reduce((sum, val) => sum + val, 0);
        const avg = data.length > 0 ? Math.round(total / data.length) : 0;
        const max = data.length > 0 ? Math.max(...data) : 0;
        const maxMonthIndex = data.indexOf(max);
        const labels = Object.keys(monthlyData).map(key => {
            const [year, month] = key.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${monthNames[parseInt(month) - 1]} '${year.slice(-2)}`;
        });
        const completionRate = window.dashboardApp.calculateCompletionRate();
        
        window.dashboardApp.updateElement('totalVisitsCount', total);
        window.dashboardApp.updateElement('avgVisitsCount', avg);
        window.dashboardApp.updateElement('completionRate', completionRate + '%');
        window.dashboardApp.updateElement('peakMonth', labels[maxMonthIndex] || '-');
        
        console.log('Chart refreshed successfully');
        
        // Show notification
        if (window.dashboardApp.showNotification) {
            window.dashboardApp.showNotification('Chart data refreshed successfully!', 'success');
        }
    } else {
        console.error('Dashboard app or chart not available');
    }
};

window.viewPatient = function(patientId) {
    console.log('View patient:', patientId);
    if (window.dashboardApp?.authManager?.isAdmin) {
        window.dashboardApp.authManager.logUserActivity('view_patient', { patientId });
    }
    window.location.href = 'Patients.html';
};

window.handleNotificationClick = function(notificationId) {
    console.log('🔔 Notification clicked:', notificationId);
    
    if (window.dashboardApp && window.dashboardApp.notificationsManager) {
        window.dashboardApp.notificationsManager.handleNotificationAction(notificationId);
    }
};

window.markAllNotificationsRead = function() {
    console.log('✅ Marking all notifications as read');
    
    if (window.dashboardApp && window.dashboardApp.notificationsManager) {
        window.dashboardApp.notificationsManager.markAllAsRead();
    }
};

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('PregnaCare Dashboard Starting...');
    console.log('Admin User ID:', ADMIN_USER_ID);
    
    window.dashboardApp = new PregnaCareDashboard();
    
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            const modal = event.target;
            if (modal.id !== 'authRequiredModal') {
                modal.style.display = 'none';
                document.body.classList.remove('modal-open');
            }
        }
    });
});

// ========================================
// PAGE UNLOAD CLEANUP
// ========================================

window.addEventListener('beforeunload', () => {
    if (window.dashboardApp && window.dashboardApp.messagesManager) {
        window.dashboardApp.messagesManager.cleanup();
    }
});

// ========================================
// DEBUG HELPERS
// ========================================

window.PregnaCare = {
    authManager: () => window.dashboardApp?.authManager,
    dataManager: () => window.dashboardApp?.dataManager,
    notificationsManager: () => window.dashboardApp?.notificationsManager,
    messagesManager: () => window.dashboardApp?.messagesManager,
    isAdmin: () => window.dashboardApp?.authManager?.isAdmin,
    currentUser: () => window.dashboardApp?.authManager?.currentUser,
    activeDropdowns: () => window.dashboardApp?.activeDropdowns,
    notifications: () => window.dashboardApp?.notificationsManager?.notifications,
    checkAdminStatus: () => {
        const auth = window.dashboardApp?.authManager;
        if (auth) {
            console.log('Current User ID:', auth.currentUser?.uid);
            console.log('Admin User ID:', ADMIN_USER_ID);
            console.log('Is Admin:', auth.isAdmin);
            console.log('Display Name:', auth.userDisplayName);
            console.log('Admin Section:', document.getElementById('adminSection')?.style.display);
        }
    },
    checkNotifications: () => {
        const notifManager = window.dashboardApp?.notificationsManager;
        if (notifManager) {
            console.log('Total Notifications:', notifManager.notifications.length);
            console.log('Unread Count:', notifManager.unreadCount);
            console.log('Notifications:', notifManager.notifications);
        }
    }
};

console.log('✅ Dashboard with Messages Card loaded successfully');

// ========================================
// HOSPITAL REFERRAL MANAGER
// ========================================

class ReferralManager {
    constructor(database, authManager) {
        this.database = database;
        this.authManager = authManager;
        this.referrals = [];
        this.patients = [];
        this.selectedPatient = null;
        this.uploadedFiles = [];
        this.init();
    }

    init() {
        console.log('🏥 Initializing ReferralManager...');
        this.setupEventListeners();
        this.loadPatients();
        this.loadReferrals();
    }

    setupEventListeners() {
        // Modal controls
        const openBtn = document.getElementById('openReferralBtn');
        const closeBtn = document.getElementById('closeReferralBtn');
        const cancelBtn = document.getElementById('cancelReferralBtn');
        const modal = document.getElementById('referralModal');
        const form = document.getElementById('referralForm');

        if (openBtn) {
            openBtn.addEventListener('click', () => this.openReferralModal());
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeReferralModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeReferralModal());
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeReferralModal();
                }
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Patient selection
        const patientSelect = document.getElementById('patientSelect');
        if (patientSelect) {
            patientSelect.addEventListener('change', (e) => this.handlePatientSelection(e));
        }

        // Hospital selection
        const hospitalSelect = document.getElementById('hospitalSelect');
        if (hospitalSelect) {
            hospitalSelect.addEventListener('change', (e) => this.handleHospitalSelection(e));
        }

        // File upload
        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('referralDocuments');
        
        if (fileUploadArea && fileInput) {
            fileUploadArea.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // Status filter
        const statusFilter = document.getElementById('referralStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.filterReferrals());
        }
    }

    openReferralModal() {
        const modal = document.getElementById('referralModal');
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    closeReferralModal() {
        const modal = document.getElementById('referralModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = 'auto';
            this.resetForm();
        }
    }

    resetForm() {
        const form = document.getElementById('referralForm');
        if (form) {
            form.reset();
        }
        
        const patientDetails = document.getElementById('patientDetails');
        if (patientDetails) {
            patientDetails.style.display = 'none';
        }

        const customHospitalRow = document.getElementById('customHospitalRow');
        if (customHospitalRow) {
            customHospitalRow.style.display = 'none';
        }

        this.uploadedFiles = [];
        this.updateUploadedFilesList();
        this.selectedPatient = null;
    }

    async loadPatients() {
        try {
            const snapshot = await this.database.ref('patients').once('value');
            const patientsData = snapshot.val();
            
            if (patientsData) {
                this.patients = Object.entries(patientsData).map(([id, data]) => ({
                    id,
                    ...data
                })).filter(patient => patient.isPregnant || patient.status === 'Active');

                this.populatePatientSelect();
            }
        } catch (error) {
            console.error('Error loading patients:', error);
        }
    }

    populatePatientSelect() {
        const select = document.getElementById('patientSelect');
        if (!select) return;

        // Clear existing options except the first one
        while (select.options.length > 1) {
            select.remove(1);
        }

        // Add patient options
        this.patients.forEach(patient => {
            const option = document.createElement('option');
            option.value = patient.id;
            option.textContent = `${patient.firstName} ${patient.lastName} - ${patient.email || patient.phone}`;
            select.appendChild(option);
        });
    }

    handlePatientSelection(e) {
        const patientId = e.target.value;
        const patientDetails = document.getElementById('patientDetails');

        if (!patientId) {
            patientDetails.style.display = 'none';
            this.selectedPatient = null;
            return;
        }

        this.selectedPatient = this.patients.find(p => p.id === patientId);
        
        if (this.selectedPatient) {
            this.displayPatientDetails(this.selectedPatient);
            patientDetails.style.display = 'block';
        }
    }

    displayPatientDetails(patient) {
        const ageElement = document.getElementById('patientAge');
        const contactElement = document.getElementById('patientContact');
        const gaElement = document.getElementById('patientGA');
        const eddElement = document.getElementById('patientEDD');

        if (ageElement) {
            const age = this.calculateAge(patient.birthday);
            ageElement.textContent = age ? `${age} years` : '-';
        }

        if (contactElement) {
            contactElement.textContent = patient.phone || patient.email || '-';
        }

        if (gaElement) {
            const ga = this.calculateGestationalAge(patient.lmpDate);
            gaElement.textContent = ga || '-';
        }

        if (eddElement) {
            eddElement.textContent = patient.expectedDueDate || '-';
        }
    }

    calculateAge(birthday) {
        if (!birthday) return null;
        const birthDate = new Date(birthday);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }

    calculateGestationalAge(lmpDate) {
        if (!lmpDate) return null;
        
        const lmp = new Date(lmpDate);
        const today = new Date();
        const diffTime = Math.abs(today - lmp);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const weeks = Math.floor(diffDays / 7);
        const days = diffDays % 7;
        
        return `${weeks} weeks ${days} days`;
    }

    handleHospitalSelection(e) {
        const customRow = document.getElementById('customHospitalRow');
        if (e.target.value === 'Custom') {
            customRow.style.display = 'block';
        } else {
            customRow.style.display = 'none';
        }
    }

    handleFileUpload(e) {
        const files = Array.from(e.target.files);
        
        files.forEach(file => {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                alert(`File ${file.name} is too large. Maximum size is 10MB.`);
                return;
            }

            const fileData = {
                name: file.name,
                size: this.formatFileSize(file.size),
                type: file.type,
                file: file
            };

            this.uploadedFiles.push(fileData);
        });

        this.updateUploadedFilesList();
        e.target.value = ''; // Reset input
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    updateUploadedFilesList() {
        const container = document.getElementById('uploadedFiles');
        if (!container) return;

        container.innerHTML = '';

        this.uploadedFiles.forEach((fileData, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'uploaded-file-item';
            fileItem.innerHTML = `
                <div class="file-info">
                    <i class="fas fa-file-${this.getFileIcon(fileData.type)}"></i>
                    <div>
                        <div class="file-name">${fileData.name}</div>
                        <div class="file-size">${fileData.size}</div>
                    </div>
                </div>
                <button type="button" class="file-remove" onclick="window.referralManager.removeFile(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(fileItem);
        });
    }

    getFileIcon(type) {
        if (type.includes('pdf')) return 'pdf';
        if (type.includes('image')) return 'image';
        if (type.includes('word')) return 'word';
        return 'alt';
    }

    removeFile(index) {
        this.uploadedFiles.splice(index, 1);
        this.updateUploadedFilesList();
    }

    async handleSubmit(e) {
        e.preventDefault();

        if (!this.selectedPatient) {
            alert('Please select a patient');
            return;
        }

        const hospitalSelect = document.getElementById('hospitalSelect');
        const customHospital = document.getElementById('customHospital');
        const hospitalContact = document.getElementById('hospitalContact');
        const hospitalDepartment = document.getElementById('hospitalDepartment');
        const referralReason = document.getElementById('referralReason');
        const urgencyLevel = document.getElementById('urgencyLevel');
        const clinicalSummary = document.getElementById('clinicalSummary');
        const additionalNotes = document.getElementById('additionalNotes');

        const hospitalName = hospitalSelect.value === 'Custom' ? 
            customHospital.value : hospitalSelect.value;

        if (!hospitalName) {
            alert('Please select or enter a hospital name');
            return;
        }

        const referralData = {
            patientId: this.selectedPatient.id,
            patientName: `${this.selectedPatient.firstName} ${this.selectedPatient.lastName}`,
            patientAge: this.calculateAge(this.selectedPatient.birthday),
            patientContact: this.selectedPatient.phone || this.selectedPatient.email,
            expectedDueDate: this.selectedPatient.expectedDueDate,
            gestationalAge: this.calculateGestationalAge(this.selectedPatient.lmpDate),
            
            hospital: hospitalName,
            hospitalContact: hospitalContact.value,
            hospitalDepartment: hospitalDepartment.value,
            
            reason: referralReason.value,
            urgencyLevel: urgencyLevel.value,
            clinicalSummary: clinicalSummary.value,
            additionalNotes: additionalNotes.value,
            
            status: 'pending',
            dateReferred: new Date().toISOString(),
            referredBy: this.authManager.userDisplayName || 'Admin',
            referredByEmail: this.authManager.userEmail,
            
            attachments: this.uploadedFiles.map(f => ({
                name: f.name,
                size: f.size,
                type: f.type
            }))
        };

        try {
            const submitBtn = e.target.querySelector('.btn-submit');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

            // Generate referral ID
            const referralRef = this.database.ref('referrals').push();
            referralData.referralId = referralRef.key.substring(0, 8).toUpperCase();
            
            await referralRef.set(referralData);

            // Success message
            alert('Referral submitted successfully!');
            
            this.closeReferralModal();
            this.loadReferrals();
            
        } catch (error) {
            console.error('Error submitting referral:', error);
            alert('Failed to submit referral. Please try again.');
        }
    }

    async loadReferrals() {
        try {
            const snapshot = await this.database.ref('referrals').once('value');
            const referralsData = snapshot.val();
            
            if (referralsData) {
                this.referrals = Object.entries(referralsData).map(([id, data]) => ({
                    id,
                    ...data
                }));

                // Sort by date (newest first)
                this.referrals.sort((a, b) => 
                    new Date(b.dateReferred) - new Date(a.dateReferred)
                );
            } else {
                this.referrals = [];
            }

            this.updateReferralStats();
            this.displayReferrals();
            
        } catch (error) {
            console.error('Error loading referrals:', error);
        }
    }

    updateReferralStats() {
        const totalElement = document.getElementById('totalReferrals');
        const pendingElement = document.getElementById('pendingReferrals');
        const acceptedElement = document.getElementById('acceptedReferrals');
        const declinedElement = document.getElementById('declinedReferrals');

        const stats = {
            total: this.referrals.length,
            pending: this.referrals.filter(r => r.status === 'pending').length,
            accepted: this.referrals.filter(r => r.status === 'accepted').length,
            declined: this.referrals.filter(r => r.status === 'declined').length
        };

        if (totalElement) totalElement.textContent = stats.total;
        if (pendingElement) pendingElement.textContent = stats.pending;
        if (acceptedElement) acceptedElement.textContent = stats.accepted;
        if (declinedElement) declinedElement.textContent = stats.declined;
    }

    displayReferrals() {
        const tbody = document.getElementById('referralTableBody');
        if (!tbody) return;

        if (this.referrals.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #888;">
                        <i class="fas fa-inbox"></i><br>
                        No referrals found. Click "New Referral" to create one.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.referrals.map(referral => `
            <tr>
                <td><strong>${referral.referralId || 'N/A'}</strong></td>
                <td>${referral.patientName}</td>
                <td>${referral.hospital}</td>
                <td>${this.formatDate(referral.expectedDueDate)}</td>
                <td>
                    <span class="status-badge status-${referral.status}">
                        ${referral.status}
                    </span>
                </td>
                <td>${this.formatDate(referral.dateReferred)}</td>
                <td>
                    <button class="table-action-btn btn-view" onclick="window.referralManager.viewReferral('${referral.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="table-action-btn btn-edit" onclick="window.referralManager.editReferral('${referral.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="table-action-btn btn-delete" onclick="window.referralManager.deleteReferral('${referral.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    filterReferrals() {
        const filter = document.getElementById('referralStatusFilter').value;
        const tbody = document.getElementById('referralTableBody');
        
        if (!tbody) return;

        let filteredReferrals = this.referrals;
        
        if (filter !== 'all') {
            filteredReferrals = this.referrals.filter(r => r.status === filter);
        }

        if (filteredReferrals.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #888;">
                        <i class="fas fa-filter"></i><br>
                        No referrals found with status: ${filter}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredReferrals.map(referral => `
            <tr>
                <td><strong>${referral.referralId || 'N/A'}</strong></td>
                <td>${referral.patientName}</td>
                <td>${referral.hospital}</td>
                <td>${this.formatDate(referral.expectedDueDate)}</td>
                <td>
                    <span class="status-badge status-${referral.status}">
                        ${referral.status}
                    </span>
                </td>
                <td>${this.formatDate(referral.dateReferred)}</td>
                <td>
                    <button class="table-action-btn btn-view" onclick="window.referralManager.viewReferral('${referral.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="table-action-btn btn-edit" onclick="window.referralManager.editReferral('${referral.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="table-action-btn btn-delete" onclick="window.referralManager.deleteReferral('${referral.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    viewReferral(id) {
        const referral = this.referrals.find(r => r.id === id);
        if (!referral) return;

        const modal = document.getElementById('referralDetailsModal');
        const content = document.getElementById('referralDetailsContent');

        if (!modal || !content) return;

        content.innerHTML = `
            <div class="referral-details-grid">
                <div class="detail-section">
                    <h5><i class="fas fa-user"></i> Patient Information</h5>
                    <p><strong>Name:</strong> ${referral.patientName}</p>
                    <p><strong>Age:</strong> ${referral.patientAge || 'N/A'} years</p>
                    <p><strong>Contact:</strong> ${referral.patientContact || 'N/A'}</p>
                    <p><strong>Gestational Age:</strong> ${referral.gestationalAge || 'N/A'}</p>
                    <p><strong>Expected Due Date:</strong> ${this.formatDate(referral.expectedDueDate)}</p>
                </div>

                <div class="detail-section">
                    <h5><i class="fas fa-hospital"></i> Hospital Information</h5>
                    <p><strong>Hospital:</strong> ${referral.hospital}</p>
                    <p><strong>Department:</strong> ${referral.hospitalDepartment || 'N/A'}</p>
                    <p><strong>Contact:</strong> ${referral.hospitalContact || 'N/A'}</p>
                </div>

                <div class="detail-section" style="grid-column: 1 / -1;">
                    <h5><i class="fas fa-notes-medical"></i> Referral Details</h5>
                    <p><strong>Referral ID:</strong> ${referral.referralId || 'N/A'}</p>
                    <p><strong>Reason:</strong> ${referral.reason}</p>
                    <p><strong>Urgency:</strong> ${referral.urgencyLevel}</p>
                    <p><strong>Status:</strong> <span class="status-badge status-${referral.status}">${referral.status}</span></p>
                    <p><strong>Date Referred:</strong> ${this.formatDate(referral.dateReferred)}</p>
                    <p><strong>Referred By:</strong> ${referral.referredBy} (${referral.referredByEmail})</p>
                </div>

                <div class="detail-section" style="grid-column: 1 / -1;">
                    <h5><i class="fas fa-file-medical-alt"></i> Clinical Summary</h5>
                    <p>${referral.clinicalSummary || 'No clinical summary provided'}</p>
                </div>

                ${referral.additionalNotes ? `
                <div class="detail-section" style="grid-column: 1 / -1;">
                    <h5><i class="fas fa-comment"></i> Additional Notes</h5>
                    <p>${referral.additionalNotes}</p>
                </div>
                ` : ''}

                ${referral.attachments && referral.attachments.length > 0 ? `
                <div class="detail-section" style="grid-column: 1 / -1;">
                    <h5><i class="fas fa-paperclip"></i> Attachments</h5>
                    ${referral.attachments.map(att => `
                        <p><i class="fas fa-file"></i> ${att.name} (${att.size})</p>
                    `).join('')}
                </div>
                ` : ''}
            </div>
        `;

        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    editReferral(id) {
        alert('Edit functionality coming soon! Referral ID: ' + id);
    }

    async deleteReferral(id) {
        if (!confirm('Are you sure you want to delete this referral? This action cannot be undone.')) {
            return;
        }

        try {
            await this.database.ref(`referrals/${id}`).remove();
            alert('Referral deleted successfully');
            this.loadReferrals();
        } catch (error) {
            console.error('Error deleting referral:', error);
            alert('Failed to delete referral. Please try again.');
        }
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

// Close referral details modal (global function)
function closeReferralDetails() {
    const modal = document.getElementById('referralDetailsModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
}

// Global function for refreshing referrals
function loadReferrals() {
    if (window.referralManager) {
        window.referralManager.loadReferrals();
    }
}

// Initialize ReferralManager when dashboard loads
document.addEventListener('DOMContentLoaded', () => {
    if (window.dashboardApp && window.dashboardApp.authManager) {
        window.referralManager = new ReferralManager(database, window.dashboardApp.authManager);
        console.log('✅ ReferralManager initialized');
    }
});

console.log('✅ Hospital Referral System loaded successfully');