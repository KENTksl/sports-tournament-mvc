const FootballTournament = require('../../models/football/FootballTournament');

class FootballRepository {
    async findAll(filter = {}, page = null, limit = null) {
        if (page && limit) {
            const skip = (page - 1) * limit;
            const total = await FootballTournament.countDocuments(filter);
            const data = await FootballTournament.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);
            
            return {
                data,
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            };
        }
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