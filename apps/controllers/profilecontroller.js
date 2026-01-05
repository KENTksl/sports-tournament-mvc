var express = require("express");
var router = express.Router();
var UserService = require(global.__basedir + "/apps/services/UserService");
var TeamRegistration = require(global.__basedir + "/apps/models/TeamRegistration");
var MyTeam = require(global.__basedir + "/apps/models/MyTeam");
var Fine = require(global.__basedir + "/apps/models/Fine");
var JWTMiddleware = require(global.__basedir + "/apps/Util/VerifyToken");
var multer = require("multer");
var path = require("path");

// Configure multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/avatars/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

class ProfileController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get("/", this.index.bind(this));
        this.router.get("/data", JWTMiddleware.verifyToken, this.getProfileData.bind(this));
        this.router.post("/update", JWTMiddleware.verifyToken, upload.single('avatar'), this.update.bind(this));
        
        // My Team Routes
        const teamUpload = upload.fields([
            { name: 'logo', maxCount: 1 },
            { name: 'memberAvatar', maxCount: 30 },
            { name: 'memberCitizenIdImage', maxCount: 30 }
        ]);
        this.router.post("/my-team/update", JWTMiddleware.verifyToken, teamUpload, this.updateMyTeam.bind(this));
    }

    async index(req, res) {
        try {
            res.render("profile.ejs", { fines: [] });
        } catch (error) {
            console.error(error);
            res.status(500).send("Internal Server Error");
        }
    }
    
    async getProfileData(req, res) {
         try {
            const email = req.userData.email; 
            if (!email) {
                 return res.status(400).json({ success: false, message: "Invalid token data" });
            }
            const user = await UserService.getUserByEmail(email);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            // Don't send password - Mongoose document needs .toObject() or just delete from obj
            // Since Mongoose returns a document, we should convert to object if we want to delete props safely
            // But since I updated Repository to return simple query result, it is a document.
            // Using toObject() is safer.
            const userObj = user.toObject ? user.toObject() : user;
            delete userObj.password;
            
            // Fetch registrations
            console.log("Querying registrations for email:", email);
            
            // Use regex for case-insensitive and trimmed match
            const emailRegex = new RegExp(`^${email.trim()}$`, 'i');
            
            const registrations = await TeamRegistration.find({ email: { $regex: emailRegex } })
                .populate('tournamentId')
                .sort({ submittedAt: -1 });
                
            console.log("Found registrations:", registrations.length);

            // Ensure tournament status is up-to-date (completed if final finished or all matches finished)
            for (const reg of registrations) {
                const t = reg.tournamentId;
                if (!t) continue;
                try {
                    let allFinished = true;
                    let finalFinished = false;
                    if (t.fixtures && t.fixtures.length > 0) {
                        for (const g of t.fixtures) {
                            for (const m of (g.matches || [])) {
                                if (m.status !== 'finished') {
                                    allFinished = false;
                                }
                                const isFinalGroup = (g.group && (g.group.includes('Chung Kết') || String(g.group).toLowerCase().includes('final')));
                                if (isFinalGroup && (m.bracketMatchIndex === undefined || m.bracketMatchIndex === 0)) {
                                    if (m.status === 'finished') {
                                        finalFinished = true;
                                    }
                                }
                            }
                        }
                    }
                    if ((allFinished || finalFinished) && t.status !== 'completed') {
                        t.status = 'completed';
                        await t.save();
                    }
                } catch (e) {
                    console.warn('Season status reconciliation failed:', e.message);
                }
            }

            // Process Team Stats
            const teamStats = [];
            registrations.forEach(reg => {
                if (reg.tournamentId && reg.tournamentId.fixtures && reg.status === 'approved') {
                    const tournament = reg.tournamentId;
                    const myTeamName = reg.teamName;
                    const relevantMatches = [];

                    tournament.fixtures.forEach(group => {
                        if (group.matches) {
                            group.matches.forEach(match => {
                                const t1 = (match.team1 || '').trim();
                                const t2 = (match.team2 || '').trim();
                                const target = myTeamName.trim();

                                if (t1 === target || t2 === target) {
                                    // Check if match is finished (has score)
                                    if (match.score1 !== null && match.score1 !== undefined && match.score1 !== "" &&
                                        match.score2 !== null && match.score2 !== undefined && match.score2 !== "") {
                                        
                                        // Match Label Logic (similar to public view)
                                        let label = `Trận`;
                                        if (group.group) {
                                            label = `${group.group}`;
                                            // Find index in group? No, just use Date or generic
                                        }
                                        if (match.date) {
                                            label += ` (${match.date})`;
                                        }

                                        relevantMatches.push({
                                            matchLabel: label, 
                                            groupName: group.group,
                                            team1: t1,
                                            team2: t2,
                                            score1: parseInt(match.score1),
                                            score2: parseInt(match.score2),
                                            isTeam1: t1 === target
                                        });
                                    }
                                }
                            });
                        }
                    });

                    if (relevantMatches.length > 0) {
                        teamStats.push({
                            tournamentId: tournament._id,
                            tournamentName: tournament.name,
                            teamName: myTeamName,
                            matches: relevantMatches
                        });
                    }
                }
            });

            // Fetch My Team
            const myTeam = await MyTeam.findOne({ userId: user._id });

            // Fetch Fines
            const teamNames = registrations
                .filter(r => r.status === 'approved')
                .map(r => r.teamName);
            
            // Also include current MyTeam name if exists
            if (myTeam && myTeam.teamName && !teamNames.includes(myTeam.teamName)) {
                teamNames.push(myTeam.teamName);
            }

            const fines = await Fine.find({ teamName: { $in: teamNames } })
                .sort({ createdAt: -1 });

            res.json({ success: true, data: userObj, registrations: registrations, myTeam: myTeam, teamStats: teamStats, fines: fines, debugEmail: email });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    async update(req, res) {
        try {
            const email = req.userData.email;
            const { username, phone, address, dob, gender, citizenId } = req.body;
            
            const updateData = {
                username: username,
                phone: phone,
                address: address,
                dob: dob,
                gender: gender,
                citizenId: citizenId
            };

            if (req.file) {
                updateData.avatar = "/static/uploads/avatars/" + req.file.filename;
            }

            const result = await UserService.updateProfile(email, updateData);
            if (result.modifiedCount > 0 || result.matchedCount > 0) {
                 res.json({ success: true, message: "Profile updated successfully", avatar: updateData.avatar });
            } else {
                 res.json({ success: false, message: "Failed to update profile" });
            }
        } catch (error) {
             console.error(error);
             res.status(500).json({ success: false, message: "Internal server error: " + error.message });
        }
    }

    async updateMyTeam(req, res) {
        try {
            const email = req.userData.email;
            const user = await UserService.getUserByEmail(email);
            if (!user) return res.status(404).json({ success: false, message: "User not found" });

            const { teamName, representative, phone, email: teamEmail, description } = req.body;
            
            let myTeam = await MyTeam.findOne({ userId: user._id });
            if (!myTeam) {
                myTeam = new MyTeam({ userId: user._id });
            }
            
            myTeam.teamName = teamName;
            myTeam.representative = representative;
            myTeam.phone = phone;
            myTeam.email = teamEmail;
            myTeam.description = description;

            if (req.files['logo'] && req.files['logo'][0]) {
                myTeam.logo = req.files['logo'][0].filename;
            }

            // Process Members
            const names = Array.isArray(req.body.memberName) ? req.body.memberName : (req.body.memberName ? [req.body.memberName] : []);
            const numbers = Array.isArray(req.body.memberNumber) ? req.body.memberNumber : (req.body.memberNumber ? [req.body.memberNumber] : []);
            const citizenIds = Array.isArray(req.body.memberCitizenId) ? req.body.memberCitizenId : (req.body.memberCitizenId ? [req.body.memberCitizenId] : []);
            
            const existingAvatars = Array.isArray(req.body.existingMemberAvatar) ? req.body.existingMemberAvatar : (req.body.existingMemberAvatar ? [req.body.existingMemberAvatar] : []);
            const existingCitizenIdImages = Array.isArray(req.body.existingMemberCitizenIdImage) ? req.body.existingMemberCitizenIdImage : (req.body.existingMemberCitizenIdImage ? [req.body.existingMemberCitizenIdImage] : []);
            
            const hasNewAvatar = Array.isArray(req.body.memberHasNewAvatar) ? req.body.memberHasNewAvatar : (req.body.memberHasNewAvatar ? [req.body.memberHasNewAvatar] : []);
            const hasNewCitizen = Array.isArray(req.body.memberHasNewCitizen) ? req.body.memberHasNewCitizen : (req.body.memberHasNewCitizen ? [req.body.memberHasNewCitizen] : []);

            const newAvatars = req.files['memberAvatar'] || [];
            const newCitizenIdImages = req.files['memberCitizenIdImage'] || [];
            
            let avatarIdx = 0;
            let citizenIdx = 0;
            
            const members = [];
            
            for (let i = 0; i < names.length; i++) {
                if (!names[i] || names[i].trim() === '') continue;
                
                let avatar = existingAvatars[i];
                if (hasNewAvatar[i] === 'true' && newAvatars[avatarIdx]) {
                    avatar = newAvatars[avatarIdx].filename;
                    avatarIdx++;
                }
                
                let citizenIdImage = existingCitizenIdImages[i];
                if (hasNewCitizen[i] === 'true' && newCitizenIdImages[citizenIdx]) {
                    citizenIdImage = newCitizenIdImages[citizenIdx].filename;
                    citizenIdx++;
                }
                
                members.push({
                    name: names[i],
                    number: numbers[i],
                    citizenId: citizenIds[i],
                    avatar: avatar,
                    citizenIdImage: citizenIdImage
                });
            }
            
            myTeam.members = members;
            await myTeam.save();

            res.json({ success: true, message: "Đã lưu thông tin đội thành công!" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: "Lỗi server: " + error.message });
        }
    }
}

module.exports = new ProfileController().router;
