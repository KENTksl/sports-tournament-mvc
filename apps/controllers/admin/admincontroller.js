const express = require("express");
const router = express.Router();

class AdminController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        // Debug logging
        console.log("Initializing Admin Routes...");

        // Main Admin Dashboard
        this.router.get("/", this.index.bind(this));

        // Fine Controller (Priority)
        try {
            console.log("Loading FineController...");
            this.router.use("/fine", require(__dirname + "/finecontroller"));
            console.log("FineController loaded successfully at /admin/fine");
        } catch (error) {
            console.error("Error loading FineController:", error);
        }

        // Test Route
        this.router.get("/fine-test", (req, res) => {
            res.send("Admin Fine Test Route Working");
        });

        // Sub-controllers
        this.router.use("/profile", require(__dirname + "/profilecontroller"));
        this.router.use("/chart", require(__dirname + "/chartcontroller"));
        this.router.use("/match", require(__dirname + "/matchcontroller"));
        this.router.use("/widget", require(__dirname + "/widgetcontroller"));
        this.router.use("/tournament", require(__dirname + "/tournamentcontroller"));

        // New Football Management Routes
        this.router.use("/football/tournament", require(__dirname + "/football/tournamentcontroller"));
        this.router.use("/team-registration", require(__dirname + "/teamregistrationcontroller"));
        // Fine route already registered above with priority
        
        // Catch-all for debugging
        this.router.use((req, res) => {
            console.log(`Admin catch-all hit: ${req.method} ${req.originalUrl}`);
            res.status(404).send(`Admin Route Not Found: ${req.originalUrl}`);
        });
    }

    index(req, res) {
        res.render("admin/home.ejs");
    }
}

module.exports = new AdminController().router;