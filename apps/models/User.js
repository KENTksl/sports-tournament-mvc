var db = require("../Database/Database");
var bcrypt = require("bcrypt");
var config = require(global.__basedir + "/Config/Setting.json");

class User {
    constructor() {
    }

    static async createUser(username, password, email, role = "customer", phone = "", address = "", dob = "", gender = "") {
        let client;
        try {
            client = db.getMongoClient();
            await client.connect();
            const database = client.db(config.mongodb.database);
            const collection = database.collection("users");

            const existingUser = await collection.findOne({ email: email });
            if (existingUser) {
                return { success: false, message: "Email already exists" };
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const user = {
                username: username,
                password: hashedPassword,
                email: email,
                role: role,
                phone: phone,
                address: address,
                dob: dob,
                gender: gender,
                created_at: new Date()
            };

            const result = await collection.insertOne(user);
            return { success: true, data: result };
        } catch (error) {
            throw error;
        } finally {
            if (client) {
                await client.close();
            }
        }
    }

    static async updateUser(email, updateData) {
        let client;
        try {
            client = db.getMongoClient();
            await client.connect();
            const database = client.db(config.mongodb.database);
            const collection = database.collection("users");

            const result = await collection.updateOne(
                { email: email },
                { $set: updateData }
            );
            return result;
        } catch (error) {
            throw error;
        } finally {
            if (client) {
                await client.close();
            }
        }
    }

    static async findUserByEmail(email) {
        let client;
        try {
            client = db.getMongoClient();
            await client.connect();
            const database = client.db(config.mongodb.database);
            const collection = database.collection("users");
            const user = await collection.findOne({ email: email });
            return user;
        } catch (error) {
            throw error;
        } finally {
            if (client) {
                await client.close();
            }
        }
    }
}

module.exports = User;
