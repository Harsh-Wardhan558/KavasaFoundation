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

    // Store registration arrays globally for export functions
    let currentSuccessfulRegistrations = [];
    let currentFailedRegistrations = [];
    let currentOtherRegistrations = [];

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

            const registrationsRef = window.firebaseCollection(window.firebaseDb, 'marathon_registrations');
            // Fetch all documents without ordering (we'll sort client-side)
            // This avoids Firestore errors if timestamp field is missing or inconsistent
            const querySnapshot = await window.firebaseGetDocs(registrationsRef);
            console.log("Query Snapshot",querySnapshot);

            if (querySnapshot.empty) {
                // Reset arrays when no data
                currentSuccessfulRegistrations = [];
                currentFailedRegistrations = [];
                currentOtherRegistrations = [];

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
                return;
            }

            // Split into successful, failed and other based on status
            const successfulRegistrations = [];
            const failedRegistrations = [];
            const otherRegistrations = [];
            querySnapshot.forEach((doc) => {
                const docData = doc.data();
                if (docData.status === 'captured') {
                    successfulRegistrations.push({ id: doc.id, data: docData });
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

            // Render successful payments
            if (adminList) {
                if (successfulRegistrations.length === 0) {
                    adminList.innerHTML = `
                        <div class="admin-list-placeholder">
                            <i class="fas fa-inbox" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                            <p>No successful payments found. Only registrations with status "captured" are displayed here.</p>
                        </div>
                    `;
                } else {
                    let html = '';
                    html += `
                        <div style="margin-bottom: 1rem; font-weight: var(--font-semibold); color: var(--text-secondary);">
                            Total successful payments: ${successfulRegistrations.length}
                        </div>
                    `;
                    let index = 1;
                    successfulRegistrations.forEach((reg) => {
                        const amount = reg.data.amount;
                        const docData = reg.data;
                        const registrationId = reg.id;

                        // Get registration data from registrationData field (fallback to document root)
                        const data = docData.registrationData || docData || {};
                        console.log("Successful registration doc", registrationId, docData);
                        console.log("Parsed successful registration data", data);

                        // Format timestamp - prefer createdAt, fall back to timestamp fields
                        let timestamp = docData.createdAt || docData.timestamp || (data && data.timestamp);
                        if (timestamp) {
                            timestamp = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                        } else {
                            console.log("Timestamp not found for", registrationId);
                            timestamp = new Date();
                        }
                        const formattedDate = timestamp.toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });

                        html += `
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
                        index++;
                    });

                    adminList.innerHTML = html;
                }
            }

            // Render failed payments
            if (failedList) {
                if (failedRegistrations.length === 0) {
                    failedList.innerHTML = `
                        <div class="admin-list-placeholder">
                            <i class="fas fa-inbox" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                            <p>No failed payments found. Only registrations with status "failed" are displayed here.</p>
                        </div>
                    `;
                } else {
                    let htmlFailed = '';
                    htmlFailed += `
                        <div style="margin-bottom: 1rem; font-weight: var(--font-semibold); color: var(--text-secondary);">
                            Total failed payments: ${failedRegistrations.length}
                        </div>
                    `;
                    let failedIndex = 1;
                    failedRegistrations.forEach((reg) => {
                        const amount = reg.data.amount;
                        const docData = reg.data;
                        const registrationId = reg.id;

                        const data = docData.registrationData || docData || {};
                        console.log("Failed registration doc", registrationId, docData);
                        console.log("Parsed failed registration data", data);

                        let timestamp = docData.createdAt || docData.timestamp || (data && data.timestamp);
                        if (timestamp) {
                            timestamp = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                        } else {
                            console.log("Timestamp not found for failed", registrationId);
                            timestamp = new Date();
                        }
                        const formattedDate = timestamp.toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });

                        htmlFailed += `
                            <div class="registration-item">
                                <div class="registration-number">#${failedIndex}</div>
                                <div class="registration-details">
                                    <h3>${data.name || 'N/A'}</h3>
                                    <div class="registration-meta">
                                        <span><i class="fas fa-envelope"></i> ${data.email || 'N/A'}</span>
                                        <span><i class="fas fa-phone"></i> ${data.phone || 'N/A'}</span>
                                        <span><i class="fas fa-birthday-cake"></i> Age: ${data.age || 'N/A'}</span>
                                        <span><i class="fas fa-venus-mars"></i> ${data.gender || 'N/A'}</span>
                                        <span><i class="fas fa-tshirt"></i> Size: ${data.tshirtSize || 'N/A'}</span>
                                        <span><i class="fas fa-calendar"></i> ${formattedDate}</span>
                                        <span><i class="fas fa-exclamation-circle" style="color:#dc2626;"></i> Status: ${docData.status || 'failed'}</span>
                                    </div>
                                </div>
                                <div>
                                    <span class="registration-category" style="background: linear-gradient(135deg,#dc2626,#b91c1c);">FAILED</span>
                                    <div style="margin-top: 0.5rem; font-weight: var(--font-semibold); color: var(--text-primary);">
                                        ₹${amount}
                                    </div>
                                </div>
                            </div>
                        `;
                        failedIndex++;
                    });

                    failedList.innerHTML = htmlFailed;
                }
            }

            // Render other status records
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
                        console.log("Other registration doc", registrationId, docData);
                        console.log("Parsed other registration data", data);

                        let timestamp = docData.createdAt || docData.timestamp || (data && data.timestamp);
                        if (timestamp) {
                            timestamp = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                        } else {
                            console.log("Timestamp not found for other", registrationId);
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
                                </div>
                            </div>
                        `;
                        otherIndex++;
                    });

                    otherList.innerHTML = htmlOther;
                }
            }
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
        let csv = 'Name,Email,Phone,Age,Gender,Category,T-Shirt Size,Amount,Status,Registration Date\n';
        
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
            
            csv += `"${data.name || ''}","${data.email || ''}","${data.phone || ''}",${data.age || ''},"${data.gender || ''}","${data.category || ''}","${data.tshirtSize || ''}",${amount},"${statusText}","${formattedDate}"\n`;
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

