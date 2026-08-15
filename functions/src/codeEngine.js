'use strict';

const crypto = require('crypto');

const CODE_LENGTH = 6;

// Code numérique à 6 chiffres, généré avec crypto.randomInt (CSPRNG) plutôt
// que Math.random, qui n'offre aucune garantie cryptographique.
function generateCode() {
  const value = crypto.randomInt(0, 10 ** CODE_LENGTH);
  return String(value).padStart(CODE_LENGTH, '0');
}

// HMAC-SHA256 avec un pepper connu uniquement du serveur (secret Cloud
// Functions) : permet une recherche O(1) par égalité (le même code produit
// toujours le même hash) sans jamais exposer le code en clair, et sans
// qu'un accès à Firestore seul suffise à retrouver les codes (il faut aussi
// le pepper, qui ne quitte jamais l'environnement des Cloud Functions).
function hashCode(code, pepper) {
  return crypto.createHmac('sha256', pepper).update(code).digest('hex');
}

// Dérive une clé AES-256 distincte du pepper (via HMAC avec un label fixe)
// plutôt que de réutiliser directement le pepper comme clé de chiffrement —
// sépare l'usage "hachage pour recherche" de l'usage "chiffrement réversible".
function deriveEncryptionKey(pepper) {
  return crypto.createHmac('sha256', pepper).update('secret-code-encryption').digest();
}

// Chiffrement réversible du code (AES-256-GCM) pour permettre à l'admin de
// le reconsulter depuis l'écran de modification, sans avoir à le régénérer.
function encryptCode(code, pepper) {
  const key = deriveEncryptionKey(pepper);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
}

function decryptCode(enc, pepper) {
  const key = deriveEncryptionKey(pepper);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(enc.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(enc.authTag, 'hex'));
  const plain = Buffer.concat([decipher.update(Buffer.from(enc.ciphertext, 'hex')), decipher.final()]);
  return plain.toString('utf8');
}

// Génère un nouveau code pour un employé, remplace son entrée dans l'index
// `employeeCodes` (supprime l'ancienne s'il y en avait une) et met à jour
// `secretCodeHash`/`secretCodeEnc`/`codeUpdatedAt` sur le document employé.
// Utilisé à la fois à la création du compte et lors d'une régénération manuelle.
async function issueCodeForEmployee({ db, admin, employeeId, previousHash }) {
  const code = generateCode();
  const pepper = process.env.CODE_PEPPER;
  const codeHash = hashCode(code, pepper);

  const batch = db.batch();
  if (previousHash) {
    batch.delete(db.collection('employeeCodes').doc(previousHash));
  }
  batch.set(db.collection('employeeCodes').doc(codeHash), { employeeId });
  batch.update(db.collection('employees').doc(employeeId), {
    secretCodeHash: codeHash,
    secretCodeEnc: encryptCode(code, pepper),
    codeUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return code;
}

module.exports = { generateCode, hashCode, encryptCode, decryptCode, issueCodeForEmployee, CODE_LENGTH };
