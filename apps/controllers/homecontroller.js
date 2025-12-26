var express = require("express");
var router = express.Router();

class HomeController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get("/", this.index.bind(this));
    }

    index(req, res) {
        //res.json({"message": "this is home"});
        res.render("home.ejs");
    }
}

module.exports = new HomeController().router;
