# REV — Virtual Engine Lab

Moteur virtuel V8 indépendant de React, simulation, scénarios, GPS et accéléromètre expérimentaux, et moteur Web Audio avec deux banques de quatre boucles, turbo et wastegate. Manifest et cache PWA dans la version compilée. Voir [AUDIO.md](AUDIO.md), [PWA.md](PWA.md), [ANDROID.md](ANDROID.md), [VALIDATION-FINALE.md](VALIDATION-FINALE.md) et la [feuille de route post-V1](ROADMAP.md). Aucun backend ni dépendance Tesla dans la V1.

## Lancer

Node.js 22.12+ (ou 20.19+). Sous Windows utiliser `npm.cmd` si PowerShell bloque `npm.ps1`.

```sh
npm install
npm run dev
npm test
npm run build
```

## Architecture

- `src/engine/virtualEngine.ts` : contrat DrivingInput, EngineProfile V8, calcul du régime, charge, boîte et états. Aucun import navigateur ou React.
- `src/simulation/drivingSimulator.ts` : mouvement synthétique, même DrivingInput que les futurs capteurs.
- `src/audio/` : profil sonore, mixage et cycle de vie Web Audio, indépendants de React.
- `src/main.tsx` : commandes, compte-tours, historique et journal des changements.

## Contrat et calculs retenus

Entrée : `speedKmh` positive et `acceleration` longitudinale signée en m/s², déjà filtrées par la source. Pas de pédale réelle transmise au moteur. Le throttle estimé ne représente pas une mesure de la pédale : pente, freinage et relâchement sont ambigus sans télémétrie véhicule.

Sortie : vitesse, accélération, RPM, rapport 1–6, throttle estimé, charge, mouvement, état, nombre de changements et temps de simulation en secondes. Start remet ce temps et le compteur à zéro. Stop coupe le moteur mais laisse le véhicule simulé évoluer. Réinitialiser remet tout à zéro.

Profil V8 : ralenti 850 RPM, maximum réglable de 5 500 à 7 500 RPM (6 500 par défaut), rapports `[4.1, 2.67, 1.88, 1.43, 1.16, 0.96]`, pont 3.7, circonférence de roue virtuelle 2.1 m. Ce sont des paramètres perceptifs de départ, pas les caractéristiques d’une Tesla.

`RPM roues = (vitesse / 3.6 / circonférence) × 60 × rapport × pont`.

Le régime cible est le maximum du régime roues et du ralenti de lancement : `850 + 1000 × throttle × clamp(1 − vitesse/15, 0, 1)`. Cette approximation d’embrayage disparaît à 15 km/h. Le régime est limité à 6500 ; le lissage exponentiel utilise une constante de temps de 100 ms, ou 55 ms pendant un changement.

Throttle cible : `clamp(0.15 + accélération/3, 0, 1)`. Cible nulle en décélération sous −0.3 m/s², ou sous 1.5 km/h sans accélération positive. Lissage exponentiel : 80 ms à la montée, 180 ms à la descente. Charge = throttle, réduite à 15 % pendant un changement. En mode réel, la couche capteurs fusionne l’accéléromètre avec la correction GPS avant d’alimenter le moteur.

Montée : RPM roues au-dessus de `maxRpm × (0.4 + 0.5 × throttle)` pendant 150 ms, avec au moins 1200 RPM dans le rapport suivant. Un changement dure 220 ms ; délai supplémentaire de 800 ms avant le suivant. Protection au régime maximal prioritaire sur ce délai après le changement en cours.

Rétrogradage : sous 1300 RPM pendant 300 ms, un rapport à la fois, régime obtenu inférieur à 90 % du maximum. Kickdown : throttle > 0.8 et RPM roues < 55 % du maximum pendant 150 ms ; recherche du plus petit rapport parmi les deux précédents donnant 55–85 % du maximum. Si aucun ne convient, conserver le rapport.

À l’arrêt : vitesse sous 1.5 km/h pendant 1 s → première ; retour progressif à 850 RPM. Le statut mouvement s’active au-dessus de 3 km/h. Start en roulant sélectionne le premier rapport donnant au plus 3000 RPM, ou la sixième si aucun n’y parvient. Au-delà de la plage représentable : régime plafonné et état rupteur, sans son.

## Boucle et simulation

Pas fixe de 20 ms (50 Hz), UI 20 Hz. Les calculs utilisent le temps simulé fourni, jamais l’horloge du navigateur. L’interface suspend la simulation quand l’onglet est masqué, arrête le moteur et l’audio, et abandonne le rattrapage après un trou de 250 ms. La reprise audio nécessite Start. Ce comportement de laboratoire ne constitue pas une garantie de fonctionnement mobile en arrière-plan.

- Pédales : accélération = `3.5 × pédale − 7 × frein − résistance`, résistance en mouvement = `0.12 + 0.00004 × vitesse²`. Modèle volontairement simple.
- Vitesse cible : rejoint 0–130 km/h progressivement, accélération limitée entre −6 et +3.5 m/s².
- Accélération : impose directement −6 à +3.5 m/s².

La vitesse reste entre 0 et 130 km/h. L’accélération transmise est toujours calculée à partir du déplacement effectif, y compris aux limites. À 130 km/h, maintenir la pédale ne simule donc pas une accélération infinie : la charge estimée redescend.

## Essai manuel

### Trajets automatiques et préférences

Choisir Ville (50 s), Accélération franche (27 s), Croisière (50 s) ou Freinage (14 s), puis « Lancer le scénario ». La lecture démarre le moteur et l’audio depuis un geste utilisateur, remet l’historique et le moteur à zéro et suit une courbe de vitesse prédéfinie à pas fixe. Freinage démarre à 100 km/h ; les autres commencent à l’arrêt. Les quatre trajets finissent à l’arrêt, puis coupent le moteur et l’audio. Stop interrompt la lecture ; Rejouer repart toujours du début. Les commandes manuelles sont bloquées pendant la lecture. Masquer l’onglet interrompt le scénario, sans reprise automatique.

Choisir Calme ou Sport avant de démarrer. Calme conserve le seuil `maxRpm × (0.4 + 0.5 × throttle)` ; Sport utilise `maxRpm × (0.55 + 0.4 × throttle)` et prolonge les rapports. Les règles de rétrogradage et les protections restent communes. Le trajet est identique pour comparer les deux modes.

Volume, banque sonore, mode de boîte et régime maximal sont sauvegardés dans `localStorage` sous `rev.settings.v1`, puis restaurés au chargement, sans démarrer l’audio. Une donnée invalide est remplacée par sa valeur par défaut. Si le stockage est refusé, l’application reste utilisable et affiche que la sauvegarde est indisponible. « Réinitialiser l’essai » conserve les préférences.

### Commandes manuelles

1. Démarrer à zéro : 850 RPM, première.
2. Sélectionner Vitesse cible, demander successivement 20, 40, 70, puis 100 km/h. Observer les montées et chutes de régime, et le journal.
3. Stabiliser 70 km/h : absence d’oscillation des rapports.
4. Passer en Pédales et demander 100 % : charge rapide et kickdown si admissible.
5. Relâcher puis freiner : décélération, rétrogradages et retour au ralenti.
6. Arrêter : zéro RPM. Réinitialiser : retour complet à zéro.

Les tests automatisés couvrent ces règles, les limites et les entrées invalides, ainsi que le mixage et le cycle de vie audio. La crédibilité perceptive de cette première version sonore reste à valider par l’utilisateur. Latence acoustique, Bluetooth Tesla, capteurs et comportement iOS/Android restent non testés ; aucune décision de fonctionnement en arrière-plan ne repose sur leur disponibilité supposée.
