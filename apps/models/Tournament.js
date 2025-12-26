const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TournamentSchema = new Schema({
    name: { type: String, required: true },
    organizer: { type: String, required: true },
    mode: { type: String, default: 'Knockout' },
    teamsCount: { type: Number, default: 0 },
    teams: { type: [Object], default: [] },
    fixtures: { type: [Object], default: [] }, // Array of match objects
    standings: { type: [Object], default: [] }, // Array of standing objects
    image: { type: String, default: 'default.png' },
    description: { type: String },
    bracketData: { type: Object }, // Store the JSON structure for the bracket
    createdAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['upcoming', 'ongoing', 'completed'], default: 'upcoming' }
}, { discriminatorKey: 'sportType', collection: 'tournaments' });

module.exports = mongoose.model('Tournament', TournamentSchema);