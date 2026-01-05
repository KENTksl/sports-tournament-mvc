const TournamentRepository = require('../repositories/TournamentRepository');

class TournamentService {
    // --- Main Service Methods ---
    async getAllTournaments(filter = {}, page = null, limit = null) {
        // Pass null for sort to use default in repository
        return await TournamentRepository.findAll(filter, { createdAt: -1 }, page, limit);
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