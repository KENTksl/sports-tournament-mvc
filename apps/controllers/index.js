const express = require("express");
const router = express.Router();

class MainController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        // Sub-controllers
        this.router.use("/home", require("./homecontroller"));
        this.router.use("/about", require("./aboutcontroller"));
        this.router.use("/news", require("./newscontroller"));
        this.router.use("/contact", require("./contactcontroller"));
        this.router.use("/login", require("./logincontroller"));
        this.router.use("/signup", require("./signupcontroller"));
        this.router.use("/profile", require("./profilecontroller"));
        this.router.use("/admin", require("./admin/admincontroller"));
        this.router.use("/authenticate", require("./api/AuthController"));
        this.router.use("/football", require("./football/footballcontroller"));
        this.router.use("/register-team", require("./football/teamregistrationcontroller"));
        this.router.use("/update", require("./updatecontroller"));

        // Default Route
        this.router.get("/", this.index.bind(this));
    }

    index(req, res) {
        res.render("home.ejs");
    }
}

module.exports = new MainController().router;
