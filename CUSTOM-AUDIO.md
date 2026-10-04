# Banque personnelle — V1

Dans **Réglages → Mon moteur · import local**, importer jusqu’à quatre fichiers audio décodables par le navigateur (MP3/WAV recommandés). Une même prise peut fournir plusieurs paliers avec « Ajouter un palier de ce fichier ».

Pour chaque palier, saisir le régime moteur réel de la prise et un extrait stable de 0,5 à 12 secondes. Préécouter la boucle préparée avec le lecteur. Les fichiers sont limités à 30 Mo et 180 secondes chacun. Les RPM doivent être distincts, entre 600 et 15 000 ; les paliers sont triés avant de créer le profil.

« Préparer et utiliser ce moteur » sauvegarde une banque personnelle dans IndexedDB et la sélectionne. Elle remplace la banque personnelle précédente. Au prochain lancement, les fichiers sont restaurés et le dernier profil choisi est conservé. Ils ne sont pas envoyés sur GitHub, Vercel ou un service externe. La banque fonctionne hors ligne une fois la PWA disponible en cache. Effacer les données du site efface la banque ; elle n’est pas synchronisée entre appareils.

Traitement : décodage Web Audio, extraction, mono, retrait de composante continue, raccord de boucle avec recouvrement de 60 ms, normalisation RMS cible 0,16 avec plafond de crête 0,84, WAV PCM16 à la fréquence du décodage. Les bruits de fond, variations de régime et passages enregistrés restent présents : pas de séparation IA ni de détection automatique des RPM. La préécoute est à hauteur native ; la simulation applique les courbes de régime/charge et le filtre habitacle.

Préférer des enregistrements depuis l’habitacle, avec plusieurs régimes stables et une perspective constante. Les effets procéduraux de REV restent actifs : éviter des extraits contenant déjà des passages de rapports ou des pétarades. Les sons générés par IA peuvent être importés par le même chemin. Une seule boucle reste expérimentale lorsque la hauteur est fortement modifiée.

## Vérification utilisateur restante

- [ ] Importer une vraie prise d’habitacle sur Android et vérifier les formats.
- [ ] Préécouter les raccords et comparer les paliers dans le simulateur.
- [ ] Fermer/réouvrir REV et vérifier la banque personnelle sélectionnée.
- [ ] Relancer hors ligne après sauvegarde et préparation du cache PWA.
- [ ] Valider le rendu et les transitions dans la Tesla.
