/**
 * Landing Page JavaScript - UConnect
 * Adds interactive elements and animations
 */

document.addEventListener('DOMContentLoaded', function() {
    injectLandingStyles();
    initializeHeroAnimations();
    initializeDemoCardHover();
    initializeButtonRipples();
    initializeFlipCard();
    initializeFloatingCards();
});

function initializeHeroAnimations() {
    const animatedElements = document.querySelectorAll('.feature-card, .demo-card, .step');
    if (!animatedElements.length) {
        return;
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    animatedElements.forEach((element, index) => {
        element.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(element);
    });
}

function initializeDemoCardHover() {
    const demoCards = document.querySelectorAll('.demo-card');
    demoCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.animationPlayState = 'paused';
            this.style.transform = 'translateY(-12px) scale(1.05) ' + (
                this.classList.contains('card-1') ? 'rotate(-2deg)' :
                this.classList.contains('card-2') ? 'rotate(3deg)' : 'rotate(-1deg)'
            );
        });

        card.addEventListener('mouseleave', function() {
            this.style.animationPlayState = 'running';
            this.style.transform = '';
        });
    });
}

function initializeButtonRipples() {
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', function(event) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = event.clientX - rect.left - size / 2;
            const y = event.clientY - rect.top - size / 2;

            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                background: rgba(255, 255, 255, 0.6);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s ease-out;
                pointer-events: none;
            `;

            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });
}

function initializeFlipCard() {
    const flipCard = document.querySelector('.flip-card');
    if (!flipCard) {
        return;
    }

    flipCard.addEventListener('click', () => {
        flipCard.classList.toggle('flipped');
    });
}

function initializeFloatingCards() {
    const cards = document.querySelectorAll('.card-3d');
    if (!cards.length) {
        return;
    }

    document.addEventListener('mousemove', event => {
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
                card.style.background = `
                    radial-gradient(
                        circle at ${x}px ${y}px,
                        rgba(99, 102, 241, 0.15),
                        rgba(255, 255, 255, 0.05)
                    )
                `;
            } else {
                card.style.background = '';
            }
        });
    });

    cards.forEach((card, index) => {
        card.addEventListener('click', () => {
            card.style.animation = 'none';
            // Trigger reflow to restart animation
            void card.offsetHeight;
            card.style.animation = `float-card 4s ease-in-out infinite ${index}s, pulse 0.6s ease`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.background = '';
        });
    });
}

function injectLandingStyles() {
    if (document.getElementById('landing-dynamic-styles')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'landing-dynamic-styles';
    style.textContent = `
        .animate-in {
            animation: slideInUp 0.8s ease-out forwards;
        }

        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes ripple {
            from {
                transform: scale(0);
                opacity: 1;
            }
            to {
                transform: scale(2);
                opacity: 0;
            }
        }

        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }

        .feature-card,
        .demo-card,
        .step {
            opacity: 0;
            transform: translateY(30px);
            transition: all 0.8s ease-out;
        }

        .feature-card.animate-in,
        .demo-card.animate-in,
        .step.animate-in {
            opacity: 1;
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);
}