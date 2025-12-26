var express = require("express");
var app = express();
var mongoose = require('mongoose');
var config = require(__dirname + "/Config/Setting.json");

// Connect to MongoDB with Mongoose
const user = config.mongodb.username;
const pass = config.mongodb.password;
const dbName = config.mongodb.database;
const uri = `mongodb+srv://${user}:${pass}@cluster0.u5scqoz.mongodb.net/${dbName}?retryWrites=true&w=majority`;

mongoose.connect(uri)
    .then(() => console.log('Mongoose connected...'))
    .catch(err => console.error('Mongoose connection error:', err));

//Body parser
global.__basedir = __dirname;

var bodyParser = require('body-parser')
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());
//Controller
var controller = require(__dirname  + "/apps/controllers");
app.use(controller);

app.set("views",__dirname + "/apps/views");
app.set("view engine", "ejs");
app.use("/static", express.static(__dirname + "/public"));

//Run server
var server = app.listen(3000, function(){
   console.log("server is running");
});
