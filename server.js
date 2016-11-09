var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");

//PostgresQL queries
var db = require('./db.js');
//Validating and promise helper functions
var fn = require('./functions.js')

var app = express();
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());

var ACCESS_TOKEN = "272855367.b6f7db4.27aee70b486a4fd7b1b5546c1da0453d";

var server = app.listen(process.env.PORT || 8080, function () {
    var port = server.address().port;
    console.log("App now running on port", port);
  });

app.get('/', function(req, res) {
	res.sendfile('index.html');
});

app.get("/getCollection", function(req, res) {
	if(!fn.validateParams(req.query.tag, req.query.startDate, req.query.endDate)) res.status(400).send('Invalid Parameters');
	else {
		db.getPosts(req.query.tag, req.query.startDate, req.query.endDate, function(err, result) {
			if (err) {
				res.status(500).send('Database Query Error');
				console.log(err);
			} else {
				res.send(result.rows);
			}
		});
	}
});

app.post("/createCollection", function(req, res) {
	if(!fn.validateParams(req.body.tag, req.body.startDate, req.body.endDate)){
		res.status(400).send('Invalid Parameters');
		return;
	}
	
	var loop = true;
	var counter = 0;
	var collections = [];
	var tag = req.body.tag;
	var startDate = req.body.startDate;
	var endDate = req.body.endDate;
	var url = "https://api.instagram.com/v1/tags/" + tag + "/media/recent/?access_token=" + ACCESS_TOKEN;
	
	fn.promiseWhile(function() {
		/*	keep paginating through endpoint if we have the next url and the need the next data
		*	Loop only 500 times because of the Instagram API rate-limit of 5k/hr and the Heroku free DB limit of 10k rows
		*	this would be triggered when there is a hashtag that would have > 10k posts on instagram in the time range, since each API call returns 20
		*/
		return url && loop && counter < 500;
	}, function() {
		return fn.getContent(url).then((response) => {
			counter++;
			//instagram API provides the next url to use for paginating through the endpoint
			url = response.pagination.next_url;

			//Might need to do an async request to get the comments of each posts, so make each post return a promise of the data we need from it
			return Promise.all(response.data.map((element) => {
				return new Promise((resolve, reject) => {
					var post = {
						tag: tag,
						username : element.user.username,
						link: element.link,
					};
					if(element.type === 'image') {
						post.type = 'image';
						post.url = element.images.low_resolution.url;
					} else {
						post.type = 'video';
						post.url = element.videos.low_resolution.url;
					}
					var comment_url = 'https://api.instagram.com/v1/media/' + element.id + '/comments?access_token=' + ACCESS_TOKEN;
					
					//Do the Async call to get the comments only if the caption does not contain the tag
					//Otherwise, just resolve the promise with nothing
					Promise.resolve(element.caption.text.search(new RegExp('#' + tag, 'i')) != -1 ? null : fn.getContent(comment_url))
						.then((comments) => {
							//If we got the comments, then look through them for a comment by the submitter of the post
							if (comments) {
								comments.data.forEach((comment) => {
									//If comment was made by the submitter of the post and contains the tag, use its created time as tag time
									if(comment.from.username === post.username && comment.text.search(new RegExp('#' + tag, 'i')) != -1) {
										post.tagtime = comment.created_time;
									}
								});
							}
							//otherwise just use the time the post was created and resolve the promise with post
							else {
								post.tagtime = element.created_time;
							}
							resolve(post);
						});
				});
			})).then((posts) => {
				// filter out the posts that are not in the time range. 
				//dont include posts without tagtimes, it means someone other than submitter commented the tag on the post
				var filtered = posts.filter((post) => {
					if(post.tagtime){
						if(post.tagtime >= startDate && post.tagtime <= endDate) return true;
						//Stop the while loop, all posts in the next API call will also have a time lower than the start Date since the 
						//Instagram API returns in reverse chronological order
						else if (post.tagtime < startDate) {
							loop = false;
						}
					}
					return false;
				});

				return Promise.all(filtered.map((post) => {
					return new Promise((resolve,reject) => {
						db.insertPost(post, function(err, result) {
							if(err) reject(err);
							else resolve();
						})
					});
				}));
			});
		});
	}).then(function() {
		res.send();
	}).catch((err) => {
		console.log(err);
		res.status(500).send('Error Inserting Posts');
	});
}); 
