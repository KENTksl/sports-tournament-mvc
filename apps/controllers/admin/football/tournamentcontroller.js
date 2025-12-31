const express = require('express');
const router = express.Router();
const FootballService = require('../../../services/FootballService');
const multer = require('multer');
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
        this.router.post('/add-match', this.addMatch.bind(this));
        this.router.post('/update-match', this.updateMatch.bind(this));
        this.router.post('/generate-bracket', this.generateBracket.bind(this));
        this.router.post('/start', this.start.bind(this));
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
            // No filter needed for FootballService as it points to FootballRepository -> FootballTournament
            const tournaments = await FootballService.getAllTournaments({});
            res.render('admin/football/tournament', { tournaments: tournaments });
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
            const tournament = await FootballService.getTournamentById(id);
            if (!tournament) {
                return res.status(404).send('Tournament not found');
            }
            res.render('admin/football/detail', { tournament: tournament });
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
            const { tournamentId, teamId, memberName } = req.body;
                
                if (!memberName || memberName.trim() === '') {
                    throw new Error('Member name is required');
                }

                let avatar = 'default-avatar.png';
            if (req.file) {
                avatar = req.file.filename;
            }

            const memberData = {
                id: Date.now().toString(),
                name: memberName,
                avatar: avatar
            };

            await FootballService.addTeamMember(tournamentId, teamId, memberData);

            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.json({ success: true, member: memberData });
            }

            res.redirect(`/admin/football/tournament/detail/${tournamentId}`);
        } catch (error) {
            console.error("Error in addTeamMember:", error);
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(500).json({ success: false, message: 'Error adding team member: ' + error.message });
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

    async updateMatch(req, res) {
        try {
            const { tournamentId, matchId, score1, score2, time, date, lineup1, lineup2, events } = req.body;
            const matchData = {};
            
            if (score1 !== undefined && score1 !== '') matchData.score1 = parseInt(score1);
            if (score2 !== undefined && score2 !== '') matchData.score2 = parseInt(score2);
            if (time) matchData.time = time;
            if (date) matchData.date = date;
            if (lineup1) matchData.lineup1 = lineup1;
            if (lineup2) matchData.lineup2 = lineup2;
            if (events) matchData.events = events;
            // Auto status
            const hasScores = (matchData.score1 !== undefined && matchData.score1 !== null) && (matchData.score2 !== undefined && matchData.score2 !== null);
            if (hasScores) matchData.status = 'finished';
            else if (events && events.length) matchData.status = 'live';
            else matchData.status = 'scheduled';
            
            await FootballService.updateMatch(tournamentId, matchId, matchData);
            const io = req.app.get('io');
            if (io) {
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
            
            if (req.xhr || req.headers['content-type'] === 'application/json') {
                return res.json({ success: true });
            }

            res.redirect(`/admin/football/tournament/detail/${tournamentId}`);
        } catch (error) {
            console.error(error);
            if (req.xhr || req.headers['content-type'] === 'application/json') {
                return res.status(500).json({ success: false, message: 'Error updating match' });
            }
            res.status(500).send('Error updating match');
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
