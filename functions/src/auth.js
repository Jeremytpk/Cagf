'use strict';

const admin = require('firebase-admin');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Vérifie le jeton Firebase Auth transmis dans l'en-tête Authorization.
// Utilisé par requireAdmin ainsi que par les endpoints qui ont besoin d'un
// utilisateur authentifié sans nécessiter les droits administrateur (ex.
// bootstrapAdmin).
async function verifyToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    throw new HttpError(401, 'Authentification requise.');
  }

  try {
    return await admin.auth().verifyIdToken(match[1]);
  } catch (error) {
    throw new HttpError(401, 'Jeton invalide ou expiré.');
  }
}

// S'assure que l'utilisateur figure dans la collection `admins`. Utilisé par
// les fonctions réservées à l'administrateur (créer/modifier/supprimer un employé).
async function requireAdmin(req) {
  const decoded = await verifyToken(req);

  const adminDoc = await admin.firestore().collection('admins').doc(decoded.uid).get();
  if (!adminDoc.exists) {
    throw new HttpError(403, "Droits administrateur requis pour cette action.");
  }

  return decoded;
}

module.exports = { requireAdmin, verifyToken, HttpError };
