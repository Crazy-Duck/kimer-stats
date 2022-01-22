const fs = require('fs');

const heroes = JSON.parse(fs.readFileSync('heroes.json'));

heroes
    .map(h => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${h.name.slice(14)}.png`)
    .forEach(name => console.log(name));