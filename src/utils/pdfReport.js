import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors } from '../theme/theme';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Génère un document HTML autonome représentant un rapport sous forme de
// tableau — utilisé uniquement pour produire le PDF final (l'aperçu à
// l'écran est rendu séparément en composants RN natifs, cf. ReportPreviewScreen).
// `rows` : tableau d'objets { [colonne.key]: valeur, photo?: base64 sans préfixe }.
export function buildReportHtml({ title, subtitle, columns, rows }) {
  const hasPhotos = rows.some((row) => row.photo);
  const generatedAt = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const headerCells = [
    hasPhotos ? '<th class="photo-col">Photo</th>' : '',
    ...columns.map((col) => `<th>${escapeHtml(col.label)}</th>`),
  ].join('');

  const bodyRows = rows
    .map((row, index) => {
      const photoCell = hasPhotos
        ? `<td class="photo-col">${
            row.photo ? `<img src="data:image/jpeg;base64,${row.photo}" />` : ''
          }</td>`
        : '';
      const cells = columns.map((col) => `<td>${escapeHtml(row[col.key])}</td>`).join('');
      return `<tr class="${index % 2 === 0 ? 'even' : 'odd'}">${photoCell}${cells}</tr>`;
    })
    .join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { margin: 32px; }
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: ${colors.textPrimary}; margin: 0; }
          .header { border-bottom: 3px solid ${colors.primary}; padding-bottom: 12px; margin-bottom: 20px; }
          .brand { font-size: 13px; font-weight: 700; color: ${colors.primary}; letter-spacing: 1px; text-transform: uppercase; }
          h1 { font-size: 22px; margin: 4px 0; }
          .meta { font-size: 11px; color: ${colors.textSecondary}; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { text-align: left; background: ${colors.primary}; color: #ffffff; padding: 8px 10px; }
          td { padding: 8px 10px; border-bottom: 1px solid ${colors.border}; vertical-align: middle; }
          tr.even { background: ${colors.background}; }
          .photo-col { width: 56px; }
          .photo-col img { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; display: block; }
          .footer { margin-top: 20px; font-size: 10px; color: ${colors.textMuted}; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">CAGF</div>
          <h1>${escapeHtml(title)}</h1>
          ${subtitle ? `<div class="meta">${escapeHtml(subtitle)}</div>` : ''}
          <div class="meta">Généré le ${generatedAt}</div>
        </div>
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
        <div class="footer">${rows.length} ligne${rows.length > 1 ? 's' : ''} — Un système développé par Jerttech</div>
      </body>
    </html>
  `;
}

const NATIVE_CALL_TIMEOUT_MS = 20000;

// expo-print est connu pour rester bloqué indéfiniment sur certains appareils
// iOS sans jamais rejeter sa promesse (bug documenté côté Expo, non corrigé
// en amont : https://github.com/expo/expo/issues/27570). Sans ce timeout,
// un blocage natif laisserait l'écran de téléchargement bloqué en permanence.
function withTimeout(promise, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), NATIVE_CALL_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

// Génère le PDF depuis le HTML et ouvre le menu de partage natif — c'est
// l'équivalent mobile d'un "téléchargement" : il n'existe pas d'écriture
// directe dans un dossier Téléchargements sans permissions supplémentaires,
// donc l'admin choisit "Enregistrer dans Fichiers" (ou équivalent) depuis ce menu.
export async function sharePdf({ html, dialogTitle }) {
  console.log('[pdfReport] génération du PDF, taille du HTML =', html.length);
  const { uri } = await withTimeout(
    Print.printToFileAsync({ html, base64: false }),
    'La génération du PDF a pris trop de temps. Réessayez.'
  );
  console.log('[pdfReport] PDF généré :', uri);

  const canShare = await Sharing.isAvailableAsync();
  console.log('[pdfReport] partage disponible :', canShare);
  if (!canShare) {
    throw new Error("Le partage de fichiers n'est pas disponible sur cet appareil.");
  }

  await withTimeout(
    Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: dialogTitle || 'Exporter le rapport',
      UTI: 'com.adobe.pdf',
    }),
    'Le partage du fichier a pris trop de temps. Réessayez.'
  );
  console.log('[pdfReport] partage terminé');
}
