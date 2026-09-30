# PWA et accès Android

## Livré

- Manifest avec affichage standalone, nom REV et icônes PNG 192/512, dont une maskable.
- Icônes générées localement par `scripts/pwa.mjs icons`.
- Service worker généré après Vite : cache versionné selon le contenu de l’ensemble du build, y compris les WAV.
- Installation du cache atomique : si une ressource échoue, le nouveau cache est supprimé et le worker ne s’active pas.
- Navigation et ressources connues servies depuis le cache. Aucun appel externe ajouté.
- Pas de remplacement forcé du worker : une nouvelle version attend que toutes les fenêtres de l’ancienne version soient fermées.
- Panneau d’état et bouton d’installation lorsque le navigateur fournit l’invitation.

## Sur le PC

`npm run build` puis `npm run preview` : version compilée sur http://127.0.0.1:4173.

Le port 5173 reste consacré au développement : pas d’enregistrement de service worker depuis ce mode. Les deux ports ont des stockages locaux séparés, donc leurs réglages ne sont pas partagés.

## Sur Android — accès restant à configurer

127.0.0.1 sur le téléphone désigne le téléphone, pas le PC. Il faut une URL HTTPS avec un certificat reconnu sur Android pour un accès normal à la PWA depuis le réseau.

La version compilée est prête pour un hébergement statique à la racine d’un domaine HTTPS. Pour conserver le projet privé, l’accès doit être protégé ou limité à un réseau privé. Aucun hébergement, tunnel public, certificat de confiance ou règle de pare-feu n’a été créé à cette étape.

Une fois l’URL configurée : ouvrir dans Chrome Android, attendre le chargement de l’application et des sons, puis utiliser Installer REV si proposé ou le menu du navigateur. Installation et cache restent à tester sur le téléphone. Le navigateur peut évincer le stockage ; le premier chargement doit se faire connecté.

L’installation n’active pas le fonctionnement audio en arrière-plan. REV continue à couper le moteur lorsque la page est masquée.

Références :
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

Voir VALIDATION-FINALE.md pour les essais reportés.
