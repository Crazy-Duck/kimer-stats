const axios = require('axios');
const fs = require('fs');

// Node doesn't contain flatMap for some reason
Array.prototype.flatMap = function(lambda) { 
    return Array.prototype.concat.apply([], this.map(lambda)); 
};

const pageSize = 250;

const stratz = axios.create({
    baseURL: 'https://api.stratz.com/api/v1',
    timeout: 10000
})

const heroes = JSON.parse(fs.readFileSync('heroes.json'));

function getMatches(league, skip) {
    return stratz.get(`/league/${league}/matches`, {
        params: {
            include: 'Player,Team',
            take: pageSize,
            skip
        }
    });
}

async function getAllMatches(league) {
    let fetched = 0;
    console.log('Fetching first batch');
    let matches = (await getMatches(league, 0)).data;
    fetched += pageSize;
    while (matches.length >= fetched) {
        console.log('Fetching next batch');
        matches.push(...(await getMatches(league, fetched)).data);
        fetched += pageSize;
    }
    matches
        .flatMap(match => match.players)
        .forEach(player => {
            player.hero = convertIdToHero(player.heroId);
        });
    return matches;
}

function getStat(matches, stat) {
    return matches
        .flatMap(match => match.players)
        .sort((a, b) => a[stat] - b[stat]);
}

function timeToString(time) {
    let sign = time > 0 ? "" : "-";
    let date = new Date(null);
    date.setSeconds(Math.abs(time));
    return sign + date.toISOString().substr(11, 8);
}

function convertIdToHero(id) {
    let hero = heroes.filter(h => h.id === Number(id))[0];
    return {
        id,
        hero: hero.localized_name, 
        picture: `http://cdn.dota2.com/apps/dota2/images/heroes/${hero.name.slice(14)}_full.png`,
        portrait: `http://cdn.dota2.com/apps/dota2/images/heroes/${hero.name.slice(14)}_vert.jpg`
    };
}

async function parse(matches, regions, from, to) {
    let stats = {};
    matches = matches.filter(match => 
        regions.includes(match.regionId)
        && match.endDateTime > from
        && match.endDateTime < to);

    // Set for each player if they won
    matches.forEach(m => m.players.forEach(p => p.hasWon = m.didRadiantWin == p.isRadiant));
    
    let durations = matches
        .map(match => ({ 
            duration: match.durationSeconds, 
            id: match.id, 
            radiant: match.radiantTeam, 
            dire: match.direTeam, 
            radiantWin: match.didRadiantWin
        }))
        .sort((a, b) => a.duration - b.duration);

    stats.shortestGame = durations[0];
    stats.shortestGame.duration = timeToString(stats.shortestGame.duration);
    stats.longestGame = durations[durations.length-1];
    stats.longestGame.duration = timeToString(stats.longestGame.duration);
    
    let kills = matches
        .map(match => ({
            kills: match.players.map(a => a.numKills).reduce((a,b) => a + b),
            id: match.id, 
            radiant: match.radiantTeam, 
            dire: match.direTeam, 
            radiantWin: match.didRadiantWin
        }))
        .sort((a, b) => a.kills - b.kills);
    stats.leastKillsGame = kills[0];
    stats.mostKillsGame = kills[kills.length-1];

    stats.players = {};
    let playerKills = getStat(matches, 'numKills');
    stats.players.mostKills = playerKills[playerKills.length-1]
    let playerDeaths = getStat(matches, 'numDeaths');
    stats.players.mostDeaths = playerDeaths[playerDeaths.length-1];
    let playerAssists = getStat(matches, 'numAssists');
    stats.players.mostAssists = playerAssists[playerAssists.length-1];
    let playerGPM = getStat(matches, 'goldPerMinute');
    stats.players.highestGPM = playerGPM[playerGPM.length-1];
    let playerXPM = getStat(matches, 'experiencePerMinute');
    stats.players.highestXPM = playerXPM[playerXPM.length-1];
    let lastHits = getStat(matches, 'numLastHits');
    stats.players.highestLH = lastHits[lastHits.length-1];
    let denies = getStat(matches, 'numDenies');
    stats.players.highestDN = denies[denies.length-1];
    let heroDamage = getStat(matches, 'heroDamage');
    stats.players.highestHD = heroDamage[heroDamage.length-1];
    let towerDamage = getStat(matches, 'towerDamage');
    stats.players.highestTD = towerDamage[towerDamage.length-1];
    let heroHealing = getStat(matches, 'heroHealing');
    stats.players.highestHH = heroHealing[heroHealing.length-1];

    let picks = matches
        .flatMap(match => match.players)
        .map(player => player.hero)
        .reduce((acc, curr) => {
            acc[curr.id] = (acc[curr.id] || 0) + 1;
            return acc;
        }, {});
    let pickCounts = Object.keys(picks)
        .map(id => {
            let hero = convertIdToHero(id);
            hero.count = picks[id];
            return hero;
        })
        .sort((a, b) => a.count - b.count);
    stats.heroes = pickCounts.slice(-3);

    console.log(JSON.stringify(stats, null, 2));
    return stats;

}

module.exports = {
    parse,
    getAllMatches,
}