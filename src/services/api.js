import { FUNCTIONS_BASE_URL } from '../config/env';

async function callFunction(path, { body, idToken } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  let response;
  try {
    response = await fetch(`${FUNCTIONS_BASE_URL}/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
    });
  } catch (networkError) {
    throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion.');
  }

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    throw new Error('Réponse invalide du serveur.');
  }

  if (!response.ok) {
    throw new Error(data?.message || `Erreur serveur (${response.status})`);
  }
  return data;
}

// Utilisateur authentifié, pas encore admin — n'accorde les droits admin que
// si aucun administrateur n'existe encore (bootstrap du tout premier compte).
export function bootstrapAdmin({ idToken }) {
  return callFunction('bootstrapAdmin', { idToken });
}

// Admin uniquement — crée un nouvel employé avec son empreinte faciale.
// L'identifiant employé est généré automatiquement côté serveur.
export function registerEmployee({ idToken, name, department, photoBase64 }) {
  return callFunction('registerEmployee', {
    idToken,
    body: { name, department, photoBase64 },
  });
}

// Admin uniquement — met à jour les informations et/ou la photo de référence.
export function updateEmployee({ idToken, employeeId, name, department, photoBase64 }) {
  return callFunction('updateEmployee', {
    idToken,
    body: { employeeId, name, department, photoBase64 },
  });
}

// Admin uniquement — supprime un employé.
export function deleteEmployee({ idToken, employeeId }) {
  return callFunction('deleteEmployee', {
    idToken,
    body: { employeeId },
  });
}

// Public (borne de pointage) — identifie l'employé à partir de son visage
// (1:N, aucun identifiant requis) et enregistre l'entrée/sortie.
export function identifyEmployee({ photoBase64 }) {
  return callFunction('identifyEmployee', {
    body: { photoBase64 },
  });
}

// Public (borne de pointage) — signale un visage non reconnu après plusieurs
// tentatives consécutives, pour examen par un administrateur.
export function reportScanFailure({ photoBase64, attempts, similarity }) {
  return callFunction('reportScanFailure', {
    body: { photoBase64, attempts, similarity },
  });
}
