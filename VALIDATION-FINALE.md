# Validation finale REV — à exécuter

Les vérifications ci-dessous sont différées à la demande de l’utilisateur. Leur présence dans cette liste ne signifie pas qu’elles ont réussi.

- Exécuter `npm test` puis `npm run build`.
- Ouvrir la version compilée (`npm run preview`, port 4173), attendre le statut application et sons prêts hors ligne.
- Vérifier installation, icône, lancement autonome et layout sur Android/Chrome via une véritable URL HTTPS.
- Charger une première fois, couper le réseau, recharger puis jouer les quatre scénarios avec audio.
- Vérifier le premier démarrage hors ligne sans cache : ne pas présenter l’application comme prête.
- Vérifier échec de téléchargement d’un son, cache refusé/effacé et récupération après reconnexion.
- Installer une nouvelle version : session audio courante intacte ; fermer toutes les fenêtres REV, rouvrir et vérifier la nouvelle version et le nettoyage des anciens caches.
- Vérifier Start/Stop, annulation du chargement, volume nul, changement de banque à l’arrêt et absence de voix audio résiduelles.
- Vérifier restauration du volume/son/boîte et démarrage silencieux après rechargement.
- Comparer les quatre scénarios en Calme et Sport ; vérifier fin automatique, interruption et relecture depuis zéro.
- Vérifier onglet masqué, verrouillage écran et interruption audio : pas de reprise sonore surprise.
- Valider le timbre à l’écoute et mesurer le délai perçu avec la sortie Bluetooth Tesla.
- Écouter les impacts de passage, les crépitements de décélération et le rupteur à plusieurs volumes ; vérifier leur équilibre et l’absence de son résiduel après Stop.
- Sur Android : tester les six orientations proposées, permissions mouvement accordées/refusées, calibration immobile et refus si mouvement, rotation après calibration, GPS absent/imprécis/périmé, arrêt du véhicule et pertes temporaires.

État de cette étape : 23 tests automatisés et compilation PWA réussis ; installation Android, cache hors ligne, cycle de mise à jour et restitution Bluetooth Tesla non testés.
