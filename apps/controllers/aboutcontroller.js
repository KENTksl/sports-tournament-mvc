var express = require("express");
var router = express.Router();

class AboutController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get("/", this.index.bind(this));
    }

    index(req, res) {
        res.render("about.ejs");
    }
}

module.exports = new AboutController().router;
