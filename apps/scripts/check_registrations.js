const mongoose = require('mongoose');
const config = require('../../Config/Setting.json');
const TeamRegistration = require('../models/TeamRegistration');
const User = require('../models/User');

// Fix for global.__basedir if models rely on it (though usually they don't if using relative paths)
global.__basedir = __dirname + '/../..';

const mongoUrl = `mongodb+srv://${config.mongodb.username}:${config.mongodb.password}@cluster0.u5scqoz.mongodb.net/${config.mongodb.database}?retryWrites=true&w=majority`;
console.log('Connecting to:', mongoUrl.replace(config.mongodb.password, '****'));

mongoose.connect(mongoUrl).then(async () => {
    console.log('Connected to MongoDB');
    
    console.log('--- USERS ---');
    const users = await User.find({}, 'email username');
    users.forEach(u => console.log(`User: ${u.email} (${u.username})`));

    console.log('\n--- TEAM REGISTRATIONS ---');
    const regs = await TeamRegistration.find({}, 'email teamName status tournamentId');
    regs.forEach(r => console.log(`Reg: Email="${r.email}", Team="${r.teamName}", Status=${r.status}, TournamentId=${r.tournamentId} (${typeof r.tournamentId})`));

    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});