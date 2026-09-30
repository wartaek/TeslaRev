# Feuille de route REV

## V1 — preuve de concept

La priorité reste la validation complète du moteur virtuel, des capteurs, de l’audio, de la PWA et de la sortie Bluetooth Tesla. Les fonctions ci-dessous ne commencent qu’une fois les contrôles V1 terminés.

## Après la V1 — lecteur musical connecté

Ajouter un lecteur multimédia capable de fonctionner avec le moteur virtuel et la sortie Bluetooth du véhicule.

Objectifs envisagés :

- connexion volontaire au fournisseur musical choisi par l’utilisateur ;
- sélection de quelques playlists utiles dans REV, notamment la playlist synchronisée par Shazam ;
- lecture, pause, morceau suivant et précédent depuis le mode conduite ;
- affichage réduit du titre, de l’artiste et de la pochette ;
- intégration avec les commandes multimédias Android via la Media Session API ;
- coexistence du volume musical et du moteur virtuel, avec réglages séparés ;
- poursuite de la musique lorsque l’interface REV est masquée uniquement si le fournisseur et le navigateur le permettent ;
- conservation sécurisée des autorisations, avec déconnexion du compte depuis REV.

L’exploration de toute la bibliothèque musicale, des favoris et de tous les albums n’est pas prioritaire : ces fonctions existent déjà dans les applications des fournisseurs.

Fournisseurs à étudier séparément : Spotify, Deezer, Apple Music et YouTube Music. Avant d’en choisir un, vérifier les abonnements requis, les SDK Web disponibles, les règles de lecture en arrière-plan, OAuth, les quotas et les conditions d’utilisation. Cette fonction introduira probablement un petit backend pour protéger les jetons et effectuer les échanges OAuth.

## Historique Shazam — objectif principal

L’objectif Shazam est d’abord de retrouver les morceaux déjà identifiés par l’utilisateur :

- afficher l’historique des morceaux Shazamés avec le titre, l’artiste, la pochette et la date lorsque ces données sont disponibles ;
- lancer le morceau ou l’ouvrir dans le fournisseur musical choisi ;
- utiliser en priorité la playlist « My Shazam Tracks » synchronisée par Shazam vers Spotify ou Apple Music ;
- éviter une dépendance à une API non disponible dans les navigateurs.

L’accès direct à la bibliothèque Shazam devra être réévalué si Apple fournit un jour une API Web ou Android adaptée. L’API `SHLibrary` actuelle appartient au framework natif ShazamKit d’Apple et n’est pas directement exploitable par la PWA Android.

## Plus tard — reconnaissance musicale dans REV

La reconnaissance directe d’un morceau depuis REV reste une option ultérieure :

- déclenchement manuel ;
- permission microphone demandée uniquement au moment de la reconnaissance ;
- identification du titre et de l’artiste ;
- ajout éventuel à l’historique REV et ouverture dans le fournisseur musical choisi ;
- aucun enregistrement permanent du microphone.

Cette fonction dépendra d’un service ou d’un SDK spécifique, de son coût, de ses plateformes compatibles et de ses conditions d’utilisation.

## Points à valider avant développement

- comportement du mix musique + moteur sur Bluetooth Tesla ;
- priorité audio, interruptions, appels téléphoniques et navigation GPS ;
- limites réelles de lecture en arrière-plan d’une PWA Android ;
- accès à la playlist Shazam synchronisée depuis le fournisseur retenu ;
- fournisseur disponible avec un coût nul ou acceptable ;
- sécurité OAuth et stockage des jetons ;
- ergonomie permettant de contrôler la musique sans surcharger le mode conduite.
