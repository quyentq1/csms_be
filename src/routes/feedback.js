const express = require('express');

const FeedbackController = require('../controllers/FeedbackController');
const jwtAuth = require('../midlewares/jwtAuth');

let router = express.Router();

router.get('/list/:product_id', FeedbackController.list);

router.get('/detail/:product_variant_id', jwtAuth, FeedbackController.detail);

router.post('/create', jwtAuth, FeedbackController.create);

router.put('/update', jwtAuth, FeedbackController.update);

router.post('/getFeedback', FeedbackController.getFeedbacks);

router.post('/predict', FeedbackController.predictFeedback);


module.exports = router;
