const express = require("express");
const router = express.Router();

class AdminProfileController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get("/", this.index.bind(this));
    }

    index(req, res) {
        res.render("admin/profile.ejs");
    }
}

module.exports = new AdminProfileController().router;