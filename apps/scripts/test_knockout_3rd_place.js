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
            name: 'Test Knockout 3rd Place ' + Date.now(),
            organizer: 'Test Script',
            mode: 'Knockout',
            teamsCount: 4,
            description: 'Testing 3rd place match generation',
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
        
        // 4. Verify Structure
        console.log('Verifying Fixtures...');
        const fixtures = startedTournament.fixtures;
        const semiFinals = fixtures.find(g => g.group === 'Bán Kết');
        const finals = fixtures.find(g => g.group === 'Chung Kết');

        if (!semiFinals || semiFinals.matches.length !== 2) {
            throw new Error('Semi-finals not generated correctly');
        }
        if (!finals || finals.matches.length !== 2) {
            console.log('Finals matches count:', finals ? finals.matches.length : 0);
            // Print matches to see what happened
            if (finals) finals.matches.forEach(m => console.log(m));
            throw new Error('Finals (including 3rd place) not generated correctly. Expected 2 matches.');
        }

        const finalMatch = finals.matches.find(m => m.bracketMatchIndex === 0);
        const thirdPlaceMatch = finals.matches.find(m => m.bracketMatchIndex === 1);

        if (!finalMatch) throw new Error('Final match not found');
        if (!thirdPlaceMatch) throw new Error('3rd Place match not found');
        console.log('Structure Verified: 3rd Place Match exists.');

        // 5. Simulate Matches
        // Match 1: Team A vs Team B. Winner A.
        const match1 = semiFinals.matches[0];
        console.log(`Simulating Match 1: ${match1.team1} vs ${match1.team2}`);
        
        // Assume Team A is team1, Team B is team2 (or vice versa, just pick a winner)
        // We need to set scores.
        await FootballService.updateMatch(tId, match1.id, {
            score1: 2,
            score2: 1, // team1 wins
            status: 'finished'
        });
        console.log(`Match 1 Updated. Winner: ${match1.team1}, Loser: ${match1.team2}`);

        // Match 2: Team C vs Team D. Winner C.
        const match2 = semiFinals.matches[1];
        console.log(`Simulating Match 2: ${match2.team1} vs ${match2.team2}`);
        
        await FootballService.updateMatch(tId, match2.id, {
            score1: 3,
            score2: 0, // team1 wins
            status: 'finished'
        });
        console.log(`Match 2 Updated. Winner: ${match2.team1}, Loser: ${match2.team2}`);

        // 6. Verify Progression
        const updatedTournament = await FootballRepository.findById(tId);
        const updatedFinals = updatedTournament.fixtures.find(g => g.group === 'Chung Kết');
        
        const updatedFinalMatch = updatedFinals.matches.find(m => m.bracketMatchIndex === 0);
        const updatedThirdPlaceMatch = updatedFinals.matches.find(m => m.bracketMatchIndex === 1);

        console.log('Final Match Teams:', updatedFinalMatch.team1, 'vs', updatedFinalMatch.team2);
        console.log('3rd Place Match Teams:', updatedThirdPlaceMatch.team1, 'vs', updatedThirdPlaceMatch.team2);

        // Verify Bracket Data
        console.log('Verifying Bracket Data...');
        const bracketResults = updatedTournament.bracketData.results;
        // Round 0 (Semi): Should have scores
        // Round 1 (Final): Should be empty (as matches not played yet)
        
        // Check Round 0 results
        const r0m0 = bracketResults[0][0]; // Match 1
        const r0m1 = bracketResults[0][1]; // Match 2
        
        console.log('Bracket Round 0 Match 0 Score:', r0m0);
        console.log('Bracket Round 0 Match 1 Score:', r0m1);

        if (r0m0[0] === 2 && r0m0[1] === 1) console.log('SUCCESS: Bracket Data updated for Match 1');
        else console.error('FAILURE: Bracket Data NOT updated for Match 1');

        if (r0m1[0] === 3 && r0m1[1] === 0) console.log('SUCCESS: Bracket Data updated for Match 2');
        else console.error('FAILURE: Bracket Data NOT updated for Match 2');

        // Expected Winners in Final
        if (updatedFinalMatch.team1 === match1.team1 && updatedFinalMatch.team2 === match2.team1) {
             console.log('SUCCESS: Final Match teams are correct.');
        } else if (updatedFinalMatch.team1 === match2.team1 && updatedFinalMatch.team2 === match1.team1) {
             console.log('SUCCESS: Final Match teams are correct (swapped).');
        } else {
             console.error('FAILURE: Final Match teams are incorrect.');
        }

        // Expected Losers in 3rd Place
        if (updatedThirdPlaceMatch.team1 === match1.team2 && updatedThirdPlaceMatch.team2 === match2.team2) {
             console.log('SUCCESS: 3rd Place Match teams are correct.');
        } else if (updatedThirdPlaceMatch.team1 === match2.team2 && updatedThirdPlaceMatch.team2 === match1.team2) {
             console.log('SUCCESS: 3rd Place Match teams are correct (swapped).');
        } else {
             console.error('FAILURE: 3rd Place Match teams are incorrect.');
        }

        // 7. Cleanup
        console.log('Deleting Test Tournament...');
        await FootballService.deleteTournament(tId);
        console.log('Cleanup Complete.');

    } catch (error) {
        console.error('Test Failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

runTest();
