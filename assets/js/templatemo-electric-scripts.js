// ===== JavaScript Document =====

(function bootstrapRoboRooster() {
	if (typeof window === 'undefined' || window.__rrScriptsBooted) return;
	window.__rrScriptsBooted = true;

	const ASSET_VERSION_JS = '20261121j';
	const SW_CACHE_VERSION = 'v26';
	const CLEAN_PAGE_SLUGS = new Set(['', 'bot', 'team-details', 'battlebots', 'sponsors', 'chemie_ka']);

	const pageHtmlCache = new Map();
	const inFlightHtmlFetches = new Map();
	const loadedModulePromises = new Map();
	let activePageCleanup = [];
	let navTransitionToken = 0;
	let pageRenderGeneration = 0;

	function importLazyChunk(path) {
		if (!loadedModulePromises.has(path)) {
			loadedModulePromises.set(
				path,
				import(path).catch((err) => {
					loadedModulePromises.delete(path);
					throw err;
				})
			);
		}
		return loadedModulePromises.get(path);
	}

	function notifySwPrecache(type) {
		if (!('serviceWorker' in navigator)) return;
		const ctrl = navigator.serviceWorker.controller;
		if (!ctrl) return;
		try {
			ctrl.postMessage({ type });
		} catch {
			// Ignore postMessage failure
		}
	}

	function registerPageCleanup(fn) {
		if (typeof fn === 'function') {
			activePageCleanup.push(fn);
		}
	}

	function teardownPageFeatures() {
		pageRenderGeneration += 1;
		while (activePageCleanup.length > 0) {
			const fn = activePageCleanup.pop();
			try {
				fn();
			} catch {
				// Ignore individual cleanup errors
			}
		}
		if (typeof window.__rrDisposeCadViewer === 'function') {
			try {
				window.__rrDisposeCadViewer();
			} catch {
				// Ignore CAD disposal errors
			}
		}
		const existingLightbox = document.querySelector('.rr-lightbox');
		if (existingLightbox) {
			existingLightbox.remove();
			document.body.style.overflow = '';
		}
	}

	// ===== Clean Language-Less URL & Language Persistence =====
	function persistLang(lang, isExplicit) {
		const valid = lang === 'de' ? 'de' : 'en';
		try {
			localStorage.setItem('rr_lang', valid);
		} catch {
			// Ignore storage errors
		}
		if (isExplicit) {
			try {
				sessionStorage.setItem('rr_lang_explicit', valid);
			} catch {
				// Ignore storage errors
			}
		}
		try {
			const isHttps = window.location.protocol === 'https:';
			document.cookie = isHttps
				? 'rr_lang=' + valid + '; Path=/; Max-Age=31536000; SameSite=None; Secure; Partitioned'
				: 'rr_lang=' + valid + '; Path=/; Max-Age=31536000; SameSite=Lax';
		} catch {
			// Ignore cookie errors
		}
	}

	function toCleanPathname(pathname) {
		let p = pathname || '/';
		const prefixMatch = p.match(/^\/(en|de)(?:\/(.*))?$/i);
		if (prefixMatch) {
			p = '/' + (prefixMatch[2] || '');
		}
		p = p.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '');
		if (p.length > 1 && p.endsWith('/')) {
			p = p.slice(0, -1);
		}
		return p || '/';
	}

	function getSlugFromCleanPath(cleanPath) {
		const seg = (cleanPath || '/').replace(/^\/+|\/+$/g, '');
		return seg || 'index';
	}

	function isCleanAppRoute(cleanPath) {
		const seg = (cleanPath || '/').replace(/^\/+|\/+$/g, '');
		return CLEAN_PAGE_SLUGS.has(seg);
	}

	function getActiveLang() {
		try {
			const explicit = (sessionStorage.getItem('rr_lang_explicit') || '').toLowerCase();
			if (explicit === 'en' || explicit === 'de') return explicit;
		} catch {
			// Ignore storage errors
		}
		return (document.documentElement.lang || '').toLowerCase().startsWith('de') ? 'de' : 'en';
	}

	function clearPageCaches() {
		pageHtmlCache.clear();
		if (!('caches' in window)) return Promise.resolve();
		return caches.keys()
			.then((keys) => Promise.all(
				keys.filter((k) => k.startsWith('rr-pages-')).map((k) => caches.delete(k))
			))
			.catch(() => {});
	}

	function fetchRawPageHtml(lang, slug) {
		const safeLang = slug === 'chemie_ka' ? 'en' : (lang === 'de' ? 'de' : 'en');
		const cacheKey = `${safeLang}:${slug}`;
		if (pageHtmlCache.has(cacheKey)) {
			return Promise.resolve(pageHtmlCache.get(cacheKey));
		}
		if (inFlightHtmlFetches.has(cacheKey)) {
			return inFlightHtmlFetches.get(cacheKey);
		}
		const rawUrl = `/${safeLang}/${slug}.html`;
		const reqPromise = fetch(rawUrl, {
			headers: { 'X-RR-Raw': '1' },
			credentials: 'same-origin'
		})
			.then((res) => {
				if (!res.ok) throw new Error('HTTP ' + res.status);
				return res.text();
			})
			.then((html) => {
				pageHtmlCache.set(cacheKey, html);
				return html;
			})
			.finally(() => {
				inFlightHtmlFetches.delete(cacheKey);
			});
		inFlightHtmlFetches.set(cacheKey, reqPromise);
		return reqPromise;
	}

	// Mark initial page-specific inline <style> tags so SPA navigation replaces them cleanly
	Array.from(document.head.querySelectorAll('style')).forEach((s) => {
		s.setAttribute('data-rr-page-style', '1');
	});

	// ===== Season Theme Manager (BIOBUZZ 2026/27 Default vs DECODE 2025/26) =====
	const SEASON_STORAGE_KEY = 'roborooster_season_v3';

	function getInitialSeason() {
		try {
			localStorage.removeItem('roborooster_season');
			const params = new URLSearchParams(window.location.search);
			const urlSeason = params.get('season');
			if (urlSeason === 'biobuzz' || urlSeason === 'decode') {
				sessionStorage.setItem(SEASON_STORAGE_KEY, urlSeason);
				return urlSeason;
			}
			const saved = sessionStorage.getItem(SEASON_STORAGE_KEY);
			if (saved === 'biobuzz' || saved === 'decode') {
				return saved;
			}
		} catch {
			// Ignore storage access issues
		}
		return 'biobuzz';
	}

	function applySeason(season, persist) {
		const validSeason = season === 'decode' ? 'decode' : 'biobuzz';
		document.documentElement.setAttribute('data-season', validSeason);

		if (persist) {
			try {
				sessionStorage.setItem(SEASON_STORAGE_KEY, validSeason);
			} catch {
				// Ignore storage access issues
			}
		}

		document.querySelectorAll('[data-season-choice]').forEach((btn) => {
			const isActive = btn.getAttribute('data-season-choice') === validSeason;
			btn.classList.toggle('active', isActive);
			btn.setAttribute('aria-pressed', String(isActive));
		});

		document.querySelectorAll('[data-decode-text][data-biobuzz-text]').forEach((el) => {
			el.textContent = validSeason === 'biobuzz'
				? el.getAttribute('data-biobuzz-text')
				: el.getAttribute('data-decode-text');
		});

		const themeMeta = document.querySelector('meta[name="theme-color"]');
		if (themeMeta) {
			themeMeta.setAttribute('content', validSeason === 'biobuzz' ? '#236B43' : '#0a0a0f');
		}
	}

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

	applySeason(getInitialSeason(), false);

	// Delegated click for season toggle buttons across initial & SPA-swapped pages
	document.addEventListener('click', (e) => {
		const btn = e.target && e.target.closest ? e.target.closest('[data-season-choice]') : null;
		if (!btn) return;
		const chosen = btn.getAttribute('data-season-choice');
		switchSeasonWithRipple(chosen, btn, e);
	});

	// ===== Top Slim Progress Bar =====
	function getProgressBar() {
		let bar = document.querySelector('.rr-nav-progress');
		if (!bar) {
			bar = document.createElement('div');
			bar.className = 'rr-nav-progress';
			bar.setAttribute('aria-hidden', 'true');
			document.body.appendChild(bar);
		}
		return bar;
	}

	function showProgressBar() {
		const bar = getProgressBar();
		bar.classList.remove('is-done');
		bar.classList.add('is-active');
	}

	function finishProgressBar() {
		const bar = document.querySelector('.rr-nav-progress');
		if (!bar) return;
		bar.classList.remove('is-active');
		bar.classList.add('is-done');
		setTimeout(() => bar.classList.remove('is-done'), 260);
	}

	// ===== Lazy Code-Split 3D CAD Component (Suspense-Style Viewport + Interaction Boundary) =====
	function loadCadChunkAndMount() {
		const mountEl = document.getElementById('botCadViewerSection');
		if (!mountEl) return;

		if (typeof window.__rrMountCadViewer === 'function') {
			window.__rrMountCadViewer();
			return;
		}

		const loadingOverlay = mountEl.querySelector('#cadLoadingOverlay');
		if (loadingOverlay && mountEl.dataset.cadPreview === 'compact') {
			loadingOverlay.hidden = false;
		}

		const myGen = pageRenderGeneration;
		importLazyChunk(`/assets/js/robot-cad-viewer.js?v=${ASSET_VERSION_JS}`)
			.then(() => {
				if (myGen !== pageRenderGeneration) return;
				if (typeof window.__rrMountCadViewer === 'function') {
					window.__rrMountCadViewer();
				}
			})
			.catch(() => {
				window.__rrCadModuleError = getActiveLang() === 'de'
					? '3D-CAD-Modul konnte nicht geladen werden.'
					: 'Failed to load 3D CAD viewer module.';
				const statusEl = document.getElementById('cadModelStatus');
				if (statusEl) statusEl.textContent = window.__rrCadModuleError;
			});
	}

	function ensureCadViewerLazy() {
		const mountEl = document.getElementById('botCadViewerSection');
		if (!mountEl) return;

		// If module is already cached in memory, mount immediately without waiting
		if (typeof window.__rrMountCadViewer === 'function') {
			window.__rrMountCadViewer();
			return;
		}

		let triggered = false;
		let observer = null;
		const triggerMount = () => {
			if (triggered) return;
			triggered = true;
			if (observer) {
				observer.disconnect();
				observer = null;
			}
			loadCadChunkAndMount();
		};

		mountEl.addEventListener('pointerenter', triggerMount, { once: true });
		mountEl.addEventListener('click', triggerMount, { once: true });

		if ('IntersectionObserver' in window) {
			observer = new IntersectionObserver((entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						triggerMount();
						break;
					}
				}
			}, { rootMargin: '450px 0px' });
			observer.observe(mountEl);
			registerPageCleanup(() => {
				if (observer) {
					observer.disconnect();
					observer = null;
				}
			});
		} else {
			setTimeout(triggerMount, 180);
		}
	}

	// ===== PWA Install Button Integration (Lazy Code-Split) =====
	function syncPwaInstallUI() {
		importLazyChunk(`/assets/js/modules/pwa-install.js?v=${ASSET_VERSION_JS}`)
			.then((mod) => {
				if (mod && typeof mod.initPwaInstallListeners === 'function') {
					mod.initPwaInstallListeners();
				}
				if (mod && typeof mod.syncInstallButton === 'function') {
					mod.syncInstallButton();
				}
			})
			.catch(() => {});
	}

	// ===== Instant Zero-Flash SPA Navigation =====
	let resumePrecacheTimer = null;

	async function navigateToCleanUrl(targetUrlObj, { push = true, forceLang = null } = {}) {
		const token = ++navTransitionToken;
		const cleanPath = toCleanPathname(targetUrlObj.pathname);
		const slug = getSlugFromCleanPath(cleanPath);
		const lang = forceLang || getActiveLang();
		const isCached = pageHtmlCache.has(`${slug === 'chemie_ka' ? 'en' : lang}:${slug}`);

		// Pause background precaching while foreground route switch happens
		notifySwPrecache('PAUSE_PRECACHE');
		if (resumePrecacheTimer) {
			clearTimeout(resumePrecacheTimer);
			resumePrecacheTimer = null;
		}

		let progressTimer = null;
		if (!isCached) {
			progressTimer = setTimeout(showProgressBar, 55);
		}

		try {
			const html = await fetchRawPageHtml(lang, slug);
			if (token !== navTransitionToken) return;

			if (progressTimer) {
				clearTimeout(progressTimer);
				progressTimer = null;
			}

			const parser = new DOMParser();
			const parsedDoc = parser.parseFromString(html, 'text/html');
			if (!parsedDoc || !parsedDoc.body) {
				window.location.assign(targetUrlObj.href);
				return;
			}

			parsedDoc.body.querySelectorAll('script').forEach((s) => s.remove());

			teardownPageFeatures();

			// Sync head page-specific inline <style> tags (e.g. sponsors.html / battlebots.html)
			document.head.querySelectorAll('style[data-rr-page-style]').forEach((s) => s.remove());
			parsedDoc.head.querySelectorAll('style').forEach((styleNode) => {
				const cloned = document.createElement('style');
				cloned.setAttribute('data-rr-page-style', '1');
				cloned.textContent = styleNode.textContent;
				document.head.appendChild(cloned);
			});

			document.title = parsedDoc.title || document.title;
			document.documentElement.lang = parsedDoc.documentElement.lang || lang;

			const searchStr = targetUrlObj.search || '';
			const cleanHref = cleanPath + searchStr + (targetUrlObj.hash || '');
			if (push) {
				window.history.pushState({ rrCleanHref: cleanHref }, '', cleanHref);
			} else {
				window.history.replaceState({ rrCleanHref: cleanHref }, '', cleanHref);
			}

			const applyDomSwap = () => {
				const existingProgress = document.querySelector('.rr-nav-progress');
				document.body.innerHTML = parsedDoc.body.innerHTML;
				if (existingProgress) {
					document.body.appendChild(existingProgress);
				}
				document.body.classList.add('rr-spa-entering');
				setTimeout(() => document.body.classList.remove('rr-spa-entering'), 200);
			};

			if (typeof document.startViewTransition === 'function' && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
				const vt = document.startViewTransition(() => {
					applyDomSwap();
				});
				await vt.ready.catch(() => {});
			} else {
				applyDomSwap();
			}

			if (targetUrlObj.hash) {
				const hashTarget = document.querySelector(targetUrlObj.hash);
				if (hashTarget) {
					hashTarget.scrollIntoView({ behavior: 'instant', block: 'start' });
				} else {
					window.scrollTo(0, 0);
				}
			} else {
				window.scrollTo(0, 0);
			}

			applySeason(getInitialSeason(), false);
			initPageFeatures();
			ensureCadViewerLazy();
			syncPwaInstallUI();
			finishProgressBar();
		} catch {
			if (progressTimer) clearTimeout(progressTimer);
			finishProgressBar();
			window.location.assign(cleanPath + (targetUrlObj.search || '') + (targetUrlObj.hash || ''));
		} finally {
			resumePrecacheTimer = setTimeout(() => notifySwPrecache('RESUME_PRECACHE'), 900);
		}
	}

	// ===== Clean Initial URL Normalization & Blocked-Cookie Reconciliation =====
	(function initUrlAndLangSync() {
		const docLang = (document.documentElement.lang || '').toLowerCase().startsWith('de') ? 'de' : 'en';
		let currentCleanPath = '/';

		try {
			const url = new URL(window.location.href);
			const prefixMatch = url.pathname.match(/^\/(en|de)(?:\/|$)/i);
			const hadLangPrefix = Boolean(prefixMatch);
			const paramLang = (url.searchParams.get('lang') || '').toLowerCase();
			const hadLangParam = paramLang === 'en' || paramLang === 'de';
			currentCleanPath = toCleanPathname(url.pathname);

			if (hadLangPrefix) {
				persistLang(prefixMatch[1].toLowerCase(), true);
			} else if (hadLangParam) {
				persistLang(paramLang, true);
			}

			if (url.searchParams.has('lang')) {
				url.searchParams.delete('lang');
			}
			const cleanSearch = url.searchParams.toString();
			const target = currentCleanPath + (cleanSearch ? '?' + cleanSearch : '') + url.hash;
			if (hadLangPrefix || hadLangParam || currentCleanPath !== url.pathname) {
				window.history.replaceState({ rrCleanHref: target }, '', target);
			} else if (!window.history.state) {
				window.history.replaceState({ rrCleanHref: target }, '', target);
			}
		} catch {
			currentCleanPath = toCleanPathname(window.location.pathname);
		}

		// Reconcile immediately via raw template if third-party iframe blocked cookies
		try {
			const savedExplicit = (sessionStorage.getItem('rr_lang_explicit') || localStorage.getItem('rr_lang') || '').toLowerCase();
			if ((savedExplicit === 'en' || savedExplicit === 'de') && savedExplicit !== docLang) {
				persistLang(savedExplicit, true);
				const targetUrl = new URL(window.location.href);
				navigateToCleanUrl(targetUrl, { push: false, forceLang: savedExplicit });
			}
		} catch {
			// Ignore storage access errors
		}
	})();

	// ===== Language Switcher Click Handler (Instant, Zero White Screen) =====
	document.addEventListener('click', (e) => {
		const link = e.target && e.target.closest ? e.target.closest('.lang-switch a') : null;
		if (!link) return;

		e.preventDefault();
		const explicit = (link.getAttribute('data-lang-choice') || '').toLowerCase();
		const href = (link.getAttribute('href') || '').toLowerCase();
		let chosen = '';
		if (explicit === 'en' || explicit === 'de') {
			chosen = explicit;
		} else if (href.includes('lang=de') || href.startsWith('/de')) {
			chosen = 'de';
		} else if (href.includes('lang=en') || href.startsWith('/en')) {
			chosen = 'en';
		} else {
			chosen = (link.textContent || '').trim().toLowerCase().startsWith('de') ? 'de' : 'en';
		}

		persistLang(chosen, true);
		clearPageCaches().finally(() => {
			const current = new URL(window.location.href);
			current.searchParams.delete('lang');
			current.pathname = toCleanPathname(current.pathname);
			navigateToCleanUrl(current, { push: false, forceLang: chosen });
		});
	});

	// ===== Speculative Preload + Instant Click Router =====
	function resolveCleanInternalTarget(anchor) {
		if (!anchor || !anchor.href) return null;
		if (anchor.target === '_blank' || anchor.hasAttribute('download')) return null;
		if (anchor.closest('.lang-switch') || anchor.hasAttribute('data-lang-choice')) return null;
		const rawHref = anchor.getAttribute('href') || '';
		if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || /[?&]lang=/i.test(rawHref)) {
			return null;
		}
		try {
			const url = new URL(anchor.href, window.location.href);
			if (url.origin !== window.location.origin) return null;
			const cleanPath = toCleanPathname(url.pathname);
			if (!isCleanAppRoute(cleanPath)) return null;
			url.pathname = cleanPath;
			return url;
		} catch {
			return null;
		}
	}

	document.addEventListener('pointerenter', (e) => {
		const anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
		const url = resolveCleanInternalTarget(anchor);
		if (url) {
			fetchRawPageHtml(getActiveLang(), getSlugFromCleanPath(url.pathname)).catch(() => {});
		}
	}, true);

	document.addEventListener('touchstart', (e) => {
		const anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
		const url = resolveCleanInternalTarget(anchor);
		if (url) {
			fetchRawPageHtml(getActiveLang(), getSlugFromCleanPath(url.pathname)).catch(() => {});
		}
	}, { capture: true, passive: true });

	document.addEventListener('click', (e) => {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
			return;
		}
		const anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
		if (!anchor) return;

		const rawHref = anchor.getAttribute('href') || '';
		if (rawHref.startsWith('#')) {
			if (rawHref.length > 1) {
				const target = document.querySelector(rawHref);
				if (target) {
					e.preventDefault();
					target.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			}
			return;
		}

		const targetUrl = resolveCleanInternalTarget(anchor);
		if (!targetUrl) return;

		const currentClean = toCleanPathname(window.location.pathname);
		if (targetUrl.pathname === currentClean && targetUrl.search === window.location.search) {
			e.preventDefault();
			const menuToggle = document.getElementById('menuToggle');
			const navLinks = document.getElementById('navLinks');
			if (menuToggle) menuToggle.classList.remove('active');
			if (navLinks) navLinks.classList.remove('active');

			if (targetUrl.hash) {
				const el = document.querySelector(targetUrl.hash);
				if (el) {
					el.scrollIntoView({ behavior: 'smooth', block: 'start' });
					return;
				}
			}
			window.scrollTo({ top: 0, behavior: 'smooth' });
			return;
		}

		e.preventDefault();
		navigateToCleanUrl(targetUrl, { push: true });
	});

	window.addEventListener('popstate', () => {
		const url = new URL(window.location.href);
		const cleanPath = toCleanPathname(url.pathname);
		if (!isCleanAppRoute(cleanPath)) return;
		url.pathname = cleanPath;
		navigateToCleanUrl(url, { push: false });
	});

	// ===== Capacity-Aware Offline Vault Synchronizer & Service Worker =====
	function warmDeviceVaultIdle() {
		const startSync = () => {
			importLazyChunk(`/assets/js/modules/offline-vault.js?v=${ASSET_VERSION_JS}`)
				.then((vault) => {
					if (!vault || typeof vault.syncLocalOfflineVault !== 'function') return;
					return vault.syncLocalOfflineVault({
						activeLang: getActiveLang(),
						pageSlugs: ['index', 'team-details', 'bot', 'battlebots', 'sponsors'],
						fetchRawPageHtml
					});
				})
				.catch(() => {});
		};

		const schedule = () => {
			if ('requestIdleCallback' in window) {
				window.requestIdleCallback(() => startSync(), { timeout: 4500 });
			} else {
				setTimeout(startSync, 1400);
			}
		};

		setTimeout(schedule, 1100);
	}

	if ('serviceWorker' in navigator) {
		window.addEventListener('load', () => {
			const hadController = Boolean(navigator.serviceWorker.controller);
			let refreshing = false;

			navigator.serviceWorker.addEventListener('controllerchange', () => {
				if (!hadController || refreshing) return;
				try {
					if (sessionStorage.getItem('rr_sw_reloaded') === SW_CACHE_VERSION) return;
					sessionStorage.setItem('rr_sw_reloaded', SW_CACHE_VERSION);
				} catch {
					// Ignore storage access errors
				}
				refreshing = true;
				window.location.reload();
			});

			navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
				.then((reg) => {
					reg.update().catch(() => {});
					warmDeviceVaultIdle();
				})
				.catch(() => {
					warmDeviceVaultIdle();
				});
		});
	} else {
		window.addEventListener('load', warmDeviceVaultIdle);
	}

	// ===== Global Navbar Scroll Effect (Registered Once) =====
	let scrollTicking = false;
	function updateActiveNav() {
		const sections = document.querySelectorAll('section[id]');
		const navItems = document.querySelectorAll('.nav-link');
		if (!navItems.length || !sections.length) return;
		const scrollPosition = window.pageYOffset + 100;

		sections.forEach((section) => {
			const sectionTop = section.offsetTop;
			const sectionHeight = section.offsetHeight;
			if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
				navItems.forEach((item) => item.classList.remove('active'));
				const currentNav = document.querySelector(`.nav-link[href="#${section.id}"]`);
				if (currentNav) currentNav.classList.add('active');
			}
		});
	}

	window.addEventListener('scroll', () => {
		if (scrollTicking) return;
		scrollTicking = true;
		requestAnimationFrame(() => {
			const navbar = document.getElementById('navbar');
			if (navbar) {
				navbar.classList.toggle('scrolled', window.scrollY > 50);
			}
			updateActiveNav();
			scrollTicking = false;
		});
	}, { passive: true });

	// ===== Per-Page Feature Initializer (With Code-Split Route Modules) =====
	function initPageFeatures() {
		const myGen = pageRenderGeneration;

		// 1. Floating Particles
		const particlesContainer = document.getElementById('particles');
		if (particlesContainer && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
			if (!particlesContainer.children.length) {
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
		}

		// 2. Mobile Menu Toggle
		const menuToggle = document.getElementById('menuToggle');
		const navLinks = document.getElementById('navLinks');
		if (menuToggle && navLinks) {
			menuToggle.addEventListener('click', () => {
				menuToggle.classList.toggle('active');
				navLinks.classList.toggle('active');
			});
			navLinks.querySelectorAll('a').forEach((link) => {
				link.addEventListener('click', () => {
					menuToggle.classList.remove('active');
					navLinks.classList.remove('active');
				});
			});
		}

		updateActiveNav();

		// 3. Scoped Feature Tabs
		document.querySelectorAll('.features-container').forEach((container) => {
			const tabs = container.querySelectorAll('.tab-item');
			const panels = container.querySelectorAll('.content-panel');
			tabs.forEach((tab) => {
				tab.addEventListener('click', () => {
					const tabId = tab.getAttribute('data-tab');
					if (!tabId) return;
					tabs.forEach((t) => t.classList.remove('active'));
					panels.forEach((p) => p.classList.remove('active'));
					tab.classList.add('active');
					const targetPanel = container.querySelector(`#${CSS.escape(tabId)}`) || document.getElementById(tabId);
					if (targetPanel) targetPanel.classList.add('active');
				});
			});
		});

		// 4. Form Submission
		const contactForm = document.getElementById('contactForm');
		if (contactForm) {
			contactForm.addEventListener('submit', function (e) {
				e.preventDefault();
				this.reset();
			});
		}

		// 5. Hero Text Rotation with Pixel-Exact Glitch Alignment
		const textSets = document.querySelectorAll('.text-set');
		if (textSets.length > 0) {
			let currentIndex = 0;
			let isAnimating = false;
			let settleTimer = null;
			let rotatePhaseTimer = null;
			let rotateInterval = null;

			function wrapTextWordsInSpans(element, rawText, isOut) {
				const words = rawText.split(' ');
				let charIndex = 0;
				const delayStep = isOut ? 0.015 : 0.035;
				element.innerHTML = words.map((word) => {
					const letters = word.split('').map((ch) => {
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
					glitchText.classList.add('is-animating');
					wrapTextWordsInSpans(glitchText, rawText, false);
					const settleDelay = Math.min(900, rawText.length * 35 + 380);
					settleTimer = setTimeout(() => {
						glitchText.textContent = rawText;
						glitchText.classList.remove('is-animating');
					}, settleDelay);
				}
				if (subtitle) {
					subtitle.classList.remove('visible');
					setTimeout(() => subtitle.classList.add('visible'), 420);
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
				if (subtitle) subtitle.classList.remove('visible');
			}

			function rotateText() {
				if (isAnimating || textSets.length < 2) return;
				isAnimating = true;
				const currentSet = textSets[currentIndex];
				const nextIndex = (currentIndex + 1) % textSets.length;
				const nextSet = textSets[nextIndex];
				animateTextOut(currentSet);
				rotatePhaseTimer = setTimeout(() => {
					currentSet.classList.remove('active');
					nextSet.classList.add('active');
					animateTextIn(nextSet);
					currentIndex = nextIndex;
					isAnimating = false;
				}, 450);
			}

			textSets.forEach((ts) => ts.classList.remove('active'));
			textSets[0].classList.add('active');
			animateTextIn(textSets[0]);

			if (textSets.length > 1) {
				rotateInterval = setInterval(rotateText, 4800);
			}

			registerPageCleanup(() => {
				if (settleTimer) clearTimeout(settleTimer);
				if (rotatePhaseTimer) clearTimeout(rotatePhaseTimer);
				if (rotateInterval) clearInterval(rotateInterval);
			});
		}

		// 6. Code-Split Team Member Portrait & Row Spotlight (only on routes with .team-bento-grid)
		const teamGrid = document.querySelector('.team-bento-grid');
		if (teamGrid) {
			importLazyChunk(`/assets/js/modules/team-spotlight.js?v=${ASSET_VERSION_JS}`)
				.then((mod) => {
					if (myGen !== pageRenderGeneration) return;
					if (mod && typeof mod.mountTeamSpotlight === 'function') {
						mod.mountTeamSpotlight(teamGrid, registerPageCleanup);
					}
				})
				.catch(() => {});
		}

		// 7. Code-Split Fullscreen Lightbox Gallery (lazy-loaded on click or idle)
		const hasAnyGalleryImg = document.querySelector('[data-lightbox], .mentoring-photo-card img, .bot-photo-card img');
		if (hasAnyGalleryImg) {
			let galleryMounted = false;
			let pendingTriggerImg = null;

			const loadGallery = (triggerImg = null) => {
				if (galleryMounted) return;
				galleryMounted = true;
				if (triggerImg) pendingTriggerImg = triggerImg;
				importLazyChunk(`/assets/js/modules/lightbox-gallery.js?v=${ASSET_VERSION_JS}`)
					.then((mod) => {
						if (myGen !== pageRenderGeneration) return;
						if (mod && typeof mod.mountLightboxGallery === 'function') {
							mod.mountLightboxGallery(getActiveLang(), registerPageCleanup, pendingTriggerImg);
							pendingTriggerImg = null;
						}
					})
					.catch(() => {
						galleryMounted = false;
					});
			};

			const earlyGalleryClick = (e) => {
				if (galleryMounted) return;
				const trigger = e.target && e.target.closest
					? e.target.closest('[data-lightbox], .mentoring-photo-card img, .bot-photo-card img')
					: null;
				if (trigger && !trigger.closest('.rr-lightbox')) {
					e.preventDefault();
					loadGallery(trigger);
				}
			};
			document.addEventListener('click', earlyGalleryClick);
			registerPageCleanup(() => document.removeEventListener('click', earlyGalleryClick));

			if ('requestIdleCallback' in window) {
				window.requestIdleCallback(() => {
					if (myGen === pageRenderGeneration) loadGallery(null);
				}, { timeout: 2200 });
			} else {
				setTimeout(() => {
					if (myGen === pageRenderGeneration) loadGallery(null);
				}, 900);
			}
		}

		// 8. Season Archive Roadmap Switcher
		const roadmapRoot = document.getElementById('roadmap');
		if (roadmapRoot) {
			roadmapRoot.querySelectorAll('.roadmap-shell').forEach((shell) => {
				const steps = Array.from(shell.querySelectorAll('.roadmap-step'));
				const detailBadge = shell.querySelector('.roadmap-detail-badge');
				const detailText = shell.querySelector('.roadmap-detail-text');
				if (!steps.length || !detailBadge || !detailText) return;
				steps.forEach((step) => {
					step.addEventListener('click', () => {
						steps.forEach((s) => s.classList.remove('is-selected'));
						step.classList.add('is-selected');
						detailBadge.textContent = step.getAttribute('data-stage') || '';
						detailText.textContent = step.getAttribute('data-detail') || '';
					});
				});
			});
		}

		// 9. Offline Connectivity Banner
		const isGerman = getActiveLang() === 'de';
		const offlineText = isGerman
			? 'Offline-Modus — Zwischengespeicherte Seiten & Bilder aktiv'
			: 'Offline Mode — Cached pages & images are active';
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

		const onOnline = () => updateOnlineUI(false);
		const onOffline = () => updateOnlineUI(true);
		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);
		updateOnlineUI();

		registerPageCleanup(() => {
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
			offlineBanner.remove();
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			applySeason(getInitialSeason(), false);
			initPageFeatures();
			ensureCadViewerLazy();
			syncPwaInstallUI();
		});
	} else {
		applySeason(getInitialSeason(), false);
		initPageFeatures();
		ensureCadViewerLazy();
		syncPwaInstallUI();
	}
})();