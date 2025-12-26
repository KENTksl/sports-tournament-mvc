const UserRepository = require('../repositories/UserRepository');
const bcrypt = require('bcrypt');
const saltRounds = 10;

class UserService {
    async login(email, password) {
        const user = await UserRepository.findByEmail(email);
        if (!user) {
            return null;
        }
        const passwordIsValid = await bcrypt.compare(password, user.password);
        if (!passwordIsValid) {
            return null;
        }
        return user;
    }

    async register(userData) {
        const existingUser = await UserRepository.findByEmail(userData.email);
        if (existingUser) {
            return { success: false, message: "Email already exists" };
        }

        const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
        userData.password = hashedPassword;
        
        // Ensure default role
        if (!userData.role) {
            userData.role = "customer";
        }

        await UserRepository.createUser(userData);
        return { success: true };
    }

    async getUserByEmail(email) {
        return await UserRepository.findByEmail(email);
    }

    async updateProfile(email, updateData) {
        return await UserRepository.updateUser(email, updateData);
    }
}

module.exports = new UserService();