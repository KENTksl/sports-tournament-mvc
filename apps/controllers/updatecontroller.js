const express = require("express");
const router = express.Router();

class UpdateController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get("/", this.index.bind(this));
    }

    index(req, res) {
        res.render("update.ejs");
    }
}

module.exports = new UpdateController().router;
