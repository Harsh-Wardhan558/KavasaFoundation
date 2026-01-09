// Wait for Firebase to be initialized
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to be ready
    if (!window.firebaseReady) {
        await new Promise(resolve => {
            window.addEventListener('firebaseReady', resolve, { once: true });
            // Timeout after 5 seconds
            setTimeout(resolve, 5000);
        });
    }

    // Additional small delay to ensure everything is loaded
    await new Promise(resolve => setTimeout(resolve, 100));

    const loginContainer = document.getElementById('loginContainer');
    const adminPanel = document.getElementById('adminPanel');
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const errorMessage = document.getElementById('errorMessage');
    const adminList = document.getElementById('adminList');
    const failedList = document.getElementById('failedList');
    const otherList = document.getElementById('otherList');
    const refreshBtn = document.getElementById('refreshBtn');
    const exportBtn = document.getElementById('exportBtn');
    const exportSuccessfulBtn = document.getElementById('exportSuccessfulBtn');
    const exportFailedBtn = document.getElementById('exportFailedBtn');
    const exportOtherBtn = document.getElementById('exportOtherBtn');
    const successfulTotalAmountEl = document.getElementById('successfulTotalAmount');

    // Coupon Management Elements
    const couponList = document.getElementById('couponList');
    const addCouponBtn = document.getElementById('addCouponBtn');
    const addCouponModal = document.getElementById('addCouponModal');
    const modalOverlay = document.getElementById('modalOverlay');
    const addCouponForm = document.getElementById('addCouponForm');
    const cancelCouponBtn = document.getElementById('cancelCouponBtn');
    const couponFilter = document.getElementById('couponFilter');
    const couponError = document.getElementById('couponError');

    // Coupon Entries Elements
    const couponAppliedList = document.getElementById('couponAppliedList');
    const couponEntriesFilter = document.getElementById('couponEntriesFilter');
    const exportCouponEntriesBtn = document.getElementById('exportCouponEntriesBtn');

    // Store registration arrays globally for export functions
    let currentSuccessfulRegistrations = [];
    let currentFailedRegistrations = [];
    let currentOtherRegistrations = [];
    let currentCoupons = [];
    let currentCouponAppliedRegistrations = [];

    // Check authentication state
    if (window.firebaseOnAuthStateChanged) {
        window.firebaseOnAuthStateChanged(window.firebaseAuth, async (user) => {
            if (user) {
                // User is signed in, verify they are admin
                try {
                    const adminDoc = await window.firebaseGetDoc(
                        window.firebaseDoc(window.firebaseDb, 'users', 'admin')
                    );

                    if (adminDoc.exists() && adminDoc.data().email === user.email) {
                        // User is admin, show admin panel
                        loginContainer.classList.add('hidden');
                        adminPanel.classList.remove('hidden');
                        await loadRegistrations();
                        await loadCoupons();
                    } else {
                        // User is not admin, sign them out
                        await window.firebaseSignOut(window.firebaseAuth);
                        showError('Access denied. You are not authorized as admin.');
                    }
                } catch (error) {
                    console.error('Error checking admin status:', error);
                    showError('Error verifying admin access.');
                }
            } else {
                // User is signed out, show login
                loginContainer.classList.remove('hidden');
                adminPanel.classList.add('hidden');
            }
        });
    }

    // Login form handler
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideError();

            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;

            if (!email || !password) {
                showError('Please enter both email and password.');
                return;
            }

            try {
                loginForm.classList.add('loading');
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
                submitBtn.disabled = true;

                // First, check if admin exists in Firestore
                let adminDoc;
                try {
                    adminDoc = await window.firebaseGetDoc(
                        window.firebaseDoc(window.firebaseDb, 'users', 'admin')
                    );
                } catch (error) {
                    console.error('Error fetching admin doc:', error);
                    throw new Error('Error accessing admin database. Please contact administrator.');
                }

                if (!adminDoc.exists()) {
                    throw new Error('Admin user not found in database. Please contact administrator to set up admin account.');
                }

                const adminData = adminDoc.data();
                if (!adminData.email || adminData.email !== email) {
                    throw new Error('Invalid email or password.');
                }

                // Try to sign in with Firebase Auth
                try {
                    await window.firebaseSignIn(window.firebaseAuth, email, password);
                    // Auth state change handler will take care of showing admin panel
                } catch (authError) {
                    // If user doesn't exist in Auth, we might need to create them
                    // For now, just show error
                    if (authError.code === 'auth/user-not-found') {
                        throw new Error('User account not found. Please contact administrator.');
                    } else if (authError.code === 'auth/wrong-password') {
                        throw new Error('Invalid email or password.');
                    } else {
                        throw new Error('Authentication failed: ' + authError.message);
                    }
                }
            } catch (error) {
                console.error('Login error:', error);
                showError(error.message || 'Login failed. Please try again.');
            } finally {
                loginForm.classList.remove('loading');
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
                submitBtn.disabled = false;
            }
        });
    }

    // Logout handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await window.firebaseSignOut(window.firebaseAuth);
                loginForm.reset();
                hideError();
            } catch (error) {
                console.error('Logout error:', error);
                showError('Error signing out. Please try again.');
            }
        });
    }

    //Resend Email
    window.resendEmail = async function (email, orderId, paymentId, registrationData, amount) {
        try {
            const payload = {
                email: email,
                orderId: orderId,
                registrationData: {
                    name: registrationData.name || 'N/A',
                    email: email,
                    phone: registrationData.phone || 'N/A',
                    category: registrationData.category || 'N/A',
                    age: registrationData.age || 0,
                    gender: registrationData.gender || 'N/A',
                    tshirtSize: registrationData.tshirtSize || 'N/A'
                },
                paymentData: {
                    razorpay_payment_id: paymentId || 'N/A',
                    status: 'success',
                    amount: amount,
                    finalAmount: amount
                },
                eventInfo: {
                    title: 'Agilisium Madras Marathon 2026',
                    date: '8th February 2026',
                    location: 'Presidency College, Chennai'
                }
            };

            const response = await fetch(
                'https://generateandsendpdf-3c2ivlmw3a-uc.a.run.app',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );

            if (response.ok) {
                alert(`… Email resent to ${email}`);
            } else {
                const err = await response.text();
                alert(`âŒ Failed to resend email\n${err}`);
            }
        } catch (error) {
            console.error('Resend email error:', error);
            alert(`âŒ Error: ${error.message}`);
        }
    }



    // Helper function to handle authorized payment and send email
    window.handleAuthorizedPayment = async function (registrationId, paymentId, amount, registrationDataStr, buttonId) {
        const button = document.getElementById(buttonId);
        const originalContent = button.innerHTML;

        try {
            // Show loader
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

            const registrationData = JSON.parse(decodeURIComponent(registrationDataStr));
            const email = registrationData.email;

            // 1. Update Firestore status to 'captured'
            const docRef = window.firebaseDoc(window.firebaseDb, 'marathon_registrations', registrationId);
            await window.firebaseUpdateDoc(docRef, {
                status: 'captured',
                updatedAt: new Date(),
                statusUpdatedBy: 'admin_panel'
            });

            // 2. Send Email
            // Construct payload similar to resendEmail but we handle the response differently
            const payload = {
                email: email,
                orderId: registrationData.razorpay_order_id || 'N/A', // Assuming it's in registrationData or we might need to pass it
                registrationData: {
                    name: registrationData.name || 'N/A',
                    email: email,
                    phone: registrationData.phone || 'N/A',
                    category: registrationData.category || 'N/A',
                    age: registrationData.age || 0,
                    gender: registrationData.gender || 'N/A',
                    tshirtSize: registrationData.tshirtSize || 'N/A'
                },
                paymentData: {
                    razorpay_payment_id: paymentId || 'N/A',
                    status: 'success',
                    amount: amount,
                    finalAmount: amount
                },
                eventInfo: {
                    title: 'Agilisium Madras Marathon 2026',
                    date: '8th February 2026',
                    location: 'Presidency College, Chennai'
                }
            };

            console.log('Sending email payload:', payload);

            const response = await fetch(
                'https://generateandsendpdf-3c2ivlmw3a-uc.a.run.app',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Email sending failed: ${err}`);
            }

            // Success
            alert(`… Payment captured and email sent to ${email} successfully!`);

            // Refresh the list to move the item
            const refreshBtn = document.getElementById('refreshBtn');
            if (refreshBtn) refreshBtn.click();

        } catch (error) {
            console.error('Error handling authorized payment:', error);
            alert(`âŒ Error: ${error.message}`);
            // Revert button
            button.disabled = false;
            button.innerHTML = originalContent;
        }
    };

    // Pagination State
    let pageSuccessful = 1;
    let pageFailed = 1;
    let pageOther = 1;
    let pageCouponEntries = 1;
    const ITEMS_PER_PAGE = 100;

    // Generic Render with Pagination
    function renderPaginatedList(data, container, page, setPageCallback, renderItemFn, emptyMsg, type) {
        if (!container) return;
        if (data.length === 0) {
            container.innerHTML = `
                <div class="admin-list-placeholder">
                    <i class="fas fa-inbox" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                    <p>${emptyMsg}</p>
                </div>
            `;
            return;
        }

        const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
        // Ensure current page is valid
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        const start = (page - 1) * ITEMS_PER_PAGE;
        const end = Math.min(start + ITEMS_PER_PAGE, data.length);
        const slice = data.slice(start, end);

        let html = `
            <div style="margin-bottom: 1rem; font-weight: var(--font-semibold); color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center;">
                <span>Total: ${data.length} records</span>
                <span>Showing ${start + 1}-${end}</span>
            </div>
        `;

        slice.forEach((item, idx) => {
            html += renderItemFn(item, start + idx + 1);
        });

        // Pagination Controls
        if (totalPages > 1) {
            html += `
                <div class="pagination-controls" style="display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--gray-200);">
                    <button class="pagination-btn prev-btn" ${page === 1 ? 'disabled' : ''} style="padding: 0.5rem 1.5rem; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; opacity: ${page === 1 ? '0.5' : '1'}; transition: opacity 0.2s;">
                        <i class="fas fa-chevron-left"></i> Previous
                    </button>
                    <span style="font-weight: 500; color: var(--text-primary);">Page ${page} of ${totalPages}</span>
                    <button class="pagination-btn next-btn" ${page === totalPages ? 'disabled' : ''} style="padding: 0.5rem 1.5rem; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; opacity: ${page === totalPages ? '0.5' : '1'}; transition: opacity 0.2s;">
                        Next <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            `;
        }

        container.innerHTML = html;

        // Attach event listeners using closure for callback
        const prevBtn = container.querySelector('.prev-btn');
        const nextBtn = container.querySelector('.next-btn');

        if (prevBtn) {
            prevBtn.onclick = () => setPageCallback(page - 1);
        }
        if (nextBtn) {
            nextBtn.onclick = () => setPageCallback(page + 1);
        }
    }

    // Item Renderers
    function getTimestamp(docData) {
        let timestamp = docData.createdAt || docData.timestamp || (docData.registrationData && docData.registrationData.timestamp);
        if (timestamp) {
            return timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        }
        return new Date();
    }

    function formatDate(date) {
        return date.toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function renderSuccessfulItem(reg, index) {
        const docData = reg.data;
        const data = docData.registrationData || docData || {};
        const amount = docData.amount != null ? docData.amount : (data.amount != null ? data.amount : 0);
        const registrationId = reg.id;
        const orderId = docData.razorpay_order_id;
        const paymentId = docData.razorpay_payment_id;
        const couponCode = docData.couponApplied || '-';
        const formattedDate = formatDate(getTimestamp(docData));

        return `
            <div class="registration-item">
                <div class="registration-number">#${index}</div>
                <div class="registration-details">
                    <h3>${data.name || 'N/A'}</h3>
                    <div class="registration-meta">
                        <span><i class="fas fa-envelope"></i> ${data.email || 'N/A'}</span>
                        <span><i class="fas fa-phone"></i> ${data.phone || 'N/A'}</span>
                        <span><i class="fas fa-birthday-cake"></i> Age: ${data.age || 'N/A'}</span>
                        <span><i class="fas fa-venus-mars"></i> ${data.gender || 'N/A'}</span>
                        <span><i class="fas fa-tshirt"></i> Size: ${data.tshirtSize || 'N/A'}</span>
                        <span><i class="fas fa-tag"></i> Coupon: ${couponCode}</span>
                        <span><i class="fas fa-calendar"></i> ${formattedDate}</span>
                    </div>
                </div>
                <div>
                    <span class="registration-category">${(data.category || 'N/A').toUpperCase()}</span>
                    <div style="margin-top: 0.5rem; font-weight: var(--font-semibold); color: var(--text-primary);">₹${amount}</div>
                    <button class="resend-btn" onclick="resendEmail('${data.email}', '${orderId}', '${paymentId}', ${JSON.stringify(data).replace(/"/g, '&quot;')}, ${amount})">
                        <i class="fas fa-envelope"></i> Resend Email
                    </button>
                </div>
            </div>
        `;
    }

    function renderFailedItem(reg, index) {
        const docData = reg.data;
        const data = docData.registrationData || docData || {};
        const amount = docData.amount != null ? docData.amount : (data.amount != null ? data.amount : 0);
        const formattedDate = formatDate(getTimestamp(docData));

        return `
            <div class="registration-item">
                <div class="registration-number">#${index}</div>
                <div class="registration-details">
                    <h3>${data.name || 'N/A'}</h3>
                    <div class="registration-meta">
                        <span><i class="fas fa-envelope"></i> ${data.email || 'N/A'}</span>
                        <span><i class="fas fa-phone"></i> ${data.phone || 'N/A'}</span>
                        <span><i class="fas fa-tshirt"></i> Size: ${data.tshirtSize || 'N/A'}</span>
                        <span><i class="fas fa-calendar"></i> ${formattedDate}</span>
                        <span><i class="fas fa-exclamation-circle" style="color:#dc2626;"></i> Status: ${docData.status || 'failed'}</span>
                    </div>
                </div>
                <div>
                    <span class="registration-category" style="background: linear-gradient(135deg,#dc2626,#b91c1c);">FAILED</span>
                    <div style="margin-top: 0.5rem; font-weight: var(--font-semibold); color: var(--text-primary);">₹${amount}</div>
                </div>
            </div>
        `;
    }

    function renderOtherItem(reg, index) {
        const docData = reg.data;
        const data = docData.registrationData || docData || {};
        const amount = docData.amount != null ? docData.amount : (data.amount != null ? data.amount : 0);
        const formattedDate = formatDate(getTimestamp(docData));
        const statusText = docData.status || 'unknown';
        const btnId = `btn-${reg.id}`;

        return `
            <div class="registration-item">
                <div class="registration-number">#${index}</div>
                <div class="registration-details">
                    <h3>${data.name || 'N/A'}</h3>
                    <div class="registration-meta">
                        <span><i class="fas fa-envelope"></i> ${data.email || 'N/A'}</span>
                        <span><i class="fas fa-phone"></i> ${data.phone || 'N/A'}</span>
                        <span><i class="fas fa-calendar"></i> ${formattedDate}</span>
                        <span><i class="fas fa-info-circle" style="color:#f59e0b;"></i> Status: ${statusText}</span>
                    </div>
                </div>
                <div>
                    <span class="registration-category" style="background: linear-gradient(135deg,#f59e0b,#d97706);">OTHER</span>
                    <div style="margin-top: 0.5rem; font-weight: var(--font-semibold); color: var(--text-primary);">₹${amount}</div>
                    ${statusText === 'authorized' ? `
                    <button id="${btnId}" class="resend-btn" style="background: #059669; margin-top: 0.5rem; width: 100%;"
                        onclick="handleAuthorizedPayment('${reg.id}', '${docData.razorpay_payment_id || ''}', '${amount}', '${encodeURIComponent(JSON.stringify(data))}', '${btnId}')">
                        <i class="fas fa-check-circle"></i> Approve & Send Email
                    </button>` : ''}
                </div>
            </div>
        `;
    }

    // Load registrations from Firestore (successful + failed + other statuses)
    async function loadRegistrations() {
        try {
            if (adminList) {
                adminList.innerHTML = `
                    <div class="admin-list-placeholder">
                        <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                        <p>Loading successful payments...</p>
                    </div>
                `;
            }

            if (failedList) {
                failedList.innerHTML = `
                    <div class="admin-list-placeholder">
                        <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                        <p>Loading failed payments...</p>
                    </div>
                `;
            }

            if (otherList) {
                otherList.innerHTML = `
                    <div class="admin-list-placeholder">
                        <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                        <p>Loading other status records...</p>
                    </div>
                `;
            }

            if (couponAppliedList) {
                couponAppliedList.innerHTML = `
                    <div class="admin-list-placeholder">
                        <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                        <p>Loading coupon entries...</p>
                    </div>
                `;
            }

            const registrationsRef = window.firebaseCollection(window.firebaseDb, 'marathon_registrations');
            // Fetch all documents without ordering (we'll sort client-side)
            // This avoids Firestore errors if timestamp field is missing or inconsistent
            const querySnapshot = await window.firebaseGetDocs(registrationsRef);
            console.log("Query Snapshot", querySnapshot);

            if (querySnapshot.empty) {
                // Reset arrays when no data
                currentSuccessfulRegistrations = [];
                currentFailedRegistrations = [];
                currentOtherRegistrations = [];
                currentCouponAppliedRegistrations = [];

                // Reset total amount display
                if (successfulTotalAmountEl) {
                    successfulTotalAmountEl.textContent = '₹0';
                }

                if (adminList) {
                    adminList.innerHTML = `
                        <div class="admin-list-placeholder">
                            <i class="fas fa-inbox" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                            <p>No successful payments found yet.</p>
                        </div>
                    `;
                }

                if (failedList) {
                    failedList.innerHTML = `
                        <div class="admin-list-placeholder">
                            <i class="fas fa-inbox" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                            <p>No failed payments found yet.</p>
                        </div>
                    `;
                }

                if (otherList) {
                    otherList.innerHTML = `
                        <div class="admin-list-placeholder">
                            <i class="fas fa-inbox" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                            <p>No other status records found yet.</p>
                        </div>
                    `;
                }
                if (couponAppliedList) {
                    couponAppliedList.innerHTML = `
                        <div class="admin-list-placeholder">
                            <i class="fas fa-ticket-alt" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                            <p>No coupon entries found yet.</p>
                        </div>
                    `;
                }
                return;
            }

            // Split into successful, failed and other based on status
            const successfulRegistrations = [];
            const failedRegistrations = [];
            const otherRegistrations = [];
            const couponAppliedRegistrations = [];

            querySnapshot.forEach((doc) => {
                const docData = doc.data();
                if (docData.status === 'captured') {
                    successfulRegistrations.push({ id: doc.id, data: docData });
                    if (docData.couponApplied) {
                        couponAppliedRegistrations.push({ id: doc.id, data: docData });
                    }
                } else if (docData.status === 'failed') {
                    failedRegistrations.push({ id: doc.id, data: docData });
                } else {
                    otherRegistrations.push({ id: doc.id, data: docData });
                }
            });

            const totalCount = querySnapshot.size;
            const countedTotal = successfulRegistrations.length + failedRegistrations.length + otherRegistrations.length;
            console.log("Successful registrations", successfulRegistrations.length);
            console.log("Failed registrations", failedRegistrations.length);
            console.log("Other registrations", otherRegistrations.length);
            console.log("Total from snapshot", totalCount, "Sum of buckets", countedTotal, "Match:", totalCount === countedTotal);

            // Store in global variables for export functions
            currentSuccessfulRegistrations = successfulRegistrations;
            currentFailedRegistrations = failedRegistrations;
            currentOtherRegistrations = otherRegistrations;

            // Calculate total amount from successful payments
            let totalSuccessfulAmount = 0;
            successfulRegistrations.forEach((reg) => {
                const docData = reg.data || {};
                const data = docData.registrationData || docData || {};
                const amount = docData.amount != null ? docData.amount : (data.amount != null ? data.amount : 0);
                const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
                if (!isNaN(numericAmount)) {
                    totalSuccessfulAmount += numericAmount;
                }
            });

            if (successfulTotalAmountEl) {
                successfulTotalAmountEl.textContent = `₹${totalSuccessfulAmount.toLocaleString('en-IN')}`;
            }

            const sortByTimestampDesc = (a, b) => {
                const timestampA = a.data.timestamp || (a.data.registrationData && a.data.registrationData.timestamp);
                const timestampB = b.data.timestamp || (b.data.registrationData && b.data.registrationData.timestamp);

                if (timestampA && timestampB) {
                    const dateA = timestampA.toDate ? timestampA.toDate() : new Date(timestampA);
                    const dateB = timestampB.toDate ? timestampB.toDate() : new Date(timestampB);
                    return dateB - dateA; // Descending order (newest first)
                }
                return 0;
            };

            // Sort by timestamp (newest first) if available
            successfulRegistrations.sort(sortByTimestampDesc);
            failedRegistrations.sort(sortByTimestampDesc);
            otherRegistrations.sort(sortByTimestampDesc);
            couponAppliedRegistrations.sort(sortByTimestampDesc);

            // Store in global variables with logic for render
            currentCouponAppliedRegistrations = couponAppliedRegistrations;
            renderCouponAppliedList(couponAppliedRegistrations);

            // Generic update wrappers for closures to handle state updates
            const updateSuccessful = () => {
                renderPaginatedList(
                    successfulRegistrations,
                    adminList,
                    pageSuccessful,
                    (p) => { pageSuccessful = p; updateSuccessful(); },
                    renderSuccessfulItem,
                    'No successful payments found. Only registrations with status "captured" are displayed here.',
                    'successful'
                );
            };

            const updateFailed = () => {
                renderPaginatedList(
                    failedRegistrations,
                    failedList,
                    pageFailed,
                    (p) => { pageFailed = p; updateFailed(); },
                    renderFailedItem,
                    'No failed payments found. Only registrations with status "failed" are displayed here.',
                    'failed'
                );
            };

            const updateOther = () => {
                // Render other status records (Original Logic)
                if (otherList) {
                    if (otherRegistrations.length === 0) {
                        otherList.innerHTML = `
                        <div class="admin-list-placeholder">
                            <i class="fas fa-inbox" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                            <p>No other status records found. Only registrations with status not "captured" or "failed" are displayed here.</p>
                        </div>
                    `;
                    } else {
                        let htmlOther = '';
                        htmlOther += `
                        <div style="margin-bottom: 1rem; font-weight: var(--font-semibold); color: var(--text-secondary);">
                            Total other status records: ${otherRegistrations.length}
                        </div>
                    `;
                        let otherIndex = 1;
                        otherRegistrations.forEach((reg) => {
                            const amount = reg.data.amount;
                            const docData = reg.data;
                            const registrationId = reg.id;

                            const data = docData.registrationData || docData || {};

                            let timestamp = docData.createdAt || docData.timestamp || (data && data.timestamp);
                            if (timestamp) {
                                timestamp = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                            } else {
                                timestamp = new Date();
                            }
                            const formattedDate = timestamp.toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });

                            const statusText = docData.status || 'unknown';
                            const btnId = `btn-${registrationId}`;

                            htmlOther += `
                            <div class="registration-item">
                                <div class="registration-number">#${otherIndex}</div>
                                <div class="registration-details">
                                    <h3>${data.name || 'N/A'}</h3>
                                    <div class="registration-meta">
                                        <span><i class="fas fa-envelope"></i> ${data.email || 'N/A'}</span>
                                        <span><i class="fas fa-phone"></i> ${data.phone || 'N/A'}</span>
                                        <span><i class="fas fa-birthday-cake"></i> Age: ${data.age || 'N/A'}</span>
                                        <span><i class="fas fa-venus-mars"></i> ${data.gender || 'N/A'}</span>
                                        <span><i class="fas fa-tshirt"></i> Size: ${data.tshirtSize || 'N/A'}</span>
                                        <span><i class="fas fa-calendar"></i> ${formattedDate}</span>
                                        <span><i class="fas fa-info-circle" style="color:#f59e0b;"></i> Status: ${statusText}</span>
                                    </div>
                                </div>
                                <div>
                                    <span class="registration-category" style="background: linear-gradient(135deg,#f59e0b,#d97706);">OTHER</span>
                                    <div style="margin-top: 0.5rem; font-weight: var(--font-semibold); color: var(--text-primary);">
                                        ₹${amount}
                                    </div>
                                    ${statusText === 'authorized' ? `
                                    <button 
                                        id="${btnId}"
                                        class="resend-btn"
                                        style="background: #059669; margin-top: 0.5rem; width: 100%;"
                                        onclick="handleAuthorizedPayment(
                                            '${registrationId}', 
                                            '${docData.razorpay_payment_id || ''}', 
                                            '${amount}',
                                            '${encodeURIComponent(JSON.stringify(data))}',
                                            '${btnId}'
                                        )">
                                        <i class="fas fa-check-circle"></i> Approve & Send Email
                                    </button>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                            otherIndex++;
                        });

                        otherList.innerHTML = htmlOther;
                    }
                }
            };

            // Initial Render
            updateSuccessful();
            updateFailed();
            updateOther();
        } catch (error) {
            console.error('Error loading registrations:', error);
            if (adminList) {
                adminList.innerHTML = `
                    <div class="admin-list-placeholder">
                        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #dc2626; margin-bottom: 1rem; display: block;"></i>
                        <p>Error loading successful payments: ${error.message}</p>
                    </div>
                `;
            }
            if (failedList) {
                failedList.innerHTML = `
                    <div class="admin-list-placeholder">
                        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #dc2626; margin-bottom: 1rem; display: block;"></i>
                        <p>Error loading failed payments: ${error.message}</p>
                    </div>
                `;
            }
            if (otherList) {
                otherList.innerHTML = `
                    <div class="admin-list-placeholder">
                        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #dc2626; margin-bottom: 1rem; display: block;"></i>
                        <p>Error loading other status records: ${error.message}</p>
                    </div>
                `;
            }
        }
    }

    // Refresh button handler
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.disabled = true;
            const originalText = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            await loadRegistrations();
            await loadCoupons();
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        });
    }

    // Export button handler
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            try {
                exportBtn.disabled = true;
                const originalText = exportBtn.innerHTML;
                exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';

                const registrationsRef = window.firebaseCollection(window.firebaseDb, 'marathon_registrations');
                // Fetch all documents without ordering (we'll sort client-side)
                // This avoids Firestore errors if timestamp field is missing or inconsistent
                const querySnapshot = await window.firebaseGetDocs(registrationsRef);

                if (querySnapshot.empty) {
                    alert('No registrations to export.');
                    exportBtn.innerHTML = originalText;
                    exportBtn.disabled = false;
                    return;
                }

                // Convert to CSV - filter by status "captured"
                let csv = 'Name,Email,Phone,Age,Gender,Category,T-Shirt Size,Amount,Registration Date\n';
                let hasCapturedData = false;

                querySnapshot.forEach((doc) => {
                    const docData = doc.data();
                    // Only export registrations with status "captured"
                    if (docData.status === 'captured') {
                        hasCapturedData = true;
                        // Get registration data from registrationData field
                        const data = docData.registrationData || docData;

                        // Format timestamp - check both document level and registrationData level
                        let timestamp = docData.timestamp || data.timestamp;
                        if (timestamp) {
                            timestamp = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                        } else {
                            timestamp = new Date();
                        }
                        const formattedDate = timestamp.toLocaleString('en-IN');

                        csv += `"${data.name || ''}","${data.email || ''}","${data.phone || ''}",${data.age || ''},"${data.gender || ''}","${data.category || ''}","${data.tshirtSize || ''}",${data.amount || 0},"${formattedDate}"\n`;
                    }
                });

                if (!hasCapturedData) {
                    alert('No captured registrations to export.');
                    exportBtn.innerHTML = originalText;
                    exportBtn.disabled = false;
                    return;
                }

                // Download CSV
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `marathon_registrations_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                exportBtn.innerHTML = originalText;
                exportBtn.disabled = false;
            } catch (error) {
                console.error('Export error:', error);
                alert('Error exporting data: ' + error.message);
                exportBtn.innerHTML = originalText;
                exportBtn.disabled = false;
            }
        });
    }

    // Reusable export function
    function exportRegistrations(registrations, filename, categoryName) {
        if (!registrations || registrations.length === 0) {
            alert(`No ${categoryName} to export.`);
            return;
        }

        // Convert to CSV
        let csv = 'Name,Email,Phone,Age,Gender,Category,T-Shirt Size,Amount,Status,Coupon Code,Registration Date\n';

        registrations.forEach((reg) => {
            const docData = reg.data;
            const data = docData.registrationData || docData || {};

            // Format timestamp
            let timestamp = docData.createdAt || docData.timestamp || (data && data.timestamp);
            if (timestamp) {
                timestamp = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            } else {
                timestamp = new Date();
            }
            const formattedDate = timestamp.toLocaleString('en-IN');

            const statusText = docData.status || 'unknown';
            const amount = docData.amount || data.amount || 0;
            const couponCode = docData.couponApplied || '';

            csv += `"${data.name || ''}","${data.email || ''}","${data.phone || ''}",${data.age || ''},"${data.gender || ''}","${data.category || ''}","${data.tshirtSize || ''}",${amount},"${statusText}","${couponCode}","${formattedDate}"\n`;
        });

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    // Export Successful Payments button handler
    if (exportSuccessfulBtn) {
        exportSuccessfulBtn.addEventListener('click', async () => {
            try {
                exportSuccessfulBtn.disabled = true;
                const originalText = exportSuccessfulBtn.innerHTML;
                exportSuccessfulBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';

                exportRegistrations(
                    currentSuccessfulRegistrations,
                    `successful_payments_${new Date().toISOString().split('T')[0]}.csv`,
                    'successful payments'
                );

                exportSuccessfulBtn.innerHTML = originalText;
                exportSuccessfulBtn.disabled = false;
            } catch (error) {
                console.error('Export successful payments error:', error);
                alert('Error exporting successful payments: ' + error.message);
                exportSuccessfulBtn.innerHTML = '<i class="fas fa-download"></i> Export Successful Payments';
                exportSuccessfulBtn.disabled = false;
            }
        });
    }

    // Export Failed Payments button handler
    if (exportFailedBtn) {
        exportFailedBtn.addEventListener('click', async () => {
            try {
                exportFailedBtn.disabled = true;
                const originalText = exportFailedBtn.innerHTML;
                exportFailedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';

                exportRegistrations(
                    currentFailedRegistrations,
                    `failed_payments_${new Date().toISOString().split('T')[0]}.csv`,
                    'failed payments'
                );

                exportFailedBtn.innerHTML = originalText;
                exportFailedBtn.disabled = false;
            } catch (error) {
                console.error('Export failed payments error:', error);
                alert('Error exporting failed payments: ' + error.message);
                exportFailedBtn.innerHTML = '<i class="fas fa-download"></i> Export Failed Payments';
                exportFailedBtn.disabled = false;
            }
        });
    }

    // Export Other Status button handler
    if (exportOtherBtn) {
        exportOtherBtn.addEventListener('click', async () => {
            try {
                exportOtherBtn.disabled = true;
                const originalText = exportOtherBtn.innerHTML;
                exportOtherBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';

                exportRegistrations(
                    currentOtherRegistrations,
                    `other_status_${new Date().toISOString().split('T')[0]}.csv`,
                    'other status records'
                );

                exportOtherBtn.innerHTML = originalText;
                exportOtherBtn.disabled = false;
            } catch (error) {
                console.error('Export other status error:', error);
                alert('Error exporting other status records: ' + error.message);
                exportOtherBtn.innerHTML = '<i class="fas fa-download"></i> Export Other Status';
                exportOtherBtn.disabled = false;
            }
        });
    }

    /* ------------------------------
       COUPON MANAGEMENT LOGIC
    ------------------------------ */

    // Show Modal
    if (addCouponBtn) {
        addCouponBtn.addEventListener('click', () => {
            addCouponModal.style.display = 'block';
            modalOverlay.style.display = 'block';
            addCouponForm.reset();
            couponError.style.display = 'none';
        });
    }

    // Hide Modal function
    function hideCouponModal() {
        if (addCouponModal) addCouponModal.style.display = 'none';
        if (modalOverlay) modalOverlay.style.display = 'none';
    }

    // Cancel Button
    if (cancelCouponBtn) {
        cancelCouponBtn.addEventListener('click', hideCouponModal);
    }

    // Overlay Click
    if (modalOverlay) {
        modalOverlay.addEventListener('click', hideCouponModal);
    }

    // Add Coupon Form Submit
    if (addCouponForm) {
        addCouponForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nameField = document.getElementById('couponName');
            const discountField = document.getElementById('couponDiscount');
            const limitField = document.getElementById('couponLimit');

            const name = nameField.value.trim().toUpperCase();
            const discount = parseFloat(discountField.value);
            const limit = limitField.value ? parseInt(limitField.value) : null;

            if (!name) {
                showCouponError('Please enter a coupon code.');
                return;
            }

            if (isNaN(discount) || discount < 0 || discount > 100) {
                showCouponError('Please enter a valid discount percentage (0-100).');
                return;
            }

            try {
                const btn = addCouponForm.querySelector('button[type="submit"]');
                const originalText = btn.innerHTML;
                btn.innerHTML = 'Saving...';
                btn.disabled = true;

                // Check if coupon already exists in DB by ID (name is ID)
                const couponDocRef = window.firebaseDoc(window.firebaseDb, 'coupons', name);
                const couponDoc = await window.firebaseGetDoc(couponDocRef);

                if (couponDoc.exists()) {
                    throw new Error('Coupon code already exists.');
                }

                await window.firebaseSetDoc(couponDocRef, {
                    code: name, // Store redundantly just in case
                    discount: discount,
                    discountType: 'percentage', // New field
                    limit: limit,
                    usedCount: 0,
                    active: true, // Renamed from isActive
                    createdAt: new Date()
                });

                hideCouponModal();
                alert('… Coupon added successfully!');
                await loadCoupons(); // Refresh list

                btn.innerHTML = originalText;
                btn.disabled = false;
            } catch (error) {
                console.error('Error adding coupon:', error);
                showCouponError(error.message);
                const btn = addCouponForm.querySelector('button[type="submit"]');
                if (btn) {
                    btn.innerHTML = 'Save Coupon';
                    btn.disabled = false;
                }
            }
        });
    }

    function showCouponError(msg) {
        if (couponError) {
            couponError.textContent = msg;
            couponError.style.display = 'block';
        }
    }

    // Load Coupons
    async function loadCoupons() {
        if (!couponList) return;

        try {
            couponList.innerHTML = `
                <div class="admin-list-placeholder">
                    <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                    <p>Loading coupons...</p>
                </div>
            `;

            const couponsRef = window.firebaseCollection(window.firebaseDb, 'coupons');
            // Fetch all directly, ignoring sort order initially to ensure no filtering by field existence
            const querySnapshot = await window.firebaseGetDocs(couponsRef);

            const coupons = [];
            querySnapshot.forEach(doc => {
                coupons.push({ id: doc.id, data: doc.data() });
            });

            // Client side sort
            coupons.sort((a, b) => {
                const da = a.data.createdAt ? (a.data.createdAt.toDate ? a.data.createdAt.toDate() : new Date(a.data.createdAt)) : new Date(0);
                const db = b.data.createdAt ? (b.data.createdAt.toDate ? b.data.createdAt.toDate() : new Date(b.data.createdAt)) : new Date(0);
                return db - da;
            });

            currentCoupons = coupons;
            renderCoupons(coupons);

        } catch (error) {
            console.error('Error loading coupons:', error);
            couponList.innerHTML = `
                <div class="admin-list-placeholder">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #dc2626; margin-bottom: 1rem; display: block;"></i>
                    <p>Error loading coupons: ${error.message}</p>
                </div>
            `;
        }
    }

    // Render Coupons
    function renderCoupons(coupons) {
        if (!couponList) return;

        if (coupons.length === 0) {
            couponList.innerHTML = `
                <div class="admin-list-placeholder">
                    <i class="fas fa-ticket-alt" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                    <p>No coupons found. Create one to get started.</p>
                </div>
            `;
            return;
        }

        let html = '';
        coupons.forEach(coupon => {
            const data = coupon.data;
            const limitText = data.limit ? `${data.usedCount || 0} / ${data.limit}` : `${data.usedCount || 0} (No User Limit)`;
            const couponCode = coupon.id; // Use ID as the Code

            html += `
                <div class="registration-item" style="align-items: center; grid-template-columns: auto 1fr auto;">
                    <div class="registration-number" style="font-size: 1.2rem; color: var(--primary);">
                        <i class="fas fa-tag"></i>
                    </div>
                    <div class="registration-details">
                        <h3 style="margin-bottom: 0.25rem;">
                            ${couponCode} 
                            <span style="font-size: 0.75rem; color: #fff; background: ${data.active ? '#10b981' : '#6b7280'}; padding: 2px 8px; border-radius: 999px; margin-left: 0.5rem; vertical-align: middle;">
                                ${data.active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                        </h3>
                        <div class="registration-meta">
                            <span><i class="fas fa-percentage"></i> ${data.discount}% OFF</span>
                            <span><i class="fas fa-users"></i> Used: ${limitText}</span>
                            ${data.createdAt ? `<span><i class="fas fa-clock"></i> Created: ${data.createdAt.toDate ? data.createdAt.toDate().toLocaleDateString() : new Date(data.createdAt).toLocaleDateString()}</span>` : ''}
                        </div>
                    </div>
                    <div>
                         <button onclick="deleteCoupon('${coupon.id}')" class="resend-btn" style="background: #ef4444; margin-left: 0.5rem; width: auto; font-size: 0.8rem; padding: 0.4rem 0.8rem;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
             `;
        });

        couponList.innerHTML = html;
    }

    // Filter Logic for Coupons
    if (couponFilter) {
        couponFilter.addEventListener('input', (e) => {
            const term = e.target.value.trim().toUpperCase();
            if (!term) {
                renderCoupons(currentCoupons);
                return;
            }
            // Filter by ID instead of data.code
            const filtered = currentCoupons.filter(c => c.id.includes(term));
            renderCoupons(filtered);
        });
    }

    /* ------------------------------
       COUPON ENTRIES LIST LOGIC
    ------------------------------ */

    function renderCouponAppliedItem(reg, index) {
        const docData = reg.data;
        const data = docData.registrationData || docData || {};
        const amount = docData.amount || data.amount || 0;
        const couponCode = docData.couponApplied || '-';
        const formattedDate = formatDate(getTimestamp(docData));

        return `
            <div class="registration-item">
                <div class="registration-number" style="color: var(--primary);">#${index}</div>
                <div class="registration-details">
                    <h3>${data.name || 'N/A'} <span style="font-size: 0.8rem; background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 6px; margin-left: 0.5rem;"><i class="fas fa-ticket-alt"></i> ${couponCode}</span></h3>
                    <div class="registration-meta">
                        <span><i class="fas fa-envelope"></i> ${data.email || 'N/A'}</span>
                        <span><i class="fas fa-phone"></i> ${data.phone || 'N/A'}</span>
                        <span><i class="fas fa-calendar"></i> ${formattedDate}</span>
                    </div>
                </div>
                <div>
                    <span class="registration-category">${(data.category || 'N/A').toUpperCase()}</span>
                    <div style="margin-top: 0.5rem; font-weight: var(--font-semibold); color: var(--text-primary);">
                        ₹${amount}
                    </div>
                </div>
            </div>
        `;
    }

    function renderCouponAppliedList(list) {
        renderPaginatedList(
            list,
            couponAppliedList,
            pageCouponEntries,
            (p) => {
                pageCouponEntries = p;
                renderCouponAppliedList(list);
            },
            renderCouponAppliedItem,
            'No entries with coupons found.',
            'coupon_entries'
        );
    }



    // Filter Coupon Entries using the new filtered logic
    if (couponEntriesFilter) {
        couponEntriesFilter.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            if (!term) {
                renderCouponAppliedList(currentCouponAppliedRegistrations);
                return;
            }

            const filtered = currentCouponAppliedRegistrations.filter(reg => {
                const data = reg.data.registrationData || reg.data;
                const name = (data.name || '').toLowerCase();
                const email = (data.email || '').toLowerCase();
                const coupon = (reg.data.couponApplied || '').toLowerCase();
                return name.includes(term) || email.includes(term) || coupon.includes(term);
            });
            renderCouponAppliedList(filtered);
        });
    }

    // Export Coupon Entries
    if (exportCouponEntriesBtn) {
        exportCouponEntriesBtn.addEventListener('click', async () => {
            exportRegistrations(
                currentCouponAppliedRegistrations,
                'coupon_entries',
                'Coupon Entries'
            );
        });
    }

    // Delete Coupon (Expose to window)
    window.deleteCoupon = async function (id) {
        if (!confirm('Are you sure you want to delete this coupon? This cannot be undone.')) return;

        try {
            await window.firebaseDeleteDoc(window.firebaseDoc(window.firebaseDb, 'coupons', id));
            // Remove from local list
            currentCoupons = currentCoupons.filter(c => c.id !== id);
            // Re-render
            const term = couponFilter ? couponFilter.value.trim().toUpperCase() : '';
            if (term) {
                const filtered = currentCoupons.filter(c => c.id.includes(term));
                renderCoupons(filtered);
            } else {
                renderCoupons(currentCoupons);
            }
            alert('Coupon deleted.');
        } catch (error) {
            console.error('Error deleting coupon:', error);
            alert('Error deleting coupon: ' + error.message);
        }
    }

    // Helper functions
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
    }

    function hideError() {
        errorMessage.classList.remove('show');
        errorMessage.textContent = '';
    }
});


