const ASSET_VERSION = '20261121k';

const CORE_CODE_CHUNKS = [
	`/assets/js/modules/team-spotlight.js?v=${ASSET_VERSION}`,
	`/assets/js/modules/lightbox-gallery.js?v=${ASSET_VERSION}`,
	`/assets/js/modules/offline-vault.js?v=${ASSET_VERSION}`,
	`/assets/js/modules/pwa-install.js?v=${ASSET_VERSION}`,
	`/assets/js/robot-cad-viewer.js?v=${ASSET_VERSION}`
];

const THREE_ENGINE_CHUNKS = [
	'/assets/js/three/core/three.module.js',
	'/assets/js/three/core/three.core.js',
	'/assets/js/three/examples/jsm/controls/OrbitControls.js',
	'/assets/js/three/examples/jsm/environments/RoomEnvironment.js',
	'/assets/js/three/examples/jsm/loaders/GLTFLoader.js',
	'/assets/js/three/examples/jsm/loaders/DRACOLoader.js',
	'/assets/js/three/examples/jsm/loaders/OBJLoader.js',
	'/assets/js/three/examples/jsm/loaders/MTLLoader.js',
	'/assets/js/three/examples/jsm/libs/meshopt_decoder.module.js',
	'/assets/js/three/examples/jsm/utils/BufferGeometryUtils.js',
	'/assets/js/three/examples/jsm/utils/SkeletonUtils.js',
	'/assets/js/three/examples/jsm/libs/draco/gltf/draco_decoder.js',
	'/assets/js/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js',
	'/assets/js/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm'
];

const ESSENTIAL_IMAGES = [
	'/assets/images/opt/logo.webp',
	'/assets/images/opt/team.webp',
	'/assets/images/opt/heidehof.webp',
	'/assets/images/opt/first.webp',
	'/assets/images/opt/kazuma.webp',
	'/assets/images/opt/johannes.webp',
	'/public/assets/aistudio/opt/victoria_49c43635.webp',
	'/public/assets/aistudio/opt/leopold_d62a13f1.webp',
	'/assets/images/opt/christian.webp',
	'/assets/images/opt/ferdinand.webp',
	'/assets/images/opt/christopher.webp',
	'/assets/images/opt/merle.webp',
	'/assets/images/opt/amalie.webp',
	'/assets/images/opt/jonas.webp',
	'/assets/images/opt/jakob.webp',
	'/assets/images/opt/moritz.bu.webp',
	'/assets/images/opt/ganter-logo.webp',
	'/assets/images/opt/amf-logo.webp',
	'/assets/images/opt/maedler-logo.webp'
];

const FULL_MEDIA_ASSETS = [
	'/public/assets/aistudio/opt/Scrimmage_11_7fbdc7e8.webp',
	'/public/assets/aistudio/opt/image_73628792.webp',
	'/public/assets/aistudio/opt/Scrimmage_15_25746fc0.webp',
	'/public/assets/aistudio/opt/Scrimmage_17_b048375f.webp',
	'/public/assets/aistudio/opt/IMG_1250_7e552ec0.webp',
	'/public/assets/aistudio/opt/Scrimmage_10_4ce575c0.webp',
	'/public/assets/aistudio/opt/Scrimmage_24_b373477d.webp',
	'/public/assets/aistudio/opt/IMG_1248_e3017baa.webp',
	'/public/assets/aistudio/opt/Screenshot_2026-06-11_222646_92a7f83a.webp',
	'/public/assets/aistudio/opt/Screenshot_2026-06-11_222734_e80ba9d8.webp',
	'/public/assets/aistudio/opt/Scrimmage_12_fb407ec2.webp',
	'/public/assets/aistudio/opt/IMG_1241_26785de7.webp',
	'/public/assets/aistudio/opt/IMG_1245_6555a5aa.webp',
	'/public/assets/aistudio/opt/IMG_1244_826d29d4.webp',
	'/public/assets/aistudio/opt/KRTI2118_bef150f6.webp',
	'/public/assets/aistudio/opt/IMG_1256_4bd4bc01.webp',
	'/public/assets/aistudio/opt/IMG_1258_f8618ace.webp',
	'/public/assets/aistudio/opt/Screenshot_2026-06-11_222926_05da67fc.webp',
	'/public/assets/aistudio/opt/IMG_1251_86748d2d.webp',
	'/public/assets/aistudio/opt/Screenshot_2026-06-11_223056_02c950d8.webp',
	'/public/assets/aistudio/opt/IMG_1239_f9c5bd35.webp',
	'/public/assets/aistudio/opt/Scrimmage_22_a13199ef.webp',
	'/public/assets/aistudio/opt/Screenshot_2026-06-11_222859_ca2ec813.webp',
	'/public/assets/aistudio/opt/Screenshot_2026-06-11_222947_236019d2.webp',
	'/public/assets/aistudio/opt/IMG_1252_a14cf315.webp',
	'/public/assets/aistudio/opt/SIOP6882_bd80de63.webp',
	'/public/assets/aistudio/opt/IMG_1243_636b7e6e.webp',
	'/public/assets/aistudio/opt/IMG_1247_0516660e.webp',
	'/assets/images/opt/sensor.webp',
	'/public/assets/aistudio/opt/WhatsApp_Image_2026-06-03_at_15.38.01_7f014599.webp',
	'/assets/images/opt/intake.webp',
	'/assets/images/opt/turret.webp',
	'/assets/images/opt/pedropathing.webp',
	'/assets/images/opt/flicker.webp',
	'/assets/images/opt/lifecycle.webp',
	'/assets/models/models.json',
	'/assets/models/Scrimmage_bot.glb'
];

let avifSupportPromise = null;
function detectAvifSupport() {
	if (avifSupportPromise) return avifSupportPromise;
	avifSupportPromise = new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img.width > 0 && img.height > 0);
		img.onerror = () => resolve(false);
		img.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfBJ5+8=';
	});
	return avifSupportPromise;
}

function localizeOptimizedFormat(url, useAvif) {
	if (!useAvif) return url;
	return url.replace(/(\/opt\/[^?#]+)\.webp$/i, '$1.avif');
}

export async function assessDeviceStorageProfile() {
	const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
	const saveData = Boolean(conn && conn.saveData);
	const effectiveType = (conn && conn.effectiveType) || '';
	const deviceMemory = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;

	let freeMB = null;
	let quotaMB = null;
	let persisted = false;

	if (navigator.storage && typeof navigator.storage.estimate === 'function') {
		try {
			const est = await navigator.storage.estimate();
			if (est && typeof est.quota === 'number') {
				quotaMB = Math.round(est.quota / (1024 * 1024));
				freeMB = Math.max(0, Math.round((est.quota - (est.usage || 0)) / (1024 * 1024)));
			}
		} catch {
			// Estimate unavailable in restricted/private mode
		}
	}

	if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g' || (freeMB !== null && freeMB < 15)) {
		return { tier: 'minimal', freeMB, quotaMB, persisted };
	}

	// Ask browser for persistent storage on capable devices so cached assets aren't evicted under storage pressure
	if (navigator.storage && typeof navigator.storage.persist === 'function' && (freeMB === null || freeMB >= 40)) {
		try {
			persisted = await navigator.storage.persisted();
			if (!persisted) {
				persisted = await navigator.storage.persist();
			}
		} catch {
			// Ignore persistence denial
		}
	}

	if (effectiveType === '3g' || (deviceMemory !== null && deviceMemory < 2) || (freeMB !== null && freeMB < 45)) {
		return { tier: 'balanced', freeMB, quotaMB, persisted };
	}

	return { tier: 'max', freeMB, quotaMB, persisted };
}

export async function syncLocalOfflineVault({ activeLang, pageSlugs, fetchRawPageHtml }) {
	const profile = await assessDeviceStorageProfile();
	if (profile.tier === 'minimal') {
		return profile;
	}

	const primaryLang = activeLang === 'de' ? 'de' : 'en';
	const secondaryLang = primaryLang === 'de' ? 'en' : 'de';

	// 1. Always warm active-language HTML pages into in-memory Map first for 0ms clicks
	for (const slug of pageSlugs) {
		try {
			await fetchRawPageHtml(primaryLang, slug);
		} catch {
			// Continue cleanly on individual transient error
		}
	}

	// 2. Ask the active Service Worker to persist resources adaptively in the background
	if (!('serviceWorker' in navigator)) return profile;
	let controller = navigator.serviceWorker.controller;
	if (!controller) {
		try {
			const reg = await navigator.serviceWorker.ready;
			controller = (reg && reg.active) || navigator.serviceWorker.controller;
		} catch {
			controller = null;
		}
	}
	if (!controller) return profile;

	const useAvif = await detectAvifSupport();
	const cleanRoutes = ['/', '/bot', '/team-details', '/battlebots', '/sponsors', '/chemie_ka', '/games/'];
	const primaryHtml = pageSlugs.map((s) => `/${primaryLang}/${s}.html`);
	const secondaryHtml = pageSlugs.map((s) => `/${secondaryLang}/${s}.html`);

	const urlsToSync = [
		...cleanRoutes,
		...primaryHtml,
		...CORE_CODE_CHUNKS
	];

	if (profile.tier === 'balanced') {
		urlsToSync.push(...ESSENTIAL_IMAGES.slice(0, 10).map((u) => localizeOptimizedFormat(u, useAvif)));
	} else if (profile.tier === 'max') {
		urlsToSync.push(
			'/en/chemie_ka.html',
			...secondaryHtml,
			...THREE_ENGINE_CHUNKS,
			...ESSENTIAL_IMAGES.map((u) => localizeOptimizedFormat(u, useAvif)),
			...FULL_MEDIA_ASSETS.map((u) => localizeOptimizedFormat(u, useAvif))
		);
	}

	try {
		controller.postMessage({
			type: 'PRECACHE',
			tier: profile.tier,
			urls: urlsToSync
		});
	} catch {
		// Ignore postMessage failure
	}

	return profile;
}
