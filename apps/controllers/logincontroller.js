var express = require("express");
var router = express.Router();

router.get("/", function(req, res){
    res.render("signin.ejs");
});

module.exports = router;
