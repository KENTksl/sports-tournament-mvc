var jsonwebtoken = require("jsonwebtoken");
var config = require(global.__basedir + "/Config/Setting.json");

class JWTMiddleware {
  static verifyToken(req, res, next) {
    if (req.headers["authorization"] == null) {
      return res.status(401).send({ auth: false, message: "No token provided." });
    }
    var temp = req.headers["authorization"].split(" ");
    if (temp.length < 2) {
      return res.status(401).send({ auth: false, message: "No token provided." });
    }
    var token = temp[1];
    if (!token)
      return res.status(401).send({ auth: false, message: "No token provided." });
    try {
      const decoded = jsonwebtoken.verify(token, config.jwt.secret);
      let details = (req.userData = {
        email: decoded.email,
        user: decoded.user,
        roles: decoded.roles,
        claims: decoded.claims,
      });
      next();
    } catch (err) {
      return res
        .status(401)
        .send({ auth: false, message: "Failed to authenticate token." });
    }
  }
}

module.exports = JWTMiddleware;
