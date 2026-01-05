const express = require('express');
const router = express.Router();
const multer = require('multer');
const FootballService = require('../../../services/football/FootballService');
const FineService = require('../../../services/football/FineService');
const TeamRegistration = require('../../../models/football/TeamRegistration');

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
        
        // Detail and Management Routes
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

    async index(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 10;
            const result = await FootballService.getAllTournaments({}, page, limit);
            res.render('admin/football/tournament', { 
                tournaments: result.data,
                currentPage: result.currentPage,
                totalPages: result.totalPages
            });
        } catch (error) {
            console.error('Error fetching tournaments:', error);
            res.status(500).send('Server Error');
        }
    }

    async create(req, res) {
        try {
            const { name, organizer, mode, teamsCount, description, pitchType } = req.body;
            const image = req.file ? req.file.filename : 'default.png';

            await FootballService.createTournament({
                name,
                organizer,
                mode,
                teamsCount: parseInt(teamsCount),
                description,
                image,
                status: 'upcoming',
                sportType: 'Football',
                pitchType
            });
            res.redirect('/admin/football/tournament');
        } catch (error) {
            console.error('Error creating tournament:', error);
            res.status(500).send('Error creating tournament: ' + error.message);
        }
    }

    async delete(req, res) {
        try {
            const { id } = req.body;
            await FootballService.deleteTournament(id);
            res.redirect('/admin/football/tournament');
        } catch (error) {
            console.error('Error deleting tournament:', error);
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
            console.error('Error updating tournament:', error);
            res.status(500).send('Error updating tournament');
        }
    }

    async detail(req, res) {
        try {
            const { id } = req.params;
            const tab = req.query.tab || 'overview';
            const page = parseInt(req.query.page) || 1;
            const limit = 10;

            const tournament = await FootballService.getTournamentById(id);
            if (!tournament) {
                return res.status(404).send('Tournament not found');
            }

            // Matches Logic
            let groupMatches = [];
            let knockoutMatches = [];

            if (tournament.fixtures) {
                tournament.fixtures.forEach(group => {
                    const isKO = group.group && (
                        group.group.includes('Tứ Kết') || 
                        group.group.includes('Bán Kết') || 
                        group.group.includes('Chung Kết') || 
                        group.group.startsWith('Vòng 1/')
                    );
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
                tournament,
                groupMatches,
                knockoutMatches,
                teams: paginatedTeams,
                teamsCurrentPage: teamPage,
                teamsTotalPages: totalTeamPages,
                currentTab: tab
            });
        } catch (error) {
            console.error('Error fetching tournament details:', error);
            res.status(500).send('Server Error');
        }
    }

    async addTeam(req, res) {
        try {
            const { tournamentId, teamName } = req.body;
            const logo = req.file ? req.file.filename : 'default.png';

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
            console.error('Error adding team:', error);
            res.status(500).send('Error adding team');
        }
    }

    async addTeamFromRegistration(req, res) {
        try {
            const { tournamentId, registrationId } = req.body;
            const registration = await TeamRegistration.findById(registrationId);

            if (!registration) throw new Error('Hồ sơ không tồn tại');

            const teamData = {
                name: registration.teamName,
                logo: registration.logo,
                members: registration.members.map(m => ({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
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
            console.error('Error adding team from registration:', error);
            res.status(500).send('Lỗi thêm đội từ hồ sơ: ' + error.message);
        }
    }

    async addTeamMember(req, res) {
        try {
            const { tournamentId, teamId, memberName, citizenId } = req.body;
                
            if (!memberName || !memberName.trim()) {
                throw new Error('Member name is required');
            }
            
            if (!citizenId || !citizenId.trim()) {
                throw new Error('Số CCCD/CMND là bắt buộc để tránh trùng lặp cầu thủ.');
            }

            const avatar = req.file ? req.file.filename : 'default-avatar.png';

            const memberData = {
                id: Date.now().toString(),
                name: memberName,
                avatar: avatar,
                citizenId: citizenId,
                citizenIdImage: citizenId
            };

            await FootballService.addTeamMember(tournamentId, teamId, memberData);

            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.json({ success: true, member: memberData });
            }

            res.redirect(`/admin/football/tournament/detail/${tournamentId}`);
        } catch (error) {
            console.error("Error in addTeamMember:", error);
            if (req.xhr || req.headers.accept.indexOf('json') > -1 || req.headers['content-type']?.includes('multipart/form-data')) {
                return res.status(500).json({ success: false, message: error.message });
            }
            res.status(500).send('Error adding team member: ' + error.message);
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
            console.error('Error updating team:', error);
            res.status(500).send('Error updating team');
        }
    }

    async deleteTeam(req, res) {
        try {
            const { tournamentId, teamId } = req.body;
            const updated = await FootballService.deleteTeam(tournamentId, teamId);
            res.json({ success: true, tournament: updated });
        } catch (error) {
            console.error('Error deleting team:', error);
            res.status(500).json({ success: false, message: error.message });
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
            console.error('Error adding match:', error);
            res.status(500).send('Error adding match');
        }
    }

    async updateMatch(req, res) {
        try {
            const { tournamentId, matchId, score1, score2, time, date, location, lineup1, lineup2, events } = req.body;
            
            const matchData = {};
            if (score1 !== undefined) matchData.score1 = (score1 === '') ? null : parseInt(score1);
            if (score2 !== undefined) matchData.score2 = (score2 === '') ? null : parseInt(score2);
            if (time) matchData.time = time;
            if (date) matchData.date = date;
            if (location) matchData.location = location;
            if (lineup1) matchData.lineup1 = lineup1;
            if (lineup2) matchData.lineup2 = lineup2;
            if (events) matchData.events = events;
            if (req.body.status) matchData.status = req.body.status;
            
            const result = await FootballService.updateMatch(tournamentId, matchId, matchData);
            const updatedTournament = result.tournament || result;
            const affectedMatches = result.affectedMatches || [];

            // Sync fines using dedicated service
            if (events && Array.isArray(events)) {
                await FineService.syncMatchFines(updatedTournament, matchId, events);
            }

            res.json({ success: true, affectedMatches });
        } catch (error) {
            console.error('Error updating match:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async generateBracket(req, res) {
        try {
            const { tournamentId } = req.body;
            await FootballService.generateKnockoutBracket(tournamentId);
            res.redirect(`/admin/football/tournament/detail/${tournamentId}`);
        } catch (error) {
            console.error('Error generating bracket:', error);
            res.status(500).send('Error generating bracket: ' + error.message);
        }
    }

    async start(req, res) {
        try {
            const { tournamentId } = req.body;
            await FootballService.startTournament(tournamentId);
            res.redirect('/admin/football/tournament');
        } catch (error) {
            console.error('Error starting tournament:', error);
            res.status(500).send('Error starting tournament: ' + error.message);
        }
    }

    async validateMatch(req, res) {
        try {
            const { tournamentId, matchId, date, time, location } = req.body;
            const result = await FootballService.validateMatchSchedule(tournamentId, matchId, date, time, location);
            res.json(result);
        } catch (error) {
            console.error('Error validating match:', error);
            res.status(500).json({ valid: false, message: error.message });
        }
    }

    async checkPlayer(req, res) {
        try {
            const { tournamentId, citizenId, memberName } = req.body;
            const memberData = {
                name: memberName || 'Unknown',
                citizenId: citizenId,
                citizenIdImage: citizenId
            };
            
            await FootballService.checkDuplicatePlayers(tournamentId, [memberData]);
            res.json({ valid: true });
        } catch (error) {
            res.json({ valid: false, message: error.message });
        }
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
            console.error('Error scheduling matches:', error);
            res.status(500).send('Error scheduling matches: ' + error.message);
        }
    }
}

module.exports = new FootballTournamentController().router;
