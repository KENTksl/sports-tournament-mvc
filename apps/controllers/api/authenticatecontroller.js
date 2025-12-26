var express = require("express");
var router = express.Router();
const jsonwebtoken = require("jsonwebtoken");
const jwtExpirySeconds = 300;
var config = require(global.__basedir + "/Config/Setting.json");
var JWTMiddleware = require(global.__basedir + "/apps/Util/VerifyToken");
const UserService = require("../../services/UserService");

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
                res.status(200).json({ message: "User registered successfully" });
            } else {
                res.status(400).json({ message: result.message });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    async login(req, res) {
        const { email, password } = req.body;
        console.log(`${email} is trying to login ..`);

        try {
            const user = await UserService.login(email, password);
            
            if (!user) {
                return res.status(401).json({ message: "The email and password your provided are invalid" });
            }

            var authorities = [];
            if (user.role) {
                authorities.push(user.role);
            } else {
                authorities.push("customer");
            }

            var claims = [];
            claims.push("product.view");
            claims.push("product.edit");
            claims.push("product.delete");

            return res.json({
                token: jsonwebtoken.sign(
                    { user: user.username, email: user.email, roles: authorities, claims: claims },
                    config.jwt.secret,
                    { expiresIn: jwtExpirySeconds }
                ),
                roles: authorities
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    testSecurity(req, res) {
        console.log(req.userData);
        res.json({ status: true, message: "login success" });
    }
}

module.exports = new AuthController().router;
