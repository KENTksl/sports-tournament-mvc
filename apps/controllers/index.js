const express = require("express");
const router = express.Router();

class MainController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        // Sub-controllers
        this.router.use("/home", require(__dirname + "/homecontroller"));
        this.router.use("/about", require(__dirname + "/aboutcontroller"));
        this.router.use("/news", require(__dirname + "/newscontroller"));
        this.router.use("/contact", require(__dirname + "/contactcontroller"));
        this.router.use("/login", require(__dirname + "/logincontroller"));
        this.router.use("/signup", require(__dirname + "/signupcontroller"));
        this.router.use("/profile", require(__dirname + "/profilecontroller"));
        this.router.use("/admin", require(__dirname + "/admin/admincontroller"));
        this.router.use("/authenticate", require(__dirname + "/api/authenticatecontroller"));
        this.router.use("/football", require(__dirname + "/footballcontroller"));
        this.router.use("/register-team", require(__dirname + "/teamregistrationcontroller"));

        // Default Route
        this.router.get("/", this.index.bind(this));
    }

    index(req, res) {
        //res.json({"message": "this is index page"});
        res.render("home.ejs");
    }
}

module.exports = new MainController().router;