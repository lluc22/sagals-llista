# TODO

## 1. Admin — sobrenom (nom i cognoms)
- [x] A la vista d'admin (EventAdmin / llista de participants), mostrar el nom en format "Sobrenom (Nom Cognoms)" igual que a la llista de marcatge, usant la integració amb Tenimaleta.

## 2. Llista de participació — millores generals
- [x] Seccionar per combinació de busos: "Bus 1 anada · Bus 1 tornada", "Bus 1 anada · Bus 2 tornada", etc.
- [x] Cerca de participant dins la llista.
- [x] Seccions truncades per defecte (scroll intern limitat) per evitar haver de baixar molt quan hi ha molts participants.
- [x] Permetre editar els busos d'un participant des de la llista (no sols l'assistència).
- [x] Revisar i corregir el format del nom — "nom i cognom és raro" (probablement mostrant el camp `name` directament en comptes de construir "Sobrenom (Nom Cognoms)").

## 3. Acompanyants no registrats a Tenimaleta
- [ ] Permetre afegir acompanyants que no estan al registre de Sagals (persones externes).
- [x] Definir model de dades (nom lliure, associat a un participant o independent).
- [x] Mostrar-los a la llista de marcatge.

## 4. Participants amb observacions o acompanyants
- [x] Afegir columna/indicador al mapping d'importació Excel per als camps "observacions" i "acompanyants".
- [x] Mostrar-los a la llista de participació.

## 5. Selectors del mapping — estil
- [x] Els selectors (dropdowns) del pas de mapping de l'Excel es veuen massa llargs.
- [x] Ajustar amplada i estil per que quedin compactes i llegibles.

## 6. Look & feel Sagals
- [x] Aplicar el color corporatiu taronja dels Sagals d'Osona: `#E0763A` (rgb 224, 118, 58).
- [x] Revisar botons, capçaleres, accents i elements destacats.
- [x] Mantenir coherència visual a totes les pantalles (admin, llista, login).

## 7. Títol a la llista
- [x] Mostrar "Passar llista — Sagals d'Osona" com a títol a la pàgina de marcatge d'assistència.
