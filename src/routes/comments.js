const express = require('express');

const CommentControler = require('../controllers/CommentController');
const jwtAuth = require('../midlewares/jwtAuth');

let router = express.Router();

router.get('/list/:product_id', CommentControler.list);

router.get('/detail/:comment_id', jwtAuth, CommentControler.detail);

router.post('/create', jwtAuth, CommentControler.create);

router.put('/update', jwtAuth, CommentControler.update);

router.post('/reply/create', jwtAuth, CommentControler.createReply);

router.get('/:commentId/replies', CommentControler.getReplies);

module.exports = router;
