# Android : mode GPS et déploiement HTTPS

## Mode réel GPS (implémenté, essai terrain différé)

Choisir GPS réel à l’arrêt, activer la localisation, attendre une vitesse valide puis démarrer. Le même VirtualEngine reçoit les entrées GPS ou simulées. Les contrôles de simulation sont désactivés en mode réel.

La vitesse native `coords.speed` est utilisée lorsqu’elle existe. Sinon, REV calcule la distance entre deux positions espacées de 0,3 à 5 secondes. Une marge liée à la précision GPS est retirée avant le calcul afin que la dérive d’une position immobile ne simule pas un déplacement. Les positions vieilles de plus de 5 s ou de précision horizontale supérieure à 50 m sont rejetées. L’interface indique si la vitesse est native ou calculée ; les coordonnées intermédiaires restent uniquement en mémoire.

L’accélération vient de la différence de deux vitesses GPS espacées de 0.1 à 3 s, bornée entre −8 et +5 m/s². Lissage : vitesse 250 ms, accélération 150 ms. Après 2 s sans mesure valide, l’inertiel est suspendu, l’accélération revient vers zéro et le mode dégradé est affiché. Après 5 s, le moteur et l’audio effectuent leur fondu d’arrêt avec le statut « signal perdu ». Stop, Reset, changement de source et onglet masqué libèrent la surveillance GPS. Au retour au premier plan, la surveillance GPS redémarre mais le moteur et l’audio exigent un appui volontaire sur Démarrer. Les callbacks anciens sont ignorés.

Aucune coordonnée ni mesure de mouvement n’est conservée ou envoyée au serveur par REV. Une fois le GPS valide, fixer le téléphone, choisir dans REV le côté dirigé vers l’avant puis lancer la calibration à l’arrêt pendant deux secondes. REV combine ensuite 80 % d’accéléromètre et 20 % de correction GPS ; il revient automatiquement au GPS si les mesures de mouvement sont interrompues.

Une rotation du téléphone annule la calibration. Le capteur utilise uniquement l’accélération sans gravité afin qu’une inclinaison du téléphone ne soit pas interprétée comme un appui sur l’accélérateur.

Le mode conduite masque la configuration, agrandit les informations principales et demande à Android de maintenir l’écran allumé avec la Screen Wake Lock API. Si cette API est absente ou refusée, REV l’indique sans empêcher le moteur de fonctionner. La configuration des capteurs doit être terminée avant d’activer ce mode.

## Déploiement Vercel séparé

Le dossier courant contient `vercel.json` : framework Vite, build `npm run build`, sortie `dist`. Créer un nouveau projet REV, sans réutiliser le projet du site existant. Aucun déploiement n’a encore été effectué.

Avant tout accès partagé, configurer et vérifier Deployment Protection / Vercel Authentication sur les URLs utilisées. L’accès privé ne découle pas de HTTPS ni d’une URL difficile à deviner. Si la protection de production n’est pas disponible dans le compte, utiliser une URL de preview protégée ou choisir une autre protection avant publication.

Une fois le déploiement protégé accessible : se connecter avec son compte Vercel dans Chrome Android, ouvrir REV, attendre le statut hors ligne, puis installer via le menu Chrome. La coexistence de l’authentification Vercel, du service worker et du cache audio doit être validée. Le cache reste local au téléphone ; retirer un accès serveur n’efface pas les données déjà mises en cache.

Après premier chargement réussi, le fonctionnement hors ligne de l’application et des sons est prévu. GPS et disponibilité des capteurs restent dépendants du téléphone. Le PC n’est pas nécessaire pour servir une version hébergée sur Vercel.

Documentation :
- https://vercel.com/docs/frameworks/frontend/vite
- https://vercel.com/docs/deployment-protection
- https://developer.mozilla.org/en-US/docs/Web/API/Geolocation
