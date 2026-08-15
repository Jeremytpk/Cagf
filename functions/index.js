'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

const { extractFaceDescriptor, cosineSimilarity } = require('./src/faceEngine');
const { issueCodeForEmployee, hashCode, decryptCode } = require('./src/codeEngine');
const { requireAdmin, verifyToken } = require('./src/auth');

admin.initializeApp();
const db = admin.firestore();

const FACE_MATCH_THRESHOLD = 0.85;

// Pepper HMAC pour le hachage des codes secrets employés — jamais stocké
// dans Firestore, connu uniquement de l'environnement des Cloud Functions.
// Défini via `firebase functions:secrets:set CODE_PEPPER`.
const CODE_PEPPER = defineSecret('CODE_PEPPER');

setGlobalOptions({ region: 'us-central1' });

// face-api.js + les modèles chargés en mémoire nécessitent plus de RAM et de
// temps qu'une fonction HTTP classique, en particulier au "cold start".
const RUNTIME_OPTIONS = { memory: '1GiB', timeoutSeconds: 60, cors: true };

// Mêmes contraintes que RUNTIME_OPTIONS, plus l'accès au pepper de hachage
// des codes secrets.
const CODE_RUNTIME_OPTIONS = { ...RUNTIME_OPTIONS, secrets: [CODE_PEPPER] };

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
  CODE_RUNTIME_OPTIONS,
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

    // Génère le code secret (2e facteur) une fois l'employé créé — jamais
    // stocké en clair, retourné une seule fois pour que l'admin le transmette.
    const code = await issueCodeForEmployee({ db, admin, employeeId, previousHash: null });

    res.status(200).json({ success: true, employeeId, name, code });
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

// POST /regenerateEmployeeCode — Admin uniquement.
// Body: { employeeId }
// Émet un nouveau code secret (2e facteur) pour un employé existant, à la
// demande de l'admin (ex. code oublié ou compromis). N'est jamais déclenché
// automatiquement par une simple modification du nom/service/photo.
exports.regenerateEmployeeCode = onRequest(
  CODE_RUNTIME_OPTIONS,
  handle(async (req, res) => {
    if (req.method !== 'POST') return sendError(res, 405, 'Méthode non autorisée.');

    await requireAdmin(req);
    const { employeeId } = req.body || {};
    if (!employeeId) return sendError(res, 400, 'employeeId est requis.');

    const employeeRef = db.collection('employees').doc(String(employeeId));
    const existing = await employeeRef.get();
    if (!existing.exists) return sendError(res, 404, 'Employé introuvable.');

    const code = await issueCodeForEmployee({
      db,
      admin,
      employeeId: String(employeeId),
      previousHash: existing.data().secretCodeHash || null,
    });

    res.status(200).json({ success: true, employeeId: String(employeeId), code });
  })
);

// POST /getEmployeeCode — Admin uniquement.
// Body: { employeeId }
// Déchiffre et retourne le code secret actuel d'un employé, pour l'écran de
// modification. Ne concerne que les codes émis après l'introduction du
// chiffrement réversible (secretCodeEnc) — les codes plus anciens n'ont que
// leur hash et doivent être régénérés pour devenir consultables.
exports.getEmployeeCode = onRequest(
  CODE_RUNTIME_OPTIONS,
  handle(async (req, res) => {
    if (req.method !== 'POST') return sendError(res, 405, 'Méthode non autorisée.');

    await requireAdmin(req);
    const { employeeId } = req.body || {};
    if (!employeeId) return sendError(res, 400, 'employeeId est requis.');

    const existing = await db.collection('employees').doc(String(employeeId)).get();
    if (!existing.exists) return sendError(res, 404, 'Employé introuvable.');

    const { secretCodeEnc } = existing.data();
    if (!secretCodeEnc) {
      return sendError(
        res,
        404,
        "Ce code a été généré avant l'activation de cette fonctionnalité. Régénérez-le pour pouvoir le consulter."
      );
    }

    const code = decryptCode(secretCodeEnc, process.env.CODE_PEPPER);
    res.status(200).json({ success: true, employeeId: String(employeeId), code });
  })
);

// POST /verifyEmployeeCode — Public (borne de pointage).
// Body: { code }
// 1er facteur du pointage à double sécurité : recherche O(1) par hash
// (index `employeeCodes`) plutôt qu'une comparaison 1:N. Ne révèle jamais
// si un code existe ou non dans le message d'erreur (évite l'énumération).
// Chaque échec est immédiatement signalé à l'admin.
exports.verifyEmployeeCode = onRequest(
  CODE_RUNTIME_OPTIONS,
  handle(async (req, res) => {
    if (req.method !== 'POST') return sendError(res, 405, 'Méthode non autorisée.');

    const { code } = req.body || {};
    if (!code) return sendError(res, 400, 'code est requis.');

    const codeHash = hashCode(String(code), process.env.CODE_PEPPER);
    const indexDoc = await db.collection('employeeCodes').doc(codeHash).get();

    if (!indexDoc.exists) {
      await db.collection('scanAlerts').add({
        type: 'code_mismatch',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ success: false, message: 'Code invalide.' });
    }

    const { employeeId } = indexDoc.data();
    const employeeSnap = await db.collection('employees').doc(employeeId).get();
    if (!employeeSnap.exists) {
      return sendError(res, 404, 'Employé introuvable.');
    }

    res.status(200).json({ success: true, employeeId, name: employeeSnap.data().name });
  })
);

// POST /verifyEmployeeFace — Public (borne de pointage).
// Body: { employeeId, photoBase64 }
// 2e facteur : comparaison 1:1 du visage capturé au seul `face_vector` de
// l'employé identifié par le code (jamais une recherche sur tout le
// registre). Un échec est immédiatement signalé à l'admin ; une réussite
// enregistre l'entrée/sortie comme auparavant.
exports.verifyEmployeeFace = onRequest(
  RUNTIME_OPTIONS,
  handle(async (req, res) => {
    if (req.method !== 'POST') return sendError(res, 405, 'Méthode non autorisée.');

    const { employeeId, photoBase64 } = req.body || {};
    if (!employeeId || !photoBase64) {
      return sendError(res, 400, 'employeeId et photoBase64 sont requis.');
    }

    const employeeSnap = await db.collection('employees').doc(String(employeeId)).get();
    if (!employeeSnap.exists) {
      return sendError(res, 404, 'Employé introuvable.');
    }
    const employee = employeeSnap.data();

    const liveDescriptor = await extractFaceDescriptor(photoBase64);
    if (!liveDescriptor) {
      return sendError(res, 400, 'Aucun visage détecté. Centrez votre visage et réessayez.');
    }

    const similarity = cosineSimilarity(employee.face_vector, liveDescriptor);

    if (similarity < FACE_MATCH_THRESHOLD) {
      await db.collection('scanAlerts').add({
        type: 'face_mismatch',
        employeeId: employee.employeeId,
        name: employee.name,
        similarity,
        photoBase64,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.status(200).json({
        success: false,
        message: 'Visage non reconnu. Veuillez réessayer.',
        similarity,
      });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaySnap = await db
      .collection('attendance')
      .where('employeeId', '==', employee.employeeId)
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    const lastType = todaySnap.empty ? null : todaySnap.docs[0].data().type;
    const action = lastType === 'in' ? 'out' : 'in';

    const attendanceRef = db.collection('attendance').doc();
    await attendanceRef.set({
      employeeId: employee.employeeId,
      name: employee.name,
      type: action,
      similarity,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      success: true,
      action,
      name: employee.name,
      employeeId: employee.employeeId,
      similarity,
      timestamp: new Date().toISOString(),
    });
  })
);
