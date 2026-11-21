let deferredPrompt = null;
let installed = false;
let initialized = false;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');

function checkStandalone() {
	return (
		(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
		window.navigator.standalone === true
	);
}

export function initPwaInstallListeners() {
	if (initialized) return;
	initialized = true;
	installed = checkStandalone();

	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferredPrompt = e;
		syncInstallButton();
	});

	window.addEventListener('appinstalled', () => {
		installed = true;
		deferredPrompt = null;
		syncInstallButton();
	});
}

function getLang() {
	return (document.documentElement.lang || '').toLowerCase().startsWith('de') ? 'de' : 'en';
}

function openIOSModal() {
	const existing = document.getElementById('pwaIosModal');
	if (existing) existing.remove();

	const isDe = getLang() === 'de';
	const modal = document.createElement('div');
	modal.id = 'pwaIosModal';
	modal.className = 'pwa-ios-modal';
	modal.setAttribute('role', 'dialog');
	modal.setAttribute('aria-modal', 'true');
	modal.innerHTML = `
		<div class="pwa-ios-card">
			<h3>${isDe ? 'App auf iPhone / iPad installieren' : 'Install on iPhone / iPad'}</h3>
			<p>${isDe
				? '1. Tippe unten in Safari auf <strong>Teilen</strong>.<br>2. Wähle <strong>Zum Home-Bildschirm</strong> für sofortigen Offline-Start.'
				: '1. Tap the <strong>Share</strong> button in Safari.<br>2. Tap <strong>Add to Home Screen</strong> for instant offline launch.'}</p>
			<button type="button" class="pwa-ios-close">${isDe ? 'Schließen' : 'Close'}</button>
		</div>
	`;

	modal.addEventListener('click', (e) => {
		if (e.target === modal || e.target.closest('.pwa-ios-close')) {
			modal.remove();
		}
	});
	document.body.appendChild(modal);
}

export function syncInstallButton() {
	installed = checkStandalone();
	const footerContent = document.querySelector('footer .footer-content');
	if (!footerContent) return;

	const existing = footerContent.querySelector('#pwaInstallBtn');
	if (installed || (!deferredPrompt && !isIOS)) {
		if (existing) existing.remove();
		return;
	}

	const isDe = getLang() === 'de';
	let btn = existing;
	if (!btn) {
		btn = document.createElement('button');
		btn.type = 'button';
		btn.id = 'pwaInstallBtn';
		btn.className = 'pwa-install-btn';
		btn.addEventListener('click', async () => {
			if (deferredPrompt) {
				try {
					await deferredPrompt.prompt();
					const choice = await deferredPrompt.userChoice;
					if (choice && choice.outcome === 'accepted') {
						installed = true;
						deferredPrompt = null;
					}
				} catch {
					// Ignore prompt cancellation errors
				}
				syncInstallButton();
			} else if (isIOS) {
				openIOSModal();
			}
		});
		const meta = footerContent.querySelector('.footer-meta');
		if (meta) {
			footerContent.insertBefore(btn, meta);
		} else {
			footerContent.appendChild(btn);
		}
	}

	btn.textContent = deferredPrompt
		? (isDe ? 'App lokal installieren (Offline)' : 'Install App Locally (Offline)')
		: (isDe ? 'Auf Home-Bildschirm installieren' : 'Install on iOS');
}
