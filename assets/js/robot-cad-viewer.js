import * as THREE from './three/core/three.module.js';
import { OrbitControls } from './three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from './three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from './three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from './three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from './three/examples/jsm/libs/meshopt_decoder.module.js';
import { OBJLoader } from './three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from './three/examples/jsm/loaders/MTLLoader.js';

const inMemoryModelBuffers = new Map();
let cachedModelManifest = null;
let activeViewerDispose = null;

window.__rrDisposeCadViewer = function disposeCadViewer() {
	if (typeof activeViewerDispose === 'function') {
		try {
			activeViewerDispose();
		} catch {
			// Ignore disposal errors
		}
		activeViewerDispose = null;
	}
	const el = document.getElementById('botCadViewerSection');
	if (el) {
		delete el.dataset.cadMounted;
	}
	window.__rrCadViewerReady = false;
};

window.__rrMountCadViewer = function mountCadViewer() {
	const el = document.getElementById('botCadViewerSection');
	if (el && !el.dataset.cadMounted) {
		if (typeof activeViewerDispose === 'function') {
			try {
				activeViewerDispose();
			} catch {
				// Ignore previous cleanup errors
			}
			activeViewerDispose = null;
		}
		el.dataset.cadMounted = '1';
		window.__rrCadViewerReady = true;
		initBotCadViewer(el);
	}
};

window.__rrMountCadViewer();

function initBotCadViewer(section) {
	const isDe = (document.documentElement.lang || '').toLowerCase().startsWith('de');
	const isCompactPreview = section.dataset.cadPreview === 'compact';

	const modeHotspotBtn = section.querySelector('[data-cad-mode="hotspots"]');
	const mode3dBtn = section.querySelector('[data-cad-mode="3d"]');
	const hotspotStage = section.querySelector('.cad-hotspot-stage');
	const threeStage = section.querySelector('.cad-three-stage');
	const canvasMount = section.querySelector('#cadCanvasMount');
	const emptyOverlay = section.querySelector('#cadEmptyOverlay');
	const loadingOverlay = section.querySelector('#cadLoadingOverlay');
	const loadingTextEl = section.querySelector('#cadLoadingText');
	const loadingSubEl = section.querySelector('#cadLoadingSub');
	const progressFillEl = section.querySelector('#cadProgressFill');
	const statusTextEl = section.querySelector('#cadModelStatus');
	const fileInput = section.querySelector('#cadLocalFileInput');
	const loadBtn = section.querySelector('#cadLoadFileBtn');
	const emptyLoadBtn = section.querySelector('#cadEmptyLoadBtn');

	const defaultEmptyStatus = statusTextEl ? statusTextEl.textContent : '';

	const dockEl = section.querySelector('#cadDock');
	const dockToggleBtn = section.querySelector('#cadDockToggle');
	const autoRotateBtn = section.querySelector('#cadAutoRotateBtn');
	const wireframeBtn = section.querySelector('#cadWireframeBtn');
	const resetCamBtn = section.querySelector('#cadResetCamBtn');
	const explodeRange = section.querySelector('#cadExplodeRange');

	const specBadge = section.querySelector('#cadSpecBadge');
	const specTitle = section.querySelector('#cadSpecTitle');
	const specDesc = section.querySelector('#cadSpecDesc');
	const specMeta = section.querySelector('#cadSpecMeta');
	const hotspotImg = section.querySelector('#cadHotspotImg');

	// Season-specific photo + hotspot metadata
	const SEASON_DATA = {
		biobuzz: {
			image: '../public/assets/aistudio/opt/Scrimmage_11_7fbdc7e8.webp',
			alt: isDe
				? 'BIOBUZZ Roboter Seitenansicht mit interaktiven Baugruppen-Markierungen'
				: 'BIOBUZZ robot side profile with interactive subsystem hotspots',
			pins: [
				{
					id: 'pods',
					x: 24,
					y: 74,
					num: '01',
					badge: isDe ? '01 · Antriebs-Pods' : '01 · 3D-Printed Pods',
					title: isDe ? 'Zweigeteilte Mecanum-Pods mit Zahnriemen' : 'Dual-Pod 3D-Printed Belt Drivetrain',
					desc: isDe
						? 'Vollständig 3D-gedruckte Seitenteile mit Metall-Abstandshaltern und Aluminum-goBILDA-Querrahmen. Extrem weit außen montiert für maximale Intake-Breite.'
						: 'Fully 3D-printed left and right pods braced internally with metal standoffs and a rigid goBILDA aluminum cross-frame, maximizing front intake clearance.',
					meta: isDe ? 'Zahnriemen & Pulleys · Kompaktes REV-Heck' : 'Belt & Pulley Drive · Compact Rear REV Tray'
				},
				{
					id: 'intake',
					x: 78,
					y: 72,
					num: '02',
					badge: isDe ? '02 · TPU-Intake' : '02 · Multi-Row TPU Intake',
					title: isDe ? 'Mehrreihige Eigenbau-TPU-Räder' : 'In-House Printed Flexible TPU Intake',
					desc: isDe
						? 'Drei riemengetriebene Wellen mit selbstgedruckten flexiblen TPU-Rädern sorgen für durchgehenden Ballkontakt vom Spielfeld bis zur Rampe.'
						: 'Three belt-driven rows of flexible in-house printed TPU wheels compress around Nectar and Pollen balls for stall-free ramp pickup.',
					meta: isDe ? 'Durchmesser & Flex per CAD anpassbar' : 'Rapid Diameter & Durometer Tuning via CAD'
				},
				{
					id: 'transfer',
					x: 49,
					y: 55,
					num: '03',
					badge: isDe ? '03 · Stirnrad-Transfer' : '03 · Dual-Sided Spur Transfer',
					title: isDe ? 'Gegenläufiger Zweiseiten-Transfer' : 'Spur-Reversed Dual Feed Transfer',
					desc: isDe
						? 'Kleine TPU-Rollen übergeben Elemente direkt in den Turm; ein zusätzliches Stirnrad kehrt eine Seite um, damit Pollen von beiden Seiten hochgefördert wird.'
						: 'Compact TPU rollers feed directly from the intake lip into the turret, using an extra spur gear to drive both left and right sides upward together.',
					meta: isDe ? 'Zweiseitiger Förderweg · Optimiert für zwei Ballgrößen' : 'Dual-Side Feed · Tuning for Nectar & Pollen Sizes'
				},
				{
					id: 'turret',
					x: 35,
					y: 28,
					num: '04',
					badge: isDe ? '04 · BB-Turm & Shooter' : '04 · BB Turret & Rear Rollers',
					title: isDe ? 'BB-Kugellager-Turm ohne Backspin' : 'BB-Bearing Turret & Zero-Backspin Shooter',
					desc: isDe
						? 'Dreht auf BB-Pellets mit beiden Servos direkt auf dem Turm (Drehung + Ball-Blockierung). Rollen hinten werfen ohne Backspin ab gegen Herausspringen.'
						: 'Rides on a custom BB-pellet raceway with both servos mounted on the turret itself and rear launching rollers that eliminate backspin bounce-outs.',
					meta: isDe ? 'Servo 1: Rotation · Servo 2: Schuss-Taktung' : 'Servo 1: Turret Aim · Servo 2: Shot Gate Metering'
				}
			]
		}
	};

	let currentSeason = 'biobuzz';
	let serverModels = { biobuzz: null };
	let activeMode = 'hotspots';

	function renderHotspots() {
		if (!hotspotStage || !hotspotImg) return;
		const cfg = SEASON_DATA.biobuzz;
		hotspotImg.src = cfg.image;
		hotspotImg.alt = cfg.alt;

		hotspotStage.querySelectorAll('.cad-hotspot-pin').forEach((el) => el.remove());

		cfg.pins.forEach((pin, idx) => {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'cad-hotspot-pin' + (idx === 0 ? ' is-active' : '');
			btn.style.left = `${pin.x}%`;
			btn.style.top = `${pin.y}%`;
			btn.setAttribute('aria-label', pin.title);
			btn.textContent = pin.num;
			btn.addEventListener('click', () => {
				hotspotStage.querySelectorAll('.cad-hotspot-pin').forEach((b) => b.classList.remove('is-active'));
				btn.classList.add('is-active');
				updateSpecCard(pin);
			});
			hotspotStage.appendChild(btn);
		});

		if (cfg.pins[0]) {
			updateSpecCard(cfg.pins[0]);
		}
	}

	function updateSpecCard(pin) {
		if (specBadge) specBadge.textContent = pin.badge;
		if (specTitle) specTitle.textContent = pin.title;
		if (specDesc) specDesc.textContent = pin.desc;
		if (specMeta) specMeta.textContent = pin.meta;
	}

	function setMode(mode) {
		activeMode = mode;
		if (modeHotspotBtn) modeHotspotBtn.classList.toggle('active', mode === 'hotspots');
		if (mode3dBtn) mode3dBtn.classList.toggle('active', mode === '3d');
		if (hotspotStage) hotspotStage.hidden = mode !== 'hotspots';
		if (threeStage) threeStage.hidden = mode !== '3d';

		if (mode === '3d') {
			ensureThreeScene();
			handleResize();
			loadCurrentSeasonServerModelIfNeeded();
		}
	}

	if (modeHotspotBtn) modeHotspotBtn.addEventListener('click', () => setMode('hotspots'));
	if (mode3dBtn) mode3dBtn.addEventListener('click', () => setMode('3d'));

	// ===== Three.js Engine (lazy initialized on demand) =====
	let renderer = null;
	let scene = null;
	let camera = null;
	let controls = null;
	let robotWrapper = null;
	let turntableMat = null;
	const DEFAULT_EXPLODE_FACTOR = isCompactPreview ? 0 : 0.5;
	let explodeParts = [];
	let explodeFactor = DEFAULT_EXPLODE_FACTOR;
	let targetExplodeFactor = DEFAULT_EXPLODE_FACTOR;
	let autoRotateEnabled = true;
	let wireframeEnabled = false;
	let previewTurretGroup = null;

	if (autoRotateBtn) autoRotateBtn.classList.toggle('active', autoRotateEnabled);
	if (explodeRange) explodeRange.value = String(Math.round(DEFAULT_EXPLODE_FACTOR * 100));
	let hasLoadedAnyModel = false;
	let loadedSeasonTag = null;
	let activeLoadToken = 0;
	let activeFetchController = null;
	let webglUnavailable = false;
	let frameId = 0;
	let renderBusy = false;
	let renderDirty = false;
	let isSoftwareGl = false;
	let lastTime = performance.now();
	const defaultCamPos = new THREE.Vector3(2.35, 1.55, 2.55);
	const defaultTarget = new THREE.Vector3(0, 0.48, 0);

	function formatBytes(bytes) {
		if (!bytes || bytes <= 0) return '0 KB';
		if (bytes < 1024 * 1024) {
			return `${Math.max(1, Math.round(bytes / 1024))} KB`;
		}
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function nextPaint() {
		return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
	}

	function setLoadingState(visible, { title, sub, percent } = {}) {
		if (!loadingOverlay) return;
		loadingOverlay.hidden = !visible;
		if (!visible) return;

		if (emptyOverlay) emptyOverlay.hidden = true;
		if (loadingTextEl && typeof title === 'string') {
			loadingTextEl.textContent = title;
		}
		if (loadingSubEl && typeof sub === 'string') {
			loadingSubEl.textContent = sub;
		}
		if (progressFillEl) {
			if (typeof percent === 'number' && Number.isFinite(percent)) {
				progressFillEl.classList.remove('is-indeterminate');
				progressFillEl.style.width = `${Math.max(4, Math.min(100, Math.round(percent)))}%`;
			} else {
				progressFillEl.style.width = '';
				progressFillEl.classList.add('is-indeterminate');
			}
		}
	}

	function probeSoftwareGl() {
		const probe = document.createElement('canvas');
		const gl = probe.getContext('webgl2') || probe.getContext('webgl');
		if (!gl) return true;
		const ext = gl.getExtension('WEBGL_debug_renderer_info');
		const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
		const gpu = String(gl.getParameter(param) || '');
		gl.getExtension('WEBGL_lose_context')?.loseContext();
		return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
	}

	function afterDraw(cb) {
		if (!renderer) return;
		const gl = renderer.getContext();
		if (gl && typeof gl.fenceSync === 'function') {
			const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
			gl.flush();
			const poll = () => {
				const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
				if (state === gl.UNSIGNALED) {
					frameId = window.setTimeout(poll, 5);
				} else {
					if (sync) gl.deleteSync(sync);
					frameId = window.setTimeout(cb, 80);
				}
			};
			frameId = window.setTimeout(poll, 5);
		} else {
			frameId = window.setTimeout(cb, 80);
		}
	}

	function updateExplodeStep(dt) {
		const diff = Math.abs(targetExplodeFactor - explodeFactor);
		if (diff < 0.0008) {
			explodeFactor = targetExplodeFactor;
			return false;
		}
		explodeFactor = THREE.MathUtils.damp(explodeFactor, targetExplodeFactor, 7.5, Math.min(dt, 0.1));
		explodeParts.forEach((part) => {
			part.mesh.position.copy(part.basePos).addScaledVector(part.localOffset, explodeFactor);
		});
		return true;
	}

	function requestRender() {
		if (!renderer || !scene || !camera) return;
		if (renderBusy) {
			renderDirty = true;
			return;
		}
		renderBusy = true;
		frameId = window.requestAnimationFrame(() => {
			renderDirty = false;
			const now = performance.now();
			const dt = Math.min(0.1, (now - lastTime) / 1000);
			lastTime = now;

			const exploding = updateExplodeStep(dt);
			if (controls) controls.update();
			if (autoRotateEnabled && !isSoftwareGl && robotWrapper) {
				robotWrapper.rotation.y += dt * (isCompactPreview ? 0.55 : 0.42);
			}
			if (previewTurretGroup && !isSoftwareGl) {
				previewTurretGroup.rotation.y = Math.sin(now * 0.0014) * 0.48;
			}
			renderer.render(scene, camera);

			const needsContinuous = exploding || (autoRotateEnabled && !isSoftwareGl);
			const done = () => {
				renderBusy = false;
				if (renderDirty || needsContinuous) {
					requestRender();
				}
			};
			if (isSoftwareGl) {
				afterDraw(done);
			} else {
				done();
			}
		});
	}

	function ensureThreeScene() {
		if (renderer || !canvasMount || webglUnavailable) return !webglUnavailable;

		try {
			isSoftwareGl = probeSoftwareGl();
			renderer = new THREE.WebGLRenderer({
				antialias: !isSoftwareGl,
				powerPreference: 'high-performance',
				alpha: true
			});
			renderer.outputColorSpace = THREE.SRGBColorSpace;
			renderer.toneMapping = THREE.ACESFilmicToneMapping;
			renderer.toneMappingExposure = 1.1;
			renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
			renderer.shadowMap.enabled = !isSoftwareGl;
			renderer.shadowMap.type = THREE.PCFSoftShadowMap;
			canvasMount.innerHTML = '';
			canvasMount.appendChild(renderer.domElement);
		} catch {
			webglUnavailable = true;
			renderer = null;
			if (statusTextEl) {
				statusTextEl.textContent = isDe
					? 'WebGL ist in diesem Browser deaktiviert oder nicht verfügbar.'
					: 'WebGL is unavailable or disabled in this browser.';
			}
			return false;
		}

		renderer.domElement.addEventListener('webglcontextlost', (e) => {
			e.preventDefault();
			window.cancelAnimationFrame(frameId);
			window.clearTimeout(frameId);
		});
		renderer.domElement.addEventListener('webglcontextrestored', () => {
			requestRender();
		});

		scene = new THREE.Scene();

		const pmremGenerator = new THREE.PMREMGenerator(renderer);
		scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
		pmremGenerator.dispose();

		const width = Math.max(canvasMount.clientWidth || 640, 280);
		const height = Math.max(canvasMount.clientHeight || 400, 260);
		camera = new THREE.PerspectiveCamera(42, width / height, 0.05, 100);
		camera.position.copy(defaultCamPos);

		controls = new OrbitControls(camera, renderer.domElement);
		controls.target.copy(defaultTarget);
		controls.enableDamping = !isSoftwareGl;
		controls.dampingFactor = 0.06;
		controls.enableZoom = !isCompactPreview;
		controls.enablePan = !isCompactPreview;
		controls.minDistance = 0.9;
		controls.maxDistance = 8.5;
		controls.maxPolarAngle = Math.PI * 0.49;
		controls.addEventListener('change', requestRender);
		if (!isCompactPreview) {
			controls.addEventListener('start', () => {
				autoRotateEnabled = false;
				if (autoRotateBtn) autoRotateBtn.classList.remove('active');
			});
		}

		// 3-Point Studio Lighting Rig
		const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x3f4e3c, 0.85);
		scene.add(hemiLight);

		const keyLight = new THREE.DirectionalLight(0xfff5e4, 2.2);
		keyLight.position.set(3.4, 5.2, 3.6);
		keyLight.castShadow = !isSoftwareGl;
		keyLight.shadow.mapSize.set(1024, 1024);
		keyLight.shadow.camera.left = -2.2;
		keyLight.shadow.camera.right = 2.2;
		keyLight.shadow.camera.top = 2.2;
		keyLight.shadow.camera.bottom = -2.2;
		keyLight.shadow.bias = -0.0005;
		keyLight.shadow.normalBias = 0.02;
		scene.add(keyLight);

		const rimLight = new THREE.DirectionalLight(0x93c5fd, 1.15);
		rimLight.position.set(-3.5, 2.8, -3.2);
		scene.add(rimLight);

		// Subtle studio turntable ring + contact shadow plane flush at y = 0
		const pedestalGroup = new THREE.Group();
		const turntableGeo = new THREE.RingGeometry(1.18, 1.24, 64);
		turntableGeo.rotateX(-Math.PI / 2);
		turntableMat = new THREE.MeshBasicMaterial({
			color: 0x236b43,
			transparent: true,
			opacity: 0.35,
			side: THREE.DoubleSide
		});
		const turntableRing = new THREE.Mesh(turntableGeo, turntableMat);
		turntableRing.position.y = 0.004;
		pedestalGroup.add(turntableRing);

		const shadowPlane = new THREE.Mesh(
			new THREE.CircleGeometry(1.6, 48).rotateX(-Math.PI / 2),
			new THREE.ShadowMaterial({ opacity: 0.24 })
		);
		shadowPlane.receiveShadow = true;
		shadowPlane.position.y = 0.001;
		pedestalGroup.add(shadowPlane);
		scene.add(pedestalGroup);

		if (!isSoftwareGl) {
			renderer.compile(scene, camera);
		}

		window.addEventListener('resize', handleResize);
		handleResize();
		requestRender();
		return true;
	}

	function handleResize() {
		if (!renderer || !camera || !canvasMount) return;
		const w = canvasMount.clientWidth;
		const h = canvasMount.clientHeight;
		if (!w || !h) return;
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		renderer.setSize(w, h, false);
		renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
		requestRender();
	}

	function disposeMaterial(mat) {
		if (!mat) return;
		['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap'].forEach((key) => {
			if (mat[key] && typeof mat[key].dispose === 'function') {
				mat[key].dispose();
			}
		});
		mat.dispose?.();
	}

	function disposeObject(obj) {
		if (!obj) return;
		obj.traverse((child) => {
			if (child.isMesh) {
				child.geometry?.dispose();
				if (Array.isArray(child.material)) {
					child.material.forEach(disposeMaterial);
				} else {
					disposeMaterial(child.material);
				}
			}
		});
	}

	function createGltfLoader() {
		const loader = new GLTFLoader();
		const draco = new DRACOLoader();
		draco.setDecoderPath(new URL('./three/examples/jsm/libs/draco/gltf/', import.meta.url).href);
		loader.setDRACOLoader(draco);
		loader.setMeshoptDecoder(MeshoptDecoder);
		return loader;
	}

	function buildFallbackMaterial(index) {
		const palette = [0x236b43, 0x1e293b, 0xd97706, 0x475569, 0x94a3b8];
		const color = palette[index % palette.length];
		const isMetal = index % 2 === 1;
		return new THREE.MeshStandardMaterial({
			color,
			metalness: isMetal ? 0.72 : 0.18,
			roughness: isMetal ? 0.28 : 0.54,
			wireframe: wireframeEnabled
		});
	}

	function mountCompactFallbackRobot() {
		if (!ensureThreeScene() || hasLoadedAnyModel) return;
		if (robotWrapper) {
			scene.remove(robotWrapper);
			disposeObject(robotWrapper);
		}

		robotWrapper = new THREE.Group();
		previewTurretGroup = new THREE.Group();
		explodeParts = [];

		const matChassis = new THREE.MeshStandardMaterial({ color: 0x236b43, metalness: 0.25, roughness: 0.42 });
		const matMetal = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.78, roughness: 0.28 });
		const matDark = new THREE.MeshStandardMaterial({ color: 0x16202a, metalness: 0.2, roughness: 0.65 });
		const matAccent = new THREE.MeshStandardMaterial({ color: 0x00b2ff, metalness: 0.35, roughness: 0.3, emissive: 0x003355, emissiveIntensity: 0.35 });
		const matEdge = new THREE.LineBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.45 });

		// Left & right 3D-printed Mecanum drive pods
		const podGeo = new THREE.BoxGeometry(0.18, 0.24, 1.05);
		const wheelGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.09, 18);
		wheelGeo.rotateZ(Math.PI / 2);

		[-0.5, 0.5].forEach((sideX) => {
			const pod = new THREE.Mesh(podGeo, matChassis);
			pod.position.set(sideX, 0.16, 0);
			robotWrapper.add(pod);
			const podWire = new THREE.LineSegments(new THREE.EdgesGeometry(podGeo), matEdge);
			pod.add(podWire);

			[-0.36, 0.36].forEach((zOff) => {
				const w = new THREE.Mesh(wheelGeo, matDark);
				w.position.set(sideX > 0 ? 0.08 : -0.08, -0.05, zOff);
				pod.add(w);
			});
		});

		// Rigid aluminum goBILDA cross-frame & rear REV tray
		const crossGeo = new THREE.BoxGeometry(0.84, 0.08, 0.22);
		const crossBar = new THREE.Mesh(crossGeo, matMetal);
		crossBar.position.set(0, 0.16, -0.26);
		robotWrapper.add(crossBar);

		const trayGeo = new THREE.BoxGeometry(0.68, 0.12, 0.34);
		const tray = new THREE.Mesh(trayGeo, matDark);
		tray.position.set(0, 0.22, -0.34);
		robotWrapper.add(tray);

		// Multi-row TPU intake ramp at front
		const rollerGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.72, 16);
		rollerGeo.rotateZ(Math.PI / 2);
		[
			{ y: 0.16, z: 0.44 },
			{ y: 0.3, z: 0.26 },
			{ y: 0.44, z: 0.08 }
		].forEach((pos) => {
			const roller = new THREE.Mesh(rollerGeo, matDark);
			roller.position.set(0, pos.y, pos.z);
			robotWrapper.add(roller);
			const ring = new THREE.LineSegments(new THREE.EdgesGeometry(rollerGeo), matEdge);
			roller.add(ring);
		});

		// Animated BB-bearing turret & rear launcher head
		previewTurretGroup.position.set(0, 0.52, -0.14);
		const ringGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.07, 28);
		const turretRing = new THREE.Mesh(ringGeo, matMetal);
		previewTurretGroup.add(turretRing);

		const hoodGeo = new THREE.BoxGeometry(0.28, 0.24, 0.36);
		const turretHood = new THREE.Mesh(hoodGeo, matChassis);
		turretHood.position.set(0, 0.16, 0.02);
		previewTurretGroup.add(turretHood);
		const hoodWire = new THREE.LineSegments(new THREE.EdgesGeometry(hoodGeo), matEdge);
		turretHood.add(hoodWire);

		const shooterAcc = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.12), matAccent);
		shooterAcc.position.set(0, 0.24, 0.16);
		previewTurretGroup.add(shooterAcc);

		robotWrapper.add(previewTurretGroup);
		scene.add(robotWrapper);

		camera.position.set(1.95, 1.28, 2.05);
		controls.target.set(0, 0.38, 0);
		controls.update();
		requestRender();
	}

	function mountLoadedObject(objectRoot, labelText, { isGltf = false } = {}) {
		previewTurretGroup = null;
		if (robotWrapper) {
			scene.remove(robotWrapper);
			disposeObject(robotWrapper);
		}

		robotWrapper = new THREE.Group();
		explodeParts = [];

		let meshIdx = 0;
		objectRoot.traverse((child) => {
			if (!child.isMesh) return;
			if (!child.geometry.attributes.normal) {
				child.geometry.computeVertexNormals();
			}
			const firstMat = Array.isArray(child.material) ? child.material[0] : child.material;
			const hasRealMat = isGltf
				? Boolean(firstMat)
				: Boolean(child.material && !(
					firstMat?.name === '' &&
					!Array.isArray(child.material) &&
					child.material.color?.getHex() === 0xffffff
				));
			if (!hasRealMat) {
				child.material = buildFallbackMaterial(meshIdx);
			} else if (Array.isArray(child.material)) {
				child.material.forEach((m) => {
					if (!m) return;
					m.wireframe = wireframeEnabled;
					if (isGltf && typeof m.envMapIntensity === 'number') m.envMapIntensity = 1.05;
				});
			} else {
				child.material.wireframe = wireframeEnabled;
				if (isGltf && typeof child.material.envMapIntensity === 'number') {
					child.material.envMapIntensity = 1.05;
				}
			}
			child.castShadow = !isSoftwareGl;
			child.receiveShadow = !isSoftwareGl;
			meshIdx += 1;
		});

		// Measure raw bounds, center horizontally, place bottom flush at y = 0, scale to ~1.75m studio box
		const box = new THREE.Box3().setFromObject(objectRoot);
		const size = new THREE.Vector3();
		const center = new THREE.Vector3();
		box.getSize(size);
		box.getCenter(center);

		const maxDim = Math.max(size.x, size.y, size.z, 0.001);
		const scaleFactor = 1.75 / maxDim;

		objectRoot.scale.setScalar(scaleFactor);
		objectRoot.position.set(
			-center.x * scaleFactor,
			-box.min.y * scaleFactor,
			-center.z * scaleFactor
		);
		robotWrapper.add(objectRoot);
		scene.add(robotWrapper);

		// Precompute local-space explosion offsets so exploded view scales uniformly across mm/cm/in/m CAD exports
		robotWrapper.updateMatrixWorld(true);
		const robotCenter = new THREE.Vector3(0, (size.y * scaleFactor) * 0.45, 0);
		objectRoot.traverse((child) => {
			if (!child.isMesh || !child.parent) return;
			const meshBox = new THREE.Box3().setFromObject(child);
			const meshCenter = new THREE.Vector3();
			meshBox.getCenter(meshCenter);
			const dir = meshCenter.clone().sub(robotCenter);
			if (dir.lengthSq() < 0.0001) {
				dir.set(0, 1, 0);
			} else {
				dir.normalize();
			}
			const worldStart = meshCenter.clone();
			const worldEnd = meshCenter.clone().addScaledVector(dir, 0.58);
			const localOffset = child.parent.worldToLocal(worldEnd).sub(child.parent.worldToLocal(worldStart));
			explodeParts.push({
				mesh: child,
				basePos: child.position.clone(),
				localOffset
			});
		});

		targetExplodeFactor = DEFAULT_EXPLODE_FACTOR;
		explodeFactor = DEFAULT_EXPLODE_FACTOR;
		explodeParts.forEach((part) => {
			part.mesh.position.copy(part.basePos).addScaledVector(part.localOffset, explodeFactor);
		});
		if (explodeRange) explodeRange.value = String(Math.round(DEFAULT_EXPLODE_FACTOR * 100));
		if (autoRotateBtn) autoRotateBtn.classList.toggle('active', autoRotateEnabled);

		camera.position.copy(defaultCamPos);
		controls.target.set(0, (size.y * scaleFactor) * 0.45, 0);
		controls.update();

		hasLoadedAnyModel = true;
		if (emptyOverlay) emptyOverlay.hidden = true;
		setLoadingState(false);
		if (statusTextEl) statusTextEl.textContent = labelText || defaultEmptyStatus;
		requestRender();
	}

	function inspectPayloadHeader(buffer, isBinaryGlb) {
		const view = new Uint8Array(buffer);
		const prefixLen = Math.min(view.length, 256);
		const headText = new TextDecoder('utf-8', { fatal: false }).decode(view.subarray(0, prefixLen)).trimStart();

		if (/^version\s+https:\/\/git-lfs\.github\.com/i.test(headText)) {
			throw new Error('GIT_LFS_POINTER');
		}
		if (/^<(?:!doctype|html)\b/i.test(headText)) {
			throw new Error('HTML_FALLBACK');
		}
		if (isBinaryGlb) {
			if (view.length < 20) {
				throw new Error('EMPTY_GLB');
			}
			const isMagic = view[0] === 0x67 && view[1] === 0x6c && view[2] === 0x54 && view[3] === 0x46;
			if (!isMagic) {
				throw new Error('INVALID_GLB');
			}
		}
	}

	function describeLoadError(err) {
		const code = String(err?.message || '');
		if (code === 'GIT_LFS_POINTER') {
			return isDe
				? '.GLB ist nur ein Git-LFS-Pointer – Modell binär committen oder lokal laden'
				: '.GLB on server is a Git LFS pointer — commit binary directly or load local .GLB';
		}
		if (code === 'HTML_FALLBACK' || code.startsWith('HTTP_')) {
			return isDe
				? '3D-Modellpfad auf Server nicht gefunden (404 / falsche URL)'
				: 'Server could not find the 3D model file (404 / invalid path)';
		}
		if (code === 'EMPTY_GLB' || code === 'INVALID_GLB') {
			return isDe
				? 'Ungültige oder leere .GLB-Datei auf Server'
				: 'Invalid or incomplete .GLB binary on server';
		}
		return isDe
			? '3D-Datei konnte nicht geladen werden (.glb/.gltf/.obj prüfen)'
			: 'Could not load 3D CAD model (check valid .glb / .gltf / .obj)';
	}

	async function fetchArrayBufferWithProgress(url, signal, onProgress) {
		if (inMemoryModelBuffers.has(url)) {
			const cachedBuf = inMemoryModelBuffers.get(url);
			onProgress(cachedBuf.byteLength, cachedBuf.byteLength);
			return cachedBuf.slice(0);
		}
		const res = await fetch(url, { cache: 'default', signal });
		if (!res.ok) {
			throw new Error(`HTTP_${res.status}`);
		}

		const contentType = (res.headers.get('content-type') || '').toLowerCase();
		if (contentType.includes('text/html')) {
			throw new Error('HTML_FALLBACK');
		}

		const total = Number(res.headers.get('content-length') || 0);
		if (!res.body || typeof res.body.getReader !== 'function') {
			const buf = await res.arrayBuffer();
			onProgress(buf.byteLength, total || buf.byteLength);
			return buf;
		}

		const reader = res.body.getReader();
		const chunks = [];
		let received = 0;

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value) {
				chunks.push(value);
				received += value.byteLength;
				onProgress(received, total);
			}
		}

		const merged = new Uint8Array(received);
		let offset = 0;
		for (const chunk of chunks) {
			merged.set(chunk, offset);
			offset += chunk.byteLength;
		}
		return merged.buffer;
	}

	async function loadServerModel(entry) {
		const candidateUrls = Array.from(new Set(
			[entry?.url, entry?.obj, ...(Array.isArray(entry?.fallbackUrls) ? entry.fallbackUrls : [])].filter(Boolean)
		));
		const modelUrl = candidateUrls[0];
		if (!entry || !modelUrl) return;
		if (!ensureThreeScene()) return;

		if (activeFetchController) {
			activeFetchController.abort();
		}
		activeFetchController = new AbortController();
		const token = ++activeLoadToken;
		const { signal } = activeFetchController;

		const displayName = entry.name || 'robot.glb';
		setLoadingState(true, {
			title: isDe ? `Lade ${displayName}…` : `Loading ${displayName}…`,
			sub: isDe ? 'Verbindung zum Server…' : 'Connecting to server…',
			percent: null
		});

		try {
			const isBinaryGlb = entry.format === 'glb' || /\.glb(?:$|\?)/i.test(modelUrl);
			const isGltf = isBinaryGlb || entry.format === 'gltf' || /\.gltf(?:$|\?)/i.test(modelUrl);

			let lastProgressPaint = 0;
			let buffer = null;
			let activeModelUrl = modelUrl;
			let lastFetchErr = null;

			for (const candidateUrl of candidateUrls) {
				try {
					const downloaded = await fetchArrayBufferWithProgress(candidateUrl, signal, (received, total) => {
						if (token !== activeLoadToken) return;
						const now = performance.now();
						if (total > 0 && received < total && now - lastProgressPaint < 65) return;
						lastProgressPaint = now;

						if (total > 0) {
							const pct = Math.min(100, Math.round((received / total) * 100));
							setLoadingState(true, {
								title: isDe ? `Lade ${displayName}…` : `Loading ${displayName}…`,
								sub: `${formatBytes(received)} / ${formatBytes(total)} · ${pct}%`,
								percent: pct
							});
						} else {
							setLoadingState(true, {
								title: isDe ? `Lade ${displayName}…` : `Loading ${displayName}…`,
								sub: isDe ? `${formatBytes(received)} geladen` : `${formatBytes(received)} downloaded`,
								percent: null
							});
						}
					});
					if (token !== activeLoadToken) return;
					inspectPayloadHeader(downloaded, isBinaryGlb);
					if (downloaded && downloaded.byteLength > 0 && downloaded.byteLength < 32 * 1024 * 1024) {
						inMemoryModelBuffers.set(candidateUrl, downloaded.slice(0));
					}
					buffer = downloaded;
					activeModelUrl = candidateUrl;
					break;
				} catch (fetchErr) {
					if (fetchErr?.name === 'AbortError' || token !== activeLoadToken) throw fetchErr;
					lastFetchErr = fetchErr;
				}
			}

			if (!buffer) {
				throw lastFetchErr || new Error('FETCH_FAILED');
			}

			if (token !== activeLoadToken) return;

			setLoadingState(true, {
				title: isDe ? '3D-Geometrie wird aufgebaut…' : 'Parsing 3D Geometry…',
				sub: formatBytes(buffer.byteLength),
				percent: 100
			});
			await nextPaint();
			if (token !== activeLoadToken) return;

			if (isGltf) {
				const gltfLoader = createGltfLoader();
				const resourceBaseUrl = new URL('.', new URL(activeModelUrl, window.location.href)).href;
				const parsePayload = isBinaryGlb ? buffer : new TextDecoder().decode(buffer);
				const gltf = await new Promise((resolve, reject) => {
					gltfLoader.parse(parsePayload, resourceBaseUrl, resolve, reject);
				});
				if (token !== activeLoadToken) return;
				loadedSeasonTag = currentSeason;
				mountLoadedObject(gltf.scene, displayName, { isGltf: true });
			} else {
				const objLoader = new OBJLoader();
				if (entry.mtl) {
					const mtlLoader = new MTLLoader();
					const mtlAbsUrl = new URL(entry.mtl, window.location.href).href;
					const baseDir = mtlAbsUrl.slice(0, mtlAbsUrl.lastIndexOf('/') + 1);
					mtlLoader.setPath(baseDir);
					const mtlFile = decodeURIComponent(mtlAbsUrl.slice(mtlAbsUrl.lastIndexOf('/') + 1));
					const materials = await mtlLoader.loadAsync(mtlFile);
					materials.preload();
					objLoader.setMaterials(materials);
				}
				const objText = new TextDecoder().decode(buffer);
				const loaded = objLoader.parse(objText);
				if (token !== activeLoadToken) return;
				loadedSeasonTag = currentSeason;
				mountLoadedObject(loaded, displayName, { isGltf: false });
			}
		} catch (err) {
			if (err?.name === 'AbortError' || token !== activeLoadToken) return;
			setLoadingState(false);
			if (!hasLoadedAnyModel && emptyOverlay) emptyOverlay.hidden = false;
			if (statusTextEl) {
				statusTextEl.textContent = describeLoadError(err);
			}
		}
	}

	async function loadLocalFiles(fileList) {
		const files = Array.from(fileList || []);
		const gltfFile = files.find((f) => /\.(?:glb|gltf)$/i.test(f.name));
		const objFile = files.find((f) => /\.obj$/i.test(f.name));
		if (!gltfFile && !objFile) return;

		if (activeFetchController) {
			activeFetchController.abort();
		}
		const token = ++activeLoadToken;

		setMode('3d');
		if (!ensureThreeScene()) return;

		const targetFile = gltfFile || objFile;
		setLoadingState(true, {
			title: isDe ? `Lese ${targetFile.name}…` : `Reading ${targetFile.name}…`,
			sub: formatBytes(targetFile.size),
			percent: null
		});

		try {
			if (gltfFile) {
				const buffer = await gltfFile.arrayBuffer();
				if (token !== activeLoadToken) return;

				const isBinaryGlb = /\.glb$/i.test(gltfFile.name);
				inspectPayloadHeader(buffer, isBinaryGlb);

				setLoadingState(true, {
					title: isDe ? '3D-Geometrie wird aufgebaut…' : 'Parsing 3D Geometry…',
					sub: formatBytes(buffer.byteLength),
					percent: 100
				});
				await nextPaint();
				if (token !== activeLoadToken) return;

				const gltfLoader = createGltfLoader();
				const parsePayload = isBinaryGlb ? buffer : new TextDecoder().decode(buffer);
				const gltf = await new Promise((resolve, reject) => {
					gltfLoader.parse(parsePayload, '', resolve, reject);
				});
				if (token !== activeLoadToken) return;
				loadedSeasonTag = 'biobuzz';
				mountLoadedObject(gltf.scene, gltfFile.name, { isGltf: true });
			} else if (objFile) {
				const objText = await objFile.text();
				if (token !== activeLoadToken) return;

				setLoadingState(true, {
					title: isDe ? '3D-Geometrie wird aufgebaut…' : 'Parsing 3D Geometry…',
					sub: formatBytes(objFile.size),
					percent: 100
				});
				await nextPaint();
				if (token !== activeLoadToken) return;

				const mtlFile = files.find((f) => /\.mtl$/i.test(f.name));
				const objLoader = new OBJLoader();

				if (mtlFile) {
					const mtlText = await mtlFile.text();
					const mtlLoader = new MTLLoader();
					const materials = mtlLoader.parse(mtlText, '');
					materials.preload();
					objLoader.setMaterials(materials);
				}

				const parsed = objLoader.parse(objText);
				if (token !== activeLoadToken) return;
				loadedSeasonTag = 'biobuzz';
				mountLoadedObject(parsed, objFile.name, { isGltf: false });
			}
		} catch (err) {
			if (token !== activeLoadToken) return;
			setLoadingState(false);
			if (!hasLoadedAnyModel && emptyOverlay) emptyOverlay.hidden = false;
			if (statusTextEl) {
				statusTextEl.textContent = describeLoadError(err);
			}
		}
	}

	function loadCurrentSeasonServerModelIfNeeded() {
		const entry = serverModels.biobuzz;
		if (entry && (entry.url || entry.obj) && loadedSeasonTag !== 'biobuzz') {
			loadServerModel(entry);
		}
	}

	// Wire HUD controls
	if (dockToggleBtn && dockEl) {
		dockToggleBtn.addEventListener('click', () => {
			const collapsed = dockEl.classList.toggle('is-collapsed');
			dockToggleBtn.setAttribute('aria-expanded', String(!collapsed));
			dockToggleBtn.textContent = collapsed
				? (isDe ? '▴ Steuerung zeigen' : '▴ Show Controls')
				: (isDe ? '▾ Ausblenden' : '▾ Hide Controls');
		});
	}

	if (autoRotateBtn) {
		autoRotateBtn.addEventListener('click', () => {
			autoRotateEnabled = !autoRotateEnabled;
			autoRotateBtn.classList.toggle('active', autoRotateEnabled);
			if (autoRotateEnabled) requestRender();
		});
	}

	if (wireframeBtn) {
		wireframeBtn.addEventListener('click', () => {
			wireframeEnabled = !wireframeEnabled;
			wireframeBtn.classList.toggle('active', wireframeEnabled);
			if (robotWrapper) {
				robotWrapper.traverse((child) => {
					if (!child.isMesh || !child.material) return;
					if (Array.isArray(child.material)) {
						child.material.forEach((m) => { m.wireframe = wireframeEnabled; });
					} else {
						child.material.wireframe = wireframeEnabled;
					}
				});
				requestRender();
			}
		});
	}

	if (resetCamBtn) {
		resetCamBtn.addEventListener('click', () => {
			if (!camera || !controls) return;
			camera.position.copy(defaultCamPos);
			controls.target.copy(defaultTarget);
			if (robotWrapper) robotWrapper.rotation.set(0, 0, 0);
			controls.update();
			requestRender();
		});
	}

	if (explodeRange) {
		explodeRange.addEventListener('input', () => {
			targetExplodeFactor = Number(explodeRange.value || 0) / 100;
			requestRender();
		});
	}

	const triggerPicker = () => fileInput && fileInput.click();
	if (loadBtn) loadBtn.addEventListener('click', triggerPicker);
	if (emptyLoadBtn) emptyLoadBtn.addEventListener('click', triggerPicker);
	if (fileInput) {
		fileInput.addEventListener('change', () => {
			if (fileInput.files && fileInput.files.length > 0) {
				loadLocalFiles(fileInput.files);
				fileInput.value = '';
			}
		});
	}

	// Drag-and-drop support directly on 3D viewport
	if (threeStage) {
		threeStage.addEventListener('dragover', (e) => {
			e.preventDefault();
			threeStage.classList.add('is-dragover');
		});
		threeStage.addEventListener('dragleave', () => {
			threeStage.classList.remove('is-dragover');
		});
		threeStage.addEventListener('drop', (e) => {
			e.preventDefault();
			threeStage.classList.remove('is-dragover');
			if (e.dataTransfer?.files?.length) {
				loadLocalFiles(e.dataTransfer.files);
			}
		});
	}

	// Resize and re-render 3D canvas when switching back to BIOBUZZ after visiting DECODE
	const obs = new MutationObserver(() => {
		const next = document.documentElement.getAttribute('data-season') === 'decode' ? 'decode' : 'biobuzz';
		if (next === 'biobuzz') {
			window.requestAnimationFrame(() => {
				handleResize();
				requestRender();
			});
		}
	});
	obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-season'] });

	renderHotspots();

	function detectGitHubRepo() {
		const host = (typeof window !== 'undefined' && window.location && window.location.hostname || '').toLowerCase();
		if (host.endsWith('.github.io')) {
			const owner = host.slice(0, -'.github.io'.length);
			const seg = (window.location.pathname || '/').split('/').filter(Boolean)[0];
			if (owner && seg && !['en', 'de', 'assets', 'games', 'public', 'bot', 'team-details', 'battlebots', 'sponsors', 'chemie_ka'].includes(seg.toLowerCase())) {
				return `${owner}/${seg}`;
			}
			if (owner) {
				return `${owner}/${owner}.github.io`;
			}
		}
		return 'RoboRoostersStuttgart/roboroosters.de';
	}

	const GITHUB_REPO = detectGitHubRepo();

	async function readPrefixBytes(res, maxBytes = 128) {
		if (res.status === 206 || !res.body || typeof res.body.getReader !== 'function') {
			const buf = new Uint8Array(await res.arrayBuffer());
			return buf.subarray(0, maxBytes);
		}
		const reader = res.body.getReader();
		const collected = new Uint8Array(maxBytes);
		let offset = 0;
		try {
			while (offset < maxBytes) {
				const { done, value } = await reader.read();
				if (done || !value) break;
				const take = Math.min(value.byteLength, maxBytes - offset);
				collected.set(value.subarray(0, take), offset);
				offset += take;
			}
		} finally {
			reader.cancel().catch(() => {});
		}
		return collected.subarray(0, offset);
	}

	async function probeUrlPayload(url, { expectBinaryGlb = true } = {}) {
		const tryFetch = async (useRange) => {
			const controller = new AbortController();
			const headers = useRange ? { Range: 'bytes=0-127' } : undefined;
			try {
				const res = await fetch(url, {
					method: 'GET',
					headers,
					cache: 'no-store',
					signal: controller.signal
				});
				if (!res.ok) {
					return { ok: false, status: res.status };
				}
				const ctype = (res.headers.get('content-type') || '').toLowerCase();
				if (ctype.includes('text/html')) {
					controller.abort();
					return { ok: false, reason: 'html' };
				}
				let totalBytes = Number(res.headers.get('content-length') || 0);
				const contentRange = res.headers.get('content-range') || '';
				const rangeMatch = contentRange.match(/\/(\d+)\s*$/);
				if (rangeMatch) {
					totalBytes = Number(rangeMatch[1]);
				}
				const firstBytes = await readPrefixBytes(res, 128);
				controller.abort();
				return { ok: true, status: res.status, totalBytes, firstBytes };
			} catch (err) {
				if (err?.name === 'AbortError') {
					return { ok: false, reason: 'aborted' };
				}
				return { ok: false, reason: 'network' };
			}
		};

		let probe = await tryFetch(true);
		if (!probe.ok && (probe.status === 416 || probe.status === 405 || probe.status === 403 || probe.reason === 'network')) {
			probe = await tryFetch(false);
		}
		if (!probe.ok) {
			return { valid: false, reason: probe.reason || `http_${probe.status || 0}`, status: probe.status || 0 };
		}

		const bytes = probe.firstBytes || new Uint8Array(0);
		const effectiveLen = Math.max(bytes.length, probe.totalBytes || 0);
		const prefixText = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 96)).trimStart();

		if (/^version\s+https:\/\/git-lfs\.github\.com/i.test(prefixText)) {
			return { valid: false, lfsPointer: true, size: effectiveLen };
		}
		if (/^<(?:!doctype|html)\b/i.test(prefixText)) {
			return { valid: false, reason: 'html' };
		}
		if (expectBinaryGlb) {
			if (effectiveLen < 20) {
				return { valid: false, reason: 'too_small', size: effectiveLen };
			}
			if (bytes.length < 4 || bytes[0] !== 0x67 || bytes[1] !== 0x6c || bytes[2] !== 0x54 || bytes[3] !== 0x46) {
				return { valid: false, reason: 'invalid_glb_magic', size: effectiveLen };
			}
		} else if (effectiveLen < 16) {
			return { valid: false, reason: 'too_small', size: effectiveLen };
		}

		return { valid: true, size: effectiveLen };
	}

	async function resolveGitHubLfsUrl(repoPath, branchHint) {
		const branches = [branchHint, 'main', 'master', 'gh-pages'].filter(Boolean);
		const seen = new Set();
		const encodedPath = repoPath.split('/').map((seg) => encodeURIComponent(seg)).join('/');
		const expectBinaryGlb = /\.glb$/i.test(repoPath);
		for (const branch of branches) {
			if (seen.has(branch)) continue;
			seen.add(branch);
			const mediaUrl = `https://media.githubusercontent.com/media/${GITHUB_REPO}/${encodeURIComponent(branch)}/${encodedPath}`;
			const check = await probeUrlPayload(mediaUrl, { expectBinaryGlb });
			if (check.valid) {
				return mediaUrl;
			}
		}
		return null;
	}

	async function verifyStaticCandidateUrl(fileUrl, fileName, repoPath = null, branchHint = null, diagnostics = []) {
		const isGlb = /\.glb(?:$|\?)/i.test(fileName);
		const isObj = /\.obj(?:$|\?)/i.test(fileName);
		const format = isGlb ? 'glb' : /\.gltf(?:$|\?)/i.test(fileName) ? 'gltf' : 'obj';
		const probe = await probeUrlPayload(fileUrl, { expectBinaryGlb: isGlb });

		if (probe.valid) {
			return {
				format,
				url: fileUrl,
				obj: isObj ? fileUrl : null,
				mtl: null,
				name: fileName
			};
		}

		if (probe.lfsPointer && repoPath) {
			const lfsMediaUrl = await resolveGitHubLfsUrl(repoPath, branchHint);
			if (lfsMediaUrl) {
				return {
					format,
					url: lfsMediaUrl,
					obj: isObj ? lfsMediaUrl : null,
					mtl: null,
					name: fileName
				};
			}
			diagnostics.push({ name: fileName, reason: 'lfs_unresolved' });
			return { lfsPointer: true, name: fileName };
		}

		if (probe.reason === 'too_small') {
			diagnostics.push({ name: fileName, reason: 'too_small', size: probe.size || 0 });
		} else if (probe.reason === 'invalid_glb_magic') {
			diagnostics.push({ name: fileName, reason: 'invalid_glb_magic', size: probe.size || 0 });
		}
		return null;
	}

	async function verifyStaticGlbCandidate(fileName, modelsBaseUrl, repoDir = 'assets/models', branchHint = null, diagnostics = []) {
		const encodedName = encodeURIComponent(fileName);
		const fileUrl = new URL(encodedName, modelsBaseUrl).href;
		return verifyStaticCandidateUrl(fileUrl, fileName, `${repoDir}/${fileName}`, branchHint, diagnostics);
	}

	async function verifyGitHubRepoItem(repoPath, siteRootUrl, branchHint = null, rawDownloadUrl = null, mtlRepoPath = null, diagnostics = []) {
		const fileName = decodeURIComponent(repoPath.split('/').pop() || 'robot.glb');
		const isGlb = /\.glb$/i.test(fileName);
		const isObj = /\.obj$/i.test(fileName);
		const format = isGlb ? 'glb' : /\.gltf$/i.test(fileName) ? 'gltf' : 'obj';
		const encodedRepoPath = repoPath.split('/').map((seg) => encodeURIComponent(seg)).join('/');
		const sameOriginUrl = new URL(encodedRepoPath, siteRootUrl).href;
		const branches = [branchHint, 'main', 'master', 'gh-pages'].filter(Boolean);
		const rawUrl = rawDownloadUrl || `https://raw.githubusercontent.com/${GITHUB_REPO}/${encodeURIComponent(branches[0] || 'main')}/${encodedRepoPath}`;

		const mtlSameOrigin = mtlRepoPath
			? new URL(mtlRepoPath.split('/').map((seg) => encodeURIComponent(seg)).join('/'), siteRootUrl).href
			: null;

		const sameOriginCheck = await verifyStaticCandidateUrl(sameOriginUrl, fileName, repoPath, branchHint, diagnostics);
		if (sameOriginCheck && !sameOriginCheck.lfsPointer) {
			return {
				...sameOriginCheck,
				mtl: mtlSameOrigin,
				fallbackUrls: [rawUrl].filter((u) => u && u !== sameOriginCheck.url)
			};
		}

		if (rawUrl && rawUrl !== sameOriginUrl) {
			const rawCheck = await verifyStaticCandidateUrl(rawUrl, fileName, repoPath, branchHint, diagnostics);
			if (rawCheck && !rawCheck.lfsPointer) {
				const rawMtlUrl = mtlRepoPath
					? `https://raw.githubusercontent.com/${GITHUB_REPO}/${encodeURIComponent(branches[0] || 'main')}/${mtlRepoPath.split('/').map((seg) => encodeURIComponent(seg)).join('/')}`
					: null;
				return {
					...rawCheck,
					mtl: rawMtlUrl || mtlSameOrigin,
					fallbackUrls: [sameOriginUrl].filter((u) => u && u !== rawCheck.url)
				};
			}
		}

		if (sameOriginCheck && sameOriginCheck.lfsPointer) {
			return sameOriginCheck;
		}
		return null;
	}

	async function probeGitHubRepoDirectory(repoDir, siteRootUrl, diagnostics = []) {
		try {
			const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${repoDir}`;
			const res = await fetch(apiUrl, { cache: 'no-store' });
			if (!res.ok) return null;
			const entries = await res.json();
			if (!Array.isArray(entries)) return null;

			const files = entries.filter((item) => item && item.type === 'file');
			const extRank = (name) => (/\.glb$/i.test(name) ? 0 : /\.gltf$/i.test(name) ? 1 : 2);
			const modelFiles = files
				.filter((f) => /\.(?:glb|gltf|obj)$/i.test(f.name))
				.sort((a, b) => extRank(a.name) - extRank(b.name));

			if (!modelFiles.length) return null;

			const extractBranch = (downloadUrl) => {
				const m = String(downloadUrl || '').match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/([^/]+)\//i);
				return m ? decodeURIComponent(m[1]) : null;
			};

			const verifyList = async (candidates) => {
				let lfsResult = null;
				for (const item of candidates) {
					if (Number(item.size || 0) < 20) {
						diagnostics.push({ name: item.name, reason: 'too_small', size: Number(item.size || 0) });
						continue;
					}
					const branch = extractBranch(item.download_url);
					const isObj = /\.obj$/i.test(item.name);
					const baseName = item.name.replace(/\.(?:glb|gltf|obj)$/i, '');
					const mtlItem = isObj
						? files.find((f) => f.name.toLowerCase() === `${baseName.toLowerCase()}.mtl`)
						: null;
					const verified = await verifyGitHubRepoItem(
						item.path || `${repoDir}/${item.name}`,
						siteRootUrl,
						branch,
						item.download_url,
						mtlItem ? (mtlItem.path || `${repoDir}/${mtlItem.name}`) : null,
						diagnostics
					);
					if (verified && !verified.lfsPointer) return verified;
					if (verified && verified.lfsPointer && !lfsResult) lfsResult = verified;
				}
				return lfsResult;
			};

				const biobuzzCandidates = [
					...modelFiles.filter((f) => /biobuzz/i.test(f.name)),
					...modelFiles.filter((f) => !/biobuzz/i.test(f.name) && !/decode/i.test(f.name)),
					...modelFiles
				];

				const biobuzzEntry = await verifyList(biobuzzCandidates);
				return { biobuzzEntry };
			} catch {
				return null;
			}
		}

		async function probeGitHubRepoTree(siteRootUrl, diagnostics = []) {
			const branches = ['HEAD', 'main', 'master', 'gh-pages'];
			for (const branch of branches) {
				try {
					const treeUrl = `https://api.github.com/repos/${GITHUB_REPO}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
					const res = await fetch(treeUrl, { cache: 'no-store' });
					if (!res.ok) continue;
					const data = await res.json();
					const tree = Array.isArray(data?.tree) ? data.tree : [];
					const blobs = tree.filter((item) => item && item.type === 'blob' && item.path);
					const extRank = (p) => (/\.glb$/i.test(p) ? 0 : /\.gltf$/i.test(p) ? 1 : 2);
					const modelBlobs = blobs
						.filter((b) => /\.(?:glb|gltf|obj)$/i.test(b.path) && !/(?:^|\/)(?:node_modules|assets\/js\/three)\//i.test(b.path))
						.sort((a, b) => extRank(a.path) - extRank(b.path));

					if (!modelBlobs.length) return null;

					const resolvedBranch = branch === 'HEAD' ? null : branch;
					const verifyList = async (candidates) => {
						let lfsResult = null;
						for (const item of candidates) {
							const fileName = item.path.split('/').pop() || 'robot.glb';
							if (typeof item.size === 'number' && item.size < 20) {
								diagnostics.push({ name: item.path, reason: 'too_small', size: item.size });
								continue;
							}
							const isObj = /\.obj$/i.test(fileName);
							const basePath = item.path.replace(/\.(?:glb|gltf|obj)$/i, '').toLowerCase();
							const mtlItem = isObj
								? blobs.find((b) => b.path.toLowerCase() === `${basePath}.mtl`)
								: null;
							const verified = await verifyGitHubRepoItem(
								item.path,
								siteRootUrl,
								resolvedBranch,
								null,
								mtlItem ? mtlItem.path : null,
								diagnostics
							);
							if (verified && !verified.lfsPointer) return verified;
							if (verified && verified.lfsPointer && !lfsResult) lfsResult = verified;
						}
						return lfsResult;
					};

					const biobuzzCandidates = [
						...modelBlobs.filter((b) => /biobuzz/i.test(b.path)),
						...modelBlobs.filter((b) => !/biobuzz/i.test(b.path) && !/decode/i.test(b.path)),
						...modelBlobs
					];

					const biobuzzEntry = await verifyList(biobuzzCandidates);
					return { biobuzzEntry };
				} catch {
					// Try next branch
				}
			}
			return null;
		}

	function normalizeManifestEntry(entry, modelsBaseUrl) {
		if (!entry) return null;
		if (typeof entry === 'string') {
			const cleaned = entry.startsWith('/assets/models/') ? entry.slice('/assets/models/'.length) : entry;
			const url = cleaned.startsWith('/') ? cleaned : new URL(cleaned, modelsBaseUrl).href;
			const name = decodeURIComponent(url.split('/').pop() || 'robot.glb');
			const format = /\.glb(?:$|\?)/i.test(url) ? 'glb' : /\.gltf(?:$|\?)/i.test(url) ? 'gltf' : 'obj';
			return { format, url, obj: format === 'obj' ? url : null, mtl: null, name };
		}
		const rawUrl = entry.url || entry.obj;
		if (!rawUrl) return null;
		const cleanRawUrl = rawUrl.startsWith('/assets/models/') ? rawUrl.slice('/assets/models/'.length) : rawUrl;
		const resolvedUrl = cleanRawUrl.startsWith('/') ? cleanRawUrl : new URL(cleanRawUrl, modelsBaseUrl).href;
		const rawMtl = entry.mtl;
		const cleanMtl = rawMtl && rawMtl.startsWith('/assets/models/') ? rawMtl.slice('/assets/models/'.length) : rawMtl;
		const resolvedMtl = cleanMtl
			? (cleanMtl.startsWith('/') ? cleanMtl : new URL(cleanMtl, modelsBaseUrl).href)
			: null;
		return {
			format: entry.format || (/\.glb(?:$|\?)/i.test(resolvedUrl) ? 'glb' : /\.gltf(?:$|\?)/i.test(resolvedUrl) ? 'gltf' : 'obj'),
			url: resolvedUrl,
			obj: entry.obj ? resolvedUrl : null,
			mtl: resolvedMtl,
			name: entry.name || decodeURIComponent(resolvedUrl.split('/').pop() || 'robot.glb')
		};
	}

	function formatDiagnosticHint(diagnostics) {
		const placeholder = diagnostics.find((d) => d.reason === 'too_small');
		if (placeholder) {
			return isDe
				? `Hinweis: ${placeholder.name} auf dem Server hat nur ${placeholder.size} B (Platzhalter) — echte .GLB hochladen oder lokal wählen.`
				: `Note: ${placeholder.name} on server is only ${placeholder.size} B (placeholder) — upload the real .GLB or load locally.`;
		}
		const lfs = diagnostics.find((d) => d.reason === 'lfs_unresolved');
		if (lfs) {
			return isDe
				? `${lfs.name} ist ein Git-LFS-Pointer – bitte direkt binär (<100 MB) committen oder lokal laden.`
				: `${lfs.name} is a Git LFS pointer — commit binary directly (<100 MB) or load local .GLB.`;
		}
		const badMagic = diagnostics.find((d) => d.reason === 'invalid_glb_magic');
		if (badMagic) {
			return isDe
				? `${badMagic.name} auf dem Server hat keinen gültigen glTF-Header.`
				: `${badMagic.name} on server does not have a valid glTF binary header.`;
		}
		return null;
	}

	async function probeStaticModels() {
		const modelsBaseUrl = new URL('../models/', import.meta.url);
		const siteRootUrl = new URL('../../', import.meta.url);
		const rootModelsBaseUrl = new URL('models/', siteRootUrl);
		const diagnostics = [];

		for (const baseUrl of [modelsBaseUrl, rootModelsBaseUrl]) {
			try {
				const manifestRes = await fetch(new URL('models.json', baseUrl).href, { cache: 'no-store' });
				if (manifestRes.ok) {
					const manifest = await manifestRes.json();
					if (manifest && manifest.biobuzz) {
						return {
							biobuzz: normalizeManifestEntry(manifest.biobuzz, baseUrl)
						};
					}
				}
			} catch {
				// Ignore missing or invalid static manifest
			}
		}

		const [
			biobuzzScrimmage,
			biobuzzScrimmageLower,
			biobuzzNamed,
			biobuzzShort,
			biobuzzRobot,
			rootScrimmage
		] = await Promise.all([
			verifyStaticGlbCandidate('Scrimmage_bot.glb', modelsBaseUrl, 'assets/models', null, diagnostics),
			verifyStaticGlbCandidate('scrimmage_bot.glb', modelsBaseUrl, 'assets/models', null, diagnostics),
			verifyStaticGlbCandidate('biobuzz-bot.glb', modelsBaseUrl, 'assets/models', null, diagnostics),
			verifyStaticGlbCandidate('biobuzz.glb', modelsBaseUrl, 'assets/models', null, diagnostics),
			verifyStaticGlbCandidate('robot.glb', modelsBaseUrl, 'assets/models', null, diagnostics),
			verifyStaticGlbCandidate('Scrimmage_bot.glb', rootModelsBaseUrl, 'models', null, diagnostics)
		]);

		const pickValid = (res) => (res && !res.lfsPointer ? res : null);
		let biobuzzEntry = pickValid(biobuzzNamed)
			|| pickValid(biobuzzScrimmage)
			|| pickValid(biobuzzScrimmageLower)
			|| pickValid(biobuzzShort)
			|| pickValid(biobuzzRobot)
			|| pickValid(rootScrimmage);

		if (biobuzzEntry) {
			return {
				biobuzz: biobuzzEntry
			};
		}

		// Fallback: query GitHub public repository contents or full git tree for any uploaded .glb/.gltf/.obj
		const repoAssets = (await probeGitHubRepoDirectory('assets/models', siteRootUrl, diagnostics))
			|| (await probeGitHubRepoDirectory('models', siteRootUrl, diagnostics))
			|| (await probeGitHubRepoTree(siteRootUrl, diagnostics));

		if (repoAssets) {
			biobuzzEntry = pickValid(repoAssets.biobuzzEntry);
			if (biobuzzEntry) {
				return { biobuzz: biobuzzEntry };
			}
		}

		const hint = formatDiagnosticHint(diagnostics);
		if (hint && statusTextEl && !hasLoadedAnyModel) {
			statusTextEl.textContent = hint;
		}

		return null;
	}

	// Compact homepage preview: mount lightweight animated 3D preview immediately, then upgrade to real .glb if present
	if (isCompactPreview) {
		mountCompactFallbackRobot();
		handleResize();
	} else {
		// Apply any early click or file drop queued while the Three.js module was still loading
		if (window.__rrCadPendingFiles && window.__rrCadPendingFiles.length > 0) {
			const queued = window.__rrCadPendingFiles;
			window.__rrCadPendingFiles = null;
			loadLocalFiles(queued);
		} else if (window.__rrCadInitialMode === '3d') {
			setMode('3d');
		}
	}

	let disposed = false;

	activeViewerDispose = () => {
		disposed = true;
		activeLoadToken += 1;
		if (activeFetchController) {
			activeFetchController.abort();
			activeFetchController = null;
		}
		window.cancelAnimationFrame(frameId);
		window.clearTimeout(frameId);
		window.removeEventListener('resize', handleResize);
		obs.disconnect();
		if (controls) {
			controls.dispose();
			controls = null;
		}
		if (robotWrapper) {
			disposeObject(robotWrapper);
			robotWrapper = null;
		}
		if (renderer) {
			renderer.dispose();
			if (renderer.domElement && renderer.domElement.parentNode) {
				renderer.domElement.parentNode.removeChild(renderer.domElement);
			}
			renderer = null;
		}
		scene = null;
		camera = null;
	};

	const manifestPromise = cachedModelManifest
		? Promise.resolve(cachedModelManifest)
		: fetch('/api/robot-models', { cache: 'no-store' })
			.then(async (res) => {
				if (res.ok) {
					const apiData = await res.json();
					if (apiData && apiData.biobuzz) {
						return apiData;
					}
				}
				return probeStaticModels();
			})
			.catch(() => probeStaticModels());

	manifestPromise
		.then((data) => {
			if (disposed || !data) return;
			cachedModelManifest = data;
			serverModels = data;
			if (serverModels.biobuzz && (serverModels.biobuzz.url || serverModels.biobuzz.obj)) {
				if (isCompactPreview) {
					loadServerModel(serverModels.biobuzz);
				} else {
					// Auto-activate full 3D CAD viewer as soon as a valid .glb / .gltf / .obj is found
					setMode('3d');
				}
			}
		})
		.catch(() => {});
}
