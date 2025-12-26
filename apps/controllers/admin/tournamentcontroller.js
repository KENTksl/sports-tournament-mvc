const express = require('express');
const router = express.Router();
const TournamentService = require('../../services/TournamentService');
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

class TournamentController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/', this.index.bind(this));
        this.router.post('/create', upload.single('image'), this.create.bind(this));
        this.router.post('/delete', this.delete.bind(this));
        this.router.post('/update', upload.single('image'), this.update.bind(this));
    }

    async index(req, res) {
        try {
            // Filter "Other" tournaments (exclude Football and legacy ones treated as Football)
            const tournaments = await TournamentService.getAllTournaments({ 
                sportType: { $exists: true, $ne: 'Football' } 
            });
            res.render('admin/tournament', { tournaments: tournaments });
        } catch (error) {
            console.error(error);
            res.status(500).send('Server Error');
        }
    }

    async create(req, res) {
        try {
            const { name, organizer, mode, teamsCount, description, sportType } = req.body;
            let image = 'default.png';
            if (req.file) {
                image = req.file.filename;
            }

            await TournamentService.createTournament({
                name,
                organizer,
                mode,
                teamsCount,
                description,
                image: image,
                status: 'upcoming',
                sportType: sportType || 'Other' // Default to 'Other' to avoid falling back to Schema default 'Football'
            });
            res.redirect('/admin/tournament');
        } catch (error) {
            console.error(error);
            res.status(500).send('Error creating tournament');
        }
    }

    async delete(req, res) {
        try {
            const { id } = req.body;
            await TournamentService.deleteTournament(id);
            res.redirect('/admin/tournament');
        } catch (error) {
            console.error(error);
            res.status(500).send('Error deleting tournament');
        }
    }

    async update(req, res) {
        try {
            const { id, name, organizer, mode, teamsCount, status, sportType } = req.body;
            const updateData = {
                name,
                organizer,
                mode,
                teamsCount,
                status,
                sportType: sportType || 'Other'
            };

            if (req.file) {
                updateData.image = req.file.filename;
            }

            await TournamentService.updateTournament(id, updateData);
            res.redirect('/admin/tournament');
        } catch (error) {
            console.error(error);
            res.status(500).send('Error updating tournament');
        }
    }
}

module.exports = new TournamentController().router;
