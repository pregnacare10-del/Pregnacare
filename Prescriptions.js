// PregnaCare Prescriptions System - COMPLETE FIXED VERSION
// Author: Claude AI Assistant
// Date: November 2025
// Version: 5.0.0 - Complete fix with working filters

// ========================================
// USER AUTHENTICATION CONFIGURATION
// ========================================

const ADMIN_USER_ID = "0GcKKrWpYkW1WyoSCdQiuwc9HDK2";
const SUB_ADMIN_USER_ID = "pnU0HliFenYYDpP3aLqfIxkkf3Z2";

// ========================================
// FIREBASE CONFIGURATION
// ========================================

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

// Initialize Firebase-related variables
let app, database, auth;
let isFirebaseConnected = false;
let connectionRetryCount = 0;
let maxRetries = 3;

// Global variables
let currentUser = null;
let medicationSystem = null;
let medicationsAuthManager = null;
let prescriptionPrinter = null;

// ========================================
// SAFE DOM HELPER FUNCTIONS
// ========================================

function safeQuerySelector(selector) {
    try {
        return document.querySelector(selector);
    } catch (error) {
        console.warn(`Failed to query selector: ${selector}`, error);
        return null;
    }
}

function safeGetElementById(id) {
    try {
        return document.getElementById(id);
    } catch (error) {
        console.warn(`Failed to get element by ID: ${id}`, error);
        return null;
    }
}

function safeAddEventListener(element, event, handler, options = {}) {
    if (!element) {
        console.warn('Cannot add event listener: element is null');
        return false;
    }
    
    try {
        element.addEventListener(event, handler, options);
        return true;
    } catch (error) {
        console.warn(`Failed to add event listener: ${event}`, error);
        return false;
    }
}

// ========================================
// GLOBAL NOTIFICATION SYSTEM
// ========================================

class NotificationSystem {
    constructor() {
        this.container = this.createContainer();
    }

    createContainer() {
        let container = safeGetElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    show(message, type = 'info', duration = 5000) {
        try {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            
            const icons = {
                success: 'fas fa-check-circle',
                error: 'fas fa-exclamation-circle',
                warning: 'fas fa-exclamation-triangle',
                info: 'fas fa-info-circle'
            };

            toast.innerHTML = `
                <div class="toast-content">
                    <i class="${icons[type] || icons.info}"></i>
                    <span>${message}</span>
                </div>
                <button type="button" class="toast-close" onclick="this.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            `;

            this.container.appendChild(toast);

            // Auto remove after duration
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, duration);

            return toast;
        } catch (error) {
            console.error('Error showing notification:', error);
            return null;
        }
    }
}

// Create global notification system
const notificationSystem = new NotificationSystem();

// Global notification function
window.showNotification = (message, type, module) => {
    return notificationSystem.show(message, type);
};

// ========================================
// PRESCRIPTION HISTORY MANAGER
// ========================================

class PrescriptionHistoryManager {
    constructor() {
        this.historyRef = database ? database.ref('prescriptionHistory') : null;
        this.prescriptionHistory = [];
        this.filteredHistory = [];
        this.historyFilters = {
            patient: '',
            action: '',
            medication: '',
            dateFrom: '',
            dateTo: ''
        };
    }

    showHistoryModal() {
        const modal = safeGetElementById('prescriptionHistoryModal');
        if (!modal) {
            console.error('Prescription history modal not found');
            notificationSystem.show('History modal not available', 'error');
            return;
        }

        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
        
        this.loadPrescriptionHistory();
    }

    async loadPrescriptionHistory() {
        const loadingElement = safeGetElementById('historyLoading');
        const timelineElement = safeGetElementById('historyTimeline');
        const noHistoryElement = safeGetElementById('noHistoryState');

        if (loadingElement) loadingElement.style.display = 'flex';
        if (timelineElement) timelineElement.style.display = 'none';
        if (noHistoryElement) noHistoryElement.style.display = 'none';

        try {
            if (isFirebaseConnected && this.historyRef) {
                const snapshot = await this.historyRef.orderByChild('timestamp').limitToLast(100).once('value');
                
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    this.prescriptionHistory = Object.entries(data).map(([key, value]) => ({
                        id: key,
                        ...value
                    })).reverse();
                } else {
                    this.prescriptionHistory = [];
                }
            } else {
                this.prescriptionHistory = this.generateDemoHistory();
            }

            this.populatePatientFilter();
            this.applyFilters();
            this.displayHistory();

        } catch (error) {
            console.error('Error loading prescription history:', error);
            notificationSystem.show('Failed to load prescription history', 'error');
            this.prescriptionHistory = this.generateDemoHistory();
            this.displayHistory();
        } finally {
            if (loadingElement) loadingElement.style.display = 'none';
        }
    }

    generateDemoHistory() {
        const now = Date.now();
        return [
            {
                id: 'hist_1',
                action: 'added',
                medicationId: 'demo_med1',
                medicationName: 'Prenatal Vitamins',
                patientId: 'PT001',
                patientName: 'Cruz, Maria Elena, Santos',
                prescribedBy: 'Dr. Amina Gerola-Simisim',
                userId: currentUser?.uid || 'demo_user',
                userName: medicationsAuthManager?.userDisplayName || 'Healthcare Provider',
                timestamp: now - 3600000,
                details: {
                    dosage: '1 tablet',
                    frequency: 'Once daily',
                    duration: 270
                },
                changes: {}
            }
        ];
    }

    populatePatientFilter() {
        const patientFilter = safeGetElementById('historyPatientFilter');
        if (!patientFilter || !medicationSystem) return;

        patientFilter.innerHTML = '<option value="">All Patients</option>';

        const uniquePatients = [...new Set(this.prescriptionHistory.map(item => item.patientId))];

        uniquePatients.forEach(patientId => {
            if (patientId) {
                const patient = medicationSystem.allPatients.find(p => p.patientId === patientId);
                const historyItem = this.prescriptionHistory.find(item => item.patientId === patientId);
                
                const patientName = patient ? patient.fullName : (historyItem ? historyItem.patientName : 'Unknown');
                
                const option = document.createElement('option');
                option.value = patientId;
                option.textContent = `${patientId} - ${patientName}`;
                patientFilter.appendChild(option);
            }
        });
    }

    applyFilters() {
        this.filteredHistory = this.prescriptionHistory.filter(item => {
            if (this.historyFilters.patient && item.patientId !== this.historyFilters.patient) {
                return false;
            }

            if (this.historyFilters.action && item.action !== this.historyFilters.action) {
                return false;
            }

            if (this.historyFilters.medication && 
                !item.medicationName.toLowerCase().includes(this.historyFilters.medication.toLowerCase())) {
                return false;
            }

            if (this.historyFilters.dateFrom) {
                const fromDate = new Date(this.historyFilters.dateFrom).getTime();
                if (item.timestamp < fromDate) {
                    return false;
                }
            }

            if (this.historyFilters.dateTo) {
                const toDate = new Date(this.historyFilters.dateTo).getTime() + 86400000;
                if (item.timestamp > toDate) {
                    return false;
                }
            }

            return true;
        });
    }

    displayHistory() {
        const timelineElement = safeGetElementById('historyTimeline');
        const noHistoryElement = safeGetElementById('noHistoryState');
        const loadingElement = safeGetElementById('historyLoading');

        if (!timelineElement) return;

        if (loadingElement) loadingElement.style.display = 'none';

        timelineElement.innerHTML = '';

        if (this.filteredHistory.length === 0) {
            timelineElement.style.display = 'none';
            if (noHistoryElement) {
                noHistoryElement.style.display = 'flex';
                if (this.prescriptionHistory.length > 0) {
                    noHistoryElement.innerHTML = `
                        <div class="no-history-icon">
                            <i class="fas fa-filter"></i>
                        </div>
                        <h3>No Results Found</h3>
                        <p>No prescription activities match your current filters. Try adjusting your search criteria.</p>
                    `;
                }
            }
            return;
        }

        timelineElement.style.display = 'block';
        if (noHistoryElement) noHistoryElement.style.display = 'none';

        this.filteredHistory.forEach(item => {
            const historyItem = this.createHistoryItem(item);
            if (historyItem) {
                timelineElement.appendChild(historyItem);
            }
        });
    }

    createHistoryItem(item) {
        try {
            const historyDiv = document.createElement('div');
            historyDiv.className = `history-item ${item.action}`;

            const timestamp = new Date(item.timestamp);
            const timeString = timestamp.toLocaleString();
            const relativeTime = this.getRelativeTime(timestamp);

            historyDiv.innerHTML = `
                <div class="history-header">
                    <div class="history-action">
                        <span class="history-action-type ${item.action}">
                            <i class="fas ${this.getActionIcon(item.action)}"></i>
                            ${this.getActionText(item.action)}
                        </span>
                        <h4 style="margin: 8px 0; color: #1f2937;">${item.medicationName}</h4>
                    </div>
                    <div class="history-timestamp">
                        <i class="fas fa-clock"></i>
                        <span title="${timeString}">${relativeTime}</span>
                    </div>
                </div>
            `;

            return historyDiv;
        } catch (error) {
            console.error('Error creating history item:', error);
            return null;
        }
    }

    getActionIcon(action) {
        const icons = {
            added: 'fa-plus',
            modified: 'fa-edit',
            deleted: 'fa-trash',
            completed: 'fa-check-circle'
        };
        return icons[action] || 'fa-info';
    }

    getActionText(action) {
        const texts = {
            added: 'Added',
            modified: 'Modified',
            deleted: 'Deleted',
            completed: 'Completed'
        };
        return texts[action] || 'Updated';
    }

    getRelativeTime(date) {
        try {
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins} minutes ago`;
            if (diffHours < 24) return `${diffHours} hours ago`;
            if (diffDays < 7) return `${diffDays} days ago`;
            return date.toLocaleDateString();
        } catch (error) {
            console.error('Error calculating relative time:', error);
            return 'Unknown time';
        }
    }

    async logPrescriptionActivity(action, medicationData, changes = {}) {
        if (!medicationData) return;

        try {
            const historyEntry = {
                action: action,
                medicationId: medicationData.id,
                medicationName: medicationData.medicationName,
                patientId: medicationData.patientId,
                patientName: medicationData.patientName,
                prescribedBy: medicationData.prescribedBy,
                userId: currentUser?.uid || 'unknown',
                userName: medicationsAuthManager?.userDisplayName || 'Unknown User',
                timestamp: Date.now(),
                details: {
                    dosage: medicationData.dosage,
                    frequency: medicationData.frequency,
                    duration: medicationData.duration,
                    instructions: medicationData.instructions
                },
                changes: changes
            };

            if (isFirebaseConnected && this.historyRef) {
                await this.historyRef.push(historyEntry);
            } else {
                this.prescriptionHistory.unshift(historyEntry);
            }

            console.log('Prescription activity logged:', action, medicationData.medicationName);
        } catch (error) {
            console.error('Error logging prescription activity:', error);
        }
    }

    setupFilterListeners() {
        const filterElements = [
            'historyPatientFilter',
            'historyActionFilter',
            'historyMedicationFilter',
            'historyDateFrom',
            'historyDateTo'
        ];

        filterElements.forEach(filterId => {
            const element = safeGetElementById(filterId);
            if (element) {
                safeAddEventListener(element, 'change', (e) => {
                    const value = e.target.value;
                    
                    if (filterId === 'historyMedicationFilter') {
                        this.historyFilters.medication = value;
                    } else if (filterId === 'historyDateFrom') {
                        this.historyFilters.dateFrom = value;
                    } else if (filterId === 'historyDateTo') {
                        this.historyFilters.dateTo = value;
                    } else if (filterId === 'historyPatientFilter') {
                        this.historyFilters.patient = value;
                    } else if (filterId === 'historyActionFilter') {
                        this.historyFilters.action = value;
                    }

                    this.applyFilters();
                    this.displayHistory();
                });

                if (filterId === 'historyMedicationFilter') {
                    safeAddEventListener(element, 'input', (e) => {
                        this.historyFilters.medication = e.target.value;
                        clearTimeout(this.filterTimeout);
                        this.filterTimeout = setTimeout(() => {
                            this.applyFilters();
                            this.displayHistory();
                        }, 300);
                    });
                }
            }
        });
    }

    closeHistoryModal() {
        const modal = safeGetElementById('prescriptionHistoryModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    }
}

// ========================================
// PRESCRIPTION PRINTING FUNCTIONALITY
// ========================================

class PrescriptionPrinter {
    constructor() {
        this.doctorInfo = {
            name: "AMINA P. GEROLA-SIMISIM, M.D., MPH, FPOGS",
            credentials: "OBSTETRICIAN - GYNECOLOGIST",
            address: "EF Square Building, Mc Arthur Highway Urdaneta City, Pangasinan",
            licenseNumber: "107367",
            ptrNumber: "0123456789"
        };
        this.currentMedicationId = null;
        this.currentPrescriptionContent = null;
        this.currentPrintMode = 'newWindow';
        this.setupPrintEventListeners();
    }

    setupPrintEventListeners() {
        const printPrescriptionBtn = safeGetElementById('printPrescriptionBtn');
        if (printPrescriptionBtn) {
            safeAddEventListener(printPrescriptionBtn, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showPrescriptionSelectionModal();
            });
        }

        const printFromDetailsBtn = safeGetElementById('printFromDetailsBtn');
        if (printFromDetailsBtn) {
            safeAddEventListener(printFromDetailsBtn, 'click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const detailsModal = safeGetElementById('medicationDetailsModal');
                const medicationId = detailsModal?.dataset?.medicationId;
                
                if (medicationId) {
                    await this.printPrescription(medicationId);
                } else {
                    notificationSystem.show('No medication selected for printing', 'error');
                }
            });
        }

        const setupPrintOptionButton = (btnId, mode) => {
            const btn = safeGetElementById(btnId);
            if (btn) {
                safeAddEventListener(btn, 'click', () => {
                    this.currentPrintMode = mode;
                    this.closePrintOptionsModal();
                    this.executePrint();
                });
            }
        };

        setupPrintOptionButton('printNewWindowBtn', 'newWindow');
        setupPrintOptionButton('printDirectBtn', 'direct');
        setupPrintOptionButton('printPreviewBtn', 'preview');

        safeAddEventListener(document, 'click', async (e) => {
            if (e.target.classList.contains('print-prescription-btn')) {
                e.preventDefault();
                const medicationId = e.target.dataset.medicationId;
                if (medicationId) {
                    await this.printPrescription(medicationId);
                    this.closePrescriptionSelectionModal();
                }
            }
        });
    }

    showPrescriptionSelectionModal() {
        if (!medicationSystem || !medicationSystem.medications || medicationSystem.medications.length === 0) {
            notificationSystem.show('No prescriptions available to print', 'warning');
            return;
        }

        const modal = safeGetElementById('prescriptionSelectionModal');
        const body = safeGetElementById('prescriptionSelectionBody');
        
        if (!modal || !body) {
            notificationSystem.show('Prescription selection not available', 'error');
            return;
        }

        body.innerHTML = '';

        try {
            const medicationsByPatient = {};
            medicationSystem.medications.forEach(medication => {
                const patientId = medication.patientId;
                if (!medicationsByPatient[patientId]) {
                    medicationsByPatient[patientId] = [];
                }
                medicationsByPatient[patientId].push(medication);
            });

            Object.keys(medicationsByPatient).forEach(patientId => {
                const medications = medicationsByPatient[patientId];
                const patient = medicationSystem.allPatients.find(p => p.patientId === patientId);
                const patientName = patient ? patient.fullName : medications[0].patientName;

                const patientSection = this.createPatientSection(patientId, patientName, medications);
                if (patientSection) {
                    body.appendChild(patientSection);
                }
            });

            modal.style.display = 'flex';
            document.body.classList.add('modal-open');
        } catch (error) {
            console.error('Error showing prescription selection modal:', error);
            notificationSystem.show('Error loading prescription selection', 'error');
        }
    }

    createPatientSection(patientId, patientName, medications) {
        try {
            const patientSection = document.createElement('div');
            patientSection.style.cssText = `
                margin-bottom: 20px;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                overflow: hidden;
            `;

            const patientHeader = document.createElement('div');
            patientHeader.style.cssText = `
                background: var(--pale-pink);
                padding: 12px 16px;
                font-weight: 600;
                color: var(--deep-red);
                border-bottom: 1px solid #e0e0e0;
            `;
            patientHeader.textContent = `${patientName} (${patientId})`;

            const medicationsList = document.createElement('div');
            medicationsList.style.padding = '12px';

            medications.forEach(medication => {
                const medicationItem = this.createMedicationItem(medication);
                if (medicationItem) {
                    medicationsList.appendChild(medicationItem);
                }
            });

            patientSection.appendChild(patientHeader);
            patientSection.appendChild(medicationsList);
            
            return patientSection;
        } catch (error) {
            console.error('Error creating patient section:', error);
            return null;
        }
    }

    createMedicationItem(medication) {
        try {
            const medicationItem = document.createElement('div');
            medicationItem.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                border: 1px solid #f0f0f0;
                border-radius: 6px;
                margin-bottom: 8px;
                background: white;
            `;

            const medicationInfo = document.createElement('div');
            medicationInfo.innerHTML = `
                <div style="font-weight: 600; color: var(--dark-gray); margin-bottom: 4px;">
                    ${medication.medicationName}
                </div>
                <div style="font-size: 12px; color: var(--gray-text);">
                    ${medication.dosage} • ${medication.frequency} • ${medication.duration} days
                </div>
                <div style="font-size: 12px; color: var(--gray-text);">
                    Prescribed: ${this.formatDate(medication.startDate)} by ${medication.prescribedBy}
                </div>
            `;

            const printButton = document.createElement('button');
            printButton.className = 'btn-primary print-prescription-btn';
            printButton.dataset.medicationId = medication.id;
            printButton.innerHTML = '<i class="fas fa-print"></i> Print';
            printButton.style.minWidth = '80px';

            medicationItem.appendChild(medicationInfo);
            medicationItem.appendChild(printButton);
            
            return medicationItem;
        } catch (error) {
            console.error('Error creating medication item:', error);
            return null;
        }
    }

    closePrescriptionSelectionModal() {
        const modal = safeGetElementById('prescriptionSelectionModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    }

    showPrintOptionsModal(medicationId, prescriptionContent) {
        this.currentMedicationId = medicationId;
        this.currentPrescriptionContent = prescriptionContent;
        
        const modal = safeGetElementById('printOptionsModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    closePrintOptionsModal() {
        const modal = safeGetElementById('printOptionsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    executePrint() {
        if (!this.currentPrescriptionContent) return;

        try {
            switch (this.currentPrintMode) {
                case 'newWindow':
                    this.printInNewWindow();
                    break;
                case 'direct':
                    this.printDirectly();
                    break;
                case 'preview':
                    this.showPrintPreview();
                    break;
            }
        } catch (error) {
            console.error('Error executing print:', error);
            notificationSystem.show('Print execution failed', 'error');
        }
    }

    printInNewWindow() {
        try {
            const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
            if (!printWindow) {
                notificationSystem.show('Popup blocked. Please allow popups for this site.', 'error');
                return;
            }

            printWindow.document.write(this.currentPrescriptionContent);
            printWindow.document.close();

            printWindow.onload = function() {
                setTimeout(() => {
                    printWindow.print();
                }, 500);
            };
            
            notificationSystem.show('Prescription opened in new window', 'success');
        } catch (error) {
            console.error('Error printing in new window:', error);
            notificationSystem.show('Failed to open print window', 'error');
        }
    }

    printDirectly() {
        try {
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px;';
            document.body.appendChild(iframe);

            iframe.contentDocument.write(this.currentPrescriptionContent);
            iframe.contentDocument.close();

            setTimeout(() => {
                iframe.contentWindow.print();
                setTimeout(() => {
                    if (iframe.parentNode) {
                        document.body.removeChild(iframe);
                    }
                }, 1000);
            }, 500);
            
            notificationSystem.show('Prescription sent to printer', 'success');
        } catch (error) {
            console.error('Error printing directly:', error);
            notificationSystem.show('Direct printing failed', 'error');
        }
    }

    showPrintPreview() {
        try {
            const previewModal = document.createElement('div');
            previewModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            `;

            const previewContent = document.createElement('div');
            previewContent.style.cssText = `
                background: white;
                border-radius: 8px;
                max-width: 900px;
                width: 100%;
                max-height: 90vh;
                overflow: hidden;
                position: relative;
                display: flex;
                flex-direction: column;
            `;

            const previewHeader = document.createElement('div');
            previewHeader.style.cssText = `
                padding: 15px 20px;
                border-bottom: 1px solid #ddd;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: var(--heart-red);
                color: white;
                border-radius: 8px 8px 0 0;
                flex-shrink: 0;
            `;
            previewHeader.innerHTML = `
                <h3 style="margin: 0;">Prescription Preview</h3>
                <div>
                    <button id="previewPrintBtn" style="margin-right: 10px; padding: 8px 16px; background: white; color: var(--heart-red); border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
                        <i class="fas fa-print"></i> Print
                    </button>
                    <button id="previewCloseBtn" style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            `;

            const previewBody = document.createElement('div');
            previewBody.style.cssText = `
                padding: 20px;
                overflow: auto;
                flex: 1;
                background: #f5f5f5;
                display: flex;
                align-items: flex-start;
                justify-content: center;
            `;
            
            const iframeContainer = document.createElement('div');
            iframeContainer.style.cssText = `
                width: 680px;
                height: 880px;
                overflow: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                background: white;
                position: relative;
                margin: 10px auto;
            `;
            
            const iframe = document.createElement('iframe');
            iframe.style.cssText = `
                width: 850px;
                height: 1100px;
                border: none;
                background: white;
                transform: scale(0.8);
                transform-origin: 0 0;
                display: block;
            `;
            
            iframeContainer.appendChild(iframe);
            previewBody.appendChild(iframeContainer);
            previewContent.appendChild(previewHeader);
            previewContent.appendChild(previewBody);
            previewModal.appendChild(previewContent);
            document.body.appendChild(previewModal);

            iframe.contentDocument.write(this.currentPrescriptionContent);
            iframe.contentDocument.close();
            
            setTimeout(() => {
                if (iframe.contentDocument && iframe.contentDocument.body) {
                    iframe.contentDocument.body.style.overflow = 'visible';
                    iframe.contentWindow.scrollTo(0, 0);
                }
            }, 100);

            const printBtn = previewModal.querySelector('#previewPrintBtn');
            const closeBtn = previewModal.querySelector('#previewCloseBtn');
            
            if (printBtn) {
                safeAddEventListener(printBtn, 'click', () => {
                    this.printDirectly();
                    if (previewModal.parentNode) {
                        document.body.removeChild(previewModal);
                    }
                });
            }

            if (closeBtn) {
                safeAddEventListener(closeBtn, 'click', () => {
                    if (previewModal.parentNode) {
                        document.body.removeChild(previewModal);
                    }
                });
            }

            safeAddEventListener(previewModal, 'click', (e) => {
                if (e.target === previewModal) {
                    if (previewModal.parentNode) {
                        document.body.removeChild(previewModal);
                    }
                }
            });
        } catch (error) {
            console.error('Error showing print preview:', error);
            notificationSystem.show('Preview failed to load', 'error');
        }
    }

    async printPrescription(medicationId) {
        try {
            console.log('Printing prescription for medication ID:', medicationId);

            if (!medicationSystem || !medicationSystem.medications) {
                throw new Error('Medication system not available');
            }

            const medication = medicationSystem.medications.find(m => m.id === medicationId);
            if (!medication) {
                throw new Error('Medication not found');
            }

            const patient = medicationSystem.allPatients.find(p => p.patientId === medication.patientId);
            const patientData = {
                name: patient ? patient.fullName : medication.patientName,
                age: patient ? patient.age : 'N/A',
                id: medication.patientId,
                address: patient ? (patient.address || 'N/A') : 'N/A'
            };

            const prescriptionContent = this.generatePrescriptionHTML(medication, patientData);

            this.currentMedicationId = medicationId;
            this.currentPrescriptionContent = prescriptionContent;

            this.showPrintOptionsModal(medicationId, prescriptionContent);

            if (medicationsAuthManager && medicationsAuthManager.initialized) {
                await medicationsAuthManager.logUserActivity('print_prescription', {
                    medicationId: medicationId,
                    patientId: medication.patientId,
                    medicationName: medication.medicationName
                });
            }

        } catch (error) {
            console.error('Error printing prescription:', error);
            notificationSystem.show(`Failed to print prescription: ${error.message}`, 'error');
        }
    }

    generatePrescriptionHTML(medication, patient) {
        const currentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const formatMedicationContent = () => {
            let content = `${medication.medicationName}\n\n`;
            
            if (medication.instructions) {
                content += `Sig: ${medication.instructions}\n\n`;
            }
            
            content += `Dosage: ${medication.dosage}\n`;
            content += `Frequency: ${medication.frequency || 'As directed'}\n`;
            content += `Duration: ${medication.duration} days\n\n`;
            
            if (medication.refillReminder) {
                content += `Refill: ${medication.refillReminder} days before completion\n`;
            }
            
            return content;
        };

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prescription</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { overflow: auto; }
        body { 
            font-family: 'Times New Roman', serif; 
            margin: 0; 
            padding: 0; 
            color: #000; 
            background: white; 
            line-height: 1.3; 
            font-size: 12px; 
        }
        .prescription-form { 
            width: 210mm; 
            height: 297mm; 
            margin: 0 auto; 
            background: white; 
            border: 2px solid #000; 
            padding: 0; 
            position: relative; 
            box-sizing: border-box; 
            page-break-inside: avoid;
            page-break-after: avoid;
        }
        .prescription-header { 
            text-align: center; 
            border-bottom: 2px solid #000; 
            padding: 15px 25px; 
            background: white; 
        }
        .doctor-name { 
            font-size: 18px; 
            font-weight: bold; 
            margin-bottom: 5px; 
            letter-spacing: 0.5px; 
            color: #000; 
        }
        .doctor-credentials { 
            font-size: 14px; 
            margin-bottom: 8px; 
            font-weight: normal; 
            color: #000; 
        }
        .clinic-address { 
            font-size: 11px; 
            line-height: 1.4; 
            margin-bottom: 0; 
            color: #000; 
        }
        .patient-info-section { 
            padding: 12px 25px; 
            border-bottom: 2px solid #000; 
        }
        .patient-top-row { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 10px; 
            gap: 20px; 
        }
        .patient-name-field { 
            display: flex; 
            align-items: center; 
            gap: 8px; 
            flex: 2; 
        }
        .patient-age-field { 
            display: flex; 
            align-items: center; 
            gap: 8px; 
            flex: 0 0 120px; 
        }
        .patient-sex-field { 
            display: flex; 
            align-items: center; 
            gap: 8px; 
            flex: 0 0 100px; 
        }
        .address-date-row { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            gap: 20px; 
            margin-top: 10px; 
        }
        .address-field { 
            display: flex; 
            align-items: center; 
            gap: 8px; 
            flex: 2; 
        }
        .date-field { 
            display: flex; 
            align-items: center; 
            gap: 8px; 
            flex: 0 0 200px; 
        }
        .patient-info-section label { 
            font-weight: bold; 
            font-size: 11px; 
            color: #000; 
            white-space: nowrap; 
        }
        .patient-info-section .value { 
            border-bottom: 1px solid #000; 
            height: 20px; 
            padding: 2px 6px; 
            font-size: 12px; 
            display: inline-block; 
        }
        .patient-name-field .value { 
            min-width: 300px; 
            flex: 1; 
        }
        .patient-age-field .value { 
            width: 60px; 
        }
        .patient-sex-field .value { 
            width: 60px; 
        }
        .address-field .value { 
            flex: 1; 
            min-width: 300px; 
        }
        .date-field .value { 
            width: 150px; 
        }
        .rx-section { 
            padding: 20px 25px 10px 25px; 
            min-height: 420px;
            max-height: 420px;
        }
        .rx-symbol { 
            font-size: 60px; 
            font-weight: bold; 
            color: #000; 
            margin: 0 0 20px 0; 
            font-family: 'Times New Roman', serif; 
            line-height: 0.8; 
        }
        .prescription-content { 
            font-size: 15px; 
            line-height: 1.8; 
            color: #000; 
            white-space: pre-line; 
            min-height: 280px;
            max-height: 280px;
            padding-left: 25px; 
            font-family: 'Times New Roman', serif;
            overflow: hidden;
        }
        .footer-section { 
            position: absolute; 
            bottom: 65px; 
            right: 80px; 
            text-align: left; 
        }
        .doctor-signature-name { 
            font-size: 13px; 
            font-weight: bold; 
            margin-bottom: 4px; 
            color: #000; 
            margin-top: 15px; 
            text-align: left; 
        }
        .license-info { 
            font-size: 11px; 
            color: #000; 
            line-height: 1.5; 
            text-align: left; 
        }
        .bottom-brands { 
            position: absolute; 
            bottom: 15px; 
            left: 25px; 
            right: 25px; 
            display: flex; 
            justify-content: space-between; 
            border-top: 1px dashed #000; 
            padding-top: 8px; 
        }
        .brand-box { 
            border: 1px solid #000; 
            padding: 5px 12px; 
            font-size: 10px; 
            font-weight: bold; 
            text-align: center; 
            background: #f8f8f8; 
            min-width: 70px; 
        }
        @media print { 
            * { 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
            }
            html, body { 
                margin: 0; 
                padding: 0; 
                width: 210mm;
                height: 297mm;
            }
            body { 
                background: white; 
            }
            .prescription-form { 
                width: 210mm; 
                height: 297mm; 
                margin: 0; 
                padding: 0;
                border: 2px solid #000 !important; 
                box-shadow: none; 
                page-break-inside: avoid;
                page-break-after: avoid;
                page-break-before: avoid;
            } 
            @page { 
                size: A4 portrait; 
                margin: 0;
            }
        }
        @media screen { 
            body {
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: flex-start;
                min-height: 100vh;
                background: #e5e5e5;
            }
            .prescription-form { 
                box-shadow: 0 8px 30px rgba(0,0,0,0.15); 
                margin: 0 auto;
            }
        }
    </style>
</head>
<body>
    <div class="prescription-form">
        <div class="prescription-header">
            <div class="doctor-name">${this.doctorInfo.name}</div>
            <div class="doctor-credentials">${this.doctorInfo.credentials}</div>
            <div class="clinic-address">${this.doctorInfo.address}</div>
        </div>
        
        <div class="patient-info-section">
            <div class="patient-top-row">
                <div class="patient-name-field">
                    <label>Patient Name:</label>
                    <span class="value">${patient.name}</span>
                </div>
                <div class="patient-age-field">
                    <label>Age:</label>
                    <span class="value">${patient.age}</span>
                </div>
                <div class="patient-sex-field">
                    <label>Sex:</label>
                    <span class="value">Female</span>
                </div>
            </div>
            <div class="address-date-row">
                <div class="address-field">
                    <label>Address:</label>
                    <span class="value">${patient.address || '_____________________________________________'}</span>
                </div>
                <div class="date-field">
                    <label>Date:</label>
                    <span class="value">${currentDate}</span>
                </div>
            </div>
        </div>
        
        <div class="rx-section">
            <div class="rx-symbol">℞</div>
            <div class="prescription-content">${formatMedicationContent()}</div>
        </div>
        
        <div class="footer-section">
            <div class="doctor-signature-name">${this.doctorInfo.name}</div>
            <div class="license-info">
                ${this.doctorInfo.credentials}<br>
                Lic. No.: ${this.doctorInfo.licenseNumber}<br>
                PTR NO.: ${this.doctorInfo.ptrNumber}
            </div>
        </div>
        
        <div class="bottom-brands">
            <div class="brand-box">NATALAC</div>
            <div class="brand-box">OB MAX</div>
            <div class="brand-box">POLICARD</div>
            <div class="brand-box">PRO-IRON</div>
        </div>
    </div>
</body>
</html>`;
    }

    formatDate(dateString) {
        try {
            if (!dateString) return 'N/A';
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'N/A';
        }
    }
}

// ========================================
// SIMPLIFIED AUTHENTICATION MANAGER
// ========================================

class MedicationsAuthenticationManager {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.isSubAdmin = false;
        this.userDisplayName = '';
        this.userEmail = '';
        this.isAuthenticated = false;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            if (typeof firebase !== 'undefined') {
                await this.setupAuthListener();
            } else {
                this.setupFallbackAuth();
            }
            this.initialized = true;
        } catch (error) {
            console.error('Auth initialization failed:', error);
            this.setupFallbackAuth();
        }
    }

    async setupAuthListener() {
        try {
            let firebaseApp;
            try {
                firebaseApp = firebase.app();
            } catch (error) {
                firebaseApp = firebase.initializeApp(firebaseConfig);
            }

            firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    this.currentUser = user;
                    this.userEmail = user.email;
                    this.isAdmin = user.uid === ADMIN_USER_ID;
                    this.isSubAdmin = user.uid === SUB_ADMIN_USER_ID;
                    this.isAuthenticated = true;
                    
                    await this.setUserDisplayName(user);
                    this.updateUserInterface();
                    
                    window.currentUser = user;
                    
                    if (!window.medicationSystemInitialized) {
                        window.medicationSystemInitialized = true;
                        await initializeApplication();
                    }
                } else {
                    this.showAuthRequiredModal();
                }
            });
        } catch (error) {
            throw error;
        }
    }

    setupFallbackAuth() {
        this.currentUser = {
            uid: 'medications-module-demo',
            displayName: 'Dr. Maria Santos',
            email: 'medications@pregnacare.com'
        };
        this.userDisplayName = 'Dr. Maria Santos';
        this.isAuthenticated = true;
        this.isAdmin = true;
        this.initialized = true;
        this.updateUserInterface();
        
        window.currentUser = this.currentUser;
        
        setTimeout(async () => {
            if (!window.medicationSystemInitialized) {
                window.medicationSystemInitialized = true;
                await initializeApplication();
            }
        }, 100);
    }

    async setUserDisplayName(user) {
        try {
            if (user.displayName && user.displayName.trim()) {
                this.userDisplayName = user.displayName.trim();
                return;
            }

            if (database) {
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

            this.userDisplayName = 'Healthcare Provider';
        } catch (error) {
            console.error('Error getting user display name:', error);
            this.userDisplayName = 'Healthcare Provider';
        }
    }

    updateUserInterface() {
        const sidebarUserInfo = safeQuerySelector('.user p');
        if (sidebarUserInfo) {
            sidebarUserInfo.textContent = this.userDisplayName;
        }
        
        const sidebarUserRole = safeQuerySelector('.user span');
        if (sidebarUserRole) {
            let role = 'Healthcare Provider';
            if (this.isAdmin) role = 'Admin';
            else if (this.isSubAdmin) role = 'Sub-Admin';
            sidebarUserRole.textContent = role;
        }
        
        const sidebarUserInitials = safeQuerySelector('.user .circle');
        if (sidebarUserInitials) {
            const initials = this.userDisplayName
                .split(' ')
                .map(name => name[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
            sidebarUserInitials.textContent = initials || 'HP';
        }
    }

    showAuthRequiredModal() {
        const modal = safeGetElementById('authRequiredModal');
        if (modal) {
            modal.style.display = 'block';
            document.body.classList.add('modal-open');
        } else {
            setTimeout(() => {
                this.redirectToLogin();
            }, 2000);
        }
    }

    async logUserActivity(action, details = {}) {
        if (!this.currentUser || !database) return;
        
        try {
            const activityLog = {
                userId: this.currentUser.uid,
                userEmail: this.currentUser.email,
                userName: this.userDisplayName,
                action: action,
                module: 'medications',
                details: details,
                timestamp: firebase?.database?.ServerValue?.TIMESTAMP || Date.now(),
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
            
            if (firebase && firebase.auth) {
                await firebase.auth().signOut();
            }
            
            this.redirectToLogin();
        } catch (error) {
            console.error('Logout error:', error);
            this.redirectToLogin();
        }
    }

    redirectToLogin() {
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
        window.location.href = 'Admin login.html';
    }

    hasPermission(action) {
        if (this.isAdmin) return true;
        
        const subAdminPermissions = ['view', 'add', 'edit', 'delete'];
        if (this.isSubAdmin) {
            return subAdminPermissions.includes(action);
        }
        
        return ['view'].includes(action);
    }
}

// ========================================
// FIREBASE INITIALIZATION
// ========================================

async function initializeFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK not loaded');
        }

        let firebaseApp;
        try {
            firebaseApp = firebase.app();
        } catch (error) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
        }
        
        app = firebaseApp;
        database = firebase.database(firebaseApp);
        auth = firebase.auth(firebaseApp);
        
        await database.ref('.info/connected').once('value');
        
        isFirebaseConnected = true;
        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('Firebase initialization failed:', error);
        isFirebaseConnected = false;
        return false;
    }
}

// ========================================
// MEDICATION SYSTEM WITH FILTER SUPPORT
// ========================================

class MedicationSystem {
    constructor() {
        this.medicationsRef = database ? database.ref('medications') : null;
        this.patientsRef = database ? database.ref('patients') : null;
        this.medications = [];
        this.allMedicationsBackup = []; // Backup for filtering
        this.allPatients = [];
        this.currentPage = 1;
        this.itemsPerPage = 25;
        this.isLoading = false;
        this.patientsLoaded = false;
        this.sortBy = 'createdAt';
        this.sortOrder = 'desc';
        
        this.prescriptionHistory = new PrescriptionHistoryManager();
        
        this.patientSearchState = {
            isOpen: false,
            selectedPatient: null,
            filteredPatients: [],
            currentQuery: ''
        };

        this.patientSearchInput = null;
        this.patientDropdownList = null;
        this.searchableDropdown = null;
    }

    initialize() {
        console.log('Initializing medication system...');
        this.loadPatients();
        this.loadMedications();
        this.setupFormValidation();
        this.setupMultiSelect();
        this.prescriptionHistory.setupFilterListeners();
    }

    async loadPatients() {
        try {
            if (!this.patientsRef || !isFirebaseConnected) {
                this.allPatients = [
                    { 
                        patientId: 'PT001', 
                        fullName: 'Cruz, Maria Elena, Santos', 
                        key: 'demo1', 
                        age: 28, 
                        status: 'Active',
                        patientType: 'Prenatal' // Added patient type
                    },
                    { 
                        patientId: 'PT002', 
                        fullName: 'Dela Cruz, Anna Mae, Rodriguez', 
                        key: 'demo2', 
                        age: 32, 
                        status: 'Active',
                        patientType: 'Gynecology' // Added patient type
                    },
                    { 
                        patientId: 'PT003', 
                        fullName: 'Lopez, Catherine Rose, Garcia', 
                        key: 'demo3', 
                        age: 25, 
                        status: 'Active',
                        patientType: 'Prenatal' // Added patient type
                    }
                ];
                this.patientsLoaded = true;
                this.populatePatientDropdown();
                return;
            }
            
            this.patientsRef.on('value', (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    this.allPatients = Object.entries(data).map(([key, value]) => ({
                        key: key,
                        patientId: value.patientId || value.id || key,
                        fullName: value.fullName || value.name || 'Unknown',
                        age: value.age || 'N/A',
                        status: value.status || 'Unknown',
                        patientType: value.patientType || 'Unknown', // Get patient type from database
                        ...value
                    }));
                    
                    this.allPatients.sort((a, b) => {
                        const aNum = parseInt(a.patientId.replace('PT', ''));
                        const bNum = parseInt(b.patientId.replace('PT', ''));
                        return aNum - bNum;
                    });
                } else {
                    this.allPatients = [];
                }
                
                this.patientsLoaded = true;
                this.populatePatientDropdown();
                
            }, (error) => {
                console.error('Firebase patients database error:', error);
                this.allPatients = [];
                this.patientsLoaded = true;
                this.populatePatientDropdown();
            });
        } catch (error) {
            console.error('Error setting up patients Firebase listener:', error);
            this.allPatients = [];
            this.patientsLoaded = true;
        }
    }

    initializeSearchableDropdown() {
        const maxRetries = 10;
        let retries = 0;
        
        const tryInitialize = () => {
            this.patientSearchInput = safeGetElementById("patientName");
            this.patientDropdownList = safeGetElementById("patientDropdownList");
            this.searchableDropdown = safeQuerySelector(".searchable-select");
            
            if (!this.patientSearchInput || !this.patientDropdownList || !this.searchableDropdown) {
                retries++;
                if (retries < maxRetries) {
                    setTimeout(tryInitialize, 200);
                    return;
                } else {
                    console.error('Failed to find searchable dropdown elements');
                    return;
                }
            }
            
            this.setupSearchListeners();
        };
        
        tryInitialize();
    }

    setupSearchListeners() {
        safeAddEventListener(this.patientSearchInput, 'input', (e) => this.handlePatientSearch(e));
        safeAddEventListener(this.patientSearchInput, 'focus', (e) => this.handlePatientFocus(e));
        safeAddEventListener(this.patientSearchInput, 'blur', (e) => this.handlePatientBlur(e));
        safeAddEventListener(this.patientDropdownList, 'click', (e) => this.handlePatientOptionClick(e));
        
        if (this.allPatients && this.allPatients.length > 0) {
            this.patientSearchState.filteredPatients = this.getAllPatientsForDropdown();
        }
    }

    handlePatientSearch(e) {
        const query = e.target.value.trim();
        this.patientSearchState.currentQuery = query;
        
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
    }

    handlePatientFocus(e) {
        const query = e.target.value.trim();
        if (query.length > 0) {
            this.openDropdown();
        }
    }

    handlePatientBlur(e) {
        setTimeout(() => {
            this.closeDropdown();
        }, 200);
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
        
        if (!patientKey || !patientId || !patientName) return;
        
        this.patientSearchState.selectedPatient = {
            key: patientKey,
            patientId: patientId,
            name: patientName,
            age: option.dataset.age,
            status: option.dataset.status
        };
        
        this.patientSearchInput.value = patientName;
        this.patientSearchInput.classList.add('has-selection');
        
        const patientIdInput = safeGetElementById('patientId');
        if (patientIdInput) patientIdInput.value = patientId;

        const patientKeyInput = safeGetElementById('patientKey');
        if (patientKeyInput) patientKeyInput.value = patientKey;
        
        this.closeDropdown();
        this.showSelectedPatientInfo();
    }

    clearPatientSelection() {
        this.patientSearchState.selectedPatient = null;
        
        if (this.patientSearchInput) {
            this.patientSearchInput.classList.remove('has-selection');
        }
        
        const patientIdInput = safeGetElementById('patientId');
        if (patientIdInput) patientIdInput.value = '';

        const patientKeyInput = safeGetElementById('patientKey');
        if (patientKeyInput) patientKeyInput.value = '';
        
        const existingInfo = safeQuerySelector('.patient-confirmation');
        if (existingInfo) existingInfo.remove();
    }

    openDropdown() {
        if (!this.searchableDropdown || !this.patientDropdownList) return;
        
        this.patientSearchState.isOpen = true;
        this.searchableDropdown.classList.add('open');
        this.patientDropdownList.style.display = 'block';
    }

    closeDropdown() {
        if (!this.searchableDropdown || !this.patientDropdownList) return;
        
        this.patientSearchState.isOpen = false;
        this.searchableDropdown.classList.remove('open');
        this.patientDropdownList.style.display = 'none';
    }

    getAllPatientsForDropdown() {
        const patients = [];
        
        if (!this.allPatients || this.allPatients.length === 0) return patients;
        
        try {
            this.allPatients.forEach(patient => {
                const patientInfo = this.processPatientData(patient);
                if (patientInfo) patients.push(patientInfo);
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
                patientType: patient.patientType || 'Unknown'
            };
        } catch (error) {
            console.error('Error processing patient data', error);
            return null;
        }
    }

    updateDropdownDisplay() {
        if (!this.patientDropdownList) return;
        
        this.patientDropdownList.innerHTML = '';
        
        if (this.patientSearchState.filteredPatients.length === 0) {
            const noResultsOption = document.createElement('div');
            noResultsOption.className = 'dropdown-item no-results';
            noResultsOption.textContent = 'No patients found';
            this.patientDropdownList.appendChild(noResultsOption);
            return;
        }
        
        this.patientSearchState.filteredPatients.forEach(patient => {
            const option = this.createPatientDropdownOption(patient);
            if (option) {
                this.patientDropdownList.appendChild(option);
            }
        });
    }

    createPatientDropdownOption(patientInfo) {
        try {
            const option = document.createElement('div');
            option.className = 'dropdown-item';
            
            option.dataset.patientKey = patientInfo.key;
            option.dataset.patientId = patientInfo.patientId;
            option.dataset.patientName = patientInfo.name;
            option.dataset.age = patientInfo.age;
            option.dataset.status = patientInfo.status;
            
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
        } catch (error) {
            console.error('Error creating patient dropdown option:', error);
            return null;
        }
    }

    showSelectedPatientInfo() {
        if (!this.patientSearchState.selectedPatient) return;
        
        const existingInfo = safeQuerySelector('.patient-confirmation');
        if (existingInfo) existingInfo.remove();
        
        const searchableSelect = safeQuerySelector('.searchable-select');
        if (!searchableSelect) return;
        
        try {
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
            
            searchableSelect.parentNode.insertBefore(infoDiv, searchableSelect.nextSibling);
        } catch (error) {
            console.error('Error showing patient info:', error);
        }
    }

    populatePatientDropdown() {
        this.patientSearchState.filteredPatients = this.getAllPatientsForDropdown();
        
        if (this.patientDropdownList) {
            this.updateDropdownDisplay();
        }
    }

    async addMedication(medicationData, showToast = true) {
        console.log('Starting to add medication...');
        
        const submitBtn = safeGetElementById('submitBtn');
        if (submitBtn) {
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            submitBtn.disabled = true;
        }
        
        try {
            const requiredFields = ['patientId', 'patientType', 'medicationName', 'dosage', 'prescribedBy', 'startDate', 'duration'];
            const missingFields = [];
            
            requiredFields.forEach(field => {
                if (!medicationData[field] || medicationData[field].toString().trim() === '') {
                    missingFields.push(field);
                }
            });
            
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }

            const selectedPatient = this.allPatients.find(p => p.patientId === medicationData.patientId);
            if (!selectedPatient) {
                throw new Error('Selected patient not found. Please refresh and try again.');
            }
            
            const cleanData = {
                patientId: medicationData.patientId.toString().trim(),
                patientName: selectedPatient.fullName,
                patientKey: selectedPatient.key,
                patientType: medicationData.patientType || selectedPatient.patientType || '',
                medicationName: medicationData.medicationName.toString().trim(),
                medicationType: medicationData.medicationType || '',
                dosage: medicationData.dosage.toString().trim(),
                frequency: medicationData.frequency || '',
                prescribedBy: medicationData.prescribedBy.toString().trim(),
                startDate: medicationData.startDate,
                duration: parseInt(medicationData.duration) || 0,
                priority: medicationData.priority || 'normal',
                instructions: medicationData.instructions || '',
                sideEffects: medicationData.sideEffects || '',
                refillReminder: medicationData.refillReminder ? parseInt(medicationData.refillReminder) : null,
                status: 'active',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                createdBy: currentUser?.uid || 'demo',
                createdByName: medicationsAuthManager?.userDisplayName || 'Demo User'
            };
            
            if (isFirebaseConnected && this.medicationsRef) {
                const newMedicationRef = this.medicationsRef.push();
                cleanData.id = newMedicationRef.key;
                await newMedicationRef.set(cleanData);
                
                await this.prescriptionHistory.logPrescriptionActivity('added', cleanData);
                
                if (medicationsAuthManager && medicationsAuthManager.initialized) {
                    await medicationsAuthManager.logUserActivity('add_medication', {
                        medicationId: newMedicationRef.key,
                        patientId: cleanData.patientId,
                        medicationName: cleanData.medicationName
                    });
                }
                
                if (showToast) {
                    notificationSystem.show(`Medication added successfully for ${selectedPatient.fullName}!`, 'success');
                }
                
                this.closeModal();
                return newMedicationRef.key;
            } else {
                const localId = `local_${Date.now()}`;
                cleanData.id = localId;
                this.medications.push(cleanData);
                
                // Also update backup
                if (!this.allMedicationsBackup) {
                    this.allMedicationsBackup = [];
                }
                this.allMedicationsBackup.push(cleanData);
                
                this.displayMedications();
                
                await this.prescriptionHistory.logPrescriptionActivity('added', cleanData);
                
                if (showToast) {
                    notificationSystem.show('Medication added locally (Database offline)', 'warning');
                }
                
                this.closeModal();
                return localId;
            }
            
        } catch (error) {
            console.error('Error adding medication:', error);
            
            let errorMessage = 'Failed to save medication. ';
            if (error.message.includes('Missing required fields')) {
                errorMessage += error.message;
            } else if (error.message.includes('patient not found')) {
                errorMessage += error.message;
            } else {
                errorMessage += error.message || 'Unknown error occurred.';
            }
            
            notificationSystem.show(errorMessage, 'error');
            throw error;
        } finally {
            if (submitBtn) {
                const originalText = '<i class="fas fa-plus"></i> Add Medication';
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    async updateMedication(medicationId, medicationData) {
        console.log('Starting to update medication...', medicationId);
        
        const submitBtn = safeGetElementById('submitBtn');
        if (submitBtn) {
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            submitBtn.disabled = true;
        }
        
        try {
            const requiredFields = ['patientId', 'patientType', 'medicationName', 'dosage', 'prescribedBy', 'startDate', 'duration'];
            const missingFields = [];
            
            requiredFields.forEach(field => {
                if (!medicationData[field] || medicationData[field].toString().trim() === '') {
                    missingFields.push(field);
                }
            });
            
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }

            const selectedPatient = this.allPatients.find(p => p.patientId === medicationData.patientId);
            if (!selectedPatient) {
                throw new Error('Selected patient not found. Please refresh and try again.');
            }
            
            const cleanData = {
                patientId: medicationData.patientId.toString().trim(),
                patientName: selectedPatient.fullName,
                patientKey: selectedPatient.key,
                patientType: medicationData.patientType || selectedPatient.patientType || '',
                medicationName: medicationData.medicationName.toString().trim(),
                medicationType: medicationData.medicationType || '',
                dosage: medicationData.dosage.toString().trim(),
                frequency: medicationData.frequency || '',
                prescribedBy: medicationData.prescribedBy.toString().trim(),
                startDate: medicationData.startDate,
                duration: parseInt(medicationData.duration) || 0,
                priority: medicationData.priority || 'normal',
                instructions: medicationData.instructions || '',
                sideEffects: medicationData.sideEffects || '',
                refillReminder: medicationData.refillReminder ? parseInt(medicationData.refillReminder) : null,
                status: medicationData.status || 'active',
                updatedAt: Date.now(),
                updatedBy: currentUser?.uid || 'demo',
                updatedByName: medicationsAuthManager?.userDisplayName || 'Demo User'
            };
            
            if (isFirebaseConnected && this.medicationsRef) {
                await this.medicationsRef.child(medicationId).update(cleanData);
                
                await this.prescriptionHistory.logPrescriptionActivity('modified', { ...cleanData, id: medicationId });
                
                if (medicationsAuthManager && medicationsAuthManager.initialized) {
                    await medicationsAuthManager.logUserActivity('update_medication', {
                        medicationId: medicationId,
                        patientId: cleanData.patientId,
                        medicationName: cleanData.medicationName
                    });
                }
                
                notificationSystem.show(`Medication updated successfully for ${selectedPatient.fullName}!`, 'success');
                
                this.closeModal();
                return medicationId;
            } else {
                const index = this.medications.findIndex(m => m.id === medicationId);
                if (index !== -1) {
                    this.medications[index] = { ...this.medications[index], ...cleanData };
                }
                
                // Update backup as well
                const backupIndex = this.allMedicationsBackup.findIndex(m => m.id === medicationId);
                if (backupIndex !== -1) {
                    this.allMedicationsBackup[backupIndex] = { ...this.allMedicationsBackup[backupIndex], ...cleanData };
                }
                
                this.displayMedications();
                
                await this.prescriptionHistory.logPrescriptionActivity('modified', { ...cleanData, id: medicationId });
                
                notificationSystem.show('Medication updated locally (Database offline)', 'warning');
                
                this.closeModal();
                return medicationId;
            }
            
        } catch (error) {
            console.error('Error updating medication:', error);
            
            let errorMessage = 'Failed to update medication. ';
            if (error.message.includes('Missing required fields')) {
                errorMessage += error.message;
            } else if (error.message.includes('patient not found')) {
                errorMessage += error.message;
            } else {
                errorMessage += error.message || 'Unknown error occurred.';
            }
            
            notificationSystem.show(errorMessage, 'error');
            throw error;
        } finally {
            if (submitBtn) {
                const originalText = '<i class="fas fa-save"></i> Update Medication';
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    async loadMedications() {
        if (this.isLoading) return;
        this.isLoading = true;

        const loadingState = safeGetElementById('loadingState');
        const errorState = safeGetElementById('errorState');

        if (loadingState) loadingState.style.display = 'block';
        if (errorState) errorState.style.display = 'none';

        try {
            if (!this.medicationsRef || !isFirebaseConnected) {
                this.medications = [
                    {
                        id: 'demo_med1',
                        patientId: 'PT001',
                        patientName: 'Cruz, Maria Elena, Santos',
                        patientType: 'Prenatal',
                        medicationName: 'Prenatal Vitamins',
                        medicationType: 'Supplement',
                        dosage: '1 tablet',
                        frequency: 'Once daily',
                        prescribedBy: 'Dr. Amina Gerola-Simisim',
                        startDate: '2025-01-01',
                        duration: 270,
                        priority: 'normal',
                        status: 'active',
                        instructions: 'Take with food to reduce nausea',
                        sideEffects: 'Nausea,Constipation',
                        refillReminder: 7,
                        createdAt: Date.now() - 86400000,
                        isDemo: true
                    },
                    {
                        id: 'demo_med2',
                        patientId: 'PT002',
                        patientName: 'Dela Cruz, Anna Mae, Rodriguez',
                        patientType: 'Gynecology',
                        medicationName: 'Folic Acid',
                        medicationType: 'Supplement',
                        dosage: '400mcg',
                        frequency: 'Once daily',
                        prescribedBy: 'Dr. Amina Gerola-Simisim',
                        startDate: '2025-01-15',
                        duration: 90,
                        priority: 'high',
                        status: 'active',
                        instructions: 'Take before conception and during first trimester',
                        sideEffects: 'NoSideEffects',
                        refillReminder: 10,
                        createdAt: Date.now() - 432000000,
                        isDemo: true
                    }
                ];
                
                // Backup medications for filtering
                this.allMedicationsBackup = [...this.medications];
                
                this.displayMedications();
                this.isLoading = false;
                return;
            }
            
            this.medicationsRef.on('value', (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    this.medications = Object.entries(data).map(([key, value]) => ({
                        id: key,
                        ...value
                    }));
                    
                    // Backup medications for filtering
                    this.allMedicationsBackup = [...this.medications];
                    
                    if (medicationsAuthManager && medicationsAuthManager.initialized) {
                        medicationsAuthManager.logUserActivity('view_medications', {
                            count: this.medications.length
                        });
                    }
                } else {
                    this.medications = [];
                    this.allMedicationsBackup = [];
                }
                
                this.displayMedications();
                
                if (loadingState) loadingState.style.display = 'none';
                if (this.medications.length === 0) {
                    this.showNoDataState();
                }
                this.isLoading = false;
            }, (error) => {
                console.error('Firebase database error:', error);
                if (loadingState) loadingState.style.display = 'none';
                if (errorState) errorState.style.display = 'block';
                notificationSystem.show('Failed to load medications from database', 'error');
                this.isLoading = false;
            });
        } catch (error) {
            console.error('Error setting up Firebase listener:', error);
            if (loadingState) loadingState.style.display = 'none';
            if (errorState) errorState.style.display = 'block';
            notificationSystem.show('Failed to connect to database', 'error');
            this.isLoading = false;
        }
    }

    displayMedications() {
        const tableBody = safeGetElementById('medicationsTableBody');
        if (!tableBody) return;
        
        const loadingState = safeGetElementById('loadingState');

        const existingRows = tableBody.querySelectorAll('.medication-row, .table-row, .no-data');
        existingRows.forEach(row => row.remove());

        if (this.medications.length === 0) {
            if (loadingState) loadingState.style.display = 'none';
            this.showNoDataState();
            return;
        }

        const sortedMedications = this.sortMedications(this.medications);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedMedications = sortedMedications.slice(startIndex, endIndex);

        paginatedMedications.forEach(medication => {
            const row = this.createMedicationRow(medication);
            if (row) {
                tableBody.appendChild(row);
            }
        });

        this.updatePagination(this.medications.length);
        if (loadingState) loadingState.style.display = 'none';
    }

    createMedicationRow(medication) {
        try {
            const row = document.createElement('div');
            row.className = 'medication-row';
            
            const patientInfo = this.allPatients.find(p => p.patientId === medication.patientId);
            const patientName = patientInfo ? patientInfo.fullName : (medication.patientName || 'Unknown Patient');
            const patientId = medication.patientId || 'N/A';
            const patientStatus = patientInfo ? ` (${patientInfo.status})` : '';

            row.innerHTML = `
                <div class="row-content" data-label="Patient">
                    <div class="patient-info">
                        <div class="patient-name">${patientName}${patientStatus}</div>
                        <div class="patient-id">ID: ${patientId} • ${medication.patientType || 'N/A'}</div>
                    </div>
                </div>
                <div class="row-content" data-label="Medication">
                    <div class="medication-info">
                        <div class="medication-name">${medication.medicationName}</div>
                        <div class="medication-type">${medication.medicationType || 'N/A'}</div>
                    </div>
                </div>
                <div class="row-content" data-label="Dosage">
                    <div class="dosage-info">
                        <div class="dosage">${medication.dosage}</div>
                        <div class="frequency">${medication.frequency || 'N/A'}</div>
                    </div>
                </div>
                <div class="row-content" data-label="Prescribed By">
                    <div class="doctor-info">
                        <div class="doctor-name">${medication.prescribedBy}</div>
                    </div>
                </div>
                <div class="row-content" data-label="Start Date">
                    <div class="date-info">
                        <div class="start-date">${this.formatDate(medication.startDate)}</div>
                    </div>
                </div>
                <div class="row-content" data-label="Duration">
                    <div class="duration-info">
                        <div class="duration">${medication.duration} days</div>
                    </div>
                </div>
                <div class="row-content" data-label="Status">
                    <div class="status-badge status-${medication.status || 'active'}">
                        ${this.getStatusText(medication.status)}
                    </div>
                </div>
                <div class="action-buttons" data-label="Actions">
                    <button type="button" class="view-btn" data-action="view-medication" data-medication-id="${medication.id}">View</button>
                    <button type="button" class="edit-btn" data-action="edit-medication" data-medication-id="${medication.id}">Edit</button>
                    <button type="button" class="delete-btn" data-action="delete-medication" data-medication-id="${medication.id}">Delete</button>
                </div>
            `;
            return row;
        } catch (error) {
            console.error('Error creating medication row:', error);
            return null;
        }
    }

    sortMedications(medications) {
        return medications.sort((a, b) => {
            let aValue = a[this.sortBy] || '';
            let bValue = b[this.sortBy] || '';
            
            if (this.sortBy === 'startDate' || this.sortBy === 'createdAt') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            } else if (this.sortBy === 'duration') {
                aValue = parseInt(aValue) || 0;
                bValue = parseInt(bValue) || 0;
            } else {
                aValue = aValue.toString().toLowerCase();
                bValue = bValue.toString().toLowerCase();
            }
            
            if (this.sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
    }

    formatDate(dateString) {
        try {
            if (!dateString) return 'N/A';
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'N/A';
        }
    }

    getStatusText(status) {
        const statusMap = {
            'active': 'Active',
            'completed': 'Completed',
            'discontinued': 'Discontinued',
            'paused': 'Paused'
        };
        return statusMap[status] || 'Active';
    }

    updatePagination(totalItems) {
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const paginationInfo = safeGetElementById('paginationInfo');
        const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endIndex = Math.min(startIndex + this.itemsPerPage - 1, totalItems);

        if (paginationInfo) {
            paginationInfo.textContent = totalItems > 0 
                ? `Showing ${startIndex}-${endIndex} of ${totalItems} entries`
                : 'Showing 0 of 0 entries';
        }

        const firstPage = safeGetElementById('firstPage');
        const prevPage = safeGetElementById('prevPage');
        const nextPage = safeGetElementById('nextPage');
        const lastPage = safeGetElementById('lastPage');

        if (firstPage) firstPage.disabled = this.currentPage === 1;
        if (prevPage) prevPage.disabled = this.currentPage === 1;
        if (nextPage) nextPage.disabled = this.currentPage === totalPages || totalPages === 0;
        if (lastPage) lastPage.disabled = this.currentPage === totalPages || totalPages === 0;

        this.updatePageNumbers(totalPages);
    }

    updatePageNumbers(totalPages) {
        const pageNumbers = safeGetElementById('pageNumbers');
        if (!pageNumbers) return;
        
        pageNumbers.innerHTML = '';

        if (totalPages === 0) return;

        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        for (let i = startPage; i <= endPage; i++) {
            const pageSpan = document.createElement('span');
            pageSpan.className = `page-number ${i === this.currentPage ? 'active' : ''}`;
            pageSpan.textContent = i;
            pageSpan.dataset.page = i;
            safeAddEventListener(pageSpan, 'click', () => {
                this.currentPage = i;
                this.displayMedications();
            });
            pageNumbers.appendChild(pageSpan);
        }
    }

    showNoDataState() {
        const tableBody = safeGetElementById('medicationsTableBody');
        if (!tableBody) return;

        const existingRows = tableBody.querySelectorAll('.medication-row, .table-row, .no-data');
        existingRows.forEach(row => row.remove());

        const noDataElement = document.createElement('div');
        noDataElement.className = 'no-data';
        noDataElement.id = 'noDataState';
        
        const hasPatients = this.allPatients.length > 0;
        const message = hasPatients 
            ? 'Use the "Add Prescription" button above to start adding medications to the system.'
            : 'No patients available. Please add patients first before adding medications.';
            
        const actionButton = hasPatients 
            ? '' 
            : '<button class="btn btn-primary" onclick="window.location.href=\'Patients.html\'" style="margin-top: 15px;"><i class="fas fa-user-plus"></i> Add Patients First</button>';
        
        noDataElement.innerHTML = `
            <div class="no-data-icon">
                <i class="fas fa-pills"></i>
            </div>
            <h3>No Medications Found</h3>
            <p>${message}</p>
            ${actionButton}
        `;
        
        tableBody.appendChild(noDataElement);
    }

    validateField(field) {
        const value = field.value ? field.value.toString().trim() : '';
        const fieldName = field.name || field.id;
        const errorElement = safeGetElementById(`${fieldName}Error`);

        if (fieldName === 'patientSelect' || fieldName === 'patientName') {
            if (field.hasAttribute('required') && !value) {
                this.showFieldError(field, errorElement, 'Please select a patient');
                return false;
            }
            
            if (fieldName === 'patientName' && value) {
                if (!this.patientSearchState.selectedPatient) {
                    this.showFieldError(field, errorElement, 'Please select a patient from the dropdown');
                    return false;
                }
            }
        } else if (field.hasAttribute('required') && !value) {
            this.showFieldError(field, errorElement, 'This field is required');
            return false;
        }

        if (fieldName === 'duration' && value) {
            const duration = parseInt(value);
            if (isNaN(duration) || duration < 1 || duration > 365) {
                this.showFieldError(field, errorElement, 'Duration must be between 1 and 365 days');
                return false;
            }
        }

        if (fieldName === 'startDate' && value) {
            const startDate = new Date(value);
            const today = new Date();
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(today.getFullYear() - 1);
            
            if (startDate > today) {
                this.showFieldError(field, errorElement, 'Start date cannot be in the future');
                return false;
            }
            
            if (startDate < oneYearAgo) {
                this.showFieldError(field, errorElement, 'Start date cannot be more than 1 year ago');
                return false;
            }
        }

        this.clearFieldError(field);
        return true;
    }

    setupFormValidation() {
        const form = safeGetElementById('medicationForm');
        if (!form) return;
        
        const inputs = form.querySelectorAll('input[required], select[required]');
        inputs.forEach(input => {
            safeAddEventListener(input, 'blur', () => this.validateField(input));
            safeAddEventListener(input, 'input', () => this.clearFieldError(input));
        });

        const instructionsField = safeGetElementById('instructions');
        const instructionsCounter = safeGetElementById('instructionsCount');
        if (instructionsField && instructionsCounter) {
            safeAddEventListener(instructionsField, 'input', () => {
                const count = instructionsField.value.length;
                instructionsCounter.textContent = count;
                
                const counter = instructionsCounter.closest('.character-counter');
                if (counter) {
                    if (count > 400) {
                        counter.classList.add('danger');
                        counter.classList.remove('warning');
                    } else if (count > 300) {
                        counter.classList.add('warning');
                        counter.classList.remove('danger');
                    } else {
                        counter.classList.remove('warning', 'danger');
                    }
                }
            });
        }
    }

    setupMultiSelect() {
        this.selectedSideEffects = [];
        
        const dropdown = safeGetElementById('dropdownContainer');
        const selectedContainer = safeGetElementById('selectedItems');
        const hiddenInput = safeGetElementById('sideEffects');
        
        if (!dropdown || !selectedContainer || !hiddenInput) return;

        safeAddEventListener(selectedContainer, 'click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
            selectedContainer.classList.toggle('active');
        });

        safeAddEventListener(document, 'click', (e) => {
            if (!e.target.closest('.custom-multiselect')) {
                dropdown.classList.remove('open');
                selectedContainer.classList.remove('active');
            }
        });

        const options = dropdown.querySelectorAll('.option');
        options.forEach(option => {
            safeAddEventListener(option, 'click', (e) => {
                e.stopPropagation();
                const value = option.getAttribute('data-value');
                const text = option.textContent.trim();
                
                if (option.classList.contains('selected')) {
                    this.removeSideEffect(value);
                    option.classList.remove('selected');
                } else {
                    this.addSideEffect(value, text);
                    option.classList.add('selected');
                }
                
                this.updateSideEffectsDisplay();
            });
        });

        this.updateSideEffectsDisplay();
    }

    addSideEffect(value, text) {
        if (!this.selectedSideEffects.find(item => item.value === value)) {
            this.selectedSideEffects.push({ value, text });
        }
    }

    removeSideEffect(value) {
        this.selectedSideEffects = this.selectedSideEffects.filter(item => item.value !== value);
        const option = document.querySelector(`.option[data-value="${value}"]`);
        if (option) {
            option.classList.remove('selected');
        }
    }

    updateSideEffectsDisplay() {
        const selectedContainer = safeGetElementById('selectedItems');
        const hiddenInput = safeGetElementById('sideEffects');
        
        if (!selectedContainer || !hiddenInput) return;
        
        selectedContainer.innerHTML = '';
        
        if (this.selectedSideEffects.length === 0) {
            selectedContainer.innerHTML = '<span class="placeholder">Click to select side effects...</span>';
        } else {
            this.selectedSideEffects.forEach(item => {
                const tag = document.createElement('div');
                tag.className = 'selected-tag';
                tag.innerHTML = `
                    ${item.text}
                    <button type="button" class="remove-tag" data-value="${item.value}">&times;</button>
                `;
                selectedContainer.appendChild(tag);
            });
            
            selectedContainer.querySelectorAll('.remove-tag').forEach(btn => {
                safeAddEventListener(btn, 'click', (e) => {
                    e.stopPropagation();
                    const value = btn.getAttribute('data-value');
                    this.removeSideEffect(value);
                    this.updateSideEffectsDisplay();
                });
            });
        }
        
        hiddenInput.value = this.selectedSideEffects.map(item => item.value).join(',');
    }

    showFieldError(field, errorElement, message) {
        field.classList.add('error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
        }
    }

    clearFieldError(field) {
        field.classList.remove('error');
        const fieldName = field.name || field.id;
        const errorElement = safeGetElementById(`${fieldName}Error`);
        if (errorElement) {
            errorElement.classList.remove('show');
        }
    }

    openModal(isEdit = false, medicationData = null) {
        const modal = safeGetElementById('medicationModal');
        if (!modal) return;
        
        modal.style.display = 'flex';
        
        if (isEdit && medicationData) {
            const modalTitle = safeGetElementById('modalTitle');
            const submitBtn = safeGetElementById('submitBtn');
            
            if (modalTitle) modalTitle.textContent = 'Edit Medication';
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Medication';
                submitBtn.dataset.medicationId = medicationData.id;
            }
            
            setTimeout(() => {
                this.populateForm(medicationData);
                this.initializeSearchableDropdown();
            }, 100);
        } else {
            const modalTitle = safeGetElementById('modalTitle');
            const submitBtn = safeGetElementById('submitBtn');
            
            if (modalTitle) modalTitle.textContent = 'Add New Prescription';
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Prescription';
                delete submitBtn.dataset.medicationId;
            }
            
            this.resetForm();
            
            setTimeout(() => {
                this.initializeSearchableDropdown();
                const startDateField = safeGetElementById('startDate');
                if (startDateField) {
                    const today = new Date().toISOString().split('T')[0];
                    startDateField.value = today;
                }
            }, 100);
        }
        
        if (!this.patientsLoaded) {
            notificationSystem.show('Loading patients data...', 'info');
            const checkPatients = setInterval(() => {
                if (this.patientsLoaded) {
                    clearInterval(checkPatients);
                    this.populatePatientDropdown();
                }
            }, 100);
        } else {
            this.populatePatientDropdown();
        }
    }

    populateForm(medicationData) {
        const form = safeGetElementById('medicationForm');
        if (!form) return;
        
        Object.keys(medicationData).forEach(key => {
            const field = form.querySelector(`[name="${key}"]`);
            if (field) {
                field.value = medicationData[key] || '';
            }
        });

        if (medicationData.patientId && medicationData.patientName) {
            const patient = this.allPatients.find(p => p.patientId === medicationData.patientId);
            if (patient) {
                this.patientSearchState.selectedPatient = {
                    key: patient.key,
                    patientId: patient.patientId,
                    name: patient.fullName,
                    age: patient.age,
                    status: patient.status
                };

                setTimeout(() => {
                    if (this.patientSearchInput) {
                        this.patientSearchInput.value = patient.fullName;
                        this.patientSearchInput.classList.add('has-selection');
                        this.showSelectedPatientInfo();
                    }
                }, 200);
            }
        }

        if (medicationData.sideEffects) {
            this.selectedSideEffects = [];
            const sideEffectsArray = medicationData.sideEffects.split(',');
            
            sideEffectsArray.forEach(value => {
                if (value.trim()) {
                    const option = document.querySelector(`.option[data-value="${value.trim()}"]`);
                    if (option) {
                        const text = option.textContent.trim();
                        this.addSideEffect(value.trim(), text);
                        option.classList.add('selected');
                    }
                }
            });
            
            this.updateSideEffectsDisplay();
        }

        const instructionsField = safeGetElementById('instructions');
        const instructionsCounter = safeGetElementById('instructionsCount');
        if (instructionsField && instructionsCounter) {
            instructionsCounter.textContent = instructionsField.value.length;
        }
    }

    closeModal() {
        const modals = [
            'medicationModal',
            'medicationDetailsModal',
            'confirmationModal',
            'prescriptionHistoryModal'
        ];
        
        modals.forEach(modalId => {
            const modal = safeGetElementById(modalId);
            if (modal) modal.style.display = 'none';
        });
        
        document.body.classList.remove('modal-open');
        this.resetForm();
    }

    resetForm() {
        const form = safeGetElementById('medicationForm');
        if (!form) return;
        
        form.reset();
        const errorElements = form.querySelectorAll('.form-error');
        errorElements.forEach(error => error.classList.remove('show'));
        const inputElements = form.querySelectorAll('input, select, textarea');
        inputElements.forEach(input => input.classList.remove('error'));
        
        const submitBtn = safeGetElementById('submitBtn');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Prescription';
            delete submitBtn.dataset.medicationId;
        }

        const instructionsCounter = safeGetElementById('instructionsCount');
        if (instructionsCounter) {
            instructionsCounter.textContent = '0';
            const counter = instructionsCounter.closest('.character-counter');
            if (counter) {
                counter.classList.remove('warning', 'danger');
            }
        }

        this.clearPatientSelection();

        this.selectedSideEffects = [];
        this.updateSideEffectsDisplay();
        
        const selectedOptions = document.querySelectorAll('.option.selected');
        selectedOptions.forEach(option => option.classList.remove('selected'));
    }

    async deleteMedication(medicationId) {
        try {
            if (!medicationId) {
                notificationSystem.show('Invalid medication ID', 'error');
                return;
            }

            const medication = this.medications.find(m => m.id === medicationId);
            if (!medication) {
                notificationSystem.show('Medication not found', 'error');
                return;
            }

            if (isFirebaseConnected && this.medicationsRef) {
                await this.medicationsRef.child(medicationId).remove();
                notificationSystem.show('Medication deleted successfully', 'success');
                
                if (medicationsAuthManager && medicationsAuthManager.initialized) {
                    await medicationsAuthManager.logUserActivity('delete_medication', {
                        medicationId: medicationId,
                        medicationName: medication.medicationName,
                        patientId: medication.patientId
                    });
                }

                if (this.prescriptionHistory && this.prescriptionHistory.logPrescriptionActivity) {
                    await this.prescriptionHistory.logPrescriptionActivity('deleted', medication);
                }
            } else {
                this.medications = this.medications.filter(m => m.id !== medicationId);
                this.allMedicationsBackup = this.allMedicationsBackup.filter(m => m.id !== medicationId);
                notificationSystem.show('Medication deleted (demo mode)', 'success');
                this.displayMedications();
            }
        } catch (error) {
            console.error('Error deleting medication:', error);
            notificationSystem.show('Failed to delete medication: ' + error.message, 'error');
        }
    }
}

// ========================================
// HELPER FUNCTIONS WITH ERROR HANDLING
// ========================================

function viewMedicationDetails(medicationId) {
    try {
        if (!medicationSystem || !medicationSystem.medications) {
            notificationSystem.show('Medication system not available', 'error');
            return;
        }

        const medication = medicationSystem.medications.find(m => m.id === medicationId);
        if (!medication) {
            notificationSystem.show('Medication not found', 'error');
            return;
        }

        const patientInfo = medicationSystem.allPatients.find(p => p.patientId === medication.patientId);
        const currentPatientName = patientInfo ? patientInfo.fullName : medication.patientName;
        const patientStatus = patientInfo ? patientInfo.status : 'Unknown';

        const modal = safeGetElementById('medicationDetailsModal');
        const body = safeGetElementById('medicationDetailsBody');

        if (!modal || !body) {
            notificationSystem.show('Details modal not available', 'error');
            return;
        }

        modal.dataset.medicationId = medicationId;

        body.innerHTML = `
            <div class="medication-details">
                <div class="detail-section">
                    <h3>Patient Information</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Patient Name:</label>
                            <span>${currentPatientName || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Patient ID:</label>
                            <span>${medication.patientId || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Patient Type:</label>
                            <span class="status-badge status-${medication.patientType?.toLowerCase()}">${medication.patientType || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Patient Status:</label>
                            <span class="status-badge status-${patientStatus.toLowerCase()}">${patientStatus}</span>
                        </div>
                    </div>
                </div>
                <div class="detail-section">
                    <h3>Medication Information</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Medication Name:</label>
                            <span>${medication.medicationName}</span>
                        </div>
                        <div class="detail-item">
                            <label>Type:</label>
                            <span>${medication.medicationType || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Dosage:</label>
                            <span>${medication.dosage}</span>
                        </div>
                        <div class="detail-item">
                            <label>Frequency:</label>
                            <span>${medication.frequency || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Duration:</label>
                            <span>${medication.duration} days</span>
                        </div>
                        <div class="detail-item">
                            <label>Status:</label>
                            <span class="status-badge status-${medication.status || 'active'}">
                                ${medicationSystem.getStatusText(medication.status)}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="detail-section">
                    <h3>Prescription Details</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Prescribed By:</label>
                            <span>${medication.prescribedBy}</span>
                        </div>
                        <div class="detail-item">
                            <label>Start Date:</label>
                            <span>${medicationSystem.formatDate(medication.startDate)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Priority:</label>
                            <span class="priority-badge priority-${medication.priority || 'normal'}">
                                ${(medication.priority || 'normal').toUpperCase()}
                            </span>
                        </div>
                        ${medication.refillReminder ? `
                        <div class="detail-item">
                            <label>Refill Reminder:</label>
                            <span>${medication.refillReminder} days before</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ${medication.instructions || medication.sideEffects ? `
                <div class="detail-section">
                    <h3>Additional Information</h3>
                    ${medication.instructions ? `
                    <div class="detail-item">
                        <label>Special Instructions:</label>
                        <span>${medication.instructions}</span>
                    </div>
                    ` : ''}
                    ${medication.sideEffects ? `
                    <div class="detail-item">
                        <label>Potential Side Effects:</label>
                        <span>${medication.sideEffects.split(',').join(', ')}</span>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
            </div>
        `;

        const editBtn = safeGetElementById('editFromDetailsBtn');
        if (editBtn) {
            editBtn.onclick = () => {
                modal.style.display = 'none';
                editMedication(medicationId);
            };
        }

        modal.style.display = 'flex';
        
        if (medicationsAuthManager && medicationsAuthManager.initialized) {
            medicationsAuthManager.logUserActivity('view_medication_details', {
                medicationId: medicationId,
                medicationName: medication.medicationName
            });
        }
    } catch (error) {
        console.error('Error viewing medication details:', error);
        notificationSystem.show('Failed to load medication details', 'error');
    }
}

function editMedication(medicationId) {
    try {
        if (!medicationSystem) {
            notificationSystem.show('Medication system not available', 'error');
            return;
        }

        const medication = medicationSystem.medications.find(m => m.id === medicationId);
        if (!medication) {
            notificationSystem.show('Medication not found', 'error');
            return;
        }

        medicationSystem.openModal(true, medication);
        
        if (medicationsAuthManager && medicationsAuthManager.initialized) {
            medicationsAuthManager.logUserActivity('edit_medication_view', {
                medicationId: medicationId,
                medicationName: medication.medicationName
            });
        }
    } catch (error) {
        console.error('Error editing medication:', error);
        notificationSystem.show('Failed to open edit form', 'error');
    }
}

function confirmDeleteMedication(medicationId) {
    try {
        if (!medicationSystem) {
            notificationSystem.show('Medication system not available', 'error');
            return;
        }

        const medication = medicationSystem.medications.find(m => m.id === medicationId);
        if (!medication) {
            notificationSystem.show('Medication not found', 'error');
            return;
        }

        const patientInfo = medicationSystem.allPatients.find(p => p.patientId === medication.patientId);
        const patientName = patientInfo ? patientInfo.fullName : medication.patientName;

        const confirmed = confirm(`Are you sure you want to delete the medication "${medication.medicationName}" for ${patientName}?\n\nThis action cannot be undone.`);
        
        if (confirmed) {
            medicationSystem.deleteMedication(medicationId);
        }
    } catch (error) {
        console.error('Error confirming delete:', error);
        notificationSystem.show('Failed to delete medication', 'error');
    }
}

function showPrescriptionHistory() {
    try {
        if (!medicationSystem || !medicationSystem.prescriptionHistory) {
            notificationSystem.show('Prescription history not available', 'error');
            return;
        }
        
        medicationSystem.prescriptionHistory.showHistoryModal();
        
        if (medicationsAuthManager && medicationsAuthManager.initialized) {
            medicationsAuthManager.logUserActivity('view_prescription_history');
        }
    } catch (error) {
        console.error('Error showing prescription history:', error);
        notificationSystem.show('Failed to load prescription history', 'error');
    }
}

// ========================================
// PRESCRIPTION PRINTING INITIALIZATION
// ========================================

function initializePrescriptionPrinting() {
    try {
        prescriptionPrinter = new PrescriptionPrinter();
        
        const prescriptionSelectionModal = safeGetElementById('prescriptionSelectionModal');
        if (prescriptionSelectionModal) {
            const closeBtn = prescriptionSelectionModal.querySelector('.close-btn');
            if (closeBtn) {
                safeAddEventListener(closeBtn, 'click', () => {
                    prescriptionPrinter.closePrescriptionSelectionModal();
                });
            }
            
            safeAddEventListener(prescriptionSelectionModal, 'click', (e) => {
                if (e.target === prescriptionSelectionModal) {
                    prescriptionPrinter.closePrescriptionSelectionModal();
                }
            });
        }
        
        const printOptionsModal = safeGetElementById('printOptionsModal');
        if (printOptionsModal) {
            const closeBtn = printOptionsModal.querySelector('.close-btn');
            if (closeBtn) {
                safeAddEventListener(closeBtn, 'click', () => {
                    prescriptionPrinter.closePrintOptionsModal();
                });
            }
            
            safeAddEventListener(printOptionsModal, 'click', (e) => {
                if (e.target === printOptionsModal) {
                    prescriptionPrinter.closePrintOptionsModal();
                }
            });
        }
        
        console.log('Prescription printing system initialized');
    } catch (error) {
        console.error('Error initializing prescription printing:', error);
    }
}

// ========================================
// PATIENT TYPE FILTER FUNCTIONALITY - COMPLETE FIXED VERSION
// ========================================

let currentFilterType = 'All';

window.filterPrescriptionsByType = function(type) {
    currentFilterType = type;
    
    console.log(`Filtering prescriptions by type: ${type}`);
    
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
    }
    
    // Apply filter to medication system
    if (!medicationSystem || !medicationSystem.medications) {
        console.error('Medication system not initialized');
        notificationSystem.show('Unable to filter - system not ready', 'error');
        return;
    }
    
    // Store original medications if not already stored
    if (!medicationSystem.allMedicationsBackup || medicationSystem.allMedicationsBackup.length === 0) {
        medicationSystem.allMedicationsBackup = [...medicationSystem.medications];
    }
    
    // Filter medications based on patient type
    if (type === 'All') {
        // Show all medications
        medicationSystem.medications = [...medicationSystem.allMedicationsBackup];
    } else {
        // Filter by patient type
        medicationSystem.medications = medicationSystem.allMedicationsBackup.filter(medication => {
            // Check if medication has patientType field directly
            if (medication.patientType) {
                return medication.patientType.toLowerCase() === type.toLowerCase();
            }
            
            // If no patientType on medication, check the patient record
            if (medication.patientId) {
                const patient = medicationSystem.allPatients.find(p => 
                    p.patientId === medication.patientId
                );
                
                if (patient && patient.patientType) {
                    return patient.patientType.toLowerCase() === type.toLowerCase();
                }
            }
            
            return false;
        });
    }
    
    // Reset to first page
    medicationSystem.currentPage = 1;
    
    // Re-render the table
    medicationSystem.displayMedications();
    
    // Show notification with count
    const count = medicationSystem.medications.length;
    const message = type === 'All' 
        ? `Showing all ${count} prescriptions` 
        : `Showing ${count} ${type} prescriptions`;
    
    notificationSystem.show(message, 'info');
    
    console.log(`Filter applied: ${count} prescriptions shown`);
};

// ========================================
// ENHANCED NOTIFICATION FUNCTIONS
// ========================================

window.markAllNotificationsRead = function() {
    console.log('Marking all notifications as read...');
    
    const notificationItems = document.querySelectorAll('.notification-item');
    notificationItems.forEach(item => {
        item.classList.remove('unread', 'urgent');
    });
    
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        badge.textContent = '0';
        badge.style.display = 'none';
    }
    
    notificationSystem.show('All notifications marked as read', 'success');
    
    console.log('All notifications marked as read');
};

// ========================================
// APPLICATION INITIALIZATION
// ========================================

async function initializeApplication() {
    try {
        console.log('Initializing medications application...');
        
        currentUser = medicationsAuthManager.currentUser;
        
        if (!currentUser) {
            console.error('No authenticated user available');
            return;
        }
        
        setupSidebarDropdown();
        
        if (!isFirebaseConnected) {
            await initializeFirebase();
        }
        
        medicationSystem = new MedicationSystem();
        
        setupEventListeners();
        initializePrescriptionPrinting();
        initializeMedicationSystem();
        
        console.log('Medications application initialized successfully');
    } catch (error) {
        console.error('Error initializing application:', error);
        notificationSystem.show('Failed to initialize application. Please refresh the page.', 'error');
    }
}

function setupSidebarDropdown() {
    try {
        const sidebarUser = safeQuerySelector('.sidebar .user');
        const sidebarDropdown = safeQuerySelector('.sidebar .dropdown-menu');
        
        if (!sidebarUser || !sidebarDropdown) return;

        sidebarDropdown.classList.remove('show');

        safeAddEventListener(sidebarUser, 'click', (e) => {
            e.stopPropagation();
            sidebarDropdown.classList.toggle('show');
        });

        const logoutBtn = safeGetElementById('logoutBtn');
        if (logoutBtn) {
            safeAddEventListener(logoutBtn, 'click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (confirm('Are you sure you want to logout?')) {
                    sidebarDropdown.classList.remove('show');
                    if (medicationsAuthManager && medicationsAuthManager.initialized) {
                        await medicationsAuthManager.logout();
                    } else {
                        window.location.href = 'Admin login.html';
                    }
                }
            });
        }

        safeAddEventListener(document, 'click', () => {
            sidebarDropdown.classList.remove('show');
        });

        safeAddEventListener(sidebarDropdown, 'click', (e) => {
            e.stopPropagation();
        });
        
        sidebarUser.style.cursor = 'pointer';
        sidebarUser.style.transition = 'all 0.3s ease';
        
        safeAddEventListener(sidebarUser, 'mouseenter', () => {
            sidebarUser.style.background = 'rgba(255,255,255,0.2)';
            sidebarUser.style.transform = 'scale(1.02)';
        });
        
        safeAddEventListener(sidebarUser, 'mouseleave', () => {
            sidebarUser.style.background = 'rgba(255,255,255,0.1)';
            sidebarUser.style.transform = 'scale(1)';
        });
    } catch (error) {
        console.error('Error setting up sidebar dropdown:', error);
    }
}

function initializeMedicationSystem() {
    try {
        if (medicationSystem) {
            medicationSystem.initialize();
        }
    } catch (error) {
        console.error('Error initializing medication system:', error);
    }
}

// ========================================
// EVENT LISTENERS SETUP
// ========================================

function setupEventListeners() {
    try {
        setTimeout(() => {
            setupMainEventListeners();
        }, 100);
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }
}

function setupMainEventListeners() {
    try {
        const addMedicationButtons = [
            safeGetElementById('addMedicationBtn'),
            safeGetElementById('floatingAddBtn')
        ].filter(btn => btn !== null);

        addMedicationButtons.forEach(btn => {
            safeAddEventListener(btn, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (medicationsAuthManager && !medicationsAuthManager.hasPermission('add')) {
                    notificationSystem.show('You do not have permission to add medications', 'error');
                    return;
                }
                
                if (medicationSystem) {
                    medicationSystem.openModal();
                }
            });
        });

        const prescriptionHistoryBtn = safeGetElementById('prescriptionHistoryBtn');
        if (prescriptionHistoryBtn) {
            safeAddEventListener(prescriptionHistoryBtn, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showPrescriptionHistory();
            });
        }

        const closeHistoryBtn = safeGetElementById('closeHistoryModal');
        if (closeHistoryBtn) {
            safeAddEventListener(closeHistoryBtn, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (medicationSystem && medicationSystem.prescriptionHistory) {
                    medicationSystem.prescriptionHistory.closeHistoryModal();
                }
            });
        }

        const medicationForm = safeGetElementById('medicationForm');
        if (medicationForm) {
            const submitBtn = safeGetElementById('submitBtn');
        if (submitBtn) {
                safeAddEventListener(submitBtn, 'click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (!medicationSystem) {
                        console.error('Medication system not initialized');
                        return;
                    }
                    
                    const isEdit = !!(submitBtn.dataset.medicationId);
                    const requiredPermission = isEdit ? 'edit' : 'add';
                    
                    if (medicationsAuthManager && !medicationsAuthManager.hasPermission(requiredPermission)) {
                        notificationSystem.show(`You do not have permission to ${isEdit ? 'edit' : 'add'} medications`, 'error');
                        return;
                    }
                    
                    await handleFormSubmission();
                });
            }

            safeAddEventListener(medicationForm, 'submit', async (e) => {
                e.preventDefault();
                await handleFormSubmission();
            });
        }

        async function handleFormSubmission() {
            if (!medicationSystem) {
                console.error('Medication system not initialized');
                return;
            }
            
            const formElements = medicationForm.elements;
            const medicationData = {};
            
            for (let i = 0; i < formElements.length; i++) {
                const element = formElements[i];
                if (element.name && element.type !== 'submit' && element.type !== 'button') {
                    medicationData[element.name] = element.value;
                }
            }

            if (medicationSystem.patientSearchState.selectedPatient) {
                medicationData.patientId = medicationSystem.patientSearchState.selectedPatient.patientId;
                medicationData.patientName = medicationSystem.patientSearchState.selectedPatient.name;
            } else {
                const patientIdField = safeGetElementById('patientId');
                if (patientIdField && patientIdField.value) {
                    medicationData.patientId = patientIdField.value;
                }
            }
            
            const requiredFields = medicationForm.querySelectorAll('[required]');
            let isValid = true;
            
            requiredFields.forEach(field => {
                if (!medicationSystem.validateField(field)) {
                    isValid = false;
                }
            });
            
            if (!medicationData.patientId) {
                notificationSystem.show('Please select a patient', 'error');
                isValid = false;
            }
            
            if (!isValid) {
                notificationSystem.show('Please fill in all required fields correctly', 'error');
                return;
            }
            
            const submitBtn = safeGetElementById('submitBtn');
            const isEdit = !!(submitBtn && submitBtn.dataset.medicationId);

            try {
                if (isEdit) {
                    const medicationId = submitBtn.dataset.medicationId;
                    await medicationSystem.updateMedication(medicationId, medicationData);
                } else {
                    await medicationSystem.addMedication(medicationData);
                }
            } catch (error) {
                console.error('Error submitting form:', error);
            }
        }

        const closeButtons = [
            safeGetElementById('closeModalBtn'),
            safeGetElementById('cancelBtn'),
            ...document.querySelectorAll('[data-action="close-modal"]'),
            ...document.querySelectorAll('[data-action="cancel-form"]'),
            ...document.querySelectorAll('[data-action="close-details-modal"]'),
            ...document.querySelectorAll('[data-action="close-history-modal"]')
        ].filter(btn => btn !== null);

        closeButtons.forEach(btn => {
            safeAddEventListener(btn, 'click', (e) => {
                e.preventDefault();
                if (medicationSystem) {
                    medicationSystem.closeModal();
                }
            });
        });

        const modals = [
            safeGetElementById('medicationModal'),
            safeGetElementById('medicationDetailsModal'),
            safeGetElementById('confirmationModal'),
            safeGetElementById('prescriptionHistoryModal')
        ].filter(modal => modal !== null);

        modals.forEach(modal => {
            safeAddEventListener(modal, 'click', (e) => {
                if (e.target === modal) {
                    if (modal.id === 'prescriptionHistoryModal' && medicationSystem && medicationSystem.prescriptionHistory) {
                        medicationSystem.prescriptionHistory.closeHistoryModal();
                    } else {
                        medicationSystem.closeModal();
                    }
                }
            });
        });

        safeAddEventListener(document, 'click', async (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const medicationId = target.dataset.medicationId || target.closest('[data-medication-id]')?.dataset.medicationId;

            switch (action) {
                case 'add-medication':
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (medicationsAuthManager && !medicationsAuthManager.hasPermission('add')) {
                        notificationSystem.show('You do not have permission to add medications', 'error');
                        return;
                    }
                    
                    if (medicationSystem) {
                        medicationSystem.openModal();
                    }
                    break;
                    
                case 'view-prescription-history':
                    e.preventDefault();
                    e.stopPropagation();
                    showPrescriptionHistory();
                    break;
                    
                case 'print-prescription':
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (medicationId) {
                        await prescriptionPrinter.printPrescription(medicationId);
                    } else {
                        const detailsModal = safeGetElementById('medicationDetailsModal');
                        const contextMedicationId = detailsModal?.dataset?.medicationId;
                        
                        if (contextMedicationId) {
                            await prescriptionPrinter.printPrescription(contextMedicationId);
                        } else {
                            notificationSystem.show('Unable to print prescription - medication not found', 'error');
                        }
                    }
                    break;
                    
                case 'view-medication':
                    if (medicationId) viewMedicationDetails(medicationId);
                    break;
                    
                case 'edit-medication':
                    if (medicationId) {
                        if (medicationsAuthManager && !medicationsAuthManager.hasPermission('edit')) {
                            notificationSystem.show('You do not have permission to edit medications', 'error');
                            return;
                        }
                        editMedication(medicationId);
                    }
                    break;
                    
                case 'delete-medication':
                    if (medicationId) {
                        if (medicationsAuthManager && !medicationsAuthManager.hasPermission('delete') && !medicationsAuthManager.isAdmin) {
                            notificationSystem.show('You do not have permission to delete medications', 'error');
                            return;
                        }
                        confirmDeleteMedication(medicationId);
                    }
                    break;
            }
        });

        safeAddEventListener(document, 'keydown', (e) => {
            if (e.key === 'Escape') {
                if (medicationSystem) {
                    medicationSystem.closeModal();
                }
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (medicationsAuthManager && !medicationsAuthManager.hasPermission('add')) {
                    notificationSystem.show('You do not have permission to add medications', 'error');
                    return;
                }
                if (medicationSystem) {
                    medicationSystem.openModal();
                }
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                e.preventDefault();
                showPrescriptionHistory();
            }
        });

        console.log('Event listeners setup complete');
    } catch (error) {
        console.error('Error in setupMainEventListeners:', error);
    }
}

// ========================================
// MAIN INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('DOM loaded, initializing medications application...');
        
        let attempts = 0;
        const maxAttempts = 50;
        
        const waitForFirebase = () => {
            return new Promise((resolve) => {
                const checkFirebase = () => {
                    attempts++;
                    if (typeof firebase !== 'undefined') {
                        console.log('Firebase SDK loaded successfully');
                        resolve(true);
                    } else if (attempts >= maxAttempts) {
                        console.log('Firebase SDK not available, proceeding with demo mode');
                        resolve(false);
                    } else {
                        setTimeout(checkFirebase, 100);
                    }
                };
                checkFirebase();
            });
        };
        
        const firebaseAvailable = await waitForFirebase();
        
        try {
            if (firebaseAvailable) {
                console.log('Firebase available, initializing Firebase...');
                await initializeFirebase();
            }
            
            console.log('Creating auth manager...');
            medicationsAuthManager = new MedicationsAuthenticationManager();
            
            await medicationsAuthManager.initialize();
            
        } catch (error) {
            console.error('Error during initialization:', error);
            
            if (!medicationsAuthManager) {
                console.log('Creating auth manager with fallback...');
                medicationsAuthManager = new MedicationsAuthenticationManager();
                medicationsAuthManager.setupFallbackAuth();
            }
        }
    } catch (error) {
        console.error('Critical error during initialization:', error);
        notificationSystem.show('Failed to initialize application', 'error');
    }
});

// Global function exports
window.viewMedicationDetails = viewMedicationDetails;
window.editMedication = editMedication;
window.confirmDeleteMedication = confirmDeleteMedication;
window.showPrescriptionHistory = showPrescriptionHistory;
window.initializePrescriptionPrinting = initializePrescriptionPrinting;

// Debug export
window.MedicationsDebug = {
    get authManager() { return medicationsAuthManager; },
    get medicationSystem() { return medicationSystem; },
    get prescriptionPrinter() { return prescriptionPrinter; },
    notificationSystem: notificationSystem,
    get isConnected() { return isFirebaseConnected; },
    get currentUser() { return currentUser; }
};

// ========================================
// MOBILE RESPONSIVE FUNCTIONALITY
// ========================================

class MobileMenuManager {
    constructor() {
        console.log('✓ Sidebar kept visible on all devices');
    }

    init() {}
    setup() {}
    setupEventListeners() {}
    toggle() {}
    open() {}
    close() {}
    handleResize() {}
}

class ResponsiveTableManager {
    constructor() {
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.addDataLabels();
        window.addEventListener('resize', () => this.handleResize());
    }

    addDataLabels() {
        const tableBody = safeGetElementById('medicationsTableBody');
        if (!tableBody) return;

        const headers = [
            'Patient',
            'Medication',
            'Dosage',
            'Prescribed By',
            'Start Date',
            'Duration',
            'Status',
            'Actions'
        ];

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.classList && (node.classList.contains('medication-row') || node.classList.contains('table-row'))) {
                        this.labelRow(node, headers);
                    }
                });
            });
        });

        observer.observe(tableBody, {
            childList: true,
            subtree: true
        });

        const rows = tableBody.querySelectorAll('.medication-row, .table-row');
        rows.forEach(row => this.labelRow(row, headers));
    }

    labelRow(row, headers) {
        const cells = row.querySelectorAll('div:not(.action-buttons)');
        cells.forEach((cell, index) => {
            if (index < headers.length && !cell.hasAttribute('data-label')) {
                cell.setAttribute('data-label', headers[index]);
            }
        });
    }

    handleResize() {
        if (window.innerWidth <= 768) {
            this.optimizeForMobile();
        }
    }

    optimizeForMobile() {
        const modals = document.querySelectorAll('.modal, .history-modal');
        modals.forEach(modal => {
            if (modal.classList.contains('show')) {
                const content = modal.querySelector('.modal-content, .history-modal-content');
                if (content) {
                    content.style.maxHeight = '90vh';
                }
            }
        });
    }
}

class TouchGestureManager {
    constructor() {
        console.log('✓ Touch gestures disabled (sidebar always visible)');
    }

    init() {}
    setup() {}
}

class MobileOptimizer {
    constructor() {
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.optimizeScrolling();
        this.handleOrientation();
        this.optimizeTouchInteractions();
    }

    optimizeScrolling() {
        const style = document.createElement('style');
        style.textContent = `
            @media (max-width: 768px) {
                * {
                    -webkit-overflow-scrolling: touch;
                }
            }
        `;
        document.head.appendChild(style);
    }

    handleOrientation() {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                window.scrollTo(0, 0);
                
                if (window.innerHeight < 500 && window.matchMedia('(orientation: landscape)').matches) {
                    const openModals = document.querySelectorAll('.modal.show, .history-modal.show');
                    openModals.forEach(modal => {
                        const closeBtn = modal.querySelector('.close-btn');
                        if (closeBtn) closeBtn.click();
                    });
                }
            }, 100);
        });
    }

    optimizeTouchInteractions() {
        const buttons = document.querySelectorAll('button, .btn-primary, .btn-secondary, .action-btn');
        buttons.forEach(button => {
            button.style.touchAction = 'manipulation';
        });
    }
}

// Initialize responsive features
window.mobileMenuManager = new MobileMenuManager();
window.responsiveTableManager = new ResponsiveTableManager();
window.touchGestureManager = new TouchGestureManager();
window.mobileOptimizer = new MobileOptimizer();

console.log('✓ Responsive features initialized');
console.log('✅ Prescriptions.js v5.0.0 - Complete with working patient type filters');