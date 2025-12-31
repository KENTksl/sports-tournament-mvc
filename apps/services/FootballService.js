const FootballRepository = require('../repositories/FootballRepository');

function generateUniqueId(prefix = '') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

class FootballService {
    // --- Helper Methods ---
    generateKnockoutStructure(teams) {
        // 1. Prepare Bracket Teams (Pairs)
        const bracketTeams = [];
        // Ensure even number of teams for pairing
        const processingTeams = [...teams];
        if (processingTeams.length % 2 !== 0) processingTeams.push('BYE');

        for (let i = 0; i < processingTeams.length; i += 2) {
            bracketTeams.push([processingTeams[i], processingTeams[i+1]]);
        }

        // 2. Prepare Bracket Results (Empty structure for UI)
        const results = [];
        let count = bracketTeams.length; // Number of matches in round 1
        
        // Loop to create empty result arrays for each round
        while (count >= 1) {
            let roundResults = [];
            for (let i = 0; i < count; i++) roundResults.push([null, null]);
            results.push(roundResults);
            count /= 2;
        }

        // 3. Prepare Fixtures (The Schedule)
        const fixtures = [];
        const totalRounds = Math.ceil(Math.log2(processingTeams.length)); 
        
        // We iterate from Round 0 (First Round) to Final
        for (let r = 0; r < totalRounds; r++) {
            const numMatches = processingTeams.length / Math.pow(2, r + 1);
            let roundName = '';
            
            if (numMatches === 1) roundName = 'Chung Kết';
            else if (numMatches === 2) roundName = 'Bán Kết';
            else if (numMatches === 4) roundName = 'Tứ Kết';
            else roundName = `Vòng 1/${numMatches}`;

            const roundMatches = [];
            for (let m = 0; m < numMatches; m++) {
                // For the first round, populate teams
                let t1 = null, t2 = null;
                if (r === 0) {
                    t1 = bracketTeams[m][0];
                    t2 = bracketTeams[m][1];
                }

                roundMatches.push({
                    id: generateUniqueId(`m_KO_r${r}_${m}_`),
                    team1: t1,
                    team2: t2,
                    score1: null,
                    score2: null,
                    scorers1: "",
                    scorers2: "",
                    lineup1: [],
                    lineup2: [],
                    events: [],
                    time: '20:00',
                    date: `${roundName} - Trận ${m + 1}`,
                    bracketRound: r,       
                    bracketMatchIndex: m   
                });
            }
            fixtures.push({ group: roundName, matches: roundMatches });
        }

        return {
            bracketData: { teams: bracketTeams, results: results },
            fixtures: fixtures
        };
    }

    getRoundRobinSchedule(teams) {
        const schedule = [];
        const numTeams = teams.length;
        if (numTeams % 2 !== 0) teams.push(null); 

        const teamCount = teams.length;
        const rounds = teamCount - 1; 
        const half = teamCount / 2;
        let groupTeams = [...teams]; 

        for (let round = 0; round < rounds; round++) {
            const roundMatches = [];
            for (let i = 0; i < half; i++) {
                const team1 = groupTeams[i];
                const team2 = groupTeams[teamCount - 1 - i];
                if (team1 !== null && team2 !== null) {
                    roundMatches.push({ t1: team1, t2: team2 });
                }
            }
            schedule.push(roundMatches);
            groupTeams.splice(1, 0, groupTeams.pop());
        }
        return schedule;
    }

    generateFixtures(numTeams) {
        const fixtures = [];
        const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        let numGroups = Math.ceil(numTeams / 4); 
        
        // Custom logic for 16 and 32 teams: Force 4 groups
        if (numTeams === 16 || numTeams === 32) {
            numGroups = 4;
        }

        const teamsPerGroup = numTeams / numGroups;
        let globalTeamCount = 1;

        if (numTeams < 4) {
            let groupTeamNames = [];
            for(let k=1; k<=numTeams; k++) groupTeamNames.push("Đội " + k);
            const rounds = this.getRoundRobinSchedule(groupTeamNames);
            let allMatches = [];
            rounds.forEach((roundMatches, roundIndex) => {
                roundMatches.forEach((match, matchIndex) => {
                    allMatches.push({
                        id: `m_${Date.now()}_A_r${roundIndex}_${matchIndex}`,
                        team1: match.t1, team2: match.t2, score1: null, score2: null,
                        scorers1: "", scorers2: "", lineup1: [], lineup2: [], events: [],
                        time: '20:00', date: `Lượt ${roundIndex + 1}`
                    });
                });
            });
            fixtures.push({ group: 'Bảng A', matches: allMatches });
            return fixtures;
        }

        for (let i = 0; i < numGroups; i++) {
            const groupName = `Bảng ${groups[i]}`;
            let groupTeamNames = [];
            for(let k=0; k<teamsPerGroup; k++) {
                if (globalTeamCount <= numTeams) groupTeamNames.push("Đội " + (globalTeamCount++));
            }
            if (groupTeamNames.length < 2) break;
            const rounds = this.getRoundRobinSchedule(groupTeamNames);
            let allMatches = [];
            rounds.forEach((roundMatches, roundIndex) => {
                roundMatches.forEach((match, matchIndex) => {
                    allMatches.push({
                        id: generateUniqueId(`m_${i}_r${roundIndex}_${matchIndex}_`),
                        team1: match.t1, team2: match.t2, score1: null, score2: null,
                        scorers1: "", scorers2: "", lineup1: [], lineup2: [], events: [],
                        time: '20:00', date: `Lượt ${roundIndex + 1}`
                    });
                });
            });
            fixtures.push({ group: groupName, matches: allMatches });
        }
        return fixtures;
    }

    // --- Main Service Methods ---
    async getAllTournaments(filter = {}) {
        return await FootballRepository.findAll(filter);
    }

    async addTeam(tournamentId, teamData) {
        const tournament = await FootballRepository.findById(tournamentId);
        if (!tournament) throw new Error('Tournament not found');

        // Filter out any null/undefined or invalid teams before checking length
        const validTeams = (tournament.teams || []).filter(t => t && t.name);
        
        if (validTeams.length >= tournament.teamsCount) {
            throw new Error(`Tournament is full. Maximum ${tournament.teamsCount} teams allowed.`);
        }

        const isDuplicate = validTeams.some(t => t.name.toLowerCase() === teamData.name.toLowerCase());
        if (isDuplicate) {
            throw new Error(`Team name "${teamData.name}" already exists in this tournament.`);
        }

        // Ensure stats initialized
        if (!teamData.stats) {
            teamData.stats = { p: 0, w: 0, d: 0, l: 0, gd: 0, pts: 0 };
        }
        
        // Ensure id exists
        if (!teamData.id) {
            teamData.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        }

        tournament.teams.push(teamData);
        return await tournament.save();
    }

    async addTeamMember(tournamentId, teamId, memberData) {
        const tournament = await FootballRepository.findById(tournamentId);
        if (!tournament) throw new Error(`Tournament not found with ID: ${tournamentId}`);

        let teamIndex = tournament.teams.findIndex(t => String(t.id) === String(teamId));
        
        if (teamIndex === -1) {
             teamIndex = tournament.teams.findIndex(t => t._id && String(t._id) === String(teamId));
        }

        if (teamIndex === -1) {
            const existingTeamIds = tournament.teams.map(t => t.id).join(', ');
            throw new Error(`Team not found. Requested ID: ${teamId}. Existing IDs: ${existingTeamIds}`);
        }

        if (!tournament.teams[teamIndex].members) {
            tournament.teams[teamIndex].members = [];
        }

        tournament.teams[teamIndex].members.push(memberData);
        tournament.markModified('teams');
        
        return await tournament.save();
    }

    async updateTeam(tournamentId, teamId, updateData) {
        const tournament = await FootballRepository.findById(tournamentId);
        if (!tournament) throw new Error('Tournament not found');

        const teamIndex = tournament.teams.findIndex(t => t.id === teamId);
        if (teamIndex === -1) throw new Error('Team not found');

        if (updateData.name) tournament.teams[teamIndex].name = updateData.name;
        if (updateData.logo) tournament.teams[teamIndex].logo = updateData.logo;

        tournament.markModified('teams');
        return await tournament.save();
    }

    async addMatch(tournamentId, matchData) {
        const tournament = await FootballRepository.findById(tournamentId);
        if (!tournament) throw new Error('Tournament not found');
        
        if (!tournament.fixtures || tournament.fixtures.length === 0) {
            tournament.fixtures = [{ group: 'Vòng đấu bảng', matches: [] }];
        }
        
        tournament.fixtures[0].matches.push(matchData);
        tournament.markModified('fixtures');
        return await tournament.save();
    }

    async updateMatch(tournamentId, matchId, matchData) {
        const tournament = await FootballRepository.findById(tournamentId);
        if (!tournament) throw new Error('Tournament not found');
        
        let matchFound = false;
        let targetMatch = null;

        if (tournament.fixtures) {
            for (const group of tournament.fixtures) {
                const matchIndex = group.matches.findIndex(m => m.id === matchId);
                if (matchIndex !== -1) {
                    const match = group.matches[matchIndex];
                    targetMatch = match;
                    const isGroupStage = group.group && (group.group.startsWith('Bảng') || group.group.startsWith('Group'));
                    if (isGroupStage && tournament.bracketData) {
                        throw new Error('Vòng bảng đã khóa sau khi tạo Knockout');
                    }
                    
                    if (matchData.score1 !== undefined) match.score1 = matchData.score1;
                    if (matchData.score2 !== undefined) match.score2 = matchData.score2;
                    if (matchData.time !== undefined) match.time = matchData.time;
                    if (matchData.date !== undefined) match.date = matchData.date;
                    if (matchData.lineup1 !== undefined) match.lineup1 = matchData.lineup1;
                    if (matchData.lineup2 !== undefined) match.lineup2 = matchData.lineup2;
                    if (matchData.events !== undefined) match.events = (matchData.events || []).map(ev => ({
                        id: ev.id || `${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
                        minute: typeof ev.minute === 'number' ? ev.minute : parseInt(ev.minute || '0'),
                        team: ev.team === 'team1' || ev.team === 'team2' ? ev.team : 'team1',
                        teamName: ev.teamName || (ev.team === 'team1' ? match.team1 : match.team2),
                        playerId: ev.playerId || null,
                        playerName: ev.playerName || '',
                        type: ['goal','yellow','red'].includes(ev.type) ? ev.type : 'goal',
                        assistId: ev.assistId || null,
                        assistName: ev.assistName || ''
                    }));
                    if (matchData.status !== undefined) match.status = matchData.status;
                    
                    // Update Bracket Data (UI)
                    // Now checking bracketRound existence instead of hardcoded group name
                    if (match.bracketRound !== undefined && tournament.bracketData && tournament.bracketData.results) {
                        const bRound = match.bracketRound;
                        const bIndex = match.bracketMatchIndex;
                        
                        if (bRound !== undefined && bIndex !== undefined && tournament.bracketData.results[bRound] && tournament.bracketData.results[bRound][bIndex]) {
                            const s1 = match.score1 !== null ? parseInt(match.score1) : null;
                            const s2 = match.score2 !== null ? parseInt(match.score2) : null;
                            
                            tournament.bracketData.results[bRound][bIndex] = [s1, s2];
                            tournament.markModified('bracketData');
                        }
                    }

                    matchFound = true;
                    break; // Found the match, exit loop
                }
            }
        }
        
        if (matchFound) {
            // --- Logic: Advance Winner to Next Round in Fixtures ---
            // Only applies if scores are present and it has bracket info
            if (targetMatch && targetMatch.score1 !== null && targetMatch.score2 !== null && 
               targetMatch.bracketRound !== undefined) {
                
                const s1 = parseInt(targetMatch.score1);
                const s2 = parseInt(targetMatch.score2);
                let winnerName = null;
                
                if (s1 > s2) winnerName = targetMatch.team1;
                else if (s2 > s1) winnerName = targetMatch.team2;
                
                // If there is a winner, advance them
                if (winnerName) {
                    const currentRound = targetMatch.bracketRound;
                    const currentIndex = targetMatch.bracketMatchIndex;
                    
                    // Safety check for undefined properties
                    if (currentRound !== undefined && currentIndex !== undefined) {
                        const nextRound = currentRound + 1;
                        const nextIndex = Math.floor(currentIndex / 2);
                        const isTeam1InNextMatch = (currentIndex % 2 === 0);

                        // Find the next match across ALL fixture groups
                        let nextMatchFound = false;
                        if (tournament.fixtures) {
                            for (const group of tournament.fixtures) {
                                const nextMatch = group.matches.find(m => m.bracketRound === nextRound && m.bracketMatchIndex === nextIndex);
                                if (nextMatch) {
                                    if (isTeam1InNextMatch) nextMatch.team1 = winnerName;
                                    else nextMatch.team2 = winnerName;
                                    nextMatchFound = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            tournament.markModified('fixtures');
            
            // Recalculate Standings
            tournament.standings = this.calculateStandings(tournament);
            tournament.markModified('standings');

            // Sync Standings to Team Stats (Fix for Admin Team List)
            if (tournament.standings && tournament.teams) {
                tournament.standings.forEach(group => {
                    if (group.teams) {
                        group.teams.forEach(standingTeam => {
                            const teamIndex = tournament.teams.findIndex(t => t.name === standingTeam.name);
                            if (teamIndex !== -1) {
                                tournament.teams[teamIndex].stats = {
                                    p: standingTeam.played,
                                    w: standingTeam.won,
                                    d: standingTeam.drawn,
                                    l: standingTeam.lost,
                                    gd: standingTeam.gd,
                                    pts: standingTeam.points
                                };
                            }
                        });
                    }
                });
                tournament.markModified('teams');
            }

            return await tournament.save();
        }
        return null;
    }

    calculateStandings(tournament) {
        if (!tournament.fixtures) return [];

        const groups = tournament.fixtures.filter(g => g.group && (g.group.startsWith('Bảng') || g.group.startsWith('Group')));
        const groupStandings = [];

        // Map team name to team details (logo, etc.)
        const teamDetailsMap = {};
        if (tournament.teams) {
            tournament.teams.forEach(t => {
                teamDetailsMap[t.name] = t;
            });
        }

        groups.forEach(group => {
            const teamsMap = {};
            
            // 1. Initialize all teams in this group from fixtures
            // We scan all matches to find participating teams
            group.matches.forEach(m => {
                [m.team1, m.team2].forEach(teamName => {
                    if (teamName && !teamsMap[teamName]) {
                        const details = teamDetailsMap[teamName] || { logo: 'default.png' };
                        teamsMap[teamName] = { 
                            name: teamName, 
                            logo: details.logo,
                            played: 0, 
                            won: 0, 
                            drawn: 0, 
                            lost: 0, 
                            gd: 0, 
                            points: 0 
                        };
                    }
                });
            });

            // 2. Calculate stats from matches
            group.matches.forEach(m => {
                if (m.score1 !== null && m.score2 !== null && m.score1 !== undefined && m.score2 !== undefined && m.score1 !== "" && m.score2 !== "") {
                    const s1 = parseInt(m.score1);
                    const s2 = parseInt(m.score2);
                    
                    if (teamsMap[m.team1]) teamsMap[m.team1].played++;
                    if (teamsMap[m.team2]) teamsMap[m.team2].played++;
                    
                    if (teamsMap[m.team1]) teamsMap[m.team1].gd += (s1 - s2);
                    if (teamsMap[m.team2]) teamsMap[m.team2].gd += (s2 - s1);

                    if (s1 > s2) {
                        if (teamsMap[m.team1]) { teamsMap[m.team1].won++; teamsMap[m.team1].points += 3; }
                        if (teamsMap[m.team2]) { teamsMap[m.team2].lost++; }
                    } else if (s1 < s2) {
                        if (teamsMap[m.team2]) { teamsMap[m.team2].won++; teamsMap[m.team2].points += 3; }
                        if (teamsMap[m.team1]) { teamsMap[m.team1].lost++; }
                    } else {
                        if (teamsMap[m.team1]) { teamsMap[m.team1].drawn++; teamsMap[m.team1].points += 1; }
                        if (teamsMap[m.team2]) { teamsMap[m.team2].drawn++; teamsMap[m.team2].points += 1; }
                    }
                }
            });

            // 3. Sort
            const rankedTeams = Object.values(teamsMap).sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.gd !== a.gd) return b.gd - a.gd;
                return 0;
            });

            groupStandings.push({ groupName: group.group, teams: rankedTeams });
        });

        return groupStandings;
    }

    async getTournamentById(id) {
        return await FootballRepository.findById(id);
    }

    async createTournament(data) {
        if (!data.status) {
            data.status = 'upcoming';
        }

        // Initialize empty teams and structures
        data.teams = [];
        data.fixtures = [];
        data.bracketData = null;
        data.standings = [];

        return await FootballRepository.create(data);
    }

    async startTournament(id) {
        const tournament = await FootballRepository.findById(id);
        if (!tournament) throw new Error('Tournament not found');

        if (tournament.teams.length === 0) {
             throw new Error('Cannot start tournament with 0 teams.');
        }

        // Optional: Enforce team count match
        // if (tournament.teams.length !== tournament.teamsCount) {
        //    throw new Error(`Tournament requires ${tournament.teamsCount} teams, but has ${tournament.teams.length}.`);
        // }

        const teamNames = tournament.teams.map(t => t.name);
        let autoBracket = null, autoFixtures = null;

        if (tournament.mode === "Knockout") {
            const knockoutData = this.generateKnockoutStructure(teamNames);
            autoBracket = knockoutData.bracketData;
            autoFixtures = knockoutData.fixtures;
        } else if (tournament.mode === "Group Stage") {
            autoFixtures = this.generateFixturesForRealTeams(teamNames, tournament.teamsCount);
             // Don't generate bracket immediately for Group Stage
            autoBracket = null;
        }

        tournament.bracketData = autoBracket;
        tournament.fixtures = autoFixtures || [];
        
        // Initial Standings Calculation
        const tempTournament = { fixtures: tournament.fixtures, teams: tournament.teams };
        tournament.standings = this.calculateStandings(tempTournament);
        
        tournament.status = 'ongoing';
        return await tournament.save();
    }

    generateFixturesForRealTeams(teamNames, expectedCount) {
        const fixtures = [];
        const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const numTeams = teamNames.length;
        
        // Determine number of groups
        let numGroups = Math.ceil(expectedCount / 4); 
        if (expectedCount === 16 || expectedCount === 32) {
            numGroups = 4;
        }
        
        // If we have fewer teams than expected, we might need to adjust or just distribute them
        // For simplicity, let's distribute available teams into groups
        
        const teamsPerGroup = Math.ceil(numTeams / numGroups);
        let teamIndex = 0;

        if (numTeams < 4) {
             // Single group
             const rounds = this.getRoundRobinSchedule(teamNames);
             let allMatches = [];
             rounds.forEach((roundMatches, roundIndex) => {
                roundMatches.forEach((match, matchIndex) => {
                    allMatches.push({
                        id: generateUniqueId(`m_${Date.now()}_A_r${roundIndex}_${matchIndex}_`),
                        team1: match.t1, team2: match.t2, score1: null, score2: null,
                        scorers1: "", scorers2: "", lineup1: [], lineup2: [], events: [],
                        time: '20:00', date: `Lượt ${roundIndex + 1}`
                    });
                });
            });
            fixtures.push({ group: 'Bảng A', matches: allMatches });
            return fixtures;
        }

        for (let i = 0; i < numGroups; i++) {
            const groupName = `Bảng ${groups[i]}`;
            let groupTeamNames = [];
            
            // Distribute teams
            // This is a simple distribution; for 16 teams / 4 groups = 4 teams per group
            // If teams are missing, some groups might have fewer
            for(let k=0; k < 4; k++) { // Assuming max 4 per group roughly
                 if (teamIndex < numTeams) {
                     groupTeamNames.push(teamNames[teamIndex++]);
                 }
            }

            if (groupTeamNames.length < 2) continue; // Skip if less than 2 teams in group

            const rounds = this.getRoundRobinSchedule(groupTeamNames);
            let allMatches = [];
            rounds.forEach((roundMatches, roundIndex) => {
                roundMatches.forEach((match, matchIndex) => {
                    allMatches.push({
                        id: generateUniqueId(`m_${i}_r${roundIndex}_${matchIndex}_`),
                        team1: match.t1, team2: match.t2, score1: null, score2: null,
                        scorers1: "", scorers2: "", lineup1: [], lineup2: [], events: [],
                        time: '20:00', date: `Lượt ${roundIndex + 1}`
                    });
                });
            });
            fixtures.push({ group: groupName, matches: allMatches });
        }
        return fixtures;
    }

    async updateTournament(id, data) {
        return await FootballRepository.update(id, data);
    }

    async deleteTournament(id) {
        return await FootballRepository.delete(id);
    }

    async generateKnockoutStage(tournamentId) {
        const tournament = await FootballRepository.findById(tournamentId);
        if (!tournament) throw new Error('Tournament not found');

        const groups = tournament.fixtures.filter(g => !g.group.includes('Knockout') && !g.group.includes('Vòng Chung Kết'));
        const groupStandings = [];

        // 1. Standings will be computed from available results without requiring all matches to be completed

        // 2. Calculate Standings
        groups.forEach(group => {
            const teamsMap = {};
            
            group.matches.forEach(m => {
                if (!teamsMap[m.team1]) teamsMap[m.team1] = { name: m.team1, p:0, w:0, d:0, l:0, gd:0, pts:0 };
                if (!teamsMap[m.team2]) teamsMap[m.team2] = { name: m.team2, p:0, w:0, d:0, l:0, gd:0, pts:0 };
                
                if (m.score1 !== null && m.score2 !== null) {
                    const s1 = parseInt(m.score1);
                    const s2 = parseInt(m.score2);
                    
                    teamsMap[m.team1].p++;
                    teamsMap[m.team2].p++;
                    
                    teamsMap[m.team1].gd += (s1 - s2);
                    teamsMap[m.team2].gd += (s2 - s1);

                    if (s1 > s2) {
                        teamsMap[m.team1].w++; teamsMap[m.team1].pts += 3;
                        teamsMap[m.team2].l++;
                    } else if (s1 < s2) {
                        teamsMap[m.team2].w++; teamsMap[m.team2].pts += 3;
                        teamsMap[m.team1].l++;
                    } else {
                        teamsMap[m.team1].d++; teamsMap[m.team1].pts += 1;
                        teamsMap[m.team2].d++; teamsMap[m.team2].pts += 1;
                    }
                }
            });

            const rankedTeams = Object.values(teamsMap).sort((a, b) => {
                if (b.pts !== a.pts) return b.pts - a.pts;
                if (b.gd !== a.gd) return b.gd - a.gd;
                return 0;
            });

            groupStandings.push({ group: group.group, teams: rankedTeams });
        });

        // 3. Select Qualified Teams
        // Assuming top 2 advance from each group, or specific logic based on # of groups
        let qualifiedTeams = [];

        if (groupStandings.length === 1) {
            // If 1 group, maybe top 4 advance?
            const group = groupStandings[0];
            if (group.teams.length >= 4) {
                qualifiedTeams = [
                    group.teams[0].name, group.teams[3].name,
                    group.teams[1].name, group.teams[2].name
                ];
            } else if (group.teams.length >= 2) {
                 qualifiedTeams = [group.teams[0].name, group.teams[1].name];
            }
        } else if (groupStandings.length === 2) {
            // A1 vs B2, B1 vs A2
            const gA = groupStandings[0];
            const gB = groupStandings[1];
            if (gA.teams.length >= 2 && gB.teams.length >= 2) {
                qualifiedTeams = [
                    gA.teams[0].name, gB.teams[1].name,
                    gB.teams[0].name, gA.teams[1].name
                ];
            }
        } else if (groupStandings.length === 4) {
            // A1-B2, C1-D2, B1-A2, D1-C2 (simplified)
            for (let i = 0; i < 4; i+=2) {
                const g1 = groupStandings[i];
                const g2 = groupStandings[i+1];
                qualifiedTeams.push(g1.teams[0].name);
                qualifiedTeams.push(g2.teams[1].name);
                qualifiedTeams.push(g2.teams[0].name);
                qualifiedTeams.push(g1.teams[1].name);
            }
        } else {
             // Generic fallback: take top 2 from each group
             groupStandings.forEach(g => {
                 if (g.teams.length >= 2) {
                     qualifiedTeams.push(g.teams[0].name);
                     qualifiedTeams.push(g.teams[1].name);
                 }
             });
        }

        if (qualifiedTeams.length === 0) {
            throw new Error('Not enough teams or groups to generate knockout stage.');
        }

        // 4. Generate Structure
        const knockoutData = this.generateKnockoutStructure(qualifiedTeams);

        // 5. Save to Tournament
        // Remove old knockout/final fixtures if any (to avoid duplicates if re-generated)
        tournament.fixtures = tournament.fixtures.filter(g => {
            const isKnockout = g.group === 'Chung Kết' || g.group === 'Bán Kết' || g.group === 'Tứ Kết' || g.group.startsWith('Vòng 1/');
            return !isKnockout;
        });
        
        // Add new fixtures
        tournament.fixtures.push(...knockoutData.fixtures);

        tournament.bracketData = knockoutData.bracketData;
        tournament.markModified('fixtures');
        tournament.markModified('bracketData');

        return await tournament.save();
    }
}

module.exports = new FootballService();
