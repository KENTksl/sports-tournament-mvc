const Tournament = require('../models/Tournament');

class TournamentRepository {
    async findAll(filter = {}, sort = { createdAt: -1 }) {
        return await Tournament.find(filter).sort(sort);
    }

    async findById(id) {
        return await Tournament.findById(id);
    }

    async create(data) {
        const tournament = new Tournament(data);
        return await tournament.save();
    }

    async update(id, data) {
        return await Tournament.findByIdAndUpdate(id, data, { new: true });
    }

    async delete(id) {
        return await Tournament.findByIdAndDelete(id);
    }
}

module.exports = new TournamentRepository();