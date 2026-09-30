# Première intégration audio — MuscleCar02

## Origine et préparation

Source : https://github.com/ItsBrank/RocketLeague-Audio/tree/main/Motors/SFX_Motor_MuscleCar02

Quatre samples retenus sur les huit fichiers de la banque : 0002 (ralenti), 0001 (bas régime), 0003 (régime moyen), 0007 (haut régime). Ces affectations et les références 850 / 1700 / 3600 / 6500 RPM sont des hypothèses de calibration REV, pas les métadonnées originales de Rocket League. La sélection repose sur la stabilité des enveloppes et le contenu spectral. Le rendu perceptif reste à valider à l’écoute.

Conversion en WAV PCM16 mono 48 kHz pour éviter de dépendre du décodage OGG sur les appareils cibles. Retrait de la composante continue, raccord de boucle par recouvrement de 60 ms, normalisation RMS à 0.16, plafond crête à 0.85. Les fichiers, empreintes des sources et mesures sont consignés dans `public/audio/musclecar/provenance.json`.

Les sons proviennent d’une archive communautaire du jeu. La présence d’une licence dans ce dépôt ne prouve pas que son auteur possède les droits sur ces assets. Ils restent identifiés comme assets tiers du prototype privé ; aucune publication ni autorisation commerciale n’est revendiquée.

## Traitement temps réel

`DrivingState → EngineAudio → 4 sources en boucle → filtre passe-bas → volume → compresseur → analyseur → sortie système`.

- AudioProfile indépendant du profil mécanique : URLs et régimes de référence. Pas encore d’import de banque utilisateur.
- Fondu à puissance constante entre les deux couches adjacentes, position logarithmique selon les RPM.
- Playback rate = RPM / référence, borné entre 0.5 et 2. Les gains des couches hors plage sont nuls.
- Charge : gain de 30 à 100 % du niveau sélectionné et ouverture du filtre.
- Effets procéduraux sans fichier supplémentaire : coupure plus impact grave au changement de rapport, crépitements courts en décélération au-dessus de 1 800 RPM et impulsions synchronisées avec la coupure du rupteur. Leur niveau suit le volume général.
- Paramètres audio lissés sur 25–35 ms. Les sources tournent dans Web Audio ; React ne génère aucun échantillon audio.
- Volume initial 20 %. Aucun son à l’ouverture. Start crée/réactive AudioContext depuis le geste utilisateur et charge/décode les quatre fichiers une seule fois. Aucun fetch pendant la conduite simulée.
- Stop et Reset invalident aussi les chargements en cours et libèrent les sources après un fondu de 150 ms. Les buffers restent en mémoire pour le prochain départ.
- Onglet masqué : arrêt audio et moteur, reprise explicite avec Start. Pas de promesse d’audio en arrière-plan.
- Erreur de chargement/décodage : message visible et possibilité de réessayer.

## Validation

`npm test` couvre le moteur, les fondus entre couches, les fichiers PCM et le cycle de vie audio (avec un contexte simulé). Ce dernier test ne remplace pas un essai Web Audio réel.

Dans l’interface, « Diagnostic audio » expose le contexte, le nombre de buffers et de voix, le RMS du signal après volume/compresseur et la latence de base annoncée par le navigateur. Cette latence n’inclut pas toute la chaîne acoustique/Bluetooth.

Essai : Start à l’arrêt → pédale 60–100 % → écouter montées et passages → relâcher/freiner → Stop. Volume à zéro doit couper le signal sans arrêter le moteur. Reset doit tout arrêter. Masquer l’onglet exige un nouveau Start.

Sources API :
- https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/playbackRate
- https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loop

Les essais iOS, Android et Tesla/Bluetooth ainsi que la latence de bout en bout restent à faire. La restitution n’est pas celle du moteur Wwise original : REV utilise ses propres courbes de mélange et de charge.
