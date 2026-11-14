# Table Nutritionnelle CIQUAL 2025 (Format Compact)

Ce dossier contient la version compacte de la table de composition nutritionnelle des aliments **Ciqual 2025** publiée par l'Anses (Agence nationale de sécurité sanitaire de l'alimentation, de l'environnement et du travail), optimisée pour une intégration directe et performante dans WorkoutVision.

---

## 1. Métadonnées Officielles de la Source

* **Producteur :** Anses — Unité Observatoire des Aliments (Laure Du Chaffaut, Marine Oseredczuk, Julie Gauvreau-Béziat).
* **Édition :** Table Ciqual 2025 (version du 3 novembre 2025, publiée le 19 novembre 2025).
* **Identifiant persistant (DOI) :** `doi:10.57745/RDMHWY`
* **Entrepôt institutionnel :** [Recherche Data Gouv](https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi:10.57745/RDMHWY)
* **Licence :** **Licence Ouverte / Open Licence version 2.0 (Etalab)**
  * *« La réutilisation de ces données est libre et gratuite sous réserve de mentionner la paternité de l'Anses / Ciqual. »*
  * URL légale : `https://spdx.org/licenses/etalab-2.0.html`
* **Date de téléchargement :** 14 octobre 2026.

---

## 2. Empreintes Cryptographiques des Fichiers Sources

| Fichier source officiel | Identifiant Datafile | Taille (octets) | Empreinte SHA-256 |
| :--- | :--- | :--- | :--- |
| `Table Ciqual 2025_FR_2025_11_03.xlsx` | 666260 | 1 541 998 | `5555c572fa3735991298d832d0427788fa69a11b4fd20a5d580d58942369fbb0` |
| `alim_2025_11_03.xml` | 666252 | 1 581 031 | `e0b1de25b3039028205e9d54a96892e403e1b313c2efeb41180fabe132627478` |

---

## 3. Structure de `ciqual-compact.json`

Le fichier `ciqual-compact.json` comprend **3 484 aliments** (100 % des aliments de la table Ciqual 2025). Chaque entrée respecte la spécification stricte de WorkoutVision :

```json
{
  "code": "25609",
  "name_fr": "Salade de pomme de terre à la piémontaise, préemballée",
  "name_en": "Potato salad, piémontaise-style, prepacked",
  "group": "entrées et plats composés",
  "energy_kcal": 130.0,
  "protein_g": 4.5,
  "carbohydrate_g": 8.87,
  "fat_g": 8.3,
  "fibre_g": null,
  "raw": {
    "energy_kcal": "130",
    "protein_g": "4,5",
    "carbohydrate_g": "8,87",
    "fat_g": "8,3",
    "fibre_g": "< 0,5"
  }
}
```

### Règles de conversion appliquées :
1. **Intégrité des données officielles :** Les valeurs numériques sont converties fidèlement en flottants sans arrondi artificiel.
2. **Absence ou seuil de détection :** Dès lors qu'une teneur dans la table source indique une absence de valeur, un tiret `-`, un marqueur `traces` ou un seuil d'incertitude `<` (ex. `< 0,5`), le champ numérique principal est fixé à `null`.
3. **Traçabilité totale :** L'objet `raw` consigne systématiquement la chaîne de caractères brute textuelle issue de la table Anses.

---

## 4. Script de Conversion

Le script de conversion officiel et autonome est situé dans ce dossier :
`data/nutrition/convert.py`

Pour reproduire la génération ou vérifier l'intégrité du fichier :
```bash
python3 data/nutrition/convert.py
```
Le script vérifie automatiquement les sommes de contrôle SHA-256 avant tout traitement.
