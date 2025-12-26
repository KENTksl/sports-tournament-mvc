const TournamentRepository = require('../repositories/TournamentRepository');

class TournamentService {
    // --- Main Service Methods ---
    async getAllTournaments(filter = {}) {
        return await TournamentRepository.findAll(filter);
    }

    async getTournamentById(id) {
        return await TournamentRepository.findById(id);
    }

    async createTournament(data) {
        if (!data.status) {
            data.status = 'upcoming';
        }
        // Basic initialization if needed, but no football-specific auto-generation
        return await TournamentRepository.create(data);
    }

    async updateTournament(id, data) {
        return await TournamentRepository.update(id, data);
    }

    async deleteTournament(id) {
        return await TournamentRepository.delete(id);
    }
}

module.exports = new TournamentService();