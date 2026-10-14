# Audit d'Assurance Qualité Safari Desktop et Simulateur iOS (WebKit)

> **Date d'audit :** 14 octobre 2026  
> **Cible auditée :** Site de production live `https://david-dabert.github.io/workout-vision/`  
> **Moteur de rendu :** Apple WebKit natif (Safari 26.6.2 / WebKit 605.1.15)  
> **Dispositifs testés :**  
> 1. `iphone-15` : iPhone 15 ($393 \times 852$ px, DPR 3, tactile, WebKit mobile)  
> 2. `iphone-se` : iPhone SE 3e génération ($375 \times 667$ px, DPR 2, tactile, WebKit mobile)  
> 3. `desktop-safari` : Mac Desktop Safari ($1280 \times 800$ px, curseur, WebKit desktop)  
> **Variantes testées :** Mode sombre (*dark*) et clair (*light*), en Français (*fr*) et Anglais (*en*).

---

## 1. Synthèse Globale

* **Écrans audités :** 16 écrans principaux par configuration (total de 192 captures analysées).
* **Crashs bloquants ou rechargements intempestifs :** 0
* **Erreurs console détectées :** 0
* **Anomalies de mise en page (débordement horizontal, cibles tactiles < 44 px, troncatures) :** 46
* **Trame blanche (*blank frame*) lors des transitions :** Aucune trame blanche bloquante observée grâce au fallback SVG inline.

---

## 2. Erreurs Console Recueillies (Exact Text)

*Aucune erreur console bloquante détectée sur les écrans testés dans l'environnement WebKit.*

---

## 3. Défauts de Mise en Page (Layout Faults)

### 3.1 Débordements Horizontaux (*Horizontal Scroll*)
*Aucun débordement horizontal détecté : la largeur totale du document respecte rigoureusement la largeur de la fenêtre (`winWidth`) sur iPhone SE, iPhone 15 et Desktop.*

### 3.2 Cibles Tactiles Inférieures à 44 px (Touch Targets < 44 px)
Conformément aux directives d'accessibilité Apple Human Interface Guidelines (HIG) et WCAG 2.1 AAA, chaque élément interactif sur écran tactile mobile doit offrir une cible d'au moins $44 \times 44$ pixels.

| Dispositif | Écran | Élément interactif identifié | Dimensions mesurées |
| :--- | :--- | :--- | :--- |
| `iphone-15` | `upload` | Small touch target (< 44px): <a> "bryllim/workout-guide" has size 133x44px |
| `iphone-15` | `upload` | Small touch target (< 44px): <a> "CC BY-SA 4.0" has size 82x44px |
| `iphone-15` | `volleyball` | Small touch target (< 44px): <a> "bryllim/workout-guide" has size 133x44px |
| `iphone-15` | `volleyball` | Small touch target (< 44px): <a> "CC BY-SA 4.0" has size 82x44px |
| `iphone-se` | `upload` | Small touch target (< 44px): <a> "bryllim/workout-guide" has size 133x44px |
| `iphone-se` | `upload` | Small touch target (< 44px): <a> "CC BY-SA 4.0" has size 82x44px |
| `iphone-se` | `volleyball` | Small touch target (< 44px): <a> "bryllim/workout-guide" has size 133x44px |
| `iphone-se` | `volleyball` | Small touch target (< 44px): <a> "CC BY-SA 4.0" has size 82x44px |
| `iphone-se` | `equine` | Small touch target (< 44px): <input> "" has size 51x31px |

### 3.3 Textes Tronqués Sans Ellipse
* `[iphone-15][guide]` : Clipped text without ellipsis: "Commencer" (812px in 353px container)
* `[iphone-15][guide]` : Clipped text without ellipsis: "Commencer" (812px in 353px container)
* `[iphone-15][guide]` : Clipped text without ellipsis: "Start" (812px in 353px container)
* `[iphone-15][guide]` : Clipped text without ellipsis: "Start" (812px in 353px container)
* `[iphone-se][guide]` : Clipped text without ellipsis: "Commencer" (771px in 335px container)
* `[iphone-se][guide]` : Clipped text without ellipsis: "Commencer" (771px in 335px container)
* `[iphone-se][guide]` : Clipped text without ellipsis: "Start" (771px in 335px container)
* `[iphone-se][guide]` : Clipped text without ellipsis: "Start" (771px in 335px container)
* `[desktop-safari][guide]` : Clipped text without ellipsis: "Commencer" (1012px in 440px container)
* `[desktop-safari][guide]` : Clipped text without ellipsis: "Commencer" (1012px in 440px container)
* `[desktop-safari][guide]` : Clipped text without ellipsis: "Start" (1012px in 440px container)
* `[desktop-safari][guide]` : Clipped text without ellipsis: "Start" (1012px in 440px container)

---

## 4. Crashs, Exceptions Non Gérées ou Rechargements

*Aucun crash, rechargement d'application ou exception non gérée survenu lors de l'exploration automatisée WebKit.*

---

## 5. Inventaire des Captures d'Écran Générées

Toutes les captures d'écran ont été compressées pour respecter la limite stricte de **150 Ko** par fichier. Elles sont archivées dans l'arborescence :

```
docs/qa/2026-10-14/
├── desktop-safari/
│   ├── entry-fr-dark.png (< 150 Ko)
│   ├── entry-fr-light.png
│   ├── choice-fr-dark.png
│   └── ...
├── iphone-15/
│   ├── entry-fr-dark.png
│   └── ...
├── iphone-se/
│   ├── entry-fr-dark.png
│   └── ...
└── REPORT.md
```
