var pg = require('pg');
pg.defaults.ssl = true;

//DB URL for postgres
var conString = process.env.DATABASE_URL || 'postgres://psmdcjwnzrphnx:pAIIJrQYx9iuJW76VDIDrAQAdk@ec2-54-243-52-115.compute-1.amazonaws.com:5432/dcsl4rj8lf2rjj';

var client = new pg.Client(conString);
client.connect();

function getPosts(tag, startDate, endDate, callback){
	var queryConfig = {
		text: 'SELECT * FROM posts WHERE tag = $1 AND tagtime BETWEEN $2 AND $3 ORDER BY tagtime DESC',
		values: [tag, startDate, endDate]
	};
	client.query(queryConfig, function(err, result) {
		callback(err,result);
	});	
};

function insertPosts(posts, callback){
	//build the SQL values statement to insert all posts at once
	var params = [];
	var chunks = [];
	posts.forEach((post) => {
		var valueClause = [];
		//need to insert in order :(username, tagtime, tag, link, type, url)
		params.push(post.username);
		valueClause.push('$' + params.length);
		
		params.push(post.tagtime);
		valueClause.push('$' + params.length);
		
		params.push(post.tag);
		valueClause.push('$' + params.length);
		
		params.push(post.link);
		valueClause.push('$' + params.length);
		
		params.push(post.type);
		valueClause.push('$' + params.length);
		
		params.push(post.url);
		valueClause.push('$' + params.length);
		
		chunks.push('(' + valueClause.join(', ') + ')')
	});

	//ON CONFLICT DO NOTHING so that if the row is already in the DB, Postgres just doesn't insert it and does not throw duplicate key value error
	// since the primary key in the db is (username, tagtime, tag, link, type, url) and each post is unique
	var q = 'INSERT INTO posts(username, tagtime, tag, link, type, url) VALUES' + chunks.join(', ') + ' ON CONFLICT DO NOTHING';
	client.query(q, params, function(err, result) {
		callback(err,result);
	});
};

module.exports = {
	getPosts: getPosts,
	insertPosts: insertPosts
};
