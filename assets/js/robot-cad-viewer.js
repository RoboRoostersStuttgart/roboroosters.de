import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

const rootEl = document.getElementById('botCadViewerSection');
if (rootEl) {
	initBotCadViewer(rootEl);
}

function initBotCadViewer(section) {
	const isDe = (document.documentElement.lang || '').toLowerCase().startsWith('de');

	const modeHotspotBtn = section.querySelector('[data-cad-mode="hotspots"]');
	const mode3dBtn = section.querySelector('[data-cad-mode="3d"]');
	const hotspotStage = section.querySelector('.cad-hotspot-stage');
	const threeStage = section.querySelector('.cad-three-stage');
	const canvasMount = section.querySelector('#cadCanvasMount');
	const emptyOverlay = section.querySelector('#cadEmptyOverlay');
	const loadingOverlay = section.querySelector('#cadLoadingOverlay');
	const statusTextEl = section.querySelector('#cadModelStatus');
	const fileInput = section.querySelector('#cadLocalFileInput');
	const loadBtn = section.querySelector('#cadLoadFileBtn');
	const emptyLoadBtn = section.querySelector('#cadEmptyLoadBtn');

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
		},
		decode: {
			image: '../assets/images/opt/turret.webp',
			alt: isDe
				? 'DECODE V3 Präzisionsturm mit interaktiven Baugruppen-Markierungen'
				: 'DECODE V3 precision turret with interactive subsystem hotspots',
			pins: [
				{
					id: 'd-turret',
					x: 50,
					y: 38,
					num: '01',
					badge: isDe ? '01 · 360°-Turm' : '01 · 360° Bearing Turret',
					title: isDe ? 'DIY Sandwich-Kugellager-Turm' : 'Custom DIY Sandwich Bearing Turret',
					desc: isDe
						? 'Drehzahnräder direkt in die Platten integriert – flacher Schwerpunkt und kontinuierliche 360°-Ausrichtung per IMU-PID.'
						: 'Rotation gearing embedded directly inside custom plates for a low center of gravity and continuous 360° field-centric IMU alignment.',
					meta: isDe ? 'V3 Finale · Integrierte Pitch-Haube' : 'V3 Competition Spec · Adjustable Hood Pitch'
				},
				{
					id: 'd-flicker',
					x: 34,
					y: 62,
					num: '02',
					badge: isDe ? '02 · Klee-Flicker' : '02 · Tri-Chamber Flicker',
					title: isDe ? 'Segmentierte Kleeblatt-Trommel' : 'Tri-Chamber Clover Indexer',
					desc: isDe
						? 'Passive kinetische Sortierung mit Pyramiden-Kern und Reset-Zeit unter 0,5 Sekunden für störungsfreie Schnellfeuer-Salven.'
						: 'Segmented clover geometry with passive pyramid diverter and sub-0.5s reset speed for jam-free burst scoring.',
					meta: isDe ? 'Pattern Auto-Burst · Kamera-gesteuert' : 'Pattern Auto-Burst · Camera Indexed'
				},
				{
					id: 'd-intake',
					x: 72,
					y: 68,
					num: '03',
					badge: isDe ? '03 · Ketten-Intake' : '03 · Variable-Pitch Intake',
					title: isDe ? 'Hochgriffiger Dual-Ketten-Intake' : 'Dual-Chain Lego Rubber Intake',
					desc: isDe
						? '3.700-U/min-Motor mit synchronisierter Doppelkette auf schwenkbarem Arm – entkoppelt Motormasse vom Aufnahmepunkt.'
						: '3,700 RPM motor mounted deep in the chassis driving compliant rubber wheels through synchronized dual chains.',
					meta: isDe ? 'Top 3 in Deutschland · Inspire Award' : 'Top 3 in Germany · Inspire Award'
				}
			]
		}
	};

	let currentSeason = document.documentElement.getAttribute('data-season') === 'decode' ? 'decode' : 'biobuzz';
	let serverModels = { biobuzz: null, decode: null };
	let activeMode = 'hotspots';

	function renderHotspots() {
		if (!hotspotStage || !hotspotImg) return;
		const cfg = SEASON_DATA[currentSeason] || SEASON_DATA.biobuzz;
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
	let explodeParts = [];
	let explodeFactor = 0;
	let targetExplodeFactor = 0;
	let autoRotateEnabled = false;
	let wireframeEnabled = false;
	let hasLoadedAnyModel = false;
	let loadedSeasonTag = null;
	let frameId = 0;
	let renderBusy = false;
	let renderDirty = false;
	let isSoftwareGl = false;
	let lastTime = performance.now();
	const defaultCamPos = new THREE.Vector3(2.35, 1.55, 2.55);
	const defaultTarget = new THREE.Vector3(0, 0.48, 0);

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
				robotWrapper.rotation.y += dt * 0.42;
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
		if (renderer || !canvasMount) return;

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
		controls.minDistance = 0.9;
		controls.maxDistance = 8.5;
		controls.maxPolarAngle = Math.PI * 0.49;
		controls.addEventListener('change', requestRender);
		controls.addEventListener('start', () => {
			autoRotateEnabled = false;
			if (autoRotateBtn) autoRotateBtn.classList.remove('active');
		});

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
		const turntableMat = new THREE.MeshBasicMaterial({
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
		const palette = currentSeason === 'decode'
			? [0xff5e00, 0x334155, 0x00b2ff, 0x1e293b, 0x94a3b8]
			: [0x236b43, 0x1e293b, 0xd97706, 0x475569, 0x94a3b8];
		const color = palette[index % palette.length];
		const isMetal = index % 2 === 1;
		return new THREE.MeshStandardMaterial({
			color,
			metalness: isMetal ? 0.72 : 0.18,
			roughness: isMetal ? 0.28 : 0.54,
			wireframe: wireframeEnabled
		});
	}

	function mountLoadedObject(objectRoot, labelText, { isGltf = false } = {}) {
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

		targetExplodeFactor = 0;
		explodeFactor = 0;
		if (explodeRange) explodeRange.value = '0';

		camera.position.copy(defaultCamPos);
		controls.target.set(0, (size.y * scaleFactor) * 0.45, 0);
		controls.update();

		hasLoadedAnyModel = true;
		if (emptyOverlay) emptyOverlay.hidden = true;
		if (loadingOverlay) loadingOverlay.hidden = true;
		if (statusTextEl) statusTextEl.textContent = labelText;
		requestRender();
	}

	async function loadServerModel(entry) {
		const modelUrl = entry?.url || entry?.obj;
		if (!entry || !modelUrl) return;
		ensureThreeScene();
		if (loadingOverlay) loadingOverlay.hidden = false;
		if (emptyOverlay) emptyOverlay.hidden = true;

		try {
			const isGltf = entry.format === 'glb' || entry.format === 'gltf' || /\.(?:glb|gltf)$/i.test(modelUrl);
			if (isGltf) {
				const gltfLoader = createGltfLoader();
				const gltf = await gltfLoader.loadAsync(modelUrl);
				loadedSeasonTag = currentSeason;
				mountLoadedObject(gltf.scene, entry.name, { isGltf: true });
			} else {
				const objLoader = new OBJLoader();
				if (entry.mtl) {
					const mtlLoader = new MTLLoader();
					const baseDir = entry.mtl.slice(0, entry.mtl.lastIndexOf('/') + 1);
					mtlLoader.setPath(baseDir);
					const mtlFile = decodeURIComponent(entry.mtl.slice(entry.mtl.lastIndexOf('/') + 1));
					const materials = await mtlLoader.loadAsync(mtlFile);
					materials.preload();
					objLoader.setMaterials(materials);
				}
				const loaded = await objLoader.loadAsync(modelUrl);
				loadedSeasonTag = currentSeason;
				mountLoadedObject(loaded, entry.name, { isGltf: false });
			}
		} catch {
			if (loadingOverlay) loadingOverlay.hidden = true;
			if (!hasLoadedAnyModel && emptyOverlay) emptyOverlay.hidden = false;
		}
	}

	async function loadLocalFiles(fileList) {
		const files = Array.from(fileList || []);
		const gltfFile = files.find((f) => /\.(?:glb|gltf)$/i.test(f.name));
		const objFile = files.find((f) => /\.obj$/i.test(f.name));
		if (!gltfFile && !objFile) return;

		setMode('3d');
		ensureThreeScene();
		if (loadingOverlay) loadingOverlay.hidden = false;
		if (emptyOverlay) emptyOverlay.hidden = true;

		try {
			if (gltfFile) {
				const buffer = await gltfFile.arrayBuffer();
				const gltfLoader = createGltfLoader();
				const gltf = await new Promise((resolve, reject) => {
					gltfLoader.parse(buffer, '', resolve, reject);
				});
				loadedSeasonTag = currentSeason;
				mountLoadedObject(gltf.scene, gltfFile.name, { isGltf: true });
			} else if (objFile) {
				const objText = await objFile.text();
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
				loadedSeasonTag = currentSeason;
				mountLoadedObject(parsed, objFile.name, { isGltf: false });
			}
		} catch {
			if (loadingOverlay) loadingOverlay.hidden = true;
			if (!hasLoadedAnyModel && emptyOverlay) emptyOverlay.hidden = false;
			if (statusTextEl) {
				statusTextEl.textContent = isDe
					? '3D-Datei konnte nicht geladen werden (.glb/.gltf/.obj prüfen)'
					: 'Could not read 3D file (check valid .glb / .gltf / .obj)';
			}
		}
	}

	function loadCurrentSeasonServerModelIfNeeded() {
		const entry = serverModels[currentSeason];
		if (entry && (entry.url || entry.obj) && loadedSeasonTag !== currentSeason) {
			loadServerModel(entry);
		}
	}

	// Wire HUD controls
	if (dockToggleBtn && dockEl) {
		dockToggleBtn.addEventListener('click', () => {
			const collapsed = dockEl.classList.toggle('is-collapsed');
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

	// Observe season switches (`html[data-season]`) so hotspots & server model sync smoothly
	const obs = new MutationObserver(() => {
		const next = document.documentElement.getAttribute('data-season') === 'decode' ? 'decode' : 'biobuzz';
		if (next !== currentSeason) {
			currentSeason = next;
			renderHotspots();
			if (activeMode === '3d') {
				loadCurrentSeasonServerModelIfNeeded();
			}
		}
	});
	obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-season'] });

	renderHotspots();

	async function probeStaticModels() {
		const modelsBaseUrl = new URL('../models/', import.meta.url);
		try {
			const manifestRes = await fetch(new URL('models.json', modelsBaseUrl).href, { cache: 'no-store' });
			if (manifestRes.ok) {
				const manifest = await manifestRes.json();
				if (manifest && (manifest.biobuzz || manifest.decode)) {
					return manifest;
				}
			}
		} catch {
			// Ignore missing or invalid static manifest
		}

		try {
			const scrimmageUrl = new URL('Scrimmage_bot.glb', modelsBaseUrl).href;
			const headRes = await fetch(scrimmageUrl, { method: 'HEAD', cache: 'no-store' });
			const len = Number(headRes.headers.get('content-length') || '0');
			if (headRes.ok && len >= 20) {
				return {
					biobuzz: {
						format: 'glb',
						url: scrimmageUrl,
						obj: null,
						mtl: null,
						name: 'Scrimmage_bot.glb'
					},
					decode: null
				};
			}
		} catch {
			// Ignore static probe errors
		}

		return null;
	}

	// Probe server /api/robot-models (Express) and fall back to static GitHub Pages model manifest/probe
	fetch('/api/robot-models', { cache: 'no-store' })
		.then((res) => (res.ok ? res.json() : probeStaticModels()))
		.catch(() => probeStaticModels())
		.then((data) => {
			if (!data) return;
			serverModels = data;
			if (serverModels[currentSeason] && (serverModels[currentSeason].url || serverModels[currentSeason].obj)) {
				// Auto-activate 3D CAD viewer as soon as a valid .glb / .gltf / .obj is in /assets/models/
				setMode('3d');
			}
		})
		.catch(() => {});
}
