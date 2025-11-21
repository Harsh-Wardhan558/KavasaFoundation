// Navigation Scroll Effect
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

// Mobile Menu Toggle
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

    // Close menu when clicking on a link
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

    // Close menu when clicking outside
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

// Smooth Scrolling for Anchor Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Contact Form Handling
const contactForm = document.getElementById('contactForm');

if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Get form values
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const subject = document.getElementById('subject').value;
        const message = document.getElementById('message').value;

        // Simple validation (HTML5 validation handles most)
        if (name && email && subject && message) {
            // Simulate form submission
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;

            submitBtn.innerText = 'Sending...';
            submitBtn.disabled = true;

            setTimeout(() => {
                alert(`Thank you, ${name}! Your message has been sent successfully. We will get back to you at ${email} shortly.`);
                contactForm.reset();
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }, 1500);
        }
    });
}

// Backend API Configuration
const API_BASE_URL = 'https://razorpay-api-474336699934.asia-south1.run.app';

// Razorpay Key ID - Set this to your Razorpay Key ID from dashboard
// Or it will be fetched from backend endpoint /api/razorpay-key if available
// Format: 'rzp_test_xxxxxxxxxxxxx' (for test) or 'rzp_live_xxxxxxxxxxxxx' (for live)
let RAZORPAY_KEY_ID = 'rzp_test_Ri4TRiPWd8jb0Q'; // Update this with your Razorpay Key ID if backend endpoint doesn't exist

// Fetch Razorpay Key ID from backend (if endpoint exists)
async function fetchRazorpayKey() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/razorpay-key`);
        if (response.ok) {
            const data = await response.json();
            if (data.keyId) {
                RAZORPAY_KEY_ID = data.keyId;
                console.log('Razorpay Key ID fetched from backend');
                return true;
            }
        }
    } catch (error) {
        console.log('Razorpay key endpoint not available. Using fallback or manual configuration.');
    }
    return false;
}

// Initialize on page load
fetchRazorpayKey();

// Registration Form Handling with Razorpay Integration
const registrationForm = document.getElementById('registrationForm');

if (registrationForm) {
    registrationForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get form values
        const name = document.getElementById('reg-name').value.trim();
        const age = parseInt(document.getElementById('reg-age').value);
        const gender = document.getElementById('reg-gender').value;
        const category = document.getElementById('reg-category').value;
        const phone = document.getElementById('reg-phone').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const tshirtSize = document.getElementById('reg-tshirt').value;

        // Validation
        if (!name || !category || !phone || !gender || !tshirtSize || !email) {
            alert('Please fill in all required fields.');
            return;
        }

        // Age validation based on category
        if (category === '3km' && (age < 8 || age > 15)) {
            alert('3KM category is only for children aged 8-15 years.');
            return;
        }

        if ((category === '5km' || category === '10km') && age < 15) {
            alert('5KM and 10KM categories require participants to be 15 years or older.');
            return;
        }

        // Phone validation (basic)
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
            alert('Please enter a valid 10-digit phone number.');
            return;
        }

        // Determine amount based on category
        const amountMap = {
            '3km': 399,
            '5km': 499,
            '10km': 499
        };
        const amount = amountMap[category];

        const submitBtn = registrationForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;

        try {
            submitBtn.innerText = 'Creating Order...';
            submitBtn.disabled = true;

            // Step 1: Create Razorpay Order
            const orderResponse = await fetch(`${API_BASE_URL}/api/create-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: amount,
                    currency: 'INR',
                    receipt: `marathon_${Date.now()}_${category}`
                })
            });

            if (!orderResponse.ok) {
                const errorData = await orderResponse.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to create order');
            }

            const orderData = await orderResponse.json();

            if (!orderData.success) {
                throw new Error('Failed to create order');
            }

            // Step 2: Prepare form data
            const formData = {
                name,
                age,
                gender,
                category,
                phone,
                email,
                tshirtSize,
                amount
            };

            // Step 3: Get Razorpay Key ID (try fetching if not already set)
            if (!RAZORPAY_KEY_ID) {
                const fetched = await fetchRazorpayKey();
                if (!fetched && !RAZORPAY_KEY_ID) {
                    // Check if orderData contains keyId (backend might return it)
                    if (orderData.keyId) {
                        RAZORPAY_KEY_ID = orderData.keyId;
                    } else {
                        throw new Error('Razorpay Key ID not configured. Please set RAZORPAY_KEY_ID in script.js or add /api/razorpay-key endpoint to backend.');
                    }
                }
            }

            const razorpayKey = RAZORPAY_KEY_ID;

            // Step 4: Initialize Razorpay Checkout
            const options = {
                key: razorpayKey,
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'Kavasa Foundation Marathon',
                description: `Registration for ${category.toUpperCase()} category`,
                order_id: orderData.orderId,
                handler: async function (response) {
                    try {
                        submitBtn.innerText = 'Verifying Payment...';
                        
                        // Step 5: Verify Payment
                        const verifyResponse = await fetch(`${API_BASE_URL}/api/verify-payment`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                formData: formData
                            })
                        });

                        const verifyData = await verifyResponse.json();

                        if (verifyData.success) {
                            alert(`Payment Successful! Thank you ${name} for registering for the ${category.toUpperCase()} category. Your registration ID: ${verifyData.docId}`);
                            registrationForm.reset();
                        } else {
                            alert('Payment verification failed. Please contact support.');
                        }
                    } catch (error) {
                        console.error('Verification error:', error);
                        alert('Payment verification failed. Please contact support with your payment ID: ' + response.razorpay_payment_id);
                    } finally {
                        submitBtn.innerText = originalText;
                        submitBtn.disabled = false;
                    }
                },
                prefill: {
                    name: name,
                    contact: phone,
                    email: email
                },
                theme: {
                    color: '#dc2626'
                },
                modal: {
                    ondismiss: function() {
                        submitBtn.innerText = originalText;
                        submitBtn.disabled = false;
                    }
                }
            };

            const razorpay = new Razorpay(options);
            razorpay.open();
            
            razorpay.on('payment.failed', function (response) {
                console.error('Payment failed:', response);
                alert('Payment failed: ' + (response.error.description || 'Please try again.'));
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            });

        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred: ' + error.message + '. Please try again later.');
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Add animation on scroll
const observerOptions = {
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Select elements to animate
const animateElements = document.querySelectorAll('.feature-card, .about-img, .about-content');

animateElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'all 0.6s ease-out';
    observer.observe(el);
});