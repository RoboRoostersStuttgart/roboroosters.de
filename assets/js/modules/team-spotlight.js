export function mountTeamSpotlight(teamGrid, registerPageCleanup) {
	if (!teamGrid) return;

	const leadCard = teamGrid.querySelector('.team-member-card.member-lead');
	const allCards = Array.from(teamGrid.querySelectorAll('.team-member-card'));
	const cards = allCards.filter((card) => !card.classList.contains('member-lead'));
	if (!cards.length) return;

	let pinnedCard = null;
	let pinnedScrollY = 0;
	let hoveredCard = null;
	let hoverLeaveTimer = null;
	let currentCentered = [];
	let rafPending = false;

	cards.forEach((card) => {
		card.setAttribute('tabindex', '0');
		card.setAttribute('role', 'button');
		card.setAttribute('aria-pressed', 'false');
	});

	function syncCardClasses() {
		const focusCard = hoveredCard || pinnedCard;
		const hasManualOverride = Boolean(focusCard);
		teamGrid.classList.toggle('has-active-focus', hasManualOverride);
		allCards.forEach((card) => {
			const isLead = card.classList.contains('member-lead');
			const isPinned = !isLead && card === pinnedCard;
			const isHovered = card === hoveredCard;
			const isRowFocus = card === focusCard;
			const isCentered = !isLead && !hasManualOverride && currentCentered.includes(card);
			const isSpotlight = !isLead && (isRowFocus || isCentered);
			card.classList.toggle('is-pinned', isPinned);
			card.classList.toggle('is-hovered', isHovered);
			card.classList.toggle('is-row-focus', isRowFocus);
			card.classList.remove('is-row-compressed');
			card.classList.toggle('is-spotlight', isSpotlight);
			if (!isLead) card.setAttribute('aria-pressed', String(isPinned));
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
			if (scrolledFar || offScreen) pinnedCard = null;
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

		cards.forEach((card) => {
			const rect = card.getBoundingClientRect();
			if (rect.bottom <= navOffset + 12 || rect.top >= vh - 40) return;
			const cardCenterY = rect.top + rect.height / 2;
			if (!isSingleCol && window.scrollY < 16 && leadRect && Math.abs(cardCenterY - leadCenterY) < 48) {
				return;
			}
			let dist = Math.abs(cardCenterY - focusY);
			if (currentCentered.includes(card)) dist -= 38;
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
				.filter((item) => Math.abs(item.cardCenterY - best.cardCenterY) <= 44)
				.map((item) => item.card);
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

	allCards.forEach((card) => {
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

	const onDocClick = (e) => {
		if (!pinnedCard) return;
		if (!e.target || !e.target.closest || !e.target.closest('.team-member-card')) {
			pinnedCard = null;
			scheduleEvaluate();
		}
	};
	const onDocKey = (e) => {
		if (e.key === 'Escape' && pinnedCard) {
			pinnedCard = null;
			scheduleEvaluate();
		}
	};

	document.addEventListener('click', onDocClick);
	document.addEventListener('keydown', onDocKey);
	window.addEventListener('scroll', scheduleEvaluate, { passive: true });
	window.addEventListener('resize', scheduleEvaluate, { passive: true });
	scheduleEvaluate();

	registerPageCleanup(() => {
		if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer);
		document.removeEventListener('click', onDocClick);
		document.removeEventListener('keydown', onDocKey);
		window.removeEventListener('scroll', scheduleEvaluate);
		window.removeEventListener('resize', scheduleEvaluate);
	});
}
