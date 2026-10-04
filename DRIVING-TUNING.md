# Réglage conduite — octobre 2026

- Lancement sur l’écran conduite. La source par défaut est GPS réel ; une sélection explicite de simulation reste mémorisée.
- Une permission GPS déjà accordée est réutilisée à l’ouverture via Permissions API. Si elle n’est pas accordée, Démarrer ou le bouton GPS lance la demande du navigateur. REV ne peut pas conserver une autorisation que le navigateur révoque.
- Stop, Reset et changement de son conservent le GPS. Masquage de l’application : arrêt des capteurs/audio ; retour visible : nouvelles mesures GPS, reprise audio explicite.
- La première vitesse GPS valide initialise directement la vitesse filtrée : démarrer à 70 km/h ne simule pas une montée depuis 0.
- Boîte Calme : seuils de base 15 / 30 / 50 / 75 / 105 km/h pour les cinq montées, multipliés par `1 + 0.65 × charge`. À faible accélération, seconde vers 15–20 km/h. Sport multiplie ces seuils par 1.4. Ce sont des choix de rendu, pas une boîte réelle de Tesla.
- Au démarrage en mouvement, choix du rapport correspondant à la vitesse de croisière. Rétrogradages avec hystérésis à 72 % des seuils de croisière, kickdown sous forte charge avec protection contre le surrégime, temporisations conservées.
- GPS réel sans plafond logiciel à 130 km/h ; simulateur étendu à 250 km/h. Le régime reste protégé par sa limite réglable.
- Rendu habitacle : atténuation des aigus sur moteur et effets, filtre entre environ 900 et 3800 Hz selon charge/régime. Niveau de base plus présent à faible charge, variation de volume moins extrême. Ce filtrage ne retire pas le Doppler ou l’ambiance déjà enregistrés dans les sources extérieures.

## Reste à valider sur Android / Tesla

- [ ] GPS déjà autorisé au lancement autonome et conservé entre Stop et changement de banque.
- [ ] Passage 1 → 2 en accélération douce, rapports en croisière et rétrogradage au freinage.
- [ ] Équilibre habitacle à charge faible / forte, pour chaque banque.
- [ ] Latence de bout en bout et calibration accéléromètre sur le support réel.
