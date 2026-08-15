'use strict';

const path = require('path');
const faceapi = require('face-api.js');
const { Canvas, Image, ImageData, loadImage } = require('canvas');

// face-api.js a été conçu pour le navigateur : on lui fournit une implémentation
// Canvas/Image compatible Node (module `canvas`) pour qu'il fonctionne côté serveur.
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODELS_PATH = path.join(__dirname, '..', 'models');

let loadPromise = null;

function ensureModelsLoaded() {
  if (!loadPromise) {
    loadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_PATH),
      faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH),
      faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH),
    ]).catch((error) => {
      loadPromise = null; // permet de réessayer sur le prochain appel
      throw error;
    });
  }
  return loadPromise;
}

function decodeBase64Image(base64) {
  const cleaned = base64.includes(',') ? base64.split(',').pop() : base64;
  return Buffer.from(cleaned, 'base64');
}

// Extrait le vecteur d'empreinte faciale (128 nombres) d'une photo base64.
// Se concentre uniquement sur la structure rigide du visage (yeux, nez, bouche,
// alignement osseux) grâce au modèle de reconnaissance faciale — insensible
// à la coiffure, à la barbe ou aux vêtements.
//
// TinyFaceDetector plutôt que SsdMobilenetv1 : mesuré ~10x plus rapide en local
// (≈0,6-0,8s contre ≈6-7s pour détection+repères+descripteur sur la même image,
// backend CPU JS pur) sans backend natif tfjs. Largement suffisant ici puisqu'on
// ne cherche qu'un seul visage, déjà centré par le cadre de guidage caméra.
async function extractFaceDescriptor(base64Image) {
  await ensureModelsLoaded();
  const buffer = decodeBase64Image(base64Image);
  const image = await loadImage(buffer);

  const detection = await faceapi
    .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;
  return Array.from(detection.descriptor);
}

function cosineSimilarity(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB) || vectorA.length !== vectorB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vectorA.length; i += 1) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = { extractFaceDescriptor, cosineSimilarity, ensureModelsLoaded };
