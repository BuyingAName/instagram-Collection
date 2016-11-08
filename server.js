var express = require("express");
var https = require('https');
var path = require("path");
var bodyParser = require("body-parser");
var pg = require('pg');
pg.defaults.ssl = true;


var app = express();
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());

var ACCESS_TOKEN = "272855367.b6f7db4.27aee70b486a4fd7b1b5546c1da0453d";

//DB URL for postgres
var conString = process.env.DATABASE_URL || 'postgres://psmdcjwnzrphnx:pAIIJrQYx9iuJW76VDIDrAQAdk@ec2-54-243-52-115.compute-1.amazonaws.com:5432/dcsl4rj8lf2rjj'
;

var client = new pg.Client(conString);
client.connect();

var server = app.listen(process.env.PORT || 8080, function () {
    var port = server.address().port;
    console.log("App now running on port", port);
  });

//make the default node https function return a promise with the response in JSON format
const getContent = function(url) {
	return new Promise((resolve, reject) => {
		var request = https.get(url, (response) => {
			var body ='';
			response.on('data', (d) => body += d);
			response.on('end', () => resolve(JSON.parse(body)));
		});
		request.on('error', (err) => reject(err));
	});
};

var validateParams = function(tag, start, end) {
	//Hashtags cannot contain special characters or spaces
	var regex = new RegExp('[$-/:-?{-~!"^`\[\]\s]');
	if(regex.test(tag)) return false;
	if(start %1 != 0 || start < 0) return false;
	if(end %1 != 0 || end < 0) return false;
	if(start >= end) return false;
	return true;
};

var promiseWhile = function(condition, action) {
	return new Promise((resolve, reject) => {
		var loop = function() {
			if(!condition()) resolve();	
			else Promise.resolve(action()).then(loop, reject);
		};
		process.nextTick(loop);
	});	
};

app.get('/', function(req, res) {
	res.sendfile('index.html');
});

app.get("/getCollection", function(req, res) {
	//Get the posts from the database
	console.log(req.query);
	if(!validateParams(req.query.tag, req.query.startDate, req.query.endDate)) res.status(400).send('Invalid Parameters');
	else {
		var queryConfig = {
			text: 'SELECT * FROM posts', //WHERE tag = $1 and tagtime BETWEEN $2 AND $3',
			//values: [req.query.tag, req.query.startDate, req.query.endDate]
		};
		client.query(queryConfig, function(err, result) {
			if (err) {
				res.status(500).send('Database Query Error');
				console.log(err);
			} else {
				console.log(result.rows);
				res.send(result.rows);
			}
		});
	}
});

app.post("/createCollection", function(req, res) {
	var loop = true;
	var counter = 0;
	var tag = "qqqqqqw";
	//"WCH2016"//
	var startDate = Math.floor(new Date(2016, 1).getTime() / 1000); 
	//'1477700000';
	var endDate = Math.floor(Date.now() / 1000);
	console.log(req.body.tag);

	if (tag === req.body.tag) console.log("USING REQ.BODY");
	
	if(!validateParams(req.body.tag, req.body.startDate, req.body.endDate)){
		res.status(400).send('Invalid Parameters');
		return;
	}

	tag = req.body.tag;
	var url = "https://api.instagram.com/v1/tags/" + tag + "/media/recent/?access_token=" + ACCESS_TOKEN;
	console.log('URL ' + counter + ' ' + url);
	var collections = [];

	startDate = req.body.startDate;
	
	promiseWhile(function() {
		//keep paginating through endpoint if we have the next url and the need the next data
		return url && loop && counter < 500;
	}, function() {
		return getContent(url).then((response) => {
			counter++;
			//instagram API provides the next url to use for paginating through the endpoint
			url = response.pagination.next_url;
			if (url) console.log('URL' + counter + ' ' +url);
			else console.log('NO URL');

			//Might need to do an async request to get the comments of each posts, so make each post return a promise of the data we need from it
			Promise.all(response.data.map((element) => {
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
					Promise.resolve(element.caption.text.search(new RegExp('#' + tag, 'i')) != -1 ? null : getContent(comment_url))
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
							else post.tagtime = element.created_time;
							resolve(post);
						});
				});
			})).then((posts) => {
				// filter out the posts that are not in the time range. 
				//dont include posts without tagtimes, it means someone other than submitter commented the tag on the post
				posts = posts.filter((post) => {
					if(post.tagtime){
						if(post.tagtime >= startDate && post.tagtime <= endDate) return true;
						//Stop the while loop, all posts in the next API call will also have a time lower than the start Date since the 
						//Instagram API returns in reverse chronological order
						else if (post.tagtime < startDate) {
							loop = false;
							console.log('ended loop cause of ' +  post.tagtime + ' from ' + post.link);
						}
					}
					//console.log('filtered out ' +  post.tagtime + ' from ' + post.link);
					return false;
				});
				posts.forEach((post) => {
					 var sql = 'INSERT INTO posts(username, tagtime, tag, link, type, url) values ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING';
					 client.query(sql, [post.username, post.tagtime, post.tag, post.link, post.type, post.url]);
					 console.log([post.username, post.tagtime, post.tag, post.link, post.type, post.url]);
				}); 
				//insert posts into DB
			});
		});
	}).then(function() {
		console.log('done');
		res.send("ff");
	});
}); 
