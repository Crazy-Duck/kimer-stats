require('dotenv').config()
const express = require('express');
const { getAllMatches, parse } = require('./parser.js');

const app = express();
const port = 3000;

const league = process.argv[2] || 13824;

let stats = {};

app.set('view engine', 'pug');
app.use(express.static('public'))

app.get('/', (_, res) => {
    res.render('params');
});

app.get('/stats', (req, res) => {
    let regions = (req.query.regions && req.query.regions.split(',').map(Number)) || [3, 8, 9];
    let from = Number(req.query.from) || 0;
    let to = Number(req.query.to) || Math.floor(Date.now() / 1000);
    parse(stats, regions, from, to).then(s => res.render('index', s));
});

getAllMatches(league)
    .then(s => {
        stats = s;
        app.listen(port, () => console.log(`Listening on port ${port}`));
    })
    .catch(err => {
        console.log(err);
    });