// ==================== FIREBASE AUTHENTICATION ====================
// Complete Auth with Email/Password, Google Sign-in, Firestore Database

// ==================== FIREBASE CONFIGURATION ====================
const firebaseConfig = {
    apiKey: "AIzaSyDf4QSE3kw9HQD_ZWJ-DDZ8yN3hgRp4UaM",
    authDomain: "otp-auth-ff7fb.firebaseapp.com",
    projectId: "otp-auth-ff7fb",
    storageBucket: "otp-auth-ff7fb.firebasestorage.app",
    messagingSenderId: "945314024888",
    appId: "1:945314024888:web:1eb577611a4de09757934d",
    measurementId: "G-6HMXTKV0SQ"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Create Google Provider instance
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// ==================== FIRESTORE HELPERS ====================
async function saveUserToFirestore(user, provider, extraData = {}) {
    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();

    const baseData = {
        uid: user.uid,
        name: user.displayName || extraData.name || "User",
        email: user.email,
        photo: user.photoURL || "",
        role: "user",
        isNewUser: !snap.exists,
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!snap.exists) {
        // Create new user document
        await ref.set({
            ...baseData,
            providers: [provider],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            phone: extraData.phone || "",
            address: extraData.address || "",
            city: extraData.city || "",
            state: extraData.state || "",
            pincode: extraData.pincode || "",
            ...extraData
        });
        console.log("✅ New user created in Firestore");
    } else {
        // Update existing user
        const updateData = {
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            providers: firebase.firestore.FieldValue.arrayUnion(provider)
        };
        
        // Only update fields that have values
        if (extraData.name) updateData.name = extraData.name;
        if (extraData.phone) updateData.phone = extraData.phone;
        if (extraData.address) updateData.address = extraData.address;
        if (extraData.city) updateData.city = extraData.city;
        if (extraData.state) updateData.state = extraData.state;
        if (extraData.pincode) updateData.pincode = extraData.pincode;
        if (user.photoURL) updateData.photo = user.photoURL;
        
        await ref.update(updateData);
        console.log("✅ User updated in Firestore");
    }
    
    return snap.exists;
}

async function checkUserProfileComplete(uid) {
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    
    if (!snap.exists) return false;
    
    const data = snap.data();
    // Check if required fields are filled
    return !!(data.phone && data.address && data.city && data.pincode);
}

async function isPhoneAlreadyExists(phone, currentUid = null) {
    const snapshot = await db
        .collection("users")
        .where("phone", "==", phone)
        .get();

    if (snapshot.empty) return false;

    return snapshot.docs.some(doc => doc.id !== currentUid);
}

// ==================== STATE ====================
let pendingGoogleUser = null;
let redirectUrl = null;

// ==================== DOM HELPERS ====================
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Auth page loaded");
    
    // Get redirect URL from query params
    const params = new URLSearchParams(window.location.search);
    redirectUrl = params.get('redirect');
    
    // Bind events based on page
    if ($('loginForm')) {
        console.log("📝 Login page detected");
        bindLoginEvents();
    }
    
    if ($('signupForm')) {
        console.log("📝 Signup page detected");
        bindSignupEvents();
    }
    
    // Common events
    bindCommonEvents();
    
    // Check if user is already logged in
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("👤 User already logged in:", user.email);
        }
    });
});

// ==================== LOGIN EVENTS ====================
function bindLoginEvents() {
    $('loginForm')?.addEventListener('submit', handleLogin);
    
    // Google Login Button
    const googleBtn = $('googleLoginBtn');
    if (googleBtn) {
        googleBtn.addEventListener('click', handleGoogleAuth);
        console.log("✅ Google login button bound");
    } else {
        console.warn("⚠️ Google login button not found");
    }
    
    $('togglePassword')?.addEventListener('click', () => {
        togglePassword('password', 'togglePassword');
    });
    
    $('forgotPasswordLink')?.addEventListener('click', e => {
        e.preventDefault();
        $('forgotPasswordModal')?.classList.add('active');
    });
    
    $('closeForgotModal')?.addEventListener('click', () => {
        $('forgotPasswordModal')?.classList.remove('active');
    });
    
    $('forgotPasswordForm')?.addEventListener('submit', handleForgotPassword);
    $('completeProfileForm')?.addEventListener('submit', handleCompleteProfile);
}

// ==================== SIGNUP EVENTS ====================
function bindSignupEvents() {
    $('signupForm')?.addEventListener('submit', handleSignup);
    
    // Google Signup Button
    const googleBtn = $('googleSignupBtn');
    if (googleBtn) {
        googleBtn.addEventListener('click', handleGoogleAuth);
        console.log("✅ Google signup button bound");
    } else {
        console.warn("⚠️ Google signup button not found");
    }
    
    $$('.toggle-password').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.dataset.target;
            togglePassword(targetId, null, this);
        });
    });
    
    $('password')?.addEventListener('input', checkPasswordStrength);
    
    $('phone')?.addEventListener('input', e => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
    });
    
    $('pincode')?.addEventListener('input', e => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });
    
    $('completeProfileForm')?.addEventListener('submit', handleCompleteProfile);
}

// ==================== COMMON EVENTS ====================
function bindCommonEvents() {
    $$('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal && modal.id !== 'completeProfileModal') {
                modal.classList.remove('active');
            }
        });
    });
    
    $('profilePhone')?.addEventListener('input', e => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
    });
    
    $('profilePincode')?.addEventListener('input', e => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });
    
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            $('forgotPasswordModal')?.classList.remove('active');
        }
    });
}

// ==================== EMAIL/PASSWORD LOGIN ====================
async function handleLogin(e) {
    e.preventDefault();
    
    const email = $('email')?.value.trim();
    const password = $('password')?.value;
    const rememberMe = $('rememberMe')?.checked;
    
    if (!email || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }
    
    showLoading('Logging in...');
    
    try {
        const persistence = rememberMe 
            ? firebase.auth.Auth.Persistence.LOCAL 
            : firebase.auth.Auth.Persistence.SESSION;
        
        await auth.setPersistence(persistence);
        
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await saveUserToFirestore(user, "password");
        
        hideLoading();
        toast('Login successful!', 'success');
        
        setTimeout(() => handleRedirect(), 1000);
        
    } catch (error) {
        hideLoading();
        handleAuthError(error);
    }
}

// ==================== EMAIL/PASSWORD SIGNUP ====================
async function handleSignup(e) {
    e.preventDefault();
    
    const fullName = $('fullName')?.value.trim();
    const email = $('email')?.value.trim();
    const phone = $('phone')?.value.trim();
    const password = $('password')?.value;
    const confirmPassword = $('confirmPassword')?.value;
    const address = $('address')?.value.trim();
    const city = $('city')?.value.trim();
    const state = $('state')?.value.trim();
    const pincode = $('pincode')?.value.trim();
    const termsChecked = $('termsCheck')?.checked;
    
    // Validation
    if (!fullName || !email || !phone || !password || !address || !city || !pincode) {
        showMessage('Please fill in all required fields', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }
    
    if (phone.length !== 10) {
        showMessage('Please enter a valid 10-digit phone number', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }
    
    if (pincode.length !== 6) {
        showMessage('Please enter a valid 6-digit pincode', 'error');
        return;
    }
    
    if (!termsChecked) {
        showMessage('Please accept the Terms of Service', 'error');
        return;
    }
    
    showLoading('Creating your account...');

    try {
        // Check if phone already exists first
        const phoneExists = await isPhoneAlreadyExists(phone);
        if (phoneExists) {
            hideLoading();
            showMessage("This phone number is already registered.", "error");
            return;
        }

        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await user.updateProfile({ displayName: fullName });
        
        await saveUserToFirestore(user, "password", {
            name: fullName,
            phone,
            address,
            city,
            state,
            pincode
        });
        
        hideLoading();
        toast('Account created successfully!', 'success');
        
        setTimeout(() => handleRedirect(), 1500);
        
    } catch (error) {
        hideLoading();
        handleAuthError(error);
    }
}

// ==================== GOOGLE AUTHENTICATION ====================
async function handleGoogleAuth() {
    console.log("🔵 Google Auth started");
    showLoading('Connecting to Google...');
    
    try {
        // Use popup for Google Sign-In
        const result = await auth.signInWithPopup(googleProvider);
        
        console.log("✅ Google sign-in successful");
        
        const user = result.user;
        const isNewUser = result.additionalUserInfo?.isNewUser;

        console.log("👤 User:", user.email, "| New User:", isNewUser);

        if (isNewUser) {
            // New user - show complete profile modal
            pendingGoogleUser = user;
            hideLoading();
            showCompleteProfileModal(user);
        } else {
            // Existing user - check if profile is complete
            const profileComplete = await checkUserProfileComplete(user.uid);
            
            if (!profileComplete) {
                // Profile incomplete - show modal
                pendingGoogleUser = user;
                hideLoading();
                showCompleteProfileModal(user);
            } else {
                // Profile complete - just update lastLogin
                await saveUserToFirestore(user, "google");
                hideLoading();
                toast('Login successful!', 'success');
                setTimeout(handleRedirect, 1000);
            }
        }

    } catch (error) {
        hideLoading();
        console.error("❌ Google Auth Error:", error);
        
        // Handle specific errors
        if (error.code === 'auth/account-exists-with-different-credential') {
            await handleAccountLinking(error);
        } else if (error.code === 'auth/popup-closed-by-user') {
            toast('Sign-in cancelled', 'warning');
        } else if (error.code === 'auth/popup-blocked') {
            toast('Popup blocked! Please allow popups for this site.', 'error');
            // Try redirect method as fallback
            tryRedirectAuth();
        } else {
            handleAuthError(error);
        }
    }
}

// Fallback to redirect if popup is blocked
async function tryRedirectAuth() {
    try {
        await auth.signInWithRedirect(googleProvider);
    } catch (error) {
        handleAuthError(error);
    }
}

// Handle redirect result (for when popup is blocked)
auth.getRedirectResult().then(async result => {
    if (result.user) {
        console.log("✅ Redirect sign-in successful");
        const user = result.user;
        const isNewUser = result.additionalUserInfo?.isNewUser;
        
        if (isNewUser) {
            pendingGoogleUser = user;
            showCompleteProfileModal(user);
        } else {
            const profileComplete = await checkUserProfileComplete(user.uid);
            
            if (!profileComplete) {
                pendingGoogleUser = user;
                showCompleteProfileModal(user);
            } else {
                await saveUserToFirestore(user, "google");
                toast('Login successful!', 'success');
                setTimeout(handleRedirect, 1000);
            }
        }
    }
}).catch(error => {
    if (error.code) {
        console.error("Redirect error:", error);
    }
});

// Handle account linking when email exists with different provider
async function handleAccountLinking(error) {
    const email = error.customData?.email || error.email;
    const pendingCred = firebase.auth.GoogleAuthProvider.credentialFromError(error);

    if (!pendingCred) {
        toast('Unable to link accounts. Please try a different method.', 'error');
        return;
    }

    const password = prompt(
        `The email "${email}" is already registered with password.\n\nEnter your password to link your Google account:`
    );

    if (!password) {
        toast('Account linking cancelled', 'warning');
        return;
    }

    try {
        showLoading('Linking accounts...');
        const userCred = await auth.signInWithEmailAndPassword(email, password);
        await userCred.user.linkWithCredential(pendingCred);
        await saveUserToFirestore(userCred.user, "google");

        hideLoading();
        toast('Google account linked successfully!', 'success');
        setTimeout(handleRedirect, 1000);
    } catch (linkError) {
        hideLoading();
        handleAuthError(linkError);
    }
}

// ==================== COMPLETE PROFILE (Google Users) ====================
function showCompleteProfileModal(user) {
    console.log("📋 Showing complete profile modal");
    
    const modal = $('completeProfileModal');
    const photo = $('googleUserPhoto');
    const name = $('googleUserName');
    
    if (photo) {
        photo.src = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'User') + '&background=4CAF50&color=fff&size=80';
    }
    if (name) {
        name.textContent = `Welcome, ${user.displayName || 'User'}!`;
    }
    
    if (modal) {
        modal.classList.add('active');
    } else {
        console.error("❌ Complete profile modal not found!");
    }
}

async function handleCompleteProfile(e) {
    e.preventDefault();
    console.log("📝 Completing profile...");
    
    if (!pendingGoogleUser) {
        showMessage('Session expired. Please try again.', 'error');
        setTimeout(() => window.location.reload(), 1500);
        return;
    }
    
    const phone = $('profilePhone')?.value.trim();
    const address = $('profileAddress')?.value.trim();
    const city = $('profileCity')?.value.trim();
    const pincode = $('profilePincode')?.value.trim();
    const state = $('profileState')?.value.trim();
    
    // Validation
    if (!phone || phone.length !== 10) {
        toast('Please enter a valid 10-digit phone number', 'error');
        return;
    }
    
    if (!address) {
        toast('Please enter your address', 'error');
        return;
    }
    
    if (!city) {
        toast('Please enter your city', 'error');
        return;
    }
    
    if (!pincode || pincode.length !== 6) {
        toast('Please enter a valid 6-digit pincode', 'error');
        return;
    }
    
    showLoading('Saving your profile...');

    try {
        // Check if phone already exists
        const phoneExists = await isPhoneAlreadyExists(phone, pendingGoogleUser.uid);
        if (phoneExists) {
            hideLoading();
            toast("This phone number is already registered.", "error");
            return;
        }

        await saveUserToFirestore(pendingGoogleUser, "google", {
            name: pendingGoogleUser.displayName || "User",
            phone,
            address,
            city,
            state,
            pincode
        });
        
        pendingGoogleUser = null;
        $('completeProfileModal')?.classList.remove('active');
        
        hideLoading();
        toast('Profile completed successfully!', 'success');
        
        setTimeout(() => handleRedirect(), 1000);
        
    } catch (error) {
        hideLoading();
        console.error('Profile completion error:', error);
        toast('Failed to save profile. Please try again.', 'error');
    }
}

// ==================== FORGOT PASSWORD ====================
async function handleForgotPassword(e) {
    e.preventDefault();
    
    const email = $('resetEmail')?.value.trim();
    
    if (!email || !validateEmail(email)) {
        toast('Please enter a valid email address', 'error');
        return;
    }
    
    showLoading('Sending reset link...');
    
    try {
        await auth.sendPasswordResetEmail(email);
        
        hideLoading();
        $('forgotPasswordModal')?.classList.remove('active');
        toast('Password reset link sent to your email!', 'success');
        
    } catch (error) {
        hideLoading();
        handleAuthError(error);
    }
}

// ==================== UTILITIES ====================
function validateEmail(email) {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
}

function togglePassword(inputId, buttonId, buttonEl) {
    const input = $(inputId);
    const button = buttonId ? $(buttonId) : buttonEl;
    
    if (!input) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        button?.querySelector('i')?.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        button?.querySelector('i')?.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function checkPasswordStrength() {
    const password = $('password')?.value;
    const strengthEl = $('passwordStrength');
    const fillEl = $('strengthFill');
    const textEl = $('strengthText');
    
    if (!strengthEl || !fillEl || !textEl) return;
    
    if (!password) {
        strengthEl.classList.add('hidden');
        return;
    }
    
    strengthEl.classList.remove('hidden');
    
    let strength = 0;
    let label = 'Weak';
    
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    if (strength <= 2) {
        label = 'Weak';
        fillEl.className = 'strength-fill weak';
        textEl.className = 'strength-text weak';
    } else if (strength === 3) {
        label = 'Fair';
        fillEl.className = 'strength-fill fair';
        textEl.className = 'strength-text fair';
    } else if (strength === 4) {
        label = 'Good';
        fillEl.className = 'strength-fill good';
        textEl.className = 'strength-text good';
    } else {
        label = 'Strong';
        fillEl.className = 'strength-fill strong';
        textEl.className = 'strength-text strong';
    }
    
    textEl.textContent = label;
}

function handleAuthError(error) {
    console.error('Auth error:', error);
    
    let message = 'An error occurred. Please try again.';
    
    switch (error.code) {
        case 'auth/email-already-in-use':
            message = 'This email is already registered. Please login.';
            break;
        case 'auth/invalid-email':
            message = 'Invalid email address.';
            break;
        case 'auth/weak-password':
            message = 'Password is too weak. Use at least 6 characters.';
            break;
        case 'auth/user-not-found':
            message = 'No account found with this email.';
            break;
        case 'auth/wrong-password':
            message = 'Incorrect password. Please try again.';
            break;
        case 'auth/invalid-credential':
            message = 'Invalid email or password. Please try again.';
            break;
        case 'auth/too-many-requests':
            message = 'Too many attempts. Please try again later.';
            break;
        case 'auth/popup-closed-by-user':
            message = 'Sign-in cancelled. Please try again.';
            break;
        case 'auth/popup-blocked':
            message = 'Popup blocked! Please allow popups for this site.';
            break;
        case 'auth/network-request-failed':
            message = 'Network error. Check your connection.';
            break;
        case 'auth/operation-not-allowed':
            message = 'Google sign-in is not enabled. Please contact support.';
            break;
        case 'auth/unauthorized-domain':
            message = 'This domain is not authorized. Please contact support.';
            break;
    }
    
    showMessage(message, 'error');
}

function handleRedirect() {
    if (redirectUrl === 'cart') {
        window.location.href = 'cart.html';
    } else {
        window.location.href = 'index.html';
    }
}

// ==================== UI HELPERS ====================
function showMessage(text, type) {
    const messageEl = $('authMessage');
    const textEl = $('messageText');
    
    if (!messageEl || !textEl) {
        toast(text, type);
        return;
    }
    
    textEl.textContent = text;
    messageEl.className = `auth-message ${type}`;
    messageEl.classList.remove('hidden');
    
    if (type === 'error') {
        setTimeout(() => messageEl.classList.add('hidden'), 5000);
    }
}

function toast(msg, type = 'success') {
    const toastEl = $('toast');
    const msgEl = $('toastMsg');
    const iconEl = $('toastIcon');
    
    if (!toastEl) {
        console.log(`${type.toUpperCase()}: ${msg}`);
        return;
    }
    
    if (msgEl) msgEl.textContent = msg;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    
    if (iconEl) iconEl.className = `fas ${icons[type] || icons.success}`;
    
    toastEl.className = `toast ${type} show`;
    
    setTimeout(() => toastEl.classList.remove('show'), 4000);
}

function showLoading(text = 'Please wait...') {
    const loadingEl = $('loading');
    const textEl = $('loadingText');
    
    if (textEl) textEl.textContent = text;
    if (loadingEl) loadingEl.classList.remove('hidden');
}

function hideLoading() {
    const loadingEl = $('loading');
    if (loadingEl) loadingEl.classList.add('hidden');
}

// ==================== EXPORTS ====================
window.handleGoogleAuth = handleGoogleAuth;
window.handleCompleteProfile = handleCompleteProfile;

// ==================== CONSOLE ====================
console.log('%c🔐 FreshMart Auth Ready!', 'color:#2e7d32;font-size:16px;font-weight:bold');
console.log('%c📱 Firebase Auth + Firestore Enabled', 'color:#666');
console.log('%c🔵 Google Sign-In: Ready', 'color:#4285f4');