// ===== JavaScript Document =====

// ===== Season Theme Manager (BIOBUZZ 2026/27 Default vs DECODE 2025/26) =====
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
		return 'biobuzz';
	}

	function applySeason(season, persist) {
		const validSeason = season === 'decode' ? 'decode' : 'biobuzz';
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

		// Update dynamic season labels (e.g., footer "About BIOBUZZ" / "About DECODE")
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

// ===== Service Worker Cache & Speculative Background Preloading =====
(function initLocalCacheAndPreloader() {
	if (typeof window === 'undefined') return;

	const prefetched = new Set();

	function isInternalNavigable(anchor) {
		if (!anchor || !anchor.href) return null;
		if (anchor.target === '_blank' || anchor.hasAttribute('download')) return null;
		const rawHref = anchor.getAttribute('href') || '';
		if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return null;
		try {
			const url = new URL(anchor.href, window.location.href);
			if (url.origin !== window.location.origin) return null;
			url.hash = '';
			if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
			return url.href;
		} catch {
			return null;
		}
	}

	function prefetchUrl(url) {
		if (!url || prefetched.has(url)) return;
		prefetched.add(url);
		const link = document.createElement('link');
		link.rel = 'prefetch';
		link.as = 'document';
		link.href = url;
		document.head.appendChild(link);
	}

	// Instant hover/touch speculative prefetch for zero-friction page switches
	document.addEventListener('pointerenter', (e) => {
		const anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
		const url = isInternalNavigable(anchor);
		if (url) prefetchUrl(url);
	}, true);

	document.addEventListener('touchstart', (e) => {
		const anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
		const url = isInternalNavigable(anchor);
		if (url) prefetchUrl(url);
	}, { capture: true, passive: true });

	function getBackgroundPrecacheList() {
		const isGerman = window.location.pathname.startsWith('/de');
		const primaryLang = isGerman ? 'de' : 'en';
		const secondaryLang = isGerman ? 'en' : 'de';

		const primaryPages = [
			`/${primaryLang}/`,
			`/${primaryLang}/bot`,
			`/${primaryLang}/team-details`,
			`/${primaryLang}/battlebots`,
			`/${primaryLang}/sponsors`
		];
		const secondaryPages = [
			`/${secondaryLang}/`,
			`/${secondaryLang}/bot`,
			`/${secondaryLang}/team-details`,
			`/${secondaryLang}/battlebots`,
			`/${secondaryLang}/sponsors`
		];

		const sharedMedia = [
			'/assets/images/opt/logo.webp',
			'/assets/images/opt/amf-logo.webp',
			'/assets/images/opt/maedler-logo.webp',
			'/assets/images/opt/ganter-logo.webp',
			'/assets/images/opt/first.webp',
			'/assets/images/opt/team.webp',
			'/assets/images/opt/heidehof.webp',
			'/assets/images/opt/kazuma.webp',
			'/assets/images/opt/jakob.webp',
			'/assets/images/opt/johannes.webp',
			'/assets/images/opt/christopher.webp',
			'/assets/images/opt/merle.webp',
			'/assets/images/opt/amalie.webp',
			'/assets/images/opt/christian.webp',
			'/assets/images/opt/moritz.bu.webp',
			'/assets/images/opt/ferdinand.webp',
			'/assets/images/opt/jonas.webp',
			'/public/assets/aistudio/opt/Scrimmage_11_7fbdc7e8.webp',
			'/public/assets/aistudio/opt/image_73628792.webp',
			'/public/assets/aistudio/opt/Scrimmage_12_fb407ec2.webp',
			'/public/assets/aistudio/opt/Scrimmage_10_4ce575c0.webp',
			'/public/assets/aistudio/opt/Scrimmage_17_b048375f.webp',
			'/public/assets/aistudio/opt/Scrimmage_15_25746fc0.webp',
			'/public/assets/aistudio/opt/Scrimmage_22_a13199ef.webp',
			'/public/assets/aistudio/opt/Scrimmage_24_b373477d.webp',
			'/public/assets/aistudio/opt/KRTI2118_bef150f6.webp',
			'/public/assets/aistudio/opt/IMG_1248_e3017baa.webp',
			'/public/assets/aistudio/opt/IMG_1251_86748d2d.webp',
			'/public/assets/aistudio/opt/IMG_1245_6555a5aa.webp',
			'/public/assets/aistudio/opt/IMG_1241_26785de7.webp',
			'/public/assets/aistudio/opt/victoria_49c43635.webp',
			'/public/assets/aistudio/opt/leopold_d62a13f1.webp'
		];

		return [...primaryPages, ...sharedMedia, ...secondaryPages];
	}

	function scheduleBackgroundPrecache(registration) {
		const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
		if (conn && (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')) {
			return;
		}

		const trigger = () => {
			const target = (registration && (registration.active || registration.waiting || registration.installing)) || navigator.serviceWorker.controller;
			if (!target) return;
			target.postMessage({
				type: 'PRECACHE',
				urls: getBackgroundPrecacheList()
			});
		};

		if ('requestIdleCallback' in window) {
			window.requestIdleCallback(() => setTimeout(trigger, 600), { timeout: 4000 });
		} else {
			setTimeout(trigger, 1400);
		}
	}

	if ('serviceWorker' in navigator) {
		window.addEventListener('load', () => {
			navigator.serviceWorker.register('/sw.js', { scope: '/' })
				.then((reg) => {
					if (reg.active) {
						scheduleBackgroundPrecache(reg);
					} else {
						navigator.serviceWorker.ready.then((readyReg) => scheduleBackgroundPrecache(readyReg));
					}
				})
				.catch(() => {
					// Ignore SW registration errors in restricted contexts
				});
		});
	}
})();

// ===== Floating Particles =====
function createParticles() {
	const particlesContainer = document.getElementById('particles');
	if (!particlesContainer) return;
	if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
	const particleCount = isMobile ? 10 : 20;

	const frag = document.createDocumentFragment();
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

		frag.appendChild(particle);
	}
	particlesContainer.appendChild(frag);
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
let scrollTicking = false;
window.addEventListener('scroll', () => {
	if (scrollTicking) return;
	scrollTicking = true;
	requestAnimationFrame(() => {
		const navbar = document.getElementById('navbar');
		if (navbar) {
			if (window.scrollY > 50) {
				navbar.classList.add('scrolled');
			} else {
				navbar.classList.remove('scrolled');
			}
		}
		updateActiveNav();
		scrollTicking = false;
	});
}, { passive: true });

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

// ===== Dynamic Team Member Portrait & Box Spotlight (Click, Hover, Scroll-Center) =====
(function initTeamSpotlight() {
	const teamGrid = document.querySelector('.team-bento-grid');
	if (!teamGrid) return;

	const leadCard = teamGrid.querySelector('.team-member-card.member-lead');
	const cards = Array.from(teamGrid.querySelectorAll('.team-member-card:not(.member-lead)'));
	if (!cards.length) return;

	let pinnedCard = null;
	let pinnedScrollY = 0;
	let hoveredCard = null;
	let currentCentered = [];
	let rafPending = false;

	cards.forEach(card => {
		card.setAttribute('tabindex', '0');
		card.setAttribute('role', 'button');
		card.setAttribute('aria-pressed', 'false');
	});

	function syncCardClasses() {
		const hasManualOverride = Boolean(pinnedCard || hoveredCard);

		cards.forEach(card => {
			const isPinned = card === pinnedCard;
			const isHovered = card === hoveredCard;
			const isCentered = !hasManualOverride && currentCentered.includes(card);
			const isSpotlight = isPinned || isHovered || isCentered;

			card.classList.toggle('is-pinned', isPinned);
			card.classList.toggle('is-hovered', isHovered);
			card.classList.toggle('is-spotlight', isSpotlight);
			card.setAttribute('aria-pressed', String(isPinned));
		});
	}

	function evaluateCenterSpotlight() {
		rafPending = false;
		const vh = window.innerHeight || document.documentElement.clientHeight;
		const vw = window.innerWidth || document.documentElement.clientWidth;

		if (pinnedCard) {
			const pinnedRect = pinnedCard.getBoundingClientRect();
			const scrolledFar = Math.abs(window.scrollY - pinnedScrollY) > 240;
			const offScreen = pinnedRect.bottom < 72 || pinnedRect.top > vh - 32;
			if (scrolledFar || offScreen) {
				pinnedCard = null;
			}
		}

		if (pinnedCard || hoveredCard) {
			currentCentered = [];
			syncCardClasses();
			return;
		}

		const navOffset = 72;
		const focusY = navOffset + (vh - navOffset) * 0.48;
		const isSingleCol = vw <= 820;

		const leadRect = leadCard ? leadCard.getBoundingClientRect() : null;
		const leadCenterY = leadRect ? leadRect.top + leadRect.height / 2 : Infinity;
		const leadDist = leadRect ? Math.abs(leadCenterY - focusY) : Infinity;

		const candidates = [];
		cards.forEach(card => {
			const rect = card.getBoundingClientRect();
			if (rect.bottom <= navOffset + 12 || rect.top >= vh - 40) return;

			const cardCenterY = rect.top + rect.height / 2;
			// On initial load at very top on desktop/tablet, keep Kazuma's row clean until scrolled or hovered
			if (!isSingleCol && window.scrollY < 16 && leadRect && Math.abs(cardCenterY - leadCenterY) < 48) {
				return;
			}

			let dist = Math.abs(cardCenterY - focusY);
			// Small hysteresis bias toward already-centered card(s) to prevent boundary jitter during transitions
			if (currentCentered.includes(card)) {
				dist -= 26;
			}
			candidates.push({ card, cardCenterY, dist });
		});

		if (!candidates.length) {
			currentCentered = [];
			syncCardClasses();
			return;
		}

		candidates.sort((a, b) => a.dist - b.dist);
		const best = candidates[0];

		// If Kazuma is clearly dominating the center on single-column mobile, let him hold the spotlight
		if (isSingleCol && leadRect && leadDist + 24 < best.dist && leadRect.bottom > focusY - 40) {
			currentCentered = [];
			syncCardClasses();
			return;
		}

		if (best.dist > vh * 0.36) {
			currentCentered = [];
			syncCardClasses();
			return;
		}

		if (isSingleCol) {
			currentCentered = [best.card];
		} else {
			// Highlight the entire centered row on multi-column layouts for visual harmony
			currentCentered = candidates
				.filter(item => Math.abs(item.cardCenterY - best.cardCenterY) <= 40)
				.map(item => item.card);
		}

		syncCardClasses();
	}

	function scheduleEvaluate() {
		if (rafPending) return;
		rafPending = true;
		requestAnimationFrame(evaluateCenterSpotlight);
	}

	function togglePin(card) {
		pinnedCard = pinnedCard === card ? null : card;
		pinnedScrollY = window.scrollY;
		syncCardClasses();
		if (!pinnedCard) scheduleEvaluate();
	}

	cards.forEach(card => {
		card.addEventListener('pointerenter', (e) => {
			if (e.pointerType === 'touch') return;
			hoveredCard = card;
			syncCardClasses();
		});

		card.addEventListener('pointerleave', (e) => {
			if (e.pointerType === 'touch') return;
			if (hoveredCard === card) {
				hoveredCard = null;
				scheduleEvaluate();
			}
		});

		card.addEventListener('click', (e) => {
			if (e.target && e.target.closest && e.target.closest('a, button:not(.team-member-card)')) return;
			togglePin(card);
		});

		card.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				togglePin(card);
			}
		});
	});

	document.addEventListener('click', (e) => {
		if (!pinnedCard) return;
		if (!e.target || !e.target.closest || !e.target.closest('.team-member-card')) {
			pinnedCard = null;
			scheduleEvaluate();
		}
	});

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && pinnedCard) {
			pinnedCard = null;
			scheduleEvaluate();
		}
	});

	window.addEventListener('scroll', scheduleEvaluate, { passive: true });
	window.addEventListener('resize', scheduleEvaluate, { passive: true });
	window.addEventListener('load', scheduleEvaluate);
	scheduleEvaluate();
})();