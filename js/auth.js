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

// ==================== CRITICAL FIX: COMPLETE SAVE USER FUNCTION ====================
async function saveUserToFirestore(user, provider, extraData = {}) {
    try {
        const userRef = db.collection("users").doc(user.uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            // NEW USER - Create complete profile document
            const newUserData = {
                // Auth fields
                uid: user.uid,
                email: user.email || "",
                emailVerified: user.emailVerified || false,
                
                // Profile fields (IMPORTANT - these are what profile page reads)
                name: extraData.name || user.displayName || "",
                phone: extraData.phone || "",
                photoURL: extraData.photo || user.photoURL || "",
                
                // Address fields
                address: extraData.address || "",
                city: extraData.city || "",
                state: extraData.state || "",
                pincode: extraData.pincode || "",
                
                // Meta fields
                provider: provider,
                providers: [provider],
                role: "user",
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await userRef.set(newUserData);
            console.log("✅ New user profile created:", user.uid);
            return { isNew: true, data: newUserData };
            
        } else {
            // EXISTING USER - Update with merge
            const updateData = {
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                providers: firebase.firestore.FieldValue.arrayUnion(provider)
            };
            
            // Only update non-empty values
            if (extraData.name) updateData.name = extraData.name;
            if (extraData.phone) updateData.phone = extraData.phone;
            if (extraData.address) updateData.address = extraData.address;
            if (extraData.city) updateData.city = extraData.city;
            if (extraData.state) updateData.state = extraData.state;
            if (extraData.pincode) updateData.pincode = extraData.pincode;
            if (extraData.photo || user.photoURL) updateData.photoURL = extraData.photo || user.photoURL;
            if (user.displayName && !userDoc.data().name) updateData.name = user.displayName;
            
            await userRef.update(updateData);
            console.log("✅ User profile updated:", user.uid);
            return { isNew: false, data: { ...userDoc.data(), ...updateData } };
        }
    } catch (error) {
        console.error("❌ Error saving to Firestore:", error);
        throw error;
    }
}

// Check if phone exists for another user
async function isPhoneAlreadyExists(phone, excludeUid = null) {
    if (!phone) return false;
    
    const snapshot = await db.collection("users")
        .where("phone", "==", phone)
        .get();
    
    if (snapshot.empty) return false;
    
    // Check if phone belongs to another user
    return snapshot.docs.some(doc => doc.id !== excludeUid);
}

// Check if profile is complete
function isProfileComplete(userData) {
    return !!(userData && userData.phone && userData.address && userData.city && userData.pincode);
}

// ==================== STATE ====================
let pendingGoogleUser = null;
let redirectUrl = null;

// ==================== DOM HELPERS ====================
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    redirectUrl = params.get('redirect');
    
    // Bind events based on page
    if ($('loginForm')) {
        bindLoginEvents();
    }
    
    if ($('signupForm')) {
        bindSignupEvents();
    }
    
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
        
        // Save/Update user in Firestore (ensures profile data exists)
        await saveUserToFirestore(user, "password");
        
        hideLoading();
        toast('Login successful!', 'success');
        
        setTimeout(() => handleRedirect(), 1000);
        
    } catch (error) {
        hideLoading();
        handleAuthError(error);
    }
}

// ==================== EMAIL/PASSWORD SIGNUP - FIXED ====================
async function handleSignup(e) {
    e.preventDefault();
    
    // Get ALL form values
    const fullName = $('fullName')?.value.trim();
    const email = $('email')?.value.trim();
    const phone = $('phone')?.value.trim();
    const password = $('password')?.value;
    const confirmPassword = $('confirmPassword')?.value;
    const address = $('address')?.value.trim();
    const city = $('city')?.value.trim();
    const state = $('state')?.value.trim() || "";  // Optional
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
        // Check phone uniqueness FIRST
        const phoneExists = await isPhoneAlreadyExists(phone);
        if (phoneExists) {
            hideLoading();
            showMessage("This phone number is already registered.", "error");
            return;
        }

        // Create Firebase Auth account
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log("✅ Auth account created for:", user.email);

        // Update display name in Firebase Auth
        await user.updateProfile({ 
            displayName: fullName 
        });
        
        // CRITICAL: Save ALL profile data to Firestore
        const profileData = {
            name: fullName,
            phone: phone,
            address: address,
            city: city,
            state: state,
            pincode: pincode
        };
        
        const result = await saveUserToFirestore(user, "password", profileData);
        
        console.log("✅ Complete profile saved to Firestore:", result);
        
        // Verify data was saved
        const verification = await db.collection("users").doc(user.uid).get();
        if (verification.exists) {
            console.log("✅ Verified - Profile data in Firestore:", verification.data());
        } else {
            console.error("❌ WARNING: Profile data not found in Firestore!");
        }
        
        hideLoading();
        toast('Account created successfully!', 'success');
        
        setTimeout(() => handleRedirect(), 1500);
        
    } catch (error) {
        hideLoading();
        console.error("❌ Signup error:", error);
        
        // If user was created but profile save failed, delete the auth account
        if (error.code !== 'auth/email-already-in-use' && auth.currentUser) {
            await auth.currentUser.delete();
            console.log("⚠️ Rolled back auth account due to profile save failure");
        }
        
        handleAuthError(error);
    }
}

// ==================== GOOGLE AUTHENTICATION - FIXED ====================
async function handleGoogleAuth() {
    console.log("🔵 Google Auth started");
    showLoading('Connecting to Google...');
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        const isNewUser = result.additionalUserInfo?.isNewUser;

        console.log("✅ Google sign-in successful:", user.email);
        console.log("🆕 Is new user:", isNewUser);

        if (isNewUser) {
            // New Google user - save basic info first
            await saveUserToFirestore(user, "google", {
                name: user.displayName,
                photo: user.photoURL
            });
            
            // Show complete profile modal
            pendingGoogleUser = user;
            hideLoading();
            showCompleteProfileModal(user);
            
        } else {
            // Existing user - check profile completeness
            const userDoc = await db.collection("users").doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                if (!isProfileComplete(userData)) {
                    // Profile incomplete - show modal
                    pendingGoogleUser = user;
                    hideLoading();
                    showCompleteProfileModal(user);
                } else {
                    // Profile complete - just update last login
                    await saveUserToFirestore(user, "google");
                    hideLoading();
                    toast('Login successful!', 'success');
                    setTimeout(handleRedirect, 1000);
                }
            } else {
                // No Firestore document - create one and show modal
                await saveUserToFirestore(user, "google", {
                    name: user.displayName,
                    photo: user.photoURL
                });
                
                pendingGoogleUser = user;
                hideLoading();
                showCompleteProfileModal(user);
            }
        }

    } catch (error) {
        hideLoading();
        console.error("❌ Google Auth Error:", error);
        
        if (error.code === 'auth/account-exists-with-different-credential') {
            await handleAccountLinking(error);
        } else if (error.code === 'auth/popup-closed-by-user') {
            toast('Sign-in cancelled', 'warning');
        } else if (error.code === 'auth/popup-blocked') {
            toast('Popup blocked! Please allow popups.', 'error');
            tryRedirectAuth();
        } else {
            handleAuthError(error);
        }
    }
}

// Fallback redirect auth
async function tryRedirectAuth() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithRedirect(provider);
    } catch (error) {
        handleAuthError(error);
    }
}

// Handle redirect result
auth.getRedirectResult().then(async result => {
    if (result.user) {
        const user = result.user;
        const isNewUser = result.additionalUserInfo?.isNewUser;
        
        if (isNewUser) {
            await saveUserToFirestore(user, "google", {
                name: user.displayName,
                photo: user.photoURL
            });
            pendingGoogleUser = user;
            showCompleteProfileModal(user);
        } else {
            const userDoc = await db.collection("users").doc(user.uid).get();
            const userData = userDoc.data();
            
            if (!isProfileComplete(userData)) {
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

// Handle account linking
async function handleAccountLinking(error) {
    const email = error.customData?.email || error.email;
    const pendingCred = firebase.auth.GoogleAuthProvider.credentialFromError(error);

    const password = prompt(
        `Email "${email}" already exists with password.\nEnter password to link Google:`
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
        toast('Google account linked!', 'success');
        setTimeout(handleRedirect, 1000);
    } catch (linkError) {
        hideLoading();
        handleAuthError(linkError);
    }
}

// ==================== COMPLETE PROFILE (Google Users) - FIXED ====================
function showCompleteProfileModal(user) {
    console.log("📋 Showing complete profile modal for:", user.email);
    
    const modal = $('completeProfileModal');
    const photo = $('googleUserPhoto');
    const name = $('googleUserName');
    
    if (photo) {
        photo.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=4CAF50&color=fff&size=80`;
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
    console.log("📝 Completing Google user profile...");
    
    if (!pendingGoogleUser) {
        showMessage('Session expired. Please try again.', 'error');
        return;
    }
    
    const phone = $('profilePhone')?.value.trim();
    const address = $('profileAddress')?.value.trim();
    const city = $('profileCity')?.value.trim();
    const pincode = $('profilePincode')?.value.trim();
    const state = $('profileState')?.value.trim() || "";
    
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
        // Check phone uniqueness
        const phoneExists = await isPhoneAlreadyExists(phone, pendingGoogleUser.uid);
        if (phoneExists) {
            hideLoading();
            toast("This phone number is already registered.", "error");
            return;
        }

        // Update Firestore with complete profile
        const userRef = db.collection("users").doc(pendingGoogleUser.uid);
        
        const updateData = {
            phone: phone,
            address: address,
            city: city,
            state: state,
            pincode: pincode,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await userRef.update(updateData);
        
        console.log("✅ Profile completed for Google user:", pendingGoogleUser.uid);
        
        // Verify the update
        const verification = await userRef.get();
        console.log("✅ Verified profile data:", verification.data());
        
        pendingGoogleUser = null;
        $('completeProfileModal')?.classList.remove('active');
        
        hideLoading();
        toast('Profile completed successfully!', 'success');
        
        setTimeout(() => handleRedirect(), 1000);
        
    } catch (error) {
        hideLoading();
        console.error('❌ Profile completion error:', error);
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

// ==================== DEBUG: Verify Firestore Connection ====================
async function verifyFirestoreConnection() {
    try {
        const testDoc = await db.collection("_test").doc("connection").get();
        console.log("✅ Firestore connection verified");
        return true;
    } catch (error) {
        console.error("❌ Firestore connection failed:", error);
        return false;
    }
}

// Run verification on load
verifyFirestoreConnection();

// ==================== CONSOLE ====================
console.log('%c🔐 FreshMart Auth Ready!', 'color:#2e7d32;font-size:16px;font-weight:bold');
console.log('%c📱 Firebase Auth + Firestore', 'color:#666');
console.log('%c🔵 Google Sign-In: Enabled', 'color:#4285f4');

// Debug: Check current auth state
auth.onAuthStateChanged(user => {
    if (user) {
        console.log("👤 Current user:", user.email);
        // Check if user has Firestore profile
        db.collection("users").doc(user.uid).get().then(doc => {
            if (doc.exists) {
                console.log("✅ Profile data exists:", doc.data());
            } else {
                console.warn("⚠️ No profile data in Firestore for:", user.email);
            }
        });
    } else {
        console.log("👤 No user logged in");
    }
});
