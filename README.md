# CAGF — Pointage par reconnaissance faciale

Application de pointage (entrée/sortie) par reconnaissance faciale pour entreprise.
Expo SDK 54 (React Native) côté mobile, Firebase (Firestore + Cloud Functions v2 +
Authentication) côté backend, avec [face-api.js](https://github.com/justadudewhohacks/face-api.js)
pour extraire une empreinte faciale (vecteur 128-D) qui se concentre sur la structure
rigide du visage (yeux, nez, bouche, alignement osseux) — insensible à la coiffure, à
la barbe ou aux vêtements.

## 1. Structure du projet

```
CAGF/
├── App.js                          # Point d'entrée, navigation (React Navigation)
├── app.json                        # Config Expo (permissions caméra incluses)
├── src/
│   ├── config/env.js                # ⚠️ À remplir : clés Firebase + URL des functions
│   ├── firebase/firebaseConfig.js   # Init Firebase (Auth + Firestore) côté client
│   ├── context/AuthContext.js       # Session admin (login/logout/getIdToken)
│   ├── services/api.js              # fetch() vers les Cloud Functions
│   ├── theme/theme.js               # Couleurs, espacements, typographie
│   ├── components/
│   │   ├── CameraCapture.js         # expo-camera + cadre carré + bascule avant/arrière
│   │   ├── FaceGuideOverlay.js      # Masque carré de cadrage du visage
│   │   ├── PrimaryButton.js, Card.js, InputField.js, StatTile.js, EmptyState.js
│   ├── screens/
│   │   ├── ScanScreen.js            # Écran public : pointage par reconnaissance faciale (1:N)
│   │   └── admin/
│   │       ├── AdminLoginScreen.js
│   │       ├── AdminSignupScreen.js     # Création du tout premier compte admin (bootstrap)
│   │       ├── DashboardScreen.js       # Vue d'ensemble (stats + activité récente)
│   │       ├── EmployeesListScreen.js   # Liste + recherche + suppression
│   │       ├── RegisterEmployeeScreen.js# Créer un employé (ID auto-généré, nom, service, photo)
│   │       ├── EditEmployeeScreen.js    # Modifier / supprimer un employé
│   │       ├── AttendanceScreen.js      # Historique des présences
│   │       └── ScanAlertsScreen.js      # Signalements après échecs de reconnaissance répétés
│   └── navigation/AdminTabNavigator.js
│
├── functions/                       # Cloud Functions (Node 20, firebase-functions v2)
│   ├── index.js                     # bootstrapAdmin, registerEmployee, updateEmployee,
│   │                                 # deleteEmployee, identifyEmployee, reportScanFailure
│   ├── src/faceEngine.js            # Chargement des modèles + extraction du vecteur + cosinus
│   ├── src/auth.js                  # Vérification du jeton admin
│   ├── scripts/download-models.js   # Télécharge les poids face-api.js (auto via npm install)
│   └── models/                      # Poids des modèles (générés, non versionnés)
│
├── firebase.json
├── firestore.rules
└── firestore.indexes.json
```

## 2. Créer le projet Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → **Ajouter un projet**.
2. **Build > Authentication** → activer le fournisseur **E-mail/Mot de passe**.
3. **Build > Firestore Database** → créer une base (mode production).
4. **Paramètres du projet > Vos applications** → ajouter une app Web, copier la config
   dans [`src/config/env.js`](src/config/env.js) (`apiKey`, `authDomain`, `projectId`, etc.)
5. Remplacer `FUNCTIONS_BASE_URL` dans le même fichier par
   `https://us-central1-<VOTRE_PROJECT_ID>.cloudfunctions.net`.
6. `npm install -g firebase-tools` puis `firebase login`.
7. À la racine du projet : `firebase use --add` et sélectionner votre projet
   (ou éditer directement `.firebaserc`).

### Créer le premier compte administrateur

Un admin est un utilisateur Firebase Auth **dont l'UID existe comme document dans
la collection `admins`** (cf. `firestore.rules`). Les écritures directes sur cette
collection sont interdites côté client (`allow write: if false`) — seule la Cloud
Function `bootstrapAdmin` (Admin SDK) peut y écrire.

**Option A — depuis l'app (recommandé) :** sur l'écran de connexion admin, le lien
« Aucun administrateur ? Créer le premier compte » ouvre `AdminSignupScreen`, qui
crée le compte Firebase Auth puis appelle `bootstrapAdmin`. Cette fonction n'accorde
les droits admin **que si la collection `admins` est encore vide** (le tout premier
compte) ; toute tentative suivante est rejetée et le compte Auth orphelin est
supprimé. Pour ajouter d'autres admins ensuite, utilisez l'option B.

**Option B — manuellement (pour les admins suivants) :**

1. **Authentication > Users > Add user** : créez le compte e-mail/mot de passe de l'admin.
2. Copiez son UID.
3. **Firestore Database > Start collection** `admins` → créez un document dont
   **l'ID du document est cet UID** (le contenu peut être vide ou `{ email: "..." }`).

## 3. Backend — Cloud Functions

```bash
cd functions
npm install        # installe les dépendances ET télécharge les modèles face-api.js
                    # (postinstall → functions/scripts/download-models.js)
```

Si votre réseau bloque le téléchargement automatique (proxy, pare-feu CI), lancez-le
manuellement plus tard avec `npm run download-models`, ou téléchargez à la main les
fichiers de `ssd_mobilenetv1`, `face_landmark_68` et `face_recognition` depuis
[justadudewhohacks/face-api.js-models](https://github.com/justadudewhohacks/face-api.js-models)
et placez-les (à plat, sans sous-dossier) dans `functions/models/`.

Déployer :

```bash
firebase deploy --only functions,firestore:rules,firestore:indexes
```

Émulateurs locaux (utile pour tester sans déployer) :

```bash
firebase emulators:start --only functions,firestore,auth
```
Avec les émulateurs, pointez `FUNCTIONS_BASE_URL` (dans `src/config/env.js`) vers
`http://<IP_DE_VOTRE_MACHINE>:5001/<PROJECT_ID>/us-central1`.

### ⚠️ Calibrer le seuil de similarité (`FACE_MATCH_THRESHOLD`)

Le seuil est fixé à **0.85** dans `functions/index.js` comme demandé, mais en test
réel sur les images d'exemple de face-api.js, la similarité cosinus entre deux
photos **de la même personne** (expressions différentes) est descendue à ~0.79.
Le cosinus n'est pas la métrique officiellement recommandée par face-api.js (qui
utilise plutôt la distance euclidienne avec un seuil ~0.6) — 0.85 peut donc s'avérer
trop strict et rejeter des employés légitimes selon l'éclairage/l'angle. **Testez
avec vos propres photos d'enregistrement et de pointage avant mise en production**,
et ajustez la constante `FACE_MATCH_THRESHOLD` dans `functions/index.js` si les
employés se font rejeter à tort (baissez-la, ex. 0.75–0.80).

## 4. App mobile

```bash
npm install
npx expo start
```

- Écran principal (`ScanScreen`) : public, caméra éteinte par défaut. L'employé
  appuie sur *Scanner mon visage*, se centre dans le carré — aucun identifiant à
  saisir. Le visage est comparé (1:N) à tous les employés enregistrés ; le système
  détermine automatiquement s'il s'agit d'une entrée ou d'une sortie.
  - Succès : message de remerciement, retour automatique à l'accueil.
  - Échec : le message reste affiché avec *Réessayer* / *Annuler* (pas de nouvel
    essai automatique). Tous les 3 échecs consécutifs, un signalement est envoyé
    à l'admin (`reportScanFailure` → collection `scanAlerts`).
- Icône en haut à droite → connexion admin (`AdminLoginScreen`).
- Espace admin (onglets) : Tableau de bord, Employés (création avec bascule caméra
  avant/arrière, édition, suppression), Présences (historique groupé par jour),
  Alertes (signalements d'échecs de reconnaissance répétés).

## 5. Déploiement web (Netlify)

L'app peut aussi tourner en web (via `react-native-web`) et être hébergée sur
Netlify. Config dans [`netlify.toml`](netlify.toml) :

```toml
[build]
  command = "npm install && npx expo export --platform web"
  publish = "dist"
```

Le repo GitHub étant relié à Netlify, chaque push sur `main` redéploie
automatiquement. Comme `src/config/env.js` contient déjà la config Firebase du
projet (les clés Firebase client ne sont pas secrètes, elles sont protégées par
`firestore.rules`), aucune variable d'environnement Netlify n'est nécessaire.

## 6. Sécurité

- `employees` (contient les `face_vector`), `attendance` et `scanAlerts` : lecture
  réservée aux admins via `firestore.rules` ; **aucune écriture client** n'est
  autorisée — seules les Cloud Functions (Admin SDK, contourne les règles) peuvent
  y écrire, ce qui empêche la falsification des pointages.
- `registerEmployee`, `updateEmployee`, `deleteEmployee` exigent un jeton Firebase Auth
  (`Authorization: Bearer <idToken>`) appartenant à un document `admins/{uid}`.
- `bootstrapAdmin` exige un jeton Firebase Auth valide mais pas encore admin ; elle
  n'accorde les droits que si `admins` est vide (premier compte uniquement).
- `identifyEmployee` et `reportScanFailure` sont volontairement publiques (borne de
  pointage) ; `identifyEmployee` ne renvoie jamais les `face_vector` stockés —
  seulement `success/action/name/employeeId/similarity`.
