#!/usr/bin/env node
/**
 * Automated image converter & optimizer for RoboRooster static assets.
 * - Converts unoptimized .jpg/.jpeg/.png files in assets/images (and optional public/assets/aistudio)
 *   into resized, metadata-stripped WebP files under opt/ directories.
 * - Generates AVIF companions alongside opt WebP files whenever AVIF is smaller than WebP.
 *
 * Usage:
 *   node scripts/optimize-images.mjs            # Convert missing/stale WebP & AVIF across assets/images + active public/opt
 *   node scripts/optimize-images.mjs --all      # Also convert all raw files in public/assets/aistudio
 *   node scripts/optimize-images.mjs --force    # Re-encode even if outputs exist
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const INCLUDE_ALL_PUBLIC = args.has('--all');
const FORCE = args.has('--force');
const SKIP_AVIF = args.has('--webp-only');

const RASTER_EXT_RE = /\.(jpe?g|png)$/i;
const SKIP_PNG_NAMES = new Set([
	'pwa-192x192.png',
	'pwa-512x512.png',
	'pwa-maskable-512x512.png',
	'logo.png'
]);

async function detectTooling() {
	let hasConvert = false;
	let hasFfmpeg = false;
	try {
		const { stdout } = await execFileAsync('convert', ['-list', 'format']);
		hasConvert = /WEBP/i.test(stdout);
	} catch {
		hasConvert = false;
	}
	try {
		await execFileAsync('ffmpeg', ['-version']);
		hasFfmpeg = true;
	} catch {
		hasFfmpeg = false;
	}
	return { hasConvert, hasFfmpeg };
}

function collectFiles(dir, { skipOpt = false } = {}) {
	const results = [];
	if (!fs.existsSync(dir)) return results;
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (skipOpt && entry.name === 'opt') continue;
			results.push(...collectFiles(full, { skipOpt }));
		} else if (entry.isFile()) {
			results.push(full);
		}
	}
	return results;
}

function isFresh(srcPath, destPath) {
	if (FORCE || !fs.existsSync(destPath)) return false;
	return fs.statSync(destPath).mtimeMs >= fs.statSync(srcPath).mtimeMs;
}

async function encodeWebp(srcPath, destPath, tooling) {
	fs.mkdirSync(path.dirname(destPath), { recursive: true });
	if (tooling.hasConvert) {
		await execFileAsync('convert', [
			srcPath,
			'-auto-orient',
			'-strip',
			'-resize',
			'1600x1600>',
			'-quality',
			'82',
			'-define',
			'webp:method=6',
			destPath
		]);
		return;
	}
	if (tooling.hasFfmpeg) {
		await execFileAsync('ffmpeg', [
			'-y',
			'-i',
			srcPath,
			'-vf',
			'scale=min(1600\\,iw):-2',
			'-c:v',
			'libwebp',
			'-q:v',
			'82',
			destPath
		]);
		return;
	}
	throw new Error('Neither ImageMagick (convert) nor ffmpeg is installed.');
}

async function encodeAvif(srcPath, destPath, tooling) {
	if (!tooling.hasConvert) return false;
	fs.mkdirSync(path.dirname(destPath), { recursive: true });
	await execFileAsync('convert', [
		srcPath,
		'-strip',
		'-quality',
		'50',
		destPath
	]);
	const srcSize = fs.statSync(srcPath).size;
	const dstSize = fs.statSync(destPath).size;
	// Only retain AVIF when genuinely smaller than WebP
	if (dstSize === 0 || dstSize >= srcSize) {
		fs.unlinkSync(destPath);
		return false;
	}
	return true;
}

async function runPool(items, concurrency, worker) {
	let idx = 0;
	async function next() {
		while (idx < items.length) {
			const current = items[idx++];
			await worker(current);
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, next));
}

async function main() {
	const tooling = await detectTooling();
	if (!tooling.hasConvert && !tooling.hasFfmpeg) {
		console.error('Error: ImageMagick `convert` or `ffmpeg` is required to convert images.');
		process.exit(1);
	}

	let webpConverted = 0;
	let webpSkipped = 0;
	let avifConverted = 0;
	let avifSkipped = 0;
	let bytesSavedWebp = 0;
	let bytesSavedAvif = 0;

	const webpJobs = [];

	// 1. assets/images/** -> assets/images/opt/**.webp
	const assetsImgDir = path.join(ROOT_DIR, 'assets', 'images');
	for (const filePath of collectFiles(assetsImgDir, { skipOpt: true })) {
		const base = path.basename(filePath);
		if (!RASTER_EXT_RE.test(base) || SKIP_PNG_NAMES.has(base)) continue;
		const rel = path.relative(assetsImgDir, filePath);
		const targetRel = rel.replace(RASTER_EXT_RE, '.webp');
		const destPath = path.join(assetsImgDir, 'opt', targetRel);
		if (isFresh(filePath, destPath)) {
			webpSkipped += 1;
			continue;
		}
		webpJobs.push({ src: filePath, dest: destPath });
	}

	// 2. Optionally convert any unoptimized originals in public/assets/aistudio
	if (INCLUDE_ALL_PUBLIC) {
		const pubAiDir = path.join(ROOT_DIR, 'public', 'assets', 'aistudio');
		for (const filePath of collectFiles(pubAiDir, { skipOpt: true })) {
			const base = path.basename(filePath);
			if (!RASTER_EXT_RE.test(base)) continue;
			const rel = path.relative(pubAiDir, filePath);
			const destPath = path.join(pubAiDir, 'opt', rel.replace(RASTER_EXT_RE, '.webp'));
			if (isFresh(filePath, destPath)) {
				webpSkipped += 1;
				continue;
			}
			webpJobs.push({ src: filePath, dest: destPath });
		}
	}

	await runPool(webpJobs, 4, async (job) => {
		await encodeWebp(job.src, job.dest, tooling);
		const origSize = fs.statSync(job.src).size;
		const newSize = fs.statSync(job.dest).size;
		bytesSavedWebp += Math.max(0, origSize - newSize);
		webpConverted += 1;
	});

	// 3. Generate AVIF companions for all optimized WebP files under opt/ directories
	if (!SKIP_AVIF && tooling.hasConvert) {
		const optDirs = [
			path.join(ROOT_DIR, 'assets', 'images', 'opt'),
			path.join(ROOT_DIR, 'public', 'assets', 'aistudio', 'opt')
		];
		const avifJobs = [];
		for (const optDir of optDirs) {
			for (const webpPath of collectFiles(optDir)) {
				if (!/\.webp$/i.test(webpPath)) continue;
				const avifPath = webpPath.replace(/\.webp$/i, '.avif');
				if (isFresh(webpPath, avifPath)) {
					avifSkipped += 1;
					continue;
				}
				avifJobs.push({ src: webpPath, dest: avifPath });
			}
		}

		await runPool(avifJobs, 4, async (job) => {
			const kept = await encodeAvif(job.src, job.dest, tooling);
			if (kept) {
				bytesSavedAvif += Math.max(0, fs.statSync(job.src).size - fs.statSync(job.dest).size);
				avifConverted += 1;
			} else {
				avifSkipped += 1;
			}
		});
	}

	console.log(
		`Image optimization complete: WebP converted=${webpConverted} (skipped=${webpSkipped}, saved ${(bytesSavedWebp / (1024 * 1024)).toFixed(2)} MB); ` +
		`AVIF converted=${avifConverted} (skipped=${avifSkipped}, saved ${(bytesSavedAvif / (1024 * 1024)).toFixed(2)} MB).`
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
