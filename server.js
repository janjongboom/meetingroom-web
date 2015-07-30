var assert = require('assert');

assert(process.env.CLIENT_ID, 'Env CLIENT_ID needs to be set');
assert(process.env.CLIENT_SECRET, 'Env CLIENT_SECRET needs to be set');
assert(process.argv[2], 'Need to pass in a second argument (dev|prod)');

var fs = require('fs');
var Path = require('path');
var express = require('express');
var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth2').Strategy;
var session = require('express-session');
var SessionFileStore = require('session-file-store')(session);
var dirty = require('dirty');
var db = dirty('user.db');
var config = JSON.parse(fs.readFileSync(
  Path.join(__dirname, 'config', process.argv[2] + '.json')));

// Set up datastore
var db = dirty(Path.join(__dirname, 'db', 'meetingroom.db'));

// Register Googles OAuth strategy here
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: config.hostname + '/auth/google/callback'
  },
  function(token, tokenSecret, profile, done) {
    db.set('profile' + profile.id, { token: token }, function(err) {
      done(err, { id: profile.id, token: token });
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(userId, done) {
  done(null, db.get('profile' + userId));
});

// Express routes
var app = express();

app.use(session({
  store: new SessionFileStore({
    path: Path.join(__dirname, 'db', 'sessions')
  }),
  secret: process.env.CLIENT_SECRET
}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.get('/loggedin', function (req, res) {
  res.send(JSON.stringify(req.user));
});

app.get('/auth/google', passport.authenticate('google', {
  scope: ['email', 'https://www.googleapis.com/auth/calendar']
}));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication
    res.redirect('/loggedin');
  });

var server = app.listen(process.env.PORT, process.env.HOST, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Listening at http://%s:%s', host, port);
});
