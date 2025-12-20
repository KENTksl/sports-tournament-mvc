var express = require("express");
var router = express.Router();
router.use("/home", require(__dirname + "/homecontroller"));
router.use("/about", require(__dirname + "/aboutcontroller"));
router.use("/news", require(__dirname + "/newscontroller"));
router.use("/contact", require(__dirname + "/contactcontroller"));
router.use("/login", require(__dirname + "/logincontroller"));
router.use("/signup", require(__dirname + "/signupcontroller"));
router.use("/profile", require(__dirname + "/profilecontroller"));
router.use("/admin", require(__dirname + "/admin/admincontroller"));
router.use("/authenticate", require(__dirname + "/api/authenticatecontroller"));

router.get("/", function(req,res){
    //res.json({"message": "this is index page"});
     res.render("home.ejs");
});
module.exports = router;
