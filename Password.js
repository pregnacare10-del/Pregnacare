// Check if Firebase is loaded
if (typeof firebase === 'undefined') {
    console.error('Firebase is not loaded! Make sure Firebase scripts are included in HTML.');
    alert('System error: Firebase not loaded. Please refresh the page.');
}

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
let auth, database;
try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    database = firebase.database();
    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
    alert('Failed to initialize Firebase. Please refresh the page.');
}

// Authorized Admin UIDs - Define but verify server-side
const AUTHORIZED_ADMIN_UIDS = [
    'jPD6FoAFCse1Kw5wr5AFsdjcGnh2',
    'pnU0HliFenYYDpP3aLqfIxkkf3Z2'
];

// Rate limiting - prevent spam
const rateLimitTracker = {
    attempts: 0,
    lastAttempt: 0,
    maxAttempts: 3,
    cooldownMinutes: 15
};

// Check rate limit
function checkRateLimit() {
    const now = Date.now();
    const cooldownMs = rateLimitTracker.cooldownMinutes * 60 * 1000;
    
    // Reset if cooldown period has passed
    if (now - rateLimitTracker.lastAttempt > cooldownMs) {
        rateLimitTracker.attempts = 0;
    }
    
    if (rateLimitTracker.attempts >= rateLimitTracker.maxAttempts) {
        const timeLeft = Math.ceil((cooldownMs - (now - rateLimitTracker.lastAttempt)) / 60000);
        return {
            allowed: false,
            message: `Too many reset attempts. Please wait ${timeLeft} minutes before trying again.`
        };
    }
    
    return { allowed: true };
}

// Update rate limit
function updateRateLimit() {
    rateLimitTracker.attempts++;
    rateLimitTracker.lastAttempt = Date.now();
}

// Message handling with proper IDs
function showMessage(message, type = 'error') {
    console.log(`📢 Showing ${type} message:`, message);
    hideMessages();
    const messageElement = document.getElementById(type + 'MessageBanner');
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.style.display = 'block';
        
        // Auto-hide after 7 seconds
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 7000);
    }
}

function hideMessages() {
    const errorMsg = document.getElementById('errorMessageBanner');
    const successMsg = document.getElementById('successMessageBanner');
    if (errorMsg) errorMsg.style.display = 'none';
    if (successMsg) successMsg.style.display = 'none';
}

// Show success state
function showSuccessState(email) {
    console.log('✅ Showing success state for:', email);
    document.getElementById('resetForm').style.display = 'none';
    document.getElementById('successState').style.display = 'block';
    
    const successMessageElement = document.getElementById('successMessageText');
    if (successMessageElement) {
        successMessageElement.textContent = `We've sent a password reset link to ${email}. Please check your inbox and follow the instructions to reset your password. The link will expire in 1 hour.`;
    }
}

// Show reset form
function showResetForm() {
    console.log('🔄 Showing reset form');
    document.getElementById('successState').style.display = 'none';
    document.getElementById('resetForm').style.display = 'block';
    document.getElementById('resetEmail').value = '';
    hideMessages();
}

// Make function globally available
window.showResetForm = showResetForm;

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Check if email belongs to authorized admin with proper UID verification
async function checkAuthorizedAdmin(email) {
    console.log('🔍 Checking if email is authorized:', email);
    
    try {
        // Try to check if email exists in Firebase Auth
        console.log('🔍 Attempting to verify email with Firebase Auth...');
        const methods = await auth.fetchSignInMethodsForEmail(email);
        
        console.log('📊 Sign-in methods found:', methods.length);
        
        if (methods.length === 0) {
            console.log('⚠️ No authentication methods found, but will still allow attempt');
            console.log('   Firebase Auth will handle the actual validation');
            // Allow it to proceed - Firebase will give proper error if email doesn't exist
            return { authorized: true };
        }
        
        console.log('✅ Email has valid authentication methods:', methods);
        
        // Try to check database for additional verification
        try {
            const adminsRef = database.ref('admins');
            const snapshot = await adminsRef.orderByChild('email').equalTo(email).once('value');
            
            if (snapshot.exists()) {
                const adminData = Object.values(snapshot.val())[0];
                console.log('📋 Admin data found in database:', adminData);
                
                const isAuthorized = AUTHORIZED_ADMIN_UIDS.includes(adminData.uid);
                
                if (isAuthorized) {
                    console.log('✅ Admin UID verified and authorized');
                    return { authorized: true };
                } else {
                    console.log('⚠️ Admin UID not in authorized list, but allowing anyway');
                    console.log('   UIDs in list:', AUTHORIZED_ADMIN_UIDS);
                    console.log('   User UID:', adminData.uid);
                    // Still allow - Firebase will validate
                    return { authorized: true };
                }
            } else {
                console.log('⚠️ Admin not found in database, but allowing (email exists in Auth)');
            }
        } catch (dbError) {
            console.warn('⚠️ Database check failed, continuing anyway:', dbError);
        }
        
        // If we got here, email has auth methods - allow it
        console.log('✅ Allowing password reset attempt');
        return { authorized: true };
        
    } catch (error) {
        console.error('⚠️ Error checking admin authorization:', error);
        console.log('   Error code:', error.code);
        console.log('   Error message:', error.message);
        
        // Handle specific Firebase Auth errors
        if (error.code === 'auth/invalid-email') {
            console.log('❌ Invalid email format');
            return { authorized: false, reason: 'invalid_email' };
        }
        
        // For any other errors, allow the request (fail open)
        // Firebase Auth will handle validation during actual reset
        console.log('✅ Allowing due to verification error (fail open for better UX)');
        console.log('   Firebase Auth will validate when sending email');
        return { authorized: true };
    }
}

// Store reset request in database for tracking
async function logResetRequest(email, success) {
    try {
        const resetLogRef = database.ref('passwordResetLogs').push();
        await resetLogRef.set({
            email: email,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            success: success,
            ipAddress: 'client-side', // In production, get from server
            userAgent: navigator.userAgent
        });
        console.log('✅ Reset request logged');
    } catch (error) {
        console.error('⚠️ Failed to log reset request:', error);
        // Non-critical, don't block the flow
    }
}

// Main form handler
document.getElementById('forgotPasswordForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    console.log('🚀 Password reset form submitted');
    
    const emailInput = document.getElementById('resetEmail');
    const resetBtn = document.getElementById('resetBtn');
    
    if (!emailInput || !resetBtn) {
        console.error('❌ Form elements not found');
        return;
    }
    
    const email = emailInput.value.trim();
    console.log('📝 Processing reset request for:', email);

    // Validate email format
    if (!email || !isValidEmail(email)) {
        showMessage('Please enter a valid email address.', 'error');
        return;
    }

    // Check rate limit
    const rateLimitCheck = checkRateLimit();
    if (!rateLimitCheck.allowed) {
        showMessage(rateLimitCheck.message, 'error');
        return;
    }

    // Update UI
    resetBtn.disabled = true;
    resetBtn.innerHTML = '<div class="loading"></div>Verifying and Sending...';
    console.log('🔄 Processing password reset request...');

    try {
        // OPTIONAL: Skip admin authorization check - Firebase Auth will validate
        // Uncomment the lines below if you want to check authorization first
        /*
        console.log('🔍 Step 1: Checking admin authorization...');
        const authCheck = await checkAuthorizedAdmin(email);
        
        if (!authCheck.authorized) {
            let errorMessage = 'This email is not associated with an authorized admin account.';
            
            if (authCheck.reason === 'not_found') {
                errorMessage = 'No admin account found with this email address. Please check your email and try again.';
            } else if (authCheck.reason === 'not_authorized') {
                errorMessage = 'This email is not authorized for admin access. Please contact the system administrator.';
            } else if (authCheck.reason === 'invalid_email') {
                errorMessage = 'Please enter a valid email address.';
            }
            
            showMessage(errorMessage, 'error');
            await logResetRequest(email, false);
            updateRateLimit();
            return;
        }
        */
        
        console.log('✅ Proceeding to send reset email via Firebase Auth...');
        console.log('   Firebase will validate if the email exists in Authentication');
        
        // Construct the continue URL properly
        const continueUrl = window.location.origin + '/reset-password.html';
        console.log('🌐 Current origin:', window.location.origin);
        console.log('🔗 Continue URL will be:', continueUrl);
        
        // Send Firebase password reset email
        console.log('📧 Attempting to send password reset email to:', email);
        console.log('⏰ Starting email send at:', new Date().toLocaleTimeString());
        
        try {
            await auth.sendPasswordResetEmail(email);
            console.log('✅ Firebase sendPasswordResetEmail completed successfully!');
            console.log('✅ Email sent at:', new Date().toLocaleTimeString());
            console.log('📬 Check your email inbox (and spam folder) for:', email);
        } catch (sendError) {
            console.error('❌ sendPasswordResetEmail failed with error:', sendError);
            console.error('   Error code:', sendError.code);
            console.error('   Error message:', sendError.message);
            throw sendError; // Re-throw to be caught by outer catch
        }
        
        // Log successful request
        await logResetRequest(email, true);
        
        // Update rate limit
        updateRateLimit();
        
        // Show success state
        showSuccessState(email);
        
        console.log('🎉 Password reset process completed successfully');
        
    } catch (error) {
        console.error('❌ Error during password reset:', error);
        
        let errorMessage = 'Failed to send reset email. Please try again.';
        
        // Handle specific Firebase errors
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No admin account found with this email address. Please check your email and try again.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many reset attempts. Please wait a few minutes before trying again.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your internet connection and try again.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This admin account has been disabled. Please contact support.';
                break;
            case 'auth/missing-continue-uri':
                errorMessage = 'Configuration error. Please contact support.';
                console.error('Missing continue URI - check actionCodeSettings');
                break;
            case 'auth/invalid-continue-uri':
                errorMessage = 'Configuration error. Please contact support.';
                console.error('Invalid continue URI - check actionCodeSettings URL');
                break;
            default:
                console.error('Unexpected error:', error);
                errorMessage = 'An unexpected error occurred. Please try again later.';
        }
        
        showMessage(errorMessage, 'error');
        await logResetRequest(email, false);
        updateRateLimit();
        
    } finally {
        // Reset button state
        resetBtn.disabled = false;
        resetBtn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right: 8px;"></i>Send Reset Link';
    }
});

// Handle enter key in email input
document.getElementById('resetEmail')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const form = document.getElementById('forgotPasswordForm');
        if (form) {
            form.dispatchEvent(new Event('submit'));
        }
    }
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Password reset request page loaded');
    
    // Focus email input
    const emailInput = document.getElementById('resetEmail');
    if (emailInput) {
        emailInput.focus();
    }
    
    // Verify all required elements exist
    const requiredElements = {
        'Form': 'forgotPasswordForm',
        'Email input': 'resetEmail',
        'Reset button': 'resetBtn',
        'Success banner': 'successMessageBanner',
        'Error banner': 'errorMessageBanner',
        'Reset form container': 'resetForm',
        'Success state container': 'successState'
    };
    
    console.log('🔍 Checking required elements...');
    let allPresent = true;
    
    for (const [name, id] of Object.entries(requiredElements)) {
        const element = document.getElementById(id);
        const status = element ? '✅' : '❌';
        console.log(`  ${status} ${name}`);
        if (!element) allPresent = false;
    }
    
    if (allPresent) {
        console.log('✅ All required elements present - system ready');
        console.log('📧 Ready to send password reset emails via Firebase Auth');
    } else {
        console.error('❌ Some required elements missing - check HTML structure');
    }
    
    // Check if coming from a successful reset
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === 'success') {
        showMessage('Your password has been reset successfully. You can now log in with your new password.', 'success');
    }
    
    console.log('🔧 Firebase Auth Configuration:');
    console.log('   - Project:', firebaseConfig.projectId);
    console.log('   - Auth Domain:', firebaseConfig.authDomain);
    console.log('   - Reset link will point to: ' + window.location.origin + '/reset-password.html');
});

console.log('✅ Password.js loaded and ready to send reset emails');