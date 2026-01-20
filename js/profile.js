// ==================== PROFILE PAGE JAVASCRIPT ====================
// Complete profile management for FreshMart

// ==================== STATE VARIABLES ====================
let userData = null;
let editMode = 'all';
let tempPhotoData = null;

// ==================== CONSTANTS ====================
const STORAGE_KEYS = {
    CART: 'freshmart_cart',
    WISHLIST: 'freshmart_wishlist',
    USER: 'freshmart_user',
    ORDERS: 'freshmart_orders',
    SAVINGS: 'freshmart_savings'
};

// ==================== DOM ELEMENTS (Initialize as empty) ====================
let DOM = {};

// ==================== INITIALIZE DOM ELEMENTS ====================
function initializeDOMElements() {
    DOM = {
        // Profile display elements
        profilePhoto: document.getElementById('profilePhoto'),
        photoPlaceholder: document.getElementById('photoPlaceholder'),
        photoInput: document.getElementById('photoInput'),
        username: document.getElementById('username'),
        phone: document.getElementById('phone'),
        email: document.getElementById('email'),
        address: document.getElementById('address'),
        memberSince: document.getElementById('memberSince'),
        profileBadge: document.getElementById('profileBadge'),
        
        // Stats elements
        totalOrders: document.getElementById('totalOrders'),
        wishlistCount: document.getElementById('wishlistCount'),
        totalSavings: document.getElementById('totalSavings'),
        walletBalance: document.getElementById('walletBalance'),
        cartCount: document.getElementById('cartCount'),
        
        // Orders elements
        recentOrders: document.getElementById('recentOrders'),
        noOrders: document.getElementById('noOrders'),
        
        // Modal elements
        editModal: document.getElementById('editModal'),
        modalTitle: document.getElementById('modalTitle'),
        editForm: document.getElementById('editForm'),
        editProfilePhoto: document.getElementById('editProfilePhoto'),
        editPhotoPlaceholder: document.getElementById('editPhotoPlaceholder'),
        editPhotoInput: document.getElementById('editPhotoInput'),
        editName: document.getElementById('editName'),
        editPhone: document.getElementById('editPhone'),
        editEmail: document.getElementById('editEmail'),
        editAddress: document.getElementById('editAddress'),
        
        // Form sections
        photoSection: document.getElementById('photoSection'),
        nameSection: document.getElementById('nameSection'),
        phoneSection: document.getElementById('phoneSection'),
        emailSection: document.getElementById('emailSection'),
        addressSection: document.getElementById('addressSection'),
        
        // Settings elements
        notificationToggle: document.getElementById('notificationToggle'),
        
        // Toast elements
        toast: document.getElementById('toast'),
        toastIcon: document.getElementById('toastIcon'),
        toastMessage: document.getElementById('toastMessage'),
        
        // Loading overlay
        loadingOverlay: document.getElementById('loadingOverlay')
    };
    
    console.log('✅ DOM Elements Initialized');
    console.log('🔍 DOM.totalSavings:', DOM.totalSavings);
    console.log('🔍 DOM.totalOrders:', DOM.totalOrders);
    console.log('🔍 DOM.wishlistCount:', DOM.wishlistCount);
}

// ==================== REFRESH DOM ELEMENT ====================
function refreshDOMElement(key) {
    const elementIds = {
        totalSavings: 'totalSavings',
        totalOrders: 'totalOrders',
        wishlistCount: 'wishlistCount',
        walletBalance: 'walletBalance',
        cartCount: 'cartCount'
    };
    
    if (elementIds[key] && !DOM[key]) {
        DOM[key] = document.getElementById(elementIds[key]);
        console.log(`🔄 Refreshed DOM.${key}:`, DOM[key]);
    }
    
    return DOM[key];
}

// Firebase initialization
const firebaseConfig = {
    apiKey: "AIzaSyDf4QSE3kw9HQD_ZWJ-DDZ8yN3hgRp4UaM",
    authDomain: "otp-auth-ff7fb.firebaseapp.com",
    projectId: "otp-auth-ff7fb",
    storageBucket: "otp-auth-ff7fb.firebasestorage.app",
    messagingSenderId: "945314024888",
    appId: "1:945314024888:web:1eb577611a4de09757934d",
    measurementId: "G-6HMXTKV0SQ"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('👤 FreshMart Profile Page Initialized');
    
    // Initialize DOM elements FIRST
    initializeDOMElements();
    
    // Setup event listeners
    setupEventListeners();
    
    // Update cart count
    updateCartCount();
    
    // Check auth state
    checkAuthState();
});

// ==================== AUTH STATE CHECK ====================
function checkAuthState() {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            console.log('❌ No user authenticated, redirecting...');
            window.location.href = 'login.html?redirect=profile';
            return;
        }

        console.log('✅ User authenticated:', user.uid);
        await loadProfileFromFirestore(user.uid);
    });
}

// ==================== LOAD PROFILE FROM FIRESTORE ====================
async function loadProfileFromFirestore(uid) {
    try {
        showLoading();

        const doc = await db.collection("users").doc(uid).get();
        
        if (!doc.exists) {
            console.warn("No profile data found in Firestore");
            hideLoading();
            return;
        }

        const data = doc.data();
        
        // DEBUG: Log raw Firestore data
        console.log('🔥 RAW FIRESTORE DATA:', data);
        console.log('🔥 Orders in Firestore:', data.orders);
        console.log('🔥 TotalSavings in Firestore:', data.totalSavings);

        // Normalize data for UI
        userData = {
            uid,
            name: data.name || 'User',
            email: data.email || '',
            phone: data.phone || '',
            address: [
                data.address,
                data.city,
                data.state,
                data.pincode
            ].filter(Boolean).join(', '),
            streetAddress: data.address || '',
            city: data.city || '',
            state: data.state || '',
            pincode: data.pincode || '',
            profilePhoto: data.photo || '',
            memberSince: data.createdAt?.toDate
                ? data.createdAt.toDate().toISOString()
                : new Date().toISOString(),
            wallet: data.wallet || 0,
            orders: data.orders || [],
            totalSavings: data.totalSavings || 0,
            notifications: data.notifications ?? true
        };

        console.log('📦 NORMALIZED userData:', userData);
        
        // Ensure DOM is ready before updating
        await ensureDOMReady();
        
        updateProfileDisplay();
        await updateStats();
        loadRecentOrders();

        hideLoading();
    } catch (err) {
        hideLoading();
        console.error("❌ Error loading profile:", err);
        showToast('Error loading profile', 'error');
    }
}

// ==================== ENSURE DOM IS READY ====================
function ensureDOMReady() {
    return new Promise((resolve) => {
        // Re-initialize DOM elements if they're null
        if (!DOM.totalSavings || !DOM.totalOrders) {
            console.log('🔄 Re-initializing DOM elements...');
            initializeDOMElements();
        }
        
        // Small delay to ensure DOM is painted
        setTimeout(resolve, 50);
    });
}

// ==================== UPDATE STATS (FIXED) ====================
async function updateStats() {
    console.log('📊 ========== UPDATING STATS ==========');
    
    // Ensure DOM elements exist
    refreshDOMElement('totalOrders');
    refreshDOMElement('wishlistCount');
    refreshDOMElement('totalSavings');
    refreshDOMElement('walletBalance');
    
    // 1. Orders count
    const orders = userData?.orders || [];
    console.log('📦 Orders array:', orders);
    console.log('📦 Orders count:', orders.length);
    
    const totalOrdersEl = DOM.totalOrders || document.getElementById('totalOrders');
    if (totalOrdersEl) {
        totalOrdersEl.textContent = orders.length;
        console.log('✅ Updated totalOrders DOM');
    } else {
        console.error('❌ DOM.totalOrders element not found!');
    }
    
    // 2. Wishlist count
    let wishlistCount = 0;
    try {
        const currentUser = auth.currentUser;
        if (currentUser) {
            const wishlistDoc = await db.collection('wishlists').doc(currentUser.uid).get();
            
            if (wishlistDoc.exists) {
                const wishlistData = wishlistDoc.data();
                wishlistCount = (wishlistData.items || []).length;
                console.log('❤️ Wishlist count from Firestore:', wishlistCount);
            } else {
                // Fallback: Check user document
                const userDoc = await db.collection('users').doc(currentUser.uid).get();
                if (userDoc.exists) {
                    const userDocData = userDoc.data();
                    wishlistCount = (userDocData.wishlist || []).length;
                    console.log('❤️ Wishlist count from user doc:', wishlistCount);
                }
            }
        }
        
        // Fallback to localStorage
        if (wishlistCount === 0) {
            const localWishlist = localStorage.getItem('freshmart_wishlist');
            if (localWishlist) {
                const parsed = JSON.parse(localWishlist);
                wishlistCount = Array.isArray(parsed) ? parsed.length : 0;
            }
        }
    } catch (error) {
        console.error('Error loading wishlist count:', error);
        // Fallback to localStorage
        try {
            const localWishlist = localStorage.getItem('freshmart_wishlist');
            if (localWishlist) {
                const parsed = JSON.parse(localWishlist);
                wishlistCount = Array.isArray(parsed) ? parsed.length : 0;
            }
        } catch (e) {
            wishlistCount = 0;
        }
    }
    
    const wishlistCountEl = DOM.wishlistCount || document.getElementById('wishlistCount');
    if (wishlistCountEl) {
        wishlistCountEl.textContent = wishlistCount;
        console.log('✅ Updated wishlist count:', wishlistCount);
    }
    
    // 3. Total Savings - FIXED
    console.log('💰 ===== CALCULATING SAVINGS =====');
    const savings = await calculateTotalSavings();
    console.log('💰 Final savings value:', savings);
    
    const totalSavingsEl = DOM.totalSavings || document.getElementById('totalSavings');
    if (totalSavingsEl) {
        const formattedSavings = formatCurrency(savings);
        totalSavingsEl.textContent = formattedSavings;
        console.log('✅ Updated totalSavings DOM to:', formattedSavings);
    } else {
        console.error('❌ DOM.totalSavings element NOT FOUND!');
        // Try one more time with a delay
        setTimeout(() => {
            const retryEl = document.getElementById('totalSavings');
            if (retryEl) {
                retryEl.textContent = formatCurrency(savings);
                console.log('✅ Updated totalSavings on retry');
            }
        }, 100);
    }
    
    // 4. Wallet balance
    const walletBalance = userData?.wallet || 0;
    const walletBalanceEl = DOM.walletBalance || document.getElementById('walletBalance');
    if (walletBalanceEl) {
        walletBalanceEl.textContent = formatCurrency(walletBalance);
        console.log('✅ Updated walletBalance:', walletBalance);
    }
    
    console.log('📊 ========== STATS UPDATE COMPLETE ==========');
}

// ==================== CALCULATE TOTAL SAVINGS (FIXED - NO DOUBLE COUNTING) ====================
async function calculateTotalSavings() {
    console.log('🧮 Starting savings calculation...');
    
    let totalSavings = 0;
    
    try {
        // PRIORITY 1: Check if totalSavings is directly stored in userData (from Firestore)
        if (userData?.totalSavings && userData.totalSavings > 0) {
            console.log('💰 Using stored totalSavings from Firestore:', userData.totalSavings);
            return parseFloat(userData.totalSavings) || 0;
        }
        
        // PRIORITY 2: Calculate from orders in userData
        const orders = userData?.orders || [];
        console.log('📋 Calculating from', orders.length, 'orders');
        
        if (orders.length > 0) {
            orders.forEach((order, index) => {
                console.log(`📋 Order ${index + 1}:`, order);
                const orderSaving = calculateOrderSavings(order);
                console.log(`📋 Order ${index + 1} savings:`, orderSaving);
                totalSavings += orderSaving;
            });
            
            if (totalSavings > 0) {
                console.log('💰 Calculated from orders:', totalSavings);
                return Math.round(totalSavings);
            }
        }
        
        // PRIORITY 3: Check Firestore orders collection (only if no orders in user doc)
        const currentUser = auth.currentUser;
        if (currentUser && orders.length === 0) {
            try {
                const ordersSnapshot = await db.collection('orders')
                    .where('userId', '==', currentUser.uid)
                    .get();
                
                console.log('🔥 Orders collection size:', ordersSnapshot.size);
                
                if (!ordersSnapshot.empty) {
                    ordersSnapshot.forEach(doc => {
                        const order = doc.data();
                        console.log('🔥 Order from collection:', order);
                        const orderSaving = calculateOrderSavings(order);
                        totalSavings += orderSaving;
                    });
                    
                    if (totalSavings > 0) {
                        console.log('💰 Calculated from orders collection:', totalSavings);
                        return Math.round(totalSavings);
                    }
                }
            } catch (e) {
                console.log('ℹ️ Orders collection not found or access denied:', e.message);
            }
        }
        
        // PRIORITY 4: Check localStorage
        const localSavings = getLocalStorageSavings();
        console.log('💾 LocalStorage savings:', localSavings);
        
        if (localSavings > 0) {
            return localSavings;
        }
        
        // PRIORITY 5: Calculate from current cart (potential savings)
        const cartSavings = calculateCartSavings();
        console.log('🛒 Potential cart savings:', cartSavings);
        
        if (cartSavings > 0) {
            return Math.round(cartSavings);
        }
        
    } catch (error) {
        console.error('❌ Error calculating savings:', error);
    }
    
    console.log('💰 FINAL TOTAL SAVINGS:', totalSavings);
    return Math.round(totalSavings);
}

// ==================== CALCULATE ORDER SAVINGS ====================
function calculateOrderSavings(order) {
    if (!order) return 0;
    
    let savings = 0;
    
    // Check direct discount fields (only use one to avoid double counting)
    if (order.totalDiscount !== undefined && order.totalDiscount > 0) {
        savings = parseFloat(order.totalDiscount) || 0;
        console.log('  → Using totalDiscount:', savings);
        return savings;
    }
    
    if (order.savings !== undefined && order.savings > 0) {
        savings = parseFloat(order.savings) || 0;
        console.log('  → Using savings field:', savings);
        return savings;
    }
    
    if (order.discount !== undefined && order.discount > 0) {
        savings = parseFloat(order.discount) || 0;
        console.log('  → Using discount field:', savings);
        return savings;
    }
    
    // Add coupon/promo discounts
    if (order.couponDiscount) {
        savings += parseFloat(order.couponDiscount) || 0;
        console.log('  → couponDiscount:', order.couponDiscount);
    }
    
    if (order.promoDiscount) {
        savings += parseFloat(order.promoDiscount) || 0;
        console.log('  → promoDiscount:', order.promoDiscount);
    }
    
    // If no direct discount fields, calculate from items
    if (savings === 0) {
        const items = order.items || order.cartItems || order.products || [];
        console.log('  → Calculating from', items.length, 'items');
        
        items.forEach((item, i) => {
            const itemSaving = calculateItemSavings(item);
            if (itemSaving > 0) {
                console.log(`    → Item ${i + 1} savings:`, itemSaving);
            }
            savings += itemSaving;
        });
    }
    
    return savings;
}

// ==================== CALCULATE ITEM SAVINGS ====================
function calculateItemSavings(item) {
    if (!item) return 0;
    
    const quantity = parseInt(item.quantity) || 1;
    let saving = 0;
    
    // Method 1: originalPrice vs price
    if (item.originalPrice !== undefined && item.price !== undefined) {
        const original = parseFloat(item.originalPrice);
        const current = parseFloat(item.price);
        if (original > current && !isNaN(original) && !isNaN(current)) {
            saving = (original - current) * quantity;
            return saving;
        }
    }
    
    // Method 2: mrp vs price
    if (item.mrp !== undefined && item.price !== undefined) {
        const mrp = parseFloat(item.mrp);
        const price = parseFloat(item.price);
        if (mrp > price && !isNaN(mrp) && !isNaN(price)) {
            saving = (mrp - price) * quantity;
            return saving;
        }
    }
    
    // Method 3: mrp vs salePrice
    if (item.mrp !== undefined && item.salePrice !== undefined) {
        const mrp = parseFloat(item.mrp);
        const sale = parseFloat(item.salePrice);
        if (mrp > sale && !isNaN(mrp) && !isNaN(sale)) {
            saving = (mrp - sale) * quantity;
            return saving;
        }
    }
    
    // Method 4: oldPrice vs price
    if (item.oldPrice !== undefined && item.price !== undefined) {
        const old = parseFloat(item.oldPrice);
        const price = parseFloat(item.price);
        if (old > price && !isNaN(old) && !isNaN(price)) {
            saving = (old - price) * quantity;
            return saving;
        }
    }
    
    // Method 5: discount field
    if (item.discount !== undefined && item.discount > 0) {
        saving = parseFloat(item.discount) * quantity;
        return saving;
    }
    
    // Method 6: discountPercent
    if (item.discountPercent !== undefined && item.price !== undefined) {
        const percent = parseFloat(item.discountPercent);
        const price = parseFloat(item.price);
        if (!isNaN(percent) && !isNaN(price) && percent > 0) {
            const originalPrice = price / (1 - percent / 100);
            saving = (originalPrice - price) * quantity;
            return saving;
        }
    }
    
    return Math.max(0, saving);
}

// ==================== GET LOCAL STORAGE SAVINGS ====================
function getLocalStorageSavings() {
    try {
        // Check direct savings
        const savedAmount = localStorage.getItem(STORAGE_KEYS.SAVINGS);
        if (savedAmount) {
            const parsed = parseFloat(savedAmount);
            if (!isNaN(parsed) && parsed > 0) {
                return parsed;
            }
        }
        
        // Check orders in localStorage
        const ordersData = localStorage.getItem(STORAGE_KEYS.ORDERS);
        if (ordersData) {
            const orders = JSON.parse(ordersData);
            let total = 0;
            if (Array.isArray(orders)) {
                orders.forEach(order => {
                    total += calculateOrderSavings(order);
                });
            }
            return total;
        }
        
        return 0;
    } catch (error) {
        console.error('Error reading localStorage savings:', error);
        return 0;
    }
}

// ==================== CALCULATE CART SAVINGS ====================
function calculateCartSavings() {
    try {
        const cartData = localStorage.getItem(STORAGE_KEYS.CART);
        if (!cartData) return 0;
        
        const cart = JSON.parse(cartData);
        if (!Array.isArray(cart)) return 0;
        
        let savings = 0;
        
        cart.forEach(item => {
            savings += calculateItemSavings(item);
        });
        
        return savings;
    } catch (error) {
        console.error('Error calculating cart savings:', error);
        return 0;
    }
}

// ==================== FORMAT CURRENCY ====================
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return '₹0';
    }
    const rounded = Math.round(amount);
    return `₹${rounded.toLocaleString('en-IN')}`;
}

// ==================== UPDATE CART COUNT ====================
function updateCartCount() {
    try {
        const cartData = localStorage.getItem(STORAGE_KEYS.CART);
        const cart = cartData ? JSON.parse(cartData) : [];
        const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        
        const cartCountEl = DOM.cartCount || document.getElementById('cartCount');
        if (cartCountEl) {
            cartCountEl.textContent = totalItems;
            cartCountEl.style.display = totalItems > 0 ? 'flex' : 'none';
        }
    } catch (error) {
        const cartCountEl = DOM.cartCount || document.getElementById('cartCount');
        if (cartCountEl) {
            cartCountEl.textContent = '0';
            cartCountEl.style.display = 'none';
        }
    }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Wait a bit for DOM to be ready
    setTimeout(() => {
        const photoInput = DOM.photoInput || document.getElementById('photoInput');
        if (photoInput) {
            photoInput.addEventListener('change', handleMainPhotoUpload);
        }
        
        const editPhotoInput = DOM.editPhotoInput || document.getElementById('editPhotoInput');
        if (editPhotoInput) {
            editPhotoInput.addEventListener('change', handleModalPhotoUpload);
        }
        
        const editForm = DOM.editForm || document.getElementById('editForm');
        if (editForm) {
            editForm.addEventListener('submit', handleFormSubmit);
        }
        
        const editPhone = DOM.editPhone || document.getElementById('editPhone');
        if (editPhone) {
            editPhone.addEventListener('input', function(e) {
                this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);
            });
        }
        
        const notificationToggle = DOM.notificationToggle || document.getElementById('notificationToggle');
        if (notificationToggle) {
            notificationToggle.checked = userData?.notifications ?? true;
            notificationToggle.addEventListener('change', handleNotificationToggle);
        }
        
        const editModal = DOM.editModal || document.getElementById('editModal');
        if (editModal) {
            editModal.addEventListener('click', function(e) {
                if (e.target === editModal) {
                    closeEditModal();
                }
            });
        }
        
        document.addEventListener('keydown', handleKeyboard);
        
        console.log('🎯 Event listeners attached');
    }, 100);
}

function handleKeyboard(e) {
    if (e.key === 'Escape') {
        const editModal = DOM.editModal || document.getElementById('editModal');
        if (editModal?.classList.contains('active')) {
            closeEditModal();
        }
        hideToast();
    }
}

// ==================== PROFILE DISPLAY ====================
function updateProfileDisplay() {
    if (!userData) {
        console.warn('No user data to display');
        return;
    }
    
    const photoData = userData.profilePhoto || userData.photo || null;
    const profilePhoto = DOM.profilePhoto || document.getElementById('profilePhoto');
    const photoPlaceholder = DOM.photoPlaceholder || document.getElementById('photoPlaceholder');
    updatePhotoDisplay(profilePhoto, photoPlaceholder, photoData);
    
    const usernameEl = DOM.username || document.getElementById('username');
    if (usernameEl) {
        usernameEl.textContent = userData.name || 'Guest User';
    }
    
    const phoneEl = DOM.phone || document.getElementById('phone');
    if (phoneEl) {
        if (userData.phone) {
            phoneEl.textContent = `+91 ${formatPhoneNumber(userData.phone)}`;
            phoneEl.classList.remove('not-set');
        } else {
            phoneEl.textContent = 'Not set';
            phoneEl.classList.add('not-set');
        }
    }
    
    const emailEl = DOM.email || document.getElementById('email');
    if (emailEl) {
        emailEl.textContent = userData.email || 'Not set';
        emailEl.classList.toggle('not-set', !userData.email);
    }
    
    const addressEl = DOM.address || document.getElementById('address');
    if (addressEl) {
        let displayAddress = userData.address || '';
        
        if (!displayAddress && (userData.streetAddress || userData.city)) {
            displayAddress = [
                userData.streetAddress,
                userData.city,
                userData.state,
                userData.pincode
            ].filter(Boolean).join(', ');
        }
        
        if (displayAddress) {
            const maxLength = 50;
            addressEl.textContent = displayAddress.length > maxLength 
                ? displayAddress.substring(0, maxLength) + '...'
                : displayAddress;
            addressEl.classList.remove('not-set');
        } else {
            addressEl.textContent = 'Not set';
            addressEl.classList.add('not-set');
        }
    }
    
    const memberSinceEl = DOM.memberSince || document.getElementById('memberSince');
    if (memberSinceEl) {
        const dateStr = userData.memberSince || userData.createdAt;
        if (dateStr) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                memberSinceEl.textContent = date.toLocaleDateString('en-IN', {
                    month: 'short',
                    year: 'numeric'
                });
            } else {
                memberSinceEl.textContent = 'Recently';
            }
        }
    }
    
    console.log('✅ Profile display updated');
}

function updatePhotoDisplay(imgElement, placeholderElement, photoData) {
    if (!imgElement) return;
    
    if (photoData && photoData.trim() !== '') {
        imgElement.src = photoData;
        imgElement.style.display = 'block';
        if (placeholderElement) {
            placeholderElement.style.display = 'none';
        }
    } else {
        imgElement.src = '';
        imgElement.style.display = 'none';
        if (placeholderElement) {
            placeholderElement.style.display = 'flex';
        }
    }
}

function formatPhoneNumber(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }
    return cleaned;
}

// ==================== RECENT ORDERS ====================
function loadRecentOrders() {
    const orders = userData?.orders || [];
    
    if (orders.length === 0) {
        showNoOrders();
        return;
    }
    
    hideNoOrders();
    
    const sortedOrders = [...orders].sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0);
        const dateB = new Date(b.date || b.createdAt || 0);
        return dateB - dateA;
    });
    
    const recentOrders = sortedOrders.slice(0, 3);
    
    const recentOrdersEl = DOM.recentOrders || document.getElementById('recentOrders');
    if (recentOrdersEl) {
        recentOrdersEl.innerHTML = recentOrders
            .map(order => createOrderItemHTML(order))
            .join('');
    }
}

function showNoOrders() {
    const recentOrdersEl = DOM.recentOrders || document.getElementById('recentOrders');
    const noOrdersEl = DOM.noOrders || document.getElementById('noOrders');
    
    if (recentOrdersEl) recentOrdersEl.innerHTML = '';
    if (noOrdersEl) noOrdersEl.classList.remove('hidden');
}

function hideNoOrders() {
    const noOrdersEl = DOM.noOrders || document.getElementById('noOrders');
    if (noOrdersEl) noOrdersEl.classList.add('hidden');
}

function createOrderItemHTML(order) {
    const statusClass = getStatusClass(order.status);
    const statusText = formatStatus(order.status);
    const orderEmoji = getOrderEmoji(order);
    const formattedDate = formatOrderDate(order.date || order.createdAt);
    const formattedTotal = formatCurrency(order.total || order.totalAmount || 0);
    const orderId = order.id || order.orderId || Date.now();
    
    return `
        <div class="order-item" data-order-id="${orderId}" onclick="viewOrderDetails('${orderId}')">
            <div class="order-icon">${orderEmoji}</div>
            <div class="order-info">
                <div class="order-id">Order #${orderId}</div>
                <div class="order-date">${formattedDate}</div>
            </div>
            <span class="order-status ${statusClass}">${statusText}</span>
            <span class="order-amount">${formattedTotal}</span>
        </div>
    `;
}

function getStatusClass(status) {
    const statusMap = {
        'delivered': 'delivered',
        'confirmed': 'pending',
        'pending': 'pending',
        'processing': 'pending',
        'shipped': 'pending',
        'cancelled': 'cancelled',
        'refunded': 'cancelled'
    };
    return statusMap[status?.toLowerCase()] || 'pending';
}

function formatStatus(status) {
    if (!status) return 'Pending';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function getOrderEmoji(order) {
    const status = order.status?.toLowerCase();
    if (status === 'delivered') return '✅';
    if (status === 'cancelled' || status === 'refunded') return '❌';
    if (status === 'shipped') return '🚚';
    return '📦';
}

function formatOrderDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    } catch {
        return dateString;
    }
}

function viewOrderDetails(orderId) {
    window.location.href = `orders.html?id=${orderId}`;
}

// ==================== PHOTO UPLOAD ====================
async function handleMainPhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const validation = validateImageFile(file);
    if (!validation.valid) {
        showToast(validation.message, 'error');
        return;
    }
    
    try {
        showLoading();
        
        const base64 = await convertFileToBase64(file);
        const compressedBase64 = await compressImage(base64);
        
        userData.profilePhoto = compressedBase64;
        
        const currentUser = auth.currentUser;
        if (currentUser) {
            await db.collection('users').doc(currentUser.uid).update({
                photo: compressedBase64,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        updateProfileDisplay();
        
        hideLoading();
        showToast('Profile photo updated successfully!', 'success');
        
    } catch (error) {
        hideLoading();
        console.error('Error uploading photo:', error);
        showToast('Failed to upload photo. Please try again.', 'error');
    }
    
    event.target.value = '';
}

async function handleModalPhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const validation = validateImageFile(file);
    if (!validation.valid) {
        showToast(validation.message, 'error');
        return;
    }
    
    try {
        const base64 = await convertFileToBase64(file);
        const compressedBase64 = await compressImage(base64);
        
        tempPhotoData = compressedBase64;
        
        const editProfilePhoto = DOM.editProfilePhoto || document.getElementById('editProfilePhoto');
        const editPhotoPlaceholder = DOM.editPhotoPlaceholder || document.getElementById('editPhotoPlaceholder');
        updatePhotoDisplay(editProfilePhoto, editPhotoPlaceholder, compressedBase64);
        
    } catch (error) {
        console.error('Error uploading photo:', error);
        showToast('Failed to upload photo. Please try again.', 'error');
    }
    
    event.target.value = '';
}

function validateImageFile(file) {
    if (!file.type.startsWith('image/')) {
        return { valid: false, message: 'Please select an image file' };
    }
    
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        return { valid: false, message: 'Image size should be less than 5MB' };
    }
    
    return { valid: true };
}

function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

function compressImage(base64) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const maxWidth = 500;
            const maxHeight = 500;
            
            let { width, height } = img;
            
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            const compressed = canvas.toDataURL('image/jpeg', 0.8);
            resolve(compressed);
        };
        
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
}

function removePhoto() {
    tempPhotoData = null;
    
    const editProfilePhoto = DOM.editProfilePhoto || document.getElementById('editProfilePhoto');
    const editPhotoPlaceholder = DOM.editPhotoPlaceholder || document.getElementById('editPhotoPlaceholder');
    updatePhotoDisplay(editProfilePhoto, editPhotoPlaceholder, null);
    
    const editPhotoInput = DOM.editPhotoInput || document.getElementById('editPhotoInput');
    if (editPhotoInput) {
        editPhotoInput.value = '';
    }
    
    showToast('Photo removed. Click Save to confirm.', 'info');
}

// ==================== EDIT MODAL ====================
function openEditModal(mode = 'all') {
    editMode = mode;
    tempPhotoData = userData?.profilePhoto || null;
    
    const titles = {
        'all': 'Edit Profile',
        'phone': 'Update Phone Number',
        'email': 'Update Email Address',
        'address': 'Update Delivery Address'
    };
    
    const modalTitle = DOM.modalTitle || document.getElementById('modalTitle');
    if (modalTitle) {
        modalTitle.textContent = titles[mode] || 'Edit Profile';
    }
    
    toggleFormSections(mode);
    populateEditForm();
    
    const editModal = DOM.editModal || document.getElementById('editModal');
    if (editModal) {
        editModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => focusFirstInput(mode), 100);
    }
}

function toggleFormSections(mode) {
    const sectionVisibility = {
        'photoSection': mode === 'all',
        'nameSection': mode === 'all',
        'phoneSection': mode === 'all' || mode === 'phone',
        'emailSection': mode === 'all' || mode === 'email',
        'addressSection': mode === 'all' || mode === 'address'
    };
    
    Object.entries(sectionVisibility).forEach(([sectionId, visible]) => {
        const section = DOM[sectionId] || document.getElementById(sectionId);
        if (section) {
            section.classList.toggle('hidden', !visible);
        }
    });
}

function focusFirstInput(mode) {
    const inputMap = {
        'all': 'editName',
        'phone': 'editPhone',
        'email': 'editEmail',
        'address': 'editAddress'
    };
    
    const inputId = inputMap[mode];
    const input = DOM[inputId] || document.getElementById(inputId);
    if (input) {
        input.focus();
        input.select();
    }
}

function closeEditModal() {
    const editModal = DOM.editModal || document.getElementById('editModal');
    if (editModal) {
        editModal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    const editForm = DOM.editForm || document.getElementById('editForm');
    if (editForm) {
        editForm.reset();
    }
    
    tempPhotoData = null;
    editMode = 'all';
}

function populateEditForm() {
    if (!userData) return;
    
    const editName = DOM.editName || document.getElementById('editName');
    const editPhone = DOM.editPhone || document.getElementById('editPhone');
    const editEmail = DOM.editEmail || document.getElementById('editEmail');
    const editAddress = DOM.editAddress || document.getElementById('editAddress');
    
    if (editName) editName.value = userData.name || '';
    if (editPhone) editPhone.value = userData.phone || '';
    if (editEmail) editEmail.value = userData.email || '';
    if (editAddress) editAddress.value = userData.address || '';
    
    const editProfilePhoto = DOM.editProfilePhoto || document.getElementById('editProfilePhoto');
    const editPhotoPlaceholder = DOM.editPhotoPlaceholder || document.getElementById('editPhotoPlaceholder');
    updatePhotoDisplay(editProfilePhoto, editPhotoPlaceholder, userData.profilePhoto);
}

// ==================== FORM SUBMISSION ====================
async function handleFormSubmit(event) {
    event.preventDefault();

    const currentUser = auth.currentUser;
    if (!currentUser) {
        showToast('User not authenticated', 'error');
        return;
    }

    const editName = DOM.editName || document.getElementById('editName');
    const editPhone = DOM.editPhone || document.getElementById('editPhone');
    const editEmail = DOM.editEmail || document.getElementById('editEmail');
    const editAddress = DOM.editAddress || document.getElementById('editAddress');

    const updatedData = {
        name: editName?.value.trim() || '',
        phone: editPhone?.value.trim() || '',
        email: editEmail?.value.trim() || '',
        address: editAddress?.value.trim() || '',
        photo: tempPhotoData || userData.profilePhoto || ''
    };

    const validation = validateFormData(updatedData, editMode);
    if (!validation.valid) {
        showToast(validation.message, 'error');
        return;
    }

    showLoading();

    try {
        if (updatedData.phone && editMode !== 'email' && updatedData.phone !== userData.phone) {
            const snapshot = await db.collection('users')
                .where('phone', '==', updatedData.phone)
                .get();

            const exists = snapshot.docs.some(doc => doc.id !== currentUser.uid);
            if (exists) {
                hideLoading();
                showToast('This phone number is already registered.', 'error');
                return;
            }
        }

        const firestoreUpdate = {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editMode === 'all') {
            firestoreUpdate.name = updatedData.name;
            firestoreUpdate.phone = updatedData.phone;
            firestoreUpdate.address = updatedData.address;
            firestoreUpdate.photo = updatedData.photo;
        } else if (editMode === 'phone') {
            firestoreUpdate.phone = updatedData.phone;
        } else if (editMode === 'address') {
            firestoreUpdate.address = updatedData.address;
        }

        await db.collection('users').doc(currentUser.uid).update(firestoreUpdate);

        userData = {
            ...userData,
            ...updatedData,
            profilePhoto: updatedData.photo
        };

        updateProfileDisplay();
        await updateStats();
        closeEditModal();

        hideLoading();
        showToast('Profile updated successfully!', 'success');

    } catch (error) {
        hideLoading();
        console.error('❌ Profile update failed:', error);
        showToast('Failed to update profile. Please try again.', 'error');
    }
}

function validateFormData(data, mode) {
    if (mode === 'all' && !data.name) {
        return { valid: false, message: 'Please enter your name' };
    }
    
    if (mode === 'all' && data.name.length < 2) {
        return { valid: false, message: 'Name must be at least 2 characters' };
    }
    
    if ((mode === 'all' || mode === 'phone') && data.phone) {
        if (!/^\d{10}$/.test(data.phone)) {
            return { valid: false, message: 'Please enter a valid 10-digit phone number' };
        }
    }
    
    if ((mode === 'all' || mode === 'email') && data.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            return { valid: false, message: 'Please enter a valid email address' };
        }
    }
    
    if (mode === 'address' && !data.address) {
        return { valid: false, message: 'Please enter your delivery address' };
    }
    
    return { valid: true };
}

// ==================== SETTINGS ====================
function handleNotificationToggle(event) {
    const enabled = event.target.checked;
    userData.notifications = enabled;
    
    const currentUser = auth.currentUser;
    if (currentUser) {
        db.collection('users').doc(currentUser.uid).update({
            notifications: enabled
        }).catch(err => console.error('Error updating notifications:', err));
    }
    
    showToast(enabled ? 'Notifications enabled' : 'Notifications disabled', 'info');
}

function openNotificationSettings() {
    const notificationToggle = DOM.notificationToggle || document.getElementById('notificationToggle');
    if (notificationToggle) {
        notificationToggle.checked = !notificationToggle.checked;
        notificationToggle.dispatchEvent(new Event('change'));
    }
}

function shareApp() {
    const shareData = {
        title: 'FreshMart - Online Grocery Store',
        text: 'Check out FreshMart for fresh groceries!',
        url: window.location.origin
    };
    
    if (navigator.share) {
        navigator.share(shareData)
            .then(() => showToast('Thanks for sharing!', 'success'))
            .catch((error) => {
                if (error.name !== 'AbortError') {
                    fallbackShare(shareData);
                }
            });
    } else {
        fallbackShare(shareData);
    }
}

function fallbackShare(shareData) {
    const shareText = `${shareData.title}\n${shareData.text}\n${shareData.url}`;
    navigator.clipboard.writeText(shareText)
        .then(() => showToast('Link copied to clipboard!', 'success'))
        .catch(() => showToast('Unable to share.', 'error'));
}

function rateApp() {
    showToast('Thank you for your feedback! ⭐', 'success');
}

// ==================== LOGOUT ====================
function handleLogout() {
    const confirmed = confirm('Are you sure you want to logout?');
    if (!confirmed) return;
    
    showLoading();
    
    auth.signOut().then(() => {
        localStorage.removeItem(STORAGE_KEYS.USER);
        
        hideLoading();
        showToast('Logged out successfully!', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }).catch((error) => {
        hideLoading();
        console.error('Logout error:', error);
        showToast('Error logging out', 'error');
    });
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'success') {
    const toast = DOM.toast || document.getElementById('toast');
    const toastMessage = DOM.toastMessage || document.getElementById('toastMessage');
    const toastIcon = DOM.toastIcon || document.getElementById('toastIcon');
    
    if (!toast || !toastMessage || !toastIcon) return;
    
    toastMessage.textContent = message;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-circle'
    };
    
    toastIcon.className = `fas ${icons[type] || icons.success}`;
    toast.className = 'toast';
    toast.classList.add(type, 'show');
    
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(hideToast, 4000);
}

function hideToast() {
    const toast = DOM.toast || document.getElementById('toast');
    if (toast) {
        toast.classList.remove('show');
    }
    clearTimeout(window.toastTimeout);
}

// ==================== LOADING OVERLAY ====================
function showLoading() {
    const loadingOverlay = DOM.loadingOverlay || document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
    }
}

function hideLoading() {
    const loadingOverlay = DOM.loadingOverlay || document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

// ==================== DEBUG FUNCTIONS ====================
window.testSavings = function(amount = 150) {
    console.log('🧪 Testing savings with amount:', amount);
    
    const element = document.getElementById('totalSavings');
    console.log('Element found:', element);
    
    if (element) {
        element.textContent = formatCurrency(amount);
        console.log('✅ DOM updated to:', formatCurrency(amount));
    } else {
        console.error('❌ totalSavings element not found!');
    }
};

window.addDemoSavings = async function() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.error('No user logged in');
        return;
    }
    
    try {
        await db.collection('users').doc(currentUser.uid).update({
            totalSavings: 250,
            orders: [
                {
                    id: '12345',
                    date: new Date().toISOString(),
                    total: 500,
                    discount: 50,
                    status: 'delivered',
                    items: [
                        { name: 'Apples', price: 100, originalPrice: 120, quantity: 2 },
                        { name: 'Milk', price: 50, originalPrice: 60, quantity: 1 }
                    ]
                }
            ]
        });
        
        console.log('✅ Demo data added! Refreshing...');
        window.location.reload();
    } catch (error) {
        console.error('Error adding demo data:', error);
    }
};

window.debugProfile = function() {
    console.log('========== DEBUG INFO ==========');
    console.log('userData:', userData);
    console.log('DOM.totalSavings:', DOM.totalSavings);
    console.log('Direct query:', document.getElementById('totalSavings'));
    console.log('auth.currentUser:', auth.currentUser);
    console.log('================================');
};

// ==================== GLOBAL EXPORTS ====================
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.removePhoto = removePhoto;
window.handleLogout = handleLogout;
window.viewOrderDetails = viewOrderDetails;
window.openNotificationSettings = openNotificationSettings;
window.shareApp = shareApp;
window.rateApp = rateApp;
window.hideToast = hideToast;

console.log('%c👤 FreshMart Profile', 'color: #2e7d32; font-size: 16px; font-weight: bold;');
console.log('%cProfile management ready!', 'color: #666; font-size: 12px;');
console.log('%c💡 Debug: Run debugProfile(), testSavings(100), or addDemoSavings() in console', 'color: #1976d2;');
