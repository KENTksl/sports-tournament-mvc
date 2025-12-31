var express = require("express");
var router = express.Router();
var UserService = require(global.__basedir + "/apps/services/UserService");
var TeamRegistration = require(global.__basedir + "/apps/models/TeamRegistration");
var MyTeam = require(global.__basedir + "/apps/models/MyTeam");
var JWTMiddleware = require(global.__basedir + "/apps/Util/VerifyToken");
var multer = require("multer");
var path = require("path");

// Configure multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/avatars/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Error: File upload only supports the following filetypes - " + filetypes));
    }
});

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
            res.render("profile.ejs");
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

            res.json({ success: true, data: userObj, registrations: registrations, myTeam: myTeam, teamStats: teamStats, debugEmail: email });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    async update(req, res) {
        try {
            const email = req.userData.email;
            const { username, phone, address, dob, gender } = req.body;
            
            const updateData = {
                username: username,
                phone: phone,
                address: address,
                dob: dob,
                gender: gender
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
            
            // Process Members
            const members = [];
            const names = Array.isArray(req.body.memberName) ? req.body.memberName : (req.body.memberName ? [req.body.memberName] : []);
            const numbers = Array.isArray(req.body.memberNumber) ? req.body.memberNumber : (req.body.memberNumber ? [req.body.memberNumber] : []);
            
            // Files
            // Note: req.files is keyed by fieldname. Since we have arrays of inputs, multer gives arrays of files.
            // But matching them to the index is tricky if some are missing.
            // However, with client-side appending, usually indices are preserved or we rely on sequential order if all are re-uploaded.
            // A better approach for updates is to handle existing images.
            
            // For simplicity in this "manage team" feature, let's assume we rebuild the members list.
            // But we need to keep existing avatars if not provided.
            
            // Wait, standard HTML form submission for arrays with files is messy.
            // Let's check how registration controller did it.
            // It relied on order: "We assume the order of files matches the order of inputs."
            
            // But for an update, we might have existing members with existing images.
            // We need a way to track which member is which.
            // Let's add hidden inputs for 'existingAvatar' and 'existingCitizenId' in the form.
            
            const existingAvatars = Array.isArray(req.body.existingMemberAvatar) ? req.body.existingMemberAvatar : (req.body.existingMemberAvatar ? [req.body.existingMemberAvatar] : []);
            const existingCitizenIds = Array.isArray(req.body.existingMemberCitizenIdImage) ? req.body.existingMemberCitizenIdImage : (req.body.existingMemberCitizenIdImage ? [req.body.existingMemberCitizenIdImage] : []);
            
            const memberAvatars = req.files['memberAvatar'] || [];
            const memberCitizenIdImages = req.files['memberCitizenIdImage'] || [];
            
            // This logic is flawed because `memberAvatars` only contains *newly uploaded* files.
            // If I have 3 members, and I update avatar for the 2nd one, `memberAvatars` has length 1.
            // I don't know it belongs to the 2nd member unless I use specific field names (e.g. memberAvatar_1) or track indices.
            // Multer array just gives a list of files.
            
            // REVISED STRATEGY: 
            // The frontend should send `memberIndex` for each file upload if we want to map them precisely.
            // OR, we just use a simpler approach: Re-upload all or nothing? No, that's bad UX.
            
            // Alternative: The frontend form uses `memberAvatar[]`.
            // If a user *doesn't* select a file, the browser sends nothing for that index in the multipart data?
            // Actually, for file inputs, empty ones are often skipped or sent as empty.
            // Multer `upload.fields` with `maxCount` puts them in an array.
            
            // Let's try to map by checking the file's originalname or just trusting the order? No, order is unreliable if empty ones are skipped.
            // The best way in a multi-part form for array of objects is difficult.
            
            // SIMPLIFICATION:
            // For now, let's assume the user manages members one by one OR we try to map them.
            // Actually, a common trick is to have the frontend append the file to `memberAvatar` ONLY if changed.
            // And we also send a hidden field `memberAvatarIndex` for each file to know which member it belongs to.
            
            // Let's look at `req.body` structure.
            // We will have arrays for `memberName`, `memberNumber`, `existingMemberAvatar`.
            // And `req.files['memberAvatar']`.
            
            // Let's try to map based on a `memberId` or just index.
            // If we use `memberAvatar_${index}` naming convention, Multer needs to be configured for dynamic fields or `any()`.
            // `upload.any()` is flexible. Let's stick to `fields` but maybe we can just iterate and check?
            
            // Actually, the `TeamRegistrationController` logic:
            // `const memberAvatars = req.files['memberAvatar'] || [];`
            // `members.push({ ..., avatar: memberAvatars[i] ? ... : ... })`
            // This implies it expects a file for EVERY member or assumes alignment. 
            // But HTML forms don't send empty file parts in a way that preserves array index in Multer easily.
            
            // Let's just try to parse what we have.
            // If we use a "Manage Team" page, maybe we should save the team details first, and manage members via separate API calls?
            // That might be too complex for this turn.
            
            // Let's try to do it in one go, but handle the images carefully.
            // We will use the `existing...` hidden fields.
            // AND we will ask the frontend to send `memberAvatarChanged` flags?
            
            // Let's blindly trust the `TeamRegistrationController` approach for now, but improved.
            // Actually, if we want to be robust, we should use a single JSON field for data and separate files, but that's complex for FormData.
            
            // Let's stick to: 
            // 1. `teamName`, `description`, etc.
            // 2. `members`: array of objects.
            
            // Let's fetch the existing team first.
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
            
            // Rebuild members list
            // We need to know which file corresponds to which member.
            // The reliable way with Multer array is hard if some are skipped.
            // BUT, if we use `upload.any()`, we get `req.files` as an array with `fieldname`.
            // If we name fields `memberAvatar_0`, `memberAvatar_1`, etc., we can map them.
            // But `ProfileController` uses `upload.fields(...)` with fixed names.
            
            // Let's change the route to use `upload.any()` for maximum flexibility?
            // No, `upload.fields` is defined in `initializeRoutes`.
            
            // Let's assume the user uploads *new* files.
            // And we rely on a hidden input `avatar_index` that is an array of indices?
            // Or `avatar_for_member_index`?
            
            // Let's go with a simpler heuristic:
            // We will Iterate over `names`.
            // For each `i`, we check if `req.files['memberAvatar']` has a file that matches? No.
            
            // Let's try this: 
            // We will just save the text data first.
            // And for images, we will just use the `existing...` values.
            // If a file is uploaded, we need to know where it goes.
            
            // Hacky but working solution for `fields` with array:
            // Frontend must ensure that if a file is NOT selected, it doesn't send a part?
            // Or we just accept that updating images in a batch list is hard without dedicated per-row upload.
            
            // Let's look at `TeamRegistrationController` again.
            // `const memberAvatars = req.files['memberAvatar'] || [];`
            // `avatar: memberAvatars[i] ? ...`
            // This assumes if I have 3 members, I send 3 files (or empty ones?). 
            // Browsers usually don't send empty file fields in a way that Multer creates an empty entry in the array. 
            // So `memberAvatars` will have length < `names.length` if some are missing.
            // And `memberAvatars[0]` will correspond to the first *uploaded* file, which might be the 3rd member's avatar.
            
            // FIX: We will rely on the Frontend to name fields `memberAvatar_${index}` and use `upload.any()`.
            // But I need to change `initializeRoutes`.
            
            // ALTERNATIVE: Just use the `TeamRegistration` logic for now, and warn the user "Please re-upload all images if you change one"? 
            // No, that's bad.
            
            // Let's use `upload.any()` in the route.
            
            const memberList = [];
            
            // We need to parse the `req.body` which might have flat arrays
            // names[0], names[1]...
            
            // Since we can't easily change the multer config dynamically inside the method without changing the route def,
            // let's change `initializeRoutes` to use `upload.any()` for this route?
            // `this.router.post("/my-team/update", JWTMiddleware.verifyToken, upload.any(), this.updateMyTeam.bind(this));`
            // But `upload` is configured with `fields` in the global scope? No, `upload` is the multer instance.
            // `upload.fields(...)` returns a middleware. `upload.any()` returns a middleware.
            
            // So I can change the route definition.
            
            // But wait, I already edited `initializeRoutes` to use `teamUpload`.
            // Let's stick to `teamUpload` and try to be smart.
            
            // Actually, I can just map the files by `originalname` if I really wanted to, but that's insecure/unreliable.
            
            // Let's do this:
            // In the form, we will have `existingMemberAvatar[]` (hidden) storing the filename.
            // And `memberAvatar` (file).
            // This is still the "array alignment" problem.
            
            // OK, let's change the route to `upload.any()`. It's safer for this dynamic list.
            
            // Re-read `ProfileController`:
            // `const upload = multer({ ... })`
            // `const teamUpload = upload.fields(...)`
            
            // I will change `initializeRoutes` in the NEXT tool call if needed, or just now.
            // Let's assume I can't change it easily without a search-replace.
            
            // Let's write the logic assuming `req.files` contains the arrays.
            // AND we assume the frontend sends a HIDDEN input `memberHasNewAvatar[]` (value "true" or "false").
            // Then we can iterate.
            
            // Backend Logic with `memberHasNewAvatar` (array of strings "true"/"false"):
            // let fileIndex = 0;
            // for (let i=0; i<names.length; i++) {
            //    if (memberHasNewAvatar[i] === 'true') {
            //        avatar = req.files['memberAvatar'][fileIndex].filename;
            //        fileIndex++;
            //    } else {
            //        avatar = existing[i];
            //    }
            // }
            
            // This works! The frontend just needs to set the hidden field value when file input changes.
            
            const hasNewAvatar = Array.isArray(req.body.memberHasNewAvatar) ? req.body.memberHasNewAvatar : (req.body.memberHasNewAvatar ? [req.body.memberHasNewAvatar] : []);
            const hasNewCitizen = Array.isArray(req.body.memberHasNewCitizen) ? req.body.memberHasNewCitizen : (req.body.memberHasNewCitizen ? [req.body.memberHasNewCitizen] : []);
            
            let avatarFileIndex = 0;
            let citizenFileIndex = 0;
            
            const newAvatars = req.files['memberAvatar'] || [];
            const newCitizenIds = req.files['memberCitizenIdImage'] || [];
            
            for (let i = 0; i < names.length; i++) {
                if (names[i] && names[i].trim() !== '') {
                    let avatar = existingAvatars[i] || 'default-avatar.png';
                    let citizenIdImage = existingCitizenIds[i] || null;
                    
                    if (hasNewAvatar[i] === 'true' && newAvatars[avatarFileIndex]) {
                        avatar = newAvatars[avatarFileIndex].filename;
                        avatarFileIndex++;
                    }
                    
                    if (hasNewCitizen[i] === 'true' && newCitizenIds[citizenFileIndex]) {
                        citizenIdImage = newCitizenIds[citizenFileIndex].filename;
                        citizenFileIndex++;
                    }
                    
                    memberList.push({
                        name: names[i],
                        number: numbers[i],
                        position: 'Cầu thủ',
                        avatar: avatar,
                        citizenIdImage: citizenIdImage
                    });
                }
            }
            
            myTeam.members = memberList;
            await myTeam.save();
            
            res.json({ success: true, message: "Team updated successfully", myTeam: myTeam });
            
        } catch (error) {
             console.error(error);
             res.status(500).json({ success: false, message: "Internal server error: " + error.message });
        }
    }
}

module.exports = new ProfileController().router;
