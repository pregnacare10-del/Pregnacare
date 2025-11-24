// PregnaCare Unified Authentication System
// This file handles all authentication across the entire application
// Include this file in every page: <script src="pregnacare-auth.js"></script>

(function() {
    'use strict';

    // Firebase configuration from Admin login.html
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

    // Authorized Admin UID
    const AUTHORIZED_ADMIN_UID = 'Eot0CErzLgetsS0bBCBtrkRCvXD2';

    class PregnaCareAuth {
        constructor() {
            this.auth = null;
            this.database = null;
            this.currentUser = null;
            this.initialized = false;
            this.sessionCheckInterval = null;
            
            // Session configuration
            this.SESSION_KEY = 'pregnacare_admin_session';
            this.SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours
            this.INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
            this.ACTIVITY_CHECK_INTERVAL = 60 * 1000; // 1 minute
            
            // Public pages that don't require authentication
            this.PUBLIC_PAGES = ['Admin login.html', 'Account.html', 'Password.html', 'Dashboard.html'];
            
            this.init();
        }

        async init() {
            if (this.initialized) return;
            
            try {
                // Initialize Firebase
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                    console.log('PregnaCareAuth: Firebase initialized');
                }
                
                this.auth = firebase.auth();
                this.database = firebase.database();
                this.initialized = true;
                
                // Set up auth state listener
                this.setupAuthStateListener();
                
                // Set up activity tracking
                this.setupActivityTracking();
                
                // Set up logout button handlers
                this.setupLogoutHandlers();
                
                // Start session checking
                this.startSessionChecking();
                
                // Check current page access
                this.checkPageAccess();
                
            } catch (error) {
                console.error('PregnaCareAuth: Initialization error:', error);
            }
        }

        setupAuthStateListener() {
            this.auth.onAuthStateChanged(async (user) => {
                if (user) {
                    console.log('PregnaCareAuth: User authenticated:', user.email);
                    
                    // Verify authorized admin
                    if (user.uid !== AUTHORIZED_ADMIN_UID) {
                        console.error('PregnaCareAuth: Unauthorized user detected');
                        await this.signOut();
                        this.showMessage('Access denied. Only authorized administrators can access this portal.', 'error');
                        return;
                    }
                    
                    this.currentUser = user;
                    
                    // Create/update session
                    this.createSession(user);
                    
                    // Update last login in database
                    await this.updateLastLogin(user.uid);
                    
                    // Update UI elements
                    this.updateUserInterface(user);
                    
                    // Handle redirect after login if needed
                    this.handlePostLoginRedirect();
                    
                } else {
                    console.log('PregnaCareAuth: No authenticated user');
                    this.currentUser = null;
                    this.clearSession();
                    
                    // Check if we need to redirect to login
                    this.checkPageAccess();
                }
            });
        }

        createSession(user) {
            const sessionData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                loginTime: Date.now(),
                lastActivity: Date.now()
            };
            
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
            console.log('PregnaCareAuth: Session created');
        }

        getSession() {
            try {
                const sessionStr = sessionStorage.getItem(this.SESSION_KEY);
                return sessionStr ? JSON.parse(sessionStr) : null;
            } catch (error) {
                console.error('PregnaCareAuth: Error parsing session:', error);
                return null;
            }
        }

        updateSession() {
            const session = this.getSession();
            if (session) {
                session.lastActivity = Date.now();
                sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
            }
        }

        clearSession() {
            sessionStorage.removeItem(this.SESSION_KEY);
            sessionStorage.removeItem('pregnacare_new_account');
            console.log('PregnaCareAuth: Session cleared');
        }

        async updateLastLogin(uid) {
            try {
                await this.database.ref(`adminUsers/${uid}`).update({
                    lastLogin: new Date().toISOString(),
                    lastLoginTimestamp: firebase.database.ServerValue.TIMESTAMP
                });
            } catch (error) {
                console.warn('PregnaCareAuth: Could not update last login:', error);
            }
        }

        setupActivityTracking() {
            // Track user activity
            ['click', 'keypress', 'scroll', 'touchstart'].forEach(event => {
                document.addEventListener(event, () => this.updateSession(), { passive: true });
            });
        }

        setupLogoutHandlers() {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.attachLogoutHandlers());
            } else {
                this.attachLogoutHandlers();
            }
        }

        attachLogoutHandlers() {
            // Find all logout elements
            const logoutSelectors = [
                '.logout',
                '#logoutBtn',
                '[onclick*="logout"]',
                '[href*="logout"]',
                '.logout-btn',
                '.logout-link',
                '[data-action="logout"]'
            ];
            
            const logoutElements = document.querySelectorAll(logoutSelectors.join(', '));
            
            logoutElements.forEach(element => {
                // Remove existing handlers
                element.onclick = null;
                element.removeAttribute('onclick');
                
                // Add new handler
                element.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const confirmed = confirm('Are you sure you want to logout?');
                    if (confirmed) {
                        await this.signOut();
                    }
                });
                
                // Add cursor pointer
                element.style.cursor = 'pointer';
            });
            
            console.log(`PregnaCareAuth: Attached logout handlers to ${logoutElements.length} elements`);
        }

        startSessionChecking() {
            // Check session every minute
            this.sessionCheckInterval = setInterval(() => {
                this.checkSessionValidity();
            }, this.ACTIVITY_CHECK_INTERVAL);
        }

        checkSessionValidity() {
            const session = this.getSession();
            if (!session) return;
            
            const now = Date.now();
            const sessionAge = now - session.loginTime;
            const inactivityTime = now - session.lastActivity;
            
            // Check session timeout
            if (sessionAge > this.SESSION_TIMEOUT) {
                console.log('PregnaCareAuth: Session expired');
                this.showMessage('Your session has expired. Please login again.', 'warning');
                this.signOut();
                return;
            }
            
            // Check inactivity timeout
            if (inactivityTime > this.INACTIVITY_TIMEOUT) {
                console.log('PregnaCareAuth: Session inactive');
                this.showMessage('You have been logged out due to inactivity.', 'info');
                this.signOut();
                return;
            }
            
            // Warn if session is about to expire (15 minutes before)
            if (sessionAge > this.SESSION_TIMEOUT - 15 * 60 * 1000 && 
                sessionAge < this.SESSION_TIMEOUT - 14 * 60 * 1000) {
                const remainingMinutes = Math.floor((this.SESSION_TIMEOUT - sessionAge) / 60000);
                this.showMessage(`Your session will expire in ${remainingMinutes} minutes.`, 'warning');
            }
        }

        checkPageAccess() {
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            const isPublicPage = this.PUBLIC_PAGES.some(page => 
                currentPage.toLowerCase() === page.toLowerCase()
            );
            
            if (!isPublicPage && !this.isAuthenticated()) {
                console.log('PregnaCareAuth: Unauthorized page access, redirecting to login');
                
                // Save current URL for redirect after login
                const currentUrl = window.location.href;
                sessionStorage.setItem('pregnacare_redirect_after_login', currentUrl);
                
                window.location.href = 'Admin login.html';
            }
        }

        handlePostLoginRedirect() {
            const redirectUrl = sessionStorage.getItem('pregnacare_redirect_after_login');
            if (redirectUrl) {
                sessionStorage.removeItem('pregnacare_redirect_after_login');
                
                // Only redirect if we're currently on the login page
                const currentPage = window.location.pathname.split('/').pop();
                if (currentPage === 'Admin login.html') {
                    window.location.href = redirectUrl;
                }
            }
        }

        isAuthenticated() {
            // Check if we have a current user
            if (!this.currentUser) return false;
            
            // Check if it's the authorized admin
            if (this.currentUser.uid !== AUTHORIZED_ADMIN_UID) return false;
            
            // Check if session exists and is valid
            const session = this.getSession();
            if (!session) return false;
            
            // Check session age
            const sessionAge = Date.now() - session.loginTime;
            if (sessionAge > this.SESSION_TIMEOUT) return false;
            
            return true;
        }

        getCurrentUser() {
            if (!this.isAuthenticated()) return null;
            
            const session = this.getSession();
            return {
                uid: session.uid,
                email: session.email,
                displayName: session.displayName,
                isAuthorized: true
            };
        }

        async signOut() {
            console.log('PregnaCareAuth: Signing out...');
            
            try {
                // Clear session first
                this.clearSession();
                
                // Clear interval
                if (this.sessionCheckInterval) {
                    clearInterval(this.sessionCheckInterval);
                }
                
                // Sign out from Firebase
                await this.auth.signOut();
                
                // Show message
                this.showMessage('You have been logged out successfully.', 'success');
                
                // Redirect to login
                setTimeout(() => {
                    window.location.href = 'Admin login.html';
                }, 1000);
                
            } catch (error) {
                console.error('PregnaCareAuth: Logout error:', error);
                // Force redirect even on error
                window.location.href = 'Admin login.html';
            }
        }

        updateUserInterface(user) {
            // Update user display elements
            const userElements = document.querySelectorAll('.user, .user-info, .admin-name');
            
            userElements.forEach(element => {
                const displayName = user.displayName || user.email.split('@')[0];
                const initials = this.getInitials(displayName);
                
                // Check if it's the main user element with circle
                if (element.classList.contains('user')) {
                    const circle = element.querySelector('.circle');
                    const nameElement = element.querySelector('p');
                    
                    if (circle) circle.textContent = initials;
                    if (nameElement) {
                        nameElement.innerHTML = `${displayName}<br><span>Administrator</span>`;
                    }
                } else {
                    element.textContent = displayName;
                }
            });
            
            // Update email displays
            const emailElements = document.querySelectorAll('.user-email, .admin-email');
            emailElements.forEach(element => {
                element.textContent = user.email;
            });
        }

        getInitials(name) {
            if (!name) return 'AD';
            
            const parts = name.trim().split(' ').filter(p => p.length > 0);
            if (parts.length === 0) return 'AD';
            if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
            
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }

        showMessage(message, type = 'info') {
            // Check if notification system exists
            if (window.showNotification) {
                window.showNotification(message, type);
                return;
            }
            
            // Fallback to custom notification
            const notification = document.createElement('div');
            notification.className = `pregnacare-notification ${type}`;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
                color: white;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                z-index: 99999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                animation: slideIn 0.3s ease-out;
            `;
            
            notification.textContent = message;
            document.body.appendChild(notification);
            
            // Auto remove after 5 seconds
            setTimeout(() => {
                notification.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }, 5000);
        }

        // Public method to refresh session (extends timeout)
        refreshSession() {
            if (this.isAuthenticated()) {
                const session = this.getSession();
                session.loginTime = Date.now();
                session.lastActivity = Date.now();
                sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
                console.log('PregnaCareAuth: Session refreshed');
                return true;
            }
            return false;
        }

        // Clean up method
        cleanup() {
            if (this.sessionCheckInterval) {
                clearInterval(this.sessionCheckInterval);
            }
        }
    }

    // Create and initialize the auth manager
    const authManager = new PregnaCareAuth();

    // Make it globally accessible
    window.PregnaCareAuth = authManager;

    // Legacy support
    window.pregnaCareAuth = authManager;

    // Add global logout function for backward compatibility
    window.pregnaCareLogout = () => authManager.signOut();

    // Add styles for notifications
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes fadeOut {
            from {
                opacity: 1;
            }
            to {
                opacity: 0;
            }
        }
        
        .pregnacare-notification {
            max-width: 350px;
            word-wrap: break-word;
        }
    `;
    document.head.appendChild(style);

    // Log initialization
    console.log('PregnaCare Unified Authentication System initialized');
    
})();