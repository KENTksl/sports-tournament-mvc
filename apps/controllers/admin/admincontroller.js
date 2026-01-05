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
        this.router.use("/fine", require("./football/finecontroller"));
        this.router.use("/profile", require("./profilecontroller"));
        this.router.use("/tournament", require("./tournamentcontroller"));

        // New Football Management Routes
        this.router.use("/football/tournament", require("./football/tournamentcontroller"));
        this.router.use("/team-registration", require("./football/teamregistrationcontroller"));
    }

    index(req, res) {
        res.render("admin/home.ejs");
    }
}

module.exports = new AdminController().router;
