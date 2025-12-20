/**
 * UCONNECT NEO - ADVANCED INTERACTIONS & ANIMATIONS
 * Brutalist + Apple Hybrid Design System
 */

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    initCustomCursor();
    initMagneticButtons();
    initTextScramble();
    initCardTilt();
    initScrollAnimations();
    initCampusReveal();
    initStatsCounter();
    initFlashMessages();
    initMobileMenu();
    initSmoothScroll();
    initParallax();
    initThemeToggle();
});

// ============================================
// CUSTOM CURSOR
// ============================================

function initCustomCursor() {
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');

    if (!cursorDot || !cursorOutline) return;

    let mouseX = 0, mouseY = 0;
    let dotX = 0, dotY = 0;
    let outlineX = 0, outlineY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // Smooth cursor animation
    function animateCursor() {
        // Dot follows immediately
        dotX += (mouseX - dotX) * 1;
        dotY += (mouseY - dotY) * 1;

        // Outline follows with delay
        outlineX += (mouseX - outlineX) * 0.15;
        outlineY += (mouseY - outlineY) * 0.15;

        cursorDot.style.transform = `translate(${dotX}px, ${dotY}px)`;
        cursorOutline.style.transform = `translate(${outlineX}px, ${outlineY}px)`;

        requestAnimationFrame(animateCursor);
    }

    animateCursor();

    // Cursor effects on interactive elements
    const interactiveElements = document.querySelectorAll('a, button, .card-neo');

    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursorDot.style.transform += ' scale(2)';
            cursorOutline.style.width = '60px';
            cursorOutline.style.height = '60px';
        });

        el.addEventListener('mouseleave', () => {
            cursorDot.style.transform = cursorDot.style.transform.replace(' scale(2)', '');
            cursorOutline.style.width = '40px';
            cursorOutline.style.height = '40px';
        });
    });
}

// ============================================
// MAGNETIC BUTTONS
// ============================================

function initMagneticButtons() {
    const magneticButtons = document.querySelectorAll('.magnetic-btn');

    magneticButtons.forEach(button => {
        button.addEventListener('mousemove', (e) => {
            const rect = button.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            const distance = Math.sqrt(x * x + y * y);
            const maxDistance = 100;

            if (distance < maxDistance) {
                const strength = (maxDistance - distance) / maxDistance;
                const moveX = x * strength * 0.3;
                const moveY = y * strength * 0.3;

                button.style.transform = `translate(${moveX}px, ${moveY}px)`;
            }
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = '';
        });
    });
}

// ============================================
// TEXT SCRAMBLE EFFECT
// ============================================

function initTextScramble() {
    const scrambleElements = document.querySelectorAll('[data-scramble]');

    scrambleElements.forEach(element => {
        const originalText = element.textContent;
        const chars = '!<>-_\\/[]{}—=+*^?#________';
        let frame = 0;
        let queue = [];

        for (let i = 0; i < originalText.length; i++) {
            queue.push({
                from: chars[Math.floor(Math.random() * chars.length)],
                to: originalText[i],
                start: Math.floor(Math.random() * 40),
                end: Math.floor(Math.random() * 40) + 40
            });
        }

        const update = () => {
            let output = '';
            let complete = 0;

            for (let i = 0; i < queue.length; i++) {
                let { from, to, start, end } = queue[i];

                if (frame >= end) {
                    complete++;
                    output += to;
                } else if (frame >= start) {
                    if (Math.random() < 0.28) {
                        output += chars[Math.floor(Math.random() * chars.length)];
                    } else {
                        output += to;
                    }
                } else {
                    output += '';
                }
            }

            element.innerHTML = output.split(' ').map(word =>
                word.includes('\n') ? word : word
            ).join(' ');

            if (complete === queue.length) {
                return;
            }

            frame++;
            requestAnimationFrame(update);
        };

        // Start scramble after a delay
        setTimeout(() => {
            update();
        }, 500);
    });
}

// ============================================
// 3D CARD TILT EFFECT
// ============================================

function initCardTilt() {
    const cards = document.querySelectorAll('.card-tilt');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;

            card.style.transform = `
                perspective(1000px)
                rotateX(${rotateX}deg)
                rotateY(${rotateY}deg)
                scale3d(1.05, 1.05, 1.05)
            `;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
        });
    });
}

// ============================================
// EPIC CAMPUS IMAGE REVEAL
// ============================================

function initCampusReveal() {
    const revealSection = document.querySelector('.campus-reveal-section');
    const revealFrame = document.querySelector('.reveal-frame');
    const revealContainer = document.querySelector('.reveal-container');
    const revealMedia = document.querySelector('.reveal-campus-image, .reveal-campus-video');

    if (!revealSection || !revealFrame) return;

    // Intersection Observer for initial reveal
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                revealContainer.classList.add('active');
            }
        });
    }, {
        threshold: 0.3
    });

    revealObserver.observe(revealSection);

    // Scroll-based expansion effect
    let ticking = false;

    function updateReveal() {
        const rect = revealSection.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        // Calculate how much the section is in view
        const visibleAmount = Math.max(0, Math.min(1,
            (windowHeight - rect.top) / (windowHeight * 0.8)
        ));

        // Expand the frame as you scroll
        if (visibleAmount > 0.3) {
            revealFrame.classList.add('expanded');
        } else {
            revealFrame.classList.remove('expanded');
        }

        // Parallax zoom effect on image/video
        if (revealMedia) {
            const scale = 1.1 - (visibleAmount * 0.1);
            revealMedia.style.transform = `scale(${scale})`;
        }

        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                updateReveal();
            });
            ticking = true;
        }
    });

    // Initial check
    updateReveal();

    // Add GSAP animation if available
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // Smooth scale animation for both image and video
        gsap.to('.reveal-campus-image, .reveal-campus-video', {
            scale: 1,
            ease: 'none',
            scrollTrigger: {
                trigger: '.campus-reveal-section',
                start: 'top center',
                end: 'center center',
                scrub: 1
            }
        });

        // Caption fade in
        gsap.from('.reveal-caption', {
            y: 60,
            opacity: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: '.campus-reveal-section',
                start: 'top center',
                toggleActions: 'play none none reverse'
            }
        });

        // Border expansion
        gsap.to(['.reveal-border-top', '.reveal-border-bottom'], {
            width: '80%',
            duration: 1.2,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: '.campus-reveal-section',
                start: 'top center',
                toggleActions: 'play none none reverse'
            }
        });
    }
}

// ============================================
// SCROLL ANIMATIONS
// ============================================

function initScrollAnimations() {
    // Check if GSAP is available
    if (typeof gsap === 'undefined') {
        console.warn('GSAP not loaded, using fallback animations');
        initFallbackScrollAnimations();
        return;
    }

    // Register ScrollTrigger plugin
    gsap.registerPlugin(ScrollTrigger);

    // Fade in elements on scroll
    gsap.utils.toArray('[data-scroll]').forEach(element => {
        const speed = element.getAttribute('data-scroll-speed') || 0;

        gsap.from(element, {
            y: 60,
            opacity: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: element,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            }
        });

        // Parallax effect
        if (speed !== 0) {
            gsap.to(element, {
                y: () => speed * 100,
                ease: 'none',
                scrollTrigger: {
                    trigger: element,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: true
                }
            });
        }
    });

    // Stagger animation for cards
    gsap.from('.card-neo', {
        y: 80,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '.cards-grid-neo',
            start: 'top 75%'
        }
    });

    // Feature cards animation
    gsap.from('.feature-card-neo', {
        scale: 0.9,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'back.out(1.2)',
        scrollTrigger: {
            trigger: '.features-grid-neo',
            start: 'top 70%'
        }
    });
}

function initFallbackScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    document.querySelectorAll('[data-scroll], .card-neo, .feature-card-neo').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(40px)';
        el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        observer.observe(el);
    });
}

// ============================================
// STATS COUNTER ANIMATION
// ============================================

function initStatsCounter() {
    const statNumbers = document.querySelectorAll('.stat-number');
    let animated = false;

    const observerOptions = {
        threshold: 0.5
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !animated) {
                animated = true;
                statNumbers.forEach(stat => {
                    const target = parseInt(stat.getAttribute('data-count'));
                    const duration = 2000;
                    const step = target / (duration / 16);
                    let current = 0;

                    const counter = setInterval(() => {
                        current += step;
                        if (current >= target) {
                            stat.textContent = target.toLocaleString() + '+';
                            clearInterval(counter);
                        } else {
                            stat.textContent = Math.floor(current).toLocaleString();
                        }
                    }, 16);
                });
            }
        });
    }, observerOptions);

    const statsSection = document.querySelector('.stats-grid-neo');
    if (statsSection) {
        observer.observe(statsSection);
    }
}

// ============================================
// FLASH MESSAGES
// ============================================

function initFlashMessages() {
    const closeButtons = document.querySelectorAll('.flash-close-neo');

    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const flash = button.closest('.flash-neo');
            flash.style.animation = 'slide-out-right 0.3s ease forwards';
            setTimeout(() => flash.remove(), 300);
        });
    });

    // Auto-dismiss after 5 seconds
    const flashes = document.querySelectorAll('.flash-neo');
    flashes.forEach(flash => {
        setTimeout(() => {
            if (flash.parentElement) {
                flash.style.animation = 'slide-out-right 0.3s ease forwards';
                setTimeout(() => flash.remove(), 300);
            }
        }, 5000);
    });
}

// ============================================
// MOBILE MENU
// ============================================

function initMobileMenu() {
    const menuBtn = document.querySelector('.mobile-menu-btn-neo');
    const navMenu = document.querySelector('.nav-menu-neo');

    if (!menuBtn || !navMenu) return;

    menuBtn.addEventListener('click', () => {
        const isOpen = menuBtn.classList.toggle('active');

        if (isOpen) {
            // Create mobile overlay
            const overlay = document.createElement('div');
            overlay.className = 'mobile-overlay-neo';
            overlay.innerHTML = navMenu.innerHTML;
            document.body.appendChild(overlay);

            // Animate in
            setTimeout(() => overlay.classList.add('active'), 10);

            // Close on click outside
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeMobileMenu();
                }
            });
        } else {
            closeMobileMenu();
        }
    });

    function closeMobileMenu() {
        const overlay = document.querySelector('.mobile-overlay-neo');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        }
        menuBtn.classList.remove('active');
    }
}

// ============================================
// SMOOTH SCROLL
// ============================================

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            e.preventDefault();
            const target = document.querySelector(href);

            if (target) {
                const offsetTop = target.offsetTop - 80;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// ============================================
// PARALLAX EFFECT
// ============================================

function initParallax() {
    let ticking = false;
    let scrollY = window.pageYOffset;

    window.addEventListener('scroll', () => {
        scrollY = window.pageYOffset;

        if (!ticking) {
            window.requestAnimationFrame(() => {
                updateParallax();
                ticking = false;
            });
            ticking = true;
        }
    });

    function updateParallax() {
        // Parallax layers
        const layer1 = document.querySelector('.layer-1');
        const layer2 = document.querySelector('.layer-2');

        if (layer1) {
            layer1.style.transform = `translateY(${scrollY * 0.3}px)`;
        }
        if (layer2) {
            layer2.style.transform = `translateY(${scrollY * 0.5}px)`;
        }

        // Blobs
        const blobs = document.querySelectorAll('.blob');
        blobs.forEach((blob, index) => {
            const speed = (index + 1) * 0.1;
            blob.style.transform = `translate(${Math.sin(scrollY * 0.002) * 50}px, ${scrollY * speed}px)`;
        });
    }
}

// ============================================
// BUTTON RIPPLE EFFECT
// ============================================

document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-brutalist')) {
        const button = e.target.closest('.btn-brutalist');
        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();

        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple-effect 0.6s ease-out;
            pointer-events: none;
        `;

        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    }
});

// Add ripple animation
if (!document.getElementById('ripple-animation')) {
    const style = document.createElement('style');
    style.id = 'ripple-animation';
    style.textContent = `
        @keyframes ripple-effect {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }

        @keyframes slide-out-right {
            to {
                transform: translateX(120%);
                opacity: 0;
            }
        }

        .mobile-overlay-neo {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            backdrop-filter: blur(20px);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 32px;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .mobile-overlay-neo.active {
            opacity: 1;
        }

        .mobile-overlay-neo a {
            font-size: 24px;
            font-weight: 700;
            color: white;
            text-decoration: none;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            transition: color 0.3s;
        }

        .mobile-overlay-neo a:hover {
            color: #FF0000;
        }

        .mobile-menu-btn-neo.active span:nth-child(1) {
            transform: rotate(45deg) translate(8px, 8px);
        }

        .mobile-menu-btn-neo.active span:nth-child(2) {
            opacity: 0;
        }

        .mobile-menu-btn-neo.active span:nth-child(3) {
            transform: rotate(-45deg) translate(8px, -8px);
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// PERFORMANCE OPTIMIZATIONS
// ============================================

// Lazy load images
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                imageObserver.unobserve(img);
            }
        });
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// Debounce resize events
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        // Handle resize
        if (typeof ScrollTrigger !== 'undefined') {
            ScrollTrigger.refresh();
        }
    }, 250);
});

// ============================================
// ACCESSIBILITY ENHANCEMENTS
// ============================================

// Keyboard navigation for cards
document.querySelectorAll('.card-neo').forEach(card => {
    card.setAttribute('tabindex', '0');

    card.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            card.click();
        }
    });
});

// Skip to main content
const skipLink = document.createElement('a');
skipLink.href = '#main';
skipLink.className = 'skip-link';
skipLink.textContent = 'Skip to main content';
skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 0;
    background: #FF0000;
    color: white;
    padding: 8px;
    text-decoration: none;
    z-index: 10000;
`;
skipLink.addEventListener('focus', () => {
    skipLink.style.top = '0';
});
skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
});
document.body.prepend(skipLink);

const mainContent = document.querySelector('.main-neo');
if (mainContent) {
    mainContent.id = 'main';
}

// ============================================
// CONSOLE EASTER EGG
// ============================================

console.log(
    '%cUCONNECT NEO',
    'font-size: 48px; font-weight: 900; color: #FF0000; text-shadow: 3px 3px 0 #000;'
);
console.log(
    '%cBrutalist + Apple Hybrid Design',
    'font-size: 16px; color: #FFF; background: #000; padding: 8px;'
);
console.log(
    '%c💀 Built by students, for students. 🚀',
    'font-size: 14px; color: #FF0000;'
);

// ============================================
// THEME TOGGLE - REMOVED (handled by main.js)
// ============================================

function initThemeToggle() {
    // Theme toggle is now handled by main.js to avoid conflicts
    // This function is kept for compatibility but does nothing
    return;
}

// ============================================
// EXPORT FOR DEBUGGING
// ============================================

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.UConnectNeo = {
        version: '2.0.0',
        theme: 'brutalist-apple',
        debug: true,
        reinit: () => {
            console.log('Reinitializing UConnect Neo...');
            document.dispatchEvent(new Event('DOMContentLoaded'));
        }
    };
}
