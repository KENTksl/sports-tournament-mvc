const express = require('express');
const router = express.Router();
const FootballService = require('../../services/football/FootballService');

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
            const page = parseInt(req.query.page) || 1;
            const limit = 6;
            const result = await FootballService.getAllTournaments({}, page, limit);
            res.render('football/index', { 
                tournaments: result.data, 
                currentPage: result.currentPage,
                totalPages: result.totalPages
            });
        } catch (error) {
            console.error(error);
            res.status(500).render('football/index', { tournaments: [], currentPage: 1, totalPages: 0 });
        }
    }

    async detail(req, res) {
        try {
            const { id } = req.params;
            const tab = req.query.tab || 'fixtures';
            const page = parseInt(req.query.page) || 1;
            const limit = 10;

            const tournament = await FootballService.getTournamentById(id);
            if (!tournament) {
                return res.status(404).send('Tournament not found');
            }

            // Flatten fixtures matches for pagination
            let allMatches = [];
            if (tournament.fixtures) {
                tournament.fixtures.forEach(group => {
                    if (group.matches) {
                        group.matches.forEach(match => {
                            match.groupName = group.group;
                            allMatches.push(match);
                        });
                    }
                });
            }

            // Matches Pagination
            const matchesPage = (tab === 'fixtures') ? page : 1;
            const totalMatches = allMatches.length;
            const matchesTotalPages = Math.ceil(totalMatches / limit);
            const paginatedMatches = allMatches.slice((matchesPage - 1) * limit, matchesPage * limit);

            // Teams Pagination
            const teamsPage = (tab === 'teams') ? page : 1;
            const allTeams = tournament.teams || [];
            const totalTeams = allTeams.length;
            const teamsTotalPages = Math.ceil(totalTeams / limit);
            const paginatedTeams = allTeams.slice((teamsPage - 1) * limit, teamsPage * limit);

            res.render('football/detail', { 
                tournament: tournament,
                
                // Matches
                matches: paginatedMatches,
                currentPage: matchesPage,
                totalPages: matchesTotalPages,
                matchesCurrentPage: matchesPage,
                matchesTotalPages: matchesTotalPages,

                // Teams
                teams: paginatedTeams,
                teamsCurrentPage: teamsPage,
                teamsTotalPages: teamsTotalPages,

                // Tab
                currentTab: tab
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Server Error');
        }
    }
}

module.exports = new FootballController().router;