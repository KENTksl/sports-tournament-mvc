const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MyTeamSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    teamName: { type: String, required: true },
    representative: { type: String }, // Optional, can default to User name
    phone: { type: String }, // Optional, can default to User phone
    email: { type: String }, // Optional, can default to User email
    logo: { type: String, default: 'default.png' },
    description: { type: String },
    members: [{
        name: { type: String, required: true },
        number: { type: Number },
        position: { type: String, default: 'Cầu thủ' },
        avatar: { type: String, default: 'default-avatar.png' },
        citizenIdImage: { type: String }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MyTeam', MyTeamSchema);
