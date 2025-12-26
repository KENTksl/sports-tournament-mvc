const express = require("express");
const router = express.Router();

class MatchController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get("/", this.index.bind(this));
    }

    index(req, res) {
        res.render("admin/match.ejs");
    }
}

module.exports = new MatchController().router;