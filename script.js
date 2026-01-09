/* ------------------------------
   NAVBAR SCROLL EFFECT
------------------------------ */
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        navbar.style.boxShadow = '0 2px 15px rgba(0,0,0,0.1)';
    } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.9)';
        navbar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    }
});

/* ------------------------------
   MOBILE MENU
------------------------------ */
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const navLinks = document.querySelector('.nav-links');

if (mobileMenuToggle && navLinks) {
    mobileMenuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const icon = mobileMenuToggle.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-times');
        }
    });

    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            const icon = mobileMenuToggle.querySelector('i');
            if (icon) {
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!navbar.contains(e.target) && navLinks.classList.contains('active')) {
            navLinks.classList.remove('active');
            const icon = mobileMenuToggle.querySelector('i');
            if (icon) {
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            }
        }
    });
}

/* ------------------------------
   SMOOTH SCROLL
------------------------------ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

/* ------------------------------
   CONTACT FORM (Static Fake Send)
------------------------------ */
const contactForm = document.getElementById('contactForm');

if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;

        const btn = contactForm.querySelector('button[type="submit"]');
        const old = btn.innerText;

        btn.innerText = 'Sending...';
        btn.disabled = true;

        setTimeout(() => {
            console.log(`Thank you, ${name}! Your message has been sent.`);
            contactForm.reset();
            btn.innerText = old;
            btn.disabled = false;
        }, 1500);
    });
}

/* ------------------------------
   BACKEND BASE URL
------------------------------ */
const API_BASE_URL = 'https://razorpay-api-474336699934.asia-south1.run.app';

/* ------------------------------
   RAZORPAY KEY
------------------------------ */
let RAZORPAY_KEY_ID = null;

async function fetchRazorpayKey() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/razorpay-key`);
        if (response.ok) {
            const data = await response.json();
            if (data.key) {
                RAZORPAY_KEY_ID = data.key;
                return;
            }
        }
    } catch (e) {
        console.log("Key fetch failed. Using local key.");
    }

    // fallback
    RAZORPAY_KEY_ID = "rzp_live_Ri3wbsv2HCMv4v";
}

fetchRazorpayKey();

/* ------------------------------
   FETCH PRICING FROM FIREBASE
------------------------------ */
let amountMap = {};
let categoryLabels = {};

async function fetchPricingFromFirebase() {
    try {
        if (!window.firebaseReady) {
            await new Promise((res) =>
                window.addEventListener("firebaseReady", res, { once: true })
            );
        }

        const docSnap = await window.firebaseGetDoc(
            window.firebaseDoc(window.firebaseDb, "settings", "pricings")
        );

        if (docSnap.exists()) {
            const data = docSnap.data();

            amountMap = {};
            categoryLabels = {};

            Object.keys(data).forEach(key => {
                const val = data[key];
                if (typeof val === "number") {
                    amountMap[key] = val;
                } else if (typeof val === "object" && val.price) {
                    amountMap[key] = val.price;
                    if (val.label) categoryLabels[key] = val.label;
                }
            });

            updateCategoryDropdown();
        }
    } catch (err) {
        console.error("Pricing load error:", err);
    }
}

let selectedCategoryFromButton = null;

function updateCategoryDropdown() {
    const select = document.getElementById("reg-category");
    if (!select) return;

    select.innerHTML = `<option value="">Select Category</option>`;

    Object.keys(amountMap).forEach(key => {
        const price = amountMap[key];
        const label = categoryLabels[key] || key.toUpperCase();
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = `${label} (₹${price})`;
        select.appendChild(opt);
    });

    // If a category was selected via button click, set it now
    if (selectedCategoryFromButton && amountMap[selectedCategoryFromButton]) {
        select.value = selectedCategoryFromButton;
        selectedCategoryFromButton = null; // Reset after setting
    }
}

// Function to set category from button click
function selectCategory(category) {
    selectedCategoryFromButton = category;
    const select = document.getElementById("reg-category");
    if (select) {
        // Try to set immediately if option exists
        const optionExists = Array.from(select.options).some(opt => opt.value === category);
        if (optionExists) {
            select.value = category;
            selectedCategoryFromButton = null; // Reset since we set it
        }
        // If options aren't loaded yet, selectedCategoryFromButton will be used when updateCategoryDropdown is called
    }
}

fetchPricingFromFirebase();

/* ------------------------------
   GET URL PARAMETERS
------------------------------ */
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Get coupon code from URL parameter
const urlCouponCode = getUrlParameter('couponCode') || null;

// Pre-fill coupon field if URL param exists
if (urlCouponCode) {
    window.addEventListener('DOMContentLoaded', () => {
        const couponInput = document.getElementById('reg-coupon');
        if (couponInput) {
            couponInput.value = urlCouponCode;
        }
    });
}

/* ------------------------------
   REGISTRATION + RAZORPAY PROCESS
------------------------------ */
const registrationForm = document.getElementById('registrationForm');
const registrationSuccessBox = document.getElementById('registrationSuccess');
const downloadReceiptBtn = document.getElementById('downloadReceiptBtn');
let lastSuccessfulOrderId = null;

// Coupon modal elements
const couponModal = document.getElementById('couponModal');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalPayBtn = document.getElementById('modalPayBtn');
const modalCouponCode = document.getElementById('modalCouponCode');
const modalOriginalPrice = document.getElementById('modalOriginalPrice');
const modalDiscount = document.getElementById('modalDiscount');
const modalFinalPrice = document.getElementById('modalFinalPrice');
const modalErrorMessage = document.getElementById('modalErrorMessage');

// Store pending order data for modal payment
let pendingOrderData = null;

// Function to show coupon modal
function showCouponModal(data) {
    if (!couponModal) return;

    modalCouponCode.textContent = data.couponCode;
    modalOriginalPrice.textContent = `₹${data.originalAmount.toFixed(2)}`;

    const discountText = `-₹${data.discount.toFixed(2)}`;
    modalDiscount.textContent = discountText;
    modalDiscount.style.color = '#10b981';

    modalFinalPrice.textContent = `₹${data.finalAmount.toFixed(2)}`;
    modalErrorMessage.style.display = 'none';

    // Store data for payment
    pendingOrderData = data;

    // Show modal
    couponModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

// Function to show error in modal
function showCouponModalError(message) {
    if (modalErrorMessage) {
        modalErrorMessage.textContent = message;
        modalErrorMessage.style.display = 'block';
    }
    // Still show modal but with error
    if (couponModal) {
        couponModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// Function to hide coupon modal
function hideCouponModal() {
    if (couponModal) {
        couponModal.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
    }
    pendingOrderData = null;
}

// Modal cancel button
if (modalCancelBtn) {
    modalCancelBtn.addEventListener('click', () => {
        hideCouponModal();
    });
}

// Close modal on overlay click
if (couponModal) {
    const overlay = couponModal.querySelector('.coupon-modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            hideCouponModal();
        });
    }
}

// Modal pay button - create order and open Razorpay
if (modalPayBtn) {
    modalPayBtn.addEventListener('click', async () => {
        if (!pendingOrderData) return;

        const btn = modalPayBtn;
        const oldText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>Processing...';

        try {
            await createOrderAndOpenRazorpay(
                pendingOrderData.formData,
                pendingOrderData.originalAmount,
                pendingOrderData.couponCode,
                pendingOrderData.finalAmount
            );
            hideCouponModal();
        } catch (error) {
            console.error('Error creating order:', error);
            showCouponModalError(`Error: ${error.message}`);
            btn.disabled = false;
            btn.innerHTML = oldText;
        }
    });
}

// Registration form submit handler
if (registrationForm) {
    registrationForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent form submission and page reload

        // Collect form values
        const name = document.getElementById('reg-name').value.trim();
        const age = document.getElementById('reg-age').value.trim();
        const gender = document.getElementById('reg-gender').value;
        const category = document.getElementById('reg-category').value;
        const phone = document.getElementById('reg-phone').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const tshirtSize = document.getElementById('reg-tshirt').value;

        if (!name || !email || !phone || !gender || !category || !tshirtSize) {
            console.log("Please fill all fields.");
            return;
        }

        if (!amountMap[category]) {
            console.log("Pricing not loaded yet.");
            return;
        }

        let amount = amountMap[category];
        let finalAmount = amount;
        let couponDiscount = 0;

        // Store form data for later use
        const formData = {
            name,
            age,
            gender,
            category,
            phone,
            email,
            tshirtSize
        };

        // Hide previous success message when starting a new payment
        if (registrationSuccessBox) {
            registrationSuccessBox.style.display = 'none';
        }

        const btn = registrationForm.querySelector("button[type=submit]");
        const old = btn.innerText;

        try {
            btn.innerText = "Validating Coupon...";
            btn.disabled = true;

            /* ------------------------------
               VALIDATE COUPON CODE (if present)
            ------------------------------ */
            const couponInput = document.getElementById('reg-coupon');
            const enteredCouponCode = couponInput ? couponInput.value.trim().toUpperCase() : null;

            if (enteredCouponCode) {
                try {
                    const validateRes = await fetch(`${API_BASE_URL}/api/validate-coupon`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            couponCode: enteredCouponCode,
                            amount: amount
                        })
                    });

                    const validateData = await validateRes.json();

                    if (validateData.valid) {
                        // Store coupon data
                        couponDiscount = validateData.discount;
                        finalAmount = validateData.finalAmount;

                        // Show modal with coupon details
                        showCouponModal({
                            couponCode: validateData.couponCode,
                            originalAmount: amount,
                            discount: couponDiscount,
                            finalAmount: finalAmount,
                            discountType: validateData.couponDetails.discountType,
                            formData: formData
                        });

                        btn.innerText = old;
                        btn.disabled = false;
                        return; // Don't proceed to payment yet, wait for modal button click
                    } else {
                        // Invalid coupon - Stop and alert
                        alert(validateData.message || 'Invalid coupon code. Please check and try again.');
                        btn.innerText = old;
                        btn.disabled = false;
                        return; // Stop! Do not proceed to payment
                    }
                } catch (error) {
                    console.error('Error validating coupon:', error);
                    alert('Error validating coupon code. Please check your internet connection and try again.');
                    btn.innerText = old;
                    btn.disabled = false;
                    return; // Stop!
                }
            }

            // If no coupon was entered, proceed directly to payment
            btn.innerText = "Creating Order...";
            await createOrderAndOpenRazorpay(formData, amount, null, finalAmount);

        } catch (err) {
            console.log("Error: " + err.message);
            btn.innerText = old;
            btn.disabled = false;
        }
    });
}

// Function to create order and open Razorpay
async function createOrderAndOpenRazorpay(formData, amount, couponCode, finalAmount) {
    const btn = registrationForm.querySelector("button[type=submit]");
    const old = btn.innerText;

    try {
        btn.innerText = "Creating Order...";
        btn.disabled = true;

        /* ------------------------------
           CREATE ORDER (FULL FORM DATA)
        ------------------------------ */
        // Send original amount - backend will apply coupon discount
        const orderPayload = {
            amount: amount, // Original amount, backend will apply discount
            currency: "INR",
            receipt: `marathon_${Date.now()}`,
            formData: {
                ...formData,
                couponCode: couponCode || null // Pass couponCode in formData as backend expects
            }
        };

        const orderRes = await fetch(`${API_BASE_URL}/api/create-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(orderPayload)
        });

        const orderData = await orderRes.json();
        if (!orderData.success) throw new Error(orderData.error);

        /* ------------------------------
           PREPARE CHECKOUT
        ------------------------------ */
        // Use the finalAmount from backend (after discount applied)
        const options = {
            key: RAZORPAY_KEY_ID,
            amount: Math.round(orderData.finalAmount * 100), // Convert to paise, use finalAmount from backend
            currency: "INR",
            name: "Madras Marathon 2026 - Kavasa Foundation",
            description: `Registration for ${formData.category.toUpperCase()}${couponCode && finalAmount < amount ? ` (Coupon: ${couponCode})` : ''}`,
            order_id: orderData.orderId,

            handler: async function (response) {
                btn.innerText = "Verifying...";

                const verifyRes = await fetch(`${API_BASE_URL}/api/verify-payment`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...response,
                        formData: {
                            ...formData,
                            amount: finalAmount,
                            couponCode: couponCode || null
                        }
                    })
                });

                const verify = await verifyRes.json();

                if (verify.success) {
                    const orderId = verify.orderId || response.razorpay_order_id || options.order_id;
                    lastSuccessfulOrderId = orderId;

                    console.log(`Payment Success! Order ID: ${orderId}`);
                    registrationForm.reset();

                    if (registrationSuccessBox && downloadReceiptBtn && lastSuccessfulOrderId) {
                        registrationSuccessBox.style.display = 'block';

                        downloadReceiptBtn.onclick = () => {
                            const url = `${API_BASE_URL}/api/download-pdf/${lastSuccessfulOrderId}`;
                            window.open(url, '_blank');
                        };
                    }
                } else {
                    console.log("Payment verification failed.");
                }

                btn.innerText = old;
                btn.disabled = false;
            },

            prefill: { name: formData.name, email: formData.email, contact: formData.phone },
            theme: { color: "#2563eb" },

            modal: {
                ondismiss: function () {
                    btn.innerText = old;
                    btn.disabled = false;
                }
            }
        };

        const rzp = new Razorpay(options);
        rzp.open();

        rzp.on("payment.failed", function (resp) {
            console.log("Payment failed: " + resp.error.description);
            btn.innerText = old;
            btn.disabled = false;
        });

    } catch (err) {
        console.log("Error: " + err.message);
        btn.innerText = old;
        btn.disabled = false;
        throw err; // Re-throw so modal can handle it
    }
}

/* ------------------------------
   SCROLL ANIMATION
------------------------------ */
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll(".feature-card, .about-img, .about-content")
    .forEach(el => {
        el.style.opacity = "0";
        el.style.transform = "translateY(20px)";
        el.style.transition = "all 0.6s ease-out";
        observer.observe(el);
    });
