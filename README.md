# Kimer stats

## Pre-requisites

* [node-js](https://nodejs.org/en/download/): The LTS version should suffice
* The `leagueID` of whatever league you're trying to pull stats from

## First time usage

Any non-trivial NodeJS script has dependencies which need to be installed before the script can run. 
This installation is a one-time thing, you only need to do it before you run the script the first time.
To install, open a command prompt/shell/... in the root directory of the project (in which you found this README) and execute the following command:
```
$> npm install
```

## Running the application

To start the application, open a command prompt/shell/... in the root directory of the project (in which you found this README) and execute the following command, substituting `<leagueId>` with the ID of your league:
```
$> npm start <leagueID>
```
Running this command will start the parsing phase of the application, where it fetches the statistics from [Stratz](https://stratz.com) and [OpenDota](https://www.opendota.com).
This happens in two phases: the first phase fetches the match id's in the league from Stratz, the second phase pulls stats for those match id's from OpenDota.
Depending on how many matches have already been played in the league, this part can take several minutes. 
The API's the script is calling have flood protection and don't appreciate getting slammed with requests.
When all the stats have been fetched and parsed, a message will appear indicating that the server is now listening.

The output you'll see on screen will look like the following:
```
$> npm start

> kimer-stats@0.1.1 start /path/to/directory
> node server.js "leagueId"

Fetching first batch
Fetching next batch
Fetching opendota matches
Listening on port 3000
```

If you now point your browser to https://localhost:3000, you will see a page allowing you to select the time period for which you want to pull statistics. Entering the dates and clicking `Stats` will show you the statistics.

## Customization

### views/index.pug
This file contains the structural layout of the stats page. 
If you want to adapt text, this is the place to look.

### public/css/style.css
This file contains all the markup of the stats page.
If you want to adapt font, colour, size, ... this is the place to look.

### server.js
Sick and tired of always having to type the league id? You can hard-code it in here!