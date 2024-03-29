/*
CSC3916 HW4
File: Server.js
Description: Web API scaffolding for Movie API
 */

var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews');
require('dotenv').config();

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

const uri = process.env.DB;
const port = process.env.PORT || 8080;

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

  const GA_TRACKING_ID = process.env.GA_KEY;

  function trackDimension(category, action, label, value, dimension, metric) {
  
      var options = { method: 'GET',
          url: 'https://www.google-analytics.com/collect',
          qs:
              {   // API Version.
                  v: '1',
                  // Tracking ID / Property ID.
                  tid: GA_TRACKING_ID,
                  // Random Client Identifier. Ideally, this should be a UUID that
                  // is associated with particular user, device, or browser instance.
                  cid: crypto.randomBytes(16).toString("hex"),
                  // Event hit type.
                  t: 'event',
                  // Event category.
                  ec: category,
                  // Event action.
                  ea: action,
                  // Event label.
                  el: label,
                  // Event value.
                  ev: value,
                  // Custom Dimension
                  cd1: dimension,
                  // Custom Metric
                  cm1: metric
              },
          headers:
              {  'Cache-Control': 'no-cache' } };
  
      return rp(options);
  }


router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err);
            }

            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

router.post('/signin', function (req, res) {
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) {
            res.send(err);
        }

        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});
//REVIEW ROUTES

//post route to add a review
router.post('/reviews', authJwtController.isAuthenticated, (req, res) => {
    const { movieId, username, review, rating } = req.body;

    // Create a new review and save it to the database
    const newReview = new Review({ movieId, username, review, rating });
    newReview.save()
        .then(savedReview => {
            res.status(200).json({ message: 'Review created!', review: savedReview });
            trackDimension('Feedback', 'Rating', 'Feedback for Movie', '3', 'Guardian\'s of the Galaxy 2', '1')
            .then(function (response) {
                console.log(response.body);
            })
        })
        .catch(error => {
            res.status(500).json({ error: 'An error occurred while saving the review' });
        });
});

//get route to get a review
router.get('/reviews', authJwtController.isAuthenticated, (req, res) => {
    const includeReviews = req.query.reviews === 'true';

    if (includeReviews) {
        // Fetch reviews along with movie details
        Review.aggregate([
            {
                $lookup: {
                    from: 'movies', // name of the movies collection
                    localField: 'movieId',
                    foreignField: '_id',
                    as: 'movieDetails' // output array where the joined movie details will be placed
                }
            },
            {
                $unwind: '$movieDetails' // unwind the movie array
            }
        ]).exec((err, aggregatedData) => {
            if (err) {
                console.error('Error aggregating reviews:', err);
                res.status(500).json({ error: 'An error occurred while aggregating reviews' });
            } else {
                res.status(200).json(aggregatedData);
            }
        });
    } else {
        // Fetch all reviews
        Review.find()
            .then(reviews => {
                res.status(200).json(reviews);
            })
            .catch(error => {
                console.error('Error fetching reviews:', error);
                res.status(500).json({ error: 'An error occurred while fetching reviews' });
            });
    }
});
app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only


