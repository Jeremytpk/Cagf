'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

const { extractFaceDescriptor, cosineSimilarity } = require('./src/faceEngine');
const { requireAdmin, verifyToken } = require('./src/auth');

admin.initializeApp();
const db = admin.firestore();

const FACE_MATCH_THRESHOLD = 0.85;

setGlobalOptions({ region: 'us-central1' });

// face-api.js + les modèles chargés en mémoire nécessitent plus de RAM et de
// temps qu'une fonction HTTP classique, en particulier au "cold start".
const RUNTIME_OPTIONS = { memory: '1GiB', timeoutSeconds: 60, cors: true };

function sendError(res, status, message) {
  res.status(status).json({ success: false, message });
}

// Enveloppe chaque handler pour uniformiser la gestion des erreurs
// (HttpError avec .status, ou toute autre erreur inattendue → 500).
function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      console.error(`[${req.path || req.originalUrl}]`, error);
      sendError(res, error.status || 500, error.message || 'Erreur interne du serveur.');
    }
  };
}

// POST /bootstrapAdmin — Utilisateur authentifié (Firebase Auth), pas encore admin.
// N'accorde les droits administrateur (création du doc `admins/{uid}`) que si
// la collection `admins` est vide, c-à-d. pour le tout premier compte. Une
// fois un admin créé, le signup est définitivement fermé : toute tentative
// suivante est rejetée et le compte Auth qui vient d'être créé côté client
// est supprimé pour ne pas laisser traîner un utilisateur sans droits.
exports.bootstrapAdmin = onRequest(
  { cors: true },
  handle(async (req, res) => {
    if (req.method !== 'POST') return sendError(res, 405, 'Méthode non autorisée.');

    const decoded = await verifyToken(req);

    const adminsSnap = await db.collection('admins').limit(1).get();
    if (!adminsSnap.empty) {
      await admin.auth().deleteUser(decoded.uid).catch(() => {});
      return sendError(res, 403, 'Un administrateur existe déjà. Contactez-le pour obtenir un accès.');
    }

    await db.collection('admins').doc(decoded.uid).set({
      email: decoded.email || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ success: true });
  })
);

// POST /registerEmployee — Admin uniquement.
// Body: { name, department?, photoBase64 }
// Extrait l'empreinte faciale (vecteur 128-D) et crée l'employé dans Firestore.
// L'identifiant employé (EMP-0001, EMP-0002, ...) est généré automatiquement
// à partir d'un compteur atomique — il n'est jamais saisi manuellement, ce
// qui élimine les doublons et les conflits de numérotation.
exports.registerEmployee = onRequest(
  RUNTIME_OPTIONS,
  handle(async (req, res) => {
    if (req.method !== 'POST') return sendError(res, 405, 'Méthode non autorisée.');

    const admin_ = await requireAdmin(req);
    const { name, department, photoBase64 } = req.body || {};
    if (!name || !photoBase64) {
      return sendError(res, 400, 'name et photoBase64 sont requis.');
    }

    const descriptor = await extractFaceDescriptor(photoBase64);
    if (!descriptor) {
      return sendError(
        res,
        400,
        'Aucun visage détecté sur la photo. Réessayez avec un visage bien centré et un bon éclairage.'
      );
    }

    const counterRef = db.collection('counters').doc('employees');
    const employeeId = await db.runTransaction(async (tx) => {
      const counterSnap = await tx.get(counterRef);
      const next = (counterSnap.exists ? counterSnap.data().value : 0) + 1;
      const id = `EMP-${String(next).padStart(4, '0')}`;

      tx.set(counterRef, { value: next }, { merge: true });
      tx.set(db.collection('employees').doc(id), {
        employeeId: id,
        name,
        department: department || null,
        face_vector: descriptor,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: admin_.uid,
      });

      return id;
    });

    res.status(200).json({ success: true, employeeId, name });
  })
);

// POST /updateEmployee — Admin uniquement.
// Body: { employeeId, name?, department?, photoBase64? }
// Met à jour les informations et, si une nouvelle photo est fournie,
// recalcule et remplace le face_vector.
exports.updateEmployee = onRequest(
  RUNTIME_OPTIONS,
  handle(async (req, res) => {
    if (req.method !== 'POST') return sendError(res, 405, 'Méthode non autorisée.');

    await requireAdmin(req);
    const { employeeId, name, department, photoBase64 } = req.body || {};
    if (!employeeId) return sendError(res, 400, 'employeeId est requis.');

    const employeeRef = db.collection('employees').doc(String(employeeId));
    const existing = await employeeRef.get();
    if (!existing.exists) return sendError(res, 404, 'Employé introuvable.');

    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (name) updates.name = name;
    if (department !== undefined) updates.department = department || null;

    if (photoBase64) {
      const descriptor = await extractFaceDescriptor(photoBase64);
      if (!descriptor) {
        return sendError(res, 400, 'Aucun visage détecté sur la nouvelle photo.');
      }
      updates.face_vector = descriptor;
    }

    await employeeRef.update(updates);
    res.status(200).json({ success: true, employeeId: String(employeeId) });
  })
);

// POST /deleteEmployee — Admin uniquement.
// Body: { employeeId }
exports.deleteEmployee = onRequest(
  RUNTIME_OPTIONS,
  handle(async (req, res) => {
    if (req.method !== 'POST') return sendError(res, 405, 'Méthode non autorisée.');

    await requireAdmin(req);
    const { employeeId } = req.body || {};
    if (!employeeId) return sendError(res, 400, 'employeeId est requis.');

    await db.collection('employees').doc(String(employeeId)).delete();
    res.status(200).json({ success: true });
  })
);

// POST /identifyEmployee — Public (borne de pointage).
// Body: { photoBase64 }
// Identification 1:N — aucun identifiant n'est demandé à l'utilisateur : le
// visage capturé est comparé (similarité cosinus) à tous les employés
// enregistrés et le meilleur score est retenu. Si ce score dépasse le seuil,
// enregistre automatiquement une entrée ou une sortie selon le dernier
// pointage du jour pour l'employé identifié.
exports.identifyEmployee = onRequest(
  RUNTIME_OPTIONS,
  handle(async (req, res) => {
    if (req.method !== 'POST') return sendError(res, 405, 'Méthode non autorisée.');

    const { photoBase64 } = req.body || {};
    if (!photoBase64) {
      return sendError(res, 400, 'photoBase64 est requis.');
    }

    const liveDescriptor = await extractFaceDescriptor(photoBase64);
    if (!liveDescriptor) {
      return sendError(res, 400, 'Aucun visage détecté. Centrez votre visage et réessayez.');
    }

    const employeesSnap = await db.collection('employees').get();
    let best = null;
    employeesSnap.forEach((doc) => {
      const employee = doc.data();
      const similarity = cosineSimilarity(employee.face_vector, liveDescriptor);
      if (!best || similarity > best.similarity) {
        best = { employee, similarity };
      }
    });

    if (!best || best.similarity < FACE_MATCH_THRESHOLD) {
      return res.status(200).json({
        success: false,
        message: 'Visage non reconnu. Veuillez réessayer.',
        similarity: best ? best.similarity : 0,
      });
    }

    const { employee, similarity } = best;
    const employeeId = employee.employeeId;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaySnap = await db
      .collection('attendance')
      .where('employeeId', '==', employeeId)
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    const lastType = todaySnap.empty ? null : todaySnap.docs[0].data().type;
    const action = lastType === 'in' ? 'out' : 'in';

    const attendanceRef = db.collection('attendance').doc();
    await attendanceRef.set({
      employeeId,
      name: employee.name,
      type: action,
      similarity,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      success: true,
      action,
      name: employee.name,
      employeeId,
      similarity,
      timestamp: new Date().toISOString(),
    });
  })
);

// POST /reportScanFailure — Public (borne de pointage).
// Body: { photoBase64?, attempts, similarity? }
// Enregistre un signalement lorsqu'un utilisateur échoue plusieurs fois de
// suite à être reconnu, afin qu'un administrateur puisse l'examiner (mauvais
// éclairage, employé non enregistré, tentative frauduleuse...).
exports.reportScanFailure = onRequest(
  { cors: true },
  handle(async (req, res) => {
    if (req.method !== 'POST') return sendError(res, 405, 'Méthode non autorisée.');

    const { photoBase64, attempts, similarity } = req.body || {};

    await db.collection('scanAlerts').add({
      photoBase64: photoBase64 || null,
      attempts: Number(attempts) || 0,
      similarity: typeof similarity === 'number' ? similarity : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ success: true });
  })
);
