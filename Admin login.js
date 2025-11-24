// Firebase configuration
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

// Authorized Admin UIDs (fallback for existing accounts)
const AUTHORIZED_ADMIN_UIDS = [
    '0GcKKrWpYkW1WyoSCdQiuwc9HDK2',
    'pnU0HliFenYYDpP3aLqfIxkkf3Z2'
];

// Global variables
let authStateProcessed = false;
let isProcessingLogin = false;

// Enhanced PregnaCare Admin Login
document.addEventListener('DOMContentLoaded', function() {
    console.log('PregnaCare Admin Login initialized');
    
    // Get form elements
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    const passwordToggle = document.getElementById('loginPasswordToggle');
    const passwordField = document.getElementById('loginPassword');
    const emailField = document.getElementById('loginEmail');
    
    // FIXED: Single auth state listener that doesn't cause redirects
    auth.onAuthStateChanged(function(user) {
        // Prevent multiple processing of the same auth state
        if (authStateProcessed) {
            return;
        }
        
        console.log('Auth state changed:', user ? user.uid : 'No user');
        
        if (user) {
            // Check authorization through database or fallback UIDs
            checkUserAuthorization(user).then(isAuthorized => {
                if (isAuthorized) {
                    // Check if we have a valid session
                    const session = sessionStorage.getItem('pregnacare_admin_session');
                    if (session) {
                        try {
                            const sessionData = JSON.parse(session);
                            // Only show session message if session is valid and recent
                            if (Date.now() - sessionData.loginTime < 8 * 60 * 60 * 1000) {
                                showMessage('You are already logged in. Click "Sign In" to continue to dashboard.', 'info');
                                return;
                            }
                        } catch (e) {
                            // Invalid session data, continue with normal flow
                            sessionStorage.removeItem('pregnacare_admin_session');
                        }
                    }
                } else {
                    // User is logged in but not authorized
                    showMessage('Access denied. Only authorized administrators can access this portal.', 'error');
                    // Sign out unauthorized user without causing redirect loops
                    auth.signOut().catch(console.error);
                    sessionStorage.removeItem('pregnacare_admin_session');
                }
            }).catch(error => {
                console.error('Error checking user authorization:', error);
                showMessage('Error verifying account. Please try again.', 'error');
                auth.signOut().catch(console.error);
                sessionStorage.removeItem('pregnacare_admin_session');
            });
        }
        // If no user is logged in, just continue with normal login flow
    });
    
    // Check for auto-fill credentials from account creation
    const savedCredentials = sessionStorage.getItem('pregnacare_new_account');
    if (savedCredentials) {
        try {
            const credentials = JSON.parse(savedCredentials);
            // Check if credentials are less than 10 minutes old
            if (Date.now() - credentials.timestamp < 10 * 60 * 1000) {
                // Auto-fill the fields
                if (emailField) emailField.value = credentials.email;
                if (passwordField) passwordField.value = credentials.password;
                
                showMessage('Your credentials have been auto-filled from account creation. Click "Sign In" to login.', 'success');
                
                // Focus on the login button
                if (loginBtn) loginBtn.focus();
                
                // Clear the saved credentials after use
                sessionStorage.removeItem('pregnacare_new_account');
            } else {
                // Credentials are too old, remove them
                sessionStorage.removeItem('pregnacare_new_account');
            }
        } catch (e) {
            console.error('Error parsing saved credentials:', e);
            sessionStorage.removeItem('pregnacare_new_account');
        }
    }
    
    // Password visibility toggle
    if (passwordToggle && passwordField) {
        passwordToggle.addEventListener('click', function(e) {
            e.preventDefault();
            const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordField.setAttribute('type', type);
            
            // Update icon
            if (type === 'text') {
                this.className = 'fas fa-eye-slash password-toggle';
                this.style.color = '#695efc';
            } else {
                this.className = 'fas fa-eye password-toggle';
                this.style.color = '#666';
            }
        });
    }
    
    // FIXED: Form submission handler without auto-redirects
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Prevent multiple simultaneous login attempts
            if (isProcessingLogin) {
                console.log('Login already in progress');
                return;
            }
            
            const email = emailField ? emailField.value.trim() : '';
            const password = passwordField ? passwordField.value : '';
            
            // Enhanced validation
            if (!email || !password) {
                showMessage('Please fill in all fields', 'error');
                return;
            }
            
            if (!isValidEmail(email)) {
                showMessage('Please enter a valid email address', 'error');
                return;
            }
            
            isProcessingLogin = true;
            showLoading(true);
            hideMessages();
            
            try {
                console.log('Attempting login for:', email);
                
                // Sign in with Firebase Auth
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                console.log('Firebase login successful for UID:', user.uid);
                
                // Check if this user is authorized (database or fallback UIDs)
                const isAuthorized = await checkUserAuthorization(user);
                
                if (!isAuthorized) {
                    console.warn('Unauthorized login attempt by UID:', user.uid);
                    
                    // Sign out unauthorized user
                    await auth.signOut();
                    sessionStorage.removeItem('pregnacare_admin_session');
                    
                    showMessage('Access denied. This account is not authorized for admin access.', 'error');
                    return;
                }
                
                console.log('User authorized - updating database records...');
                
                // Get user data from database for session info
                let userData = null;
                let isFirstTimeLogin = false;
                
                try {
                    const snapshot = await database.ref(`adminUsers/${user.uid}`).once('value');
                    userData = snapshot.val();
                    
                    // Check if this is first time login
                    if (userData) {
                        isFirstTimeLogin = !userData.lastLogin || userData.loginCount === 0 || userData.loginCount === undefined;
                    }
                } catch (dbError) {
                    console.warn('Could not fetch user data from database:', dbError);
                }
                
                // Create login history entry
                const loginHistoryEntry = {
                    uid: user.uid,
                    email: user.email,
                    loginTime: new Date().toISOString(),
                    loginTimestamp: firebase.database.ServerValue.TIMESTAMP,
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    screenResolution: `${screen.width}x${screen.height}`,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    isFirstTimeLogin: isFirstTimeLogin,
                    sessionType: userData ? 'database' : 'legacy',
                    role: userData ? userData.role : 'Admin',
                    userName: userData ? (userData.fullName || `${userData.firstName} ${userData.lastName}`) : user.displayName || user.email
                };
                
                // Update last login in database (if user exists in database)
                if (userData) {
                    try {
                        const updates = {
                            lastLogin: new Date().toISOString(),
                            lastLoginTimestamp: firebase.database.ServerValue.TIMESTAMP,
                            loginCount: firebase.database.ServerValue.increment(1),
                            isActive: true
                        };
                        
                        await database.ref(`adminUsers/${user.uid}`).update(updates);
                        console.log('Database login records updated');
                    } catch (dbError) {
                        console.warn('Could not update database login records:', dbError);
                        // Continue with login even if database update fails
                    }
                }
                
                // Store login history
                try {
                    await database.ref('loginHistory').push(loginHistoryEntry);
                    console.log('Login history recorded');
                } catch (historyError) {
                    console.warn('Could not store login history:', historyError);
                    // Continue with login even if history logging fails
                }
                
                // Create valid session
                const sessionData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: userData ? (userData.fullName || userData.firstName + ' ' + userData.lastName) : (user.displayName || email),
                    role: userData ? userData.role : 'Admin',
                    loginTime: Date.now(),
                    lastActivity: Date.now(),
                    authorized: true,
                    userType: userData ? 'database' : 'legacy',
                    isFirstTimeLogin: isFirstTimeLogin
                };
                
                sessionStorage.setItem('pregnacare_admin_session', JSON.stringify(sessionData));
                console.log('Admin session created');
                
                // Show success message - different for first time vs returning users
                const welcomeMessage = isFirstTimeLogin 
                    ? `Welcome to PregnaCare, ${sessionData.displayName}! Your account is now active.`
                    : `Welcome back, ${sessionData.displayName}! Login successful.`;
                
                showMessage(welcomeMessage, 'success');
                
                // FIXED: Redirect after a delay without causing refresh loops
                setTimeout(() => {
                    authStateProcessed = true; // Prevent auth state changes from interfering
                    
                    // Check for saved redirect URL
                    const redirectUrl = sessionStorage.getItem('pregnacare_redirect_after_login');
                    
                    if (redirectUrl && redirectUrl !== window.location.href) {
                        sessionStorage.removeItem('pregnacare_redirect_after_login');
                        console.log('Redirecting to saved URL:', redirectUrl);
                        window.location.replace(redirectUrl); // Use replace instead of href
                    } else {
                        console.log('Redirecting to dashboard...');
                        window.location.replace('DashBoard.html'); // Use replace instead of href
                    }
                }, 2000);
                
            } catch (error) {
                console.error('Login error:', error);
                handleLoginError(error);
            } finally {
                isProcessingLogin = false;
                showLoading(false);
            }
        });
    }
    
    // Enhanced user authorization check
    async function checkUserAuthorization(user) {
        try {
            // First, check if user exists in database with Admin or SubAdmin role
            const snapshot = await database.ref(`adminUsers/${user.uid}`).once('value');
            const userData = snapshot.val();
            
            if (userData) {
                // Check if user is active and has admin privileges
                const isActive = userData.isActive === true || userData.isActive === 'true' || userData.isActive === 1;
                const hasAdminRole = userData.role === 'Admin' || userData.role === 'SubAdmin';
                
                if (isActive && hasAdminRole) {
                    console.log('User authorized via database:', userData.role);
                    return true;
                }
                
                console.log('User found in database but not authorized:', {
                    role: userData.role,
                    isActive: userData.isActive
                });
            }
            
            // Fallback: Check against hardcoded UIDs for legacy accounts
            if (AUTHORIZED_ADMIN_UIDS.includes(user.uid)) {
                console.log('User authorized via fallback UID list');
                return true;
            }
            
            console.log('User not authorized - not in database or UID list');
            return false;
            
        } catch (error) {
            console.error('Error checking user authorization:', error);
            
            // Fallback: Check against hardcoded UIDs if database check fails
            if (AUTHORIZED_ADMIN_UIDS.includes(user.uid)) {
                console.log('User authorized via fallback UID list (database error)');
                return true;
            }
            
            return false;
        }
    }
    
    // Enhanced loading state
    function showLoading(show) {
        if (!loginBtn) return;
        
        if (show) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="loading"></span>Signing in...';
            loginBtn.style.opacity = '0.7';
        } else {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
            loginBtn.style.opacity = '1';
        }
    }
    
    // FIXED: Message display without auto-hide for critical messages
    function showMessage(message, type = 'error') {
        hideMessages();
        
        const messageEl = type === 'success' || type === 'info' ? successMessage : errorMessage;
        if (!messageEl) return;
        
        messageEl.innerHTML = message;
        messageEl.style.display = 'block';
        
        // Auto-scroll to show message
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Only auto-hide non-critical messages
        if (type !== 'error' && !message.includes('Access denied') && !message.includes('successful')) {
            setTimeout(() => {
                if (messageEl.style.display === 'block') {
                    messageEl.style.display = 'none';
                }
            }, 8000);
        }
    }
    
    function hideMessages() {
        if (successMessage) successMessage.style.display = 'none';
        if (errorMessage) errorMessage.style.display = 'none';
    }
    
    // Handle login errors
    function handleLoginError(error) {
        let errorMsg = 'Login failed. Please try again.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMsg = 'No account found with this email address. Please check your email or contact support.';
                break;
            case 'auth/wrong-password':
                errorMsg = 'Incorrect password. Please check your password and try again.';
                break;
            case 'auth/invalid-email':
                errorMsg = 'Invalid email address format.';
                break;
            case 'auth/user-disabled':
                errorMsg = 'This account has been disabled. Please contact support.';
                break;
            case 'auth/too-many-requests':
                errorMsg = 'Too many failed login attempts. Please wait a few minutes before trying again.';
                break;
            case 'auth/network-request-failed':
                errorMsg = 'Network error. Please check your internet connection and try again.';
                break;
            case 'auth/invalid-credential':
                errorMsg = 'Invalid login credentials. Please check your email and password.';
                break;
            case 'auth/popup-closed-by-user':
                errorMsg = 'Login was cancelled. Please try again.';
                break;
            default:
                if (error.message && !error.message.includes('internal')) {
                    errorMsg = error.message;
                } else {
                    errorMsg = 'An unexpected error occurred. Please try again.';
                }
        }
        
        showMessage(errorMsg, 'error');
    }
    
    // Email validation
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) && 
               email.length <= 254 && 
               !email.includes('..') &&
               /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
    }
    
    // FIXED: Enhanced keyboard navigation without interference
    document.addEventListener('keydown', function(e) {
        // Only handle Enter if not already processing
        if (e.key === 'Enter' && !isProcessingLogin && e.target.tagName !== 'BUTTON') {
            e.preventDefault();
            if (loginForm && !loginBtn.disabled) {
                loginForm.dispatchEvent(new Event('submit'));
            }
        }
        
        // ESC to clear messages
        if (e.key === 'Escape') {
            hideMessages();
        }
    });
    
    // Enhanced input feedback
    const inputs = document.querySelectorAll('input[type="email"], input[type="password"]');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'translateY(-1px)';
            this.parentElement.style.transition = 'transform 0.2s ease';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'translateY(0)';
        });
        
        input.addEventListener('input', function() {
            // Remove validation classes on input
            this.classList.remove('valid', 'invalid');
            
            if (this.value.trim().length > 0) {
                if (this.type === 'email') {
                    if (isValidEmail(this.value.trim())) {
                        this.classList.add('valid');
                    }
                } else if (this.type === 'password') {
                    if (this.value.length >= 6) {
                        this.classList.add('valid');
                    }
                }
            }
        });
    });
    
    // Auto-focus on email field when page loads (only if empty)
    if (emailField && !emailField.value.trim()) {
        setTimeout(() => emailField.focus(), 100);
    }
});

// FIXED: Global logout function that prevents redirect loops
window.pregnaCareLogout = async function() {
    try {
        console.log('Initiating logout...');
        authStateProcessed = true; // Prevent auth state listener from interfering
        
        // Clear session first
        sessionStorage.removeItem('pregnacare_admin_session');
        sessionStorage.removeItem('pregnacare_redirect_after_login');
        sessionStorage.removeItem('pregnacare_new_account');
        
        // Sign out from Firebase
        await auth.signOut();
        
        // Clear any cached data
        if (window.caches) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        
        console.log('Logout successful');
        
        // Only redirect if not already on login page
        if (!window.location.href.includes('Admin login.html')) {
            window.location.replace('Admin login.html');
        }
        
    } catch (error) {
        console.error('Logout error:', error);
        // Force redirect even on error, but prevent loops
        if (!window.location.href.includes('Admin login.html')) {
            window.location.replace('Admin login.html');
        }
    }
};

// FIXED: Session management without causing refreshes
function checkSession() {
    const session = sessionStorage.getItem('pregnacare_admin_session');
    if (!session) {
        return false;
    }
    
    try {
        const sessionData = JSON.parse(session);
        
        // Check if session is older than 8 hours
        const eightHours = 8 * 60 * 60 * 1000;
        if (Date.now() - sessionData.loginTime > eightHours) {
            console.log('Session expired due to age');
            sessionStorage.removeItem('pregnacare_admin_session');
            return false;
        }
        
        // Check if user is inactive for more than 2 hours
        const twoHours = 2 * 60 * 60 * 1000;
        if (sessionData.lastActivity && Date.now() - sessionData.lastActivity > twoHours) {
            console.log('Session expired due to inactivity');
            sessionStorage.removeItem('pregnacare_admin_session');
            return false;
        }
        
        return true;
    } catch (e) {
        console.error('Session validation error:', e);
        sessionStorage.removeItem('pregnacare_admin_session');
        return false;
    }
}

// Update session activity
function updateSessionActivity() {
    const session = sessionStorage.getItem('pregnacare_admin_session');
    if (session) {
        try {
            const sessionData = JSON.parse(session);
            sessionData.lastActivity = Date.now();
            sessionStorage.setItem('pregnacare_admin_session', JSON.stringify(sessionData));
        } catch (e) {
            console.error('Failed to update session activity:', e);
        }
    }
}

// Track user activity to maintain session
['click', 'keypress', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, updateSessionActivity, { passive: true });
});

// FIXED: Session check without forced redirects
setInterval(() => {
    if (!checkSession() && sessionStorage.getItem('pregnacare_admin_session')) {
        // Session was invalid and has been removed
        console.log('Session invalidated by periodic check');
        
        // Only redirect if user is supposed to be logged in but isn't
        const currentUser = auth.currentUser;
        if (currentUser) {
            // User thinks they're logged in but session is invalid
            showMessage('Your session has expired. Please log in again.', 'error');
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

// Utility function to get current user session
window.getCurrentAdminSession = function() {
    const session = sessionStorage.getItem('pregnacare_admin_session');
    if (session && checkSession()) {
        try {
            return JSON.parse(session);
        } catch (e) {
            console.error('Invalid session data:', e);
            return null;
        }
    }
    return null;
};

// FIXED: Error logging without causing side effects
window.logAdminError = function(error, context = 'Admin Login') {
    const errorLog = {
        timestamp: new Date().toISOString(),
        context: context,
        error: {
            message: error.message || 'Unknown error',
            code: error.code || 'unknown',
            stack: error.stack || 'No stack trace'
        },
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: auth.currentUser ? auth.currentUser.uid : 'Not authenticated'
    };
    
    console.error('Admin Login Error:', errorLog);
    
    // In production, send to logging service
    // logToExternalService(errorLog);
};

// FIXED: Page visibility handling without refreshes
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        // Just update activity, don't trigger any redirects
        updateSessionActivity();
        console.log('Page became visible - session activity updated');
    }
});

// FIXED: Prevent accidental navigation only during active login
window.addEventListener('beforeunload', function(e) {
    if (isProcessingLogin) {
        e.preventDefault();
        e.returnValue = 'Login is in progress. Are you sure you want to leave?';
        return e.returnValue;
    }
});

// Add utility function to check if user can create sub-admins
window.canCreateSubAdmins = function() {
    const session = getCurrentAdminSession();
    if (!session) return false;
    
    // Allow if user is Admin role or in the authorized UIDs list
    return session.role === 'Admin' || AUTHORIZED_ADMIN_UIDS.includes(session.uid);
};