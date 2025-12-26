const FootballTournament = require('../models/FootballTournament');

class FootballRepository {
    async findAll(filter = {}) {
        return await FootballTournament.find(filter).sort({ createdAt: -1 });
    }

    async findById(id) {
        return await FootballTournament.findById(id);
    }

    async create(data) {
        const tournament = new FootballTournament(data);
        return await tournament.save();
    }

    async update(id, data) {
        return await FootballTournament.findByIdAndUpdate(id, data, { new: true });
    }

    async delete(id) {
        return await FootballTournament.findByIdAndDelete(id);
    }
}

module.exports = new FootballRepository();