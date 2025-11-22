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
    const refreshBtn = document.getElementById('refreshBtn');
    const exportBtn = document.getElementById('exportBtn');

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

    // Load registrations from Firestore
    async function loadRegistrations() {
        try {
            adminList.innerHTML = `
                <div class="admin-list-placeholder">
                    <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                    <p>Loading registrations...</p>
                </div>
            `;

            const registrationsRef = window.firebaseCollection(window.firebaseDb, 'marathon_registrations');
            // Fetch all documents without ordering (we'll sort client-side)
            // This avoids Firestore errors if timestamp field is missing or inconsistent
            const querySnapshot = await window.firebaseGetDocs(registrationsRef);

            if (querySnapshot.empty) {
                adminList.innerHTML = `
                    <div class="admin-list-placeholder">
                        <i class="fas fa-inbox" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                        <p>No captured registrations found yet.</p>
                    </div>
                `;
                return;
            }

            // Convert to array and filter by status "captured"
            const registrations = [];
            querySnapshot.forEach((doc) => {
                const docData = doc.data();
                // Only include registrations with status "captured"
                if (docData.status === 'captured') {
                    registrations.push({ id: doc.id, data: docData });
                }
            });
            
            // Sort by timestamp (newest first) if available
            registrations.sort((a, b) => {
                const timestampA = a.data.timestamp || (a.data.registrationData && a.data.registrationData.timestamp);
                const timestampB = b.data.timestamp || (b.data.registrationData && b.data.registrationData.timestamp);
                
                if (timestampA && timestampB) {
                    const dateA = timestampA.toDate ? timestampA.toDate() : new Date(timestampA);
                    const dateB = timestampB.toDate ? timestampB.toDate() : new Date(timestampB);
                    return dateB - dateA; // Descending order (newest first)
                }
                return 0;
            });

            // Check if any captured registrations found
            if (registrations.length === 0) {
                adminList.innerHTML = `
                    <div class="admin-list-placeholder">
                        <i class="fas fa-inbox" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem; display: block;"></i>
                        <p>No captured registrations found. Only registrations with status "captured" are displayed.</p>
                    </div>
                `;
                return;
            }

            let html = '';
            let index = 1;
            registrations.forEach((reg) => {
                const docData = reg.data;
                const registrationId = reg.id;
                
                // Get registration data from registrationData field
                const data = docData.registrationData || docData;
                
                // Format timestamp - check both document level and registrationData level
                let timestamp = docData.timestamp || data.timestamp;
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
                                ₹${data.amount || 0}
                            </div>
                        </div>
                    </div>
                `;
                index++;
            });

            adminList.innerHTML = html;
        } catch (error) {
            console.error('Error loading registrations:', error);
            adminList.innerHTML = `
                <div class="admin-list-placeholder">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #dc2626; margin-bottom: 1rem; display: block;"></i>
                    <p>Error loading registrations: ${error.message}</p>
                </div>
            `;
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

