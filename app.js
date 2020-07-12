// IMPORTING REQUIRED LIBRARIES
require('dotenv').config();
const express = require("express");
const httpsOnly = require('https-only');
const https = require("https");
const ejs = require('ejs');
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const helmet = require('helmet');
const imgbbUploader = require('imgbb-uploader');
const passport = require('passport');
const multer = require('multer');
const fs = require('fs');
const imguploadpath = multer({
  dest: __dirname + '/public/temp/uploads'
});
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const nodemailer = require('nodemailer');
const randomToken = require('random-token');
const {
  generateEmailBody,
  generateResetEmailBody
} = require('./verifyEmailTemplate');
const parseGithubUrl = require("parse-github-url")
const store = new MongoDBStore({
  uri: process.env.MONGODB_SERVER_URL + "/adhocnwDB",
  collection: 'mySessions'
});

// Catch session errors
store.on('error', function(error) {
  console.log(error);
});

// NODEMAILER TRANSPORTER
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.BOT_GMAIL_ID,
    pass: process.env.BOT_GMAIL_PASSWORD
  }
});

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, __dirname + '/public/share/uploads')
  },
  filename: function(req, file, cb) {
    cb(null, file.originalname.replace(/ /g, "_"))
  }
})
const fileShare = multer({
  storage: storage
})

// DEFINING APP AND ITS PARAMETERS
const app = express();
app.use(httpsOnly(true));
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(helmet());
app.use(session({
  secret: process.env.SESSION_SECRET_KEY,
  cookie: {
    maxAge: 259200000
  }, //Age of cookie is 3 days
  store: store,
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// DEFINING MONGOOSE FOR DATABASE
mongoose.connect(process.env.MONGODB_SERVER_URL + "/adhocnwDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  autoIndex: false //To turn off username as unique in database
});
mongoose.set("useCreateIndex", true);

// ACTIVITY LOG SCHEMA
const activitylogSchema = new mongoose.Schema({
  userId: String,
  userLoginMethod: String,
  userEmail: String,
  labName: String,
  labType: String,
  labAccessDateAndTime: String,
  labScore: String
});
const ActivityLog = new mongoose.model("ActivityLog", activitylogSchema);

// PRACTICE LAB SCHEMA
const practiceSchema = new mongoose.Schema({
  thumbnailUrl: String,
  catagory: String,
  labName: String,
  labDescription: String,
  katacodaUsername: String,
  katacodaScenarioName: String
});
const PracticeLab = new mongoose.model("PracticeLab", practiceSchema);

// EXAM LAB SCHEMA
const examSchema = new mongoose.Schema({
  thumbnailUrl: String,
  terminal_selector: String,
  katacoda_username: String,
  katacoda_scenario: String,
  catagory: String,
  labName: String,
  examDetails: String,
  labDataMarkdown: String,
  labDataHTML: String,
  terminal_ip_and_port: String,
  startDateAndTime: String,
  endDateAndTime: String
});
const ExamLab = new mongoose.model("ExamLab", examSchema);


// FEEDBACK SCHEMA
const feedbackSchema = new mongoose.Schema({
  userid: String,
  name: String,
  email: String,
  message: String
});
const Feedback = new mongoose.model("Feedback", feedbackSchema);


// SETTING USER SCHEMA
const userSchema = new mongoose.Schema({
  loginMethod: String,
  role: String,
  accountStatus: String,
  githubURL: String,
  linkedinURL: String,
  bio: String,
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

// SCHEMA FOR VERIFICATION TOKENS
const tokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  token: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
    expires: 43200
  }
});
const Token = new mongoose.model("Token", tokenSchema);


// FUCNTION TO CHECK IF USER IS AUTHENTICATED OR NOT
function checkLoginValidation(req) {
  let isLogined = false;
  if (req.isAuthenticated()) {
    isLogined = true;
  }
  return isLogined;
}

// FUNCTION TO DELETE A FILE
function deleteFile(req) {
  fs.unlink(req.file.path, function(err) {
    if (err) throw err;
  });
}

// FUNCTION TO GET MAIL OPTIONS
function getMailOptions(to, subject, content) {
  const mailOptions = {
    from: process.env.BOT_GMAIL_ID,
    to: to,
    subject: subject,
    html: content
  };
  return mailOptions;
}

// FUNCTION TO CHECK FOR FIRST USER TO MAKE HIM SUPERUSER
function checkFirstUserToMakeSuperUser(userId) {
  checkFirstUserToMakeSuperUser = function(nothing) {};
  User.countDocuments({}, function(err, count) {
    if (count === 1) {
      User.updateOne({
        _id: userId
      }, {
        role: "superuser"
      }, function(err) {
        if (err) {
          console.log("ERROR UPDATING ROLE TO SUPERUSER");
        } else {
          console.log("SUPERUSER CREATED");
        }
      });
    }
  });
}

// SETTING GOOGLE LOGIN STRATEGY
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    callbackURL: process.env.LOGIN_CALLBACK_URL + "/auth/google/googlelogin"
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
            return cb(err, user);
          } else {
            let newUser = new User();
            newUser.loginMethod = "google";
            newUser.role = "standard";
            newUser.accountStatus = "active";
            newUser.google = {
              googleId: googleUserData.id,
              email: googleUserData._json.email,
              fullname: googleUserData._json.name,
              profilePicture: googleUserData._json.picture
            }
            newUser.save(function(err) {
              if (err) {
                console.log("GOOGLE LOGIN :" + err);
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
    callbackURL: process.env.LOGIN_CALLBACK_URL + "/auth/facebook/facebooklogin",
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
            newUser.role = "standard";
            newUser.accountStatus = "active";
            newUser.facebook = {
              facebookId: facebookUserData.id,
              email: facebookUserData._json.email,
              fullname: facebookUserData._json.name,
              profilePicture: facebookUserData._json.picture.data.url
            }
            newUser.save(function(err) {
              if (err) {
                console.log("FACEBOOK LOGIN :" + err);
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
    isLogined: checkLoginValidation(req),
    user: req.user
  });
});

app.get("/questions/:labID", function(req, res) {
  if (req.isAuthenticated()) {
    if (req.user.accountStatus === "pending") {
      res.redirect("/verifyEmail");
    } else if (req.user.accountStatus === "suspended") {
      res.redirect("/logout");
    } else {
      ExamLab.find({
        _id: req.params.labID
      }, function(err, foundLab) {
        if (err) {
          console.log("ERROR FIND QUESTION " + err);
          res.redirect("/dashboard");
        } else {
          if (foundLab) {
            const currentDateAndTime = new Date().toLocaleString("en-US", {
              timeZone: "Asia/Kolkata"
            });
            if (new Date(foundLab[0].startDateAndTime) <= new Date(currentDateAndTime) && new Date(foundLab[0].endDateAndTime) >= new Date(currentDateAndTime) || req.user.role === "superuser") {
              if (req.user.role !== "superuser") {
                const activity = new ActivityLog({
                  userId: req.user._id,
                  userLoginMethod: req.user.loginMethod,
                  userEmail: req.user[req.user.loginMethod].email,
                  labName: foundLab[0].labName,
                  labType: "Exam Lab",
                  labAccessDateAndTime: currentDateAndTime,
                  labScore: "Not Scored Yet"
                });
                activity.save(function(err) {
                  if (err) {
                    console.log("SAVING ACTIVITY FAILED " + err);
                  }
                });
              }
              res.render("questionPanel", {
                isLogined: checkLoginValidation(req),
                user: req.user,
                foundLab: foundLab
              });
            } else {
              res.redirect("/dashboard");
            }
          } else {
            res.redirect("/dashboard");
          }
        }
      });
    }
  } else {
    res.redirect("/login");
  }
});

app.get("/practice/:labID", function(req, res) {
  if (req.isAuthenticated()) {
    if (req.user.accountStatus === "pending") {
      res.redirect("/verifyEmail");
    } else if (req.user.accountStatus === "suspended") {
      res.redirect("/logout");
    } else {
      PracticeLab.find({
        _id: req.params.labID
      }, function(err, foundLab) {
        if (err) {
          console.log("ERROR FINDING PRACTICE LAB " + err);
          res.redirect("/404");
        } else {
          if (foundLab) {
            if (req.user.role !== "superuser") {
              const currentDateAndTime = new Date().toLocaleString("en-US", {
                timeZone: "Asia/Kolkata"
              });
              const activity = new ActivityLog({
                userId: req.user._id,
                userLoginMethod: req.user.loginMethod,
                userEmail: req.user[req.user.loginMethod].email,
                labName: foundLab[0].labName,
                labType: "Practice Lab",
                labAccessDateAndTime: currentDateAndTime.toString(),
                labScore: "Not Applicable"
              });
              activity.save(function(err) {
                if (err) {
                  console.log("ERROR SAVING ACTIVITY " + err);
                }
              });
            }
            res.render("practicePanel", {
              user: req.user,
              isLogined: checkLoginValidation(req),
              foundLab: foundLab[0],
              dashboardIP: process.env.LOGIN_CALLBACK_URL
            });
          } else {
            res.redirect("/404");
          }
        }
      });
    }
  } else {
    res.redirect("/login");
  }
});

// GOOGLE AUTHENTICATION ROUTES
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ["profile", "email"],
    prompt: "select_account"
  }));
app.get('/auth/google/googlelogin',
  passport.authenticate('google', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    const accountStatus = req.user.accountStatus;
    if (accountStatus != "active") {
      req.logout();
      res.render("login", {
        isLogined: checkLoginValidation(req),
        errors: [{
          message: "Cannot log in, you account is in " + accountStatus + " state!"
        }],
        user: req.user,
        tempUserData: null
      });
    } else {
      res.redirect('/dashboard');
    }
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
    const accountStatus = req.user.accountStatus;
    if (accountStatus != "active") {
      req.logout();
      res.render("login", {
        isLogined: checkLoginValidation(req),
        errors: [{
          message: "Cannot log in, you account is in " + accountStatus + " state!"
        }],
        user: req.user,
        tempUserData: null
      });
    } else {
      res.redirect('/dashboard');
    }
  });

// LOCAL SIGNUP ROUTES
app.post("/signup", function(req, res) {
  let errors = [];
  const givenUsername = req.body.username;
  const givenFullName = req.body.fullname;
  const givenPassword1 = req.body.password;
  const givenPassword2 = req.body.confirm_password;
  if (!givenUsername || givenUsername.trim() === '' || givenFullName.trim() === '' || !givenFullName || !givenPassword1 || !givenPassword2) {
    errors.push({
      message: "Please fill all the details!"
    });
  }
  if (givenFullName.length > 25) {
    errors.push({
      message: "Name should be less then 25 characters!"
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
      console.log("SIGNUP :" + err);
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
            console.log("ERROR REGISTERING NEW USER " + err);
            res.redirect("/signup");
          } else {
            user.local = {
              fullname: givenFullName,
              email: givenUsername,
              profilePicture: "/images/demoDP.webp"
            }
            user.loginMethod = "local";
            user.role = "standard";
            user.accountStatus = "pending";
            user.save();
            const token = new Token({
              userId: user._id,
              token: randomToken(24)
            });
            token.save(function(err) {
              if (err) {
                console.log("ERROR SAVING TOKEN " + err);
                res.redirect("/signup");
              } else {
                const content = generateEmailBody(user.local.fullname, process.env.LOGIN_CALLBACK_URL + "/verify/" + token.token + "/" + user._id);
                const mailOptions = getMailOptions(user.username, "AdHoc Networks - Verify you email", content);
                transporter.sendMail(mailOptions, function(err) {
                  if (err) {
                    return res.status(500).send({
                      msg: err.message
                    });
                  }
                });
              }
            });
            passport.authenticate("local")(req, res, function() {
              res.redirect("/verifyEmail");
            });
          }
        });
      } else {
        res.render("signup", {
          errors: errors,
          user: req.user,
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
app.post('/login', function(req, res, next) {
  let errors = [];
  const givenUsername = req.body.username;
  const givenPassword = req.body.password;
  if (!givenUsername || !givenPassword) {
    errors.push({
      message: "Email or password can't be empty!"
    });
  }
  User.findOne({
    username: givenUsername
  }, function(err, foundUser) {
    if (err) {
      console.log("ERROR FINDING USER " + err);
      res.redirect("/login");
    } else {
      if (!foundUser) {
        errors.push({
          message: "No user found with this email!"
        });
        return res.render("login", {
          errors: errors,
          user: req.user,
          isLogined: checkLoginValidation(req),
          tempUserData: {
            uname: givenUsername,
            pass: givenPassword
          }
        });
      } else {
        if (foundUser.accountStatus === "pending") {
          passport.authenticate('local', function(err, user, info) {
            req.logIn(user, function(err) {
              if (err) {
                return next(err);
              }
              return res.redirect('/verifyEmail');
            });
          })(req, res, next);
        } else if (foundUser.accountStatus != "active") {
          errors.push({
            message: "Cannot login, your account is in " + foundUser.accountStatus + " state!"
          });
          return res.render("login", {
            errors: errors,
            user: req.user,
            isLogined: checkLoginValidation(req),
            tempUserData: {
              uname: givenUsername,
              pass: givenPassword
            }
          });
        } else {
          passport.authenticate('local', function(err, user, info) {
            if (err) {
              return next(err);
            }
            if (!user) {
              errors.push({
                message: "Wrong email and password combination!"
              });
              return res.render("login", {
                errors: errors,
                user: req.user,
                isLogined: checkLoginValidation(req),
                tempUserData: {
                  uname: givenUsername,
                  pass: givenPassword
                }
              });
            }
            req.logIn(user, function(err) {
              if (err) {
                return next(err);
              }
              return res.redirect('/dashboard');
            });
          })(req, res, next);
        }
      }
    }
  });
});


// VERIFY EMAIL ROUTE
app.get("/verifyEmail", function(req, res) {
  if (req.isAuthenticated()) {
    if (req.user.accountStatus === "active") {
      res.redirect("/dashboard");
    } else {
      res.render("verifyEmail", {
        user: req.user,
        isLogined: checkLoginValidation(req),
        action: "verify"
      });
    }
  } else {
    res.redirect("/login");
  }
});

// ROUTE TO VERIFY EMAIL IDs
app.get("/verify/:submittedToken/:userId", function(req, res) {
  if (req.isAuthenticated() && req.user.accountStatus === "active") {
    res.redirect("/dashboard");
  } else {
    Token.findOne({
      token: req.params.submittedToken,
      userId: req.params.userId
    }, function(err, foundToken) {
      if (err) {
        console.log("ERROR FINDING TOKEN : " + err);
      } else {
        if (foundToken) {
          User.findOne({
            _id: req.params.userId
          }, function(err, foundUser) {
            if (err) {
              console.log("ERROR FINDING USER " + err);
            } else {
              if (foundUser) {
                foundUser.accountStatus = "active";
                foundUser.save(function(err) {
                  if (err) {
                    console.log("ERROR UPDATING USER ACCOUT STATUS " + err);
                    res.redirect("/login");
                  } else {
                    res.redirect("/dashboard");
                  }
                });
              }
            }
          });
        } else {
          res.redirect("/verifyEmail");
        }
      }
    });
  }
});

// RESEND TOKEN ROUTE
app.get("/resendToken", function(req, res) {
  if (req.isAuthenticated()) {
    if (req.user.accountStatus === "active") {
      res.redirect("/dashboard");
    } else if (req.user.accountStatus === "pending") {
      const token = new Token({
        userId: req.user._id,
        token: randomToken(24)
      });
      token.save(function(err) {
        if (err) {
          console.log("ERROR SAVING TOKEN " + err);
          res.redirect("/signup");
        } else {
          const content = generateEmailBody(req.user.local.fullname, process.env.LOGIN_CALLBACK_URL + "/verify/" + token.token + "/" + req.user._id);
          const mailOptions = getMailOptions(req.user.username, "AdHoc Networks - Verify you email", content);
          transporter.sendMail(mailOptions, function(err) {
            if (err) {
              return res.status(500).send({
                msg: err.message
              });
            }
          });
        }
      });
      res.render("verifyEmail", {
        user: req.user,
        isLogined: checkLoginValidation(req),
        action: "resend"
      });
    }
  } else {
    res.redirect("/login");
  }
});

// ROUTE FOR RESET PASSWORD PAGE
app.get("/resetPassword", function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/dashboard");
  } else {
    res.render("resetPassword", {
      user: req.user,
      isLogined: checkLoginValidation(req),
      action: "resetrequest"
    });
  }
});

app.get("/resetPassword/:token/:userId", function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/dashboard");
  } else {
    Token.findOne({
      token: req.params.token,
      userId: req.params.userId
    }, function(err, foundToken) {
      if (err) {
        console.log("ERROR FINDING TOKEN " + err);
        res.render("resetPassword", {
          user: req.user,
          isLogined: checkLoginValidation(req),
          action: "incorrectdata"
        });
      } else {
        if (foundToken) {
          res.render("resetPassword", {
            user: req.user,
            isLogined: checkLoginValidation(req),
            foundToken: foundToken,
            errors: [],
            action: "changepassword"
          });
        } else {
          res.render("resetPassword", {
            user: req.user,
            isLogined: checkLoginValidation(req),
            action: "incorrectdata"
          });
        }
      }
    });
  }
});

// POST ROUTE FOR RESET PASSWORD
app.post("/resetPassword", function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/dashboard");
  } else {
    if (req.body.action === "resetrequest") {
      User.findOne({
        username: req.body.username
      }, function(err, foundUser) {
        if (err) {
          console.log("ERROR FINDING USER " + err);
          res.redirect("/resetPassword");
        } else {
          if (foundUser) {
            const token = new Token({
              userId: foundUser._id,
              token: randomToken(24)
            });
            token.save(function(err) {
              if (err) {
                console.log("ERROR SAVING TOKEN " + err);
                res.redirect("/resetPassword");
              } else {
                const content = generateResetEmailBody(foundUser.local.fullname, process.env.LOGIN_CALLBACK_URL + "/resetPassword/" + token.token + "/" + foundUser._id);
                const mailOptions = getMailOptions(foundUser.username, "AdHoc Networks - Forget your password", content);
                transporter.sendMail(mailOptions, function(err) {
                  if (err) {
                    return res.status(500).send({
                      msg: err.message
                    });
                  }
                });
              }
            });
          }
        }
      });
      res.render("resetPassword", {
        user: req.user,
        isLogined: checkLoginValidation(req),
        resetEmail: req.body.username,
        action: "sentemail"
      });
    } else if (req.body.action === "changepassword") {
      Token.findOne({
        token: req.body.hidden_verification_token,
        userId: req.body.hidden_user_id
      }, function(err, foundToken) {
        if (err) {
          console.log("ERROR FINDING TOKEN " + err);
          res.redirect("/resetPassword");
        } else {
          if (foundToken) {
            let errors = [];
            if (!req.body.new_password || !req.body.confirm_password || req.body.new_password.trim() === '' || req.body.confirm_password.trim() === '') {
              errors.push({
                message: "Please enter all fields correctly!"
              });
            }
            if (req.body.new_password && req.body.new_password.length < 8 || req.body.confirm_password && req.body.confirm_password.length < 8) {
              errors.push({
                message: "Password should be 8-20 characters long!"
              });
            }
            if (req.body.new_password != req.body.confirm_password) {
              errors.push({
                message: "Passwords don't match!"
              });
            }
            if (errors.length > 0) {
              res.render("resetPassword", {
                user: req.user,
                isLogined: checkLoginValidation(req),
                resetEmail: req.body.username,
                errors: errors,
                foundToken: foundToken,
                action: "changepassword"
              });
            } else {
              User.findOne({
                _id: req.body.hidden_user_id
              }, function(err, foundUser) {
                if (err) {
                  console.log("ERROR FINDING USER " + err);
                  res.redirect("/resetPassword");
                } else {
                  if (foundUser) {
                    foundUser.setPassword(req.body.new_password, function(err) {
                      if (err) {
                        console.log("ERROR SETTING PASSWORD " + err);
                        res.redirect("/resetPassword");
                      } else {
                        foundUser.save(function(err) {
                          if (err) {
                            console.log("ERROR SETTING PASSWORD " + err);
                            res.redirect("/resetPassword");
                          } else {
                            Token.deleteMany({
                              userId: req.body.hidden_user_id
                            }, function(err) {
                              if (err) {
                                console.log("ERROR DELETING TOKENS " + err);
                              }
                            });
                          }
                        });
                        res.redirect("/login");
                      }
                    });
                  } else {
                    res.redirect("/resetPassword");
                  }
                }
              });
            }
          } else {
            res.render("resetPassword", {
              user: req.user,
              isLogined: checkLoginValidation(req),
              action: "incorrectdata"
            });
          }
        }
      });
    } else {
      res.redirect("/resetPassword");
    }

  }
});

// DASHBOARD ROUTE
app.get("/dashboard", function(req, res) {
  if (req.isAuthenticated()) {
    if (req.user.accountStatus === "pending") {
      res.redirect("/verifyEmail");
    } else if (req.user.accountStatus === "suspended") {
      res.redirect("/logout");
    } else {
      PracticeLab.find({}, function(err, foundLab) {
        if (err) {
          console.log("ERROR SEARCHING PRACTICE LAB " + err);
          res.redirect("/dashboard");
        } else {
          if (foundLab) {
            ExamLab.find({}, function(err, examFoundLabs) {
              if (err) {
                console.log("ERROR FINDING EXAM LAB " + err);
                res.redirect("/dashboard");
              } else {
                checkFirstUserToMakeSuperUser(req.user._id);
                if (examFoundLabs) {
                  res.render("dashboard", {
                    isLogined: checkLoginValidation(req),
                    user: req.user,
                    foundLab: foundLab,
                    examFoundLabs: examFoundLabs,
                    getCurrentDateAndTime: new Date(new Date().toLocaleString("en-US", {
                      timeZone: "Asia/Kolkata"
                    }))
                  });
                }
              }
            });

          }
        }
      });
    }
  } else {
    res.redirect("/login");
  }
});


// VIEW SHARED FILES ROUTE
app.get("/sharedfiles", function(req, res) {
  if (req.isAuthenticated()) {
    if (req.user.accountStatus === "pending") {
      res.redirect("/verifyEmail");
    } else if (req.user.accountStatus === "suspended") {
      res.redirect("/logout");
    } else {
      fs.readdir(__dirname + "/public/share/uploads", function(err, files) {
        if (err) {
          return console.log('Unable to scan directory: ' + err);
        }
        var allFiles = {};
        files.forEach(function(file) {
          const mydate = new Date(fs.statSync(__dirname + "/public/share/uploads/" + file).mtimeMs);
          const month = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
          ][mydate.getMonth()];
          if (file !== "nomedia") {
            allFiles[file] = mydate.getDate() + " " + month + " " + mydate.getFullYear();
          }
        });

        res.render("sharedFiles", {
          isLogined: checkLoginValidation(req),
          user: req.user,
          allFiles: allFiles
        });
      });
    }
  } else {
    res.redirect("/login");
  }
});

// PROFILE SECTION ROUTE
app.get("/profile", function(req, res) {
  if (req.isAuthenticated()) {
    if (req.user.accountStatus === "pending") {
      res.redirect("/verifyEmail");
    } else if (req.user.accountStatus === "suspended") {
      res.redirect("/logout");
    } else {
      ActivityLog.find({
        userId: req.user._id
      }, function(err, activity) {
        if (err) {
          console.log("ERROR FINDING ACTIVITY LOG " + err);
          res.redirect("/profile");
        } else {
          res.render("profile", {
            isLogined: checkLoginValidation(req),
            user: req.user,
            alertType: "",
            errors: [],
            activites: activity
          });
        }
      });
    }
  } else {
    res.redirect("/login");
  }
});

// REGISTER AND LOGIN
app.get("/signup", function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/dashboard");
  } else {
    let errors = [];
    res.render("signup", {
      isLogined: checkLoginValidation(req),
      errors: errors,
      user: req.user,
      tempUserData: null
    });
  }
});

app.get("/login", function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/dashboard");
  } else {
    let errors = [];
    res.render("login", {
      isLogined: checkLoginValidation(req),
      errors: errors,
      user: req.user,
      tempUserData: null
    });
  }
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

// FEEDBACK SUBMIT ROUTE
app.post("/submitfeedback", function(req, res) {
  const newFeedback = new Feedback({
    userid: req.body.userid,
    name: req.body.feedback_author,
    email: req.body.feedback_email,
    message: req.body.feedback_message
  });
  newFeedback.save();
  res.redirect("/");
});

// UPDATE INFO ROUTE
app.post("/profile-info-update", function(req, res) {
  if (req.isAuthenticated()) {
    if (req.user.accountStatus === "pending") {
      res.redirect("/verifyEmail");
    } else if (req.user.accountStatus === "suspended") {
      res.redirect("/logout");
    } else {
      User.findById(req.user.id, function(err, foundUser) {
        if (err) {
          console.log("ERROR FINDING USER " + err);
          res.redirect("/profile");
        } else {
          if (foundUser) {
            foundUser.bio = req.body.profile_bio;
            foundUser.githubURL = req.body.profile_githubUsername.trim() == "" ? "" : parseGithubUrl(req.body.profile_githubUsername).path;
            foundUser.linkedinURL = req.body.profile_linkedinUsername;
            foundUser.save(function(err) {
              if (!err) {
                res.redirect("/profile");
              }
            });

          }
        }
      });
    }
  } else {
    res.redirect("/login");
  }
});

// UPDATE PROFILE PICTURE
app.post('/upload/img', imguploadpath.single('profile_img'), (req, res) => {
  if (req.file.mimetype === "image/png" || req.file.mimetype === "image/jpg" || req.file.mimetype === "image/jpeg") {
    imgbbUploader(process.env.IMGBB_API_KEY, req.file.path)
      .then(function(response) {
        User.findById(req.user.id, function(err, foundUser) {
          if (err) {
            console.log("NO USER:" + err);
            res.redirect("/profile");
          } else {
            if (foundUser) {
              foundUser[foundUser.loginMethod].profilePicture = response.url;
              foundUser.save(function(err) {
                deleteFile(req);
                res.redirect("/profile");
              });
            }
          }
        })
      })
      .catch(function(error) {
        console.error("ERROR" + req);
        res.redirect("/profile");
        deleteFile(req);
      })
  } else {
    console.log("Error uploading profile pic");
    deleteFile(req);
    res.redirect("/profile");
  };

});


// CHANGE PASSWORD ROUTE
app.post("/changePassword", function(req, res) {
  let errors = [];
  const profile_currentPassword = req.body.profile_currentPassword;
  const profile_newPassword = req.body.profile_newPassword;
  const profile_confirmPassword = req.body.profile_confirmPassword;
  if (req.isAuthenticated()) {
    if (req.user.accountStatus === "pending") {
      res.redirect("/verifyEmail");
    } else if (req.user.accountStatus === "suspended") {
      res.redirect("/logout");
    } else {
      if (!profile_currentPassword || !profile_newPassword || !profile_confirmPassword || profile_currentPassword.trim() === '' || profile_newPassword.trim() === '' || profile_confirmPassword.trim() === '') {
        errors.push({
          message: "Please enter all fields correctly!"
        });
      }
      if (profile_newPassword && profile_newPassword.length < 8 || profile_confirmPassword && profile_confirmPassword.length < 8) {
        errors.push({
          message: "Password should be 8-20 characters long!"
        });
      }
      if (profile_newPassword != profile_confirmPassword) {
        errors.push({
          message: "Passwords don't match!"
        });
      }
      if (errors.length > 0) {
        ActivityLog.find({
          userId: req.user._id
        }, function(err, activity) {
          if (err) {
            console.log("ERROR FINDING ACTIVITY LOG " + err);
            res.redirect("/profile");
          } else {
            res.render("profile", {
              isLogined: checkLoginValidation(req),
              user: req.user,
              alertType: "danger",
              errors: errors,
              activites: activity
            });
          }
        });
      } else {
        req.user.changePassword(profile_currentPassword, profile_newPassword, function(err) {
          if (err) {
            console.log("CHANGE PASSWORD ERROR " + err);
            ActivityLog.find({
              userId: req.user._id
            }, function(err, activity) {
              if (err) {
                console.log("ERROR FINDING ACTIVITY LOG " + err);
                res.redirect("/profile");
              } else {
                res.render("profile", {
                  isLogined: checkLoginValidation(req),
                  user: req.user,
                  alertType: "danger",
                  errors: [{
                    message: "Wrong Current Password!"
                  }],
                  activites: activity
                });
              }
            });
          } else {
            ActivityLog.find({
              userId: req.user._id
            }, function(err, activity) {
              if (err) {
                console.log("ERROR FINDING ACTIVITY LOG " + err);
                res.redirect("/profile");
              } else {
                res.render("profile", {
                  isLogined: checkLoginValidation(req),
                  user: req.user,
                  alertType: "success",
                  errors: [{
                    message: "Password Successfully Changed!"
                  }],
                  activites: activity
                });
              }
            });
          }
        });
      }
    }
  } else {
    res.redirect("/login");
  }
});

// SUPPORT PAGE ROUTE
app.get("/support", function(req, res) {
  res.render("supportPage", {
    isLogined: checkLoginValidation(req),
    user: req.user
  });
});


// ROUTE TO ADMIN CONSOLE
app.get("/powerzone", function(req, res) {
  if (req.isAuthenticated()) {
    if (req.user.accountStatus === "pending") {
      res.redirect("/verifyEmail");
    } else if (req.user.accountStatus === "suspended") {
      res.redirect("/logout");
    } else {
      if (req.user.role != "superuser") {
        res.render("adminPanel/403", {
          isLogined: checkLoginValidation(req),
          user: req.user
        });
      } else {
        Promise.all([
          User.countDocuments({}),
          PracticeLab.countDocuments({}),
          ExamLab.countDocuments({}),
          Feedback.countDocuments({})
        ]).then(function([userCount, practiceLabCount, examLabCount, feedbackCount]) {
          res.render("adminPanel/adminDash", {
            isLogined: checkLoginValidation(req),
            user: req.user,
            pageType: "dashboard",
            userCount: userCount,
            practiceLabCount: practiceLabCount,
            examLabCount: examLabCount,
            feedbackCount: feedbackCount
          });
        });
      }
    }
  } else {
    res.redirect("/login");
  }
});

// ROUTE TO ADDITIONAL POWERZONE SETTINGS
app.get("/powerzone/:setting", function(req, res) {
  if (req.isAuthenticated()) {
    if (req.user.accountStatus === "pending") {
      res.redirect("/verifyEmail");
    } else if (req.user.accountStatus === "suspended") {
      res.redirect("/logout");
    } else {
      if (req.user.role != "superuser") {
        res.render("adminPanel/403", {
          isLogined: checkLoginValidation(req),
          user: req.user
        });
      } else {
        if (req.params.setting === "manageUsers") {
          User.find({}, function(err, foundUsers) {
            if (err) {
              console.log("USER FIND ERROR " + err);
              res.redirect("/powerzone");
            } else {
              if (foundUsers) {
                res.render("adminPanel/adminManageUsers", {
                  isLogined: checkLoginValidation(req),
                  user: req.user,
                  pageType: "manageusers",
                  foundUsers: foundUsers
                });
              }
            }
          });
        } else if (req.params.setting === "practiceLabs") {
          PracticeLab.find({}, function(err, foundLab) {
            if (err) {
              console.log("ERROR FINDING PRACTICE LAB " + err);
              res.redirect("/powerzone");
            } else {
              if (foundLab) {
                res.render("adminPanel/adminPracticeLab", {
                  isLogined: checkLoginValidation(req),
                  user: req.user,
                  pageType: "plabs",
                  foundLab: foundLab
                });
              }
            }
          });
        } else if (req.params.setting === "examLabs") {
          ExamLab.find({}, function(err, foundLab) {
            if (err) {
              console.log("ERROR FINDING EXAM LAB " + err);
              res.redirect("/powerzone");
            } else {
              if (foundLab) {
                res.render("adminPanel/adminExamLab", {
                  isLogined: checkLoginValidation(req),
                  user: req.user,
                  pageType: "elabs",
                  foundLab: foundLab
                });
              }
            }
          });
        } else if (req.params.setting === "userFeedbacks") {
          Feedback.find({}, function(err, feedbacks) {
            if (err) {
              console.log("ERROR FINDING FEEDBACKS " + err);
              res.redirect("/powerzone");
            } else {
              if (feedbacks) {
                res.render("adminPanel/adminFeedbackPanel", {
                  isLogined: checkLoginValidation(req),
                  user: req.user,
                  pageType: "userfeedback",
                  feedbacks: feedbacks
                });
              }
            }
          });
        } else if (req.params.setting === "labActivityLog") {
          ActivityLog.find({}, function(err, foundLogs) {
            if (err) {
              console.log("ERROR FINDING ACTIVITY LOG " + err);
              res.redirect("/powerzone/labActivityLog");
            } else {
              if (foundLogs) {
                res.render("adminPanel/adminLabActivityLog", {
                  isLogined: checkLoginValidation(req),
                  user: req.user,
                  pageType: "labActivityLog",
                  activityLogs: foundLogs
                });
              }
            }
          });
        } else if (req.params.setting === "shareFiles") {
          fs.readdir(__dirname + "/public/share/uploads", function(err, files) {
            if (err) {
              return console.log('Unable to scan directory: ' + err);
            }
            var allFiles = {};
            files.forEach(function(file) {
              const mydate = new Date(fs.statSync(__dirname + "/public/share/uploads/" + file).mtimeMs);
              const month = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
              ][mydate.getMonth()];
              if (file !== "nomedia") {
                allFiles[file] = mydate.getDate() + " " + month + " " + mydate.getFullYear();
              }
            });
            res.render("adminPanel/adminShareFiles", {
              isLogined: checkLoginValidation(req),
              user: req.user,
              pageType: "share",
              allFiles: allFiles
            });
          });
        } else {
          res.redirect("/powerzone");
        }
      }
    }
  } else {
    res.redirect("/login");
  }
});

// POWERZONE POST ROUTES
app.post("/powerzone/:setting", function(req, res) {
  if (req.isAuthenticated()) {
    if (req.user.accountStatus === "pending") {
      res.redirect("/verifyEmail");
    } else if (req.user.accountStatus === "suspended") {
      res.redirect("/logout");
    } else {
      if (req.user.role != "superuser") {
        res.render("adminPanel/403", {
          isLogined: checkLoginValidation(req),
          user: req.user
        });
      } else {
        if (req.params.setting === "addPracticeLab") {
          const newLab = new PracticeLab({
            thumbnailUrl: req.body.thumbnailUrl,
            catagory: req.body.catagory,
            labName: req.body.labName,
            labDescription: req.body.labDescription,
            katacodaUsername: req.body.katacodaUsername,
            katacodaScenarioName: req.body.katacodaScenarioName
          });
          newLab.save(function(err) {
            if (err) {
              console.log("ERROR SAVING NEW PRACTICE LAB " + err);
            }
            res.redirect("/powerzone/practiceLabs");
          });
        } else if (req.params.setting === "editPracticeLab") {
          PracticeLab.updateOne({
            _id: req.body.labID
          }, req.body, function(err) {
            res.redirect("/powerzone/practiceLabs");
          });
        } else if (req.params.setting === "deletePracticeLab") {
          PracticeLab.deleteOne({
            _id: req.body.labID
          }, function(err) {
            res.redirect("/powerzone/practiceLabs");
          });
        } else if (req.params.setting === "suspendUser") {
          if (req.body.accountStatus === "activate") {
            User.updateOne({
              _id: req.body.hiddenUserId
            }, {
              accountStatus: "active"
            }, function(err) {
              if (err) {
                console.log("ERROR UPDATING USER STATUS " + err);
              }
              res.redirect("/powerzone/manageUsers");
            });
          } else if (req.body.accountStatus === "suspend") {
            User.updateOne({
              _id: req.body.hiddenUserId
            }, {
              accountStatus: "suspended"
            }, function(err) {
              if (err) {
                console.log("ERROR UPDATING USER STATUS " + err);
              }
              res.redirect("/powerzone/manageUsers");
            });
          }

        } else if (req.params.setting === "addExamLab") {
          const newLab = new ExamLab({
            thumbnailUrl: req.body.thumbnailUrl,
            terminal_selector: req.body.terminal_selector,
            katacoda_scenario: req.body.katacoda_scenario,
            katacoda_username: req.body.katacoda_username,
            catagory: req.body.catagory,
            labName: req.body.labName,
            examDetails: req.body.examDetails,
            labDataMarkdown: req.body.labDataMarkdown,
            labDataHTML: req.body.labDataHTML,
            terminal_ip_and_port: req.body.terminal_ip_and_port,
            startDateAndTime: req.body.startDateAndTime,
            endDateAndTime: req.body.endDateAndTime
          });
          newLab.save(function(err) {
            if (err) {
              console.log("ERROR SAVING NEW EXAM LAB " + err);
            }
            res.redirect("/powerzone/examLabs");
          });
        } else if (req.params.setting === "editExamLabForm") {
          ExamLab.updateOne({
            _id: req.body.labID
          }, req.body, function(err) {
            res.redirect("/powerzone/examLabs");
          });
        } else if (req.params.setting === "deleteExamLab") {
          ExamLab.deleteOne({
            _id: req.body.labID
          }, function(err) {
            res.redirect("/powerzone/examLabs");
          });
        }
      }
    }
  } else {
    res.redirect("/login");
  }
});

// SHARE FILE UPLOAD ROUTE
app.post('/shareFiles', fileShare.any(), (req, res, next) => {
  res.redirect("/powerzone/shareFiles");
})

// DELETE FILE ROUTE
app.post("/deleteFile", function(req, res) {
  fs.unlink(__dirname + "/public/share/uploads/" + req.body.fileName, function(err) {
    if (err) throw err;
  });
  res.redirect("/powerzone/shareFiles");
});

// ERROR 404 ROUTE
app.get("*", function(req, res) {
  res.status(404).render('404', {
    isLogined: checkLoginValidation(req),
    user: req.user
  });
});

// Error handler
if (process.env.NODE_ENV !== "development") {
  app.use(function(err, req, res, next) {
    res.redirect('https://' + req.headers.host + req.url);
  })
}

// LISTETING ON PORT
const port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("SERVER STARTED");
});
