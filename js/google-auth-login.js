// ==================== GOOGLE AUTHENTICATION FIXED VERSION ====================
// Simplified implementation to work alongside existing auth.js

// Wait for Firebase to be available
let googleAuthReady = false;
let googleAuthInstance = null;
let googleDbInstance = null;

// Debug flag
const DEBUG_MODE = true;

function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log('[GoogleAuth]', ...args);
    }
}

// Initialize Google Auth
function initGoogleAuth() {
    debugLog('Initializing Google Auth...');
    
    // Check if Firebase is available
    if (typeof firebase === 'undefined') {
        debugLog('❌ Firebase not loaded yet, retrying...');
        setTimeout(initGoogleAuth, 100);
        return;
    }
    
    // Check if auth and firestore are available
    if (!firebase.auth || !firebase.firestore) {
        debugLog('❌ Firebase auth/firestore not available, retrying...');
        setTimeout(initGoogleAuth, 100);
        return;
    }
    
    try {
        // Get auth instance (use the global one if available)
        if (window.auth && typeof window.auth.signInWithPopup === 'function') {
            googleAuthInstance = window.auth;
            debugLog('✅ Using existing auth instance');
        } else {
            googleAuthInstance = firebase.auth();
            debugLog('✅ Created new auth instance');
        }
        
        // Get firestore instance
        if (window.db && typeof window.db.collection === 'function') {
            googleDbInstance = window.db;
            debugLog('✅ Using existing db instance');
        } else {
            googleDbInstance = firebase.firestore();
            debugLog('✅ Created new db instance');
        }
        
        googleAuthReady = true;
        debugLog('✅ Google Auth ready!');
        
        // Bind events
        bindGoogleSignInButtons();
        
        // Check auth state
        checkGoogleAuthState();
        
    } catch (error) {
        debugLog('❌ Initialization error:', error);
        setTimeout(initGoogleAuth, 500);
    }
}

// Bind Google sign-in buttons
function bindGoogleSignInButtons() {
    debugLog('Binding Google sign-in buttons...');
    
    // List of possible selectors
    const selectors = [
        '.google-signin-btn',
        '.google-login-btn',
        '#googleLoginBtn',
        '#googleSignInBtn',
        '#googleSignupBtn',
        '[data-google-signin]',
        'button[onclick*="Google"]'
    ];
    
    let buttonsFound = 0;
    
    selectors.forEach(selector => {
        const buttons = document.querySelectorAll(selector);
        buttons.forEach(button => {
            // Remove any existing onclick
            button.onclick = null;
            button.removeAttribute('onclick');
            
            // Add new click handler
            button.addEventListener('click', handleGoogleSignInClick, true);
            buttonsFound++;
            debugLog(`✅ Bound to: ${selector}`);
        });
    });
    
    if (buttonsFound === 0) {
        debugLog('⚠️ No Google sign-in buttons found');
        // Retry after DOM updates
        setTimeout(bindGoogleSignInButtons, 1000);
    } else {
        debugLog(`✅ Bound ${buttonsFound} buttons`);
    }
}

// Handle Google sign-in button click
function handleGoogleSignInClick(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    debugLog('🔷 Google sign-in button clicked');
    performGoogleSignIn();
}

// Perform Google sign-in
async function performGoogleSignIn() {
    debugLog('Starting Google sign-in process...');
    
    if (!googleAuthReady || !googleAuthInstance) {
        showToast('Authentication not ready. Please try again.', 'error');
        return;
    }
    
    showGoogleLoading('Connecting to Google...');
    
    try {
        // Create a NEW provider instance each time
        const provider = new firebase.auth.GoogleAuthProvider();
        
        // Configure provider
        provider.addScope('profile');
        provider.addScope('email');
        provider.setCustomParameters({
            'prompt': 'select_account',
            'login_hint': ''
        });
        
        debugLog('Provider configured, attempting popup...');
        
        // Clear any pending operations
        if (googleAuthInstance.currentUser) {
            debugLog('Current user exists:', googleAuthInstance.currentUser.email);
        }
        
        // Sign in with popup
        const result = await googleAuthInstance.signInWithPopup(provider);
        
        debugLog('✅ Popup sign-in successful!');
        
        const user = result.user;
        const credential = result.credential;
        const additionalUserInfo = result.additionalUserInfo;
        
        debugLog('User details:', {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            isNewUser: additionalUserInfo.isNewUser
        });
        
        // Handle successful sign-in
        await handleGoogleSignInSuccess(user, additionalUserInfo);
        
    } catch (error) {
        debugLog('❌ Sign-in error:', error);
        hideGoogleLoading();
        handleGoogleAuthError(error);
    }
}

// Handle successful Google sign-in
async function handleGoogleSignInSuccess(user, additionalUserInfo) {
    try {
        // Check if user exists in Firestore
        const userDocRef = googleDbInstance.collection('users').doc(user.uid);
        const userDoc = await userDocRef.get();
        
        debugLog('User doc exists:', userDoc.exists);
        
        if (!userDoc.exists || !userDoc.data()?.phone) {
            // New user or incomplete profile
            debugLog('📝 Profile incomplete, showing form...');
            hideGoogleLoading();
            showGoogleProfileForm(user);
        } else {
            // Existing user - update last login
            await userDocRef.update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            hideGoogleLoading();
            showToast('Login successful!', 'success');
            
            // Redirect after delay
            setTimeout(() => {
                redirectAfterGoogleLogin();
            }, 1000);
        }
        
    } catch (error) {
        debugLog('❌ Post-signin error:', error);
        hideGoogleLoading();
        
        // If Firestore fails, still consider login successful
        if (error.code === 'permission-denied') {
            showToast('Logged in, but profile access denied', 'warning');
            setTimeout(redirectAfterGoogleLogin, 1000);
        } else {
            showToast('Login successful, but profile update failed', 'warning');
            setTimeout(redirectAfterGoogleLogin, 1000);
        }
    }
}

// Show Google profile completion form
function showGoogleProfileForm(user) {
    debugLog('Showing profile form for:', user.email);
    
    // Store user for form submission
    window.googlePendingUser = user;
    
    // Create form HTML
    const formHTML = `
        <div id="googleProfileModal" class="google-modal active">
            <div class="google-modal-content">
                <h2>Complete Your Profile</h2>
                
                <div class="google-user-info">
                    <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'User')}" alt="Profile">
                    <div>
                        <div class="user-name">${user.displayName || 'Welcome!'}</div>
                        <div class="user-email">${user.email}</div>
                    </div>
                </div>
                
                <form id="googleProfileCompleteForm">
                    <div class="form-group">
                        <label>Phone Number *</label>
                        <input type="tel" id="g_phone" maxlength="10" required placeholder="10-digit mobile number">
                    </div>
                    
                    <div class="form-group">
                        <label>Address *</label>
                        <textarea id="g_address" required placeholder="Complete address"></textarea>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>City *</label>
                            <input type="text" id="g_city" required placeholder="City">
                        </div>
                        <div class="form-group">
                            <label>Pincode *</label>
                            <input type="text" id="g_pincode" maxlength="6" required placeholder="6-digit pincode">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>State</label>
                        <input type="text" id="g_state" placeholder="State (Optional)">
                    </div>
                    
                    <button type="submit" class="btn-submit">Complete Profile</button>
                </form>
            </div>
        </div>
    `;
    
    // Add to body
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = formHTML;
    document.body.appendChild(modalContainer);
    
    // Add styles
    addGoogleModalStyles();
    
    // Bind form events
    const form = document.getElementById('googleProfileCompleteForm');
    form.addEventListener('submit', handleGoogleProfileSubmit);
    
    // Format inputs
    document.getElementById('g_phone').addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
    });
    
    document.getElementById('g_pincode').addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
    });
}

// Handle Google profile form submission
async function handleGoogleProfileSubmit(event) {
    event.preventDefault();
    
    debugLog('Submitting profile form...');
    
    const user = window.googlePendingUser;
    if (!user) {
        showToast('Session expired. Please sign in again.', 'error');
        return;
    }
    
    const phone = document.getElementById('g_phone').value.trim();
    const address = document.getElementById('g_address').value.trim();
    const city = document.getElementById('g_city').value.trim();
    const pincode = document.getElementById('g_pincode').value.trim();
    const state = document.getElementById('g_state').value.trim();
    
    // Validate
    if (phone.length !== 10) {
        showToast('Please enter a valid 10-digit phone number', 'error');
        return;
    }
    
    if (pincode.length !== 6) {
        showToast('Please enter a valid 6-digit pincode', 'error');
        return;
    }
    
    showGoogleLoading('Saving profile...');
    
    try {
        // Save to Firestore
        await googleDbInstance.collection('users').doc(user.uid).set({
            uid: user.uid,
            name: user.displayName || '',
            email: user.email,
            photo: user.photoURL || '',
            phone: phone,
            address: address,
            city: city,
            state: state || '',
            pincode: pincode,
            role: 'user',
            providers: ['google'],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        debugLog('✅ Profile saved successfully');
        
        // Remove modal
        document.getElementById('googleProfileModal').remove();
        
        hideGoogleLoading();
        showToast('Profile completed successfully!', 'success');
        
        // Clear pending user
        window.googlePendingUser = null;
        
        // Redirect
        setTimeout(redirectAfterGoogleLogin, 1000);
        
    } catch (error) {
        debugLog('❌ Profile save error:', error);
        hideGoogleLoading();
        showToast('Failed to save profile. Please try again.', 'error');
    }
}

// Check auth state
function checkGoogleAuthState() {
    if (!googleAuthInstance) return;
    
    googleAuthInstance.onAuthStateChanged((user) => {
        if (user) {
            debugLog('Auth state: User signed in -', user.email);
            // Auto-fill profile if on profile page
            if (window.location.pathname.includes('profile')) {
                autoFillGoogleProfile(user);
            }
        } else {
            debugLog('Auth state: No user signed in');
        }
    });
}

// Auto-fill profile
async function autoFillGoogleProfile(user) {
    try {
        const userDoc = await googleDbInstance.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            // Fill fields if they exist
            const fillField = (id, value) => {
                const field = document.getElementById(id);
                if (field && value) field.value = value;
            };
            
            fillField('profileName', userData.name);
            fillField('profileEmail', userData.email);
            fillField('profilePhone', userData.phone);
            fillField('profileAddress', userData.address);
            fillField('profileCity', userData.city);
            fillField('profileState', userData.state);
            fillField('profilePincode', userData.pincode);
            
            debugLog('✅ Profile auto-filled');
        }
    } catch (error) {
        debugLog('❌ Auto-fill error:', error);
    }
}

// Handle Google auth errors
function handleGoogleAuthError(error) {
    let message = 'Sign-in failed. Please try again.';
    
    switch (error.code) {
        case 'auth/popup-closed-by-user':
            message = 'Sign-in cancelled';
            break;
        case 'auth/popup-blocked':
            message = 'Popup blocked. Please allow popups for this site.';
            break;
        case 'auth/network-request-failed':
            message = 'Network error. Check your connection.';
            break;
        case 'auth/too-many-requests':
            message = 'Too many attempts. Please try again later.';
            break;
        case 'auth/argument-error':
            message = 'Configuration error. Please refresh and try again.';
            // Try to clear any stale auth state
            if (googleAuthInstance && googleAuthInstance.signOut) {
                googleAuthInstance.signOut();
            }
            break;
        case 'auth/operation-not-allowed':
            message = 'Google sign-in is not enabled.';
            break;
        case 'auth/internal-error':
            message = 'Internal error. Please try again.';
            break;
    }
    
    showToast(message, 'error');
}

// Redirect after Google login
function redirectAfterGoogleLogin() {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    
    if (redirect === 'cart') {
        window.location.href = 'cart.html';
    } else if (redirect === 'checkout') {
        window.location.href = 'checkout.html';
    } else {
        window.location.href = 'index.html';
    }
}

// UI Helper Functions
function showGoogleLoading(text) {
    hideGoogleLoading(); // Remove any existing
    
    const loader = document.createElement('div');
    loader.id = 'googleLoader';
    loader.innerHTML = `
        <div class="loader-content">
            <div class="spinner"></div>
            <p>${text}</p>
        </div>
    `;
    document.body.appendChild(loader);
    
    // Add styles if not exist
    if (!document.getElementById('googleLoaderStyles')) {
        const style = document.createElement('style');
        style.id = 'googleLoaderStyles';
        style.textContent = `
            #googleLoader {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
            }
            #googleLoader .loader-content {
                text-align: center;
                color: white;
            }
            #googleLoader .spinner {
                width: 50px;
                height: 50px;
                border: 4px solid #fff3;
                border-top-color: #fff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

function hideGoogleLoading() {
    const loader = document.getElementById('googleLoader');
    if (loader) loader.remove();
}

function showToast(message, type = 'info') {
    debugLog(`Toast (${type}): ${message}`);
    
    // Remove existing toast
    const existing = document.querySelector('.google-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `google-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Add styles if not exist
    if (!document.getElementById('googleToastStyles')) {
        const style = document.createElement('style');
        style.id = 'googleToastStyles';
        style.textContent = `
            .google-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-size: 14px;
                z-index: 100000;
                animation: slideIn 0.3s ease;
            }
            .google-toast.success { background: #4CAF50; }
            .google-toast.error { background: #f44336; }
            .google-toast.warning { background: #ff9800; }
            .google-toast.info { background: #2196F3; }
            @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Auto remove
    setTimeout(() => toast.remove(), 4000);
}

function addGoogleModalStyles() {
    if (document.getElementById('googleModalStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'googleModalStyles';
    style.textContent = `
        .google-modal {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            padding: 20px;
        }
        .google-modal.active {
            display: flex;
        }
        .google-modal-content {
            background: white;
            border-radius: 12px;
            padding: 30px;
            width: 100%;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
        }
        .google-modal h2 {
            margin: 0 0 20px 0;
            color: #333;
        }
        .google-user-info {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .google-user-info img {
            width: 50px;
            height: 50px;
            border-radius: 50%;
        }
        .google-user-info .user-name {
            font-weight: 600;
            color: #333;
        }
        .google-user-info .user-email {
            color: #666;
            font-size: 14px;
        }
        .google-modal .form-group {
            margin-bottom: 15px;
        }
        .google-modal label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: #555;
        }
        .google-modal input,
        .google-modal textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
        }
        .google-modal .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        .google-modal .btn-submit {
            width: 100%;
            padding: 12px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 10px;
        }
        .google-modal .btn-submit:hover {
            background: #45a049;
        }
    `;
    document.head.appendChild(style);
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGoogleAuth);
} else {
    initGoogleAuth();
}

// Re-bind buttons on DOM changes
const observer = new MutationObserver(() => {
    if (googleAuthReady) {
        bindGoogleSignInButtons();
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Export for debugging
window.googleAuthDebug = {
    status: () => ({
        ready: googleAuthReady,
        authInstance: !!googleAuthInstance,
        dbInstance: !!googleDbInstance,
        currentUser: googleAuthInstance?.currentUser
    }),
    signIn: performGoogleSignIn,
    signOut: () => googleAuthInstance?.signOut()
};

console.log('🔷 Google Auth Fixed Module Loaded');
console.log('Debug with: googleAuthDebug.status()');
