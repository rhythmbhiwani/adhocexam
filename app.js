// IMPORTING REQUIRED LIBRARIES
require('dotenv').config();
const express = require("express");
const https = require("https");
const ejs = require('ejs');
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

// DEFINING APP AND ITS PARAMETERS
const app = express();
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(session({
  secret: process.env.SESSION_SECRET_KEY,
  cookie: {
    maxAge: 604800000
  }, //Age of cookie is 7 days
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// DEFINING MONGOOSE FOR DATABASE
mongoose.connect(process.env.MONGODB_SERVER_URL+"/adhocnwDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  autoIndex: false //To turn off username as unique in database
});
mongoose.set("useCreateIndex", true);

// SETTING USER SCHEMA
const userSchema = new mongoose.Schema({
  loginMethod: String,
  local: {
    email: String,
    fullname: String,
    profilePicture: String
  },
  google: {
    email: String,
    fullname: String,
    googleId: String,
    profilePicture: String
  },
  facebook: {
    facebookId: String,
    email: String,
    fullname: String,
    profilePicture: String
  }
});
userSchema.plugin(passportLocalMongoose);
const User = new mongoose.model("User", userSchema);
passport.use(User.createStrategy());
passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// FUCNTION TO CHECK IF USER IS AUTHENTICATED OR NOT
function checkLoginValidation(req) {
  let isLogined = false;
  if (req.isAuthenticated()) {
    isLogined = true;
  }
  return isLogined;
}


// SETTING GOOGLE LOGIN STRATEGY
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    callbackURL: process.env.LOGIN_CALLBACK_URL+"/auth/google/googlelogin"
  },
  function(accessToken, refreshToken, googleUserData, cb) {
    process.nextTick(function() {
      User.findOne({
        'google.googleId': googleUserData.id
      }, function(err, user) {
        if (err) {
          return cb(err);
        } else {
          if (user) {
            return cb(err, user)
          } else {
            let newUser = new User();
            newUser.loginMethod = "google";
            newUser.google = {
              googleId: googleUserData.id,
              email: googleUserData._json.email,
              fullname: googleUserData._json.name,
              profilePicture: googleUserData._json.picture
            }
            newUser.save(function(err) {
              if (err) {
                console.log(err);
                throw err;
              } else {
                return cb(null, newUser);
              }
            });
          }
        }
      });
    });
  }));


// SETTING FACEBOOK LOGIN STRATEGY
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: process.env.LOGIN_CALLBACK_URL+"/auth/facebook/facebooklogin",
    profileFields: ['id', 'displayName', 'email', 'picture.height(500).width(500)']
  },
  function(accessToken, refreshToken, facebookUserData, cb) {
    process.nextTick(function() {
      User.findOne({
        'facebook.facebookId': facebookUserData.id
      }, function(err, user) {
        if (err) {
          return cb(err);
        } else {
          if (user) {
            return cb(err, user)
          } else {
            let newUser = new User();
            newUser.loginMethod = "facebook";
            newUser.facebook = {
              facebookId: facebookUserData.id,
              email: facebookUserData._json.email,
              fullname: facebookUserData._json.name,
              profilePicture: facebookUserData._json.picture.data.url
            }
            newUser.save(function(err) {
              if (err) {
                console.log(err);
                throw err;
              } else {
                return cb(null, newUser);
              }
            });
          }
        }
      });
    });
  }
));



// SETTING ROUTES
app.get("/", function(req, res) {
  res.render("home", {
    isLogined: checkLoginValidation(req)
  });
});

app.get("/questions", function(req, res) {
  res.render("questionPanel", {
    isLogined: checkLoginValidation(req)
  });
});

// GOOGLE AUTHENTICATION ROUTES
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ["profile", "email"]
  }));
app.get('/auth/google/googlelogin',
  passport.authenticate('google', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    res.redirect('/dashboard');
  });

// FACEBOOK AUTHENTICATION ROUTES
app.get('/auth/facebook',
  passport.authenticate('facebook', {
    scope: ["email"]
  }));
app.get('/auth/facebook/facebooklogin',
  passport.authenticate('facebook', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    res.redirect('/dashboard');
  });

// LOCAL SIGNUP ROUTES
app.post("/signup", function(req, res) {
  let errors = [];
  const givenUsername = req.body.username;
  const givenFullName = req.body.fullname;
  const givenPassword1 = req.body.password;
  const givenPassword2 = req.body.confirm_password;
  if (!givenUsername || !givenFullName || !givenPassword1 || !givenPassword2) {
    errors.push({
      message: "Please fill all the details!"
    });
  }
  if (givenPassword1 != givenPassword2) {
    errors.push({
      message: "Passwords do not match!"
    });
  }
  if (givenPassword1.length < 8) {
    errors.push({
      message: "Password should be of atleast 8 characters!"
    });
  }
  User.findOne({
    username: givenUsername
  }, function(err, foundUser) {
    if (err) {
      console.log(err);
      res.redirect("/signup");
    } else {
      if (foundUser) {
        errors.push({
          message: "Email id already exists!"
        });
      }
      // NEXT PART OF ERROR CHECKING
      if (errors.length === 0) {
        User.register({
          username: givenUsername
        }, givenPassword1, function(err, user) {
          if (err) {
            res.redirect("/signup");
          } else {
            user.local = {
              fullname: givenFullName,
              email: givenUsername,
              profilePicture: "https://rainerboshoff.co.za/wp-content/uploads/2014/08/Profile-Pic-Demo.png"
            }
            user.loginMethod = "local";
            user.save();
            passport.authenticate("local")(req, res, function() {
              res.redirect("/dashboard");
            });
          }
        });
      } else {
        res.render("signup", {
          errors: errors,
          isLogined: checkLoginValidation(req),
          tempUserData: {
            uname: givenUsername,
            fname: givenFullName,
            pass1: givenPassword1,
            pass2: givenPassword2
          }
        });
      }
    }
  });
});

// LOCAL LOGIN ROUTE
app.post("/login", function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, function(err) {
    console.log(err);
    if (err) {
      console.log(err);
      res.redirect("/login");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/dashboard");
      });
    }
  });
});

// DASHBOARD ROUTE
app.get("/dashboard", function(req, res) {
  let isLogined = false;
  if (req.isAuthenticated()) {
    isLogined = true;
    res.render("dashboard", {
      isLogined: isLogined,
      user: req.user
    });
  } else {
    res.redirect("/login");
  }
});

// REGISTER AND LOGIN
app.get("/signup", function(req, res) {
  let isLogined = false;
  if (req.isAuthenticated()) {
    isLogined = true;
    res.redirect("/dashboard")
  } else {
    let errors = [];
    res.render("signup", {
      isLogined: isLogined,
      errors: errors,
      tempUserData: null
    });
  }
});

app.get("/login", function(req, res) {
  let isLogined = false;
  if (req.isAuthenticated()) {
    isLogined = true;
    res.redirect("/dashboard")
  } else {
    res.render("login", {
      isLogined: isLogined
    });
  }
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

// ERROR 404 ROUTE
app.get("*", function(req, res) {
  let isLogined = false;
  if (req.isAuthenticated()) {
    isLogined = true;
  }
  res.status(404).render('404', {
    isLogined: isLogined
  });
});
// https://raw.githubusercontent.com/rhythmbhiwani/whatsapp_rtu_result/master/README.md


// LISTETING ON PORT
const port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("SERVER STARTED");
});
