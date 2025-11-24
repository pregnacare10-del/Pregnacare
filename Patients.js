// PregnaCare Patients System - Complete Version with Dashboard Notifications
// Version: 6.0.0 COMPLETE - ALL FEATURES + NOTIFICATIONS + FULLY INTEGRATED PATIENT RECORD FORM
// Admin User: fyPV8Gase6cs72cPT3JzzEHL17h2
// Sub-Admin User: jPD6FoAFCse1Kw5wr5AFsdjcGnh2

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
                
                console.log('User authenticated:', {
                    uid: user.uid,
                    email: user.email,
                    displayName: this.userDisplayName,
                    isAdmin: this.isAdmin,
                    isSubAdmin: this.isSubAdmin
                });
                
                this.updateUserInterface();
                this.logUserActivity('access_patients_module');
                
                if (window.patientsApp) {
                    window.patientsApp.onAuthenticated();
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
                module: 'patients',
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
// NOTIFICATIONS MANAGER (from Dashboard)
// ========================================

class NotificationsManager {
    constructor(authManager, dataManager) {
        this.authManager = authManager;
        this.dataManager = dataManager;
        this.notifications = [];
        this.unreadCount = 0;
        this.storageKey = 'pregnacare_notifications_read_patients';
        this.readNotifications = this.loadReadNotifications();
    }

    initialize() {
        if (!this.authManager.isAuthenticated) return;
        
        console.log('🔔 Initializing Notifications Manager...');
        this.generateNotifications();
        this.updateNotificationBadge();
        this.renderNotifications();
        
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
        setInterval(() => {
            const previousCount = this.notifications.length;
            this.generateNotifications();
            this.updateNotificationBadge();
            
            const newCount = this.notifications.length;
            if (newCount > previousCount) {
                console.log(`🔔 ${newCount - previousCount} new notification(s)`);
            }
        }, 30000);

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

        const patients = Object.values(this.dataManager.patients || {});
        
        // 1. HIGH-RISK PATIENTS
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

        // 2. FREQUENT VISITORS
        const frequentVisitors = patients.filter(p => {
            const visitNum = parseInt(p.visitNumber);
            return !isNaN(visitNum) && visitNum > 10;
        });

        if (frequentVisitors.length > 0) {
            this.notifications.push({
                id: 'frequent-visitors',
                type: 'info',
                icon: 'fa-user-check',
                title: `${frequentVisitors.length} frequent visitor${frequentVisitors.length > 1 ? 's' : ''}`,
                message: 'More than 10 visits',
                timestamp: new Date().toISOString(),
                read: this.readNotifications['frequent-visitors'] || false,
                priority: 'medium',
                color: '#3b82f6'
            });
        }

        // 3. NEW PATIENTS TODAY
        const newPatientsToday = patients.filter(p => {
            if (!p.createdAt) return false;
            const createdDate = new Date(p.createdAt);
            createdDate.setHours(0, 0, 0, 0);
            return createdDate.getTime() === today.getTime();
        });

        if (newPatientsToday.length > 0) {
            this.notifications.push({
                id: 'new-patients-today',
                type: 'patient',
                icon: 'fa-user-plus',
                title: `${newPatientsToday.length} new patient${newPatientsToday.length > 1 ? 's' : ''} today`,
                message: 'Recently added',
                timestamp: new Date().toISOString(),
                read: this.readNotifications['new-patients-today'] || false,
                priority: 'high',
                color: '#10b981'
            });
        }

        // 4. ONGOING PATIENTS
        const ongoingPatients = patients.filter(p => p.status === 'Ongoing');

        if (ongoingPatients.length > 0) {
            this.notifications.push({
                id: 'ongoing-patients',
                type: 'info',
                icon: 'fa-heartbeat',
                title: `${ongoingPatients.length} ongoing patient${ongoingPatients.length > 1 ? 's' : ''}`,
                message: 'Active cases',
                timestamp: new Date().toISOString(),
                read: this.readNotifications['ongoing-patients'] || false,
                priority: 'low',
                color: '#f59e0b'
            });
        }

        // 5. FIRST-TIME VISITORS
        const firstTimeVisitors = patients.filter(p => 
            p.visitNumber === '1' && p.status === 'Ongoing'
        );

        if (firstTimeVisitors.length > 0) {
            this.notifications.push({
                id: 'first-time-visitors',
                type: 'patient',
                icon: 'fa-star',
                title: `${firstTimeVisitors.length} first-time visitor${firstTimeVisitors.length > 1 ? 's' : ''}`,
                message: 'New to the clinic',
                timestamp: new Date().toISOString(),
                read: this.readNotifications['first-time-visitors'] || false,
                priority: 'medium',
                color: '#22c55e'
            });
        }

        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        this.notifications.sort((a, b) => {
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        this.unreadCount = this.notifications.filter(n => !n.read).length;
        
        console.log(`📊 Generated ${this.notifications.length} notifications (${this.unreadCount} unread)`);
    }

    updateNotificationBadge() {
        const badge = document.querySelector('#notifIcon .notification-badge');
        if (badge) {
            badge.textContent = this.unreadCount;
            badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
            
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
                <li class="notification-empty">
                    <i class="fas fa-check-circle"></i>
                    <p>All caught up!</p>
                    <small>No new notifications</small>
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
            
            if (window.patientsApp) {
                window.patientsApp.showNotification('All notifications marked as read', 'success');
            }
        }
    }

    handleNotificationAction(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (!notification) return;

        this.markAsRead(notificationId);
        this.renderNotifications();

        const notifDropdown = document.getElementById('notifDropdown');
        if (notifDropdown) {
            notifDropdown.classList.remove('show');
        }

        console.log(`Notification '${notificationId}' clicked`);
    }
}

// ========================================
// AUTO-HIDE TOPBAR SYSTEM
// ========================================

class AutoHideTopbar {
    constructor() {
        this.topbar = document.getElementById('topbar');
        this.content = document.querySelector('.content');
        this.isEnabled = true;
        this.scrollThreshold = 5;
        this.hideDelay = 50;
        this.showDelay = 0;
        this.lastScrollTop = 0;
        this.isHidden = false;
        this.hideTimeout = null;
        this.showTimeout = null;
        this.touchStartY = 0;
        this.touchEndY = 0;
        this.init();
    }

    init() {
        if (!this.topbar) {
            console.warn('Auto-hide topbar: Topbar element not found');
            return;
        }
        this.bindEvents();
        this.topbar.classList.add('visible');
        console.log('Auto-hide topbar initialized');
    }

    bindEvents() {
        let scrollTimer = null;
        window.addEventListener('scroll', () => {
            if (scrollTimer) return;
            scrollTimer = setTimeout(() => {
                this.handleScroll();
                scrollTimer = null;
            }, 8);
        }, { passive: true });

        document.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        document.addEventListener('touchstart', (e) => {
            this.handleTouchStart(e);
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            this.handleTouchEnd(e);
        }, { passive: true });

        window.addEventListener('resize', () => {
            this.recalculate();
        });

        document.addEventListener('focusin', (e) => {
            if (this.isTopbarElement(e.target)) {
                this.show();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.show();
            }
        });
    }

    handleScroll() {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollDiff = currentScrollTop - this.lastScrollTop;
        
        this.clearTimeouts();

        if (currentScrollTop <= 5) {
            this.show();
            this.lastScrollTop = currentScrollTop;
            return;
        }

        if (Math.abs(scrollDiff) > this.scrollThreshold) {
            if (scrollDiff > 0) {
                this.hideTimeout = setTimeout(() => {
                    this.hide();
                }, this.hideDelay);
            } else {
                this.show();
            }
        }

        this.lastScrollTop = currentScrollTop;
    }

    handleMouseMove(e) {
        if (e.clientY <= 50 && this.isHidden) {
            this.show();
        }
    }

    handleTouchStart(e) {
        this.touchStartY = e.touches[0].clientY;
    }

    handleTouchEnd(e) {
        this.touchEndY = e.changedTouches[0].clientY;
        const touchDiff = this.touchStartY - this.touchEndY;
        
        if (this.touchStartY <= 50 && touchDiff < -30) {
            this.show();
        }
    }

    hide() {
        if (this.isHidden) return;
        this.topbar.classList.remove('visible');
        this.topbar.classList.add('hidden');
        document.body.classList.add('topbar-hidden');
        this.isHidden = true;
        this.dispatchEvent('topbar:hidden');
    }

    show() {
        if (!this.isHidden && this.topbar.classList.contains('visible')) return;
        this.clearTimeouts();
        this.topbar.classList.remove('hidden');
        this.topbar.classList.add('visible');
        document.body.classList.remove('topbar-hidden');
        this.isHidden = false;
        this.dispatchEvent('topbar:shown');
    }

    clearTimeouts() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
            this.showTimeout = null;
        }
    }

    isTopbarElement(element) {
        return this.topbar && this.topbar.contains(element);
    }

    recalculate() {}

    dispatchEvent(eventName, data = {}) {
        const event = new CustomEvent(eventName, {
            detail: { ...data, isHidden: this.isHidden }
        });
        document.dispatchEvent(event);
    }

    forceShow() {
        this.show();
    }

    forceHide() {
        this.hide();
    }

    getState() {
        return {
            isHidden: this.isHidden,
            scrollThreshold: this.scrollThreshold,
            hideDelay: this.hideDelay,
            showDelay: this.showDelay
        };
    }

    updateConfig(config) {
        if (config.scrollThreshold !== undefined) {
            this.scrollThreshold = Math.max(1, config.scrollThreshold);
        }
        if (config.hideDelay !== undefined) {
            this.hideDelay = Math.max(0, config.hideDelay);
        }
        if (config.showDelay !== undefined) {
            this.showDelay = Math.max(0, config.showDelay);
        }
        console.log('Auto-hide topbar config updated:', this.getState());
    }

    destroy() {
        this.clearTimeouts();
        this.show();
        console.log('Auto-hide topbar destroyed');
    }
}

// ========================================
// PATIENT REGISTRATION NOTIFICATION SYSTEM
// ========================================

class PatientRegistrationNotificationSystem {
    constructor(authManager, database) {
        this.authManager = authManager;
        this.database = database;
        this.pendingRegistrations = {};
        this.notificationSound = null;
        this.initialize();
    }

    initialize() {
        console.log('Initializing Patient Registration Notification System...');
        this.createNotificationSound();
        this.monitorPendingRegistrations();
        this.setupNotificationUI();
    }

    createNotificationSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.notificationSound = () => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
            };
        } catch (error) {
            console.warn('Could not create notification sound:', error);
        }
    }

    monitorPendingRegistrations() {
        this.database.ref('pendingPatientRegistrations').on('child_added', (snapshot) => {
            const registration = snapshot.val();
            const registrationKey = snapshot.key;
            
            if (registration && registration.status === 'pending') {
                console.log('New patient registration detected:', registration);
                
                this.pendingRegistrations[registrationKey] = {
                    ...registration,
                    key: registrationKey,
                    receivedAt: Date.now()
                };
                
                this.playNotificationSound();
                this.showRegistrationNotification(registrationKey, registration);
                this.updateNotificationBadge();
                this.showBrowserNotification(registration);
            }
        });

        this.database.ref('pendingPatientRegistrations').on('child_changed', (snapshot) => {
            const registration = snapshot.val();
            const registrationKey = snapshot.key;
            
            if (registration.status !== 'pending') {
                delete this.pendingRegistrations[registrationKey];
                this.updateNotificationBadge();
            }
        });

        this.database.ref('pendingPatientRegistrations').on('child_removed', (snapshot) => {
            const registrationKey = snapshot.key;
            delete this.pendingRegistrations[registrationKey];
            this.updateNotificationBadge();
        });
    }

    setupNotificationUI() {
        const notificationPanel = document.createElement('div');
        notificationPanel.id = 'registrationNotificationPanel';
        notificationPanel.className = 'registration-notification-panel';
        notificationPanel.style.cssText = `
            position: fixed;
            top: 90px;
            right: 30px;
            width: 450px;
            max-height: 70vh;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
            display: none;
            z-index: 10000;
            overflow: hidden;
            animation: slideInRight 0.3s ease-out;
        `;
        
        notificationPanel.innerHTML = `
            <div style="background: linear-gradient(135deg, var(--heart-red), var(--deep-red)); padding: 20px; color: white; position: sticky; top: 0; z-index: 1;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <h3 style="margin: 0; font-size: 18px; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-user-clock"></i>
                            Pending Registrations
                        </h3>
                        <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">Review and approve new patient accounts</p>
                    </div>
                    <button onclick="document.getElementById('registrationNotificationPanel').style.display='none'" style="background: none; border: none; color: white; cursor: pointer; font-size: 20px; padding: 5px; opacity: 0.8; transition: opacity 0.2s;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div id="registrationNotificationList" style="max-height: calc(70vh - 100px); overflow-y: auto; padding: 15px; background: #fafafa;">
            </div>
        `;
        
        document.body.appendChild(notificationPanel);

        // Prevent panel from closing when clicking inside
        notificationPanel.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        this.addNotificationStyles();
    }

    addNotificationStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .registration-notification-item {
                background: #f9fafb;
                border: 2px solid #e5e7eb;
                border-radius: 12px;
                padding: 15px;
                margin-bottom: 12px;
                transition: all 0.3s ease;
            }
            .registration-notification-item:hover {
                border-color: var(--heart-red);
                box-shadow: 0 4px 12px rgba(250, 49, 74, 0.1);
            }
            .action-buttons {
                display: flex;
                gap: 8px;
                margin-top: 12px;
            }
            .action-btn {
                flex: 1;
                padding: 8px 12px;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            .action-btn.accept {
                background: linear-gradient(135deg, #22c55e, #16a34a);
                color: white;
            }
            .action-btn.accept:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
            }
            .action-btn.decline {
                background: linear-gradient(135deg, #ef4444, #dc2626);
                color: white;
            }
            .action-btn.decline:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
            }
            .action-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    toggleNotificationPanel() {
        const panel = document.getElementById('registrationNotificationPanel');
        if (panel) {
            const isVisible = panel.style.display === 'block';
            panel.style.display = isVisible ? 'none' : 'block';
            
            if (!isVisible) {
                this.renderNotificationList();
            }
        }
    }

    showRegistrationNotification(key, registration) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, var(--heart-red), var(--deep-red));
            color: white;
            padding: 15px 20px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 10001;
            animation: slideInRight 0.3s ease-out;
            max-width: 350px;
            cursor: pointer;
        `;
        
        toast.innerHTML = `
            <div style="display: flex; align-items: start; gap: 12px;">
                <i class="fas fa-user-plus" style="font-size: 24px; margin-top: 2px;"></i>
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 4px;">New Patient Registration</div>
                    <div style="font-size: 13px; opacity: 0.9;">
                        ${registration.fullName || registration.firstName + ' ' + registration.lastName}
                    </div>
                    <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">
                        ${registration.email}
                    </div>
                </div>
                <i class="fas fa-times" style="cursor: pointer; opacity: 0.7; font-size: 14px;" onclick="this.parentElement.parentElement.remove()"></i>
            </div>
        `;
        
        toast.addEventListener('click', (e) => {
            if (e.target.tagName !== 'I') {
                this.toggleNotificationPanel();
                toast.remove();
            }
        });
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }, 8000);
    }

    renderNotificationList() {
        const listContainer = document.getElementById('registrationNotificationList');
        if (!listContainer) return;

        const pendingCount = Object.keys(this.pendingRegistrations).length;

        if (pendingCount === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 60px 30px; color: #6b7280;">
                    <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: linear-gradient(135deg, #f3f4f6, #e5e7eb); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-check-circle" style="font-size: 40px; color: #9ca3af;"></i>
                    </div>
                    <h4 style="font-size: 16px; margin: 0 0 8px 0; color: #374151; font-weight: 600;">All Caught Up!</h4>
                    <p style="font-size: 14px; margin: 0; color: #6b7280; line-height: 1.5;">No pending patient registrations at the moment.</p>
                    <small style="font-size: 12px; opacity: 0.7; display: block; margin-top: 12px;">New registrations from the mobile app will appear here.</small>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = '';

        const sortedRegistrations = Object.entries(this.pendingRegistrations)
            .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

        sortedRegistrations.forEach(([key, registration]) => {
            const item = this.createNotificationItem(key, registration);
            listContainer.appendChild(item);
        });
    }

    createNotificationItem(key, registration) {
        const item = document.createElement('div');
        item.className = 'registration-notification-item';
        item.dataset.key = key;
        
        const timeAgo = this.getTimeAgo(registration.createdAt || registration.receivedAt);
        
        item.innerHTML = `
            <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 10px;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--heart-red), var(--deep-red)); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; flex-shrink: 0;">
                    ${(registration.firstName?.[0] || '') + (registration.lastName?.[0] || '')}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #1f2937; font-size: 14px;">
                        ${registration.fullName || registration.firstName + ' ' + registration.lastName}
                    </div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">
                        <i class="fas fa-envelope" style="margin-right: 4px;"></i>
                        ${registration.email}
                    </div>
                    ${registration.phone ? `
                        <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">
                            <i class="fas fa-phone" style="margin-right: 4px;"></i>
                            ${registration.phone}
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div style="background: white; padding: 10px; border-radius: 8px; margin-bottom: 10px; font-size: 12px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    ${registration.birthdate ? `
                        <div>
                            <span style="color: #6b7280;">Age:</span>
                            <strong style="color: #1f2937; margin-left: 4px;">${this.calculateAge(registration.birthdate)} years</strong>
                        </div>
                    ` : ''}
                    ${registration.address ? `
                        <div style="grid-column: 1 / -1;">
                            <span style="color: #6b7280;">Address:</span>
                            <strong style="color: #1f2937; margin-left: 4px;">${registration.address}</strong>
                        </div>
                    ` : ''}
                </div>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; color: #6b7280;">
                    <i class="fas fa-clock" style="margin-right: 4px;"></i>
                    Registered ${timeAgo}
                </div>
            </div>

            <div class="action-buttons">
                <button class="action-btn accept" onclick="window.registrationNotifier.acceptRegistration('${key}')">
                    <i class="fas fa-check"></i>
                    Accept
                </button>
                <button class="action-btn decline" onclick="window.registrationNotifier.declineRegistration('${key}')">
                    <i class="fas fa-times"></i>
                    Decline
                </button>
            </div>
        `;
        
        return item;
    }

    async acceptRegistration(key) {
        const registration = this.pendingRegistrations[key];
        if (!registration) return;

        const item = document.querySelector(`[data-key="${key}"]`);
        const buttons = item?.querySelectorAll('.action-btn');
        
        if (buttons) {
            buttons.forEach(btn => btn.disabled = true);
            buttons[0].innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }

        try {
            const patientData = {
                patientId: await this.generatePatientId(),
                email: registration.email.toLowerCase(),
                fullName: registration.fullName || `${registration.lastName}, ${registration.firstName}${registration.middleName ? ', ' + registration.middleName : ''}`,
                lastName: registration.lastName,
                firstName: registration.firstName,
                middleName: registration.middleName || '',
                birthdate: registration.birthdate,
                age: this.calculateAge(registration.birthdate),
                phone: registration.phone || '',
                address: registration.address || '',
                visitNumber: '1',
                status: 'Ongoing',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                source: 'mobile_app',
                approvedBy: this.authManager.currentUser?.uid,
                approvedByName: this.authManager.userDisplayName,
                approvedAt: Date.now()
            };

            await this.database.ref('patients').push(patientData);

            await this.database.ref(`pendingPatientRegistrations/${key}`).update({
                status: 'approved',
                approvedBy: this.authManager.currentUser?.uid,
                approvedByName: this.authManager.userDisplayName,
                approvedAt: Date.now(),
                processedAt: Date.now()
            });

            await this.authManager.logUserActivity('approve_patient_registration', {
                registrationKey: key,
                patientName: patientData.fullName,
                patientEmail: patientData.email
            });

            this.showSuccessMessage(`${patientData.fullName} has been approved and added to the system!`);

            delete this.pendingRegistrations[key];
            this.updateNotificationBadge();
            this.renderNotificationList();

        } catch (error) {
            console.error('Error accepting registration:', error);
            this.showErrorMessage('Failed to approve registration. Please try again.');
            
            if (buttons) {
                buttons.forEach(btn => btn.disabled = false);
                buttons[0].innerHTML = '<i class="fas fa-check"></i> Accept';
            }
        }
    }

    async declineRegistration(key) {
        const registration = this.pendingRegistrations[key];
        if (!registration) return;

        const reason = prompt('Please provide a reason for declining this registration (optional):');
        
        const item = document.querySelector(`[data-key="${key}"]`);
        const buttons = item?.querySelectorAll('.action-btn');
        
        if (buttons) {
            buttons.forEach(btn => btn.disabled = true);
            buttons[1].innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }

        try {
            await this.database.ref(`pendingPatientRegistrations/${key}`).update({
                status: 'declined',
                declinedBy: this.authManager.currentUser?.uid,
                declinedByName: this.authManager.userDisplayName,
                declinedAt: Date.now(),
                declineReason: reason || 'No reason provided',
                processedAt: Date.now()
            });

            await this.authManager.logUserActivity('decline_patient_registration', {
                registrationKey: key,
                patientName: registration.fullName || `${registration.firstName} ${registration.lastName}`,
                patientEmail: registration.email,
                reason: reason || 'No reason provided'
            });

            this.showSuccessMessage(`Registration for ${registration.fullName || registration.firstName} has been declined.`);

            delete this.pendingRegistrations[key];
            this.updateNotificationBadge();
            this.renderNotificationList();

        } catch (error) {
            console.error('Error declining registration:', error);
            this.showErrorMessage('Failed to decline registration. Please try again.');
            
            if (buttons) {
                buttons.forEach(btn => btn.disabled = false);
                buttons[1].innerHTML = '<i class="fas fa-times"></i> Decline';
            }
        }
    }

    async generatePatientId() {
        const snapshot = await this.database.ref('patients').once('value');
        const patients = snapshot.val() || {};
        
        // Only consider regular patient IDs (PT001-PT099), exclude sample patients (PT100+)
        const existingIds = Object.values(patients)
            .map(patient => {
                if (!patient || !patient.patientId) return 0;
                const match = patient.patientId.match(/PT(\d+)/);
                const id = match ? parseInt(match[1], 10) : 0;
                // Only include IDs below 100 to exclude sample patients
                return (id > 0 && id < 100) ? id : 0;
            })
            .filter(id => id > 0);
        
        const highestId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        const newIdNumber = highestId + 1;
        
        return `PT${String(newIdNumber).padStart(3, '0')}`;
    }

    calculateAge(birthdate) {
        const today = new Date();
        const birth = new Date(birthdate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        return age;
    }

    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'just now';
        if (minutes === 1) return '1 minute ago';
        if (minutes < 60) return `${minutes} minutes ago`;
        if (hours === 1) return '1 hour ago';
        if (hours < 24) return `${hours} hours ago`;
        if (days === 1) return '1 day ago';
        return `${days} days ago`;
    }

    updateNotificationBadge() {
        const badge = document.querySelector('.notification-badge');
        const pendingCount = Object.keys(this.pendingRegistrations).length;
        
        if (badge) {
            badge.textContent = pendingCount;
            
            if (pendingCount > 0) {
                badge.classList.add('has-pending');
            } else {
                badge.classList.remove('has-pending');
            }
        }
    }

    playNotificationSound() {
        if (this.notificationSound) {
            try {
                this.notificationSound();
            } catch (error) {
                console.warn('Could not play notification sound:', error);
            }
        }
    }

    async showBrowserNotification(registration) {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            new Notification('New Patient Registration', {
                body: `${registration.fullName || registration.firstName + ' ' + registration.lastName} has registered`,
                icon: 'icons/mother.png',
                badge: 'icons/love 1.png',
                tag: 'patient-registration',
                requireInteraction: true
            });
        } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                this.showBrowserNotification(registration);
            }
        }
    }

    showSuccessMessage(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #22c55e, #16a34a);
            color: white;
            padding: 15px 20px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 10002;
            animation: slideInRight 0.3s ease-out;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    showErrorMessage(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: white;
            padding: 15px 20px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 10002;
            animation: slideInRight 0.3s ease-out;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }, 6000);
    }
}

// ========================================
// MAIN PATIENTS APPLICATION
// ========================================

class PatientsApplication {
    constructor() {
        this.authManager = new AuthenticationManager();
        this.autoHideTopbar = null;
        this.registrationNotifier = null;
        this.notificationsManager = null;
        this.patients = {};
        this.patientHistory = [];
        this.patientVisitHistory = {};
        this.isFirebaseConnected = false;
        this.patientCounter = 1;
        this.connectionRetryCount = 0;
        this.maxRetries = 3;
        this.setupSidebarDropdown();
    }

    onAuthenticated() {
        if (!this.authManager.isAuthenticated) {
            console.log('User not authenticated');
            return;
        }
        console.log('Initializing Patients System for authenticated user...');
        this.initialize();
    }

    async initialize() {
        try {
            this.updateConnectionStatus('connecting');
            this.autoHideTopbar = new AutoHideTopbar();
            
            window.topbarAPI = {
                show: () => this.autoHideTopbar.forceShow(),
                hide: () => this.autoHideTopbar.forceHide(),
                getState: () => this.autoHideTopbar.getState(),
                updateConfig: (config) => this.autoHideTopbar.updateConfig(config)
            };
            
            this.setupEventListeners();
            await this.initializeFirebase();
            
            // Initialize registration notification system (for admins/sub-admins only)
            if (this.authManager.isAdmin || this.authManager.isSubAdmin) {
                this.registrationNotifier = new PatientRegistrationNotificationSystem(
                    this.authManager,
                    database
                );
                window.registrationNotifier = this.registrationNotifier;
                console.log('Registration notification system initialized');
            }
            
            // Initialize Notifications Manager
            const dataManager = {
                patients: this.patients
            };
            this.notificationsManager = new NotificationsManager(this.authManager, dataManager);
            
            // Initialize notifications after a short delay to allow data to load
            setTimeout(() => {
                if (this.notificationsManager) {
                    this.notificationsManager.initialize();
                }
            }, 1000);
            
            console.log('Patients System initialized successfully');
            
        } catch (error) {
            console.error('Error initializing Patients System:', error);
            this.updateConnectionStatus('offline');
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
                    await this.authManager.logout();
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

    async initializeFirebase() {
        try {
            console.log('Testing Firebase connection...');
            
            const isConnected = await this.testFirebaseConnection();
            
            if (isConnected) {
                this.isFirebaseConnected = true;
                this.connectionRetryCount = 0;
                
                console.log('Firebase connected successfully');
                this.updateConnectionStatus('connected');
                
                await this.loadVisitHistory();
                await this.initializePatientHistory();
                await this.loadPatients();
                this.startPatientMonitoring();
                this.startConnectionMonitoring();
                
            } else {
                console.log('Firebase connection test failed');
                this.isFirebaseConnected = false;
                this.updateConnectionStatus('offline');
                
                this.loadDemoData();
                await this.initializePatientHistory();
                await this.loadVisitHistory();
                
                this.showNotification('Working in offline mode', 'warning');
                
                setTimeout(() => {
                    this.retryFirebaseConnection();
                }, 5000);
            }
            
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            this.handleFirebaseError(error);
        }
    }

    testFirebaseConnection() {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log('Connection test timeout');
                resolve(false);
            }, 10000);
            
            try {
                const testRef = database.ref('connectionTest');
                const testValue = Date.now();
                
                testRef.set(testValue)
                    .then(() => {
                        clearTimeout(timeout);
                        console.log('Firebase connection test successful');
                        testRef.remove().catch(() => {});
                        resolve(true);
                    })
                    .catch((error) => {
                        clearTimeout(timeout);
                        console.log('Connection test failed:', error.message);
                        resolve(false);
                    });
            } catch (error) {
                clearTimeout(timeout);
                console.log('Connection test error:', error.message);
                resolve(false);
            }
        });
    }

    async retryFirebaseConnection() {
        if (this.isFirebaseConnected) return;
        
        console.log('Retrying Firebase connection...');
        
        try {
            const isConnected = await this.testFirebaseConnection();
            
            if (isConnected) {
                console.log('Firebase reconnected!');
                this.isFirebaseConnected = true;
                this.updateConnectionStatus('connected');
                
                await this.loadPatients();
                await this.loadVisitHistory();
                await this.initializePatientHistory();
                
                this.showNotification('Database connection restored!', 'success');
            } else {
                setTimeout(() => {
                    this.retryFirebaseConnection();
                }, 10000);
            }
        } catch (error) {
            console.log('Retry failed:', error.message);
            
            setTimeout(() => {
                this.retryFirebaseConnection();
            }, 10000);
        }
    }

    handleFirebaseError(error) {
        console.error('Firebase error:', error);
        
        let shouldRetry = false;
        let errorMessage = 'Unknown Firebase error';
        
        if (error.message.includes('network') || error.message.includes('timeout')) {
            shouldRetry = true;
            errorMessage = 'Network connection issue';
        } else if (error.message.includes('permission') || error.code === 'PERMISSION_DENIED') {
            errorMessage = 'Database permission denied';
        } else {
            shouldRetry = true;
            errorMessage = error.message;
        }
        
        if (shouldRetry && this.connectionRetryCount < this.maxRetries) {
            this.connectionRetryCount++;
            console.log(`Retrying Firebase connection (${this.connectionRetryCount}/${this.maxRetries})...`);
            
            setTimeout(() => {
                this.initializeFirebase();
            }, Math.pow(2, this.connectionRetryCount) * 2000);
        } else {
            console.log('Falling back to offline mode');
            this.isFirebaseConnected = false;
            this.updateConnectionStatus('offline');
            this.loadDemoData();
            this.showNotification(`Database offline: ${errorMessage}`, 'warning');
        }
    }

    startConnectionMonitoring() {
        if (!database) return;
        
        try {
            setTimeout(() => {
                database.ref('.info/connected').on('value', (snapshot) => {
                    const connected = snapshot.val();
                    
                    if (connected) {
                        if (!this.isFirebaseConnected) {
                            console.log('Firebase reconnected');
                            this.isFirebaseConnected = true;
                            this.updateConnectionStatus('connected');
                            this.connectionRetryCount = 0;
                            this.loadPatients();
                            this.loadVisitHistory();
                            this.initializePatientHistory();
                        }
                    } else {
                        if (this.isFirebaseConnected) {
                            console.log('Firebase disconnected');
                            this.isFirebaseConnected = false;
                            this.updateConnectionStatus('offline');
                            this.showNotification('Database connection lost', 'warning');
                        }
                    }
                }, (error) => {
                    console.log('Connection monitoring error (non-critical):', error.message);
                });
            }, 2000);
        } catch (error) {
            console.error('Connection monitoring setup error:', error);
        }
    }

    updateConnectionStatus(status) {
        const statusIcon = document.getElementById('statusIcon');
        const statusText = document.getElementById('statusText');
        
        if (!statusIcon || !statusText) return;
        
        switch(status) {
            case 'connected':
                statusIcon.style.color = '#22c55e';
                statusText.textContent = 'Connected to database';
                break;
            case 'connecting':
                statusIcon.style.color = '#fbbf24';
                statusText.textContent = 'Connecting...';
                break;
            case 'offline':
                statusIcon.style.color = '#ef4444';
                statusText.textContent = 'Offline mode';
                break;
        }
    }

    setupEventListeners() {
        // Notification dropdown
        const notifIcon = document.getElementById('notifIcon');
        const notifDropdown = document.getElementById('notifDropdown');
        
        if (notifIcon && notifDropdown) {
            notifIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const isShowing = notifDropdown.classList.contains('show');
                this.closeAllDropdowns();
                
                if (!isShowing) {
                    notifDropdown.classList.add('show');
                    
                    // Render notifications when dropdown opens
                    if (this.notificationsManager) {
                        this.notificationsManager.renderNotifications();
                    }
                }
            });
        }
        
        // Help dropdown
        const helpIcon = document.getElementById('helpIcon');
        const helpDropdown = document.getElementById('helpDropdown');
        
        if (helpIcon && helpDropdown) {
            helpIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const isShowing = helpDropdown.classList.contains('show');
                this.closeAllDropdowns();
                
                if (!isShowing) {
                    helpDropdown.classList.add('show');
                }
            });
        }

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            this.closeAllDropdowns();
        });

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterPatients(e.target.value);
            });
        }

        // Patient form
        const patientForm = document.getElementById('patientForm');
        if (patientForm) {
            patientForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleAddPatient();
            });
        }

        // Birthdate handler
        const birthdateInput = document.getElementById('birthdate');
        const ageDisplay = document.getElementById('ageDisplay');
        
        if (birthdateInput && ageDisplay) {
            birthdateInput.addEventListener('change', () => {
                const age = this.calculateAge(birthdateInput.value);
                if (age) {
                    ageDisplay.textContent = `Age: ${age} years`;
                    ageDisplay.style.color = age >= 10 && age <= 50 ? '#10b981' : '#e63946';
                } else {
                    ageDisplay.textContent = '';
                }
            });
        }

        // Email auto-visit detection
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.addEventListener('blur', () => {
                this.checkReturningPatient(emailInput.value);
            });
        }
    }

    closeAllDropdowns() {
        const notifDropdown = document.getElementById('notifDropdown');
        const helpDropdown = document.getElementById('helpDropdown');
        
        if (notifDropdown) notifDropdown.classList.remove('show');
        if (helpDropdown) helpDropdown.classList.remove('show');
    }

    // PATIENT DATA MANAGEMENT
    async loadPatients() {
        if (!this.isFirebaseConnected) {
            this.renderNoData();
            return;
        }

        try {
            console.log('Loading patients from Firebase...');
            
            database.ref('patients').on('value', (snapshot) => {
                try {
                    const data = snapshot.val();
                    this.patients = data || {};
                    
                    console.log(`Loaded ${Object.keys(this.patients).length} patients`);
                    
                    this.updatePatientCounter();
                    this.renderPatients();
                    
                    // Update notifications after loading patients
                    if (this.notificationsManager) {
                        this.notificationsManager.dataManager.patients = this.patients;
                        this.notificationsManager.generateNotifications();
                        this.notificationsManager.updateNotificationBadge();
                    }
                    
                    if (this.authManager) {
                        this.authManager.logUserActivity('view_patients', {
                            count: Object.keys(this.patients).length
                        });
                    }
                    
                } catch (error) {
                    console.error('Error processing patient data:', error);
                    this.showNotification('Error processing patient data', 'warning');
                }
            }, (error) => {
                console.error('Error loading patients:', error);
                
                if (error.code === 'PERMISSION_DENIED') {
                    this.showNotification('Database access denied', 'error');
                    this.loadDemoData();
                } else {
                    this.showNotification('Error loading patients', 'warning');
                    this.renderNoData();
                }
            });
            
        } catch (error) {
            console.error('Error setting up Firebase listener:', error);
            this.renderNoData();
        }
    }

    updatePatientCounter() {
        try {
            const lastUsedCounter = this.getLastUsedPatientCounter();
            
            if (Object.keys(this.patients).length === 0) {
                this.patientCounter = Math.max(lastUsedCounter + 1, 1);
                return;
            }
            
            const existingIds = Object.values(this.patients)
                .map(patient => {
                    if (!patient || !patient.patientId) return 0;
                    const match = patient.patientId.match(/PT(\d+)/);
                    return match ? parseInt(match[1], 10) : 0;
                })
                .filter(id => !isNaN(id) && id > 0);
            
            if (existingIds.length > 0) {
                const highestExistingId = Math.max(...existingIds);
                this.patientCounter = Math.max(highestExistingId + 1, lastUsedCounter + 1);
            } else {
                this.patientCounter = lastUsedCounter + 1;
            }
            
            this.saveLastUsedPatientCounter(this.patientCounter - 1);
            
            console.log('Patient counter updated to:', this.patientCounter);
            
        } catch (error) {
            console.warn('Error updating patient counter:', error);
            this.patientCounter = Math.max(this.patientCounter, Object.keys(this.patients).length + 1);
        }
    }

    getLastUsedPatientCounter() {
        try {
            const stored = localStorage.getItem('lastUsedPatientCounter');
            if (stored) {
                const counter = parseInt(stored, 10);
                if (!isNaN(counter) && counter >= 0) {
                    return counter;
                }
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }

    saveLastUsedPatientCounter(counter) {
        try {
            localStorage.setItem('lastUsedPatientCounter', counter.toString());
            
            if (this.isFirebaseConnected) {
                database.ref('system/lastUsedPatientCounter').set(counter).catch(error => {
                    console.warn('Could not save counter to Firebase:', error);
                });
            }
        } catch (error) {
            console.warn('Error saving last used patient counter:', error);
        }
    }

    loadDemoData() {
        console.log('Loading demo data for offline mode');
        
        this.patients = {
            'demo1': {
                patientId: 'PT001',
                email: 'maria.santos@example.com',
                fullName: 'Santos, Maria, Cruz',
                lastName: 'Santos',
                firstName: 'Maria',
                middleName: 'Cruz',
                birthdate: '1996-07-08',
                age: 28,
                visitNumber: '3',
                status: 'Ongoing',
                createdAt: Date.now() - 86400000,
                isDemo: true
            },
            'demo2': {
                patientId: 'PT002',
                email: 'anna.delacruz@example.com',
                fullName: 'Dela Cruz, Anna, Mae',
                lastName: 'Dela Cruz',
                firstName: 'Anna',
                middleName: 'Mae',
                birthdate: '1992-03-15',
                age: 32,
                visitNumber: '7',
                status: 'Completed',
                createdAt: Date.now() - 172800000,
                isDemo: true
            },
            'demo3': {
                patientId: 'PT003',
                email: 'catherine.lopez@example.com',
                fullName: 'Lopez, Catherine, Rose',
                lastName: 'Lopez',
                firstName: 'Catherine',
                middleName: 'Rose',
                birthdate: '1999-11-22',
                age: 25,
                visitNumber: '1',
                status: 'Ongoing',
                createdAt: Date.now() - 259200000,
                isDemo: true
            }
        };
        
        this.updatePatientCounter();
        this.renderPatients();
        
        // Update notifications with demo data
        if (this.notificationsManager) {
            this.notificationsManager.dataManager.patients = this.patients;
            this.notificationsManager.generateNotifications();
            this.notificationsManager.updateNotificationBadge();
        }
        
        this.showNotification('Running in offline mode with demo data', 'warning');
    }

    // RENDERING FUNCTIONS
    renderNoData() {
        const tableBody = document.getElementById('patientTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="5" style="text-align: center; padding: 60px 20px; color: var(--gray-text);">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                        <i class="fas fa-users" style="font-size: 48px; color: var(--light-pink); margin-bottom: 10px;"></i>
                        <h3 style="color: var(--deep-red); margin: 0; font-size: 18px;">No Patients Found</h3>
                        <p style="margin: 0; font-size: 14px; max-width: 300px; line-height: 1.5;">
                            ${this.isFirebaseConnected ? 
                                'No patients have been added yet. Use the "Add New Patient" button above to get started.' : 
                                'Unable to load patient data. Please check your connection.'
                            }
                        </p>
                        ${!this.isFirebaseConnected ? 
                            '<button onclick="window.patientsApp.retryConnection()" style="margin-top: 15px; background: linear-gradient(135deg, var(--heart-red), var(--deep-red)); color: white; border: none; padding: 12px 24px; border-radius: 20px; cursor: pointer; font-weight: 600;"><i class="fas fa-refresh"></i> Retry Connection</button>' : 
                            ''
                        }
                    </div>
                </td>
            </tr>
        `;
    }

    retryConnection() {
        console.log('Manual connection retry initiated');
        
        this.connectionRetryCount = 0;
        this.isFirebaseConnected = false;
        
        this.showNotification('Reconnecting...', 'info');
        this.initializeFirebase();
    }

    renderPatients() {
        const tableBody = document.getElementById('patientTableBody');
        if (!tableBody) return;
        
        if (!this.patients || Object.keys(this.patients).length === 0) {
            this.renderNoData();
            return;
        }

        tableBody.innerHTML = '';
        
        try {
            const sortedPatients = Object.entries(this.patients).sort((a, b) => {
                return (b[1].createdAt || 0) - (a[1].createdAt || 0);
            });
            
            sortedPatients.forEach(([key, patient]) => {
                if (patient) {
                    const row = this.createPatientRow(key, patient);
                    if (row) tableBody.appendChild(row);
                }
            });
            
            console.log(`Rendered ${sortedPatients.length} patients`);
        } catch (error) {
            console.error('Error rendering patients:', error);
            this.showNotification('Error displaying patients', 'warning');
        }
    }

    createPatientRow(key, patient) {
        if (!patient) return null;
        
        try {
            const row = document.createElement('tr');
            row.dataset.key = key;
            row.dataset.patientId = patient.patientId || key;
            row.dataset.patientType = patient.patientType || 'Prenatal';
            row.style.animation = 'fadeIn 0.3s ease-out';
            
            if (patient.isDemo) {
                row.style.opacity = '0.8';
                row.title = 'Demo data - changes will not be saved';
            }
            
            const statusDisplay = `<span class="status-badge status-${patient.status.toLowerCase()}">${patient.status}</span>`;
            
            const ageDisplay = patient.birthdate ? 
                `${this.calculateAge(patient.birthdate)} years old` : 
                `${patient.age || 'N/A'} years old`;
            
            const emailDisplay = patient.email || 'No email provided';
            
            const canEdit = this.authManager?.hasPermission('edit');
            const canDelete = this.authManager?.hasPermission('delete') || this.authManager?.isAdmin;
            
            row.innerHTML = `
                <td><strong>${patient.patientId}</strong></td>
                <td>${patient.fullName}</td>
                <td>${ageDisplay}</td>
                <td>${statusDisplay}</td>
                <td>
                    <div class="action-buttons">
                        <button class="view-btn" onclick="viewPatientProfile('${key}')" title="View Patient Record">
                            <i class="fas fa-eye"></i> View
                        </button>
                        ${canDelete ? `<button class="delete-btn" onclick="window.patientsApp.deletePatient('${key}')" title="Delete Patient">
                            <i class="fas fa-trash"></i> Delete
                        </button>` : ''}
                    </div>
                </td>
            `;
            
            return row;
        } catch (error) {
            console.error('Error creating patient row:', error);
            return null;
        }
    }

    filterPatients(searchTerm) {
        const rows = document.querySelectorAll('#patientTableBody tr:not(.no-data-row)');
        const term = searchTerm.toLowerCase().trim();
        
        let visibleCount = 0;
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const isVisible = !term || text.includes(term);
            row.style.display = isVisible ? '' : 'none';
            if (isVisible) visibleCount++;
        });

        const tableBody = document.getElementById('patientTableBody');
        
        const existingNoResults = tableBody.querySelector('.no-results-row');
        if (existingNoResults) existingNoResults.remove();
        
        if (term && visibleCount === 0 && rows.length > 0) {
            const noResultsRow = document.createElement('tr');
            noResultsRow.className = 'no-results-row';
            noResultsRow.innerHTML = `
                <td colspan="5" style="text-align: center; padding: 40px 20px; color: var(--gray-text);">
                    <i class="fas fa-search" style="font-size: 24px; margin-bottom: 10px; color: var(--light-pink);"></i>
                    <p>No patients found matching "${searchTerm}"</p>
                </td>
            `;
            
            tableBody.appendChild(noResultsRow);
        }
    }

    // PATIENT CRUD OPERATIONS  
    async handleAddPatient() {
        if (!this.authManager?.hasPermission('add')) {
            this.showNotification('You do not have permission to add patients', 'error');
            return;
        }

        const saveBtn = document.getElementById('saveBtn');
        const originalBtnContent = saveBtn.innerHTML;
        
        try {
            const email = document.getElementById('email').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            const firstName = document.getElementById('firstName').value.trim();
            const middleName = document.getElementById('middleName').value.trim();
            const birthdate = document.getElementById('birthdate').value;
            const patientType = document.getElementById('patientType').value;
            const status = document.getElementById('status').value;

            const validationErrors = this.validateForm({
                email, lastName, firstName, middleName, birthdate, patientType, status
            });
            
            if (validationErrors.length > 0) {
                throw new Error(validationErrors.join('\n'));
            }

            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            saveBtn.disabled = true;

            const age = this.calculateAge(birthdate);
            const fullName = this.formatFullName(lastName, firstName, middleName);

            const visitInfo = await this.checkDuplicateEmailForNewVisit(email);
            const visitNumber = visitInfo && visitInfo.isDuplicate ? 
                String(visitInfo.nextVisit) : '1';

            const patientData = {
                patientId: `PT${String(this.patientCounter).padStart(3, '0')}`,
                email: email.toLowerCase(),
                fullName,
                lastName,
                firstName,
                middleName,
                birthdate,
                age,
                visitNumber,
                
                patientType,status,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                createdBy: this.authManager?.currentUser?.uid,
                createdByName: this.authManager?.userDisplayName
            };

            if (this.isFirebaseConnected) {
                const newPatientRef = await database.ref('patients').push(patientData);
                console.log('Patient added with ID:', newPatientRef.key);
                
                await this.authManager?.logUserActivity('add_patient', {
                    patientId: patientData.patientId,
                    patientName: patientData.fullName
                });
            } else {
                const key = `local_${Date.now()}`;
                this.patients[key] = { ...patientData, isLocal: true };
                this.renderPatients();
            }

            await this.addToPatientHistory('added', patientData);
            await this.updateVisitHistory(email, visitNumber);

            this.patientCounter++;
            this.saveLastUsedPatientCounter(this.patientCounter - 1);

            this.showNotification(
                `Patient added! ${visitNumber === '1' ? 'First visit' : `Visit #${visitNumber}`}`, 
                'success'
            );

            this.closeModal();
            
            // Update notifications
            if (this.notificationsManager) {
                setTimeout(() => {
                    this.notificationsManager.dataManager.patients = this.patients;
                    this.notificationsManager.generateNotifications();
                    this.notificationsManager.updateNotificationBadge();
                }, 500);
            }
            
        } catch (error) {
            console.error('Error adding patient:', error);
            this.showNotification(`${error.message}`, 'error');
        } finally {
            saveBtn.innerHTML = originalBtnContent;
            saveBtn.disabled = false;
        }
    }

    async editPatient(key) {
        if (!this.authManager?.hasPermission('edit')) {
            this.showNotification('You do not have permission to edit patients', 'error');
            return;
        }

        const patient = this.patients[key];
        if (!patient) return;

        this.showEditModal(key, patient);
        
        await this.authManager?.logUserActivity('edit_patient', {
            patientId: patient.patientId,
            patientName: patient.fullName
        });
    }

    showEditModal(key, patient) {
        let modal = document.getElementById('patientDetailsModal');
        if (!modal) {
            modal = this.createPatientDetailsModal();
        }

        const modalContent = modal.querySelector('.modal-content');
        modalContent.innerHTML = `
            <span class="close" onclick="window.patientsApp.closeModal('patientDetailsModal')">&times;</span>
            <h2>
                <i class="fas fa-user-edit"></i>
                Edit Patient
            </h2>
            <form id="editPatientForm">
                <input type="hidden" id="editKey" value="${key}" />
                <input type="email" id="editEmail" value="${patient.email || ''}" placeholder="Email Address" required />
                <input type="text" id="editLastName" value="${patient.lastName}" placeholder="Last Name" required />
                <input type="text" id="editFirstName" value="${patient.firstName}" placeholder="First Name" required />
                <input type="text" id="editMiddleName" value="${patient.middleName || ''}" placeholder="Middle Name (Optional)" />
                <label for="editBirthdate" class="floating-label"><small class="birthdate">Birthdate</small></label>
                <input type="date" id="editBirthdate" value="${patient.birthdate}" class="floating-input" required />
                <small id="editAgeDisplay" style="color: #10b981; margin-bottom: 5px; margin-top: -5px; display: block;">Age: ${patient.age} years</small>
                <label for="editVisitNumber" class="floating-label"><small class="visit-number">Visit Number</small></label>
                <select id="editVisitNumber" required>
                    ${Array.from({length: 30}, (_, i) => i + 1).map(num => 
                        `<option value="${num}" ${patient.visitNumber == num ? 'selected' : ''}>${this.getVisitDisplayText(String(num))}</option>`
                    ).join('')}
                </select>
                <label for="editStatus" class="floating-label"><small>Status</small></label>
                <select id="editStatus" required>
                    <option value="Ongoing" ${patient.status === 'Ongoing' ? 'selected' : ''}>Ongoing</option>
                    <option value="Completed" ${patient.status === 'Completed' ? 'selected' : ''}>Completed</option>
                </select>
                <button type="submit" id="updateBtn">
                    <i class="fas fa-save"></i>
                    Update Patient
                </button>
            </form>
        `;

        const editForm = document.getElementById('editPatientForm');
        const editBirthdateInput = document.getElementById('editBirthdate');
        const editAgeDisplay = document.getElementById('editAgeDisplay');
        
        if (editBirthdateInput && editAgeDisplay) {
            editBirthdateInput.addEventListener('change', () => {
                const age = this.calculateAge(editBirthdateInput.value);
                editAgeDisplay.textContent = `Age: ${age} years`;
                editAgeDisplay.style.color = age >= 10 && age <= 50 ? '#10b981' : '#e63946';
            });
        }
        
        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleUpdatePatient();
            });
        }

        modal.style.display = 'block';
        document.body.classList.add('modal-open');
    }

    createPatientDetailsModal() {
        const modal = document.createElement('div');
        modal.id = 'patientDetailsModal';
        modal.className = 'modal';
        modal.innerHTML = '<div class="modal-content"></div>';
        document.body.appendChild(modal);
        return modal;
    }

    async handleUpdatePatient() {
        const key = document.getElementById('editKey').value;
        const patient = this.patients[key];
        
        if (!patient) return;

        try {
            const email = document.getElementById('editEmail').value.trim();
            const lastName = document.getElementById('editLastName').value.trim();
            const firstName = document.getElementById('editFirstName').value.trim();
            const middleName = document.getElementById('editMiddleName').value.trim();
            const birthdate = document.getElementById('editBirthdate').value;
            const patientType = document.getElementById('editPatientType').value;
            const status = document.getElementById('editStatus').value;

            const fullName = this.formatFullName(lastName, firstName, middleName);
            const age = this.calculateAge(birthdate);

            const updatedPatient = {
                ...patient,
                email: email.toLowerCase(),
                fullName,
                lastName,
                firstName,
                middleName,
                birthdate,
                age,
                visitNumber,
                
                patientType,status,
                updatedAt: Date.now(),
                updatedBy: this.authManager?.currentUser?.uid,
                updatedByName: this.authManager?.userDisplayName
            };

            if (this.isFirebaseConnected && !patient.isDemo) {
                await database.ref(`patients/${key}`).update(updatedPatient);
            } else {
                this.patients[key] = updatedPatient;
                this.renderPatients();
            }

            await this.addToPatientHistory('updated', updatedPatient);

            if (patient.visitNumber !== visitNumber) {
                await this.updateVisitHistory(email, visitNumber);
            }

            this.showNotification('Patient updated successfully!', 'success');
            this.closeModal('patientDetailsModal');
            
            // Update notifications
            if (this.notificationsManager) {
                setTimeout(() => {
                    this.notificationsManager.dataManager.patients = this.patients;
                    this.notificationsManager.generateNotifications();
                    this.notificationsManager.updateNotificationBadge();
                }, 500);
            }

        } catch (error) {
            console.error('Error updating patient:', error);
            this.showNotification(`${error.message}`, 'error');
        }
    }

    async deletePatient(key) {
        if (!this.authManager?.hasPermission('delete') && !this.authManager?.isAdmin) {
            this.showNotification('You do not have permission to delete patients', 'error');
            return;
        }

        const patient = this.patients[key];
        if (!patient) {
            this.showNotification('Patient not found', 'error');
            return;
        }

        const confirmMessage = `Delete Patient Confirmation\n\n` +
                              `Patient: ${patient.fullName}\n` +
                              `ID: ${patient.patientId}\n` +
                              `Email: ${patient.email || 'No email'}\n` +
                              `Visit: ${this.getVisitDisplayText(patient.visitNumber)}\n\n` +
                              `This action cannot be undone. Are you sure?`;

        if (confirm(confirmMessage)) {
            try {
                await this.addToPatientHistory('deleted', patient);
                
                if (this.isFirebaseConnected && !patient.isDemo) {
                    this.showNotification('Deleting patient...', 'info');
                    
                    await database.ref(`patients/${key}`).remove();
                    
                    await this.authManager?.logUserActivity('delete_patient', {
                        patientId: patient.patientId,
                        patientName: patient.fullName
                    });
                } else {
                    delete this.patients[key];
                    this.renderPatients();
                }
                
                this.showNotification(`${patient.fullName} deleted successfully!`, 'success');
                
                // Update notifications
                if (this.notificationsManager) {
                    setTimeout(() => {
                        this.notificationsManager.dataManager.patients = this.patients;
                        this.notificationsManager.generateNotifications();
                        this.notificationsManager.updateNotificationBadge();
                    }, 500);
                }
                
            } catch (error) {
                console.error('Error deleting patient:', error);
                this.showNotification(`Error: ${error.message}`, 'error');
            }
        }
    }

    // VISIT HISTORY MANAGEMENT
    async loadVisitHistory() {
        try {
            const stored = localStorage.getItem('patientVisitHistory');
            if (stored) {
                this.patientVisitHistory = JSON.parse(stored);
                console.log('Loaded visit history from localStorage:', Object.keys(this.patientVisitHistory).length, 'entries');
            }

            if (this.isFirebaseConnected) {
                database.ref('patientVisitHistory').on('value', (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        this.patientVisitHistory = data;
                        console.log('Loaded visit history from Firebase:', Object.keys(this.patientVisitHistory).length, 'entries');
                        localStorage.setItem('patientVisitHistory', JSON.stringify(this.patientVisitHistory));
                    }
                }, (error) => {
                    console.error('Error loading visit history from Firebase:', error);
                });
            }
        } catch (error) {
            console.error('Error loading visit history:', error);
            this.patientVisitHistory = {};
        }
    }

    async saveVisitHistory() {
        try {
            localStorage.setItem('patientVisitHistory', JSON.stringify(this.patientVisitHistory));
            
            if (this.isFirebaseConnected) {
                await database.ref('patientVisitHistory').set(this.patientVisitHistory);
                console.log('Visit history saved to Firebase');
            }
        } catch (error) {
            console.error('Error saving visit history:', error);
        }
    }

    async updateVisitHistory(email, visitNumber) {
        if (!email) return;
        
        const normalizedEmail = email.trim().toLowerCase();
        const visitNum = parseInt(visitNumber) || 1;
        
        if (!this.patientVisitHistory[normalizedEmail]) {
            this.patientVisitHistory[normalizedEmail] = {
                email: normalizedEmail,
                visitCount: visitNum,
                lastVisit: Date.now(),
                firstVisit: Date.now(),
                visits: []
            };
        } else {
            this.patientVisitHistory[normalizedEmail].visitCount = Math.max(
                this.patientVisitHistory[normalizedEmail].visitCount || 0,
                visitNum
            );
            this.patientVisitHistory[normalizedEmail].lastVisit = Date.now();
        }
        
        this.patientVisitHistory[normalizedEmail].visits.push({
            visitNumber: visitNum,
            date: Date.now(),
            timestamp: new Date().toISOString()
        });
        
        await this.saveVisitHistory();
        console.log(`Updated visit history for ${email}: Visit #${visitNum}`);
    }

    checkDuplicateEmailForNewVisit(email) {
        if (!email) return null;
        
        const normalizedEmail = email.trim().toLowerCase();
        
        if (this.patientVisitHistory[normalizedEmail]) {
            return {
                isDuplicate: true,
                visitCount: this.patientVisitHistory[normalizedEmail].visitCount || 0,
                lastVisit: this.patientVisitHistory[normalizedEmail].lastVisit,
                nextVisit: (this.patientVisitHistory[normalizedEmail].visitCount || 0) + 1
            };
        }
        
        for (const patient of Object.values(this.patients)) {
            if (patient && patient.email && 
                patient.email.trim().toLowerCase() === normalizedEmail) {
                return {
                    isDuplicate: true,
                    visitCount: parseInt(patient.visitNumber) || 1,
                    patientName: patient.fullName,
                    nextVisit: (parseInt(patient.visitNumber) || 1) + 1
                };
            }
        }
        
        return null;
    }

    checkReturningPatient(email) {
        if (!email) return;
        
        const normalizedEmail = email.trim().toLowerCase();
        
        const existingInfo = document.querySelector('.visit-info');
        if (existingInfo) existingInfo.remove();
        
        const visitInfo = this.checkDuplicateEmailForNewVisit(email);
        
        const emailInput = document.getElementById('email');
        if (!emailInput) return;
        
        if (visitInfo && visitInfo.isDuplicate) {
            const visitInfoDiv = document.createElement('div');
            visitInfoDiv.className = 'visit-info';
            visitInfoDiv.style.cssText = `
                background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                color: white;
                padding: 12px 15px;
                border-radius: 8px;
                margin: 10px 0;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 10px;
                animation: slideDown 0.3s ease-out;
            `;
            visitInfoDiv.innerHTML = `
                <i class="fas fa-info-circle"></i>
                <span><strong>Returning Patient!</strong> This will be visit #${visitInfo.nextVisit} for this email address.</span>
            `;
            
            emailInput.parentNode.insertBefore(visitInfoDiv, emailInput.nextSibling);
            
            if (visitInfo.patientName) {
                const nameParts = visitInfo.patientName.split(', ');
                const lastNameInput = document.getElementById('lastName');
                const firstNameInput = document.getElementById('firstName');
                const middleNameInput = document.getElementById('middleName');
                
                if (nameParts[0] && lastNameInput) lastNameInput.value = nameParts[0];
                if (nameParts[1] && firstNameInput) firstNameInput.value = nameParts[1];
                if (nameParts[2] && middleNameInput) middleNameInput.value = nameParts[2];
            }
        } else {
            const visitInfoDiv = document.createElement('div');
            visitInfoDiv.className = 'visit-info';
            visitInfoDiv.style.cssText = `
                background: linear-gradient(135deg, #22c55e, #16a34a);
                color: white;
                padding: 12px 15px;
                border-radius: 8px;
                margin: 10px 0;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 10px;
                animation: slideDown 0.3s ease-out;
            `;
            visitInfoDiv.innerHTML = `
                <i class="fas fa-star"></i>
                <span><strong>New Patient!</strong> This will be their first visit.</span>
            `;
            
            emailInput.parentNode.insertBefore(visitInfoDiv, emailInput.nextSibling);
        }
    }

    // PATIENT HISTORY MANAGEMENT
    async initializePatientHistory() {
        try {
            console.log('Initializing patient history...');
            
            const storedHistory = localStorage.getItem('patientHistory');
            if (storedHistory) {
                try {
                    this.patientHistory = JSON.parse(storedHistory);
                    console.log(`Loaded ${this.patientHistory.length} history entries from localStorage`);
                } catch (e) {
                    console.error('Error parsing stored history:', e);
                    this.patientHistory = [];
                }
            }
            
            if (this.isFirebaseConnected) {
                database.ref('patientHistory').on('value', (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        const firebaseHistory = Object.keys(data).map(key => ({
                            ...data[key],
                            firebaseKey: key
                        }));
                        
                        const historyMap = new Map();
                        
                        this.patientHistory.forEach(entry => {
                            historyMap.set(entry.id, entry);
                        });
                        
                        firebaseHistory.forEach(entry => {
                            historyMap.set(entry.id, entry);
                        });
                        
                        this.patientHistory = Array.from(historyMap.values());
                        this.patientHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                        
                        console.log(`Loaded ${this.patientHistory.length} total history entries`);
                        
                        localStorage.setItem('patientHistory', JSON.stringify(this.patientHistory));
                    }
                    
                    if (document.getElementById('patientHistoryModal')?.style.display === 'block') {
                        this.renderPatientHistory();
                    }
                }, (error) => {
                    console.error('Error loading history from Firebase:', error);
                });
            }
        } catch (error) {
            console.error('Error initializing patient history:', error);
            this.patientHistory = [];
        }
    }

    async addToPatientHistory(action, patientData) {
        try {
            const historyEntry = {
                id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                action: action,
                patientId: patientData.patientId,
                patientName: patientData.fullName,
                email: patientData.email || 'No email',
                visitNumber: patientData.visitNumber || '1',
                timestamp: Date.now(),
                date: new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                }),
                time: new Date().toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                }),
                performedBy: this.authManager?.userDisplayName || 'Admin',
                performedByRole: this.authManager?.isAdmin ? 'Admin' : 
                                 this.authManager?.isSubAdmin ? 'Sub-Admin' : 'User',
                details: {
                    age: patientData.age,
                    status: patientData.status,
                    isFirstVisit: patientData.visitNumber === '1',
                    visitText: this.getVisitDisplayText(patientData.visitNumber)
                }
            };

            this.patientHistory.unshift(historyEntry);
            
            localStorage.setItem('patientHistory', JSON.stringify(this.patientHistory));
            console.log('History entry saved to localStorage');

            if (this.isFirebaseConnected) {
                try {
                    await database.ref('patientHistory').push(historyEntry);
                    console.log('History entry saved to Firebase');
                } catch (error) {
                    console.error('Error saving to Firebase, but saved locally:', error);
                }
            }

            console.log('History entry added:', historyEntry);
            
            if (document.getElementById('patientHistoryModal')?.style.display === 'block') {
                this.renderPatientHistory();
            }
            
            return historyEntry;
        } catch (error) {
            console.error('Error adding to patient history:', error);
        }
    }

    renderPatientHistory() {
        console.log('Rendering patient history, entries:', this.patientHistory.length);
        const historyContent = document.getElementById('historyContent');
        if (!historyContent) {
            console.error('History content element not found');
            return;
        }

        if (!this.patientHistory || this.patientHistory.length === 0) {
            historyContent.innerHTML = `
                <div class="history-empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-clock"></i>
                    </div>
                    <h3>No History Available</h3>
                    <p>Patient activities will appear here when you add, update, or delete patients.</p>
                    <small style="color: #999; margin-top: 10px; display: block;">
                        History tracking starts from when this feature was added.
                    </small>
                </div>
            `;
            return;
        }

        const groupedHistory = this.groupHistoryByDate(this.patientHistory);

        let historyHTML = '<div class="history-list" style="max-height: 500px; overflow-y: auto;">';
        
        for (const [date, entries] of Object.entries(groupedHistory)) {
            historyHTML += `
                <div class="history-date-group">
                    <div class="history-date-header">
                        <i class="fas fa-calendar"></i>
                        <span>${date}</span>
                        <span class="entry-count">${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}</span>
                    </div>
                    <div class="history-entries">
            `;

            entries.forEach(entry => {
                const actionIcon = this.getActionIcon(entry.action);
                const actionColor = this.getActionColor(entry.action);
                const actionText = this.getActionText(entry.action);

                historyHTML += `
                    <div class="history-item" data-id="${entry.id}">
                        <div class="history-item-icon" style="background: ${actionColor};">
                            <i class="${actionIcon}"></i>
                        </div>
                        <div class="history-item-details">
                            <div class="history-item-title">
                                ${actionText} - ${entry.patientName}
                            </div>
                            <div class="history-item-description">
                                <span class="history-badge">ID: ${entry.patientId}</span>
                                <span class="history-badge">${entry.details.visitText}</span>
                                ${entry.details.isFirstVisit ? '<span class="history-badge first-time">First Time</span>' : '<span class="history-badge returning">Returning</span>'}
                            </div>
                            <div class="history-item-meta">
                                <i class="fas fa-envelope"></i> ${entry.email} • 
                                <i class="fas fa-user"></i> Age: ${entry.details.age} • 
                                <i class="fas fa-check-circle"></i> ${entry.details.status}
                            </div>
                            <div class="history-item-time">
                                <i class="fas fa-clock"></i> ${entry.time} • 
                                <i class="fas fa-user-shield"></i> ${entry.performedBy} (${entry.performedByRole})
                            </div>
                        </div>
                    </div>
                `;
            });

            historyHTML += `
                    </div>
                </div>
            `;
        }

        historyHTML += '</div>';
        historyContent.innerHTML = historyHTML;
        console.log('Patient history rendered successfully');
    }

    groupHistoryByDate(history) {
        const grouped = {};
        
        history.forEach(entry => {
            const date = entry.date || new Date(entry.timestamp).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
            
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(entry);
        });

        const sortedGrouped = {};
        Object.keys(grouped)
            .sort((a, b) => new Date(b) - new Date(a))
            .forEach(key => {
                sortedGrouped[key] = grouped[key];
            });

        return sortedGrouped;
    }

    // PATIENT MONITORING
    startPatientMonitoring() {
        this.checkHighVisitCounts();
        setInterval(() => {
            this.checkHighVisitCounts();
        }, 24 * 60 * 60 * 1000);
        
        setInterval(() => {
            this.checkPatientVisitPatterns();
        }, 60 * 60 * 1000);
    }

    checkHighVisitCounts() {
        if (Object.keys(this.patients).length === 0) return;
        
        Object.entries(this.patients).forEach(([key, patient]) => {
            if (!patient || !patient.visitNumber) return;
            
            const visitNum = parseInt(patient.visitNumber);
            if (isNaN(visitNum)) return;
            
            if (visitNum > 15) {
                const notificationKey = `patient_high_visits_${patient.patientId}`;
                if (!this.hasRecentNotification(notificationKey)) {
                    console.log(`High visit count alert for ${patient.fullName}: ${visitNum} visits`);
                    this.markNotificationSent(notificationKey);
                }
            }
        });
    }

    checkPatientVisitPatterns() {
        if (Object.keys(this.patients).length === 0) return;
        
        const visitCounts = {};
        Object.values(this.patients).forEach(patient => {
            if (patient && patient.visitNumber) {
                const visitNum = parseInt(patient.visitNumber);
                if (!isNaN(visitNum)) {
                    visitCounts[visitNum] = (visitCounts[visitNum] || 0) + 1;
                }
            }
        });
    }

    hasRecentNotification(key) {
        try {
            const sent = localStorage.getItem(`notif_sent_${key}`);
            if (!sent) return false;
            
            const sentTime = parseInt(sent);
            const hoursSince = (Date.now() - sentTime) / (1000 * 60 * 60);
            
            return hoursSince < 24;
        } catch (error) {
            return false;
        }
    }

    markNotificationSent(key) {
        try {
            localStorage.setItem(`notif_sent_${key}`, Date.now().toString());
        } catch (error) {
            console.warn('Error marking notification as sent:', error);
        }
    }

    // UTILITY FUNCTIONS
    calculateAge(birthdate) {
        try {
            const today = new Date();
            const birth = new Date(birthdate);
            let age = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            
            return age;
        } catch (error) {
            console.warn('Error calculating age:', error);
            return 0;
        }
    }

    formatFullName(lastName, firstName, middleName) {
        if (middleName && middleName.trim()) {
            return `${lastName}, ${firstName}, ${middleName}`;
        } else {
            return `${lastName}, ${firstName}`;
        }
    }

    validateForm(data) {
        const errors = [];

        if (!data.email) {
            errors.push('Email is required');
        } else {
            const emailValidation = this.validateEmail(data.email);
            if (!emailValidation.valid) {
                errors.push(emailValidation.error);
            }
        }

        if (!data.lastName || data.lastName.length < 2) {
            errors.push('Last name must be at least 2 characters long');
        }
        if (!data.firstName || data.firstName.length < 2) {
            errors.push('First name must be at least 2 characters long');
        }
        
        if (data.middleName && data.middleName.length < 2) {
            errors.push('Middle name must be at least 2 characters long (if provided)');
        }

        if (!data.birthdate) {
            errors.push('Birthday is required');
        } else {
            const age = this.calculateAge(data.birthdate);
            if (age < 10 || age > 50) {
                errors.push('Age must be between 10 and 50 years');
            }
        }

        if (!data.patientType) {
            errors.push('Please select a patient type');
        }

        if (!data.status) {
            errors.push('Please select a status');
        }

        return errors;
    }

    validateEmail(email) {
        if (!email || typeof email !== 'string') {
            return { valid: false, error: 'Email is required' };
        }
        
        const trimmedEmail = email.trim().toLowerCase();
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        
        if (!emailRegex.test(trimmedEmail)) {
            return { valid: false, error: 'Please enter a valid email address' };
        }
        
        if (trimmedEmail.length > 254) {
            return { valid: false, error: 'Email address is too long' };
        }
        
        const localPart = trimmedEmail.split('@')[0];
        if (localPart.length > 64) {
            return { valid: false, error: 'Email address local part is too long' };
        }
        
        return { valid: true, email: trimmedEmail };
    }

    getVisitDisplayText(visitNumber) {
        if (!visitNumber) return 'Not Set';
        
        const num = parseInt(visitNumber);
        if (isNaN(num) || num < 1) return 'Invalid';
        
        const suffix = this.getOrdinalSuffix(num);
        return `${num}${suffix} Visit`;
    }

    getOrdinalSuffix(num) {
        const lastDigit = num % 10;
        const lastTwoDigits = num % 100;
        
        if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
            return 'th';
        }
        
        switch (lastDigit) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    getVisitBadgeClass(visitNumber) {
        const num = parseInt(visitNumber);
        if (isNaN(num) || num < 1) return 'visit-badge';
        
        if (num === 1) return 'visit-badge first-visit';
        if (num >= 2 && num <= 5) return 'visit-badge early-visits';
        if (num >= 6 && num <= 10) return 'visit-badge regular-visits';
        if (num >= 11 && num <= 15) return 'visit-badge frequent-visits';
        return 'visit-badge very-frequent';
    }

    getVisitIcon(visitNumber) {
        const num = parseInt(visitNumber);
        if (isNaN(num) || num < 1) return 'fas fa-question';
        
        if (num === 1) return 'fas fa-star';
        if (num >= 2 && num <= 5) return 'fas fa-leaf';
        if (num >= 6 && num <= 10) return 'fas fa-heart';
        if (num >= 11 && num <= 15) return 'fas fa-crown';
        return 'fas fa-gem';
    }

    getActionIcon(action) {
        switch(action) {
            case 'added': return 'fas fa-user-plus';
            case 'updated': return 'fas fa-user-edit';
            case 'deleted': return 'fas fa-user-minus';
            default: return 'fas fa-history';
        }
    }

    getActionColor(action) {
        switch(action) {
            case 'added': return 'linear-gradient(135deg, #22c55e, #16a34a)';
            case 'updated': return 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
            case 'deleted': return 'linear-gradient(135deg, #ef4444, #dc2626)';
            default: return 'linear-gradient(135deg, #6b7280, #4b5563)';
        }
    }

    getActionText(action) {
        switch(action) {
            case 'added': return 'Patient Added';
            case 'updated': return 'Patient Updated';
            case 'deleted': return 'Patient Deleted';
            default: return 'Patient Activity';
        }
    }

    // MODAL AND UI FUNCTIONS
    closeModal(modalId) {
        const modal = document.getElementById(modalId || 'patientModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
            
            if (modalId === 'patientModal' || !modalId) {
                const form = document.getElementById('patientForm');
                if (form) form.reset();
                
                const saveBtn = document.getElementById('saveBtn');
                if (saveBtn) {
                    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Patient';
                    saveBtn.disabled = false;
                }
                
                const ageDisplay = document.getElementById('ageDisplay');
                if (ageDisplay) {
                    ageDisplay.textContent = '';
                }
                
                const duplicateWarnings = document.querySelectorAll('.duplicate-warning');
                duplicateWarnings.forEach(warning => warning.remove());
                
                const visitInfo = document.querySelector('.visit-info');
                if (visitInfo) visitInfo.remove();
            }
        }
    }

    showNotification(message, type = 'info', category = 'patients') {
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

// ========================================
// GLOBAL FUNCTIONS
// ========================================

window.openModal = function() {
    if (!window.patientsApp?.authManager?.hasPermission('add')) {
        window.patientsApp?.showNotification('You do not have permission to add patients', 'error');
        return;
    }

    const modal = document.getElementById('patientModal');
    if (!modal) return;
    
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
    
    const birthdateInput = document.getElementById('birthdate');
    if (birthdateInput) {
        const maxBirthdate = new Date().toISOString().split('T')[0];
        const minBirthdate = new Date();
        minBirthdate.setFullYear(minBirthdate.getFullYear() - 100);
        birthdateInput.max = maxBirthdate;
        birthdateInput.min = minBirthdate.toISOString().split('T')[0];
    }
    
    setTimeout(() => {
        const emailInput = document.getElementById('email');
        if (emailInput) emailInput.focus();
    }, 100);
};

window.closeModal = function(modalId) {
    if (window.patientsApp) {
        window.patientsApp.closeModal(modalId);
    }
};

window.openPatientHistory = function() {
    console.log('Opening patient history modal...');
    console.log('Current history entries:', window.patientsApp?.patientHistory?.length);
    
    const modal = document.getElementById('patientHistoryModal');
    if (!modal) {
        console.error('Patient history modal not found');
        return;
    }

    if (window.patientsApp) {
        window.patientsApp.renderPatientHistory();
    }
    
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
    
    if (window.patientsApp?.authManager) {
        window.patientsApp.authManager.logUserActivity('view_patient_history');
    }
    
    console.log('Patient history modal opened');
};

window.closePatientHistory = function() {
    const modal = document.getElementById('patientHistoryModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
};

window.handleNotificationClick = function(notificationId) {
    console.log('🔔 Notification clicked:', notificationId);
    
    if (window.patientsApp && window.patientsApp.notificationsManager) {
        window.patientsApp.notificationsManager.handleNotificationAction(notificationId);
    }
};

window.markAllNotificationsRead = function() {
    console.log('✅ Marking all notifications as read');
    
    if (window.patientsApp && window.patientsApp.notificationsManager) {
        window.patientsApp.notificationsManager.markAllAsRead();
    }
};

// ========================================
// PATIENT RECORD FORM - COMPLETE IMPLEMENTATION
// ========================================

window.openPatientRecord = function() {
    console.log('Opening Patient Record Form...');
    
    const modal = document.getElementById('patientRecordModal');
    if (!modal) {
        console.error('❌ Patient record modal not found! Make sure the HTML has <div id="patientRecordModal">');
        alert('Error: Patient record modal not found in HTML. Please check the Patients.html file.');
        return;
    }

    console.log('✓ Modal found');
    modal.style.display = 'block';
    document.body.classList.add('modal-open');

    const container = document.getElementById('patientRecordContainer');
    if (!container) {
        console.error('❌ Patient record container not found! Make sure the HTML has <div id="patientRecordContainer">');
        alert('Error: Patient record container not found in HTML. Please check the Patients.html file.');
        return;
    }

    console.log('✓ Container found');

    // Check if React is loaded
    if (typeof React === 'undefined') {
        console.error('❌ React is not loaded!');
        alert('Error: React library not loaded. Please check your HTML.');
        return;
    }

    console.log('✓ React loaded');

    // Check if ReactDOM is loaded
    if (typeof ReactDOM === 'undefined') {
        console.error('❌ ReactDOM is not loaded!');
        alert('Error: ReactDOM library not loaded. Please check your HTML.');
        return;
    }

    console.log('✓ ReactDOM loaded');

    // Remove existing script if present to avoid duplicates
    const existingScript = document.getElementById('patient-record-script');
    if (existingScript) {
        console.log('Removing existing script...');
        existingScript.remove();
    }

    // Create and inject the React component
    const script = document.createElement('script');
    script.id = 'patient-record-script';
    script.type = 'text/babel';
    script.textContent = `
        const { useState, useEffect } = React;
        
        // Create icon components from Lucide
        const FileText = () => React.createElement('i', { className: 'fas fa-file-alt', style: { fontSize: '18px' } });
        const Download = () => React.createElement('i', { className: 'fas fa-download', style: { fontSize: '18px' } });
        const Plus = () => React.createElement('i', { className: 'fas fa-plus', style: { fontSize: '18px' } });
        const Trash2 = () => React.createElement('i', { className: 'fas fa-trash', style: { fontSize: '18px' } });
        const Calendar = () => React.createElement('i', { className: 'fas fa-calendar', style: { fontSize: '24px' } });
        const User = () => React.createElement('i', { className: 'fas fa-user', style: { fontSize: '24px' } });
        const Activity = () => React.createElement('i', { className: 'fas fa-chart-line', style: { fontSize: '24px' } });
        const Search = () => React.createElement('i', { className: 'fas fa-search', style: { fontSize: '20px' } });
        const X = () => React.createElement('i', { className: 'fas fa-times', style: { fontSize: '18px' } });

        const PatientRecordForm = () => {
          // State management
          const [searchQuery, setSearchQuery] = useState('');
          const [searchResults, setSearchResults] = useState([]);
          const [showSearchResults, setShowSearchResults] = useState(false);
          const [selectedPatient, setSelectedPatient] = useState(null);
          const [patientsDatabase, setPatientsDatabase] = useState([]);
          
          const [patientInfo, setPatientInfo] = useState({
            name: '', address: '', contactNo: '', birthday: '', age: '',
            spouse: '', lastMenstrual: '', expectedDelivery: '',
            previousPregnancies: '', liveBirths: '', lastDelivery: '',
            deliveryMethod: '', referredBy: ''
          });

          const [records, setRecords] = useState([
            { id: 1, date: '', weight: '', bloodPressure: '', abdMeas: '', remarks: '' }
          ]);

          const [showForm, setShowForm] = useState(false);

          // Load patients from the main system on mount
          useEffect(() => {
            if (window.patientsApp && window.patientsApp.patients) {
              const patients = window.patientsApp.patients || {};
              const patientsList = Object.entries(patients).map(([key, patient]) => ({
                key, ...patient
              }));
              setPatientsDatabase(patientsList);
              console.log('Patient Record: Loaded', patientsList.length, 'patients');
            }

            // Close search results when clicking outside
            const handleClickOutside = (e) => {
              if (!e.target.closest('.search-container')) {
                setShowSearchResults(false);
              }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
          }, []);

          // Search functionality
          const handleSearch = (query) => {
            setSearchQuery(query);
            
            if (query.trim() === '') {
              setSearchResults([]);
              setShowSearchResults(false);
              return;
            }

            const lowerQuery = query.toLowerCase().trim();
            const results = patientsDatabase.filter(patient => 
              patient.patientId?.toLowerCase().includes(lowerQuery) ||
              patient.fullName?.toLowerCase().includes(lowerQuery) ||
              patient.firstName?.toLowerCase().includes(lowerQuery) ||
              patient.lastName?.toLowerCase().includes(lowerQuery) ||
              patient.email?.toLowerCase().includes(lowerQuery)
            );

            setSearchResults(results);
            setShowSearchResults(true);
          };

          // Select patient from search
          const selectPatient = (patient) => {
            setSelectedPatient(patient);
            setSearchQuery('');
            setShowSearchResults(false);
            
            // Auto-fill patient information
            setPatientInfo({
              name: patient.fullName || \`\${patient.lastName}, \${patient.firstName}\${patient.middleName ? ', ' + patient.middleName : ''}\`,
              address: patient.address || '',
              contactNo: patient.phone || patient.contactNo || '',
              birthday: patient.birthdate || '',
              age: patient.age?.toString() || '',
              spouse: patient.spouse || '',
              lastMenstrual: patient.lastMenstrual || '',
              expectedDelivery: patient.expectedDelivery || '',
              previousPregnancies: patient.previousPregnancies || '',
              liveBirths: patient.liveBirths || '',
              lastDelivery: patient.lastDelivery || '',
              deliveryMethod: patient.deliveryMethod || '',
              referredBy: patient.referredBy || ''
            });

            setShowForm(true);
          };

          // Clear patient selection
          const clearPatientSelection = () => {
            setSelectedPatient(null);
            setPatientInfo({
              name: '', address: '', contactNo: '', birthday: '', age: '',
              spouse: '', lastMenstrual: '', expectedDelivery: '',
              previousPregnancies: '', liveBirths: '', lastDelivery: '',
              deliveryMethod: '', referredBy: ''
            });
            setRecords([{ id: 1, date: '', weight: '', bloodPressure: '', abdMeas: '', remarks: '' }]);
          };

          // Records management
          const addRecord = () => {
            setRecords([...records, {
              id: records.length + 1,
              date: '', weight: '', bloodPressure: '', abdMeas: '', remarks: ''
            }]);
          };

          const deleteRecord = (id) => {
            if (records.length > 1) {
              setRecords(records.filter(record => record.id !== id));
            }
          };

          const updateRecord = (id, field, value) => {
            setRecords(records.map(record =>
              record.id === id ? { ...record, [field]: value } : record
            ));
          };

          // Patient info update with age calculation
          const updatePatientInfo = (field, value) => {
            setPatientInfo({ ...patientInfo, [field]: value });
            
            if (field === 'birthday' && value) {
              const birthDate = new Date(value);
              const today = new Date();
              let age = today.getFullYear() - birthDate.getFullYear();
              const monthDiff = today.getMonth() - birthDate.getMonth();
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
              }
              setPatientInfo(prev => ({ ...prev, age: age.toString() }));
            }
          };

          // Print functionality
          const handlePrint = () => {
            window.print();
          };

          // Close modal
          const closePatientRecord = () => {
            const modal = document.getElementById('patientRecordModal');
            if (modal) {
              modal.style.display = 'none';
              document.body.classList.remove('modal-open');
            }
          };

          // Main render
          return (
            <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fef3f4 0%, #fff5f7 100%)' }}>
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg, #e63946, #d62828)', padding: '20px', boxShadow: '0 4px 20px rgba(230, 57, 70, 0.2)' }}>
                <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ width: '50px', height: '50px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', padding: '8px' }}>
                      <img src="icons/mother.png" alt="PregnaCare" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div>
                      <h1 style={{ color: 'white', fontSize: '28px', fontWeight: 'bold', margin: 0 }}>Patient Record Form</h1>
                      
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setShowForm(!showForm)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'white', color: '#e63946', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                    >
                      {showForm ? <X size={18} /> : <FileText size={18} />}
                      {showForm ? 'Close Form' : 'New Record'}
                    </button>
                    <button
                      onClick={closePatientRecord}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '2px solid white', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      <X size={18} /> Close
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div style={{ maxWidth: '1400px', margin: '30px auto', padding: '0 20px' }}>
                {showForm ? (
                  <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
                    {/* Search Section */}
                    <div style={{ padding: '30px', borderBottom: '2px solid #f0f0f0' }}>
                      <div className="search-container" style={{ position: 'relative', maxWidth: '600px' }}>
                        <div style={{ position: 'relative' }}>
                          <Search style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#e63946' }} size={20} />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Search patient by ID, name, or email..."
                            style={{ width: '100%', padding: '15px 15px 15px 50px', border: '2px solid #e0e0e0', borderRadius: '12px', fontSize: '16px' }}
                          />
                          {selectedPatient && (
                            <button onClick={clearPatientSelection} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
                              <X size={20} />
                            </button>
                          )}
                        </div>
                        
                        {showSearchResults && searchResults.length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginTop: '8px', maxHeight: '400px', overflowY: 'auto', zIndex: 1000 }}>
                            {searchResults.map((patient) => (
                              <div key={patient.key} onClick={() => selectPatient(patient)} style={{ padding: '15px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}>
                                <div style={{ fontWeight: '600', color: '#333' }}>{patient.fullName}</div>
                                <div style={{ fontSize: '14px', color: '#666' }}>{patient.patientId} • {patient.email}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {selectedPatient && (
                          <div style={{ marginTop: '15px', padding: '15px', background: '#fef3f4', borderRadius: '12px', border: '2px solid #e63946' }}>
                            <div style={{ fontWeight: '600', color: '#e63946', fontSize: '18px' }}>{selectedPatient.fullName}</div>
                            <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                              {selectedPatient.patientId} • Age: {selectedPatient.age} • {selectedPatient.email}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Form Fields */}
                    <div style={{ padding: '40px' }}>
                      {/* Patient Information Section */}
                      <div style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
                          <User style={{ color: '#e63946' }} size={24} />
                          <h3 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>Patient Information</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                          {['name', 'address', 'contactNo', 'birthday', 'age', 'spouse'].map(field => (
                            <div key={field}>
                              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#e63946', marginBottom: '8px' }}>
                                {field === 'name' ? 'Full Name' : field === 'contactNo' ? 'Contact Number' : field.charAt(0).toUpperCase() + field.slice(1)}
                              </label>
                              <input
                                type={field === 'birthday' ? 'date' : field === 'contactNo' ? 'tel' : 'text'}
                                value={patientInfo[field]}
                                onChange={(e) => updatePatientInfo(field, e.target.value)}
                                readOnly={field === 'age'}
                                style={{ width: '100%', padding: '12px 16px', border: '2px solid #e0e0e0', borderRadius: '10px', fontSize: '15px', background: field === 'age' ? '#f5f5f5' : 'white' }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Pregnancy Information Section */}
                      <div style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
                          <Calendar style={{ color: '#e63946' }} size={24} />
                          <h3 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>Pregnancy Information</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                          {[
                            { key: 'lastMenstrual', label: 'Last Menstrual Period', type: 'date' },
                            { key: 'expectedDelivery', label: 'Expected Date of Delivery', type: 'date' },
                            { key: 'previousPregnancies', label: 'Previous Pregnancies', type: 'text' },
                            { key: 'liveBirths', label: 'Live Births', type: 'text' },
                            { key: 'lastDelivery', label: 'Date of Last Delivery', type: 'date' },
                            { key: 'deliveryMethod', label: 'Method of Previous Deliveries', type: 'text' },
                            { key: 'referredBy', label: 'Referred by', type: 'text', fullWidth: true, marginBottom: '30px' }
                          ].map(field => (
                            <div key={field.key} style={field.fullWidth ? { gridColumn: '1 / -1', ...(field.marginBottom ? { marginBottom: field.marginBottom } : {}) } : {}}>
                              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#e63946', marginBottom: '8px' }}>
                                {field.label}
                              </label>
                              <input
                                type={field.type}
                                value={patientInfo[field.key]}
                                onChange={(e) => updatePatientInfo(field.key, e.target.value)}
                                placeholder={field.key === 'deliveryMethod' ? 'e.g., Normal, C-Section' : ''}
                                style={{ width: '100%', padding: '12px 16px', border: '2px solid #e0e0e0', borderRadius: '10px', fontSize: '15px' }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Visit Records Table */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Activity style={{ color: '#e63946' }} size={24} />
                            <h3 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>Visit Records</h3>
                          </div>
                          <button onClick={addRecord} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'linear-gradient(135deg, #e63946, #d62828)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>
                            <Plus size={18} /> Add Visit
                          </button>
                        </div>

                        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '2px solid #e0e0e0' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                            <thead style={{ background: 'linear-gradient(135deg, #fef3f4, #fff5f7)' }}>
                              <tr>
                                {['Date', 'Weight', 'Blood Pressure', 'Abd. Meas.', 'Remarks', 'Action'].map(header => (
                                  <th key={header} style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#e63946', borderBottom: '2px solid #e0e0e0' }}>
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {records.map((record, idx) => (
                                <tr key={record.id} style={{ background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                                  <td style={{ padding: '12px', borderBottom: '1px solid #e0e0e0' }}>
                                    <input type="date" value={record.date} onChange={(e) => updateRecord(record.id, 'date', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #d0d0d0', borderRadius: '6px' }} />
                                  </td>
                                  <td style={{ padding: '12px', borderBottom: '1px solid #e0e0e0' }}>
                                    <input type="text" value={record.weight} onChange={(e) => updateRecord(record.id, 'weight', e.target.value)} placeholder="kg" style={{ width: '100%', padding: '8px', border: '1px solid #d0d0d0', borderRadius: '6px' }} />
                                  </td>
                                  <td style={{ padding: '12px', borderBottom: '1px solid #e0e0e0' }}>
                                    <input type="text" value={record.bloodPressure} onChange={(e) => updateRecord(record.id, 'bloodPressure', e.target.value)} placeholder="120/80" style={{ width: '100%', padding: '8px', border: '1px solid #d0d0d0', borderRadius: '6px' }} />
                                  </td>
                                  <td style={{ padding: '12px', borderBottom: '1px solid #e0e0e0' }}>
                                    <input type="text" value={record.abdMeas} onChange={(e) => updateRecord(record.id, 'abdMeas', e.target.value)} placeholder="cm" style={{ width: '100%', padding: '8px', border: '1px solid #d0d0d0', borderRadius: '6px' }} />
                                  </td>
                                  <td style={{ padding: '12px', borderBottom: '1px solid #e0e0e0' }}>
                                    <textarea value={record.remarks} onChange={(e) => updateRecord(record.id, 'remarks', e.target.value)} placeholder="Enter remarks..." style={{ width: '100%', padding: '8px', border: '1px solid #d0d0d0', borderRadius: '6px', minHeight: '60px', resize: 'vertical' }} />
                                  </td>
                                  <td style={{ padding: '12px', borderBottom: '1px solid #e0e0e0', textAlign: 'center' }}>
                                    {records.length > 1 && (
                                      <button onClick={() => deleteRecord(record.id)} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#e63946' }}>
                                        <Trash2 size={18} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      
                        <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 28px', background: 'linear-gradient(135deg, #e63946, #d62828)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', margin: '0 auto' }}>
                          <Download size={18} /> Print Record
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Welcome Screen
                  <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
                    <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', padding: '60px 40px' }}>
                      <div style={{ width: '100px', height: '100px', background: 'linear-gradient(135deg, #e63946, #d62828)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 25px', padding: '12px' }}>
                        <img src="icons/mother.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <h2 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '15px' }}>Welcome to Patient Record Management</h2>
                      <p style={{ color: '#666', marginBottom: '35px', fontSize: '16px' }}>
                        Search for existing patients or create comprehensive patient records with detailed visit tracking. Click "New Record" to get started.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                        {[
                          { icon: Search, title: 'Search Patients', desc: 'Quickly find patients by ID, name, or email' },
                          { icon: User, title: 'Patient Details', desc: 'Comprehensive maternal information and history' },
                          { icon: Download, title: 'Export Records', desc: 'Download patient records as PDF for printing' }
                        ].map(item => (
                          <div key={item.title} style={{ padding: '25px', background: 'linear-gradient(135deg, #fef3f4, #fff5f7)', borderRadius: '15px', border: '2px solid #ffcdd2' }}>
                            <item.icon style={{ color: '#e63946', margin: '0 auto 15px' }} size={32} />
                            <h3 style={{ fontWeight: '600', marginBottom: '10px', fontSize: '18px' }}>{item.title}</h3>
                            <p style={{ fontSize: '14px', color: '#666' }}>{item.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        };

        // Render the component
        const container = document.getElementById('patientRecordContainer');
        if (container) {
          const root = ReactDOM.createRoot(container);
          root.render(React.createElement(PatientRecordForm));
        }
    `;
    
    document.body.appendChild(script);
    console.log('✓ Script appended to body');

    // Trigger Babel transformation
    console.log('Triggering Babel transformation...');
    
    if (window.Babel && window.Babel.transformScriptTags) {
        try {
            setTimeout(() => {
                window.Babel.transformScriptTags();
                console.log('✓ Babel transformation complete');
            }, 100);
        } catch (error) {
            console.error('❌ Babel transformation error:', error);
            alert('Error transforming React code. Please check browser console.');
        }
    } else {
        console.error('❌ Babel not found! The React component cannot be rendered.');
        alert('Error: Babel standalone not loaded. Please check your HTML includes Babel.');
    }

    // Log activity
    if (window.patientsApp?.authManager) {
        window.patientsApp.authManager.logUserActivity('open_patient_record_form');
    }
    
    console.log('✓ Patient Record Form initialization complete');
};


// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing PregnaCare Patients System...');
    console.log('Admin User ID:', ADMIN_USER_ID);
    console.log('Sub-Admin User ID:', SUB_ADMIN_USER_ID);
    
    window.patientsApp = new PatientsApplication();
    
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            const modalId = event.target.id;
            if (modalId !== 'authRequiredModal') {
                window.closeModal(modalId);
            }
        }
    });
    
    console.log('Patients System ready, waiting for authentication...');
});

// ========================================
// DEBUG HELPERS
// ========================================

window.debugPatientHistory = function() {
    console.log('=== PATIENT HISTORY DEBUG ===');
    console.log('History array:', window.patientsApp?.patientHistory);
    console.log('History length:', window.patientsApp?.patientHistory?.length);
    console.log('Firebase connected:', window.patientsApp?.isFirebaseConnected);
    console.log('LocalStorage history:', localStorage.getItem('patientHistory'));
};

window.PregnaCarePatientsDebug = {
    app: () => window.patientsApp,
    authManager: () => window.patientsApp?.authManager,
    currentUser: () => window.patientsApp?.authManager?.currentUser,
    isAdmin: () => window.patientsApp?.authManager?.isAdmin,
    isSubAdmin: () => window.patientsApp?.authManager?.isSubAdmin,
    patients: () => window.patientsApp?.patients,
    history: () => window.patientsApp?.patientHistory,
    visitHistory: () => window.patientsApp?.patientVisitHistory,
    registrationNotifier: () => window.registrationNotifier,
    notificationsManager: () => window.patientsApp?.notificationsManager,
    
    checkAuth: () => {
        const auth = window.patientsApp?.authManager;
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
    },
    
    testPermissions: () => {
        const auth = window.patientsApp?.authManager;
        if (auth) {
            console.log('=== Permission Check ===');
            console.log('Can View:', auth.hasPermission('view'));
            console.log('Can Add:', auth.hasPermission('add'));
            console.log('Can Edit:', auth.hasPermission('edit'));
            console.log('Can Delete:', auth.hasPermission('delete'));
            console.log('========================');
        }
    },
    
    connectionStatus: () => {
        console.log('=== Connection Status ===');
        console.log('Firebase Connected:', window.patientsApp?.isFirebaseConnected);
        console.log('Patient Count:', Object.keys(window.patientsApp?.patients || {}).length);
        console.log('History Count:', window.patientsApp?.patientHistory?.length || 0);
        console.log('Pending Registrations:', Object.keys(window.registrationNotifier?.pendingRegistrations || {}).length);
        console.log('Notifications Count:', window.patientsApp?.notificationsManager?.notifications?.length || 0);
        console.log('Unread Notifications:', window.patientsApp?.notificationsManager?.unreadCount || 0);
        console.log('=========================');
    },
    
    manualLogout: async () => {
        if (window.patientsApp?.authManager) {
            await window.patientsApp.authManager.logout();
            console.log('Logged out successfully');
        }
    }
};

console.log('✅ PregnaCare Patients System v6.0.0 - FULLY INTEGRATED with Complete Patient Record Form loaded successfully');
// ========================================
// VIEW PATIENT PROFILE FUNCTION - ADDED v6.1.0
// ========================================

// Function to open patient profile modal
window.viewPatientProfile = function(patientId) {
    console.log('Opening patient profile for:', patientId);
    
    if (!window.patientsApp?.authManager?.isAuthenticated) {
        alert('Please log in to view patient profiles');
        return;
    }

    const patient = window.patientsApp.patients[patientId];
    if (!patient) {
        alert('Patient not found');
        return;
    }

    // Log activity
    if (window.patientsApp?.authManager) {
        window.patientsApp.authManager.logUserActivity('view_patient_profile', {
            patientId: patientId,
            patientName: `${patient.firstName} ${patient.lastName}`
        });
    }

    // Show modal
    const modal = document.getElementById('patientProfileModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
        
        // Render patient profile
        renderPatientProfile(patient, patientId);
    }
};

// Function to close patient profile modal
window.closePatientProfile = function() {
    const modal = document.getElementById('patientProfileModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
};

// Function to render patient profile (styled like patient record)
function renderPatientProfile(patient, patientId) {
    const container = document.getElementById('patientProfileContainer');
    if (!container) return;

    // Calculate age
    const age = calculateAge(patient.birthdate);
    
    // Get visit history
    const visits = window.patientsApp?.patientVisitHistory?.[patientId] || [];
    
    // Format name
    const fullName = `${patient.lastName}, ${patient.firstName}${patient.middleName ? ' ' + patient.middleName : ''}`;
    
    const profileHTML = `
        <div class="patient-profile-header">
            <h1>PATIENT RECORD</h1>
        </div>
        
        <div class="patient-profile-body">
            <!-- Patient Information Section -->
            <div class="profile-section">
                <h3>Patient Information</h3>
                <div class="profile-grid">
                    <div class="profile-field">
                        <label>Name of Patient:</label>
                        <div class="profile-field-value">${fullName}</div>
                    </div>
                    <div class="profile-field">
                        <label>Last Menstrual Period:</label>
                        <div class="profile-field-value">${patient.lastMenstrualPeriod || '—'}</div>
                    </div>
                    <div class="profile-field">
                        <label>Address:</label>
                        <div class="profile-field-value">${patient.address}</div>
                    </div>
                    <div class="profile-field">
                        <label>Expected Delivery Date:</label>
                        <div class="profile-field-value">${patient.expectedDeliveryDate || '—'}</div>
                    </div>
                    <div class="profile-field">
                        <label>Contact No.:</label>
                        <div class="profile-field-value">${patient.contactNumber || patient.email}</div>
                    </div>
                    <div class="profile-field">
                        <label>No. of Previous Pregnancies:</label>
                        <div class="profile-field-value">${patient.previousPregnancies || '0'}</div>
                    </div>
                    <div class="profile-field">
                        <label>Birthday:</label>
                        <div class="profile-field-value">${formatDate(patient.birthdate)}</div>
                    </div>
                    <div class="profile-field">
                        <label>No. of Live Births:</label>
                        <div class="profile-field-value">${patient.liveBirths || '0'}</div>
                    </div>
                    <div class="profile-field">
                        <label>Age:</label>
                        <div class="profile-field-value">${age} years old</div>
                    </div>
                    <div class="profile-field">
                        <label>Date of Last Delivery:</label>
                        <div class="profile-field-value">${patient.lastDeliveryDate || '—'}</div>
                    </div>
                    <div class="profile-field">
                        <label>Name of Spouse:</label>
                        <div class="profile-field-value">${patient.spouseName || '—'}</div>
                    </div>
                    <div class="profile-field">
                        <label>Method of Previous Deliveries:</label>
                        <div class="profile-field-value">${patient.deliveryMethod || '—'}</div>
                    </div>
                </div>
                <div class="profile-field" style="margin-top: 15px;">
                    <label>Referred By:</label>
                    <div class="profile-field-value">${patient.referredBy || 'Walk-in'}</div>
                </div>
            </div>

            <!-- Visit Records Section -->
            <div class="profile-section">
                <h3>Visit Records</h3>
                ${visits.length > 0 ? `
                    <table class="visit-records-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Weight</th>
                                <th>Blood Pressure</th>
                                <th>Abd. Meas.</th>
                                <th>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${visits.map(visit => `
                                <tr>
                                    <td>${formatDate(visit.visitDate)}</td>
                                    <td>${visit.weight || '—'}</td>
                                    <td>${visit.bloodPressure || '—'}</td>
                                    <td>${visit.abdominalMeasurement || '—'}</td>
                                    <td class="remarks-cell">${visit.remarks || '—'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : `
                    <p style="text-align: center; color: #999; padding: 20px;">No visit records available</p>
                `}
            </div>

            <div class="profile-actions">
                    <button class="profile-action-btn" onclick="printPatientProfile()">
                        <i class="fas fa-print"></i> Print Record
                    </button>
                    <button class="profile-action-btn" onclick="closePatientProfile()">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = profileHTML;
}

// Function to print patient profile
window.printPatientProfile = function() {
    window.print();
};

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Helper function to calculate age
function calculateAge(birthdate) {
    if (!birthdate) return '—';
    const today = new Date();
    const birthDate = new Date(birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

// ========================================
// OVERRIDE RENDER TABLE ROW - ADDED v6.1.0
// ========================================

// Wait for DOM and app to be ready, then override renderTableRow
document.addEventListener('DOMContentLoaded', function() {
    // Wait a moment for patientsApp to be initialized
    setTimeout(function() {
        if (window.patientsApp && typeof window.patientsApp.renderTableRow === 'function') {
            // Store original function
            const originalRenderTableRow = window.patientsApp.renderTableRow.bind(window.patientsApp);
            
            // Override with new version that includes View button
            window.patientsApp.renderTableRow = function(patient, patientId) {
                const age = this.calculateAge(patient.birthdate);
                const ageDisplay = age !== '—' ? `${age} years old` : '—';
                const statusClass = patient.status?.toLowerCase() || 'ongoing';
                
                const fullName = `${patient.lastName}, ${patient.firstName}${patient.middleName ? ' ' + patient.middleName : ''}`;
                
                return `
                    <tr data-patient-id="${patientId}" data-patient-type="${patient.patientType || 'Prenatal'}">
                        <td>${patientId}</td>
                        <td>${fullName}</td>
                        <td>${ageDisplay}</td>
                        <td>
                            <span class="status-badge status-${statusClass}">
                                ${patient.status || 'Ongoing'}
                            </span>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn view-btn" onclick="viewPatientProfile('${patientId}')" title="View Patient Profile">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                ${this.authManager.hasPermission('edit') ? `
                                    <button class="action-btn edit-btn" onclick="openEditModal('${patientId}')" title="Edit Patient">
                                        <i class="fas fa-edit"></i> Edit
                                    </button>
                                ` : ''}
                                ${this.authManager.hasPermission('delete') ? `
                                    <button class="action-btn delete-btn" onclick="deletePatient('${patientId}')" title="Delete Patient">
                                        <i class="fas fa-trash"></i> Delete
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            };
            
            console.log('✅ View Patient Profile feature successfully integrated - v6.1.0');
            
            // Refresh table if patients already loaded
            if (window.patientsApp.patients && Object.keys(window.patientsApp.patients).length > 0) {
                window.patientsApp.renderTable();
            }
        } else {
            console.warn('⚠️ patientsApp.renderTableRow not found, retrying...');
            // Retry after another delay
            setTimeout(arguments.callee, 1000);
        }
    }, 500);
});

console.log('✅ PregnaCare Patients System v6.1.0 - View Patient Profile Feature Loaded');
// ========================================
// UPDATED PATIENT RECORD VIEW - v7.0.0
// ========================================

// Override the viewPatientProfile function to show proper patient record
window.viewPatientProfile = function(patientId) {
    console.log('Opening patient record for:', patientId);
    
    if (!window.patientsApp?.authManager?.isAuthenticated) {
        alert('Please log in to view patient records');
        return;
    }

    const patient = window.patientsApp.patients[patientId];
    if (!patient) {
        alert('Patient not found');
        return;
    }
}
// ========================================
// ENHANCED PATIENT RECORD MODULE v8.0.0
// Complete Physical Form Replica
// ========================================

// Override viewPatientProfile to use enhanced record view
window.viewPatientProfile = function(patientId) {
    window.viewPatientRecord(patientId);
};

// Function to open patient record modal (VIEW MODE)
window.viewPatientRecord = function(patientId) {
    console.log('Opening patient record for:', patientId);
    
    if (!window.patientsApp?.authManager?.isAuthenticated) {
        alert('Please log in to view patient records');
        return;
    }

    const patient = window.patientsApp.patients[patientId];
    if (!patient) {
        alert('Patient not found');
        return;
    }

    // Log activity
    if (window.patientsApp?.authManager) {
        window.patientsApp.authManager.logUserActivity('view_patient_record', {
            patientId: patientId,
            patientName: `${patient.firstName} ${patient.lastName}`
        });
    }

    // Show modal with patient record
    const modal = document.getElementById('patientRecordModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
        
        // Render patient record in view mode
        renderPatientRecord(patient, patientId, false);
    }
};

// Function to open patient record in EDIT MODE
window.editPatientRecord = function(patientId) {
    console.log('Opening patient record for editing:', patientId);
    
    if (!window.patientsApp?.authManager?.hasPermission('edit')) {
        alert('You do not have permission to edit patient records');
        return;
    }

    const patient = window.patientsApp.patients[patientId];
    if (!patient) {
        alert('Patient not found');
        return;
    }

    // Log activity
    if (window.patientsApp?.authManager) {
        window.patientsApp.authManager.logUserActivity('edit_patient_record', {
            patientId: patientId,
            patientName: `${patient.firstName} ${patient.lastName}`
        });
    }

    // Show modal with patient record in edit mode
    const modal = document.getElementById('patientRecordModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
        
        // Render patient record in edit mode
        renderPatientRecord(patient, patientId, true);
    }
};

// Function to close patient record modal
window.closePatientRecord = function() {
    const modal = document.getElementById('patientRecordModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
};

// Main function to render patient record matching physical form
function renderPatientRecord(patient, patientId, editMode = false) {
    const container = document.getElementById('patientRecordContainer');
    if (!container) return;

    // Calculate age
    const age = calculateAge(patient.birthdate);
    
    // Get visit history
    const visits = window.patientsApp?.patientVisitHistory?.[patientId] || [];
    
    // Format name
    const fullName = `${patient.firstName} ${patient.middleName ? patient.middleName + ' ' : ''}${patient.lastName}`;
    
    // Create empty rows for the visit table (matching the physical form - at least 15 rows)
    const minRows = 15;
    const emptyRowsNeeded = Math.max(minRows - visits.length, 0);
    
    const recordHTML = `
        <div class="patient-record-container">
            <!-- Header -->
            <div class="record-header">
                <h1>PATIENT RECORD</h1>
                <div class="record-actions">
                    ${!editMode ? `
                        <button class="edit-record-btn" onclick="editPatientRecord('${patientId}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    ` : ''}
                    <button class="print-btn" onclick="printPatientRecord()">
                        <i class="fas fa-print"></i> Print
                    </button>
                    <button class="print-btn" onclick="closePatientRecord()">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            </div>

            <!-- Body -->
            <div class="record-body">
                <!-- Patient Information Section - Two Column Grid -->
                <div class="patient-info-section">
                    <div class="info-group">
                        <span class="info-label">✓ Name of Patient:</span>
                        <span class="info-value" data-field="fullName">
                            ${fullName}
                        </span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">✓ Last Menstrual Period:</span>
                        <span class="info-value ${editMode ? 'editable' : ''}" data-field="lastMenstrualPeriod">
                            ${editMode ? `<input type="date" value="${patient.lastMenstrualPeriod || ''}">` : (patient.lastMenstrualPeriod ? formatDateShort(patient.lastMenstrualPeriod) : '_________________')}
                        </span>
                    </div>
                    
                    <div class="info-group">
                        <span class="info-label">✓ Address:</span>
                        <span class="info-value ${editMode ? 'editable' : ''}" data-field="address">
                            ${editMode ? `<input type="text" value="${patient.address || ''}">` : (patient.address || '_________________')}
                        </span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">✓ Expected Delivery Date:</span>
                        <span class="info-value ${editMode ? 'editable' : ''}" data-field="expectedDeliveryDate">
                            ${editMode ? `<input type="date" value="${patient.expectedDeliveryDate || ''}">` : (patient.expectedDeliveryDate ? formatDateShort(patient.expectedDeliveryDate) : '_________________')}
                        </span>
                    </div>
                    
                    <div class="info-group">
                        <span class="info-label">✓ Contact No.:</span>
                        <span class="info-value ${editMode ? 'editable' : ''}" data-field="contactNumber">
                            ${editMode ? `<input type="tel" value="${patient.contactNumber || ''}">` : (patient.contactNumber || patient.email || '_________________')}
                        </span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">✓ No. of Previous Pregnancies:</span>
                        <span class="info-value ${editMode ? 'editable' : ''}" data-field="previousPregnancies">
                            ${editMode ? `<input type="number" value="${patient.previousPregnancies || 0}" min="0">` : (patient.previousPregnancies || '_________________')}
                        </span>
                    </div>
                    
                    <div class="info-group">
                        <span class="info-label">✓ Birthday:</span>
                        <span class="info-value" data-field="birthdate">
                            ${formatDateShort(patient.birthdate)}
                        </span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">✓ No. of Live Births:</span>
                        <span class="info-value ${editMode ? 'editable' : ''}" data-field="liveBirths">
                            ${editMode ? `<input type="number" value="${patient.liveBirths || 0}" min="0">` : (patient.liveBirths || '_________________')}
                        </span>
                    </div>
                    
                    <div class="info-group">
                        <span class="info-label">✓ Age:</span>
                        <span class="info-value" data-field="age">
                            ${age} ${age !== '—' ? 'years old' : ''}
                        </span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">✓ Date of Last Delivery:</span>
                        <span class="info-value ${editMode ? 'editable' : ''}" data-field="lastDeliveryDate">
                            ${editMode ? `<input type="date" value="${patient.lastDeliveryDate || ''}">` : (patient.lastDeliveryDate ? formatDateShort(patient.lastDeliveryDate) : '_________________')}
                        </span>
                    </div>
                    
                    <div class="info-group">
                        <span class="info-label">✓ Name of Spouse:</span>
                        <span class="info-value ${editMode ? 'editable' : ''}" data-field="spouseName">
                            ${editMode ? `<input type="text" value="${patient.spouseName || ''}">` : (patient.spouseName || '_________________')}
                        </span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">✓ Method of Previous Deliveries:</span>
                        <span class="info-value ${editMode ? 'editable' : ''}" data-field="deliveryMethod">
                            ${editMode ? `<input type="text" value="${patient.deliveryMethod || ''}">` : (patient.deliveryMethod || '_________________')}
                        </span>
                    </div>
                </div>

                <!-- Referred By Section -->
                <div class="referred-by-section" style="margin-bottom: 30px;">
                    <span class="info-label">Referred By:</span>
                    <span class="info-value ${editMode ? 'editable' : ''}" data-field="referredBy">
                        ${editMode ? `<input type="text" value="${patient.referredBy || ''}" placeholder="Walk-in or Referral source">` : (patient.referredBy || '__________________________________')}
                    </span>
                </div>

                <!-- Obstetric History Section -->
                ${patient.obstetricHistory || editMode ? `
                <div class="obstetric-history">
                    <h3><i class="fas fa-notes-medical"></i> Obstetric History / Additional Notes</h3>
                    ${editMode ? `
                        <textarea id="obstetricHistoryField" style="width: 100%; min-height: 120px; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-family: inherit; font-size: 14px;">${patient.obstetricHistory || ''}</textarea>
                    ` : `
                        <ul class="obstetric-history-list">
                            ${patient.obstetricHistory ? patient.obstetricHistory.split('\n').filter(line => line.trim()).map(line => `<li>${line.trim()}</li>`).join('') : '<li>No obstetric history recorded</li>'}
                        </ul>
                    `}
                </div>
                ` : ''}

                <!-- Visit Records Table -->
                <div class="record-table-container">
                    <table class="record-table" id="visitRecordsTable">
                        <thead>
                            <tr>
                                <th>DATE</th>
                                <th>WEIGHT</th>
                                <th>BLOOD PRESSURE</th>
                                <th>ABD. MEAS.</th>
                                <th>REMARKS</th>
                            </tr>
                        </thead>
                        <tbody id="visitTableBody">
                            ${renderVisitRows(visits, editMode)}
                            ${renderEmptyRows(emptyRowsNeeded, editMode)}
                        </tbody>
                    </table>
                </div>

                ${editMode ? `
                    <button class="add-visit-row-btn" onclick="addNewVisitRow()">
                        <i class="fas fa-plus"></i> Add Visit Entry
                    </button>
                ` : ''}

                ${editMode ? `
                    <button class="save-changes-btn" onclick="savePatientRecordChanges('${patientId}')">
                        <i class="fas fa-save"></i> Save All Changes
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    container.innerHTML = recordHTML;
}

// Helper function to render visit rows
function renderVisitRows(visits, editMode) {
    if (!visits || visits.length === 0) return '';
    
    return visits.map((visit, index) => `
        <tr data-visit-index="${index}">
            <td>
                ${editMode ? `<input type="date" value="${visit.visitDate || ''}" data-field="visitDate">` : formatDateShort(visit.visitDate)}
            </td>
            <td>
                ${editMode ? `<input type="text" value="${visit.weight || ''}" placeholder="e.g., 65kg" data-field="weight">` : (visit.weight || '')}
            </td>
            <td>
                ${editMode ? `<input type="text" value="${visit.bloodPressure || ''}" placeholder="e.g., 120/80" data-field="bloodPressure">` : (visit.bloodPressure || '')}
            </td>
            <td>
                ${editMode ? `<input type="text" value="${visit.abdominalMeasurement || ''}" placeholder="e.g., 36cm" data-field="abdominalMeasurement">` : (visit.abdominalMeasurement || '')}
            </td>
            <td class="remarks-cell">
                ${editMode ? `<textarea data-field="remarks" rows="2">${visit.remarks || ''}</textarea>` : (visit.remarks || '')}
            </td>
        </tr>
    `).join('');
}

// Helper function to render empty rows
function renderEmptyRows(count, editMode) {
    if (count <= 0) return '';
    
    const rows = [];
    for (let i = 0; i < count; i++) {
        rows.push(`
            <tr class="empty-row" data-empty="true">
                <td>${editMode ? '<input type="date" data-field="visitDate">' : '&nbsp;'}</td>
                <td>${editMode ? '<input type="text" placeholder="Weight" data-field="weight">' : '&nbsp;'}</td>
                <td>${editMode ? '<input type="text" placeholder="BP" data-field="bloodPressure">' : '&nbsp;'}</td>
                <td>${editMode ? '<input type="text" placeholder="ABD" data-field="abdominalMeasurement">' : '&nbsp;'}</td>
                <td class="remarks-cell">${editMode ? '<textarea placeholder="Remarks" data-field="remarks" rows="2"></textarea>' : '&nbsp;'}</td>
            </tr>
        `);
    }
    return rows.join('');
}

// Function to add a new visit row dynamically
window.addNewVisitRow = function() {
    const tbody = document.getElementById('visitTableBody');
    if (!tbody) return;
    
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td><input type="date" data-field="visitDate"></td>
        <td><input type="text" placeholder="Weight (e.g., 65kg)" data-field="weight"></td>
        <td><input type="text" placeholder="BP (e.g., 120/80)" data-field="bloodPressure"></td>
        <td><input type="text" placeholder="ABD (e.g., 36cm)" data-field="abdominalMeasurement"></td>
        <td class="remarks-cell"><textarea placeholder="Remarks" data-field="remarks" rows="2"></textarea></td>
    `;
    
    // Insert before empty rows
    const emptyRows = tbody.querySelectorAll('tr.empty-row');
    if (emptyRows.length > 0) {
        tbody.insertBefore(newRow, emptyRows[0]);
        // Remove one empty row
        emptyRows[0].remove();
    } else {
        tbody.appendChild(newRow);
    }
};

// Function to save patient record changes
window.savePatientRecordChanges = async function(patientId) {
    if (!window.patientsApp?.authManager?.hasPermission('edit')) {
        alert('You do not have permission to edit patient records');
        return;
    }

    const saveBtn = document.querySelector('.save-changes-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
        // Collect patient information changes
        const patientUpdates = {};
        document.querySelectorAll('.info-value.editable input, .info-value.editable select').forEach(input => {
            const field = input.closest('.info-value').dataset.field;
            if (field) {
                patientUpdates[field] = input.value;
            }
        });

        // Get obstetric history
        const obstetricHistoryField = document.getElementById('obstetricHistoryField');
        if (obstetricHistoryField) {
            patientUpdates.obstetricHistory = obstetricHistoryField.value;
        }

        // Collect visit records
        const visits = [];
        const visitRows = document.querySelectorAll('#visitTableBody tr:not(.empty-row)');
        visitRows.forEach((row, index) => {
            const visit = {};
            row.querySelectorAll('input, textarea').forEach(input => {
                const field = input.dataset.field;
                if (field && input.value.trim()) {
                    visit[field] = input.value.trim();
                }
            });
            
            // Only add visit if it has at least one filled field
            if (Object.keys(visit).length > 0) {
                visits.push(visit);
            }
        });

        // Update patient data in Firebase
        const updates = {};
        updates[`patients/${patientId}`] = {
            ...window.patientsApp.patients[patientId],
            ...patientUpdates,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        };

        // Update visits if any
        if (visits.length > 0) {
            updates[`patientVisits/${patientId}`] = visits;
        }

        await firebase.database().ref().update(updates);

        // Log activity
        if (window.patientsApp?.authManager) {
            await window.patientsApp.authManager.logUserActivity('update_patient_record', {
                patientId: patientId,
                changes: Object.keys(patientUpdates),
                visitsUpdated: visits.length
            });
        }

        // Show success message
        alert('Patient record updated successfully!');
        
        // Reload the record in view mode
        const patient = window.patientsApp.patients[patientId];
        Object.assign(patient, patientUpdates);
        renderPatientRecord(patient, patientId, false);

        // Refresh the main patients table
        if (window.patientsApp && window.patientsApp.renderTable) {
            window.patientsApp.renderTable();
        }

    } catch (error) {
        console.error('Error saving patient record:', error);
        alert('Error saving patient record. Please try again.');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save All Changes';
        }
    }
};

// Function to print patient record
window.printPatientRecord = function() {
    window.print();
};

// Helper function to format date in short format (MM/DD/YYYY)
function formatDateShort(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

// Helper function to calculate age
function calculateAge(birthdate) {
    if (!birthdate) return '—';
    const today = new Date();
    const birthDate = new Date(birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

console.log('✅ PregnaCare Patient Record System v8.0.0 - Complete Physical Form Replica Loaded');
// ========================================
// PATIENT TYPE FILTER FUNCTIONALITY
// ========================================

let currentFilter = 'All';

window.filterPatientsByType = function(filterType) {
    currentFilter = filterType;
    
    console.log('Filtering patients by type:', filterType);
    
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
    const tableBody = document.getElementById('patientTableBody');
    const rows = tableBody.querySelectorAll('tr[data-patient-id]');
    
    console.log('Total rows found:', rows.length);
    
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
    
    console.log('Visible rows after filter:', visibleCount);
    
    // Log activity
    if (window.patientsApp?.authManager) {
        window.patientsApp.authManager.logUserActivity('filter_patients', {
            filterType: filterType
        });
    }
    
    // Check if any rows are visible - show message without removing rows
    const noResultsRow = tableBody.querySelector('tr[data-no-results]');
    
    if (visibleCount === 0 && rows.length > 0) {
        // Remove existing no-results message if any
        if (noResultsRow) {
            noResultsRow.remove();
        }
        
        // Add no-results message
        const noResultsHtml = `
            <tr data-no-results="true">
                <td colspan="5" style="text-align: center; padding: 40px;">
                    <i class="fas fa-user-slash" style="font-size: 48px; color: #ccc; margin-bottom: 10px; display: block;"></i>
                    <p style="color: #666; font-size: 16px;">No ${filterType} patients found</p>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', noResultsHtml);
    } else {
        // Remove no-results message if rows are visible
        if (noResultsRow) {
            noResultsRow.remove();
        }
    }
};


console.log('✅ Patient Type Filter Feature Loaded - v7.0.0');

// ========================================
// SAMPLE PATIENT DATA - DEMO PURPOSES
// ========================================

// Function to add sample patients to the system
window.addSamplePatients = async function() {
    if (!window.patientsApp) {
        console.error('PatientsApp not initialized');
        return;
    }

    const samplePatients = {
        // PRENATAL PATIENT
        'sample_prenatal_maria': {
            patientId: "PT100",
            email: "maria.santos@sample.com",
            lastName: "Santos",
            firstName: "Maria",
            middleName: "Cruz",
            fullName: "Santos, Maria Cruz",
            address: "123 Mabini Street, Manila City, Metro Manila",
            birthdate: "1995-03-15",
            age: 30,
            patientType: "Prenatal",
            status: "Ongoing",
            obstetricHistory: "G2P1 (2-0-0-1) - Previous delivery: Normal spontaneous vaginal delivery, 2021",
            contactNumber: "+63 917 123 4567",
            emergencyContact: "Juan Santos (Husband) - +63 917 765 4321",
            bloodType: "O+",
            allergies: "None known",
            medicalHistory: "No significant medical history. Previous pregnancy without complications.",
            lastMenstrualPeriod: "2024-07-20",
            expectedDueDate: "2025-04-26",
            gestationalAge: "16 weeks",
            createdAt: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
            updatedAt: Date.now(),
            createdBy: window.patientsApp.authManager?.currentUser?.uid || "system",
            createdByName: window.patientsApp.authManager?.userDisplayName || "System"
        },
        
        // GYNECOLOGY PATIENT
        'sample_gynecology_carmen': {
            patientId: "PT101",
            email: "carmen.lopez@sample.com",
            lastName: "Lopez",
            firstName: "Carmen",
            middleName: "Isabel",
            fullName: "Lopez, Carmen Isabel",
            address: "789 Del Pilar Street, Makati City, Metro Manila",
            birthdate: "1988-11-30",
            age: 36,
            patientType: "Gynecology",
            status: "Ongoing",
            obstetricHistory: "G0 - Nulligravida",
            contactNumber: "+63 919 345 6789",
            emergencyContact: "Rosa Lopez (Mother) - +63 919 987 6543",
            bloodType: "B+",
            allergies: "Latex (mild contact dermatitis)",
            medicalHistory: "Polycystic Ovary Syndrome (PCOS) diagnosed 2019. Irregular menstrual cycles. Managed with medication.",
            chiefComplaint: "Irregular menstrual periods, pelvic pain",
            lastMenstrualPeriod: "2024-10-10",
            menstrualCycleLength: "Irregular (35-50 days)",
            contraceptionMethod: "Oral contraceptives",
            diagnosis: "PCOS with irregular menses",
            currentMedications: "Metformin 500mg BID, Oral contraceptive pills",
            createdAt: Date.now() - (45 * 24 * 60 * 60 * 1000), // 45 days ago
            updatedAt: Date.now(),
            createdBy: window.patientsApp.authManager?.currentUser?.uid || "system",
            createdByName: window.patientsApp.authManager?.userDisplayName || "System"
        }
    };

    const sampleVisits = {
        // PRENATAL PATIENT VISITS
        'sample_prenatal_maria': [
            {
                visitDate: "2024-09-15",
                weight: "58kg",
                bloodPressure: "110/70",
                abdominalMeasurement: "N/A",
                remarks: "First prenatal check-up. BP normal, no complaints. Prescribed prenatal vitamins (Natalac)."
            },
            {
                visitDate: "2024-10-20",
                weight: "59kg",
                bloodPressure: "115/72",
                abdominalMeasurement: "22cm",
                remarks: "Second check-up. Fetal heartbeat detected - 145 bpm. Mother reports feeling well. Continue vitamins."
            },
            {
                visitDate: "2024-11-05",
                weight: "60.5kg",
                bloodPressure: "112/70",
                abdominalMeasurement: "24cm",
                remarks: "Routine check-up. Baby's movements felt by mother. No swelling noted. All vitals normal."
            }
        ],
        
        // GYNECOLOGY PATIENT VISITS
        'sample_gynecology_carmen': [
            {
                visitDate: "2024-08-15",
                weight: "68kg",
                bloodPressure: "125/78",
                abdominalMeasurement: "N/A",
                remarks: "Initial consultation for irregular periods. Pelvic ultrasound ordered. Started on Metformin."
            },
            {
                visitDate: "2024-09-20",
                weight: "67kg",
                bloodPressure: "122/76",
                abdominalMeasurement: "N/A",
                remarks: "Follow-up visit. Ultrasound confirmed PCOS - multiple small cysts on both ovaries. Prescribed oral contraceptives to regulate cycle."
            },
            {
                visitDate: "2024-10-25",
                weight: "66.5kg",
                bloodPressure: "120/75",
                abdominalMeasurement: "N/A",
                remarks: "6-week follow-up. Patient reports improvement in cycle regularity. Mild side effects from medications (nausea) resolving. Continue current regimen."
            }
        ]
    };

    try {
        console.log('Adding sample patients to Firebase...');
        
        // Add patients to Firebase
        for (const [key, patient] of Object.entries(samplePatients)) {
            await firebase.database().ref(`patients/${key}`).set(patient);
            console.log(`✓ Added patient: ${patient.fullName}`);
        }
        
        // Add visit records to Firebase
        for (const [key, visits] of Object.entries(sampleVisits)) {
            await firebase.database().ref(`patientVisits/${key}`).set(visits);
            console.log(`✓ Added ${visits.length} visits for ${samplePatients[key].fullName}`);
        }
        
        console.log('✅ Sample patients added successfully!');
        alert('Sample patients added successfully!\n\nAdded:\n- Maria Santos (Prenatal, PT100)\n- Carmen Lopez (Gynecology, PT101)\n\nRefresh the page to see them.');
        
        return true;
    } catch (error) {
        console.error('Error adding sample patients:', error);
        alert('Error adding sample patients. Check console for details.');
        return false;
    }
};

// Function to check if sample patients already exist
window.checkSamplePatients = async function() {
    try {
        const snapshot = await firebase.database().ref('patients').orderByChild('patientId').equalTo('PT100').once('value');
        return snapshot.exists();
    } catch (error) {
        console.error('Error checking sample patients:', error);
        return false;
    }
};

// Auto-add sample patients on first load if no patients exist
document.addEventListener('DOMContentLoaded', async function() {
    // Wait for authentication and app initialization
    setTimeout(async () => {
        if (window.patientsApp && window.patientsApp.authManager?.isAuthenticated) {
            try {
                // Check if there are any patients
                const patientsSnapshot = await firebase.database().ref('patients').once('value');
                const patientsExist = patientsSnapshot.exists() && patientsSnapshot.numChildren() > 0;
                
                // Check if sample patients already added
                const samplesExist = await window.checkSamplePatients();
                
                // If no patients at all, add samples automatically
                if (!patientsExist) {
                    console.log('📝 No patients found. Adding sample patients...');
                    await window.addSamplePatients();
                } else if (!samplesExist) {
                    console.log('ℹ️ Sample patients not found. You can add them by running: addSamplePatients()');
                } else {
                    console.log('✓ Sample patients already exist');
                }
            } catch (error) {
                console.error('Error in sample patient auto-add:', error);
            }
        }
    }, 3000); // Wait 3 seconds for full initialization
});

console.log('✅ Sample Patient Data Module Loaded v1.0');
console.log('📝 To manually add sample patients, run: addSamplePatients()');
console.log('📝 Sample patients will be added automatically if no patients exist');