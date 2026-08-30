# Roots — vocabulario en red

Versión web real de la app (fuera del sandbox de artifacts de Claude), para
que las imágenes de Unsplash carguen de verdad — varias por palabra.

## Qué cambió respecto a la versión de chat

- **Imágenes**: ahora se buscan de verdad en Unsplash (varias por palabra,
  gratis, sin necesidad de pegar el link a mano — aunque esa opción sigue
  disponible).
- **Guardado**: usa `localStorage` del navegador en vez del storage interno
  de Claude — sigue siendo privado por persona/navegador.
- **IA (definiciones, conexiones, corrección de oraciones)**: en vez de
  llamar directo a la API de Claude desde el navegador (inseguro — expondría
  tu clave a cualquiera que abra la página), pasa por dos funciones
  "serverless" propias (`/api/claude.js` y `/api/pexels.js`) que guardan las
  claves en el servidor.

## 1. Conseguir las dos claves (ambas gratis)

- **Anthropic**: [console.anthropic.com](https://console.anthropic.com) →
  crear una API key. (Tiene costo por uso una vez agotado el crédito
  gratuito inicial — es la misma API que usa Claude.)
- **Unsplash**: [unsplash.com/oauth/applications](https://unsplash.com/oauth/applications)
  (o el flujo que ya empezaste) → creá una app, te dan una "Access Key" al
  instante en modo Demo. Es gratis, sin límite de tiempo, alcanza de sobra
  para uso personal.

## 2. Probarla en tu computadora

```bash
npm install
npm i -g vercel      # solo la primera vez
vercel dev           # levanta el sitio + las funciones /api juntos
```

Abrí la URL que te muestre la terminal (normalmente `http://localhost:3000`).
`vercel dev` te va a pedir pegar tus dos claves la primera vez (o podés
crear un archivo `.env` copiando `.env.example`).

## 3. Publicarla en internet (Vercel, gratis)

1. Subí esta carpeta a un repositorio de GitHub.
2. Entrá a [vercel.com](https://vercel.com), "Add New… → Project", elegí ese
   repositorio.
3. En "Environment Variables" pegá `ANTHROPIC_API_KEY` y `UNSPLASH_ACCESS_KEY`.
4. Deploy. Vercel te da una URL pública — esa es tu app, ya con imágenes
   reales funcionando para cualquiera que entre.

## Estructura

```
index.html          punto de entrada
src/App.jsx          toda la app (mapa, repaso estilo Anki, agregar palabras)
src/main.jsx          arranque de React
api/claude.js         función que le pasa tus preguntas a Claude sin exponer la clave
api/pexels.js         función que busca imágenes en Unsplash sin exponer la clave
```
