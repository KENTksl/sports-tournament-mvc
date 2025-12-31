const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TeamRegistrationSchema = new Schema({
    teamName: { type: String, required: true },
    representative: { type: String, required: true }, // Tên người đại diện (HLV/Đội trưởng)
    phone: { type: String, required: true },
    email: { type: String },
    logo: { type: String, default: 'default.png' },
    description: { type: String }, // Giới thiệu về đội
    members: [{
        name: { type: String, required: true },
        dob: { type: String }, // Ngày sinh
        position: { type: String, default: 'Cầu thủ' }, // Vị trí (Mặc định do user bỏ chọn)
        number: { type: Number }, // Số áo
        avatar: { type: String, default: 'default-avatar.png' },
        citizenIdImage: { type: String } // Ảnh CCCD/CMND
    }],
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected'], 
        default: 'pending' 
    },
    submittedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date },
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament' }
});

module.exports = mongoose.model('TeamRegistration', TeamRegistrationSchema);
