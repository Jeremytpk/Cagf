#!/usr/bin/env node
// Télécharge les poids des modèles face-api.js (Tiny Face Detector,
// Face Landmark 68 et Face Recognition) dans functions/models/.
// Ces modèles sont nécessaires pour extraire les empreintes faciales
// (vecteurs 128-D) directement dans la Cloud Function.
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js-models@master';
const MODELS_DIR = path.join(__dirname, '..', 'models');

// Chaque modèle vit dans son propre sous-dossier du repo en amont ;
// on les télécharge tous à plat dans functions/models/.
const FILES = [
  'tiny_face_detector/tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector/tiny_face_detector_model-shard1',
  'face_landmark_68/face_landmark_68_model-weights_manifest.json',
  'face_landmark_68/face_landmark_68_model-shard1',
  'face_recognition/face_recognition_model-weights_manifest.json',
  'face_recognition/face_recognition_model-shard1',
  'face_recognition/face_recognition_model-shard2',
];

function download(url, destination, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) {
          if (redirectsLeft === 0) return reject(new Error(`Trop de redirections pour ${url}`));
          response.resume();
          return resolve(download(response.headers.location, destination, redirectsLeft - 1));
        }
        if (response.statusCode !== 200) {
          response.resume();
          return reject(new Error(`Échec du téléchargement ${url} (HTTP ${response.statusCode})`));
        }
        const file = fs.createWriteStream(destination);
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      })
      .on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

  const missing = FILES.filter((relPath) => !fs.existsSync(path.join(MODELS_DIR, path.basename(relPath))));
  if (missing.length === 0) {
    console.log('[download-models] Tous les modèles sont déjà présents, rien à faire.');
    return;
  }

  console.log(`[download-models] Téléchargement de ${missing.length} fichier(s) de modèle...`);
  for (const relPath of missing) {
    const url = `${BASE_URL}/${relPath}`;
    const fileName = path.basename(relPath);
    const destination = path.join(MODELS_DIR, fileName);
    process.stdout.write(`  - ${fileName} ... `);
    try {
      await download(url, destination);
      console.log('OK');
    } catch (error) {
      console.log('ÉCHEC');
      console.error(`[download-models] ${error.message}`);
      console.error(
        '[download-models] Téléchargez manuellement les modèles depuis ' +
          'https://github.com/justadudewhohacks/face-api.js-models et placez-les dans functions/models/'
      );
      process.exitCode = 0; // ne bloque pas `npm install` ; voir README pour le mode manuel.
      return;
    }
  }
  console.log('[download-models] Terminé.');
}

main();
