# Feuille de route REV

## V1 — preuve de concept

La priorité reste la validation complète du moteur virtuel, des capteurs, de l’audio, de la PWA et de la sortie Bluetooth Tesla. Les fonctions ci-dessous ne commencent qu’une fois les contrôles V1 terminés.

## Après la V1 — lecteur musical connecté

Ajouter un lecteur multimédia capable de fonctionner avec le moteur virtuel et la sortie Bluetooth du véhicule.

Objectifs envisagés :

- connexion volontaire du compte musical de l’utilisateur ;
- accès à sa bibliothèque, ses favoris et ses playlists lorsque l’API du fournisseur l’autorise ;
- lecture, pause, morceau suivant et précédent depuis le mode conduite ;
- affichage réduit du titre, de l’artiste et de la pochette ;
- intégration avec les commandes multimédias Android via la Media Session API ;
- coexistence du volume musical et du moteur virtuel, avec réglages séparés ;
- poursuite de la musique lorsque l’interface REV est masquée uniquement si le fournisseur et le navigateur le permettent ;
- conservation sécurisée des autorisations, avec déconnexion du compte depuis REV.

Fournisseurs à étudier séparément : Spotify, Deezer, Apple Music et YouTube Music. Avant d’en choisir un, vérifier les abonnements requis, les SDK Web disponibles, les règles de lecture en arrière-plan, OAuth, les quotas et les conditions d’utilisation. Cette fonction introduira probablement un petit backend pour protéger les jetons et effectuer les échanges OAuth.

## Après le lecteur — reconnaissance musicale

Étudier une fonction de reconnaissance de morceau inspirée de Shazam :

- déclenchement manuel depuis REV ;
- permission microphone demandée uniquement au moment de la reconnaissance ;
- identification du titre et de l’artiste ;
- ouverture du résultat dans le fournisseur musical choisi ;
- aucun enregistrement permanent du microphone.

La reconnaissance ne fait pas partie du lecteur : elle dépendra d’un service ou d’un SDK spécifique, de ses coûts, de ses plateformes compatibles et de ses conditions d’utilisation.

## Points à valider avant développement

- comportement du mix musique + moteur sur Bluetooth Tesla ;
- priorité audio, interruptions, appels téléphoniques et navigation GPS ;
- limites réelles de lecture en arrière-plan d’une PWA Android ;
- fournisseur disponible avec un coût nul ou acceptable ;
- sécurité OAuth et stockage des jetons ;
- ergonomie permettant de contrôler la musique sans surcharger le mode conduite.
