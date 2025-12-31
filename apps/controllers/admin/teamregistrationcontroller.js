const TeamRegistration = require('../../models/TeamRegistration');
const Tournament = require('../../models/Tournament');
const FootballService = require('../../services/FootballService');
const express = require("express");
const router = express.Router();
const fs = require('fs');
const path = require('path');

class TeamRegistrationController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/', this.index.bind(this));
        this.router.get('/create-fake', this.createFake.bind(this));
        this.router.get('/api/approved', this.getApprovedTeams.bind(this));
        this.router.get('/:id', this.detail.bind(this));
        this.router.post('/:id/approve', this.approve.bind(this));
        this.router.post('/:id/reject', this.reject.bind(this));
    }
    
    // 1. List all registrations (Hồ sơ đội tuyển)
    async index(req, res) {
        try {
            const filter = {};
            if (req.query.status && req.query.status !== 'all') {
                filter.status = req.query.status;
            }
            if (req.query.tournamentId && req.query.tournamentId !== 'all') {
                filter.tournamentId = req.query.tournamentId;
            }
            
            const registrations = await TeamRegistration.find(filter).sort({ submittedAt: -1 }).populate('tournamentId');
            const tournaments = await FootballService.getAllTournaments();
            
            res.render('admin/team_registration/index', { 
                registrations, 
                tournaments,
                filterStatus: req.query.status || 'all',
                filterTournamentId: req.query.tournamentId || 'all',
                layout: 'admin/layout' 
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Server Error');
        }
    }

    // 2. View Detail
    async detail(req, res) {
        try {
            const registration = await TeamRegistration.findById(req.params.id).populate('tournamentId');
            if (!registration) return res.status(404).send('Not Found');
            res.render('admin/team_registration/detail', { 
                registration,
                layout: 'admin/layout',
                error: req.query.error || null
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Server Error');
        }
    }

    // 3. Approve Registration
    async approve(req, res) {
        try {
            const { id } = req.params;
            const registration = await TeamRegistration.findById(id);
            
            if (!registration) return res.status(404).send('Not Found');

            // Helper function to copy file
            const copyFile = (filename) => {
                if (!filename || filename === 'default.png' || filename === 'default-avatar.png') return;
                
                const srcPath = path.join(__basedir, 'public', 'uploads', 'avatars', filename);
                const destPath = path.join(__basedir, 'public', 'uploads', 'tournaments', filename);

                // Check if source exists
                if (fs.existsSync(srcPath)) {
                    // Create destination directory if not exists
                    const destDir = path.dirname(destPath);
                    if (!fs.existsSync(destDir)) {
                        fs.mkdirSync(destDir, { recursive: true });
                    }
                    
                    // Copy file
                    fs.copyFileSync(srcPath, destPath);
                }
            };

            // If there's a tournamentId, add the team to the tournament
            if (registration.tournamentId) {
                // Copy Logo
                copyFile(registration.logo);
                
                // Copy Member Images
                if (registration.members) {
                    registration.members.forEach(m => {
                        copyFile(m.avatar);
                        copyFile(m.citizenIdImage);
                    });
                }

                const teamData = {
                    name: registration.teamName,
                    logo: registration.logo,
                    members: registration.members.map(m => ({
                        name: m.name,
                        number: m.number,
                        position: m.position,
                        avatar: m.avatar,
                        citizenIdImage: m.citizenIdImage
                    }))
                };
                
                // Use FootballService to add team
                await FootballService.addTeam(registration.tournamentId, teamData);
            }

            await TeamRegistration.findByIdAndUpdate(id, { 
                status: 'approved',
                approvedAt: new Date()
            });
            
            // Redirect based on whether it was attached to a tournament
            if (registration.tournamentId) {
                res.redirect(`/admin/football/tournament/detail/${registration.tournamentId}`);
            } else {
                res.redirect('/admin/team-registration');
            }
        } catch (error) {
            console.error(error);
            // Redirect back to detail page with error message
            res.redirect(`/admin/team-registration/${req.params.id}?error=${encodeURIComponent(error.message)}`);
        }
    }

    // 4. Reject Registration
    async reject(req, res) {
        try {
            const { id } = req.params;
            await TeamRegistration.findByIdAndUpdate(id, { status: 'rejected' });
            res.redirect('/admin/team-registration');
        } catch (error) {
            console.error(error);
            res.status(500).send('Server Error');
        }
    }

    // 5. API: Get Approved Teams (For Ajax call in Tournament Detail)
    async getApprovedTeams(req, res) {
        try {
            const teams = await TeamRegistration.find({ status: 'approved' }).sort({ teamName: 1 });
            res.json({ success: true, teams });
        } catch (error) {
            res.json({ success: false, message: error.message });
        }
    }

    // 6. Create Fake Data (For testing)
    async createFake(req, res) {
        try {
            let targetTournamentId = null;
            const requestedTournamentId = req.query.tournamentId;

            if (requestedTournamentId && requestedTournamentId !== 'all') {
                targetTournamentId = requestedTournamentId;
            } else {
                // Find a random upcoming tournament to assign if not specified
                const tournaments = await FootballService.getAllTournaments({ status: 'upcoming' });
                if (tournaments && tournaments.length > 0) {
                    const randIndex = Math.floor(Math.random() * tournaments.length);
                    targetTournamentId = tournaments[randIndex]._id;
                }
            }

            const fakeTeam = new TeamRegistration({
                teamName: 'FC Test ' + Date.now().toString().slice(-6),
                representative: 'Nguyen Van A',
                phone: '0901234567',
                email: 'test@gmail.com',
                description: 'Doi bong phong trao',
                tournamentId: targetTournamentId,
                members: [
                    { name: 'Cau thu 1', number: 10, position: 'Cầu thủ', avatar: 'default-avatar.png', citizenIdImage: 'default.png' },
                    { name: 'Cau thu 2', number: 7, position: 'Cầu thủ', avatar: 'default-avatar.png', citizenIdImage: 'default.png' },
                    { name: 'Thu mon', number: 1, position: 'Cầu thủ', avatar: 'default-avatar.png', citizenIdImage: 'default.png' }
                ],
                status: 'pending'
            });
            await fakeTeam.save();
            
            // Redirect back with the same filter
            const redirectUrl = requestedTournamentId && requestedTournamentId !== 'all' 
                ? `/admin/team-registration?tournamentId=${requestedTournamentId}` 
                : '/admin/team-registration';
                
            res.redirect(redirectUrl);
        } catch(e) {
            res.send(e.message);
        }
    }
}

module.exports = new TeamRegistrationController().router;
