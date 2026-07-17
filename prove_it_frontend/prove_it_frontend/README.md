# Prove IT Catalysts React Replica - Full Structure

This ZIP uses the requested React.js structure and **does not use `.jsx` files**.

## Where the HTML is

- `index.html` is the Vite root HTML file. It only contains the `<div id="root"></div>` mount point.
- The original application HTML replica is stored inside `src/pages/Replica/appMarkup.js` as `appHtml`.
- `src/pages/Replica/ReplicaPage.js` injects that HTML and runtime script into React.

## Where the UI/design comes from

- `src/styles/global.css` contains the original UI/UX styling, animations, colors, cards, sidebar, login page, dashboard, tables, modals, and responsive CSS.
- `src/assets/images/company-logo.png` contains the company logo.
- `public/company-logo.png` is also kept because the converted HTML uses `/company-logo.png` paths.

## Main run flow

`index.html` -> `src/main.js` -> `src/App.js` -> `src/routes/AppRoutes.js` -> `src/pages/Replica/ReplicaPage.js` -> `src/pages/Replica/appMarkup.js`

## Install and run

```bash
npm install
npm run dev
```
