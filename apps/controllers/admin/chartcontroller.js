const express = require("express");
const router = express.Router();

class ChartController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get("/", this.index.bind(this));
    }

    index(req, res) {
        res.render("admin/chart.ejs");
    }
}

module.exports = new ChartController().router;