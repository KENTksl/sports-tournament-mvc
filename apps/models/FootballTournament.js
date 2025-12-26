const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Tournament = require('./Tournament');

const FootballTournamentSchema = new Schema({
    pitchType: { type: String, default: '7' } // '5', '7'
});

// Create a discriminator. This will store documents in the 'tournaments' collection
// with a 'sportType' value of 'Football'.
module.exports = Tournament.discriminator('Football', FootballTournamentSchema);