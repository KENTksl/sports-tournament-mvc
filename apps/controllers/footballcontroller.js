const express = require('express');
const router = express.Router();
const FootballService = require('../services/FootballService');

class FootballController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/', this.index.bind(this));
        this.router.get('/detail/:id', this.detail.bind(this));
    }

    async index(req, res) {
        try {
            const tournaments = await FootballService.getAllTournaments();
            res.render('football', { tournaments: tournaments });
        } catch (error) {
            console.error(error);
            res.status(500).render('football', { tournaments: [] });
        }
    }

    async detail(req, res) {
        try {
            const tournament = await FootballService.getTournamentById(req.params.id);
            if (!tournament) {
                return res.status(404).send('Tournament not found');
            }
            res.render('football_detail', { tournament: tournament });
        } catch (error) {
            console.error(error);
            res.status(500).send('Server Error');
        }
    }
}

module.exports = new FootballController().router;