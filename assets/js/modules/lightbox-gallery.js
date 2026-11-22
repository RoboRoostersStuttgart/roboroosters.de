export function mountLightboxGallery(lang, registerPageCleanup, initialTriggerImg = null) {
	const isGerman = lang === 'de';
	const labels = {
		zoomIn: 'Zoom +',
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

	function getGalleryTriggers() {
		return Array.from(document.querySelectorAll('[data-lightbox], .mentoring-photo-card img, .bot-photo-card img'))
			.filter((img) => {
				const rect = img.getBoundingClientRect();
				return rect.width > 0 || img.offsetParent !== null;
			});
	}

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
		imgEl.src = item.currentSrc || item.src;
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

	const onGalleryClick = (e) => {
		const trigger = e.target && e.target.closest ? e.target.closest('[data-lightbox], .mentoring-photo-card img, .bot-photo-card img') : null;
		if (trigger && !trigger.closest('.rr-lightbox')) {
			e.preventDefault();
			openGallery(trigger);
		}
	};
	const onGalleryKey = (e) => {
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
	};

	document.addEventListener('click', onGalleryClick);
	document.addEventListener('keydown', onGalleryKey);
	prevBtn.addEventListener('click', (e) => { e.stopPropagation(); showIndex(currentIndex - 1); });
	nextBtn.addEventListener('click', (e) => { e.stopPropagation(); showIndex(currentIndex + 1); });
	zoomBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		zoomed = !zoomed;
		if (!zoomed) { panX = 0; panY = 0; }
		applyImageTransform();
	});
	closeBtn.addEventListener('click', closeGallery);
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay || e.target === stageEl) closeGallery();
	});
	imgEl.addEventListener('dblclick', (e) => {
		e.stopPropagation();
		zoomed = !zoomed;
		if (!zoomed) { panX = 0; panY = 0; }
		applyImageTransform();
	});
	stageEl.addEventListener('pointerdown', (e) => {
		if (e.target.closest('button')) return;
		isPointerDown = true;
		movedDuringDrag = false;
		swipeStartX = e.clientX;
		swipeStartY = e.clientY;
		dragStartX = panX;
		dragStartY = panY;
		if (zoomed) imgEl.classList.add('is-dragging');
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

	if (initialTriggerImg) {
		openGallery(initialTriggerImg);
	}

	registerPageCleanup(() => {
		document.removeEventListener('click', onGalleryClick);
		document.removeEventListener('keydown', onGalleryKey);
		overlay.remove();
	});
}
