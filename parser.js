const axios = require('axios');
const rateLimit = require('axios-rate-limit');
const retry = require('axios-retry');
const fs = require('fs');

const pageSize = 250;
const odotaDelay = 2000;

const stratz = axios.create({
    baseURL: 'https://api.stratz.com/api/v1',
    timeout: 10000,
    headers: {'Authorization': `Bearer ${process.env.STRATZ_API_KEY}`}
});
const opendota = rateLimit(axios.create({
    baseURL: 'https://api.opendota.com/api',
    timeout: 10000
}), { maxRequests: 1, perMilliseconds: odotaDelay});
stratz.interceptors.response.use(r => r.data, err => Promise.reject(err));
opendota.interceptors.response.use(r => r.data, err => Promise.reject(err));
retry(stratz, { retries: 3 });
retry(opendota, { retries: 3 });


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
    let matches = await getMatches(league, 0);
    fetched += pageSize;
    while (matches.length >= fetched) {
        console.log('Fetching next batch');
        matches.push(...(await getMatches(league, fetched)));
        fetched += pageSize;
    }
    console.log(`Fetching ${matches.length} opendota matches\nEstimated time: ${odotaDelay / 1000 * matches.length}s`);
    let odota_matches = await Promise.all(matches.map(m => opendota.get(`/matches/${m.id}`)));
    
    console.log("Combining OpenDota & Stratz data")
    odota_matches
        .forEach(m => {
            let match = matches.find(stratz => stratz.id == m.match_id);
            m.players.forEach(player => {
                player.steamAccount = match.players.find(stratz => stratz.steamAccountId == player.account_id).steamAccount;
                player.hero = convertIdToHero(player.hero_id);
                player.steamAccount.avatar = "https://avatars.akamai.steamstatic.com/" + player.steamAccount.avatar.split("/").at(-1)
            });
            m.regionId = match.regionId;
            m.startDateTime = match.startDateTime;
            m.endDateTime = match.endDateTime;
            m.durationSeconds = match.durationSeconds;
            m.direTeam = match.direTeam;
            m.radiantTeam = match.radiantTeam;
        });

    return odota_matches;
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
        picture: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${hero.name.slice(14)}.png`,
        portrait: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/heroes/${hero.name.slice(14)}_vert.jpg`
    };
}

async function parse(matches, regions, from, to) {
    let stats = {};
    matches = matches.filter(match => 
        regions.includes(match.regionId)
        && match.endDateTime > from
        && match.endDateTime < to);
    
    let durations = matches
        .map(match => ({ 
            duration: match.durationSeconds, 
            id: match.id, 
            radiant: match.radiantTeam, 
            dire: match.direTeam, 
            radiantWin: match.radiant_win
        }))
        .sort((a, b) => a.duration - b.duration);

    stats.shortestGame = durations[0];
    stats.shortestGame.duration = timeToString(stats.shortestGame.duration);
    stats.longestGame = durations[durations.length-1];
    stats.longestGame.duration = timeToString(stats.longestGame.duration);
    
    let kills = matches
        .map(match => ({
            kills: match.radiant_score + match.dire_score,
            id: match.id, 
            radiant: match.radiantTeam, 
            dire: match.direTeam, 
            radiantWin: match.radiant_win
        }))
        .sort((a, b) => a.kills - b.kills);
    stats.leastKillsGame = kills[0];
    stats.mostKillsGame = kills[kills.length-1];

    stats.players = {};
    let playerKills = getStat(matches, 'kills');
    stats.players.mostKills = playerKills[playerKills.length-1]
    let playerDeaths = getStat(matches, 'deaths');
    stats.players.mostDeaths = playerDeaths[playerDeaths.length-1];
    let playerAssists = getStat(matches, 'assists');
    stats.players.mostAssists = playerAssists[playerAssists.length-1];
    let playerGPM = getStat(matches, 'gold_per_min');
    stats.players.highestGPM = playerGPM[playerGPM.length-1];
    let playerXPM = getStat(matches, 'xp_per_min');
    stats.players.highestXPM = playerXPM[playerXPM.length-1];
    let lastHits = getStat(matches, 'last_hits');
    stats.players.highestLH = lastHits[lastHits.length-1];
    let denies = getStat(matches, 'denies');
    stats.players.highestDN = denies[denies.length-1];
    let heroDamage = getStat(matches, 'hero_damage');
    stats.players.highestHD = heroDamage[heroDamage.length-1];
    let towerDamage = getStat(matches, 'tower_damage');
    stats.players.highestTD = towerDamage[towerDamage.length-1];
    let heroHealing = getStat(matches, 'hero_healing');
    stats.players.highestHH = heroHealing[heroHealing.length-1];
    let runes = getStat(matches, 'rune_pickups');
    stats.players.runes = runes[runes.length-1];
    let stacks = getStat(matches, 'camps_stacked');
    stats.players.stacks = stacks[stacks.length-1];
    let couriers = getStat(matches, 'courier_kills');
    stats.players.couriers = couriers[couriers.length-1]
    let fatCat = getStat(matches, 'total_gold');
    stats.players.fatCat = fatCat[fatCat.length-1];
    stats.players.pauper = fatCat[0];

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

    let bans = matches
        .flatMap(match => match.picks_bans)
        .filter(pick => pick && !pick.is_pick)
        .map(pick => pick.hero_id)
        .reduce((acc, curr) => {
            acc[curr] = (acc[curr] || 0) + 1;
            return acc;
        }, {});
    let banCounts = Object.keys(bans)
        .map(id => {
            let hero = convertIdToHero(id);
            hero.count = bans[id];
            return hero;
        })
        .sort((a, b) => a.count - b.count);
    stats.bans = banCounts.slice(-3);

    // console.log(JSON.stringify(stats, null, 2));
    return stats;

}

module.exports = {
    parse,
    getAllMatches,
}