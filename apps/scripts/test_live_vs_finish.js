const mongoose = require('mongoose');
const config = require('../../Config/Setting.json');
const FootballService = require('../services/FootballService');
const FootballRepository = require('../repositories/FootballRepository');

// Mock global.__basedir just in case
global.__basedir = __dirname + '/../..';

const mongoUrl = `mongodb+srv://${config.mongodb.username}:${config.mongodb.password}@cluster0.u5scqoz.mongodb.net/${config.mongodb.database}?retryWrites=true&w=majority`;

async function runTest() {
    try {
        await mongoose.connect(mongoUrl);
        console.log('Connected to MongoDB');

        // 1. Create Tournament
        console.log('Creating Tournament...');
        const tournament = await FootballService.createTournament({
            name: 'Test Live vs Finish ' + Date.now(),
            organizer: 'Test Script',
            mode: 'Knockout',
            teamsCount: 4,
            description: 'Testing live vs finished status',
            image: 'default.png',
            status: 'upcoming',
            sportType: 'Football',
            pitchType: '5'
        });
        const tId = tournament._id;
        console.log('Tournament Created:', tId);

        // 2. Add 4 Teams
        console.log('Adding 4 Teams...');
        const teamNames = ['Team A', 'Team B', 'Team C', 'Team D'];
        for (const name of teamNames) {
            await FootballService.addTeam(tId, {
                id: Date.now().toString() + Math.random(),
                name: name,
                logo: 'default.png',
                members: [],
                stats: { p: 0, w: 0, d: 0, l: 0, gd: 0, pts: 0 }
            });
        }

        // 3. Start Tournament
        console.log('Starting Tournament...');
        const startedTournament = await FootballService.startTournament(tId);
        
        const semiFinals = startedTournament.fixtures.find(g => g.group === 'Bán Kết');
        const match1 = semiFinals.matches[0];
        
        // 4. Test LIVE Status (Should NOT advance)
        console.log(`\n--- Testing LIVE Status ---`);
        console.log(`Simulating Match 1 LIVE update: ${match1.team1} 2 - 1 ${match1.team2}`);
        
        await FootballService.updateMatch(tId, match1.id, {
            score1: 2,
            score2: 1,
            status: 'live' // LIVE STATUS
        });

        let updatedTournament = await FootballRepository.findById(tId);
        let updatedFinals = updatedTournament.fixtures.find(g => g.group === 'Chung Kết');
        let finalMatch = updatedFinals.matches.find(m => m.bracketMatchIndex === 0);

        if (finalMatch.team1 || finalMatch.team2) {
            console.error('FAILURE: Teams advanced to final while match is LIVE!');
            console.log('Final Match:', finalMatch);
        } else {
            console.log('SUCCESS: Teams did NOT advance while match is LIVE.');
        }

        // Check Bracket Data (Should be updated)
        if (updatedTournament.bracketData.results[0][match1.bracketMatchIndex][0] === 2) {
             console.log('SUCCESS: Bracket UI scores updated.');
        } else {
             console.error('FAILURE: Bracket UI scores NOT updated.');
        }

        // 5. Test FINISHED Status (Should advance)
        console.log(`\n--- Testing FINISHED Status ---`);
        console.log(`Simulating Match 1 FINISHED update...`);

        await FootballService.updateMatch(tId, match1.id, {
            score1: 2,
            score2: 1,
            status: 'finished' // FINISHED STATUS
        });

        updatedTournament = await FootballRepository.findById(tId);
        updatedFinals = updatedTournament.fixtures.find(g => g.group === 'Chung Kết');
        finalMatch = updatedFinals.matches.find(m => m.bracketMatchIndex === 0);

        // Note: We don't know if match1 winner goes to team1 or team2 slot of final without checking index logic,
        // but ONE of them should be set.
        if (finalMatch.team1 === match1.team1 || finalMatch.team2 === match1.team1) {
            console.log('SUCCESS: Winner advanced to Final after FINISHED status.');
        } else {
            console.error('FAILURE: Winner did NOT advance after FINISHED status.');
            console.log('Final Match:', finalMatch);
        }

        // Cleanup
        console.log('\nDeleting Test Tournament...');
        await FootballRepository.delete(tId);
        console.log('Cleanup Complete.');

        process.exit(0);
    } catch (error) {
        console.error('TEST FAILED:', error);
        process.exit(1);
    }
}

runTest();
