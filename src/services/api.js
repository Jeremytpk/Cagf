import { FUNCTIONS_BASE_URL } from '../config/env';

const REQUEST_TIMEOUT_MS = 15000;

async function callFunction(path, { body, idToken } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  // Sans timeout, une requête qui ne répond jamais (réseau instable, cold
  // start anormalement long) laisse l'appelant en attente indéfiniment.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${FUNCTIONS_BASE_URL}/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
  } catch (networkError) {
    if (networkError.name === 'AbortError') {
      throw new Error('La requête a expiré. Vérifiez votre connexion et réessayez.');
    }
    throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion.');
  } finally {
    clearTimeout(timeoutId);
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

// Admin uniquement — crée un congé pour un employé. startDate/endDate au
// format 'YYYY-MM-JJ'.
export function addVacation({ idToken, employeeId, startDate, endDate, reason }) {
  return callFunction('addVacation', {
    idToken,
    body: { employeeId, startDate, endDate, reason },
  });
}

// Admin uniquement — met à jour les dates et/ou le motif d'un congé existant.
export function updateVacation({ idToken, vacationId, startDate, endDate, reason }) {
  return callFunction('updateVacation', {
    idToken,
    body: { vacationId, startDate, endDate, reason },
  });
}

// Admin uniquement — supprime un congé.
export function deleteVacation({ idToken, vacationId }) {
  return callFunction('deleteVacation', {
    idToken,
    body: { vacationId },
  });
}

// Admin uniquement — émet un nouveau code secret pour un employé existant
// (ex. code oublié/compromis). N'affecte ni le nom, ni le service, ni la photo.
export function regenerateEmployeeCode({ idToken, employeeId }) {
  return callFunction('regenerateEmployeeCode', {
    idToken,
    body: { employeeId },
  });
}

// Admin uniquement — déchiffre et retourne le code secret actuel d'un
// employé pour affichage sur l'écran de modification.
export function getEmployeeCode({ idToken, employeeId }) {
  return callFunction('getEmployeeCode', {
    idToken,
    body: { employeeId },
  });
}

// Public (borne de pointage) — 1er facteur : vérifie le code secret et
// retourne l'identité de l'employé correspondant (sans jamais révéler si un
// code existe en cas d'échec).
export function verifyEmployeeCode({ code }) {
  return callFunction('verifyEmployeeCode', {
    body: { code },
  });
}

// Public (borne de pointage) — 2e facteur : compare le visage capturé
// uniquement à celui de l'employé identifié par le code (1:1), puis
// enregistre l'entrée/sortie si ça correspond.
export function verifyEmployeeFace({ employeeId, photoBase64 }) {
  return callFunction('verifyEmployeeFace', {
    body: { employeeId, photoBase64 },
  });
}
