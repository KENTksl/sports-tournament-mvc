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
                            allMatches.push(match);
                            if (isKO) {
                                knockoutMatches.push(match);
                            } else {
                                groupMatches.push(match);
                            }
                        });
                    }
                });
            }

            // Matches Pagination - DISABLED (Show All)
            const matchesPage = 1;
            const totalMatches = allMatches.length;
            const matchesTotalPages = 1;
            const paginatedMatches = allMatches;

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
                groupMatches: groupMatches,
                knockoutMatches: knockoutMatches,
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