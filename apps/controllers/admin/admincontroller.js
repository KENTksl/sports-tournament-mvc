const express = require("express");
const router = express.Router();

class AdminController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        // Main Admin Dashboard
        this.router.get("/", this.index.bind(this));

        // Sub-controllers
        this.router.use("/profile", require(__dirname + "/profilecontroller"));
        this.router.use("/chart", require(__dirname + "/chartcontroller"));
        this.router.use("/match", require(__dirname + "/matchcontroller"));
        this.router.use("/widget", require(__dirname + "/widgetcontroller"));
        this.router.use("/tournament", require(__dirname + "/tournamentcontroller"));

        // New Football Management Routes
        this.router.use("/football/tournament", require(__dirname + "/football/tournamentcontroller"));
    }

    index(req, res) {
        res.render("admin/home.ejs");
    }
}

module.exports = new AdminController().router;