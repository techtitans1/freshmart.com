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

// ==================== ENHANCED SAVE USER TO FIRESTORE ====================
async function saveUserToFirestore(user, provider, extraData = {}) {
    try {
        const userRef = db.collection("users").doc(user.uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            // NEW USER - Create complete profile
            const newUserData = {
                // Basic info
                uid: user.uid,
                email: user.email || "",
                emailVerified: user.emailVerified || false,
                
                // Profile info
                name: extraData.name || user.displayName || "",
                phone: extraData.phone || "",
                photoURL: extraData.photoURL || user.photoURL || "",
                
                // Address info
                address: extraData.address || "",
                city: extraData.city || "",
                state: extraData.state || "",
                pincode: extraData.pincode || "",
                
                // Meta info
                provider: provider,
                providers: [provider],
                role: "user",
                profileComplete: !!(extraData.phone && extraData.address && extraData.city && extraData.pincode),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await userRef.set(newUserData);
            console.log("✅ New user profile created with all details");
            return newUserData;
            
        } else {
            // EXISTING USER - Update login info
            const existingData = userDoc.data();
            const updateData = {
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Add provider if new
            if (!existingData.providers?.includes(provider)) {
                updateData.providers = firebase.firestore.FieldValue.arrayUnion(provider);
            }
            
            // Update any new data provided
            Object.keys(extraData).forEach(key => {
                if (extraData[key] && extraData[key] !== existingData[key]) {
                    updateData[key] = extraData[key];
                }
            });
            
            // Check if profile is now complete
            const isComplete = !!(
                (existingData.phone || extraData.phone) &&
                (existingData.address || extraData.address) &&
                (existingData.city || extraData.city) &&
                (existingData.pincode || extraData.pincode)
            );
            updateData.profileComplete = isComplete;
            
            await userRef.update(updateData);
            console.log("✅ User profile updated");
            
            return { ...existingData, ...updateData };
        }
    } catch (error) {
        console.error("❌ Error saving user to Firestore:", error);
        throw error;
    }
}

// ==================== PROFILE DATA FUNCTIONS ====================

/**
 * Get current user's profile data from Firestore
 */
async function getCurrentUserProfile() {
    const user = auth.currentUser;
    if (!user) return null;
    
    try {
        const userDoc = await db.collection("users").doc(user.uid).get();
        if (userDoc.exists) {
            return {
                authUser: user,
                profileData: userDoc.data()
            };
        }
        return null;
    } catch (error) {
        console.error("❌ Error getting profile:", error);
        return null;
    }
}

/**
 * Update user profile in Firestore
 */
async function updateUserProfile(uid, updates) {
    try {
        const userRef = db.collection("users").doc(uid);
        
        // Check if profile is complete after updates
        const userDoc = await userRef.get();
        const currentData = userDoc.data() || {};
        const mergedData = { ...currentData, ...updates };
        
        const profileComplete = !!(
            mergedData.phone &&
            mergedData.address &&
            mergedData.city &&
            mergedData.pincode
        );
        
        await userRef.update({
            ...updates,
            profileComplete: profileComplete,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log("✅ Profile updated successfully");
        return true;
    } catch (error) {
        console.error("❌ Error updating profile:", error);
        throw error;
    }
}

/**
 * Check if phone number already exists
 */
async function isPhoneAlreadyExists(phone, currentUid = null) {
    if (!phone) return false;
    
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
    // Get redirect URL from query params
    const params = new URLSearchParams(window.location.search);
    redirectUrl = params.get('redirect');
    
    // Bind events based on page
    if ($('loginForm')) {
        bindLoginEvents();
    }
    
    if ($('signupForm')) {
        bindSignupEvents();
    }
    
    // Common events
    bindCommonEvents();
});

// ==================== LOGIN EVENTS ====================
function bindLoginEvents() {
    $('loginForm')?.addEventListener('submit', handleLogin);
    $('googleLoginBtn')?.addEventListener('click', handleGoogleAuth);
    
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
    $('googleSignupBtn')?.addEventListener('click', handleGoogleAuth);
    
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
        
        // Ensure user data exists in Firestore
        await saveUserToFirestore(user, "password");
        
        // Check if profile is complete
        const userDoc = await db.collection("users").doc(user.uid).get();
        const userData = userDoc.data();
        
        hideLoading();
        
        if (userData && !userData.profileComplete) {
            // Profile incomplete - show complete profile modal
            pendingGoogleUser = user;
            showCompleteProfileModal(user);
        } else {
            toast('Login successful!', 'success');
            setTimeout(() => handleRedirect(), 1000);
        }
        
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
        // Check phone uniqueness before creating account
        const phoneExists = await isPhoneAlreadyExists(phone);
        if (phoneExists) {
            hideLoading();
            showMessage("This phone number is already registered.", "error");
            return;
        }
        
        // Create auth account
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update display name
        await user.updateProfile({ displayName: fullName });
        
        // Save complete profile to Firestore
        await saveUserToFirestore(user, "password", {
            name: fullName,
            phone: phone,
            address: address,
            city: city,
            state: state || "",
            pincode: pincode
        });
        
        // Send verification email (optional)
        try {
            await user.sendEmailVerification();
            console.log("Verification email sent");
        } catch (err) {
            console.log("Could not send verification email:", err);
        }
        
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
    console.log("🔵 Starting Google Sign-In...");
    showLoading('Connecting to Google...');
    
    try {
        // Create Google provider
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        
        // Sign in with popup
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        const isNewUser = result.additionalUserInfo?.isNewUser;
        
        console.log("✅ Google sign-in successful:", user.email);
        
        // Check if user exists in Firestore
        const userRef = db.collection("users").doc(user.uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists || isNewUser) {
            // NEW USER - Create profile in Firestore
            await userRef.set({
                uid: user.uid,
                email: user.email || "",
                emailVerified: true,
                name: user.displayName || "",
                photoURL: user.photoURL || "",
                phone: "",
                address: "",
                city: "",
                state: "",
                pincode: "",
                provider: "google",
                providers: ["google"],
                role: "user",
                profileComplete: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log("✅ New Google user saved to Firestore");
            
            // Show complete profile modal
            pendingGoogleUser = user;
            hideLoading();
            showCompleteProfileModal(user);
            
        } else {
            // EXISTING USER
            const userData = userDoc.data();
            
            // Update last login and providers
            await userRef.update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                providers: firebase.firestore.FieldValue.arrayUnion("google"),
                photoURL: user.photoURL || userData.photoURL || "",
                name: user.displayName || userData.name || ""
            });
            
            hideLoading();
            
            // Check if profile is complete
            if (!userData.profileComplete || !userData.phone || !userData.address) {
                // Profile incomplete - show modal
                pendingGoogleUser = user;
                showCompleteProfileModal(user);
            } else {
                // Profile complete - redirect
                toast('Login successful!', 'success');
                setTimeout(() => handleRedirect(), 1000);
            }
        }
        
    } catch (error) {
        hideLoading();
        console.error("❌ Google Auth Error:", error);
        
        if (error.code === 'auth/popup-closed-by-user') {
            toast('Sign-in cancelled', 'warning');
        } else if (error.code === 'auth/popup-blocked') {
            toast('Please allow popups for this site', 'error');
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            handleAccountLinking(error);
        } else {
            handleAuthError(error);
        }
    }
}

// ==================== COMPLETE PROFILE (For incomplete profiles) ====================
function showCompleteProfileModal(user) {
    console.log("📋 Showing profile completion modal");
    
    const modal = $('completeProfileModal');
    if (!modal) {
        console.error("❌ Complete profile modal not found!");
        // If modal doesn't exist, still allow user to continue
        handleRedirect();
        return;
    }
    
    const photo = $('googleUserPhoto');
    const name = $('googleUserName');
    
    if (photo) {
        photo.src = user.photoURL || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=4CAF50&color=fff&size=80`;
    }
    
    if (name) {
        name.textContent = `Welcome, ${user.displayName || 'User'}!`;
    }
    
    // Pre-fill any existing data
    db.collection("users").doc(user.uid).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            if ($('profilePhone')) $('profilePhone').value = data.phone || '';
            if ($('profileAddress')) $('profileAddress').value = data.address || '';
            if ($('profileCity')) $('profileCity').value = data.city || '';
            if ($('profileState')) $('profileState').value = data.state || '';
            if ($('profilePincode')) $('profilePincode').value = data.pincode || '';
        }
    });
    
    modal.classList.add('active');
}

async function handleCompleteProfile(e) {
    e.preventDefault();
    console.log("📝 Saving additional profile info...");
    
    const currentUser = auth.currentUser || pendingGoogleUser;
    
    if (!currentUser) {
        showMessage('Session expired. Please try again.', 'error');
        setTimeout(() => window.location.reload(), 2000);
        return;
    }
    
    // Get form values
    const phone = $('profilePhone')?.value.trim();
    const address = $('profileAddress')?.value.trim();
    const city = $('profileCity')?.value.trim();
    const state = $('profileState')?.value.trim() || "";
    const pincode = $('profilePincode')?.value.trim();
    
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
        const phoneExists = await isPhoneAlreadyExists(phone, currentUser.uid);
        
        if (phoneExists) {
            hideLoading();
            toast('This phone number is already registered', 'error');
            return;
        }
        
        // Update user document in Firestore
        await updateUserProfile(currentUser.uid, {
            phone: phone,
            address: address,
            city: city,
            state: state,
            pincode: pincode,
            profileComplete: true
        });
        
        console.log("✅ Profile completed successfully");
        
        // Clear pending user and close modal
        pendingGoogleUser = null;
        $('completeProfileModal')?.classList.remove('active');
        
        hideLoading();
        toast('Profile completed successfully!', 'success');
        
        // Redirect
        setTimeout(() => handleRedirect(), 1000);
        
    } catch (error) {
        hideLoading();
        console.error('❌ Error saving profile:', error);
        
        if (error.code === 'permission-denied') {
            toast('Permission denied. Please try logging in again.', 'error');
            setTimeout(() => {
                auth.signOut();
                window.location.reload();
            }, 2000);
        } else {
            toast('Failed to save profile. Please try again.', 'error');
        }
    }
}

// ==================== ACCOUNT LINKING ====================
async function handleAccountLinking(error) {
    console.log("🔗 Handling account linking...");
    
    const email = error.customData?.email || error.email;
    const pendingCred = firebase.auth.GoogleAuthProvider.credentialFromError(error);
    
    if (!pendingCred) {
        toast('Unable to link accounts. Please try again.', 'error');
        return;
    }
    
    const password = prompt(
        `The email "${email}" is already registered.\n\nEnter your password to link Google sign-in:`
    );
    
    if (!password) {
        toast('Account linking cancelled', 'warning');
        return;
    }
    
    showLoading('Linking accounts...');
    
    try {
        // Sign in with existing account
        const userCred = await auth.signInWithEmailAndPassword(email, password);
        
        // Link Google credential
        await userCred.user.linkWithCredential(pendingCred);
        
        // Update Firestore
        await updateUserProfile(userCred.user.uid, {
            providers: firebase.firestore.FieldValue.arrayUnion("google")
        });
        
        hideLoading();
        toast('Google account linked successfully!', 'success');
        setTimeout(() => handleRedirect(), 1000);
        
    } catch (linkError) {
        hideLoading();
        console.error("❌ Linking error:", linkError);
        
        if (linkError.code === 'auth/wrong-password') {
            toast('Incorrect password. Please try again.', 'error');
        } else {
            handleAuthError(linkError);
        }
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
        case 'auth/network-request-failed':
            message = 'Network error. Check your connection.';
            break;
    }
    
    showMessage(message, 'error');
}

function handleRedirect() {
    if (redirectUrl === 'cart') {
        window.location.href = 'cart.html';
    } else if (redirectUrl === 'profile') {
        window.location.href = 'profile.html';
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
window.getCurrentUserProfile = getCurrentUserProfile;
window.updateUserProfile = updateUserProfile;

// ==================== CONSOLE ====================
console.log('%c🔐 FreshMart Auth Ready!', 'color:#2e7d32;font-size:16px;font-weight:bold');
console.log('%c📱 Firebase Auth + Firestore', 'color:#666');
