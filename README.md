# Freskis & La Gran Pantalla · GitHub Pages

Paquete completo listo para publicar en GitHub Pages.

## Contenido
- `index.html`
- `app.js`
- `styles.css`
- `game-placeholder.html`
- `assets/`
- `data/menu-data.js`
- `game/`

## Importante
El catálogo base ya quedó incluido en `data/menu-data.js` usando la hoja `tabla_web` del archivo `Menu-Web-Formato.xlsx`.

## Cómo publicar en GitHub Pages
1. Crea un repositorio nuevo en GitHub.
2. Sube **todos** los archivos y carpetas de este paquete.
3. En GitHub entra a **Settings > Pages**.
4. En **Source**, selecciona **Deploy from a branch**.
5. Elige la rama `main` y la carpeta raíz `/ (root)`.
6. Guarda los cambios.
7. Espera unos minutos y abre la URL pública de GitHub Pages.

## Panel administrativo
Contraseña:
`1A972df8$`

## Catálogo
El sitio carga el menú desde:
- `data/menu-data.js` para la vista pública inicial.
- También puedes reemplazar el catálogo desde el panel administrativo subiendo otro Excel.

## Juego
Para integrar el juego:
1. Sube el HTML del juego dentro de la carpeta `game/`.
2. En el panel administrativo define la ruta, por ejemplo:
   `game/index.html`

## Nota técnica
Este sitio funciona de forma estática en GitHub Pages.
Los cambios realizados desde el panel administrativo se guardan en el navegador mediante LocalStorage.
