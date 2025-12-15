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
const API_BASE_URL = 'https://razorpay-backend-474336699934.asia-south1.run.app';

/* ------------------------------
   RAZORPAY KEY
------------------------------ */
let RAZORPAY_KEY_ID = null;

async function fetchRazorpayKey() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/razorpay-key`);
        if (response.ok) {
            const data = await response.json();
            if (data.keyId) {
                RAZORPAY_KEY_ID = data.keyId;
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
}

fetchPricingFromFirebase();

/* ------------------------------
   REGISTRATION + RAZORPAY PROCESS
------------------------------ */
const registrationForm = document.getElementById('registrationForm');
const registrationSuccessBox = document.getElementById('registrationSuccess');
const downloadReceiptBtn = document.getElementById('downloadReceiptBtn');
let lastSuccessfulOrderId = null;

if (registrationForm) {
    registrationForm.addEventListener('submit', async (e) => {
        e.preventDefault();

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

        const amount = amountMap[category];

        // Hide previous success message when starting a new payment
        if (registrationSuccessBox) {
            registrationSuccessBox.style.display = 'none';
        }

        const btn = registrationForm.querySelector("button[type=submit]");
        const old = btn.innerText;

        try {
            btn.innerText = "Creating Order...";
            btn.disabled = true;

            /* ------------------------------
               CREATE ORDER (FULL FORM DATA)
            ------------------------------ */
            const orderRes = await fetch(`${API_BASE_URL}/api/create-order`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount,
                    currency: "INR",
                    receipt: `marathon_${Date.now()}`,
                    formData: {
                        name,
                        age,
                        gender,
                        category,
                        phone,
                        email,
                        tshirtSize
                    }
                })
            });

            const orderData = await orderRes.json();
            if (!orderData.success) throw new Error(orderData.error);

            /* ------------------------------
               PREPARE CHECKOUT
            ------------------------------ */
            const options = {
                key: RAZORPAY_KEY_ID,
                amount: orderData.amount,
                currency: "INR",
                name: "Madras Marathon 2026 - Kavasa Foundation",
                description: `Registration for ${category.toUpperCase()}`,
                order_id: orderData.orderId,

                handler: async function (response) {
                    btn.innerText = "Verifying...";

                    const verifyRes = await fetch(`${API_BASE_URL}/api/verify-payment`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            ...response,
                            formData: {
                                name,
                                age,
                                gender,
                                category,
                                phone,
                                email,
                                tshirtSize,
                                amount
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

                prefill: { name, email, contact: phone },
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
        }
    });
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
