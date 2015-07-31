var assert = require('assert');

assert(process.env.CLIENT_ID, 'Env CLIENT_ID needs to be set');
assert(process.env.CLIENT_SECRET, 'Env CLIENT_SECRET needs to be set');
assert(process.argv[2], 'Need to pass in a second argument (dev|prod)');

var fs = require('fs');
var Path = require('path');
var util = require('util');
var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth2').Strategy;
var session = require('express-session');
var SessionFileStore = require('session-file-store')(session);
var gcal = require('google-calendar');
var dirty = require('dirty');
var db = dirty('user.db');
var mu = require('mu2');
mu.root = Path.join(__dirname, 'public');
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
    db.set('profile' + profile.id, {
      token: token,
      displayName: profile.displayName
    }, function(err) {
      done(err, {
        id: profile.id,
        token: token
      });
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
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', function (req, res) {
  if (req.user && req.user.token) {
    res.redirect(302, '/loggedin');
  }
  else {
    if (config.clear_mu_cache) {
      mu.clearCache();
    }
    var stream = mu.compileAndRender('index.html', {});
    util.pump(stream, res);
  }
});

app.get('/loggedin', function (req, res, next) {
  if (!req.user || !req.user.token) {
    return res.redirect(302, '/');
  }

  var now = new Date();
  // var now = new Date('2015-07-27T11:05:00.000Z');
  // var now = new Date('2015-07-30T09:10:00.000Z');

  var calendar = new gcal.GoogleCalendar(req.user.token);
  calendar.events.list('0rlmj64nd2kk41q3jldro6s8sk@group.calendar.google.com', {
    timeMin: now.toISOString(),
    timeMax: new Date(+now + 100 * 60 * 60 * 1000).toISOString(),
    singleEvents: true
  }, function(err, list) {
    if (err) {
      if (err.message === 'Invalid Credentials') {
        return res.redirect(302, '/auth/google');
      }
      return next(JSON.stringify(err));
    }

    var items = list.items.map(function(item) {
      return [new Date(item.start.dateTime), new Date(item.end.dateTime)];
    }).sort(function(a, b) {
      return a[0] - b[0];
    });
    // Make meeting blocks into one
    items = items.reduce(function (curr, item, ix) {
      if (!curr.length) {
        curr.push(item);
        return curr;
      }

      if (curr[curr.length-1][1] === item[0]) {
        curr[curr.length-1][1] = item[1];
      }
      else {
        curr.push(item);
      }
      return curr;
    }, []);

    var opts = {
      room: 'Boven de Balie Meetingroom #1',
      noMotion: false,
      motionText: 'Motion detected',
      calendar: '0rlmj64nd2kk41q3jldro6s8sk@group.calendar.google.com'
    };

    if (items.length && items[0][0] < now) {
      opts.freeText = 'Booked';
      var minutesLeft = (items[0][1] -  now) / 1000 / 60 | 0;
      opts.nextText = 'For the next ' + minutesLeft + ' minutes';
      opts.disabled15 = true;
      opts.disabled30 = true;
      opts.disabled60 = true;
    }
    else {
      var minutesFromNow;
      if (!items.length) {
        minutesFromNow = 60;
      }
      else {
        minutesFromNow = ((items[0][0] - now) / 1000 / 60) | 0;
        if (minutesFromNow > 60) {
          minutesFromNow = 60;
        }
      }

      opts.freeText = 'Free';
      opts.nextText = minutesFromNow === 60 ?
        'Next hour' :
        'Next ' + minutesFromNow + ' minutes';
      opts.disabled15 = minutesFromNow < 15;
      opts.disabled30 = minutesFromNow < 30;
      opts.disabled60 = minutesFromNow < 60;
    }

    if (config.clear_mu_cache) {
      mu.clearCache();
    }

    var stream = mu.compileAndRender('room.html', opts);
    util.pump(stream, res);
  });
});

app.post('/book', function(req, res, next) {
  var time;
  if (typeof req.body.b15 !== undefined) {
    time = 15;
  }
  else if (typeof req.body.b30 !== undefined) {
    time = 30;
  }
  else if (typeof req.body.b60 !== undefined) {
    time = 60;
  }
  else {
    return next('Could not figure out which button you pressed');
  }

  var calendar = new gcal.GoogleCalendar(req.user.token);
  calendar.events.insert(req.body.calendar, {
    start: {
      dateTime: new Date().toISOString()
    },
    end: {
      dateTime: new Date(Date.now() + (time * 60 * 1000)).toISOString()
    },
    summary: req.user.displayName
  }, function(err, other) {
    if (err) return next(err);

    if (config.clear_mu_cache) {
      mu.clearCache();
    }
    var stream = mu.compileAndRender('booked-ok.html', {
      room: 'Boven de Balie Meetingroom #1',
      duration: time
    });
    util.pump(stream, res);
  });
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
