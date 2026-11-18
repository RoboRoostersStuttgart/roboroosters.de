// ===== JavaScript Document =====

// ===== Season Theme Manager (DECODE 2025/26 vs BIOBUZZ 2026/27) =====
(function initSeasonManager() {
	const STORAGE_KEY = 'roborooster_season';

	function getInitialSeason() {
		try {
			const params = new URLSearchParams(window.location.search);
			const urlSeason = params.get('season');
			if (urlSeason === 'biobuzz' || urlSeason === 'decode') {
				localStorage.setItem(STORAGE_KEY, urlSeason);
				return urlSeason;
			}
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved === 'biobuzz' || saved === 'decode') {
				return saved;
			}
		} catch (e) {
			// Ignore storage access issues
		}
		return 'decode';
	}

	function applySeason(season, persist) {
		const validSeason = season === 'biobuzz' ? 'biobuzz' : 'decode';
		document.documentElement.setAttribute('data-season', validSeason);

		if (persist) {
			try {
				localStorage.setItem(STORAGE_KEY, validSeason);
			} catch (e) {
				// Ignore storage access issues
			}
		}

		// Sync all season toggle buttons (navbar + hero + bot page)
		document.querySelectorAll('[data-season-choice]').forEach(btn => {
			const isActive = btn.getAttribute('data-season-choice') === validSeason;
			btn.classList.toggle('active', isActive);
			btn.setAttribute('aria-pressed', String(isActive));
		});

		// Update dynamic season labels (e.g., footer "About DECODE" -> "About BIOBUZZ")
		document.querySelectorAll('[data-decode-text][data-biobuzz-text]').forEach(el => {
			el.textContent = validSeason === 'biobuzz'
				? el.getAttribute('data-biobuzz-text')
				: el.getAttribute('data-decode-text');
		});
	}

	// Apply immediately
	applySeason(getInitialSeason(), false);

	document.addEventListener('DOMContentLoaded', () => {
		applySeason(document.documentElement.getAttribute('data-season') || getInitialSeason(), false);

		document.querySelectorAll('[data-season-choice]').forEach(btn => {
			btn.addEventListener('click', () => {
				const chosen = btn.getAttribute('data-season-choice');
				applySeason(chosen, true);
			});
		});
	});
})();

// ===== Floating Particles =====
function createParticles() {
	const particlesContainer = document.getElementById('particles');
	if (!particlesContainer) return;
	const particleCount = 28;

	for (let i = 0; i < particleCount; i++) {
		const particle = document.createElement('div');
		particle.className = 'particle';
		particle.style.left = Math.random() * 100 + '%';
		particle.style.animationDelay = Math.random() * 15 + 's';
		particle.style.animationDuration = (Math.random() * 10 + 15) + 's';

		if (Math.random() > 0.5) {
			particle.style.setProperty('--particle-color', '#00B2FF');
			particle.style.background = '#00B2FF';
		}

		particlesContainer.appendChild(particle);
	}
}

// ===== Mobile Menu Toggle =====
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');

if (menuToggle && navLinks) {
	menuToggle.addEventListener('click', () => {
		menuToggle.classList.toggle('active');
		navLinks.classList.toggle('active');
	});

	document.querySelectorAll('.nav-links a').forEach(link => {
		link.addEventListener('click', () => {
			menuToggle.classList.remove('active');
			navLinks.classList.remove('active');
		});
	});
}

// ===== Active Navigation Highlighting =====
const sections = document.querySelectorAll('section[id]');
const navItems = document.querySelectorAll('.nav-link');

function updateActiveNav() {
	if (!navItems.length || !sections.length) return;
	const scrollPosition = window.pageYOffset + 100;

	sections.forEach(section => {
		const sectionTop = section.offsetTop;
		const sectionHeight = section.offsetHeight;

		if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
			navItems.forEach(item => item.classList.remove('active'));
			const currentNav = document.querySelector(`.nav-link[href="#${section.id}"]`);
			if (currentNav) currentNav.classList.add('active');
		}
	});
}

// ===== Navbar Scroll Effect =====
window.addEventListener('scroll', () => {
	const navbar = document.getElementById('navbar');
	if (navbar) {
		if (window.scrollY > 50) {
			navbar.classList.add('scrolled');
		} else {
			navbar.classList.remove('scrolled');
		}
	}
	updateActiveNav();
});

updateActiveNav();

// ===== Smooth Scrolling =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
	anchor.addEventListener('click', function (e) {
		const href = this.getAttribute('href');
		if (!href || href === '#') return;
		const target = document.querySelector(href);
		if (target) {
			e.preventDefault();
			target.scrollIntoView({
				behavior: 'smooth',
				block: 'start'
			});
		}
	});
});

// ===== Scoped Feature Tabs Functionality =====
document.addEventListener('DOMContentLoaded', () => {
	document.querySelectorAll('.features-container').forEach(container => {
		const tabs = container.querySelectorAll('.tab-item');
		const panels = container.querySelectorAll('.content-panel');

		tabs.forEach(tab => {
			tab.addEventListener('click', () => {
				const tabId = tab.getAttribute('data-tab');
				if (!tabId) return;

				tabs.forEach(t => t.classList.remove('active'));
				panels.forEach(p => p.classList.remove('active'));

				tab.classList.add('active');
				const targetPanel = container.querySelector(`#${CSS.escape(tabId)}`) || document.getElementById(tabId);
				if (targetPanel) {
					targetPanel.classList.add('active');
				}
			});
		});
	});
});

// ===== Form Submission =====
const contactForm = document.getElementById('contactForm');
if (contactForm) {
	contactForm.addEventListener('submit', function (e) {
		e.preventDefault();
		this.reset();
	});
}

createParticles();

// ===== Text Rotation with Pixel-Exact Glitch Alignment =====
const textSets = document.querySelectorAll('.text-set');
let currentIndex = 0;
let isAnimating = false;
let settleTimer = null;

function wrapTextWordsInSpans(element, rawText, isOut) {
	const words = rawText.split(' ');
	let charIndex = 0;
	const delayStep = isOut ? 0.015 : 0.035;

	element.innerHTML = words.map(word => {
		const letters = word.split('').map(ch => {
			const delay = (charIndex * delayStep).toFixed(3);
			charIndex += 1;
			return `<span class="char${isOut ? ' out' : ''}" style="animation-delay: ${delay}s">${ch}</span>`;
		}).join('');
		charIndex += 1;
		return `<span class="word" style="display:inline-block;white-space:nowrap">${letters}</span>`;
	}).join(' ');
}

function animateTextIn(textSet) {
	if (!textSet) return;
	const glitchText = textSet.querySelector('.glitch-text');
	const subtitle = textSet.querySelector('.subtitle');

	if (settleTimer) {
		clearTimeout(settleTimer);
		settleTimer = null;
	}

	if (glitchText) {
		const rawText = glitchText.dataset.rawText || glitchText.getAttribute('data-text') || glitchText.textContent.trim();
		glitchText.dataset.rawText = rawText;
		glitchText.setAttribute('data-text', rawText);

		// Hide ::before / ::after while spans animate so they never desync
		glitchText.classList.add('is-animating');
		wrapTextWordsInSpans(glitchText, rawText, false);

		const settleDelay = Math.min(900, rawText.length * 35 + 380);
		settleTimer = setTimeout(() => {
			// Restore native single text node so kerning and wrapping match ::before/::after 100%
			glitchText.textContent = rawText;
			glitchText.classList.remove('is-animating');
		}, settleDelay);
	}

	if (subtitle) {
		subtitle.classList.remove('visible');
		setTimeout(() => {
			subtitle.classList.add('visible');
		}, 420);
	}
}

function animateTextOut(textSet) {
	if (!textSet) return;
	const glitchText = textSet.querySelector('.glitch-text');
	const subtitle = textSet.querySelector('.subtitle');

	if (glitchText) {
		const rawText = glitchText.dataset.rawText || glitchText.getAttribute('data-text') || glitchText.textContent.trim();
		glitchText.dataset.rawText = rawText;
		glitchText.classList.add('is-animating');
		wrapTextWordsInSpans(glitchText, rawText, true);
	}

	if (subtitle) {
		subtitle.classList.remove('visible');
	}
}

function rotateText() {
	if (isAnimating || textSets.length < 2) return;
	isAnimating = true;

	const currentSet = textSets[currentIndex];
	const nextIndex = (currentIndex + 1) % textSets.length;
	const nextSet = textSets[nextIndex];

	animateTextOut(currentSet);

	setTimeout(() => {
		currentSet.classList.remove('active');
		nextSet.classList.add('active');
		animateTextIn(nextSet);

		currentIndex = nextIndex;
		isAnimating = false;
	}, 450);
}

if (textSets.length > 0) {
	textSets.forEach(ts => ts.classList.remove('active'));
	textSets[0].classList.add('active');
	animateTextIn(textSets[0]);

	if (textSets.length > 1) {
		setInterval(rotateText, 4800);
	}
}