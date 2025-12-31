const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const TeamRegistration = require('../models/TeamRegistration');
const FootballService = require('../services/FootballService');

// Configure Multer for uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/avatars/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

class TeamRegistrationController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/', this.index.bind(this));
        // Use any() to handle dynamic field names for members
        this.router.post('/submit', upload.any(), this.submit.bind(this));
        this.router.get('/success', this.success.bind(this));
    }

    async index(req, res) {
        let tournamentName = '';
        let tournamentId = '';
        
        if (req.query.tournamentId) {
            try {
                const tournament = await FootballService.getTournamentById(req.query.tournamentId);
                if (tournament) {
                    tournamentName = tournament.name;
                    tournamentId = tournament._id;
                }
            } catch (e) {
                console.error('Error fetching tournament:', e);
            }
        }

        res.render('team_registration/register', { 
            pageTitle: 'Đăng Ký Hồ Sơ Đội Tuyển',
            tournamentName,
            tournamentId
        });
    }

    async submit(req, res) {
        try {
            const { teamName, representative, phone, email, description, tournamentId } = req.body;
            
            // Process Logo
            let logo = 'default.png';
            const logoFile = req.files.find(f => f.fieldname === 'logo');
            if (logoFile) {
                logo = logoFile.filename;
            } else if (req.body.existingLogo) {
                logo = req.body.existingLogo;
            }

            // Process Members
            const members = [];
            
            // Handle array inputs
            const names = Array.isArray(req.body.memberName) ? req.body.memberName : (req.body.memberName ? [req.body.memberName] : []);
            const numbers = Array.isArray(req.body.memberNumber) ? req.body.memberNumber : (req.body.memberNumber ? [req.body.memberNumber] : []);
            const indices = Array.isArray(req.body.memberIndex) ? req.body.memberIndex : (req.body.memberIndex ? [req.body.memberIndex] : []);
            
            // Existing files (hidden inputs)
            // Note: req.body.existingMemberAvatar might be a single string if only one member, or array, or undefined.
            // We need to normalize it to access by index safely if it follows DOM order.
            // HOWEVER, if the form is dynamic, simple index access [i] works if all rows have the hidden input.
            // We will ensure Frontend adds hidden inputs for ALL rows.
            
            let existingAvatars = req.body.existingMemberAvatar;
            if (!Array.isArray(existingAvatars)) existingAvatars = existingAvatars ? [existingAvatars] : [];
            
            let existingCitizenIds = req.body.existingMemberCitizenIdImage;
            if (!Array.isArray(existingCitizenIds)) existingCitizenIds = existingCitizenIds ? [existingCitizenIds] : [];

            // We assume names, numbers, indices, and existing arrays are all in sync (DOM order).
            
            for (let i = 0; i < names.length; i++) {
                if (names[i] && names[i].trim() !== '') {
                    const idx = indices[i] || i; // Fallback to loop index if memberIndex is missing
                    
                    // Find files by unique fieldname
                    const avatarFile = req.files.find(f => f.fieldname === `memberAvatar_${idx}`);
                    const citizenFile = req.files.find(f => f.fieldname === `memberCitizenIdImage_${idx}`);
                    
                    // Determine filenames
                    // 1. New file uploaded? Use it.
                    // 2. Existing file provided? Use it.
                    // 3. Default.
                    
                    let avatar = 'default-avatar.png';
                    if (avatarFile) {
                        avatar = avatarFile.filename;
                    } else if (existingAvatars[i]) {
                        avatar = existingAvatars[i];
                    }
                    
                    let citizenIdImage = null;
                    if (citizenFile) {
                        citizenIdImage = citizenFile.filename;
                    } else if (existingCitizenIds[i]) {
                        citizenIdImage = existingCitizenIds[i];
                    }

                    members.push({
                        name: names[i],
                        number: numbers[i],
                        position: 'Cầu thủ',
                        avatar: avatar,
                        citizenIdImage: citizenIdImage
                    });
                }
            }

            const registration = new TeamRegistration({
                teamName,
                representative,
                phone,
                email,
                description,
                logo,
                members,
                status: 'pending',
                tournamentId: tournamentId || null
            });

            await registration.save();
            res.redirect('/register-team/success');

        } catch (error) {
            console.error(error);
            res.status(500).render('team_registration/register', {
                error: 'Đã xảy ra lỗi khi gửi hồ sơ. Vui lòng thử lại.',
                pageTitle: 'Đăng Ký Hồ Sơ Đội Tuyển'
            });
        }
    }

    async success(req, res) {
        res.render('team_registration/success', {
            pageTitle: 'Gửi Hồ Sơ Thành Công'
        });
    }
}

module.exports = new TeamRegistrationController().router;
