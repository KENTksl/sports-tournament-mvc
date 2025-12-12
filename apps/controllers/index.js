var express = require("express");
var router = express.Router();
router.use("/home", require(__dirname + "/homecontroller"));
// router.use("/about", require(__dirname + "/aboutcontroller"));
// router.use("/product", require(__dirname + "/productcontroller"));
// router.use("/admin", require(__dirname + "/admin/admincontroller"));


router.get("/", function(req,res){
    //res.json({"message": "this is index page"});
     res.render("home.ejs");
});
module.exports = router;
