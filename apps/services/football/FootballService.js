const FootballRepository = require('../../repositories/football/FootballRepository');
const { 
    TOURNAMENT_STATUS, 
    MATCH_STATUS, 
    KNOCKOUT_ROUNDS 
} = require('../../common/constants');

function generateUniqueId(prefix = '') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

class FootballService {
    // --- Helper Methods ---

    /**
     * Check for duplicate players in the tournament
     * @param {string} tournamentId 
     * @param {Array} newMembers 
     * @param {string|null} excludeTeamId 
     */
    async checkDuplicatePlayers(tournamentId, newMembers, excludeTeamId = null) {
        if (!newMembers || newMembers.length === 0) return;
        
        const tournament = await FootballRepository.findById(tournamentId);
        if (!tournament || !tournament.teams) return;

        // Flatten all existing members into a single array with team info
        const allMembers = [];
        tournament.teams.forEach(t => {
            const tId = String(t.id || t._id);
            const exclId = excludeTeamId ? String(excludeTeamId) : null;
            
            if (exclId && tId === exclId) return;

            if (t.members) {
                t.members.forEach(m => allMembers.push({ ...m, teamName: t.name }));
            }
        });

        for (const newMem of newMembers) {
            // Priority 1: Check by Citizen ID
            if (newMem.citizenId && newMem.citizenId.trim() !== '') {
                const dup = allMembers.find(m => 
                    (m.citizenId && m.citizenId === newMem.citizenId) || 
                    (m.citizenIdImage && m.citizenIdImage === newMem.citizenId)
                );
                if (dup) {
                    throw new Error(`Cầu thủ ${newMem.name} (CCCD: ${newMem.citizenId}) đã đăng ký cho đội ${dup.teamName}.`);
                }
            }
            // Priority 2: Check by Citizen ID Image (Legacy/Fallback)
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

    /**
     * Parse date and time strings into a Date object
     * @param {string} d Date string (YYYY-MM-DD)
     * @param {string} t Time string (HH:MM or HH:MM AM/PM)
     * @returns {Date}
     */
    parseDateTime(d, t) {
        if (!d || !t) return new Date();
        
        const [year, month, day] = d.split('-').map(Number);
        
        const timeMatch12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        const timeMatch24 = t.match(/^(\d{1,2}):(\d{2})$/);
        
        let hour = 0, minute = 0;

        if (timeMatch12) {
            hour = parseInt(timeMatch12[1]);
            minute = parseInt(timeMatch12[2]);
            const period = timeMatch12[3].toUpperCase();
            
            if (period === 'PM' && hour < 12) hour += 12;
            if (period === 'AM' && hour === 12) hour = 0;
        } else if (timeMatch24) {
            hour = parseInt(timeMatch24[1]);
            minute = parseInt(timeMatch24[2]);
        }

        return new Date(year, month - 1, day, hour, minute, 0, 0);
    }

    /**
     * Validate match schedule for conflicts
     */
    async validateMatchSchedule(tournamentId, matchId, date, time, location) {
        const tournament = await FootballRepository.findById(tournamentId);
        if (!tournament) throw new Error('Tournament not found');

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const timeRegex24 = /^\d{1,2}:\d{2}$/;
        const timeRegex12 = /^\d{1,2}:\d{2}\s*(AM|PM)$/i;

        const isRealDate = typeof date === 'string' && dateRegex.test(date);
        const isRealTime = typeof time === 'string' && (timeRegex24.test(time) || timeRegex12.test(time));
        
        if (!isRealDate || !isRealTime) return { valid: true };

        const pitchType = tournament.pitchType === '5' ? '5' : '7';
        const halfDuration = pitchType === '5' ? 20 : 35;
        const halftimeBreak = pitchType === '5' ? 15 : 10;
        const baseMinutes = (halfDuration * 2) + halftimeBreak;
        const bufferMinutes = 10;
        const restMinutes = 120; // Required rest between matches for a team

        // Identify teams involved in the current match
        let currentTeams = { team1: null, team2: null };
        if (tournament.fixtures) {
            for (const g of tournament.fixtures) {
                const cm = (g.matches || []).find(x => x.id === matchId);
                if (cm) { 
                    currentTeams.team1 = cm.team1; 
                    currentTeams.team2 = cm.team2; 
                    break; 
                }
            }
        }

        const newStart = this.parseDateTime(date, time).getTime();
        const newEnd = newStart + (baseMinutes + bufferMinutes) * 60000;

        if (tournament.fixtures) {
            for (const g of tournament.fixtures) {
                for (const m of (g.matches || [])) {
                    if (m.id === matchId) continue;
                    if (!m.date || !m.time) continue;

                    const validD = typeof m.date === 'string' && dateRegex.test(m.date);
                    const validT = typeof m.time === 'string' && (timeRegex24.test(m.time) || timeRegex12.test(m.time));
                    if (!validD || !validT) continue;

                    const existingStart = this.parseDateTime(m.date, m.time).getTime();
                    const existingEnd = existingStart + (baseMinutes + bufferMinutes) * 60000;

                    // Location Conflict Check
                    if (location && m.location && String(location).trim() !== '' && String(m.location).trim() !== '') {
                        const sameLocation = String(location).trim().toLowerCase() === String(m.location).trim().toLowerCase();
                        if (sameLocation) {
                            const overlaps = (newStart < existingEnd) && (existingStart < newEnd);
                            if (overlaps) {
                                return { 
                                    valid: false, 
                                    message: `Xung đột sân: Sân ${location} đã có trận ${m.team1} vs ${m.team2} lúc ${m.time} ngày ${m.date}.` 
                                };
                            }
                        }
                    }

                    // Team Rest Time Check
                    const involvesTeam1 = currentTeams.team1 && (m.team1 === currentTeams.team1 || m.team2 === currentTeams.team1);
                    const involvesTeam2 = currentTeams.team2 && (m.team1 === currentTeams.team2 || m.team2 === currentTeams.team2);
                    
                    if (involvesTeam1 || involvesTeam2) {
                        const diffMinutes = Math.abs(newStart - existingStart) / 60000;
                        if (diffMinutes < restMinutes) {
                            const teamName = involvesTeam1 ? currentTeams.team1 : currentTeams.team2;
                            return { 
                                valid: false, 
                                message: `Thời gian nghỉ không đủ: Đội ${teamName} có trận khác lúc ${m.time} ngày ${m.date}.` 
                            };
                        }
                    }
                }
            }
        }

        return { valid: true };
    }

    /**
     * Generate Knockout Bracket Structure and Fixtures
     */
    generateKnockoutStructure(teams) {
        // 1. Prepare Bracket Teams (Pairs)
        const bracketTeams = [];
        const processingTeams = [...teams];
        
        // Ensure even number of teams
        if (processingTeams.length % 2 !== 0) processingTeams.push('BYE');

        for (let i = 0; i < processingTeams.length; i += 2) {
            bracketTeams.push([processingTeams[i], processingTeams[i+1]]);
        }

        // 2. Prepare Bracket Results (Empty structure for UI)
        const results = [];
        let count = bracketTeams.length;
        
        while (count >= 1) {
            let roundResults = [];
            for (let i = 0; i < count; i++) roundResults.push([null, null]);
            
            // Add slot for 3rd place match if applicable
            if (count === 1 && processingTeams.length >= 4) {
                roundResults.push([null, null]);
            }
            
            results.push(roundResults);
            count /= 2;
        }

        // 3. Prepare Fixtures
        const fixtures = [];
        const totalRounds = Math.ceil(Math.log2(processingTeams.length)); 
        
        for (let r = 0; r < totalRounds; r++) {
            const numMatches = processingTeams.length / Math.pow(2, r + 1);
            let roundName = '';
            
            if (numMatches === 1) roundName = KNOCKOUT_ROUNDS.FINAL;
            else if (numMatches === 2) roundName = KNOCKOUT_ROUNDS.SEMI_FINAL;
            else if (numMatches === 4) roundName = KNOCKOUT_ROUNDS.QUARTER_FINAL;
            else if (numMatches === 8) roundName = KNOCKOUT_ROUNDS.ROUND_OF_16;
            else if (numMatches === 16) roundName = KNOCKOUT_ROUNDS.ROUND_OF_32;
            else roundName = `Vòng 1/${numMatches}`;

            const roundMatches = [];
            const actualMatchesInRound = (numMatches === 1 && processingTeams.length >= 4) ? 2 : numMatches;

            for (let m = 0; m < actualMatchesInRound; m++) {
                let t1 = null, t2 = null;
                if (r === 0) {
                    t1 = bracketTeams[m][0];
                    t2 = bracketTeams[m][1];
                }

                let matchLabel = `${roundName} - Trận ${m + 1}`;
                if (numMatches === 1 && m === 1) {
                    matchLabel = KNOCKOUT_ROUNDS.THIRD_PLACE;
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

    /**
     * Generate Round Robin Schedule
     */
    getRoundRobinSchedule(teams) {
        const schedule = [];
        const workingTeams = [...teams];
        if (workingTeams.length % 2 !== 0) workingTeams.push(null); 

        const teamCount = workingTeams.length;
        const rounds = teamCount - 1; 
        const half = teamCount / 2;

        for (let round = 0; round < rounds; round++) {
            const roundMatches = [];
            for (let i = 0; i < half; i++) {
                const team1 = workingTeams[i];
                const team2 = workingTeams[teamCount - 1 - i];
                if (team1 !== null && team2 !== null) {
                    roundMatches.push({ t1: team1, t2: team2 });
                }
            }
            schedule.push(roundMatches);
            
            // Rotate teams (keep index 0 fixed)
            workingTeams.splice(1, 0, workingTeams.pop());
        }
        return schedule;
    }

    /**
     * Generate Knockout Bracket from Group Stage Standings
     */
    async generateKnockoutBracket(tournamentId) {
        const tournament = await this.getTournamentById(tournamentId);
        if (!tournament) throw new Error('Tournament not found');

        if (tournament.bracketData && tournament.bracketData.teams && tournament.bracketData.teams.length > 0) {
            throw new Error('Vòng đấu loại trực tiếp đã được tạo.');
        }

        const standings = this.calculateStandings(tournament);
        let knockoutTeams = [];

        // Logic to select teams based on group configuration
        if (standings.length === 1) {
            // Single Group: Top 4 (Semi-Finals) or Top 2 (Final)
            const group = standings[0];
            if (group.teams.length >= 4) {
                // 1 vs 4
                knockoutTeams.push(group.teams[0].name);
                knockoutTeams.push(group.teams[3].name);
                // 2 vs 3
                knockoutTeams.push(group.teams[1].name);
                knockoutTeams.push(group.teams[2].name);
            } else if (group.teams.length >= 2) {
                // 1 vs 2
                knockoutTeams.push(group.teams[0].name);
                knockoutTeams.push(group.teams[1].name);
            }
        } else if (standings.length > 0 && standings.length % 2 === 0) {
            // Even number of groups (A-B, C-D...): Cross pairing
            for (let i = 0; i < standings.length; i += 2) {
                const g1 = standings[i];
                const g2 = standings[i+1];
                
                // We need at least 2 teams in each group to do cross pairing (1st vs 2nd)
                if (g1.teams.length >= 2 && g2.teams.length >= 2) {
                    // Match 1: Group 1 Winner vs Group 2 Runner-up
                    knockoutTeams.push(g1.teams[0].name);
                    knockoutTeams.push(g2.teams[1].name);
                    
                    // Match 2: Group 2 Winner vs Group 1 Runner-up
                    knockoutTeams.push(g2.teams[0].name);
                    knockoutTeams.push(g1.teams[1].name);
                } else {
                    // Not enough teams, fallback to just taking winners
                    if(g1.teams.length > 0) knockoutTeams.push(g1.teams[0].name);
                    if(g2.teams.length > 0) knockoutTeams.push(g2.teams[0].name);
                }
            }
        } else {
            // Odd number of groups or complex structure: Take Top 2 from each
            // This is a simple fallback. Better logic would depend on specific rules (best 3rd place, etc.)
            standings.forEach(g => {
                if(g.teams.length > 0) knockoutTeams.push(g.teams[0].name);
                if(g.teams.length > 1) knockoutTeams.push(g.teams[1].name);
            });
        }

        if (knockoutTeams.length < 2) {
            throw new Error('Không đủ đội đủ điều kiện để tạo vòng đấu loại (cần ít nhất 2 đội).');
        }

        // Generate Structure
        const { bracketData, fixtures } = this.generateKnockoutStructure(knockoutTeams);

        // Update Tournament
        tournament.bracketData = bracketData;
        
        // Append new fixtures to existing ones
        if (!tournament.fixtures) tournament.fixtures = [];
        tournament.fixtures.push(...fixtures);

        tournament.markModified('bracketData');
        tournament.markModified('fixtures');
        
        await tournament.save();
    }

    /**
     * Generate Group Stage Fixtures
     */
    generateFixtures(teamsInput) {
        const fixtures = [];
        const groupLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        
        let teamNames = [];
        if (Array.isArray(teamsInput)) {
            teamNames = teamsInput;
        } else {
            for(let k=1; k<=teamsInput; k++) teamNames.push("Đội " + k);
        }

        const numTeams = teamNames.length;
        let numGroups = Math.ceil(numTeams / 4); 
        
        if (numTeams === 16 || numTeams === 32) {
            numGroups = 4;
        }

        // Small tournament: single group
        if (numTeams < 4) {
            const rounds = this.getRoundRobinSchedule(teamNames);
            let allMatches = [];
            
            rounds.forEach((roundMatches, roundIndex) => {
                roundMatches.forEach((match, matchIndex) => {
                    allMatches.push({
                        id: `m_${Date.now()}_A_r${roundIndex}_${matchIndex}`,
                        team1: match.t1, 
                        team2: match.t2, 
                        score1: null, 
                        score2: null,
                        scorers1: "", 
                        scorers2: "", 
                        lineup1: [], 
                        lineup2: [], 
                        events: [],
                        time: '20:00', 
                        date: `Lượt ${roundIndex + 1}`
                    });
                });
            });
            fixtures.push({ group: 'Bảng A', matches: allMatches });
            return fixtures;
        }

        // Multi-group tournament
        const teamsPerGroup = numTeams / numGroups;
        let currentTeamIndex = 0;

        for (let i = 0; i < numGroups; i++) {
            const groupName = `Bảng ${groupLabels[i]}`;
            let groupTeamNames = [];
            
            const limit = (i === numGroups - 1) ? (numTeams - currentTeamIndex) : Math.ceil(teamsPerGroup);
            
            for(let k=0; k < limit; k++) {
                if (currentTeamIndex < numTeams) {
                    groupTeamNames.push(teamNames[currentTeamIndex++]);
                }
            }
            
            if (groupTeamNames.length < 2) continue;
            
            const rounds = this.getRoundRobinSchedule(groupTeamNames);
            let allMatches = [];
            
            rounds.forEach((roundMatches, roundIndex) => {
                roundMatches.forEach((match, matchIndex) => {
                    allMatches.push({
                        id: generateUniqueId(`m_${i}_r${roundIndex}_${matchIndex}_`),
                        team1: match.t1, 
                        team2: match.t2, 
                        score1: null, 
                        score2: null,
                        scorers1: "", 
                        scorers2: "", 
                        lineup1: [], 
                        lineup2: [], 
                        events: [],
                        time: '20:00', 
                        date: `Lượt ${roundIndex + 1}`
                    });
                });
            });
            fixtures.push({ group: groupName, matches: allMatches });
        }
        return fixtures;
    }

    // --- Main Service Methods ---

    async createTournament(data) {
        return await FootballRepository.create(data);
    }

    async updateTournament(id, data) {
        return await FootballRepository.update(id, data);
    }

    async deleteTournament(id) {
        return await FootballRepository.delete(id);
    }

    async getAllTournaments(filter = {}, page = null, limit = null) {
        return await FootballRepository.findAll(filter, page, limit);
    }

    async startTournament(tournamentId) {
        const tournament = await FootballRepository.findById(tournamentId);
        if (!tournament) throw new Error('Tournament not found');

        if (tournament.status !== TOURNAMENT_STATUS.UPCOMING) {
            throw new Error('Giải đấu đã bắt đầu hoặc đã kết thúc.');
        }

        const validTeams = (tournament.teams || []).filter(t => t.name);
        if (validTeams.length < 2) {
            throw new Error('Cần ít nhất 2 đội để bắt đầu giải đấu.');
        }

        if (tournament.mode === 'Knockout') {
            const teamNames = validTeams.map(t => t.name);
            const { bracketData, fixtures } = this.generateKnockoutStructure(teamNames);
            tournament.bracketData = bracketData;
            tournament.fixtures = fixtures;
        } else {
            const teamNames = validTeams.map(t => t.name);
            const fixtures = this.generateFixtures(teamNames);
            tournament.fixtures = fixtures;
            tournament.standings = this.calculateStandings(tournament);
        }

        tournament.status = TOURNAMENT_STATUS.ONGOING;
        return await tournament.save();
    }

    async batchScheduleMatches(tournamentId, options) {
        const tournament = await FootballRepository.findById(tournamentId);
        if (!tournament) throw new Error('Tournament not found');
        // Placeholder implementation to avoid crash. 
        // Real implementation would iterate fixtures and set dates.
        return true;
    }

    async addTeam(tournamentId, teamData) {
        const tournament = await FootballRepository.findById(tournamentId);
        if (!tournament) throw new Error('Tournament not found');

        const validTeams = (tournament.teams || []).filter(t => t && t.name);
        
        if (validTeams.length >= tournament.teamsCount) {
            throw new Error(`Tournament is full. Maximum ${tournament.teamsCount} teams allowed.`);
        }

        const isDuplicate = validTeams.some(t => t.name.toLowerCase() === teamData.name.toLowerCase());
        if (isDuplicate) {
            throw new Error(`Team name "${teamData.name}" already exists in this tournament.`);
        }

        if (teamData.members && teamData.members.length > 0) {
            await this.checkDuplicatePlayers(tournamentId, teamData.members);
        }

        if (!teamData.stats) {
            teamData.stats = { p: 0, w: 0, d: 0, l: 0, gd: 0, pts: 0 };
        }
        
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
        
        if (tournament.status && tournament.status !== TOURNAMENT_STATUS.UPCOMING) {
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
                        const conflictCheck = await this.validateMatchSchedule(tournamentId, matchId, proposedDate, proposedTime, proposedLocation);
                        if (!conflictCheck.valid) {
                            throw new Error(conflictCheck.message);
                        }
                    }

                    // Update fields
                    if (matchData.score1 !== undefined) {
                        match.score1 = (matchData.score1 === 'null' || matchData.score1 === '') ? null : matchData.score1;
                    }
                    if (matchData.score2 !== undefined) {
                        match.score2 = (matchData.score2 === 'null' || matchData.score2 === '') ? null : matchData.score2;
                    }
                    if (matchData.date) match.date = matchData.date;
                    if (matchData.time) match.time = matchData.time;
                    if (matchData.location) match.location = matchData.location;
                    if (matchData.scorers1 !== undefined) match.scorers1 = matchData.scorers1;
                    if (matchData.scorers2 !== undefined) match.scorers2 = matchData.scorers2;
                    if (matchData.lineup1) match.lineup1 = matchData.lineup1;
                    if (matchData.lineup2) match.lineup2 = matchData.lineup2;
                    if (matchData.events) match.events = matchData.events;

                    // Status control:
                    // Only set 'finished' when explicitly requested via payload.
                    if (matchData.status === MATCH_STATUS.FINISHED) {
                        match.status = MATCH_STATUS.FINISHED;
                    } else if (match.status === MATCH_STATUS.FINISHED) {
                        // If previously finished but scores cleared, revert to scheduled
                        if (match.score1 === null || match.score2 === null) {
                            match.status = MATCH_STATUS.SCHEDULED;
                        }
                    } else {
                        // Keep existing status; default to 'scheduled' if undefined
                        if (!match.status) match.status = MATCH_STATUS.SCHEDULED;
                    }
                    
                    // Knockout Progression
                    const isKnockout = group.group && (
                        group.group === KNOCKOUT_ROUNDS.FINAL || 
                        group.group === KNOCKOUT_ROUNDS.SEMI_FINAL || 
                        group.group === KNOCKOUT_ROUNDS.QUARTER_FINAL || 
                        group.group.includes('Vòng') ||
                        group.group.includes('Bán Kết') ||
                        group.group.includes('Chung Kết')
                    );
                    
                    console.log(`[UpdateMatch] ID=${matchId} Group=${group.group} Status=${match.status} IsKO=${isKnockout} BracketData=${!!tournament.bracketData}`);

                    if (isKnockout && match.status === MATCH_STATUS.FINISHED && tournament.bracketData) {
                        console.log('[UpdateMatch] Calling advanceKnockoutWinner');
                        await this.advanceKnockoutWinner(tournament, match, group.group);
                    }
                }
            }
        }
        
        if (!targetMatch) throw new Error('Match not found');

        // Recalculate standings (always safe to do, minimal cost for small tournaments)
        tournament.standings = this.calculateStandings(tournament);
        tournament.markModified('fixtures');
        tournament.markModified('standings');
        tournament.markModified('bracketData');

        await tournament.save();
        return { tournament, affectedMatches };
    }

    /**
     * Advance winner to next round in Knockout Bracket
     */
    async advanceKnockoutWinner(tournament, match, groupName) {
        if (!tournament.bracketData || !tournament.bracketData.results) return;

        const roundIndex = match.bracketRound;
        const matchIndex = match.bracketMatchIndex;
        
        console.log(`[AdvanceKO] Round=${roundIndex} MatchIdx=${matchIndex} Score=${match.score1}:${match.score2}`);

        if (roundIndex === undefined || matchIndex === undefined) {
             console.log('[AdvanceKO] Missing bracket info');
             return;
        }

        const score1 = parseInt(match.score1);
        const score2 = parseInt(match.score2);
        
        if (isNaN(score1) || isNaN(score2)) return;

        let winner = null;
        let loser = null;
        if (score1 > score2) {
            winner = match.team1;
            loser = match.team2;
        } else if (score2 > score1) {
            winner = match.team2;
            loser = match.team1;
        } else {
             // Handle draw (Penalties logic not here yet, assuming draw not allowed in KO without pens)
             // If penalties events exist, determine winner?
             // For now, if draw, no winner advanced automatically unless we add penalty logic.
             return;
        }

        // Update Bracket Results (Visual)
        if (tournament.bracketData.results[roundIndex]) {
            if (tournament.bracketData.results[roundIndex][matchIndex]) {
                 // Format: [score1, score2] or similar. The original code was using [score1, score2, winner?]
                 // The array structure in bracketData.results seems to be [score1, score2]
                 tournament.bracketData.results[roundIndex][matchIndex] = [score1, score2];
            }
        }

        // Find Next Match
        // Next Round: roundIndex + 1
        // Next Match Index: floor(matchIndex / 2)
        // Position in Next Match: matchIndex % 2 (0 = team1, 1 = team2)
        
        const nextRoundIndex = roundIndex + 1;
        const nextMatchIndex = Math.floor(matchIndex / 2);
        const nextTeamPos = matchIndex % 2 === 0 ? 'team1' : 'team2';

        // Update in Fixtures
        if (tournament.fixtures) {
             let nextMatchFound = false;
             for (const g of tournament.fixtures) {
                 if (g.matches) {
                     // Find next match (Final/Next Round)
                     const nextMatch = g.matches.find(m => m.bracketRound === nextRoundIndex && m.bracketMatchIndex === nextMatchIndex);
                     if (nextMatch) {
                         console.log(`[AdvanceKO] Found next match: ${nextMatch.id} (${nextMatch.team1} vs ${nextMatch.team2})`);
                         nextMatch[nextTeamPos] = winner;
                         nextMatchFound = true;
                     }

                     // Update Loser for 3rd Place Match
                     if (nextMatchIndex === 0 && loser) {
                        const thirdPlaceMatch = g.matches.find(m => m.bracketRound === nextRoundIndex && m.bracketMatchIndex === 1)
                                             || g.matches.find(m => m.date && String(m.date).includes('Tranh Hạng 3')); // Fallback by name
                        if (thirdPlaceMatch) {
                            console.log(`[AdvanceKO] Found 3rd place match: ${thirdPlaceMatch.id}`);
                            thirdPlaceMatch[nextTeamPos] = loser;
                        }
                     }
                 }
             }
             if (!nextMatchFound) console.log('[AdvanceKO] Next match NOT found in fixtures');
        }

        // Update in Bracket Teams (Visual) if needed?
        // Usually bracketData.results implies progression, but bracketData.teams is initial pairs.
        // We might need to update the *next* round's visual representation if the frontend relies on it.
        // But usually frontend deduces next round teams from previous results.
        // However, looking at the code, we are updating the *Fixture* for the next round.
        
        // Ensure 3rd place match is populated from both semi-final losers
        this.ensureThirdPlaceFromSemis(tournament);
    }

    

    /**
     * Ensure 3rd place match teams are set from Semi-Final losers
     */
    ensureThirdPlaceFromSemis(tournament) {
        if (!tournament || !tournament.fixtures) return;
        
        let semifinals = [];
        let finalGroup = null;
        
        for (const g of tournament.fixtures) {
            if (!g || !g.matches) continue;
            const isSemi = g.group && (g.group.includes('Bán Kết'));
            const isFinal = g.group && (g.group.includes('Chung Kết'));
            if (isSemi) {
                semifinals = semifinals.concat(g.matches);
            }
            if (isFinal) {
                finalGroup = g;
            }
        }
        
        if (!finalGroup || !finalGroup.matches || semifinals.length === 0) return;
        
        const thirdPlaceMatch = finalGroup.matches.find(m => m.bracketMatchIndex === 1) 
            || finalGroup.matches.find(m => m.date && String(m.date).includes('Tranh Hạng 3'));
        if (!thirdPlaceMatch) return;
        
        // Order semis by bracket index to map losers consistently: [semi1 -> team1, semi2 -> team2]
        const semisOrdered = semifinals.slice().sort((a, b) => {
            const ai = typeof a.bracketMatchIndex === 'number' ? a.bracketMatchIndex : 0;
            const bi = typeof b.bracketMatchIndex === 'number' ? b.bracketMatchIndex : 0;
            return ai - bi;
        });
        
        const losers = [];
        for (let i = 0; i < semisOrdered.length; i++) {
            const m = semisOrdered[i];
            if (m && m.score1 !== null && m.score2 !== null) {
                const s1 = parseInt(m.score1);
                const s2 = parseInt(m.score2);
                if (!isNaN(s1) && !isNaN(s2)) {
                    if (s1 > s2) losers[i] = m.team2;
                    else if (s2 > s1) losers[i] = m.team1;
                }
            }
        }
        
        if (losers[0]) thirdPlaceMatch.team1 = losers[0];
        if (losers[1]) thirdPlaceMatch.team2 = losers[1];
    }

    calculateStandings(tournament) {
        if (!tournament.teams || tournament.teams.length === 0) return [];

        // If tournament has groups (fixtures define groups), we calculate per group
        let hasGroups = false;
        let groupStats = {}; // Map<GroupName, Map<TeamName, Stats>>

        if (tournament.fixtures && tournament.fixtures.length > 0) {
            tournament.fixtures.forEach(group => {
                // Only consider groups that are "Group Stage" like
                if (group.group && (group.group.startsWith('Bảng') || group.group.startsWith('Group'))) {
                    hasGroups = true;
                    if (!groupStats[group.group]) {
                        groupStats[group.group] = {};
                    }
                    
                    // Initialize stats for teams in this group if we can identify them
                    // We identify teams by looking at matches
                    if (group.matches) {
                        group.matches.forEach(m => {
                            [m.team1, m.team2].forEach(tName => {
                                if (tName && !groupStats[group.group][tName]) {
                                    // Find team logo/id from master list
                                    const masterTeam = tournament.teams.find(t => t.name === tName);
                                    groupStats[group.group][tName] = {
                                        id: masterTeam ? masterTeam.id : null,
                                        name: tName,
                                        logo: masterTeam ? masterTeam.logo : 'default.png',
                                        played: 0, won: 0, drawn: 0, lost: 0, // 'played' matches 'p' in view? View uses played, won, drawn, lost
                                        gf: 0, ga: 0, gd: 0, points: 0 // View uses points
                                    };
                                }
                            });
                        });
                    }
                }
            });
        }

        // If no groups found in fixtures (e.g. League mode or not started), fallback to single table
        if (!hasGroups) {
             // Treat as one single group named "Bảng Xếp Hạng"
             const groupName = "Bảng Xếp Hạng";
             groupStats[groupName] = {};
             tournament.teams.forEach(t => {
                if (t && t.name) {
                    groupStats[groupName][t.name] = { 
                        id: t.id,
                        name: t.name, 
                        logo: t.logo, 
                        played: 0, won: 0, drawn: 0, lost: 0, 
                        gf: 0, ga: 0, gd: 0, points: 0 
                    };
                }
            });
        }

        // Calculate stats
        if (tournament.fixtures) {
            tournament.fixtures.forEach(group => {
                const isGroupStage = group.group && (group.group.startsWith('Bảng') || group.group.startsWith('Group'));
                // Use specific group if Group Stage, else use "Bảng Xếp Hạng" if it's a league (all matches contribute to one table)
                // If it's a knockout round in a mixed tournament, ignore for standings
                
                let targetGroupName = null;
                if (hasGroups) {
                    if (isGroupStage) targetGroupName = group.group;
                } else {
                    // In League mode, we might have rounds "Vòng 1", "Vòng 2", etc.
                    // If tournament.mode is League, all rounds contribute to the single table
                    if (tournament.mode === 'League') {
                         targetGroupName = "Bảng Xếp Hạng";
                    } else if (isGroupStage) {
                         // Fallback
                         targetGroupName = group.group;
                    }
                }

                if (targetGroupName && groupStats[targetGroupName]) {
                    group.matches.forEach(m => {
                        if (m.status === MATCH_STATUS.FINISHED && m.score1 !== null && m.score2 !== null) {
                            const s1 = parseInt(m.score1);
                            const s2 = parseInt(m.score2);
                            const t1 = m.team1;
                            const t2 = m.team2;

                            // Helper to update stats
                            const update = (teamName, GF, GA) => {
                                if (groupStats[targetGroupName][teamName]) {
                                    const s = groupStats[targetGroupName][teamName];
                                    s.played++;
                                    s.gf += GF;
                                    s.ga += GA;
                                    s.gd = s.gf - s.ga;
                                    if (GF > GA) { s.won++; s.points += 3; }
                                    else if (GA > GF) { s.lost++; }
                                    else { s.drawn++; s.points += 1; }
                                }
                            };

                            update(t1, s1, s2);
                            update(t2, s2, s1);
                        }
                    });
                }
            });
        }

        // Convert to array of groups
        const result = Object.keys(groupStats).map(gName => {
            const teams = Object.values(groupStats[gName]).sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.gd !== a.gd) return b.gd - a.gd;
                return b.gf - a.gf;
            });
            return {
                groupName: gName,
                teams: teams
            };
        });

        // Sort groups by name (Group A, Group B...)
        result.sort((a, b) => a.groupName.localeCompare(b.groupName));

        return result;
    }

    async getTournamentById(id) {
        return await FootballRepository.findById(id);
    }
}

module.exports = new FootballService();
