const Tournament = require('../models/Tournament');

class TournamentRepository {
    async findAll(filter = {}, sort = { createdAt: -1 }, page = null, limit = null) {
        if (page && limit) {
            const skip = (page - 1) * limit;
            const total = await Tournament.countDocuments(filter);
            const data = await Tournament.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit);
            
            return {
                data,
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            };
        }
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