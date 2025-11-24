// PregnaCare Sub-Admin Registration System - No Admin Verification Required
// Author: PregnaCare Development Team
// Version: 3.0 - DIRECT ACCESS
// Description: Direct admin account creation system without verification requirements

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
let isSubmitting = false;
let formInitialized = false;

// DOM Elements (will be initialized on DOMContentLoaded)
let elements = {};

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    console.log('PregnaCare Sub-Admin Registration System initializing...');
    
    try {
        initializeElements();
        initializeApp();
        setupEventListeners();
        
        console.log('System initialization complete');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        showError('Failed to initialize system. Please refresh the page.');
    }
});

// Initialize DOM Elements
function initializeElements() {
    elements = {
        // Main containers
        formBox: document.querySelector('.form-box'),
        container: document.querySelector('.container'),
        
        // Registration form elements
        registerForm: document.getElementById('registerForm'),
        firstName: document.getElementById('firstName'),
        middleName: document.getElementById('middleName'),
        lastName: document.getElementById('lastName'),
        email: document.getElementById('email'),
        adminLevel: document.getElementById('adminLevel'),
        password: document.getElementById('password'),
        confirmPassword: document.getElementById('confirmPassword'),
        terms: document.getElementById('terms'),
        
        // Form controls
        passwordToggle: document.getElementById('passwordToggle'),
        confirmPasswordToggle: document.getElementById('confirmPasswordToggle'),
        submitBtn: document.getElementById('submitBtn'),
        backBtn: document.getElementById('backBtn'),
        
        // UI feedback elements
        errorMessage: document.getElementById('errorMessage'),
        successMessage: document.getElementById('successMessage'),
        progressFill: document.getElementById('progressFill'),
        progressText: document.getElementById('progressText'),
        passwordRequirements: document.getElementById('passwordRequirements'),
        
        // Dynamic content
        formTitle: document.getElementById('formTitle'),
        formDescription: document.getElementById('formDescription'),
        
        // Loading overlay
        loadingOverlay: document.getElementById('loadingOverlay')
    };
    
    console.log('DOM elements initialized');
}

// Main Application Initialization
function initializeApp() {
    // Update form content for direct access
    updateFormForDirectAccess();
    
    // Setup form functionality immediately
    setupFormFunctionality();
    
    console.log('Direct access registration system ready');
}

// Update Form for Direct Access
function updateFormForDirectAccess() {
    if (elements.formTitle) {
        elements.formTitle.innerHTML = '<i class="fas fa-user-plus"></i> Create Administrator Account';
    }
    
    if (elements.formDescription) {
        elements.formDescription.innerHTML = 'Fill in the details below to create a new administrator account';
    }
    
    if (elements.submitBtn) {
        elements.submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Admin Account';
    }
    
    console.log('Form updated for direct access');
}

// Setup Event Listeners
function setupEventListeners() {
    // Back button
    if (elements.backBtn) {
        elements.backBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to go back? Any unsaved data will be lost.')) {
                window.location.href = 'DashBoard.html';
            }
        });
    }
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeyboard);
    
    // Window events
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    console.log('Event listeners setup complete');
}

// Setup Form Functionality
function setupFormFunctionality() {
    if (!elements.registerForm) {
        console.error('Registration form not found');
        return;
    }
    
    if (formInitialized) {
        console.log('Form already initialized');
        return;
    }
    
    try {
        // Initialize form functionality
        setupPasswordToggles();
        setupFormValidation();
        setupSpecialHandlers();
        setupFormAutoSave();
        
        // Setup form submission
        elements.registerForm.addEventListener('submit', handleAdminRegistration);
        
        // Restore any saved form data
        restoreFormData();
        
        // Focus on first field
        setTimeout(() => {
            if (elements.firstName) {
                elements.firstName.focus();
            }
        }, 300);
        
        updateProgress();
        formInitialized = true;
        
        console.log('Form functionality initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize form functionality:', error);
        showError('Failed to initialize registration form. Please refresh the page.');
    }
}

// Setup Password Toggles
function setupPasswordToggles() {
    setupPasswordToggle('password', 'passwordToggle');
    setupPasswordToggle('confirmPassword', 'confirmPasswordToggle');
}

// Setup Individual Password Toggle
function setupPasswordToggle(inputId, toggleId) {
    const input = elements[inputId];
    const toggle = elements[toggleId];
    
    if (!input || !toggle) {
        console.warn(`Password toggle elements not found: ${inputId}, ${toggleId}`);
        return;
    }
    
    toggle.addEventListener('click', function(e) {
        e.preventDefault();
        togglePasswordVisibility(inputId, toggleId);
    });
}

// Toggle Password Visibility
function togglePasswordVisibility(inputId, toggleId) {
    const input = elements[inputId];
    const toggle = elements[toggleId];
    
    if (!input || !toggle) return;
    
    const isPassword = input.getAttribute('type') === 'password';
    input.setAttribute('type', isPassword ? 'text' : 'password');
    
    const icon = toggle.querySelector('i');
    if (icon) {
        icon.className = isPassword ? 'fa fa-eye-slash' : 'fa fa-eye';
    }
    
    // Update toggle color
    toggle.style.color = isPassword ? '#695efc' : '#666';
}

// Setup Form Validation
function setupFormValidation() {
    const fieldValidators = {
        firstName: validators.firstName,
        middleName: validators.middleName,
        lastName: validators.lastName,
        email: validators.email,
        password: validators.password,
        confirmPassword: validators.confirmPassword
    };
    
    Object.keys(fieldValidators).forEach(fieldId => {
        const field = elements[fieldId];
        if (field) {
            field.addEventListener('input', () => {
                validateField(fieldId, fieldValidators[fieldId], fieldId + 'Status');
            });
            
            field.addEventListener('blur', () => {
                validateField(fieldId, fieldValidators[fieldId], fieldId + 'Status');
            });
        }
    });
    
    console.log('Form validation setup complete');
}

// Field Validators
const validators = {
    firstName: (value) => {
        const trimmed = value.trim();
        return trimmed.length >= 2 && trimmed.length <= 30 && /^[a-zA-Z\s.'-]+$/.test(trimmed);
    },
    
    middleName: (value) => {
        const trimmed = value.trim();
        // Middle name is optional, so empty is valid
        if (trimmed === '') return true;
        return trimmed.length >= 1 && trimmed.length <= 30 && /^[a-zA-Z\s.'-]+$/.test(trimmed);
    },
    
    lastName: (value) => {
        const trimmed = value.trim();
        return trimmed.length >= 2 && trimmed.length <= 30 && /^[a-zA-Z\s.'-]+$/.test(trimmed);
    },
    
    email: (value) => {
        return isValidEmail(value.trim());
    },
    
    password: (value) => {
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]{8,}$/;
        return passwordRegex.test(value) && value.length <= 128;
    },
    
    confirmPassword: (value) => {
        const password = elements.password;
        return password && value === password.value && value.length > 0;
    }
};

// Validate Field
function validateField(fieldId, validator, statusId) {
    const field = elements[fieldId];
    const statusElement = document.getElementById(statusId);
    
    if (!field) return false;
    
    const isValid = validator(field.value);
    
    if (field.value.length > 0) {
        if (isValid) {
            field.classList.add('valid');
            field.classList.remove('invalid');
            if (statusElement) {
                statusElement.textContent = '✓';
                statusElement.className = 'field-status valid';
            }
        } else {
            field.classList.add('invalid');
            field.classList.remove('valid');
            if (statusElement) {
                statusElement.textContent = '✗';
                statusElement.className = 'field-status invalid';
            }
        }
    } else {
        // Special case for middle name - it's optional
        if (fieldId === 'middleName') {
            field.classList.remove('valid', 'invalid');
            if (statusElement) {
                statusElement.textContent = '';
                statusElement.className = 'field-status';
            }
        } else {
            field.classList.remove('valid', 'invalid');
            if (statusElement) {
                statusElement.textContent = '';
                statusElement.className = 'field-status';
            }
        }
    }
    
    updateProgress();
    return isValid;
}

// Setup Special Handlers
function setupSpecialHandlers() {
    setupPasswordRequirements();
    setupAdminLevelHandler();
    setupTermsHandler();
    setupEmailExistenceCheck();
}

// Setup Password Requirements Display
function setupPasswordRequirements() {
    if (!elements.password || !elements.passwordRequirements) return;
    
    elements.password.addEventListener('input', function() {
        const password = this.value;
        const requirements = elements.passwordRequirements;
        
        if (password.length > 0) {
            if (validators.password(password)) {
                requirements.className = 'password-requirements valid';
                requirements.textContent = '✓ Password meets all requirements';
            } else {
                requirements.className = 'password-requirements invalid';
                requirements.textContent = 'Password must contain: 8+ characters, uppercase, lowercase, number, and special character (@$!%*?&)';
            }
        } else {
            requirements.className = 'password-requirements';
            requirements.textContent = 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character (@$!%*?&)';
        }
    });
    
    // Re-validate confirm password when main password changes
    elements.password.addEventListener('input', () => {
        if (elements.confirmPassword && elements.confirmPassword.value.length > 0) {
            validateField('confirmPassword', validators.confirmPassword, 'confirmPasswordStatus');
        }
    });
}

// Setup Admin Level Handler
function setupAdminLevelHandler() {
    if (!elements.adminLevel) return;
    
    elements.adminLevel.addEventListener('change', function() {
        updateProgress();
        
        // Visual feedback for selection
        if (this.value) {
            this.classList.add('valid');
            this.classList.remove('invalid');
            const status = document.getElementById('adminLevelStatus');
            if (status) {
                status.textContent = '✓';
                status.className = 'field-status valid';
            }
        } else {
            this.classList.remove('valid', 'invalid');
            const status = document.getElementById('adminLevelStatus');
            if (status) {
                status.textContent = '';
                status.className = 'field-status';
            }
        }
    });
}

// Setup Terms Handler
function setupTermsHandler() {
    if (!elements.terms) return;
    
    elements.terms.addEventListener('change', updateProgress);
}

// Setup Email Existence Check
function setupEmailExistenceCheck() {
    if (!elements.email) return;
    
    elements.email.addEventListener('input', function() {
        const email = this.value.trim();
        if (email && isValidEmail(email)) {
            // Debounced email existence check
            clearTimeout(this.emailCheckTimeout);
            this.emailCheckTimeout = setTimeout(async () => {
                try {
                    const exists = await checkEmailExists(email);
                    if (exists && this.value.trim() === email) {
                        this.classList.remove('valid');
                        this.classList.add('invalid');
                        const status = document.getElementById('emailStatus');
                        if (status) {
                            status.textContent = '⚠ ';
                            status.className = 'field-status invalid';
                            status.title = 'Email already exists';
                        }
                    }
                } catch (error) {
                    console.warn('Email existence check failed:', error);
                }
            }, 1000);
        }
    });
}

// Update Progress Bar
function updateProgress() {
    // Required fields: firstName, lastName, email, password, confirmPassword, adminLevel
    const requiredFields = ['firstName', 'lastName', 'email', 'password', 'confirmPassword'];
    const validFields = requiredFields.filter(fieldId => {
        const field = elements[fieldId];
        return field && field.classList.contains('valid');
    });
    
    const adminLevelSelected = elements.adminLevel && elements.adminLevel.value !== '';
    const termsChecked = elements.terms && elements.terms.checked;
    
    const totalSteps = requiredFields.length + 2; // +1 for admin level, +1 for terms
    const completedSteps = validFields.length + (adminLevelSelected ? 1 : 0) + (termsChecked ? 1 : 0);
    
    const percentage = Math.round((completedSteps / totalSteps) * 100);
    
    if (elements.progressFill) {
        elements.progressFill.style.width = percentage + '%';
        elements.progressFill.setAttribute('aria-valuenow', percentage);
    }
    
    if (elements.progressText) {
        if (percentage === 100) {
            elements.progressText.textContent = 'Ready to create admin account';
            elements.progressText.style.color = '#28a745';
        } else {
            elements.progressText.textContent = `Complete all fields to create account (${percentage}% complete)`;
            elements.progressText.style.color = '#666';
        }
    }
}

// Combine Name Fields into Full Name
function getFullName() {
    const firstName = (elements.firstName?.value || '').trim();
    const middleName = (elements.middleName?.value || '').trim();
    const lastName = (elements.lastName?.value || '').trim();
    
    let fullName = firstName;
    if (middleName) {
        fullName += ' ' + middleName;
    }
    if (lastName) {
        fullName += ' ' + lastName;
    }
    
    return fullName.trim();
}

// Handle Admin Registration - Main registration function without admin verification
async function handleAdminRegistration(e) {
    e.preventDefault();
    
    if (isSubmitting) {
        console.log('Form submission already in progress');
        return;
    }
    
    isSubmitting = true;
    hideMessages();
    showLoading(true);
    
    try {
        // Collect form data
        const formData = {
            firstName: elements.firstName?.value.trim() || '',
            middleName: elements.middleName?.value.trim() || '',
            lastName: elements.lastName?.value.trim() || '',
            email: elements.email?.value.trim() || '',
            password: elements.password?.value || '',
            confirmPassword: elements.confirmPassword?.value || '',
            adminLevel: elements.adminLevel?.value || '',
            terms: elements.terms?.checked || false
        };
        
        // Get full name for display and database
        const fullName = getFullName();
        
        console.log('Creating admin account:', { 
            fullName,
            firstName: formData.firstName,
            middleName: formData.middleName,
            lastName: formData.lastName,
            email: formData.email,
            adminLevel: formData.adminLevel,
            password: '[HIDDEN]', 
            confirmPassword: '[HIDDEN]'
        });
        
        // Validate form
        const errors = validateForm(formData);
        if (errors.length > 0) {
            showError(errors.join('. '));
            return;
        }
        
        // Check email existence
        const emailExists = await checkEmailExists(formData.email);
        if (emailExists) {
            showError('An account with this email already exists. Please use a different email address.');
            return;
        }
        
        // Create Firebase user
        console.log('Creating Firebase user for admin...');
        const userCredential = await auth.createUserWithEmailAndPassword(formData.email, formData.password);
        const newUser = userCredential.user;
        console.log('Admin user created with UID:', newUser.uid);

        // Update user profile
        await newUser.updateProfile({
            displayName: fullName
        });

        // Prepare user data
        const userData = createUserData(formData, newUser, fullName);

        // Save to database
        console.log('Saving admin data to database...');
        await database.ref('adminUsers/' + newUser.uid).set(userData);
        console.log('Admin data saved successfully');

        // Log admin creation action
        await logAdminAction({
            action: 'CREATE_ADMIN_ACCOUNT',
            targetUID: newUser.uid,
            targetEmail: formData.email,
            targetName: fullName,
            adminLevel: formData.adminLevel,
            performedBy: 'system',
            performedByEmail: 'system',
            performedByName: 'Direct Registration System',
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            date: new Date().toISOString(),
            details: {
                permissions: userData.permissions,
                nameFields: {
                    firstName: formData.firstName,
                    middleName: formData.middleName,
                    lastName: formData.lastName
                },
                registrationMethod: 'direct_access',
                systemGenerated: true
            }
        });

        // Send verification email
        console.log('Sending verification email...');
        await newUser.sendEmailVerification({
            url: window.location.origin + '/Admin login.html',
            handleCodeInApp: false
        });

        // Show success and handle next steps
        await handleSuccessfulCreation(formData, fullName);
        
    } catch (error) {
        console.error('Admin creation error:', error);
        handleRegistrationError(error);
    } finally {
        isSubmitting = false;
        showLoading(false);
    }
}

// Create User Data Object
function createUserData(formData, newUser, fullName) {
    return {
        fullName: fullName,
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: formData.lastName,
        email: formData.email,
        phoneVerified: false,
        role: formData.adminLevel,
        isActive: true,
        createdAt: new Date().toISOString(),
        createdTimestamp: firebase.database.ServerValue.TIMESTAMP,
        createdBy: 'system',
        createdByEmail: 'direct-registration-system',
        createdByName: 'Direct Registration System',
        lastLogin: null,
        uid: newUser.uid,
        emailVerified: false,
        profileComplete: true,
        registrationSource: 'direct-registration',
        version: '3.0',
        permissions: getPermissionsForAdminLevel(formData.adminLevel)
    };
}

// Get Permissions for Admin Level
function getPermissionsForAdminLevel(adminLevel) {
    const permissionSets = {
        'SubAdmin': {
            canViewUsers: true,
            canEditUsers: true,
            canDeleteUsers: false,
            canCreateAdmins: false,
            canViewReports: true,
            canEditSettings: true,
            canAccessDatabase: true,
            canManageContent: true,
            accessLevel: 'high'
        },
        'Admin': {
            canViewUsers: true,
            canEditUsers: true,
            canDeleteUsers: true,
            canCreateAdmins: true,
            canViewReports: true,
            canEditSettings: true,
            canAccessDatabase: true,
            canManageContent: true,
            accessLevel: 'full'
        },
        'Moderator': {
            canViewUsers: true,
            canEditUsers: false,
            canDeleteUsers: false,
            canCreateAdmins: false,
            canViewReports: true,
            canEditSettings: false,
            canAccessDatabase: false,
            canManageContent: true,
            accessLevel: 'medium'
        },
        'Viewer': {
            canViewUsers: true,
            canEditUsers: false,
            canDeleteUsers: false,
            canCreateAdmins: false,
            canViewReports: true,
            canEditSettings: false,
            canAccessDatabase: false,
            canManageContent: false,
            accessLevel: 'low'
        }
    };
    
    return permissionSets[adminLevel] || permissionSets['Viewer'];
}

// Log Admin Action
async function logAdminAction(actionData) {
    try {
        await database.ref('adminLogs').push(actionData);
        console.log('Admin action logged successfully');
    } catch (error) {
        console.error('Failed to log admin action:', error);
    }
}

// Handle Successful Creation
async function handleSuccessfulCreation(formData, fullName) {
    const successMsg = `
        <i class="fas fa-check-circle" style="color: #28a745; margin-right: 8px;"></i>
        <strong>Admin Account Created Successfully!</strong>
        <br><br>
        <div style="text-align: left; line-height: 1.6;">
            <strong>Account Details:</strong><br>
            • Name: <strong>${fullName}</strong><br>
            • Email: <strong>${formData.email}</strong><br>
            • Admin Level: <strong>${formData.adminLevel}</strong><br>
            • Status: <span style="color: #ffc107;">Pending Email Verification</span>
            <br><br>
            <strong>Next Steps:</strong><br>
            • Verification email sent to ${formData.email}<br>
            • New admin must verify email before first login<br>
            • Account will be active after verification
        </div>
    `;
    
    showError(successMsg, 'success');
    resetForm();
    clearFormDraft();
    
    // Add success animation
    if (elements.formBox) {
        elements.formBox.classList.add('form-success');
        setTimeout(() => {
            elements.formBox.classList.remove('form-success');
        }, 5000);
    }
    
    // Handle next actions
    setTimeout(() => {
        handlePostCreationOptions();
    }, 4000);
}

// Handle Post Creation Options
function handlePostCreationOptions() {
    if (confirm('Admin account created successfully!\n\nWould you like to create another admin account?')) {
        resetForm();
        hideMessages();
        if (elements.firstName) {
            elements.firstName.focus();
        }
    } else {
        const choice = confirm('Would you like to return to the dashboard?\n\nClick OK for Dashboard, Cancel to stay here');
        if (choice) {
            window.location.href = 'DashBoard.html';
        }
        // If they choose cancel, they stay on the current page
    }
}

// Validate Form
function validateForm(formData) {
    const errors = [];
    
    // Validate required name fields
    if (!formData.firstName || !validators.firstName(formData.firstName)) {
        errors.push('Please enter a valid first name');
    }
    
    if (!formData.lastName || !validators.lastName(formData.lastName)) {
        errors.push('Please enter a valid last name');
    }
    
    // Validate middle name if provided (it's optional)
    if (formData.middleName && !validators.middleName(formData.middleName)) {
        errors.push('Please enter a valid middle name or leave it empty');
    }
    
    // Validate other required fields
    const otherRequiredFields = ['email', 'password', 'confirmPassword'];
    otherRequiredFields.forEach(fieldId => {
        const value = formData[fieldId];
        if (!value || !validators[fieldId](value)) {
            const fieldName = fieldId.replace(/([A-Z])/g, ' $1').toLowerCase();
            errors.push(`Please enter a valid ${fieldName}`);
        }
    });
    
    // Additional validations
    if (!formData.adminLevel) {
        errors.push('Please select an admin level');
    }
    
    if (!formData.terms) {
        errors.push('You must agree to the Terms of Service and Privacy Policy');
    }
    
    if (formData.password !== formData.confirmPassword) {
        errors.push('Passwords do not match');
    }
    
    return errors;
}

// Message Functions
function showError(message, type = 'error') {
    hideMessages();
    
    const messageEl = (type === 'success' || type === 'info') ? elements.successMessage : elements.errorMessage;
    if (messageEl) {
        messageEl.innerHTML = message;
        messageEl.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function hideMessages() {
    if (elements.errorMessage) elements.errorMessage.style.display = 'none';
    if (elements.successMessage) elements.successMessage.style.display = 'none';
}

function showLoading(show) {
    if (!elements.submitBtn) return;
    
    if (show) {
        elements.submitBtn.disabled = true;
        elements.submitBtn.innerHTML = '<div class="loading"></div>Creating Admin Account...';
        
        // Show loading overlay
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = 'flex';
        }
    } else {
        elements.submitBtn.disabled = false;
        elements.submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Admin Account';
        
        // Hide loading overlay
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = 'none';
        }
    }
}

// Handle Registration Error
function handleRegistrationError(error) {
    console.error('Admin registration error:', error);
    
    const errorMap = {
        'auth/email-already-in-use': 'An account with this email already exists. Please use a different email.',
        'auth/weak-password': 'Password is too weak. Please use a stronger password.',
        'auth/invalid-email': 'Invalid email address format. Please enter a valid email.',
        'auth/operation-not-allowed': 'Account creation is not enabled. Please contact support.',
        'auth/network-request-failed': 'Network error. Please check your internet connection.',
        'permission-denied': 'Database access denied. Please contact support.',
        'auth/too-many-requests': 'Too many requests. Please wait a moment and try again.'
    };
    
    let errorMsg = errorMap[error.code] || 'Failed to create admin account. Please try again.';
    
    if (!errorMap[error.code] && error.message && !error.message.includes('internal')) {
        errorMsg = error.message;
    }
    
    showError(errorMsg);
}

// Form Management Functions
function resetForm() {
    if (elements.registerForm) {
        elements.registerForm.reset();
    }
    
    if (elements.progressFill) {
        elements.progressFill.style.width = '0%';
        elements.progressFill.setAttribute('aria-valuenow', '0');
    }
    
    // Reset field statuses
    document.querySelectorAll('.field-status').forEach(status => {
        status.textContent = '';
        status.className = 'field-status';
    });
    
    // Reset validation classes
    document.querySelectorAll('input, select').forEach(field => {
        field.classList.remove('valid', 'invalid');
    });
    
    // Reset password requirements
    if (elements.passwordRequirements) {
        elements.passwordRequirements.className = 'password-requirements';
        elements.passwordRequirements.textContent = 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character (@$!%*?&)';
    }
    
    // Reset progress text
    if (elements.progressText) {
        elements.progressText.textContent = 'Complete all fields to create admin account';
        elements.progressText.style.color = '#666';
    }
    
    updateProgress();
}

// Utility Functions
async function checkEmailExists(email) {
    try {
        const methods = await auth.fetchSignInMethodsForEmail(email);
        return methods.length > 0;
    } catch (error) {
        console.warn('Could not check email existence:', error);
        return false;
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email) || email.length > 254) {
        return false;
    }
    
    if (email !== email.toLowerCase() || email.includes('..')) {
        return false;
    }
    
    const validEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return validEmailRegex.test(email);
}

// Form Auto-Save Functions
function setupFormAutoSave() {
    const fieldsToSave = ['firstName', 'middleName', 'lastName', 'email', 'adminLevel'];
    
    fieldsToSave.forEach(fieldId => {
        const field = elements[fieldId];
        if (field) {
            field.addEventListener('input', debounce(saveFormDraft, 500));
        }
    });
}

function saveFormDraft() {
    const draftData = {};
    const fieldsToSave = ['firstName', 'middleName', 'lastName', 'email', 'adminLevel'];
    
    fieldsToSave.forEach(fieldId => {
        const field = elements[fieldId];
        if (field && field.value.trim()) {
            draftData[fieldId] = field.value.trim();
        }
    });
    
    try {
        sessionStorage.setItem('admin_form_draft', JSON.stringify(draftData));
    } catch (e) {
        console.warn('Could not save form draft:', e);
    }
}

function restoreFormData() {
    try {
        const savedData = sessionStorage.getItem('admin_form_draft');
        if (savedData) {
            const formData = JSON.parse(savedData);
            
            Object.keys(formData).forEach(fieldId => {
                const field = elements[fieldId];
                if (field && formData[fieldId]) {
                    field.value = formData[fieldId];
                    
                    // Trigger validation
                    if (validators[fieldId]) {
                        validateField(fieldId, validators[fieldId], fieldId + 'Status');
                    } else if (fieldId === 'adminLevel') {
                        // Handle admin level selection
                        const event = new Event('change');
                        field.dispatchEvent(event);
                    }
                }
            });
            
            updateProgress();
            console.log('Form data restored from auto-save');
        }
    } catch (e) {
        console.warn('Could not restore form data:', e);
        clearFormDraft();
    }
}

function clearFormDraft() {
    sessionStorage.removeItem('admin_form_draft');
}

// Helper Functions
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

// Event Handlers
function handleGlobalKeyboard(e) {
    if (e.key === 'Escape') {
        hideMessages();
    }
    
    if (e.key === 'Enter' && !isSubmitting) {
        if (elements.submitBtn && !elements.submitBtn.disabled && e.target.tagName !== 'BUTTON') {
            e.preventDefault();
            elements.submitBtn.click();
        }
    }
}

function handleBeforeUnload(e) {
    if (isSubmitting) {
        e.preventDefault();
        e.returnValue = 'Admin account creation is in progress. Are you sure you want to leave?';
        return e.returnValue;
    }
}

// Initialize system when page loads
console.log('PregnaCare Sub-Admin Registration System loaded successfully');
console.log('Version: 3.0 - DIRECT ACCESS | Features: No admin verification required, Direct registration, Auto-save, Form validation, Separate name fields');