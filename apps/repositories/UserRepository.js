const User = require('../models/User');

class UserRepository {
    async findByEmail(email) {
        return await User.findOne({ email: email });
    }

    async createUser(userData) {
        const user = new User(userData);
        return await user.save();
    }

    async updateUser(email, updateData) {
        return await User.updateOne({ email: email }, { $set: updateData });
    }
}

module.exports = new UserRepository();