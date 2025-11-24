// =============================================
// PregnaCare Messages System - JavaScript
// COMPLETE VERSION WITH FILE ATTACHMENTS
// =============================================

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyABrKEsHES3slgR8040ZAMa3_8tYeGf4uM",
    authDomain: "pregnacare-f3c44.firebaseapp.com",
    databaseURL: "https://pregnacare-f3c44-default-rtdb.firebaseio.com",
    projectId: "pregnacare-f3c44",
    storageBucket: "pregnacare-f3c44.firebasestorage.app",
    messagingSenderId: "981150593337",
    appId: "1:981150593337:web:4ae9b3215529ee340ff8e8"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// =============================================
// Global Variables
// =============================================
let currentUser = null;
let currentConversation = null;
let conversations = {};
let users = {};
let patients = {};
let messageListeners = {};
let conversationListener = null;
let usersListener = null;
let patientsListener = null;
let currentFilter = 'all';
let patientsLoaded = false;
let usersLoaded = false;

// File Attachment Variables
let modalAttachments = [];
let chatAttachments = [];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Recipient Search State
let recipientSearchState = {
    isOpen: false,
    selectedRecipient: null,
    filteredRecipients: [],
    currentQuery: ''
};

// DOM Elements
const conversationsList = document.getElementById('conversationsList');
const chatArea = document.getElementById('chatArea');
const newMessageModal = document.getElementById('newMessageModal');
const toastContainer = document.getElementById('toastContainer');
const unreadCount = document.getElementById('unreadCount');
const connectionIndicator = document.getElementById('connectionIndicator');

// Searchable dropdown DOM elements
let recipientSearchInput = null;
let recipientDropdownList = null;
let searchableDropdown = null;

// =============================================
// Initialize Application
// =============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing PregnaCare Messages...');
    
    setupConnectionMonitoring();
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('✅ User authenticated:', user.email);
            await loadCurrentUser(user.uid);
        } else {
            console.log('⚠️ No authentication - using demo user');
            currentUser = {
                uid: 'web_user_001',
                name: 'Web User',
                email: 'web@pregnacare.com',
                role: 'admin',
                avatar: 'WU'
            };
            await database.ref(`users/${currentUser.uid}`).set(currentUser);
        }
        
        setupEventListeners();
        
        await Promise.all([
            loadUsers(),
            loadPatients(),
            loadConversations()
        ]);
        
        setupPresence();
        setupFileHandlers();
        
        console.log('✅ Messages System initialized successfully');
    });
});

// =============================================
// Connection Monitoring
// =============================================

function setupConnectionMonitoring() {
    const connectedRef = database.ref('.info/connected');
    
    connectedRef.on('value', (snapshot) => {
        if (snapshot.val() === true) {
            updateConnectionStatus('connected');
        } else {
            updateConnectionStatus('disconnected');
        }
    });
}

function updateConnectionStatus(status) {
    const indicator = connectionIndicator;
    if (!indicator) return;
    
    const icon = indicator.querySelector('i');
    const text = indicator.querySelector('span');
    
    indicator.className = 'connection-indicator';
    
    if (status === 'connected') {
        indicator.classList.add('connected');
        if (icon) icon.className = 'fas fa-circle';
        if (text) text.textContent = 'Connected';
    } else if (status === 'disconnected') {
        indicator.classList.add('disconnected');
        if (icon) icon.className = 'fas fa-circle';
        if (text) text.textContent = 'Disconnected';
    } else {
        indicator.classList.add('connecting');
        if (icon) icon.className = 'fas fa-spinner fa-spin';
        if (text) text.textContent = 'Connecting...';
    }
}

// =============================================
// User Management
// =============================================

async function loadCurrentUser(uid) {
    try {
        const snapshot = await database.ref(`users/${uid}`).once('value');
        
        if (snapshot.exists()) {
            currentUser = { ...snapshot.val(), uid: uid };
            console.log('✅ User data loaded:', currentUser.name);
        } else {
            currentUser = {
                uid: uid,
                name: auth.currentUser.displayName || 'User',
                email: auth.currentUser.email,
                role: 'user',
                avatar: (auth.currentUser.displayName || 'U').substring(0, 2).toUpperCase()
            };
            await database.ref(`users/${uid}`).set(currentUser);
            console.log('✅ New user created:', currentUser.name);
        }
    } catch (error) {
        console.error('❌ Error loading user:', error);
        showToast('Failed to load user data', 'error');
    }
}

async function loadUsers() {
    return new Promise((resolve) => {
        if (usersListener) {
            database.ref('users').off('value', usersListener);
        }
        
        usersListener = database.ref('users').on('value', (snapshot) => {
            users = snapshot.val() || {};
            usersLoaded = true;
            console.log('✅ Users loaded:', Object.keys(users).length);
            
            if (recipientSearchState.currentQuery) {
                populateRecipientDropdown();
            }
            
            if (Object.keys(conversations).length > 0) {
                renderConversations();
            }
            
            resolve();
        });
    });
}

async function loadPatients() {
    return new Promise((resolve) => {
        if (patientsListener) {
            database.ref('patients').off('value', patientsListener);
        }
        
        patientsListener = database.ref('patients').on('value', (snapshot) => {
            const data = snapshot.val() || {};
            patients = {};
            
            console.log('📦 Loading patients from Firebase...');
            console.log('📊 Raw patients data keys:', Object.keys(data).length);
            
            let successCount = 0;
            let skipCount = 0;
            
            Object.keys(data).forEach(id => {
                const patient = data[id];
                
                const hasPatientId = patient && patient.patientId;
                const hasFullName = patient && patient.fullName;
                const hasName = patient && (patient.firstName || patient.lastName);
                
                if (patient && hasPatientId && (hasFullName || hasName)) {
                    let fullName = patient.fullName;
                    if (!fullName && patient.firstName && patient.lastName) {
                        fullName = `${patient.lastName}, ${patient.firstName}`;
                        if (patient.middleName) {
                            fullName += `, ${patient.middleName}`;
                        }
                    }
                    
                    patients[id] = {
                        uid: id,
                        patientId: patient.patientId,
                        name: fullName,
                        email: patient.email || '',
                        role: 'patient',
                        avatar: getPatientInitials(fullName),
                        age: patient.age || 'N/A',
                        visitNumber: patient.visitNumber || '1',
                        birthdate: patient.birthdate || '',
                        status: patient.status || 'Active'
                    };
                    
                    successCount++;
                } else {
                    skipCount++;
                }
            });
            
            patientsLoaded = true;
            console.log(`✅ Patients loaded: ${successCount} successful, ${skipCount} skipped`);
            
            if (recipientSearchState.currentQuery) {
                populateRecipientDropdown();
            }
            
            resolve();
        }, (error) => {
            console.error('❌ Error loading patients:', error);
            patientsLoaded = true;
            resolve();
        });
    });
}

function getPatientInitials(fullName) {
    if (!fullName) return 'P';
    
    const parts = fullName.split(',').map(p => p.trim());
    
    if (parts.length >= 2) {
        const lastName = parts[0];
        const firstName = parts[1];
        return (firstName[0] || '') + (lastName[0] || '');
    }
    
    return fullName.substring(0, 2).toUpperCase();
}

function setupPresence() {
    if (!currentUser || !currentUser.uid) return;
    
    const userRef = database.ref(`users/${currentUser.uid}`);
    
    userRef.update({ 
        isOnline: true, 
        lastSeen: Date.now() 
    });
    
    userRef.onDisconnect().update({ 
        isOnline: false, 
        lastSeen: Date.now() 
    });
    
    setInterval(() => {
        userRef.update({ lastSeen: Date.now() });
    }, 30000);
    
    console.log('✅ Presence system initialized');
}

// =============================================
// Event Listeners
// =============================================

function setupEventListeners() {
    // New Message Button
    const newMsgBtn = document.getElementById('newMessageBtn');
    if (newMsgBtn) {
        newMsgBtn.addEventListener('click', async () => {
            newMessageModal.style.display = 'block';
            
            if (!patientsLoaded || !usersLoaded) {
                showToast('Loading recipients...', 'info');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            if (Object.keys(patients).length === 0) {
                console.log('⚠️ No patients loaded, forcing reload...');
                await forceReloadPatients();
            }
            
            setTimeout(() => {
                initializeSearchableDropdown();
                if (recipientSearchInput) {
                    recipientSearchInput.focus();
                }
            }, 100);
        });
    }
    
    // Refresh Button
    const refreshBtn = document.getElementById('refreshMessages');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadConversations();
            showToast('Messages refreshed', 'success');
        });
    }
    
    // Modal Close Buttons
    const closeBtn = document.getElementById('closeModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    const cancelBtn = document.getElementById('cancelMessage');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }
    
    // New Message Form Submit
    const form = document.getElementById('newMessageForm');
    if (form) {
        form.addEventListener('submit', handleNewMessage);
    }
    
    // Character Counter
    const contentArea = document.getElementById('messageContent');
    if (contentArea) {
        contentArea.addEventListener('input', function() {
            const charCount = document.getElementById('charCount');
            if (charCount) {
                charCount.textContent = `${this.value.length}/1000 characters`;
            }
        });
    }
    
    // Search Input
    const searchInput = document.getElementById('searchConversations');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                filterConversations(e.target.value);
            }, 300);
        });
    }
    
    // Filter Tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            filterByType(this.dataset.filter);
        });
    });
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === newMessageModal) {
            closeModal();
        }
    });
    
    console.log('✅ Event listeners initialized');
}

// =============================================
// File Attachment Management
// =============================================

function setupFileHandlers() {
    // Modal file input
    const modalFileInput = document.getElementById('fileInput');
    if (modalFileInput) {
        modalFileInput.addEventListener('change', handleModalFileSelect);
    }
    
    // Chat file input
    const chatFileInput = document.getElementById('chatFileInput');
    const chatAttachBtn = document.getElementById('chatAttachBtn');
    
    if (chatFileInput && chatAttachBtn) {
        chatAttachBtn.addEventListener('click', () => {
            chatFileInput.click();
        });
        chatFileInput.addEventListener('change', handleChatFileSelect);
    }
}

function handleModalFileSelect(e) {
    const files = Array.from(e.target.files);
    processFiles(files, 'modal');
    e.target.value = ''; // Reset input
}

function handleChatFileSelect(e) {
    const files = Array.from(e.target.files);
    processFiles(files, 'chat');
    e.target.value = ''; // Reset input
}

function processFiles(files, context) {
    const validFiles = files.filter(file => {
        if (file.size > MAX_FILE_SIZE) {
            showToast(`File "${file.name}" is too large. Max size is 5MB.`, 'error');
            return false;
        }
        return true;
    });
    
    validFiles.forEach(file => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const fileData = {
                id: Date.now() + Math.random(),
                name: file.name,
                size: file.size,
                type: file.type,
                data: e.target.result,
                timestamp: Date.now()
            };
            
            if (context === 'modal') {
                modalAttachments.push(fileData);
                renderModalFilePreview();
            } else {
                chatAttachments.push(fileData);
                renderChatFilePreview();
                updateSendButtonState();
            }
        };
        
        reader.readAsDataURL(file);
    });
}

function renderModalFilePreview() {
    const container = document.getElementById('filePreviewContainer');
    if (!container) return;
    
    if (modalAttachments.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = modalAttachments.map(file => createFilePreviewHTML(file, 'modal')).join('');
}

function renderChatFilePreview() {
    const container = document.getElementById('chatFilePreview');
    if (!container) return;
    
    if (chatAttachments.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = chatAttachments.map(file => createFilePreviewHTML(file, 'chat')).join('');
}

function createFilePreviewHTML(file, context) {
    const fileType = getFileType(file.name, file.type);
    const icon = getFileIcon(fileType, file.data, file.type);
    
    return `
        <div class="file-preview-item" data-file-id="${file.id}">
            <div class="file-icon ${fileType}">
                ${icon}
            </div>
            <div class="file-info">
                <div class="file-name" title="${escapeHTML(file.name)}">${escapeHTML(file.name)}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <button type="button" class="file-remove" onclick="removeFile(${file.id}, '${context}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
}

function getFileType(filename, mimeType) {
    const ext = filename.split('.').pop().toLowerCase();
    
    if (mimeType.startsWith('image/')) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'doc';
    if (['xls', 'xlsx'].includes(ext)) return 'excel';
    return 'other';
}

function getFileIcon(fileType, data, mimeType) {
    if (fileType === 'image') {
        return `<img src="${data}" alt="Preview">`;
    }
    
    const icons = {
        pdf: '<i class="fas fa-file-pdf"></i>',
        doc: '<i class="fas fa-file-word"></i>',
        excel: '<i class="fas fa-file-excel"></i>',
        other: '<i class="fas fa-file"></i>'
    };
    
    return icons[fileType] || icons.other;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function removeFile(fileId, context) {
    if (context === 'modal') {
        modalAttachments = modalAttachments.filter(f => f.id !== fileId);
        renderModalFilePreview();
    } else {
        chatAttachments = chatAttachments.filter(f => f.id !== fileId);
        renderChatFilePreview();
        updateSendButtonState();
    }
}

function updateSendButtonState() {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (!sendBtn) return;
    
    const hasText = input && input.value.trim().length > 0;
    const hasFiles = chatAttachments.length > 0;
    
    sendBtn.disabled = !(hasText || hasFiles);
}

// =============================================
// SEARCHABLE RECIPIENT DROPDOWN
// =============================================

function initializeSearchableDropdown() {
    console.log('🔍 Initializing searchable recipient dropdown...');
    
    recipientSearchInput = document.getElementById("recipientInput");
    recipientDropdownList = document.getElementById("recipientDropdownList");
    searchableDropdown = document.querySelector(".searchable-select");
    
    if (!recipientSearchInput || !recipientDropdownList || !searchableDropdown) {
        console.error('❌ Dropdown elements not found!');
        return;
    }
    
    console.log('✅ Dropdown elements found');
    console.log('📊 Patients available:', Object.keys(patients).length);
    console.log('📊 Users available:', Object.keys(users).length);
    
    // Remove existing listeners by cloning
    const newInput = recipientSearchInput.cloneNode(true);
    recipientSearchInput.parentNode.replaceChild(newInput, recipientSearchInput);
    recipientSearchInput = newInput;
    
    const newList = recipientDropdownList.cloneNode(true);
    recipientDropdownList.parentNode.replaceChild(newList, recipientDropdownList);
    recipientDropdownList = newList;
    
    // Set up event listeners
    recipientSearchInput.addEventListener('input', handleRecipientSearch);
    recipientSearchInput.addEventListener('focus', handleRecipientFocus);
    recipientSearchInput.addEventListener('blur', handleRecipientBlur);
    recipientSearchInput.addEventListener('keydown', handleRecipientKeydown);
    
    recipientDropdownList.addEventListener('click', handleRecipientOptionClick);
    recipientDropdownList.addEventListener('mousedown', (e) => e.preventDefault());
    
    console.log('✅ Searchable recipient dropdown initialized');
}

function handleRecipientSearch(e) {
    const query = e.target.value.trim();
    recipientSearchState.currentQuery = query;
    
    if (query.length === 0) {
        closeDropdown();
        clearRecipientSelection();
        return;
    }
    
    if (query.length >= 1) {
        const allRecipients = getAllRecipientsForDropdown();
        
        recipientSearchState.filteredRecipients = allRecipients.filter(recipient => {
            const lowerQuery = query.toLowerCase();
            
            const nameMatch = recipient.name && recipient.name.toLowerCase().includes(lowerQuery);
            const patientIdMatch = recipient.patientId && 
                                  recipient.patientId.toLowerCase().includes(lowerQuery);
            const emailMatch = recipient.email && 
                              recipient.email.toLowerCase().includes(lowerQuery);
            
            return nameMatch || patientIdMatch || emailMatch;
        });
        
        updateDropdownDisplay();
        openDropdown();
    }
    
    if (recipientSearchState.selectedRecipient) {
        const lowerQuery = query.toLowerCase();
        const selectedMatches = 
            recipientSearchState.selectedRecipient.name.toLowerCase().includes(lowerQuery) ||
            (recipientSearchState.selectedRecipient.patientId && 
             recipientSearchState.selectedRecipient.patientId.toLowerCase().includes(lowerQuery));
        
        if (!selectedMatches && query.length > 0) {
            clearRecipientSelection();
        }
    }
}

function handleRecipientFocus(e) {
    const query = e.target.value.trim();
    
    if (query.length > 0) {
        handleRecipientSearch(e);
    } else {
        updateDropdownPlaceholder();
        openDropdown();
    }
}

function handleRecipientBlur(e) {
    setTimeout(() => {
        if (document.activeElement !== recipientSearchInput && 
            !recipientDropdownList?.contains(document.activeElement)) {
            closeDropdown();
        }
    }, 250);
}

function handleRecipientKeydown(e) {
    const options = recipientDropdownList.querySelectorAll('.dropdown-item:not(.no-results)');
    const currentSelected = recipientDropdownList.querySelector('.dropdown-item.selected');
    
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
                selectRecipientFromOption(currentSelected);
            }
            break;
            
        case 'Escape':
            e.preventDefault();
            closeDropdown();
            break;
    }
}

function handleRecipientOptionClick(e) {
    const option = e.target.closest('.dropdown-item');
    if (option && !option.classList.contains('no-results')) {
        selectRecipientFromOption(option);
    }
}

function selectRecipientFromOption(option) {
    const recipientUid = option.dataset.recipientUid;
    const recipientName = option.dataset.recipientName;
    const recipientAvatar = option.dataset.recipientAvatar;
    const recipientRole = option.dataset.recipientRole;
    const recipientPatientId = option.dataset.recipientPatientId;
    
    if (!recipientUid || !recipientName) {
        console.error('Invalid recipient option data', option.dataset);
        return;
    }
    
    recipientSearchState.selectedRecipient = {
        uid: recipientUid,
        name: recipientName,
        avatar: recipientAvatar,
        role: recipientRole,
        patientId: recipientPatientId || null
    };
    
    recipientSearchInput.value = recipientName;
    recipientSearchInput.classList.add('has-selection');
    
    closeDropdown();
    showSelectedRecipientInfo();
    
    console.log('✅ Recipient selected:', recipientSearchState.selectedRecipient);
}

function clearRecipientSelection() {
    recipientSearchState.selectedRecipient = null;
    if (recipientSearchInput) {
        recipientSearchInput.classList.remove('has-selection');
    }
    
    const existingInfo = document.querySelector('.recipient-confirmation');
    if (existingInfo) {
        existingInfo.remove();
    }
}

function openDropdown() {
    if (!searchableDropdown || !recipientDropdownList) {
        console.warn('⚠️ Cannot open dropdown - elements not found');
        return;
    }
    
    recipientSearchState.isOpen = true;
    searchableDropdown.classList.add('open');
    recipientDropdownList.style.display = 'block';
}

function closeDropdown() {
    if (!searchableDropdown || !recipientDropdownList) return;
    
    recipientSearchState.isOpen = false;
    searchableDropdown.classList.remove('open');
    recipientDropdownList.style.display = 'none';
    
    const selectedOption = recipientDropdownList.querySelector('.dropdown-item.selected');
    if (selectedOption) {
        selectedOption.classList.remove('selected');
    }
}

function getAllRecipientsForDropdown() {
    const recipients = [];
    
    // Add users (except current user)
    let userCount = 0;
    Object.keys(users).forEach(uid => {
        if (uid !== currentUser?.uid) {
            const user = users[uid];
            if (user && user.name && typeof user.name === 'string' && user.name.length > 0) {
                recipients.push({
                    uid: uid,
                    name: user.name,
                    email: user.email || '',
                    role: user.role || 'user',
                    avatar: user.avatar || user.name.substring(0, 2).toUpperCase(),
                    isOnline: user.isOnline || false,
                    patientId: null
                });
                userCount++;
            }
        }
    });
    
    // Add patients
    let patientCount = 0;
    Object.keys(patients).forEach(uid => {
        const patient = patients[uid];
        if (patient && patient.name && patient.patientId) {
            recipients.push({
                uid: uid,
                name: patient.name,
                email: patient.email || '',
                role: 'patient',
                avatar: patient.avatar || 'PT',
                patientId: patient.patientId,
                age: patient.age,
                status: patient.status,
                isOnline: false
            });
            patientCount++;
        }
    });
    
    // Sort
    recipients.sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return a.name.localeCompare(b.name);
    });
    
    console.log(`✅ Total recipients: ${recipients.length}`);
    
    return recipients;
}

function updateDropdownPlaceholder() {
    if (!recipientDropdownList) return;
    
    recipientDropdownList.innerHTML = '';
    
    const placeholderOption = document.createElement('div');
    placeholderOption.className = 'dropdown-item no-results search-prompt';
    placeholderOption.innerHTML = `
        <i class="fas fa-search" style="margin-bottom: 8px; font-size: 24px; opacity: 0.3;"></i>
        <div>Start typing to search...</div>
        <small style="opacity: 0.7; margin-top: 4px; display: block;">Search by name, patient ID (PT001), or email</small>
    `;
    
    recipientDropdownList.appendChild(placeholderOption);
}

function updateDropdownDisplay() {
    if (!recipientDropdownList) return;
    
    recipientDropdownList.innerHTML = '';
    
    if (recipientSearchState.filteredRecipients.length === 0) {
        const noResultsOption = document.createElement('div');
        noResultsOption.className = 'dropdown-item no-results no-matches';
        
        if (recipientSearchState.currentQuery && recipientSearchState.currentQuery.length > 0) {
            noResultsOption.innerHTML = `
                <i class="fas fa-exclamation-circle" style="margin-bottom: 8px; font-size: 20px; color: #dc3545;"></i>
                <div style="font-weight: 600; margin-bottom: 4px;">No recipients found</div>
                <small style="opacity: 0.8;">No patients or users match "${escapeHTML(recipientSearchState.currentQuery)}"</small>
            `;
        } else {
            noResultsOption.className = 'dropdown-item no-results search-prompt';
            noResultsOption.innerHTML = `
                <i class="fas fa-search" style="margin-bottom: 8px; font-size: 24px; opacity: 0.3;"></i>
                <div>Start typing to search...</div>
                <small style="opacity: 0.7; margin-top: 4px; display: block;">Search by name, patient ID (PT001), or email</small>
            `;
        }
        
        recipientDropdownList.appendChild(noResultsOption);
        return;
    }
    
    recipientSearchState.filteredRecipients.forEach(recipient => {
        const option = createRecipientDropdownOption(recipient);
        recipientDropdownList.appendChild(option);
    });
}

function createRecipientDropdownOption(recipient) {
    const option = document.createElement('div');
    option.className = 'dropdown-item';
    
    option.dataset.recipientUid = recipient.uid;
    option.dataset.recipientName = recipient.name;
    option.dataset.recipientAvatar = recipient.avatar;
    option.dataset.recipientRole = recipient.role;
    if (recipient.patientId) {
        option.dataset.recipientPatientId = recipient.patientId;
    }
    
    const recipientDisplay = document.createElement('div');
    recipientDisplay.className = 'recipient-info';
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'recipient-name';
    nameDiv.innerHTML = `
        <i class="fas fa-${recipient.role === 'patient' ? 'user' : recipient.role === 'doctor' ? 'user-md' : 'user-circle'}"></i>
        ${escapeHTML(recipient.name)}
    `;
    
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'recipient-details';
    
    if (recipient.patientId) {
        const idSpan = document.createElement('span');
        idSpan.className = 'recipient-id';
        idSpan.innerHTML = `<i class="fas fa-id-badge"></i> ID: ${recipient.patientId}`;
        detailsDiv.appendChild(idSpan);
    }
    
    if (recipient.email) {
        const emailSpan = document.createElement('span');
        emailSpan.innerHTML = `<i class="fas fa-envelope"></i> ${escapeHTML(recipient.email)}`;
        detailsDiv.appendChild(emailSpan);
    }
    
    if (recipient.age && recipient.role === 'patient') {
        const ageSpan = document.createElement('span');
        ageSpan.innerHTML = `<i class="fas fa-birthday-cake"></i> Age: ${recipient.age}`;
        detailsDiv.appendChild(ageSpan);
    }
    
    const roleSpan = document.createElement('span');
    roleSpan.className = `recipient-status ${recipient.isOnline ? 'active' : 'other'}`;
    
    if (recipient.role === 'patient' && recipient.status) {
        roleSpan.textContent = recipient.status.toUpperCase();
        roleSpan.style.background = recipient.status.toLowerCase() === 'ongoing' ? 
            'linear-gradient(135deg, #22c55e, #16a34a)' : 
            'linear-gradient(135deg, #3b82f6, #1d4ed8)';
    } else {
        roleSpan.textContent = recipient.role.charAt(0).toUpperCase() + recipient.role.slice(1);
        if (recipient.isOnline) {
            roleSpan.textContent += ' • Online';
        }
    }
    detailsDiv.appendChild(roleSpan);
    
    recipientDisplay.appendChild(nameDiv);
    recipientDisplay.appendChild(detailsDiv);
    option.appendChild(recipientDisplay);
    
    return option;
}

function showSelectedRecipientInfo() {
    if (!recipientSearchState.selectedRecipient) return;
    
    const existingInfo = document.querySelector('.recipient-confirmation');
    if (existingInfo) {
        existingInfo.remove();
    }
    
    const recipientContainer = document.querySelector('.recipient-field-wrapper');
    if (!recipientContainer) return;
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'recipient-confirmation';
    
    const checkIcon = document.createElement('span');
    checkIcon.className = 'check-icon';
    checkIcon.textContent = '✓';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'recipient-name';
    
    let displayText = recipientSearchState.selectedRecipient.name;
    if (recipientSearchState.selectedRecipient.patientId) {
        displayText += ` (${recipientSearchState.selectedRecipient.patientId})`;
    } else {
        displayText += ` (${recipientSearchState.selectedRecipient.role})`;
    }
    
    nameSpan.textContent = displayText;
    
    infoDiv.appendChild(checkIcon);
    infoDiv.appendChild(nameSpan);
    
    recipientContainer.appendChild(infoDiv);
}

function populateRecipientDropdown() {
    recipientSearchState.filteredRecipients = getAllRecipientsForDropdown();
    if (recipientDropdownList && recipientSearchState.isOpen) {
        updateDropdownDisplay();
    }
}

// =============================================
// Conversations Management
// =============================================

function loadConversations() {
    if (!currentUser || !currentUser.uid) {
        console.warn('Cannot load conversations: no current user');
        return;
    }
    
    if (conversationListener) {
        database.ref('conversations').off('value', conversationListener);
    }
    
    conversationListener = database.ref('conversations').on('value', (snapshot) => {
        const data = snapshot.val() || {};
        conversations = {};
        
        Object.keys(data).forEach(id => {
            const conv = data[id];
            if (conv.participants && conv.participants[currentUser.uid]) {
                conversations[id] = { ...conv, id };
            }
        });
        
        renderConversations();
        updateUnreadCount();
        
        console.log('✅ Conversations loaded:', Object.keys(conversations).length);
    });
}

function renderConversations() {
    if (!conversationsList) return;
    
    const convArray = Object.values(conversations).sort((a, b) => {
        return (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0);
    });

    if (convArray.length === 0) {
        conversationsList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #888;">
                <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 20px; display: block; color: #f8bbc7;"></i>
                <h3 style="margin-bottom: 10px; color: #d6455f; font-size: 18px;">No conversations yet</h3>
                <p style="font-size: 14px;">Click "New Message" to start a conversation</p>
            </div>
        `;
        return;
    }

    conversationsList.innerHTML = convArray.map(conv => {
        const otherUserId = Object.keys(conv.participants).find(id => id !== currentUser.uid);
        const otherUser = users[otherUserId] || patients[otherUserId] || { name: 'Unknown', avatar: '??', isOnline: false };
        
        const isUnread = conv.lastMessage?.senderId !== currentUser.uid && 
                        (!conv.lastReadBy?.[currentUser.uid] || 
                         conv.lastReadBy[currentUser.uid] < conv.lastMessage.timestamp);
        
        return `
            <div class="conversation-item ${currentConversation === conv.id ? 'active' : ''}" 
                 onclick="selectConversation('${conv.id}')">
                <div class="conversation-avatar">
                    ${escapeHTML(otherUser.avatar)}
                    ${otherUser.isOnline ? '<div class="online-indicator"></div>' : ''}
                </div>
                <div class="conversation-info">
                    <div class="conversation-name">${escapeHTML(otherUser.name)}</div>
                    <div class="conversation-preview">
                        ${escapeHTML((conv.lastMessage?.content || 'No messages').substring(0, 50))}${(conv.lastMessage?.content || '').length > 50 ? '...' : ''}
                    </div>
                </div>
                <div class="conversation-meta">
                    <div class="conversation-time">${formatTimeAgo(conv.lastMessage?.timestamp)}</div>
                    ${isUnread ? '<div class="unread-badge">New</div>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

function selectConversation(conversationId) {
    currentConversation = conversationId;
    const conv = conversations[conversationId];
    
    if (!conv) {
        console.warn('Conversation not found:', conversationId);
        return;
    }
    
    if (messageListeners[conversationId]) {
        database.ref(`messages/${conversationId}`).off();
        delete messageListeners[conversationId];
    }
    
    markAsRead(conversationId);
    renderConversations();
    renderChatArea(conv);
    loadMessages(conversationId);
    
    console.log('✅ Conversation selected:', conversationId);
}

function updateUnreadCount() {
    if (!unreadCount) return;
    
    let count = 0;
    
    Object.values(conversations).forEach(conv => {
        if (conv.lastMessage?.senderId !== currentUser.uid && 
            (!conv.lastReadBy?.[currentUser.uid] || 
             conv.lastReadBy[currentUser.uid] < conv.lastMessage.timestamp)) {
            count++;
        }
    });
    
    unreadCount.textContent = count;
    unreadCount.style.display = count > 0 ? 'inline-block' : 'none';
    
    if (count > 0) {
        document.title = `(${count}) PregnaCare - Messages`;
    } else {
        document.title = 'PregnaCare - Messages';
    }
}

function markAsRead(conversationId) {
    if (!currentUser || !currentUser.uid) return;
    
    database.ref(`conversations/${conversationId}/lastReadBy/${currentUser.uid}`)
        .set(Date.now())
        .catch(error => {
            console.error('Error marking as read:', error);
        });
}

// =============================================
// Chat Area Management
// =============================================

function renderChatArea(conv) {
    if (!chatArea) return;
    
    const otherUserId = Object.keys(conv.participants).find(id => id !== currentUser.uid);
    const otherUser = users[otherUserId] || patients[otherUserId] || { name: 'Unknown', avatar: '??', isOnline: false };
    
    chatArea.innerHTML = `
        <div class="chat-header">
            <div class="chat-user-info">
                <div class="chat-avatar">
                    ${escapeHTML(otherUser.avatar)}
                    ${otherUser.isOnline ? '<div class="online-indicator"></div>' : ''}
                </div>
                <div class="chat-user-details">
                    <h3>${escapeHTML(otherUser.name)}</h3>
                    <div class="chat-status">
                        <div class="status-dot ${otherUser.isOnline ? '' : 'offline'}"></div>
                        ${otherUser.isOnline ? 'Online' : 'Offline'}
                    </div>
                </div>
            </div>
        </div>
        
        <div class="messages-area" id="messagesArea">
            <div class="loading-messages" style="text-align: center; padding: 40px; color: #888;">
                <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #fa314a;"></i>
                <p>Loading messages...</p>
            </div>
        </div>
        
        <div class="message-input-area">
            <div class="message-input-container">
                <button class="attach-btn" id="chatAttachBtn" title="Attach file">
                    <i class="fas fa-paperclip"></i>
                </button>
                <input type="file" id="chatFileInput" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" style="display: none;">
                <textarea class="message-input" id="messageInput" 
                          placeholder="Type a message..." rows="1"></textarea>
                <button class="send-btn" id="sendBtn" onclick="sendMessage()" disabled>
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
            <div id="chatFilePreview" class="chat-file-preview"></div>
        </div>
    `;
    
    setupMessageInput();
    setupFileHandlers();
}

function setupMessageInput() {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (!input || !sendBtn) return;
    
    input.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        updateSendButtonState();
    });
    
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (this.value.trim() || chatAttachments.length > 0) {
                sendMessage();
            }
        }
    });
    
    input.focus();
}

// =============================================
// Messages Management
// =============================================

function loadMessages(conversationId) {
    const messagesRef = database.ref(`messages/${conversationId}`);
    
    messagesRef.on('value', (snapshot) => {
        const messages = [];
        
        snapshot.forEach(child => {
            messages.push({ id: child.key, ...child.val() });
        });
        
        messages.sort((a, b) => a.timestamp - b.timestamp);
        
        renderMessages(messages);
    });
    
    messageListeners[conversationId] = true;
}

function renderMessages(messages) {
    const messagesArea = document.getElementById('messagesArea');
    
    if (!messagesArea) return;
    
    const wasAtBottom = messagesArea.scrollHeight - messagesArea.scrollTop === messagesArea.clientHeight || 
                       messagesArea.scrollTop === 0;
    
    if (messages.length === 0) {
        messagesArea.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #888;">
                <i class="fas fa-comment-dots" style="font-size: 48px; margin-bottom: 20px; 
                   display: block; color: #f8bbc7;"></i>
                <h3 style="color: #d6455f; margin-bottom: 10px;">No messages yet</h3>
                <p>Send a message to start the conversation</p>
            </div>
        `;
        return;
    }
    
    messagesArea.innerHTML = messages.map(msg => {
        const isSent = msg.senderId === currentUser.uid;
        const attachmentsHTML = msg.attachments ? renderAttachments(msg.attachments, isSent) : '';
        
        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="message-content">
                    ${msg.content ? `<div class="message-bubble">${escapeHTML(msg.content)}</div>` : ''}
                    ${attachmentsHTML}
                    <div class="message-time">${formatTime(msg.timestamp)}</div>
                </div>
            </div>
        `;
    }).join('');
    
    if (wasAtBottom) {
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }
    
    // Setup attachment click handlers
    setupAttachmentHandlers();
}

function renderAttachments(attachments, isSent) {
    if (!attachments || attachments.length === 0) return '';
    
    return `
        <div class="message-attachments">
            ${attachments.map(att => {
                const fileType = getFileType(att.name, att.type);
                const icon = getFileIcon(fileType, att.data, att.type);
                
                return `
                    <div class="message-attachment" data-attachment='${JSON.stringify(att).replace(/'/g, "&apos;")}'>
                        <div class="attachment-icon ${fileType}">
                            ${icon}
                        </div>
                        <div class="attachment-details">
                            <div class="attachment-name" title="${escapeHTML(att.name)}">${escapeHTML(att.name)}</div>
                            <div class="attachment-size">${formatFileSize(att.size)}</div>
                        </div>
                        <div class="attachment-download">
                            <i class="fas fa-download"></i>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function setupAttachmentHandlers() {
    document.querySelectorAll('.message-attachment').forEach(element => {
        element.addEventListener('click', function(e) {
            e.preventDefault();
            const attachmentData = JSON.parse(this.dataset.attachment);
            handleAttachmentClick(attachmentData);
        });
    });
}

function handleAttachmentClick(attachment) {
    const fileType = getFileType(attachment.name, attachment.type);
    
    if (fileType === 'image') {
        showImageLightbox(attachment);
    } else {
        downloadAttachment(attachment);
    }
}

function showImageLightbox(attachment) {
    // Remove existing lightbox if any
    let lightbox = document.getElementById('imageLightbox');
    if (lightbox) {
        lightbox.remove();
    }
    
    // Create new lightbox
    lightbox = document.createElement('div');
    lightbox.id = 'imageLightbox';
    lightbox.className = 'image-lightbox';
    lightbox.innerHTML = `
        <div class="lightbox-content">
            <span class="lightbox-close">&times;</span>
            <img src="${attachment.data}" alt="${escapeHTML(attachment.name)}">
        </div>
    `;
    
    document.body.appendChild(lightbox);
    
    // Show with animation
    setTimeout(() => {
        lightbox.classList.add('active');
    }, 10);
    
    // Close handlers
    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
    
    // ESC key to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeLightbox();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function closeLightbox() {
    const lightbox = document.getElementById('imageLightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        setTimeout(() => {
            lightbox.remove();
        }, 300);
    }
}

function downloadAttachment(attachment) {
    const link = document.createElement('a');
    link.href = attachment.data;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Downloading ${attachment.name}...`, 'success');
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (!input || !sendBtn) return;
    
    const content = input.value.trim();
    const hasAttachments = chatAttachments.length > 0;
    
    if (!content && !hasAttachments) {
        console.warn('Cannot send message: empty content and no attachments');
        return;
    }
    
    if (!currentConversation) {
        console.warn('Cannot send message: no conversation selected');
        return;
    }
    
    sendBtn.disabled = true;
    
    const messageId = database.ref(`messages/${currentConversation}`).push().key;
    const timestamp = Date.now();
    
    const message = {
        id: messageId,
        content: content || '',
        senderId: currentUser.uid,
        senderName: currentUser.name,
        timestamp: timestamp,
        type: hasAttachments ? 'mixed' : 'text'
    };
    
    // Add attachments if any
    if (hasAttachments) {
        message.attachments = chatAttachments.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type,
            data: file.data,
            timestamp: file.timestamp
        }));
    }
    
    database.ref(`messages/${currentConversation}/${messageId}`).set(message)
        .then(() => {
            const lastMessageContent = hasAttachments ? 
                (content || `📎 ${chatAttachments.length} attachment(s)`) : 
                content;
            
            return database.ref(`conversations/${currentConversation}`).update({
                lastMessage: {
                    content: lastMessageContent,
                    senderId: currentUser.uid,
                    timestamp: timestamp
                }
            });
        })
        .then(() => {
            input.value = '';
            input.style.height = 'auto';
            chatAttachments = [];
            renderChatFilePreview();
            sendBtn.disabled = false;
            input.focus();
            
            console.log('✅ Message sent successfully');
        })
        .catch(error => {
            console.error('❌ Error sending message:', error);
            showToast('Failed to send message', 'error');
            sendBtn.disabled = false;
        });
}

function handleNewMessage(e) {
    e.preventDefault();
    
    const recipient = recipientSearchState.selectedRecipient;
    const subject = document.getElementById('messageSubject').value.trim();
    const content = document.getElementById('messageContent').value.trim();
    const hasAttachments = modalAttachments.length > 0;
    
    if (!recipient) {
        showToast('Please select a recipient from the dropdown', 'error');
        if (recipientSearchInput) {
            recipientSearchInput.focus();
        }
        return;
    }
    
    if (!subject || (!content && !hasAttachments)) {
        showToast('Please fill in subject and message or attach files', 'error');
        return;
    }
    
    const recipientUser = users[recipient.uid] || patients[recipient.uid];
    
    if (!recipientUser) {
        showToast(`Recipient not found`, 'error');
        return;
    }
    
    const existingConv = Object.values(conversations).find(conv => 
        conv.participants[currentUser.uid] && conv.participants[recipient.uid]
    );
    
    if (existingConv) {
        showToast('Conversation already exists. Opening it...', 'info');
        closeModal();
        setTimeout(() => selectConversation(existingConv.id), 500);
        return;
    }
    
    const conversationId = database.ref('conversations').push().key;
    const timestamp = Date.now();
    
    const conversationData = {
        id: conversationId,
        participants: {
            [currentUser.uid]: { 
                name: currentUser.name, 
                avatar: currentUser.avatar 
            },
            [recipient.uid]: { 
                name: recipientUser.name, 
                avatar: recipientUser.avatar 
            }
        },
        subject: subject,
        createdAt: timestamp,
        createdBy: currentUser.uid
    };
    
    database.ref(`conversations/${conversationId}`).set(conversationData)
        .then(() => {
            const messageId = database.ref(`messages/${conversationId}`).push().key;
            const message = {
                id: messageId,
                content: content || '',
                senderId: currentUser.uid,
                senderName: currentUser.name,
                timestamp: timestamp,
                type: hasAttachments ? 'mixed' : 'text'
            };
            
            // Add attachments if any
            if (hasAttachments) {
                message.attachments = modalAttachments.map(file => ({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    data: file.data,
                    timestamp: file.timestamp
                }));
            }
            
            return database.ref(`messages/${conversationId}/${messageId}`).set(message);
        })
        .then(() => {
            const lastMessageContent = hasAttachments ? 
                (content || `📎 ${modalAttachments.length} attachment(s)`) : 
                content;
            
            return database.ref(`conversations/${conversationId}`).update({
                lastMessage: { 
                    content: lastMessageContent, 
                    senderId: currentUser.uid, 
                    timestamp: timestamp 
                }
            });
        })
        .then(() => {
            showToast('Conversation created successfully', 'success');
            modalAttachments = [];
            closeModal();
            setTimeout(() => selectConversation(conversationId), 500);
        })
        .catch(error => {
            console.error('❌ Error creating conversation:', error);
            showToast('Failed to create conversation', 'error');
        });
}

// =============================================
// Filter Functions
// =============================================

function filterConversations(searchTerm) {
    if (!searchTerm) {
        renderConversations();
        return;
    }
    
    const filtered = Object.values(conversations).filter(conv => {
        const otherUserId = Object.keys(conv.participants).find(id => id !== currentUser.uid);
        const otherUser = users[otherUserId] || patients[otherUserId] || {};
        
        return otherUser.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
               conv.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
               conv.lastMessage?.content?.toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    renderFilteredConversations(filtered);
}

function filterByType(type) {
    let filtered = Object.values(conversations);
    
    if (type === 'unread') {
        filtered = filtered.filter(conv => 
            conv.lastMessage?.senderId !== currentUser.uid && 
            (!conv.lastReadBy?.[currentUser.uid] || 
             conv.lastReadBy[currentUser.uid] < conv.lastMessage.timestamp)
        );
    } else if (type === 'patients') {
        filtered = filtered.filter(conv => {
            const otherUserId = Object.keys(conv.participants).find(id => id !== currentUser.uid);
            const otherUser = users[otherUserId] || patients[otherUserId];
            return otherUser?.role === 'patient';
        });
    } else if (type === 'doctors') {
        filtered = filtered.filter(conv => {
            const otherUserId = Object.keys(conv.participants).find(id => id !== currentUser.uid);
            return users[otherUserId]?.role === 'doctor';
        });
    }
    
    renderFilteredConversations(filtered);
}

function renderFilteredConversations(filtered) {
    if (!conversationsList) return;
    
    if (filtered.length === 0) {
        conversationsList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #888;">
                <i class="fas fa-search" style="font-size: 48px; margin-bottom: 20px; display: block; color: #f8bbc7;"></i>
                <h3 style="color: #d6455f; margin-bottom: 10px;">No results found</h3>
                <p style="font-size: 14px;">Try a different search term or filter</p>
            </div>
        `;
        return;
    }
    
    filtered.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
    
    conversationsList.innerHTML = filtered.map(conv => {
        const otherUserId = Object.keys(conv.participants).find(id => id !== currentUser.uid);
        const otherUser = users[otherUserId] || patients[otherUserId] || { name: 'Unknown', avatar: '??', isOnline: false };
        
        const isUnread = conv.lastMessage?.senderId !== currentUser.uid && 
                        (!conv.lastReadBy?.[currentUser.uid] || 
                         conv.lastReadBy[currentUser.uid] < conv.lastMessage.timestamp);
        
        return `
            <div class="conversation-item ${currentConversation === conv.id ? 'active' : ''}" 
                 onclick="selectConversation('${conv.id}')">
                <div class="conversation-avatar">
                    ${escapeHTML(otherUser.avatar)}
                    ${otherUser.isOnline ? '<div class="online-indicator"></div>' : ''}
                </div>
                <div class="conversation-info">
                    <div class="conversation-name">${escapeHTML(otherUser.name)}</div>
                    <div class="conversation-preview">
                        ${escapeHTML((conv.lastMessage?.content || 'No messages').substring(0, 50))}${(conv.lastMessage?.content || '').length > 50 ? '...' : ''}
                    </div>
                </div>
                <div class="conversation-meta">
                    <div class="conversation-time">${formatTimeAgo(conv.lastMessage?.timestamp)}</div>
                    ${isUnread ? '<div class="unread-badge">New</div>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

// =============================================
// Utility Functions
// =============================================

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function closeModal() {
    if (newMessageModal) {
        newMessageModal.style.display = 'none';
    }
    
    const form = document.getElementById('newMessageForm');
    if (form) {
        form.reset();
    }
    
    const charCount = document.getElementById('charCount');
    if (charCount) {
        charCount.textContent = '0/1000 characters';
    }
    
    // Clear file attachments
    modalAttachments = [];
    renderModalFilePreview();
    
    clearRecipientSelection();
    if (recipientSearchInput) {
        recipientSearchInput.value = '';
        recipientSearchInput.classList.remove('has-selection');
    }
    
    closeDropdown();
}

function goToDashboard() {
    if (document.referrer) {
        window.history.back();
    } else {
        window.location.href = 'Dashboard.html';
    }
}

function showToast(message, type = 'success') {
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 
                 'info-circle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${escapeHTML(message)}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

async function forceReloadPatients() {
    console.log('🔄 Force reloading patients...');
    
    try {
        const snapshot = await database.ref('patients').once('value');
        const data = snapshot.val() || {};
        
        patients = {};
        
        Object.keys(data).forEach(id => {
            const patient = data[id];
            
            const hasPatientId = patient && patient.patientId;
            const hasFullName = patient && patient.fullName;
            const hasName = patient && (patient.firstName || patient.lastName);
            
            if (patient && hasPatientId && (hasFullName || hasName)) {
                let fullName = patient.fullName;
                if (!fullName && patient.firstName && patient.lastName) {
                    fullName = `${patient.lastName}, ${patient.firstName}`;
                    if (patient.middleName) {
                        fullName += `, ${patient.middleName}`;
                    }
                }
                
                patients[id] = {
                    uid: id,
                    patientId: patient.patientId,
                    name: fullName,
                    email: patient.email || '',
                    role: 'patient',
                    avatar: getPatientInitials(fullName),
                    age: patient.age || 'N/A',
                    visitNumber: patient.visitNumber || '1'
                };
            }
        });
        
        patientsLoaded = true;
        console.log('✅ Patients reloaded:', Object.keys(patients).length);
        
        if (recipientSearchState.currentQuery) {
            populateRecipientDropdown();
        }
        
    } catch (error) {
        console.error('❌ Error force reloading patients:', error);
    }
}

// =============================================
// Cleanup on page unload
// =============================================
window.addEventListener('beforeunload', () => {
    if (currentUser && currentUser.uid) {
        database.ref(`users/${currentUser.uid}`).update({
            isOnline: false,
            lastSeen: Date.now()
        });
    }
    
    if (conversationListener) {
        database.ref('conversations').off('value', conversationListener);
    }
    if (usersListener) {
        database.ref('users').off('value', usersListener);
    }
    if (patientsListener) {
        database.ref('patients').off('value', patientsListener);
    }
    Object.keys(messageListeners).forEach(convId => {
        database.ref(`messages/${convId}`).off();
    });
});

// =============================================
// Export Functions for Global Access
// =============================================
window.selectConversation = selectConversation;
window.sendMessage = sendMessage;
window.goToDashboard = goToDashboard;
window.forceReloadPatients = forceReloadPatients;
window.removeFile = removeFile;

console.log('✅ PregnaCare Messages System Loaded Successfully');
console.log('💡 Try typing "PT" in the recipient field to search for patients!');
console.log('📎 File attachments feature enabled - send images, PDFs, and documents!');