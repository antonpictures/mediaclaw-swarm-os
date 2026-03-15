const fetch = require('node-fetch');

async function fetchMothershipArticles() {
  try {
    const res = await fetch('https://googlemapscoin.com/api/articles');
    const articles = await res.json();
    console.log(JSON.stringify(articles, null, 2));
  } catch (err) {
    console.error(err);
  }
}

fetchMothershipArticles();
