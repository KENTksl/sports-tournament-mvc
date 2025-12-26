var express = require("express");
var router = express.Router();

class LoginController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get("/", this.index.bind(this));
    }

    index(req, res) {
        res.render("signin.ejs");
    }
}

module.exports = new LoginController().router;
