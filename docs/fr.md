# Abode

Pilotez votre système de sécurité [Abode](https://goabode.com) depuis Gladys
Assistant : armez et désarmez l’alarme, suivez les portes, fenêtres et
capteurs, commandez serrures, lumières, prises et portes de garage, prenez
des photos avec les caméras, et réagissez aux alarmes dans vos scènes.

## Prérequis

- Gladys Assistant 5.1 ou plus récent.
- Un compte Abode (Abode Iota, kit Abode Security / Gateway).
- **La double authentification désactivée sur le compte utilisé par
  Gladys.** L’intégration se connecte seule, sans personne pour saisir un
  code. Si votre compte principal utilise la double authentification,
  invitez un second utilisateur depuis l’application Abode (Compte →
  Utilisateurs) et donnez ses identifiants à Gladys.

Abode ne propose qu’une API **cloud** : Gladys dialogue avec
`my.goabode.com`, l’intégration a donc besoin d’Internet. Chaque appareil
affiche le badge **Cloud**.

## Configuration

1. Ouvrez l’onglet **Configuration** de l’intégration.
2. Saisissez l’**e-mail** et le **mot de passe** du compte Abode.
3. Modifiez si besoin l’**intervalle de rafraîchissement** (15 secondes par
   défaut, de 10 à 300) : la fréquence à laquelle Gladys lit le mode de
   l’alarme, les capteurs et les alarmes.
4. Enregistrez, puis cliquez sur **Tester la connexion** : le nombre
   d’appareils trouvés et le mode actuel de l’alarme s’affichent.
5. Ouvrez l’onglet **Découverte** et ajoutez les appareils voulus.

## Appareils

| Appareil Abode                      | Dans Gladys                                      |
| ----------------------------------- | ------------------------------------------------ |
| Centrale / gateway                  | Liste **Mode de l’alarme** : Standby, Home, Away |
| Contact de porte / fenêtre          | Capteur d’ouverture (fermé / ouvert)             |
| Détecteur de mouvement              | Détecteur de mouvement                           |
| Détecteur de fuite d’eau            | Capteur de fuite                                 |
| Détecteur de fumée / CO             | Capteur de fumée ou de monoxyde de carbone       |
| Multi-capteur                       | Température, humidité et luminosité              |
| Serrure                             | Serrure (verrouiller / déverrouiller)            |
| Interrupteur, prise connectée       | Interrupteur                                     |
| Variateur, ampoule                  | Lumière (marche / arrêt + intensité)             |
| Vanne d’eau                         | Interrupteur (vanne ouverte)                     |
| Porte de garage (secure barrier)    | Commande ouvrir / fermer + capteur d’ouverture   |
| Caméras                             | Caméra (photo à la demande)                      |
| Défauts de pile et d’autoprotection | Capteurs « pile faible » et « sabotage »         |

Un appareil ajouté dans l’application Abode apparaît dans l’onglet
Découverte au rafraîchissement suivant.

## Actions (écran de configuration)

- **Tester la connexion** — lit Abode immédiatement et affiche le résultat.
- **Lister les automatisations** — les noms de vos automatisations Abode, à
  utiliser dans l’action de scène « Lancer une automatisation Abode ».
- **Changer le mode de l’alarme** — armer ou désarmer depuis l’écran de
  configuration.

## Scènes

Déclencheurs :

- **Mode de l’alarme Abode changé** — l’alarme a été armée ou désarmée,
  depuis Gladys, un clavier, une télécommande ou l’application Abode.
  Filtrez sur le nouveau mode ; variables `{{triggerEvent.data.mode}}` et
  `{{triggerEvent.data.previous_mode}}` (`standby`, `home`, `away`).
- **Alarme Abode déclenchée** — Abode a déclenché une alarme. Filtrez sur
  le type (intrusion, incendie / fumée, monoxyde de carbone, fuite d’eau,
  panique, médicale, autre) et sur l’appareil ; variables `alarm_type`,
  `device_name` et `event_name`.
- **Défaut d’un appareil Abode** — un appareil signale une pile faible, un
  sabotage, un blocage ou une perte de liaison. Variables `fault` et
  `device_name`.

Actions :

- **Changer le mode de l’alarme Abode** — renvoie le mode confirmé par
  Abode.
- **Lancer une automatisation Abode** — par son nom (sans tenir compte des
  majuscules) ou son identifiant ; indique si elle a été trouvée et lancée.
- **Prendre une photo avec une caméra Abode** — à envoyer ensuite avec
  l’action « Envoyer une image de caméra ».

Exemple : _quand l’alarme se déclenche (intrusion), prendre une photo avec
la caméra du jardin, me l’envoyer et allumer toutes les lumières._

Les déclencheurs standards de Gladys fonctionnent aussi : « une porte
s’ouvre », « la température dépasse »…

## Tableau de bord

Trois widgets sont disponibles (Gladys 5.1 ou plus récent) :

- **Alarme Abode** — le mode de l’alarme, le nombre de portes et fenêtres
  ouvertes, les appareils en défaut, la dernière alarme, et les boutons
  **Armer total** / **Armer partiel** (avec confirmation). Le bouton
  **Désarmer** est masqué par défaut : activez _Afficher le bouton de
  désarmement_ dans les réglages du widget seulement si le tableau de bord
  n’est pas visible par des personnes qui ne doivent pas désarmer l’alarme.
- **Portes et fenêtres Abode** — l’état ouvert / fermé de chaque capteur
  d’ouverture, les ouverts en premier.
- **Historique Abode** — les derniers événements, alarmes en évidence.

La liste « Mode de l’alarme » de la centrale peut aussi être placée sur un
tableau de bord avec le widget appareil standard.

## Dépannage

- **« Connexion à Abode refusée »** — vérifiez l’e-mail et le mot de passe
  dans l’application Abode. Après un refus, l’intégration attend 30 minutes
  avant de réessayer (des échecs répétés peuvent bloquer le compte) ;
  enregistrer la configuration relance immédiatement.
- **« double authentification »** — utilisez un utilisateur Abode sans
  double authentification (voir Prérequis).
- **Cloud injoignable** — les appareils affichent le badge _Injoignable_
  jusqu’à la prochaine lecture réussie.
- Les photos de caméra plus grandes que ce qu’accepte Gladys (150 Ko) sont
  réduites automatiquement.

L’intégration journalise chaque requête (jamais le mot de passe ni les
jetons) : consultez les logs de l’intégration dans Gladys, avec
`LOG_LEVEL=debug` pour tout le détail.

Abode est une marque de son propriétaire ; cette intégration est un projet
communautaire, sans lien avec Abode Systems.
