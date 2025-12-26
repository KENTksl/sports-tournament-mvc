var express = require("express");
var router = express.Router();
var UserService = require(global.__basedir + "/apps/services/UserService");
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
            
            res.json({ success: true, data: userObj });
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
}

module.exports = new ProfileController().router;
