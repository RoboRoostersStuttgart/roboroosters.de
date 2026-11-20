// ===== JavaScript Document =====

// ===== Season Theme Manager (BIOBUZZ 2026/27 Default vs DECODE 2025/26) =====
(function initSeasonManager() {
	const STORAGE_KEY = 'roborooster_season_v3';

	function getInitialSeason() {
		try {
			localStorage.removeItem('roborooster_season');
			const params = new URLSearchParams(window.location.search);
			const urlSeason = params.get('season');
			if (urlSeason === 'biobuzz' || urlSeason === 'decode') {
				sessionStorage.setItem(STORAGE_KEY, urlSeason);
				return urlSeason;
			}
			const saved = sessionStorage.getItem(STORAGE_KEY);
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
				sessionStorage.setItem(STORAGE_KEY, validSeason);
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

		// Sync PWA status-bar theme-color meta tag with active season skin
		const themeMeta = document.querySelector('meta[name="theme-color"]');
		if (themeMeta) {
			themeMeta.setAttribute('content', validSeason === 'biobuzz' ? '#236B43' : '#0a0a0f');
		}
	}

	// Apply immediately
	applySeason(getInitialSeason(), false);

	function switchSeasonWithRipple(chosen, sourceEl, clientEvent) {
		const current = document.documentElement.getAttribute('data-season') || 'biobuzz';
		if (chosen === current) {
			applySeason(chosen, true);
			return;
		}

		const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduceMotion) {
			applySeason(chosen, true);
			return;
		}

		let x = window.innerWidth / 2;
		let y = 36;
		if (clientEvent && typeof clientEvent.clientX === 'number' && clientEvent.clientX > 0) {
			x = clientEvent.clientX;
			y = clientEvent.clientY;
		} else if (sourceEl && sourceEl.getBoundingClientRect) {
			const rect = sourceEl.getBoundingClientRect();
			x = rect.left + rect.width / 2;
			y = rect.top + rect.height / 2;
		}

		const endRadius = Math.hypot(
			Math.max(x, window.innerWidth - x),
			Math.max(y, window.innerHeight - y)
		);

		document.documentElement.style.setProperty('--ripple-x', `${Math.round(x)}px`);
		document.documentElement.style.setProperty('--ripple-y', `${Math.round(y)}px`);
		document.documentElement.style.setProperty('--ripple-r', `${Math.ceil(endRadius)}px`);

		// Honeycomb pulse ring matching target era
		const existingRing = document.querySelector('.season-honeycomb-ring');
		if (existingRing) existingRing.remove();
		const ring = document.createElement('div');
		ring.className = `season-honeycomb-ring${chosen === 'decode' ? ' to-decode' : ''}`;
		document.body.appendChild(ring);
		setTimeout(() => ring.remove(), 720);

		if (typeof document.startViewTransition === 'function') {
			document.documentElement.classList.add('is-season-rippling');
			const vt = document.startViewTransition(() => {
				applySeason(chosen, true);
			});
			vt.finished.finally(() => {
				document.documentElement.classList.remove('is-season-rippling');
			});
		} else {
			applySeason(chosen, true);
		}
	}

	document.addEventListener('DOMContentLoaded', () => {
		applySeason(document.documentElement.getAttribute('data-season') || getInitialSeason(), false);

		document.querySelectorAll('[data-season-choice]').forEach(btn => {
			btn.addEventListener('click', (e) => {
				const chosen = btn.getAttribute('data-season-choice');
				switchSeasonWithRipple(chosen, btn, e);
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
			'/assets/images/logo.png',
			'/assets/images/pwa-192x192.png',
			'/assets/images/pwa-512x512.png',
			'/assets/images/pwa-maskable-512x512.png',
			'/assets/images/opt/amf-logo.webp',
			'/assets/images/opt/maedler-logo.webp',
			'/assets/images/opt/ganter-logo.webp',
			'/assets/images/opt/first.webp',
			'/assets/images/opt/team.webp',
			'/assets/images/opt/heidehof.webp',
			'/assets/images/opt/lifecycle.webp',
			'/assets/images/opt/intake.webp',
			'/assets/images/opt/flicker.webp',
			'/assets/images/opt/turret.webp',
			'/assets/images/opt/sensor.webp',
			'/assets/images/opt/pedropathing.webp',
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
			'/public/assets/aistudio/opt/SIOP6882_bd80de63.webp',
			'/public/assets/aistudio/opt/WhatsApp_Image_2026-06-03_at_15.38.01_7f014599.webp',
			'/public/assets/aistudio/opt/IMG_1239_f9c5bd35.webp',
			'/public/assets/aistudio/opt/IMG_1241_26785de7.webp',
			'/public/assets/aistudio/opt/IMG_1243_636b7e6e.webp',
			'/public/assets/aistudio/opt/IMG_1244_826d29d4.webp',
			'/public/assets/aistudio/opt/IMG_1245_6555a5aa.webp',
			'/public/assets/aistudio/opt/IMG_1247_0516660e.webp',
			'/public/assets/aistudio/opt/IMG_1248_e3017baa.webp',
			'/public/assets/aistudio/opt/IMG_1250_7e552ec0.webp',
			'/public/assets/aistudio/opt/IMG_1251_86748d2d.webp',
			'/public/assets/aistudio/opt/IMG_1252_a14cf315.webp',
			'/public/assets/aistudio/opt/IMG_1256_4bd4bc01.webp',
			'/public/assets/aistudio/opt/IMG_1258_f8618ace.webp',
			'/public/assets/aistudio/opt/victoria_49c43635.webp',
			'/public/assets/aistudio/opt/leopold_d62a13f1.webp'
		];

		return ['/', ...primaryPages, ...sharedMedia, ...secondaryPages];
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
			const hadController = Boolean(navigator.serviceWorker.controller);
			let refreshing = false;

			navigator.serviceWorker.addEventListener('controllerchange', () => {
				if (!hadController || refreshing) return;
				try {
					if (sessionStorage.getItem('rr_sw_reloaded') === 'v14') return;
					sessionStorage.setItem('rr_sw_reloaded', 'v14');
				} catch {
					// Ignore storage access errors
				}
				refreshing = true;
				window.location.reload();
			});

			navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
				.then((reg) => {
					reg.update().catch(() => {});
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

// ===== Dynamic Team Member Portrait & Row Spotlight (Click, Hover, Scroll-Center) =====
(function initTeamSpotlight() {
	const teamGrid = document.querySelector('.team-bento-grid');
	if (!teamGrid) return;

	const leadCard = teamGrid.querySelector('.team-member-card.member-lead');
	const allCards = Array.from(teamGrid.querySelectorAll('.team-member-card'));
	const cards = allCards.filter(card => !card.classList.contains('member-lead'));
	if (!cards.length) return;

	let pinnedCard = null;
	let pinnedScrollY = 0;
	let hoveredCard = null;
	let hoverLeaveTimer = null;
	let currentCentered = [];
	let rafPending = false;

	cards.forEach(card => {
		card.setAttribute('tabindex', '0');
		card.setAttribute('role', 'button');
		card.setAttribute('aria-pressed', 'false');
	});

	function syncCardClasses() {
		const focusCard = hoveredCard || pinnedCard;
		const focusRow = focusCard ? focusCard.closest('.team-bento-row') : null;
		const hasManualOverride = Boolean(focusCard);

		allCards.forEach(card => {
			const isLead = card.classList.contains('member-lead');
			const isPinned = !isLead && card === pinnedCard;
			const isHovered = card === hoveredCard;
			const isRowFocus = card === focusCard;
			const inFocusRow = Boolean(focusRow && card.closest('.team-bento-row') === focusRow);
			// Kazuma stays medium-big and never compresses
			const isRowCompressed = Boolean(!isLead && focusRow && inFocusRow && !isRowFocus);
			const isCentered = !isLead && !hasManualOverride && currentCentered.includes(card);
			const isSpotlight = !isLead && (isRowFocus || isCentered);

			card.classList.toggle('is-pinned', isPinned);
			card.classList.toggle('is-hovered', isHovered);
			card.classList.toggle('is-row-focus', isRowFocus);
			card.classList.toggle('is-row-compressed', isRowCompressed);
			card.classList.toggle('is-spotlight', isSpotlight);
			if (!isLead) {
				card.setAttribute('aria-pressed', String(isPinned));
			}
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
			// On initial load at very top on desktop/tablet, keep Kazuma's row balanced until scrolled or hovered
			if (!isSingleCol && window.scrollY < 16 && leadRect && Math.abs(cardCenterY - leadCenterY) < 48) {
				return;
			}

			let dist = Math.abs(cardCenterY - focusY);
			// Hysteresis bias keeps transitions calm and prevents jitter while scrolling
			if (currentCentered.includes(card)) {
				dist -= 38;
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

		if (isSingleCol && leadRect && leadDist + 24 < best.dist && leadRect.bottom > focusY - 40) {
			currentCentered = [];
			syncCardClasses();
			return;
		}

		if (best.dist > vh * 0.38) {
			currentCentered = [];
			syncCardClasses();
			return;
		}

		if (isSingleCol) {
			currentCentered = [best.card];
		} else {
			currentCentered = candidates
				.filter(item => Math.abs(item.cardCenterY - best.cardCenterY) <= 44)
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

	allCards.forEach(card => {
		const isLead = card.classList.contains('member-lead');

		card.addEventListener('pointerenter', (e) => {
			if (e.pointerType === 'touch') return;
			if (hoverLeaveTimer) {
				clearTimeout(hoverLeaveTimer);
				hoverLeaveTimer = null;
			}
			hoveredCard = card;
			syncCardClasses();
		});

		card.addEventListener('pointerleave', (e) => {
			if (e.pointerType === 'touch') return;
			if (hoveredCard === card) {
				if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer);
				// Short grace period bridges the 20px gap between cards without intermediate snap-back
				hoverLeaveTimer = setTimeout(() => {
					hoverLeaveTimer = null;
					if (hoveredCard === card) {
						hoveredCard = null;
						scheduleEvaluate();
					}
				}, 115);
			}
		});

		if (!isLead) {
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
		}
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

// ===== Fullscreen Lightbox Gallery (Swipe, Zoom & Keyboard Arrows) =====
(function initGlobalLightbox() {
	function getGalleryTriggers() {
		return Array.from(document.querySelectorAll('[data-lightbox], .mentoring-photo-card img, .bot-photo-card img'))
			.filter(img => {
				// Skip hidden season sections
				const rect = img.getBoundingClientRect();
				return rect.width > 0 || img.offsetParent !== null;
			});
	}

	const hasAnyGalleryImg = document.querySelector('[data-lightbox], .mentoring-photo-card img, .bot-photo-card img');
	if (!hasAnyGalleryImg) return;

	const isGerman = (document.documentElement.lang || '').toLowerCase().startsWith('de');
	const labels = {
		zoomIn: isGerman ? 'Zoom +' : 'Zoom +',
		zoomOut: isGerman ? 'Zurücksetzen' : 'Reset Zoom',
		close: isGerman ? 'Schließen ✕' : 'Close ✕',
		prev: isGerman ? 'Vorheriges Bild' : 'Previous photo',
		next: isGerman ? 'Nächstes Bild' : 'Next photo'
	};

	const overlay = document.createElement('div');
	overlay.className = 'rr-lightbox';
	overlay.setAttribute('role', 'dialog');
	overlay.setAttribute('aria-modal', 'true');
	overlay.setAttribute('aria-label', isGerman ? 'Vollbild-Bildergalerie' : 'Fullscreen image gallery');
	overlay.innerHTML = `
		<div class="rr-lightbox-top">
			<span class="rr-lightbox-counter" id="rrLightboxCounter">1 / 1</span>
			<div class="rr-lightbox-controls">
				<button type="button" class="rr-lightbox-btn" id="rrLightboxZoom">${labels.zoomIn}</button>
				<button type="button" class="rr-lightbox-btn" id="rrLightboxClose">${labels.close}</button>
			</div>
		</div>
		<div class="rr-lightbox-stage" id="rrLightboxStage">
			<button type="button" class="rr-lightbox-nav rr-lightbox-prev" id="rrLightboxPrev" aria-label="${labels.prev}">&#8249;</button>
			<img class="rr-lightbox-img" id="rrLightboxImg" src="" alt="" decoding="async">
			<button type="button" class="rr-lightbox-nav rr-lightbox-next" id="rrLightboxNext" aria-label="${labels.next}">&#8250;</button>
		</div>
		<div class="rr-lightbox-bottom" id="rrLightboxCaption"></div>
	`;
	document.body.appendChild(overlay);

	const imgEl = overlay.querySelector('#rrLightboxImg');
	const stageEl = overlay.querySelector('#rrLightboxStage');
	const captionEl = overlay.querySelector('#rrLightboxCaption');
	const counterEl = overlay.querySelector('#rrLightboxCounter');
	const zoomBtn = overlay.querySelector('#rrLightboxZoom');
	const closeBtn = overlay.querySelector('#rrLightboxClose');
	const prevBtn = overlay.querySelector('#rrLightboxPrev');
	const nextBtn = overlay.querySelector('#rrLightboxNext');

	let activeList = [];
	let currentIndex = 0;
	let zoomed = false;
	let panX = 0;
	let panY = 0;
	let dragStartX = 0;
	let dragStartY = 0;
	let swipeStartX = 0;
	let swipeStartY = 0;
	let isPointerDown = false;
	let movedDuringDrag = false;

	function applyImageTransform(extraX = 0, extraY = 0) {
		const scale = zoomed ? 2.15 : 1;
		imgEl.style.transform = `translate3d(${panX + extraX}px, ${panY + extraY}px, 0) scale(${scale})`;
		imgEl.classList.toggle('is-zoomed', zoomed);
		zoomBtn.textContent = zoomed ? labels.zoomOut : labels.zoomIn;
	}

	function resetZoom() {
		zoomed = false;
		panX = 0;
		panY = 0;
		imgEl.classList.remove('is-dragging');
		applyImageTransform();
	}

	function extractCaption(img) {
		const dataCap = img.getAttribute('data-caption');
		if (dataCap) return dataCap;
		const fig = img.closest('figure');
		const figCap = fig ? fig.querySelector('figcaption') : null;
		if (figCap && figCap.textContent.trim()) return figCap.textContent.trim();
		return img.alt || '';
	}

	function showIndex(idx) {
		if (!activeList.length) return;
		currentIndex = (idx + activeList.length) % activeList.length;
		const item = activeList[currentIndex];
		resetZoom();
		imgEl.style.opacity = '0.35';
		imgEl.src = item.src;
		imgEl.alt = item.alt || '';
		captionEl.textContent = extractCaption(item);
		counterEl.textContent = `${currentIndex + 1} / ${activeList.length}`;
		const showArrows = activeList.length > 1;
		prevBtn.style.display = showArrows ? 'flex' : 'none';
		nextBtn.style.display = showArrows ? 'flex' : 'none';
		requestAnimationFrame(() => {
			imgEl.style.opacity = '1';
		});
	}

	function openGallery(targetImg) {
		activeList = getGalleryTriggers();
		if (!activeList.length) activeList = [targetImg];
		const idx = activeList.indexOf(targetImg);
		overlay.classList.add('open');
		document.body.style.overflow = 'hidden';
		showIndex(idx >= 0 ? idx : 0);
	}

	function closeGallery() {
		overlay.classList.remove('open');
		document.body.style.overflow = '';
		resetZoom();
	}

	document.addEventListener('click', (e) => {
		const trigger = e.target && e.target.closest ? e.target.closest('[data-lightbox], .mentoring-photo-card img, .bot-photo-card img') : null;
		if (trigger && !trigger.closest('.rr-lightbox')) {
			e.preventDefault();
			openGallery(trigger);
		}
	});

	prevBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		showIndex(currentIndex - 1);
	});

	nextBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		showIndex(currentIndex + 1);
	});

	zoomBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		zoomed = !zoomed;
		if (!zoomed) {
			panX = 0;
			panY = 0;
		}
		applyImageTransform();
	});

	closeBtn.addEventListener('click', closeGallery);

	overlay.addEventListener('click', (e) => {
		if (e.target === overlay || e.target === stageEl) {
			closeGallery();
		}
	});

	imgEl.addEventListener('dblclick', (e) => {
		e.stopPropagation();
		zoomed = !zoomed;
		if (!zoomed) {
			panX = 0;
			panY = 0;
		}
		applyImageTransform();
	});

	// Swipe navigation (1x) + drag pan (zoomed)
	stageEl.addEventListener('pointerdown', (e) => {
		if (e.target.closest('button')) return;
		isPointerDown = true;
		movedDuringDrag = false;
		swipeStartX = e.clientX;
		swipeStartY = e.clientY;
		dragStartX = panX;
		dragStartY = panY;
		if (zoomed) {
			imgEl.classList.add('is-dragging');
		}
	});

	stageEl.addEventListener('pointermove', (e) => {
		if (!isPointerDown) return;
		const dx = e.clientX - swipeStartX;
		const dy = e.clientY - swipeStartY;
		if (Math.hypot(dx, dy) > 6) movedDuringDrag = true;

		if (zoomed) {
			panX = dragStartX + dx;
			panY = dragStartY + dy;
			applyImageTransform();
		} else if (Math.abs(dx) > Math.abs(dy)) {
			imgEl.style.transform = `translate3d(${dx * 0.35}px, 0, 0)`;
		}
	});

	function finishPointer(e) {
		if (!isPointerDown) return;
		isPointerDown = false;
		imgEl.classList.remove('is-dragging');
		const dx = e.clientX - swipeStartX;
		const dy = e.clientY - swipeStartY;

		if (!zoomed) {
			if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
				showIndex(dx < 0 ? currentIndex + 1 : currentIndex - 1);
				return;
			}
			if (dy > 95 && Math.abs(dy) > Math.abs(dx)) {
				closeGallery();
				return;
			}
			applyImageTransform();
			if (!movedDuringDrag && e.target === imgEl) {
				zoomed = true;
				applyImageTransform();
			}
		}
	}

	stageEl.addEventListener('pointerup', finishPointer);
	stageEl.addEventListener('pointercancel', finishPointer);

	document.addEventListener('keydown', (e) => {
		if (!overlay.classList.contains('open')) return;
		if (e.key === 'Escape') closeGallery();
		else if (e.key === 'ArrowLeft') showIndex(currentIndex - 1);
		else if (e.key === 'ArrowRight') showIndex(currentIndex + 1);
		else if (e.key === '+' || e.key === '=' || e.key.toLowerCase() === 'z') {
			zoomed = !zoomed;
			if (!zoomed) { panX = 0; panY = 0; }
			applyImageTransform();
		} else if (e.key === '0') {
			resetZoom();
		}
	});
})();

// ===== Live Season Roadmap & Competition Countdown =====
(function initSeasonRoadmap() {
	const root = document.getElementById('roadmap');
	if (!root) return;

	const isGerman = (document.documentElement.lang || '').toLowerCase().startsWith('de');

	// Auto-advancing BIOBUZZ target milestones (local CET/CEST Europe/Berlin reference)
	const biobuzzTargets = [
		{
			date: new Date('2027-01-24T09:00:00+01:00').getTime(),
			labelEn: 'Countdown to Regional Qualifier · Jan 2027 Target',
			labelDe: 'Countdown zum Regional-Qualifier · Ziel Jan 2027'
		},
		{
			date: new Date('2027-03-14T09:00:00+01:00').getTime(),
			labelEn: 'Countdown to German Championship · Mar 2027 Target',
			labelDe: 'Countdown zur Deutschen Meisterschaft · Ziel Mär 2027'
		},
		{
			date: new Date('2027-04-21T09:00:00-05:00').getTime(),
			labelEn: 'Countdown to FIRST World Festival · Apr 2027 Target',
			labelDe: 'Countdown zum FIRST World Festival · Ziel Apr 2027'
		}
	];

	function updateCountdown() {
		const now = Date.now();
		const target = biobuzzTargets.find(item => item.date > now) || biobuzzTargets[biobuzzTargets.length - 1];
		const diff = Math.max(0, target.date - now);

		const days = Math.floor(diff / 86400000);
		const hours = Math.floor((diff % 86400000) / 3600000);
		const mins = Math.floor((diff % 3600000) / 60000);
		const secs = Math.floor((diff % 60000) / 1000);

		const pad = (n) => String(n).padStart(2, '0');
		const setEl = (id, val) => {
			const el = document.getElementById(id);
			if (el) el.textContent = val;
		};

		setEl('cdDays', String(days));
		setEl('cdHours', pad(hours));
		setEl('cdMins', pad(mins));
		setEl('cdSecs', pad(secs));
		setEl('roadmapTargetLabel', isGerman ? target.labelDe : target.labelEn);
	}

	updateCountdown();
	setInterval(updateCountdown, 1000);

	// Clickable milestone detail switcher inside each roadmap track (BIOBUZZ & DECODE)
	root.querySelectorAll('.roadmap-shell').forEach(shell => {
		const steps = Array.from(shell.querySelectorAll('.roadmap-step'));
		const detailBadge = shell.querySelector('.roadmap-detail-badge');
		const detailText = shell.querySelector('.roadmap-detail-text');
		if (!steps.length || !detailBadge || !detailText) return;

		steps.forEach(step => {
			step.addEventListener('click', () => {
				steps.forEach(s => s.classList.remove('is-selected'));
				step.classList.add('is-selected');
				detailBadge.textContent = step.getAttribute('data-stage') || '';
				detailText.textContent = step.getAttribute('data-detail') || '';
			});
		});
	});
})();

// ===== Offline Connectivity Banner =====
(function initOfflineIndicator() {
	if (typeof window === 'undefined') return;

	const isGerman = (document.documentElement.lang || '').toLowerCase().startsWith('de') ||
		window.location.pathname.startsWith('/de');

	const offlineText = isGerman
		? 'Offline-Modus — Zwischengespeicherte Seiten & Bilder aktiv'
		: 'Offline Mode — Cached pages & images are active';

	document.addEventListener('DOMContentLoaded', () => {
		const offlineBanner = document.createElement('div');
		offlineBanner.id = 'pwaOfflineBanner';
		offlineBanner.className = 'pwa-offline-banner';
		offlineBanner.setAttribute('role', 'status');
		offlineBanner.setAttribute('aria-live', 'polite');
		offlineBanner.innerHTML = `<span class="pwa-offline-dot" aria-hidden="true"></span><span>${offlineText}</span>`;
		offlineBanner.hidden = true;
		document.body.appendChild(offlineBanner);

		function updateOnlineUI(isOffline) {
			const offline = typeof isOffline === 'boolean'
				? isOffline
				: (typeof navigator !== 'undefined' && navigator.onLine === false);
			offlineBanner.hidden = !offline;
			offlineBanner.classList.toggle('is-visible', offline);
		}

		window.addEventListener('online', () => updateOnlineUI(false));
		window.addEventListener('offline', () => updateOnlineUI(true));
		updateOnlineUI();
	});
})();