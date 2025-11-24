// PregnaCare Reports System - FULLY ENHANCED VERSION 2.0
// Complete integration with Patients, Appointments, Lab Results, and Prescriptions
// Date: November 23, 2025

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
                
                console.log('✅ User authenticated:', {
                    uid: user.uid,
                    email: user.email,
                    displayName: this.userDisplayName
                });
                
                this.updateUserInterface();
                this.logUserActivity('access_reports_module');
                
                if (window.reportsApp) {
                    window.reportsApp.onAuthenticated();
                }
                
            } else {
                console.log('⚠️  No user authenticated');
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
                this.userDisplayName = user.email.split('@')[0];
                return;
            }

            this.userDisplayName = 'Admin User';
        } catch (error) {
            console.error('Error fetching user display name:', error);
            this.userDisplayName = user.email ? user.email.split('@')[0] : 'Admin User';
        }
    }

    updateUserInterface() {
        const userCircle = document.querySelector('.user .circle');
        const userName = document.querySelector('.user p');
        
        if (userCircle) {
            const initials = this.userDisplayName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .substring(0, 2);
            userCircle.textContent = initials;
        }
        
        if (userName) {
            // Capitalize first letter of each word
            const capitalizedName = this.userDisplayName
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
            userName.textContent = capitalizedName;
        }
    }

    async logUserActivity(action, details = {}) {
        if (!this.currentUser) return;
        
        try {
            const logEntry = {
                userId: this.currentUser.uid,
                userEmail: this.userEmail,
                userName: this.userDisplayName,
                action: action,
                details: details,
                timestamp: new Date().toISOString(),
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString(),
                module: 'Reports'
            };
            
            await database.ref('activityLogs').push(logEntry);
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    }

    showAuthRequiredModal() {
        const modal = document.getElementById('authRequiredModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    async logout() {
        try {
            await this.logUserActivity('logout_reports');
            await auth.signOut();
            window.location.href = 'Login.html';
        } catch (error) {
            console.error('Error during logout:', error);
        }
    }
}

// ========================================
// DATA MANAGER - Real-time Data Integration
// ========================================

class DataManager {
    constructor() {
        this.patients = [];
        this.appointments = [];
        this.labResults = [];
        this.prescriptions = [];
        this.dataLoaded = false;
    }

    async loadAllData() {
        console.log('📥 Loading all clinic data...');
        
        try {
            await Promise.all([
                this.loadPatients(),
                this.loadAppointments(),
                this.loadLabResults(),
                this.loadPrescriptions()
            ]);
            
            this.dataLoaded = true;
            console.log('✅ All data loaded successfully:', {
                patients: this.patients.length,
                appointments: this.appointments.length,
                labResults: this.labResults.length,
                prescriptions: this.prescriptions.length
            });
            
            this.setupRealtimeListeners();
            return true;
        } catch (error) {
            console.error('❌ Error loading data:', error);
            return false;
        }
    }

    setupRealtimeListeners() {
        // Real-time listeners for data updates
        database.ref('patients').on('child_changed', (snapshot) => {
            const updated = { key: snapshot.key, ...snapshot.val() };
            const index = this.patients.findIndex(p => p.key === updated.key);
            if (index !== -1) {
                this.patients[index] = updated;
                console.log('🔄 Patient data updated');
            }
        });

        database.ref('appointments').on('child_changed', (snapshot) => {
            const updated = { key: snapshot.key, ...snapshot.val() };
            const index = this.appointments.findIndex(a => a.key === updated.key);
            if (index !== -1) {
                this.appointments[index] = updated;
                console.log('🔄 Appointment data updated');
            }
        });

        database.ref('labResults').on('child_changed', (snapshot) => {
            const updated = { key: snapshot.key, ...snapshot.val() };
            const index = this.labResults.findIndex(r => r.key === updated.key);
            if (index !== -1) {
                this.labResults[index] = updated;
                console.log('🔄 Lab result data updated');
            }
        });

        database.ref('prescriptions').on('child_changed', (snapshot) => {
            const updated = { key: snapshot.key, ...snapshot.val() };
            const index = this.prescriptions.findIndex(p => p.key === updated.key);
            if (index !== -1) {
                this.prescriptions[index] = updated;
                console.log('🔄 Prescription data updated');
            }
        });
    }

    async loadPatients() {
        try {
            const snapshot = await database.ref('patients').once('value');
            if (snapshot.exists()) {
                this.patients = Object.entries(snapshot.val()).map(([key, patient]) => ({
                    key,
                    ...patient
                }));
                console.log(`✅ Loaded ${this.patients.length} patients`);
            } else {
                this.patients = [];
            }
        } catch (error) {
            console.error('Error loading patients:', error);
            this.patients = [];
        }
    }

    async loadAppointments() {
        try {
            const snapshot = await database.ref('appointments').once('value');
            if (snapshot.exists()) {
                this.appointments = Object.entries(snapshot.val()).map(([key, appointment]) => ({
                    key,
                    ...appointment
                }));
                console.log(`✅ Loaded ${this.appointments.length} appointments`);
            } else {
                this.appointments = [];
            }
        } catch (error) {
            console.error('Error loading appointments:', error);
            this.appointments = [];
        }
    }

    async loadLabResults() {
        try {
            const snapshot = await database.ref('labResults').once('value');
            if (snapshot.exists()) {
                this.labResults = Object.entries(snapshot.val()).map(([key, result]) => ({
                    key,
                    ...result
                }));
                console.log(`✅ Loaded ${this.labResults.length} lab results`);
            } else {
                this.labResults = [];
            }
        } catch (error) {
            console.error('Error loading lab results:', error);
            this.labResults = [];
        }
    }

    async loadPrescriptions() {
        try {
            const snapshot = await database.ref('prescriptions').once('value');
            if (snapshot.exists()) {
                this.prescriptions = Object.entries(snapshot.val()).map(([key, prescription]) => ({
                    key,
                    ...prescription
                }));
                console.log(`✅ Loaded ${this.prescriptions.length} prescriptions`);
            } else {
                this.prescriptions = [];
            }
        } catch (error) {
            console.error('Error loading prescriptions:', error);
            this.prescriptions = [];
        }
    }

    getPatientById(patientId) {
        return this.patients.find(p => 
            p.patientId === patientId || 
            p.id === patientId ||
            p.key === patientId
        );
    }

    getAppointmentsForDate(date) {
        return this.appointments.filter(apt => {
            const aptDate = apt.appointmentDate || apt.date || '';
            return aptDate.startsWith(date);
        });
    }

    getActivePrescriptions() {
        return this.prescriptions.filter(p => {
            const status = (p.status || '').toLowerCase();
            return status === 'active' || status === 'ongoing';
        });
    }

    getRecentLabResults(days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        return this.labResults.filter(lr => {
            try {
                const resultDate = new Date(lr.date || lr.createdAt);
                return resultDate >= cutoffDate;
            } catch (e) {
                return false;
            }
        });
    }
}

// ========================================
// REPORTS GENERATOR
// ========================================

class ReportsGenerator {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    generatePatientSummary(startDate = null, endDate = null) {
        let patients = this.dataManager.patients;
        
        if (startDate && endDate) {
            patients = patients.filter(p => {
                const createdDate = new Date(p.createdAt || p.dateRegistered || '');
                return createdDate >= new Date(startDate) && createdDate <= new Date(endDate);
            });
        }
        
        const totalPatients = patients.length;
        const activePatients = patients.filter(p => (p.status || '').toLowerCase() === 'active').length;
        const inactivePatients = totalPatients - activePatients;
        
        const ageGroups = { 'Under 20': 0, '20-25': 0, '26-30': 0, '31-35': 0, '36-40': 0, 'Over 40': 0 };
        const patientTypes = { 'Prenatal': 0, 'Gynecology': 0, 'Other': 0 };
        const trimesterDist = { 'First Trimester': 0, 'Second Trimester': 0, 'Third Trimester': 0, 'Postpartum': 0, 'N/A': 0 };
        const bloodTypes = {};

        patients.forEach(patient => {
            const age = parseInt(patient.age) || 0;
            if (age < 20) ageGroups['Under 20']++;
            else if (age <= 25) ageGroups['20-25']++;
            else if (age <= 30) ageGroups['26-30']++;
            else if (age <= 35) ageGroups['31-35']++;
            else if (age <= 40) ageGroups['36-40']++;
            else ageGroups['Over 40']++;

            const type = patient.patientType || patient.type || 'Other';
            patientTypes[type] = (patientTypes[type] || 0) + 1;

            const trimester = (patient.trimester || patient.currentTrimester || 'N/A').toLowerCase();
            if (trimester.includes('first')) trimesterDist['First Trimester']++;
            else if (trimester.includes('second')) trimesterDist['Second Trimester']++;
            else if (trimester.includes('third')) trimesterDist['Third Trimester']++;
            else if (trimester.includes('postpartum')) trimesterDist['Postpartum']++;
            else trimesterDist['N/A']++;

            const bloodType = patient.bloodType || 'Unknown';
            bloodTypes[bloodType] = (bloodTypes[bloodType] || 0) + 1;
        });

        return {
            generatedAt: new Date().toISOString(),
            dateRange: startDate && endDate ? { startDate, endDate } : null,
            summary: {
                totalPatients,
                activePatients,
                inactivePatients,
                inactivityRate: totalPatients > 0 ? ((inactivePatients / totalPatients) * 100).toFixed(1) + '%' : '0%'
            },
            demographics: {
                ageDistribution: ageGroups,
                patientTypeDistribution: patientTypes,
                trimesterDistribution: trimesterDist,
                bloodTypeDistribution: bloodTypes
            },
            recentPatients: patients.slice(0, 10).map(p => ({
                patientId: p.patientId || p.id,
                name: p.fullName || p.name || p.patientName,
                age: p.age,
                bloodType: p.bloodType,
                patientType: p.patientType || p.type,
                status: p.status,
                registeredDate: p.createdAt || p.dateRegistered
            })),
            allPatients: patients.map(p => ({
                patientId: p.patientId || p.id,
                name: p.fullName || p.name || p.patientName,
                age: p.age,
                birthdate: p.birthdate || p.dateOfBirth,
                bloodType: p.bloodType,
                patientType: p.patientType || p.type,
                status: p.status,
                phoneNumber: p.phoneNumber || p.contactNumber,
                email: p.email
            }))
        };
    }

    generateDailyAppointments(targetDate = null) {
        const date = targetDate || new Date().toISOString().split('T')[0];
        const appointments = this.dataManager.getAppointmentsForDate(date);

        const statusCounts = {
            'Scheduled': 0, 'Confirmed': 0, 'Completed': 0, 
            'Cancelled': 0, 'No Show': 0, 'Rescheduled': 0
        };

        appointments.forEach(apt => {
            const status = apt.status || 'Scheduled';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        const sortedAppointments = appointments.sort((a, b) => {
            const timeA = a.appointmentTime || a.time || '00:00';
            const timeB = b.appointmentTime || b.time || '00:00';
            return timeA.localeCompare(timeB);
        });

        return {
            generatedAt: new Date().toISOString(),
            reportDate: date,
            summary: {
                totalAppointments: appointments.length,
                statusBreakdown: statusCounts,
                completionRate: appointments.length > 0 
                    ? ((statusCounts.Completed / appointments.length) * 100).toFixed(1) + '%'
                    : '0%'
            },
            appointments: sortedAppointments.map(apt => {
                const patient = this.dataManager.getPatientById(apt.patientId);
                return {
                    appointmentId: apt.appointmentId || apt.id || apt.key,
                    time: apt.appointmentTime || apt.time,
                    patientId: apt.patientId,
                    patientName: apt.patientName || apt.name || patient?.fullName || patient?.name || 'Unknown',
                    appointmentType: apt.appointmentType || apt.type || apt.service,
                    purpose: apt.purpose || apt.reason || apt.notes,
                    doctor: apt.assignedDoctor || apt.doctor || apt.provider,
                    status: apt.status || 'Scheduled'
                };
            })
        };
    }

    generateLabResultsReport(startDate = null, endDate = null) {
        let labResults = this.dataManager.labResults;
        
        if (startDate && endDate) {
            labResults = labResults.filter(lr => {
                const resultDate = new Date(lr.date || lr.createdAt);
                return resultDate >= new Date(startDate) && resultDate <= new Date(endDate);
            });
        } else {
            labResults = this.dataManager.getRecentLabResults(30);
        }

        const statusCounts = { 'Normal': 0, 'Abnormal': 0, 'Pending': 0, 'Reviewed': 0, 'Critical': 0 };
        const testTypes = {};

        labResults.forEach(lr => {
            const status = (lr.status || 'Pending').charAt(0).toUpperCase() + (lr.status || 'Pending').slice(1).toLowerCase();
            statusCounts[status] = (statusCounts[status] || 0) + 1;

            const test = lr.test || lr.testType || 'Unknown';
            testTypes[test] = (testTypes[test] || 0) + 1;
        });

        const criticalResults = labResults.filter(lr => {
            const status = (lr.status || '').toLowerCase();
            return status === 'abnormal' || status === 'critical';
        });

        return {
            generatedAt: new Date().toISOString(),
            dateRange: startDate && endDate ? { startDate, endDate } : { days: 30 },
            summary: {
                totalResults: labResults.length,
                statusBreakdown: statusCounts,
                abnormalRate: labResults.length > 0
                    ? (((statusCounts.Abnormal + statusCounts.Critical) / labResults.length) * 100).toFixed(1) + '%'
                    : '0%',
                criticalCount: statusCounts.Critical || 0
            },
            testTypeDistribution: testTypes,
            criticalResults: criticalResults.map(lr => {
                const patient = this.dataManager.getPatientById(lr.patientId);
                return {
                    resultId: lr.key,
                    patientId: lr.patientId,
                    patientName: lr.patientName || patient?.fullName || patient?.name,
                    test: lr.test || lr.testType,
                    status: lr.status,
                    results: lr.results || lr.value,
                    date: lr.date
                };
            }),
            allResults: labResults.map(lr => {
                const patient = this.dataManager.getPatientById(lr.patientId);
                return {
                    resultId: lr.key,
                    date: lr.date,
                    patientId: lr.patientId,
                    patientName: lr.patientName || patient?.fullName || patient?.name,
                    test: lr.test || lr.testType,
                    status: lr.status,
                    results: lr.results || lr.value
                };
            })
        };
    }

    generateActiveMedicationsReport() {
        const activePrescriptions = this.dataManager.getActivePrescriptions();

        const medications = {};
        activePrescriptions.forEach(rx => {
            const meds = rx.medications || rx.medication || [];
            if (Array.isArray(meds)) {
                meds.forEach(med => {
                    const medName = typeof med === 'string' ? med : (med.name || med.medication || 'Unknown');
                    medications[medName] = (medications[medName] || 0) + 1;
                });
            } else if (typeof meds === 'string') {
                medications[meds] = (medications[meds] || 0) + 1;
            }
        });

        const topMedications = Object.entries(medications)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        return {
            generatedAt: new Date().toISOString(),
            summary: {
                totalActivePrescriptions: activePrescriptions.length,
                uniqueMedications: Object.keys(medications).length
            },
            topMedications,
            patientPrescriptions: activePrescriptions.map(rx => {
                const patient = this.dataManager.getPatientById(rx.patientId);
                const meds = Array.isArray(rx.medications) 
                    ? rx.medications.map(m => typeof m === 'string' ? m : m.name).join(', ')
                    : (rx.medications || '-');
                
                return {
                    prescriptionId: rx.prescriptionId || rx.id || rx.key,
                    patientId: rx.patientId,
                    patientName: rx.patientName || patient?.fullName || patient?.name,
                    medications: meds,
                    dosage: rx.dosage,
                    frequency: rx.frequency,
                    prescribedBy: rx.prescribedBy || rx.doctor,
                    prescribedDate: rx.prescribedDate || rx.date || rx.createdAt,
                    status: rx.status
                };
            })
        };
    }

    generateMonthlySummary(year = null, month = null) {
        const now = new Date();
        const targetYear = year || now.getFullYear();
        const targetMonth = month || now.getMonth() + 1;
        
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        const monthPatients = this.dataManager.patients.filter(p => {
            const createdDate = new Date(p.createdAt || p.dateRegistered || '');
            return createdDate >= startDate && createdDate <= endDate;
        });

        const monthAppointments = this.dataManager.appointments.filter(apt => {
            const aptDate = new Date(apt.appointmentDate || apt.date || '');
            return aptDate >= startDate && aptDate <= endDate;
        });

        const completedAppointments = monthAppointments.filter(a => 
            (a.status || '').toLowerCase() === 'completed'
        ).length;

        return {
            generatedAt: new Date().toISOString(),
            period: {
                year: targetYear,
                month: targetMonth,
                monthName: startDate.toLocaleString('default', { month: 'long' }),
                startDate: startDateStr,
                endDate: endDateStr
            },
            summary: {
                newPatients: monthPatients.length,
                totalAppointments: monthAppointments.length,
                completedAppointments,
                completionRate: monthAppointments.length > 0
                    ? ((completedAppointments / monthAppointments.length) * 100).toFixed(1) + '%'
                    : '0%'
            }
        };
    }
}

// ========================================
// REPORT STORAGE MANAGER
// ========================================

class ReportStorageManager {
    constructor() {
        this.reports = [];
        this.loadReportsFromStorage();
    }

    loadReportsFromStorage() {
        try {
            const stored = localStorage.getItem('pregnacare_reports');
            if (stored) {
                this.reports = JSON.parse(stored);
                console.log(`📂 Loaded ${this.reports.length} reports from storage`);
            }
        } catch (error) {
            console.error('Error loading reports:', error);
            this.reports = [];
        }
    }

    saveReport(reportData, reportType, reportName, format = 'json') {
        const report = {
            id: `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: reportName || `${reportType} - ${new Date().toLocaleString()}`,
            type: reportType,
            format: format,
            generatedDate: new Date().toISOString(),
            size: JSON.stringify(reportData).length,
            data: reportData
        };

        this.reports.unshift(report);
        
        if (this.reports.length > 50) {
            this.reports = this.reports.slice(0, 50);
        }

        this.saveToStorage();
        return report;
    }

    saveToStorage() {
        try {
            localStorage.setItem('pregnacare_reports', JSON.stringify(this.reports));
        } catch (error) {
            console.error('Error saving reports:', error);
        }
    }

    deleteReport(reportId) {
        this.reports = this.reports.filter(r => r.id !== reportId);
        this.saveToStorage();
    }

    getReport(reportId) {
        return this.reports.find(r => r.id === reportId);
    }

    getAllReports() {
        return this.reports;
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
}

// ========================================
// REPORT EXPORTER
// ========================================

class ReportExporter {
    async exportToPDF(reportData, reportName) {
        const content = this.formatReportForExport(reportData);
        const blob = new Blob([content], { type: 'text/plain' });
        this.downloadFile(blob, `${reportName}.txt`);
        return true;
    }

    async exportToCSV(reportData, reportName) {
        const csv = this.convertToCSV(reportData);
        const blob = new Blob([csv], { type: 'text/csv' });
        this.downloadFile(blob, `${reportName}.csv`);
        return true;
    }

    formatReportForExport(reportData) {
        let content = 'PREGNACARE CLINIC REPORT\n';
        content += '='.repeat(60) + '\n\n';
        content += `Generated: ${new Date(reportData.generatedAt).toLocaleString()}\n\n`;
        content += JSON.stringify(reportData, null, 2);
        return content;
    }

    convertToCSV(reportData) {
        let csv = 'PregnaCare Clinic Report\n';
        csv += `Generated: ${new Date(reportData.generatedAt).toLocaleString()}\n\n`;
        csv += JSON.stringify(reportData, null, 2);
        return csv;
    }

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.replace(/[^a-z0-9.-]/gi, '_');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    async exportReport(reportData, reportName, format) {
        switch (format.toLowerCase()) {
            case 'pdf':
                return await this.exportToPDF(reportData, reportName);
            case 'csv':
            case 'excel':
                return await this.exportToCSV(reportData, reportName);
            default:
                return false;
        }
    }
}

// ========================================
// REPORTS APP - Main Application
// ========================================

class ReportsApp {
    constructor() {
        this.authManager = new AuthenticationManager();
        this.dataManager = new DataManager();
        this.reportsGenerator = new ReportsGenerator(this.dataManager);
        this.storageManager = new ReportStorageManager();
        this.exporter = new ReportExporter();
        this.isInitialized = false;
        
        this.initializeApp();
    }

    async initializeApp() {
        console.log('🚀 Initializing Reports App...');
        this.setupEventListeners();
    }

    async onAuthenticated() {
        if (this.isInitialized) return;
        
        console.log('👤 User authenticated, loading data...');
        this.showLoadingIndicator('Loading clinic data...');
        
        try {
            const success = await this.dataManager.loadAllData();
            
            if (success) {
                this.isInitialized = true;
                this.displayReportsList();
            } else {
                this.showError('Failed to load clinic data.');
            }
        } catch (error) {
            console.error('Error during initialization:', error);
            this.showError('An error occurred while loading data.');
        } finally {
            this.hideLoadingIndicator();
        }
    }

    setupEventListeners() {
        // Generate Report Button
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.openGenerateModal());
        }

        // Refresh Button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshData());
        }

        // Quick Report Cards
        document.querySelectorAll('.quick-report-card').forEach(card => {
            card.addEventListener('click', () => {
                const reportType = card.dataset.reportType;
                this.generateQuickReport(reportType);
            });
        });

        // Generate Report Form
        const generateForm = document.getElementById('generateReportForm');
        if (generateForm) {
            generateForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleGenerateReport();
            });
        }

        // Filter controls
        const filterType = document.getElementById('filterType');
        if (filterType) {
            filterType.addEventListener('change', () => this.filterReportsList());
        }

        const filterDate = document.getElementById('filterDate');
        if (filterDate) {
            filterDate.addEventListener('change', () => this.filterReportsList());
        }

        // Search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchReports(e.target.value);
            });
        }

        // Modal close buttons
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        });

        // Cancel buttons
        document.querySelectorAll('.btn-cancel-generate, .btn-cancel-share').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
            });
        });

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.authManager.logout();
            });
        }

        // Auth required
        const goToLoginBtn = document.getElementById('goToLoginBtn');
        if (goToLoginBtn) {
            goToLoginBtn.addEventListener('click', () => {
                window.location.href = 'Login.html';
            });
        }

        this.setupNotificationHelp();
    }

    setupNotificationHelp() {
        const notifIcon = document.getElementById('notifIcon');
        const helpIcon = document.getElementById('helpIcon');
        const notifDropdown = document.getElementById('notifDropdown');
        const helpDropdown = document.getElementById('helpDropdown');

        if (notifIcon && notifDropdown) {
            notifIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                notifDropdown.style.display = notifDropdown.style.display === 'block' ? 'none' : 'block';
                if (helpDropdown) helpDropdown.style.display = 'none';
            });
        }

        if (helpIcon && helpDropdown) {
            helpIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                helpDropdown.style.display = helpDropdown.style.display === 'block' ? 'none' : 'block';
                if (notifDropdown) notifDropdown.style.display = 'none';
            });
        }

        document.addEventListener('click', () => {
            if (notifDropdown) notifDropdown.style.display = 'none';
            if (helpDropdown) helpDropdown.style.display = 'none';
        });
    }

    async refreshData() {
        console.log('🔄 Refreshing data...');
        this.showLoadingIndicator('Refreshing clinic data...');
        
        try {
            await this.dataManager.loadAllData();
            this.displayReportsList();
            this.showSuccess('Data refreshed successfully!');
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.showError('Failed to refresh data.');
        } finally {
            this.hideLoadingIndicator();
        }
    }

    openGenerateModal() {
        const modal = document.getElementById('generateReportModal');
        if (modal) {
            const form = document.getElementById('generateReportForm');
            if (form) form.reset();
            
            // Set default dates
            const today = new Date().toISOString().split('T')[0];
            const endDate = document.getElementById('endDate');
            const startDate = document.getElementById('startDate');
            
            if (endDate) endDate.value = today;
            if (startDate) {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                startDate.value = thirtyDaysAgo.toISOString().split('T')[0];
            }
            
            modal.style.display = 'flex';
        }
    }

    setDatePreset(preset) {
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        if (!startDate || !endDate) return;
        
        endDate.value = todayStr;
        
        switch(preset) {
            case 'today':
                startDate.value = todayStr;
                break;
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                startDate.value = weekAgo.toISOString().split('T')[0];
                break;
            case 'month':
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                startDate.value = monthAgo.toISOString().split('T')[0];
                break;
            case 'year':
                const yearAgo = new Date(today);
                yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                startDate.value = yearAgo.toISOString().split('T')[0];
                break;
        }
        
        // Visual feedback
        this.showNotification(`Date range set to: ${preset}`, 'info');
    }

    async generateQuickReport(reportType) {
        console.log('📊 Generating quick report:', reportType);
        
        if (!this.isInitialized) {
            this.showError('System is still loading. Please wait...');
            return;
        }

        if (reportType === 'custom') {
            this.openGenerateModal();
            return;
        }

        this.showGenerationProgress();
        
        try {
            let reportData;
            let reportName;

            switch (reportType) {
                case 'patient-summary':
                    reportData = this.reportsGenerator.generatePatientSummary();
                    reportName = `Patient Summary - ${new Date().toLocaleDateString()}`;
                    break;
                
                case 'appointments-daily':
                    reportData = this.reportsGenerator.generateDailyAppointments();
                    reportName = `Daily Appointments - ${new Date().toLocaleDateString()}`;
                    break;
                
                case 'lab-results':
                    reportData = this.reportsGenerator.generateLabResultsReport();
                    reportName = `Lab Results Report - ${new Date().toLocaleDateString()}`;
                    break;
                
                case 'medications-active':
                    reportData = this.reportsGenerator.generateActiveMedicationsReport();
                    reportName = `Active Medications - ${new Date().toLocaleDateString()}`;
                    break;
                
                case 'monthly-summary':
                    reportData = this.reportsGenerator.generateMonthlySummary();
                    reportName = `Monthly Summary - ${new Date().toLocaleDateString()}`;
                    break;
                
                case 'financial-summary':
                    reportData = { 
                        generatedAt: new Date().toISOString(),
                        summary: { note: 'Financial reports require billing system integration' }
                    };
                    reportName = `Financial Summary - ${new Date().toLocaleDateString()}`;
                    break;
                
                default:
                    throw new Error('Unknown report type');
            }

            const savedReport = this.storageManager.saveReport(reportData, reportType, reportName, 'json');
            
            await this.authManager.logUserActivity('generate_quick_report', {
                reportType,
                reportName,
                reportId: savedReport.id
            });

            this.hideGenerationProgress();
            this.displayReportDetails(savedReport);
            this.displayReportsList();
            this.showSuccess(`Report generated: ${reportName}`);
            
        } catch (error) {
            console.error('Error generating report:', error);
            this.hideGenerationProgress();
            this.showError('Failed to generate report.');
        }
    }

    async handleGenerateReport() {
        const form = document.getElementById('generateReportForm');
        if (!form) return;

        const formData = new FormData(form);
        const reportType = formData.get('reportType');
        
        // Validation
        if (!reportType) {
            this.showError('Please select a report type');
            return;
        }
        
        const reportName = formData.get('reportName') || `${this.formatReportType(reportType)} - ${new Date().toLocaleDateString()}`;
        const startDate = formData.get('startDate');
        const endDate = formData.get('endDate');
        const exportFormat = formData.get('exportFormat') || 'pdf';

        console.log('📊 Generating custom report:', { reportType, reportName, startDate, endDate, exportFormat });

        // Add loading state to button
        const submitBtn = document.getElementById('generateSubmitBtn');
        if (submitBtn) {
            submitBtn.classList.add('loading');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        }

        // Close modal
        document.getElementById('generateReportModal').style.display = 'none';
        
        // Show progress
        this.showGenerationProgress();

        try {
            let reportData;

            switch (reportType) {
                case 'patient-summary':
                    reportData = this.reportsGenerator.generatePatientSummary(startDate, endDate);
                    break;
                case 'appointments-daily':
                    reportData = this.reportsGenerator.generateDailyAppointments(startDate || new Date().toISOString().split('T')[0]);
                    break;
                case 'lab-results':
                    reportData = this.reportsGenerator.generateLabResultsReport(startDate, endDate);
                    break;
                case 'medications-active':
                    reportData = this.reportsGenerator.generateActiveMedicationsReport();
                    break;
                case 'monthly-summary':
                    const date = new Date(startDate || new Date());
                    reportData = this.reportsGenerator.generateMonthlySummary(date.getFullYear(), date.getMonth() + 1);
                    break;
                case 'financial-summary':
                    reportData = this.reportsGenerator.generateFinancialSummary(startDate, endDate);
                    break;
                default:
                    throw new Error('Invalid report type');
            }

            // Save report
            const savedReport = this.storageManager.saveReport(reportData, reportType, reportName, exportFormat);
            
            // Export if needed
            if (exportFormat !== 'json') {
                await this.exporter.exportReport(reportData, reportName, exportFormat);
            }

            // Log activity
            await this.authManager.logUserActivity('generate_custom_report', {
                reportType,
                reportName,
                reportId: savedReport.id,
                exportFormat,
                dateRange: startDate && endDate ? { startDate, endDate } : null
            });

            this.hideGenerationProgress();
            
            // Display report
            this.displayReportDetails(savedReport);
            
            // Refresh list
            this.displayReportsList();
            
            this.showSuccess(`Report generated successfully: ${reportName}`);
            
        } catch (error) {
            console.error('❌ Error generating custom report:', error);
            this.hideGenerationProgress();
            this.showError('Failed to generate report. Please try again.');
        } finally {
            // Reset button
            if (submitBtn) {
                submitBtn.classList.remove('loading');
                submitBtn.innerHTML = '<i class="fas fa-cog"></i> Generate Report';
            }
        }
    }

    showGenerationProgress() {
        const modal = document.getElementById('generationProgressModal');
        if (modal) {
            modal.style.display = 'flex';
            
            let progress = 0;
            const progressFill = document.getElementById('progressFill');
            const progressPercentage = document.getElementById('progressPercentage');
            const progressMessage = document.getElementById('progressMessage');
            
            const messages = [
                'Initializing report generation...',
                'Fetching patient data...',
                'Analyzing appointments...',
                'Processing lab results...',
                'Compiling medication records...',
                'Generating statistics...',
                'Formatting report...',
                'Finalizing report...'
            ];
            
            let messageIndex = 0;
            
            const interval = setInterval(() => {
                progress += 12.5;
                if (progress > 100) progress = 100;
                
                if (progressFill) progressFill.style.width = progress + '%';
                if (progressPercentage) progressPercentage.textContent = Math.round(progress) + '%';
                
                if (messageIndex < messages.length && progressMessage) {
                    progressMessage.textContent = messages[messageIndex];
                    messageIndex++;
                }
                
                if (progress >= 100) clearInterval(interval);
            }, 300);
            
            modal.dataset.intervalId = interval;
        }
    }

    hideGenerationProgress() {
        const modal = document.getElementById('generationProgressModal');
        if (modal) {
            if (modal.dataset.intervalId) {
                clearInterval(parseInt(modal.dataset.intervalId));
            }
            
            modal.style.display = 'none';
            
            const progressFill = document.getElementById('progressFill');
            const progressPercentage = document.getElementById('progressPercentage');
            const progressMessage = document.getElementById('progressMessage');
            
            if (progressFill) progressFill.style.width = '0%';
            if (progressPercentage) progressPercentage.textContent = '0%';
            if (progressMessage) progressMessage.textContent = 'Initializing report generation...';
        }
    }

    displayReportsList() {
        const reports = this.storageManager.getAllReports();
        const tbody = document.querySelector('#reportsTable tbody');
        
        if (!tbody) return;

        if (reports.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px;">
                        <i class="fas fa-inbox" style="font-size: 48px; color: #ddd;"></i>
                        <p style="margin-top: 15px; color: #999;">No reports generated yet. Click "Generate New Report" to create your first report.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = reports.map(report => `
            <tr data-report-id="${report.id}">
                <td>
                    <div class="report-name">
                        <i class="fa-solid fa-file-alt"></i>
                        <span>${report.name}</span>
                    </div>
                </td>
                <td>${new Date(report.generatedDate).toLocaleString()}</td>
                <td><span class="badge badge-primary">${this.formatReportType(report.type)}</span></td>
                <td><span class="badge badge-info">${report.format.toUpperCase()}</span></td>
                <td>${this.storageManager.formatFileSize(report.size)}</td>
                <td>
                    <div class="actions">
                        <button class="btn-action" onclick="window.reportsApp.viewReport('${report.id}')" title="View Report">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action" onclick="window.reportsApp.downloadReport('${report.id}')" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn-action btn-danger" onclick="window.reportsApp.deleteReport('${report.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    formatReportType(type) {
        const types = {
            'patient-summary': 'Patient Summary',
            'appointments-daily': 'Daily Appointments',
            'lab-results': 'Lab Results',
            'medications-active': 'Active Medications',
            'monthly-summary': 'Monthly Summary',
            'financial-summary': 'Financial Summary',
            'custom': 'Custom Report'
        };
        return types[type] || type;
    }

    viewReport(reportId) {
        const report = this.storageManager.getReport(reportId);
        if (!report) {
            this.showError('Report not found.');
            return;
        }

        this.displayReportDetails(report);
    }

    displayReportDetails(report) {
        const modal = document.getElementById('reportDetailsModal');
        const titleEl = document.getElementById('reportDetailsTitle');
        const contentEl = document.getElementById('reportDetailsContent');
        
        if (!modal || !titleEl || !contentEl) return;

        titleEl.textContent = report.name;
        
        const data = report.data;
        let html = '<div class="report-details-container">';
        
        // Report Header with Icon
        html += `
            <div class="report-details-header">
                <div class="report-icon">
                    ${this.getReportIcon(report.type)}
                </div>
                <div class="report-meta">
                    <h2>${report.name}</h2>
                    <div class="report-info">
                        <span><i class="fas fa-calendar"></i> ${new Date(report.generatedDate).toLocaleString()}</span>
                        <span><i class="fas fa-tag"></i> ${this.formatReportType(report.type)}</span>
                        <span><i class="fas fa-file"></i> ${report.format.toUpperCase()}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Summary Cards
        if (data.summary) {
            html += '<div class="summary-section">';
            html += '<h3 class="section-title"><i class="fas fa-chart-line"></i> Key Metrics</h3>';
            html += '<div class="metrics-cards">';
            
            Object.entries(data.summary).forEach(([key, value]) => {
                const label = this.formatLabel(key);
                const icon = this.getMetricIcon(key);
                html += `
                    <div class="metric-card">
                        <div class="metric-icon">${icon}</div>
                        <div class="metric-content">
                            <div class="metric-label">${label}</div>
                            <div class="metric-value">${value}</div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div></div>';
        }
        
        // Render specific report type content
        html += this.renderReportSpecificContent(data, report.type);
        
        html += '</div>';
        
        contentEl.innerHTML = html;
        modal.style.display = 'flex';
    }

    getReportIcon(type) {
        const icons = {
            'patient-summary': '<i class="fas fa-users"></i>',
            'appointments-daily': '<i class="fas fa-calendar-day"></i>',
            'lab-results': '<i class="fas fa-flask"></i>',
            'medications-active': '<i class="fas fa-pills"></i>',
            'monthly-summary': '<i class="fas fa-chart-bar"></i>',
            'financial-summary': '<i class="fas fa-dollar-sign"></i>'
        };
        return icons[type] || '<i class="fas fa-file-alt"></i>';
    }

    getMetricIcon(key) {
        const icons = {
            'totalPatients': '👥',
            'activePatients': '✅',
            'inactivePatients': '⏸️',
            'newPatients': '🆕',
            'totalAppointments': '📅',
            'completedAppointments': '✔️',
            'scheduledAppointments': '🕐',
            'completionRate': '📊',
            'totalResults': '🧪',
            'abnormalRate': '⚠️',
            'criticalCount': '🚨',
            'totalActivePrescriptions': '💊',
            'uniqueMedications': '💉'
        };
        return icons[key] || '📊';
    }

    formatLabel(key) {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    renderReportSpecificContent(data, type) {
        switch(type) {
            case 'patient-summary':
                return this.renderPatientSummaryContent(data);
            case 'appointments-daily':
                return this.renderAppointmentsContent(data);
            case 'lab-results':
                return this.renderLabResultsContent(data);
            case 'medications-active':
                return this.renderMedicationsContent(data);
            case 'monthly-summary':
                return this.renderMonthlySummaryContent(data);
            case 'financial-summary':
                return this.renderFinancialContent(data);
            default:
                return '';
        }
    }

    renderPatientSummaryContent(data) {
        let html = '';
        
        // Demographics
        if (data.demographics) {
            html += '<div class="report-section">';
            html += '<h3 class="section-title"><i class="fas fa-chart-pie"></i> Demographics</h3>';
            
            if (data.demographics.ageDistribution) {
                html += '<div class="demographics-grid">';
                html += '<div class="demo-card">';
                html += '<h4><i class="fas fa-birthday-cake"></i> Age Distribution</h4>';
                html += '<div class="chart-bars">';
                Object.entries(data.demographics.ageDistribution).forEach(([range, count]) => {
                    const percentage = data.summary.totalPatients > 0 
                        ? (count / data.summary.totalPatients * 100).toFixed(1) 
                        : 0;
                    html += `
                        <div class="bar-item">
                            <span class="bar-label">${range}</span>
                            <div class="bar-container">
                                <div class="bar-fill" style="width: ${percentage}%"></div>
                            </div>
                            <span class="bar-value">${count}</span>
                        </div>
                    `;
                });
                html += '</div></div>';
            }
            
            if (data.demographics.patientTypeDistribution) {
                html += '<div class="demo-card">';
                html += '<h4><i class="fas fa-user-tag"></i> Patient Types</h4>';
                html += '<div class="chart-bars">';
                Object.entries(data.demographics.patientTypeDistribution).forEach(([type, count]) => {
                    const percentage = data.summary.totalPatients > 0 
                        ? (count / data.summary.totalPatients * 100).toFixed(1) 
                        : 0;
                    html += `
                        <div class="bar-item">
                            <span class="bar-label">${type}</span>
                            <div class="bar-container">
                                <div class="bar-fill" style="width: ${percentage}%"></div>
                            </div>
                            <span class="bar-value">${count}</span>
                        </div>
                    `;
                });
                html += '</div></div>';
            }
            
            html += '</div></div>';
        }
        
        // Recent Patients
        if (data.recentPatients && data.recentPatients.length > 0) {
            html += '<div class="report-section">';
            html += '<h3 class="section-title"><i class="fas fa-user-plus"></i> Recent Patients</h3>';
            html += '<div class="data-table-container">';
            html += '<table class="data-table">';
            html += '<thead><tr><th>ID</th><th>Name</th><th>Age</th><th>Type</th><th>Status</th></tr></thead>';
            html += '<tbody>';
            
            data.recentPatients.slice(0, 10).forEach(patient => {
                const statusClass = patient.status === 'Active' ? 'status-active' : 'status-inactive';
                html += `
                    <tr>
                        <td><span class="patient-id">${patient.patientId || '-'}</span></td>
                        <td><strong>${patient.name || '-'}</strong></td>
                        <td>${patient.age || '-'}</td>
                        <td>${patient.patientType || '-'}</td>
                        <td><span class="status-badge ${statusClass}">${patient.status || 'Unknown'}</span></td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div></div>';
        }
        
        return html;
    }

    renderAppointmentsContent(data) {
        let html = '';
        
        if (data.appointments && data.appointments.length > 0) {
            html += '<div class="report-section">';
            html += '<h3 class="section-title"><i class="fas fa-calendar-check"></i> Today\'s Schedule</h3>';
            html += '<div class="appointments-timeline">';
            
            data.appointments.forEach(apt => {
                const statusClass = this.getStatusClass(apt.status);
                html += `
                    <div class="appointment-card ${statusClass}">
                        <div class="apt-time">
                            <i class="fas fa-clock"></i>
                            <span>${apt.time || '-'}</span>
                        </div>
                        <div class="apt-content">
                            <div class="apt-patient">
                                <i class="fas fa-user"></i>
                                <strong>${apt.patientName || 'Unknown'}</strong>
                            </div>
                            <div class="apt-type">${apt.appointmentType || '-'}</div>
                            ${apt.doctor ? `<div class="apt-doctor"><i class="fas fa-user-md"></i> ${apt.doctor}</div>` : ''}
                        </div>
                        <div class="apt-status">
                            <span class="status-badge ${statusClass}">${apt.status || 'Scheduled'}</span>
                        </div>
                    </div>
                `;
            });
            
            html += '</div></div>';
        } else {
            html += '<div class="empty-state">';
            html += '<i class="fas fa-calendar-times"></i>';
            html += '<p>No appointments scheduled for this date</p>';
            html += '</div>';
        }
        
        return html;
    }

    renderLabResultsContent(data) {
        let html = '';
        
        // Test Distribution
        if (data.testTypeDistribution) {
            html += '<div class="report-section">';
            html += '<h3 class="section-title"><i class="fas fa-vial"></i> Test Distribution</h3>';
            html += '<div class="test-distribution">';
            
            Object.entries(data.testTypeDistribution).forEach(([test, count]) => {
                html += `
                    <div class="test-item">
                        <span class="test-name">${test}</span>
                        <span class="test-count">${count}</span>
                    </div>
                `;
            });
            
            html += '</div></div>';
        }
        
        // Critical Results
        if (data.criticalResults && data.criticalResults.length > 0) {
            html += '<div class="report-section alert-section">';
            html += '<h3 class="section-title"><i class="fas fa-exclamation-triangle"></i> Critical/Abnormal Results</h3>';
            html += '<div class="critical-results">';
            
            data.criticalResults.forEach(result => {
                html += `
                    <div class="critical-card">
                        <div class="critical-header">
                            <span class="critical-badge">⚠️ ${result.status}</span>
                            <span class="critical-date">${new Date(result.date).toLocaleDateString()}</span>
                        </div>
                        <div class="critical-body">
                            <div class="critical-patient">
                                <i class="fas fa-user"></i>
                                <strong>${result.patientName || 'Unknown'}</strong>
                            </div>
                            <div class="critical-test">${result.test}</div>
                            <div class="critical-value">${result.results}</div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div></div>';
        }
        
        return html;
    }

    renderMedicationsContent(data) {
        let html = '';
        
        // Top Medications
        if (data.topMedications && data.topMedications.length > 0) {
            html += '<div class="report-section">';
            html += '<h3 class="section-title"><i class="fas fa-pills"></i> Top Prescribed Medications</h3>';
            html += '<div class="top-medications">';
            
            data.topMedications.forEach((med, index) => {
                html += `
                    <div class="med-rank-card">
                        <div class="med-rank">#${index + 1}</div>
                        <div class="med-info">
                            <div class="med-name">${med.name}</div>
                            <div class="med-count">${med.count} prescriptions</div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div></div>';
        }
        
        // Active Prescriptions
        if (data.patientPrescriptions && data.patientPrescriptions.length > 0) {
            html += '<div class="report-section">';
            html += '<h3 class="section-title"><i class="fas fa-prescription"></i> Active Prescriptions</h3>';
            html += '<div class="data-table-container">';
            html += '<table class="data-table">';
            html += '<thead><tr><th>Patient</th><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Prescribed By</th></tr></thead>';
            html += '<tbody>';
            
            data.patientPrescriptions.slice(0, 20).forEach(rx => {
                html += `
                    <tr>
                        <td><strong>${rx.patientName || '-'}</strong></td>
                        <td>${rx.medications || '-'}</td>
                        <td>${rx.dosage || '-'}</td>
                        <td>${rx.frequency || '-'}</td>
                        <td>${rx.prescribedBy || '-'}</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div></div>';
        }
        
        return html;
    }

    renderMonthlySummaryContent(data) {
        let html = '';
        
        if (data.period) {
            html += '<div class="period-banner">';
            html += `<h3><i class="fas fa-calendar-alt"></i> ${data.period.monthName} ${data.period.year}</h3>`;
            html += `<p>${data.period.startDate} to ${data.period.endDate}</p>`;
            html += '</div>';
        }
        
        return html;
    }

    renderFinancialContent(data) {
        let html = '';
        
        if (data.note) {
            html += `<div class="info-banner">`;
            html += `<i class="fas fa-info-circle"></i>`;
            html += `<p>${data.note}</p>`;
            html += `</div>`;
        }
        
        if (data.revenueByService) {
            html += '<div class="report-section">';
            html += '<h3 class="section-title"><i class="fas fa-chart-line"></i> Revenue by Service</h3>';
            html += '<div class="revenue-grid">';
            
            Object.entries(data.revenueByService).forEach(([service, amount]) => {
                html += `
                    <div class="revenue-card">
                        <div class="revenue-service">${service}</div>
                        <div class="revenue-amount">₱${amount.toLocaleString()}</div>
                    </div>
                `;
            });
            
            html += '</div></div>';
        }
        
        return html;
    }

    getStatusClass(status) {
        const statusMap = {
            'Completed': 'status-completed',
            'Confirmed': 'status-confirmed',
            'Scheduled': 'status-scheduled',
            'Cancelled': 'status-cancelled',
            'No Show': 'status-noshow'
        };
        return statusMap[status] || 'status-default';
    }

    async downloadReport(reportId) {
        const report = this.storageManager.getReport(reportId);
        if (!report) {
            this.showError('Report not found.');
            return;
        }

        try {
            await this.exporter.exportReport(report.data, report.name, report.format);
            
            await this.authManager.logUserActivity('download_report', {
                reportId: report.id,
                reportName: report.name,
                format: report.format
            });
            
            this.showSuccess('Report downloaded successfully!');
        } catch (error) {
            console.error('Error downloading report:', error);
            this.showError('Failed to download report.');
        }
    }

    async deleteReport(reportId) {
        if (!confirm('Are you sure you want to delete this report?')) {
            return;
        }

        const report = this.storageManager.getReport(reportId);
        if (!report) {
            this.showError('Report not found.');
            return;
        }

        try {
            this.storageManager.deleteReport(reportId);
            
            await this.authManager.logUserActivity('delete_report', {
                reportId: report.id,
                reportName: report.name
            });
            
            this.displayReportsList();
            this.showSuccess('Report deleted successfully!');
        } catch (error) {
            console.error('Error deleting report:', error);
            this.showError('Failed to delete report.');
        }
    }

    filterReportsList() {
        const filterType = document.getElementById('filterType')?.value || 'all';
        const filterDate = document.getElementById('filterDate')?.value || 'all';
        
        let reports = this.storageManager.getAllReports();
        
        if (filterType !== 'all') {
            reports = reports.filter(r => r.type === filterType);
        }
        
        if (filterDate !== 'all') {
            const now = new Date();
            reports = reports.filter(r => {
                const reportDate = new Date(r.generatedDate);
                switch (filterDate) {
                    case 'today':
                        return reportDate.toDateString() === now.toDateString();
                    case 'week':
                        const weekAgo = new Date(now);
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return reportDate >= weekAgo;
                    case 'month':
                        const monthAgo = new Date(now);
                        monthAgo.setMonth(monthAgo.getMonth() - 1);
                        return reportDate >= monthAgo;
                    default:
                        return true;
                }
            });
        }
        
        const tbody = document.querySelector('#reportsTable tbody');
        if (!tbody) return;

        if (reports.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px;">
                        <i class="fas fa-filter" style="font-size: 48px; color: #ddd;"></i>
                        <p style="margin-top: 15px; color: #999;">No reports match your filter criteria.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = reports.map(report => `
            <tr data-report-id="${report.id}">
                <td>
                    <div class="report-name">
                        <i class="fa-solid fa-file-alt"></i>
                        <span>${report.name}</span>
                    </div>
                </td>
                <td>${new Date(report.generatedDate).toLocaleString()}</td>
                <td><span class="badge badge-primary">${this.formatReportType(report.type)}</span></td>
                <td><span class="badge badge-info">${report.format.toUpperCase()}</span></td>
                <td>${this.storageManager.formatFileSize(report.size)}</td>
                <td>
                    <div class="actions">
                        <button class="btn-action" onclick="window.reportsApp.viewReport('${report.id}')" title="View Report">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action" onclick="window.reportsApp.downloadReport('${report.id}')" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn-action btn-danger" onclick="window.reportsApp.deleteReport('${report.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    searchReports(query) {
        if (!query || query.trim() === '') {
            this.displayReportsList();
            return;
        }

        const searchTerm = query.toLowerCase();
        const reports = this.storageManager.getAllReports().filter(report => {
            return report.name.toLowerCase().includes(searchTerm) ||
                   report.type.toLowerCase().includes(searchTerm) ||
                   this.formatReportType(report.type).toLowerCase().includes(searchTerm);
        });

        const tbody = document.querySelector('#reportsTable tbody');
        if (!tbody) return;

        if (reports.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px;">
                        <i class="fas fa-search" style="font-size: 48px; color: #ddd;"></i>
                        <p style="margin-top: 15px; color: #999;">No reports found matching "${query}"</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = reports.map(report => `
            <tr data-report-id="${report.id}">
                <td>
                    <div class="report-name">
                        <i class="fa-solid fa-file-alt"></i>
                        <span>${report.name}</span>
                    </div>
                </td>
                <td>${new Date(report.generatedDate).toLocaleString()}</td>
                <td><span class="badge badge-primary">${this.formatReportType(report.type)}</span></td>
                <td><span class="badge badge-info">${report.format.toUpperCase()}</span></td>
                <td>${this.storageManager.formatFileSize(report.size)}</td>
                <td>
                    <div class="actions">
                        <button class="btn-action" onclick="window.reportsApp.viewReport('${report.id}')" title="View Report">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action" onclick="window.reportsApp.downloadReport('${report.id}')" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn-action btn-danger" onclick="window.reportsApp.deleteReport('${report.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    showLoadingIndicator(message = 'Loading...') {
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.7); display: flex;
                align-items: center; justify-content: center; z-index: 10000;
            `;
            overlay.innerHTML = `
                <div style="background: white; padding: 30px 40px; border-radius: 12px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                    <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #f857a6; margin-bottom: 20px;"></i>
                    <p id="loadingMessage" style="margin: 0; font-size: 16px; color: #333;">${message}</p>
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            overlay.style.display = 'flex';
            const messageEl = document.getElementById('loadingMessage');
            if (messageEl) messageEl.textContent = message;
        }
    }

    hideLoadingIndicator() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 16px 24px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white; border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10001;
            display: flex; align-items: center; gap: 12px; min-width: 300px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
        notification.innerHTML = `
            <i class="fas ${icon}" style="font-size: 20px;"></i>
            <span style="flex: 1;">${message}</span>
            <i class="fas fa-times" style="cursor: pointer; opacity: 0.8;" onclick="this.parentElement.remove()"></i>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
}

// ========================================
// INITIALIZE APPLICATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 PregnaCare Reports System v2.0 - Initializing...');
    window.reportsApp = new ReportsApp();
});

// ========================================
// ADDITIONAL STYLES
// ========================================

const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }

    .badge {
        padding: 6px 12px; border-radius: 12px; font-size: 11px;
        font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
        display: inline-block;
    }

    .badge-primary { background: #2196F3; color: white; }
    .badge-success { background: #4CAF50; color: white; }
    .badge-warning { background: #ff9800; color: white; }
    .badge-danger { background: #f44336; color: white; }
    .badge-info { background: #00bcd4; color: white; }
    .badge-secondary { background: #9e9e9e; color: white; }

    .modal {
        display: none; position: fixed; z-index: 9999; left: 0; top: 0;
        width: 100%; height: 100%; background-color: rgba(0,0,0,0.5);
        align-items: center; justify-content: center;
    }

    .modal-content {
        background-color: white; 
        padding: 0; 
        border-radius: 16px;
        width: 90%; 
        max-width: 650px; 
        max-height: 90vh; 
        overflow: hidden;
        display: flex; 
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: modalSlideIn 0.3s ease-out;
    }

    @keyframes modalSlideIn {
        from {
            opacity: 0;
            transform: translateY(-50px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .modal-content.large { max-width: 1200px; }
    .modal-content.small { max-width: 400px; }

    .modal-header {
        padding: 24px 30px;
        background: linear-gradient(135deg, #f857a6 0%, #ff5858 100%);
        color: white; 
        display: flex; 
        justify-content: space-between;
        align-items: center;
        border-radius: 16px 16px 0 0;
        box-shadow: 0 4px 12px rgba(248, 87, 166, 0.3);
    }

    .modal-header h2 {
        margin: 0; 
        font-size: 24px; 
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .modal-header h2::before {
        content: '📊';
        font-size: 28px;
    }

    .modal-header .close {
        font-size: 28px; 
        font-weight: 300; 
        cursor: pointer;
        opacity: 0.9; 
        transition: all 0.2s; 
        background: rgba(255, 255, 255, 0.2);
        border: none; 
        color: white; 
        padding: 0; 
        width: 36px; 
        height: 36px;
        display: flex; 
        align-items: center; 
        justify-content: center;
        border-radius: 8px;
    }

    .modal-header .close:hover { 
        opacity: 1;
        background: rgba(255, 255, 255, 0.3);
        transform: rotate(90deg);
    }

    #reportDetailsContent {
        overflow-y: auto; 
        max-height: calc(90vh - 80px);
        padding: 20px;
    }

    #generateReportForm {
        overflow-y: auto;
        max-height: calc(90vh - 200px);
        padding: 30px;
        scrollbar-width: thin;
        scrollbar-color: #f857a6 #f5f5f5;
    }

    #generateReportForm::-webkit-scrollbar {
        width: 8px;
    }

    #generateReportForm::-webkit-scrollbar-track {
        background: #f5f5f5;
        border-radius: 10px;
    }

    #generateReportForm::-webkit-scrollbar-thumb {
        background: linear-gradient(135deg, #f857a6 0%, #ff5858 100%);
        border-radius: 10px;
    }

    #generateReportForm::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(135deg, #ff5858 0%, #f857a6 100%);
    }

    .form-group {
        margin-bottom: 24px;
        animation: fadeInUp 0.3s ease-out;
    }

    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .form-group label {
        display: block; 
        margin-bottom: 10px; 
        font-weight: 600;
        color: #2c3e50; 
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .form-group label::before {
        content: '';
        width: 4px;
        height: 16px;
        background: linear-gradient(135deg, #f857a6 0%, #ff5858 100%);
        border-radius: 2px;
    }

    .form-group input[type="text"],
    .form-group input[type="date"],
    .form-group select,
    .form-group textarea {
        width: 100%; 
        padding: 12px 16px; 
        border: 2px solid #e1e8ed;
        border-radius: 10px; 
        font-size: 14px; 
        font-family: inherit;
        transition: all 0.3s ease;
        background: #fafafa;
    }

    .form-group input[type="text"]:hover,
    .form-group input[type="date"]:hover,
    .form-group select:hover,
    .form-group textarea:hover {
        border-color: #f857a6;
        background: white;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
        outline: none; 
        border-color: #f857a6;
        background: white;
        box-shadow: 0 0 0 4px rgba(248, 87, 166, 0.1);
    }

    .form-group textarea {
        resize: vertical;
        min-height: 80px;
    }

    .form-row {
        display: grid; 
        grid-template-columns: 1fr 1fr; 
        gap: 20px;
        margin-bottom: 24px;
    }

    .checkbox-group, .radio-group {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        padding: 16px;
        background: #f8f9fa;
        border-radius: 10px;
        border: 2px solid #e1e8ed;
    }

    .checkbox-item, .radio-item {
        display: flex; 
        align-items: center; 
        gap: 10px; 
        cursor: pointer;
        padding: 10px 12px;
        border-radius: 8px;
        transition: all 0.2s ease;
        background: white;
        border: 2px solid transparent;
    }

    .checkbox-item:hover, .radio-item:hover {
        background: #fff;
        border-color: #f857a6;
        transform: translateX(4px);
    }

    .checkbox-item input[type="checkbox"],
    .radio-item input[type="radio"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
        accent-color: #f857a6;
    }

    .checkbox-item span,
    .radio-item span {
        font-size: 14px;
        color: #2c3e50;
        font-weight: 500;
    }

    .form-actions {
        display: flex; 
        justify-content: space-between; 
        gap: 12px;
        margin-top: 0;
        padding: 20px 30px;
        border-top: 2px solid #f0f0f0;
        background: #fafafa;
        border-radius: 0 0 16px 16px;
    }

    .form-section-title {
        font-size: 16px;
        font-weight: 600;
        color: #2c3e50;
        margin-bottom: 16px;
        padding-bottom: 10px;
        border-bottom: 2px solid #f0f0f0;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .form-section-title i {
        color: #f857a6;
        font-size: 18px;
    }

    .form-section {
        margin-bottom: 32px;
        padding-bottom: 24px;
        border-bottom: 2px dashed #e1e8ed;
    }

    .form-section:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
    }

    .date-preset-btn {
        padding: 8px 16px;
        border: 2px solid #e1e8ed;
        background: white;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        color: #2c3e50;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .date-preset-btn:hover {
        background: linear-gradient(135deg, #f857a6 0%, #ff5858 100%);
        border-color: #f857a6;
        color: white;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(248, 87, 166, 0.3);
    }

    .date-preset-btn i {
        font-size: 12px;
    }

    /* Info badge */
    .info-badge {
        display: inline-block;
        padding: 4px 10px;
        background: #e3f2fd;
        color: #1976d2;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        margin-left: 8px;
    }

    /* Form helper text */
    .form-helper {
        font-size: 12px;
        color: #999;
        margin-top: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .form-helper i {
        color: #f857a6;
        font-size: 14px;
    }

    /* Required field indicator */
    .required-indicator {
        color: #ff5858;
        margin-left: 4px;
        font-weight: 600;
    }

    /* Select arrow styling */
    .form-group select {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23f857a6' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
        background-size: 12px;
        padding-right: 40px;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
    }

    /* Improved checkbox/radio styling */
    .checkbox-item input[type="checkbox"]:checked,
    .radio-item input[type="radio"]:checked {
        background: linear-gradient(135deg, #f857a6 0%, #ff5858 100%);
    }

    /* Form validation states */
    .form-group input:invalid:not(:placeholder-shown),
    .form-group select:invalid:not(:placeholder-shown) {
        border-color: #ff5858;
    }

    .form-group input:valid:not(:placeholder-shown),
    .form-group select:valid:not(:placeholder-shown) {
        border-color: #4caf50;
    }

    /* Loading state for submit button */
    #generateSubmitBtn.loading {
        pointer-events: none;
        opacity: 0.7;
    }

    #generateSubmitBtn.loading i {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    /* ========================================
       REPORT DETAILS STYLING
       ======================================== */

    .report-details-container {
        padding: 0;
    }

    .report-details-header {
        background: linear-gradient(135deg, #f857a6 0%, #ff5858 100%);
        color: white;
        padding: 30px;
        display: flex;
        align-items: center;
        gap: 20px;
        border-radius: 12px 12px 0 0;
        margin: -20px -20px 30px -20px;
    }

    .report-icon {
        width: 70px;
        height: 70px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
    }

    .report-meta h2 {
        margin: 0 0 10px 0;
        font-size: 24px;
        font-weight: 700;
    }

    .report-info {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
        opacity: 0.95;
        font-size: 14px;
    }

    .report-info span {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .summary-section {
        margin-bottom: 35px;
        padding: 0 20px;
    }

    .section-title {
        font-size: 20px;
        font-weight: 700;
        color: #2c3e50;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 3px solid #f857a6;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .section-title i {
        color: #f857a6;
        font-size: 22px;
    }

    .metrics-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
    }

    .metric-card {
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border-radius: 12px;
        padding: 20px;
        display: flex;
        align-items: center;
        gap: 15px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        transition: all 0.3s ease;
        border: 2px solid transparent;
    }

    .metric-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 24px rgba(248, 87, 166, 0.2);
        border-color: #f857a6;
    }

    .metric-icon {
        font-size: 32px;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #f857a6 0%, #ff5858 100%);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .metric-content {
        flex: 1;
    }

    .metric-label {
        font-size: 13px;
        color: #666;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 5px;
    }

    .metric-value {
        font-size: 24px;
        font-weight: 700;
        color: #2c3e50;
    }

    .report-section {
        margin-bottom: 35px;
        padding: 0 20px;
    }

    .demographics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 25px;
    }

    .demo-card {
        background: white;
        border-radius: 12px;
        padding: 25px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        border: 2px solid #f0f0f0;
    }

    .demo-card h4 {
        margin: 0 0 20px 0;
        color: #2c3e50;
        font-size: 16px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .demo-card h4 i {
        color: #f857a6;
    }

    .chart-bars {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .bar-item {
        display: grid;
        grid-template-columns: 100px 1fr 50px;
        align-items: center;
        gap: 12px;
    }

    .bar-label {
        font-size: 13px;
        font-weight: 600;
        color: #666;
    }

    .bar-container {
        height: 24px;
        background: #f0f0f0;
        border-radius: 12px;
        overflow: hidden;
    }

    .bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #f857a6 0%, #ff5858 100%);
        border-radius: 12px;
        transition: width 0.5s ease;
    }

    .bar-value {
        font-size: 14px;
        font-weight: 700;
        color: #2c3e50;
        text-align: right;
    }

    .data-table-container {
        overflow-x: auto;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }

    .data-table {
        width: 100%;
        border-collapse: collapse;
    }

    .data-table thead {
        background: linear-gradient(135deg, #f857a6 0%, #ff5858 100%);
    }

    .data-table thead th {
        padding: 16px;
        text-align: left;
        color: white;
        font-weight: 700;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .data-table tbody tr {
        border-bottom: 1px solid #f0f0f0;
        transition: background 0.2s ease;
    }

    .data-table tbody tr:hover {
        background: #fff5f8;
    }

    .data-table tbody tr:last-child {
        border-bottom: none;
    }

    .data-table tbody td {
        padding: 14px 16px;
        font-size: 14px;
        color: #2c3e50;
    }

    .patient-id {
        background: #e3f2fd;
        color: #1976d2;
        padding: 4px 10px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 12px;
    }

    .status-badge {
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .status-active, .status-completed {
        background: #e8f5e9;
        color: #2e7d32;
    }

    .status-inactive, .status-cancelled {
        background: #ffebee;
        color: #c62828;
    }

    .status-confirmed {
        background: #e3f2fd;
        color: #1976d2;
    }

    .status-scheduled {
        background: #fff3e0;
        color: #e65100;
    }

    .status-noshow {
        background: #fce4ec;
        color: #c2185b;
    }

    .appointments-timeline {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .appointment-card {
        background: white;
        border-radius: 12px;
        padding: 20px;
        display: grid;
        grid-template-columns: 100px 1fr auto;
        gap: 20px;
        align-items: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        border-left: 5px solid #f857a6;
        transition: all 0.3s ease;
    }

    .appointment-card:hover {
        transform: translateX(5px);
        box-shadow: 0 6px 20px rgba(248, 87, 166, 0.2);
    }

    .appointment-card.status-completed {
        border-left-color: #4caf50;
    }

    .appointment-card.status-cancelled {
        border-left-color: #f44336;
        opacity: 0.7;
    }

    .apt-time {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        color: #f857a6;
        font-size: 18px;
    }

    .apt-time i {
        font-size: 24px;
    }

    .apt-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .apt-patient {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        color: #2c3e50;
    }

    .apt-patient i {
        color: #f857a6;
    }

    .apt-type {
        font-size: 14px;
        color: #666;
        font-weight: 500;
    }

    .apt-doctor {
        font-size: 13px;
        color: #999;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .apt-doctor i {
        color: #f857a6;
    }

    .apt-status {
        display: flex;
        align-items: center;
    }

    .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: #999;
    }

    .empty-state i {
        font-size: 64px;
        margin-bottom: 20px;
        opacity: 0.5;
    }

    .empty-state p {
        font-size: 16px;
        margin: 0;
    }

    .test-distribution {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 15px;
    }

    .test-item {
        background: white;
        padding: 15px 20px;
        border-radius: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        border-left: 4px solid #f857a6;
    }

    .test-name {
        font-weight: 600;
        color: #2c3e50;
        font-size: 14px;
    }

    .test-count {
        background: linear-gradient(135deg, #f857a6 0%, #ff5858 100%);
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-weight: 700;
        font-size: 13px;
    }

    .alert-section {
        background: #fff5f5;
        border-radius: 12px;
        padding: 25px;
        border: 2px solid #ffebee;
    }

    .alert-section .section-title {
        color: #c62828;
        border-bottom-color: #f44336;
    }

    .alert-section .section-title i {
        color: #f44336;
    }

    .critical-results {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
    }

    .critical-card {
        background: white;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 4px 12px rgba(244, 67, 54, 0.15);
        border: 2px solid #ffcdd2;
    }

    .critical-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding-bottom: 15px;
        border-bottom: 2px solid #ffebee;
    }

    .critical-badge {
        background: #f44336;
        color: white;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
    }

    .critical-date {
        font-size: 13px;
        color: #999;
        font-weight: 600;
    }

    .critical-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .critical-patient {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        color: #2c3e50;
    }

    .critical-patient i {
        color: #f44336;
    }

    .critical-test {
        font-size: 14px;
        color: #666;
        font-weight: 600;
    }

    .critical-value {
        font-size: 16px;
        color: #f44336;
        font-weight: 700;
    }

    .top-medications {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 20px;
    }

    .med-rank-card {
        background: white;
        border-radius: 12px;
        padding: 20px;
        display: flex;
        align-items: center;
        gap: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        border: 2px solid #f0f0f0;
        transition: all 0.3s ease;
    }

    .med-rank-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 24px rgba(248, 87, 166, 0.2);
        border-color: #f857a6;
    }

    .med-rank {
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #f857a6 0%, #ff5858 100%);
        color: white;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        font-weight: 700;
    }

    .med-info {
        flex: 1;
    }

    .med-name {
        font-size: 16px;
        font-weight: 700;
        color: #2c3e50;
        margin-bottom: 5px;
    }

    .med-count {
        font-size: 13px;
        color: #666;
        font-weight: 600;
    }

    .period-banner {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 30px;
        border-radius: 12px;
        text-align: center;
        margin: 0 20px 30px 20px;
        box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
    }

    .period-banner h3 {
        margin: 0 0 10px 0;
        font-size: 28px;
        font-weight: 700;
    }

    .period-banner p {
        margin: 0;
        font-size: 16px;
        opacity: 0.95;
    }

    .info-banner {
        background: #e3f2fd;
        border-left: 5px solid #2196f3;
        padding: 20px;
        border-radius: 8px;
        margin: 0 20px 30px 20px;
        display: flex;
        align-items: center;
        gap: 15px;
    }

    .info-banner i {
        font-size: 24px;
        color: #2196f3;
    }

    .info-banner p {
        margin: 0;
        color: #1565c0;
        font-size: 14px;
        font-weight: 500;
    }

    .revenue-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
    }

    .revenue-card {
        background: white;
        border-radius: 12px;
        padding: 25px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        border-top: 4px solid #4caf50;
        transition: all 0.3s ease;
    }

    .revenue-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 24px rgba(76, 175, 80, 0.2);
    }

    .revenue-service {
        font-size: 14px;
        color: #666;
        font-weight: 600;
        margin-bottom: 10px;
    }

    .revenue-amount {
        font-size: 28px;
        font-weight: 700;
        color: #4caf50;
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
        .report-details-header {
            flex-direction: column;
            text-align: center;
        }

        .metrics-cards {
            grid-template-columns: 1fr;
        }

        .demographics-grid {
            grid-template-columns: 1fr;
        }

        .appointment-card {
            grid-template-columns: 1fr;
            text-align: center;
        }

        .apt-time, .apt-content, .apt-status {
            justify-content: center;
        }

        .bar-item {
            grid-template-columns: 1fr;
            gap: 8px;
        }

        .bar-label, .bar-value {
            text-align: left;
        }
    }

    .btn {
        padding: 12px 28px; 
        border: none; 
        border-radius: 10px;
        font-size: 15px; 
        font-weight: 600; 
        cursor: pointer;
        transition: all 0.3s ease;
        display: inline-flex;
        align-items: center; 
        gap: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-size: 13px;
    }

    .btn i {
        font-size: 16px;
    }

    .btn-primary {
        background: linear-gradient(135deg, #f857a6 0%, #ff5858 100%);
        color: white;
        flex: 1;
    }

    .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(248, 87, 166, 0.4);
    }

    .btn-primary:active {
        transform: translateY(0);
    }

    .btn-secondary {
        background: #6c757d; 
        color: white;
        flex: 1;
    }

    .btn-secondary:hover {
        background: #5a6268;
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(108, 117, 125, 0.3);
    }

    .progress-content {
        padding: 40px; text-align: center;
    }

    .progress-icon {
        font-size: 64px; color: #f857a6; margin-bottom: 20px;
    }

    .progress-content h3 {
        margin: 0 0 10px 0; color: #333;
    }

    .progress-content p {
        color: #666; margin-bottom: 20px;
    }

    .progress-bar {
        width: 100%; height: 8px; background: #e0e0e0;
        border-radius: 4px; overflow: hidden; margin-bottom: 10px;
    }

    .progress-fill {
        height: 100%; background: linear-gradient(90deg, #f857a6 0%, #ff5858 100%);
        transition: width 0.3s ease; width: 0%;
    }

    .progress-percentage {
        font-weight: 600; color: #f857a6; font-size: 18px;
    }

    .reports-table {
        width: 100%; border-collapse: separate; border-spacing: 0;
        background: white; border-radius: 8px; overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .reports-table thead {
        background: linear-gradient(135deg, #f857a6 0%, #ff5858 100%);
    }

    .reports-table thead th {
        padding: 16px 12px; text-align: left; font-weight: 600;
        font-size: 13px; color: white; text-transform: uppercase;
        letter-spacing: 0.5px; border: none;
    }

    .reports-table tbody tr {
        border-bottom: 1px solid #f0f0f0; transition: all 0.2s ease;
    }

    .reports-table tbody tr:hover {
        background: #f8f9ff; transform: scale(1.01);
    }

    .reports-table tbody td {
        padding: 14px 12px; vertical-align: middle;
        font-size: 13px; color: #333;
    }

    .report-name {
        display: flex; align-items: center; gap: 10px; font-weight: 500;
    }

    .report-name i {
        width: 32px; height: 32px; display: flex; align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #f857a6 0%, #ff5858 100%);
        color: white; border-radius: 8px; font-size: 14px;
    }

    .actions {
        display: flex; gap: 6px; justify-content: flex-start;
    }

    .btn-action {
        width: 32px; height: 32px; border: none; background: #f0f0f0;
        color: #666; border-radius: 6px; cursor: pointer; display: flex;
        align-items: center; justify-content: center;
        transition: all 0.2s ease; font-size: 13px;
    }

    .btn-action:hover {
        background: #f857a6; color: white; transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(248, 87, 166, 0.3);
    }

    .btn-action.btn-danger:hover {
        background: #f44336; box-shadow: 0 4px 8px rgba(244, 67, 54, 0.3);
    }

    @media (max-width: 768px) {
        .modal-content { width: 95%; max-height: 95vh; }
        .form-row { grid-template-columns: 1fr; }
        .reports-table { font-size: 12px; }
        .report-name { flex-direction: column; gap: 5px; align-items: flex-start; }
        .actions { flex-wrap: wrap; }
        .btn-action { width: 28px; height: 28px; font-size: 11px; }
    }
`;
document.head.appendChild(style);

console.log('✅ PregnaCare Reports System v2.0 - Fully Loaded');
console.log('📊 Connected Modules:');
console.log('   ✅ Patients');
console.log('   ✅ Appointments');
console.log('   ✅ Lab Results');
console.log('   ✅ Prescriptions');
console.log('🎉 System ready!');