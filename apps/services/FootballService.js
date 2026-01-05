const FootballRepository = require('../repositories/FootballRepository');

function generateUniqueId(prefix = '') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

class FootballService {
    // --- Helper Methods ---
    async checkDuplicatePlayers(tournamentId, newMembers, excludeTeamId = null) {
        if (!newMembers || newMembers.length === 0) return;
        const tournament = await FootballRepository.findById(tournamentId);
        if (!tournament || !tournament.teams) return;

        const allMembers = [];
        tournament.teams.forEach(t => {
            if (excludeTeamId && (String(t.id) === String(excludeTeamId) || (t._id && String(t._id) === String(excludeTeamId)))) return;
            if (t.members) {
                t.members.forEach(m => allMembers.push({ ...m, teamName: t.name }));
            }
        });

        for (const newMem of newMembers) {
            // Check by Citizen ID (Unique Identifier)
            // Priority 1: Check explicit citizenId field
            if (newMem.citizenId && newMem.citizenId.trim() !== '') {
                const dup = allMembers.find(m => 
                    (m.citizenId && m.citizenId === newMem.citizenId) || 
                    (m.citizenIdImage && m.citizenIdImage === newMem.citizenId) // Check against image field if it holds the ID
                );
                if (dup) {
                    throw new Error(`Cầu thủ ${newMem.name} (CCCD: ${newMem.citizenId}) đã đăng ký cho đội ${dup.teamName}.`);
                }
            }
            // Priority 2: Check citizenIdImage (legacy or registration data)
            else if (newMem.citizenIdImage && newMem.citizenIdImage !== 'default.png' && newMem.citizenIdImage !== '') {
                const dup = allMembers.find(m => 
                    (m.citizenIdImage === newMem.citizenIdImage) ||
                    (m.citizenId && m.citizenId === newMem.citizenIdImage)
                );
                if (dup) {
                    throw new Error(`Cầu thủ ${newMem.name} trùng thông tin định danh (CCCD/Ảnh) với cầu thủ đội ${dup.teamName}.`);
                }
            }
        }
    }

    // Helper for date parsing
    parseDateTime(d, t) {
        if (!d || !t) return new Date();
        const dp = d.split('-');
        const year = parseInt(dp[0]);
        const month = parseInt(dp[1]) - 1;
        const day = parseInt(dp[2]);
        const m1 = t.match(/^(\d{1,2}):(\d{2})$/);
        const m2 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        let hour, minute;
        if (m2) {
            hour = parseInt(m2[1]);
            minute = parseInt(m2[2]);
            const ap = m2[3].toUpperCase();
            if (ap === 'PM' && hour < 12) hour += 12;
            if (ap === 'AM' && hour === 12) hour = 0;
        } else if (m1) {
            hour = parseInt(m1[1]);
            minute = parseInt(m1[2]);
        } else {
            hour = 0; minute = 0;
        }
        return new Date(year, month, day, hour, minute, 0, 0);
    }

    async validateMatchSchedule(tournamentId, matchId, date, time, location) {
        const tournament = await FootballRepository.findById(tournamentId);
        if (!tournament) throw new Error('Tournament not found');

        const isRealDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
        const isRealTime = typeof time === 'string' && (/^\d{1,2}:\d{2}$/.test(time) || /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(time));
        if (!isRealDate || !isRealTime) return { valid: true };

        // Use class helper
        const parseDateTime = this.parseDateTime;

        const pitchType = tournament.pitchType === '5' ? '5' : '7';
        const halfDuration = pitchType === '5' ? 20 : 35;
        const halftimeBreak = pitchType === '5' ? 15 : 10;
        const baseMinutes = (halfDuration * 2) + halftimeBreak;
        const bufferMinutes = 10;
        const restMinutes = 120;

        let currentTeams = { team1: null, team2: null };
        if (tournament.fixtures) {
            for (const g of tournament.fixtures) {
                const cm = (g.matches || []).find(x => x.id === matchId);
                if (cm) { currentTeams.team1 = cm.team1; currentTeams.team2 = cm.team2; break; }
            }
        }

        const newStart = parseDateTime(date, time).getTime();
        const newEnd = newStart + (baseMinutes + bufferMinutes) * 60000;

        if (tournament.fixtures) {
            for (const g of tournament.fixtures) {
                for (const m of (g.matches || [])) {
                    if (m.id === matchId) continue;
                    if (!m.date || !m.time) continue;
                    const validD = typeof m.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.date);
                    const validT = typeof m.time === 'string' && (/^\d{1,2}:\d{2}$/.test(m.time) || /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(m.time));
                    if (!validD || !validT) continue;

                    const existingStart = parseDateTime(m.date, m.time).getTime();
                    const existingEnd = existingStart + (baseMinutes + bufferMinutes) * 60000;

                    if (location && m.location && String(location).trim() !== '' && String(m.location).trim() !== '') {
                        const sameLocation = String(location).trim().toLowerCase() === String(m.location).trim().toLowerCase();
                        if (sameLocation) {
                            const overlaps = (newStart < existingEnd) && (existingStart < newEnd);
                            if (overlaps) {
                                return { valid: false, message: `Xung đột sân: Sân ${location} đã có trận ${m.team1} vs ${m.team2} lúc ${m.time} ngày ${m.date}.` };
                            }
                        }
                    }

                    const involvesTeam1 = currentTeams.team1 && (m.team1 === currentTeams.team1 || m.team2 === currentTeams.team1);
                    const involvesTeam2 = currentTeams.team2 && (m.team1 === currentTeams.team2 || m.team2 === currentTeams.team2);
                    if (involvesTeam1 || involvesTeam2) {
                        const diffMinutes = Math.abs(newStart - existingStart) / 60000;
                        if (diffMinutes < restMinutes) {
                            const tmsg = involvesTeam1 ? currentTeams.team1 : currentTeams.team2;
                            return { valid: false, message: `Thời gian nghỉ không đủ: Đội ${tmsg} có trận khác lúc ${m.time} ngày ${m.date}.` };
                        }
                    }
                }
            }
        }

        return { valid: true };
    }

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
            
            // Add slot for 3rd place match in the final round if we have enough teams
            if (count === 1 && processingTeams.length >= 4) {
                roundResults.push([null, null]);
            }
            
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
            // If it's the final round (numMatches === 1) and we have >= 4 teams, 
            // we actually want 2 matches (Final + 3rd Place)
            const actualMatchesInRound = (numMatches === 1 && processingTeams.length >= 4) ? 2 : numMatches;

            for (let m = 0; m < actualMatchesInRound; m++) {
                // For the first round, populate teams
                let t1 = null, t2 = null;
                if (r === 0) {
                    t1 = bracketTeams[m][0];
                    t2 = bracketTeams[m][1];
                }

                let matchLabel = `${roundName} - Trận ${m + 1}`;
                if (numMatches === 1 && m === 1) {
                    matchLabel = 'Tranh Hạng 3';
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
                    date: matchLabel,
                    bracketRound: r,       
                    bracketMatchIndex: m   
                });
            }
            fixtures.push({ group: roundName, matches: roundMatches });
        }

        return { bracketData: { teams: bracketTeams, results: results }, fixtures: fixtures };
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
    async getAllTournaments(filter = {}, page = null, limit = null) {
        return await FootballRepository.findAll(filter, page, limit);
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

        // Check for duplicate players
        if (teamData.members && teamData.members.length > 0) {
            await this.checkDuplicatePlayers(tournamentId, teamData.members);
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

        // Check for duplicate player
        await this.checkDuplicatePlayers(tournamentId, [memberData], teamId);

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

    async deleteTeam(tournamentId, teamId) {
        const tournament = await FootballRepository.findById(tournamentId);
        if (!tournament) throw new Error('Tournament not found');
        
        if (tournament.status && tournament.status !== 'upcoming') {
            throw new Error('Không thể xóa đội khi giải đang diễn ra hoặc đã kết thúc.');
        }
        
        let teamIndex = tournament.teams.findIndex(t => String(t.id) === String(teamId));
        if (teamIndex === -1) {
            teamIndex = tournament.teams.findIndex(t => t._id && String(t._id) === String(teamId));
        }
        if (teamIndex === -1) throw new Error('Team not found');
        
        const removedTeam = tournament.teams[teamIndex];
        const removedName = removedTeam.name;
        tournament.teams.splice(teamIndex, 1);
        tournament.markModified('teams');
        
        if (tournament.fixtures && tournament.fixtures.length > 0) {
            tournament.fixtures.forEach(group => {
                if (group.matches && group.matches.length) {
                    group.matches = group.matches.filter(m => m.team1 !== removedName && m.team2 !== removedName);
                }
            });
            tournament.markModified('fixtures');
        }
        
        // Recalculate standings based on remaining fixtures
        tournament.standings = this.calculateStandings(tournament);
        tournament.markModified('standings');
        
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
        let affectedMatches = [];

        if (tournament.fixtures) {
            for (const group of tournament.fixtures) {
                const matchIndex = group.matches.findIndex(m => m.id === matchId);
                if (matchIndex !== -1) {
                    const match = group.matches[matchIndex];
                    targetMatch = match;
                    affectedMatches.push(match);

                    const isGroupStage = group.group && (group.group.startsWith('Bảng') || group.group.startsWith('Group'));
                    if (isGroupStage && tournament.bracketData) {
                        throw new Error('Vòng bảng đã khóa sau khi tạo Knockout');
                    }
                    
                    // --- Schedule Conflict Validation ---
                    const proposedDate = matchData.date !== undefined ? matchData.date : match.date;
                    const proposedTime = matchData.time !== undefined ? matchData.time : match.time;
                    const proposedLocation = matchData.location !== undefined ? matchData.location : match.location;

                    if ((matchData.date || matchData.time || matchData.location) && proposedDate && proposedTime && proposedLocation) {
                        // Check for conflicts within this tournament
                        // Note: To check across ALL tournaments, we would need to query the DB, which requires more changes.
                        // For now, we restrict to the current tournament context.
                        if (tournament.fixtures) {
                            for (const g of tournament.fixtures) {
                                for (const m of g.matches) {
                                    if (m.id !== matchId && m.date === proposedDate && m.time === proposedTime && m.location === proposedLocation) {
                                        throw new Error(`Xung đột lịch: Sân ${proposedLocation} đã có trận đấu lúc ${proposedTime} ngày ${proposedDate}.`);
                                    }
                                }
                            }
                        }
                    }
                    // ------------------------------------

                    if (matchData.score1 !== undefined) {
                        match.score1 = (matchData.score1 === 'null' || matchData.score1 === '') ? null : matchData.score1;
                    }
                    if (matchData.score2 !== undefined) {
                        match.score2 = (matchData.score2 === 'null' || matchData.score2 === '') ? null : matchData.score2;
                    }
                    if (matchData.scorers1 !== undefined) match.scorers1 = matchData.scorers1;
                    if (matchData.scorers2 !== undefined) match.scorers2 = matchData.scorers2;
                    if (matchData.time !== undefined) match.time = matchData.time;
                    if (matchData.date !== undefined) match.date = matchData.date;
                    if (matchData.location !== undefined) match.location = matchData.location;
                    if (matchData.status !== undefined) match.status = matchData.status;
                    if (matchData.lineup1 !== undefined) match.lineup1 = matchData.lineup1;
                    if (matchData.lineup2 !== undefined) match.lineup2 = matchData.lineup2;
                    if (matchData.events !== undefined) match.events = matchData.events;

                    // --- KNOCKOUT PROGRESSION LOGIC ---
                    if (match.score1 !== null && match.score2 !== null && match.bracketRound !== undefined && match.bracketMatchIndex !== undefined) {
                         const currentRound = match.bracketRound;
                         const currentIndex = match.bracketMatchIndex;
                         
                         const s1 = parseInt(match.score1);
                         const s2 = parseInt(match.score2);
                         
                         // 1. Update Bracket Data (for UI) - Always update score
                         if (tournament.bracketData && tournament.bracketData.results) {
                             if (tournament.bracketData.results[currentRound]) {
                                 tournament.bracketData.results[currentRound][currentIndex] = [s1, s2];
                                 tournament.markModified('bracketData');
                             }
                         }

                         // 2. Advance Teams - ONLY IF FINISHED
                         if (match.status === 'finished') {
                             const nextRound = currentRound + 1;
                             const nextIndex = Math.floor(currentIndex / 2);
                             const isTeam1InNext = (currentIndex % 2 === 0);
                             
                             let winnerName = null;
                             if (s1 > s2) winnerName = match.team1;
                             else if (s2 > s1) winnerName = match.team2;

                             if (winnerName) {
                                 // Advance Winner
                                 for (const g of tournament.fixtures) {
                                     const nextMatch = g.matches.find(m => m.bracketRound === nextRound && m.bracketMatchIndex === nextIndex);
                                     if (nextMatch) {
                                         if (isTeam1InNext) nextMatch.team1 = winnerName;
                                         else nextMatch.team2 = winnerName;
                                         affectedMatches.push(nextMatch);
                                         break; 
                                     }
                                 }

                                 // Advance Loser (If Semi-Final)
                                 let isSemiFinal = false;
                                 for (const g of tournament.fixtures) {
                                     if (g.matches.some(m => m.id === matchId)) {
                                         if (g.group === 'Bán Kết') isSemiFinal = true;
                                         break;
                                     }
                                 }

                                 if (isSemiFinal) {
                                     const loserName = (winnerName === match.team1) ? match.team2 : match.team1;
                                     // Find 3rd Place Match (Next Round, Index 1)
                                     for (const g of tournament.fixtures) {
                                         const thirdPlaceMatch = g.matches.find(m => m.bracketRound === nextRound && m.bracketMatchIndex === 1);
                                         if (thirdPlaceMatch) {
                                             if (isTeam1InNext) thirdPlaceMatch.team1 = loserName;
                                             else thirdPlaceMatch.team2 = loserName;
                                             affectedMatches.push(thirdPlaceMatch);
                                             break;
                                         }
                                     }
                                 }
                             }
                         }
                    }
                    // ----------------------------------

                    matchFound = true;
                    // Note: We don't break immediately because we might need to check other groups?
                    // But typically match IDs are unique across groups.
                    break; 
                }
            }
        }
        
        if (!matchFound) throw new Error('Match not found');
        
        // Recalculate standings
        tournament.standings = this.calculateStandings(tournament);
        tournament.markModified('standings');
        tournament.markModified('teams');

        tournament.markModified('fixtures');
        const savedTournament = await tournament.save();
        return { tournament: savedTournament, affectedMatches };
    }

    async batchScheduleMatches(tournamentId, { startDate, startTime, matchDuration, concurrentMatches, stageName }) {
        const tournament = await FootballRepository.findById(tournamentId);
        if (!tournament) throw new Error('Tournament not found');

        // Helper to parse and format time
        let ptr = this.parseDateTime(startDate, startTime);

        // Flatten matches into queues by group
        let queues = [];
        
        if (tournament.fixtures) {
            tournament.fixtures.forEach(group => {
                // If stageName is specified, filter by it (simple substring check or exact match)
                // For "Vòng Bảng", we usually look for groups starting with "Bảng" or "Group"
                let isRelevantGroup = true;
                if (stageName === 'group_stage') {
                    isRelevantGroup = group.group.startsWith('Bảng') || group.group.startsWith('Group');
                } else if (stageName === 'knockout_stage') {
                    isRelevantGroup = !group.group.startsWith('Bảng') && !group.group.startsWith('Group');
                }
                
                if (isRelevantGroup && group.matches && group.matches.length > 0) {
                     // Filter unplayed matches
                     const pendingMatches = group.matches.filter(m => 
                         (m.score1 === null || m.score1 === undefined || m.score1 === '') &&
                         (m.score2 === null || m.score2 === undefined || m.score2 === '')
                     );
                     if (pendingMatches.length > 0) {
                         queues.push({ group: group.group, matches: pendingMatches });
                     }
                }
            });
        }

        // Scheduling Loop
        let hasMatches = true;
        while (hasMatches) {
            let scheduledCount = 0;
            let batchMatches = [];

            // Try to pick one match from each queue until we hit concurrentMatches
            // To ensure fairness and parallelism across groups, we iterate queues.
            for (let i = 0; i < queues.length; i++) {
                if (queues[i].matches.length > 0) {
                    batchMatches.push(queues[i].matches.shift()); 
                    scheduledCount++;
                    if (scheduledCount >= concurrentMatches) break;
                }
            }
            
            if (scheduledCount === 0) {
                hasMatches = false;
                break;
            }

            // Assign Time to this batch
            const timeString = `${ptr.getHours().toString().padStart(2, '0')}:${ptr.getMinutes().toString().padStart(2, '0')}`;
            const dateString = `${ptr.getFullYear()}-${(ptr.getMonth()+1).toString().padStart(2, '0')}-${ptr.getDate().toString().padStart(2, '0')}`;

            batchMatches.forEach(match => {
                match.date = dateString;
                match.time = timeString;
                // Location assignment logic could go here if we had a pool of locations
            });

            // Increment time for next batch
            ptr.setMinutes(ptr.getMinutes() + parseInt(matchDuration));
        }

        tournament.markModified('fixtures');
        return await tournament.save();
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
                if (m.score1 !== null && m.score2 !== null && m.score1 !== undefined && m.score2 !== undefined && m.score1 !== "" && m.score2 !== "" && m.status === 'finished') {
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

            // Update tournament.teams stats
            rankedTeams.forEach(rt => {
                const team = tournament.teams.find(t => t.name === rt.name);
                if (team) {
                    team.stats = {
                        p: rt.played,
                        w: rt.won,
                        d: rt.drawn,
                        l: rt.lost,
                        gd: rt.gd,
                        pts: rt.points
                    };
                }
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
        const tournament = await FootballRepository.findById(id);
        if (!tournament) throw new Error('Tournament not found');

        // Check Structure Integrity
        if (tournament.status === 'ongoing' || tournament.status === 'completed') {
            if (data.teamsCount !== undefined && data.teamsCount != tournament.teamsCount) {
                 throw new Error('Không thể thay đổi số lượng đội khi giải đang diễn ra hoặc đã kết thúc.');
            }
            if (data.mode !== undefined && data.mode !== tournament.mode) {
                 throw new Error('Không thể thay đổi thể thức thi đấu khi giải đang diễn ra hoặc đã kết thúc.');
            }
        }

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
