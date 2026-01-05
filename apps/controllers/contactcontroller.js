const express = require("express");
const router = express.Router();

class ContactController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get("/", this.index.bind(this));
    }

    index(req, res) {
        res.render("contact.ejs");
    }
}

module.exports = new ContactController().router;
