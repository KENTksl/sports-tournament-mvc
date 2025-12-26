const express = require("express");
const router = express.Router();

class WidgetController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get("/", this.index.bind(this));
    }

    index(req, res) {
        res.render("admin/widget.ejs");
    }
}

module.exports = new WidgetController().router;