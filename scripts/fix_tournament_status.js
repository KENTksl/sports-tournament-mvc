const mongoose = require('mongoose');
const config = require('../Config/Setting.json');
const FootballTournament = require('../apps/models/football/FootballTournament');

const { username, password, database } = config.mongodb;
const uri = `mongodb+srv://${username}:${password}@cluster0.u5scqoz.mongodb.net/${database}?retryWrites=true&w=majority`;

async function fix() {
    try {
        await mongoose.connect(uri);
        console.log('Connected to DB');

        const tournaments = await FootballTournament.find({ status: 'completed' });
        console.log(`Found ${tournaments.length} completed tournaments.`);
        let count = 0;

        for (const t of tournaments) {
            // Check if fixtures are empty or zero matches
            let hasMatches = false;
            if (t.fixtures && t.fixtures.length > 0) {
                for (const g of t.fixtures) {
                    if (g.matches && g.matches.length > 0) {
                        hasMatches = true;
                        break;
                    }
                }
            }

            if (!hasMatches) {
                console.log(`Fixing tournament: ${t.name} (${t._id}) - Status: completed -> upcoming`);
                t.status = 'upcoming';
                await t.save();
                count++;
            } else {
                 // Check if all matches are actually finished
                 let allFinished = true;
                 for (const g of t.fixtures) {
                    for (const m of (g.matches || [])) {
                        if (m.status !== 'finished') {
                            allFinished = false;
                            break;
                        }
                    }
                    if (!allFinished) break;
                 }
                 
                 if (!allFinished) {
                     console.log(`Fixing tournament: ${t.name} (${t._id}) - Has unfinished matches but status is completed -> ongoing`);
                     t.status = 'ongoing';
                     await t.save();
                     count++;
                 }
            }
        }

        console.log(`Fixed ${count} tournaments.`);
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

fix();