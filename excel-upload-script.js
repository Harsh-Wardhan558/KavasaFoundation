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

    initializeExcelUpload();
});

function initializeExcelUpload() {
    const { firebaseAuth, firebaseOnAuthStateChanged, firebaseSignOut } = window;

    // Check if Firebase functions are available
    if (!firebaseAuth || !firebaseOnAuthStateChanged) {
        console.error('Firebase not initialized properly');
        // Redirect to admin login if Firebase is not available
        window.location.href = 'admin.html';
        return;
    }

    const adminPanel = document.getElementById('adminPanel');
    if (!adminPanel) {
        console.error('Admin panel element not found');
        return;
    }

    // Check authentication status
    firebaseOnAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
            // User is signed in, show admin panel
            adminPanel.classList.remove('hidden');
        } else {
            // User is not signed in, redirect to admin login
            window.location.href = 'admin.html';
        }
    });

    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await firebaseSignOut(firebaseAuth);
                window.location.href = 'admin.html';
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }

    // Excel upload functionality
    const fileInput = document.getElementById('fileInput');
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const clearFileBtn = document.getElementById('clearFileBtn');
    const loading = document.getElementById('loading');
    const errorMessage = document.getElementById('errorMessage');
    const excelTableContainer = document.getElementById('excelTableContainer');
    const emptyState = document.getElementById('emptyState');
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    const rowCount = document.getElementById('rowCount');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const sendEmailsBtn = document.getElementById('sendEmailsBtn');
    const emailProgressSection = document.getElementById('emailProgressSection');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const processedCount = document.getElementById('processedCount');
    const totalCount = document.getElementById('totalCount');
    const successCount = document.getElementById('successCount');
    const failedCount = document.getElementById('failedCount');
    const emailResults = document.getElementById('emailResults');
    const emailResultsList = document.getElementById('emailResultsList');

    // Check if all required elements exist
    if (!fileInput || !fileUploadArea || !fileInfo || !fileName || !clearFileBtn || 
        !loading || !errorMessage || !excelTableContainer || !emptyState || 
        !tableHead || !tableBody || !rowCount || !exportCsvBtn || !sendEmailsBtn ||
        !emailProgressSection || !progressBar || !progressText || !processedCount ||
        !totalCount || !successCount || !failedCount || !emailResults || !emailResultsList) {
        console.error('Required DOM elements not found');
        return;
    }

    let currentWorkbook = null;
    let currentSheetData = null;

    // Check if XLSX library is loaded
    if (typeof XLSX === 'undefined') {
        console.error('XLSX library not loaded');
        showError('Excel library not loaded. Please refresh the page.');
        return;
    }

    // Click to upload
    fileUploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileUpload(file);
        }
    });

    // Drag and drop functionality
    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.classList.add('dragover');
    });

    fileUploadArea.addEventListener('dragleave', () => {
        fileUploadArea.classList.remove('dragover');
    });

    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove('dragover');
        
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
            handleFileUpload(file);
        } else {
            showError('Please upload a valid Excel file (.xlsx, .xls, or .csv)');
        }
    });

    // Clear file button
    clearFileBtn.addEventListener('click', () => {
        clearFile();
    });

    // Export CSV button
    exportCsvBtn.addEventListener('click', () => {
        exportToCSV();
    });

    // Send Emails button
    sendEmailsBtn.addEventListener('click', () => {
        if (!currentSheetData || currentSheetData.length < 2) {
            showError('No data to process. Please upload an Excel file first.');
            return;
        }

        const rowCount = currentSheetData.length - 1; // Exclude header row
        const confirmed = confirm(`Are you sure you want to send emails to ${rowCount} recipient(s)?\n\nThis action cannot be undone.`);
        
        if (confirmed) {
            sendEmails();
        }
    });

    function handleFileUpload(file) {
        // Hide error message
        hideError();

        // Validate file type
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv' // .csv
        ];

        if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
            showError('Please upload a valid Excel file (.xlsx, .xls, or .csv)');
            return;
        }

        // Show file info
        fileName.textContent = file.name;
        fileInfo.classList.add('show');

        // Show loading
        loading.classList.add('show');
        excelTableContainer.classList.remove('show');
        emptyState.style.display = 'none';

        // Read file
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                currentWorkbook = workbook;

                // Get the first sheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                    header: 1,
                    defval: '' // Default value for empty cells
                });

                currentSheetData = jsonData;

                // Display data in table
                displayTable(jsonData);

                // Hide loading
                loading.classList.remove('show');

            } catch (error) {
                console.error('Error reading file:', error);
                showError('Error reading Excel file: ' + error.message);
                loading.classList.remove('show');
            }
        };

        reader.onerror = () => {
            showError('Error reading file. Please try again.');
            loading.classList.remove('show');
        };

        reader.readAsArrayBuffer(file);
    }

    function displayTable(data) {
        if (!data || data.length === 0) {
            showError('The Excel file appears to be empty.');
            return;
        }

        // Clear previous table
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        // First row is headers
        const headers = data[0] || [];
        const rows = data.slice(1);

        // Create header row
        const headerRow = document.createElement('tr');
        headers.forEach((header, index) => {
            const th = document.createElement('th');
            th.textContent = header || `Column ${index + 1}`;
            headerRow.appendChild(th);
        });
        tableHead.appendChild(headerRow);

        // Create data rows
        rows.forEach((row) => {
            const tr = document.createElement('tr');
            headers.forEach((header, index) => {
                const td = document.createElement('td');
                const cellValue = row[index] !== undefined ? row[index] : '';
                td.textContent = cellValue;
                tr.appendChild(td);
            });
            tableBody.appendChild(tr);
        });

        // Update row count
        rowCount.textContent = rows.length;

        // Show table, hide empty state
        excelTableContainer.classList.add('show');
        emptyState.style.display = 'none';
    }

    function clearFile() {
        fileInput.value = '';
        fileInfo.classList.remove('show');
        excelTableContainer.classList.remove('show');
        emptyState.style.display = 'block';
        currentWorkbook = null;
        currentSheetData = null;
        hideError();
    }

    function exportToCSV() {
        if (!currentSheetData || currentSheetData.length === 0) {
            showError('No data to export.');
            return;
        }

        try {
            // Convert array data to CSV format
            const csv = currentSheetData.map(row => {
                return row.map(cell => {
                    // Escape cells containing commas, quotes, or newlines
                    if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
                        return `"${cell.replace(/"/g, '""')}"`;
                    }
                    return cell || '';
                }).join(',');
            }).join('\n');

            // Create download link
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `export_${new Date().getTime()}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error exporting CSV:', error);
            showError('Error exporting CSV: ' + error.message);
        }
    }

    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.classList.add('show');
        } else {
            console.error(message);
            alert(message);
        }
    }

    function hideError() {
        if (errorMessage) {
            errorMessage.classList.remove('show');
        }
    }

    async function sendEmails() {
        if (!currentSheetData || currentSheetData.length < 2) {
            showError('No data to process. Please upload an Excel file first.');
            return;
        }

        const headers = currentSheetData[0].map(h => String(h || '').toLowerCase().trim());
        const rows = currentSheetData.slice(1);

        // Find column indices - match Excel column names
        const columnMap = {
            email: findColumnIndex(headers, ['email']),
            orderId: findColumnIndex(headers, ['order_id', 'orderid', 'order id']),
            name: findColumnIndex(headers, ['name']),
            phone: findColumnIndex(headers, ['phone', 'phone number', 'phonenumber']),
            category: findColumnIndex(headers, ['category']),
            age: findColumnIndex(headers, ['age']),
            gender: findColumnIndex(headers, ['gender']),
            tshirtSize: findColumnIndex(headers, ['tshirt_size', 'tshirtsize', 'tshirt size', 'tshirt_size']),
            paymentId: findColumnIndex(headers, ['payment id', 'paymentid', 'payment_id', 'razorpay_payment_id']),
            status: findColumnIndex(headers, ['payment status', 'paymentstatus', 'payment_status', 'status']),
            amount: findColumnIndex(headers, ['total payment amount', 'totalpaymentamount', 'total_payment_amount', 'amount', 'finalamount']),
            paymentPageTitle: findColumnIndex(headers, ['payment page title', 'paymentpagetitle', 'payment_page_title']),
            paymentDate: findColumnIndex(headers, ['payment date', 'paymentdate', 'payment_date'])
        };

        // Validate required columns
        if (columnMap.email === -1 || columnMap.orderId === -1) {
            showError('Required columns not found. Please ensure "email" and "order_id" columns exist.');
            return;
        }

        // Reset progress
        emailProgressSection.style.display = 'block';
        emailResults.style.display = 'none';
        emailResultsList.innerHTML = '';
        totalCount.textContent = rows.length;
        processedCount.textContent = '0';
        successCount.textContent = '0';
        failedCount.textContent = '0';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        sendEmailsBtn.disabled = true;
        sendEmailsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        // Scroll to progress section
        emailProgressSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        let success = 0;
        let failed = 0;

        // Process rows one by one
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            try {
                // Map row data to API structure
                const email = columnMap.email >= 0 ? String(row[columnMap.email] || '').trim() : '';
                const orderId = columnMap.orderId >= 0 ? String(row[columnMap.orderId] || '').trim() : '';

                if (!email || !orderId) {
                    throw new Error(`Missing required fields: email="${email}", order_id="${orderId}"`);
                }

                // Validate email format
                if (!email.includes('@')) {
                    throw new Error('Invalid email format');
                }

                // Build API payload with safe column access
                const getCellValue = (colIndex, defaultValue = '') => {
                    return colIndex >= 0 && row[colIndex] !== undefined && row[colIndex] !== null 
                        ? String(row[colIndex]).trim() 
                        : defaultValue;
                };

                const payload = {
                    email: email,
                    orderId: orderId,
                    registrationData: {
                        name: getCellValue(columnMap.name, 'N/A'),
                        email: email,
                        phone: getCellValue(columnMap.phone, 'N/A'),
                        category: getCellValue(columnMap.category, 'N/A'),
                        age: columnMap.age >= 0 && row[columnMap.age] ? parseInt(row[columnMap.age]) || 0 : 0,
                        gender: getCellValue(columnMap.gender, 'N/A'),
                        tshirtSize: getCellValue(columnMap.tshirtSize, 'N/A')
                    },
                    paymentData: {
                        razorpay_payment_id: getCellValue(columnMap.paymentId, 'N/A'),
                        status: getCellValue(columnMap.status, 'N/A').toLowerCase(),
                        amount: columnMap.amount >= 0 && row[columnMap.amount] ? parseFloat(row[columnMap.amount]) || 0 : 0,
                        finalAmount: columnMap.amount >= 0 && row[columnMap.amount] ? parseFloat(row[columnMap.amount]) || 0 : 0
                    },
                    eventInfo: {
                        title: getCellValue(columnMap.paymentPageTitle, 'Agilisium Madras Marathon 2026'),
                        date: getCellValue(columnMap.paymentDate, '8th February 2026'),
                        location: 'Presidency College, Chennai'
                    }
                };

                // Call API
                const response = await fetch('https://generateandsendpdf-3c2ivlmw3a-uc.a.run.app', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    success++;
                    addResultItem(email, 'success', `Email sent successfully`);
                } else {
                    const errorText = await response.text();
                    failed++;
                    addResultItem(email, 'failed', `Failed: ${response.status} - ${errorText.substring(0, 100)}`);
                }
            } catch (error) {
                failed++;
                const email = columnMap.email >= 0 && row[columnMap.email] ? String(row[columnMap.email]).trim() : 'Unknown';
                addResultItem(email, 'failed', `Error: ${error.message}`);
                console.error(`Error processing row ${i + 1}:`, error);
            }

            // Update progress
            const processed = i + 1;
            const percentage = Math.round((processed / rows.length) * 100);
            processedCount.textContent = processed;
            progressBar.style.width = percentage + '%';
            progressText.textContent = percentage + '%';
            successCount.textContent = success;
            failedCount.textContent = failed;

            // Small delay to prevent overwhelming the API
            if (i < rows.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Show results
        emailResults.style.display = 'block';
        sendEmailsBtn.disabled = false;
        sendEmailsBtn.innerHTML = '<i class="fas fa-envelope"></i> Send Emails';

        // Scroll to results
        emailResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function findColumnIndex(headers, possibleNames) {
        for (const name of possibleNames) {
            const normalizedName = name.toLowerCase().replace(/[_\s]/g, '');
            const index = headers.findIndex(h => {
                const normalizedHeader = h.toLowerCase().replace(/[_\s]/g, '');
                return normalizedHeader === normalizedName || normalizedHeader.includes(normalizedName);
            });
            if (index !== -1) return index;
        }
        return -1;
    }

    function addResultItem(email, status, message) {
        const item = document.createElement('div');
        item.className = `result-item ${status}`;
        item.innerHTML = `
            <div class="result-item-header">
                <span class="result-item-email">${email}</span>
                <i class="fas ${status === 'success' ? 'fa-check-circle' : 'fa-times-circle'}" 
                   style="color: ${status === 'success' ? '#10b981' : '#dc2626'};"></i>
            </div>
            <div class="result-item-message">${message}</div>
        `;
        emailResultsList.appendChild(item);
    }
}

