const express = require("express");
const router = express.Router();
const jsonwebtoken = require("jsonwebtoken");
const config = require(global.__basedir + "/Config/Setting.json");
const JWTMiddleware = require(global.__basedir + "/apps/Util/VerifyToken");
const UserService = require("../../services/UserService");
const { AUTH_SETTINGS } = require("../../common/constants");

class AuthController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.post("/register", this.register.bind(this));
        this.router.post("/login", this.login.bind(this));
        this.router.get("/test-security", JWTMiddleware.verifyToken, this.testSecurity.bind(this));
    }

    async register(req, res) {
        const { username, password, email, phone, address, dob, gender } = req.body;
        try {
            const result = await UserService.register({
                username, password, email, phone, address, dob, gender
            });
            
            if (result.success) {
                return res.status(200).json({ message: "User registered successfully" });
            } else {
                return res.status(400).json({ message: result.message });
            }
        } catch (error) {
            console.error('Register Error:', error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    async login(req, res) {
        const { email, password } = req.body;

        try {
            const user = await UserService.login(email, password);
            
            if (!user) {
                return res.status(401).json({ message: "The email and password your provided are invalid" });
            }

            const authorities = [];
            if (user.role) {
                authorities.push(user.role);
            } else {
                authorities.push(AUTH_SETTINGS.DEFAULT_ROLE);
            }

            const token = jsonwebtoken.sign(
                { user: user.username, email: user.email, roles: authorities },
                config.jwt.secret,
                { expiresIn: AUTH_SETTINGS.TOKEN_EXPIRY }
            );

            return res.json({
                token: token,
                roles: authorities
            });
        } catch (error) {
            console.error('Login Error:', error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    testSecurity(req, res) {
        // req.userData is populated by JWTMiddleware
        res.json({ status: true, message: "login success", user: req.userData });
    }
}

module.exports = new AuthController().router;
