var express = require("express");
var router = express.Router();
const jsonwebtoken = require("jsonwebtoken");
const jwtExpirySeconds = 300;
var config = require(global.__basedir + "/Config/Setting.json");
var JWTMiddleware = require(global.__basedir + "/apps/Util/VerifyToken");
var User = require(global.__basedir + "/apps/models/User");
var bcrypt = require("bcrypt");

class AuthController {
    static async register(req, res) {
        const { username, password, email, phone, address, dob, gender } = req.body;
        try {
            const result = await User.createUser(username, password, email, "customer", phone, address, dob, gender);
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

    static async login(req, res) {
        const { email, password } = req.body;
        console.log(`${email} is trying to login ..`);

        try {
            const user = await User.findUserByEmail(email);
            if (!user) {
                return res.status(401).json({ message: "The email and password your provided are invalid" });
            }

            const passwordIsValid = await bcrypt.compare(password, user.password);
            if (!passwordIsValid) {
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

    static testSecurity(req, res) {
        console.log(req.userData);
        res.json({ status: true, message: "login success" });
    }
}

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.get("/test-security", JWTMiddleware.verifyToken, AuthController.testSecurity);

module.exports = router;
