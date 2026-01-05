const express = require('express');
const router = express.Router();
const FootballService = require('../../../services/FootballService');
const FootballRepository = require('../../../repositories/FootballRepository');
const Fine = require(global.__basedir + "/apps/models/Fine"); // Import Fine model
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/tournaments');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

class FootballTournamentController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/', this.index.bind(this));
        this.router.post('/create', upload.single('image'), this.create.bind(this));
        this.router.post('/delete', this.delete.bind(this));
        this.router.post('/update', upload.single('image'), this.update.bind(this));
        
        // New Routes for Detail and Management
        this.router.get('/detail/:id', this.detail.bind(this));
        this.router.post('/add-team', upload.single('teamLogo'), this.addTeam.bind(this));
        this.router.post('/add-team-from-registration', this.addTeamFromRegistration.bind(this));
        this.router.post('/add-team-member', upload.single('memberAvatar'), this.addTeamMember.bind(this));
        this.router.post('/update-team', upload.single('teamLogo'), this.updateTeam.bind(this));
        this.router.post('/delete-team', this.deleteTeam.bind(this));
        this.router.post('/add-match', this.addMatch.bind(this));
        this.router.post('/update-match', this.updateMatch.bind(this));
        this.router.post('/generate-bracket', this.generateBracket.bind(this));
        this.router.post('/start', this.start.bind(this));
        this.router.post('/validate-match', this.validateMatch.bind(this));
        this.router.post('/check-player', this.checkPlayer.bind(this));
        this.router.post('/schedule-batch', this.scheduleBatch.bind(this));
    }

    async scheduleBatch(req, res) {
        try {
            const { tournamentId, startDate, startTime, matchDuration, concurrentMatches, stageName } = req.body;
            await FootballService.batchScheduleMatches(tournamentId, {
                startDate,
                startTime,
                matchDuration,
                concurrentMatches,
                stageName
            });
            res.redirect(`/admin/football/tournament/detail/${tournamentId}`);
        } catch (error) {
            console.error(error);
            res.status(500).send('Error scheduling matches: ' + error.message);
        }
    }

    async checkPlayer(req, res) {
        try {
            const { tournamentId, citizenId, memberName } = req.body;
            // Create a dummy member object for validation
            const memberData = {
                name: memberName || 'Unknown',
                citizenId: citizenId,
                citizenIdImage: citizenId // Check both fields
            };
            
            // We pass excludeTeamId as null because we are checking against ALL teams (assuming new player)
            // If editing an existing player, we might need to pass their teamId, but for now this is for "Add Member"
            await FootballService.checkDuplicatePlayers(tournamentId, [memberData]);
            
            res.json({ valid: true });
        } catch (error) {
            res.json({ valid: false, message: error.message });
        }
    }

    async validateMatch(req, res) {
        try {
            const { tournamentId, matchId, date, time, location } = req.body;
            const result = await FootballService.validateMatchSchedule(tournamentId, matchId, date, time, location);
            res.json(result);
        } catch (error) {
            console.error(error);
            res.status(500).json({ valid: false, message: error.message });
        }
    }

    async start(req, res) {
        try {
            const { tournamentId } = req.body;
            await FootballService.startTournament(tournamentId);
            res.redirect('/admin/football/tournament');
        } catch (error) {
            console.error(error);
            res.status(500).send('Error starting tournament: ' + error.message);
        }
    }

    async index(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 10;
            // No filter needed for FootballService as it points to FootballRepository -> FootballTournament
            const result = await FootballService.getAllTournaments({}, page, limit);
            res.render('admin/football/tournament', { 
                tournaments: result.data,
                currentPage: result.currentPage,
                totalPages: result.totalPages
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Server Error');
        }
    }

    async create(req, res) {
        try {
            const { name, organizer, mode, teamsCount, description, pitchType } = req.body;
            let image = 'default.png';
            if (req.file) {
                image = req.file.filename;
            }

            await FootballService.createTournament({
                name,
                organizer,
                mode,
                teamsCount: parseInt(teamsCount),
                description,
                image: image,
                status: 'upcoming',
                sportType: 'Football', // Still good to keep
                pitchType
            });
            res.redirect('/admin/football/tournament');
        } catch (error) {
            console.error(error);
            res.status(500).send('Error creating tournament');
        }
    }

    async delete(req, res) {
        try {
            const { id } = req.body;
            await FootballService.deleteTournament(id);
            res.redirect('/admin/football/tournament');
        } catch (error) {
            console.error(error);
            res.status(500).send('Error deleting tournament');
        }
    }

    async update(req, res) {
        try {
            const { id, name, organizer, mode, teamsCount, status, pitchType } = req.body;
            const updateData = {
                name,
                organizer,
                mode,
                teamsCount: parseInt(teamsCount),
                status,
                sportType: 'Football',
                pitchType
            };

            if (req.file) {
                updateData.image = req.file.filename;
            }

            await FootballService.updateTournament(id, updateData);
            res.redirect('/admin/football/tournament');
        } catch (error) {
            console.error(error);
            res.status(500).send('Error updating tournament');
        }
    }

    async detail(req, res) {
        try {
            const { id } = req.params;
            const tab = req.query.tab || 'overview'; // Default tab (overview is usually first, but fixtures is active in code?)
            // Wait, previous code didn't handle tabs. View handles active tab via JS or hash?
            // View uses Bootstrap tabs (client-side).
            // To support server-side pagination, we need to set active tab based on query param.
            
            const page = parseInt(req.query.page) || 1;
            const limit = 10;

            const tournament = await FootballService.getTournamentById(id);
            if (!tournament) {
                return res.status(404).send('Tournament not found');
            }

            // Matches (No Pagination as requested)
            // Flatten and split matches
            let groupMatches = [];
            let knockoutMatches = [];

            if (tournament.fixtures) {
                tournament.fixtures.forEach(group => {
                    const isKO = group.group && (group.group.includes('Tứ Kết') || group.group.includes('Bán Kết') || group.group.includes('Chung Kết') || group.group.startsWith('Vòng 1/'));
                    if (group.matches) {
                        group.matches.forEach(match => {
                            match.groupName = group.group;
                            if (isKO) {
                                knockoutMatches.push(match);
                            } else {
                                groupMatches.push(match);
                            }
                        });
                    }
                });
            }

            // Teams Pagination
            const isTeamTab = (tab === 'teams');
            const teamPage = isTeamTab ? page : 1;
            const allTeams = tournament.teams || [];
            const totalTeams = allTeams.length;
            const totalTeamPages = Math.ceil(totalTeams / limit);
            const paginatedTeams = allTeams.slice((teamPage - 1) * limit, teamPage * limit);

            res.render('admin/football/detail', { 
                tournament: tournament,
                
                // Matches (Full List)
                groupMatches: groupMatches,
                knockoutMatches: knockoutMatches,
                
                // Teams (Paginated)
                teams: paginatedTeams,
                teamsCurrentPage: teamPage,
                teamsTotalPages: totalTeamPages,

                currentTab: tab
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Server Error');
        }
    }

    async addTeam(req, res) {
        try {
            const { tournamentId, teamName } = req.body;
            let logo = 'default.png';
            if (req.file) {
                logo = req.file.filename;
            }

            const teamData = {
                id: Date.now().toString(),
                name: teamName,
                logo: logo,
                members: [],
                stats: { p: 0, w: 0, d: 0, l: 0, gd: 0, pts: 0 }
            };
            
            await FootballService.addTeam(tournamentId, teamData);
            res.redirect(`/admin/football/tournament/detail/${tournamentId}`);
        } catch (error) {
            console.error(error);
            res.status(500).send('Error adding team');
        }
    }

    async updateTeam(req, res) {
        try {
            const { tournamentId, teamId, teamName } = req.body;
            const updateData = {};
            
            if (teamName) updateData.name = teamName;
            if (req.file) {
                updateData.logo = req.file.filename;
            }

            await FootballService.updateTeam(tournamentId, teamId, updateData);
            res.redirect(`/admin/football/tournament/detail/${tournamentId}`);
        } catch (error) {
            console.error(error);
            res.status(500).send('Error updating team');
        }
    }

    async addTeamMember(req, res) {
        try {
            const { tournamentId, teamId, memberName, citizenId } = req.body;
                
                if (!memberName || memberName.trim() === '') {
                    throw new Error('Member name is required');
                }
                
                // Validate citizenId
                if (!citizenId || citizenId.trim() === '') {
                    throw new Error('Số CCCD/CMND là bắt buộc để tránh trùng lặp cầu thủ.');
                }

                let avatar = 'default-avatar.png';
            if (req.file) {
                avatar = req.file.filename;
            }

            const memberData = {
                id: Date.now().toString(),
                name: memberName,
                avatar: avatar,
                citizenId: citizenId,
                citizenIdImage: citizenId // For backward compatibility with Service check, though Service should update to check citizenId preference
            };

            await FootballService.addTeamMember(tournamentId, teamId, memberData);

            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.json({ success: true, member: memberData });
            }

            // Fallback for non-AJAX requests (though UI uses AJAX)
            res.redirect(`/admin/football/tournament/detail/${tournamentId}`);
        } catch (error) {
            console.error("Error in addTeamMember:", error);
            // Always try to return JSON if it looks like an API call
            if (req.xhr || req.headers.accept.indexOf('json') > -1 || req.headers['content-type']?.includes('multipart/form-data')) {
                return res.status(500).json({ success: false, message: error.message });
            }
            res.status(500).send('Error adding team member: ' + error.message);
        }
    }

    async addMatch(req, res) {
        try {
            const { tournamentId, homeTeam, awayTeam, matchDate } = req.body;
            const matchData = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                homeTeam,
                awayTeam,
                date: matchDate,
                homeScore: null,
                awayScore: null,
                status: 'scheduled'
            };
            await FootballService.addMatch(tournamentId, matchData);
            res.redirect(`/admin/football/tournament/detail/${tournamentId}`);
        } catch (error) {
            console.error(error);
            res.status(500).send('Error adding match');
        }
    }

    async addTeamFromRegistration(req, res) {
        try {
            const { tournamentId, registrationId } = req.body;
            const TeamRegistration = require('../../../models/TeamRegistration');
            const registration = await TeamRegistration.findById(registrationId);

            if (!registration) throw new Error('Hồ sơ không tồn tại');

            const teamData = {
                name: registration.teamName,
                logo: registration.logo,
                members: registration.members.map(m => ({
                    id: new Date().getTime().toString() + Math.random().toString(36).substr(2, 9),
                    name: m.name,
                    number: m.number,
                    position: m.position,
                    avatar: m.avatar,
                    citizenIdImage: m.citizenIdImage
                }))
            };

            await FootballService.addTeam(tournamentId, teamData);
            res.redirect(`/admin/football/tournament/detail/${tournamentId}`);
        } catch (error) {
            console.error(error);
            res.status(500).send('Lỗi thêm đội từ hồ sơ: ' + error.message);
        }
    }

    async deleteTeam(req, res) {
        try {
            const { tournamentId, teamId } = req.body;
            const updated = await FootballService.deleteTeam(tournamentId, teamId);
            res.json({ success: true, tournament: updated });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updateMatch(req, res) {
        try {
            const { tournamentId, matchId, score1, score2, time, date, location, lineup1, lineup2, events } = req.body;
            console.log('[TournamentController] Update Match Request:', {
                tournamentId, 
                matchId, 
                status: req.body.status, 
                hasScore1: req.body.score1 !== undefined, 
                hasEvents: req.body.events ? req.body.events.length : 0
            });
            const matchData = {};
            
            if (score1 !== undefined) {
                matchData.score1 = (score1 === '') ? null : parseInt(score1);
            }
            if (score2 !== undefined) {
                matchData.score2 = (score2 === '') ? null : parseInt(score2);
            }
            if (time) matchData.time = time;
            if (date) matchData.date = date;
            if (location) matchData.location = location;
            if (lineup1) matchData.lineup1 = lineup1;
            if (lineup2) matchData.lineup2 = lineup2;
            if (events) matchData.events = events;
            if (req.body.status) matchData.status = req.body.status;
            
            // Let Service handle status logic
            
            const result = await FootballService.updateMatch(tournamentId, matchId, matchData);
            const updatedTournament = result.tournament || result;
            const affectedMatches = result.affectedMatches || [];

            // --- Fine Generation Logic ---
            if (events && Array.isArray(events)) {
                try {
                    // Find the match in the updated tournament to get team names
                    let currentMatch = null;
                    let groupName = '';
                    if (updatedTournament.fixtures) {
                        for (const group of updatedTournament.fixtures) {
                            const m = group.matches.find(m => m.id === matchId);
                            if (m) {
                                currentMatch = m;
                                groupName = group.group || '';
                                break;
                            }
                        }
                    }

                    if (currentMatch) {
                        // Helper to find team ID by name
                        const getTeamId = (teamName) => {
                            const team = updatedTournament.teams.find(t => t.name === teamName);
                            return team ? team.id : null;
                        };

                        // 1. Get all existing fines for this match
                        const existingFines = await Fine.find({ matchId: matchId });
                        
                        // 2. Identify current card events
                        const cardEvents = events.filter(e => e.type === 'yellow' || e.type === 'red');
                        const processedFineIds = new Set();

                        // 3. Sync Logic
                        for (const event of cardEvents) {
                            const isYellow = event.type === 'yellow';
                            const amount = isYellow ? 100000 : 300000;
                            const teamName = event.team === 'team1' ? currentMatch.team1 : currentMatch.team2;
                            const teamId = getTeamId(teamName);
                            
                            if (teamId && event.playerId) {
                                // Try to match with an existing fine
                                // Logic: Same match, same player, same type.
                                // We might have multiple fines for same player (2 yellow cards).
                                // To handle multiple yellows, we need a way to map specific event to specific fine.
                                // Simplest way: Match by player+type, and consume the fine so it's not matched again for next event.
                                
                                const matchingFine = existingFines.find(f => 
                                    !processedFineIds.has(f._id.toString()) &&
                                    f.memberId === event.playerId &&
                                    f.type === (isYellow ? 'yellow_card' : 'red_card')
                                );

                                if (matchingFine) {
                                    // Update existing fine (e.g. if minute changed)
                                    // Don't change status if it's already paid? Maybe keep it simple.
                                    matchingFine.reason = `${isYellow ? 'Thẻ vàng' : 'Thẻ đỏ'} phút ${event.minute}`;
                                    await matchingFine.save();
                                    processedFineIds.add(matchingFine._id.toString());
                                } else {
                                    // Create new fine
                                    const fine = new Fine({
                                        memberId: event.playerId,
                                        memberName: event.playerName || 'Unknown',
                                        teamId: teamId,
                                        teamName: teamName,
                                        tournamentId: tournamentId,
                                        matchId: matchId,
                                        matchLabel: `${groupName} - ${currentMatch.team1} vs ${currentMatch.team2}`,
                                        type: isYellow ? 'yellow_card' : 'red_card',
                                        amount: amount,
                                        reason: `${isYellow ? 'Thẻ vàng' : 'Thẻ đỏ'} phút ${event.minute}`,
                                        status: 'pending'
                                    });
                                    await fine.save();
                                    // Don't add to processedFineIds since it's new, or add it if we push to existingFines? 
                                    // No need, we are done with this event.
                                }
                            }
                        }

                        // 4. Delete fines that were not matched (i.e., event was removed)
                        // ONLY delete if status is 'pending'. If 'paid', we should probably keep it or warn?
                        // For now, let's only delete pending fines to be safe.
                        for (const fine of existingFines) {
                            if (!processedFineIds.has(fine._id.toString())) {
                                if (fine.status === 'pending') {
                                    await Fine.findByIdAndDelete(fine._id);
                                    console.log(`Deleted fine ${fine._id} because event was removed`);
                                } else {
                                    console.log(`Skipped deleting paid fine ${fine._id}`);
                                }
                            }
                        }
                    }
                } catch (fineError) {
                    console.error('Error generating fines:', fineError);
                    // Don't block the response, just log error
                }
            }
            // -----------------------------

            const io = req.app.get('io');
            if (io) {
                // If we have a list of affected matches from Service (new logic), use it
                if (affectedMatches.length > 0) {
                    affectedMatches.forEach(m => {
                        // Construct payload from the actual match object to ensure we send latest state
                        const payload = {
                            score1: m.score1,
                            score2: m.score2,
                            status: m.status,
                            team1: m.team1,
                            team2: m.team2,
                            lineup1: m.lineup1,
                            lineup2: m.lineup2,
                            events: m.events,
                            time: m.time,
                            date: m.date,
                            location: m.location
                        };

                        io.to('tournament:' + String(tournamentId)).emit('match_updated', {
                            tournamentId,
                            matchId: m.id,
                            payload: payload
                        });
                        io.to('match:' + String(m.id)).emit('match_updated', {
                            tournamentId,
                            matchId: m.id,
                            payload: payload
                        });
                    });
                } else {
                    // Fallback for safety (though affectedMatches should include at least the target match)
                    // Find the actual updated status to emit via Socket
                    if (updatedTournament && updatedTournament.fixtures) {
                        let realStatus = null;
                        for (const g of updatedTournament.fixtures) {
                            const m = g.matches.find(m => m.id === matchId);
                            if (m) {
                                realStatus = m.status;
                                break;
                            }
                        }
                        if (realStatus) matchData.status = realStatus;
                    }

                    io.to('tournament:' + String(tournamentId)).emit('match_updated', {
                        tournamentId,
                        matchId,
                        payload: matchData
                    });
                    io.to('match:' + String(matchId)).emit('match_updated', {
                        tournamentId,
                        matchId,
                        payload: matchData
                    });
                }

                // Emit Standings Update
                if (updatedTournament && updatedTournament.standings) {
                    io.to('tournament:' + String(tournamentId)).emit('standings_updated', {
                        tournamentId,
                        standings: updatedTournament.standings
                    });
                }

                // Emit Bracket Update if applicable
                if (updatedTournament.bracketData) {
                    io.to('tournament:' + String(tournamentId)).emit('bracket_updated', {
                        tournamentId: tournamentId,
                        bracketData: updatedTournament.bracketData
                    });
                }
            }
            
            if (req.xhr || req.headers['content-type'] === 'application/json') {
                return res.json({ success: true });
            }

            res.redirect(`/admin/football/tournament/detail/${tournamentId}`);
        } catch (error) {
            console.error(error);
            if (req.xhr || req.headers['content-type'] === 'application/json') {
                return res.status(500).json({ success: false, message: error.message });
            }
            res.status(500).send('Error updating match: ' + error.message);
        }
    }

    async generateBracket(req, res) {
        try {
            const { tournamentId } = req.body;
            await FootballService.generateKnockoutStage(tournamentId);
            res.redirect(`/admin/football/tournament/detail/${tournamentId}`);
        } catch (error) {
            console.error(error);
            res.status(500).send('Error generating bracket: ' + error.message);
        }
    }
}

module.exports = new FootballTournamentController().router;
