var pg = require('pg');
pg.defaults.ssl = true;

//DB URL for postgres
var conString = process.env.DATABASE_URL || 'postgres://psmdcjwnzrphnx:pAIIJrQYx9iuJW76VDIDrAQAdk@ec2-54-243-52-115.compute-1.amazonaws.com:5432/dcsl4rj8lf2rjj';

var client = new pg.Client(conString);
client.connect();

function getPosts(tag, startDate, endDate, callback){
	var queryConfig = {
		text: 'SELECT * FROM posts WHERE tag = $1 and tagtime BETWEEN $2 AND $3',
		values: [tag, startDate, endDate]
	};
	client.query(queryConfig, function(err, result) {
		callback(err,result);
	});	
};

function insertPost(post, callback){
	var sql = 'INSERT INTO posts(username, tagtime, tag, link, type, url) values ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING';
	client.query(sql, [post.username, post.tagtime, post.tag, post.link, post.type, post.url], function(err, result) {
		callback(err,result);
	});
};

module.exports = {
	getPosts: getPosts,
	insertPost: insertPost
};
