const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const FineSchema = new Schema({
    memberId: { type: String, required: true }, // ID or Name of member if ID not available
    memberName: { type: String, required: true },
    teamId: { type: String, required: true }, // Team ID (string from TeamRegistration or Tournament Team ID)
    teamName: { type: String, required: true },
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    matchId: { type: String, required: true },
    matchLabel: { type: String }, // e.g., "Vòng Bảng - Trận 1"
    type: { 
        type: String, 
        enum: ['yellow_card', 'red_card'], 
        required: true 
    },
    amount: { type: Number, required: true }, // 100000 or 300000
    reason: { type: String }, // e.g., "Thẻ vàng phút 45"
    status: { 
        type: String, 
        enum: ['pending', 'paid'], 
        default: 'pending' 
    },
    paidAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Fine', FineSchema);
